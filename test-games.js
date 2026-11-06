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

try { fs.unlinkSync('./test-games-runner.js'); } catch (e) { /* ignore */ }

if (!allPassed) {
    console.error('\nSome skill game tests failed.');
    process.exit(1);
}
console.log('\nAll skill game tests passed.');
