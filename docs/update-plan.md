# Tablero de Actualizaciones Post-v1.0.0 — Qwent

> [!NOTE]
> Las fases fundacionales **F1–F6** hasta la versión **`v1.0.0`** quedaron cerradas al 100% en [plan.md](file:///c:/Users/marco/Documents/Estudio/practicas%20programacion/Qwent/docs/plan.md).
> A partir de **`v1.0.0`**, toda nueva mejora, corrección, ajuste de balance o cambio se planifica y registra aquí.

## Resumen de Actualizaciones

| ID | Título | Estado | % de avance |
| :--- | :--- | :---: | :---: |
| U1 | Arte local de cartas TW3 (100% offline) | [x] | 100% |
| U2 | Audio de taberna offline, FX de cartas y regla Vaca → Chort | [x] | 100% |
| U3 | Salir de partida en juego, historial offline y ritmo de IA | [x] | 100% |

**Estados:** `[ ]` pendiente | `[~]` en curso | `[x]` completada

---

## Backlog / Actualizaciones Planificadas

## U3: Salir de partida en juego, historial offline y ritmo de IA
- [x] **U3.1**: Delay de IA más pausado (`1350 ms` / `650 ms`), `abandonMatch()` y botón **Salir** con confirmación en tablero
- [x] **U3.2**: Servicio offline `MatchHistoryService` (`qwent.history.v1`), helpers puros, guardado al finalizar partida y tests Vitest
- [x] **U3.3**: Pantalla de Historial de Partidas (`MatchHistoryPageComponent`) y botón de acceso desde el Menú
- [x] **U3.4**: Versión `1.3.0`, verificación completa, APK `gwent-u3-debug.apk`, tag `v1.3.0` y push a GitHub

## U2: Audio de taberna offline, FX de cartas y regla Vaca → Chort
- [x] **U2.1**: Script `scripts/import-tw3-audio.ts` e importación offline de 29 SFX, 4 temas de taberna y sprite de *Bovine Defense Force*
- [x] **U2.2**: Motor de audio `FeedbackService` (SFX MP3 + BGM en bucle), triggers en `GameFacadeService` y controles en Menú/Tablero
- [x] **U2.3**: Efectos visuales GPU al colocar cartas y activar habilidades (`styles.css`, `CardTokenComponent` y `BoardPageComponent`)
- [x] **U2.4**: Regla clásica *La Vaca* (`nt_cow` → *Fuerza de Defensa Bovina* fuerza `8`) en `round-resolution.ts` + tests unitarios
- [x] **U2.5**: Auditoría de integridad offline, versión `1.2.0`, APK `gwent-u2-debug.apk`, tag `v1.2.0` y push a GitHub

## U1: Arte local de cartas TW3 (100% offline)
- [x] **U1.1**: Script determinista `scripts/import-tw3-sprites.ts` y descarga de sprites TW3 en `src/assets/cards/<id>.jpg`
- [x] **U1.2**: Helper `card-art.ts` e integración visual en tablero, tokens, mano, inspector y líderes
- [x] **U1.3**: Integración en overlays (`Mulligan`, `Médico`, descarte) y Constructor de Mazos
- [x] **U1.4**: Auditoría de integridad offline, versión `1.1.0`, compilación APK (`gwent-u1-debug.apk`) y tag `v1.1.0`

---

## Registro de avance

| Fecha | Cambio completado | Qué sigue |
| :--- | :--- | :--- |
| 2026-11-23 | Lanzamiento **`v1.0.0`**: catálogo base TW3 completo (**150** cartas únicas / **207** coleccionables + Líderes), F1–F6 al 100% y apertura de `docs/update-plan.md` | Planificar nuevas mejoras o correcciones aquí tras `v1.0.0` |
| 2026-11-23 | **U1.1**: Creado `scripts/import-tw3-sprites.ts` (`npm run import:sprites`) e importados **150/150** sprites `.jpg` TW3 offline en `src/assets/cards/` (`5.94 MB` totales) | U1.2: Helper `card-art.ts` e integración visual en tablero, tokens, mano, inspector y líderes |
| 2026-11-23 | **U1.2**: Creado `src/app/shared/constants/card-art.ts` e integrados retratos TW3 con gradiente legible y fallback SVG en `CardTokenComponent`, `HandBarComponent`, `CardDetailComponent` y botones de Líder en `BoardPageComponent` | U1.3: Integración en overlays (`Mulligan`, `Médico`, descarte) y Constructor de Mazos |
| 2026-11-23 | **U1.3**: Integrados retratos con fallback SVG en `BoardOverlaysComponent` (Mulligan, Médico, objetivo de Líder y pila de descarte) y miniaturas `aspect-[3/4]` en `DeckBuilderPageComponent` | U1.4: Auditoría de integridad offline, versión `1.1.0`, build APK y tag `v1.1.0` |
| 2026-11-23 | **U1.4 (`v1.1.0`)**: Auditoría offline ampliada a **150/150** sprites JPEG válidos (**58/58** tests en verde), build Angular `359.19 kB` iniciales y APK **`gwent-u1-debug.apk`** (`9.96 MB`) compilado en verde | Completada **U1**; continuando con **U2** |
| 2026-11-23 | **U2.1**: Creado `scripts/import-tw3-audio.ts` (`npm run import:audio`) e importados **29 SFX + 4 temas BGM + `nt_bovine_defense_force.jpg`** (`6.79 MB` totales) | U2.2: Motor de audio `FeedbackService`, cues en `GameFacadeService` y controles en Menú/Tablero |
| 2026-11-23 | **U2.2**: Actualizado `FeedbackService` (SFX polifónicos MP3 + BGM en bucle con autoplay unlock y pausa en segundo plano), triggers enriquecidos en `GameFacadeService` / `DeckBuilderPageComponent` y controles de música/SFX en `AppComponent` y `BoardPageComponent` | U2.3: Efectos visuales GPU al colocar cartas y activar habilidades |
| 2026-11-23 | **U2.3**: Añadidas animaciones GPU por tipo de carta (`CardTokenComponent`) y overlays diferenciados por clima/habilidad en `BoardPageComponent` y `styles.css` | U2.4: Regla clásica *La Vaca* (`nt_cow` → *Fuerza de Defensa Bovina*) en Core + tests |
| 2026-11-23 | **U2.4**: Implementada regla *Vengador* (`nt_cow` → *Fuerza de Defensa Bovina* fuerza `8`) en `round-resolution.ts`, actualizada descripción en `cards.json` y añadidos tests en `avenger.spec.ts` | U2.5: Auditoría offline, versión `1.2.0`, APK `gwent-u2-debug.apk`, tag `v1.2.0` y push |
| 2026-11-23 | **U2.5 (`v1.2.0`)**: Auditoría offline ampliada (**151** retratos `.jpg`, **29** SFX + **4** BGM MP3 válidos), **15** archivos / **61** tests en verde, build Angular `370.82 kB` iniciales y APK **`gwent-u2-debug.apk`** (`16.77 MB`) compilado en verde | Completada **U2**; listo para probar en dispositivo o planificar **U3** |
| 2026-11-24 | **U3.1**: Aumentado delay de la IA a `1350 ms` / `650 ms` en `GameFacadeService`, añadido `abandonMatch()` y botón **Salir** con modal de confirmación en `BoardPageComponent` | U3.2: Servicio offline `MatchHistoryService` (`qwent.history.v1`), guardado al finalizar partida y tests Vitest |
| 2026-11-24 | **U3.2**: Creados `match-history.utils.ts`, `MatchHistoryService` (`qwent.history.v1`), tests Vitest en `match-history.spec.ts` y registro automático en `GameFacadeService` al llegar a `MATCH_END` | U3.3: Pantalla `MatchHistoryPageComponent` y acceso desde el Menú Principal |
| 2026-11-24 | **U3.3**: Creada pantalla `MatchHistoryPageComponent` (filtros, stats, puntajes ronda a ronda y borrado con confirmación) e integrado acceso `Historial (N)` en `AppComponent` | U3.4: Versión `1.3.0`, verificación completa, APK `gwent-u3-debug.apk`, tag `v1.3.0` y push |
| 2026-11-24 | **U3.4 (`v1.3.0`)**: Incluido `src/app/**/*.spec.ts` en `vitest.config.ts` (**16** archivos / **65** tests en verde), build Angular `387.43 kB` iniciales y APK **`gwent-u3-debug.apk`** (`16.77 MB`) compilado en verde | Completada **U3**; listo para instalar en Android o planificar **U4** |
