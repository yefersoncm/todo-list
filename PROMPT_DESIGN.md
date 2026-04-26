Eres un diseñador UX/UI senior. Necesito que me propongas un rediseño responsive
para una to-do list app vanilla (HTML/CSS/JS sin frameworks). El refactor mobile-
first ya está en marcha pero el diseño visual sigue siendo el original (azul
pastel, tipografía Roboto/Open Sans). Quiero un look más cuidado sin perder la
ergonomía que ya construimos.

## La app

- To-do list con jerarquía padre/subtarea (un nivel de anidación, no más).
- Persistencia local (localStorage). Sin backend.
- Single page, sección central tipo "card" con shadow.
- Feature set actual:
  - CRUD de tareas y subtareas (con input inline en cada padre para agregar
    subs).
  - Toggle done/undone con check circular.
  - Edición inline del título (lápiz o doble-click en desktop).
  - Eliminar (basurero).
  - Búsqueda por texto que filtra padres y matchea subs.
  - Sort: 11 modos (recientes, alfa, longitud, pendientes/hechas primero,
    modificadas, manual con drag-and-drop).
  - Filtros: todas / hechas / pendientes.
  - Paginación con tamaño configurable (10/20/50/100).
  - Colapsar/expandir grupos de subs (chevron por padre + botones globales).
  - Drag-and-drop multi-caso (sub→sub, sub→padre, sub→promote-zone).
  - Toast notifications con undo (top-right desktop, bottom mobile).
  - Modal de confirmación para acciones destructivas.
  - Indicador de tiempo transcurrido por tarea ("hace 2 días", etc.).
  - En cada item: contador (X/Y) de subs hechas/total.

## Stack y constraints

- HTML semántico + CSS puro + JS vanilla módulos (sin React, sin Tailwind, sin
  Bootstrap; eso último ya lo eliminamos).
- Iconos SVG inline (Lucide, ya implementados como módulo).
- Variables CSS ya en uso: paleta de azules `--clr-primary-1..10`, grises
  `--clr-grey-1..10`, rojos, verdes; `--radius`, `--light-shadow`,
  `--dark-shadow`, fuentes Roboto/Open Sans (Google Fonts).
- Soporte declarado: 320px → desktop sin límite (max-width 1170px en el
  wrapper).
- Breakpoints en uso: 480 (mobile small), 768 (tablet), 1024 (desktop).
- A11y: focus-visible, aria-labels, keyboard DnD para subtareas, ratios de
  contraste decentes.
- Touch: ya implementé `@media (pointer: coarse)` con touch targets ≥44px,
  botones ↑/↓/⬅ que reemplazan al drag, sticky-hover neutralizado en
  `(hover: none)`.

## Lo que quiero de ti

1. **Sistema visual coherente**: paleta refinada (puede ser nueva o partir de
   la actual), tipografía con escala clara (h1/h2/h3/body/small), espaciado
   en escala (4/8/12/16/24/32...), elevation con 2-3 niveles de sombra.
2. **Componentes documentados**: cómo se ve cada uno en hover/focus/active/
   disabled/loading. Botón primary, secondary, ghost, danger; input, select
   custom, toast (4 tipos), modal, item de lista en sus 3 estados (default,
   hover, dragging), chevron, avatar de tarea con check.
3. **Dos layouts completos**:
   - Desktop ≥1024: aprovecha el ancho. Header con título + búsqueda inline +
     contador. Cuerpo central con la lista. Sidebar opcional con filtros
     persistentes.
   - Mobile ≤480: header condensado, lista full-width, controles globales
     organizados en filas claras (ya tengo: contador, [colapsar][expandir],
     limpiar, sort, page-size). Item con título arriba en línea propia y
     acciones centradas debajo.
4. **Microinteracciones que valgan la pena**: una animación al marcar como
   done, transición del chevron, feedback visual del drag, entrada/salida
   del toast. Nada gratuito; cada anim debe tener motivo.
5. **Modo oscuro**: variantes de la paleta que no sea solo "invertir grises".
   Que sea legible y se sienta intencional.
6. **Densidad**: una opción cómoda (default) y una compacta (para usuarios
   con listas largas).

## Restricciones duras

- **No proponer frameworks**. CSS puro, variables CSS, max 1 archivo de
  estilos. JS vanilla.
- **No tocar la lógica existente**. Solo CSS + ajustes mínimos a la estructura
  HTML si son justificables (ej: agregar un wrapper para grid).
- **No reemplazar los iconos Lucide**, ya están integrados como SVG inline.
- **Mantener accesibilidad**: focus rings visibles, contraste AA mínimo,
  aria-labels.
- **Mobile no debe sentir 'desktop encogido'**. Debe sentirse nativo: big
  taps, comandos pulgar-friendly, sin hover-only.

## Formato de entrega esperado

1. **Tokens CSS** (`:root` con variables) — paleta light + dark, espaciado,
   tipografía, sombras, radios.
2. **Snippets de cada componente** — HTML mínimo + CSS, listos para integrar.
3. **Layout desktop completo** — un `index.html` o un fragment grande con
   la card central, header, lista de items con padre y subs, paginación,
   filtros.
4. **Layout mobile completo** — mismo nivel de detalle que desktop.
5. **Tabla de decisiones** — para cada componente, qué cambió respecto al
   estilo "default azul claro" original y por qué (qué problema soluciona).

Si necesitas ver código actual antes de proponer, dímelo y te paso
`styles.css`, `index.html` y `app.js`. Si arrancas con propuesta directa,
asume el estado actual descrito arriba.
