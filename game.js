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
  let settings = Object.assign({ motion: false, conflicts: true, coach: true }, LS.get('lab.settings', {}));
  let screen = 'start';
  let S = null;
  let prevScreen = 'start';
  let endView = 'both', endSaved = false;

  const IC = {
    pit: (s, c, w, l) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Яма"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>`,
    sign: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Табличка"><rect x="4" y="5" width="16" height="12" rx="1"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M12 17v3"/></svg>`,
    exit: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Выход"><path d="M10 4H5v16h5"/><path d="M21 12H9"/><path d="M13 8l-4 4 4 4"/></svg>`,
    chest: (s, c, w) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Ларец"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10a9 5 0 0 1 18 0"/><path d="M12 13v3"/></svg>`,
    up: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>', down: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    left: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'
  };
  const arrow = (n) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const objIcon = (k, s, col, w) => k === 'pit' ? IC.pit(s, col.pit || '#B65B48', w) : k === 'sign' ? IC.sign(s, col.sign || '#2E7F78', w) : k === 'exit' ? IC.exit(s, col.exit || '#263238', w) : k === 'chest' ? IC.chest(s, col.chest || '#9A7330', w + 0.2) : '';

  /* ---------- мир ---------- */
  const W = {
    pass: new Set(['v:1,4','h:1,4','h:1,3','v:1,2','h:0,2','h:0,1','v:1,0','v:2,0','h:2,1','v:2,1','v:2,2','v:3,2','v:4,2','h:3,3','v:4,3','v:5,3','h:5,4','h:5,5','v:5,5','v:4,5','v:3,5','h:1,5','v:1,5','v:2,3','h:2,4','v:3,4','v:4,4','h:0,4','h:3,1','v:4,0','v:5,0','h:5,1','h:5,2','h:4,1']),
    exitEdge: 'v:0,4', exitCell: '0,4', pits: ['2,5', '3,1'], treasure: '5,2', objs: { '4,2': 'sign' }
  };
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
  function persist() { if (S && !S.won) LS.set('lab.save', S); else if (S && S.won) LS.del('lab.save'); }

  /* ---------- действия ---------- */
  function step(dx, dy) {
    const s = S;
    if (s.mode !== 'explore' || s.won) return;
    const dn = dirName(dx, dy), x = s.wpos[0], y = s.wpos[1], nx = x + dx, ny = y + dy, e = edge(x, y, dx, dy);
    const frags = clone(), f = frag(s.cur, frags), lx = s.lpos[0], ly = s.lpos[1], le = edge(lx, ly, dx, dy);
    const moves = s.moves + 1, seen = Object.assign({}, s.seen);
    let hint = s.hint && s.hint.kind === 'start' ? null : s.hint;
    if (e === W.exitEdge) {
      if (s.carrying) { set({ moves, won: true, bump: null, hint: null, msg: { kind: 'win', text: 'ты вышел из лабиринта с ларцом!' } }); endView = 'both'; endSaved = false; screen = 'end'; render(); return; }
      set({ moves, bump: dirKey(dx, dy), bumpN: s.bumpN + 1, hint, msg: { kind: 'exit', text: dn.toLowerCase() + ' — выход. Без ларца уходить рано.' } });
      return;
    }
    const inside = nx >= 0 && ny >= 0 && nx < 6 && ny < 6;
    if (!inside || !W.pass.has(e)) {
      f.walls[le] = 1;
      hint = hintOnce(seen, 'wall', 'Стена записана сама. Ход потрачен — ты остался на месте.', hint);
      set({ frags, moves, seen, hint, bump: dirKey(dx, dy), bumpN: s.bumpN + 1, msg: { kind: 'wall', text: dn.toLowerCase() + ' — стена. Ты остался на месте.' } });
      return;
    }
    f.pass[le] = 1;
    const nlx = lx + dx, nly = ly + dy, nk = nlx + ',' + nly, isNew = !f.cells[nk];
    f.cells[nk] = 1;
    const key = nx + ',' + ny, pi = W.pits.indexOf(key);
    if (pi >= 0) {
      f.obj[nk] = 'pit';
      const dest = kv(W.pits[(pi + 1) % W.pits.length]);
      const names = 'АБВГДЕЖЗИКЛМНОП', name = names[frags.length] || ('Л' + frags.length), id = 'f' + frags.length;
      frags.push({ id, name, anchored: false, placed: false, ox: 0, oy: 0, tx: null, ty: null, tw: dest, cells: { '0,0': 1 }, walls: {}, pass: {}, obj: { '0,0': 'pit' } });
      hint = hintOnce(seen, 'pit', 'Новый лист «' + name + '» не привязан к карте. Найди знакомые приметы и переключись в «Сопоставлять».', hint);
      set({ frags, cur: id, lpos: [0, 0], wpos: dest, moves, seen, hint, bump: null, pitFx: true, lastNew: id + ':0,0', msg: { kind: 'pit', text: dn.toLowerCase() + ' — яма! Ты провалился и потерял ориентир. Начат новый лист «' + name + '».' } });
      clearTimeout(step._t); step._t = setTimeout(() => { if (S) set({ pitFx: false }); }, 700);
      return;
    }
    let obj = null;
    if (key === W.treasure && !s.taken) obj = 'chest'; else if (W.objs[key]) obj = W.objs[key]; else if (key === W.exitCell) obj = 'exit';
    if (obj) f.obj[nk] = obj;
    const texts = { chest: 'ларец! Возьми его.', sign: 'обломок таблички, надпись стёрта.', exit: 'клетка у выхода.' };
    if (obj === 'chest') hint = hintOnce(seen, 'chest', 'Найти — не значит взять. Нажми «Взять клад», затем вынеси его через выход.', hint);
    set({ frags, lpos: [nlx, nly], wpos: [nx, ny], moves, seen, hint, bump: null, lastNew: isNew ? s.cur + ':' + nk : s.lastNew, msg: { kind: obj || 'move', text: dn.toLowerCase() + ' — ' + (obj ? texts[obj] : (isNew ? 'проход, пустая клетка.' : 'проход, здесь ты уже был.')) } });
  }
  function take() {
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
  const pad = (dx, dy) => { if (S.mode === 'explore') step(dx, dy); else moveKalka(dx, dy); };
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

    const msgColors = { wall: '#9FB3B0', pit: '#E58A76', chest: '#E2B866', take: '#E2B866', win: '#E2B866', exit: '#7FD0C6', sign: '#7FD0C6' };
    const atTreasure = s.wpos.join(',') === W.treasure && !s.carrying;
    const canPad = isExplore ? !s.won : hasKalka;
    let stA, stB, stC = '#A9BDB9';
    if (isExplore) { stA = 'Лист ' + cur.name + (cur.anchored ? ' · точно на карте' : cur.placed ? ' · гипотеза на карте' : ' · вне карты'); stB = 'клеток записано: ' + Object.keys(cur.cells).length; }
    else if (!sel) { stA = 'Сопоставление'; stB = S.frags.some((f) => !f.anchored) ? 'выбери лист в инвентаре' : 'пока всё на одном листе'; }
    else if (sel.placed) { stA = sel.name + ' · гипотеза закреплена'; stB = 'сними закрепление, чтобы двигать'; }
    else { stA = sel.name + ' · калька'; stB = !settings.conflicts ? 'проверка выключена' : nConf ? 'противоречий в записях: ' + nConf : 'противоречий нет — это не подтверждение'; if (settings.conflicts && nConf) stC = '#E58A76'; }
    const tagText = isMatch ? 'Сопоставление · персонаж стоит' : onSheet ? 'Лист ' + cur.name + ' · вне карты' : (S.frags.some((f) => f.placed && !f.anchored) ? 'Карта · рамка и штриховка — место под вопросом' : 'Карта');
    const sub = cur.anchored ? 'Лист привязан к выходу — его место на карте известно.' : cur.placed ? 'Лист закреплён как гипотеза. Проверяй её ходами.' : 'Место листа неизвестно. Сопоставь его с картой.';
    const pbg = isExplore ? '#2C3A30' : '#1D4441', pbd = isExplore ? '#6B5A33' : '#3E7C75';
    const pb = (a, n, lbl) => `<button type="button" data-act="${a}" ${canPad ? '' : 'disabled'} aria-label="${lbl}" style="background:${pbg};border:1px solid ${pbd};opacity:${canPad ? 1 : .4}">${arrow(n)}</button>`;
    const sp = (isMatch ? sel : null);
    const selOff = !sel;
    const ops = [[1, '100%'], [0.7, '70%'], [0.4, '40%']].map((o) => `<button type="button" data-act="op" data-a="${o[0]}" aria-pressed="${s.op === o[0]}" style="flex:1 1 0;min-width:0;height:44px;padding:0;font-size:13px;font-weight:600;border-radius:8px;border:1px solid #3B5C5A;background:${s.op === o[0] ? '#4EAAA1' : '#1B3437'};color:${s.op === o[0] ? '#14282B' : '#EFE3C5'}">${o[1]}</button>`).join('');
    const sbtn = (act, label, extra, st) => `<button type="button" data-act="${act}" ${selOff ? 'disabled' : ''} ${extra || ''} style="flex:1 1 0;min-width:0;height:44px;padding:0 6px;font-size:13px;font-weight:500;border-radius:8px;border:1px solid #3B5C5A;background:#1B3437;color:#EFE3C5;opacity:${selOff ? .4 : 1};${st || ''}">${label}</button>`;
    const pinned = sel && sel.placed;
    const side = isExplore
      ? `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px"><div class="card" style="height:88px;display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:600">Ты на листе ${cur.name}</span><span style="font-size:11.5px;line-height:1.3;color:#C9D6D3">${sub}</span></div><button type="button" data-act="take" ${!atTreasure ? 'disabled' : ''} style="height:44px;font-size:14px;font-weight:600;border-radius:8px;border:0;background:#C59A49;color:#14282B;opacity:${atTreasure ? 1 : .35}">Взять клад</button></div>`
      : `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px"><div role="group" aria-label="Непрозрачность кальки" style="display:flex;gap:4px;align-items:center"><span style="font-size:12px;color:#A9BDB9;width:34px;flex:none">Слой</span>${ops}</div><div class="row" style="gap:6px">${sbtn('hide', s.hidden ? 'Показать' : 'Скрыть', `aria-pressed="${s.hidden}"`)}${sbtn('away', 'Убрать')}</div><button type="button" data-act="pin" ${selOff ? 'disabled' : ''} style="height:44px;font-size:14px;font-weight:600;border-radius:8px;border:${pinned ? '1px solid #6B5A33' : '0'};background:${pinned ? '#1B3437' : '#C59A49'};color:${pinned ? '#E2B866' : '#14282B'};opacity:${selOff ? .4 : 1}">${pinned ? 'Снять закрепление' : 'Закрепить гипотезу'}</button></div>`;
    const showHint = settings.coach && s.hint && !s.won;
    const ring = isMatch ? '0 0 0 3px #4EAAA1' : '0 0 0 0 rgba(0,0,0,0)';

    return `<div class="screen">
<header style="display:flex;justify-content:space-between;align-items:center;height:44px;gap:12px;flex:none">
<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="eyebrow">Экспедиция №1</span><h1 class="serif" style="margin:0;font-size:24px;line-height:1.1">Лабиринт</h1></div>
<div style="display:flex;align-items:center;gap:10px"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;color:#C9D6D3"><span>Ход ${s.moves}</span><span style="color:${s.carrying ? '#E2B866' : '#C9D6D3'};font-weight:${s.carrying ? 600 : 400}">${s.carrying ? 'Несу ларец' : 'Ларец: нет'}</span></div>
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
<div style="display:flex;gap:12px;align-items:flex-start;flex:none"><div class="pad" role="group" aria-label="${isExplore ? 'Ход персонажа' : 'Сдвиг кальки на одну клетку'}"><span></span>${pb('up', 'up', 'Вверх')}<span></span>${pb('left', 'left', 'Влево')}<span aria-hidden="true" style="height:44px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;color:${isExplore ? '#E2B866' : '#7FD0C6'};text-transform:uppercase;letter-spacing:.06em">${isExplore ? 'Ход' : 'Калька'}</span>${pb('right', 'right', 'Вправо')}<span></span>${pb('down', 'down', 'Вниз')}<span></span></div>${side}</div>
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
${saved ? `<button type="button" data-act="resume" class="btn primary">Продолжить · ход ${saved.moves}</button><button type="button" data-act="new" class="btn" style="height:48px;font-size:15px">Начать заново</button>` : `<button type="button" data-act="new" class="btn primary">Начать экспедицию</button>`}
<p style="margin:0;text-align:center;font-size:12px;color:#A9BDB9">Поле 6 × 6 · стрелки или WASD, на телефоне — крестовина</p></div></div>`;
  }

  /* ---------- пауза и настройки ---------- */
  function settingsHTML() {
    const sw = (k, label, sub) => `<div style="display:flex;justify-content:space-between;align-items:center;min-height:52px;gap:12px"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px">${label}</span><span style="font-size:12px;line-height:1.35;color:#A9BDB9">${sub}</span></span><button type="button" role="switch" aria-checked="${settings[k]}" aria-label="${label}" data-act="sw" data-a="${k}" class="sw" style="background:${settings[k] ? '#4EAAA1' : '#3B4A4C'};justify-content:${settings[k] ? 'flex-end' : 'flex-start'}"><i></i></button></div>`;
    const inGame = S && !S.won && prevScreen === 'game';
    return `<div class="screen" style="padding:16px 20px;gap:16px">
<header style="display:flex;justify-content:space-between;align-items:center;height:44px"><h1 class="serif" style="margin:0;font-size:26px">${inGame ? 'Пауза' : 'Настройки'}</h1>${inGame ? `<span style="font-size:12px;color:#A9BDB9">Ход ${S.moves} · партия сохранена</span>` : ''}</header>
<nav aria-label="Партия" style="display:flex;flex-direction:column;gap:8px">
${inGame ? `<button type="button" data-act="back" class="btn primary">Продолжить</button><div class="row"><button type="button" data-act="new" class="btn flex">Начать заново</button><button type="button" data-act="menu" class="btn flex">Выйти в меню</button></div>` : `<button type="button" data-act="back" class="btn primary">Назад</button>`}
</nav>
<section aria-labelledby="gm" class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:2px"><h2 id="gm" style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A9BDB9;font-weight:600">Игра и экран</h2>
${sw('motion', 'Меньше анимации', 'Без тряски, вспышек и долгих переходов')}${sw('conflicts', 'Подсвечивать противоречия', 'Только между твоими записями, не по скрытой карте')}${sw('coach', 'Подсказки обучения', 'Короткие пояснения в первой партии')}</section>
<section aria-labelledby="rl" class="card" style="padding:12px 14px;font-size:13px;line-height:1.5;color:#C9D6D3"><h2 id="rl" style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A9BDB9;font-weight:600">Правила</h2>
Ход — на одну клетку. Стена: ты стоишь, ход засчитан. Ямы связаны в цикл и уносят на новый лист без привязки. Сопоставление — только сдвиг, без поворотов; закрепление — твоя гипотеза, приложение её не подтверждает. Победа: взять ларец и выйти через выход.</section>
<p style="margin:auto 0 0;font-size:12px;color:#A9BDB9;text-align:center">Клавиши: <kbd>←↑→↓</kbd> / <kbd>WASD</kbd> · <kbd>M</kbd> режим · <kbd>F</kbd> взять · <kbd>Space</kbd> закрепить · <kbd>H</kbd> скрыть · <kbd>Q</kbd><kbd>E</kbd> листы · <kbd>Esc</kbd> пауза</p></div>`;
  }

  /* ---------- итоги ---------- */
  function endHTML() {
    const showTruth = endView !== 'mine', showMine = endView !== 'truth';
    const visited = new Set();
    S.frags.forEach((f) => Object.keys(f.cells).forEach((k) => { const p = kv(k); visited.add((p[0] + f.tw[0]) + ',' + (p[1] + f.tw[1])); }));
    // клетки листа А хранятся в мировых координатах (tw = 0,0)
    let cells = '', walls = '', objs = '', frames = '';
    const trueObjs = { '2,5': 'pit', '3,1': 'pit', '5,2': 'chest', '4,2': 'sign', '0,4': 'exit' };
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
<header style="display:flex;flex-direction:column;gap:4px;flex:none"><span class="eyebrow">Итоги партии</span><h1 class="serif" style="margin:0;font-size:30px;line-height:1.1">Ларец вынесен</h1><p style="margin:0;font-size:13px;color:#C9D6D3">${S.moves} ходов · ${S.frags.length} ${S.frags.length === 1 ? 'лист' : 'лист' + (S.frags.length < 5 ? 'а' : 'ов')} · гипотез ${right + wrong}${right + wrong ? ', верных ' + right : ''}${unplaced ? ' · не закреплено листов: ' + unplaced : ''}</p></header>
<div class="seg" role="group" aria-label="Что показать на карте">${views}</div>
<div class="sheet" style="box-shadow:0 12px 32px rgba(0,0,0,.4)"><div class="board" role="img" aria-label="${endView === 'mine' ? 'Твоя карта с гипотезами' : endView === 'truth' ? 'Настоящая карта лабиринта' : 'Настоящая карта поверх твоей'}">${cells}${walls}${objs}${frames}</div></div>
<ul style="margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;font-size:12px;color:#C9D6D3;flex:none">${lg('background:#E6CF97', 'Где ты побывал')}${lg('border:2px solid #4EAAA1', 'Гипотеза верна')}${lg('border:2px dashed #E58A76', 'Ошибочная гипотеза')}${lg('border:2px dotted #7FD0C6', 'Где лист на самом деле')}</ul>
<div style="margin-top:auto;display:flex;flex-direction:column;gap:8px"><button type="button" data-act="new" class="btn primary">Сыграть ещё</button><div class="row"><button type="button" data-act="atlas" class="btn flex">${endSaved ? 'В атласе ✓' : 'В атлас'}</button><button type="button" data-act="menu" class="btn flex">В меню</button></div></div></div>`;
  }

  /* ---------- рендер и события ---------- */
  function render() {
    document.body.classList.toggle('calm', settings.motion);
    const f = document.activeElement, key = f && f.dataset && f.dataset.act ? f.dataset.act + '|' + (f.dataset.a || '') + '|' + (f.dataset.b || '') : null;
    app.innerHTML = screen === 'start' ? startHTML() : screen === 'settings' ? settingsHTML() : screen === 'end' ? endHTML() : gameHTML();
    if (key) { const els = app.querySelectorAll('[data-act]'); for (const el of els) if (el.dataset.act + '|' + (el.dataset.a || '') + '|' + (el.dataset.b || '') === key && !el.disabled) { el.focus({ preventScroll: true }); break; } }
  }
  function newGame() { S = initialState(); LS.del('lab.save'); screen = 'game'; render(); persist(); }
  const A = {
    new: newGame,
    resume() { S = LS.get('lab.save', null) || initialState(); screen = 'game'; render(); },
    settings() { prevScreen = screen; screen = 'settings'; render(); },
    pause() { prevScreen = 'game'; screen = 'settings'; render(); },
    back() { screen = prevScreen === 'game' && S ? 'game' : 'start'; render(); },
    menu() { screen = 'start'; render(); },
    sw(a) { settings[a] = !settings[a]; LS.set('lab.settings', settings); render(); },
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
  app.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (!t || t.disabled) return; const fn = A[t.dataset.act]; if (fn) fn(t.dataset.a, t.dataset.b); });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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
