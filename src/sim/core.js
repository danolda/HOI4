// Oyun durumu, yardımcılar ve türetilmiş değerler.
import { MAJORS, EQUIP, EQ_KEYS, BATTALION, BAT_KEYS, DEFAULT_TEMPLATES, LAWS, TECHS, TECH_BY_ID, MOD_LABEL } from '../data.js';
const MOD_KEYS = Object.keys(MOD_LABEL);
import { RNG, hashString, clamp } from '../rng.js';

export const ST_IDLE = 0, ST_MOVE = 1, ST_RETREAT = 2;
export const DIFF = [
  { name: 'Kolay', ai: -0.15, player: 0.15 },
  { name: 'Normal', ai: 0, player: 0 },
  { name: 'Zor', ai: 0.2, player: 0 },
];

const BASE_OPINION = { dem: { dem: 25, mon: 5, mil: -30, kol: -20 }, mon: { dem: 5, mon: 20, mil: -10, kol: -25 }, mil: { dem: -30, mon: -10, mil: 15, kol: -40 }, kol: { dem: -20, mon: -25, mil: -40, kol: 25 } };
export function baseOpinion(a, b) { return BASE_OPINION[a.ideo][b.ideo]; }

export function newState(world, opts) {
  const N = world.nations.length, NL = world.NL;
  const rng = new RNG(hashString(world.seed + ':sim'));
  const humans = opts.humans || (opts.player !== undefined && opts.player >= 0 ? [opts.player] : []);
  const S = {
    v: 3, seed: world.seed, hours: 0, player: opts.player ?? -1, diff: opts.diff ?? 1, tension: 0, N,
    C: [], owner: [], ctrl: [], civ: [], mil: [], dock: [], infra: [], fort: [], port: [], pop: [], rs: [], ro: [], ra: [],
    divs: [], nextDiv: 1, battles: [], nextBattle: 1, wars: [], nextWar: 1, factions: [], log: [], logSeq: 0, rs0: 0,
    observer: false,
  };
  for (let i = 0; i < NL; i++) {
    const p = world.prov[i];
    S.owner.push(p.owner0); S.ctrl.push(p.owner0);
    S.civ.push(p.civ0); S.mil.push(p.mil0); S.dock.push(p.dock0); S.infra.push(p.infra0); S.fort.push(p.fort0); S.port.push(p.port0);
    S.pop.push(p.pop0); S.rs.push(p.res0.steel); S.ro.push(p.res0.oil); S.ra.push(p.res0.alu);
  }
  for (const nat of world.nations) {
    const major = nat.major;
    const c = {
      id: nat.id, alive: nat.provs.length > 0 && nat.capital >= 0, capit: false, capital: nat.capital, ideo: nat.ideo, major, human: humans.includes(nat.id),
      stab: { dem: 66, mon: 60, mil: 56, kol: 52 }[nat.ideo] + rng.int(-6, 6),
      ws: { dem: 25, mon: 35, mil: 60, kol: 52 }[nat.ideo] + rng.int(-5, 5),
      pp: 40, laws: { cons: nat.ideo === 'mil' || nat.ideo === 'kol' ? 1 : 0, eco: nat.ideo === 'mil' ? 1 : 0 },
      gm: {}, techs: {}, slots: major ? 3 : 2, research: [], goalsDone: [], goal: null, freeGoals: 0,
      stock: {}, naval: 0, lines: [], build: [], imports: { steel: 0, oil: 0, alu: 0 }, train: [],
      tpls: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)), nextTpl: 1, divNo: {},
      faction: -1, casualties: 0, op: [], pacts: [], guar: [], just: [], wargoals: [], aggr: 0, intel: false,
      auto: { stance: 1 }, ai: { nextAggro: 24 * (nat.ideo === 'mil' ? rng.int(240, 800) : rng.int(500, 1400)), lastLines: -9999, baseDivs: nat.divs }, deploy: -1, lost: 0, kills: 0,
    };
    if (!c.alive) c.capit = true;
    for (const t of TECHS) {
      if (major) { if (t.year <= 1934 || (t.year === 1935 && rng.chance(0.4))) c.techs[t.id] = true; }
      else if (t.year <= 1931 ? rng.chance(0.8) : t.year <= 1933 ? rng.chance(0.35) : false) c.techs[t.id] = true;
    }
    // ön koşulu eksik kalan teknolojileri temizle
    for (let pass = 0; pass < 4; pass++) for (const t of TECHS) if (c.techs[t.id] && t.req.some((r) => !c.techs[r])) delete c.techs[t.id];
    for (let i = 0; i < c.slots; i++) c.research.push(null);
    for (const k of EQ_KEYS) c.stock[k] = 0;
    S.C.push(c);
  }
  for (const a of S.C) for (const b of S.C) a.op.push(a === b ? 0 : clamp(baseOpinion(a, b) + rng.int(-10, 10), -100, 100));
  S.rs0 = rng.s;
  return S;
}

// ---- ilişkiler
export function buildWarMatrix(S) {
  const N = S.N;
  const m = new Uint8Array(N * N);
  for (const w of S.wars) for (const a of w.att) for (const d of w.def) {
    if (!S.C[a].alive || !S.C[d].alive) continue;
    m[a * N + d] = 1; m[d * N + a] = 1;
  }
  S._war = m;
  for (const c of S.C) {
    c._enemies = [];
    for (const o of S.C) if (o.alive && m[c.id * N + o.id]) c._enemies.push(o.id);
    c._atWar = c._enemies.some((e) => !S.C[e].capit);
  }
}
export const atWar = (S, a, b) => S._war[a * S.N + b] === 1;
export const sameFaction = (S, a, b) => a === b || (S.C[a].faction >= 0 && S.C[a].faction === S.C[b].faction);
// Aynı savaşta aynı tarafta olanlar da dost sayılır.
export function friendly(S, a, b) {
  if (a === b) return true;
  if (a < 0 || b < 0) return false;
  if (sameFaction(S, a, b)) return true;
  for (const w of S.wars) {
    if ((w.att.includes(a) && w.att.includes(b)) || (w.def.includes(a) && w.def.includes(b))) return true;
  }
  return false;
}
export function buildFriendMatrix(S) {
  const N = S.N, m = new Uint8Array(N * N);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) m[a * N + b] = friendly(S, a, b) && !(S._war && S._war[a * N + b]) ? 1 : 0;
  S._fr = m;
}
export const isFriend = (S, a, b) => a >= 0 && b >= 0 && S._fr[a * S.N + b] === 1;

// ---- değiştiriciler ve tümen istatistikleri
export function recalcMods(S, c) {
  const m = {};
  for (const k of MOD_KEYS) m[k] = 0;
  const add = (fx) => { if (fx) for (const k in fx) m[k] = (m[k] || 0) + fx[k]; };
  for (const id in c.techs) add(TECH_BY_ID[id] && TECH_BY_ID[id].fx);
  add(c.gm);
  add(LAWS.cons[c.laws.cons].fx);
  add(LAWS.eco[c.laws.eco].fx);
  const d = DIFF[S.diff];
  const bonus = c.human ? d.player : d.ai;
  if (bonus) { m.prodOut = (m.prodOut || 0) + bonus; m.construction = (m.construction || 0) + bonus; m.research = (m.research || 0) + bonus * 0.5; }
  if (c.ideo === 'dem') { m.construction = (m.construction || 0) + 0.1; m.research = (m.research || 0) + 0.05; }
  if (c.ideo === 'mil') { m.atk = (m.atk || 0) + 0.05; m.justify = (m.justify || 0) + 0.25; }
  if (c.ideo === 'kol') { m.manpower = (m.manpower || 0) + 0.01; m.prodOut = (m.prodOut || 0) + 0.05; }
  if (c.ideo === 'mon') { m.coreDef = (m.coreDef || 0) + 0.1; }
  c._mods = m;
  c._stats = {};
}

export function tplOf(c, id) { return c.tpls.find((t) => t.id === id) || c.tpls[0]; }

export function tplStats(c, tpl) {
  const m = c._mods;
  const s = { atk: 0, def: 0, brk: 0, hp: 0, org: 0, speed: 99, width: 0, mp: 0, eq: {}, n: 0, armor: 0, kind: 'inf' };
  let orgSum = 0;
  for (const k of BAT_KEYS) {
    const n = tpl.bats[k] || 0;
    if (!n) continue;
    const B = BATTALION[k];
    const foot = k === 'inf' || k === 'mot';
    s.atk += n * B.atk * (1 + m.atk + (foot ? m.infAtk : k === 'art' ? m.artAtk : m.tankAtk));
    s.def += n * B.def * (1 + m.def + (foot ? m.infDef : 0));
    s.brk += n * B.brk * (1 + m.brk + (k === 'tank' ? m.tankBrk : 0));
    s.hp += n * B.hp; orgSum += n * B.org; s.width += n * B.width; s.mp += n * B.mp; s.n += n;
    if (k !== 'art') s.speed = Math.min(s.speed, B.speed);
    for (const e in B.eq) s.eq[e] = (s.eq[e] || 0) + n * B.eq[e];
    if (k === 'tank') s.armor += n;
  }
  if (s.speed === 99) s.speed = 4;
  s.org = s.n ? (orgSum / s.n) * (1 + m.org) : 1;
  s.speed *= 1 + m.speed;
  s.armor = s.n ? s.armor / s.n : 0;
  s.kind = (tpl.bats.tank || 0) > 0 ? 'arm' : (tpl.bats.mot || 0) > (tpl.bats.inf || 0) ? 'mot' : 'inf';
  s.cost = 0;
  for (const e in s.eq) s.cost += s.eq[e] * EQUIP[e].cost;
  s.days = Math.round((s.n <= 4 ? 60 : 90) * (1 + 0.35 * s.armor));
  return s;
}
export function divStats(S, d) {
  const c = S.C[d.o];
  let st = c._stats[d.t];
  if (!st) st = c._stats[d.t] = tplStats(c, tplOf(c, d.t));
  return st;
}
export function tplAllowed(c, tpl) {
  for (const k of BAT_KEYS) if ((tpl.bats[k] || 0) > 0 && BATTALION[k].req && !c.techs[BATTALION[k].req]) return false;
  return true;
}

// ---- türetilmiş ülke değerleri (günde bir ve oyuncu eylemlerinden sonra)
export function refreshAll(G) {
  const S = G.S, W = G.world, NL = W.NL;
  for (const c of S.C) {
    c._civ = 0; c._mil = 0; c._dock = 0; c._pop = 0; c._res = { steel: 0, oil: 0, alu: 0 };
    c._nProv = 0; c._vpOwn = 0; c._vpLost = 0; c._vpHeld = 0; c._ports = 0; c._mpUsed = 0; c._nDiv = 0; c._str = 0;
  }
  let worldVp = 0;
  for (let p = 0; p < NL; p++) {
    const o = S.owner[p], k = S.ctrl[p], vp = W.prov[p].vp;
    worldVp += vp;
    const O = S.C[o], K = S.C[k];
    if (W.prov[p].core === o) { O._vpOwn += vp; if (k !== o && !isFriend(S, o, k)) O._vpLost += vp; }
    K._vpHeld += vp; K._nProv++;
    const core = W.prov[p].core === k;
    const f = core && o === k ? 1 : o === k ? 0.5 : 0.25;
    K._civ += S.civ[p] * f; K._mil += S.mil[p] * f; K._dock += S.dock[p] * f;
    K._pop += S.pop[p] * (core && o === k ? 1 : o === k ? 0.2 : 0.03);
    const rf = o === k ? 1 : 0.5;
    K._res.steel += S.rs[p] * rf; K._res.oil += S.ro[p] * rf; K._res.alu += S.ra[p] * rf;
    if (S.port[p]) K._ports++;
  }
  S._worldVp = worldVp;
  for (const d of S.divs) {
    const c = S.C[d.o], st = divStats(S, d);
    c._mpUsed += st.mp * d.s; c._nDiv++;
    c._str += (st.atk + st.def * 0.6 + st.brk * 0.4) * d.s;
  }
  for (const c of S.C) {
    const m = c._mods;
    c._civ = Math.floor(c._civ + 1e-6); c._mil = Math.floor(c._mil + 1e-6); c._dock = Math.floor(c._dock + 1e-6);
    const rm = 1 + m.resources;
    c._res.steel = Math.floor(c._res.steel * rm); c._res.alu = Math.floor(c._res.alu * rm);
    c._res.oil = Math.floor(c._res.oil * rm + m.synthOil);
    for (const t of c.train) if (t.started) c._mpUsed += tplStats(c, tplOf(c, t.tpl)).mp;
    c._rate = LAWS.cons[c.laws.cons].rate + m.manpower;
    c._mpMax = c._pop * c._rate;
    c._mpFree = Math.floor(c._mpMax - c._mpUsed - c.casualties);
    // sanayi dağılımı
    let usedMil = 0;
    c._need = { steel: 0, oil: 0, alu: 0 };
    for (const l of c.lines) {
      usedMil += l.fac;
      const r = EQUIP[l.eq].res;
      for (const k in r) c._need[k] += r[k] * l.fac;
    }
    if (usedMil > c._mil) { // fabrika kaybı: hatlardan düş
      let over = usedMil - c._mil;
      for (let i = c.lines.length - 1; i >= 0 && over > 0; i--) { const cut = Math.min(over, c.lines[i].fac); c.lines[i].fac -= cut; over -= cut; }
      usedMil = c._mil;
    }
    c._milFree = c._mil - usedMil;
    const blockade = c._atWar ? Math.min(1, 0.35 + 1.3 * (c._navRatio ?? 0.5)) : 1;
    c._blockade = blockade;
    c._bal = {}; c._short = {};
    let tradeCiv = 0, surplus = 0;
    for (const k of ['steel', 'oil', 'alu']) {
      const have = c._res[k] + c.imports[k] * blockade;
      c._bal[k] = Math.round(have - c._need[k]);
      c._short[k] = c._need[k] > 0 ? clamp(have / c._need[k], 0, 1) : 1;
      tradeCiv += Math.ceil(c.imports[k] / 8);
      if (c._bal[k] > 0) surplus += c._bal[k];
    }
    c._consumer = Math.ceil(c._civ * LAWS.eco[c.laws.eco].consumer);
    c._tradeCiv = tradeCiv;
    c._export = Math.min(Math.floor(surplus / 24), Math.ceil(c._civ * 0.15));
    c._civFree = Math.max(0, c._civ - c._consumer - tradeCiv + c._export);
    const stabF = (c.stab - 50) / 50;
    c._output = Math.max(0.3, 1 + m.prodOut + stabF * 0.12);
    c._ppGain = Math.max(0.2, 1.1 + m.ppGain + Math.max(0, stabF) * 0.5);
  }
}

export function vpShare(S, c) {
  // ittifakın elindeki dünya zafer puanı payı
  let held = 0;
  for (const o of S.C) if (o.alive && !o.capit && sameFaction(S, c.id, o.id)) held += o._vpHeld || 0;
  return held / Math.max(1, S._worldVp);
}

// to: olayı görecek ülke kimlikleri (boşsa herkes görür)
export function pushLog(G, type, text, prov, major, to) {
  const S = G.S;
  const e = { i: ++S.logSeq, t: S.hours, type, text, prov: prov ?? -1 };
  if (major) e.m = 1;
  if (to) e.to = to;
  S.log.push(e);
  if (S.log.length > 120) S.log.shift();
  G.emit('log', e, major);
}
export function humansOf(S, ids) { return ids.filter((id) => id >= 0 && S.C[id] && S.C[id].human); }

export function natName(G, id) { return G.world.nations[id].name; }
export function isMajor(c) { return c.id < MAJORS; }
