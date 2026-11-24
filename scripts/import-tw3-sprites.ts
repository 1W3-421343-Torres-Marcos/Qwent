import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CardDefinition } from '../src/core/models/types.ts';

const SPRITE_BASE_URL =
  'https://raw.githubusercontent.com/asundr/gwent-classic/main/img/sm/';

const CARDS_JSON_PATH = path.resolve(process.cwd(), 'src/assets/data/cards.json');
const OUTPUT_DIR = path.resolve(process.cwd(), 'src/assets/cards');

const CARD_ID_TO_SPRITE_FILE: Readonly<Record<string, string>> = {
  // Northern Realms Leaders
  nr_leader_foltest_steel_forged: 'realms_foltest_bronze.jpg',
  nr_leader_foltest_siege_master: 'realms_foltest_copper.jpg',
  nr_leader_foltest_king_of_temeria: 'realms_foltest_silver.jpg',
  nr_leader_foltest_lord_commander: 'realms_foltest_gold.jpg',

  // Northern Realms Units
  nr_ballista: 'realms_ballista.jpg',
  nr_catapult: 'realms_catapult_1.jpg',
  nr_crinfrid_reavers: 'realms_crinfrid.jpg',
  nr_blue_stripes_commando: 'realms_blue_stripes.jpg',
  nr_dethmold: 'realms_dethmold.jpg',
  nr_esterad_thyssen: 'realms_esterad.jpg',
  nr_kaedweni_siege_expert: 'realms_kaedwen_siege.jpg',
  nr_john_natalis: 'realms_natalis.jpg',
  nr_keira_metz: 'realms_keira.jpg',
  nr_dun_banner_medic: 'realms_banner_nurse.jpg',
  nr_philippa_eilhart: 'realms_philippa.jpg',
  nr_poor_fucking_infantry: 'realms_poor_infantry.jpg',
  nr_prince_stennis: 'realms_stennis.jpg',
  nr_redanian_foot_soldier: 'realms_redania.jpg',
  nr_sabrina_glevissig: 'realms_sabrina.jpg',
  nr_sheldon_skaggs: 'realms_sheldon.jpg',
  nr_siege_tower: 'realms_siege_tower.jpg',
  nr_siegfried_of_denesle: 'realms_siegfried.jpg',
  nr_sigismund_dijkstra: 'realms_dijkstra.jpg',
  nr_sile_de_tansarville: 'realms_sheala.jpg',
  nr_thaler: 'realms_thaler.jpg',
  nr_trebuchet: 'realms_trebuchet.jpg',
  nr_vernon_roche: 'realms_vernon.jpg',
  nr_ves: 'realms_ves.jpg',
  nr_yarpen_zigrin: 'realms_yarpen.jpg',

  // Nilfgaard Leaders
  ng_leader_emhyr_relentless: 'nilfgaard_emhyr_gold.jpg',
  ng_leader_emhyr_emperor: 'nilfgaard_emhyr_copper.jpg',
  ng_leader_emhyr_white_flame: 'nilfgaard_emhyr_bronze.jpg',
  ng_leader_emhyr_imperial_majesty: 'nilfgaard_emhyr_silver.jpg',

  // Nilfgaard Units
  ng_albrich: 'nilfgaard_albrich.jpg',
  ng_etolian_auxiliary: 'nilfgaard_archer_support.jpg',
  ng_black_infantry_archer: 'nilfgaard_black_archer.jpg',
  ng_assire_var_anahid: 'nilfgaard_assire.jpg',
  ng_cahir: 'nilfgaard_cahir.jpg',
  ng_cynthia: 'nilfgaard_cynthia.jpg',
  ng_zerrikanian_fire_scorpion: 'nilfgaard_zerri.jpg',
  ng_heavy_zerrikanian_fire_scorpion: 'nilfgaard_heavy_zerri.jpg',
  ng_fringilla_vigo: 'nilfgaard_fringilla.jpg',
  ng_impera_brigade: 'nilfgaard_imperal_brigade.jpg',
  ng_nausicaa_cavalry: 'nilfgaard_nauzicaa_2.jpg',
  ng_letho_of_gulet: 'nilfgaard_letho.jpg',
  ng_menno_coehoorn: 'nilfgaard_menno.jpg',
  ng_morteisen: 'nilfgaard_morteisen.jpg',
  ng_morvran_voorhis: 'nilfgaard_moorvran.jpg',
  ng_puttkammer: 'nilfgaard_puttkammer.jpg',
  ng_rainfarn: 'nilfgaard_rainfarn.jpg',
  ng_renuald_aep_matsen: 'nilfgaard_renuald.jpg',
  ng_rotten_mangonel: 'nilfgaard_rotten.jpg',
  ng_shilard_fitz_oesterlen: 'nilfgaard_shilard.jpg',
  ng_siege_engineer: 'nilfgaard_siege_engineer.jpg',
  ng_siege_technician: 'nilfgaard_siege_support.jpg',
  ng_stefan_skellen: 'nilfgaard_stefan.jpg',
  ng_sweers: 'nilfgaard_sweers.jpg',
  ng_tibor_eggebracht: 'nilfgaard_tibor.jpg',
  ng_vanhemar: 'nilfgaard_vanhemar.jpg',
  ng_vattier_de_rideaux: 'nilfgaard_vattier.jpg',
  ng_vreemde: 'nilfgaard_vreemde.jpg',
  ng_young_emissary: 'nilfgaard_young_emissary.jpg',

  // Monsters Leaders
  mo_leader_eredin_commander: 'monsters_eredin_silver.jpg',
  mo_leader_eredin_destroyer: 'monsters_eredin_gold.jpg',
  mo_leader_eredin_bringer_of_death: 'monsters_eredin_bronze.jpg',
  mo_leader_eredin_king: 'monsters_eredin_copper.jpg',

  // Monsters Units
  mo_arachas: 'monsters_arachas.jpg',
  mo_harpy: 'monsters_harpy.jpg',
  mo_arachas_behemoth: 'monsters_arachas_behemoth.jpg',
  mo_botchling: 'monsters_poroniec.jpg',
  mo_celaeno_harpy: 'monsters_celaeno_harpy.jpg',
  mo_cockatrice: 'monsters_cockatrice.jpg',
  mo_crone_brewess: 'monsters_witch_velen.jpg',
  mo_crone_weavess: 'monsters_witch_velen_1.jpg',
  mo_crone_whispess: 'monsters_witch_velen_2.jpg',
  mo_fiend: 'monsters_fiend.jpg',
  mo_draug: 'monsters_draug.jpg',
  mo_earth_elemental: 'monsters_earth_elemental.jpg',
  mo_endrega: 'monsters_endrega.jpg',
  mo_fire_elemental: 'monsters_fire_elemental.jpg',
  mo_foglet: 'monsters_fogling.jpg',
  mo_forktail: 'monsters_forktail.jpg',
  mo_frightener: 'monsters_frightener.jpg',
  mo_gargoyle: 'monsters_gargoyle.jpg',
  mo_ice_giant: 'monsters_frost_giant.jpg',
  mo_grave_hag: 'monsters_gravehag.jpg',
  mo_griffin: 'monsters_gryffin.jpg',
  mo_ghoul: 'monsters_ghoul.jpg',
  mo_imlerith: 'monsters_imlerith.jpg',
  mo_kayran: 'monsters_kayran.jpg',
  mo_leshen: 'monsters_leshen.jpg',
  mo_nekker: 'monsters_nekker.jpg',
  mo_plague_maiden: 'monsters_mighty_maiden.jpg',
  mo_toad: 'monsters_toad.jpg',
  mo_vampire_bruxa: 'monsters_bruxa.jpg',
  mo_vampire_ekimmara: 'monsters_ekkima.jpg',
  mo_vampire_fleder: 'monsters_fleder.jpg',
  mo_vampire_garkain: 'monsters_garkain.jpg',
  mo_vampire_katakan: 'monsters_katakan.jpg',
  mo_werewolf: 'monsters_werewolf.jpg',
  mo_wyvern: 'monsters_wyvern.jpg',

  // Scoia'tael Leaders
  st_leader_francesca_pureblood: 'scoiatael_francesca_bronze.jpg',
  st_leader_francesca_hope: 'scoiatael_francesca_hope_of_the_aen_seidhe.jpg',
  st_leader_francesca_daisy: 'scoiatael_francesca_copper.jpg',
  st_leader_francesca_queen: 'scoiatael_francesca_silver.jpg',

  // Scoia'tael Units
  st_barclay_els: 'scoiatael_barclay.jpg',
  st_ciaran_aep_easnillien: 'scoiatael_ciaran.jpg',
  st_havekar_smuggler: 'scoiatael_havekar_support.jpg',
  st_mahakaman_defender: 'scoiatael_mahakam.jpg',
  st_dennis_cranmer: 'scoiatael_dennis.jpg',
  st_dol_blathanna_archer: 'scoiatael_dol_archer.jpg',
  st_dwarven_skirmisher: 'scoiatael_dwarf.jpg',
  st_eithne: 'scoiatael_eithne.jpg',
  st_dol_blathanna_scout: 'scoiatael_dol_infantry.jpg',
  st_filavandrel_aen_fidhail: 'scoiatael_filavandrel.jpg',
  st_elven_skirmisher: 'scoiatael_elf_skirmisher.jpg',
  st_ida_emean_aep_sivney: 'scoiatael_ida.jpg',
  st_iorveth: 'scoiatael_iorveth.jpg',
  st_isengrim_faoiltiarna: 'scoiatael_isengrim.jpg',
  st_milva: 'scoiatael_milva.jpg',
  st_riordain: 'scoiatael_riordain.jpg',
  st_saesenthessis: 'scoiatael_saskia.jpg',
  st_havekar_healer: 'scoiatael_havekar_nurse.jpg',
  st_schirru: 'scoiatael_schirru.jpg',
  st_toruviel: 'scoiatael_toruviel.jpg',
  st_vrihedd_brigade: 'scoiatael_vrihedd_brigade.jpg',
  st_vrihedd_brigade_recruit: 'scoiatael_vrihedd_cadet.jpg',
  st_yaevinn: 'scoiatael_yaevinn.jpg',

  // Neutral Units
  nt_cirilla_fiona_elen_riannon: 'neutral_ciri.jpg',
  nt_cow: 'neutral_cow.jpg',
  nt_mysterious_elf: 'neutral_mysterious_elf.jpg',
  nt_emiel_regis_rohellec_terzieff: 'neutral_emiel.jpg',
  nt_gaunter_odimm: 'neutral_gaunter_odimm.jpg',
  nt_gaunter_darkness: 'neutral_gaunter_odimm_darkness.jpg',
  nt_geralt_of_rivia: 'neutral_geralt.jpg',
  nt_dandelion: 'neutral_dandelion.jpg',
  nt_olgierd_von_everec: 'neutral_olgierd.jpg',
  nt_roach: 'neutral_roach.jpg',
  nt_triss_merigold: 'neutral_triss.jpg',
  nt_vesemir: 'neutral_vesemir.jpg',
  nt_villentretenmerth: 'neutral_villen.jpg',
  nt_yennefer_of_vengerberg: 'neutral_yennefer.jpg',
  nt_zoltan_chivay: 'neutral_zoltan.jpg',

  // Specials & Weather
  sp_commanders_horn: 'special_horn.jpg',
  sp_biting_frost: 'weather_frost.jpg',
  sp_torrential_rain: 'weather_rain.jpg',
  sp_impenetrable_fog: 'weather_fog.jpg',
  sp_decoy: 'special_decoy.jpg',
  sp_clear_weather: 'weather_clear.jpg',
  sp_scorch: 'special_scorch.jpg',
};

function isValidJpeg(buffer: Uint8Array): boolean {
  return (
    buffer.byteLength > 1000 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

async function importSprites(): Promise<void> {
  const force = process.argv.includes('--force');
  const cards = JSON.parse(readFileSync(CARDS_JSON_PATH, 'utf8')) as readonly CardDefinition[];

  const unmapped = cards.filter((card) => !(card.id in CARD_ID_TO_SPRITE_FILE));
  if (unmapped.length > 0) {
    throw new Error(`Faltan mapeos de sprite para: ${unmapped.map((c) => c.id).join(', ')}`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  const queue = [...cards];
  const workerCount = 6;

  async function runWorker(): Promise<void> {
    while (queue.length > 0) {
      const card = queue.shift();
      if (!card) return;

      const targetPath = path.join(OUTPUT_DIR, `${card.id}.jpg`);
      if (!force && existsSync(targetPath)) {
        const existing = readFileSync(targetPath);
        if (isValidJpeg(existing)) {
          skipped += 1;
          totalBytes += existing.byteLength;
          continue;
        }
      }

      const sourceFile = CARD_ID_TO_SPRITE_FILE[card.id];
      const url = `${SPRITE_BASE_URL}${sourceFile}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al descargar ${url} para ${card.id}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isValidJpeg(bytes)) {
        throw new Error(`Archivo inválido (no es JPEG válido > 1KB): ${url} para ${card.id}`);
      }

      writeFileSync(targetPath, bytes);
      downloaded += 1;
      totalBytes += bytes.byteLength;
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[SPRITES OK] ${downloaded + skipped}/${cards.length} sprites válidos en src/assets/cards/ (${downloaded} descargados, ${skipped} existentes, ${mb} MB totales)`,
  );
}

importSprites().catch((err: unknown) => {
  console.error('[SPRITES ERROR]', err);
  process.exit(1);
});
