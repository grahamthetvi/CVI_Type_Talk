/**
 * Unit tests for Pop and Arrows play history.
 * Run: node test-game-history.js
 */
const fs = require('fs');
const vm = require('vm');

const storage = {};
const en = JSON.parse(fs.readFileSync('./locales/en.json', 'utf8'));

function lookup(obj, keyPath) {
    return keyPath.split('.').reduce(function (current, key) {
        return current == null ? null : current[key];
    }, obj);
}

let clock = 1700000000000;
const notifies = [];

const context = {
    localStorage: {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
        },
        setItem(key, value) {
            storage[key] = String(value);
        },
        removeItem(key) {
            delete storage[key];
        }
    },
    Date: Date,
    Math: Math,
    console: console,
    CVII18n: {
        t(path, vars) {
            var text = lookup(en, path);
            if (typeof text !== 'string') return path;
            if (vars) {
                Object.keys(vars).forEach(function (key) {
                    text = text.split('{' + key + '}').join(String(vars[key]));
                });
            }
            return text;
        }
    },
    CVISettings: {
        getSettings() {
            return { studentName: 'Amina' };
        },
        refreshGameHistoryIfOpen() {
            notifies.push('refresh');
        }
    }
};

vm.createContext(context);
vm.runInContext(
    fs.readFileSync('./js/game-history.js', 'utf8') + '\nthis.CVIGameHistory = CVIGameHistory;',
    context
);

const history = context.CVIGameHistory;
history._now = function () {
    return clock;
};

function assert(condition, message) {
    if (!condition) throw new Error('FAIL: ' + message);
}

assert(history.median([]) === null, 'median of empty');
assert(history.median([2]) === 2, 'median of one');
assert(history.median([1, 3]) === 2, 'median of two');
assert(history.median([1, 2, 9]) === 2, 'median of three');

history.init();
assert(history.getSessions().length === 0, 'starts empty');

history.recordPopHit({ diameter: 10, x: 0.5, y: 0.5, pointer: 'mouse' });
assert(history.getSessions().length === 0, 'hit without a play is ignored');

history.startSession('drive');
assert(history.activeSession === null, 'drive is not a tracked game');

history.startSession('pop');
assert(history.activeSession.studentName === 'Amina', 'student name is copied');
assert(history.formatSessionLabel(history.activeSession).indexOf('Amina') !== -1, 'label names the student');
assert(history.formatSessionLabel(history.activeSession).indexOf('in progress') !== -1, 'open play is marked');

clock += 2000;
history.recordPopMiss({ x: 1.4, y: -0.2, pointer: 'touch' });
clock += 2000;
history.recordPopHit({ diameter: 160.4, moving: false, x: 0.5, y: 0.4, pointer: 'mouse' });
clock += 2000;
history.recordPopHit({ diameter: 140, moving: true, x: 0.2, y: 0.8, pointer: 'pen' });

let summary = history.summarize(history.activeSession);
assert(summary.hits === 2, 'two hits');
assert(summary.misses === 1, 'one miss');
assert(summary.hitPercent === 67, 'hit percent rounds');
assert(summary.firstHitMs === 4000, 'first hit counts from the start, not the miss');
assert(summary.medianHitMs === 3000, 'median gap of 4s and 2s');
assert(summary.movingHits === 1, 'moving hit counted');
assert(history.activeSession.events[0].x === 1 && history.activeSession.events[0].y === 0, 'miss point is clamped');
assert(history.activeSession.events[1].diameter === 160, 'diameter rounds to pixels');

history.recordArrowStep('left', 'key');
assert(history.activeSession.totals.steps === 0, 'arrow press is ignored during Pop');

const popDetail = history.formatDetail(history.activeSession);
assert(popDetail.indexOf('hit 1') !== -1, 'hit line');
assert(popDetail.indexOf('160px') !== -1, 'target size');
assert(popDetail.indexOf('still') !== -1, 'still target');
assert(popDetail.indexOf('moving') !== -1, 'moving target');
assert(popDetail.indexOf('mouse') !== -1, 'mouse pointer');
assert(popDetail.indexOf('miss') !== -1, 'miss line');
assert(popDetail.indexOf('67%') !== -1, 'percent in the summary');
assert(popDetail.indexOf('2 hits, 1 miss') !== -1, 'singular miss');

clock += 1000;
history.endSession();
assert(history.activeSession === null, 'play closed');
assert(notifies.length === 1, 'settings refresh once on close');
assert(history.getSessions()[0].endedAt != null, 'ended time stored');
assert(history.formatSessionLabel(history.getSessions()[0]).indexOf('in progress') === -1, 'closed play is not in progress');

clock += 500;
history.startSession('arrows');
history.recordArrowStep('left', 'key');
history.recordArrowStep('left', 'pad');
history.recordArrowStep('up', 'key');
history.recordArrowStep('sideways', 'key');
clock += 3000;
history.recordArrowStep('right', 'key');
history.recordArrowGoal();
history.recordArrowStep('down', 'pad');

summary = history.summarize(history.activeSession);
assert(summary.goals === 1, 'one goal');
assert(summary.steps === 5, 'invalid direction is ignored and the rest count');
assert(summary.medianSteps === 4, 'goal took four presses');
assert(summary.medianGoalMs === 3000, 'goal time');
assert(summary.keySteps === 3, 'keyboard presses');
assert(summary.padSteps === 2, 'on-screen presses');
assert(summary.directions.left === 2 && summary.directions.down === 1, 'direction totals');
assert(history.activeSession.openSteps === 1, 'press after the goal stays open');

const arrowDetail = history.formatDetail(history.activeSession);
assert(arrowDetail.indexOf('goal 1') !== -1, 'goal line');
assert(arrowDetail.indexOf('Left') !== -1, 'direction name');
assert(arrowDetail.indexOf('on-screen button') !== -1, 'pad source');
assert(arrowDetail.indexOf('keyboard') !== -1, 'keyboard source');
assert(arrowDetail.indexOf('Not yet at a goal: 1 press') !== -1, 'unfinished press');
assert(arrowDetail.indexOf('4 presses') !== -1, 'goal press count');

const arrowId = history.activeSession.id;
clock += 10;
history.startSession('pop');
assert(history.getSessions()[0].game === 'pop', 'new play is newest');
assert(history.getSessions().some(function (session) {
    return session.id === arrowId && session.endedAt != null;
}), 'starting another game closes the previous play');

history.recordPopHit({ diameter: 0, x: 'no', y: null, pointer: 'trackpad' });
assert(history.activeSession.events[0].pointer === 'unknown', 'unknown pointer');
assert(history.activeSession.events[0].diameter === null, 'missing size');
assert(history.activeSession.events[0].x === null, 'missing place');

history.MAX_EVENTS = 2;
history.recordPopHit({ diameter: 100, x: 0.1, y: 0.1, pointer: 'mouse' });
history.recordPopHit({ diameter: 100, x: 0.1, y: 0.1, pointer: 'mouse' });
assert(history.activeSession.events.length === 2, 'event log is capped');
assert(history.activeSession.trimmed === true, 'trimmed flag');
assert(history.activeSession.totals.hits === 3, 'totals keep every hit');
assert(history.formatDetail(history.activeSession).indexOf('Older events') !== -1, 'trim note');

const bare = history.summarize({
    game: 'pop',
    startedAt: clock,
    endedAt: clock + 1000,
    events: [
        { kind: 'hit', at: clock + 100, ms: 100, moving: false, n: 1 },
        { kind: 'miss', at: clock + 200 }
    ]
});
assert(bare.hits === 1 && bare.misses === 1 && bare.firstHitMs === 100, 'summary can be rebuilt from events');

history.MAX_SESSIONS = 2;
history.endSession();
history.startSession('pop');
history.endSession();
history.startSession('arrows');
history.endSession();
assert(history.getSessions().length === 2, 'only the newest plays are kept');

history.startSession('pop');
history.recordPopHit({ diameter: 80, x: 0.3, y: 0.3, pointer: 'key' });
history.activeSession = null;
history.init();
assert(history.activeSession === null, 'a reloaded play is not left open');
assert(history.getSessions()[0].endedAt != null, 'orphaned play is closed');
assert(history.summarize(history.getSessions()[0]).hits === 1, 'orphaned hit is kept');
assert(history.formatDetail(history.getSessions()[0]).indexOf('keyboard') !== -1, 'keyboard hit');

storage[history.STORAGE_KEY] = '{';
history.init();
assert(history.getSessions().length === 0, 'corrupt storage resets');

history.startSession('pop');
history.recordPopMiss({ x: 0.1, y: 0.2, pointer: 'mouse' });
history.clearAll();
assert(history.getSessions().length === 0, 'clear removes plays');
assert(storage[history.STORAGE_KEY] == null, 'clear removes storage');
assert(notifies.length > 1, 'clear refreshes settings');

console.log('All game history tests passed.');
