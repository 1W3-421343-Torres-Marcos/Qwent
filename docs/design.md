# Sistema de Diseño Visual — Qwent

## 1. Concepto Estético
Estética de **taberna medieval de alto contraste** inspirada en *The Witcher 3: Wild Hunt*, optimizada para celulares en orientación horizontal (`landscape`, relaciones `16:9` a `20:9`). Prioridad absoluta a la legibilidad instantánea de valores numéricos (fuerza de unidad, totales de fila, puntaje global, gemas y contadores) evitando ruido visual.

## 2. Paleta de Colores

| Rol | Token | Hex | Uso |
| :--- | :--- | :--- | :--- |
| Fondo principal | `bg-tavern-dark` | `#1A1410` | Marco exterior y fondo de pantalla |
| Superficie tablero | `bg-board-wood` | `#2A211B` | Fondo de filas de combate y paneles |
| Superficie fila | `bg-row-leather` | `#362920` | Contenedor individual de cada fila |
| Pergamino / Texto claro | `text-parchment` | `#E6D5B8` | Títulos, descripciones y pergaminos |
| Borde bronce | `border-bronze` | `#6E5536` | Separadores, bordes de paneles y botones |
| Oro Héroe / Destacado | `accent-gold` | `#D97706` / `#FDE047` | Marco radiante de Héroes y turno activo |
| Fuerza Normal | `strength-normal` | `#FFFFFF` | Valor sin modificar |
| Fuerza Bonificada | `strength-buff` | `#4ADE80` | Fuerza aumentada por Vínculo, Moral o Cuerno |
| Fuerza Penalizada | `strength-nerf` | `#F87171` | Fuerza reducida por Clima activo |
| Gema activa / perdida | `gem-ruby` / `gem-ash` | `#DC2626` / `#44403C` | Vidas de ronda (2 gemas por jugador) |

### Colores de Facción y Clima
- **Reinos del Norte (`NORTHERN_REALMS`)**: Azul real `#1D4ED8` / borde `#60A5FA`
- **Nilfgaard (`NILFGAARD`)**: Negro imperial `#18181B` / acento sol dorado `#EAB308`
- **Monstruos (`MONSTERS`)**: Rojo carmesí `#991B1B` / borde `#F87171`
- **Scoia'tael (`SCOIATAEL`)**: Verde bosque `#15803D` / borde `#4ADE80`
- **Neutral (`NEUTRAL`)**: Gris piedra `#57534E` / borde `#A8A29E`
- **Climas**: Escarcha `#38BDF8` (azul hielo), Niebla `#94A3B8` (gris plata), Lluvia `#60A5FA` (azul tormenta).
- **Efecto especial**: Scorch `#EA580C` (naranja fuego).

## 3. Tipografía y Legibilidad
- **Números y Encabezados**: Fuente serif/display de peso alto (`700–800`, `tabular-nums`) con `text-shadow` oscura (`0 1px 2px #000`) para contraste garantizado sobre cualquier fondo.
- **Cuerpo e Inspector**: Fuente sans-serif limpia (`400–600`) para nombres de cartas y textos de habilidad.
- **Escala responsive (`vh`/`clamp`)** para pantallas de 5.5" a 6.8":
  - Total global de jugador: `clamp(1.25rem, 4.2vh, 2rem)` (negrita).
  - Total por fila: `clamp(0.95rem, 3.2vh, 1.4rem)`.
  - Insignia de fuerza en carta en mesa: `clamp(0.75rem, 2.5vh, 1.05rem)`.
  - Nombre/descripción en Inspector: `0.875rem` a `1rem`.

## 4. Fidelidad al Tablero de TW3, Layout y Ergonomía Táctil (Landscape)
El tablero ocupa `100vw x 100dvh` sin scroll de página ni pestañas, respetando `safe-area-inset` para cámaras/notches. **Regla obligatoria**: las 6 filas, la zona de clima, ambos líderes, gemas, puntajes, contador de mano rival, mazos/descartes y la mano propia deben permanecer visibles simultáneamente en pantalla.

- **Zona Izquierda (`18%` ancho)**: Perfil/Líder + Gemas + Puntaje global + **Contador de cartas en mano** (rival arriba, jugador abajo) y **Caja de Climas compartida** (slots Escarcha, Niebla, Lluvia) en el centro exacto entre ambos.
- **Zona Centro (`68%` ancho)**:
  - **6 Filas simétricas** divididas por una línea horizontal central (`gap: 3px–4px`): `Asedio / Distancia / Cuerpo a cuerpo` del rival arriba; `Cuerpo a cuerpo / Distancia / Asedio` propias abajo.
  - **Orden interno exacto por fila** (de izquierda a derecha): `[Badge de total de fila]` -> `[Ranura cuadrada de Cuerno del Comandante]` -> `[Carril horizontal de cartas con ícono de fila de fondo como marca de agua]`.
  - **Bandeja de Mano**: ubicada directamente debajo de tu fila de Asedio (`~19vh` de altura), con solapamiento ligero si hay >8 cartas y elevación al tocar.
- **Zona Derecha (`14%` ancho)**: Pilas visuales de **Descarte** y **Mazo** (rival arriba, jugador abajo; descarte tocable para inspeccionar), área de vista ampliada al inspeccionar carta y botón **Pasar Ronda** en el tercio inferior derecho (adaptación táctil ergonómica para el pulgar).
- **Reglas táctiles**:
  - Área mínima interactiva: `44x44px` en todos los botones, ranuras y objetivos seleccionables.
  - **Seguridad al pasar**: El botón "Pasar Ronda" requiere **mantener pulsado (`600ms`)** con barra de progreso circular/lineal para evitar pases accidentales en móvil.
  - **Flujo de jugada**: 1 toque selecciona la carta y muestra su detalle en el área de vista ampliada; un segundo toque (o tocar la fila resaltada) confirma la jugada.

## 5. Componentes Reutilizables (CSS / SVG)
- **`<app-card-token>`** (ficha compacta en fila, ~45px de alto):
  - Relación `~3:4` adaptativa (`height: 100%` de la fila).
  - Esquina superior izquierda: insignia circular con la fuerza efectiva (coloreada según normal/buff/nerf) y fondo oscuro en Héroes con anillo dorado.
  - Esquina inferior: solo 1 ícono chico de habilidad si posee (sin ícono de fila para preservar legibilidad; el ícono de fila se muestra únicamente en la mano y en `<app-card-detail>`).
  - Marco estándar bronce/facción vs. marco doble dorado brillante para cartas **Héroe**.
- **`<app-card-detail>`** (mano ampliada, inspector, mulligan y deck builder):
  - Muestra nombre, facción, fuerza base, íconos de filas permitidas, habilidad explicada en español y contenedor gráfico preparado para sprites locales.
- **Iconografía SVG inline 100% offline**:
  - Filas: Espada (`CLOSE_COMBAT`), Arco (`RANGED`), Catapulta (`SIEGE`), Doble flecha (`Ágil`).
  - Habilidades: Apretón de manos (`TIGHT_BOND`), símbolo `+` (`MORALE_BOOST`), Ojo (`SPY`), Cruz/Poción (`MEDIC`), Manada (`MUSTER`), Llama (`SCORCH`/`SCORCH_ROW`), Máscara (`DECOY`), Cuerno (`COMMANDERS_HORN`), Copo/Nube/Gota/Sol (`WEATHER_*`).

## 6. Reglas de Recursos y Marca
- **Cero URLs externas**: Ninguna fuente remota ni imagen por HTTP/HTTPS. Todas las fuentes del sistema o empaquetadas localmente y todos los íconos en SVG inline.
- **Desacoplamiento de sprites**: Las cartas deben verse completas, legibles y estéticas usando únicamente CSS + SVG. El componente de carta acepta opcionalmente una ruta local `assets/cards/<cardId>.webp` con fallback transparente al emblema SVG de facción cuando el arte no exista.
