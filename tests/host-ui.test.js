'use strict';
/* UI-level host-mode tests through the real game.js in the vm harness: AC4, AC5, AC6, AC9, AC11, AC13, AC17, AC18, AC19, AC20.
   Contract (see tech-plan.md, "game.js integration contract"): screens hostIntro/hostGame/hostEnd, session variable HS = {match, ctl, tab},
   data-act names duelHost duelClassic chooserCancel hostBegin hUp hDown hLeft hRight hAim hDagger hSkip hRepeat hVoice hPause hResults hAgain hTab. */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../host.js');
const { loadGame, fakeSynth } = require('./harness');

const t = (k, p) => H.t(k, p);
const spoken = (s) => s.spoken.map((u) => u.text);

/* start the host duel and speak/skip through the start line; returns {g, synth} */
function hostGame(opts) {
  opts = opts || {};
  const synth = opts.noSynth ? undefined : fakeSynth({ voices: opts.voices });
  const g = loadGame({ seed: opts.seed || 3, synth, storage: opts.storage });
  g.click('duel'); g.click('duelHost'); g.click('hostBegin');
  if (synth && synth.spoken[0]) synth.fire(synth.spoken[0], 'end');
  g.timers.tick(400);
  return { g, synth };
}
const last = (s) => s.spoken[s.spoken.length - 1];
const unlock = (g, s) => { s.fire(last(s), 'end'); g.timers.tick(300); };
const HS = (g) => g.peek().HS;

/* ---------- chooser (AC17) ---------- */
test('duel button on the start screen opens the chooser; cancel and Esc close it; nothing starts (AC17)', () => {
  const g = loadGame({ seed: 1 });
  assert.equal(g.peek().screen, 'start');
  g.click('duel');
  assert.equal(g.peek().screen, 'start', 'still on the start screen underneath');
  assert.ok(g.hasControl('duelHost') && g.hasControl('duelClassic') && g.hasControl('chooserCancel'));
  assert.ok(g.html().includes(t('ui.chooser.host.title')) && g.html().includes(t('ui.chooser.classic.title')));
  assert.equal(g.peek().D, null); assert.equal(HS(g), null);
  g.click('chooserCancel');
  assert.ok(!g.hasControl('duelHost'));
  g.click('duel'); g.key('Escape', 'Escape');
  assert.ok(!g.hasControl('duelHost'), 'Esc closes the chooser');
  assert.equal(g.peek().screen, 'start');
});

test('classic card starts the unchanged classic flow: hand-off screen, D set, no host session (AC17, AC18)', () => {
  const g = loadGame({ seed: 1 });
  g.click('duel'); g.click('duelClassic');
  assert.equal(g.peek().screen, 'handoff'); assert.ok(g.peek().D); assert.equal(HS(g), null);
  assert.ok(g.hasControl('ready'));
});

test('host card starts host mode: intro screen, host session, no classic duel state, no hand-off (AC17, D3)', () => {
  const g = loadGame({ seed: 1, synth: fakeSynth() });
  g.click('duel'); g.click('duelHost');
  assert.equal(g.peek().screen, 'hostIntro');
  assert.equal(g.peek().D, null); assert.ok(HS(g));
  assert.ok(g.hasControl('hostBegin')); assert.ok(!g.hasControl('ready'));
  assert.ok(g.html().includes(t('ui.intro.start')));
});

test('no mixed state: after a classic duel the host session is empty, and the other way round', () => {
  const g = loadGame({ seed: 1, synth: fakeSynth() });
  g.click('duel'); g.click('duelHost'); g.click('hostBegin'); g.click('hPause'); g.click('menu');
  assert.equal(HS(g), null);
  g.click('duel'); g.click('duelClassic');
  assert.ok(g.peek().D); assert.equal(HS(g), null);
  g.click('ready'); g.click('pause'); g.click('menu'); g.click('duel'); g.click('duelHost');
  assert.equal(g.peek().D, null); assert.ok(HS(g));
});

/* ---------- turn screen (AC4, AC5, AC6) ---------- */
test('turn screen: banner, status, actions, log; no map, sheets, inventory or hand-off (AC4)', () => {
  const { g } = hostGame();
  const html = g.html();
  assert.equal(g.peek().screen, 'hostGame');
  assert.ok(html.includes(t('ui.turn.banner', { p: 1 })));
  assert.ok(html.includes(t('ui.status.healthy')));
  assert.ok(html.includes(HS(g).match.log[0].text), 'the start line is in the log');
  ['class="board"', 'data-act="pick"', 'data-act="match"', 'data-act="explore"', 'data-act="take"', 'data-act="place"', 'class="inv"'].forEach((frag) => assert.ok(!html.includes(frag), 'host turn screen must not contain ' + frag));
  ['hUp', 'hDown', 'hLeft', 'hRight', 'hAim', 'hDagger', 'hSkip', 'hRepeat', 'hVoice', 'hPause'].forEach((a) => assert.ok(g.hasControl(a), 'missing control ' + a));
});

test('unavailable actions are disabled and carry the reason inside the button (AC5)', () => {
  const { g } = hostGame();
  const m = HS(g).match;
  m.players[0].bullets = 0; m.players[0].daggers = 0; g.click('hRepeat'); // any re-render
  const html0 = g.html();
  assert.equal(g.isDisabled('hAim'), true); assert.equal(g.isDisabled('hDagger'), true);
  assert.ok(html0.includes(t('ui.reason.noBullets')) && html0.includes(t('ui.reason.noDaggers')));
  m.players[0].wounded = true; m.players[0].bullets = 2; m.players[0].daggers = 2;
  g.click('hRepeat');
  assert.equal(g.isDisabled('hAim'), true); assert.equal(g.isDisabled('hDagger'), true);
  assert.ok(g.html().includes(t('ui.reason.wounded')));
  assert.equal(g.isDisabled('hUp'), false); assert.equal(g.isDisabled('hSkip'), false);
});

test('an action locks every action control while the line is spoken; repeat and voice stay live (AC6)', () => {
  const { g, synth } = hostGame();
  g.click('hRight');
  assert.equal(HS(g).ctl.phase, 'speaking');
  ['hUp', 'hDown', 'hLeft', 'hRight', 'hAim', 'hDagger', 'hSkip'].forEach((a) => assert.equal(g.isDisabled(a), true, a + ' locked'));
  assert.equal(g.isDisabled('hRepeat'), false); assert.equal(g.isDisabled('hVoice'), false);
  assert.ok(g.html().includes(t('ui.turn.banner', { p: 1 })), 'indicator still shows the acting player');
  assert.ok(g.html().includes(t('ui.speaking')));
  assert.equal(g.click('hRight'), false, 'a disabled control does nothing');
  assert.equal(HS(g).match.log.length, 2);
  synth.fire(last(synth), 'end');
  assert.ok(g.html().includes(t('ui.turn.banner', { p: 2 })), 'banner flips at unlock');
});

test('input-settle pause: controls stay disabled 300 ms after the flip, then open (AC19)', () => {
  const { g, synth } = hostGame();
  g.click('hRight'); synth.fire(last(synth), 'end');
  assert.equal(g.isDisabled('hRight'), true);
  g.timers.tick(299); assert.equal(g.isDisabled('hRight'), true);
  g.timers.tick(1); assert.equal(g.isDisabled('hRight'), false);
});
test('settle off in Settings: controls open at the flip (AC19)', () => {
  const { g, synth } = hostGame({ storage: { 'lab.settings': JSON.stringify({ settle: false }) } });
  g.click('hRight'); synth.fire(last(synth), 'end');
  assert.equal(g.isDisabled('hRight'), false);
});

test('without speech support the line is shown, the turn passes at once, and the no-voice note appears (AC6a, AC8)', () => {
  const { g } = hostGame({ noSynth: true });
  assert.ok(g.html().includes(t('ui.notice.noVoice')));
  g.click('hRight');
  assert.ok(g.html().includes(t('ui.turn.banner', { p: 2 })));
  g.timers.tick(300);
  assert.equal(g.isDisabled('hRight'), false);
});
test('with a Russian voice the no-voice note is absent', () => {
  const { g } = hostGame();
  assert.ok(!g.html().includes(t('ui.notice.noVoice')));
});

test('voice switch (touch) mid-speech cancels and unlocks at once (AC6a, D10)', () => {
  const { g, synth } = hostGame();
  g.click('hRight');
  g.click('hVoice');
  assert.equal(g.peek().settings.voice, false);
  assert.ok(g.html().includes(t('ui.turn.banner', { p: 2 })));
  assert.ok(synth.cancelled > 0);
});

test('«Повторить» re-speaks the last line without changing the turn (AC7)', () => {
  const { g, synth } = hostGame({ seed: 5 }); // seed 5: player 1 has an open cell to the right
  g.click('hRight'); unlock(g, synth);
  const n = synth.spoken.length;
  g.click('hRepeat');
  assert.equal(synth.spoken.length, n + 1); assert.equal(last(synth).text, 'Игрок 1: вправо — пустая клетка.');
  assert.equal(HS(g).match.turn, 1);
});

test('a11y: live region, log role, d-pad labels, aim labels, voice switch state, reasons inside the button name (ux-design a11y)', () => {
  const { g } = hostGame();
  let html = g.html();
  assert.ok(html.includes('aria-live="polite"'), 'latest host line is a polite live region');
  assert.ok(html.includes('role="log"'), 'history is a log');
  ['Вверх', 'Влево', 'Вправо', 'Вниз'].forEach((l) => assert.ok(html.includes('aria-label="' + l + '"'), 'd-pad label ' + l));
  const tag = (act) => (html.match(new RegExp('<button[^>]*data-act="' + act + '"[^>]*>', 'g')) || [''])[0];
  assert.ok(/aria-pressed="(true|false)"/.test(tag('hVoice')), 'voice switch exposes its state');
  assert.ok(/aria-pressed="(true|false)"/.test(tag('hAim')), 'shoot exposes aria-pressed');
  HS(g).match.players[0].bullets = 0; g.click('hRepeat'); html = g.html();
  const aim = html.match(/<button[^>]*data-act="hAim"[^>]*>[\s\S]*?<\/button>/)[0];
  assert.ok(aim.includes(t('ui.reason.noBullets')), 'the reason is part of the button content, hence of its accessible name');
  HS(g).match.players[0].bullets = 2; g.click('hRepeat'); g.key('KeyX'); html = g.html();
  ['Выстрел вверх', 'Выстрел влево', 'Выстрел вправо', 'Выстрел вниз'].forEach((l) => assert.ok(html.includes('aria-label="' + l + '"'), 'aim-mode label ' + l));
});

/* ---------- keyboard (AC9) ---------- */
test('keys by e.code: arrows/WASD step, even on a Russian layout (AC9)', () => {
  const { g, synth } = hostGame();
  assert.equal(g.key('KeyD', 'в'), true, 'handled and default prevented');
  assert.match(HS(g).match.log[1].text, /^Игрок 1: вправо — /, 'KeyD with a Cyrillic e.key still steps right');
  assert.equal(HS(g).match.log.length, 2);
  unlock(g, synth);
  g.key('ArrowLeft', 'ArrowLeft'); assert.equal(HS(g).match.log.length, 3);
});

test('X arms the shot, a direction fires it, X again or Esc cancels the aim, Esc then opens pause (AC9)', () => {
  const { g } = hostGame();
  const m = HS(g).match; m.players[0].bullets = 2;
  g.key('KeyX'); assert.equal(HS(g).ctl.aim, true);
  g.key('KeyX'); assert.equal(HS(g).ctl.aim, false);
  g.key('KeyX'); g.key('Escape', 'Escape'); assert.equal(HS(g).ctl.aim, false);
  assert.equal(g.peek().screen, 'hostGame', 'first Esc only cancelled the aim');
  g.key('Escape', 'Escape'); assert.equal(g.peek().screen, 'settings');
  g.key('Escape', 'Escape'); assert.equal(g.peek().screen, 'hostGame', 'Esc in the pause screen resumes');
  g.key('KeyX'); g.key('ArrowRight', 'ArrowRight');
  assert.match(HS(g).match.log[1].text, /^Игрок 1 стреляет вправо/);
  assert.equal(m.players[0].bullets, 1);
});

test('K dagger, P skip, R repeat, V voice (AC9)', () => {
  let { g, synth } = hostGame();
  HS(g).match.players[0].daggers = 1;
  g.key('KeyK'); assert.match(HS(g).match.log[1].text, /бьёт кинжалом/); unlock(g, synth);
  g.key('KeyP'); assert.match(HS(g).match.log[2].text, /пропускает ход/);
  const n = synth.spoken.length; g.key('KeyR'); assert.equal(synth.spoken.length, n + 1);
  g.key('KeyV'); assert.equal(g.peek().settings.voice, false);
  g.key('KeyV'); assert.equal(g.peek().settings.voice, true);
});

test('while locked only R, V and Esc act; during the settle pause too, silently (AC9, AC19)', () => {
  const { g, synth } = hostGame();
  g.key('KeyD'); const n = HS(g).match.log.length;
  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'KeyK', 'KeyP', 'KeyX'].forEach((c) => g.key(c));
  assert.equal(HS(g).match.log.length, n, 'locked: nothing fires'); assert.equal(HS(g).ctl.aim, false);
  const s = synth.spoken.length; g.key('KeyR'); assert.equal(synth.spoken.length, s + 1, 'R works while locked');
  synth.fire(last(synth), 'end'); // settling now
  assert.equal(HS(g).ctl.phase, 'settling');
  ['KeyW', 'KeyK', 'KeyP'].forEach((c) => g.key(c));
  assert.equal(HS(g).match.log.length, n, 'settle pause swallows action keys');
  g.timers.tick(300); g.key('KeyP'); assert.equal(HS(g).match.log.length, n + 1);
});

test('rejected keyboard action shows an inline notice, no line, no speech, turn kept (AC5, UX)', () => {
  const { g, synth } = hostGame();
  const n = HS(g).match.log.length, s = synth.spoken.length;
  g.key('KeyK');
  assert.ok(g.html().includes(t('ui.notice.noDaggers')));
  assert.equal(HS(g).match.log.length, n); assert.equal(synth.spoken.length, s); assert.equal(HS(g).ctl.phase, 'idle');
});

test('host keys do not leak into classic duel or Solo, and classic keys do nothing in host mode (AC9, AC18)', () => {
  const g = loadGame({ seed: 4 });
  g.click('duel'); g.click('duelClassic'); g.click('ready');
  const before = g.hash();
  ['KeyX', 'KeyK', 'KeyP', 'KeyR', 'KeyV'].forEach((c) => g.key(c, c.slice(3).toLowerCase()));
  assert.equal(g.hash(), before, 'classic duel ignores X K P R V');
  const h = hostGame();
  const n = HS(h.g).match.log.length;
  ['m', 'f', 'h', 'q', 'e', ' ', 'Delete', '1', '2', '3'].forEach((k) => h.g.key('Unidentified', k));
  assert.equal(HS(h.g).match.log.length, n);
});

/* ---------- results (AC11) ---------- */
test('win: «К итогам» is locked until the win line is spoken, then results show map + winner + log, no hypothesis check (U6, AC11)', () => {
  const r = hostGame();
  const m = HS(r.g).match, W = r.g.peek().W;
  m.players[0].pos = W.exitCell.split(',').map(Number); m.players[0].carrying = true; m.tpos = null; m.carrier = 0;
  const p = W.exitEdge.slice(2).split(',').map(Number);
  const dirAct = W.exitEdge[0] === 'v' ? (p[0] === 0 ? 'hLeft' : 'hRight') : (p[1] === 0 ? 'hUp' : 'hDown');
  r.g.click('hRepeat'); // re-render with the injected state
  r.g.click(dirAct);
  assert.equal(m.winner, 0);
  assert.equal(r.g.peek().screen, 'hostGame', 'no auto-navigation');
  assert.ok(r.g.hasControl('hResults')); assert.equal(r.g.isDisabled('hResults'), true);
  assert.equal(last(r.synth).text, 'Игрок 1 вышел из лабиринта с кладом. Победил игрок 1!');
  r.synth.fire(last(r.synth), 'end');
  assert.equal(r.g.isDisabled('hResults'), false);
  r.g.click('hResults');
  assert.equal(r.g.peek().screen, 'hostEnd');
  const html = r.g.html();
  assert.ok(html.includes(t('ui.end.winner', { p: 1 })));
  assert.ok(html.includes(t('ui.end.mapLabel')), 'true map is shown');
  assert.ok(!html.includes('data-act="player"'), 'no per-player sheet tabs'); assert.ok(!/гипотез/i.test(html), 'no hypothesis check');
  assert.ok(r.g.hasControl('hTab', 'log') && r.g.hasControl('hTab', 'map'));
  r.g.click('hTab', 'log');
  m.log.forEach((e) => assert.ok(r.g.html().includes(e.text), 'log tab lists: ' + e.text));
  assert.ok(r.g.hasControl('hAgain') && r.g.hasControl('menu'));
});

test('«Сыграть ещё» repeats host mode without the chooser; «В меню» leaves and clears the session (AC17)', () => {
  const r = hostGame();
  const m = HS(r.g).match, W = r.g.peek().W;
  m.players[0].pos = W.exitCell.split(',').map(Number); m.players[0].carrying = true; m.tpos = null; m.carrier = 0;
  const p = W.exitEdge.slice(2).split(',').map(Number);
  r.g.click('hRepeat');
  r.g.click(W.exitEdge[0] === 'v' ? (p[0] === 0 ? 'hLeft' : 'hRight') : (p[1] === 0 ? 'hUp' : 'hDown'));
  r.synth.fire(last(r.synth), 'end'); r.g.click('hResults');
  r.g.click('hAgain');
  assert.equal(r.g.peek().screen, 'hostIntro'); assert.ok(!r.g.hasControl('duelHost')); assert.equal(HS(r.g).match.winner, null);
  r.g.click('hostBegin'); r.g.click('hPause'); r.g.click('menu');
  assert.equal(r.g.peek().screen, 'start'); assert.equal(HS(r.g), null);
});

/* ---------- settings (AC13, AC19, AC20, AC12) ---------- */
test('missing flags in an old lab.settings default to voice on, settle on, speakTurn off; old keys survive (AC13)', () => {
  const g = loadGame({ seed: 1, storage: { 'lab.settings': JSON.stringify({ motion: true, conflicts: false }) } });
  const s = g.peek().settings;
  assert.deepEqual([s.voice, s.settle, s.speakTurn, s.motion, s.conflicts, s.coach], [true, true, false, true, false, true]);
});
test('a corrupt lab.settings does not break startup', () => {
  const g = loadGame({ seed: 1, storage: { 'lab.settings': '{not json' } });
  assert.equal(g.peek().screen, 'start');
  assert.equal(g.peek().settings.voice, true);
});

test('Settings has the three host switches that persist; the classic legend and sections are still there (AC13, AC18, U10)', () => {
  const g = loadGame({ seed: 1, synth: fakeSynth() });
  g.click('settings');
  const html = g.html();
  ['voice', 'settle', 'speakTurn'].forEach((k) => assert.ok(g.hasControl('sw', k), 'switch ' + k));
  [t('ui.set.voice'), t('ui.set.settle'), t('ui.set.speakTurn')].forEach((s) => assert.ok(html.includes(s), s));
  ['Меньше анимации', 'Подсвечивать противоречия', 'Подсказки обучения', 'Клавиши: <kbd>←↑→↓</kbd> / <kbd>WASD</kbd> · <kbd>M</kbd> режим · <kbd>F</kbd> взять · <kbd>Space</kbd> закрепить · <kbd>H</kbd> скрыть · <kbd>Q</kbd><kbd>E</kbd> листы · <kbd>Esc</kbd> пауза'].forEach((s) => assert.ok(html.includes(s), 'classic settings text kept: ' + s));
  g.click('sw', 'speakTurn');
  assert.equal(JSON.parse(g.store['lab.settings']).speakTurn, true);
  g.click('sw', 'settle'); assert.equal(JSON.parse(g.store['lab.settings']).settle, false);
});

test('host pause: header says Pause, no «партия сохранена», legend mentions the host keys (UX 5)', () => {
  const { g } = hostGame();
  g.click('hPause');
  assert.equal(g.peek().screen, 'settings');
  const html = g.html();
  assert.ok(html.includes('>Пауза<')); assert.ok(!html.includes('партия сохранена'));
  assert.ok(html.includes(t('ui.set.keys')));
  g.click('back'); assert.equal(g.peek().screen, 'hostGame');
});

test('pausing mid-speech cancels it, unlocks, and keeps the line in the log (UX)', () => {
  const { g, synth } = hostGame();
  g.click('hRight'); g.click('hPause');
  assert.ok(synth.cancelled > 0); assert.equal(HS(g).match.turn, 1); assert.equal(HS(g).match.log.length, 2);
});

test('speakTurn switch: the phrase joins the spoken line and the log (AC20)', () => {
  const { g, synth } = hostGame({ storage: { 'lab.settings': JSON.stringify({ speakTurn: true }) } });
  g.click('hRight');
  assert.match(last(synth).text, /Ход игрока 2\.$/);
  assert.equal(HS(g).match.log[1].text, last(synth).text);
});

/* ---------- AC13: Solo and saves untouched ---------- */
test('host play leaves lab.save and lab.atlas byte-identical and never writes them (AC13)', () => {
  const save = JSON.stringify({ moves: 5, mode: 'explore', wpos: [0, 4], won: false, frags: [], cur: 'f0', msg: { kind: 'start', text: 'x' } });
  const atlas = JSON.stringify([{ moves: 9, sheets: 1, at: 1 }]);
  const r = hostGame({ storage: { 'lab.save': save, 'lab.atlas': atlas } });
  r.g.click('hRight'); unlock(r.g, r.synth); r.g.click('hPause'); r.g.click('back'); r.g.click('hPause'); r.g.click('menu');
  assert.equal(r.g.store['lab.save'], save); assert.equal(r.g.store['lab.atlas'], atlas);
  assert.ok(r.g.html().includes('Продолжить'), 'the solo save is still offered');
});

test('host mode does not touch the classic hand-off, news queue or sheet state (AC18)', () => {
  const { g } = hostGame();
  assert.equal(g.peek().D, null);
  assert.ok(!g.html().includes('Передай'), 'no hand-off wording');
  assert.ok(!g.html().includes('data-act="endTurn"'));
});
