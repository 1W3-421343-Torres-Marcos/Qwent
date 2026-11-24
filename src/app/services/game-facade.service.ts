import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import rawCards from '../../assets/data/cards.json';
import {
  QWENT_PHASE,
  canPlayCard,
  canUseLeader,
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
} from '../../core';
import { FACTION_META } from '../shared/constants/faction-meta';
import {
  buildAiPlayLabel,
  detectLostGemPlayers,
  detectNilfgaardTieBanner,
  detectRoundAdvanceBanners,
  type AiPlayPreview,
  type BoardBannerData,
  type BoardBannerPayload,
} from './board-events.utils';
import { DeckStorageService } from './deck-storage.service';
import { FeedbackService, type FeedbackCue } from './feedback.service';
import { MatchHistoryService } from './match-history.service';

export type GameMode = 'VS_AI' | 'LOCAL_2P';
export type VisualEffectType =
  | 'SCORCH'
  | 'WEATHER_FROST'
  | 'WEATHER_FOG'
  | 'WEATHER_RAIN'
  | 'WEATHER_CLEAR'
  | 'HORN'
  | 'HERO'
  | 'MEDIC'
  | 'MUSTER'
  | 'ROUND_END';

const TURN_BREATHER_MS = 450;
const AI_PLAY_DELAY_MS = 1350;
const AI_MULLIGAN_DELAY_MS = 650;
const VISUAL_FX_DURATION_MS = 480;
const BANNER_DURATION_MS = 1200;
const AI_PREVIEW_DURATION_MS = 1200;
const GEM_BREAK_DURATION_MS = 650;

@Injectable({ providedIn: 'root' })
export class GameFacadeService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly deckStorage = inject(DeckStorageService);
  private readonly feedback = inject(FeedbackService);
  private readonly matchHistory = inject(MatchHistoryService);
  private readonly catalog = rawCards as readonly CardDefinition[];
  private handoffTimerId: ReturnType<typeof setTimeout> | null = null;
  private aiTimerId: ReturnType<typeof setTimeout> | null = null;
  private fxTimerId: ReturnType<typeof setTimeout> | null = null;
  private bannerTimerId: ReturnType<typeof setTimeout> | null = null;
  private bannerQueue: BoardBannerPayload[] = [];
  private bannerSeq = 0;
  private aiPreviewTimerId: ReturnType<typeof setTimeout> | null = null;
  private aiPreviewSeq = 0;
  private gemBreakTimerId: ReturnType<typeof setTimeout> | null = null;

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
  readonly visualEffect = signal<VisualEffectType | null>(null);
  readonly activeBanner = signal<BoardBannerData | null>(null);
  readonly aiPlayPreview = signal<AiPlayPreview | null>(null);
  readonly lostGemPlayers = signal<readonly PlayerId[]>([]);

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

  readonly leaderTargetChoices = computed<readonly CardInstance[]>(() => {
    const current = this.state();
    if (current.phase !== 'PENDING_SELECTION' || current.pendingSelection?.type !== 'LEADER_TARGET') {
      return [];
    }
    const pending = current.pendingSelection;
    const sourcePlayerId =
      pending.source === 'OWN_DISCARD' ? pending.playerId : getOpponentId(pending.playerId);
    const eligible = new Set(pending.eligibleInstanceIds);
    return current.players[sourcePlayerId].discard.filter((card) => eligible.has(card.instanceId));
  });

  readonly canUseBottomLeader = computed(
    () => !this.isHumanInputBlocked() && canUseLeader(this.state(), this.perspectivePlayerId()),
  );

  readonly inspectedIsUsableBottomLeader = computed(() => {
    const inspected = this.inspectedCard();
    const bottom = this.bottomPlayer();
    return (
      inspected !== null &&
      inspected.card.type === 'LEADER' &&
      inspected.instanceId === `leader_${bottom.id}` &&
      this.canUseBottomLeader()
    );
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
    if (this.inspectedIsUsableBottomLeader()) {
      return true;
    }
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

  readonly inspectorConfirmLabel = computed(() =>
    this.inspectedIsUsableBottomLeader() ? 'Activar Líder' : 'Jugar carta',
  );

  readonly discardModalPlayer = computed(() => {
    const id = this.discardModalPlayerId();
    return id ? this.state().players[id] : null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearTimers();
      this.clearFxTimer();
      this.clearBanners();
      this.clearAiPreview();
      this.clearGemBreak();
    });
  }

  startNewMatch(mode?: GameMode): void {
    this.clearTimers();
    this.clearFxTimer();
    this.clearBanners();
    this.clearAiPreview();
    this.clearGemBreak();
    this.visualEffect.set(null);
    const resolvedMode = mode ?? this.gameMode();
    this.gameMode.set(resolvedMode);

    const fresh = this.buildNewMatchState(resolvedMode);
    this.state.set(fresh);
    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
    this.discardModalPlayerId.set(null);
    this.isTransitioningTurn.set(false);
    this.isAiThinking.set(false);
    this.feedback.play('gameStart');

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
    this.feedback.play('turnMe');
  }

  abandonMatch(): void {
    this.clearTimers();
    this.clearFxTimer();
    this.clearBanners();
    this.clearAiPreview();
    this.clearGemBreak();
    this.isAiThinking.set(false);
    this.isTransitioningTurn.set(false);
    this.turnHandoffPending.set(false);
    this.selectedInstanceId.set(null);
    this.inspectedCard.set(null);
    this.discardModalPlayerId.set(null);
    this.visualEffect.set(null);
    this.feedback.play('tap');
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
      this.feedback.play('tap');
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
    this.feedback.play('tap');
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

  inspectLeader(playerId: PlayerId): void {
    const player = this.state().players[playerId];
    if (!player.leader) return;
    this.selectedInstanceId.set(null);
    this.inspectedCard.set({
      instanceId: `leader_${player.id}`,
      definitionId: player.leader.id,
      card: player.leader,
      effectiveStrength: 0,
    });
  }

  useLeader(): void {
    if (!this.canUseBottomLeader()) return;
    const current = this.state();
    this.applyAction({
      type: 'USE_LEADER',
      playerId: current.activePlayer,
    });
  }

  selectLeaderTarget(targetInstanceId: string): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    if (current.phase !== 'PENDING_SELECTION' || current.pendingSelection?.type !== 'LEADER_TARGET') {
      return;
    }
    this.applyAction({
      type: 'SELECT_TARGET',
      playerId: current.activePlayer,
      targetInstanceId,
    });
  }

  selectScoiataelStarter(startingPlayer: PlayerId): void {
    if (this.isHumanInputBlocked()) return;
    const current = this.state();
    if (
      current.phase !== 'PENDING_SELECTION' ||
      current.pendingSelection?.type !== 'SCOIATAEL_START_CHOICE'
    ) {
      return;
    }
    this.applyAction({
      type: 'SELECT_TARGET',
      playerId: current.activePlayer,
      startingPlayer,
    });
  }

  playSelectedFromInspector(card: CardInstance): void {
    if (!this.inspectorCanConfirmPlay()) return;
    if (card.card.type === 'LEADER') {
      this.useLeader();
      return;
    }
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
    this.feedback.play('roundStart');
    const roundBanners = detectRoundAdvanceBanners(prev, next, this.perspectivePlayerId());
    for (const banner of roundBanners) {
      this.enqueueBanner(banner);
    }

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
    this.emitVisualAndFeedback(prev, next, action);
    this.emitTurnAndCoinBanners(prev, next, action);
    this.triggerAiPlayPreview(prev, action);
    const lostGems = detectLostGemPlayers(prev, next);
    if (lostGems.length > 0) {
      this.triggerGemBreak(lostGems);
    }

    if (next.phase === 'ROUND_END' || next.phase === 'MATCH_END') {
      const nilfTieBanner = detectNilfgaardTieBanner(next);
      if (nilfTieBanner) {
        this.enqueueBanner(nilfTieBanner);
      }
      if (prev.phase !== 'MATCH_END' && next.phase === 'MATCH_END') {
        this.matchHistory.recordCompletedMatch(next, this.gameMode());
      }
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
      if (
        next.pendingSelection?.type === 'SCOIATAEL_START_CHOICE' &&
        next.activePlayer !== prev.activePlayer
      ) {
        this.clearTimers();
        this.isTransitioningTurn.set(false);
        this.perspectivePlayerId.set(next.activePlayer);
        this.turnHandoffPending.set(true);
      }
      return;
    }

    if (
      prev.phase === 'PENDING_SELECTION' &&
      prev.pendingSelection?.type === 'SCOIATAEL_START_CHOICE' &&
      next.phase === 'PLAYING'
    ) {
      if (next.activePlayer !== prev.activePlayer) {
        this.clearTimers();
        this.isTransitioningTurn.set(false);
        this.perspectivePlayerId.set(next.activePlayer);
        this.turnHandoffPending.set(true);
      }
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
    const p1Faction = this.deckStorage.selectedPlayerFaction();
    const p2Faction = this.deckStorage.selectedOpponentFaction();
    const deck1 = this.deckStorage.getDeckForFaction(p1Faction);
    const deck2 = this.deckStorage.getDeckForFaction(p2Faction);
    const leader1 = this.deckStorage.getLeaderDefinition(deck1.leaderId);
    const leader2 = this.deckStorage.getLeaderDefinition(deck2.leaderId);

    const p1Label = FACTION_META[p1Faction].shortLabel;
    const p2Label = FACTION_META[p2Faction].shortLabel;

    return createInitialGameState({
      rngSeed: (Date.now() ^ 0x5f3759df) | 0,
      catalog: this.catalog,
      player1: {
        name: mode === 'VS_AI' ? `Tú · ${p1Label}` : `Jugador 1 · ${p1Label}`,
        faction: p1Faction,
        leader: leader1,
        deckCardIds: deck1.cardIds,
      },
      player2: {
        name: mode === 'VS_AI' ? `IA · ${p2Label}` : `Jugador 2 · ${p2Label}`,
        faction: p2Faction,
        leader: leader2,
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
    this.clearAiPreview();
  }

  private clearAiPreview(): void {
    if (this.aiPreviewTimerId !== null) {
      clearTimeout(this.aiPreviewTimerId);
      this.aiPreviewTimerId = null;
    }
    this.aiPlayPreview.set(null);
  }

  private clearGemBreak(): void {
    if (this.gemBreakTimerId !== null) {
      clearTimeout(this.gemBreakTimerId);
      this.gemBreakTimerId = null;
    }
    this.lostGemPlayers.set([]);
  }

  private triggerGemBreak(players: readonly PlayerId[]): void {
    this.clearGemBreak();
    this.lostGemPlayers.set(players);
    this.gemBreakTimerId = setTimeout(() => {
      this.gemBreakTimerId = null;
      this.lostGemPlayers.set([]);
    }, GEM_BREAK_DURATION_MS);
  }

  private triggerAiPlayPreview(prev: GameState, action: GameAction): void {
    if (this.gameMode() !== 'VS_AI') return;
    if (action.type !== 'PLAY_CARD' && action.type !== 'USE_LEADER') return;
    if (action.playerId !== 'PLAYER_2') return;

    const card =
      action.type === 'PLAY_CARD'
        ? prev.players.PLAYER_2.hand.find((c) => c.instanceId === action.instanceId)?.card ?? null
        : prev.players.PLAYER_2.leader;

    if (!card) return;

    this.clearAiPreview();
    this.aiPlayPreview.set({
      id: ++this.aiPreviewSeq,
      card,
      label: buildAiPlayLabel(card),
    });
    this.aiPreviewTimerId = setTimeout(() => {
      this.aiPreviewTimerId = null;
      this.aiPlayPreview.set(null);
    }, AI_PREVIEW_DURATION_MS);
  }

  private clearFxTimer(): void {
    if (this.fxTimerId !== null) {
      clearTimeout(this.fxTimerId);
      this.fxTimerId = null;
    }
  }

  private clearBanners(): void {
    if (this.bannerTimerId !== null) {
      clearTimeout(this.bannerTimerId);
      this.bannerTimerId = null;
    }
    this.bannerQueue = [];
    this.activeBanner.set(null);
  }

  private enqueueBanner(payload: BoardBannerPayload): void {
    this.bannerQueue.push(payload);
    if (this.activeBanner() === null && this.bannerTimerId === null) {
      this.pumpBannerQueue();
    }
  }

  private pumpBannerQueue(): void {
    const next = this.bannerQueue.shift();
    if (!next) {
      this.activeBanner.set(null);
      this.bannerTimerId = null;
      return;
    }

    this.activeBanner.set({ ...next, id: ++this.bannerSeq });
    this.bannerTimerId = setTimeout(() => {
      this.bannerTimerId = null;
      this.activeBanner.set(null);
      this.pumpBannerQueue();
    }, BANNER_DURATION_MS);
  }

  private emitTurnAndCoinBanners(prev: GameState, next: GameState, action: GameAction): void {
    const startedRoundOneFromCoin =
      (prev.phase === 'MULLIGAN' ||
        (prev.phase === 'PENDING_SELECTION' &&
          prev.pendingSelection?.type === 'SCOIATAEL_START_CHOICE')) &&
      next.phase === 'PLAYING';

    if (startedRoundOneFromCoin) {
      const iStart = next.activePlayer === this.perspectivePlayerId();
      this.enqueueBanner({
        title: iStart ? 'Moneda: Empiezas tú' : 'Moneda: Empieza el rival',
        subtitle: 'Ronda 1',
        tone: 'GOLD',
        icon: 'COIN',
      });
      return;
    }

    if (action.type === 'PASS_TURN' && next.phase === 'PLAYING') {
      const iPassed = action.playerId === this.perspectivePlayerId();
      this.enqueueBanner({
        title: iPassed ? 'Has pasado' : 'El rival ha pasado',
        tone: iPassed ? 'NEUTRAL' : 'CRIMSON',
        icon: 'PASS',
      });
      return;
    }

    if (
      this.gameMode() === 'VS_AI' &&
      prev.phase === 'PLAYING' &&
      next.phase === 'PLAYING' &&
      prev.activePlayer === 'PLAYER_2' &&
      next.activePlayer === 'PLAYER_1'
    ) {
      this.enqueueBanner({ title: 'Tu turno', tone: 'GOLD', icon: 'TURN' });
      this.feedback.play('turnMe');
    } else if (
      this.gameMode() === 'VS_AI' &&
      prev.phase === 'PLAYING' &&
      next.phase === 'PLAYING' &&
      prev.activePlayer === 'PLAYER_1' &&
      next.activePlayer === 'PLAYER_2'
    ) {
      this.feedback.play('turnOp');
    }
  }

  private triggerVisualEffect(effect: VisualEffectType): void {
    this.clearFxTimer();
    this.visualEffect.set(effect);
    this.fxTimerId = setTimeout(() => {
      this.fxTimerId = null;
      this.visualEffect.set(null);
    }, VISUAL_FX_DURATION_MS);
  }

  private emitVisualAndFeedback(prev: GameState, next: GameState, action: GameAction): void {
    if (next.phase === 'MATCH_END') {
      this.triggerVisualEffect('ROUND_END');
      this.feedback.play(next.winner === this.perspectivePlayerId() ? 'gameWin' : 'gameLose');
      return;
    }

    if (next.phase === 'ROUND_END') {
      this.triggerVisualEffect('ROUND_END');
      const lastRound = next.roundHistory[next.roundHistory.length - 1];
      this.feedback.play(lastRound?.winner === this.perspectivePlayerId() ? 'roundWin' : 'roundLose');
      return;
    }

    if (action.type === 'MULLIGAN_SWAP') {
      this.feedback.play('redraw');
      return;
    }

    if (this.didScorchOccur(prev, next, action)) {
      this.triggerVisualEffect('SCORCH');
      this.feedback.play('scorch');
      return;
    }

    const weatherOutcome = this.resolveWeatherTransition(prev, next);
    if (weatherOutcome) {
      this.triggerVisualEffect(weatherOutcome.fx);
      this.feedback.play(weatherOutcome.cue);
      return;
    }

    const hornAdded = (['PLAYER_1', 'PLAYER_2'] as const).some((p) =>
      (['CLOSE_COMBAT', 'RANGED', 'SIEGE'] as const).some(
        (r) => prev.players[p].rows[r].hornCard === null && next.players[p].rows[r].hornCard !== null,
      ),
    );
    if (hornAdded) {
      this.triggerVisualEffect('HORN');
      this.feedback.play('horn');
      return;
    }

    if (action.type === 'PASS_TURN') {
      this.feedback.play('pass');
      return;
    }

    if (action.type === 'SELECT_TARGET' && prev.pendingSelection?.type === 'MEDIC_DISCARD') {
      this.triggerVisualEffect('MEDIC');
      this.feedback.play('medic');
      return;
    }

    if (action.type === 'PLAY_CARD') {
      const played = prev.players[action.playerId].hand.find(
        (c) => c.instanceId === action.instanceId,
      );
      if (played) {
        const outcome = this.resolvePlayedCardOutcome(played, action.targetRow);
        if (outcome.fx) {
          this.triggerVisualEffect(outcome.fx);
        }
        this.feedback.play(outcome.cue);
        return;
      }
    }

    if (action.type === 'USE_LEADER') {
      this.triggerVisualEffect('HERO');
      this.feedback.play('hero');
      return;
    }

    this.feedback.play('cardPlay');
  }

  private resolveWeatherTransition(
    prev: GameState,
    next: GameState,
  ): { readonly fx: VisualEffectType; readonly cue: FeedbackCue } | null {
    if (prev.weather.frost === null && next.weather.frost !== null) {
      return { fx: 'WEATHER_FROST', cue: 'frost' };
    }
    if (prev.weather.fog === null && next.weather.fog !== null) {
      return { fx: 'WEATHER_FOG', cue: 'fog' };
    }
    if (prev.weather.rain === null && next.weather.rain !== null) {
      return { fx: 'WEATHER_RAIN', cue: 'rain' };
    }
    const hadWeather = prev.weather.frost !== null || prev.weather.fog !== null || prev.weather.rain !== null;
    const hasWeather = next.weather.frost !== null || next.weather.fog !== null || next.weather.rain !== null;
    if (hadWeather && !hasWeather) {
      return { fx: 'WEATHER_CLEAR', cue: 'clearWeather' };
    }
    return null;
  }

  private resolvePlayedCardOutcome(
    played: CardInstance,
    targetRow?: RowType,
  ): { readonly fx: VisualEffectType | null; readonly cue: FeedbackCue } {
    if (played.card.isHero) {
      return { fx: 'HERO', cue: 'hero' };
    }
    switch (played.card.ability) {
      case 'SPY':
        return { fx: null, cue: 'spy' };
      case 'MEDIC':
        return { fx: 'MEDIC', cue: 'medic' };
      case 'MUSTER':
        return { fx: 'MUSTER', cue: 'muster' };
      case 'TIGHT_BOND':
        return { fx: null, cue: 'bond' };
      case 'MORALE_BOOST':
        return { fx: null, cue: 'morale' };
      case 'DECOY':
        return { fx: null, cue: 'decoy' };
      case 'COMMANDERS_HORN':
        return { fx: 'HORN', cue: 'horn' };
      default: {
        const resolvedRow = targetRow ?? played.card.allowedRows[0];
        if (resolvedRow === 'SIEGE') return { fx: null, cue: 'cardSiege' };
        if (resolvedRow === 'RANGED') return { fx: null, cue: 'cardRanged' };
        return { fx: null, cue: 'cardClose' };
      }
    }
  }

  private didScorchOccur(prev: GameState, next: GameState, action: GameAction): boolean {
    if (action.type === 'PLAY_CARD') {
      const played = prev.players[action.playerId].hand.find(
        (c) => c.instanceId === action.instanceId,
      );
      if (played?.card.ability === 'SCORCH') {
        return true;
      }
      if (played?.card.ability === 'SCORCH_ROW') {
        const oppId = getOpponentId(action.playerId);
        return next.players[oppId].discard.length > prev.players[oppId].discard.length;
      }
    }
    if (action.type === 'USE_LEADER') {
      const ability = prev.players[action.playerId].leader?.leaderAbility;
      if (ability === 'SCORCH_ENEMY_CLOSE_10' || ability === 'SCORCH_ENEMY_SIEGE_10') {
        const oppId = getOpponentId(action.playerId);
        return next.players[oppId].discard.length > prev.players[oppId].discard.length;
      }
    }
    return false;
  }
}
