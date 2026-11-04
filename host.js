'use strict';
/* LabHost: pure core of the host-driven duel. No DOM, no globals besides the export.
   Catalogue (ru), host-line builder, rules engine, voice resolver, speaker and turn controller.
   Loaded by index.html before game.js; CommonJS-exported for the Node tests. */
(function () {
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  /* ---------- message catalogue ---------- */
  /* catalogue:start */
  const ru = {
    'dir.u': 'вверх', 'dir.d': 'вниз', 'dir.l': 'влево', 'dir.r': 'вправо',
    'cell.empty': 'пустая клетка', 'cell.hospital': 'госпиталь', 'cell.arsenal': 'арсенал', 'cell.exit': 'выход', 'cell.pit': 'яма', 'cell.treasure': 'клад',

    'ev.start': 'Игра началась. Игрок 1 стоит в клетке: {p1cell}. Игрок 2 стоит в клетке: {p2cell}. Первым ходит игрок {first}.',
    'ev.step': 'Игрок {p}: {dir} — {cell}.',
    'ev.step.healed': 'Игрок {p}: {dir} — госпиталь, раны залечены.',
    'ev.step.wall': 'Игрок {p}: {dir} — стена.',
    'ev.step.wall.pit': 'Игрок {p}: {dir} — стена. Провалился.',
    'ev.step.pit': 'Игрок {p}: {dir} — яма! Провалился.',
    'ev.step.treasure': 'Игрок {p}: клад — теперь он у него.',
    'ev.step.treasure.wounded': 'Игрок {p}: клад — но он ранен и унести его не может.',
    'ev.step.exit.blocked': 'Игрок {p}: {dir} — выход. Без клада уходить рано.',
    'ev.shot.hit': 'Игрок {p} стреляет {dir} — попал, игрок {o} ранен.',
    'ev.shot.hit.drop': 'Игрок {p} стреляет {dir} — попал, игрок {o} ранен и выронил клад.',
    'ev.shot.miss': 'Игрок {p} стреляет {dir} — мимо.',
    'ev.dagger.hit': 'Игрок {p} бьёт кинжалом — попал, игрок {o} ранен.',
    'ev.dagger.hit.drop': 'Игрок {p} бьёт кинжалом — попал, игрок {o} ранен и выронил клад.',
    'ev.dagger.miss': 'Игрок {p} бьёт кинжалом — мимо.',
    'ev.skip': 'Игрок {p} пропускает ход.',
    'ev.skip.pit': 'Игрок {p} пропускает ход. Провалился.',
    'ev.win': 'Игрок {p} вышел из лабиринта с кладом. Победил игрок {p}!',
    'ev.turn': 'Ход игрока {p}.',

    'ui.bullets': ['пуля', 'пули', 'пуль'],
    'ui.daggers': ['кинжал', 'кинжала', 'кинжалов'],

    'ui.chooser.title': 'Выбери дуэль',
    'ui.chooser.host.title': 'Дуэль с ведущим',
    'ui.chooser.host.sub': 'Игра говорит вслух, как ведущий. Карту рисуете на бумаге. Устройство лежит между вами.',
    'ui.chooser.classic.title': 'Классическая дуэль',
    'ui.chooser.classic.sub': 'Листы и сопоставление в приложении. Устройство передаётся по ходам.',
    'ui.chooser.cancel': 'Отмена',

    'ui.intro.eyebrow': 'Дуэль с ведущим',
    'ui.intro.title': 'Приготовьтесь',
    'ui.intro.body': 'Возьмите по листу бумаги и ручке. Карту вы рисуете сами по словам ведущего. Игра говорит вслух для обоих. Положите устройство между вами.',
    'ui.intro.start': 'Начать игру',
    'ui.intro.voice': 'Голос',
    'ui.intro.voiceOk': 'Русский голос найден',

    'ui.header.eyebrow': 'Дуэль с ведущим',
    'ui.header.turn': 'ход {n}',
    'ui.host.label': 'Ведущий',
    'ui.log.title': 'Журнал',
    'ui.speaking': 'Ведущий говорит…',
    'ui.notice.noVoice': 'Голос недоступен — только текст',
    'ui.notice.wounded': 'Ты ранен — ход не потрачен',
    'ui.notice.noBullets': 'Нет патронов — ход не потрачен',
    'ui.notice.noDaggers': 'Нет кинжалов — ход не потрачен',
    'ui.turn.banner': 'Ход игрока {p}',
    'ui.banner.over': 'Игра окончена',
    'ui.banner.aim': 'Целься: выбери направление. Выстрел ещё раз или Esc — отмена',
    'ui.pad.fire': 'Огонь',
    'ui.status.healthy': 'Здоров',
    'ui.status.wounded': 'Ранен',
    'ui.status.carrying': 'Несёт клад',
    'ui.status.woundedNoTreasure': 'Ранен: клад не унести',
    'ui.reason.wounded': 'ранен',
    'ui.reason.noBullets': 'нет патронов',
    'ui.reason.noDaggers': 'нет кинжалов',

    'ui.btn.repeat': 'Повторить',
    'ui.btn.shoot': 'Выстрел',
    'ui.btn.dagger': 'Кинжал',
    'ui.btn.skip': 'Пропустить',
    'ui.btn.results': 'К итогам',
    'ui.btn.again': 'Сыграть ещё',
    'ui.btn.menu': 'В меню',

    'ui.aria.up': 'Вверх',
    'ui.aria.down': 'Вниз',
    'ui.aria.left': 'Влево',
    'ui.aria.right': 'Вправо',
    'ui.aria.shootUp': 'Выстрел вверх',
    'ui.aria.shootDown': 'Выстрел вниз',
    'ui.aria.shootLeft': 'Выстрел влево',
    'ui.aria.shootRight': 'Выстрел вправо',
    'ui.aria.pause': 'Пауза и настройки',
    'ui.aria.repeat': 'Повторить последнюю реплику',
    'ui.aria.voiceOn': 'Голос ведущего: включён',
    'ui.aria.voiceOff': 'Голос ведущего: выключен',
    'ui.aria.pad': 'Ход',
    'ui.aria.actions': 'Действия',

    'ui.end.eyebrow': 'Дуэль с ведущим · итоги',
    'ui.end.winner': 'Победил игрок {p}',
    'ui.end.turns': 'Ходов: игрок 1 — {a}, игрок 2 — {b}',
    'ui.end.tab.map': 'Карта',
    'ui.end.tab.log': 'Журнал',
    'ui.end.tabs': 'Что показать',
    'ui.end.mapLabel': 'Настоящая карта лабиринта',

    'ui.set.title': 'Дуэль с ведущим',
    'ui.set.voice': 'Голос ведущего',
    'ui.set.voice.sub': 'Реплики озвучиваются. Текст показывается всегда',
    'ui.set.settle': 'Пауза после хода',
    'ui.set.settle.sub': 'Короткая пауза, чтобы случайный тап не сработал за следующего игрока',
    'ui.set.speakTurn': 'Говорить, чей ход',
    'ui.set.speakTurn.sub': 'Ведущий добавляет «Ход игрока N» после каждой реплики',
    'ui.set.keys': 'Дуэль с ведущим: <kbd>←↑→↓</kbd> / <kbd>WASD</kbd> ход · <kbd>X</kbd> выстрел · <kbd>K</kbd> кинжал · <kbd>P</kbd> пропуск · <kbd>R</kbd> повтор · <kbd>V</kbd> голос · <kbd>Esc</kbd> отмена / пауза',
    'ui.set.status.found': 'Русский голос найден',
    'ui.set.status.fallback': 'Нет русского голоса — используется: {lang}',
    'ui.set.status.none': 'Голос недоступен — только текст'
  };
  /* catalogue:end */
  const catalogue = { ru };

  /* russian plural rule: 1 / 21 -> one, 2-4 / 22-24 -> few, rest -> many */
  function pluralIndex(n) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 2;
    if (b === 1) return 0;
    if (b >= 2 && b <= 4) return 1;
    return 2;
  }

  function t(key, params) {
    if (!has(ru, key)) throw new Error('unknown catalogue key: ' + key);
    const v = ru[key];
    if (Array.isArray(v)) {
      const n = params ? params.n : undefined;
      if (n === undefined) throw new Error('missing param n for ' + key);
      return n + ' ' + v[pluralIndex(n)];
    }
    return v.replace(/\{(\w+)\}/g, (m, name) => {
      if (!params || params[name] === undefined) throw new Error('missing param ' + name + ' for ' + key);
      return String(params[name]);
    });
  }

  /* ---------- host lines: enumerated params, enumerated domains ---------- */
  const PARAMS = {
    'start': ['p1cell', 'p2cell', 'first'],
    'step': ['p', 'dir', 'cell'],
    'step.healed': ['p', 'dir'],
    'step.wall': ['p', 'dir'],
    'step.wall.pit': ['p', 'dir'],
    'step.pit': ['p', 'dir'],
    'step.treasure': ['p'],
    'step.treasure.wounded': ['p'],
    'step.exit.blocked': ['p', 'dir'],
    'shot.hit': ['p', 'dir', 'o'],
    'shot.hit.drop': ['p', 'dir', 'o'],
    'shot.miss': ['p', 'dir'],
    'dagger.hit': ['p', 'o'],
    'dagger.hit.drop': ['p', 'o'],
    'dagger.miss': ['p'],
    'skip': ['p'],
    'skip.pit': ['p'],
    'win': ['p'],
    'turn': ['p']
  };
  const DIRS = ['u', 'd', 'l', 'r'];
  const CELLS = ['empty', 'hospital', 'arsenal', 'exit', 'pit', 'treasure'];
  const DOMAIN = {
    p: (v) => v === 1 || v === 2,
    o: (v) => v === 1 || v === 2,
    first: (v) => v === 1 || v === 2,
    dir: (v) => DIRS.indexOf(v) >= 0,
    cell: (v) => CELLS.indexOf(v) >= 0,
    p1cell: (v) => CELLS.indexOf(v) >= 0,
    p2cell: (v) => CELLS.indexOf(v) >= 0
  };

  function hostLine(id, params) {
    if (!has(PARAMS, id)) throw new Error('unknown event id: ' + id);
    const names = PARAMS[id], given = params || {};
    Object.keys(given).forEach((k) => { if (names.indexOf(k) < 0) throw new Error('param not allowed for ' + id + ': ' + k); });
    const out = {};
    names.forEach((n) => {
      if (!has(given, n) || given[n] === undefined) throw new Error('missing param ' + n + ' for ' + id);
      if (!DOMAIN[n](given[n])) throw new Error('param ' + n + ' out of domain for ' + id + ': ' + given[n]);
      out[n] = n === 'dir' ? t('dir.' + given[n]) : /cell$/.test(n) ? t('cell.' + given[n]) : given[n];
    });
    return t('ev.' + id, out);
  }

  function composeLine(line, next, speakTurn) {
    return speakTurn ? line + ' ' + hostLine('turn', { p: next }) : line;
  }

  const DEFAULT_SETTINGS = { voice: true, settle: true, speakTurn: false };
  const SETTLE_MS = 300;

  /* ---------- rules engine (same rules as the classic duel) ---------- */
  const edge = (x, y, dx, dy) => dx === 1 ? 'v:' + (x + 1) + ',' + y : dx === -1 ? 'v:' + x + ',' + y : dy === 1 ? 'h:' + x + ',' + (y + 1) : 'h:' + x + ',' + y;
  const dirKey = (dx, dy) => dy === -1 ? 'u' : dy === 1 ? 'd' : dx === -1 ? 'l' : 'r';
  const parse = (k) => k.split(',').map(Number);

  function cellOf(world, pos) {
    const k = pos[0] + ',' + pos[1];
    if (world.pits.indexOf(k) >= 0) return 'pit';
    if (k === world.treasure) return 'treasure';
    if (k === world.exitCell) return 'exit';
    const o = world.objs[k];
    return o === 'hospital' || o === 'arsenal' ? o : 'empty';
  }

  function createMatch(world, spawns) {
    const players = spawns.map((s) => {
      const arsenal = world.objs[s[0] + ',' + s[1]] === 'arsenal';
      return { pos: s.slice(), wounded: false, bullets: arsenal ? 3 : 0, daggers: arsenal ? 3 : 0, carrying: false, moves: 0 };
    });
    return { W: world, players, turn: 0, tpos: world.treasure, carrier: null, winner: null, acted: false, log: [] };
  }

  function startEvent(m) {
    return { id: 'start', params: { p1cell: cellOf(m.W, m.players[0].pos), p2cell: cellOf(m.W, m.players[1].pos), first: m.turn + 1 } };
  }

  function legalActions(m) {
    const me = m.players[m.turn];
    const gate = (n, why) => me.wounded ? { enabled: false, reason: 'wounded' } : n <= 0 ? { enabled: false, reason: why } : { enabled: true };
    return { step: { enabled: true }, skip: { enabled: true }, shoot: gate(me.bullets, 'noBullets'), dagger: gate(me.daggers, 'noDaggers') };
  }

  function wound(m, o) {
    o.wounded = true;
    if (o.carrying) { o.carrying = false; m.tpos = o.pos.join(','); m.carrier = null; return true; }
    return false;
  }

  function applyAction(m, a) {
    if (m.winner !== null) return { ok: false, reason: 'over' };
    if (m.acted) return { ok: false, reason: 'acted' };
    const pi = m.turn, me = m.players[pi], o = m.players[1 - pi], p = pi + 1, oN = 2 - pi, W = m.W;
    const ok = (id, params) => { me.moves++; m.acted = true; return { ok: true, event: { id, params }, line: hostLine(id, params) }; };
    const nextPit = (k) => parse(W.pits[(W.pits.indexOf(k) + 1) % W.pits.length]);

    if (a.type === 'step') {
      const dx = a.dx, dy = a.dy, x = me.pos[0], y = me.pos[1], nx = x + dx, ny = y + dy, e = edge(x, y, dx, dy), dir = dirKey(dx, dy);
      if (e === W.exitEdge) {
        if (me.carrying) { m.winner = pi; return ok('win', { p }); }
        return ok('step.exit.blocked', { p, dir });
      }
      const inside = nx >= 0 && ny >= 0 && nx < 6 && ny < 6;
      if (!inside || !W.pass.has(e)) {
        const here = x + ',' + y;
        if (W.pits.indexOf(here) >= 0) { me.pos = nextPit(here); return ok('step.wall.pit', { p, dir }); }
        return ok('step.wall', { p, dir });
      }
      const key = nx + ',' + ny;
      if (W.pits.indexOf(key) >= 0) { me.pos = nextPit(key); return ok('step.pit', { p, dir }); }
      me.pos = [nx, ny];
      if (m.tpos === key) {
        if (me.wounded) return ok('step.treasure.wounded', { p });
        m.tpos = null; m.carrier = pi; me.carrying = true;
        return ok('step.treasure', { p });
      }
      const obj = W.objs[key];
      if (obj === 'hospital') {
        if (me.wounded) { me.wounded = false; return ok('step.healed', { p, dir }); }
        return ok('step', { p, dir, cell: 'hospital' });
      }
      if (obj === 'arsenal') { me.bullets = 3; me.daggers = 3; return ok('step', { p, dir, cell: 'arsenal' }); }
      return ok('step', { p, dir, cell: key === W.exitCell ? 'exit' : 'empty' });
    }

    if (a.type === 'shoot') {
      if (me.wounded) return { ok: false, reason: 'wounded' };
      if (me.bullets <= 0) return { ok: false, reason: 'noBullets' };
      const dx = a.dx, dy = a.dy, dir = dirKey(dx, dy);
      let x = me.pos[0], y = me.pos[1], hit = false;
      for (;;) {
        if (o.pos[0] === x && o.pos[1] === y) { hit = true; break; }
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx > 5 || ny > 5 || !W.pass.has(edge(x, y, dx, dy))) break;
        x = nx; y = ny;
      }
      me.bullets--;
      if (!hit) return ok('shot.miss', { p, dir });
      return ok(wound(m, o) ? 'shot.hit.drop' : 'shot.hit', { p, dir, o: oN });
    }

    if (a.type === 'dagger') {
      if (me.wounded) return { ok: false, reason: 'wounded' };
      if (me.daggers <= 0) return { ok: false, reason: 'noDaggers' };
      const hit = o.pos[0] === me.pos[0] && o.pos[1] === me.pos[1];
      me.daggers--;
      if (!hit) return ok('dagger.miss', { p });
      return ok(wound(m, o) ? 'dagger.hit.drop' : 'dagger.hit', { p, o: oN });
    }

    if (a.type === 'skip') {
      const here = me.pos.join(',');
      if (W.pits.indexOf(here) >= 0) { me.pos = nextPit(here); return ok('skip.pit', { p }); }
      return ok('skip', { p });
    }
    return { ok: false, reason: 'unknown' };
  }

  function passTurn(m) {
    if (m.winner !== null) return;
    m.turn = 1 - m.turn; m.acted = false;
  }

  /* ---------- voice and speech ---------- */
  const norm = (s) => String(s || '').replace(/_/g, '-').toLowerCase();
  const langOf = (s) => norm(s).split('-')[0];

  function resolveVoice(voices, lang, fallbackLang) {
    const list = Array.prototype.slice.call(voices || []);
    const pick = (fn) => { const c = list.filter(fn); return c.find((v) => v.default) || c[0] || null; };
    let v = pick((x) => norm(x.lang) === norm(lang));
    if (v) return { voice: v, how: 'exact' };
    v = pick((x) => langOf(x.lang) === langOf(lang));
    if (v) return { voice: v, how: 'lang' };
    v = pick((x) => langOf(x.lang) === langOf(fallbackLang));
    if (v) return { voice: v, how: 'fallback' };
    return { voice: null, how: 'none' };
  }

  /* safety unlock: floor covers engine start-up, the cap keeps a stuck synth from freezing the game */
  function safetyMs(text, rate) {
    const r = rate > 0 ? rate : 1;
    return Math.min(30000, Math.round(3000 + 120 * String(text).length / r));
  }

  function createSpeaker(o) {
    const synth = o.synth, Utter = o.Utter, timers = o.timers, getRate = o.getRate || (() => 1);
    let token = 0, timer = null, finish = null;
    const clear = () => { if (timer !== null) { timers.clearTimeout(timer); timer = null; } };
    const safeCancel = () => { try { if (synth && synth.cancel) synth.cancel(); } catch (e) { /* ignore */ } };
    function status() {
      const none = { available: false, how: 'none', voice: null };
      try {
        if (!synth || !Utter) return none;
        const r = resolveVoice(synth.getVoices ? synth.getVoices() : [], o.lang, o.fallbackLang);
        return { available: !!r.voice, how: r.how, voice: r.voice };
      } catch (e) { return none; }
    }
    function cancel() { token++; finish = null; clear(); safeCancel(); }
    function speak(text, cb) {
      const st = status();
      token++; clear(); finish = null;
      const my = token;
      if (!st.available) { cb('error'); return; }
      safeCancel();
      const done = (why) => {
        if (my !== token || finish === null) return;
        finish = null; clear();
        if (why === 'timeout') safeCancel();
        cb(why);
      };
      finish = done;
      let u;
      try {
        const rate = getRate();
        u = new Utter(text);
        u.lang = o.lang; u.voice = st.voice; u.rate = rate;
        u.onend = () => done('end');
        u.onerror = () => done('error');
        timer = timers.setTimeout(() => { timer = null; done('timeout'); }, safetyMs(text, rate));
        synth.speak(u);
      } catch (e) { done('error'); }
    }
    return { status, speak, cancel };
  }

  /* ---------- turn controller: ready -> speaking <-> idle/settling -> finished ---------- */
  function createController(o) {
    const match = o.match, speaker = o.speaker, timers = o.timers, getSettings = o.settings, onChange = o.onChange || (() => {});
    const ctl = { phase: 'ready', aim: false, lastLine: null };
    let pending = null, settleTimer = null, disposed = false;
    const changed = () => { if (!disposed) onChange(); };
    const voiceOn = () => { const s = getSettings(); return !!(s && s.voice) && speaker.status().available; };
    const setPhase = (p) => { ctl.phase = p; changed(); };
    const unlock = () => { const f = pending; pending = null; if (f) f(); };

    function lock(text, after) {
      if (!voiceOn()) { after(); return; }
      pending = after;
      setPhase('speaking');
      speaker.speak(text, () => unlock());
    }
    function settle() {
      const s = getSettings();
      if (s && s.settle) {
        ctl.phase = 'settling';
        settleTimer = timers.setTimeout(() => { settleTimer = null; setPhase('idle'); }, SETTLE_MS);
        changed();
      } else setPhase('idle');
    }

    ctl.begin = function () {
      const ev = startEvent(match), text = hostLine(ev.id, ev.params);
      match.log.push({ p: 0, id: ev.id, text });
      ctl.lastLine = text;
      lock(text, () => setPhase('idle'));
    };
    ctl.act = function (a) {
      if (ctl.phase !== 'idle') return { ok: false, reason: 'locked' };
      const r = applyAction(match, a);
      if (!r.ok) {
        if (ctl.aim) { ctl.aim = false; changed(); }
        return r;
      }
      ctl.aim = false;
      const won = match.winner !== null;
      const text = won ? r.line : composeLine(r.line, 2 - match.turn, !!(getSettings() || {}).speakTurn);
      match.log.push({ p: match.turn + 1, id: r.event.id, text });
      ctl.lastLine = text;
      lock(text, won ? () => setPhase('finished') : () => { passTurn(match); settle(); });
      return { ok: true, event: r.event, line: text };
    };
    ctl.dir = function (dx, dy) { return ctl.act(ctl.aim ? { type: 'shoot', dx, dy } : { type: 'step', dx, dy }); };
    ctl.toggleAim = function () {
      if (ctl.phase !== 'idle') return false;
      if (ctl.aim) { ctl.aim = false; changed(); return true; }
      if (!legalActions(match).shoot.enabled) return false;
      ctl.aim = true; changed();
      return true;
    };
    ctl.cancelAim = function () {
      if (!ctl.aim) return false;
      ctl.aim = false; changed();
      return true;
    };
    ctl.repeat = function () {
      if (!ctl.lastLine || !voiceOn()) return;
      if (ctl.phase === 'speaking' && pending) speaker.speak(ctl.lastLine, () => unlock());
      else speaker.speak(ctl.lastLine, () => {});
    };
    ctl.voiceChanged = function () {
      if (voiceOn()) return;
      speaker.cancel();
      if (ctl.phase === 'speaking') unlock();
    };
    ctl.pause = function () {
      speaker.cancel();
      if (ctl.phase === 'speaking') unlock();
    };
    ctl.dispose = function () {
      disposed = true; pending = null;
      speaker.cancel();
      if (settleTimer !== null) { timers.clearTimeout(settleTimer); settleTimer = null; }
    };
    return ctl;
  }

  const LabHost = {
    catalogue, t, PARAMS, hostLine, composeLine, DEFAULT_SETTINGS, SETTLE_MS,
    createMatch, startEvent, applyAction, passTurn, legalActions,
    resolveVoice, safetyMs, createSpeaker, createController
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LabHost;
  else globalThis.LabHost = LabHost;
})();
