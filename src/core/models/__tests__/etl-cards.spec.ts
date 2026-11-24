import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import {
  LEADER_ABILITY_TYPES,
  PLAYABLE_FACTIONS,
  validateCatalog,
  type CardDefinition,
} from '../../index';
import {
  parseCsvDataset,
  transformDatasetToCatalog,
  type RawCardRecord,
} from '../../../../scripts/etl-cards';

describe('Deterministic Cards ETL (F5.2)', () => {
  it('parses CSV rows with quoted fields and pipe-separated allowedRows deterministically', () => {
    const csv = [
      'id,name,faction,type,baseStrength,isHero,allowedRows,ability,bondGroup,musterGroup,leaderAbility,maxCopies,description,artVariant',
      'st_agile,Explorador Élficó,SCOIATAEL,UNIT,6,false,CLOSE_COMBAT|RANGED,,,,,2,"Ágil, versátil",',
      'nr_leader_1,Foltest: Comandante,NORTHERN_REALMS,LEADER,0,false,,,, ,CLEAR_WEATHER_LEADER,1,"Limpia el clima.",',
      'sp_horn_alt,Cuerno,NEUTRAL,SPECIAL,0,false,CLOSE_COMBAT|RANGED|SIEGE,COMMANDERS_HORN,,,,2,"Duplica fila",alt_a',
      'sp_horn_alt,Cuerno,NEUTRAL,SPECIAL,0,false,CLOSE_COMBAT|RANGED|SIEGE,COMMANDERS_HORN,,,,1,"Duplica fila",alt_b',
    ].join('\n');

    const parsed = parseCsvDataset(csv);
    expect(parsed).toHaveLength(4);

    const forward = transformDatasetToCatalog(parsed);
    const reversed = transformDatasetToCatalog([...parsed].reverse());

    expect(JSON.stringify(forward)).toBe(JSON.stringify(reversed));
    expect(validateCatalog(forward).valid).toBe(true);

    const mergedHorn = forward.find((c) => c.id === 'sp_horn_alt');
    expect(mergedHorn?.maxCopies).toBe(3);

    const agile = forward.find((c) => c.id === 'st_agile');
    expect(agile?.allowedRows).toEqual(['CLOSE_COMBAT', 'RANGED']);
  });

  it('rejects duplicate IDs without artVariant and rejects invalid enums or invalid leaders', () => {
    const dupes: RawCardRecord[] = [
      {
        id: 'u1',
        name: 'A',
        faction: 'NORTHERN_REALMS',
        type: 'UNIT',
        baseStrength: 5,
        allowedRows: ['CLOSE_COMBAT'],
        maxCopies: 1,
      },
      {
        id: 'u1',
        name: 'A',
        faction: 'NORTHERN_REALMS',
        type: 'UNIT',
        baseStrength: 5,
        allowedRows: ['CLOSE_COMBAT'],
        maxCopies: 1,
      },
    ];
    expect(() => transformDatasetToCatalog(dupes)).toThrow(/ID duplicado/);

    expect(() =>
      transformDatasetToCatalog([
        {
          id: 'bad_leader',
          name: 'Neutral Leader',
          faction: 'NEUTRAL',
          type: 'LEADER',
          baseStrength: 0,
          allowedRows: [],
          leaderAbility: 'CLEAR_WEATHER_LEADER',
          maxCopies: 1,
        },
      ]),
    ).toThrow(/NEUTRAL/);

    expect(() =>
      transformDatasetToCatalog([
        {
          id: 'bad_ability',
          name: 'Weird Card',
          faction: 'MONSTERS',
          type: 'UNIT',
          baseStrength: 4,
          allowedRows: ['CLOSE_COMBAT'],
          ability: 'PROVISION_BOOST',
          maxCopies: 1,
        },
      ]),
    ).toThrow(/Habilidad inválida/);
  });

  it('ensures generated src/assets/data/cards.json is sorted deterministically, valid, and covers all 5 factions & leader abilities', () => {
    const catalog = rawCards as readonly CardDefinition[];
    const validation = validateCatalog(catalog);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(catalog).toHaveLength(181);

    const retransformed = transformDatasetToCatalog(catalog);
    expect(JSON.stringify(catalog)).toBe(JSON.stringify(retransformed));

    for (const faction of PLAYABLE_FACTIONS) {
      const factionLeaders = catalog.filter((c) => c.type === 'LEADER' && c.faction === faction);
      const expectedLeaderCount = faction === 'SKELLIGE' ? 2 : 5;
      expect(factionLeaders).toHaveLength(expectedLeaderCount);
    }

    const coveredLeaderAbilities = new Set(
      catalog.filter((c) => c.type === 'LEADER').map((c) => c.leaderAbility),
    );
    for (const ability of LEADER_ABILITY_TYPES) {
      expect(coveredLeaderAbilities.has(ability)).toBe(true);
    }
  });
});
