/*
 * ToastManager — notificaciones flotantes en la esquina superior derecha.
 *
 * Reglas:
 *  - Auto-dismiss a los 5s o al click en la X (lo que ocurra primero).
 *  - Máximo 5 toasts visibles. Al exceder, sólo la MÁS ANTIGUA se cierra.
 *  - El más nuevo entra arriba (slide desde la derecha + fade); los
 *    demás se mantienen visibles debajo.
 *  - El tipo determina la paleta: 'success', 'danger' o 'warning'.
 */

import { createIcon } from './icons.js';

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 5000;

export class ToastManager {
    constructor(container) {
        this.container = container;
        this.toasts = []; // [{ id, element, timer }] — orden por edad asc.
        this._idCounter = 0;
    }

    show(text, type = 'success') {
        // Si ya hay 5 visibles, cerrar la más antigua primero.
        while (this.toasts.length >= MAX_TOASTS) {
            this._dismiss(this.toasts[0].id);
        }

        const id = ++this._idCounter;
        const element = this._buildToast(id, text, type);

        // Inserta arriba (más nueva primero en el DOM).
        this.container.insertBefore(element, this.container.firstChild);

        // Forzamos un reflow para que la transición de entrada corra al
        // pasar de estado inicial (off-screen) → 'is-visible'.
        // eslint-disable-next-line no-unused-expressions
        element.offsetHeight;
        element.classList.add('is-visible');

        const timer = setTimeout(() => this._dismiss(id), AUTO_DISMISS_MS);
        this.toasts.push({ id, element, timer });
    }

    _buildToast(id, text, type) {
        const el = document.createElement('div');
        // Prefijo 'app-toast' para evitar colisión con la clase .toast de
        // Bootstrap (cargado por CDN) que aplicaría opacity:0 con mayor
        // especificidad que nuestra .is-visible.
        el.className = `app-toast app-toast-${type}`;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.dataset.toastId = String(id);

        const message = document.createElement('p');
        message.className = 'app-toast-message';
        message.textContent = text;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-toast-close';
        closeBtn.setAttribute('aria-label', 'Cerrar notificación');
        closeBtn.appendChild(createIcon('x', { size: 14 }));
        closeBtn.addEventListener('click', () => this._dismiss(id));

        el.append(message, closeBtn);
        return el;
    }

    _dismiss(id) {
        const idx = this.toasts.findIndex(t => t.id === id);
        if (idx < 0) return;
        const { element, timer } = this.toasts[idx];
        clearTimeout(timer);
        this.toasts.splice(idx, 1);

        element.classList.remove('is-visible');
        element.classList.add('is-leaving');

        const remove = () => element.remove();
        element.addEventListener('transitionend', remove, { once: true });
        // Fallback si transitionend no dispara (elemento ya removido, etc.)
        setTimeout(remove, 400);
    }
}
