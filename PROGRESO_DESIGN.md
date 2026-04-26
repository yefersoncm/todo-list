# Progreso integración rediseño Claude Design

Rama: `feature/design-refresh` (desde `feature/responsive-mobile-first`).
Plan: 8 sub-fases (7A → 7H), 1 commit por sub-fase, atómicas y reversibles.
Documento actualizado tras cada sub-fase para sobrevivir cortes de energía.

## Origen
Archivos del diseño Claude generados externamente, copia local en
`/home/yefersoncm/Escritorio/ToDo/`. Importados al repo:
- `tokens.css` — variables CSS (paleta OKLCH, tipografía, espaciado, dark, density).
- `components.css` — botones, inputs, items, toast, modal, etc. (BEM-ish).
- (Referencia, no integrados): `desktop.html`, `mobile.html`, `styleguide.html`,
  `index.html` del demo, `icons.js`, `shell.js` del design.

## Decisiones tomadas
- **Sí**: tokens, .btn variants, .field, .toggle-check, .task rename, toast/modal,
  filter tabs, mobile card-per-item, density + dark mode.
- **No (al menos por ahora)**: sidebar desktop con nav (requeriría feature de
  categorías que no tenemos), `data-icon` hydration de iconos (mantenemos
  nuestro `createIcon()`).
- **Pendiente decidir**: page-head con saludo/stats, kbd shortcuts ⌘K.

## Estado por sub-fase

| # | Sub-fase | Estado | Commit | Notas |
|---|---|---|---|---|
| 7A | Tokens + reset + tipografías nuevas | DONE | `f09eff8` | tokens.css y components.css copiados al repo. index.html carga Google Fonts (Inter Tight + JetBrains Mono) y los CSS en orden tokens → components → styles. |
| 7B | `.btn` y `.field` aplicados | IN PROGRESS | — | HTML: `.submit-btn` con `.btn .btn--primary`; `#grocery`, `.search-input`, `.subtask-add-input` con `.field`; `.bulk-btn`/`.bulk-btn-danger` con `.btn .btn--ghost/--danger .btn--sm`; `.confirm-btn-cancel/-ok` con `.btn--secondary/--danger-filled`. styles.css: eliminadas reglas legacy duplicadas (153 líneas borradas). |
| 7C | `.toggle-check` con check-pop | PENDING | — | |
| 7D | Rename `.grocery-item` → `.task` + grid | PENDING | — | Toca `_renderItem` en app.js |
| 7E | Toast + modal nuevo look | PENDING | — | |
| 7F | Filter tabs en lugar de combo | PENDING | — | |
| 7G | Mobile card-per-item | PENDING | — | |
| 7H | Density + dark mode toggle | PENDING | — | |

## Mapeo de clases (referencia para 7D y siguientes)

```
.grocery-item            → .task
.grocery-item.is-subtask → .task.is-sub
.grocery-item.done       → .task.is-done
.title                   → .task__title
.subtask-counter         → .task__counter
.subtask-collapse-btn    → .task__chevron
.toggle-btn              → .toggle-check
.action-group            → .task__actions
.task-days-old           → .task__elapsed
.edit-btn / .delete-btn  → .btn-icon (+ .btn-icon--danger)
.app-toast               → .toast
.confirm-modal-dialog    → .modal
.search-input / #grocery → .field
.bulk-btn                → .btn .btn--ghost / .btn--secondary
.bulk-btn-danger         → .btn .btn--danger
.submit-btn              → .btn .btn--primary
.touch-move-btn          → .btn-icon
```

## Cómo hacer rollback

```
git log --oneline feature/design-refresh
git revert <hash-fase-7X>     # deshacer una sub-fase
git reset --hard <hash-7X-1>  # destructivo, volver al estado anterior
```

La rama base `feature/responsive-mobile-first` queda intacta — si abandonamos
el design refresh, basta con descartar esta rama.
