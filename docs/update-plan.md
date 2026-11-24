# Tablero de Actualizaciones Post-v1.0.0 — Qwent

> [!NOTE]
> Las fases fundacionales **F1–F6** hasta la versión **`v1.0.0`** quedaron cerradas al 100% en [plan.md](file:///c:/Users/marco/Documents/Estudio/practicas%20programacion/Qwent/docs/plan.md).
> A partir de **`v1.0.0`**, toda nueva mejora, corrección, ajuste de balance o cambio se planifica y registra aquí.

## Resumen de Actualizaciones

| ID | Título | Estado | % de avance |
| :--- | :--- | :---: | :---: |
| U1 | Arte local de cartas TW3 (100% offline) | [x] | 100% |

**Estados:** `[ ]` pendiente | `[~]` en curso | `[x]` completada

---

## Backlog / Actualizaciones Planificadas

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
| 2026-11-23 | **U1.4 (`v1.1.0`)**: Auditoría offline ampliada a **150/150** sprites JPEG válidos (**58/58** tests en verde), build Angular `359.19 kB` iniciales y APK **`gwent-u1-debug.apk`** (`9.96 MB`) compilado en verde | Esperar feedback o planificar **U2** en este archivo |
