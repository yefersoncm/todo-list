# Todo List

App sencilla para gestionar tareas por hacer: agregar, editar, marcar como hechas y eliminar. Hecha con HTML, CSS y JavaScript vanilla, persiste en `localStorage`.

**Demo:** https://yefersoncm-todo-list.netlify.app

## Características

- Agregar tareas con un input de texto.
- Editar el texto de una tarea existente.
- Marcar / desmarcar como hecha (la fila queda destacada y el texto tachado).
- Eliminar una tarea (con confirmación) o limpiar la lista entera.
- Filtrar la vista por: Todas / Hechas / Pendientes.
- Indicador de antigüedad por tarea ("Hoy", "1 día", "N días") calculado a partir del timestamp de creación.
- Contador de tareas según el filtro activo.
- Persistencia en `localStorage` — al recargar, las tareas siguen ahí.
- Modal de confirmación custom (sin `confirm()` nativo) con soporte de teclado (`Esc` cancela, `Enter` confirma).

## Stack

- HTML5 + CSS3 (variables CSS, sin preprocesadores).
- JavaScript vanilla (clase `TaskManager`, sin frameworks ni build).
- [Bootstrap 5](https://getbootstrap.com/) y [Font Awesome 5](https://fontawesome.com/) por CDN para algunos componentes y los íconos.
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
├── index.html              # Estructura
├── styles.css              # Estilos custom + variables
├── app.js                  # Capa UI (clase TaskManager, DOM)
├── taskStore.js            # Lógica pura: TaskStore + adapters de storage
├── package.json
├── tests/
│   └── taskStore.test.js   # Suite con node --test
├── vendor/
│   └── fallback.css        # Fallback de Bootstrap si el CDN falla
├── logo.svg
└── *-svgrepo-*.svg         # Iconos auxiliares
```

## Roadmap / ideas

- [ ] Capturas de pantalla en este README.
- [ ] Sincronización opcional entre dispositivos.
