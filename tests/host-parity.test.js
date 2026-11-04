'use strict';
/* D7: the rules are shared. Differential test: the same random action script is played on the REAL classic
   duel in game.js (through clicks) and on the new host rules engine over the SAME world. After every
   accepted action the two must agree on positions, wounds, ammo, treasure and winner; rejections must agree. */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../host.js');
const { loadGame, mulberry32 } = require('./harness');

const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const clickName = { u: 'up', d: 'down', l: 'left', r: 'right' };

function playOne(seed, stats) {
  const g = loadGame({ seed });
  g.click('duel'); if (g.hasControl('duelClassic')) g.click('duelClassic');
  const D0 = g.peek().D;
  const hm = H.createMatch(g.peek().W, [D0.players[0].wpos.slice(), D0.players[1].wpos.slice()]);
  const rnd = mulberry32(seed * 7919);
  /* Random walks rarely meet, so every 10 turns put both players on shared rows/columns with full ammo,
     on BOTH sides (the peeked classic state is the real game state), to exercise hits, wounds and drops. */
  const reposition = () => {
    const x1 = Math.floor(rnd() * 6), y1 = Math.floor(rnd() * 6), r = rnd();
    const x2 = r < .4 ? x1 : Math.floor(rnd() * 6), y2 = r < .4 ? Math.floor(rnd() * 6) : r < .8 ? y1 : Math.floor(rnd() * 6);
    [[x1, y1], [x2, y2]].forEach((c, i) => {
      const cp = g.peek().D.players[i], hp = hm.players[i];
      cp.wpos = c.slice(); hp.pos = c.slice();
      cp.bullets = hp.bullets = 3; cp.daggers = hp.daggers = 3;
    });
  };
  for (let turn = 0; turn < 150; turn++) {
    if (g.peek().screen === 'handoff') g.click('ready');
    if (turn % 10 === 0) reposition();
    let guard = 0;
    for (;;) { // one turn: retry after rejections, which do not spend it
      assert.ok(guard++ < 20, 'seed ' + seed + ': stuck retrying rejections');
      const r = rnd(), dk = Object.keys(DIRS)[Math.floor(rnd() * 4)], dv = DIRS[dk];
      let a;
      if (r < .55) a = { type: 'step', dx: dv[0], dy: dv[1] };
      else if (r < .75) a = { type: 'shoot', dx: dv[0], dy: dv[1] };
      else if (r < .87) a = { type: 'dagger' };
      else a = { type: 'skip' };
      if (a.type === 'step') g.click(clickName[dk]);
      else if (a.type === 'shoot') { g.click('aim'); g.click(clickName[dk]); }
      else g.click(a.type);
      const cs = g.peek(), spent = cs.screen === 'end' || cs.S.acted;
      const hr = H.applyAction(hm, a);
      assert.equal(hr.ok, spent, 'seed ' + seed + ' turn ' + turn + ': acceptance differs for ' + JSON.stringify(a) + ' host=' + JSON.stringify(hr));
      if (!hr.ok) { stats.rejected++; continue; }
      stats[hr.event.id] = (stats[hr.event.id] || 0) + 1;
      for (let i = 0; i < 2; i++) {
        const cp = cs.D.players[i], hp = hm.players[i];
        const ctx = 'seed ' + seed + ' turn ' + turn + ' p' + (i + 1) + ' after ' + JSON.stringify(a);
        assert.equal(hp.pos.join(','), cp.wpos.join(','), 'position ' + ctx);
        assert.equal(hp.wounded, cp.wounded, 'wounded ' + ctx);
        assert.equal(hp.bullets, cp.bullets, 'bullets ' + ctx);
        assert.equal(hp.daggers, cp.daggers, 'daggers ' + ctx);
        assert.equal(hp.carrying, cp.carrying, 'carrying ' + ctx);
      }
      assert.equal(hm.tpos, cs.D.tpos, 'treasure position, seed ' + seed + ' turn ' + turn);
      assert.equal(hm.carrier, cs.D.carrier, 'carrier, seed ' + seed + ' turn ' + turn);
      if (cs.screen === 'end') { assert.equal(hm.winner, cs.D.winner, 'winner'); return; }
      assert.equal(hm.winner, null);
      g.click('endTurn'); H.passTurn(hm);
      assert.equal(hm.turn, g.peek().D.turn, 'turn index');
      break;
    }
  }
}

test('host rules == classic rules over 30 seeded random duels (D7)', () => {
  const stats = { rejected: 0 };
  for (let seed = 1; seed <= 30; seed++) playOne(seed, stats);
  // the script must actually exercise the interesting rules, or the comparison proves little
  ['step.pit', 'step.wall', 'step.wall.pit', 'step.treasure', 'shot.miss', 'dagger.miss', 'skip'].forEach((id) => assert.ok(stats[id] > 0, 'script never produced ' + id + ' - widen it'));
  assert.ok((stats['shot.hit'] || 0) + (stats['shot.hit.drop'] || 0) > 0, 'script never produced a shot hit');
  assert.ok((stats['dagger.hit'] || 0) + (stats['dagger.hit.drop'] || 0) > 0, 'script never produced a dagger hit');
  assert.ok(stats.rejected > 0, 'script never produced a rejected action');
});
