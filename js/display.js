/**
 * CVI Type Talker - Display Module
 * Manages the text display area, line tracking, and status bar.
 */
const CVIDisplay = {
    displayEl: null,
    statusTextEl: null,
    lines: [],
    currentText: '',
    maxVisibleLines: 5,
    targetWord: '', // For Teacher Mode

    init() {
        this.displayEl = document.getElementById('text-display');
        this.statusTextEl = document.getElementById('status-text');
        this.lines = [];
        this.currentText = '';
        this.targetWord = '';
        this._render();
    },

    /**
     * Start Teacher Mode with a specific target word.
     * Non-letter characters are stripped because only letters can be typed.
     */
    startTeacherMode(word) {
        if (this.currentText.trim().length > 0) {
            this.commitLine();
        }
        // Keep letters only so targets remain completable with the keyboard
        var sanitized = String(word || '').replace(/[^\p{L}]/gu, '');
        if (!sanitized) {
            this.targetWord = '';
            this._updateStatus(CVII18n.t('statusBar.exitedTeacherMode'));
            this._render();
            return;
        }
        if (typeof CVIKeyboard !== 'undefined') {
            CVIKeyboard._teacherCommitPending = false;
        }
        this.targetWord = sanitized;
        this._render();
        this._updateStatus(CVII18n.t('statusBar.teacherMode', { word: sanitized }));
    },

    /**
     * Add a character to the current line.
     */
    addCharacter(char) {
        if (typeof char !== 'string' || char.length === 0) return;
        this.currentText += char;
        this._render();
    },

    /**
     * Remove the last character (backspace).
     * Returns the removed character or null if empty.
     */
    removeCharacter() {
        if (this.currentText.length === 0) return null;
        const removed = this.currentText[this.currentText.length - 1];
        this.currentText = this.currentText.slice(0, -1);
        this._render();
        return removed;
    },

    /**
     * Get the current word being typed (last space-separated token).
     */
    getCurrentWord() {
        const words = this.currentText.trim().split(/\s+/);
        return words[words.length - 1] || '';
    },

    /**
     * Handle space: add a single space (ignore if already ends with space).
     * Returns the just-completed word, or null if already trailing a space.
     */
    handleSpace() {
        // Collapse multiple spaces — if currentText already ends with a space, ignore
        if (this.currentText.endsWith(' ')) {
            return null;
        }

        const word = this.getCurrentWord();
        this.currentText += ' ';
        this._render();
        if (word) {
            this._updateStatus(CVII18n.t('statusBar.youTyped', { word: word }));
            this._recordWord(word);
        }
        return word;
    },

    /**
     * Commit the current line (Enter). Returns the last word.
     */
    commitLine() {
        const lastWord = this.getCurrentWord();
        // Skip empty lines so blank Enter presses don't fill the visible line slots
        if (this.currentText.length > 0) {
            this.lines.push(this.currentText);
        }
        this.currentText = '';
        this._render();
        if (lastWord) {
            this._updateStatus(CVII18n.t('statusBar.youTyped', { word: lastWord }));
            this._recordWord(lastWord);
        } else {
            this._updateStatus(CVII18n.t('statusBar.newLine'));
        }
        return lastWord;
    },

    /**
     * Record a completed word — single entry point for session and persisted history.
     */
    _recordWord(word) {
        if (!word || !word.trim()) return;
        if (typeof CVIKeyboard !== 'undefined' && CVIKeyboard.recordWord) {
            CVIKeyboard.recordWord(word.trim());
        }
    },

    /**
     * Get the full session word history array.
     */
    getWordHistory() {
        if (typeof CVITypingHistory !== 'undefined') {
            return CVITypingHistory.getActiveWords().map(function (entry) {
                return {
                    word: entry.word,
                    timestamp: new Date(entry.at).toLocaleTimeString(),
                    wpm: entry.wpm,
                    lpm: entry.lpm
                };
            });
        }
        return [];
    },

    /**
     * Re-render the text display from data model.
     */
    _render() {
        if (!this.displayEl) return;
        var visibleLines = this.lines.slice(-this.maxVisibleLines);

        this.displayEl.textContent = '';

        for (var i = 0; i < visibleLines.length; i++) {
            var line = document.createElement('div');
            line.className = 'completed-line';
            this._appendLineText(line, visibleLines[i]);
            this.displayEl.appendChild(line);
        }

        var lineSpan = document.createElement('span');
        lineSpan.id = 'current-line';
        lineSpan.className = 'current-line';
        this._appendLineText(lineSpan, this.currentText);

        var cursor = document.createElement('span');
        cursor.className = 'cursor';
        cursor.setAttribute('aria-hidden', 'true');
        cursor.textContent = '|';
        lineSpan.appendChild(cursor);

        if (this.targetWord) {
            var remaining = this.targetWord.substring(this.currentText.length);
            if (remaining) {
                var ghostSpan = document.createElement('span');
                ghostSpan.className = 'ghost-text';
                ghostSpan.textContent = remaining;
                lineSpan.appendChild(ghostSpan);
            }
        }

        this.displayEl.appendChild(lineSpan);

        this.displayEl.scrollTop = this.displayEl.scrollHeight;

        if (typeof CVIColors !== 'undefined') {
            CVIColors.syncFromDisplay(this.lines, this.currentText);
        }
    },

    /**
     * Put a line of typed text into the display.
     * In "color the word" mode, a color name is wrapped so it shows in that color.
     */
    _appendLineText(parent, text) {
        if (!text) return;
        if (typeof CVIColors === 'undefined' || CVIColors.mode() !== 'word') {
            parent.appendChild(document.createTextNode(text));
            return;
        }
        var parts = String(text).split(/(\s+)/);
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (!part) continue;
            var hex = /^\s+$/.test(part) ? null : CVIColors.lookup(part);
            if (hex) parent.appendChild(this._colorWordSpan(part, hex));
            else parent.appendChild(document.createTextNode(part));
        }
    },

    _colorWordSpan(text, hex) {
        var span = document.createElement('span');
        span.className = 'color-word';
        span.style.color = hex;
        span.textContent = text;

        var settings = (typeof CVISettings !== 'undefined' && CVISettings.current)
            ? CVISettings.current
            : null;
        var bg = (settings && settings.backgroundColor) || '#000000';
        var bubbleOn = !!(settings && settings.bubbleLettersEnabled);
        if (!bubbleOn && CVIColors.contrastRatio(hex, bg) < 4.5) {
            span.classList.add('needs-outline');
            span.style.setProperty('--color-word-stroke', CVIColors.readableText(bg));
        }
        return span;
    },

    _updateStatus(text) {
        if (this.statusTextEl) {
            this.statusTextEl.textContent = text;
        }
    },

    /**
     * Clear all text and reset.
     */
    clear() {
        this.lines = [];
        this.currentText = '';
        this.targetWord = '';
        if (typeof CVIKeyboard !== 'undefined') {
            CVIKeyboard._teacherCommitPending = false;
        }
        this._render();
        this._updateStatus(CVII18n.t('mainShellNavigation.statusBarInitial'));
    }
};
