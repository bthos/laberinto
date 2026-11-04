'use strict';
/* Speech and turn control: AC6, AC6a, AC7, AC8, AC19, AC20, Q9, Q11. Fake speechSynthesis, fake timers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeSynth, fakeTimers } = require('./harness');
const { H, rig, match, step, shoot, dagger, skip, U, D, L, R } = require('./fixtures');

const v = (lang, extra) => Object.assign({ lang, name: lang }, extra);

/* ---------- voice resolver (AC8) ---------- */
test('resolveVoice: exact locale wins', () => {
  const r = H.resolveVoice([v('en-US'), v('ru-BY'), v('ru-RU')], 'ru-RU', 'en');
  assert.equal(r.voice.lang, 'ru-RU'); assert.equal(r.how, 'exact');
});
test('resolveVoice: same language, any region', () => {
  const r = H.resolveVoice([v('en-US'), v('ru-BY')], 'ru-RU', 'en');
  assert.equal(r.voice.lang, 'ru-BY'); assert.equal(r.how, 'lang');
});
test('resolveVoice: Android-style ru_RU and odd case still match', () => {
  assert.equal(H.resolveVoice([v('ru_RU')], 'ru-RU', 'en').how, 'exact');
  assert.equal(H.resolveVoice([v('RU-ru')], 'ru-RU', 'en').how, 'exact');
});
test('resolveVoice: configured fallback language, then none', () => {
  let r = H.resolveVoice([v('de-DE'), v('en-GB')], 'ru-RU', 'en');
  assert.equal(r.voice.lang, 'en-GB'); assert.equal(r.how, 'fallback');
  r = H.resolveVoice([v('de-DE')], 'ru-RU', 'en');
  assert.equal(r.voice, null); assert.equal(r.how, 'none');
  assert.equal(H.resolveVoice([], 'ru-RU', 'en').how, 'none');
  assert.equal(H.resolveVoice(undefined, 'ru-RU', 'en').how, 'none');
});
test('resolveVoice: prefers the default voice among equals', () => {
  const r = H.resolveVoice([v('ru-RU', { name: 'a' }), v('ru-RU', { name: 'b', default: true })], 'ru-RU', 'en');
  assert.equal(r.voice.name, 'b');
});

/* ---------- safety timeout (Q9, AC6a) ---------- */
test('safetyMs is finite, grows with the line, never below the floor, capped', () => {
  const a = H.safetyMs('x'.repeat(20)), b = H.safetyMs('x'.repeat(80)), c = H.safetyMs('x'.repeat(160));
  assert.ok(Number.isFinite(a) && a >= 3000);
  assert.ok(a < b && b < c, 'scales with length');
  assert.equal(H.safetyMs('x'.repeat(100000)), 30000);
  assert.ok(H.safetyMs('x'.repeat(80), 0.5) > H.safetyMs('x'.repeat(80), 1), 'slower speech waits longer');
});

/* ---------- speaker ---------- */
function speakerRig(synthOpts) {
  const timers = fakeTimers(), synth = fakeSynth(synthOpts);
  const speaker = H.createSpeaker({ synth, Utter: synth.Utter, timers, getRate: () => 1, lang: 'ru-RU', fallbackLang: 'en' });
  return { timers, synth, speaker };
}
test('speaker.speak: utterance carries text, lang, voice, rate; end calls back once', () => {
  const { synth, speaker } = speakerRig();
  const got = [];
  speaker.speak('Привет', (why) => got.push(why));
  const u = synth.spoken[0];
  assert.equal(u.text, 'Привет'); assert.equal(u.lang, 'ru-RU'); assert.equal(u.rate, 1); assert.equal(u.voice.lang, 'ru-RU');
  synth.fire(u, 'end'); synth.fire(u, 'end'); synth.fire(u, 'error');
  assert.deepEqual(got, ['end']);
});
test('speaker.speak: a newer utterance silences the older one\'s events (stale end/error never unlock)', () => {
  const { synth, speaker } = speakerRig();
  const got = [];
  speaker.speak('один', (w) => got.push('a:' + w));
  speaker.speak('два', (w) => got.push('b:' + w));
  assert.ok(synth.cancelled >= 1, 'previous speech cancelled');
  synth.fire(synth.spoken[0], 'error', { error: 'interrupted' }); synth.fire(synth.spoken[0], 'end');
  assert.deepEqual(got, []);
  synth.fire(synth.spoken[1], 'end');
  assert.deepEqual(got, ['b:end']);
});
test('speaker.speak: error event and safety timeout call back once with their reason', () => {
  let r = speakerRig(); const got = [];
  r.speaker.speak('текст', (w) => got.push(w)); r.synth.fire(r.synth.spoken[0], 'error', { error: 'synthesis-failed' });
  assert.deepEqual(got, ['error']);
  r = speakerRig(); const got2 = [];
  r.speaker.speak('текст', (w) => got2.push(w));
  r.timers.tick(H.safetyMs('текст') - 1); assert.deepEqual(got2, []);
  r.timers.tick(1); assert.deepEqual(got2, ['timeout']);
  r.synth.fire(r.synth.spoken[0], 'end'); assert.deepEqual(got2, ['timeout'], 'late end ignored');
});
test('speaker.speak: end clears the safety timer; cancel() is silent', () => {
  const { synth, speaker, timers } = speakerRig();
  const got = [];
  speaker.speak('текст', (w) => got.push(w)); synth.fire(synth.spoken[0], 'end');
  assert.equal(timers.pending(), 0);
  speaker.speak('ещё', (w) => got.push(w)); speaker.cancel();
  assert.equal(timers.pending(), 0); assert.deepEqual(got, ['end']);
  synth.fire(synth.spoken[1], 'end'); assert.deepEqual(got, ['end']);
});
test('speaker.speak: synth.speak throwing is an immediate error callback, never an exception', () => {
  const { synth, speaker } = speakerRig();
  synth.speak = () => { throw new Error('boom'); };
  const got = [];
  assert.doesNotThrow(() => speaker.speak('текст', (w) => got.push(w)));
  assert.deepEqual(got, ['error']);
});
test('speaker.status: available only with a synth, a constructor and a resolved voice (AC8)', () => {
  const t = fakeTimers();
  const none = H.createSpeaker({ synth: undefined, Utter: undefined, timers: t, getRate: () => 1, lang: 'ru-RU', fallbackLang: 'en' });
  assert.equal(none.status().available, false);
  const noVoice = speakerRig({ voices: [v('de-DE')] }).speaker.status();
  assert.deepEqual([noVoice.available, noVoice.how], [false, 'none']);
  const fb = speakerRig({ voices: [v('en-US')] }).speaker.status();
  assert.deepEqual([fb.available, fb.how], [true, 'fallback']);
  assert.equal(speakerRig().speaker.status().how, 'exact');
  assert.doesNotThrow(() => none.speak('текст', () => {})); assert.doesNotThrow(() => none.cancel());
});

/* ---------- controller ---------- */
const started = (opts) => { const r = rig(opts); r.ctl.begin(); if (r.synth && r.synth.spoken[0]) r.synth.fire(r.synth.spoken[0], 'end'); return r; };
const lastU = (r) => r.synth.spoken[r.synth.spoken.length - 1];

test('begin: one start line, spoken, controls locked until it ends; turn stays with player 1 (AC10, D10)', () => {
  const r = rig();
  assert.equal(r.ctl.phase, 'ready');
  r.ctl.begin();
  assert.equal(r.ctl.phase, 'speaking');
  assert.equal(r.m.log.length, 1);
  assert.equal(r.synth.spoken[0].text, r.m.log[0].text);
  assert.match(r.m.log[0].text, /^Игра началась\./);
  assert.deepEqual(r.ctl.act(step(R)), { ok: false, reason: 'locked' });
  r.synth.fire(r.synth.spoken[0], 'end');
  assert.equal(r.ctl.phase, 'idle'); assert.equal(r.m.turn, 0, 'the start line does not pass the turn, and needs no settle pause');
});

test('act: line logged and spoken once; controls lock; turn passes only after speech (AC1, AC6)', () => {
  const r = started();
  const res = r.ctl.act(step(R));
  assert.equal(res.ok, true);
  assert.equal(r.m.log.length, 2);
  assert.deepEqual({ p: r.m.log[1].p, text: r.m.log[1].text }, { p: 1, text: 'Игрок 1: вправо — пустая клетка.' });
  assert.equal(r.synth.spoken.length, 2); assert.equal(lastU(r).text, 'Игрок 1: вправо — пустая клетка.');
  assert.equal(r.ctl.phase, 'speaking'); assert.equal(r.m.turn, 0, 'indicator still shows the acting player');
  assert.deepEqual(r.ctl.act(step(R)), { ok: false, reason: 'locked' });
  assert.equal(r.m.log.length, 2, 'a locked press adds no line');
  r.synth.fire(lastU(r), 'end');
  assert.equal(r.m.turn, 1);
});

test('settle pause: controls stay locked 300 ms after the turn passes, then open (AC19)', () => {
  const r = started();
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'end');
  assert.equal(r.ctl.phase, 'settling'); assert.equal(r.m.turn, 1, 'banner has flipped');
  assert.deepEqual(r.ctl.act(step(L)), { ok: false, reason: 'locked' });
  r.timers.tick(299); assert.equal(r.ctl.phase, 'settling');
  r.timers.tick(1); assert.equal(r.ctl.phase, 'idle');
  assert.equal(r.ctl.act(step(L)).ok, true);
});

test('settle off: controls open at the unlock (AC19)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'end');
  assert.equal(r.ctl.phase, 'idle'); assert.equal(r.m.turn, 1);
});

test('voice off: no speech, turn passes as soon as the line is shown, settle pause still runs (AC6a, AC19)', () => {
  const r = started({ settings: { voice: false } });
  r.ctl.act(step(R));
  assert.equal(r.synth.spoken.length, 0, 'voice is off: nothing is spoken, not even the start line (AC6a, AC7)');
  assert.equal(r.m.turn, 1, 'no voice: turn passes as soon as the line is shown');
  assert.equal(r.ctl.phase, 'settling');
  r.timers.tick(300); assert.equal(r.ctl.phase, 'idle');
});

test('unlock on speech error (AC6a)', () => {
  const r = started();
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'error', { error: 'synthesis-failed' });
  assert.equal(r.m.turn, 1);
});

test('unlock on the safety timeout when neither end nor error ever arrives (AC6a, Q9)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R));
  r.timers.tick(H.safetyMs(lastU(r).text) - 1); assert.equal(r.m.turn, 0);
  r.timers.tick(1); assert.equal(r.m.turn, 1); assert.equal(r.ctl.phase, 'idle');
});

test('the turn passes exactly once even if end and the timeout both fire (AC6a)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R)); const u = lastU(r);
  r.synth.fire(u, 'end'); r.synth.fire(u, 'error'); r.timers.tick(100000);
  assert.equal(r.m.turn, 1);
});

test('no speechSynthesis at all: text only, no wait, no exception (AC6a, AC8)', () => {
  const r = rig({ noSynth: true });
  assert.doesNotThrow(() => r.ctl.begin());
  assert.equal(r.ctl.phase, 'idle', 'start line shown, nothing to wait for');
  r.ctl.act(step(R));
  assert.equal(r.m.turn, 1); assert.equal(r.m.log.length, 2);
  assert.equal(r.speaker.status().available, false);
  assert.doesNotThrow(() => r.ctl.repeat());
});

test('no usable voice: silent, text only (AC8)', () => {
  const r = rig({ voices: [v('de-DE')] });
  r.ctl.begin();
  assert.equal(r.synth.spoken.length, 0); assert.equal(r.ctl.phase, 'idle');
});

test('fallback-language voice is used when no Russian voice exists (D5)', () => {
  const r = rig({ voices: [v('en-US')] });
  r.ctl.begin();
  assert.equal(r.synth.spoken.length, 1); assert.equal(r.synth.spoken[0].voice.lang, 'en-US');
});

test('voice turned off mid-speech cancels it and unlocks at once (AC6a, D10)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R));
  const before = r.synth.cancelled;
  r.settings.voice = false; r.ctl.voiceChanged();
  assert.ok(r.synth.cancelled > before, 'speech cancelled');
  assert.equal(r.m.turn, 1); assert.equal(r.ctl.phase, 'idle');
  r.synth.fire(r.synth.spoken[1], 'end'); assert.equal(r.m.turn, 1, 'late end of the cancelled line changes nothing');
});

test('«Повторить» while locked restarts speech and re-arms the unlock on the NEW utterance (AC6a, AC7)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R)); const first = lastU(r);
  r.ctl.repeat();
  assert.equal(r.synth.spoken.length, 3); const second = lastU(r);
  assert.equal(second.text, first.text);
  assert.equal(r.ctl.phase, 'speaking');
  r.synth.fire(first, 'error', { error: 'interrupted' }); r.synth.fire(first, 'end');
  assert.equal(r.m.turn, 0, 'cancelled utterance must not unlock early');
  r.synth.fire(second, 'end');
  assert.equal(r.m.turn, 1);
});

test('«Повторить» when idle re-speaks the last line and never changes the turn (AC7)', () => {
  const r = started();
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'end'); r.timers.tick(300);
  const turn = r.m.turn, phase = r.ctl.phase, n = r.m.log.length;
  r.ctl.repeat();
  assert.equal(lastU(r).text, 'Игрок 1: вправо — пустая клетка.');
  r.synth.fire(lastU(r), 'end');
  assert.equal(r.m.turn, turn); assert.equal(r.ctl.phase, phase); assert.equal(r.m.log.length, n);
});

test('rejected action: no line, no speech, no lock, turn kept (AC5, AC6)', () => {
  const r = started();
  const n = r.m.log.length, spoken = r.synth.spoken.length;
  assert.deepEqual(r.ctl.act(dagger()), { ok: false, reason: 'noDaggers' });
  assert.deepEqual(r.ctl.act(shoot(R)), { ok: false, reason: 'noBullets' });
  assert.equal(r.m.log.length, n); assert.equal(r.synth.spoken.length, spoken);
  assert.equal(r.ctl.phase, 'idle'); assert.equal(r.m.turn, 0);
  assert.equal(r.ctl.act(step(R)).ok, true, 'still free to act');
});

test('speakTurn off: the log line is exactly the host line (AC1, AC20)', () => {
  const r = started();
  r.ctl.act(step(R));
  assert.equal(r.m.log[1].text, 'Игрок 1: вправо — пустая клетка.'); assert.equal(lastU(r).text, r.m.log[1].text);
});

test('speakTurn on: «Ход игрока N» joins the same line, spoken and logged alike; still one entry (AC20, Q11)', () => {
  const r = started({ settings: { speakTurn: true } });
  r.ctl.act(step(R));
  assert.equal(r.m.log.length, 2, 'one entry per action');
  assert.equal(r.m.log[1].text, 'Игрок 1: вправо — пустая клетка. Ход игрока 2.');
  assert.equal(lastU(r).text, r.m.log[1].text);
  assert.equal(r.m.turn, 0, 'unlock waits for the whole phrase');
  r.synth.fire(lastU(r), 'end'); assert.equal(r.m.turn, 1);
});

test('speakTurn setting is read live (flip it between turns)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'end');
  r.settings.speakTurn = true;
  r.ctl.act(step(L));
  assert.equal(r.m.log[2].text, 'Игрок 2: влево — пустая клетка. Ход игрока 1.');
});

test('a win is spoken without a turn phrase, never passes the turn, and ends in finished (U6, AC11)', () => {
  const m = match({}, [[0, 0], [5, 5]]); m.players[0].carrying = true; m.tpos = null; m.carrier = 0;
  const r = rig({ match: m, settings: { speakTurn: true } });
  r.ctl.begin(); r.synth.fire(r.synth.spoken[0], 'end');
  r.ctl.act(step(L));
  assert.equal(lastU(r).text, 'Игрок 1 вышел из лабиринта с кладом. Победил игрок 1!');
  assert.equal(r.ctl.phase, 'speaking'); assert.equal(m.winner, 0);
  r.synth.fire(lastU(r), 'end');
  assert.equal(r.ctl.phase, 'finished'); assert.equal(m.turn, 0);
  r.timers.tick(1000); assert.equal(r.ctl.phase, 'finished', 'no settle pause after a win');
  assert.deepEqual(r.ctl.act(step(R)), { ok: false, reason: 'locked' });
});

test('a win without voice goes straight to finished', () => {
  const m = match({}, [[0, 0], [5, 5]]); m.players[0].carrying = true; m.tpos = null; m.carrier = 0;
  const r = rig({ match: m, noSynth: true });
  r.ctl.begin(); r.ctl.act(step(L));
  assert.equal(r.ctl.phase, 'finished');
});

test('pause during speech cancels it and unlocks; the line stays in the log (UX pause rule)', () => {
  const r = started({ settings: { settle: false } });
  r.ctl.act(step(R)); const n = r.m.log.length;
  r.ctl.pause();
  assert.ok(r.synth.cancelled >= 1); assert.equal(r.m.turn, 1); assert.equal(r.m.log.length, n);
});

test('dispose silences speech and drops pending timers (leaving to the menu)', () => {
  const r = started();
  r.ctl.act(step(R)); r.synth.fire(lastU(r), 'end'); // settle timer pending
  r.ctl.dispose();
  assert.equal(r.timers.pending(), 0);
  const phase = r.ctl.phase; r.timers.tick(100000); assert.equal(r.ctl.phase, phase);
});

test('onChange fires on every phase change (the UI re-renders from it)', () => {
  const r = rig(); const c0 = r.calls.changes;
  r.ctl.begin(); const c1 = r.calls.changes; assert.ok(c1 > c0);
  r.synth.fire(r.synth.spoken[0], 'end'); assert.ok(r.calls.changes > c1);
});

test('aim: shoot is two-step; direction fires only while armed; cancelAim reports whether it did anything (AC9, U8)', () => {
  const m = match({}, [[0, 3], [4, 3]]); m.players[0].bullets = 2;
  const r = rig({ match: m }); r.ctl.begin(); r.synth.fire(r.synth.spoken[0], 'end');
  assert.equal(r.ctl.aim, false); assert.equal(r.ctl.cancelAim(), false);
  assert.equal(r.ctl.toggleAim(), true); assert.equal(r.ctl.aim, true);
  assert.equal(r.ctl.cancelAim(), true); assert.equal(r.ctl.aim, false);
  r.ctl.toggleAim();
  const res = r.ctl.dir(1, 0);
  assert.equal(res.ok, true); assert.match(r.m.log[1].text, /стреляет вправо — попал/);
  assert.equal(r.ctl.aim, false, 'aim clears after firing');
  assert.equal(m.players[0].bullets, 1);
});
test('aim without bullets or while wounded cannot be armed; plain direction moves (AC5)', () => {
  const r = started();
  assert.equal(r.ctl.toggleAim(), false); assert.equal(r.ctl.aim, false);
  assert.equal(r.ctl.dir(1, 0).ok, true); assert.deepEqual(r.m.players[0].pos, [1, 3]);
});
test('aim cannot be armed while locked', () => {
  const m = match({}, [[0, 3], [4, 3]]); m.players[0].bullets = 2;
  const r = rig({ match: m }); r.ctl.begin();
  assert.equal(r.ctl.toggleAim(), false);
});
