---
name: board-ui
description: Usar al construir o modificar la interfaz táctil del tablero de 6 filas, mano de cartas, marcadores, selectores de objetivo e integración Angular con el Core.
---

# Módulo: Board UI (Interfaz Táctil Landscape Angular + Signals)

## Especificaciones Técnicas
- **Puente Core-UI (`GameFacadeService`)**:
  - Servicio Angular `@Injectable({ providedIn: 'root' })` que mantiene un `signal<GameState>` y expone `computed()` derivados (totales, cartas jugables, acciones legales, fila seleccionada, carta inspeccionada).
  - Único punto que invoca `dispatch(state, action)` del Core y coordina los turnos del Bot (con breve delay visual opcional en F4).
- **Arquitectura de Componentes (Standalone + `OnPush` + Tailwind)**:
  - `BoardPageComponent`: contenedor principal `100vw x 100dvh` en orientación horizontal sin scroll global.
  - `BoardRowComponent`: renderiza una fila (`CLOSE_COMBAT`, `RANGED`, `SIEGE`), su total dinámico, indicador visual de clima activo, ranura de Cuerno del Comandante y lista de cartas en fila.
  - `CardTokenComponent`: ficha compacta en tablero con CSS/SVG (fuerza efectiva coloreada, marco dorado para Héroes y solo 1 ícono chico de habilidad si posee; sin ícono de fila para preservar legibilidad, alineado con `docs/design.md`).
  - `CardDetailModalComponent` / `CardInspectorComponent`: vista detallada al tocar una carta, modal de pila de descarte, selector de objetivo para `MEDIC` y `MULLIGAN`, y overlays explícitos para `ROUND_END` (resumen de puntajes, pérdida de gema y botón para `ADVANCE_ROUND`) y `MATCH_END` (resultado final y reinicio).
  - `HandBarComponent`: mano táctil inferior con selección de carta y resaltado de destinos válidos.
- **Seguridad Táctil**:
  - Botón **Pasar Ronda** con activación por pulsación sostenida (`hold-to-pass` ~600ms) para evitar toques accidentales.

## Reglas de Negocio
- **Fidelidad espacial TW3**: El layout de `BoardPageComponent` y `BoardRowComponent` debe conservar la silueta y lectura espacial clásica de *The Witcher 3* (todas las zonas visibles a la vez, nunca colapsadas en tabs ni desplazadas fuera de vista; orden interno de fila `Total -> Cuerno -> Unidades`).
- **Cero lógica de reglas en la UI**: Los componentes nunca calculan puntajes, ni deciden qué destruye Scorch ni mutan cartas. Solo muestran lo que entrega `GameState` y despachan `GameAction`s.
- **Flujos de selección interactiva (Pre-jugada vs. `PENDING_SELECTION`)**:
  - **Pre-jugada (cancelable en UI)**: Al seleccionar una carta **Ágil** (`allowedRows.length > 1`), **Cuerno del Comandante** o **Señuelo (`DECOY`)**, se iluminan únicamente las filas/unidades propias válidas (con posibilidad de cancelar tocando afuera antes de confirmar) y al elegir objetivo se despacha `PLAY_CARD` con el payload completo. Si `DECOY` no tiene unidades NO-Héroe propias en mesa o todas las ranuras de Cuerno están ocupadas, la carta aparece deshabilitada en la mano.
  - **`PENDING_SELECTION` (irreversible post-jugada)**: Reservado para triggers disparados tras jugar la carta (`MEDIC_DISCARD`, cadenas como `MEDIC -> AGILE_ROW`, `LEADER_TARGET` y `SCOIATAEL_START_CHOICE`), abriendo el modal/overlay táctil correspondiente hasta completar la cadena.
- **Modo local 2 jugadores (F2–F3)**: Pantalla intermedia opaca de "Turno del Jugador X — Toca para continuar" entre turnos para no revelar la mano del oponente antes de habilitar el Bot en F4.
- **Respeto estricto de `docs/design.md`**: Colores de facción, alto contraste en números y soporte opcional de sprites locales sin romper el layout si faltan imágenes.

## Archivos que Toca
- `src/app/services/game-facade.service.ts`
- `src/app/features/board/board-page.component.*`
- `src/app/features/board/components/board-row.component.*`
- `src/app/features/board/components/hand-bar.component.*`
- `src/app/features/board/components/selection-overlay.component.*`
- `src/app/shared/components/card-token.component.*`
- `src/app/shared/components/card-detail.component.*`

## Criterios de Aceptación
- [x] `GameFacadeService` desacoplado dirige toda interacción vía `GameState` inmutable y `GameAction`.
- [x] El área jugable respeta la disposición espacial clásica de TW3 (3 columnas, 6 filas simétricas visibles simultáneamente con orden Total -> Cuerno -> Unidades, clima al centro-izquierda y pilas a la derecha).
- [x] Tablero horizontal de 6 filas, zona de clima, gemas, contadores y mano legibles en resoluciones móviles `16:9` a `20:9`.
- [ ] Flujos interactivos completos para Ágil, Cuerno, Señuelo, Médico (incluyendo cadenas), Mulligan y overlays `ROUND_END`/`MATCH_END`.
- [x] Botón "Pasar Ronda" protegido contra toques accidentales y cero dependencias/URLs externas.
- [ ] (F6) Diseño visual completo de `docs/design.md` + animaciones livianas fluidas aplicadas.
