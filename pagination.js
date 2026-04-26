/*
 * Lógica pura de paginación.
 *
 * paginate(totalPages, currentPage) → array de items para renderizar.
 *   Cada item es un número de página o el sentinel 'ellipsis'.
 *
 * Reglas:
 *   - Si totalPages <= 1, devuelve [] (no hay paginación).
 *   - Siempre incluye página 1 y la última.
 *   - Caso especial cuando currentPage = 1 y caben AMBOS elipsis: en
 *     lugar de la ventana alrededor del current, se muestran las 3
 *     páginas del centro literal del total. Permite saltar a páginas
 *     lejanas desde el inicio sin pasar por el botón Siguiente.
 *     Para que ambos elipsis quepan se requiere al menos 2 páginas
 *     ocultas a cada lado del centro (P >= 9 con la fórmula actual).
 *   - En el resto de casos: ventana de 3 alrededor del current
 *     (current-1, current, current+1), deslizada cuando el current
 *     está en el borde para que sigan siendo 3 distintas.
 *   - Entre páginas mostradas que distan exactamente 2 (un hueco de 1
 *     página), se inserta esa página para evitar un '...' que ocupa lo
 *     mismo que el número.
 *   - Entre páginas que distan 3 o más, se inserta 'ellipsis'.
 */

export const ELLIPSIS = 'ellipsis';

export function paginate(totalPages, currentPage) {
    if (totalPages <= 1) return [];

    // Caso especial: en la primera página, si el centro literal del
    // total deja espacio para ambos elipsis, lo mostramos en lugar de
    // la ventana alrededor del current. Útil para navegar lejos rápido
    // desde el principio.
    if (currentPage === 1) {
        const mid = Math.floor((totalPages + 1) / 2);
        const m1 = mid - 1;
        const m3 = mid + 1;
        // Hidden pages a la izquierda de m1 = m1 - 2 (entre [1] y [m1]).
        // Hidden pages a la derecha de m3 = totalPages - m3 - 1.
        // Para mostrar elipsis necesitamos >= 2 hidden a cada lado.
        const leftHidden = m1 - 2;
        const rightHidden = totalPages - m3 - 1;
        if (leftHidden >= 2 && rightHidden >= 2) {
            return [1, ELLIPSIS, m1, mid, m3, ELLIPSIS, totalPages];
        }
    }

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
