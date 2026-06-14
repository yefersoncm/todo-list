# Todo List

App para gestionar tareas por hacer: agregar, editar, marcar como hechas y eliminar, con subtareas, etiquetas, fechas y prioridad. Hecha con HTML, CSS y JavaScript vanilla (sin frameworks ni build), responsive de 320px a desktop, con sistema de diseño propio (tema claro/oscuro), y persistencia en `localStorage`.

**Demo:** https://yefersoncm-todo-list.netlify.app

## Características

- Agregar tareas con un input de texto.
- Editar el texto de una tarea existente.
- Marcar / desmarcar como hecha (la fila queda destacada y el texto tachado).
- Eliminar una tarea (con confirmación) o limpiar la lista entera.
- Filtrar la vista por: Todas / Pendientes / Hechas, más **Hoy**, **Esta semana**, **Este mes** y **Prioritarias**. Hoy / Esta semana / Este mes consideran tanto la **fecha de creación** como la **fecha límite** (así son útiles aunque la tarea no tenga fecha asignada).
- **Fechas límite y prioridad**: cada tarea principal puede llevar fecha (con date picker custom que respeta dark/light) y marcarse como prioritaria (estrella). Las tareas con fecha de hoy o vencidas se resaltan.
- **Etiquetas**: etiquetas libres por tarea principal, cada una con un **color elegido de una paleta fija de 10 colores** (persistido). Se asignan al crear la tarea o desde un modal por tarea, se muestran como chips de color, y permiten filtrar desde el panel lateral.
- **Subtareas** (1 nivel de profundidad): cada tarea puede tener subtareas que se agregan desde un input inline en la fila del padre. El padre muestra un contador `(X/Y)` con el progreso. Marcar el padre propaga a sus subs (y viceversa), agregar una sub a un padre hecho lo re-abre, borrar el padre borra todas las subs en cascada con confirmación. Filtros, sort y paginación operan sobre padres; las subs van pegadas a su padre. Cada padre con subs puede **colapsarse / expandirse** con un chevron (animación CSS slide), persistido en `localStorage`. Atajo de teclado: `←` colapsa, `→` expande sobre el chevron enfocado. Botones globales `Colapsar todo / Expandir todo` en la cabecera de la lista. **Drag-and-drop entre niveles** (sólo en sort manual + filtro Todas): arrastrar una sub sobre otro padre la re-parenta; arrastrar una sub a la zona "Soltar aquí para convertir en tarea principal" (que aparece arriba de la lista durante el drag) la promueve a top-level.
- Ordenamiento configurable (persistido en `localStorage`) por: tiempo de creación, alfabético, longitud del texto, estado, última modificación, o **manual**. En modo manual se puede reordenar arrastrando o con `Alt+↑` / `Alt+↓` cuando el item está enfocado.
- Paginación con tamaño configurable (10 / 20 / 50 / 100, persistido en `localStorage`). Navegación Anterior / Siguiente más números alrededor del actual; los huecos de 1 página se rellenan, los mayores muestran `…`.
- Indicador de tiempo transcurrido por tarea con desglose completo ("1 Año, 3 Meses, 4 Días, 5 Horas, 30 Minutos y 55 Segundos"), refrescado cada segundo. La columna alinea su ancho al de la tarea más antigua.
- Contador de tareas según el filtro activo.
- Persistencia en `localStorage` — al recargar, las tareas siguen ahí.
- Modal de confirmación custom (sin `confirm()` nativo) con soporte de teclado (`Esc` cancela, `Enter` confirma).
- Notificaciones tipo toast (success / danger / warning) con **icono por tipo, título y línea de detalle** (el detalle se recorta a 2 líneas). Las acciones reversibles incluyen un botón **Deshacer**. Auto-dismiss a 5 s o cierre con la X; máximo 5 visibles — al exceder, la más antigua se cierra. Arriba a la derecha en desktop, abajo a todo el ancho en mobile.
- **Deshacer** de un nivel: revierte la última acción (agregar, editar, marcar, eliminar, limpiar, prioridad, fecha, subtarea, etiqueta o reordenar) restaurando el estado anterior.

## Diseño y layout

Sistema de diseño propio con tokens CSS (`tokens.css`): paleta OKLCH, tipografías
Inter Tight + JetBrains Mono, escala de espaciado, sombras y radios. Incluye
**tema claro/oscuro** y **densidad cómoda/compacta**, ambos persistidos. El layout
es responsive con tres modos:

- **Mobile (≤480px):** header condensado, pills de filtro, FAB para nueva tarea,
  bottom-nav y drawer de ajustes. Toques ≥44px y botones ↑/↓ que reemplazan al drag.
- **Tablet (481–1023px):** layout centrado tipo "card".
- **Desktop / web (≥1024px):** app-shell con **sidebar** colapsable de 3 secciones
  (Vistas: Todas/Hoy/Esta semana/Este mes/Prioritarias · Estado: Pendientes/Hechas ·
  Etiquetas con contadores), **topbar**, **page-head** con saludo, stats y los
  controles **Ordenar** + **Deshacer**, y una barra de herramientas con filtros,
  colapsar/expandir, limpiar y paginación. Las subtareas se muestran con un árbol
  conector indentado bajo su padre.

## Stack

- HTML5 + CSS3 (variables CSS, sin preprocesadores ni build).
- JavaScript vanilla (clase `TaskManager`, módulos ES, sin frameworks).
- Iconos [Lucide](https://lucide.dev/) inline como SVG (`icons.js`), sin dependencias externas.
- Fuentes [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) por Google Fonts.
- API web `localStorage` para la persistencia.

## Cómo correrlo localmente

No requiere build. Cualquier servidor estático sirve:

```bash
python3 -m http.server 8000
# o
npx serve .
# o
npm run serve
```

Luego abre `http://localhost:8000` en el navegador.

> Importante: ahora `app.js` se carga como módulo ES (`<script type="module">`), por lo que **no funciona abriendo `index.html` con `file://`** — los módulos requieren un servidor.

## Tests

La lógica de tareas está separada del DOM en `taskStore.js` y se prueba con el runner nativo de Node.

```bash
npm test
# o
node --test tests/*.test.js
```

## Estructura

```
todo-list/
├── index.html              # Estructura (app-shell desktop + chrome mobile)
├── tokens.css              # Design tokens: paleta, tipografía, espaciado, dark, densidad
├── components.css          # Componentes (botones, inputs, items, toast, modal…)
├── styles.css              # Layout + overrides (incluye el shell desktop ≥1024px)
├── app.js                  # Capa UI (clase TaskManager, DOM, eventos)
├── taskStore.js            # Lógica pura: TaskStore + adapters de storage
├── elapsed.js              # Cálculo y formato de tiempo transcurrido
├── pagination.js           # Lógica de paginación (paginate(P, C))
├── toast.js                # Sistema de notificaciones flotantes
├── icons.js                # Iconos SVG inline (Lucide)
├── combobox.js             # Combobox accesible (reemplazo del <select>)
├── package.json
├── tests/
│   ├── taskStore.test.js   # Suite con node --test
│   ├── elapsed.test.js
│   └── pagination.test.js
├── logo.svg
└── *-svgrepo-*.svg         # Iconos auxiliares
```

## Roadmap / ideas

- [ ] Capturas de pantalla en este README.
- [ ] Sincronización opcional entre dispositivos.
