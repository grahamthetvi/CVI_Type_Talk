/**
 * CVI Type Talker - Typing History Module
 * Persists multi-session word history with WPM/LPM in localStorage.
 */
const CVITypingHistory = {
    STORAGE_KEY: 'cvi-typing-sessions',
    VERSION: 1,
    MAX_SESSIONS: 50,

    sessions: [],
    activeSession: null,

    init() {
        this._load();
        this._finalizeOrphanedSessions();
    },

    /**
     * Begin a new typing session (called when keyboard is enabled).
     */
    startSession() {
        if (this.activeSession) return;

        var studentName = '';
        if (typeof CVISettings !== 'undefined' && CVISettings.getSettings) {
            studentName = CVISettings.getSettings().studentName || '';
        }

        this.activeSession = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            startedAt: Date.now(),
            endedAt: null,
            studentName: studentName,
            words: [],
            summary: null
        };
        this.sessions.unshift(this.activeSession);
        this._pruneSessions();
        this._save();
    },

    /**
     * Record a completed word in the active session.
     */
    recordWord(word, metrics) {
        if (!this.activeSession || !word || !word.trim()) return;

        this.activeSession.words.push({
            word: word.trim(),
            at: Date.now(),
            wpm: metrics && metrics.wpm != null ? metrics.wpm : 0,
            lpm: metrics && metrics.lpm != null ? metrics.lpm : 0
        });

        this._save();
        if (typeof CVISettings !== 'undefined' && CVISettings.refreshWordHistoryIfOpen) {
            CVISettings.refreshWordHistoryIfOpen();
        }
    },

    /**
     * Finalize the active session with summary metrics.
     */
    endSession(metrics) {
        if (!this.activeSession) return;

        var session = this.activeSession;
        session.endedAt = Date.now();
        session.summary = {
            wordCount: session.words.length,
            letterCount: metrics && metrics.letterCount != null ? metrics.letterCount : 0,
            durationMs: session.endedAt - session.startedAt,
            finalWpm: metrics && metrics.wpm != null ? metrics.wpm : 0,
            finalLpm: metrics && metrics.lpm != null ? metrics.lpm : 0
        };

        this.activeSession = null;
        this._save();
    },

    /**
     * Words from the current (in-progress) session for display.
     */
    getActiveWords() {
        if (!this.activeSession) return [];
        return this.activeSession.words.slice();
    },

    /**
     * Completed sessions (newest first), excluding the active session.
     */
    getPastSessions() {
        return this.sessions.filter(function (s) {
            return s.endedAt != null;
        });
    },

    /**
     * Clear all stored session history.
     */
    clearAll() {
        this.sessions = [];
        this.activeSession = null;
        localStorage.removeItem(this.STORAGE_KEY);
        if (typeof CVISettings !== 'undefined' && CVISettings.refreshWordHistoryIfOpen) {
            CVISettings.refreshWordHistoryIfOpen();
        }
    },

    _load() {
        var saved = localStorage.getItem(this.STORAGE_KEY);
        if (!saved) {
            this.sessions = [];
            return;
        }
        try {
            var data = JSON.parse(saved);
            this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
            this.activeSession = this.sessions.find(function (s) {
                return s.endedAt == null;
            }) || null;
        } catch (e) {
            this.sessions = [];
            this.activeSession = null;
        }
    },

    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                version: this.VERSION,
                sessions: this.sessions
            }));
        } catch (e) {
            console.error('Failed to save typing history:', e);
        }
    },

    _pruneSessions() {
        if (this.sessions.length <= this.MAX_SESSIONS) return;
        this.sessions = this.sessions.slice(0, this.MAX_SESSIONS);
    },

    _finalizeOrphanedSessions() {
        var orphaned = this.sessions.filter(function (s) {
            return s.endedAt == null;
        });
        for (var i = 0; i < orphaned.length; i++) {
            var session = orphaned[i];
            session.endedAt = session.words.length > 0
                ? session.words[session.words.length - 1].at
                : session.startedAt;
            var lastWord = session.words.length > 0 ? session.words[session.words.length - 1] : null;
            session.summary = {
                wordCount: session.words.length,
                letterCount: 0,
                durationMs: session.endedAt - session.startedAt,
                finalWpm: lastWord ? lastWord.wpm : 0,
                finalLpm: lastWord ? lastWord.lpm : 0
            };
        }
        this.activeSession = null;
        if (orphaned.length > 0) {
            this._save();
        }
    },

    _formatTime(ms) {
        return new Date(ms).toLocaleTimeString();
    },

    _formatDate(ms) {
        return new Date(ms).toLocaleString();
    },

    formatWordLine(entry) {
        if (typeof CVII18n !== 'undefined' && CVII18n.t) {
            return CVII18n.t('settingsPanel.labelsAndControls.historyWordLine', {
                time: this._formatTime(entry.at),
                word: entry.word,
                wpm: String(entry.wpm),
                lpm: String(entry.lpm)
            });
        }
        return this._formatTime(entry.at) + '  —  ' + entry.word +
            '  (WPM: ' + entry.wpm + ', LPM: ' + entry.lpm + ')';
    },

    formatSessionLabel(session) {
        var summary = session.summary || {};
        var name = session.studentName ? ' — ' + session.studentName : '';
        if (typeof CVII18n !== 'undefined' && CVII18n.t) {
            return CVII18n.t('settingsPanel.labelsAndControls.pastSessionOption', {
                date: this._formatDate(session.startedAt),
                words: String(summary.wordCount || session.words.length),
                wpm: String(summary.finalWpm || 0),
                lpm: String(summary.finalLpm || 0),
                name: name
            });
        }
        return this._formatDate(session.startedAt) + ' — ' +
            (summary.wordCount || session.words.length) + ' words — WPM: ' +
            (summary.finalWpm || 0) + ', LPM: ' + (summary.finalLpm || 0) + name;
    }
};
