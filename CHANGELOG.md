# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/)
y versionado según [SemVer](https://semver.org/lang/es/).

## [1.2.2] - 2026-06-15

### Fixed
- La búsqueda (Ctrl/Cmd+K) ahora también matchea por **etiquetas**, no solo
  por el texto de la tarea y sus subtareas.

## [1.2.1] - 2026-06-15

### Changed
- El chip del atajo de búsqueda muestra **⌘ K** en macOS/iOS y **Ctrl K** en el
  resto (detección por `navigator.userAgentData.platform` / `navigator.platform`).
  El atajo ya respondía a Cmd y Ctrl. Probado en Mac.

## [1.2.0] - 2026-06-15

### Added
- **Búsqueda en el topbar** (desktop): el buscador se reubica al topbar (siempre
  visible) reutilizando el mismo input; en mobile vuelve al contenido. Atajo
  **Ctrl/Cmd+K** para enfocarlo.
- **Menú ⚙ Ajustes** en el topbar: **Exportar** datos (.json), **Importar**
  (con confirmación y undo) y **Borrar todos los datos** (tareas + etiquetas +
  preferencias). Tema y densidad también viven ahora aquí.
- Badge **"Local"** en el dock (indica almacenamiento local; reemplaza un
  "en línea" que no aplica sin backend).

### Changed
- **Tema y densidad** se movieron del pie del sidebar al modal de Ajustes.
- Se quitó del topbar el contador "N pendientes · N hechas" (ya estaba en el
  page-head y el sidebar).

## [1.1.1] - 2026-06-15

### Added
- **Indicador de versión** en ejecución, arriba a la izquierda (brand del
  sidebar); se hidrata desde `package.json`.

### Changed
- El checkbox de selección múltiple pasa de flotar en el margen a ser una
  **columna real** de cada tarea padre (siempre visible, integrada al cuerpo);
  el contenido se corre a la derecha y el árbol de subtareas se reajusta para
  seguir alineado bajo el chevron del padre.
- El check "seleccionar todo" se alinea en esa misma columna.

## [1.1.0] - 2026-06-15

### Added
- **Versión web/escritorio (app-shell ≥1024px):** sidebar + topbar + page-head +
  área de contenido, fiel al diseño `desktop.html`. Mobile (≤480) y tablet
  (481–1023) quedan intactos (todo lo nuevo vive en `@media (min-width:1024px)`).
- **Sidebar de 3 secciones:** Vistas (Todas/Hoy/Esta semana/Este mes/Prioritarias),
  Estado (Pendientes/Hechas) y Etiquetas (dinámica, con color y contador).
- **Etiquetas:** modelo `tags[]` en tareas top-level; asignación desde "Nueva
  tarea" y un modal por tarea; chips de color; filtro por etiqueta; **selector
  de color** con paleta fija de 10 colores (persistido por etiqueta).
- **Vistas por fecha:** Hoy / Esta semana / **Este mes** consideran la fecha de
  creación además de la fecha límite.
- **Deshacer** de un nivel para las mutaciones principales (botón en el page-head
  y acción "Deshacer" en los toasts).
- **Page-head dinámico:** titular contextual (saludo + pendientes / "N para hoy" /
  "N vencidas" / "¡Todo al día!" / "Lista vacía") y stats clicables que filtran.
- **Selección múltiple (desktop):** checkbox por fila, **"seleccionar todo"** la
  página actual, y **eliminado masivo** con confirmación y undo.
- **Paginación** estilo `desktop.html` (`.page-btn`, prev/next solo icono y
  deshabilitados en los extremos) + footer-bar "Mostrando X–Y de N".
- Toggles de tema claro/oscuro y densidad cómoda/compacta sincronizados.

### Changed
- **Toasts** rediseñados: icono por tipo + título + detalle (recortado a 2
  líneas) + acción "Deshacer"; a todo el ancho al pie en mobile.
- Focus automático al input principal tras agregar, y al input de subtarea al
  abrir su formulario.
- README actualizado; se retiró Bootstrap/Font Awesome de la documentación
  (ya no se usan).

### Fixed
- Árbol de subtareas correctamente anidado en desktop y recálculo de los
  conectores al expandir (antes se desajustaban si el último render ocurría con
  el padre colapsado).
- Las tareas hechas ya no usan el fondo azul legacy en el shell (tachado + texto
  atenuado, según el design).

## [1.0.0] - 2026-04

### Added
- App base de tareas en HTML/CSS/JS vanilla con `localStorage`: CRUD, subtareas
  (1 nivel), filtros, orden configurable, paginación, búsqueda, tiempo
  transcurrido, modal de confirmación y refactor responsive mobile-first.
- Integración del sistema de diseño (tokens + componentes, tema claro/oscuro).

[1.2.2]: https://github.com/yefersoncm/todo-list/releases/tag/v1.2.2
[1.2.1]: https://github.com/yefersoncm/todo-list/releases/tag/v1.2.1
[1.2.0]: https://github.com/yefersoncm/todo-list/releases/tag/v1.2.0
[1.1.1]: https://github.com/yefersoncm/todo-list/releases/tag/v1.1.1
[1.1.0]: https://github.com/yefersoncm/todo-list/releases/tag/v1.1.0
[1.0.0]: https://github.com/yefersoncm/todo-list/releases/tag/v1.0.0
