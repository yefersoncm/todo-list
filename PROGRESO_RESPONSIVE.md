# Progreso refactor responsive mobile-first

Rama: `feature/responsive-mobile-first` (desde main).
Plan acordado: 1 commit por fase, atómico y reversible.
Documento actualizado después de cada fase para proteger contra cortes de energía.

## Decisiones tomadas (sesión anterior, 2026-04-26)
- Bootstrap fuera (eliminado en fase 0).
- DnD opción B: en mobile botones ↑/↓ + promote para subs, drag intacto en desktop.
- Soporte desde 320px hasta sin límite.
- Sin PWA.
- Breakpoints: 480 / 768 / 1024.

## Estado por fase

| # | Fase | Estado | Commit | Notas |
|---|---|---|---|---|
| 0 | Sacar Bootstrap | DONE | `dabd71b` | Eliminados `<link>`, `<script>`, `vendor/fallback.css` y regla `.form-check-label` huérfana. |
| 1 | Layout fluido mobile-first | DONE | `7980462` | clamp/min en widths, breakpoint 800→768, márgenes/paddings fluidos, indentación subs proporcional, bloque `@media (max-width: 480px)` con ajustes de gap/padding. |
| 2 | Touch targets ≥44px | DONE | `d156c05` | Bloque `@media (pointer: coarse)` con min 2.75rem (44px) en chevron, edit/delete, toggle, paginación, combo-toggle, bulk, confirm, inputs. Iconos visuales sin cambios. |
| 3 | DnD opción B | DONE | `c6ba928` | Botones touch ↑/↓ (reorder en mismo scope) + ⬅ promote para subs. Reusan `moveToParent` y `store.move`. CSS oculta en pointer:fine, muestra en pointer:coarse. Promote-zone hide en touch. Disabled si sort != manual o no hay vecino. Tests 95/95 pasan. |
| 4 | Edición inline touch-friendly | DONE | `b84a539` | `dblclick` solo se registra en pointer:fine. En touch el lápiz queda como único trigger. Helper nuevo `_isPrimaryTouch()`. Tests 95/95 pasan. |
| 5 | Hover → tap-friendly | IN PROGRESS | — | Bloque `@media (hover: none)` revierte fondo/borde/color/shadow de los `:hover` problemáticos (sticky-hover en touch). Refuerzo `:active` con `transform: scale(0.96)` para feedback inmediato al tap. |
| 6 | QA cross-viewport | PENDING | — | 320, 375, 412, 768, 1024, 1440. |

## Cambios concretos por archivo (acumulados)

### `index.html`
- Borrados los 2 `<link>` de Bootstrap CSS + `vendor/fallback.css`.
- Borrados los 2 `<script>` de Popper y Bootstrap JS.

### `styles.css`
- Borrada regla `.form-check-label` (Bootstrap-only).
- Breakpoint 800→768 para tipografía global.
- `.section-center`: `margin` y `padding` con `clamp()`; eliminadas las dos media queries duplicadas que setteaban width:90vw / max-width:100%.
- `.app-toast min-width: 16rem` → `min(16rem, 100%)`.
- `.submit-btn width: 7.5rem` → `clamp(5.5rem, 24vw, 7.5rem)`.
- `.combo-sort .combo-toggle min-width: 13rem` → `clamp(8rem, 40vw, 13rem)`.
- `.grocery-item.is-subtask margin-left: 3.5rem` → `clamp(1.25rem, 6vw, 3.5rem)`. `padding-left` con `clamp` también.
- `.subtask-add-input width: 9rem` → `clamp(7rem, 28vw, 9rem)`.
- `#grocery flex: 1 0 auto` → `flex: 1 1 auto + min-width: 0` (permite encogerse en mobile sin overflow).
- Bloque nuevo `@media (max-width: 480px)`: reduce padding/gap en `.section`, `.grocery-item`, `.task-count-row`, `.task-count-controls`, `.pagination`, `.grocery-item .meta`.

### Borrados
- `vendor/fallback.css` (carpeta `vendor/` ya no existe).

### Fase 2 — touch targets (sumado encima de fase 1)
Bloque nuevo `@media (pointer: coarse)` al final de styles.css:
- `.subtask-collapse-btn`, `.subtask-collapse-placeholder`, `.edit-btn`, `.delete-btn`, `.toggle-btn` → 2.75x2.75rem (44px).
- `.page-num`, `.page-prev`, `.page-next` → min-width/height 2.75rem.
- `.combo-toggle` → padding 0.65rem 0.75rem (alcanza ~44px height).
- `.bulk-btn` → padding 0.55rem 0.85rem.
- `.confirm-btn` → padding 0.65rem 1.15rem.
- `.submit-btn`, inputs (`.search-input`, `.subtask-add-input`, `#grocery`) → min-height 2.75rem.
- `.grocery-item .action-group` → gap 0.5rem (evita mis-taps).

Desktop (mouse) sin cambios — los hit areas pequeños se mantienen.

### Fase 3 — DnD opción B (sumado encima de fase 2)
- `icons.js`: agregado `chevron-up`.
- `app.js`: nuevo método `_buildTouchMoveControls(task, isSubtask)` y handlers
  `_touchMove(id, direction, isSubtask)` y `_touchPromote(id)`. Los 2-3 botones
  se appendan al inicio del `.action-group` antes de `editBtn`/`deleteBtn`.
  Reusan `store.moveToParent` y `store.move` — misma lógica que los keybindings
  Alt+↑/↓.
- `styles.css`:
  - Estilos base de `.touch-move-btn` con `display: none` (desktop).
  - En `@media (pointer: coarse)`: `display: inline-flex`, 2.75rem (44px),
    `cursor: default` en `.is-draggable`, `.promote-zone { display: none !important }`.
- Estados disabled: si sort != manual o no hay vecino arriba/abajo.
- Promote (⬅) está siempre activo en subs (el nuevo orden de top-levels lo
  determina el sort actual, no se necesita modo manual).

### Fase 4 — Edición inline touch-friendly
- `app.js`: nuevo helper `_isPrimaryTouch()` que delega en `matchMedia('(pointer: coarse)')`.
- En `_renderItem`, el `addEventListener('dblclick', ...)` sobre el título
  solo se registra cuando NO es primary touch. En touch, el lápiz es el único
  trigger de edición.

### Fase 5 — Hover → tap-friendly
- `styles.css`: bloque nuevo `@media (hover: none)` al final.
  - Neutraliza los `:hover` problemáticos (sticky en touch) usando `revert`
    en `background`, `border-color`, `color`, `box-shadow`.
  - Selectores cubiertos: `.btn`, `.grocery-item` (+title), `.section-center`,
    `.search-input`, `.subtask-add-input`, `.combo-toggle`,
    `.subtask-collapse-btn`, `.bulk-btn`, `.bulk-btn-danger`, `.submit-btn`,
    paginación, `.toggle-btn`, `.edit-btn`, `.delete-btn`, `.touch-move-btn`,
    `.confirm-btn-cancel`, `.confirm-btn-ok`, `.app-toast-close`, `.done`.
  - `:active` con `transform: scale(0.96)` en los botones principales para
    feedback inmediato al tap.

## Cómo hacer rollback

```
git log --oneline feature/responsive-mobile-first
git checkout <hash-fase-N>      # ver una fase específica
git revert <hash-fase-N>        # deshacer una fase manteniendo siguientes
git reset --hard <hash-fase-N>  # destructivo, sólo si nada más depende
```
