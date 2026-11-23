import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ABILITY_TYPES,
  LEADER_ABILITY_TYPES,
  ROW_TYPES,
  type AbilityType,
  type CardDefinition,
  type CardType,
  type FactionId,
  type LeaderAbilityType,
  type RowType,
} from '../src/core/models/types.ts';

export interface RawCardRecord {
  readonly id?: string;
  readonly name?: string;
  readonly faction?: string;
  readonly type?: string;
  readonly baseStrength?: number | string;
  readonly isHero?: boolean | string;
  readonly allowedRows?: readonly string[] | string;
  readonly ability?: string | null;
  readonly bondGroup?: string | null;
  readonly musterGroup?: string | null;
  readonly leaderAbility?: string | null;
  readonly maxCopies?: number | string;
  readonly description?: string;
  readonly artVariant?: string | null;
}

const VALID_FACTIONS: ReadonlySet<FactionId> = new Set([
  'NORTHERN_REALMS',
  'NILFGAARD',
  'MONSTERS',
  'SCOIATAEL',
  'NEUTRAL',
]);

const VALID_TYPES: ReadonlySet<CardType> = new Set(['UNIT', 'SPECIAL', 'LEADER']);
const VALID_ROWS: ReadonlySet<RowType> = new Set(ROW_TYPES);
const VALID_ABILITIES: ReadonlySet<AbilityType> = new Set(ABILITY_TYPES);
const VALID_LEADER_ABILITIES: ReadonlySet<LeaderAbilityType> = new Set(LEADER_ABILITY_TYPES);

const FACTION_SORT_ORDER: Readonly<Record<FactionId, number>> = {
  NORTHERN_REALMS: 0,
  NILFGAARD: 1,
  MONSTERS: 2,
  SCOIATAEL: 3,
  NEUTRAL: 4,
};

const TYPE_SORT_ORDER: Readonly<Record<CardType, number>> = {
  LEADER: 0,
  UNIT: 1,
  SPECIAL: 2,
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses an RFC-4180 CSV dataset string into normalized RawCardRecord objects.
 */
export function parseCsvDataset(csvContent: string): readonly RawCardRecord[] {
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!);
  const records: RawCardRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let col = 0; col < headers.length; col++) {
      const header = headers[col];
      if (header) {
        row[header] = values[col] ?? '';
      }
    }
    records.push(row as RawCardRecord);
  }

  return records;
}

function parseBoolean(value: boolean | string | undefined, field: string, id: string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    if (norm === 'true' || norm === '1' || norm === 'yes') return true;
    if (norm === 'false' || norm === '0' || norm === 'no' || norm === '') return false;
  }
  if (value === undefined) return false;
  throw new Error(`Valor booleano inválido en ${field} para "${id}": ${String(value)}`);
}

function parseInteger(value: number | string | undefined, field: string, id: string): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) return parsed;
  }
  throw new Error(`Entero inválido en ${field} para "${id}": ${String(value)}`);
}

function parseAllowedRows(rawRows: readonly string[] | string | undefined, id: string): readonly RowType[] {
  let parts: string[];
  if (Array.isArray(rawRows)) {
    parts = rawRows.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof rawRows === 'string') {
    const trimmed = rawRows.trim();
    if (!trimmed) {
      parts = [];
    } else if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`allowedRows inválido en "${id}".`);
      }
      parts = parsed.map((item) => String(item).trim()).filter(Boolean);
    } else {
      parts = trimmed
        .split(/[|;,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else {
    parts = [];
  }

  const deduped: RowType[] = [];
  for (const part of parts) {
    if (!VALID_ROWS.has(part as RowType)) {
      throw new Error(`Fila inválida "${part}" en "${id}".`);
    }
    if (!deduped.includes(part as RowType)) {
      deduped.push(part as RowType);
    }
  }
  return deduped;
}

/**
 * Validates and normalizes a raw CSV/JSON card entry into a strict CardDefinition.
 */
export function normalizeCardRecord(raw: RawCardRecord): CardDefinition {
  const id = (raw.id ?? '').trim();
  if (!id) {
    throw new Error('Registro de carta sin "id".');
  }

  const name = (raw.name ?? '').trim();
  if (!name) {
    throw new Error(`Carta "${id}" sin "name".`);
  }

  const faction = (raw.faction ?? '').trim() as FactionId;
  if (!VALID_FACTIONS.has(faction)) {
    throw new Error(`Facción inválida "${String(raw.faction)}" en "${id}".`);
  }

  const type = (raw.type ?? '').trim() as CardType;
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Tipo inválido "${String(raw.type)}" en "${id}".`);
  }

  const baseStrength = parseInteger(raw.baseStrength ?? 0, 'baseStrength', id);
  if (baseStrength < 0) {
    throw new Error(`baseStrength negativo en "${id}": ${baseStrength}`);
  }

  const isHero = parseBoolean(raw.isHero ?? false, 'isHero', id);
  const allowedRows = parseAllowedRows(raw.allowedRows, id);

  const rawAbility = raw.ability === undefined || raw.ability === null ? '' : String(raw.ability).trim();
  const ability = rawAbility === '' ? null : (rawAbility as AbilityType);
  if (ability !== null && !VALID_ABILITIES.has(ability)) {
    throw new Error(`Habilidad inválida "${ability}" en "${id}".`);
  }

  const maxCopies = parseInteger(raw.maxCopies ?? 1, 'maxCopies', id);
  if (maxCopies < 1) {
    throw new Error(`maxCopies inválido en "${id}": ${maxCopies}`);
  }

  const rawLeaderAbility =
    raw.leaderAbility === undefined || raw.leaderAbility === null ? '' : String(raw.leaderAbility).trim();
  const leaderAbility = rawLeaderAbility === '' ? undefined : (rawLeaderAbility as LeaderAbilityType);

  if (type === 'UNIT' && allowedRows.length === 0) {
    throw new Error(`Unidad "${id}" debe declarar al menos 1 fila en allowedRows.`);
  }

  if (type === 'LEADER') {
    if (faction === 'NEUTRAL') {
      throw new Error(`Líder "${id}" no puede pertenecer a NEUTRAL.`);
    }
    if (baseStrength !== 0 || allowedRows.length !== 0 || maxCopies !== 1) {
      throw new Error(`Líder "${id}" debe tener baseStrength=0, allowedRows=[], maxCopies=1.`);
    }
    if (!leaderAbility || !VALID_LEADER_ABILITIES.has(leaderAbility)) {
      throw new Error(`Líder "${id}" tiene leaderAbility inválida: ${String(raw.leaderAbility)}`);
    }
  }

  const bondGroup = raw.bondGroup?.trim() || undefined;
  const musterGroup = raw.musterGroup?.trim() || undefined;
  const description = (raw.description ?? '').trim();

  return {
    id,
    name,
    faction,
    type,
    baseStrength,
    isHero,
    allowedRows,
    ability,
    ...(bondGroup ? { bondGroup } : {}),
    ...(musterGroup ? { musterGroup } : {}),
    ...(leaderAbility ? { leaderAbility } : {}),
    maxCopies,
    description,
  };
}

/**
 * Transforms raw records into a deterministically ordered, schema-validated catalog.
 * Rows sharing an ID with explicit `artVariant` consolidate `maxCopies` into a single ID;
 * unintended duplicate IDs without `artVariant` throw immediately.
 */
export function transformDatasetToCatalog(records: readonly RawCardRecord[]): readonly CardDefinition[] {
  const byId = new Map<string, { def: CardDefinition; hasVariant: boolean }>();

  for (const raw of records) {
    const def = normalizeCardRecord(raw);
    const hasVariant = Boolean(raw.artVariant && raw.artVariant.trim().length > 0);
    const existing = byId.get(def.id);

    if (!existing) {
      byId.set(def.id, { def, hasVariant });
      continue;
    }

    if (!hasVariant && !existing.hasVariant) {
      throw new Error(`ID duplicado en dataset de entrada: "${def.id}".`);
    }

    const mergedMaxCopies = existing.def.maxCopies + def.maxCopies;
    byId.set(def.id, {
      def: {
        ...existing.def,
        maxCopies: mergedMaxCopies,
      },
      hasVariant: true,
    });
  }

  return [...byId.values()]
    .map((entry) => entry.def)
    .sort((a, b) => {
      const factionDiff = FACTION_SORT_ORDER[a.faction] - FACTION_SORT_ORDER[b.faction];
      if (factionDiff !== 0) return factionDiff;

      const typeDiff = TYPE_SORT_ORDER[a.type] - TYPE_SORT_ORDER[b.type];
      if (typeDiff !== 0) return typeDiff;

      const nameDiff = a.name.localeCompare(b.name, 'es');
      if (nameDiff !== 0) return nameDiff;

      return a.id.localeCompare(b.id, 'en');
    });
}

/**
 * Reads a curated CSV or JSON dataset, transforms it deterministically, and writes cards.json.
 */
export function runEtl(inputPath: string, outputPath: string): readonly CardDefinition[] {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);
  const rawContent = readFileSync(resolvedInput, 'utf8');
  const ext = path.extname(resolvedInput).toLowerCase();

  let records: readonly RawCardRecord[];
  if (ext === '.csv') {
    records = parseCsvDataset(rawContent);
  } else if (ext === '.json') {
    const parsed = JSON.parse(rawContent) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`El dataset JSON "${resolvedInput}" debe ser un array de cartas.`);
    }
    records = parsed as readonly RawCardRecord[];
  } else {
    throw new Error(`Formato no soportado "${ext}". Usa .csv o .json.`);
  }

  const catalog = transformDatasetToCatalog(records);
  writeFileSync(resolvedOutput, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return catalog;
}

function parseCliArgs(argv: readonly string[]): { input: string; output: string } {
  let input = 'scripts/data/base-cards.json';
  let output = 'src/assets/data/cards.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--input' && argv[i + 1]) {
      input = argv[++i]!;
    } else if (arg.startsWith('--input=')) {
      input = arg.slice('--input='.length);
    } else if (arg === '--output' && argv[i + 1]) {
      output = argv[++i]!;
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    }
  }

  return { input, output };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentModulePath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath === currentModulePath) {
  const { input, output } = parseCliArgs(process.argv.slice(2));
  const catalog = runEtl(input, output);
  console.log(`[ETL OK] ${catalog.length} cartas validadas y escritas en ${output}`);
}
