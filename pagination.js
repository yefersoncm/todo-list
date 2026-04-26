/*
 * Lógica pura de paginación.
 *
 * paginate(totalPages, currentPage) → array de items para renderizar.
 *   Cada item es un número de página o el sentinel 'ellipsis'.
 *
 * Reglas:
 *   - Si totalPages <= 1, devuelve [] (no hay paginación).
 *   - Siempre incluye página 1 y la última.
 *   - Ventana de 3 alrededor del current (current-1, current, current+1),
 *     deslizada cuando el current está en el borde para que sigan siendo 3.
 *   - Entre páginas mostradas que distan exactamente 2 (un hueco de 1
 *     página), se inserta esa página para evitar un '...' que ocupa lo
 *     mismo que el número.
 *   - Entre páginas que distan 3 o más, se inserta 'ellipsis'.
 */

export const ELLIPSIS = 'ellipsis';

export function paginate(totalPages, currentPage) {
    if (totalPages <= 1) return [];

    // Ventana de 3 alrededor del current (deslizada en los bordes).
    let windowStart = Math.max(1, currentPage - 1);
    let windowEnd = Math.min(totalPages, currentPage + 1);
    if (windowEnd - windowStart < 2) {
        if (windowStart === 1) windowEnd = Math.min(totalPages, 3);
        else if (windowEnd === totalPages) windowStart = Math.max(1, totalPages - 2);
    }

    // Conjunto de páginas a mostrar (siempre 1, totalPages y la ventana).
    const pages = new Set([1, totalPages]);
    for (let i = windowStart; i <= windowEnd; i++) pages.add(i);

    const sorted = [...pages].sort((a, b) => a - b);

    const result = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = sorted[i] - sorted[i - 1];
            if (gap === 2) result.push(sorted[i] - 1); // rellena hueco de 1
            else if (gap > 2) result.push(ELLIPSIS);
        }
        result.push(sorted[i]);
    }
    return result;
}
