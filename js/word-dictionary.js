/**
 * CVI Type Talker - Local Word Dictionary
 * Offline English word validation using a bundled common-word list plus
 * teacher-configured extras (preload list, allow-list, student name, etc.).
 */
const CVIWordDictionary = {
    /** @type {Set<string>|null} */
    _words: null,
    /** @type {Set<string>} */
    _extras: new Set(),
    /** @type {Map<string, boolean>} */
    _cache: new Map(),
    _ready: false,

    async init() {
        if (this._ready) return;

        try {
            var response = await fetch('data/english-words.json');
            if (!response.ok) {
                throw new Error('Word list request failed: ' + response.status);
            }
            var words = await response.json();
            this._words = new Set(words);
        } catch (err) {
            console.error('Failed to load word list:', err);
            this._words = new Set();
        }

        this.refreshExtras();
        this._ready = true;
    },

    /**
     * Re-read settings-driven word lists so newly saved words count as real.
     */
    refreshExtras() {
        this._extras.clear();
        this._cache.clear();

        var settings = (typeof CVISettings !== 'undefined' && CVISettings.getSettings)
            ? CVISettings.getSettings()
            : null;
        if (settings) {
            this.registerWordsFromCsv(settings.preloadWords);
            this.registerWordsFromCsv(settings.customWordList);
            if (settings.studentName) {
                this.registerWord(settings.studentName);
            }
        }
    },

    registerWord(word) {
        if (!word) return;
        var normalized = String(word).toLowerCase().trim();
        if (normalized.length > 1) {
            this._extras.add(normalized);
            this._cache.delete(normalized);
        }
    },

    registerWordsFromCsv(csv) {
        if (!csv || !String(csv).trim()) return;
        String(csv).split(',').forEach(function (part) {
            CVIWordDictionary.registerWord(part);
        });
    },

    /**
     * True when the word looks like a real English word we should fetch a picture for.
     */
    isRealWord(word) {
        if (!word) return false;

        var normalized = String(word).toLowerCase().trim();
        if (normalized.length <= 1) return false;

        if (this._cache.has(normalized)) {
            return this._cache.get(normalized);
        }

        var isReal = this._extras.has(normalized)
            || (this._words && this._words.has(normalized))
            || this._looksLikeInflectedForm(normalized);

        this._cache.set(normalized, isReal);
        return isReal;
    },

    /**
     * Accept simple plurals and past tense for common kid words (cat → cats, walk → walked).
     */
    _looksLikeInflectedForm(word) {
        if (!this._words || word.length < 4) return false;

        if (word.endsWith('s') && this._words.has(word.slice(0, -1))) return true;
        if (word.endsWith('es') && this._words.has(word.slice(0, -2))) return true;
        if (word.endsWith('ed') && this._words.has(word.slice(0, -2))) return true;
        if (word.endsWith('ed') && this._words.has(word.slice(0, -1))) return true;
        if (word.endsWith('ing') && this._words.has(word.slice(0, -3))) return true;

        return false;
    }
};
