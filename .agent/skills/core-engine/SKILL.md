---
name: core-engine
description: Usar al desarrollar o modificar el estado inmutable de partida, flujo de turnos y rondas, gemas de vida o el motor de cálculo dinámico de puntajes en src/core.
---

# Módulo: Core Engine (Estado, Flujo de Partida y Puntaje Dinámico)

## Especificaciones Técnicas
- **Pureza absoluta**: Todo `src/core/` usa TypeScript `strict: true` sin dependencias de Angular, DOM, `window` ni Capacitor.
- **Estado Inmutable (`GameState`)**:
  - `phase`: `'MULLIGAN' | 'PLAYING' | 'PENDING_SELECTION' | 'ROUND_END' | 'MATCH_END'`.
  - `roundNumber`: `1 | 2 | 3`.
  - `activePlayer`: `'PLAYER_1' | 'PLAYER_2'`.
  - `rngSeed: number`: semilla para PRNG determinista (ej. Mulberry32) usado en toda operación aleatoria (barajado, mulligan, moneda, pasiva de Monstruos); prohibido `Math.random()`.
  - `players`: registro de ambos jugadores (`PlayerState`: `faction`, `leader`, `leaderUsed`, `gems` [inicia en 2], `passed`, `hand`, `deck`, `discard`, `rows` para `CLOSE_COMBAT`, `RANGED`, `SIEGE` con `hasHornCard`, `mulligansRemaining`). Cada carta en partida es una `CardInstance` con `instanceId` único (distinto del `id` de catálogo).
  - `weather`: conjunto activo (`frost`, `fog`, `rain`) compartido simétricamente entre ambos jugadores.
  - `pendingSelection`: reservado exclusivamente para triggers irreversibles posteriores a jugar una carta o habilidad (`MEDIC_DISCARD`, cadenas como `MEDIC -> AGILE_ROW`, `LEADER_TARGET` y `SCOIATAEL_START_CHOICE`). Las selecciones previas a jugar (`AGILE_ROW`, `HORN_ROW`, `DECOY_TARGET`) se resuelven en la UI permitiendo cancelar antes de confirmar y se envían como payload dentro de `PLAY_CARD`.
  - `roundHistory` y `winner`.
- **Acciones tipadas (`GameAction`)**:
  - `PLAY_CARD`, `PASS_TURN`, `USE_LEADER`, `SELECT_TARGET`, `MULLIGAN_SWAP`, `FINISH_MULLIGAN`, `ADVANCE_ROUND`. Todas las acciones sobre cartas (`PLAY_CARD`, `SELECT_TARGET`, `MULLIGAN_SWAP`) referencian `instanceId`.
  - Función reductora pura: `dispatch(state: GameState, action: GameAction): GameState`.
- **Pipeline de cálculo dinámico (`src/core/scoring/`)**:
  - Función pura `recalculateBoard(state)` que computa la fuerza efectiva de cada `CardInstance` en mesa y los totales de fila y jugador **siempre partiendo de `baseStrength`**, sin mutarlo jamás.

## Reglas de Negocio
- **Flujo clásico TW3**:
  - Mano inicial de **10 cartas** robadas del mazo al inicio de la partida. **No hay robo automático entre rondas** (salvo habilidades/pasivas explícitas).
  - Mejor de 3 rondas: cada jugador inicia con **2 gemas**. Quien pierde una ronda pierde 1 gema; en **empate**, ambos pierden 1 gema (salvo pasiva de Nilfgaard). Quien queda con 0 gemas pierde la partida (si ambos llegan a 0, empate global).
  - Un jugador que pasa (`PASS_TURN`) no puede jugar más cartas ni usar Líder en esa ronda; el rival puede seguir jugando hasta pasar o quedarse sin acciones. Al quedarse con 0 cartas en mano **NO hay auto-pase** si el jugador aún tiene disponible su carta de Líder.
  - `activePlayer` **no rota** hasta resolver por completo cualquier cadena de `PENDING_SELECTION`.
  - Cuando ambos pasan, finaliza la ronda y todas las unidades/climas/cuernos de la mesa van a sus respectivos descartes (respetando pasivas como Monstruos).
- **Orden estricto del cálculo de fuerza (unidades normales)**:
  1. Partir de `baseStrength`.
  2. Si hay clima activo para esa fila (`frost` en `CLOSE_COMBAT`, `fog` en `RANGED`, `rain` en `SIEGE`), el valor base pasa a `1`.
  3. **Vínculo estrecho (`TIGHT_BOND`)**: multiplicar el valor actual por el número de cartas en esa misma fila con igual `bondGroup`.
  4. **Inyección de moral (`MORALE_BOOST`)**: sumar `+1` por cada *otra* unidad con `MORALE_BOOST` en la misma fila (nunca se suma a sí misma).
  5. **Cuerno del Comandante**: una unidad se duplica (`x2`) si `row.hasHornCard || existe otra unidad con efecto cuerno en la fila` (máximo un `x2` por fila; una unidad con efecto cuerno no se duplica por su propia habilidad).
  - **Cartas Héroe (`isHero: true`)**: inmunes a clima, vínculo, moral, cuerno, Scorch, Señuelo y Médico; su fuerza efectiva es siempre `baseStrength`.
  - **Señuelo (`DECOY`)**: ocupa lugar en la fila con fuerza `0` fija, inmune a buffs/nerfs.
- **Mulligan (F4)**: Antes de la Ronda 1, cada jugador puede cambiar hasta 2 cartas de su mano devolviéndolas al mazo (mezclado) y robando reemplazos.

## Archivos que Toca
- `src/core/models/types.ts`
- `src/core/models/game-state.ts`
- `src/core/models/actions.ts`
- `src/core/scoring/calculate-strength.ts`
- `src/core/engine/reducer.ts`
- `src/core/engine/round-resolution.ts`
- `src/core/engine/__tests__/*.spec.ts`

## Criterios de Aceptación
- [x] `GameState` y `GameAction` tipados con `strict: true` y cero mutaciones directas.
- [x] Cálculo dinámico verificado con tests para clima + vínculo + moral + cuerno + Héroes en un mismo tablero.
- [x] Flujo completo de partida (10 cartas, turnos, pasar, 2 gemas, empate y fin de partida) cubierto por tests en verde.
- [ ] Fase `MULLIGAN` (hasta 2 cambios pre-Ronda 1) probada unitariamente.
- [x] Cero imports de Angular, DOM o Capacitor en `src/core/`.
