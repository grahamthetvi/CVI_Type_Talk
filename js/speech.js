/**
 * CVI Type Talker - Speech Module
 * Wraps the Web Speech API for letter-by-letter and word speech.
 */
const CVISpeech = {
    synth: window.speechSynthesis,
    voice: null,
    enabled: true,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,

    _langPrefix() {
        var current = (typeof CVII18n !== 'undefined' && CVII18n.current) ? CVII18n.current : 'en';
        if (current === 'ar' || current === 'es' || current === 'fr') return current;
        return 'en';
    },

    _utteranceLang() {
        if (this.voice && this.voice.lang) return this.voice.lang;
        var defaults = { en: 'en-US', ar: 'ar-SA', es: 'es-ES', fr: 'fr-FR' };
        return defaults[this._langPrefix()] || 'en-US';
    },

    _digitWord(d) {
        if (typeof CVII18n !== 'undefined' && CVII18n.t) {
            var w = CVII18n.t('systemSpeech.digits.' + d);
            if (w && w.indexOf('systemSpeech') === -1) return w;
        }
        var fallback = {
            '0': 'zero', '1': 'one', '2': 'two', '3': 'three',
            '4': 'four', '5': 'five', '6': 'six', '7': 'seven',
            '8': 'eight', '9': 'nine'
        };
        return fallback[d] || d;
    },

    /**
     * Initialize: select a voice matching the current UI locale.
     * Chrome loads voices asynchronously so we wait for the event.
     */
    init() {
        return new Promise((resolve) => {
            if (!this.isSupported() || !this.synth) {
                this.synth = null;
                this.voice = null;
                resolve(null);
                return;
            }
            var prefix = this._langPrefix();
            var setVoice = () => {
                var voices = this.synth.getVoices();
                var pick = function (p) {
                    return voices.find(function (v) {
                        return v.lang && v.lang.toLowerCase().indexOf(p) === 0;
                    });
                };
                this.voice =
                    pick(prefix + '-') ||
                    pick(prefix) ||
                    (prefix === 'en' ? voices.find(function (v) { return v.name.indexOf('Google US English') !== -1; }) : null) ||
                    pick('en') ||
                    voices[0] || null;
                resolve(this.voice);
            };

            if (this.synth.getVoices().length > 0) {
                setVoice();
            } else {
                this.synth.addEventListener('voiceschanged', setVoice, { once: true });
                setTimeout(function () {
                    if (!this.voice) setVoice();
                }.bind(this), 1000);
            }
        });
    },

    /**
     * Speak a single letter. Cancels any pending speech first.
     */
    speakLetter(letter) {
        if (!this.enabled || !this.synth) return;
        this.synth.cancel();

        const spokenText = this._charToSpoken(letter);
        const utterance = new SpeechSynthesisUtterance(spokenText);
        if (this.voice) utterance.voice = this.voice;
        utterance.lang = this._utteranceLang();
        utterance.rate = 0.9;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;

        this.synth.speak(utterance);
    },

    /**
     * Speak a full word. Cancels any pending speech first.
     */
    speakWord(word) {
        if (!this.enabled || !this.synth || !word.trim()) return;
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(word);
        if (this.voice) utterance.voice = this.voice;
        utterance.lang = this._utteranceLang();
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;

        this.synth.speak(utterance);
    },

    /**
     * Speak a system message (e.g., "backspace", "new line").
     */
    speakSystem(message) {
        if (!this.enabled || !this.synth) return;
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        if (this.voice) utterance.voice = this.voice;
        utterance.lang = this._utteranceLang();
        utterance.rate = 1.1;
        utterance.pitch = 0.9;
        utterance.volume = this.volume;

        this.synth.speak(utterance);
    },

    /**
     * Convert a character to its spoken representation.
     */
    _charToSpoken(char) {
        if (/[a-zA-Z]/.test(char)) {
            return char.toUpperCase();
        }
        if (/[0-9]/.test(char)) {
            return this._digitWord(char);
        }
        // Non-Latin letters (e.g. Arabic): speak the character as-is
        return char;
    },

    /** Stop all speech immediately. */
    stop() {
        if (this.synth) this.synth.cancel();
    },

    /** Check if Web Speech API is supported. */
    isSupported() {
        return 'speechSynthesis' in window;
    },

    /** Re-select TTS voice after UI language change. */
    refreshVoice() {
        return this.init();
    }
};
