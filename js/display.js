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
     */
    startTeacherMode(word) {
        if (this.currentText.trim().length > 0) {
            this.commitLine();
        }
        this.targetWord = word;
        this._render();
        this._updateStatus(CVII18n.t('statusBar.teacherMode', { word: word }));
    },

    /**
     * Add a character to the current line.
     */
    addCharacter(char) {
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
        this.lines.push(this.currentText);
        this.currentText = '';
        this._render();
        if (lastWord) {
            this._updateStatus('You typed: ' + lastWord);
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
        var visibleLines = this.lines.slice(-this.maxVisibleLines);

        var html = '';
        for (var i = 0; i < visibleLines.length; i++) {
            html += '<div class="completed-line">' + this._escapeHTML(visibleLines[i]) + '</div>';
        }

        this.displayEl.innerHTML = html;

        var lineSpan = document.createElement('span');
        lineSpan.id = 'current-line';
        lineSpan.className = 'current-line';
        
        var typedTextNode = document.createTextNode(this.currentText);
        lineSpan.appendChild(typedTextNode);

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
    },

    _updateStatus(text) {
        if (this.statusTextEl) {
            this.statusTextEl.textContent = text;
        }
    },

    _escapeHTML(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Clear all text and reset.
     */
    clear() {
        this.lines = [];
        this.currentText = '';
        this.targetWord = '';
        this._render();
        this._updateStatus(CVII18n.t('mainShellNavigation.statusBarInitial'));
    }
};
