/*
 * Combobox accesible (ARIA select-only pattern).
 * Reemplaza al <select> nativo para tener control total de la estética
 * y conservar navegación por teclado y semántica.
 *
 * Estructura esperada en el DOM:
 *   <div class="combo">
 *     <button class="combo-toggle" aria-haspopup="listbox" aria-expanded="false">
 *       <span class="combo-toggle-label"></span>
 *       <span class="combo-arrow" aria-hidden="true">▾</span>
 *     </button>
 *     <ul class="combo-listbox" role="listbox" tabindex="-1" hidden>
 *       <li role="option" data-value="..." aria-selected="true|false"></li>
 *       ...
 *     </ul>
 *   </div>
 */

export class Combobox {
    constructor(root, { onChange } = {}) {
        this.root = root;
        this.toggle = root.querySelector('.combo-toggle');
        this.label = root.querySelector('.combo-toggle-label');
        this.listbox = root.querySelector('.combo-listbox');
        this.options = Array.from(this.listbox.querySelectorAll('[role="option"]'));
        this.onChange = onChange;

        const initial = this.options.findIndex(o => o.getAttribute('aria-selected') === 'true');
        this.selectedIndex = initial >= 0 ? initial : 0;
        this.activeIndex = this.selectedIndex;
        this.isOpen = false;

        this._bind();
        this._renderSelection();
    }

    get value() {
        return this.options[this.selectedIndex]?.dataset.value;
    }

    _bind() {
        this.toggle.addEventListener('click', () => this.isOpen ? this._close() : this._open());
        this.toggle.addEventListener('keydown', (e) => this._onToggleKeyDown(e));

        this.listbox.addEventListener('keydown', (e) => this._onListboxKeyDown(e));

        this.options.forEach((opt, i) => {
            opt.addEventListener('click', () => {
                this._select(i);
                this._close({ returnFocus: true });
            });
            opt.addEventListener('mouseenter', () => this._setActive(i));
        });

        // Cerrar al hacer click fuera
        document.addEventListener('mousedown', (e) => {
            if (this.isOpen && !this.root.contains(e.target)) this._close();
        });
    }

    _onToggleKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp':
            case 'Enter':
            case ' ':
                e.preventDefault();
                this._open();
                break;
        }
    }

    _onListboxKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._setActive(Math.min(this.activeIndex + 1, this.options.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._setActive(Math.max(this.activeIndex - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                this._setActive(0);
                break;
            case 'End':
                e.preventDefault();
                this._setActive(this.options.length - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this._select(this.activeIndex);
                this._close({ returnFocus: true });
                break;
            case 'Escape':
                e.preventDefault();
                this._close({ returnFocus: true });
                break;
            case 'Tab':
                this._close();
                break;
        }
    }

    _open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.listbox.hidden = false;
        this.toggle.setAttribute('aria-expanded', 'true');
        this.activeIndex = this.selectedIndex;
        this._setActive(this.activeIndex);
        // Trasladar foco al listbox para capturar las teclas
        this.listbox.focus();
    }

    _close({ returnFocus = false } = {}) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.listbox.hidden = true;
        this.toggle.setAttribute('aria-expanded', 'false');
        if (returnFocus) this.toggle.focus();
    }

    _setActive(idx) {
        this.activeIndex = idx;
        this.options.forEach((opt, i) => {
            opt.classList.toggle('is-active', i === idx);
            if (i === idx) opt.setAttribute('id', opt.id || `combo-opt-${i}`);
        });
        const active = this.options[idx];
        if (active) {
            this.listbox.setAttribute('aria-activedescendant', active.id);
            // Mantener visible si la lista hace scroll
            active.scrollIntoView({ block: 'nearest' });
        }
    }

    _select(idx) {
        if (idx === this.selectedIndex) return;
        this.selectedIndex = idx;
        this.options.forEach((opt, i) => {
            opt.setAttribute('aria-selected', String(i === idx));
        });
        this._renderSelection();
        if (typeof this.onChange === 'function') this.onChange(this.value);
    }

    _renderSelection() {
        const selected = this.options[this.selectedIndex];
        if (selected && this.label) this.label.textContent = selected.textContent;
    }
}
