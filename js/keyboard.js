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

    /** Helper for finger mapping (assuming home row) */
    _getFingerForChar: function(char) {
        var c = char.toLowerCase();
        if (['q', 'a', 'z', '1'].includes(c)) return "left pinky";
        if (['w', 's', 'x', '2'].includes(c)) return "left ring finger";
        if (['e', 'd', 'c', '3'].includes(c)) return "left middle finger";
        if (['r', 'f', 'v', 't', 'g', 'b', '4', '5'].includes(c)) return "left index finger";
        if (['y', 'h', 'n', 'u', 'j', 'm', '6', '7'].includes(c)) return "right index finger";
        if (['i', 'k', ',', '8'].includes(c)) return "right middle finger";
        if (['o', 'l', '.', '9'].includes(c)) return "right ring finger";
        if (['p', ';', '/', "'", '[', ']', '-', '=', '0'].includes(c)) return "right pinky";
        if (c === ' ') return "thumb";
        return "";
    },

    /** True if the base letter is typed with the left hand on the home row. */
    _isLeftHandLetter: function(char) {
        var low = char.toLowerCase();
        return ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'].indexOf(low) !== -1;
    },

    /**
     * Spoken instruction for the next key in Teacher Mode (Tab/?) or after a wrong key.
     * Lowercase: "Press X with your … finger"; uppercase: capital + opposite-hand shift + base key finger.
     */
    _teacherKeyPromptMessage: function(expectedChar, tryAgain) {
        var prefix = tryAgain ? 'Try again. ' : '';
        var finger = this._getFingerForChar(expectedChar);
        if (!/[a-zA-Z]/.test(expectedChar)) {
            var msg = prefix + 'Press ' + expectedChar;
            if (finger) msg += ' with your ' + finger;
            return msg;
        }
        var letterName = expectedChar.toUpperCase();
        if (expectedChar === expectedChar.toLowerCase()) {
            var out = prefix + 'Press ' + letterName;
            if (finger) out += ' with your ' + finger;
            return out;
        }
        var shiftFinger = this._isLeftHandLetter(expectedChar) ? 'right pinky' : 'left pinky';
        var cap = prefix + 'Press capital ' + letterName + '. Hold shift with your ' + shiftFinger;
        if (finger) {
            cap += ', then press ' + letterName + ' with your ' + finger;
        }
        return cap;
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

        // Ctrl+Shift+Y: Teacher Mode (avoid Ctrl+Shift+T — browsers use that for "reopen closed tab")
        if (event.ctrlKey && event.shiftKey && (key === 'Y' || key === 'y')) {
            event.preventDefault();
            var word = prompt("Enter target word for Teacher Mode (or leave blank to exit):");
            if (word !== null) {
                if (word.trim() === '') {
                    if (CVIDisplay.targetWord && CVIDisplay.currentText.length > 0) {
                        var partialWord = CVIDisplay.commitLine();
                        if (partialWord) this.recordWord();
                    }
                    CVIDisplay.targetWord = '';
                    CVIDisplay._updateStatus('Exited Teacher Mode');
                    CVIDisplay._render();
                } else {
                    CVIDisplay.startTeacherMode(word.trim());
                }
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

        // Audio prompt key for Teacher Mode (Tab or ?)
        if (CVIDisplay.targetWord) {
            if (key === 'Tab' || key === '?' || key === '/') {
                event.preventDefault();
                var expectedChar = CVIDisplay.targetWord[CVIDisplay.currentText.length];
                if (expectedChar) {
                    CVISpeech.speakSystem(this._teacherKeyPromptMessage(expectedChar, false));
                }
                return;
            }
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
            
            // Teacher Mode Enforcement
            if (CVIDisplay.targetWord) {
                var expectedChar = CVIDisplay.targetWord[CVIDisplay.currentText.length];
                if (expectedChar && key.toLowerCase() !== expectedChar.toLowerCase()) {
                    CVISpeech.speakSystem(this._teacherKeyPromptMessage(expectedChar, true));
                    return;
                }
            }

            this.letterCount++;
            var charToAdd = key;
            if (CVIDisplay.targetWord) {
                // Force the typed character to match the teacher's capitalization
                charToAdd = CVIDisplay.targetWord[CVIDisplay.currentText.length];
            }
            CVIDisplay.addCharacter(charToAdd);
            CVISpeech.speakLetter(charToAdd);
            if (this.speedDisplayMode) this._showSpeed();

            // Check if word is complete in Teacher Mode
            if (CVIDisplay.targetWord && CVIDisplay.currentText.length === CVIDisplay.targetWord.length) {
                // Short delay so they can hear the last letter before the word is spoken
                setTimeout(() => {
                    var word = CVIDisplay.commitLine();
                    CVIDisplay.targetWord = ''; // Exit teacher mode after successful word
                    if (word) {
                        CVISpeech.speakWord(word);
                        CVIImages.showImage(word);
                        this.recordWord();
                        if (this.speedDisplayMode) this._showSpeed();
                    }
                }, 400);
            }
            return;
        }

        // All other keys: ignore (Tab, arrows, F-keys, digits, etc.)
    }
};
