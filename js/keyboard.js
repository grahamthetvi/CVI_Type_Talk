/**
 * CVI Type Talker - Keyboard Module
 * Captures keyboard input, applies rate limiting, and routes to other modules.
 */
const CVIKeyboard = {
    lastKeyTime: 0,
    minInterval: 150,
    enabled: false,
    keyPressHistory: [],

    // Typing speed tracking
    sessionStartTime: null,
    letterCount: 0,
    wordCount: 0,
    speedDisplayMode: null, // null | 'wpm' | 'lpm'

    /** Allowed single characters: letters only (no digits) */
    _isAllowedChar: function(key) {
        return (key.length === 1 && /[a-zA-Z]/.test(key));
    },

    init() {
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
    },

    enable() {
        this.enabled = true;
        if (!this.sessionStartTime) {
            this.sessionStartTime = Date.now();
        }
    },

    disable() {
        this.enabled = false;
    },

    /**
     * Record a completed word for WPM tracking.
     * Called by display.js when a word is committed.
     */
    recordWord() {
        this.wordCount++;
    },

    /**
     * Get current WPM based on elapsed session time.
     */
    getWPM() {
        if (!this.sessionStartTime || this.wordCount === 0) return 0;
        var elapsedMinutes = (Date.now() - this.sessionStartTime) / 60000;
        if (elapsedMinutes < 0.001) return 0;
        return Math.round(this.wordCount / elapsedMinutes);
    },

    /**
     * Get current LPM based on elapsed session time.
     */
    getLPM() {
        if (!this.sessionStartTime || this.letterCount === 0) return 0;
        var elapsedMinutes = (Date.now() - this.sessionStartTime) / 60000;
        if (elapsedMinutes < 0.001) return 0;
        return Math.round(this.letterCount / elapsedMinutes);
    },

    /**
     * Show typing speed in the status bar.
     */
    _showSpeed() {
        if (this.speedDisplayMode === 'wpm') {
            var wpm = this.getWPM();
            CVIDisplay._updateStatus('Words per minute: ' + wpm + ' WPM  |  Press Ctrl+Shift+M to hide');
        } else if (this.speedDisplayMode === 'lpm') {
            var lpm = this.getLPM();
            CVIDisplay._updateStatus('Letters per minute: ' + lpm + ' LPM  |  Press Ctrl+Shift+L to hide');
        }
    },

    _handleKeyDown(event) {
        if (!this.enabled) return;

        var key = event.key;

        // Ctrl+Shift+Q: exit fullscreen
        if (event.ctrlKey && event.shiftKey && (key === 'Q' || key === 'q')) {
            event.preventDefault();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            return;
        }

        // Ctrl+Shift+C: clear screen
        if (event.ctrlKey && event.shiftKey && (key === 'C' || key === 'c')) {
            event.preventDefault();
            CVIDisplay.clear();
            CVIImages.hideImage();
            CVISpeech.speakSystem('screen cleared');
            return;
        }

        // Ctrl+Shift+M: toggle WPM display
        if (event.ctrlKey && event.shiftKey && (key === 'M' || key === 'm')) {
            event.preventDefault();
            if (this.speedDisplayMode === 'wpm') {
                this.speedDisplayMode = null;
                CVIDisplay._updateStatus('Type a letter to begin');
            } else {
                this.speedDisplayMode = 'wpm';
                this._showSpeed();
            }
            return;
        }

        // Ctrl+Shift+L: toggle LPM display
        if (event.ctrlKey && event.shiftKey && (key === 'L' || key === 'l')) {
            event.preventDefault();
            if (this.speedDisplayMode === 'lpm') {
                this.speedDisplayMode = null;
                CVIDisplay._updateStatus('Type a letter to begin');
            } else {
                this.speedDisplayMode = 'lpm';
                this._showSpeed();
            }
            return;
        }

        // Ignore other modifier combos (let browser handle Ctrl+C, etc.)
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        // Arrow keys: navigate photos (bypass rate-limiting — these aren't typing actions)
        if (key === 'ArrowLeft') {
            event.preventDefault();
            CVIImages.showPrevPhoto();
            return;
        }
        if (key === 'ArrowRight') {
            event.preventDefault();
            CVIImages.showNextPhoto();
            return;
        }

        // Get current settings
        var settings = CVISettings ? CVISettings.getSettings() : null;
        var minInterval = settings ? settings.typingInterval : this.minInterval;
        var maxKeysPerSecond = settings ? settings.maxKeysPerSecond : 10;

        // Rate limiting - minimum interval between keys
        var now = Date.now();
        if (now - this.lastKeyTime < minInterval) {
            event.preventDefault();
            return;
        }

        // Max keys per second limiting
        this.keyPressHistory.push(now);
        // Keep only keys from the last second
        this.keyPressHistory = this.keyPressHistory.filter(function(time) {
            return now - time < 1000;
        });

        if (this.keyPressHistory.length > maxKeysPerSecond) {
            event.preventDefault();
            return;
        }

        this.lastKeyTime = now;

        // Backspace
        if (key === 'Backspace') {
            event.preventDefault();
            var removed = CVIDisplay.removeCharacter();
            if (removed) {
                CVISpeech.speakSystem('backspace');
            }
            return;
        }

        // Enter
        if (key === 'Enter') {
            event.preventDefault();
            var word = CVIDisplay.commitLine();
            if (word) {
                CVISpeech.speakWord(word);
                CVIImages.showImage(word);
                this.recordWord();
                if (this.speedDisplayMode) this._showSpeed();
            } else {
                CVISpeech.speakSystem('new line');
            }
            return;
        }

        // Space
        if (key === ' ') {
            event.preventDefault();
            var completedWord = CVIDisplay.handleSpace();
            if (completedWord) {
                CVISpeech.speakWord(completedWord);
                CVIImages.showImage(completedWord);
                this.recordWord();
                if (this.speedDisplayMode) this._showSpeed();
            }
            return;
        }

        // Letters only (no digits)
        if (this._isAllowedChar(key)) {
            event.preventDefault();
            this.letterCount++;
            CVIDisplay.addCharacter(key);
            CVISpeech.speakLetter(key);
            if (this.speedDisplayMode) this._showSpeed();
            return;
        }

        // All other keys: ignore (Tab, arrows, F-keys, digits, etc.)
    }
};
