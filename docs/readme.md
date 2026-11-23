# Qwent — Gwent Clásico de The Witcher 3 (Android Offline)

## Resumen Ejecutivo
- **Qué es**: Aplicación móvil Android (`.apk`) 100% offline que replica fielmente el minijuego de cartas **Gwent** original de *The Witcher 3: Wild Hunt*. Mantiene las reglas clásicas: tablero de 3 filas por jugador, mano única de 10 cartas para toda la partida (al mejor de 3 rondas con 2 gemas), sin costos de provisión ni daño directo/armadura entre unidades.
- **Para quién**: Jugadores que desean disfrutar del Gwent táctico original en un dispositivo Android con pantalla horizontal táctil, sin conexión a internet, ni microtransacciones ni dependencias externas.
- **Propósito**: Garantizar fidelidad matemática a todas las reglas y casos borde del minijuego original mediante un motor puro en TypeScript cubierto por pruebas unitarias en Vitest, acoplado a una interfaz ágil en Angular + Tailwind CSS y empaquetada nativamente con Capacitor.

## Estructura General de Carpetas

```text
Qwent/
├── AGENTS.md                        # Reglas persistentes, arquitectura y protocolo de trabajo
├── docs/
│   ├── readme.md                    # Resumen ejecutivo y mapa del proyecto
│   ├── plan.md                      # Tablero de fases incrementales (F1–F6) y registro de avance
│   └── design.md                    # Sistema visual medieval táctil, paleta, tipografía y componentes
├── .agent/
│   └── skills/                      # Documentación modular cargada bajo demanda por módulo
│       ├── android-packaging/SKILL.md
│       ├── core-engine/SKILL.md
│       ├── cards-and-abilities/SKILL.md
│       ├── ai-opponent/SKILL.md
│       ├── board-ui/SKILL.md
│       └── deck-builder/SKILL.md
├── src/
│   ├── core/                        # Motor 100% puro en TypeScript (cero imports UI/Capacitor)
│   │   ├── models/                  # Tipos de dominio, GameState, acciones y esquema de cartas
│   │   ├── scoring/                 # Recálculo dinámico desde baseStrength (clima -> vínculo -> moral -> cuerno)
│   │   ├── abilities/               # Resolución de habilidades, pasivas de facción y líderes
│   │   ├── engine/                  # Máquina de estados de partida, rondas, turnos y mulligan
│   │   ├── ai/                      # AIPlayerView (sin mano oculta) y heurísticas de decisión
│   │   └── deck/                    # Validación de mazos (mín. 22 unidades, máx. 10 especiales)
│   ├── app/                         # Interfaz móvil Angular (Standalone + Signals + Tailwind CSS)
│   │   ├── features/
│   │   │   ├── board/               # Tablero táctil landscape de 6 filas, climas, mano y selectores
│   │   │   └── deck-builder/        # Constructor de mazos, selección de facción/líder y colección
│   │   ├── shared/components/       # Componentes reutilizables de carta (CSS/SVG), modales e íconos
│   │   └── services/                # GameFacadeService (Signals) y repositorio localStorage offline
│   └── assets/
│       ├── data/                    # cards.json y starter-decks.json embebidos offline
│       └── cards/                   # Carpeta preparada para sprites locales futuros (<cardId>.webp)
├── scripts/
│   ├── etl-cards.ts                 # Script determinista de importación y validación de catálogo (F5)
│   └── build-apk.mjs                # Flujo reproducible: test -> build -> cap sync -> assembleDebug
└── android/                         # Proyecto nativo Android generado por Capacitor
```
