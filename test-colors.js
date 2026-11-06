const CVIColors = require('./js/colors.js');

const cases = [
    { word: 'red', locale: 'en', expect: '#FF0000' },
    { word: 'RED', locale: 'en', expect: '#FF0000' },
    { word: 'grey', locale: 'en', expect: '#808080' },
    { word: 'gray', locale: 'en', expect: '#808080' },
    { word: 'cat', locale: 'en', expect: null },
    { word: 'rojo', locale: 'en', expect: null },
    { word: 'rose', locale: 'en', expect: null },
    { word: 'café', locale: 'en', expect: null },
    { word: 'rojo', locale: 'es', expect: '#FF0000' },
    { word: 'Marrón', locale: 'es', expect: '#A52A2A' },
    { word: 'café', locale: 'es', expect: '#A52A2A' },
    { word: 'púrpura', locale: 'es', expect: '#800080' },
    { word: 'red', locale: 'es', expect: '#FF0000' },
    { word: 'bleu', locale: 'fr', expect: '#0000FF' },
    { word: 'bleue', locale: 'fr', expect: '#0000FF' },
    { word: 'rose', locale: 'fr', expect: '#FFC0CB' },
    { word: 'verte', locale: 'fr', expect: '#00FF00' },
    { word: 'yellow', locale: 'fr', expect: '#FFFF00' },
    { word: 'أحمر', locale: 'ar', expect: '#FF0000' },
    { word: 'حمراء', locale: 'ar', expect: '#FF0000' },
    { word: 'أزرق', locale: 'ar', expect: '#0000FF' },
    { word: 'ازرق', locale: 'ar', expect: '#0000FF' },
    { word: 'blue', locale: 'ar', expect: '#0000FF' },
    { word: 'قطة', locale: 'ar', expect: null },
    { word: '', locale: 'en', expect: null },
    { word: '   ', locale: 'en', expect: null }
];

let failed = false;

console.log('Running color word tests...');
cases.forEach(function (tc) {
    const actual = CVIColors.lookup(tc.word, tc.locale);
    const passed = actual === tc.expect;
    console.log((passed ? '✅ PASS' : '❌ FAIL')
        + ' | ' + tc.locale + ' "' + tc.word + '" → ' + actual
        + ' (expected ' + tc.expect + ')');
    if (!passed) failed = true;
});

function expectHex(name, actual, expected) {
    const passed = actual === expected;
    console.log((passed ? '✅ PASS' : '❌ FAIL') + ' | ' + name + ' → ' + actual + ' (expected ' + expected + ')');
    if (!passed) failed = true;
}

expectHex(
    'last color on the current line is ignored until space',
    CVIColors.lastCommittedHex(['red cat'], 'blue', 'en'),
    '#FF0000'
);
expectHex(
    'space finishes the color word',
    CVIColors.lastCommittedHex([], 'blue ', 'en'),
    '#0000FF'
);
expectHex(
    'later color replaces the earlier one',
    CVIColors.lastCommittedHex(['yellow'], 'green ', 'en'),
    '#00FF00'
);
expectHex(
    'no color word',
    CVIColors.lastCommittedHex(['cat'], 'dog', 'en'),
    null
);
expectHex(
    'spanish color is ignored in english',
    CVIColors.lastCommittedHex(['rojo '], '', 'en'),
    null
);
expectHex(
    'spanish color counts in spanish',
    CVIColors.lastCommittedHex(['rojo '], '', 'es'),
    '#FF0000'
);

const yellowText = CVIColors.readableText('#FFFF00');
const blueText = CVIColors.readableText('#0000FF');
expectHex('yellow screen uses dark text', yellowText, '#000000');
expectHex('blue screen uses light text', blueText, '#FFFFFF');

const keepYellow = CVIColors.textOn('#0000FF', '#FFFF00');
expectHex('yellow font stays on blue', keepYellow, '#FFFF00');
const swapRed = CVIColors.textOn('#FF0000', '#FF0000');
expectHex('red font on red screen switches to the higher-contrast color', swapRed, '#000000');

if (CVIColors.contrastRatio('#000000', '#FFFFFF') < 20) {
    console.log('❌ FAIL | black/white contrast should be about 21');
    failed = true;
} else {
    console.log('✅ PASS | black/white contrast is high');
}

if (failed) {
    console.error('\nSome color word tests failed.');
    process.exit(1);
}
console.log('\nAll color word tests passed.');
