'use strict';
/* Characterization (golden-master) test for Solo and classic duel: AC13, AC18.
   The golden file was recorded from game.js BEFORE the duel-host-mode build. After the build the
   same scripted games must render byte-identical markup (sha256 prefix) at every checkpoint.
   The Settings screen is deliberately not hashed: it legitimately gains the host switches.
   Re-record only on purpose:  UPDATE_GOLDEN=1 node --test tests/classic-golden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, mulberry32, bfs, DIRS } = require('./harness');

const GOLDEN = path.join(__dirname, 'golden', 'classic.json');
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
const recorded = {};

function check(name, hashes) {
  recorded[name] = hashes;
  if (process.env.UPDATE_GOLDEN) return;
  assert.ok(golden[name], 'no golden for ' + name + ' - record with UPDATE_GOLDEN=1 on the pre-build game.js');
  assert.equal(hashes.length, golden[name].length, name + ': checkpoint count changed');
  hashes.forEach((h, i) => assert.equal(h, golden[name][i], name + ': markup changed at checkpoint ' + i));
}
test.after(() => {
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, JSON.stringify(Object.assign(golden, recorded), null, 1) + '\n');
});

/* click helper that records a checkpoint hash after every action */
function rec(g, hashes) { return (act, a, b) => { g.click(act, a, b); hashes.push(g.hash()); }; }

/* The duel entry works before and after the build. Before: `duel` starts classic at once.
   After: `duel` opens the chooser and `duelClassic` starts it (contract in tech-plan.md). */
function startClassicDuel(g, click, hashes) {
  g.click('duel'); // the chooser click is not a checkpoint: the pre-build `duel` started the duel and was exactly one
  if (g.hasControl('duelClassic')) click('duelClassic'); else hashes.push(g.hash());
}

const dirClick = { u: 'up', d: 'down', l: 'left', r: 'right' };
function exitDir(W) {
  const k = W.exitEdge[0], p = W.exitEdge.slice(2).split(',').map(Number);
  return k === 'v' ? (p[0] === 0 ? [-1, 0] : [1, 0]) : (p[1] === 0 ? [0, -1] : [0, 1]);
}
/* Player 1 fetches the chest and leaves, player 2 skips. Returns when the results screen shows. */
function playWin(g, c) {
  let guard = 0;
  while (g.peek().screen !== 'end' && guard++ < 600) {
    const p = g.peek();
    if (p.screen === 'handoff') { c('ready'); continue; }
    const D = p.D, S = p.S, W = p.W;
    if (D.turn === 1) { c('skip'); c('endTurn'); continue; }
    const target = S.carrying ? W.exitCell.split(',').map(Number) : D.tpos.split(',').map(Number);
    if (S.carrying && S.wpos[0] === target[0] && S.wpos[1] === target[1]) {
      const ed = exitDir(W);
      c(ed[0] === -1 ? 'left' : ed[0] === 1 ? 'right' : ed[1] === -1 ? 'up' : 'down');
      continue;
    }
    const path = bfs(W, S.wpos, target);
    if (!path || !path.length) { c('skip'); c('endTurn'); continue; }
    c(dirClick[path[0]]);
    if (g.peek().screen === 'game' && g.peek().S.acted) c('endTurn');
  }
}

test('solo: start, walk to the chest, take it, leave, results', () => {
  const g = loadGame({ seed: 1 });
  const h = [g.hash()], c = rec(g, h);
  c('new');
  const { W } = g.peek();
  const there = bfs(W, [0, 4], [5, 2]);
  assert.ok(there, 'solo path to chest');
  there.forEach((d) => c(dirClick[d]));
  assert.equal(g.peek().S.wpos.join(','), '5,2', 'scripted path lands on the chest cell');
  c('take');
  bfs(W, [5, 2], [0, 4]).forEach((d) => c(dirClick[d]));
  c('left'); // out through the exit edge v:0,4
  assert.equal(g.peek().screen, 'end');
  c('view', 'truth'); c('atlas'); c('menu');
  assert.equal(g.peek().screen, 'start');
  check('solo-win', h);
});

test('solo: wall bump, pit fall, match mode, settings, resume', () => {
  const g = loadGame({ seed: 2 });
  const h = [g.hash()], c = rec(g, h);
  c('new'); c('up'); c('up'); c('down');
  const { W } = g.peek();
  bfs(W, g.peek().S.wpos, [3, 1]).forEach((d) => c(dirClick[d]));
  c('match'); c('pick', 'f1'); c('right'); c('pin'); c('explore');
  g.click('pause'); h.push('settings-not-hashed');
  c('menu'); // «Выйти в меню» on the pause screen
  assert.equal(g.peek().screen, 'start');
  assert.ok(g.store['lab.save'], 'solo save kept after leaving to the menu');
  c('resume');
  check('solo-pit-match', h);
});

test('classic duel: seeded scripted turns (steps, aim+shot, dagger, skip)', () => {
  const g = loadGame({ seed: 7 });
  const h = [g.hash()], c = rec(g, h), rnd = mulberry32(99);
  startClassicDuel(g, c, h);
  assert.equal(g.peek().screen, 'handoff');
  assert.ok(!g.store['lab.save'], 'classic duel start clears the solo save, as before');
  for (let i = 0; i < 40; i++) {
    c('ready');
    const r = rnd(), d = Object.keys(DIRS)[Math.floor(rnd() * 4)];
    if (r < .55) c(dirClick[d]);
    else if (r < .75) { c('aim'); c(dirClick[d]); }
    else if (r < .85) c('dagger');
    else c('skip');
    if (g.peek().screen !== 'game') break;
    if (!g.peek().S.acted) c('skip');
    c('endTurn');
    if (g.peek().screen !== 'handoff') break;
  }
  if (g.peek().screen === 'handoff') c('ready');
  assert.equal(g.peek().screen, 'game');
  g.click('pause'); h.push('settings-not-hashed');
  c('back');
  check('duel-script', h);
});

test('classic duel: win run, results, player and view toggles', () => {
  const g = loadGame({ seed: 7 });
  const h = [g.hash()], c = rec(g, h);
  startClassicDuel(g, c, h);
  playWin(g, c);
  assert.equal(g.peek().screen, 'end', 'classic duel win scripted to the results screen');
  assert.equal(g.peek().D.winner, 0);
  c('player', 1); c('view', 'mine'); c('view', 'truth'); c('player', 0); c('menu');
  check('duel-win', h);
});

test('classic duel: Play again from results starts a new classic duel without a chooser (AC17)', () => {
  const g = loadGame({ seed: 7 });
  const hh = [], c = rec(g, hh);
  startClassicDuel(g, c, hh);
  playWin(g, c);
  assert.equal(g.peek().screen, 'end');
  g.click('duel'); // the results button of a classic duel
  assert.equal(g.peek().screen, 'handoff', 'classic Play again goes straight to the hand-off');
  assert.ok(!g.hasControl('duelClassic') && !g.hasControl('duelHost'), 'no chooser overlay');
});
