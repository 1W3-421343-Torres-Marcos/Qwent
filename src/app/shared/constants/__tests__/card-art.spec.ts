import { describe, expect, it } from 'vitest';
import { getCardSpritePath, getExpectedAltSpriteIds } from '../card-art.utils';

describe('Card Art Variant Resolution (U5.1)', () => {
  it('resolves cards without alternate variants to the base sprite path', () => {
    expect(getCardSpritePath('nt_geralt_of_rivia')).toBe('assets/cards/nt_geralt_of_rivia.jpg');
    expect(getCardSpritePath('nt_geralt_of_rivia', 'PLAYER_1_2_nt_geralt_of_rivia')).toBe(
      'assets/cards/nt_geralt_of_rivia.jpg',
    );
  });

  it('distributes consecutive 3-copy instances deterministically and wraps cleanly', () => {
    expect(getCardSpritePath('mo_nekker', 'PLAYER_1_1_mo_nekker')).toBe(
      'assets/cards/mo_nekker.jpg',
    );
    expect(getCardSpritePath('mo_nekker', 'PLAYER_1_2_mo_nekker')).toBe(
      'assets/cards/mo_nekker_alt1.jpg',
    );
    expect(getCardSpritePath('mo_nekker', 'PLAYER_1_3_mo_nekker')).toBe(
      'assets/cards/mo_nekker_alt2.jpg',
    );
    expect(getCardSpritePath('mo_nekker', 'PLAYER_1_4_mo_nekker')).toBe(
      'assets/cards/mo_nekker.jpg',
    );
  });

  it('cycles Mahakaman Defender across all 5 distinct artworks', () => {
    const resolved = [1, 2, 3, 4, 5].map((idx) =>
      getCardSpritePath('st_mahakaman_defender', `PLAYER_2_${idx}_st_mahakaman_defender`),
    );
    expect(resolved).toEqual([
      'assets/cards/st_mahakaman_defender.jpg',
      'assets/cards/st_mahakaman_defender_alt1.jpg',
      'assets/cards/st_mahakaman_defender_alt2.jpg',
      'assets/cards/st_mahakaman_defender_alt3.jpg',
      'assets/cards/st_mahakaman_defender_alt4.jpg',
    ]);
  });

  it('declares all 29 expected alternate sprite stems uniquely', () => {
    const altIds = getExpectedAltSpriteIds();
    expect(altIds).toHaveLength(29);
    expect(new Set(altIds).size).toBe(29);
  });
});
