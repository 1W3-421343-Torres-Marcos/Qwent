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
| U4 | Sensación en vivo de partida TW3 (banners, preview IA, corona y gemas) | [ ] | 0% |
| U5 | Fidelidad visual del tablero, artes alternativos, dorsos y climas | [ ] | 0% |
| U6 | 5.º Líder por facción (*Hearts of Stone*) y localización completa al español | [ ] | 0% |
| U7 | Expansión *Blood and Wine* (Skellige) y niveles de dificultad de IA | [ ] | 0% |

**Estados:** `[ ]` pendiente | `[~]` en curso | `[x]` completada

---

## Backlog / Actualizaciones Planificadas

### Pendientes (Hoja de Ruta TW3)

## U4: Sensación en vivo de partida TW3 (`v1.4.0`)
- [ ] **U4.1**: Banners centrales no bloqueantes (`BoardBannerComponent`, ~`1200 ms`, animación GPU) y cola en `GameFacadeService` para moneda inicial, cambio de turno (*"Tu turno"* / *"Turno del rival"* con `turn_me.mp3` / `turn_op.mp3`), pase, inicio de Ronda 2/3 y activación de pasivas de facción / Vengador
- [ ] **U4.2**: Preview flotante breve (~`1100 ms`) de la última carta o habilidad de Líder jugada por la IA antes de resolverse o ir al descarte
- [ ] **U4.3**: Corona dorada en el marcador del jugador que lidera la ronda actual y animación GPU al perder/quebrarse una gema de vida
- [ ] **U4.4**: Tests en verde, versión `1.4.0`, compilación de `gwent-u4-debug.apk` (`--phase=u4`) y tag `v1.4.0`

## U5: Fidelidad visual del tablero, artes alternativos, dorsos y climas (`v1.5.0`)
- [ ] **U5.1**: Importación offline de las variantes de arte originales (`_1`..`_4` en `asundr/gwent-classic/img/sm/`) en `scripts/import-tw3-sprites.ts` y resolución determinista por instancia en `card-art.ts` para unidades multi-copia (*Nekker*, *Arachas*, *Gul*, *Defensor de Mahakam*, *Experto en asedio kaedweni*, *Hostigador élfico*, etc.)
- [ ] **U5.2**: Miniaturas reales de cartas activas en la caja de Clima (`sp_biting_frost`, `sp_impenetrable_fog`, `sp_torrential_rain`) y en la ranura de Cuerno (`sp_commanders_horn`), más dorsos ilustrados SVG/CSS por facción en las pilas de Mazo
- [ ] **U5.3**: Capas atmosféricas CSS GPU sobre las filas afectadas por clima (escarcha en Cuerpo a cuerpo, niebla en Distancia y lluvia en Asedio, respetando `prefers-reduced-motion`)
- [ ] **U5.4**: Auditoría offline actualizada en `offline-audit.spec.ts`, versión `1.5.0`, `gwent-u5-debug.apk` (`--phase=u5`) y tag `v1.5.0`

## U6: 5.º Líder por facción (*Hearts of Stone*) y localización completa al español (`v1.6.0`)
- [ ] **U6.1**: Implementar en Clean Core (`types.ts`, `leaders.ts`, `calculate-strength.ts`), catálogo, IA y sprites los 4 quintos líderes de *Hearts of Stone*: *Foltest: Hijo de Medell* (`SCORCH_ENEMY_RANGED_10`), *Emhyr: Invasor del Norte* (`RANDOMIZE_REVIVES`), *Eredin: El Traidor* (`DOUBLE_SPY_STRENGTH`) y completar los 5 líderes de Scoia'tael (*Francesca: La Hermosa* + habilidad `OPTIMIZE_AGILE_ROWS` en *Esperanza de Aen Seidhe*), cubierto por tests en `leaders.spec.ts`
- [ ] **U6.2**: Diccionario determinista de localización al español oficial de TW3 en `scripts/import-tw3-dataset.ts` para unificar nombres y descripciones que quedaron en inglés sin alterar ningún `id` (preservando compatibilidad con `localStorage`)
- [ ] **U6.3**: Validación ETL + tests en verde, versión `1.6.0`, `gwent-u6-debug.apk` (`--phase=u6`) y tag `v1.6.0`

## U7: Expansión *Blood and Wine* (Facción Skellige) y niveles de dificultad de IA (`v1.7.0`)
- [ ] **U7.1**: Actualizar alcance en `AGENTS.md` e implementar en Clean Core la 5.ª facción `SKELLIGE`: pasiva de Ronda 3 (revive hasta 2 unidades no-Héroe aleatorias del descarte con `rngSeed`), habilidades `BERSERKER` + `MARDROEME` (*Ermion* + especial *Mardroeme* → *Vildkaarl* / *Joven Vildkaarl* + `sfx/mardroeme.mp3`), *Kambi* → *Hemdall* (`11` Héroe), *Cerys* (`MUSTER` con *Doncellas Escuderas*), clima dual *Tormenta de Skellige* (`WEATHER_STORM`: Niebla + Lluvia) y líderes *Crach an Craite* y *Rey Bran*
- [ ] **U7.2**: Importar las cartas de Skellige + 2 líderes + 3 tokens + *Tormenta de Skellige* y sus sprites (incluidas variantes de *Shield Maiden*), emblema SVG, paleta en `faction-meta.ts` y mazo inicial en `starter-decks.json`
- [ ] **U7.3**: Niveles de dificultad del Bot en `src/core/ai/` (`NOVICE`, `TAVERNER`, `MASTER`) manteniendo intacta la vista honesta `AIPlayerView`, selector en Menú Principal persistido en `localStorage` e indicador en `MatchHistoryService`
- [ ] **U7.4**: Simulaciones Bot vs. Bot con las 5 facciones y 3 dificultades en `bot-simulation.spec.ts`, auditoría offline, versión `1.7.0`, `gwent-u7-debug.apk` (`--phase=u7`) y tag `v1.7.0`

### Completadas

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
| 2026-11-24 | Planificación integral de la hoja de ruta **U4–U7** (`v1.4.0`–`v1.7.0`) registrada en `docs/update-plan.md` | Ejecutar **U4** cuando el usuario lo indique |
