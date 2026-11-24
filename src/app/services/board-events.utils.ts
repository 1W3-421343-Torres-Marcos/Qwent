import type { CardDefinition, GameState, PlayerId, RowType } from '../../core';

export type BannerTone = 'GOLD' | 'CRIMSON' | 'EMERALD' | 'NEUTRAL';
export type BannerIcon = 'COIN' | 'TURN' | 'PASS' | 'ROUND' | 'FACTION';

export interface BoardBannerPayload {
  readonly title: string;
  readonly subtitle?: string;
  readonly tone: BannerTone;
  readonly icon: BannerIcon;
}

export interface BoardBannerData extends BoardBannerPayload {
  readonly id: number;
}

export interface AiPlayPreview {
  readonly id: number;
  readonly card: CardDefinition;
  readonly label: string;
}

const BOVINE_TOKEN_ID = 'nt_bovine_defense_force';
const BOARD_ROWS: readonly RowType[] = ['CLOSE_COMBAT', 'RANGED', 'SIEGE'];

/**
 * Builds banners for round transition, Northern Realms extra draw, Monsters carryover, and Cow Avenger.
 */
export function detectRoundAdvanceBanners(
  prev: GameState,
  next: GameState,
  perspectivePlayerId: PlayerId,
): readonly BoardBannerPayload[] {
  const banners: BoardBannerPayload[] = [
    {
      title: `Ronda ${next.roundNumber}`,
      subtitle: next.activePlayer === perspectivePlayerId ? 'Empiezas tú' : 'Empieza el rival',
      tone: 'GOLD',
      icon: 'ROUND',
    },
  ];

  for (const playerId of ['PLAYER_1', 'PLAYER_2'] as const) {
    const prevPlayer = prev.players[playerId];
    const nextPlayer = next.players[playerId];

    if (nextPlayer.faction === 'NORTHERN_REALMS' && nextPlayer.hand.length > prevPlayer.hand.length) {
      banners.push({
        title: 'Reinos del Norte',
        subtitle: `${nextPlayer.name} roba 1 carta`,
        tone: 'EMERALD',
        icon: 'FACTION',
      });
    }

    if (nextPlayer.faction === 'MONSTERS') {
      const keptCard = BOARD_ROWS.flatMap((row) => nextPlayer.rows[row].cards).find(
        (card) => card.definitionId !== BOVINE_TOKEN_ID,
      );
      if (keptCard) {
        banners.push({
          title: 'Pasiva de Monstruos',
          subtitle: `${keptCard.card.name} permanece en mesa`,
          tone: 'EMERALD',
          icon: 'FACTION',
        });
      }
    }

    const spawnedBovine = nextPlayer.rows.CLOSE_COMBAT.cards.some(
      (card) => card.definitionId === BOVINE_TOKEN_ID,
    );
    if (spawnedBovine) {
      banners.push({
        title: '¡Vengador!',
        subtitle: `${nextPlayer.name}: Fuerza de Defensa Bovina (8)`,
        tone: 'GOLD',
        icon: 'FACTION',
      });
    }
  }

  return banners;
}

/**
 * Returns a Nilfgaard tie-breaker banner when a tied round score is awarded to Nilfgaard.
 */
export function detectNilfgaardTieBanner(next: GameState): BoardBannerPayload | null {
  if (next.phase !== 'ROUND_END' && next.phase !== 'MATCH_END') {
    return null;
  }
  const lastRound = next.roundHistory[next.roundHistory.length - 1];
  if (
    !lastRound ||
    lastRound.scores.PLAYER_1 !== lastRound.scores.PLAYER_2 ||
    lastRound.winner === 'DRAW'
  ) {
    return null;
  }

  const winnerName = next.players[lastRound.winner].name;
  return {
    title: 'Pasiva de Nilfgaard',
    subtitle: `${winnerName} gana el empate`,
    tone: 'GOLD',
    icon: 'FACTION',
  };
}

/**
 * Lists player IDs whose remaining life gems decreased during the latest transition.
 */
export function detectLostGemPlayers(prev: GameState, next: GameState): readonly PlayerId[] {
  const lost: PlayerId[] = [];
  for (const playerId of ['PLAYER_1', 'PLAYER_2'] as const) {
    if (next.players[playerId].gems < prev.players[playerId].gems) {
      lost.push(playerId);
    }
  }
  return lost;
}

/**
 * Returns a concise Spanish action label for the AI's latest played card or leader ability.
 */
export function buildAiPlayLabel(card: CardDefinition): string {
  if (card.type === 'LEADER') return 'IA activó Líder';
  if (card.type === 'SPECIAL') return 'IA jugó especial';
  if (card.isHero) return 'IA jugó Héroe';
  return 'IA jugó unidad';
}
