/**
 * CVI Type Talker - Color Words
 * Recognizes color names in the current language (English names always work too)
 * and turns either that word, or the whole screen, that color.
 */
const CVIColors = {
    /** Last screen color applied from a finished color word, or null. */
    activeScreenHex: null,
    _maps: null,

    /**
     * Fold case, accents, and Arabic letter variants so "Marrón" and "marron" match.
     */
    normalize(word) {
        if (!word) return '';
        return String(word)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            // Hamza and maddah sit above this range once alef variants are decomposed.
            .replace(/[\u064B-\u0655\u0670\u0640]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه');
    },

    _buildMaps() {
        if (this._maps) return;
        var palettes = {
            en: [
                ['white', '#FFFFFF'],
                ['black', '#000000'],
                ['red', '#FF0000'],
                ['green', '#00FF00'],
                ['blue', '#0000FF'],
                ['yellow', '#FFFF00'],
                ['magenta', '#FF00FF'],
                ['cyan', '#00FFFF'],
                ['orange', '#FFA500'],
                ['purple', '#800080'],
                ['pink', '#FFC0CB'],
                ['brown', '#A52A2A'],
                ['gray', '#808080'],
                ['grey', '#808080']
            ],
            es: [
                ['blanco', '#FFFFFF'],
                ['negro', '#000000'],
                ['rojo', '#FF0000'],
                ['verde', '#00FF00'],
                ['azul', '#0000FF'],
                ['amarillo', '#FFFF00'],
                ['magenta', '#FF00FF'],
                ['cian', '#00FFFF'],
                ['naranja', '#FFA500'],
                ['morado', '#800080'],
                ['púrpura', '#800080'],
                ['rosa', '#FFC0CB'],
                ['marrón', '#A52A2A'],
                ['café', '#A52A2A'],
                ['gris', '#808080']
            ],
            fr: [
                ['blanc', '#FFFFFF'],
                ['blanche', '#FFFFFF'],
                ['noir', '#000000'],
                ['noire', '#000000'],
                ['rouge', '#FF0000'],
                ['vert', '#00FF00'],
                ['verte', '#00FF00'],
                ['bleu', '#0000FF'],
                ['bleue', '#0000FF'],
                ['jaune', '#FFFF00'],
                ['magenta', '#FF00FF'],
                ['cyan', '#00FFFF'],
                ['orange', '#FFA500'],
                ['violet', '#800080'],
                ['violette', '#800080'],
                ['rose', '#FFC0CB'],
                ['marron', '#A52A2A'],
                ['gris', '#808080'],
                ['grise', '#808080']
            ],
            ar: [
                ['أبيض', '#FFFFFF'],
                ['بيضاء', '#FFFFFF'],
                ['أسود', '#000000'],
                ['سوداء', '#000000'],
                ['أحمر', '#FF0000'],
                ['حمراء', '#FF0000'],
                ['أخضر', '#00FF00'],
                ['خضراء', '#00FF00'],
                ['أزرق', '#0000FF'],
                ['زرقاء', '#0000FF'],
                ['أصفر', '#FFFF00'],
                ['صفراء', '#FFFF00'],
                ['أرجواني', '#FF00FF'],
                ['أرجوانية', '#FF00FF'],
                ['سماوي', '#00FFFF'],
                ['سماوية', '#00FFFF'],
                ['برتقالي', '#FFA500'],
                ['برتقالية', '#FFA500'],
                ['بنفسجي', '#800080'],
                ['بنفسجية', '#800080'],
                ['وردي', '#FFC0CB'],
                ['وردية', '#FFC0CB'],
                ['بني', '#A52A2A'],
                ['بنية', '#A52A2A'],
                ['رمادي', '#808080'],
                ['رمادية', '#808080']
            ]
        };
        var maps = {};
        var self = this;
        Object.keys(palettes).forEach(function (locale) {
            var map = Object.create(null);
            palettes[locale].forEach(function (pair) {
                map[self.normalize(pair[0])] = pair[1];
            });
            maps[locale] = map;
        });
        this._maps = maps;
    },

    /**
     * @param {string} word
     * @param {string} [locale] current UI language; defaults to CVII18n.current or English
     * @returns {string|null} hex color, or null when the word is not a color name
     */
    lookup(word, locale) {
        this._buildMaps();
        var key = this.normalize(word);
        if (!key) return null;
        var loc = locale;
        if (!loc && typeof CVII18n !== 'undefined' && CVII18n.current) {
            loc = CVII18n.current;
        }
        if (!loc || !this._maps[loc]) loc = 'en';
        if (this._maps[loc][key]) return this._maps[loc][key];
        if (loc !== 'en' && this._maps.en[key]) return this._maps.en[key];
        return null;
    },

    /** 'off' | 'word' | 'screen' */
    mode() {
        if (typeof CVISettings === 'undefined' || !CVISettings.current) return 'off';
        var mode = CVISettings.current.colorWordMode;
        if (mode === 'word' || mode === 'screen') return mode;
        return 'off';
    },

    _parseHex(hex) {
        if (typeof hex !== 'string') return null;
        var h = hex.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
        return {
            r: parseInt(h.slice(1, 3), 16),
            g: parseInt(h.slice(3, 5), 16),
            b: parseInt(h.slice(5, 7), 16)
        };
    },

    _channel(value) {
        var c = value / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    },

    luminance(hex) {
        var rgb = this._parseHex(hex);
        if (!rgb) return 0;
        return (0.2126 * this._channel(rgb.r))
            + (0.7152 * this._channel(rgb.g))
            + (0.0722 * this._channel(rgb.b));
    },

    contrastRatio(hexA, hexB) {
        var l1 = this.luminance(hexA);
        var l2 = this.luminance(hexB);
        var lighter = Math.max(l1, l2);
        var darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    },

    /** Black or white, whichever is easier to read on this background. */
    readableText(bgHex) {
        var onBlack = this.contrastRatio(bgHex, '#000000');
        var onWhite = this.contrastRatio(bgHex, '#FFFFFF');
        return onWhite > onBlack ? '#FFFFFF' : '#000000';
    },

    /**
     * Keep the preferred font color when it still contrasts with the new background.
     */
    textOn(bgHex, preferredHex) {
        if (preferredHex && this._parseHex(preferredHex) && this.contrastRatio(preferredHex, bgHex) >= 4.5) {
            return preferredHex;
        }
        return this.readableText(bgHex);
    },

    /**
     * Hex of the latest finished color word still on screen.
     * The word being typed does not count until Space or Enter finishes it,
     * so the whole screen does not flash while a longer word is spelled.
     */
    lastCommittedHex(lines, currentText, locale) {
        var last = null;
        var self = this;
        function scan(text, includePartial) {
            if (!text) return;
            var parts = String(text).split(/\s+/);
            var end = parts.length;
            if (!includePartial && text.length > 0 && !/\s$/.test(text)) {
                end -= 1;
            }
            for (var i = 0; i < end; i++) {
                if (!parts[i]) continue;
                var hex = self.lookup(parts[i], locale);
                if (hex) last = hex;
            }
        }
        var list = lines || [];
        for (var i = 0; i < list.length; i++) {
            scan(list[i], true);
        }
        scan(currentText || '', false);
        return last;
    },

    /**
     * Paint or clear the full-screen color from the words currently on screen.
     */
    syncFromDisplay(lines, currentText) {
        if (typeof document === 'undefined') return;
        var next = this.mode() === 'screen'
            ? this.lastCommittedHex(lines, currentText)
            : null;
        this.activeScreenHex = next;
        if (next) this._paintScreen(next);
        else this._clearScreen();
    },

    _paintScreen(hex) {
        var preferred = (typeof CVISettings !== 'undefined' && CVISettings.current)
            ? CVISettings.current.fontColor
            : null;
        var text = this.textOn(hex, preferred);
        var root = document.documentElement;
        root.style.setProperty('--typed-screen-color', hex);
        root.style.setProperty('--typed-text-color', text);
        document.body.classList.add('typed-color-screen');
    },

    _clearScreen() {
        if (typeof document === 'undefined') return;
        document.body.classList.remove('typed-color-screen');
        document.documentElement.style.removeProperty('--typed-screen-color');
        document.documentElement.style.removeProperty('--typed-text-color');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CVIColors;
}
