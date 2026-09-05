const CVIBadWords = require('./js/badwords.js');

const testCases = [
    { word: 'glass', expectBlocked: false },
    { word: 'class', expectBlocked: false },
    { word: 'ass', expectBlocked: true },
    { word: 'asshole', expectBlocked: true },
    { word: 'cunt', expectBlocked: true },
    { word: 'scunthorpe', expectBlocked: false },
    { word: 'sex', expectBlocked: true },
    { word: 'penis', expectBlocked: true },
    { word: 'bass', expectBlocked: false },
    { word: 'hello', expectBlocked: false },
    { word: 'fuck', expectBlocked: true },
    { word: 'fucking', expectBlocked: true },
    { word: 'FUCK', expectBlocked: true },
    { word: 'f u c k', expectBlocked: true },
    { word: 'am', expectBlocked: false },
    { word: 'anita', expectBlocked: false },
    { word: 'chat', expectBlocked: false },
    { word: 'con', expectBlocked: false },
    { word: 'gato', expectBlocked: false },
    { word: 'puta', expectBlocked: true },
    { word: 'putain', expectBlocked: true },
    { word: 'merde', expectBlocked: true },
    { word: 'كس', expectBlocked: true },
    { word: 'زب', expectBlocked: true }
];

let allPassed = true;

console.log('Running profanity filter tests...');
for (const tc of testCases) {
    const isBlocked = CVIBadWords.check(tc.word);
    const passed = isBlocked === tc.expectBlocked;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | Word: '${tc.word}' | Blocked: ${isBlocked} (Expected: ${tc.expectBlocked})`);
    if (!passed) allPassed = false;
}

if (!allPassed) {
    console.error('\nSome profanity filter tests failed.');
    process.exit(1);
}

console.log('\nAll profanity filter tests passed.');

function run(name, file) {
    console.log('\nRunning ' + name + '...');
    const result = require('child_process').spawnSync('node', [file], { stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

run('word dictionary tests', 'test-word-dictionary.js');
run('locale key-tree tests', 'test-locales.js');
