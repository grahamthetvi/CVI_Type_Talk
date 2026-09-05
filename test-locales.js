const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'ar', 'es', 'fr'];

function shape(value) {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value && typeof value === 'object') {
        var out = {};
        Object.keys(value).sort().forEach(function (key) {
            out[key] = shape(value[key]);
        });
        return out;
    }
    return typeof value;
}

function loadLocale(code) {
    var file = path.join('locales', code + '.json');
    var raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
}

console.log('Running locale key-tree tests...');
var trees = {};
var failed = false;

LOCALES.forEach(function (code) {
    try {
        trees[code] = shape(loadLocale(code));
        console.log('✅ PASS | locales/' + code + '.json parsed');
    } catch (err) {
        failed = true;
        console.log('❌ FAIL | locales/' + code + '.json — ' + err.message);
    }
});

if (!failed) {
    var expected = JSON.stringify(trees.en);
    LOCALES.slice(1).forEach(function (code) {
        var actual = JSON.stringify(trees[code]);
        var passed = actual === expected;
        console.log((passed ? '✅ PASS' : '❌ FAIL') + ' | ' + code + ' key tree matches en');
        if (!passed) {
            failed = true;
        }
    });
}

if (failed) {
    process.exit(1);
}
console.log('All locale key-tree tests passed.');
