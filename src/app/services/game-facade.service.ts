import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import rawCards from '../../assets/data/cards.json';
import rawStarterDecks from '../../assets/data/starter-decks.json';
import {
  QWENT_PHASE,
  canPlayCard,
  createAIView,
  createInitialGameState,
  decideAction,
  dispatch,
  getOpponentId,
  type CardDefinition,
  type CardInstance,
  type GameAction,
  type GameState,
  type PlayerId,
  type RowType,
  type StarterDeckDefinition,
} from '../../core';

export type GameMode = 'VS_AI' | 'LOCAL_2P';

const TURN_BREATHER_MS = 450;
const AI_PLAY_DELAY_MS = 550;
const AI_MULLIGAN_DELAY_MS = 250;

@Injectable({ providedIn: 'root' })
export class GameFacadeService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalog = rawCards as readonly CardDefinition[];
  private readonly starterDecks = rawStarterDecks as readonly StarterDeckDefinition[];
  private handoffTimerId: ReturnType<typeof setTimeout> | null = null;
  private aiTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly phaseLabel = QWENT_PHASE;
  readonly gameMode = signal<GameMode>('VS_AI');
  readonly state = signal<GameState>(this.buildNewMatchState('VS_AI'));
  readonly perspectivePlayerId = signal<PlayerId>('PLAYER_1');
  readonly selectedInstanceId = signal<string | null>(null);
  readonly inspectedCard = signal<CardInstance | null>(null);
  readonly discardModalPlayerId = signal<PlayerId | null>(null);
  readonly isTransitioningTurn = signal(false);
  readonly turnHandoffPending = signal(false);
  readonly isAiThinking = signal(false);

  readonly isHumanTurn = computed(
    () => this.gameMode() === 'LOCAL_2P' || this.state().activePlayer === 'PLAYER_1',
  );

  readonly bottomPlayer = computed(() => this.state().players[this.perspectivePlayerId()]);
  readonly topPlayer = computed(() => this.state().players[getOpponentId(this.perspectivePlayerId())]);

  readonly selectedHandCard = computed<CardInstance | null>(() => {
    const id = this.selectedInstanceId();
    if (!id) return null;
    return this.bottomPlayer().hand.find((card) => card.instanceId === id) ?? null;
  });

  readonly isSelectingHornTarget = computed(() => {
    const selected = this.selectedHandCard();
    return selected !== null && selected.card.type === 'SPECIAL' && selected.card.ability === 'COMMANDERS_HORN';
  });

  readonly isSelectingDecoyTarget = computed(() => {
    const selected = this.selectedHandCard();
    return selected !== null && selected.card.type === 'SPECIAL' && selected.card.ability === 'DECOY';
  });

  readonly isSelectingAgilePrePlay = computed(() => {
    const selected = this.selectedHandCard();
    return (
      selected !== null &&
      selected.card.type === 'UNIT' &&
      selected.card.ability !== 'SPY' &&
      selected.card.allowedRows.length > 1
    );
  });

  readonly medicDiscardChoices = computed<readonly CardInstance[]>(() => {
    const current = this.state();
    if (current.phase !== 'PENDING_SELECTION' || current.pendingSelection?.type !== 'MEDIC_DISCARD') {
      return [];
    }
    const player = current.players[current.pendingSelection.playerId];
    const eligible = new Set(current.pendingSelection.eligibleInstanceIds);
    return player.discard.filter((card) => eligible.has(card.instanceId));
  });

  readonly selectionPrompt = computed<string | null>(() => {
    if (!this.isHumanTurn() || this.isAiThinking()) {
      return null;
    }
    const current = this.state();
    if (current.phase === 'PENDING_SELECTION' && current.pendingSelection?.type === 'AGILE_ROW') {
      return `Médico: elige una fila permitida para ${current.pendingSelection.card.card.name}`;
    }
    const selected = this.selectedHandCard();
    if (!selected) return null;
    if (this.isSelectingDecoyTarget()) {
      return 'Señuelo: toca una unidad propia no-Héroe en el tablero';
    }
    if (this.isSelectingHornTarget()) {
      return 'Cuerno: toca una fila propia disponible';
    }
    if (this.isSelectingAgilePrePlay()) {
      return `Ágil: toca una fila permitida para ${selected.card.name}`;
    }
    return null;
  });

  readonly canCancelSelection = computed(
    () =>
      this.isHumanTurn() &&
      this.state().phase === 'PLAYING' &&
      (this.isSelectingDecoyTarget() || this.isSelectingHornTarget() || this.isSelectingAgilePrePlay()),
  );

  readonly inspectorCanConfirmPlay = computed(() => {
    const inspected = this.inspectedCard();
    const selected = this.selectedHandCard();
    if (!inspected || !selected || inspected.instanceId !== selected.instanceId) {
      return false;
    }
    if (this.isHumanInputBlocked() || this.state().phase !== 'PLAYING') {
      return false;
    }
    if (
      this.isSelectingHornTarget() ||
      this.isSelectingDecoyTarget() ||
      this.isSelectingAgilePrePlay()
    ) {
      return false;
    }
    return this.canPlayFromHand(selected.instanceId);
  });

  readonly discardModalPlayer = computed(() => {
    const id = this.discardModalPlayerId();
    return id ? this.state().players[id] : null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearTimers();
    });
  }

  startNewMatch(mode?: GameMode): void {
    this.clearTimers();
    const resolvedMode = mode ?? this.gameMode();
    this.gameMode.set(resolvedMode);

    const fresh = this.buildNewMatchState(resolvedMode);
    this.state.set(fresh);
    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
    this.discardModalPlayerId.set(null);
    this.isTransitioningTurn.set(false);
    this.isAiThinking.set(false);

    if (resolvedMode === 'VS_AI') {
      this.perspectivePlayerId.set('PLAYER_1');
      this.turnHandoffPending.set(false);
      this.scheduleAiTurnIfNeeded();
    } else {
      this.perspectivePlayerId.set(fresh.activePlayer);
      this.turnHandoffPending.set(true);
    }
  }

  confirmTurnHandoff(): void {
    this.turnHandoffPending.set(false);
  }

  clearSelection(): void {
    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
  }

  inspectCard(card: CardInstance): void {
    this.inspectedCard.set(card);
  }

  closeInspector(): void {
    this.inspectedCard.set(null);
    this.selectedInstanceId.set(null);
  }

  openDiscardModal(playerId: PlayerId): void {
    if (this.turnHandoffPending() || this.isTransitioningTurn()) return;
    this.discardModalPlayerId.set(playerId);
  }

  closeDiscardModal(): void {
    this.discardModalPlayerId.set(null);
  }

  canPlayFromHand(instanceId: string): boolean {
    if (!this.isHumanTurn() || this.isAiThinking()) {
      return false;
    }
    const current = this.state();
    return canPlayCard(current, current.activePlayer, instanceId);
  }

  isOwnRowSelectable(rowType: RowType): boolean {
    if (this.isHumanInputBlocked()) {
      return false;
    }
    const current = this.state();
    if (current.phase === 'PENDING_SELECTION' && current.pendingSelection?.type === 'AGILE_ROW') {
      return current.pendingSelection.allowedRows.includes(rowType);
    }
    if (current.phase !== 'PLAYING') {
      return false;
    }

    const selected = this.selectedHandCard();
    if (!selected) return false;

    if (selected.card.type === 'SPECIAL' && selected.card.ability === 'COMMANDERS_HORN') {
      return current.players[current.activePlayer].rows[rowType].hornCard === null;
    }
    if (selected.card.type === 'UNIT' && selected.card.ability !== 'SPY') {
      return selected.card.allowedRows.includes(rowType);
    }
    return false;
  }

  onHandCardTap(card: CardInstance): void {
    if (this.isHumanInputBlocked() || this.state().phase !== 'PLAYING') {
      return;
    }
    if (!this.canPlayFromHand(card.instanceId)) {
      this.inspectedCard.set(card);
      return;
    }

    const currentlySelectedId = this.selectedInstanceId();
    if (currentlySelectedId === card.instanceId) {
      if (
        (card.card.type === 'SPECIAL' &&
          (card.card.ability === 'COMMANDERS_HORN' || card.card.ability === 'DECOY')) ||
        (card.card.type === 'UNIT' && card.card.ability !== 'SPY' && card.card.allowedRows.length > 1)
      ) {
        this.clearSelection();
        return;
      }
      if (card.card.type === 'UNIT') {
        this.playCard(card.instanceId, card.card.allowedRows[0]);
        return;
      }
      if (card.card.type === 'SPECIAL') {
        this.playCard(card.instanceId);
        return;
      }
      return;
    }

    this.selectedInstanceId.set(card.instanceId);
    this.inspectedCard.set(card);
  }

  onOwnRowTap(rowType: RowType): void {
    const current = this.state();
    if (!this.isOwnRowSelectable(rowType)) {
      return;
    }

    if (current.phase === 'PENDING_SELECTION' && current.pendingSelection?.type === 'AGILE_ROW') {
      this.applyAction({
        type: 'SELECT_TARGET',
        playerId: current.activePlayer,
        targetRow: rowType,
      });
      return;
    }

    const selected = this.selectedHandCard();
    if (!selected) return;
    this.playCard(selected.instanceId, rowType);
  }

  onOwnUnitTap(targetCard: CardInstance): void {
    if (this.isHumanInputBlocked()) return;
    const selected = this.selectedHandCard();
    const current = this.state();
    if (!selected || !this.isSelectingDecoyTarget()) {
      return;
    }
    if (!canPlayCard(current, current.activePlayer, selected.instanceId, undefined, targetCard.instanceId)) {
      return;
    }

    this.applyAction({
      type: 'PLAY_CARD',
      playerId: current.activePlayer,
      instanceId: selected.instanceId,
      decoyTargetInstanceId: targetCard.instanceId,
    });
  }

  selectMedicTarget(targetInstanceId: string): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    if (current.phase !== 'PENDING_SELECTION' || current.pendingSelection?.type !== 'MEDIC_DISCARD') {
      return;
    }
    this.applyAction({
      type: 'SELECT_TARGET',
      playerId: current.activePlayer,
      targetInstanceId,
    });
  }

  playSelectedFromInspector(card: CardInstance): void {
    if (!this.inspectorCanConfirmPlay()) return;
    const targetRow = card.card.type === 'UNIT' ? card.card.allowedRows[0] : undefined;
    this.playCard(card.instanceId, targetRow);
  }

  passTurn(): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    this.applyAction({
      type: 'PASS_TURN',
      playerId: current.activePlayer,
    });
  }

  mulliganSwap(instanceId: string): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    if (current.phase !== 'MULLIGAN') return;
    this.applyAction({
      type: 'MULLIGAN_SWAP',
      playerId: current.activePlayer,
      instanceId,
    });
  }

  finishMulligan(): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    if (current.phase !== 'MULLIGAN') return;
    this.applyAction({
      type: 'FINISH_MULLIGAN',
      playerId: current.activePlayer,
    });
  }

  advanceRound(): void {
    const prev = this.state();
    if (prev.phase !== 'ROUND_END') return;

    const next = dispatch(prev, { type: 'ADVANCE_ROUND' });
    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
    this.discardModalPlayerId.set(null);
    this.state.set(next);

    if (this.gameMode() === 'VS_AI') {
      this.perspectivePlayerId.set('PLAYER_1');
      this.turnHandoffPending.set(false);
      this.scheduleAiTurnIfNeeded();
    } else {
      this.perspectivePlayerId.set(next.activePlayer);
      this.turnHandoffPending.set(true);
    }
  }

  private isHumanInputBlocked(): boolean {
    return (
      this.turnHandoffPending() ||
      this.isTransitioningTurn() ||
      this.isAiThinking() ||
      !this.isHumanTurn()
    );
  }

  private playCard(instanceId: string, targetRow?: RowType): void {
    const current = this.state();
    this.applyAction({
      type: 'PLAY_CARD',
      playerId: current.activePlayer,
      instanceId,
      targetRow,
    });
  }

  private applyAction(action: GameAction): void {
    const prev = this.state();
    const next = dispatch(prev, action);
    if (next === prev) {
      return;
    }

    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
    this.discardModalPlayerId.set(null);
    this.state.set(next);

    if (next.phase === 'ROUND_END' || next.phase === 'MATCH_END') {
      this.clearTimers();
      this.isTransitioningTurn.set(false);
      this.isAiThinking.set(false);
      this.turnHandoffPending.set(false);
      return;
    }

    if (this.gameMode() === 'VS_AI') {
      this.perspectivePlayerId.set('PLAYER_1');
      this.turnHandoffPending.set(false);
      this.scheduleAiTurnIfNeeded();
      return;
    }

    if (next.phase === 'PENDING_SELECTION') {
      return;
    }

    if (prev.phase === 'MULLIGAN') {
      if (next.activePlayer !== prev.activePlayer) {
        this.clearTimers();
        this.isTransitioningTurn.set(false);
        this.perspectivePlayerId.set(next.activePlayer);
        this.turnHandoffPending.set(true);
      }
      return;
    }

    if (next.phase === 'PLAYING' && next.activePlayer !== prev.activePlayer) {
      this.clearTimers();
      this.isTransitioningTurn.set(true);
      this.handoffTimerId = setTimeout(() => {
        this.handoffTimerId = null;
        this.isTransitioningTurn.set(false);
        this.perspectivePlayerId.set(next.activePlayer);
        this.turnHandoffPending.set(true);
      }, TURN_BREATHER_MS);
    }
  }

  private scheduleAiTurnIfNeeded(): void {
    if (this.gameMode() !== 'VS_AI') return;
    const current = this.state();
    const isAiPhase =
      current.phase === 'MULLIGAN' ||
      current.phase === 'PLAYING' ||
      current.phase === 'PENDING_SELECTION';

    if (!isAiPhase || current.activePlayer !== 'PLAYER_2') {
      this.isAiThinking.set(false);
      return;
    }

    if (this.aiTimerId !== null) {
      clearTimeout(this.aiTimerId);
    }

    this.isAiThinking.set(true);
    const delayMs = current.phase === 'MULLIGAN' ? AI_MULLIGAN_DELAY_MS : AI_PLAY_DELAY_MS;
    this.aiTimerId = setTimeout(() => {
      this.aiTimerId = null;
      this.isAiThinking.set(false);
      const latest = this.state();
      if (latest.activePlayer !== 'PLAYER_2') return;
      const aiAction = decideAction(createAIView(latest, 'PLAYER_2'));
      this.applyAction(aiAction);
    }, delayMs);
  }

  private buildNewMatchState(mode: GameMode): GameState {
    const deck1 = this.starterDecks[0]!;
    const deck2 = this.starterDecks[1]!;

    return createInitialGameState({
      rngSeed: (Date.now() ^ 0x5f3759df) | 0,
      catalog: this.catalog,
      player1: {
        name: mode === 'VS_AI' ? 'Tú · Reinos del Norte' : 'Jugador 1 · Norte',
        faction: deck1.faction,
        leader: null,
        deckCardIds: deck1.cardIds,
      },
      player2: {
        name: mode === 'VS_AI' ? 'IA · Nilfgaard' : 'Jugador 2 · Nilfgaard',
        faction: deck2.faction,
        leader: null,
        deckCardIds: deck2.cardIds,
      },
    });
  }

  private clearTimers(): void {
    if (this.handoffTimerId !== null) {
      clearTimeout(this.handoffTimerId);
      this.handoffTimerId = null;
    }
    if (this.aiTimerId !== null) {
      clearTimeout(this.aiTimerId);
      this.aiTimerId = null;
    }
  }
}
