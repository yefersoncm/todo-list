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
| 1 | Layout fluido mobile-first | IN PROGRESS | — | clamp/min en widths, breakpoint 800→768, márgenes/paddings fluidos, indentación subs proporcional, bloque `@media (max-width: 480px)` con ajustes de gap/padding. |
| 2 | Touch targets ≥44px | PENDING | — | |
| 3 | DnD opción B | PENDING | — | |
| 4 | Edición inline touch-friendly | PENDING | — | |
| 5 | Hover → tap-friendly | PENDING | — | |
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

## Cómo hacer rollback

```
git log --oneline feature/responsive-mobile-first
git checkout <hash-fase-N>      # ver una fase específica
git revert <hash-fase-N>        # deshacer una fase manteniendo siguientes
git reset --hard <hash-fase-N>  # destructivo, sólo si nada más depende
```
