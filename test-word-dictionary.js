const fs = require('fs');

const dictCode = fs.readFileSync('./js/word-dictionary.js', 'utf8')
    + '\nmodule.exports = CVIWordDictionary;';
fs.writeFileSync('./test-word-dictionary-runner.js', dictCode);

const CVIWordDictionary = require('./test-word-dictionary-runner.js');

async function run() {
    // Stub fetch for Node test environment
    global.fetch = async function () {
        var words = JSON.parse(fs.readFileSync('./data/english-words.json', 'utf8'));
        return {
            ok: true,
            json: async () => words
        };
    };

    await CVIWordDictionary.init();
    CVIWordDictionary.registerWord('charlie');

    const cases = [
        { word: 'cat', expect: true },
        { word: 'cats', expect: true },
        { word: 'apple', expect: true },
        { word: 'charlie', expect: true },
        { word: 'asdfgh', expect: false },
        { word: 'xqzpt', expect: false },
        { word: 'a', expect: false },
        { word: 'walked', expect: true }
    ];

    let allPassed = true;
    console.log('Running word dictionary tests...');
    for (const tc of cases) {
        const result = CVIWordDictionary.isRealWord(tc.word);
        const passed = result === tc.expect;
        console.log(`${passed ? '✅ PASS' : '❌ FAIL'} | '${tc.word}' => ${result} (expected ${tc.expect})`);
        if (!passed) allPassed = false;
    }

    process.exit(allPassed ? 0 : 1);
}

run().catch(function (err) {
    console.error(err);
    process.exit(1);
});
