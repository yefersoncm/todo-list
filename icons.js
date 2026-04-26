/*
 * Iconos SVG inline (Lucide — ISC license, gratuito sin atribución).
 * Reemplazo de Font Awesome para evitar dependencia externa, race
 * conditions con document.fonts y duplicados de render.
 *
 * Todos los iconos comparten grid 24x24, stroke 2, line-cap/join round.
 * El color se hereda por currentColor — basta con setear `color` en el
 * botón contenedor.
 */

const PATHS = {
    pencil: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    circle: '<circle cx="12" cy="12" r="10"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createIcon(name, { size = 18, className = 'icon' } = {}) {
    const paths = PATHS[name];
    if (!paths) throw new Error(`Icon "${name}" no definido en icons.js`);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add(className);
    // PATHS contiene markup estático controlado por la app — no hay XSS.
    svg.innerHTML = paths;
    return svg;
}
