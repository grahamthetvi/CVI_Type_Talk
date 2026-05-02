/**
 * CVI Type Talker - Internationalization
 * Loads JSON locale bundles and applies strings to the DOM and runtime messages.
 */
var CVII18n = {
    STORAGE_KEY: 'cvi-locale',
    /** @type {string} */
    current: 'en',
    /** @type {object|null} */
    dict: null,

    _get(obj, path) {
        if (!obj || !path) return null;
        var parts = path.split('.');
        var o = obj;
        for (var i = 0; i < parts.length; i++) {
            if (o == null) return null;
            o = o[parts[i]];
        }
        return o;
    },

    /**
     * Translate a dotted path. Replaces {placeholders} with vars[key].
     */
    t(path, vars) {
        var s = this._get(this.dict, path);
        if (s == null || typeof s !== 'string') {
            return typeof s === 'number' ? String(s) : path;
        }
        if (vars) {
            for (var k in vars) {
                if (Object.prototype.hasOwnProperty.call(vars, k)) {
                    s = s.split('{' + k + '}').join(String(vars[k]));
                }
            }
        }
        return s;
    },

    /** Convert **bold** segments to <strong> for consent/settings copy. */
    formatRich(text) {
        if (!text) return '';
        return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    },

    colorLabel(hex) {
        var map = this._get(this.dict, 'settingsPanel.labelsAndControls.colorOptions');
        if (!map) return hex;
        var keys = {
            '#FFFFFF': 'white',
            '#000000': 'black',
            '#FF0000': 'red',
            '#00FF00': 'green',
            '#0000FF': 'blue',
            '#FFFF00': 'yellow',
            '#FF00FF': 'magenta',
            '#00FFFF': 'cyan',
            '#FFA500': 'orange',
            '#800080': 'purple',
            '#FFC0CB': 'pink',
            '#A52A2A': 'brown',
            '#808080': 'gray'
        };
        var k = keys[hex];
        return k && map[k] ? map[k] : hex;
    },

    cursorOptionLabel(value) {
        var keys = { default: 'default', pointer: 'hand', crosshair: 'crosshair', none: 'hidden' };
        return this.t('settingsPanel.labelsAndControls.cursorOptions.' + keys[value]);
    },

    /**
     * @param {string} code  'en' | 'ar'
     * @param {boolean} [persist=true]
     */
    async setLocale(code, persist) {
        var res = await fetch('locales/' + code + '.json');
        if (!res.ok) throw new Error('Locale not found: ' + code);
        this.dict = await res.json();
        this.current = code;
        if (persist !== false) {
            try {
                localStorage.setItem(this.STORAGE_KEY, code);
            } catch (e) { /* ignore */ }
        }
        document.documentElement.lang = code === 'ar' ? 'ar' : 'en';
        document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
        this.applyDom();
        document.dispatchEvent(new CustomEvent('cvi-locale-changed', { detail: { locale: code } }));
    },

    applyDom() {
        if (!this.dict) return;

        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', this.t('documentSeo.metaDescription'));
        }
        var titleEl = document.querySelector('title');
        if (titleEl) titleEl.textContent = this.t('documentSeo.title');

        var list = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            var key = el.getAttribute('data-i18n');
            var val = this._get(this.dict, key);
            if (val == null) continue;
            if (typeof val === 'string') {
                if (el.hasAttribute('data-i18n-html')) {
                    el.innerHTML = this.formatRich(val);
                } else {
                    el.textContent = val;
                }
            }
        }

        var attrList = document.querySelectorAll('[data-i18n-attr]');
        for (var j = 0; j < attrList.length; j++) {
            var node = attrList[j];
            var spec = node.getAttribute('data-i18n-attr');
            if (!spec) continue;
            var pair = spec.split(':');
            if (pair.length !== 2) continue;
            var attrName = pair[0].trim();
            var path = pair[1].trim();
            var str = this._get(this.dict, path);
            if (typeof str === 'string') {
                node.setAttribute(attrName, str);
            }
        }

        this._applyColorSelectOptions('font-color');
        this._applyColorSelectOptions('background-color');
        this._applyColorSelectOptions('bubble-color');
        this._applyColorSelectOptions('image-bg-color');
        this._applyColorSelectOptions('arrow-color');
        this._applyFontOptions();
        this._applyCursorOptions();

        var langSel = document.getElementById('language-select');
        if (langSel) langSel.value = this.current;
    },

    _applyColorSelectOptions(selectId) {
        var sel = document.getElementById(selectId);
        if (!sel) return;
        var opts = sel.querySelectorAll('option');
        for (var i = 0; i < opts.length; i++) {
            var opt = opts[i];
            opt.textContent = this.colorLabel(opt.value);
        }
    },

    _applyFontOptions() {
        var sel = document.getElementById('font-family');
        if (!sel) return;
        var labels = this._get(this.dict, 'settingsPanel.labelsAndControls.fontOptions');
        if (!Array.isArray(labels)) return;
        var opts = sel.querySelectorAll('option');
        for (var i = 0; i < opts.length && i < labels.length; i++) {
            opts[i].textContent = labels[i];
        }
    },

    _applyCursorOptions() {
        var sel = document.getElementById('cursor-style');
        if (!sel) return;
        var opts = sel.querySelectorAll('option');
        for (var i = 0; i < opts.length; i++) {
            var opt = opts[i];
            opt.textContent = this.cursorOptionLabel(opt.value);
        }
    },

    async init() {
        var saved = 'en';
        try {
            saved = localStorage.getItem(this.STORAGE_KEY) || 'en';
        } catch (e) { /* ignore */ }
        if (saved !== 'en' && saved !== 'ar') saved = 'en';
        await this.setLocale(saved, false);
    }
};
