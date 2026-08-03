/**
 * CVI Type Talker - Keyboard Module
 * Captures keyboard input, applies rate limiting, and routes to other modules.
 */
const CVIKeyboard = {
    lastKeyTime: 0,
    minInterval: 150,
    enabled: false,
    keyPressHistory: [],
    _teacherCommitPending: false,

    // Typing speed tracking
    sessionStartTime: null,
    letterCount: 0,
    wordCount: 0,
    speedDisplayMode: null, // null | 'wpm' | 'lpm'

    /** Allowed single characters: letters only (no digits) */
    _isAllowedChar: function(key) {
        return (key.length === 1 && /[a-zA-Z]/.test(key));
    },

    /** Finger id for i18n (systemSpeech.fingerNames.*) */
    _getFingerIdForChar: function(char) {
        var c = char.toLowerCase();
        if (['q', 'a', 'z', '1'].includes(c)) return 'leftPinky';
        if (['w', 's', 'x', '2'].includes(c)) return 'leftRing';
        if (['e', 'd', 'c', '3'].includes(c)) return 'leftMiddle';
        if (['r', 'f', 'v', 't', 'g', 'b', '4', '5'].includes(c)) return 'leftIndex';
        if (['y', 'h', 'n', 'u', 'j', 'm', '6', '7'].includes(c)) return 'rightIndex';
        if (['i', 'k', ',', '8'].includes(c)) return 'rightMiddle';
        if (['o', 'l', '.', '9'].includes(c)) return 'rightRing';
        if (['p', ';', '/', "'", '[', ']', '-', '=', '0'].includes(c)) return 'rightPinky';
        if (c === ' ') return 'thumb';
        return '';
    },

    _fingerLabel: function(fingerId) {
        if (!fingerId || typeof CVII18n === 'undefined' || !CVII18n.t) return '';
        return CVII18n.t('systemSpeech.fingerNames.' + fingerId);
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
        var t = (typeof CVII18n !== 'undefined' && CVII18n.t) ? CVII18n.t.bind(CVII18n) : function (k) { return k; };
        var prefix = tryAgain ? t('systemSpeech.teacherModePrompts.tryAgain') : '';
        var fingerId = this._getFingerIdForChar(expectedChar);
        var finger = this._fingerLabel(fingerId);
        if (!/[a-zA-Z]/.test(expectedChar)) {
            var msg = prefix + (finger
                ? t('systemSpeech.teacherModePrompts.pressCharWithFinger', { char: expectedChar, finger: finger })
                : t('systemSpeech.teacherModePrompts.pressCharOnly', { char: expectedChar }));
            return msg;
        }
        var letterName = expectedChar.toUpperCase();
        if (expectedChar === expectedChar.toLowerCase()) {
            return prefix + (finger
                ? t('systemSpeech.teacherModePrompts.pressLowercaseWithFinger', { LETTER: letterName, finger: finger })
                : t('systemSpeech.teacherModePrompts.pressLowercaseOnly', { LETTER: letterName }));
        }
        var modId = this._isLeftHandLetter(expectedChar) ? 'rightPinky' : 'leftPinky';
        var modifierFinger = this._fingerLabel(modId);
        if (finger) {
            return prefix + t('systemSpeech.teacherModePrompts.pressUppercaseWithBothFingers', {
                LETTER: letterName,
                modifier_finger: modifierFinger,
                finger: finger
            });
        }
        return prefix + t('systemSpeech.teacherModePrompts.pressUppercaseShiftOnly', {
            LETTER: letterName,
            modifier_finger: modifierFinger
        });
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
     * Record a completed word for WPM tracking and persisted history.
     */
    recordWord(word) {
        this.wordCount++;
        if (typeof CVITypingHistory !== 'undefined' && word) {
            CVITypingHistory.recordWord(word, {
                wpm: this.getWPM(),
                lpm: this.getLPM(),
                letterCount: this.letterCount
            });
        }
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
            CVIDisplay._updateStatus(CVII18n.t('statusBar.wpm', { n: String(wpm) }));
        } else if (this.speedDisplayMode === 'lpm') {
            var lpm = this.getLPM();
            CVIDisplay._updateStatus(CVII18n.t('statusBar.lpm', { n: String(lpm) }));
        }
    },

    _isEditableTarget(event) {
        var el = event.target;
        if (!el || !el.tagName) return false;
        var tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (el.isContentEditable) return true;
        return false;
    },

    _handleKeyDown(event) {
        if (!this.enabled) return;

        // Let native form controls (language select, settings fields) receive typing
        if (this._isEditableTarget(event)) return;

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
            var wasTeacherMode = !!CVIDisplay.targetWord;
            CVIDisplay.clear();
            CVIImages.hideImage();
            CVISpeech.speakSystem(wasTeacherMode
                ? CVII18n.t('systemSpeech.screenCleared') + ' ' + CVII18n.t('statusBar.exitedTeacherMode')
                : CVII18n.t('systemSpeech.screenCleared'));
            return;
        }

        // Ctrl+Shift+M: toggle WPM display
        if (event.ctrlKey && event.shiftKey && (key === 'M' || key === 'm')) {
            event.preventDefault();
            if (this.speedDisplayMode === 'wpm') {
                this.speedDisplayMode = null;
                CVIDisplay._updateStatus(CVII18n.t('mainShellNavigation.statusBarInitial'));
            } else {
                this.speedDisplayMode = 'wpm';
                this._showSpeed();
            }
            return;
        }

        // Ctrl+Shift+Y: Teacher Mode (avoid Ctrl+Shift+T — browsers use that for "reopen closed tab")
        if (event.ctrlKey && event.shiftKey && (key === 'Y' || key === 'y')) {
            event.preventDefault();
            var word = prompt(CVII18n.t('browserDialogs.teacherModePrompt'));
            if (word !== null) {
                if (word.trim() === '') {
                    if (CVIDisplay.targetWord && CVIDisplay.currentText.length > 0) {
                        CVIDisplay.commitLine();
                    }
                    CVIDisplay.targetWord = '';
                    this._teacherCommitPending = false;
                    CVIDisplay._updateStatus(CVII18n.t('statusBar.exitedTeacherMode'));
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
                CVIDisplay._updateStatus(CVII18n.t('mainShellNavigation.statusBarInitial'));
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

        // Max keys per second limiting — prune first, then reject without counting
        this.keyPressHistory = this.keyPressHistory.filter(function(time) {
            return now - time < 1000;
        });

        if (this.keyPressHistory.length >= maxKeysPerSecond) {
            event.preventDefault();
            return;
        }

        // Backspace
        if (key === 'Backspace') {
            // Ignore during the Teacher Mode commit delay window
            if (this._teacherCommitPending) {
                event.preventDefault();
                return;
            }
            event.preventDefault();
            this.keyPressHistory.push(now);
            this.lastKeyTime = now;
            var removed = CVIDisplay.removeCharacter();
            if (removed) {
                CVISpeech.speakSystem(CVII18n.t('systemSpeech.backspace'));
            }
            return;
        }

        // Enter
        if (key === 'Enter') {
            event.preventDefault();
            // In Teacher Mode, do not commit a partial target word
            if (CVIDisplay.targetWord || this._teacherCommitPending) {
                return;
            }
            this.keyPressHistory.push(now);
            this.lastKeyTime = now;
            var word = CVIDisplay.commitLine();
            if (word) {
                CVISpeech.speakWord(word);
                CVIImages.showImage(word);
                if (this.speedDisplayMode) this._showSpeed();
            } else {
                CVISpeech.speakSystem(CVII18n.t('systemSpeech.newLine'));
            }
            return;
        }

        // Space
        if (key === ' ') {
            event.preventDefault();
            // In Teacher Mode, do not commit a partial target word
            if (CVIDisplay.targetWord || this._teacherCommitPending) {
                return;
            }
            this.keyPressHistory.push(now);
            this.lastKeyTime = now;
            var completedWord = CVIDisplay.handleSpace();
            if (completedWord) {
                CVISpeech.speakWord(completedWord);
                CVIImages.showImage(completedWord);
                if (this.speedDisplayMode) this._showSpeed();
            }
            return;
        }

        // Letters only (no digits)
        if (this._isAllowedChar(key)) {
            event.preventDefault();

            // Ignore further letters while Teacher Mode is finishing a word
            if (this._teacherCommitPending) {
                return;
            }
            
            // Teacher Mode Enforcement
            if (CVIDisplay.targetWord) {
                var expectedChar = CVIDisplay.targetWord[CVIDisplay.currentText.length];
                // Word already complete (should be covered by _teacherCommitPending)
                if (!expectedChar) {
                    return;
                }
                if (key.toLowerCase() !== expectedChar.toLowerCase()) {
                    CVISpeech.speakSystem(this._teacherKeyPromptMessage(expectedChar, true));
                    return;
                }
            }

            this.keyPressHistory.push(now);
            this.lastKeyTime = now;
            this.letterCount++;
            var charToAdd = key;
            if (CVIDisplay.targetWord) {
                // Force the typed character to match the teacher's capitalization
                charToAdd = CVIDisplay.targetWord[CVIDisplay.currentText.length];
            }
            if (typeof charToAdd !== 'string' || charToAdd.length !== 1) {
                return;
            }
            CVIDisplay.addCharacter(charToAdd);
            CVISpeech.speakLetter(charToAdd);
            if (this.speedDisplayMode) this._showSpeed();

            // Check if word is complete in Teacher Mode
            if (CVIDisplay.targetWord && CVIDisplay.currentText.length === CVIDisplay.targetWord.length) {
                // Block further input immediately so late keypresses cannot append "undefined"
                this._teacherCommitPending = true;
                var self = this;
                // Short delay so they can hear the last letter before the word is spoken
                setTimeout(function () {
                    var word = CVIDisplay.commitLine();
                    CVIDisplay.targetWord = ''; // Exit teacher mode after successful word
                    self._teacherCommitPending = false;
                    if (word) {
                        CVISpeech.speakWord(word);
                        CVIImages.showImage(word);
                        if (self.speedDisplayMode) self._showSpeed();
                    }
                }, 400);
            }
            return;
        }

        // All other keys: ignore (Tab, arrows, F-keys, digits, etc.)
    }
};
