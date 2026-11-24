/**
 * Number of alternate portrait variants (_alt1 .. _altN) available per multi-copy card ID.
 */
export const CARD_ALT_VARIANT_COUNTS: Readonly<Record<string, number>> = {
  mo_arachas: 2,
  mo_ghoul: 2,
  mo_nekker: 2,
  ng_etolian_auxiliary: 1,
  ng_black_infantry_archer: 1,
  ng_young_emissary: 1,
  nr_ballista: 1,
  nr_kaedweni_siege_expert: 2,
  nr_redanian_foot_soldier: 1,
  nr_trebuchet: 1,
  st_dol_blathanna_scout: 2,
  st_dwarven_skirmisher: 2,
  st_elven_skirmisher: 2,
  st_havekar_healer: 2,
  st_havekar_smuggler: 2,
  st_mahakaman_defender: 4,
  st_vrihedd_brigade: 1,
};

/**
 * Returns every expected alternate sprite file stem (<cardId>_alt<N>) for integrity audits.
 */
export function getExpectedAltSpriteIds(): readonly string[] {
  const ids: string[] = [];
  for (const [cardId, count] of Object.entries(CARD_ALT_VARIANT_COUNTS)) {
    for (let i = 1; i <= count; i += 1) {
      ids.push(`${cardId}_alt${i}`);
    }
  }
  return ids;
}

function resolveInstanceCopyIndex(instanceId: string): number {
  const match = /^PLAYER_[12]_(\d+)_/.exec(instanceId);
  if (match?.[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  let hash = 0;
  for (let i = 0; i < instanceId.length; i += 1) {
    hash = (hash * 31 + instanceId.charCodeAt(i)) >>> 0;
  }
  return hash + 1;
}

/**
 * Returns the local bundled portrait asset path for a Qwent card definition ID and optional instance ID.
 */
export function getCardSpritePath(cardId: string, instanceId?: string): string {
  const altCount = CARD_ALT_VARIANT_COUNTS[cardId] ?? 0;
  if (!instanceId || altCount === 0) {
    return `assets/cards/${cardId}.jpg`;
  }

  const copyNum = resolveInstanceCopyIndex(instanceId);
  const variantIndex = (copyNum - 1) % (altCount + 1);
  if (variantIndex === 0) {
    return `assets/cards/${cardId}.jpg`;
  }
  return `assets/cards/${cardId}_alt${variantIndex}.jpg`;
}
