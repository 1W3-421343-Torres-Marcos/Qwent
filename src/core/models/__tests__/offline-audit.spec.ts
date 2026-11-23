import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT_DIR, 'src');

function collectFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      results.push(...collectFilesRecursive(fullPath));
    } else if (/\.(ts|html|css|json)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Offline Audit & Android Packaging Compliance (F6.3)', () => {
  it('contains zero external HTTP/HTTPS URLs anywhere in runtime src/ and assets/', () => {
    const files = collectFilesRecursive(SRC_DIR);
    expect(files.length).toBeGreaterThan(10);

    const externalUrls: string[] = [];
    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf8');
      const matches = content.match(/https?:\/\/[^\s"'`)>]+/g) ?? [];
      for (const url of matches) {
        if (!url.startsWith('http://www.w3.org/')) {
          externalUrls.push(`${path.relative(ROOT_DIR, filePath)} -> ${url}`);
        }
      }
    }

    expect(externalUrls).toEqual([]);
  });

  it('AndroidManifest.xml enforces sensorLandscape and declares zero network or sensitive permissions', () => {
    const manifestPath = path.join(
      ROOT_DIR,
      'android',
      'app',
      'src',
      'main',
      'AndroidManifest.xml',
    );
    const manifest = readFileSync(manifestPath, 'utf8');

    expect(manifest).toContain('android:screenOrientation="sensorLandscape"');
    expect(manifest).not.toContain('android.permission.INTERNET');
    expect(manifest).not.toContain('android.permission.CAMERA');
    expect(manifest).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(manifest).not.toContain('android.permission.READ_CONTACTS');
    expect(manifest).not.toContain('android.permission.WRITE_EXTERNAL_STORAGE');
  });

  it('capacitor.config.ts stays 100% local and Android adaptive icon + splash resources exist', () => {
    const capConfig = readFileSync(path.join(ROOT_DIR, 'capacitor.config.ts'), 'utf8');
    expect(capConfig).not.toMatch(/https?:\/\//);
    expect(capConfig).not.toContain('url:');

    const resDir = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');
    const requiredResources = [
      'values/colors.xml',
      'values/styles.xml',
      'drawable/qwent_launcher_background.xml',
      'drawable/qwent_launcher_foreground.xml',
      'drawable/qwent_splash.xml',
      'mipmap-anydpi-v26/ic_launcher.xml',
      'mipmap-anydpi-v26/ic_launcher_round.xml',
    ];
    for (const rel of requiredResources) {
      expect(existsSync(path.join(resDir, rel))).toBe(true);
    }

    const styles = readFileSync(path.join(resDir, 'values', 'styles.xml'), 'utf8');
    expect(styles).toContain('@drawable/qwent_splash');
  });
});
