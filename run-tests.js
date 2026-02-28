const fs = require('fs');

// Read the js/badwords.js content
const badwordsCode = fs.readFileSync('./js/badwords.js', 'utf8');

// Evaluate the CVIBadWords module
const script = badwordsCode + '\nmodule.exports = CVIBadWords;';
fs.writeFileSync('./test-badwords.js', script);

const CVIBadWords = require('./test-badwords.js');

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
    { word: 'FUCK', expectBlocked: true }, // Case insensitivity check
    { word: 'f u c k', expectBlocked: true }
];

let allPassed = true;

console.log("Running profanity filter tests...");
for (const tc of testCases) {
    const isBlocked = CVIBadWords.check(tc.word);
    const passed = isBlocked === tc.expectBlocked;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | Word: '${tc.word}' | Blocked: ${isBlocked} (Expected: ${tc.expectBlocked})`);
    if (!passed) allPassed = false;
}

if (allPassed) {
    console.log("\nAll tests passed successfully!");
    process.exit(0);
} else {
    console.error("\nSome tests failed.");
    process.exit(1);
}
