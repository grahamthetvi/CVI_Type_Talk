/**
 * CVI Type Talker - Focus Trap Helper
 * Keeps Tab / Shift+Tab cycling inside a dialog while it is open.
 */
var CVIFocusTrap = {
    _handlers: new WeakMap(),

    _focusableSelector: 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',

    _getFocusable: function (container) {
        return Array.prototype.slice.call(container.querySelectorAll(this._focusableSelector)).filter(function (el) {
            return !el.disabled && el.offsetParent !== null;
        });
    },

    /**
     * Trap Tab focus inside container. Safe to call repeatedly on the same node.
     */
    trap: function (container) {
        if (!container) return;
        this.release(container);

        var self = this;
        var handler = function (e) {
            if (e.key !== 'Tab') return;

            var focusable = self._getFocusable(container);
            if (focusable.length === 0) {
                e.preventDefault();
                return;
            }

            var first = focusable[0];
            var last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        container.addEventListener('keydown', handler);
        this._handlers.set(container, handler);
    },

    /**
     * Remove a previously installed trap.
     */
    release: function (container) {
        if (!container) return;
        var handler = this._handlers.get(container);
        if (handler) {
            container.removeEventListener('keydown', handler);
            this._handlers.delete(container);
        }
    }
};
