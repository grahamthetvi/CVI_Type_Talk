/**
 * Unit tests for word recording flow (display -> keyboard -> typing history).
 * Run: node test-typing-history.js
 */
const fs = require('fs');
const vm = require('vm');

const storage = {};
const context = {
    localStorage: {
        getItem(k) { return storage[k] || null; },
        setItem(k, v) { storage[k] = v; },
        removeItem(k) { delete storage[k]; }
    },
    Date: Date,
    Math: Math,
    console: console
};
vm.createContext(context);

vm.runInContext(
    fs.readFileSync('./js/typing-history.js', 'utf8') + '\nthis.CVITypingHistory = CVITypingHistory;',
    context
);

const recorded = [];
const displayEl = { innerHTML: '', scrollTop: 0, scrollHeight: 0, appendChild() {} };
context.document = {
    getElementById(id) {
        if (id === 'text-display') return displayEl;
        if (id === 'status-text') return { textContent: '' };
        return null;
    },
    createElement() {
        return {
            id: '', className: '', textContent: '', innerHTML: '',
            setAttribute() {}, appendChild() {}, style: {}
        };
    },
    createTextNode(text) { return { textContent: text }; }
};
context.CVII18n = { t(key) { return key; } };
context.CVISettings = { refreshWordHistoryIfOpen() {} };
context.CVIKeyboard = {
    sessionStartTime: Date.now(),
    letterCount: 0,
    wordCount: 0,
    getWPM() { return this.wordCount * 10; },
    getLPM() { return this.letterCount * 5; },
    recordWord(word) {
        this.wordCount++;
        context.CVITypingHistory.recordWord(word, {
            wpm: this.getWPM(),
            lpm: this.getLPM(),
            letterCount: this.letterCount
        });
        recorded.push(word);
    }
};

vm.runInContext(
    fs.readFileSync('./js/display.js', 'utf8') + '\nthis.CVIDisplay = CVIDisplay;',
    context
);

const CVIDisplay = context.CVIDisplay;
const CVITypingHistory = context.CVITypingHistory;

CVIDisplay.init();
CVITypingHistory.init();
CVITypingHistory.startSession();

function assert(cond, msg) {
    if (!cond) throw new Error('FAIL: ' + msg);
}

CVIDisplay.currentText = 'hello';
assert(CVIDisplay.handleSpace() === 'hello', 'handleSpace returns word');
assert(recorded.length === 1 && recorded[0] === 'hello', 'space records word');

CVIDisplay.currentText = 'world';
assert(CVIDisplay.commitLine() === 'world', 'commitLine returns word');
assert(recorded.length === 2 && recorded[1] === 'world', 'enter records word');

CVIDisplay.currentText = 'partial';
CVIDisplay.startTeacherMode('target');
assert(recorded.length === 3 && recorded[2] === 'partial', 'startTeacherMode records partial word');

CVIDisplay.targetWord = 'cat';
CVIDisplay.currentText = 'cat';
CVIDisplay.commitLine();
assert(recorded.length === 4 && recorded[3] === 'cat', 'teacher commitLine records word');

const before = recorded.length;
CVIDisplay.currentText = '   ';
CVIDisplay.commitLine();
CVIDisplay.handleSpace();
assert(recorded.length === before, 'whitespace-only not recorded');

const saved = JSON.parse(storage['cvi-typing-sessions']);
assert(saved.sessions[0].words.length === 4, 'four words persisted');
assert(saved.sessions[0].words[0].word === 'hello', 'first persisted word correct');
assert(saved.sessions[0].words[0].wpm === 10, 'wpm snapshot stored');

console.log('All word recording tests passed.');
