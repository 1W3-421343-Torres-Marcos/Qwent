# Tablero de Progreso del Proyecto — Qwent

## Resumen de Fases

| ID de fase | Nombre | Estado | % de avance |
| :--- | :--- | :---: | :---: |
| F1 | Walking Skeleton + APK Base | [x] | 100% |
| F2 | MVP Jugable — Motor Base + Tablero | [x] | 100% |
| F3 | Habilidades Completas de The Witcher 3 | [x] | 100% |
| F4 | Oponente IA + Mulligan | [x] | 100% |
| F5 | Facciones, Líderes, Catálogo Real y Constructor de Mazos | [~] | 75% |
| F6 | Pulido Visual, UX Táctil y Release Offline | [ ] | 0% |

**Estados:** `[ ]` pendiente | `[~]` en curso | `[x]` completada

---

## F1: Walking Skeleton + APK Base
- [x] **F1.1**: Inicializar proyecto Angular (Standalone + Signals) + Tailwind CSS + TypeScript `strict: true`. | *Módulos/Archivos*: `package.json`, `tsconfig.json`, `src/app/` | *Hecho*: `npm run build` compila sin errores.
- [x] **F1.2**: Configurar Vitest y estructura base de `src/core/` con test humo inicial. | *Módulos/Archivos*: `core-engine`, `vitest.config.ts`, `src/core/` | *Hecho*: `npm test` ejecuta y pasa en verde.
- [x] **F1.3**: Integrar Capacitor Android con bloqueo horizontal (`sensorLandscape`) y pantalla completa inmersiva. | *Módulos/Archivos*: `android-packaging`, `capacitor.config.ts`, `android/` | *Hecho*: Proyecto Android sincronizado con orientación horizontal e inmersiva configuradas.
- [x] **F1.4**: Crear pantalla inicial mínima con versión de fase y script reproducible `npm run build:apk` + compilación de APK F1. | *Módulos/Archivos*: `android-packaging`, `board-ui`, `scripts/` | *Hecho*: Tests en verde y `gwent-f1-debug.apk` compilado y verificado.

## F2: MVP Jugable — Motor Base + Tablero
- [x] **F2.1**: Definir tipos de dominio, `GameState` inmutable y `cards.json` reducido de prueba (20–35 cartas) con 2 mazos fijos. | *Módulos/Archivos*: `core-engine`, `cards-and-abilities`, `src/core/models/`, `src/assets/data/cards.json` | *Hecho*: Catálogo de prueba tipado y validado con tests.
- [x] **F2.2**: Implementar motor de cálculo dinámico de puntaje con Unidades normales, Héroes, 3 Climas, Tiempo despejado y Cuerno del Comandante. | *Módulos/Archivos*: `core-engine`, `src/core/scoring/` | *Hecho*: Suite de tests unitarios de cálculo dinámico en verde.
- [x] **F2.3**: Implementar máquina de estados de partida (mano de 10 cartas, turnos, pasar turno, 2 gemas, resolución de rondas y victoria/empate). | *Módulos/Archivos*: `core-engine`, `src/core/engine/` | *Hecho*: Partida completa jugable por acciones en tests unitarios.
- [x] **F2.4**: Construir tablero táctil landscape (6 filas, zona de clima, totales, gemas, mano e inspector) en modo local 2 jugadores con pantalla intermedia opaca de cambio de turno. | *Módulos/Archivos*: `board-ui`, `src/app/features/board/` | *Hecho*: Partida de 3 rondas jugable de principio a fin sin exponer la mano rival.
- [x] **F2.5**: Verificación integral F2, suite de tests en verde, sync Capacitor y generación de APK F2. | *Módulos/Archivos*: `android-packaging`, `android/` | *Hecho*: Tests 100% en verde y `gwent-f2-debug.apk` generado y funcional.

## F3: Habilidades Completas de The Witcher 3
- [x] **F3.1**: Implementar Vínculo estrecho (`TIGHT_BOND`), Inyección de moral (`MORALE_BOOST`), Reunión (`MUSTER`) y cartas Ágiles (`allowedRows` múltiples), y ampliar `src/assets/data/cards.json` de prueba cubriendo `TIGHT_BOND`, `MORALE_BOOST`, `MUSTER`, Ágil, `SPY`, `DECOY`, `MEDIC`, `SCORCH` y `SCORCH_ROW`. | *Módulos/Archivos*: `cards-and-abilities`, `core-engine`, `src/core/`, `src/assets/data/cards.json` | *Hecho*: Todas las mecánicas de F3 jugables desde el catálogo en APK y tests de combinación/invocación en verde.
- [x] **F3.2**: Implementar Espía (`SPY`), Señuelo (`DECOY`) y Médico (`MEDIC`) incluyendo cadenas de resurrección y cambio de bando de espías. | *Módulos/Archivos*: `cards-and-abilities`, `core-engine`, `src/core/` | *Hecho*: Tests de todos los casos borde de Espía, Señuelo (fuerza 0 inmune) y cadenas Médico en verde.
- [x] **F3.3**: Implementar Tierra quemada global (`SCORCH`) y Tierra quemada de fila (`SCORCH_ROW` con umbral >= 10). | *Módulos/Archivos*: `cards-and-abilities`, `core-engine`, `src/core/` | *Hecho*: Tests de empates, autodaño en Scorch global, umbral 10 con Héroes e inmunidad de Héroes en verde.
- [x] **F3.4**: Añadir selectores interactivos en UI para fila Ágil/Cuerno, objetivo de Señuelo y modal de descarte para Médico. | *Módulos/Archivos*: `board-ui`, `src/app/features/board/` | *Hecho*: Todas las habilidades requieren y completan su selección táctil en el tablero.
- [x] **F3.5**: Verificación integral F3, suite de tests en verde, sync Capacitor y generación de APK F3. | *Módulos/Archivos*: `android-packaging`, `android/` | *Hecho*: Tests 100% en verde y `gwent-f3-debug.apk` generado y funcional.

## F4: Oponente IA + Mulligan
- [x] **F4.1**: Implementar fase de Mulligan inicial (cambio opcional de hasta 2 cartas antes de Ronda 1) en Core y UI. | *Módulos/Archivos*: `core-engine`, `board-ui`, `src/core/engine/`, `src/app/features/board/` | *Hecho*: Jugador puede devolver hasta 2 cartas al mazo, barajarlo y robar reemplazos (nunca van al descarte) con tests en verde.
- [x] **F4.2**: Implementar vista filtrada `AIPlayerView` y motor heurístico del Bot (ventaja de cartas, gestión de rondas, habilidades y pase). | *Módulos/Archivos*: `ai-opponent`, `src/core/ai/` | *Hecho*: IA decide acciones legales sin acceder a la mano ni mazo oculto del rival.
- [x] **F4.3**: Crear suite de simulación Bot vs. Bot (100+ partidas) e integrar turno automático de la IA en la UI. | *Módulos/Archivos*: `ai-opponent`, `board-ui`, `src/core/ai/` | *Hecho*: Simulaciones terminan sin bucles infinitos ni errores y modo 1 Jugador vs. IA es jugable.
- [x] **F4.4**: Verificación integral F4, suite de tests en verde, sync Capacitor y generación de APK F4. | *Módulos/Archivos*: `android-packaging`, `android/` | *Hecho*: Tests 100% en verde y `gwent-f4-debug.apk` generado y funcional.

## F5: Facciones, Líderes, Catálogo Real y Constructor de Mazos
- [x] **F5.1**: Implementar las 4 pasivas de facción (Reinos del Norte, Nilfgaard, Monstruos, Scoia'tael) y habilidades de Líder (1 uso por partida), incluyendo UI e IA para Scoia'tael y Líderes. | *Módulos/Archivos*: `cards-and-abilities`, `core-engine`, `board-ui`, `ai-opponent`, `src/core/` | *Hecho*: Tests unitarios de pasivas de facción y activación de Líderes en verde, integrados en UI e IA.
- [x] **F5.2**: Crear script ETL determinista (`scripts/etl-cards.ts`) para importar y validar el catálogo real completo hacia `cards.json`. | *Módulos/Archivos*: `cards-and-abilities`, `scripts/etl-cards.ts`, `src/assets/data/cards.json` | *Hecho*: Catálogo completo generado y tests de integridad de esquema 100% en verde.
- [x] **F5.3**: Implementar validación de mazos (mín. 22 unidades, máx. 10 especiales, facción/neutrales) y pantalla de Deck Builder con persistencia offline. | *Módulos/Archivos*: `deck-builder`, `src/core/deck/`, `src/app/features/deck-builder/` | *Hecho*: Usuario puede armar, validar, guardar y jugar con mazos propios offline.
- [ ] **F5.4**: Verificación integral F5, suite de tests en verde, sync Capacitor y generación de APK F5. | *Módulos/Archivos*: `android-packaging`, `android/` | *Hecho*: Tests 100% en verde y `gwent-f5-debug.apk` generado y funcional.

## F6: Pulido Visual, UX Táctil y Release Offline
- [ ] **F6.1**: Aplicar sistema de diseño completo de `docs/design.md` (temática taberna medieval, insignias SVG/CSS, marcos de Héroe y colores por facción). | *Módulos/Archivos*: `board-ui`, `deck-builder`, `src/app/` | *Hecho*: Interfaz cumple lineamientos visuales y de legibilidad en pantallas 16:9 a 20:9.
- [ ] **F6.2**: Incorporar animaciones livianas de cartas, efectos visuales de clima/Scorch y feedback táctil/sonoro opcional. | *Módulos/Archivos*: `board-ui`, `src/app/features/board/` | *Hecho*: Transiciones fluidas a 60fps sin bloquear la interacción táctil.
- [ ] **F6.3**: Configurar ícono adaptativo, splash screen de Android, auditoría 100% offline y compilación del APK F6 final. | *Módulos/Archivos*: `android-packaging`, `android/` | *Hecho*: Suite completa de tests en verde y `gwent-f6-debug.apk` listo para instalar y jugar offline.

---

## Registro de avance

| Fecha | Paso completado | Qué sigue |
| :--- | :--- | :--- |
| 2026-11-23 | Estructuración documental modular (`AGENTS.md`, `docs/`, `.agent/skills/`) | Planificar e iniciar **F1** (Walking Skeleton + APK Base) |
| 2026-11-23 | **F1.1**: Proyecto Angular 19 (Standalone + Signals + `OnPush`) + Tailwind CSS + TypeScript `strict: true` compilando con `npm run build` | **F1.2**: Configurar Vitest puro y estructura base de `src/core/` |
| 2026-11-23 | **F1.2**: Vitest puro (sin `TestBed`) + estructura `src/core/` + PRNG determinista `Mulberry32` y 3 tests humo pasando | **F1.3**: Integrar Capacitor Android con bloqueo `sensorLandscape` y modo inmersivo |
| 2026-11-23 | **F1.3**: Capacitor Android sincronizado con `sensorLandscape`, modo inmersivo (`WindowCompat`/`WindowInsetsControllerCompat`), cutout `shortEdges` y sin permiso `INTERNET` | **F1.4**: Pantalla inicial landscape, `scripts/build-apk.mjs` y compilación de APK F1 |
| 2026-11-23 | **F1.4**: Pantalla inicial landscape (`AppComponent` conectado a `QWENT_PHASE` y `nextRng`), `scripts/build-apk.mjs` multiplataforma y `builds/apks/gwent-f1-debug.apk` (3.92 MB) compilado con tests en verde | Planificar e iniciar **F2** (MVP Jugable — Motor Base + Tablero) con `/plan F2` |
| 2026-11-23 | **F2.1**: Tipos de dominio, `GameState` (`hornCard`/`WeatherSlot`), `GameAction`, `cards.json` (35 cartas) y `starter-decks.json` (2 mazos) validados (6 tests en verde) | **F2.2**: Implementar motor de cálculo dinámico de puntaje en `src/core/scoring/` |
| 2026-11-23 | **F2.2**: Motor dinámico `calculate-strength.ts` (`recalculateBoard`) con clima, Héroes y Cuerno (11 tests en verde) | **F2.3**: Implementar máquina de estados de partida en `src/core/engine/` |
| 2026-11-23 | **F2.3**: Máquina de estados (`setup.ts`, `round-resolution.ts`, `reducer.ts`) con trazabilidad de climas/cuernos, moneda determinista y auto-pase con/sin líder (16 tests en verde) | **F2.4**: Construir tablero táctil landscape TW3 con modo local 2 jugadores |
| 2026-11-23 | **F2.4**: Tablero TW3 (`BoardPageComponent`, `BoardRowComponent`, `HandBarComponent`, `CardTokenComponent`, `CardDetailComponent` flotante, `BoardOverlaysComponent` con handoff 450ms y hold-to-pass 600ms) compilando sin errores | **F2.5**: Verificación integral F2 y compilación de `gwent-f2-debug.apk` |
| 2026-11-23 | **F2.5**: `npm run build:apk -- --phase=f2` completado (16 tests en verde, `builds/apks/gwent-f2-debug.apk` 3.98 MB) | Planificar e iniciar **F3** (Habilidades Completas de The Witcher 3) con `/plan F3` |
| 2026-11-23 | **F3.1**: Catálogo F3 (`cards.json` 35 cartas, `starter-decks.json` con todas las mecánicas), `TIGHT_BOND`, `MORALE_BOOST`, `MUSTER` no recursivo y Ágiles validados (19 tests en verde) | **F3.2**: Implementar `SPY`, `DECOY` y `MEDIC` con cadenas de resurrección |
| 2026-11-23 | **F3.2**: `SPY` (clima/cuerno/descarte rival), `DECOY` (fuerza 0 inmune) y `MEDIC` con cadenas (`MEDIC -> MEDIC/SPY/MUSTER/AGILE_ROW`) validados (23 tests en verde) | **F3.3**: Implementar `SCORCH` global y `SCORCH_ROW` con umbral >= 10 |
| 2026-11-23 | **F3.3**: `SCORCH` global y `SCORCH_ROW` (umbral >= 10 con Héroes, solo Héroes sin destruir, recálculo inmediato y vía Médico) validados (27 tests en verde) | **F3.4**: Añadir selectores interactivos e íconos SVG en `board-ui` |
| 2026-11-23 | **F3.4**: Selectores pre-jugada cancelables (Ágil, Cuerno, Señuelo), modal `MEDIC_DISCARD` y fila encadenada `AGILE_ROW` + SVGs F3 compilando sin errores | **F3.5**: Verificación integral F3 y compilación de `gwent-f3-debug.apk` |
| 2026-11-23 | **F3.5**: `npm run build:apk -- --phase=f3` completado (27 tests en verde, `builds/apks/gwent-f3-debug.apk` 3.98 MB) | Planificar e iniciar **F4** (Oponente IA + Mulligan) con `/plan F4` |
| 2026-11-23 | **F4.1**: Fase inicial `MULLIGAN` (hasta 2 cambios devueltos y re-barajados al mazo, nunca descarte) en Core + modal táctil UI (30 tests en verde, `ng build` OK) | **F4.2**: Implementar `AIPlayerView` y motor heurístico del Bot en `src/core/ai/` |
| 2026-11-23 | **F4.2**: `AIPlayerView` aislada (`ai-view.ts`), heurísticas de ronda/ventaja de cartas/Nilfgaard (`heuristics.ts`) y `decideAction` (`bot-player.ts`) validados (35 tests en verde) | **F4.3**: Suite de simulación Bot vs. Bot (120 partidas) e integración 1P vs. IA en UI |
| 2026-11-23 | **F4.3**: Simulación de 150 partidas Bot vs. Bot (0 bucles/errores, 37 tests en verde) + modo 1P vs. IA integrado en UI (`ng build` OK) | **F4.4**: Verificación integral F4, `gwent-f4-debug.apk` y tag `v0.4.0-f4` |
| 2026-11-23 | **F4.4**: `npm run build:apk -- --phase=f4` completado (37 tests en verde, `builds/apks/gwent-f4-debug.apk` 3.97 MB) y tag `v0.4.0-f4` | Planificar e iniciar **F5** (Facciones, Líderes, Catálogo Real y Constructor de Mazos) con `/plan F5` |
| 2026-11-23 | **F5.1**: Las 4 pasivas de facción y habilidades de Líder implementadas y probadas en Core (`factions.ts`, `leaders.ts`), IA (`ai-view.ts`, `heuristics.ts`) y UI (`BoardPage`, `BoardOverlays`), con 47 tests en verde (incluidas 270 simulaciones Bot vs. Bot) y `ng build` OK | **F5.2**: Crear script ETL determinista (`scripts/etl-cards.ts`) y catálogo de 4 facciones + Líderes |
| 2026-11-23 | **F5.2**: Script ETL determinista `scripts/etl-cards.ts` (CSV/JSON), dataset curado base `scripts/data/base-cards.json` y catálogo `cards.json` (74 cartas con las 4 facciones y 16 Líderes) validado con `etl-cards.spec.ts` (50 tests en verde) | **F5.3**: Validador de mazos, 4 mazos prearmados y Deck Builder offline |
| 2026-11-23 | **F5.3**: Validador `validateDeck`, 4 mazos prearmados con Líderes reales (`starter-decks.json`), `DeckStorageService` (`qwent.decks.v1`), `DeckBuilderPageComponent` y selector en Menú/Facade verificados (54 tests en verde + `ng build` OK) | **F5.4**: Verificación integral F5, APK F5 y cierre con tag `v0.5.0-f5` |
