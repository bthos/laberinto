'use strict';
/* AC2, AC12 and the information-hiding invariant: the public line is the only channel.
   Pure: no DOM, no speech. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../host.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const GAME = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const CYR = /[А-Яа-яЁё]/;

/* event id -> [params, exact ru line]. Wording fixed here (spec D9, ux-design samples). */
const LINES = [
  ['start', { p1cell: 'empty', p2cell: 'arsenal', first: 1 }, 'Игра началась. Игрок 1 стоит в клетке: пустая клетка. Игрок 2 стоит в клетке: арсенал. Первым ходит игрок 1.'],
  ['start', { p1cell: 'hospital', p2cell: 'empty', first: 2 }, 'Игра началась. Игрок 1 стоит в клетке: госпиталь. Игрок 2 стоит в клетке: пустая клетка. Первым ходит игрок 2.'],
  ['step', { p: 1, dir: 'r', cell: 'empty' }, 'Игрок 1: вправо — пустая клетка.'],
  ['step', { p: 2, dir: 'l', cell: 'arsenal' }, 'Игрок 2: влево — арсенал.'],
  ['step', { p: 1, dir: 'd', cell: 'hospital' }, 'Игрок 1: вниз — госпиталь.'],
  ['step', { p: 1, dir: 'u', cell: 'exit' }, 'Игрок 1: вверх — выход.'],
  ['step.healed', { p: 1, dir: 'd' }, 'Игрок 1: вниз — госпиталь, раны залечены.'],
  ['step.wall', { p: 1, dir: 'u' }, 'Игрок 1: вверх — стена.'],
  ['step.wall.pit', { p: 2, dir: 'r' }, 'Игрок 2: вправо — стена. Провалился.'],
  ['step.pit', { p: 2, dir: 'l' }, 'Игрок 2: влево — яма! Провалился.'],
  ['step.treasure', { p: 2 }, 'Игрок 2: клад — теперь он у него.'],
  ['step.treasure.wounded', { p: 1 }, 'Игрок 1: клад — но он ранен и унести его не может.'],
  ['step.exit.blocked', { p: 1, dir: 'l' }, 'Игрок 1: влево — выход. Без клада уходить рано.'],
  ['shot.hit', { p: 1, dir: 'r', o: 2 }, 'Игрок 1 стреляет вправо — попал, игрок 2 ранен.'],
  ['shot.hit.drop', { p: 2, dir: 'u', o: 1 }, 'Игрок 2 стреляет вверх — попал, игрок 1 ранен и выронил клад.'],
  ['shot.miss', { p: 1, dir: 'r' }, 'Игрок 1 стреляет вправо — мимо.'],
  ['dagger.hit', { p: 1, o: 2 }, 'Игрок 1 бьёт кинжалом — попал, игрок 2 ранен.'],
  ['dagger.hit.drop', { p: 2, o: 1 }, 'Игрок 2 бьёт кинжалом — попал, игрок 1 ранен и выронил клад.'],
  ['dagger.miss', { p: 1 }, 'Игрок 1 бьёт кинжалом — мимо.'],
  ['skip', { p: 1 }, 'Игрок 1 пропускает ход.'],
  ['skip.pit', { p: 2 }, 'Игрок 2 пропускает ход. Провалился.'],
  ['win', { p: 1 }, 'Игрок 1 вышел из лабиринта с кладом. Победил игрок 1!'],
  ['turn', { p: 2 }, 'Ход игрока 2.']
];

test('every host event renders the agreed Russian wording (AC1, D9)', () => {
  LINES.forEach(([id, params, want]) => assert.equal(H.hostLine(id, params), want, id));
});

test('catalogue covers exactly the events the game can raise', () => {
  const ids = new Set(LINES.map((l) => l[0]));
  assert.deepEqual([...ids].sort(), Object.keys(H.PARAMS).sort());
});

test('information hiding: no event can receive a pit index, coordinates or the treasure position (AC2)', () => {
  const allowed = new Set(['p', 'o', 'first', 'dir', 'cell', 'p1cell', 'p2cell']);
  Object.entries(H.PARAMS).forEach(([id, names]) => names.forEach((n) => assert.ok(allowed.has(n), id + ' takes forbidden param ' + n)));
  const forbidden = /pit|index|idx|coord|^x$|^y$|pos|treasure|tpos|world|map/i;
  Object.values(H.PARAMS).flat().forEach((n) => assert.ok(!forbidden.test(n), 'param name ' + n));
});

test('hostLine rejects params outside the declared set, outside their domain, or missing', () => {
  assert.throws(() => H.hostLine('step', { p: 1, dir: 'r', cell: 'empty', x: 3 }), /param/i);
  assert.throws(() => H.hostLine('step', { p: 1, dir: 'r', cell: 'empty', pit: 2 }), /param/i);
  assert.throws(() => H.hostLine('step', { p: 3, dir: 'r', cell: 'empty' }), /p/);
  assert.throws(() => H.hostLine('step', { p: 1, dir: 'east', cell: 'empty' }), /dir/);
  assert.throws(() => H.hostLine('step', { p: 1, dir: 'r', cell: '3,4' }), /cell/);
  assert.throws(() => H.hostLine('step', { p: 1, dir: 'r' }), /cell/);
  assert.throws(() => H.hostLine('nope', {}), /event/i);
});

test('public lines contain no digit except player numbers', () => {
  LINES.forEach(([id, params]) => {
    const rest = H.hostLine(id, params).replace(/игрок(а)? [12]/gi, '');
    assert.ok(!/\d/.test(rest), id + ': ' + rest);
  });
});

test('composeLine appends the spoken turn phrase only when asked (AC20, Q11: same log line)', () => {
  assert.equal(H.composeLine('Игрок 1: вправо — пустая клетка.', 2, true), 'Игрок 1: вправо — пустая клетка. Ход игрока 2.');
  assert.equal(H.composeLine('Игрок 1: вправо — пустая клетка.', 2, false), 'Игрок 1: вправо — пустая клетка.');
});

test('plural forms of grammar-bearing words live in the catalogue (AC12)', () => {
  const b = (n) => H.t('ui.bullets', { n }), d = (n) => H.t('ui.daggers', { n });
  assert.deepEqual([0, 1, 2, 4, 5, 11, 12, 21, 22, 25].map(b), ['0 пуль', '1 пуля', '2 пули', '4 пули', '5 пуль', '11 пуль', '12 пуль', '21 пуля', '22 пули', '25 пуль']);
  assert.deepEqual([1, 2, 5, 11, 21].map(d), ['1 кинжал', '2 кинжала', '5 кинжалов', '11 кинжалов', '21 кинжал']);
});

test('t(): unknown key and missing param throw; params are substituted', () => {
  assert.throws(() => H.t('ui.no.such.key'), /key/i);
  assert.throws(() => H.t('ui.turn.banner'), /p/);
  assert.equal(H.t('ui.turn.banner', { p: 2 }), 'Ход игрока 2');
});

test('contract keys the UI needs exist in the ru catalogue', () => {
  const keys = ['ui.chooser.title', 'ui.chooser.host.title', 'ui.chooser.host.sub', 'ui.chooser.classic.title', 'ui.chooser.classic.sub', 'ui.chooser.cancel',
    'ui.intro.eyebrow', 'ui.intro.title', 'ui.intro.body', 'ui.intro.start', 'ui.intro.voiceOk', 'ui.notice.noVoice', 'ui.speaking',
    'ui.turn.banner', 'ui.status.healthy', 'ui.status.wounded', 'ui.status.carrying', 'ui.status.woundedNoTreasure',
    'ui.reason.wounded', 'ui.reason.noBullets', 'ui.reason.noDaggers',
    'ui.notice.wounded', 'ui.notice.noBullets', 'ui.notice.noDaggers',
    'ui.btn.repeat', 'ui.btn.shoot', 'ui.btn.dagger', 'ui.btn.skip', 'ui.btn.results', 'ui.btn.again', 'ui.btn.menu',
    'ui.end.eyebrow', 'ui.end.winner', 'ui.end.tab.map', 'ui.end.tab.log', 'ui.end.mapLabel',
    'ui.set.title', 'ui.set.voice', 'ui.set.voice.sub', 'ui.set.settle', 'ui.set.settle.sub', 'ui.set.speakTurn', 'ui.set.speakTurn.sub', 'ui.set.keys',
    'ui.set.status.found', 'ui.set.status.fallback', 'ui.set.status.none'];
  const params = { p: 1, n: 2, lang: 'en', a: 1, b: 2 };
  keys.forEach((k) => assert.doesNotThrow(() => H.t(k, params), k));
});

test('settings defaults are additive: voice on, settle on, speakTurn off (AC13)', () => {
  assert.deepEqual({ ...H.DEFAULT_SETTINGS }, { voice: true, settle: true, speakTurn: false });
  assert.equal(H.SETTLE_MS, 300);
});

test('AC12: no Cyrillic in host.js outside the catalogue block', () => {
  const a = SRC.indexOf('/* catalogue:start */'), b = SRC.indexOf('/* catalogue:end */');
  assert.ok(a >= 0 && b > a, 'host.js must fence the catalogue with /* catalogue:start */ ... /* catalogue:end */');
  const outside = SRC.slice(0, a) + SRC.slice(b);
  assert.ok(!CYR.test(outside), 'Cyrillic outside the catalogue: ' + (outside.match(/.*[А-Яа-яЁё].*/) || [''])[0].trim());
});

test('AC12: no Cyrillic in the host section of game.js; every t(...) key exists', () => {
  const a = GAME.indexOf('/* host:start */'), b = GAME.indexOf('/* host:end */');
  assert.ok(a >= 0 && b > a, 'game.js must fence host-mode code with /* host:start */ ... /* host:end */');
  const sec = GAME.slice(a, b);
  assert.ok(!CYR.test(sec), 'Cyrillic in the host section: ' + (sec.match(/.*[А-Яа-яЁё].*/) || [''])[0].trim().slice(0, 100));
  const keys = [...sec.matchAll(/\bt\('([^']+)'\s*[,)]/g)].map((m) => m[1]);
  assert.ok(keys.length > 10, 'the host section should render through t(...)');
  keys.forEach((k) => assert.ok(Object.prototype.hasOwnProperty.call(H.catalogue.ru, k), 'unknown catalogue key in game.js: ' + k));
});
