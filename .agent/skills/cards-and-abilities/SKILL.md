---
name: cards-and-abilities
description: Usar al trabajar en el esquema cards.json, resolución de habilidades de cartas, pasivas de facción, líderes o el script ETL del catálogo.
---

# Módulo: Cards, Abilities, Factions & Leaders

## Especificaciones Técnicas
- **Esquema normalizado (`CardDefinition` en `cards.json`)**:
  - `id: string`, `name: string`, `faction: FactionId`, `type: 'UNIT' | 'SPECIAL' | 'LEADER'`.
  - `baseStrength: number` (0 para especiales/líderes), `isHero: boolean`.
  - `allowedRows: RowType[]` (siempre array, ej. `["CLOSE_COMBAT"]`, o `["CLOSE_COMBAT", "RANGED"]` para Ágiles).
  - `ability: AbilityType | null` usando unión estricta: `TIGHT_BOND`, `MORALE_BOOST`, `SPY`, `MEDIC`, `MUSTER`, `SCORCH`, `SCORCH_ROW`, `DECOY`, `COMMANDERS_HORN`, `WEATHER_FROST`, `WEATHER_FOG`, `WEATHER_RAIN`, `WEATHER_CLEAR`.
  - Metadatos opcionales: `bondGroup?: string`, `musterGroup?: string`, `leaderAbility?: LeaderAbilityType` (para `type === 'LEADER'`), `maxCopies: number`, `description: string`.
- **Estrategia de catálogo por fases**:
  - **F2–F4**: `src/assets/data/cards.json` reducido de prueba (20 a 35 cartas) cubriendo todas las habilidades y casos borde.
  - **F5**: Script determinista `scripts/etl-cards.ts` que transforma un dataset local curado (CSV/JSON aportado por el usuario o importado desde una fuente pública verificada) en `cards.json` y valida integridad (sin IDs duplicados, campos válidos, enums válidos). Prohibido inventar cartas de memoria o consumir APIs externas en tiempo de ejecución.

## Reglas de Negocio (Casos Borde Obligatorios TW3)
- **Tierra quemada global (`SCORCH` especial)**: Evalúa la fuerza **efectiva actual** (post clima/vínculo/moral/cuerno) de todas las unidades **NO-Héroe** en **AMBOS lados** del tablero. Destruye la más alta; si hay empate, destruye **todas** las empatadas (incluyendo propias). Héroes y Señuelos (fuerza 0) se ignoran. Puede jugarse incluso si no hay objetivos NO-Héroe en mesa (se descarta sin destruir nada).
- **Tierra quemada de fila (`SCORCH_ROW`, ej. Villentretenmerth)**: Evalúa solo la fila espejo del rival (ej. Cuerpo a cuerpo rival si la unidad entra en Cuerpo a cuerpo). Solo se activa si la **fuerza total de esa fila rival es >= 10** (los Héroes sí suman para el umbral de 10). Destruye la(s) unidad(es) NO-Héroe de mayor fuerza efectiva en esa fila.
- **Médico (`MEDIC`)**: Permite elegir y revivir 1 unidad **NO-Héroe** de tu pila de descarte (nunca Héroes ni cartas especiales). La unidad revivida entra al tablero y **dispara su habilidad** (permite cadenas `MEDIC -> MEDIC`, `MEDIC -> SPY`, `MEDIC -> MUSTER`). Si no hay objetivos válidos en descarte, entra al tablero sin efecto de resurrección.
- **Espía (`SPY`)**: Se coloca en la fila correspondiente del **RIVAL** (sumándole puntos a él) y quien la jugó roba **2 cartas** de su mazo (si quedan 1 o 0, roba lo disponible sin error). Un Espía NO-Héroe pertenece ahora al campo rival: el rival puede recuperarlo con Señuelo y al fin de ronda va al descarte del **RIVAL**. Espías Héroe son inmunes a Señuelo y Médico.
- **Señuelo (`DECOY`)**: Solo puede reemplazar una unidad **NO-Héroe** de **TU propio lado** del tablero (incluidos Espías NO-Héroe rivales en tu campo) devolviéndola a tu mano. El Señuelo queda en esa fila con fuerza 0 (inmune a buffs, Scorch y otro Señuelo) y va al descarte al fin de ronda. Recálculo inmediato. Si no tienes unidades válidas en mesa, no puede jugarse.
- **Climas y Tiempo despejado**: Climas son simétricos (afectan la fila correspondiente de ambos jugadores) y idempotentes (repetir un clima no se apila). Fijan fuerza base de NO-Héroes en `1`; Vínculo, Moral y Cuerno aplican **después** sobre ese `1`. `WEATHER_CLEAR` limpia todos los climas activos simultáneamente y recalcula todo.
- **Reunión (`MUSTER`)**: Al jugarse, invoca automáticamente todas las copias con el mismo `musterGroup` desde tu **mazo Y tu mano** (nunca desde el descarte) colocándolas en sus filas permitidas.
- **Cuerno del Comandante**: Tope de un único efecto `x2` por fila (carta en slot de Cuerno o unidad con efecto cuerno). Una unidad con efecto cuerno no se duplica por su propia habilidad, pero sí si hay `COMMANDERS_HORN` en la ranura u otra unidad con efecto cuerno en la fila. La carta especial `COMMANDERS_HORN` no puede jugarse en una fila cuya ranura de cuerno ya esté ocupada.
- **Pasivas de Facción (F5)**:
  - **Reinos del Norte**: roba 1 carta adicional al ganar una ronda.
  - **Nilfgaard**: gana las rondas empatadas (en espejo **Nilfgaard vs. Nilfgaard**, un empate quita 1 gema a ambos).
  - **Monstruos**: conserva 1 unidad aleatoria **NO-Héroe** de su propio lado del tablero al finalizar cada ronda para la siguiente (excluyendo Héroes y Señuelos, usando el PRNG determinista).
  - **Scoia'tael**: elige quién empieza la Ronda 1 (jugador o rival; en espejo **Scoia'tael vs. Scoia'tael**, el inicio se decide por moneda con el PRNG determinista).
- **Líderes (F5)**: 1 carta de Líder por jugador, activable 1 sola vez por partida (equivale a un turno).

## Archivos que Toca
- `src/core/abilities/ability-resolver.ts`
- `src/core/abilities/factions.ts`
- `src/core/abilities/leaders.ts`
- `src/core/abilities/__tests__/*.spec.ts`
- `src/assets/data/cards.json`
- `scripts/etl-cards.ts`

## Criterios de Aceptación
- [x] Esquema `cards.json` validado con array `allowedRows` y unión estricta de habilidades.
- [x] Tests unitarios en verde para todos los casos borde: `SCORCH`, `SCORCH_ROW` (>=10), `MEDIC` (y cadenas), `SPY`, `DECOY`, Climas + `WEATHER_CLEAR`, `TIGHT_BOND`, `MORALE_BOOST`, `COMMANDERS_HORN` y `MUSTER`.
- [x] (F5) Pasivas de las 4 facciones y habilidades de Líder implementadas y probadas.
- [x] (F5) Script `scripts/etl-cards.ts` genera y valida el catálogo real completo de forma determinista.
