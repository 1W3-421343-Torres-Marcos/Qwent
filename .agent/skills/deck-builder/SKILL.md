---
name: deck-builder
description: Usar al implementar el constructor de mazos, selector de facción y líder, validación de reglas de mazo, mazos prearmados y persistencia local.
---

# Módulo: Deck Builder (Constructor y Validación de Mazos)

## Especificaciones Técnicas
- **Validador puro en Core (`src/core/deck/validate-deck.ts`)**:
  - Recibe una lista de IDs de cartas, el `leaderId`, la `faction` y el catálogo `cards.json`.
  - Retorna `{ valid: boolean, unitCount: number, specialCount: number, totalCards: number, heroCount: number, totalStrength: number, errors: DeckValidationError[] }`.
- **Mazos prearmados offline**:
  - `src/assets/data/starter-decks.json` con mazos listos para jugar desde el primer arranque (mazo de prueba en F2–F4, mazos de las 4 facciones en F5).
- **Persistencia offline (`DeckStorageService`)**:
  - Guarda y recupera mazos personalizados por facción en `localStorage` bajo claves versionadas (`qwent.decks.v1`), con fallback seguro ante datos corruptos.
- **Interfaz táctil landscape (`DeckBuilderPageComponent`)**:
  - Selector superior de Facción (`NORTHERN_REALMS`, `NILFGAARD`, `MONSTERS`, `SCOIATAEL`) y selector de carta **Líder** de esa facción.
  - Vista dividida en 2 columnas: **Colección disponible** (izquierda, filtrable por fila/tipo) y **Mazo actual** (derecha), con barra de estado mostrando contadores en vivo (`Unidades >= 22`, `Especiales <= 10`).

## Reglas de Negocio (Reglas Exactas de TW3)
- **Mínimo de unidades**: Un mazo válido debe contener al menos **22 cartas de Unidad** (`type === 'UNIT'`). Sin límite máximo estricto de unidades, aunque con indicador informativo del total.
- **Límite de especiales**: Un mazo puede contener como máximo **10 cartas Especiales** (`type === 'SPECIAL'`, incluyendo Climas, Señuelo, Scorch y Cuerno).
- **Restricción de facción**: Solo pueden incluirse cartas de la facción elegida para el mazo o cartas `NEUTRAL`.
- **Líder obligatorio**: Cada mazo debe tener exactamente **1 Líder** perteneciente a la facción del mazo.
- **Límite de copias**: No se pueden agregar más copias de una carta que el `maxCopies` definido en `cards.json` (ej. Héroes `1`, cartas únicas `1`, copias múltiples `2` o `3`). Las cartas con artes alternativos (ej. Comando de los Franjas Azules) usan un único `id` en el catálogo con `maxCopies: 3`.

## Archivos que Toca
- `src/core/deck/validate-deck.ts`
- `src/core/deck/__tests__/validate-deck.spec.ts`
- `src/assets/data/starter-decks.json`
- `src/app/services/deck-storage.service.ts`
- `src/app/features/deck-builder/deck-builder-page.component.*`

## Criterios de Aceptación
- [x] `validateDeck` hace cumplir: `>= 22` unidades, `<= 10` especiales, restricción de facción + neutrales, 1 líder válido y límite `maxCopies`, cubierto por tests unitarios.
- [x] El usuario puede cambiar entre las 4 facciones, elegir Líder y armar/editar mazos táctilmente.
- [x] Los mazos guardados persisten 100% offline en `localStorage` y pueden seleccionarse para iniciar partida contra la IA.
- [x] Mazos prearmados funcionales disponibles sin necesidad de armar uno desde cero.
