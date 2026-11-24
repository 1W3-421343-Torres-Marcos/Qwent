import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SFX_BASE_URL = 'https://raw.githubusercontent.com/asundr/gwent-classic/main/sfx/';
const MUSIC_BASE_URL = 'https://raw.githubusercontent.com/ia2904/gwent-classic-v5.0/main/audio/';
const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/asundr/gwent-classic/main/img/sm/';

const SFX_OUTPUT_DIR = path.resolve(process.cwd(), 'src/assets/audio/sfx');
const MUSIC_OUTPUT_DIR = path.resolve(process.cwd(), 'src/assets/audio/music');
const CARDS_OUTPUT_DIR = path.resolve(process.cwd(), 'src/assets/cards');

const SFX_FILES: readonly string[] = [
  'common_close',
  'common_ranged',
  'common_siege',
  'hero',
  'bond',
  'morale',
  'horn',
  'medic',
  'muster',
  'spy',
  'decoy',
  'scorch',
  'frost',
  'fog',
  'rain',
  'clear',
  'ui_card',
  'ui_card_bank',
  'draw',
  'redraw',
  'pass',
  'turn_me',
  'turn_op',
  'round1_start',
  'round_win',
  'round_lose',
  'game_start',
  'game_win',
  'game_lose',
];

const MUSIC_TRACK_MAP: ReadonlyArray<{ readonly source: string; readonly target: string }> = [
  { source: 'track1.mp3', target: 'tavern_1.mp3' },
  { source: 'track4.mp3', target: 'tavern_2.mp3' },
  { source: 'track8.mp3', target: 'tavern_3.mp3' },
  { source: 'track13.mp3', target: 'tavern_4.mp3' },
];

interface DownloadJob {
  readonly kind: 'SFX' | 'BGM' | 'JPEG';
  readonly url: string;
  readonly targetPath: string;
  readonly validate: (bytes: Uint8Array) => boolean;
}

function isValidMp3(buffer: Uint8Array): boolean {
  if (buffer.byteLength <= 1000) return false;
  const hasId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  const hasMpegSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3 || hasMpegSync;
}

function isValidJpeg(buffer: Uint8Array): boolean {
  return (
    buffer.byteLength > 1000 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

async function importAudioAssets(): Promise<void> {
  const force = process.argv.includes('--force');

  mkdirSync(SFX_OUTPUT_DIR, { recursive: true });
  mkdirSync(MUSIC_OUTPUT_DIR, { recursive: true });
  mkdirSync(CARDS_OUTPUT_DIR, { recursive: true });

  const jobs: DownloadJob[] = [
    ...SFX_FILES.map(
      (name): DownloadJob => ({
        kind: 'SFX',
        url: `${SFX_BASE_URL}${name}.mp3`,
        targetPath: path.join(SFX_OUTPUT_DIR, `${name}.mp3`),
        validate: isValidMp3,
      }),
    ),
    ...MUSIC_TRACK_MAP.map(
      (track): DownloadJob => ({
        kind: 'BGM',
        url: `${MUSIC_BASE_URL}${track.source}`,
        targetPath: path.join(MUSIC_OUTPUT_DIR, track.target),
        validate: isValidMp3,
      }),
    ),
    {
      kind: 'JPEG',
      url: `${SPRITE_BASE_URL}neutral_chort.jpg`,
      targetPath: path.join(CARDS_OUTPUT_DIR, 'nt_bovine_defense_force.jpg'),
      validate: isValidJpeg,
    },
  ];

  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;
  const queue = [...jobs];
  const workerCount = 6;

  async function runWorker(): Promise<void> {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;

      if (!force && existsSync(job.targetPath)) {
        const existing = readFileSync(job.targetPath);
        if (job.validate(existing)) {
          skipped += 1;
          totalBytes += existing.byteLength;
          continue;
        }
      }

      const response = await fetch(job.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al descargar ${job.url}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!job.validate(bytes)) {
        throw new Error(`Archivo ${job.kind} inválido tras descargar: ${job.url}`);
      }

      writeFileSync(job.targetPath, bytes);
      downloaded += 1;
      totalBytes += bytes.byteLength;
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[AUDIO OK] ${SFX_FILES.length} SFX + ${MUSIC_TRACK_MAP.length} BGM + 1 token sprite (${downloaded} descargados, ${skipped} existentes, ${mb} MB totales)`,
  );
}

importAudioAssets().catch((err: unknown) => {
  console.error('[AUDIO ERROR]', err);
  process.exit(1);
});
