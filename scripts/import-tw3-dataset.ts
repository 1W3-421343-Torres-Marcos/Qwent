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

const FACTION_NAME_ES: Readonly<Record<FactionId, string>> = {
  NORTHERN_REALMS: 'Reinos del Norte',
  NILFGAARD: 'Imperio Nilfgaardiano',
  MONSTERS: 'Monstruos',
  SCOIATAEL: "Scoia'tael",
  NEUTRAL: 'Neutral',
};

interface CardLocalizationEntry {
  readonly name: string;
  readonly description?: string;
}

const ES_CARD_LOCALIZATION: Readonly<Record<string, CardLocalizationEntry>> = {
  // Northern Realms
  nr_catapult: { name: 'Catapulta' },
  nr_dethmold: {
    name: 'Dethmold',
    description: '«Una vez hice vomitar sus propias entrañas a un prisionero... Qué buenos tiempos».',
  },
  nr_john_natalis: { name: 'John Natalis' },
  nr_keira_metz: {
    name: 'Keira Metz',
    description: '«Si voy a morir hoy, prefiero lucir deslumbrante para la ocasión».',
  },
  nr_philippa_eilhart: { name: 'Philippa Eilhart' },
  nr_poor_fucking_infantry: { name: 'Pobre infantería de mierda' },
  nr_redanian_foot_soldier: {
    name: 'Soldado de a pie redaniano',
    description: '«¡He sangrado por Redania! ¡He matado por Redania!». Infantería de línea del norte.',
  },
  nr_sabrina_glevissig: {
    name: 'Sabrina Glevissig',
    description: '«Hija de los páramos indómitos de Kaedwen».',
  },
  nr_sheldon_skaggs: {
    name: 'Sheldon Skaggs',
    description: '«¡Estuve en primera línea, justo donde arreciaba el combate!»',
  },
  nr_siege_tower: {
    name: 'Torre de asedio',
    description: '«Adoro el estruendo de las torres de asedio por la mañana. Suena a victoria».',
  },
  nr_siegfried_of_denesle: {
    name: 'Sigfrido de Denesle',
    description: '«Estamos en el mismo bando, brujo. Algún día te darás cuenta».',
  },
  nr_sigismund_dijkstra: { name: 'Sigismund Dijkstra' },
  nr_sile_de_tansarville: {
    name: 'Síle de Tansarville',
    description: '«La Logia carece de humildad. Nuestra sed de poder será nuestra perdición».',
  },
  nr_thaler: { name: 'Thaler' },
  nr_yarpen_zigrin: {
    name: 'Yarpen Zigrin',
    description: '«El mundo pertenece a quienes mejor saben partir cráneos en batalla».',
  },

  // Nilfgaard
  ng_albrich: {
    name: 'Albrich',
    description: '«¿Una bola de fuego? Por supuesto. Lo que desee Su Majestad Imperial».',
  },
  ng_assire_var_anahid: {
    name: 'Assire var Anahid',
    description: '«Los magos nilfgaardianos tienen elección: sumisión servil o la horca».',
  },
  ng_cynthia: {
    name: 'Cynthia',
    description: '«Los talentos de Cynthia pueden ser letales. Necesita correa corta».',
  },
  ng_fringilla_vigo: {
    name: 'Fringilla Vigo',
    description: '«La magia es el bien supremo. Trasciende todas las fronteras y divisiones».',
  },
  ng_menno_coehoorn: { name: 'Menno Coehoorn' },
  ng_morteisen: {
    name: 'Morteisen',
    description: '«Ningún piquero norteño ni lancero enano puede resistir nuestra caballería».',
  },
  ng_morvran_voorhis: { name: 'Morvran Voorhis' },
  ng_puttkammer: {
    name: 'Puttkammer',
    description: '«Aprendí mucho en la Academia Militar de Braibant. A pelar patatas, por ejemplo».',
  },
  ng_rainfarn: {
    name: 'Rainfarn',
    description: '«Morirás con tanto sufrimiento como aquel patético traidor de Windhalm».',
  },
  ng_renuald_aep_matsen: {
    name: 'Renuald aep Matsen',
    description: '«Dicen que los Impera no temen a nada. Falso: Renuald los aterra».',
  },
  ng_rotten_mangonel: {
    name: 'Mangonel podrido',
    description: '«El hedor a podredumbre despierta recuerdos de la infancia».',
  },
  ng_shilard_fitz_oesterlen: { name: 'Shilard Fitz-Oesterlen' },
  ng_siege_engineer: {
    name: 'Ingeniero de asedio',
    description: '«Empuñado con destreza, un transportador puede ser un arma letal».',
  },
  ng_siege_technician: { name: 'Técnico de asedio' },
  ng_sweers: {
    name: 'Sweers',
    description: '«¡Apartad las manos de la chica! Seamos lo que seamos, no somos salvajes».',
  },
  ng_vanhemar: {
    name: 'Vanhemar',
    description: '«Para ser un mago del fuego, no resulta demasiado extravagante».',
  },
  ng_vattier_de_rideaux: { name: 'Vattier de Rideaux' },
  ng_vreemde: {
    name: 'Vreemde',
    description: '«La disciplina es el arma más mortífera del Imperio».',
  },
  ng_young_emissary: { name: 'Joven emisario' },

  // Monsters
  mo_botchling: {
    name: 'Malogrado',
    description: '«Admite tus errores y entiérralos como es debido, o volverán para atormentarte».',
  },
  mo_celaeno_harpy: { name: 'Arpía celaeno' },
  mo_cockatrice: {
    name: 'Cocatriz',
    description: '«Nacida de un huevo puesto por un gallo... si crees esas patrañas campesinas».',
  },
  mo_crone_brewess: { name: 'Moira: Guisandera' },
  mo_crone_weavess: { name: 'Moira: Tejedora' },
  mo_crone_whispess: { name: 'Moira: Susurradora' },
  mo_draug: { name: 'Draug' },
  mo_endrega: {
    name: 'Endriago',
    description: '«¡El nido! ¡Acabad con el nido o estas alimañas no dejarán de salir!»',
  },
  mo_fire_elemental: {
    name: 'Elemental de fuego',
    description: '«El fuego resulta tan encantador».',
  },
  mo_foglet: {
    name: 'Boira',
    description: '«La niebla avanza sigilosa. Las boiras se deslizan sobre sus víctimas».',
  },
  mo_forktail: {
    name: 'Colahorquilla',
    description: '«¿Colas bifurcadas? Parecen más bien enormes cuchillas de carnicero».',
  },
  mo_frightener: {
    name: 'Espantajo',
    description: '«"¿Qué he hecho?", gritó el mago, aterrado ante su propia creación».',
  },
  mo_gargoyle: {
    name: 'Gárgola',
    description: '«Pesadillas de antiguos escultores cobrando vida por capricho de magos aburridos».',
  },
  mo_grave_hag: {
    name: 'Bruja sepulcral',
    description: '«Sus largas lenguas sirven para sorber médula y preparar el banquete».',
  },
  mo_griffin: {
    name: 'Grifo',
    description: '«A los grifos les gusta jugar con su presa y devorarla viva, pedazo a pedazo».',
  },
  mo_plague_maiden: {
    name: 'Pesta',
    description: '«Los enfermos deliran con una mujer cubierta de bubas rodeada de ratas rabiosas».',
  },
  mo_vampire_bruxa: { name: 'Vampiro: Bruxa' },
  mo_vampire_ekimmara: { name: 'Vampiro: Ekimma' },
  mo_vampire_fleder: { name: 'Vampiro: Fleder' },
  mo_vampire_garkain: { name: 'Vampiro: Garkain' },
  mo_vampire_katakan: { name: 'Vampiro: Katakan' },
  mo_werewolf: {
    name: 'Hombre lobo',
    description: '«Los lobos no son tan malos como dicen. Los hombres lobo son mucho peores».',
  },
  mo_wyvern: {
    name: 'Guiverno',
    description: '«Imagina un cruce entre una serpiente alada y una pesadilla. Un guiverno es peor».',
  },

  // Scoia'tael
  st_barclay_els: { name: 'Barclay Els' },
  st_ciaran_aep_easnillien: { name: 'Ciaran aep Easnillien' },
  st_dennis_cranmer: {
    name: 'Dennis Cranmer',
    description: '«Sé perfectamente cómo cumplir órdenes, así que ahórrate los consejos».',
  },
  st_dol_blathanna_archer: {
    name: 'Arquero de Dol Blathanna',
    description: "«Da otro paso, dh'oine. Te verías mejor con una flecha entre los ojos».",
  },
  st_dwarven_skirmisher: { name: 'Hostigador enano' },
  st_filavandrel_aen_fidhail: { name: 'Filavandrel aen Fidhail' },
  st_ida_emean_aep_sivney: {
    name: 'Ida Emean aep Sivney',
    description: '«Soy una Sabia. Mi poder reside en poseer el conocimiento, no en compartirlo».',
  },
  st_isengrim_faoiltiarna: { name: 'Isengrim Faoiltiarna' },
  st_riordain: {
    name: 'Riordain',
    description: '«Míralos a los ojos, aliméntate de su terror. Luego lánzate a matar».',
  },
  st_toruviel: {
    name: 'Toruviel',
    description: '«Con gusto te mataría de cerca mirándote a los ojos... pero apestas, humano».',
  },
  st_vrihedd_brigade_recruit: {
    name: 'Recluta de la brigada Vrihedd',
    description: '«El odio arde más que cualquier fuego y corta más profundo que cualquier hoja».',
  },
  st_yaevinn: { name: 'Yaevinn' },

  // Neutral
  nt_cirilla_fiona_elen_riannon: { name: 'Cirilla Fiona Elen Riannon' },
  nt_cow: { name: 'Vaca' },
  nt_emiel_regis_rohellec_terzieff: {
    name: 'Emiel Regis Rohellec Terzieff',
    description: '«Los hombres, al menos los educados, me llaman monstruo. Un engendro chupasangre».',
  },
  nt_roach: {
    name: 'Sardinilla',
    description: '«¡Vamos, Sardinilla! ¡Más rápido!»',
  },
  nt_triss_merigold: { name: 'Triss Merigold' },
  nt_vesemir: {
    name: 'Vesemir',
    description: '«Si van a ahorcarte, pide agua. Nunca se sabe qué puede ocurrir antes de que la traigan».',
  },
  nt_zoltan_chivay: {
    name: 'Zoltan Chivay',
    description: '«La vida sin viejos camaradas ni buena bebida no vale gran cosa».',
  },
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

function buildDescription(
  id: string,
  faction: FactionId,
  raw: AboeUnitRecord,
  ability: AbilityType | null,
  isAgile: boolean,
  isHero: boolean,
): string {
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
  const localized = ES_CARD_LOCALIZATION[id];
  if (localized?.description) {
    return localized.description;
  }
  return `Unidad de ${FACTION_NAME_ES[faction]}.`;
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

    const localized = ES_CARD_LOCALIZATION[id];
    combined.push({
      id,
      name: localized?.name ?? raw.Name,
      faction: faction as PlayableFactionId | 'NEUTRAL',
      type: 'UNIT',
      baseStrength: Number.isInteger(raw.Strength) ? raw.Strength! : 0,
      isHero,
      allowedRows: rows,
      ability,
      ...(bondGroup ? { bondGroup } : {}),
      ...(musterGroup ? { musterGroup } : {}),
      maxCopies: Math.max(1, raw.Occurrences ?? 1),
      description: buildDescription(id, faction, raw, ability, isAgile, isHero),
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
