# AGENTS.md — Reglas Persistentes del Proyecto Qwent

## Propósito y Alcance
App Android (`.apk`) 100% offline que replica el minijuego **Gwent** de *The Witcher 3* (sin provisiones, daño/armadura entre unidades ni robo automático entre rondas; tablero de 3 filas por jugador).

## Stack Técnico
- **Core (`src/core/`)**: TypeScript `strict: true`, 100% puro (cero imports de Angular, DOM o Capacitor).
- **UI (`src/app/`)**: Angular (Standalone Components + Signals + `OnPush`) + Tailwind CSS.
- **Móvil (`android/`)**: Capacitor + Android Gradle (`assembleDebug`).
- **Testing**: Vitest puro (motor `src/core/`, catálogo y simulaciones IA corren sin `TestBed` de Angular).
- **Datos**: JSON local embebido (`src/assets/data/cards.json`, mazos base) y almacenamiento local. Sin APIs externas.

## Arquitectura y Reglas Innegociables
1. **Separación estricta Core vs. UI (Clean Core funcional)**:
   - `src/core/` es máquina de estados pura `(state: GameState, action: GameAction) => GameState` con estado inmutable, acciones tipadas (`PLAY_CARD`, `PASS_TURN`, `USE_LEADER`, `SELECT_TARGET`, `MULLIGAN_SWAP`) y PRNG determinista (`rngSeed` en `GameState`) para azar (prohibido `Math.random()`).
   - *Por qué*: permite testear reglas/casos borde y simulaciones IA vs. IA en Vitest en milisegundos sin Angular ni Android.
2. **Cálculo dinámico de puntajes (NUNCA mutar `baseStrength`)**:
   - Ante cualquier cambio en mesa, cada unidad y fila se recalculan desde `baseStrength` en este orden estricto para unidades normales (los **Héroes** son inmunes a todo y conservan `baseStrength`):
     a) `baseStrength`.
     b) Clima activo (`WEATHER_FROST`=Cuerpo a cuerpo, `WEATHER_FOG`=Distancia, `WEATHER_RAIN`=Asedio): fija el valor base en `1`.
     c) Vínculo estrecho (`TIGHT_BOND`): multiplica por la cantidad de cartas con igual `bondGroup` en la fila.
     d) Inyección de moral (`MORALE_BOOST`): `+1` por cada *otra* unidad con esta habilidad en la fila.
     e) Cuerno del Comandante (`COMMANDERS_HORN` o unidad con efecto cuerno): duplica (`x2`) la fila (tope: un `x2` por fila; una unidad con efecto cuerno no se duplica por su propia habilidad, pero sí si hay `COMMANDERS_HORN` en la ranura u otra unidad cuerno en la fila).
3. **Esquema normalizado y estrategia de datos**:
   - `allowedRows` siempre es array (`["CLOSE_COMBAT"]`, `["CLOSE_COMBAT", "RANGED"]`, etc.), resolviendo Ágiles sin lógica especial.
   - Habilidades tipadas: `TIGHT_BOND`, `MORALE_BOOST`, `SPY`, `MEDIC`, `MUSTER`, `SCORCH`, `SCORCH_ROW`, `DECOY`, `COMMANDERS_HORN`, `WEATHER_FROST`, `WEATHER_FOG`, `WEATHER_RAIN`, `WEATHER_CLEAR`, `BERSERKER`, `MARDROEME`, `WEATHER_STORM`.
   - F2–F4 usan un `cards.json` de prueba (20–35 cartas) cubriendo casos borde. En F5 un script ETL determinista genera el catálogo completo desde un dataset local curado (CSV/JSON aportado por el usuario o importado desde una fuente pública verificada), validado por tests.
4. **Entregable APK obligatorio en CADA fase (Walking Skeleton)**:
   - F1 configura Capacitor, orientación `sensorLandscape`, modo inmersivo y `npm run build:apk`.
   - Toda fase (F1–F6) cierra ejecutando tests en verde, sync de Capacitor, compilación de `gwent-f<N>-debug.apk` y verificación de arranque.

## Supuestos de Diseño ante Ambigüedades
- **Facciones jugables**: Incluye las 5 facciones clásicas de TW3 (`NORTHERN_REALMS`, `NILFGAARD`, `MONSTERS`, `SCOIATAEL`, y `SKELLIGE` de *Blood and Wine*) más `NEUTRAL`.
- **Modo 2 jugadores en F2–F3**: Pantalla de transición entre turnos ("Pasar dispositivo") sobre tablero único para ocultar la mano hasta integrar IA en F4.
- **Almacenamiento local**: `localStorage` tras repositorio tipado por ser síncrono, offline y nativo en WebView sin plugins extra.

## Convenciones de Código
- TypeScript `strict: true`, prohibido `any` y mutaciones directas de estado.
- Código en inglés (`PascalCase` tipos, `camelCase` funciones/campos, `UPPER_SNAKE_CASE` enums/acciones); UI y docs en español.
- Angular Standalone + `OnPush` + Signals (`signal`, `computed`) + Tailwind CSS.
- **Versionado Git**: Commit (Conventional Commits) tras cada paso/cambio relevante con tests en verde, y tag `v0.<N>.0-f<N>` al cerrar fase.

## Lo que el Agente NUNCA Debe Hacer
- Nunca mezclar reglas dentro de componentes Angular.
- Nunca mutar `baseStrength` ni "deshacer clima" restando valores a mano.
- Nunca depender de APIs externas ni imágenes por URL (usar CSS/SVG desacoplado para sprites locales futuros).
- Nunca inventar de memoria el catálogo completo de ~200 cartas ni consumir APIs externas en tiempo de ejecución (se permite importar datasets públicos verificados a `scripts/data/` y procesarlos offline mediante `scripts/etl-cards.ts`).
- Nunca permitir que la IA lea la mano oculta ni el orden del mazo del jugador humano.
- Nunca avanzar de fase sin tests en verde y sin el `.apk` de la fase generado.
- Nunca rediseñar el área jugable ni ocultar/colapsar filas tras scroll o pestañas; replicar fielmente el tablero clásico de *The Witcher 3* definido en `docs/design.md`.

## Protocolo de trabajo
1. Cuando el usuario use `/plan` o pida planificar un cambio, actualización o paso (ej: "/plan U1"):
   a. Leer el alcance actual en `docs/update-plan.md` (`docs/plan.md` quedó cerrado en `v1.0.0`) y las skills de los módulos involucrados (solo esas).
   b. Generar el artefacto nativo de Antigravity: Implementation Plan + Task List, con diagramas cuando aporten (arquitectura, flujos, modelo de datos). No responder con un plan en texto plano en el chat.
   c. Detenerse y esperar la aprobación del usuario. No escribir código antes.
2. Al ejecutar, trabajar paso por paso siguiendo la Task List aprobada.
3. Al terminar CADA paso, y antes de continuar con el siguiente, actualizar en `docs/update-plan.md`: los checkboxes, la tabla de resumen (estado y %) y el Registro de avance.
4. Al terminar una actualización o versión, marcar los criterios de aceptación en los SKILL.md de los módulos involucrados y resumir qué quedó usable.
5. Leer solo la skill del módulo que se está tocando. No cargar documentación de otros módulos.
