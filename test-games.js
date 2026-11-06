const fs = require('fs');

const code = fs.readFileSync('./js/games.js', 'utf8') + '\nmodule.exports = CVIGames;';
fs.writeFileSync('./test-games-runner.js', code);
const CVIGames = require('./test-games-runner.js');

function check(name, actual, expected) {
    const passed = actual === expected;
    console.log((passed ? '✅ PASS' : '❌ FAIL') + ' | ' + name + ' => ' + actual + ' (expected ' + expected + ')');
    return passed;
}

let allPassed = true;

const words = [
    ['car', 'car'],
    ['CAR', 'car'],
    ['  Van ', 'van'],
    ['SUV', 'suv'],
    ['suvs', 'suv'],
    ['cars', 'car'],
    ['coche', 'car'],
    ['camion', 'truck'],
    ['camión', 'truck'],
    ['furgoneta', 'van'],
    ['fourgonnette', 'van'],
    ['voiture', 'car'],
    ['todoterreno', 'suv'],
    ['جيب', 'suv'],
    ['سيارة', 'car'],
    ['شاحنة', 'truck'],
    ['فان', 'van'],
    ['cartoon', null],
    ['cat', null],
    ['bus', null],
    ['', null]
];

console.log('Running skill game tests...');
words.forEach(function (pair) {
    if (!check('vehicle ' + JSON.stringify(pair[0]), CVIGames.vehicleForWord(pair[0]), pair[1])) {
        allPassed = false;
    }
});

global.CVII18n = {
    t: function (path) {
        if (path === 'games.vehicles.car') return 'buggy';
        return path;
    }
};
if (!check('locale label buggy', CVIGames.vehicleForWord('buggy'), 'car')) allPassed = false;
if (!check('locale label does not steal truck', CVIGames.vehicleForWord('truck'), 'truck')) allPassed = false;
delete global.CVII18n;

if (!check('lane left', CVIGames.laneFromRatio(0.1), 0)) allPassed = false;
if (!check('lane middle', CVIGames.laneFromRatio(0.5), 1)) allPassed = false;
if (!check('lane right', CVIGames.laneFromRatio(0.9), 2)) allPassed = false;
if (!check('lane edge', CVIGames.laneFromRatio(1), 2)) allPassed = false;

if (!check('light catch', CVIGames.catchesLight(80, 1, 1), true)) allPassed = false;
if (!check('light early', CVIGames.catchesLight(67, 1, 1), false)) allPassed = false;
if (!check('light other lane', CVIGames.catchesLight(80, 0, 1), false)) allPassed = false;

if (!check('goal reached', CVIGames.reachedGoal(0.5, 0.5, 0.55, 0.5), true)) allPassed = false;
if (!check('goal far', CVIGames.reachedGoal(0.1, 0.1, 0.8, 0.8), false)) allPassed = false;

if (!check('pop large', CVIGames.popDiameter(0, 400) >= 160, true)) allPassed = false;
if (!check('pop min', CVIGames.popDiameter(20, 100) >= 140, true)) allPassed = false;
if (!check('pop shrinks', CVIGames.popDiameter(8, 500) < CVIGames.popDiameter(0, 500), true)) allPassed = false;

var defaults = CVIGames.typingAppearance(null);
if (!check('typed default size', defaults.fontSize, '60px')) allPassed = false;
if (!check('typed default color', defaults.color, '#000000')) allPassed = false;
if (!check('typed default background', defaults.backgroundColor, '#000000')) allPassed = false;
if (!check('typed default bubble', defaults.bubble, true)) allPassed = false;
if (!check('typed default bubble color', defaults.bubbleColor, '#FF0000')) allPassed = false;
if (!check('typed default outline', defaults.textShadow.indexOf('-4px -4px 0 #FF0000') === 0, true)) allPassed = false;

var custom = CVIGames.typingAppearance({
    fontFamily: 'Georgia, serif',
    fontSize: 120,
    fontColor: '#FFFF00',
    backgroundColor: '#0000FF',
    bubbleLettersEnabled: false
});
if (!check('typed custom family', custom.fontFamily, 'Georgia, serif')) allPassed = false;
if (!check('typed custom size', custom.fontSize, '120px')) allPassed = false;
if (!check('typed custom color', custom.color, '#FFFF00')) allPassed = false;
if (!check('typed custom background', custom.backgroundColor, '#0000FF')) allPassed = false;
if (!check('typed custom bubble off', custom.bubble, false)) allPassed = false;
if (!check('typed custom no outline', custom.textShadow, 'none')) allPassed = false;

var outline = CVIGames.bubbleTextShadow(1, '#FF0000');
var expectedOutline = [
    '-1px -1px 0 #FF0000',
    '-1px 0px 0 #FF0000',
    '-1px 1px 0 #FF0000',
    '0px -1px 0 #FF0000',
    '0px 1px 0 #FF0000',
    '1px -1px 0 #FF0000',
    '1px 0px 0 #FF0000',
    '1px 1px 0 #FF0000'
].join(', ');
if (!check('bubble outline', outline, expectedOutline)) allPassed = false;
if (!check('bubble size stops at setting', CVIGames.bubbleTextShadow(2, '#FFFFFF').indexOf('3px') === -1, true)) allPassed = false;

try { fs.unlinkSync('./test-games-runner.js'); } catch (e) { /* ignore */ }

if (!allPassed) {
    console.error('\nSome skill game tests failed.');
    process.exit(1);
}
console.log('\nAll skill game tests passed.');
