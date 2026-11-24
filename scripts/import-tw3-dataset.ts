import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AbilityType, CardDefinition, FactionId, PlayableFactionId, RowType } from '../src/core/models/types.ts';
import { runEtl } from './etl-cards.ts';

interface AboeUnitRecord {
  readonly Name: string;
  readonly Occurrences?: number;
  readonly Deckable?: string;
  readonly Faction: string;
  readonly Hero?: string;
  readonly 'Combat 1'?: string;
  readonly 'Combat 2'?: string;
  readonly 'Combat 3'?: string;
  readonly Strength?: number;
  readonly 'Effect 1'?: string;
  readonly 'Effect 2'?: string;
  readonly 'Effect Prefix'?: string;
  readonly DLC?: string;
  readonly Quote?: string;
}

const FACTION_PREFIX: Readonly<Record<FactionId, string>> = {
  NORTHERN_REALMS: 'nr',
  NILFGAARD: 'ng',
  MONSTERS: 'mo',
  SCOIATAEL: 'st',
  NEUTRAL: 'nt',
};

const FACTION_MAP: Readonly<Record<string, FactionId>> = {
  'Northern Realms': 'NORTHERN_REALMS',
  'Nilfgaardian Empire': 'NILFGAARD',
  Monsters: 'MONSTERS',
  "Scoia'tael": 'SCOIATAEL',
  Neutral: 'NEUTRAL',
};

const ROW_MAP: Readonly<Record<string, RowType>> = {
  Close: 'CLOSE_COMBAT',
  Ranged: 'RANGED',
  Siege: 'SIEGE',
};

// Maps English names in tw3-gwent-source.json to existing IDs in base-cards.json to avoid duplicates
const EXISTING_SOURCE_NAME_TO_BASE_ID: Readonly<Record<string, string>> = {
  'Blue Stripes Commando': 'nr_blue_stripes_commando',
  'Crinfrid Reavers Dragon Hunter': 'nr_crinfrid_reavers',
  'Kaedweni Siege Expert': 'nr_kaedweni_siege_expert',
  'Prince Stennis': 'nr_prince_stennis',
  'Dun Banner Medic': 'nr_dun_banner_medic',
  Ves: 'nr_ves',
  Ballista: 'nr_ballista',
  Trebuchet: 'nr_trebuchet',
  'Vernon Roche': 'nr_vernon_roche',
  'Esterad Thyssen': 'nr_esterad_thyssen',
  'Impera Brigade Guard': 'ng_impera_brigade',
  'Nausicaa Cavalry Rider': 'ng_nausicaa_cavalry',
  'Stefan Skellen': 'ng_stefan_skellen',
  'Etolian Auxiliary Archers': 'ng_etolian_auxiliary',
  'Black Infantry Archer': 'ng_black_infantry_archer',
  'Cahir Mawr Dyffryn aep Ceallach': 'ng_cahir',
  'Zerrikanian Fire Scorpion': 'ng_zerrikanian_fire_scorpion',
  'Heavy Zerrikanian Fire Scorpion': 'ng_heavy_zerrikanian_fire_scorpion',
  'Letho of Gulet': 'ng_letho_of_gulet',
  'Tibor Eggebracht': 'ng_tibor_eggebracht',
  Nekker: 'mo_nekker',
  Ghoul: 'mo_ghoul',
  Arachas: 'mo_arachas',
  'Arachas Behemoth': 'mo_arachas_behemoth',
  Harpy: 'mo_harpy',
  'Ice Giant': 'mo_ice_giant',
  'Earth Elemental': 'mo_earth_elemental',
  Fiend: 'mo_fiend',
  Toad: 'mo_toad',
  Kayran: 'mo_kayran',
  Imlerith: 'mo_imlerith',
  Leshen: 'mo_leshen',
  'Elven Skirmisher': 'st_elven_skirmisher',
  'Havekar Healer': 'st_havekar_healer',
  'Havekar Smuggler': 'st_havekar_smuggler',
  'Dol Blathanna Scout': 'st_dol_blathanna_scout',
  'Vrihedd Brigade Veteran': 'st_vrihedd_brigade',
  'Mahakaman Defender': 'st_mahakaman_defender',
  Milva: 'st_milva',
  Schirru: 'st_schirru',
  Iorveth: 'st_iorveth',
  Eithne: 'st_eithne',
  Saesenthessis: 'st_saesenthessis',
  "Gaunter O'Dimm": 'nt_gaunter_odimm',
  "Gaunter O'Dimm Darkness": 'nt_gaunter_darkness',
  'Olgierd Von Everec': 'nt_olgierd_von_everec',
  Dandelion: 'nt_dandelion',
  Villentretenmerth: 'nt_villentretenmerth',
  'Mysterious Elf': 'nt_mysterious_elf',
  'Yennefer of Vengerberg': 'nt_yennefer_of_vengerberg',
  'Geralt of Rivia': 'nt_geralt_of_rivia',
  'Biting Frost': 'sp_biting_frost',
  'Impenetrable Fog': 'sp_impenetrable_fog',
  'Torrential Rain': 'sp_torrential_rain',
  'Clear Weather': 'sp_clear_weather',
  "Commander's Horn": 'sp_commanders_horn',
  Decoy: 'sp_decoy',
  Scorch: 'sp_scorch',
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapAbility(raw: AboeUnitRecord): AbilityType | null {
  const eff1 = raw['Effect 1'];
  const eff2 = raw['Effect 2'];
  const effects = [eff1, eff2].filter((e): e is string => Boolean(e && e !== 'Agile'));

  for (const eff of effects) {
    switch (eff) {
      case 'Bond':
        return 'TIGHT_BOND';
      case 'Morale':
        return 'MORALE_BOOST';
      case 'Spy':
        return 'SPY';
      case 'Medic':
        return 'MEDIC';
      case 'Muster':
        return 'MUSTER';
      case 'Scorch':
        return 'SCORCH_ROW';
      case 'Horn':
        return 'COMMANDERS_HORN';
      default:
        break;
    }
  }
  return null;
}

function buildDescription(raw: AboeUnitRecord, ability: AbilityType | null, isAgile: boolean, isHero: boolean): string {
  const parts: string[] = [];
  if (isHero) parts.push('Héroe (inmune a climas y efectos).');
  if (isAgile) parts.push('Ágil (Cuerpo o Distancia).');

  switch (ability) {
    case 'TIGHT_BOND':
      parts.push('Vínculo estrecho: multiplica su fuerza por cada copia igual en la fila.');
      break;
    case 'MORALE_BOOST':
      parts.push('Inyección de moral: suma +1 a las demás unidades normales de su fila.');
      break;
    case 'SPY':
      parts.push('Espía: se coloca en el campo rival y robas 2 cartas.');
      break;
    case 'MEDIC':
      parts.push('Médico: revive una unidad no-Héroe de tu descarte.');
      break;
    case 'MUSTER':
      parts.push('Reunión: invoca todas las cartas iguales o del mismo grupo desde mano y mazo.');
      break;
    case 'SCORCH_ROW':
      parts.push('Tierra quemada de fila: destruye la unidad no-Héroe rival más fuerte si esa fila suma >= 10.');
      break;
    case 'COMMANDERS_HORN':
      parts.push('Cuerno del comandante: duplica la fuerza de las demás unidades de la fila.');
      break;
    default:
      break;
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }
  if (raw.Name === 'Cow') {
    return 'Vengador: al ser descartada al final de la ronda, invoca una Fuerza de Defensa Bovina (8) en Cuerpo a cuerpo para la siguiente ronda.';
  }
  return raw.Quote ? raw.Quote.replace(/https?:\/\/\S+/g, '').trim() : `Unidad de ${raw.Faction}.`;
}

function main(): void {
  const basePath = path.resolve('scripts/data/base-cards.json');
  const sourcePath = path.resolve('scripts/data/tw3-gwent-source.json');
  const combinedPath = path.resolve('scripts/data/tw3-full-cards.json');
  const outputPath = path.resolve('src/assets/data/cards.json');

  const baseCards = JSON.parse(readFileSync(basePath, 'utf8')) as readonly CardDefinition[];
  const sourceRecords = JSON.parse(readFileSync(sourcePath, 'utf8')) as readonly AboeUnitRecord[];

  const combined: CardDefinition[] = [...baseCards];
  const existingIds = new Set(baseCards.map((c) => c.id));

  for (const raw of sourceRecords) {
    if (raw.Faction === 'Skellige' || raw.DLC === 'Blood and Wine' || raw.Deckable !== 'Yes') {
      continue;
    }
    if (EXISTING_SOURCE_NAME_TO_BASE_ID[raw.Name]) {
      continue;
    }

    const faction = FACTION_MAP[raw.Faction];
    if (!faction) {
      throw new Error(`Facción inesperada en tw3-gwent-source.json: "${raw.Faction}" (${raw.Name})`);
    }

    const id = `${FACTION_PREFIX[faction]}_${toSlug(raw.Name)}`;
    if (existingIds.has(id)) {
      throw new Error(`Colisión de ID al importar "${raw.Name}": ${id}`);
    }
    existingIds.add(id);

    const rows: RowType[] = [];
    for (const col of [raw['Combat 1'], raw['Combat 2'], raw['Combat 3']]) {
      if (col && ROW_MAP[col] && !rows.includes(ROW_MAP[col]!)) {
        rows.push(ROW_MAP[col]!);
      }
    }
    if (rows.length === 0) {
      throw new Error(`Carta importada sin filas válidas: "${raw.Name}"`);
    }

    const isHero = raw.Hero === 'Yes';
    const rawAbility = mapAbility(raw);
    const ability =
      raw.Name === 'Cirilla Fiona Elen Riannon' && rawAbility === 'MUSTER' ? null : rawAbility;
    const slug = toSlug(raw.Name);
    const bondGroup = ability === 'TIGHT_BOND' ? slug : undefined;
    const musterGroup =
      ability === 'MUSTER' ? toSlug(raw['Effect Prefix'] || raw.Name) : undefined;
    const isAgile = rows.length > 1 || raw['Effect 1'] === 'Agile' || raw['Effect 2'] === 'Agile';

    combined.push({
      id,
      name: raw.Name,
      faction: faction as PlayableFactionId | 'NEUTRAL',
      type: 'UNIT',
      baseStrength: Number.isInteger(raw.Strength) ? raw.Strength! : 0,
      isHero,
      allowedRows: rows,
      ability,
      ...(bondGroup ? { bondGroup } : {}),
      ...(musterGroup ? { musterGroup } : {}),
      maxCopies: Math.max(1, raw.Occurrences ?? 1),
      description: buildDescription(raw, ability, isAgile, isHero),
    });
  }

  writeFileSync(combinedPath, `${JSON.stringify(combined, null, 2)}\n`, 'utf8');
  const catalog = runEtl(combinedPath, outputPath);

  const byFaction: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalDeckCopies = 0;
  for (const card of catalog) {
    byFaction[card.faction] = (byFaction[card.faction] ?? 0) + 1;
    byType[card.type] = (byType[card.type] ?? 0) + 1;
    if (card.type !== 'LEADER') {
      totalDeckCopies += card.maxCopies;
    }
  }

  console.log(`[IMPORT OK] ${catalog.length} definiciones únicas (${totalDeckCopies} copias coleccionables + ${byType['LEADER'] ?? 0} Líderes)`);
  console.log('Por facción:', byFaction);
  console.log('Por tipo:', byType);
}

main();
