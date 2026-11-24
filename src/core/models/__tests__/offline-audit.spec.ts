import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getExpectedAltSpriteIds } from '../../../app/shared/constants/card-art.utils';

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

  it('embeds valid offline JPEG portraits in src/assets/cards/ covering all 181 cards, 4 tokens and 31 alt variants without orphans', () => {
    const cardsJson = JSON.parse(
      readFileSync(path.join(SRC_DIR, 'assets', 'data', 'cards.json'), 'utf8'),
    ) as ReadonlyArray<{ readonly id: string; readonly name: string; readonly description: string }>;
    expect(cardsJson).toHaveLength(181);

    const validIds = new Set(cardsJson.map((card) => card.id));
    validIds.add('nt_bovine_defense_force');
    validIds.add('sk_hemdall');
    validIds.add('sk_vildkaarl');
    validIds.add('sk_young_vildkaarl');
    for (const altId of getExpectedAltSpriteIds()) {
      validIds.add(altId);
    }

    const spritesDir = path.join(SRC_DIR, 'assets', 'cards');
    expect(existsSync(spritesDir)).toBe(true);

    const jpgFiles = readdirSync(spritesDir).filter((name) => name.endsWith('.jpg'));
    expect(jpgFiles.length).toBe(216);
    expect(jpgFiles.length).toBe(validIds.size);

    for (const fileName of jpgFiles) {
      const cardId = fileName.slice(0, -4);
      expect(validIds.has(cardId)).toBe(true);

      const bytes = readFileSync(path.join(spritesDir, fileName));
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes[2]).toBe(0xff);
    }
  });

  it('localizes all 181 catalog card names and descriptions to Spanish without English dataset residue', () => {
    const cardsJson = JSON.parse(
      readFileSync(path.join(SRC_DIR, 'assets', 'data', 'cards.json'), 'utf8'),
    ) as ReadonlyArray<{ readonly id: string; readonly name: string; readonly description: string }>;

    const englishResiduePattern = /\b(the|and|with|your|from|when|for|you|this|that|they|their|were|are|have|has|northern realms|nilfgaardian empire|siege tower|grave hag)\b/i;
    const unlocalized = cardsJson.filter((card) =>
      englishResiduePattern.test(`${card.name} ${card.description}`),
    );
    expect(unlocalized).toEqual([]);
  });

  it('embeds all 30 offline SFX and 4 tavern BGM MP3 files with valid audio headers', () => {
    const expectedSfx = [
      'common_close.mp3',
      'common_ranged.mp3',
      'common_siege.mp3',
      'hero.mp3',
      'bond.mp3',
      'morale.mp3',
      'horn.mp3',
      'mardroeme.mp3',
      'medic.mp3',
      'muster.mp3',
      'spy.mp3',
      'decoy.mp3',
      'scorch.mp3',
      'frost.mp3',
      'fog.mp3',
      'rain.mp3',
      'clear.mp3',
      'ui_card.mp3',
      'ui_card_bank.mp3',
      'draw.mp3',
      'redraw.mp3',
      'pass.mp3',
      'turn_me.mp3',
      'turn_op.mp3',
      'round1_start.mp3',
      'round_win.mp3',
      'round_lose.mp3',
      'game_start.mp3',
      'game_win.mp3',
      'game_lose.mp3',
    ] as const;

    const expectedMusic = ['tavern_1.mp3', 'tavern_2.mp3', 'tavern_3.mp3', 'tavern_4.mp3'] as const;

    const assertValidMp3Dir = (dir: string, files: readonly string[], minBytes: number): void => {
      expect(existsSync(dir)).toBe(true);
      const actual = readdirSync(dir)
        .filter((name) => name.endsWith('.mp3'))
        .sort();
      expect(actual).toEqual([...files].sort());

      for (const file of files) {
        const bytes = readFileSync(path.join(dir, file));
        expect(bytes.byteLength).toBeGreaterThan(minBytes);
        const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
        const hasMpegSync = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
        expect(hasId3 || hasMpegSync).toBe(true);
      }
    };

    assertValidMp3Dir(path.join(SRC_DIR, 'assets', 'audio', 'sfx'), expectedSfx, 1000);
    assertValidMp3Dir(path.join(SRC_DIR, 'assets', 'audio', 'music'), expectedMusic, 10000);
  });
});
