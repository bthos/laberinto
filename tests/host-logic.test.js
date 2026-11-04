'use strict';
/* Pure rules engine for host mode: AC1, AC2, AC3, AC5, AC6 (rejections), AC10, AC11, D7. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { H, openWorld, cut, match, step, shoot, dagger, skip, U, D, L, R, strayDigits } = require('./fixtures');

const put = (m, i, x, y) => { m.players[i].pos = [x, y]; return m; };
const pos = (m, i) => m.players[i].pos.slice();

test('createMatch: ammo only from an arsenal start, everyone healthy, treasure on the floor (D7)', () => {
  const m = H.createMatch(openWorld(), [[5, 0], [0, 3]]);
  assert.equal(m.turn, 0); assert.equal(m.winner, null); assert.equal(m.acted, false);
  assert.deepEqual([m.players[0].bullets, m.players[0].daggers], [3, 3]);
  assert.deepEqual([m.players[1].bullets, m.players[1].daggers], [0, 0]);
  assert.ok(m.players.every((p) => !p.wounded && !p.carrying));
  assert.equal(m.tpos, '3,3'); assert.equal(m.carrier, null);
});

test('startEvent names both start cells and who moves first (AC10)', () => {
  const m = H.createMatch(openWorld(), [[1, 1], [0, 3]]);
  const ev = H.startEvent(m);
  assert.equal(ev.id, 'start');
  assert.deepEqual(ev.params, { p1cell: 'hospital', p2cell: 'empty', first: 1 });
  assert.equal(H.hostLine(ev.id, ev.params), 'Игра началась. Игрок 1 стоит в клетке: госпиталь. Игрок 2 стоит в клетке: пустая клетка. Первым ходит игрок 1.');
});

test('step into an empty cell: one event, position moves, turn is NOT passed yet (AC1, AC6)', () => {
  const m = match();
  const r = H.applyAction(m, step(R));
  assert.equal(r.ok, true);
  assert.deepEqual(r.event, { id: 'step', params: { p: 1, dir: 'r', cell: 'empty' } });
  assert.equal(r.line, 'Игрок 1: вправо — пустая клетка.');
  assert.deepEqual(pos(m, 0), [1, 3]);
  assert.equal(m.turn, 0); assert.equal(m.acted, true);
});

test('one action per turn; passTurn flips the turn and re-arms', () => {
  const m = match();
  H.applyAction(m, step(R));
  assert.deepEqual(H.applyAction(m, step(R)), { ok: false, reason: 'acted' });
  assert.deepEqual(pos(m, 0), [1, 3]);
  H.passTurn(m);
  assert.equal(m.turn, 1); assert.equal(m.acted, false);
  assert.equal(H.applyAction(m, step(L)).ok, true);
  assert.deepEqual(pos(m, 1), [4, 5]);
});

test('wall bump spends the turn and keeps the position (AC6)', () => {
  const m = match({ pass: cut(openWorld(), 'v:1,3').pass });
  const r = H.applyAction(m, step(R));
  assert.equal(r.line, 'Игрок 1: вправо — стена.');
  assert.deepEqual(pos(m, 0), [0, 3]); assert.equal(m.acted, true);
});

test('board edge counts as a wall', () => {
  const m = match({}, [[2, 0], [5, 5]]);
  assert.equal(H.applyAction(m, step(U)).line, 'Игрок 1: вверх — стена.');
});

test('exit edge without the treasure: spends the turn, stays, no win', () => {
  const m = match({}, [[0, 0], [5, 5]]);
  const r = H.applyAction(m, step(L));
  assert.equal(r.event.id, 'step.exit.blocked');
  assert.equal(r.line, 'Игрок 1: влево — выход. Без клада уходить рано.');
  assert.equal(m.winner, null); assert.deepEqual(pos(m, 0), [0, 0]); assert.equal(m.acted, true);
});

test('leaving with the treasure wins; the match is over for further actions (AC11)', () => {
  const m = match({}, [[0, 0], [5, 5]]);
  m.players[0].carrying = true; m.tpos = null; m.carrier = 0;
  const r = H.applyAction(m, step(L));
  assert.equal(r.event.id, 'win');
  assert.equal(r.line, 'Игрок 1 вышел из лабиринта с кладом. Победил игрок 1!');
  assert.equal(m.winner, 0);
  assert.deepEqual(H.applyAction(m, step(R)), { ok: false, reason: 'over' });
  H.passTurn(m); assert.equal(m.turn, 0, 'passTurn after a win is a no-op');
});

test('player 2 can win too (turn index 1)', () => {
  const m = match({}, [[5, 5], [0, 0]]);
  H.passTurn(m);
  m.players[1].carrying = true; m.tpos = null; m.carrier = 1;
  assert.equal(H.applyAction(m, step(L)).line, 'Игрок 2 вышел из лабиринта с кладом. Победил игрок 2!');
  assert.equal(m.winner, 1);
});

test('exit cell announces «выход»; hospital heals a wounded player, arsenal refills (D7)', () => {
  let m = match({}, [[0, 1], [5, 5]]);
  assert.equal(H.applyAction(m, step(U)).line, 'Игрок 1: вверх — выход.');
  m = match({}, [[1, 0], [5, 5]]);
  assert.equal(H.applyAction(m, step(D)).line, 'Игрок 1: вниз — госпиталь.');
  m = match({}, [[1, 0], [5, 5]]); m.players[0].wounded = true;
  const r = H.applyAction(m, step(D));
  assert.equal(r.line, 'Игрок 1: вниз — госпиталь, раны залечены.');
  assert.equal(m.players[0].wounded, false);
  m = match({}, [[4, 0], [5, 5]]);
  assert.equal(H.applyAction(m, step(R)).line, 'Игрок 1: вправо — арсенал.');
  assert.deepEqual([m.players[0].bullets, m.players[0].daggers], [3, 3]);
});

test('pit: fall to the next pit of the cycle, line never names which pit (AC2)', () => {
  const m = match({}, [[2, 1], [5, 5]]);
  const r = H.applyAction(m, step(D));
  assert.equal(r.line, 'Игрок 1: вниз — яма! Провалился.');
  assert.deepEqual(pos(m, 0), [4, 4]);
  assert.equal(strayDigits(r.line), null);
});

test('pit cycle wraps; stepping out of a pit to an open neighbour is not a fall', () => {
  let m = match({}, [[1, 4], [5, 5]]);
  H.applyAction(m, skip());
  assert.deepEqual(pos(m, 0), [2, 2], 'last pit leads back to the first');
  m = match({}, [[4, 4], [5, 5]]);
  const r = H.applyAction(m, step(R));
  assert.deepEqual(pos(m, 0), [5, 4]); assert.equal(r.event.id, 'step');
});

test('standing in a pit: a wall bump or a skip carries you on; shooting does not', () => {
  let m = match({ pass: cut(openWorld(), 'v:3,2').pass }, [[2, 2], [5, 5]]);
  let r = H.applyAction(m, step(R));
  assert.equal(r.event.id, 'step.wall.pit'); assert.equal(r.line, 'Игрок 1: вправо — стена. Провалился.');
  assert.deepEqual(pos(m, 0), [4, 4]);
  m = match({}, [[2, 2], [5, 5]]);
  r = H.applyAction(m, skip());
  assert.equal(r.event.id, 'skip.pit'); assert.equal(r.line, 'Игрок 1 пропускает ход. Провалился.');
  assert.deepEqual(pos(m, 0), [4, 4]);
  m = match({}, [[2, 2], [5, 5]]); m.players[0].bullets = 1;
  H.applyAction(m, shoot(R));
  assert.deepEqual(pos(m, 0), [2, 2]);
});

test('skip outside a pit', () => {
  const m = match();
  assert.equal(H.applyAction(m, skip()).line, 'Игрок 1 пропускает ход.');
  assert.deepEqual(pos(m, 0), [0, 3]);
});

test('treasure: auto pickup when healthy; wounded cannot take it (AC5, D9)', () => {
  let m = match({}, [[3, 2], [5, 5]]);
  const r = H.applyAction(m, step(D));
  assert.equal(r.line, 'Игрок 1: клад — теперь он у него.');
  assert.equal(m.tpos, null); assert.equal(m.players[0].carrying, true); assert.equal(m.carrier, 0);
  m = match({}, [[3, 2], [5, 5]]); m.players[0].wounded = true;
  const w = H.applyAction(m, step(D));
  assert.equal(w.event.id, 'step.treasure.wounded');
  assert.equal(m.tpos, '3,3'); assert.equal(m.players[0].carrying, false);
});

test('after pickup the treasure cell is an ordinary cell for the other player', () => {
  const m = match({}, [[3, 2], [3, 4]]);
  H.applyAction(m, step(D)); H.passTurn(m);
  assert.equal(H.applyAction(m, step(U)).line, 'Игрок 2: вверх — пустая клетка.');
});

test('shot: spends a bullet and the turn; hit along an open corridor wounds (AC3)', () => {
  const m = match({}, [[0, 3], [4, 3]]); m.players[0].bullets = 3;
  const r = H.applyAction(m, shoot(R));
  assert.deepEqual(r.event, { id: 'shot.hit', params: { p: 1, dir: 'r', o: 2 } });
  assert.equal(r.line, 'Игрок 1 стреляет вправо — попал, игрок 2 ранен.');
  assert.equal(m.players[1].wounded, true); assert.equal(m.players[0].bullets, 2); assert.equal(m.acted, true);
});

test('shot: a wall stops the bullet; wrong direction misses', () => {
  let m = match({ pass: cut(openWorld(), 'v:2,3').pass }, [[0, 3], [4, 3]]); m.players[0].bullets = 1;
  assert.equal(H.applyAction(m, shoot(R)).line, 'Игрок 1 стреляет вправо — мимо.');
  assert.equal(m.players[1].wounded, false); assert.equal(m.players[0].bullets, 0);
  m = match({}, [[0, 3], [4, 3]]); m.players[0].bullets = 1;
  assert.equal(H.applyAction(m, shoot(U)).event.id, 'shot.miss');
});

test('shot: a target in the shooter\'s own cell is hit, as in the classic duel (D7)', () => {
  const m = match({}, [[2, 0], [2, 0]]); m.players[0].bullets = 1;
  assert.equal(H.applyAction(m, shoot(D)).event.id, 'shot.hit');
});

test('wounding a carrier drops the treasure where they stand, and says so (AC3)', () => {
  const m = match({}, [[0, 3], [4, 3]]); m.players[0].bullets = 1;
  m.players[1].carrying = true; m.tpos = null; m.carrier = 1;
  const r = H.applyAction(m, shoot(R));
  assert.equal(r.event.id, 'shot.hit.drop');
  assert.equal(r.line, 'Игрок 1 стреляет вправо — попал, игрок 2 ранен и выронил клад.');
  assert.equal(m.players[1].carrying, false); assert.equal(m.tpos, '4,3'); assert.equal(m.carrier, null);
  assert.equal(strayDigits(r.line), null, 'the drop cell is not announced');
});

test('shoot and dagger are rejected without spending the turn (AC5, AC6)', () => {
  let m = match(); m.players[0].wounded = true; m.players[0].bullets = 3; m.players[0].daggers = 3;
  assert.deepEqual(H.applyAction(m, shoot(R)), { ok: false, reason: 'wounded' });
  assert.deepEqual(H.applyAction(m, dagger()), { ok: false, reason: 'wounded' });
  assert.equal(m.acted, false); assert.equal(m.players[0].bullets, 3);
  m = match();
  assert.deepEqual(H.applyAction(m, shoot(R)), { ok: false, reason: 'noBullets' });
  assert.deepEqual(H.applyAction(m, dagger()), { ok: false, reason: 'noDaggers' });
  assert.equal(m.acted, false);
});

test('dagger: hits only in the same cell; spends a dagger and the turn', () => {
  let m = match({}, [[2, 2], [2, 2]]); m.players[0].daggers = 2;
  let r = H.applyAction(m, dagger());
  assert.equal(r.line, 'Игрок 1 бьёт кинжалом — попал, игрок 2 ранен.');
  assert.equal(m.players[1].wounded, true); assert.equal(m.players[0].daggers, 1); assert.equal(m.acted, true);
  m = match({}, [[2, 2], [2, 3]]); m.players[0].daggers = 1;
  r = H.applyAction(m, dagger());
  assert.equal(r.line, 'Игрок 1 бьёт кинжалом — мимо.'); assert.equal(m.players[1].wounded, false);
});

test('dagger on a carrier drops the treasure', () => {
  const m = match({}, [[2, 2], [2, 2]]); m.players[0].daggers = 1;
  m.players[1].carrying = true; m.tpos = null; m.carrier = 1;
  assert.equal(H.applyAction(m, dagger()).event.id, 'dagger.hit.drop');
  assert.equal(m.tpos, '2,2');
});

test('legalActions: reasons for disabled actions (AC5)', () => {
  const m = match();
  let la = H.legalActions(m);
  assert.equal(la.step.enabled, true); assert.equal(la.skip.enabled, true);
  assert.deepEqual(la.shoot, { enabled: false, reason: 'noBullets' });
  assert.deepEqual(la.dagger, { enabled: false, reason: 'noDaggers' });
  m.players[0].bullets = 1; m.players[0].daggers = 1;
  la = H.legalActions(m);
  assert.equal(la.shoot.enabled, true); assert.equal(la.dagger.enabled, true);
  m.players[0].wounded = true;
  la = H.legalActions(m);
  assert.deepEqual(la.shoot, { enabled: false, reason: 'wounded' });
  assert.deepEqual(la.dagger, { enabled: false, reason: 'wounded' });
});

test('invariants over 300 seeded random matches: privacy, one event per action, treasure bookkeeping (AC1, AC2)', () => {
  const { mulberry32 } = require('./harness');
  const dirs = [U, D, L, R];
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = mulberry32(seed);
    const m = match({}, [[Math.floor(rnd() * 6), Math.floor(rnd() * 6)], [Math.floor(rnd() * 6), Math.floor(rnd() * 6)]]);
    m.players.forEach((p) => { p.bullets = 3; p.daggers = 3; });
    for (let i = 0; i < 120 && m.winner === null; i++) {
      const r0 = rnd(), d = dirs[Math.floor(rnd() * 4)];
      const a = r0 < .5 ? step(d) : r0 < .7 ? shoot(d) : r0 < .85 ? dagger() : skip();
      const r = H.applyAction(m, a);
      if (!r.ok) { assert.ok(['wounded', 'noBullets', 'noDaggers'].includes(r.reason)); assert.equal(m.acted, false); continue; }
      assert.equal(r.line, H.hostLine(r.event.id, r.event.params), 'line is catalogue output only');
      assert.equal(strayDigits(r.line), null, r.line);
      m.players.forEach((p) => { assert.ok(p.pos[0] >= 0 && p.pos[0] <= 5 && p.pos[1] >= 0 && p.pos[1] <= 5); });
      const carriers = m.players.filter((p) => p.carrying).length;
      assert.equal(carriers + (m.tpos === null ? 0 : 1), 1, 'treasure is on the floor xor carried');
      assert.equal(m.carrier === null, carriers === 0);
      H.passTurn(m);
    }
  }
});
