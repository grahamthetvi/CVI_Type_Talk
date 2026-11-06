/**
 * CVI Type Talker - Game History
 * Persists Pop (mouse) and Arrows plays in localStorage for teacher review.
 * Drive is a typing game and stays in the typing history.
 */
const CVIGameHistory = {
    STORAGE_KEY: 'cvi-game-sessions',
    VERSION: 1,
    MAX_SESSIONS: 50,
    MAX_EVENTS: 400,

    sessions: [],
    activeSession: null,

    init() {
        this._load();
        this._finalizeOrphanedSessions();
    },

    /**
     * Begin a Pop or Arrows play. An in-progress play of the same game is kept.
     */
    startSession(game) {
        if (game !== 'pop' && game !== 'arrows') return;
        if (this.activeSession && this.activeSession.game === game) return;
        this.endSession();

        var studentName = '';
        if (typeof CVISettings !== 'undefined' && CVISettings.getSettings) {
            studentName = CVISettings.getSettings().studentName || '';
        }

        var now = this._now();
        this.activeSession = {
            id: now + '-' + Math.random().toString(36).slice(2, 8),
            game: game,
            startedAt: now,
            endedAt: null,
            studentName: studentName,
            lastSuccessAt: null,
            openSteps: 0,
            openDirections: { left: 0, right: 0, up: 0, down: 0 },
            trimmed: false,
            events: [],
            totals: this._freshTotals()
        };
        this.sessions.unshift(this.activeSession);
        this._pruneSessions();
        this._save();
    },

    /**
     * A click that landed on the Pop circle.
     * info: { diameter, moving, x, y, pointer }
     */
    recordPopHit(info) {
        var session = this.activeSession;
        if (!session || session.game !== 'pop') return;
        info = info || {};
        var now = this._now();
        var prev = session.lastSuccessAt != null ? session.lastSuccessAt : session.startedAt;
        var ms = now - prev;
        var totals = this._ensureTotals(session);
        totals.hits += 1;
        if (totals.firstHitMs == null) totals.firstHitMs = ms;
        if (info.moving) totals.movingHits += 1;
        this._pushSample(totals.hitGaps, ms);
        session.lastSuccessAt = now;
        this._push({
            kind: 'hit',
            at: now,
            ms: ms,
            n: totals.hits,
            diameter: this._diameter(info.diameter),
            moving: !!info.moving,
            x: this._ratio(info.x),
            y: this._ratio(info.y),
            pointer: this._pointer(info.pointer)
        });
    },

    /**
     * A click in the Pop field that missed the circle.
     * info: { x, y, pointer }
     */
    recordPopMiss(info) {
        var session = this.activeSession;
        if (!session || session.game !== 'pop') return;
        info = info || {};
        var totals = this._ensureTotals(session);
        totals.misses += 1;
        this._push({
            kind: 'miss',
            at: this._now(),
            x: this._ratio(info.x),
            y: this._ratio(info.y),
            pointer: this._pointer(info.pointer)
        });
    },

    /**
     * One arrow-key or on-screen pad press. input is 'key' or 'pad'.
     */
    recordArrowStep(dir, input) {
        var session = this.activeSession;
        if (!session || session.game !== 'arrows') return;
        if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') return;
        var source = input === 'pad' ? 'pad' : 'key';
        var totals = this._ensureTotals(session);
        totals.steps += 1;
        if (source === 'pad') totals.padSteps += 1;
        else totals.keySteps += 1;
        totals.directions[dir] += 1;
        session.openSteps = (session.openSteps || 0) + 1;
        if (!session.openDirections) {
            session.openDirections = { left: 0, right: 0, up: 0, down: 0 };
        }
        session.openDirections[dir] += 1;
        this._push({
            kind: 'step',
            at: this._now(),
            dir: dir,
            input: source
        });
    },

    /**
     * The arrow player reached the red ring. Counts presses since the previous goal.
     */
    recordArrowGoal() {
        var session = this.activeSession;
        if (!session || session.game !== 'arrows') return;
        var now = this._now();
        var prev = session.lastSuccessAt != null ? session.lastSuccessAt : session.startedAt;
        var totals = this._ensureTotals(session);
        totals.goals += 1;
        var steps = session.openSteps || 0;
        var dirs = session.openDirections || { left: 0, right: 0, up: 0, down: 0 };
        this._pushSample(totals.goalGaps, now - prev);
        this._pushSample(totals.goalSteps, steps);
        session.lastSuccessAt = now;
        session.openSteps = 0;
        session.openDirections = { left: 0, right: 0, up: 0, down: 0 };
        this._push({
            kind: 'goal',
            at: now,
            ms: now - prev,
            n: totals.goals,
            steps: steps,
            directions: {
                left: dirs.left || 0,
                right: dirs.right || 0,
                up: dirs.up || 0,
                down: dirs.down || 0
            }
        });
    },

    endSession() {
        if (!this.activeSession) return;
        this.activeSession.endedAt = this._now();
        this.activeSession = null;
        this._save();
        this._notify();
    },

    /**
     * Saved plays, newest first, including one that is still open.
     */
    getSessions() {
        return this.sessions.filter(function (session) {
            return session && (session.game === 'pop' || session.game === 'arrows');
        });
    },

    clearAll() {
        this.sessions = [];
        this.activeSession = null;
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (e) {
            console.error('Failed to clear game history:', e);
        }
        this._notify();
    },

    /**
     * Counts and timing for a play. Uses stored totals so a trimmed event log
     * still reports the full play.
     */
    summarize(session) {
        if (!session) return this._summaryFromTotals(this._emptySession());
        if (!session.totals) session.totals = this._totalsFromEvents(session);
        return this._summaryFromTotals(session);
    },

    median(values) {
        if (!values || !values.length) return null;
        var copy = values.slice().sort(function (a, b) { return a - b; });
        var mid = Math.floor(copy.length / 2);
        if (copy.length % 2) return copy[mid];
        return (copy[mid - 1] + copy[mid]) / 2;
    },

    formatSessionLabel(session) {
        var summary = this.summarize(session);
        var name = session.studentName ? ' — ' + session.studentName : '';
        var label;
        if (session.game === 'arrows') {
            label = this._t('settingsPanel.labelsAndControls.gameHistoryArrowOption', {
                date: this._formatDate(session.startedAt),
                game: this._gameName(session.game),
                goals: this._plural(summary.goals, 'gameHistoryGoalOne', 'gameHistoryGoals'),
                presses: this._plural(summary.steps, 'gameHistoryPressOne', 'gameHistoryPresses'),
                name: name
            });
        } else {
            label = this._t('settingsPanel.labelsAndControls.gameHistoryPopOption', {
                date: this._formatDate(session.startedAt),
                game: this._gameName(session.game),
                hits: this._plural(summary.hits, 'gameHistoryHitOne', 'gameHistoryHits'),
                misses: this._plural(summary.misses, 'gameHistoryMissOne', 'gameHistoryMisses'),
                name: name
            });
        }
        if (session.endedAt == null) {
            label += this._t('settingsPanel.labelsAndControls.gameHistoryInProgress');
        }
        return label;
    },

    formatDetail(session) {
        if (!session) return '';
        var summary = this.summarize(session);
        var lines = [];
        var game = this._gameName(session.game);
        if (session.game === 'arrows') {
            var dirs = summary.directions;
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryArrowSummary', {
                game: game,
                goals: this._plural(summary.goals, 'gameHistoryGoalOne', 'gameHistoryGoals'),
                presses: this._plural(summary.steps, 'gameHistoryPressOne', 'gameHistoryPresses'),
                duration: this._formatGap(summary.durationMs),
                medianPresses: this._pluralCount(summary.medianSteps, 'gameHistoryPressOne', 'gameHistoryPresses'),
                medianTime: this._formatGap(summary.medianGoalMs)
            }));
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryDirections', {
                left: String(dirs.left),
                right: String(dirs.right),
                up: String(dirs.up),
                down: String(dirs.down)
            }));
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryInput', {
                key: String(summary.keySteps),
                pad: String(summary.padSteps)
            }));
        } else {
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryPopSummary', {
                game: game,
                hits: this._plural(summary.hits, 'gameHistoryHitOne', 'gameHistoryHits'),
                misses: this._plural(summary.misses, 'gameHistoryMissOne', 'gameHistoryMisses'),
                percent: this._formatPercent(summary.hitPercent),
                duration: this._formatGap(summary.durationMs),
                first: this._formatGap(summary.firstHitMs),
                median: this._formatGap(summary.medianHitMs),
                moving: String(summary.movingHits)
            }));
        }
        if (session.trimmed) {
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryTrimmed'));
        }
        var events = session.events || [];
        for (var i = 0; i < events.length; i++) {
            var line = this._formatEvent(events[i]);
            if (line) lines.push(line);
        }
        if (session.game === 'arrows' && session.openSteps > 0) {
            var open = session.openDirections || { left: 0, right: 0, up: 0, down: 0 };
            lines.push(this._t('settingsPanel.labelsAndControls.gameHistoryTrailing', {
                presses: this._plural(session.openSteps, 'gameHistoryPressOne', 'gameHistoryPresses'),
                left: String(open.left || 0),
                right: String(open.right || 0),
                up: String(open.up || 0),
                down: String(open.down || 0)
            }));
        }
        return lines.join('\n');
    },

    _formatEvent(entry) {
        if (!entry || !entry.kind) return '';
        var time = this._formatTime(entry.at);
        if (entry.kind === 'hit') {
            return this._t('settingsPanel.labelsAndControls.gameHistoryHitLine', {
                time: time,
                n: String(entry.n || ''),
                size: entry.diameter == null ? this._none() : String(entry.diameter),
                motion: entry.moving
                    ? this._t('settingsPanel.labelsAndControls.gameHistoryMoving')
                    : this._t('settingsPanel.labelsAndControls.gameHistoryStill'),
                gap: this._formatGap(entry.ms),
                pointer: this._pointerLabel(entry.pointer),
                x: this._pct(entry.x),
                y: this._pct(entry.y)
            });
        }
        if (entry.kind === 'miss') {
            return this._t('settingsPanel.labelsAndControls.gameHistoryMissLine', {
                time: time,
                pointer: this._pointerLabel(entry.pointer),
                x: this._pct(entry.x),
                y: this._pct(entry.y)
            });
        }
        if (entry.kind === 'step') {
            return this._t('settingsPanel.labelsAndControls.gameHistoryStepLine', {
                time: time,
                dir: this._dirLabel(entry.dir),
                input: entry.input === 'pad'
                    ? this._t('settingsPanel.labelsAndControls.gameHistoryOnScreen')
                    : this._t('settingsPanel.labelsAndControls.gameHistoryPointerKey')
            });
        }
        if (entry.kind === 'goal') {
            var dirs = entry.directions || {};
            return this._t('settingsPanel.labelsAndControls.gameHistoryGoalLine', {
                time: time,
                n: String(entry.n || ''),
                presses: this._plural(entry.steps || 0, 'gameHistoryPressOne', 'gameHistoryPresses'),
                gap: this._formatGap(entry.ms),
                left: String(dirs.left || 0),
                right: String(dirs.right || 0),
                up: String(dirs.up || 0),
                down: String(dirs.down || 0)
            });
        }
        return '';
    },

    _emptySession() {
        return {
            game: 'pop',
            startedAt: 0,
            endedAt: 0,
            totals: this._freshTotals()
        };
    },

    _freshTotals() {
        return {
            hits: 0,
            misses: 0,
            goals: 0,
            steps: 0,
            keySteps: 0,
            padSteps: 0,
            movingHits: 0,
            firstHitMs: null,
            directions: { left: 0, right: 0, up: 0, down: 0 },
            hitGaps: [],
            goalGaps: [],
            goalSteps: []
        };
    },

    _ensureTotals(session) {
        if (!session.totals) session.totals = this._freshTotals();
        if (!session.totals.directions) {
            session.totals.directions = { left: 0, right: 0, up: 0, down: 0 };
        }
        if (!session.totals.hitGaps) session.totals.hitGaps = [];
        if (!session.totals.goalGaps) session.totals.goalGaps = [];
        if (!session.totals.goalSteps) session.totals.goalSteps = [];
        return session.totals;
    },

    _summaryFromTotals(session) {
        var totals = this._ensureTotals(session);
        var ended = session.endedAt != null ? session.endedAt : this._now();
        var attempts = totals.hits + totals.misses;
        var dirs = totals.directions;
        return {
            game: session.game,
            hits: totals.hits,
            misses: totals.misses,
            goals: totals.goals,
            steps: totals.steps,
            keySteps: totals.keySteps || 0,
            padSteps: totals.padSteps || 0,
            movingHits: totals.movingHits || 0,
            directions: {
                left: dirs.left || 0,
                right: dirs.right || 0,
                up: dirs.up || 0,
                down: dirs.down || 0
            },
            attempts: attempts,
            hitPercent: attempts === 0 ? null : Math.round((100 * totals.hits) / attempts),
            durationMs: Math.max(0, ended - session.startedAt),
            firstHitMs: totals.firstHitMs,
            medianHitMs: this.median(totals.hitGaps),
            medianGoalMs: this.median(totals.goalGaps),
            medianSteps: this.median(totals.goalSteps)
        };
    },

    _totalsFromEvents(session) {
        var totals = this._freshTotals();
        var events = session.events || [];
        var lastHit = null;
        for (var i = 0; i < events.length; i++) {
            var entry = events[i];
            if (!entry) continue;
            if (entry.kind === 'hit') {
                totals.hits += 1;
                if (entry.moving) totals.movingHits += 1;
                if (typeof entry.ms === 'number') {
                    if (totals.firstHitMs == null) totals.firstHitMs = entry.ms;
                    this._pushSample(totals.hitGaps, entry.ms);
                }
                lastHit = entry.at;
            } else if (entry.kind === 'miss') {
                totals.misses += 1;
            } else if (entry.kind === 'step') {
                totals.steps += 1;
                if (entry.input === 'pad') totals.padSteps += 1;
                else totals.keySteps += 1;
                if (totals.directions[entry.dir] != null) totals.directions[entry.dir] += 1;
            } else if (entry.kind === 'goal') {
                totals.goals += 1;
                if (typeof entry.ms === 'number') this._pushSample(totals.goalGaps, entry.ms);
                if (typeof entry.steps === 'number') this._pushSample(totals.goalSteps, entry.steps);
            }
        }
        if (session.lastSuccessAt == null && lastHit != null) session.lastSuccessAt = lastHit;
        return totals;
    },

    _push(event) {
        var session = this.activeSession;
        if (!session) return;
        session.events.push(event);
        if (session.events.length > this.MAX_EVENTS) {
            session.events.shift();
            session.trimmed = true;
        }
        this._save();
    },

    _pushSample(list, value) {
        list.push(value);
        if (list.length > this.MAX_EVENTS) list.shift();
    },

    _now() {
        return Date.now();
    },

    _ratio(value) {
        if (typeof value !== 'number' || !isFinite(value)) return null;
        var rounded = Math.round(value * 100) / 100;
        if (rounded < 0) return 0;
        if (rounded > 1) return 1;
        return rounded;
    },

    _diameter(value) {
        if (typeof value !== 'number' || !isFinite(value) || value <= 0) return null;
        return Math.round(value);
    },

    _pointer(value) {
        if (value === 'mouse' || value === 'touch' || value === 'pen' || value === 'key') return value;
        return 'unknown';
    },

    _pointerLabel(value) {
        if (value === 'mouse') return this._t('settingsPanel.labelsAndControls.gameHistoryPointerMouse');
        if (value === 'touch') return this._t('settingsPanel.labelsAndControls.gameHistoryPointerTouch');
        if (value === 'pen') return this._t('settingsPanel.labelsAndControls.gameHistoryPointerPen');
        if (value === 'key') return this._t('settingsPanel.labelsAndControls.gameHistoryPointerKey');
        return this._none();
    },

    _dirLabel(dir) {
        if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') {
            return this._t('games.pad.' + dir);
        }
        return dir || this._none();
    },

    _gameName(game) {
        if (game === 'pop') return this._t('games.menuPop');
        if (game === 'arrows') return this._t('games.menuArrows');
        return game || '';
    },

    _pct(ratio) {
        if (typeof ratio !== 'number' || !isFinite(ratio)) return this._none();
        return String(Math.round(ratio * 100));
    },

    _formatPercent(value) {
        if (value == null || !isFinite(value)) return this._none();
        return this._t('settingsPanel.labelsAndControls.gameHistoryPercent', { n: String(value) });
    },

    _plural(count, oneKey, manyKey) {
        var n = typeof count === 'number' && isFinite(count) ? count : 0;
        var key = n === 1 ? oneKey : manyKey;
        return this._t('settingsPanel.labelsAndControls.' + key, { n: String(n) });
    },

    _pluralCount(value, oneKey, manyKey) {
        if (value == null || !isFinite(value)) return this._none();
        var key = value === 1 ? oneKey : manyKey;
        return this._t('settingsPanel.labelsAndControls.' + key, { n: this._formatCount(value) });
    },

    _formatCount(value) {
        if (value == null || !isFinite(value)) return this._none();
        if (Math.round(value) === value) return String(value);
        return (Math.round(value * 10) / 10).toFixed(1);
    },

    _formatGap(ms) {
        if (ms == null || typeof ms !== 'number' || !isFinite(ms)) return this._none();
        if (ms < 0) ms = 0;
        if (ms < 10000) {
            var tenths = Math.round(ms / 100) / 10;
            return this._t('settingsPanel.labelsAndControls.gameHistorySeconds', { n: tenths.toFixed(1) });
        }
        var sec = Math.round(ms / 1000);
        if (sec < 60) {
            return this._t('settingsPanel.labelsAndControls.gameHistorySeconds', { n: String(sec) });
        }
        var minutes = Math.floor(sec / 60);
        var seconds = sec % 60;
        var secondText = (seconds < 10 ? '0' : '') + seconds;
        return this._t('settingsPanel.labelsAndControls.gameHistoryMinutes', {
            m: String(minutes),
            s: secondText
        });
    },

    _none() {
        return this._t('settingsPanel.labelsAndControls.gameHistoryNone');
    },

    _t(path, vars) {
        if (typeof CVII18n !== 'undefined' && CVII18n.t) return CVII18n.t(path, vars);
        return path;
    },

    _formatTime(ms) {
        return new Date(ms).toLocaleTimeString();
    },

    _formatDate(ms) {
        return new Date(ms).toLocaleString();
    },

    _notify() {
        if (typeof CVISettings !== 'undefined' && CVISettings.refreshGameHistoryIfOpen) {
            CVISettings.refreshGameHistoryIfOpen();
        }
    },

    _load() {
        var saved = null;
        try {
            saved = localStorage.getItem(this.STORAGE_KEY);
        } catch (e) {
            saved = null;
        }
        if (!saved) {
            this.sessions = [];
            this.activeSession = null;
            return;
        }
        try {
            var data = JSON.parse(saved);
            this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
        } catch (e) {
            this.sessions = [];
        }
        this.activeSession = null;
    },

    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                version: this.VERSION,
                sessions: this.sessions
            }));
        } catch (e) {
            console.error('Failed to save game history:', e);
        }
    },

    _pruneSessions() {
        if (this.sessions.length <= this.MAX_SESSIONS) return;
        this.sessions = this.sessions.slice(0, this.MAX_SESSIONS);
    },

    _finalizeOrphanedSessions() {
        var changed = false;
        for (var i = 0; i < this.sessions.length; i++) {
            var session = this.sessions[i];
            if (!session || session.endedAt != null) continue;
            var events = session.events || [];
            var last = events.length > 0 ? events[events.length - 1].at : session.startedAt;
            session.endedAt = last || session.startedAt;
            changed = true;
        }
        this.activeSession = null;
        if (changed) this._save();
    }
};
