'use strict';
/* Test harness: runs the real game.js (and host.js, when present) in a vm with a tiny DOM stub.
   No dependencies. Drives the app the way a user does: click on [data-act], keydown on document.
   - seeded Math.random, fake timers (explicit flush), localStorage stub, optional fake speechSynthesis.
   - peek(): reads the IIFE's closed-over state through an accessor spliced in before the closing `})();`.
     Host session variable MUST be named `HS` (see tech-plan.md); until it exists, peek().HS is null. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fakeTimers() {
  let now = 0, id = 0;
  const q = new Map();
  return {
    setTimeout(fn, ms) { const i = ++id; q.set(i, { at: now + (ms || 0), fn }); return i; },
    clearTimeout(i) { q.delete(i); },
    get now() { return now; },
    pending() { return q.size; },
    /* advance virtual time by ms, firing due timers in order */
    tick(ms) {
      const end = now + ms;
      for (;;) {
        let best = null, bi = null;
        for (const [i, t] of q) if (t.at <= end && (best === null || t.at < best.at || (t.at === best.at && i < bi))) { best = t; bi = i; }
        if (!best) break;
        q.delete(bi); now = Math.max(now, best.at); best.fn();
      }
      now = end;
    }
  };
}

/* fake Web Speech API. synth.spoken = every utterance handed to speak(); the test fires events by hand. */
function fakeSynth(opts) {
  opts = opts || {};
  const synth = {
    voices: opts.voices || [{ lang: 'ru-RU', name: 'Fake RU', default: true }],
    spoken: [], cancelled: 0, current: null,
    getVoices() { return synth.voices; },
    speak(u) { synth.spoken.push(u); synth.current = u; if (opts.onSpeak) opts.onSpeak(u); },
    cancel() { synth.cancelled++; synth.current = null; },
    addEventListener() {}, removeEventListener() {}
  };
  function Utter(text) { this.text = text; this.lang = ''; this.voice = null; this.rate = 1; this.onend = null; this.onerror = null; }
  synth.Utter = Utter;
  synth.fire = (u, type, extra) => { const h = u['on' + type]; if (h) h.call(u, Object.assign({ type }, extra)); };
  return synth;
}

function makeApp() {
  const listeners = {};
  const app = {
    innerHTML: '',
    addEventListener(t, fn) { (listeners['app:' + t] = listeners['app:' + t] || []).push(fn); },
    querySelectorAll() { return []; }
  };
  const doc = {
    body: { classList: { toggle() {} } },
    activeElement: null,
    getElementById: (id) => (id === 'app' ? app : null),
    addEventListener(t, fn) { (listeners['doc:' + t] = listeners['doc:' + t] || []).push(fn); }
  };
  return { app, doc, listeners };
}

/* opts: { seed, synth (fakeSynth | undefined => speechSynthesis missing), storage (object), withHost (default true) } */
function loadGame(opts) {
  opts = opts || {};
  const timers = fakeTimers();
  const { app, doc, listeners } = makeApp();
  const store = Object.assign({}, opts.storage || {});
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const sandbox = {
    document: doc, localStorage, console,
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    navigator: { language: 'ru-RU' }
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  if (opts.synth) { sandbox.speechSynthesis = opts.synth; sandbox.SpeechSynthesisUtterance = opts.synth.Utter; }
  vm.createContext(sandbox);
  sandbox.__rnd = mulberry32(opts.seed == null ? 1 : opts.seed);
  vm.runInContext('Math.random = __rnd;', sandbox);

  const hostPath = path.join(ROOT, 'host.js');
  if (opts.withHost !== false && fs.existsSync(hostPath)) vm.runInContext(fs.readFileSync(hostPath, 'utf8'), sandbox, { filename: 'host.js' });

  let src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const tail = src.lastIndexOf('})();');
  if (tail < 0) throw new Error('harness: game.js no longer ends with an IIFE closer "})();" - update tests/harness.js');
  const peekSrc = "globalThis.__peek=function(){return {W:W,D:D,S:S,screen:screen,settings:settings,HS:(typeof HS==='undefined'?null:HS)};};\n";
  src = src.slice(0, tail) + peekSrc + src.slice(tail);
  vm.runInContext(src, sandbox, { filename: 'game.js' });

  const api = {
    app, store, timers, sandbox,
    html: () => app.innerHTML,
    hash: () => crypto.createHash('sha256').update(app.innerHTML).digest('hex').slice(0, 16),
    peek: () => sandbox.__peek(),
    /* click a [data-act] control. Mirrors the app's delegated handler: disabled controls do nothing. */
    click(act, a, b) {
      const dis = api.isDisabled(act, a, b);
      if (dis === null) throw new Error('harness: no rendered control data-act="' + act + '"' + (a == null ? '' : ' data-a="' + a + '"') + ' on screen ' + api.peek().screen);
      if (dis) return false;
      const t = { dataset: { act, a: a == null ? undefined : String(a), b: b == null ? undefined : String(b) }, disabled: false };
      const e = { target: { closest: () => t } };
      (listeners['app:click'] || []).forEach((fn) => fn(e));
      return true;
    },
    /* true when the rendered markup has this control and it is disabled */
    isDisabled(act, a, b) {
      const re = new RegExp('<button[^>]*data-act="' + act + '"' + (a == null ? '' : '[^>]*data-a="' + a + '"') + (b == null ? '' : '[^>]*data-b="' + b + '"') + '[^>]*>', 'g');
      const m = app.innerHTML.match(re);
      if (!m) return null;
      return /\sdisabled(\s|>|=)/.test(m[0]);
    },
    hasControl: (act, a) => api.isDisabled(act, a) !== null,
    /* keydown by e.code (and e.key for the classic handler). Returns true if preventDefault was called. */
    key(code, key, extra) {
      let prevented = false;
      const e = Object.assign({ code, key: key || code, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { prevented = true; } }, extra || {});
      (listeners['doc:keydown'] || []).forEach((fn) => fn(e));
      return prevented;
    }
  };
  return api;
}

/* ---- helpers for scripted games ---- */
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const edgeKey = (x, y, dx, dy) => dx === 1 ? 'v:' + (x + 1) + ',' + y : dx === -1 ? 'v:' + x + ',' + y : dy === 1 ? 'h:' + x + ',' + (y + 1) : 'h:' + x + ',' + y;

/* BFS over a world ({pass:Set, exitEdge, exitCell, pits:[..]}) from a cell to a cell.
   mode: 'fall' (default) models the rules: stepping into a pit cell carries you to the next pit of the
   cycle (so the plan can use pits); 'avoid' never steps into a pit. Returns dir letters, or null.
   Stepping into `to` itself ends the search even if `to` is a pit. */
function bfs(W, from, to, mode) {
  mode = mode === true ? 'avoid' : (mode || 'fall');
  const key = (p) => p[0] + ',' + p[1];
  const prev = new Map([[key(from), null]]);
  const q = [from];
  while (q.length) {
    const p = q.shift();
    if (key(p) === key(to)) {
      const out = [];
      for (let k = key(p); prev.get(k); k = prev.get(k).from) out.unshift(prev.get(k).d);
      return out;
    }
    for (const d of Object.keys(DIRS)) {
      const [dx, dy] = DIRS[d], n = [p[0] + dx, p[1] + dy];
      if (n[0] < 0 || n[1] < 0 || n[0] > 5 || n[1] > 5) continue;
      if (!W.pass.has(edgeKey(p[0], p[1], dx, dy))) continue;
      let land = n;
      const pi = W.pits.indexOf(key(n));
      if (pi >= 0 && key(n) !== key(to)) {
        if (mode === 'avoid') continue;
        land = W.pits[(pi + 1) % W.pits.length].split(',').map(Number);
      }
      if (prev.has(key(land))) continue;
      prev.set(key(land), { from: key(p), d });
      q.push(land);
    }
  }
  return null;
}

module.exports = { loadGame, fakeSynth, fakeTimers, mulberry32, bfs, DIRS, edgeKey, ROOT };
