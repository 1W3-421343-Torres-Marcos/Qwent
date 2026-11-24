import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isWin = process.platform === 'win32';
const rootDir = process.cwd();
const androidDir = path.resolve(rootDir, 'android');

/**
 * Parses `--phase=<id>` from CLI args, defaulting to `f1`.
 */
function parsePhaseArg(argv) {
  const arg = argv.find((item) => item.startsWith('--phase='));
  const raw = arg ? arg.split('=')[1] : 'f1';
  const normalized = (raw || 'f1').trim().toLowerCase();
  if (!/^[fu]\d+$/.test(normalized)) {
    throw new Error(`Formato de fase inválido "${normalized}". Usa ej: --phase=f1 o --phase=u1`);
  }
  return normalized;
}

/**
 * Runs a command synchronously and aborts immediately on non-zero exit.
 */
function runStep(command, args, options = {}) {
  const display = `${command} ${args.join(' ')}`.trim();
  console.log(`\n==> ${display}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? rootDir,
    shell: options.shell ?? false,
    env: options.env ?? process.env,
  });

  if (result.error) {
    throw new Error(`Error ejecutando "${display}": ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`El comando "${display}" falló con código ${result.status}`);
  }
}

/**
 * Validates JAVA_HOME (or java in PATH) and resolves ANDROID_HOME / local.properties.
 */
function ensureAndroidToolchain() {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome && !existsSync(javaHome)) {
    throw new Error(`JAVA_HOME apunta a una ruta inexistente: ${javaHome}`);
  }
  if (!javaHome) {
    const javaCheck = spawnSync('java', ['-version'], { stdio: 'ignore', shell: isWin });
    if (javaCheck.status !== 0) {
      throw new Error('No se encontró JAVA_HOME ni el ejecutable "java" en PATH.');
    }
  }

  const localPropertiesPath = path.join(androidDir, 'local.properties');
  if (existsSync(localPropertiesPath)) {
    const content = readFileSync(localPropertiesPath, 'utf8');
    if (/^sdk\.dir=.+/m.test(content)) {
      return;
    }
  }

  const defaultSdk = isWin
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
    : path.join(os.homedir(), 'Android', 'Sdk');

  const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdk;
  if (!existsSync(sdkDir)) {
    throw new Error(
      `No se encontró Android SDK en ANDROID_HOME, ANDROID_SDK_ROOT ni en ${defaultSdk}.`,
    );
  }

  const escapedSdkDir = sdkDir.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  writeFileSync(localPropertiesPath, `sdk.dir=${escapedSdkDir}${os.EOL}`, 'utf8');
  console.log(`Generado android/local.properties con sdk.dir=${sdkDir}`);
}

function main() {
  const phase = parsePhaseArg(process.argv.slice(2));
  ensureAndroidToolchain();

  const npmCmd = isWin ? 'npm.cmd' : 'npm';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';
  const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';

  runStep(npmCmd, ['test'], { shell: isWin });
  runStep(npmCmd, ['run', 'build'], { shell: isWin });
  runStep(npxCmd, ['cap', 'sync', 'android'], { shell: isWin });
  runStep(gradleCmd, ['assembleDebug'], { cwd: androidDir, shell: isWin });

  const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!existsSync(sourceApk)) {
    throw new Error(`No se encontró el APK compilado en ${sourceApk}`);
  }

  const outputDir = path.resolve(rootDir, 'builds', 'apks');
  mkdirSync(outputDir, { recursive: true });
  const targetApk = path.join(outputDir, `gwent-${phase}-debug.apk`);
  copyFileSync(sourceApk, targetApk);

  const sizeMb = (statSync(targetApk).size / (1024 * 1024)).toFixed(2);
  console.log(`\n[OK] APK generado: ${targetApk} (${sizeMb} MB)`);
}

main();
