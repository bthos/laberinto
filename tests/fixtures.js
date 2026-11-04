'use strict';
/* Shared fixtures for the host-mode unit tests. Requires ../host.js (not built yet: red until Cmok). */
const H = require('../host.js');
const { fakeSynth, fakeTimers } = require('./harness');

/* 6x6 board, every internal edge open. Exit on the left edge of (0,0). Pit cycle 2,2 -> 4,4 -> 1,4 -> 2,2.
   Treasure 3,3. Hospital 1,1. Arsenal 5,0. */
function openWorld(over) {
  const pass = new Set();
  for (let y = 0; y < 6; y++) for (let x = 1; x < 6; x++) pass.add('v:' + x + ',' + y);
  for (let y = 1; y < 6; y++) for (let x = 0; x < 6; x++) pass.add('h:' + x + ',' + y);
  return Object.assign({ pass, exitEdge: 'v:0,0', exitCell: '0,0', pits: ['2,2', '4,4', '1,4'], treasure: '3,3', objs: { '1,1': 'hospital', '5,0': 'arsenal' } }, over || {});
}
const cut = (W, ...edges) => { edges.forEach((e) => W.pass.delete(e)); return W; };

/* a fresh match; spawns default to two far-apart empty cells */
function match(worldOver, spawns) { return H.createMatch(openWorld(worldOver), spawns || [[0, 3], [5, 5]]); }

const U = [0, -1], D = [0, 1], L = [-1, 0], R = [1, 0];
const step = (d) => ({ type: 'step', dx: d[0], dy: d[1] });
const shoot = (d) => ({ type: 'shoot', dx: d[0], dy: d[1] });
const dagger = () => ({ type: 'dagger' });
const skip = () => ({ type: 'skip' });

/* a controller wired to fake speech and fake timers */
function rig(opts) {
  opts = opts || {};
  const m = opts.match || match(opts.world, opts.spawns);
  const timers = fakeTimers();
  const synth = opts.noSynth ? undefined : fakeSynth({ voices: opts.voices });
  const settings = Object.assign({ voice: true, settle: true, speakTurn: false }, opts.settings);
  const speaker = H.createSpeaker({ synth, Utter: synth && synth.Utter, timers, getRate: () => 1, lang: 'ru-RU', fallbackLang: 'en' });
  const calls = { changes: 0 };
  const ctl = H.createController({ match: m, speaker, timers, settings: () => settings, onChange: () => { calls.changes++; } });
  return { m, timers, synth, settings, speaker, ctl, calls };
}

/* privacy check on a public line: after removing player numbers no digit may remain */
const strayDigits = (line) => line.replace(/игрок(а)? [12]/gi, '').match(/\d/g);

module.exports = { H, openWorld, cut, match, rig, step, shoot, dagger, skip, U, D, L, R, strayDigits };
