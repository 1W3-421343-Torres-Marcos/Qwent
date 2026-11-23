---
name: ai-opponent
description: Usar al implementar o ajustar el bot oponente, la vista filtrada de estado para la IA, heurísticas de decisión o simulaciones Bot vs. Bot.
---

# Módulo: AI Opponent (Bot Desacoplado y Simulaciones)

## Especificaciones Técnicas
- **Aislamiento de información (`AIPlayerView`)**:
  - Función constructora pura `createAIView(state: GameState, botId: PlayerId): AIPlayerView`.
  - Expone exclusivamente: mano del bot, `myDeckCount` y `myDeckCardIds` **desordenados** (nunca el orden real de robo ni nada oculto del rival), tablero visible completo, climas activos, descartes visibles, gemas, puntajes, estado de pase de ambos y **solo la cantidad** de cartas en mano y mazo del jugador humano.
  - La firma del Bot es `decideAction(view: AIPlayerView): GameAction` (cero acceso a `GameState` crudo para garantizar por compilación que nunca hace trampa).
- **Motor heurístico (`src/core/ai/`)**:
  - Evalúa todas las acciones legales disponibles según fase: `MULLIGAN_SWAP`, `FINISH_MULLIGAN`, `PLAY_CARD`, `SELECT_TARGET`, `USE_LEADER` y `PASS_TURN`, asignando una puntuación táctica según contexto de ronda.
  - En fase `MULLIGAN`, cambia cartas subóptimas (ej. duplicados de `MUSTER` o climas redundantes) y finaliza con `FINISH_MULLIGAN`.
  - Resuelve de forma determinista y sin bloqueo cualquier `PENDING_SELECTION` o payload de selección que disparen sus propias cartas (Ágil, Cuerno, Médico, Señuelo, Líder, Scoia'tael).
- **Suite de simulación (`Bot vs. Bot`)**:
  - Runner en Vitest capaz de ejecutar `100+` partidas completas automáticas con límite de seguridad de turnos para verificar ausencia de bucles infinitos, jugadas ilegales o excepciones no manejadas.

## Reglas de Negocio
- **Principio fundamental de Gwent (Ventaja de cartas / Card Advantage)**:
  - El Bot no debe "vaciar la mano" en Ronda 1 si no es necesario.
  - **Ronda 1**: Prioriza ganar ventaja de cartas (jugar `SPY`, recuperar con `DECOY`). Si el rival ya pasó: si el Bot va ganando (o empatando siendo Nilfgaard contra no-Nilfgaard), pasa de inmediato; si va perdiendo (o empatando contra Nilfgaard), evalúa si puede superar en 1–2 cartas eficientes o ceder la ronda con `PASS_TURN`. Si ninguno pasó y va perdiendo por mucha diferencia (>15 puntos o >2 cartas de desventaja para alcanzar), evalúa `PASS_TURN` temprano para conservar cartas para Rondas 2 y 3.
  - **Ronda 2**: Si ganó Ronda 1 (tiene 2 gemas y rival 1), puede hacer "bleeding" moderado o pasar temprano si tiene desventaja de cartas; si perdió Ronda 1, **nunca** puede pasar perdiendo salvo que no tenga cartas o sea matemáticamente imposible remontar.
  - **Ronda 3**: Juega con todo lo restante; nunca pasa mientras tenga cartas que sumen puntaje positivo y siga abajo o pueda asegurar ventaja.
- **Prioridades tácticas**:
  - Evalúa `SCORCH` solo cuando la suma destruida en el campo rival supera el valor potencial destruido en el propio.
  - Evita lanzar climas que perjudiquen más su propia fila que la del rival.
  - Aprovecha `MEDIC` solo si hay objetivos válidos no-Héroe en descarte.

## Archivos que Toca
- `src/core/ai/ai-view.ts`
- `src/core/ai/heuristics.ts`
- `src/core/ai/bot-player.ts`
- `src/core/ai/__tests__/bot-simulation.spec.ts`
- `src/core/ai/__tests__/ai-decisions.spec.ts`

## Criterios de Aceptación
- [ ] `AIPlayerView` oculta estrictamente las cartas en mano y orden del mazo del jugador humano.
- [ ] El Bot resuelve acciones normales y selecciones pendientes (`MEDIC`, `DECOY`, filas Ágiles/Cuerno) sin errores.
- [ ] El Bot pasa de forma inteligente cuando ya superó a un rival que pasó o cuando conviene ceder Ronda 1 por ventaja de cartas.
- [ ] Simulación automatizada de 100+ partidas Bot vs. Bot completa el 100% de las partidas en estado `MATCH_END` sin bucles infinitos.
