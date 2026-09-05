#!/usr/bin/env node
/**
 * One-off generator for bundled word data. Not required to run the app.
 *
 *   node scripts/build-word-lists.js
 *
 * Writes:
 *   data/english-words.json  — ~50k common English tokens (FrequencyWords)
 *   js/badwords.js           — profanity Set from LDNOOBWV2 (en, ar, es, fr)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');

const FREQ_URL =
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt';
const PROFANITY_BASE =
    'https://raw.githubusercontent.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2/main/data';
const PROFANITY_LANGS = ['en', 'ar', 'es', 'fr'];

/**
 * Common classroom / everyday words that over-broad lists sometimes flag.
 * Teachers can still block these via Settings → Blocked Words.
 */
const PROFANITY_ALLOWLIST = [
    'am', 'anita', 'glass', 'class', 'bass', 'scunthorpe',
    'chat', // French for "cat"; also English everyday word
    'con',  // Spanish for "with"
    'un', 'una', 'el', 'la', 'le', 'les', 'de', 'en', 'es', 'et', 'ou',
    'yo', 'tu', 'tú', 'me', 'you', 'moi', 'toi', 'vous'
];

function fetchText(url) {
    return new Promise(function (resolve, reject) {
        https.get(url, function (res) {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchText(res.headers.location).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(url + ' failed: ' + res.statusCode));
                res.resume();
                return;
            }
            var chunks = [];
            res.on('data', function (c) { chunks.push(c); });
            res.on('end', function () {
                resolve(Buffer.concat(chunks).toString('utf8'));
            });
        }).on('error', reject);
    });
}

function buildEnglishWords(text) {
    var seen = Object.create(null);
    var words = [];
    text.split(/\r?\n/).forEach(function (line) {
        var token = line.trim().split(/\s+/)[0];
        if (!token) return;
        token = token.toLowerCase();
        if (!/^[a-z]+$/.test(token)) return;
        if (token.length < 2) return;
        if (seen[token]) return;
        seen[token] = true;
        words.push(token);
    });
    words.sort();
    return words;
}

function parseProfanityFile(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
        var token = line.trim();
        if (!token || token.charAt(0) === '#') return;
        token = token.toLowerCase();
        if (/\s/.test(token)) return;
        if (token.length < 2) return;
        out.push(token);
    });
    return out;
}

function buildBadwordsModule(words) {
    var allow = Object.create(null);
    PROFANITY_ALLOWLIST.forEach(function (w) {
        allow[w.toLowerCase()] = true;
    });
    var unique = [];
    var seen = Object.create(null);
    words.forEach(function (w) {
        if (allow[w] || seen[w]) return;
        seen[w] = true;
        unique.push(w);
    });
    unique.sort(function (a, b) {
        return a.localeCompare(b, 'en');
    });

    var listLiteral = unique.map(function (w) {
        return '        ' + JSON.stringify(w);
    }).join(',\n');

    return [
        '/**',
        ' * CVI Type Talker - Profanity word list',
        ' * Generated from LDNOOBWV2 (en, ar, es, fr).',
        ' * Source: https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2',
        ' * Regenerate with: node scripts/build-word-lists.js',
        ' */',
        'const CVIBadWords = (function () {',
        '    const list = [',
        listLiteral,
        '    ];',
        '',
        '    const set = new Set(list.map(function (w) {',
        '        return String(w).toLowerCase().replace(/\\s+/g, \'\');',
        '    }));',
        '',
        '    function normalize(word) {',
        '        if (!word) return \'\';',
        '        return String(word).toLowerCase().replace(/\\s+/g, \'\');',
        '    }',
        '',
        '    return {',
        '        check: function (word) {',
        '            var n = normalize(word);',
        '            return n.length > 0 && set.has(n);',
        '        },',
        '        getList: function () {',
        '            return list.slice();',
        '        }',
        '    };',
        '})();',
        '',
        "if (typeof module !== 'undefined') module.exports = CVIBadWords;",
        ''
    ].join('\n');
}

async function main() {
    console.log('Fetching English frequency list…');
    var freqText = await fetchText(FREQ_URL);
    var english = buildEnglishWords(freqText);
    var wordsPath = path.join(ROOT, 'data', 'english-words.json');
    fs.writeFileSync(wordsPath, JSON.stringify(english));
    console.log('Wrote', english.length, 'words to', path.relative(ROOT, wordsPath));

    console.log('Fetching LDNOOBWV2 profanity lists…');
    var merged = [];
    for (var i = 0; i < PROFANITY_LANGS.length; i++) {
        var lang = PROFANITY_LANGS[i];
        var body = await fetchText(PROFANITY_BASE + '/' + lang + '.txt');
        var parsed = parseProfanityFile(body);
        console.log('  ', lang, parsed.length, 'tokens');
        merged = merged.concat(parsed);
    }

    var badwordsPath = path.join(ROOT, 'js', 'badwords.js');
    fs.writeFileSync(badwordsPath, buildBadwordsModule(merged));
    console.log('Wrote', badwordsPath);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
