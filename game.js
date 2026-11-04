'use strict';
/* Лабиринт — правила v1. Поле 6×6, ямы по циклу, листы-гипотезы, сопоставление сдвигом. */
(function () {
  const C = 56;
  const app = document.getElementById('app');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  let settings = Object.assign({ motion: false, conflicts: true, coach: true }, LabHost.DEFAULT_SETTINGS, LS.get('lab.settings', {}));
  let screen = 'start';
  let S = null;
  let prevScreen = 'start';
  let endView = 'both', endSaved = false;

  const IC = {
    pit: (s, c, w, l) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Яма"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>`,
    sign: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Табличка"><rect x="4" y="5" width="16" height="12" rx="1"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M12 17v3"/></svg>`,
    exit: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Выход"><path d="M10 4H5v16h5"/><path d="M21 12H9"/><path d="M13 8l-4 4 4 4"/></svg>`,
    chest: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Ларец"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10a9 5 0 0 1 18 0"/><path d="M12 13v3"/></svg>`,
    hospital: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Госпиталь"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>`,
    arsenal: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Арсенал"><circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/></svg>`,
    up: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>', down: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    left: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'
  };
  const arrow = (n) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const objIcon = (k, s, col, w) => k === 'pit' ? IC.pit(s, col.pit || '#B65B48', w) : k === 'sign' ? IC.sign(s, col.sign || '#2E7F78', w) : k === 'exit' ? IC.exit(s, col.exit || '#263238', w) : k === 'chest' ? IC.chest(s, col.chest || '#9A7330', w + 0.2) : k === 'hospital' ? IC.hospital(s, col.hospital || '#B0392F', w) : k === 'arsenal' ? IC.arsenal(s, col.arsenal || '#4B5A2E', w) : '';

  /* ---------- мир ---------- */
  const SOLO = {
    pass: new Set(['v:1,4','h:1,4','h:1,3','v:1,2','h:0,2','h:0,1','v:1,0','v:2,0','h:2,1','v:2,1','v:2,2','v:3,2','v:4,2','h:3,3','v:4,3','v:5,3','h:5,4','h:5,5','v:5,5','v:4,5','v:3,5','h:1,5','v:1,5','v:2,3','h:2,4','v:3,4','v:4,4','h:0,4','h:3,1','v:4,0','v:5,0','h:5,1','h:5,2','h:4,1']),
    exitEdge: 'v:0,4', exitCell: '0,4', pits: ['2,5', '3,1'], treasure: '5,2', objs: { '4,2': 'sign' }
  };
  let W = SOLO, D = null, lastMode = 'solo', endPlayer = 0;
  const xy = (k) => k.slice(k.indexOf(':') + 1).split(',').map(Number);
  const edge = (x, y, dx, dy) => dx === 1 ? 'v:' + (x + 1) + ',' + y : dx === -1 ? 'v:' + x + ',' + y : dy === 1 ? 'h:' + x + ',' + (y + 1) : 'h:' + x + ',' + y;
  const shiftEdge = (e, ox, oy) => { const p = xy(e); return e[0] + ':' + (p[0] + ox) + ',' + (p[1] + oy); };
  const kv = (k) => k.split(',').map(Number);
  const dirName = (dx, dy) => dy === -1 ? 'Вверх' : dy === 1 ? 'Вниз' : dx === -1 ? 'Влево' : 'Вправо';
  const dirKey = (dx, dy) => dy === -1 ? 'u' : dy === 1 ? 'd' : dx === -1 ? 'l' : 'r';

  function initialState() {
    return {
      mode: 'explore', wpos: [0, 4], carrying: false, taken: false, moves: 0, won: false,
      frags: [{ id: 'f0', name: 'А', anchored: true, placed: true, ox: 0, oy: 0, tx: 0, ty: 0, tw: [0, 0], cells: { '0,4': 1 }, walls: {}, pass: {}, obj: { '0,4': 'exit' } }],
      cur: 'f0', lpos: [0, 4], lastNew: 'f0:0,4',
      msg: { kind: 'start', text: 'ты у входа, выход — слева за спиной. Где-то здесь ларец.' },
      sel: null, op: 1, hidden: false, bump: null, bumpN: 0, pitFx: false,
      hint: { kind: 'start', text: 'Ходи крестовиной. Клетки, проходы и стены записываются на лист сами.' },
      seen: {}
    };
  }
  const clone = () => S.frags.map((f) => Object.assign({}, f, { cells: Object.assign({}, f.cells), walls: Object.assign({}, f.walls), pass: Object.assign({}, f.pass), obj: Object.assign({}, f.obj) }));
  const frag = (id, fr) => (fr || S.frags).find((f) => f.id === id);
  function bbox(f) {
    const ks = Object.keys(f.cells).map(kv), xs = ks.map((p) => p[0]), ys = ks.map((p) => p[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    return { minx, maxx, miny, maxy, w: maxx - minx + 1, h: maxy - miny + 1 };
  }
  const center = (f) => { const b = bbox(f); return { x: Math.floor((6 - b.w) / 2) - b.minx, y: Math.floor((6 - b.h) / 2) - b.miny }; };
  const clampT = (f, x, y) => { const b = bbox(f); return { x: Math.min(Math.max(x, -b.minx), 5 - b.maxx), y: Math.min(Math.max(y, -b.miny), 5 - b.maxy) }; };
  function hintOnce(seen, key, text, cur) { if (seen[key]) return cur; seen[key] = 1; return { kind: key, text }; }

  function set(patch) { Object.assign(S, patch); persist(); render(); }
  function persist() { if (D) return; if (S && !S.won) LS.set('lab.save', S); else if (S && S.won) LS.del('lab.save'); }

  /* ---------- действия ---------- */
  function done(p) { if (D) p.acted = true; set(p); }
  function fall(frags, dest, moves, seen, hint, text) {
    const names = 'АБВГДЕЖЗИКЛМНОП', name = names[frags.length] || ('Л' + frags.length), id = 'f' + frags.length;
    frags.push({ id, name, anchored: false, placed: false, ox: 0, oy: 0, tx: null, ty: null, tw: dest, cells: { '0,0': 1 }, walls: {}, pass: {}, obj: { '0,0': 'pit' } });
    hint = hintOnce(seen, 'pit', 'Новый лист «' + name + '» не привязан к карте. Найди знакомые приметы и переключись в «Сопоставлять».', hint);
    done({ frags, cur: id, lpos: [0, 0], wpos: dest, moves, seen, hint, bump: null, pitFx: true, lastNew: id + ':0,0', msg: { kind: 'pit', text: text.replace('%n', name) } });
    clearTimeout(step._t); step._t = setTimeout(() => { if (S) set({ pitFx: false }); }, 700);
  }
  function step(dx, dy) {
    const s = S;
    if (s.mode !== 'explore' || s.won || (D && s.acted)) return;
    const dn = dirName(dx, dy), x = s.wpos[0], y = s.wpos[1], nx = x + dx, ny = y + dy, e = edge(x, y, dx, dy);
    const frags = clone(), f = frag(s.cur, frags), lx = s.lpos[0], ly = s.lpos[1], le = edge(lx, ly, dx, dy);
    const moves = s.moves + 1, seen = Object.assign({}, s.seen);
    let hint = s.hint && s.hint.kind === 'start' ? null : s.hint;
    if (e === W.exitEdge) {
      if (s.carrying) {
        if (D) D.winner = D.turn;
        set({ moves, won: true, bump: null, hint: null, msg: { kind: 'win', text: 'ты вышел из лабиринта с кладом!' } });
        endView = 'both'; endSaved = false; endPlayer = D ? D.turn : 0; screen = 'end'; render(); return;
      }
      done({ moves, bump: dirKey(dx, dy), bumpN: s.bumpN + 1, hint, msg: { kind: 'exit', text: dn.toLowerCase() + ' — выход. Без клада уходить рано.' } });
      return;
    }
    const inside = nx >= 0 && ny >= 0 && nx < 6 && ny < 6;
    if (!inside || !W.pass.has(e)) {
      f.walls[le] = 1;
      const pi0 = D ? W.pits.indexOf(x + ',' + y) : -1;
      if (pi0 >= 0) { fall(frags, kv(W.pits[(pi0 + 1) % W.pits.length]), moves, seen, hint, dn.toLowerCase() + ' — стена, но ты в яме: тебя унесло в следующую яму. Начат новый лист «%n».'); return; }
      hint = hintOnce(seen, 'wall', 'Стена записана сама. Ход потрачен — ты остался на месте.', hint);
      done({ frags, moves, seen, hint, bump: dirKey(dx, dy), bumpN: s.bumpN + 1, msg: { kind: 'wall', text: dn.toLowerCase() + ' — стена. Ты остался на месте.' } });
      return;
    }
    f.pass[le] = 1;
    const nlx = lx + dx, nly = ly + dy, nk = nlx + ',' + nly, isNew = !f.cells[nk];
    f.cells[nk] = 1;
    const key = nx + ',' + ny, pi = W.pits.indexOf(key);
    if (pi >= 0) {
      f.obj[nk] = 'pit';
      fall(frags, kv(W.pits[(pi + 1) % W.pits.length]), moves, seen, hint, dn.toLowerCase() + ' — яма! Ты провалился и потерял ориентир. Начат новый лист «%n».');
      return;
    }
    let obj = null, extra = {}, text = null;
    if (D ? D.tpos === key : (key === W.treasure && !s.taken)) {
      obj = 'chest';
      if (D) {
        if (s.wounded) text = 'клад! Но ты ранен — унести его не можешь.';
        else { D.tpos = null; D.carrier = D.turn; extra = { carrying: true, taken: true }; text = 'нашёл клад. Он у тебя — теперь к выходу.'; }
      }
    } else if (W.objs[key]) obj = W.objs[key]; else if (key === W.exitCell) obj = 'exit';
    if (D && obj === 'hospital') extra = { wounded: false };
    if (D && obj === 'arsenal') extra = { bullets: 3, daggers: 3 };
    if (obj) f.obj[nk] = obj;
    const texts = { chest: 'ларец! Возьми его.', sign: 'обломок таблички, надпись стёрта.', exit: 'клетка у выхода.', hospital: s.wounded ? 'госпиталь. Раны залечены.' : 'госпиталь.', arsenal: 'арсенал. Патроны и кинжалы пополнены — по 3.' };
    if (obj === 'chest' && !D) hint = hintOnce(seen, 'chest', 'Найти — не значит взять. Нажми «Взять клад», затем вынеси его через выход.', hint);
    done(Object.assign({ frags, lpos: [nlx, nly], wpos: [nx, ny], moves, seen, hint, bump: null, lastNew: isNew ? s.cur + ':' + nk : s.lastNew, msg: { kind: obj === 'chest' && D && !s.wounded ? 'take' : (obj || 'move'), text: text || (dn.toLowerCase() + ' — ' + (obj ? texts[obj] : (isNew ? 'проход, пустая клетка.' : 'проход, здесь ты уже был.'))) } }, extra));
  }

  /* ---------- дуэль: ведущий — игра ---------- */
  const NEWS_HURT = 'Тебя ранили! Оружие и клад тебе недоступны, пока не дойдёшь до госпиталя.';
  function woundOther(o) {
    o.wounded = true;
    if (o.carrying) { o.carrying = false; D.tpos = o.wpos.join(','); D.carrier = null; }
    D.news[1 - D.turn].push(NEWS_HURT + (D.tpos === o.wpos.join(',') ? ' Клад остался там, где ты был ранен.' : ''));
  }
  function shoot(dx, dy) {
    if (!D || S.acted || S.mode !== 'explore') return;
    if (S.wounded) { set({ aim: false, msg: { kind: 'wall', text: 'ты ранен — стрелять нельзя. Ход не потрачен.' } }); return; }
    if (S.bullets <= 0) { set({ aim: false, msg: { kind: 'wall', text: 'нет патронов — нужен арсенал. Ход не потрачен.' } }); return; }
    const o = D.players[1 - D.turn];
    let x = S.wpos[0], y = S.wpos[1], hit = false;
    for (;;) {
      if (o.wpos[0] === x && o.wpos[1] === y) { hit = true; break; }
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 5 || ny > 5 || !W.pass.has(edge(x, y, dx, dy))) break;
      x = nx; y = ny;
    }
    if (hit) woundOther(o);
    done({ bullets: S.bullets - 1, aim: false, moves: S.moves + 1, msg: { kind: hit ? 'pit' : 'wall', text: hit ? 'выстрел ' + dirName(dx, dy).toLowerCase() + ' — попал! Игрок ' + (2 - D.turn) + ' ранен.' : 'выстрел ' + dirName(dx, dy).toLowerCase() + ' — пуля улетела до стены. Никто не ранен.' } });
  }
  function dagger() {
    if (!D || S.acted || S.mode !== 'explore') return;
    if (S.wounded) { set({ msg: { kind: 'wall', text: 'ты ранен — бить нельзя. Ход не потрачен.' } }); return; }
    if (S.daggers <= 0) { set({ msg: { kind: 'wall', text: 'нет кинжалов — нужен арсенал. Ход не потрачен.' } }); return; }
    const o = D.players[1 - D.turn], hit = o.wpos[0] === S.wpos[0] && o.wpos[1] === S.wpos[1];
    if (hit) woundOther(o);
    done({ daggers: S.daggers - 1, aim: false, moves: S.moves + 1, msg: { kind: hit ? 'pit' : 'wall', text: hit ? 'удар кинжалом — попал! Игрок ' + (2 - D.turn) + ' ранен.' : 'удар кинжалом — в клетке никого нет.' } });
  }
  function skip() {
    if (!D || S.acted || S.mode !== 'explore') return;
    const frags = clone(), seen = Object.assign({}, S.seen), pi = W.pits.indexOf(S.wpos.join(','));
    if (pi >= 0) { fall(frags, kv(W.pits[(pi + 1) % W.pits.length]), S.moves + 1, seen, S.hint, 'ты пропустил ход в яме — тебя унесло в следующую яму. Начат новый лист «%n».'); return; }
    done({ moves: S.moves + 1, aim: false, msg: { kind: 'move', text: 'ход пропущен.' } });
  }
  function genWorld(nPits) {
    const idx = (x, y) => x + ',' + y, pass = new Set(), seenC = new Set(['0,0']), stack = [[0, 0]];
    const link = (x, y, nx, ny) => pass.add(nx !== x ? 'v:' + Math.max(x, nx) + ',' + y : 'h:' + x + ',' + Math.max(y, ny));
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d) => [x + d[0], y + d[1]]).filter((p) => p[0] >= 0 && p[1] >= 0 && p[0] < 6 && p[1] < 6 && !seenC.has(idx(p[0], p[1])));
      if (!nb.length) { stack.pop(); continue; }
      const p = nb[Math.floor(Math.random() * nb.length)];
      link(x, y, p[0], p[1]); seenC.add(idx(p[0], p[1])); stack.push(p);
    }
    for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(Math.random() * 5), y = Math.floor(Math.random() * 6); pass.add(Math.random() < .5 ? 'v:' + x + ',' + y : 'h:' + y + ',' + x); }
    const side = Math.floor(Math.random() * 4), t = Math.floor(Math.random() * 6);
    const exitEdge = ['v:0,' + t, 'v:6,' + t, 'h:' + t + ',0', 'h:' + t + ',6'][side];
    const exitCell = [[0, t], [5, t], [t, 0], [t, 5]][side].join(',');
    const free = []; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (idx(x, y) !== exitCell) free.push(idx(x, y));
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    const pits = free.splice(0, nPits), treasure = free.splice(0, 1)[0], hosp = free.splice(0, 1)[0], arse = free.splice(0, 1)[0];
    const objs = {}; objs[hosp] = 'hospital'; objs[arse] = 'arsenal';
    return { pass, exitEdge, exitCell, pits, treasure, objs, spawn: free };
  }
  function newDuel() {
    const w = genWorld(3);
    W = w; lastMode = 'duel'; LS.del('lab.save');
    const players = [0, 1].map((i) => {
      const c = w.spawn.splice(Math.floor(Math.random() * w.spawn.length), 1)[0], at = kv(c), o = w.objs[c];
      const st = initialState();
      st.frags = [{ id: 'f0', name: 'А', anchored: false, placed: false, ox: 0, oy: 0, tx: null, ty: null, tw: at, cells: { '0,0': 1 }, walls: {}, pass: {}, obj: o ? { '0,0': o } : {} }];
      st.wpos = at; st.lpos = [0, 0]; st.lastNew = 'f0:0,0';
      st.wounded = false; st.bullets = o === 'arsenal' ? 3 : 0; st.daggers = o === 'arsenal' ? 3 : 0; st.acted = false; st.aim = false;
      const kind = { hospital: 'госпиталь', arsenal: 'арсенал' }[o] || 'пустая клетка';
      st.msg = { kind: 'start', text: 'ведущий поставил тебя в клетку: ' + kind + '. Где ты — неизвестно.' };
      st.hint = { kind: 'start', text: 'Ты не знаешь, где стоишь: лист А не привязан к карте. Ходи, записывай и сопоставляй. Ведущий говорит только о типе клетки.' };
      return st;
    });
    D = { players, turn: 0, tpos: w.treasure, carrier: null, winner: null, news: [[], []] };
    S = players[0]; screen = 'handoff'; render();
  }
  function endTurn() {
    if (!D || !S.acted || D.winner !== null) return;
    S.aim = false; S.hint = null;
    D.turn = 1 - D.turn; S = D.players[D.turn]; S.acted = false; S.mode = 'explore'; S.pitFx = false; S.bump = null;
    screen = 'handoff'; render();
  }
  function ready() {
    if (D.news[D.turn].length) { S.msg = { kind: 'pit', text: D.news[D.turn].join(' ') }; D.news[D.turn] = []; }
    screen = 'game'; render();
  }
  function take() {
    if (D) return;
    if (S.mode !== 'explore' || S.won || S.carrying || S.wpos.join(',') !== W.treasure) return;
    set({ carrying: true, taken: true, hint: S.hint && S.hint.kind === 'chest' ? null : S.hint, msg: { kind: 'take', text: 'ларец у тебя. Теперь — к выходу.' } });
  }
  function firstSelectable() {
    const cur = frag(S.cur);
    if (!cur.anchored && !cur.placed) return cur.id;
    const f = S.frags.find((g) => !g.anchored && !g.placed) || S.frags.find((g) => !g.anchored);
    return f ? f.id : null;
  }
  function selectFrag(id) {
    const frags = clone(), f = id ? frag(id, frags) : null;
    if (f && !f.placed && f.tx === null) { const c = center(f); f.tx = c.x; f.ty = c.y; }
    const seen = Object.assign({}, S.seen);
    let hint = S.hint;
    if (f) hint = hintOnce(seen, 'match', 'Двигай кальку крестовиной или нажми клетку. Поворотов нет — ямы не меняют направлений.', hint && hint.kind === 'pit' ? null : hint);
    set({ mode: 'match', sel: id, frags, hidden: false, seen, hint });
  }
  function moveKalka(dx, dy) {
    if (!S.sel) return;
    const frags = clone(), f = frag(S.sel, frags);
    if (f.placed || f.anchored) return;
    const p = clampT(f, f.tx + dx, f.ty + dy); f.tx = p.x; f.ty = p.y;
    set({ frags });
  }
  function placeAt(x, y) {
    if (!S.sel) return;
    const frags = clone(), f = frag(S.sel, frags);
    if (f.placed || f.anchored) return;
    const b = bbox(f), p = clampT(f, x - b.minx, y - b.miny); f.tx = p.x; f.ty = p.y;
    set({ frags });
  }
  const pad = (dx, dy) => { if (S.mode === 'explore') { if (D && S.aim) shoot(dx, dy); else step(dx, dy); } else moveKalka(dx, dy); };
  function togglePin() {
    if (!S.sel) return;
    const frags = clone(), f = frag(S.sel, frags), seen = Object.assign({}, S.seen);
    let hint = S.hint;
    if (f.placed) { f.placed = false; f.tx = f.ox; f.ty = f.oy; }
    else { f.placed = true; f.ox = f.tx; f.oy = f.ty; hint = hintOnce(seen, 'pin', 'Гипотеза закреплена. Приложение её не подтверждает — проверь ходом.', hint && hint.kind === 'match' ? null : hint); }
    set({ frags, seen, hint, hidden: false });
  }
  function putAway() {
    if (!S.sel) return;
    const frags = clone(), f = frag(S.sel, frags);
    if (f.placed) { f.placed = false; f.tx = f.ox; f.ty = f.oy; }
    set({ frags, sel: null, hidden: false });
  }
  function scheme(exclude) {
    const R = { cells: {}, walls: {}, pass: {}, obj: {} };
    S.frags.forEach((f) => {
      if (!f.placed || f.id === exclude) return;
      Object.keys(f.cells).forEach((k) => { const p = kv(k); R.cells[(p[0] + f.ox) + ',' + (p[1] + f.oy)] = 1; });
      Object.keys(f.obj).forEach((k) => { const p = kv(k); R.obj[(p[0] + f.ox) + ',' + (p[1] + f.oy)] = f.obj[k]; });
      Object.keys(f.walls).forEach((e) => { R.walls[shiftEdge(e, f.ox, f.oy)] = 1; });
      Object.keys(f.pass).forEach((e) => { R.pass[shiftEdge(e, f.ox, f.oy)] = 1; });
    });
    return R;
  }
  function cycleSheet(d) {
    if (S.mode !== 'match') return;
    const list = S.frags.filter((f) => !f.anchored); if (!list.length) return;
    const i = list.findIndex((f) => f.id === S.sel);
    selectFrag(list[(i + d + list.length) % list.length].id);
  }

  /* ---------- геометрия ---------- */
  const bar = (e, ox, oy, th) => { const p = xy(e), x = p[0] + ox, y = p[1] + oy; return e[0] === 'h' ? { l: x * C - 1, t: y * C - th / 2, w: C + 2, h: th } : { l: x * C - th / 2, t: y * C - 1, w: th, h: C + 2 }; };
  const route = (e, ox, oy) => { const p = xy(e), x = p[0] + ox, y = p[1] + oy; return e[0] === 'h' ? { l: x * C + C / 2 - 1, t: (y - 1) * C + C / 2, w: 2, h: C } : { l: (x - 1) * C + C / 2, t: y * C + C / 2 - 1, w: C, h: 2 }; };
  const box = (r, style) => `<div class="abs" style="left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px;${style}"></div>`;

  /* ---------- экран партии ---------- */
  function gameHTML() {
    const s = S, isMatch = s.mode === 'match', isExplore = !isMatch;
    const cur = frag(s.cur), sel = s.sel ? frag(s.sel) : null;
    let cellsH = '', routesH = '', wallsH = '', objsH = '', framesH = '';
    const draw = (f, ox, oy, hyp) => {
      Object.keys(f.cells).forEach((k) => {
        const p = kv(k), anim = isExplore && s.lastNew === f.id + ':' + k ? 'reveal 260ms ease-out' : 'none';
        cellsH += `<div class="abs" style="left:${(p[0] + ox) * C}px;top:${(p[1] + oy) * C}px;width:56px;height:56px;background:#EFE3C5;box-shadow:inset 0 0 0 .5px rgba(38,50,56,.22),inset 0 0 0 56px ${hyp ? 'rgba(78,170,161,.12)' : 'rgba(0,0,0,0)'};background-image:${hyp ? 'repeating-linear-gradient(135deg,rgba(46,127,120,.16) 0 2px,rgba(0,0,0,0) 2px 8px)' : 'none'};animation:${anim}"></div>`;
      });
      Object.keys(f.pass).forEach((e) => { routesH += box(route(e, ox, oy), `background:${hyp ? 'rgba(46,127,120,.75)' : 'rgba(197,154,73,.55)'};border-radius:1px;pointer-events:none`); });
      Object.keys(f.walls).forEach((e) => { wallsH += box(bar(e, ox, oy, 6), `background:${hyp ? '#1F5E59' : '#141C1F'};border-radius:2px;box-shadow:0 0 0 1.5px #EFE3C5,0 0 0 3px rgba(11,23,25,.35);pointer-events:none`); });
      Object.keys(f.obj).forEach((k) => {
        const p = kv(k), kind = f.obj[k];
        objsH += `<div class="abs" style="left:${(p[0] + ox) * C + 14}px;top:${(p[1] + oy) * C + 14}px;width:28px;height:28px;opacity:${kind === 'chest' && s.taken ? .4 : 1};border-radius:50%;box-shadow:${hyp ? '0 0 0 2px #EFE3C5,0 0 0 3.5px #2E7F78' : 'none'};pointer-events:none">${objIcon(kind, 28, {}, 1.8)}</div>`;
      });
    };
    const curOff = { x: cur.ox, y: cur.oy };
    let onSheet = false;
    if (isExplore && !cur.placed) { onSheet = true; const c = center(cur); curOff.x = c.x; curOff.y = c.y; draw(cur, c.x, c.y, false); }
    else {
      S.frags.filter((f) => f.placed && !f.anchored).concat(S.frags.filter((f) => f.anchored)).forEach((f) => {
        draw(f, f.ox, f.oy, !f.anchored);
        if (!f.anchored) {
          const b = bbox(f), isSel = isMatch && sel && sel.id === f.id;
          framesH += `<div class="abs" style="left:${(b.minx + f.ox) * C}px;top:${(b.miny + f.oy) * C}px;width:${b.w * C}px;height:${b.h * C}px;border:${isSel ? '2.5px dashed #4EAAA1' : '2px dashed #2E7F78'};border-radius:4px;pointer-events:none"><span class="abs" style="right:2px;bottom:2px;padding:1px 5px;font-size:10px;font-weight:600;line-height:14px;background:#2E5E5A;border-radius:3px;white-space:nowrap">${f.name} · гипотеза</span></div>`;
        }
      });
    }
    let kalkaH = '', conflictH = '', nConf = 0, hasKalka = false;
    if (isMatch && sel && !sel.placed && !sel.anchored) {
      hasKalka = true;
      const b = bbox(sel), t = clampT(sel, sel.tx, sel.ty);
      let kc = '', kr = '', kw = '', ko = '';
      Object.keys(sel.cells).forEach((k) => { const p = kv(k); kc += `<div class="abs" style="left:${(p[0] - b.minx) * C}px;top:${(p[1] - b.miny) * C}px;width:56px;height:56px;background:rgba(78,170,161,.2)"></div>`; });
      Object.keys(sel.pass).forEach((e) => { kr += box(route(e, -b.minx, -b.miny), 'background:rgba(78,170,161,.9);border-radius:1px'); });
      Object.keys(sel.walls).forEach((e) => { kw += box(bar(e, -b.minx, -b.miny, 12), 'border:2px solid #4EAAA1;border-radius:3px;box-shadow:0 0 0 1px rgba(20,40,43,.6)'); });
      Object.keys(sel.obj).forEach((k) => { const p = kv(k); ko += `<div class="abs" style="left:${(p[0] - b.minx) * C + 14}px;top:${(p[1] - b.miny) * C + 14}px;width:28px;height:28px;border-radius:50%;background:rgba(20,40,43,.72);display:flex;align-items:center;justify-content:center">${objIcon(sel.obj[k], 20, { pit: '#7FD0C6', sign: '#7FD0C6', exit: '#7FD0C6', chest: '#7FD0C6' }, 2)}</div>`; });
      kalkaH = `<div class="abs" style="left:${(t.x + b.minx) * C}px;top:${(t.y + b.miny) * C}px;width:${b.w * C}px;height:${b.h * C}px;opacity:${s.hidden ? 0 : s.op};pointer-events:none;transition:left .16s ease-out,top .16s ease-out,opacity .16s ease-out"><div class="abs" style="left:-3px;top:-3px;right:-3px;bottom:-3px;border:1.5px dashed #4EAAA1;border-radius:4px;box-shadow:0 6px 16px rgba(0,0,0,.28)"></div>${kc}${kr}${kw}${ko}<span class="abs" style="left:2px;top:2px;padding:1px 5px;font-size:10px;font-weight:600;line-height:14px;color:#14282B;background:#4EAAA1;border-radius:3px;white-space:nowrap">${sel.name} · примеряется</span></div>`;
      const R = scheme(sel.id), cb = [];
      Object.keys(sel.walls).forEach((e) => { const w = shiftEdge(e, t.x, t.y); if (R.pass[w]) { cb.push(bar(w, 0, 0, 12)); nConf++; } });
      Object.keys(sel.pass).forEach((e) => { const w = shiftEdge(e, t.x, t.y); if (R.walls[w]) { cb.push(bar(w, 0, 0, 12)); nConf++; } });
      Object.keys(sel.cells).forEach((k) => {
        const p = kv(k), wk = (p[0] + t.x) + ',' + (p[1] + t.y);
        if (R.cells[wk] && (R.obj[wk] || '') !== (sel.obj[k] || '')) { conflictH += `<div class="abs" style="left:${(p[0] + t.x) * C}px;top:${(p[1] + t.y) * C}px;width:56px;height:56px;border:2px dashed #B65B48;pointer-events:none"></div>`; nConf++; }
      });
      if (settings.conflicts) cb.forEach((r) => { conflictH += box(r, 'border-radius:3px;background:repeating-linear-gradient(45deg,#B65B48 0 3px,#EFE3C5 3px 5px);box-shadow:0 0 0 1px #B65B48;pointer-events:none'); }); else conflictH = '';
      if (sel.id === cur.id) { curOff.x = t.x; curOff.y = t.y; }
    }
    let hasMarker = isExplore || cur.placed || (hasKalka && sel.id === cur.id);
    if (isMatch && hasKalka && sel.id === cur.id && s.hidden) hasMarker = false;
    const onHyp = !cur.anchored && (cur.placed || (hasKalka && sel.id === cur.id));
    const markerH = hasMarker ? `<div role="img" aria-label="${onHyp ? 'Предполагаемое положение' : 'Ты здесь'}" class="abs" style="left:${(curOff.x + s.lpos[0]) * C + C / 2 - 12}px;top:${(curOff.y + s.lpos[1]) * C + C / 2 - 12}px;width:24px;height:24px;transition:left .15s ease-out,top .15s ease-out;pointer-events:none"><div style="width:24px;height:24px;border-radius:50%;background:${onHyp ? 'rgba(197,154,73,.55)' : '#C59A49'};border:${onHyp ? (s.carrying ? '3px dashed #FFF3D6' : '2px dashed #14282B') : (s.carrying ? '3px solid #FFF3D6' : '2px solid #14282B')};box-shadow:0 0 0 3px rgba(197,154,73,.28),0 2px 6px rgba(0,0,0,.4);animation:${s.bump ? 'bump-' + s.bump + '-' + (s.bumpN % 2) + ' 200ms ease-out' : 'none'}"></div></div>` : '';
    let btns = '';
    if (isMatch) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) btns += `<button type="button" data-act="place" data-a="${x}" data-b="${y}" ${hasKalka ? '' : 'disabled'} aria-label="Поставить кальку в клетку ${x + 1}, ${y + 1}" class="abs" style="left:${x * C}px;top:${y * C}px;width:56px;height:56px;padding:0;margin:0;border:0;background:transparent"></button>`;

    const inv = S.frags.map((f) => {
      const isSel = isMatch && s.sel === f.id, b = bbox(f);
      let st, col;
      if (f.anchored) { st = 'Привязан к выходу'; col = '#A9BDB9'; } else if (f.placed) { st = 'Гипотеза'; col = '#E2B866'; } else if (isSel) { st = 'Примеряется'; col = '#7FD0C6'; } else { st = 'Вне карты'; col = '#E58A76'; }
      const step2 = Math.max(5, Math.floor(8 * Math.min(1, 32 / (Math.max(b.w, b.h) * 8))));
      const mini = Object.keys(f.cells).map((k) => { const p = kv(k); return `<span style="position:absolute;display:block;left:${(p[0] - b.minx) * step2}px;top:${(p[1] - b.miny) * step2}px;width:6px;height:6px;background:${f.obj[k] === 'chest' ? '#C59A49' : f.obj[k] === 'pit' ? '#B65B48' : '#EFE3C5'};border-radius:1px"></span>`; }).join('');
      return `<button type="button" data-act="pick" data-a="${f.id}" ${f.anchored ? 'disabled' : ''} aria-pressed="${isSel}" style="border:${isSel ? '2px solid #4EAAA1' : '1px solid #34504E'};background:${isSel ? '#1F3D3F' : '#182F32'};cursor:${f.anchored ? 'default' : 'pointer'}"><span aria-hidden="true" style="position:relative;display:block;flex:none;width:${b.w * step2}px;height:${b.h * step2}px">${mini}</span><span style="display:flex;flex-direction:column;gap:1px;min-width:0"><span class="serif" style="display:flex;align-items:center;gap:5px;font-size:16px;font-weight:700;line-height:1.1">${f.name}${f.id === s.cur ? '<span title="Ты здесь" style="width:7px;height:7px;border-radius:50%;background:#C59A49;display:inline-block"></span>' : ''}</span><span style="font-size:10.5px;font-weight:600;line-height:1.25;color:${col}">${st}</span></span></button>`;
    }).join('');

    const msgColors = { hospital: '#E58A76', arsenal: '#E2B866', wall: '#9FB3B0', pit: '#E58A76', chest: '#E2B866', take: '#E2B866', win: '#E2B866', exit: '#7FD0C6', sign: '#7FD0C6' };
    const atTreasure = s.wpos.join(',') === W.treasure && !s.carrying;
    const canPad = isExplore ? !s.won && !(D && s.acted) : hasKalka;
    let stA, stB, stC = '#A9BDB9';
    if (isExplore) { stA = 'Лист ' + cur.name + (cur.anchored ? ' · точно на карте' : cur.placed ? ' · гипотеза на карте' : ' · вне карты'); stB = 'клеток записано: ' + Object.keys(cur.cells).length; }
    else if (!sel) { stA = 'Сопоставление'; stB = S.frags.some((f) => !f.anchored) ? 'выбери лист в инвентаре' : 'пока всё на одном листе'; }
    else if (sel.placed) { stA = sel.name + ' · гипотеза закреплена'; stB = 'сними закрепление, чтобы двигать'; }
    else { stA = sel.name + ' · калька'; stB = !settings.conflicts ? 'проверка выключена' : nConf ? 'противоречий в записях: ' + nConf : 'противоречий нет — это не подтверждение'; if (settings.conflicts && nConf) stC = '#E58A76'; }
    const tagText = isMatch ? 'Сопоставление · персонаж стоит' : onSheet ? 'Лист ' + cur.name + ' · вне карты' : (S.frags.some((f) => f.placed && !f.anchored) ? 'Карта · рамка и штриховка — место под вопросом' : 'Карта');
    const sub = cur.anchored ? 'Лист привязан к выходу — его место на карте известно.' : cur.placed ? 'Лист закреплён как гипотеза. Проверяй её ходами.' : 'Место листа неизвестно. Сопоставь его с картой.';
    const aim = D && s.aim && isExplore, pbg = aim ? '#4A2A26' : isExplore ? '#2C3A30' : '#1D4441', pbd = aim ? '#B65B48' : isExplore ? '#6B5A33' : '#3E7C75';
    const pb = (a, n, lbl) => `<button type="button" data-act="${a}" ${canPad ? '' : 'disabled'} aria-label="${lbl}" style="background:${pbg};border:1px solid ${pbd};opacity:${canPad ? 1 : .4}">${arrow(n)}</button>`;
    const sp = (isMatch ? sel : null);
    const selOff = !sel;
    const ops = [[1, '100%'], [0.7, '70%'], [0.4, '40%']].map((o) => `<button type="button" data-act="op" data-a="${o[0]}" aria-pressed="${s.op === o[0]}" style="flex:1 1 0;min-width:0;height:44px;padding:0;font-size:13px;font-weight:600;border-radius:8px;border:1px solid #3B5C5A;background:${s.op === o[0] ? '#4EAAA1' : '#1B3437'};color:${s.op === o[0] ? '#14282B' : '#EFE3C5'}">${o[1]}</button>`).join('');
    const sbtn = (act, label, extra, st) => `<button type="button" data-act="${act}" ${selOff ? 'disabled' : ''} ${extra || ''} style="flex:1 1 0;min-width:0;height:44px;padding:0 6px;font-size:13px;font-weight:500;border-radius:8px;border:1px solid #3B5C5A;background:#1B3437;color:#EFE3C5;opacity:${selOff ? .4 : 1};${st || ''}">${label}</button>`;
    const pinned = sel && sel.placed;
    const nxt = D ? 2 - D.turn : 0;
    const duelSide = D ? `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px"><div class="card" style="display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:600">Лист ${cur.name} · ${s.wounded ? '<span style="color:#E58A76">ранен</span>' : 'здоров'}</span><span style="font-size:11.5px;line-height:1.3;color:#C9D6D3">Пули: ${s.bullets} · кинжалы: ${s.daggers}</span></div>${s.acted ? '' : `<div class="row" style="gap:6px"><button type="button" data-act="aim" aria-pressed="${!!s.aim}" style="flex:1 1 0;min-width:0;height:44px;padding:0 6px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid ${s.aim ? '#B65B48' : '#3B5C5A'};background:${s.aim ? '#B65B48' : '#1B3437'};color:#EFE3C5">Выстрел</button><button type="button" data-act="dagger" style="flex:1 1 0;min-width:0;height:44px;padding:0 6px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid #3B5C5A;background:#1B3437;color:#EFE3C5">Кинжал</button></div><button type="button" data-act="skip" class="btn" style="height:44px">Пропустить ход</button>`}</div>` : '';
    const side = D && isExplore ? duelSide : isExplore
      ? `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px"><div class="card" style="height:88px;display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:600">Ты на листе ${cur.name}</span><span style="font-size:11.5px;line-height:1.3;color:#C9D6D3">${sub}</span></div><button type="button" data-act="take" ${!atTreasure ? 'disabled' : ''} style="height:44px;font-size:14px;font-weight:600;border-radius:8px;border:0;background:#C59A49;color:#14282B;opacity:${atTreasure ? 1 : .35}">Взять клад</button></div>`
      : `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px"><div role="group" aria-label="Непрозрачность кальки" style="display:flex;gap:4px;align-items:center"><span style="font-size:12px;color:#A9BDB9;width:34px;flex:none">Слой</span>${ops}</div><div class="row" style="gap:6px">${sbtn('hide', s.hidden ? 'Показать' : 'Скрыть', `aria-pressed="${s.hidden}"`)}${sbtn('away', 'Убрать')}</div><button type="button" data-act="pin" ${selOff ? 'disabled' : ''} style="height:44px;font-size:14px;font-weight:600;border-radius:8px;border:${pinned ? '1px solid #6B5A33' : '0'};background:${pinned ? '#1B3437' : '#C59A49'};color:${pinned ? '#E2B866' : '#14282B'};opacity:${selOff ? .4 : 1}">${pinned ? 'Снять закрепление' : 'Закрепить гипотезу'}</button></div>`;
    const showHint = settings.coach && s.hint && !s.won;
    const ring = isMatch ? '0 0 0 3px #4EAAA1' : '0 0 0 0 rgba(0,0,0,0)';

    return `<div class="screen">
<header style="display:flex;justify-content:space-between;align-items:center;height:44px;gap:12px;flex:none">
<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="eyebrow">${D ? 'Дуэль · ход игрока ' + (D.turn + 1) : 'Экспедиция №1'}</span><h1 class="serif" style="margin:0;font-size:24px;line-height:1.1">${D ? 'Игрок ' + (D.turn + 1) : 'Лабиринт'}</h1></div>
<div style="display:flex;align-items:center;gap:10px"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;color:#C9D6D3"><span>Ход ${s.moves}</span><span style="color:${s.carrying ? '#E2B866' : '#C9D6D3'};font-weight:${s.carrying ? 600 : 400}">${D && s.wounded ? 'Ранен · ' : ''}${s.carrying ? 'Несу клад' : 'Клада нет'}</span></div>
<button type="button" data-act="pause" aria-label="Пауза и настройки" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#1B3437;border:1px solid #2F4D4C;color:#EFE3C5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6v12"/><path d="M15 6v12"/></svg></button></div></header>
<section aria-label="Ответ ведущего" aria-live="polite" class="card" style="display:flex;gap:10px;align-items:flex-start;height:60px;border-color:${s.msg.kind === 'pit' ? '#B65B48' : (s.msg.kind === 'chest' || s.msg.kind === 'take') ? '#C59A49' : '#2F4D4C'};flex:none"><span aria-hidden="true" style="flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;background:${msgColors[s.msg.kind] || '#7FD0C6'}"></span><p style="margin:0;font-size:13px;line-height:1.35"><span style="font-weight:600">Ведущий:</span> ${s.msg.text}</p></section>
<div class="sheet" style="box-shadow:${ring},0 12px 32px rgba(0,0,0,.4)"><div class="board" role="group" aria-label="${isMatch ? 'Карта и калька для сопоставления' : onSheet ? 'Отдельный лист без привязки к карте' : 'Карта экспедиции'}">
${cellsH}${routesH}${wallsH}${objsH}${framesH}${kalkaH}${conflictH}${markerH}${btns}
<span class="abs" style="left:6px;top:6px;padding:2px 7px;font-size:11px;font-weight:600;line-height:16px;color:${isMatch ? '#14282B' : '#EFE3C5'};background:${isMatch ? '#4EAAA1' : onSheet ? '#B65B48' : '#263238'};border-radius:4px;pointer-events:none">${tagText}</span>
<div aria-hidden="true" style="position:absolute;inset:0;background:#0B1719;opacity:${s.pitFx ? .92 : 0};transition:opacity .32s ease-out;pointer-events:none;display:flex;align-items:center;justify-content:center"><span class="serif" style="font-size:20px;color:#E58A76">Ты потерял ориентир</span></div>
${showHint ? `<div class="toast"><p style="margin:0;flex:1 1 auto;font-size:12.5px;line-height:1.35">${s.hint.text}</p><button type="button" data-act="hint">Понятно</button></div>` : ''}
</div></div>
<p role="status" style="margin:-2px 0 0;font-size:12.5px;line-height:18px;color:#C9D6D3;height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none">${stA} · <span style="color:${stC};font-weight:600">${stB}</span></p>
<div class="inv" role="group" aria-label="Инвентарь листов">${inv}</div>
<div class="seg" role="group" aria-label="Режим"><button type="button" data-act="explore" aria-pressed="${isExplore}" style="background:${isExplore ? '#C59A49' : 'transparent'};color:${isExplore ? '#14282B' : '#C9D6D3'}">Исследовать</button><button type="button" data-act="match" aria-pressed="${isMatch}" style="background:${isMatch ? '#4EAAA1' : 'transparent'};color:${isMatch ? '#14282B' : '#C9D6D3'}">Сопоставлять</button></div>
<div style="display:flex;gap:12px;align-items:flex-start;flex:none"><div class="pad" role="group" aria-label="${isExplore ? 'Ход персонажа' : 'Сдвиг кальки на одну клетку'}"><span></span>${pb('up', 'up', 'Вверх')}<span></span>${pb('left', 'left', 'Влево')}<span aria-hidden="true" style="height:44px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;color:${aim ? '#E58A76' : isExplore ? '#E2B866' : '#7FD0C6'};text-transform:uppercase;letter-spacing:.06em">${aim ? 'Огонь' : isExplore ? 'Ход' : 'Калька'}</span>${pb('right', 'right', 'Вправо')}<span></span>${pb('down', 'down', 'Вниз')}<span></span></div>${side}</div>
${D && s.acted ? `<button type="button" data-act="endTurn" class="btn primary" style="flex:none">Передать ход игроку ${nxt}</button>` : ''}
</div>`;
  }

  /* ---------- старт ---------- */
  function startHTML() {
    const saved = LS.get('lab.save', null);
    const item = (bg, bd, ic, t, d) => `<li style="display:flex;gap:12px;align-items:flex-start"><span aria-hidden="true" style="flex:none;width:32px;height:32px;border-radius:8px;background:${bg};border:1px solid ${bd};display:flex;align-items:center;justify-content:center">${ic}</span><span style="font-size:14px;line-height:1.4"><span style="font-weight:600">${t}</span> ${d}</span></li>`;
    const st = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    return `<div class="screen" style="padding:24px 20px;gap:20px">
<div style="display:flex;justify-content:space-between;align-items:center;height:44px"><span class="eyebrow">Экспедиция №1</span><button type="button" data-act="settings" class="btn">Настройки</button></div>
<div style="position:relative;height:230px;display:flex;align-items:center;justify-content:center"><svg width="230" height="230" viewBox="0 0 230 230" aria-hidden="true" style="transform:rotate(-4deg)"><rect x="15" y="15" width="200" height="200" rx="3" fill="#EFE3C5"/><g stroke="rgba(38,50,56,.18)"><path d="M48 15v200M81 15v200M114 15v200M147 15v200M180 15v200M15 48h200M15 81h200M15 114h200M15 147h200M15 180h200"/></g><rect x="114" y="15" width="101" height="200" fill="#1C3538"/><rect x="15" y="147" width="99" height="68" fill="#1C3538"/><g stroke="#263238" stroke-width="4" stroke-linecap="round" fill="none"><path d="M15 48h33M48 48v33M81 15v66M15 114h66M81 114v33M48 147h66"/></g><g stroke="rgba(197,154,73,.8)" stroke-width="2" stroke-dasharray="3 4" fill="none"><path d="M31 131H64V64H97V131"/></g><circle cx="97" cy="131" r="9" fill="#C59A49" stroke="#14282B" stroke-width="2"/></svg></div>
<div style="display:flex;flex-direction:column;gap:10px"><h1 class="serif" style="margin:0;font-size:44px;line-height:1">Лабиринт</h1><p class="serif" style="margin:0;font-style:italic;font-size:16px;line-height:1.45;color:#DCD2B6">Предыдущая экспедиция не вернулась. Остался обрывок карты и запись на полях: «Ямы уводят, но не разворачивают».</p></div>
<ol style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
${item('#2C3A30', '#6B5A33', `<svg ${st} stroke="#E2B866"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`, 'Исследуй.', 'Ходи на одну клетку. Всё, что узнаёшь, записывается на лист само.')}
${item('#1D4441', '#3E7C75', `<svg ${st} stroke="#7FD0C6"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>`, 'Сопоставляй.', 'Яма уносит на новый лист. Где он на карте — решаешь ты.')}
${item('#2C3A30', '#6B5A33', `<svg ${st} stroke="#E2B866"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10a9 5 0 0 1 18 0"/></svg>`, 'Вынеси ларец.', 'Найди его, возьми и выйди тем же выходом.')}
</ol>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
<button type="button" data-act="duel" class="btn" style="height:48px;font-size:15px;border-color:#B65B48">Дуэль вдвоём · на одном экране</button>
${saved ? `<button type="button" data-act="resume" class="btn primary">Продолжить · ход ${saved.moves}</button><button type="button" data-act="new" class="btn" style="height:48px;font-size:15px">Начать заново</button>` : `<button type="button" data-act="new" class="btn primary">Начать экспедицию</button>`}
<p style="margin:0;text-align:center;font-size:12px;color:#A9BDB9">Поле 6 × 6 · стрелки или WASD, на телефоне — крестовина</p></div></div>`;
  }

  function handoffHTML() {
    const n = D.turn + 1, first = D.players[0].moves === 0 && D.players[1].moves === 0 && D.turn === 0;
    return `<div class="screen" style="justify-content:center;align-items:center;text-align:center;gap:18px;padding:32px 24px">
<span class="eyebrow">Дуэль · ведущий — игра</span>
<h1 class="serif" style="margin:0;font-size:34px;line-height:1.15">Ход игрока ${n}</h1>
<p style="margin:0;font-size:14px;line-height:1.5;color:#C9D6D3;max-width:300px">${first ? 'Лабиринт создан и скрыт. Каждый игрок стоит в своей клетке и не знает, где находится. Ходите по очереди, передавая устройство: ведущий говорит только о типе клетки и о ранениях. Победит тот, кто вынесет клад.' : 'Передай устройство игроку ' + n + '. Следующий игрок нажимает кнопку, только когда предыдущий отвернулся.'}</p>
<button type="button" data-act="ready" class="btn primary" style="width:100%;max-width:300px">Я игрок ${n}</button>
<p style="margin:0;font-size:12px;color:#A9BDB9;max-width:300px">Ход: шаг, выстрел, кинжал или пропуск. Упёрся в стену — ход потрачен. Сопоставлять листы можно без траты хода.</p></div>`;
  }

  /* ---------- пауза и настройки ---------- */
  function settingsHTML() {
    const sw = (k, label, sub) => `<div style="display:flex;justify-content:space-between;align-items:center;min-height:52px;gap:12px"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px">${label}</span><span style="font-size:12px;line-height:1.35;color:#A9BDB9">${sub}</span></span><button type="button" role="switch" aria-checked="${settings[k]}" aria-label="${label}" data-act="sw" data-a="${k}" class="sw" style="background:${settings[k] ? '#4EAAA1' : '#3B4A4C'};justify-content:${settings[k] ? 'flex-end' : 'flex-start'}"><i></i></button></div>`;
    const hostPause = !!HS && prevScreen === 'hostGame';
    const inGame = hostPause || (S && !S.won && prevScreen === 'game');
    return `<div class="screen" style="padding:16px 20px;gap:16px">
<header style="display:flex;justify-content:space-between;align-items:center;height:44px"><h1 class="serif" style="margin:0;font-size:26px">${inGame ? 'Пауза' : 'Настройки'}</h1>${inGame && !hostPause ? `<span style="font-size:12px;color:#A9BDB9">Ход ${S.moves} · партия сохранена</span>` : ''}</header>
<nav aria-label="Партия" style="display:flex;flex-direction:column;gap:8px">
${inGame ? `<button type="button" data-act="back" class="btn primary">Продолжить</button><div class="row"><button type="button" data-act="restart" class="btn flex">Начать заново</button><button type="button" data-act="menu" class="btn flex">Выйти в меню</button></div>` : `<button type="button" data-act="back" class="btn primary">Назад</button>`}
</nav>
<section aria-labelledby="gm" class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><h2 id="gm" style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A9BDB9;font-weight:600">Игра и экран</h2>
${sw('motion', 'Меньше анимации', 'Без тряски, вспышек и долгих переходов')}${sw('conflicts', 'Подсвечивать противоречия', 'Только между твоими записями, не по скрытой карте')}${sw('coach', 'Подсказки обучения', 'Короткие пояснения в первой партии')}</section>
${hostSettingsHTML(sw)}
<section aria-labelledby="rl" class="card" style="padding:12px 14px;font-size:13px;line-height:1.5;color:#C9D6D3"><h2 id="rl" style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A9BDB9;font-weight:600">Правила</h2>
Ход — на одну клетку. Стена: ты стоишь, ход засчитан. Ямы связаны в цикл и уносят на новый лист без привязки. Сопоставление — только сдвиг, без поворотов; закрепление — твоя гипотеза, приложение её не подтверждает. Победа: взять ларец и выйти через выход.</section>
<p style="margin:auto 0 0;font-size:12px;color:#A9BDB9;text-align:center">Клавиши: <kbd>←↑→↓</kbd> / <kbd>WASD</kbd> · <kbd>M</kbd> режим · <kbd>F</kbd> взять · <kbd>Space</kbd> закрепить · <kbd>H</kbd> скрыть · <kbd>Q</kbd><kbd>E</kbd> листы · <kbd>Esc</kbd> пауза</p>
${hostLegendHTML()}</div>`;
  }

  /* ---------- итоги ---------- */
  function endHTML() {
    const showTruth = endView !== 'mine', showMine = endView !== 'truth';
    const visited = new Set();
    S.frags.forEach((f) => Object.keys(f.cells).forEach((k) => { const p = kv(k); visited.add((p[0] + f.tw[0]) + ',' + (p[1] + f.tw[1])); }));
    // клетки листа А хранятся в мировых координатах (tw = 0,0)
    let cells = '', walls = '', objs = '', frames = '';
    const trueObjs = {}; W.pits.forEach((k) => { trueObjs[k] = 'pit'; }); Object.keys(W.objs).forEach((k) => { trueObjs[k] = W.objs[k]; }); trueObjs[W.treasure] = 'chest'; trueObjs[W.exitCell] = 'exit';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const k = x + ',' + y, v = visited.has(k);
      let bg = '#1C3538';
      if (showTruth && showMine) bg = v ? '#E6CF97' : '#EFE3C5'; else if (showTruth) bg = '#EFE3C5'; else if (v) bg = '#EFE3C5';
      cells += `<div class="abs" style="left:${x * C}px;top:${y * C}px;width:56px;height:56px;background:${bg};box-shadow:inset 0 0 0 .5px rgba(38,50,56,.18)"></div>`;
      const edges = [['h', x, y], ['v', x, y]];
      if (y === 5) edges.push(['h', x, 6]);
      if (x === 5) edges.push(['v', 6, y]);
      edges.forEach((e) => {
        const key = e[0] + ':' + e[1] + ',' + e[2];
        if (W.pass.has(key) || key === W.exitEdge) return;
        if (!showTruth) {
          const a = e[0] === 'h' ? [e[1], e[2] - 1] : [e[1] - 1, e[2]], b = [e[1], e[2]];
          if (!visited.has(a.join(',')) && !visited.has(b.join(','))) return;
        }
        const r = e[0] === 'h' ? { l: e[1] * C - 1, t: e[2] * C - 3, w: C + 2, h: 6 } : { l: e[1] * C - 3, t: e[2] * C - 1, w: 6, h: C + 2 };
        walls += box(r, 'background:#141C1F;border-radius:2px;box-shadow:0 0 0 1.5px #EFE3C5,0 0 0 3px rgba(11,23,25,.35)');
      });
    }
    Object.keys(trueObjs).forEach((k) => { if (!showTruth && !visited.has(k)) return; const p = kv(k); objs += `<div class="abs" style="left:${p[0] * C + 14}px;top:${p[1] * C + 14}px;width:28px;height:28px">${objIcon(trueObjs[k], 28, { pit: '#B65B48', exit: '#263238' }, 1.8)}</div>`; });
    let right = 0, wrong = 0;
    S.frags.filter((f) => !f.anchored && f.placed).forEach((f) => {
      const ok = f.ox === f.tw[0] && f.oy === f.tw[1], b = bbox(f);
      if (ok) right++; else wrong++;
      if (showMine) {
        frames += `<div class="abs" style="left:${(b.minx + f.ox) * C}px;top:${(b.miny + f.oy) * C}px;width:${b.w * C}px;height:${b.h * C}px;border:2px ${ok ? 'solid #4EAAA1' : 'dashed #E58A76'};border-radius:4px"><span class="abs" style="left:2px;top:2px;padding:1px 5px;font-size:10px;font-weight:600;line-height:14px;color:${ok ? '#14282B' : '#FFF6EE'};background:${ok ? '#4EAAA1' : '#B65B48'};border-radius:3px;white-space:nowrap">${f.name} · ${ok ? 'верно' : 'ошибка'}</span></div>`;
        if (!ok && showTruth) frames += `<div class="abs" style="left:${(b.minx + f.tw[0]) * C + 3}px;top:${(b.miny + f.tw[1]) * C + 3}px;width:${b.w * C - 6}px;height:${b.h * C - 6}px;border:2px dotted #2E7F78;border-radius:4px"><span class="abs" style="left:2px;bottom:2px;padding:1px 5px;font-size:10px;font-weight:600;line-height:14px;color:#EFE3C5;background:#2E7F78;border-radius:3px;white-space:nowrap">${f.name} на самом деле</span></div>`;
      }
    });
    const unplaced = S.frags.filter((f) => !f.anchored && !f.placed).length;
    const views = [['both', 'Обе'], ['truth', 'Настоящая'], ['mine', 'Моя карта']].map((v) => `<button type="button" data-act="view" data-a="${v[0]}" aria-pressed="${endView === v[0]}" style="background:${endView === v[0] ? '#C59A49' : 'transparent'};color:${endView === v[0] ? '#14282B' : '#C9D6D3'}">${v[1]}</button>`).join('');
    const lg = (st, t) => `<li style="display:flex;align-items:center;gap:8px"><span aria-hidden="true" style="width:16px;height:12px;border-radius:2px;${st}"></span>${t}</li>`;
    return `<div class="screen" style="gap:12px">
<header style="display:flex;flex-direction:column;gap:4px;flex:none"><span class="eyebrow">${D ? 'Дуэль · листы игрока ' + (endPlayer + 1) : 'Итоги партии'}</span><h1 class="serif" style="margin:0;font-size:30px;line-height:1.1">${D ? 'Победил игрок ' + (D.winner + 1) : 'Ларец вынесен'}</h1><p style="margin:0;font-size:13px;color:#C9D6D3">${S.moves} ходов · ${S.frags.length} ${S.frags.length === 1 ? 'лист' : 'лист' + (S.frags.length < 5 ? 'а' : 'ов')} · гипотез ${right + wrong}${right + wrong ? ', верных ' + right : ''}${unplaced ? ' · не закреплено листов: ' + unplaced : ''}</p></header>
${D ? `<div class="seg" role="group" aria-label="Чьи листы показать">${[0, 1].map((i) => `<button type="button" data-act="player" data-a="${i}" aria-pressed="${endPlayer === i}" style="background:${endPlayer === i ? '#4EAAA1' : 'transparent'};color:${endPlayer === i ? '#14282B' : '#C9D6D3'}">Игрок ${i + 1}</button>`).join('')}</div>` : ''}<div class="seg" role="group" aria-label="Что показать на карте">${views}</div>
<div class="sheet" style="box-shadow:0 12px 32px rgba(0,0,0,.4)"><div class="board" role="img" aria-label="${endView === 'mine' ? 'Твоя карта с гипотезами' : endView === 'truth' ? 'Настоящая карта лабиринта' : 'Настоящая карта поверх твоей'}">${cells}${walls}${objs}${frames}</div></div>
<ul style="margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;font-size:12px;color:#C9D6D3;flex:none">${lg('background:#E6CF97', 'Где ты побывал')}${lg('border:2px solid #4EAAA1', 'Гипотеза верна')}${lg('border:2px dashed #E58A76', 'Ошибочная гипотеза')}${lg('border:2px dotted #7FD0C6', 'Где лист на самом деле')}</ul>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><button type="button" data-act="${D ? 'duel' : 'new'}" class="btn primary">Сыграть ещё</button><div class="row">${D ? '' : `<button type="button" data-act="atlas" class="btn flex">${endSaved ? 'В атласе ✓' : 'В атлас'}</button>`}<button type="button" data-act="menu" class="btn flex">В меню</button></div></div></div>`;
  }

  /* ---------- рендер и события ---------- */
  function render() {
    document.body.classList.toggle('calm', settings.motion);
    const f = document.activeElement, key = f && f.dataset && f.dataset.act ? f.dataset.act + '|' + (f.dataset.a || '') + '|' + (f.dataset.b || '') : null;
    app.innerHTML = screen === 'handoff' ? handoffHTML() : screen === 'start' ? startHTML() + chooserHTML() : screen === 'settings' ? settingsHTML() : screen === 'end' ? endHTML() : screen === 'hostIntro' ? hostIntroHTML() : screen === 'hostGame' ? hostGameHTML() : screen === 'hostEnd' ? hostEndHTML() : gameHTML();
    if (key) { const els = app.querySelectorAll('[data-act]'); for (const el of els) if (el.dataset.act + '|' + (el.dataset.a || '') + '|' + (el.dataset.b || '') === key && !el.disabled) { el.focus({ preventScroll: true }); break; } }
  }
  function newGame() { if (lastMode === 'duel' && D) { newDuel(); return; } D = null; W = SOLO; lastMode = 'solo'; S = initialState(); LS.del('lab.save'); screen = 'game'; render(); persist(); }
  function startSolo() { D = null; W = SOLO; lastMode = 'solo'; newGame(); }
  const A = {
    new: startSolo,
    restart() { if (HS) startHost(); else newGame(); },
    duel() { if (screen === 'end') newDuel(); else openChooser(); }, aim() { if (!D || S.acted) return; set({ aim: !S.aim }); }, dagger, skip, endTurn, ready,
    player(a) { endPlayer = Number(a); S = D.players[endPlayer]; render(); },
    resume() { D = null; W = SOLO; lastMode = 'solo'; S = LS.get('lab.save', null) || initialState(); screen = 'game'; render(); },
    settings() { prevScreen = screen; screen = 'settings'; render(); },
    pause() { prevScreen = 'game'; screen = 'settings'; render(); },
    back() { screen = HS && prevScreen === 'hostGame' ? 'hostGame' : prevScreen === 'game' && S ? 'game' : 'start'; render(); },
    menu() { endHost(); D = null; W = SOLO; lastMode = 'solo'; screen = 'start'; render(); },
    sw(a) { settings[a] = !settings[a]; LS.set('lab.settings', settings); if (a === 'voice' && HS) HS.ctl.voiceChanged(); render(); },
    up: () => pad(0, -1), down: () => pad(0, 1), left: () => pad(-1, 0), right: () => pad(1, 0),
    take, pin: togglePin, away: putAway,
    hide() { set({ hidden: !S.hidden }); },
    hint() { set({ hint: null }); },
    op(a) { set({ op: Number(a), hidden: false }); },
    explore() { set({ mode: 'explore', hidden: false }); },
    match() { if (S.mode !== 'match') selectFrag(firstSelectable()); },
    pick(a) { const f = frag(a); if (f && !f.anchored) selectFrag(a); },
    place(a, b) { placeAt(Number(a), Number(b)); },
    view(a) { endView = a; render(); },
    atlas() { endSaved = true; const at = LS.get('lab.atlas', []); at.push({ moves: S.moves, sheets: S.frags.length, at: Date.now() }); LS.set('lab.atlas', at); render(); }
  };
  /* host:start */
  /* Host-driven duel UI. Text comes from LabHost.t(...) with literal keys only; English comments only.
     Session HS is separate from the classic duel state D, so classic paths are never entered. */
  const t = LabHost.t;
  let HS = null, chooser = false, speaker = null;
  const hostTimers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (i) => clearTimeout(i) };
  const PLAYER = { 1: { col: '#E2B866', shape: '50%' }, 2: { col: '#7FD0C6', shape: '6px' } };
  const KEYDIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  const NOTICES = () => ({ wounded: t('ui.notice.wounded'), noBullets: t('ui.notice.noBullets'), noDaggers: t('ui.notice.noDaggers') });
  const REASONS = () => ({ wounded: t('ui.reason.wounded'), noBullets: t('ui.reason.noBullets'), noDaggers: t('ui.reason.noDaggers') });

  function theSpeaker() {
    if (!speaker) {
      const w = typeof window !== 'undefined' ? window : {};
      speaker = LabHost.createSpeaker({ synth: w.speechSynthesis, Utter: w.SpeechSynthesisUtterance, timers: hostTimers, getRate: () => 1, lang: 'ru-RU', fallbackLang: 'en' });
    }
    return speaker;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', () => { if (HS || screen === 'settings') render(); });
  }

  function endHost() {
    if (HS) { HS.ctl.dispose(); HS = null; }
    chooser = false;
  }
  function startHost() {
    endHost();
    const w = genWorld(3);
    W = w; D = null; lastMode = 'host';
    const spawns = [0, 1].map(() => kv(w.spawn.splice(Math.floor(Math.random() * w.spawn.length), 1)[0]));
    const match = LabHost.createMatch(w, spawns);
    const ctl = LabHost.createController({ match, speaker: theSpeaker(), timers: hostTimers, settings: () => settings, onChange: () => render() });
    HS = { match, ctl, tab: 'map', notice: null };
    screen = 'hostIntro'; render();
  }
  function openChooser() {
    chooser = true; render();
    const el = app.querySelector && app.querySelector('[data-act="duelHost"]');
    if (el && el.focus) el.focus();
  }

  /* run one action attempt: clear the notice, try, show the reason of a rejection (not logged, not spoken) */
  function hostDo(fn) {
    if (!HS) return;
    HS.notice = null;
    const r = fn(HS.ctl);
    if (r && r.ok === false && NOTICES()[r.reason]) HS.notice = r.reason;
    render();
  }
  function hostAim() {
    hostDo((ctl) => {
      if (ctl.phase !== 'idle') return null;
      if (ctl.toggleAim()) return null;
      const la = LabHost.legalActions(HS.match).shoot;
      return la.enabled ? null : { ok: false, reason: la.reason };
    });
  }
  function hostStep(dx, dy) { if (HS && HS.ctl.phase === 'idle') hostDo((ctl) => ctl.dir(dx, dy)); }
  function hostTry(a) { if (HS && HS.ctl.phase === 'idle') hostDo((ctl) => ctl.act(a)); }
  function toggleVoice() {
    settings.voice = !settings.voice; LS.set('lab.settings', settings);
    if (HS) HS.ctl.voiceChanged();
    render();
  }
  function hostPauseOpen() {
    HS.ctl.pause(); prevScreen = 'hostGame'; screen = 'settings'; render();
  }

  Object.assign(A, {
    duelHost() { chooser = false; startHost(); },
    duelClassic() { endHost(); newDuel(); },
    chooserCancel() { chooser = false; render(); },
    hostBegin() { if (HS && screen === 'hostIntro') { screen = 'hostGame'; HS.ctl.begin(); render(); } },
    hUp: () => hostStep(0, -1), hDown: () => hostStep(0, 1), hLeft: () => hostStep(-1, 0), hRight: () => hostStep(1, 0),
    hAim: hostAim,
    hDagger: () => hostTry({ type: 'dagger' }),
    hSkip: () => hostTry({ type: 'skip' }),
    hRepeat() { if (HS) { HS.ctl.repeat(); render(); } },
    hVoice: toggleVoice,
    hPause() { if (HS) hostPauseOpen(); },
    hResults() { if (HS && HS.ctl.phase === 'finished') { HS.tab = 'map'; screen = 'hostEnd'; render(); } },
    hAgain: startHost,
    hTab(a) { if (HS) { HS.tab = a === 'log' ? 'log' : 'map'; render(); } }
  });

  /* keys are read by e.code so they work on any keyboard layout; returns true when the event was consumed */
  function hostKey(e) {
    if (screen === 'start' && chooser) {
      if (e.code === 'Escape' || e.key === 'Escape') { e.preventDefault(); chooser = false; render(); return true; }
      return false;
    }
    if (!HS || screen !== 'hostGame') return false;
    const c = e.code, ctl = HS.ctl, idle = ctl.phase === 'idle', d = KEYDIRS[c];
    if (d) { e.preventDefault(); hostStep(d[0], d[1]); return true; }
    if (c === 'KeyX') { e.preventDefault(); if (idle) hostAim(); return true; }
    if (c === 'KeyK') { e.preventDefault(); hostTry({ type: 'dagger' }); return true; }
    if (c === 'KeyP') { e.preventDefault(); hostTry({ type: 'skip' }); return true; }
    if (c === 'KeyR') { e.preventDefault(); ctl.repeat(); render(); return true; }
    if (c === 'KeyV') { e.preventDefault(); toggleVoice(); return true; }
    if (c === 'Escape') { e.preventDefault(); if (ctl.cancelAim()) render(); else hostPauseOpen(); return true; }
    return false;
  }

  /* ---------- markup ---------- */
  const speakerIcon = (s, off) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/>${off ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 8.5a5 5 0 0 1 0 7"/>'}</svg>`;
  const badge = (p, size) => p
    ? `<span aria-hidden="true" style="flex:none;width:${size}px;height:${size}px;border-radius:${PLAYER[p].shape};background:${PLAYER[p].col};color:#14282B;font-weight:700;font-size:${Math.round(size * 0.55)}px;display:flex;align-items:center;justify-content:center">${p}</span>`
    : `<span aria-hidden="true" style="flex:none;width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid #6B8582;color:#A9BDB9;display:flex;align-items:center;justify-content:center">${speakerIcon(Math.round(size * 0.6))}</span>`;
  const logItem = (e) => `<li style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.35">${badge(e.p, 22)}<span style="min-width:0">${e.text}</span></li>`;
  const voiceBtn = () => `<button type="button" data-act="hVoice" aria-pressed="${settings.voice}" aria-label="${settings.voice ? t('ui.aria.voiceOn') : t('ui.aria.voiceOff')}" style="flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#1B3437;border:1px solid #2F4D4C;color:${settings.voice ? '#EFE3C5' : '#E58A76'}">${speakerIcon(20, !settings.voice)}</button>`;

  function voiceStatusText() {
    const st = theSpeaker().status();
    if (!st.available) return t('ui.set.status.none');
    if (st.how === 'fallback') return t('ui.set.status.fallback', { lang: st.voice.lang });
    return t('ui.set.status.found');
  }

  function chooserHTML() {
    if (!chooser) return '';
    const card = (act, title, sub, bd) => `<button type="button" data-act="${act}" class="card" style="width:100%;min-height:88px;text-align:left;display:flex;flex-direction:column;gap:4px;color:#EFE3C5;border-color:${bd}"><span class="serif" style="font-size:20px;font-weight:700">${title}</span><span style="font-size:13px;line-height:1.4;color:#C9D6D3">${sub}</span></button>`;
    return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="chtitle"><span id="chtitle" class="eyebrow">${t('ui.chooser.title')}</span>${card('duelHost', t('ui.chooser.host.title'), t('ui.chooser.host.sub'), '#C59A49')}${card('duelClassic', t('ui.chooser.classic.title'), t('ui.chooser.classic.sub'), '#B65B48')}<button type="button" data-act="chooserCancel" class="btn" style="width:100%">${t('ui.chooser.cancel')}</button></div>`;
  }

  function hostIntroHTML() {
    return `<div class="screen" style="padding:24px 20px;gap:16px">
<span class="eyebrow">${t('ui.intro.eyebrow')}</span>
<h1 class="serif" style="margin:0;font-size:34px;line-height:1.15">${t('ui.intro.title')}</h1>
<p style="margin:0;font-size:15px;line-height:1.5;color:#C9D6D3">${t('ui.intro.body')}</p>
<section class="card" aria-label="${t('ui.intro.voice')}" style="display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:64px"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">${t('ui.intro.voice')}</span><span role="status" style="font-size:12.5px;line-height:1.35;color:#C9D6D3">${theSpeaker().status().how === 'exact' ? t('ui.intro.voiceOk') : voiceStatusText()}</span></span>${voiceBtn()}</section>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:10px"><button type="button" data-act="hostBegin" class="btn primary">${t('ui.intro.start')}</button><button type="button" data-act="menu" class="btn">${t('ui.btn.menu')}</button></div></div>`;
  }

  function hostGameHTML() {
    const m = HS.match, ctl = HS.ctl, ph = ctl.phase, idle = ph === 'idle', over = m.winner !== null, aim = ctl.aim && idle;
    const pn = m.turn + 1, me = m.players[m.turn], la = LabHost.legalActions(m), pc = aim ? '#B65B48' : PLAYER[pn].col;
    const chips = [me.wounded ? t('ui.status.woundedNoTreasure') : t('ui.status.healthy'), t('ui.bullets', { n: me.bullets }), t('ui.daggers', { n: me.daggers })];
    if (me.carrying) chips.push(t('ui.status.carrying'));
    const state = ph === 'speaking' ? `<span style="display:flex;align-items:center;gap:6px;color:#E2B866">${speakerIcon(16)}${t('ui.speaking')}</span>` : aim ? `<span style="color:#E58A76">${t('ui.banner.aim')}</span>` : over ? `<span>${t('ui.banner.over')}</span>` : '';
    const latest = m.log[m.log.length - 1], older = m.log.slice(0, -1).reverse();
    const reasons = REASONS();

    const pbg = aim ? '#4A2A26' : '#1B3437', pbd = aim ? '#B65B48' : '#3B5C5A';
    const pad = (act, icon, label, shootLabel) => `<button type="button" data-act="${act}"${idle ? '' : ' disabled'} aria-label="${aim ? shootLabel : label}" style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;border-radius:10px;color:#EFE3C5;background:${pbg};border:1px solid ${pbd};opacity:${idle ? 1 : .4}">${arrow(icon)}</button>`;
    const abtn = (act, label, st, extra, style) => {
      const on = idle && st.enabled, why = idle && !st.enabled ? reasons[st.reason] : '';
      return `<button type="button" data-act="${act}"${on ? '' : ' disabled'}${extra || ''} style="width:100%;height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0 8px;border-radius:8px;font-size:14px;font-weight:600;color:#EFE3C5;${style}"><span style="opacity:${on ? 1 : .4}">${label}</span>${why ? `<span style="font-size:11px;line-height:1.1;font-weight:500;color:#E58A76">${why}</span>` : ''}</button>`;
    };
    const controls = over
      ? `<button type="button" data-act="hResults" class="btn primary"${ph === 'finished' ? '' : ' disabled'} style="flex:none;opacity:${ph === 'finished' ? 1 : .4}">${t('ui.btn.results')}</button>`
      : `<div class="hctl" style="display:flex;gap:24px;align-items:flex-start;justify-content:center;flex:none">
<div role="group" aria-label="${t('ui.aria.pad')}" style="display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:6px;flex:none"><span></span>${pad('hUp', 'up', t('ui.aria.up'), t('ui.aria.shootUp'))}<span></span>${pad('hLeft', 'left', t('ui.aria.left'), t('ui.aria.shootLeft'))}<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#E58A76">${aim ? t('ui.pad.fire') : ''}</span>${pad('hRight', 'right', t('ui.aria.right'), t('ui.aria.shootRight'))}<span></span>${pad('hDown', 'down', t('ui.aria.down'), t('ui.aria.shootDown'))}<span></span></div>
<div class="hact" role="group" aria-label="${t('ui.aria.actions')}" style="display:flex;flex-direction:column;gap:16px;width:166px;flex:none">${abtn('hDagger', t('ui.btn.dagger'), la.dagger, '', 'background:#1B3437;border:1px solid #B65B48')}${abtn('hAim', t('ui.btn.shoot'), la.shoot, ` aria-pressed="${aim}"`, `background:${aim ? '#B65B48' : '#1B3437'};border:1px solid ${aim ? '#B65B48' : '#3B5C5A'}`)}${abtn('hSkip', t('ui.btn.skip'), la.skip, '', 'background:transparent;border:1px solid #2F4D4C;font-weight:500')}</div></div>`;

    return `<div class="screen" style="padding:16px;gap:10px">
<header style="display:flex;justify-content:space-between;align-items:center;height:44px;gap:12px;flex:none"><span class="eyebrow" style="min-width:0">${t('ui.header.eyebrow')} · ${t('ui.header.turn', { n: m.log.length })}</span><div style="display:flex;gap:8px;flex:none">${voiceBtn()}<button type="button" data-act="hPause" aria-label="${t('ui.aria.pause')}" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#1B3437;border:1px solid #2F4D4C;color:#EFE3C5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6v12"/><path d="M15 6v12"/></svg></button></div></header>
<p class="sr" aria-live="polite">${over ? '' : t('ui.turn.banner', { p: pn })}</p>
<section class="card" style="flex:none;display:flex;gap:12px;align-items:flex-start;min-height:76px;border:2px solid ${pc}">${badge(pn, 32)}<div style="display:flex;flex-direction:column;gap:4px;min-width:0"><h1 class="serif" style="margin:0;font-size:30px;line-height:1.1">${over ? t('ui.end.winner', { p: pn }) : t('ui.turn.banner', { p: pn })}</h1><div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:13px;color:#C9D6D3">${chips.map((c) => `<span>${c}</span>`).join('')}</div><div style="font-size:12.5px;line-height:1.35;min-height:17px">${state}</div></div></section>
<section aria-live="polite" aria-label="${t('ui.host.label')}" class="card" style="flex:none;display:flex;gap:10px;align-items:flex-start;min-height:96px;border:1.5px solid ${ph === 'speaking' ? '#E2B866' : '#2F4D4C'}"><div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:8px">${badge(latest ? latest.p : 0, 32)}<button type="button" data-act="hRepeat" aria-label="${t('ui.aria.repeat')}" title="${t('ui.btn.repeat')}" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#14282B;border:1px solid #3B5C5A;color:#EFE3C5">${speakerIcon(18)}</button></div><div style="min-width:0;display:flex;flex-direction:column;gap:2px"><span class="eyebrow">${t('ui.host.label')}</span><p style="margin:0;font-size:18px;line-height:1.35">${latest ? latest.text : ''}</p></div></section>
${theSpeaker().status().available ? '' : `<p role="status" style="margin:0;flex:none;font-size:12.5px;color:#E2B866">${t('ui.notice.noVoice')}</p>`}
<ol role="log" aria-live="off" tabindex="0" aria-label="${t('ui.log.title')}" class="card" style="flex:1 1 120px;min-height:120px;margin:0;list-style:none;overflow-y:auto;display:flex;flex-direction:column;gap:8px">${older.map(logItem).join('')}</ol>
<p role="status" style="margin:0;flex:none;height:18px;font-size:12.5px;line-height:18px;color:#E58A76">${HS.notice ? NOTICES()[HS.notice] : ''}</p>
${controls}
</div>`;
  }

  function hostMapHTML() {
    let cells = '', walls = '', objs = '';
    const trueObjs = {};
    W.pits.forEach((k) => { trueObjs[k] = 'pit'; });
    Object.keys(W.objs).forEach((k) => { trueObjs[k] = W.objs[k]; });
    trueObjs[W.treasure] = 'chest'; trueObjs[W.exitCell] = 'exit';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      cells += `<div class="abs" style="left:${x * C}px;top:${y * C}px;width:56px;height:56px;background:#EFE3C5;box-shadow:inset 0 0 0 .5px rgba(38,50,56,.18)"></div>`;
      const edges = [['h', x, y], ['v', x, y]];
      if (y === 5) edges.push(['h', x, 6]);
      if (x === 5) edges.push(['v', 6, y]);
      edges.forEach((e) => {
        const key = e[0] + ':' + e[1] + ',' + e[2];
        if (W.pass.has(key) || key === W.exitEdge) return;
        const r = e[0] === 'h' ? { l: e[1] * C - 1, t: e[2] * C - 3, w: C + 2, h: 6 } : { l: e[1] * C - 3, t: e[2] * C - 1, w: 6, h: C + 2 };
        walls += box(r, 'background:#141C1F;border-radius:2px;box-shadow:0 0 0 1.5px #EFE3C5,0 0 0 3px rgba(11,23,25,.35)');
      });
    }
    Object.keys(trueObjs).forEach((k) => { const p = kv(k); objs += `<div class="abs" style="left:${p[0] * C + 14}px;top:${p[1] * C + 14}px;width:28px;height:28px">${objIcon(trueObjs[k], 28, { pit: '#B65B48', exit: '#263238' }, 1.8)}</div>`; });
    return `<div class="sheet" style="box-shadow:0 12px 32px rgba(0,0,0,.4)"><div class="board" role="img" aria-label="${t('ui.end.mapLabel')}">${cells}${walls}${objs}</div></div>`;
  }

  function hostEndHTML() {
    const m = HS.match, w = m.winner === null ? 1 : m.winner + 1, tab = HS.tab;
    const tb = (id, label) => `<button type="button" data-act="hTab" data-a="${id}" aria-pressed="${tab === id}" style="background:${tab === id ? '#C59A49' : 'transparent'};color:${tab === id ? '#14282B' : '#C9D6D3'}">${label}</button>`;
    return `<div class="screen" style="gap:12px">
<header style="display:flex;flex-direction:column;gap:6px;flex:none"><span class="eyebrow">${t('ui.end.eyebrow')}</span><div style="display:flex;gap:12px;align-items:center">${badge(w, 32)}<h1 class="serif" style="margin:0;font-size:30px;line-height:1.1">${t('ui.end.winner', { p: w })}</h1></div><p style="margin:0;font-size:13px;color:#C9D6D3">${t('ui.end.turns', { a: m.players[0].moves, b: m.players[1].moves })}</p></header>
<div class="seg" role="group" aria-label="${t('ui.end.tabs')}">${tb('map', t('ui.end.tab.map'))}${tb('log', t('ui.end.tab.log'))}</div>
${tab === 'log' ? `<ol role="log" aria-live="off" tabindex="0" aria-label="${t('ui.log.title')}" class="card" style="flex:1 1 200px;min-height:200px;margin:0;list-style:none;overflow-y:auto;display:flex;flex-direction:column;gap:8px">${m.log.slice().reverse().map(logItem).join('')}</ol>` : hostMapHTML()}
<div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><button type="button" data-act="hAgain" class="btn primary">${t('ui.btn.again')}</button><button type="button" data-act="menu" class="btn">${t('ui.btn.menu')}</button></div></div>`;
  }

  function hostSettingsHTML(sw) {
    return `<section aria-labelledby="hs" class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><h2 id="hs" style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A9BDB9;font-weight:600">${t('ui.set.title')}</h2>
${sw('voice', t('ui.set.voice'), t('ui.set.voice.sub'))}<p role="status" style="margin:0 0 6px;font-size:12px;line-height:1.35;color:#C9D6D3">${voiceStatusText()}</p>${sw('settle', t('ui.set.settle'), t('ui.set.settle.sub'))}${sw('speakTurn', t('ui.set.speakTurn'), t('ui.set.speakTurn.sub'))}</section>`;
  }
  const hostLegendHTML = () => `<p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#A9BDB9;text-align:center">${t('ui.set.keys')}</p>`;
  /* host:end */

  app.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (!t || t.disabled) return; const fn = A[t.dataset.act]; if (fn) fn(t.dataset.a, t.dataset.b); });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (hostKey(e)) return;
    if (screen === 'game' && S && !S.won) {
      const dir = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] }[e.key];
      if (dir) { e.preventDefault(); pad(dir[0], dir[1]); return; }
      const k = e.key.toLowerCase();
      if (k === 'm') { S.mode === 'match' ? A.explore() : A.match(); }
      else if (k === 'f') take();
      else if (k === 'h') { if (S.sel && S.mode === 'match') A.hide(); }
      else if (k === 'q') cycleSheet(-1);
      else if (k === 'e') cycleSheet(1);
      else if (e.key === ' ' && S.mode === 'match' && document.activeElement === document.body) { e.preventDefault(); togglePin(); }
      else if (e.key === 'Delete' && S.mode === 'match') putAway();
      else if (e.key === '1' || e.key === '2' || e.key === '3') { if (S.mode === 'match') A.op({ 1: 1, 2: 0.7, 3: 0.4 }[e.key]); }
      else if (e.key === 'Escape') A.pause();
    } else if (screen === 'settings' && e.key === 'Escape') A.back();
  });

  render();
})();
