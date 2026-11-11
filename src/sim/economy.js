// Ekonomi: inşaat, üretim, ticaret, araştırma, ulusal hedefler, yasalar, asker alma.
import { EQUIP, BUILDING, LAWS, TECHS, TECH_BY_ID, TECH_BASE_DAYS, GOALS, GOAL_BY_ID, GOAL_DAYS, BATTALION, BAT_KEYS, MAX_BATS, yearFrac, FACTION_NAMES } from '../data.js';
import { clamp } from '../rng.js';
import { recalcMods, refreshAll, tplOf, tplStats, tplAllowed, pushLog, natName, baseOpinion } from './core.js';
import { spawnDivision, deployProvince } from './military.js';
import { createFaction, joinFaction, findFactionFor } from './diplomacy.js';

// ---------- inşaat
export function provSlots(G, c, p) { return G.world.prov[p].slots0 + c._mods.slots; }
export function queuedAt(c, p, type) { let n = 0; for (const b of c.build) if (b.prov === p && b.type === type) n++; return n; }
export function canBuild(G, c, type, p) {
  const S = G.S, W = G.world, B = BUILDING[type];
  if (p < 0 || p >= W.NL || S.owner[p] !== c.id || S.ctrl[p] !== c.id) return false;
  if (B.coastal && !W.prov[p].coastal) return false;
  if (B.slot) {
    const used = S.civ[p] + S.mil[p] + S.dock[p] + queuedAt(c, p, 'civ') + queuedAt(c, p, 'mil') + queuedAt(c, p, 'dock');
    return used < provSlots(G, c, p);
  }
  return S[type][p] + queuedAt(c, p, type) < B.max;
}
export function buildCost(G, type, p) {
  const B = BUILDING[type];
  return type === 'fort' ? B.cost * (1 + 0.5 * G.S.fort[p]) : B.cost;
}
export function queueBuild(G, c, type, p) {
  if (!canBuild(G, c, type, p)) return false;
  c.build.push({ type, prov: p, prog: 0 });
  return true;
}
export function bestBuildProv(G, c, type) {
  const S = G.S, W = G.world;
  let best = -1, bs = -1e9;
  for (let p = 0; p < W.NL; p++) {
    if (!canBuild(G, c, type, p)) continue;
    let s = S.infra[p] * 10 + (W.prov[p].city ? 5 : 0) - queuedAt(c, p, type) * 3 + ((p * 7919) % 13) * 0.1;
    if (type === 'infra') s = (S.civ[p] + S.mil[p]) * 4 - S.infra[p] * 6 + (W.prov[p].city ? 4 : 0);
    if (type === 'fort' || type === 'port') s = W.prov[p].vp;
    if (s > bs) { bs = s; best = p; }
  }
  return best;
}
function finishBuild(G, c, b) {
  const S = G.S;
  if (b.type === 'civ' || b.type === 'mil' || b.type === 'dock' || b.type === 'infra' || b.type === 'fort' || b.type === 'port') S[b.type][b.prov]++;
  if (c.id === S.player) pushLog(G, 'build', `${BUILDING[b.type].name} tamamlandı: ${G.world.prov[b.prov].name}.`, b.prov);
  G.mapDirty = true;
}

// ---------- üretim hatları
export function addLine(G, c, eq) {
  if (EQUIP[eq].req && !c.techs[EQUIP[eq].req]) return false;
  if (c.lines.some((l) => l.eq === eq)) return false;
  c.lines.push({ eq, fac: 0, eff: 0.2 });
  return true;
}
export function setLineFac(G, c, idx, delta) {
  const l = c.lines[idx];
  if (!l) return;
  let used = 0;
  for (const x of c.lines) used += x.fac;
  const free = c._mil - used;
  const d = clamp(delta, -l.fac, Math.max(0, free));
  if (d > 0) l.eff = (l.eff * l.fac + 0.2 * d) / (l.fac + d);
  l.fac += d;
}
export function lineOutput(c, l) {
  const r = EQUIP[l.eq].res;
  let pen = 1;
  for (const k in r) pen = Math.min(pen, c._short[k]);
  return (l.fac * 3.6 * l.eff * c._output * (0.3 + 0.7 * pen)) / EQUIP[l.eq].cost;
}
export function effCap(c) { return 0.55 + c._mods.prodCap; }

// ---------- araştırma
export function techAvailable(c, t) {
  if (c.techs[t.id]) return false;
  for (const r of t.req) if (!c.techs[r]) return false;
  return true;
}
export function techDays(G, c, t) {
  const ahead = Math.max(0, t.year - yearFrac(G.S.hours));
  return (TECH_BASE_DAYS * (1 + 0.7 * ahead)) / (1 + c._mods.research);
}
export function startResearch(G, c, slot, id) {
  const t = TECH_BY_ID[id];
  if (!t || slot < 0 || slot >= c.slots || !techAvailable(c, t)) return false;
  if (c.research.some((r) => r && r.id === id)) return false;
  c.research[slot] = { id, prog: 0 };
  return true;
}
export function grantTech(G, c, id) {
  if (c.techs[id]) return;
  c.techs[id] = true;
  recalcMods(G.S, c);
}

// ---------- hedefler
export function goalAvailable(G, c, g) {
  if (c.goalsDone.includes(g.id)) return false;
  if (c.goal && c.goal.id === g.id) return false;
  for (const r of g.req) if (!c.goalsDone.includes(r)) return false;
  if (g.excl && (c.goalsDone.includes(g.excl) || (c.goal && c.goal.id === g.excl))) return false;
  if (g.need === 'expansion' && c.ideo === 'dem' && G.S.tension < 50) return false;
  return true;
}
export function startGoal(G, c, id) {
  const g = GOAL_BY_ID[id];
  if (!g || !goalAvailable(G, c, g)) return false;
  c.goal = { id, prog: 0 };
  return true;
}
function addFactories(G, c, type, n) {
  const S = G.S, W = G.world;
  for (let i = 0; i < n; i++) {
    let p = bestBuildProv(G, c, type);
    if (p < 0) { p = S.ctrl[c.capital] === c.id ? c.capital : -1; if (p < 0) return; W.prov[p].slots0++; }
    S[type][p]++;
  }
}
function applyGoal(G, c, g) {
  const S = G.S, W = G.world, fx = g.fx, a = fx.add || {};
  if (fx.mods) for (const k in fx.mods) c.gm[k] = (c.gm[k] || 0) + fx.mods[k];
  if (a.civ) addFactories(G, c, 'civ', a.civ);
  if (a.mil) addFactories(G, c, 'mil', a.mil);
  if (a.dock) addFactories(G, c, 'dock', a.dock);
  if (a.infra) for (let i = 0; i < a.infra; i++) { const p = bestBuildProv(G, c, 'infra'); if (p >= 0) S.infra[p]++; }
  if (a.research) { c.slots++; c.research.push(null); }
  if (a.stock) for (const k in a.stock) c.stock[k] += a.stock[k];
  if (a.tech) c.techs[a.tech] = true;
  if (a.stability) { c.stab = clamp(c.stab + a.stability, 0, 100); c.gm._stab = (c.gm._stab || 0) + a.stability; }
  if (a.warSupport) { c.ws = clamp(c.ws + a.warSupport, 0, 100); c.gm._ws = (c.gm._ws || 0) + a.warSupport; }
  if (a.pp) c.pp += a.pp;
  if (a.freeGoal) c.freeGoals += a.freeGoal;
  if (a.naval) c.naval += a.naval;
  if (a.res) {
    const own = [];
    for (let p = 0; p < W.NL; p++) if (S.owner[p] === c.id && S.ctrl[p] === c.id) own.push(p);
    if (own.length) {
      const key = { steel: 'rs', oil: 'ro', alu: 'ra' };
      let i = 0;
      for (const k in a.res) { S[key[k]][own[(c.id * 7 + i * 13) % own.length]] += a.res[k]; i++; }
    }
  }
  if (fx.special === 'forts') {
    let worst = -1, wo = 1e9;
    for (const o of S.C) if (o.alive && o.id !== c.id && c.op[o.id] - (o._str || 0) * 0.001 < wo && bordersOf(G, c, o.id).length) { wo = c.op[o.id] - (o._str || 0) * 0.001; worst = o.id; }
    if (worst >= 0) for (const p of bordersOf(G, c, worst)) S.fort[p] = Math.max(S.fort[p], 2);
  }
  if (fx.special === 'opinion') for (const o of S.C) if (o.id !== c.id && o.ideo === c.ideo) { o.op[c.id] = clamp(o.op[c.id] + 20, -100, 100); c.op[o.id] = clamp(c.op[o.id] + 20, -100, 100); }
  if (fx.special === 'intel') c.intel = true;
  if (fx.special === 'faction' && c.faction < 0) {
    const f = findFactionFor(G, c);
    if (f) joinFaction(G, c, f.id, true); else createFaction(G, c, FACTION_NAMES[c.ideo]);
  }
  recalcMods(S, c);
  G.mapDirty = true;
}
export function bordersOf(G, c, other) {
  const S = G.S, W = G.world, out = [];
  for (let p = 0; p < W.NL; p++) {
    if (S.ctrl[p] !== c.id) continue;
    for (const q of W.prov[p].nb) if (S.ctrl[q] === other) { out.push(p); break; }
  }
  return out;
}

// ---------- yasalar
export function lawAllowed(G, c, kind, idx) {
  const L = LAWS[kind][idx];
  if (!L || c.laws[kind] === idx) return false;
  if (L.need === 'war' && !c._atWar) return false;
  if (L.need === 'tension25' && !(c._atWar || G.S.tension >= 25 || c.ideo === 'mil' || c.ideo === 'kol')) return false;
  return c.pp >= L.cost;
}
export function setLaw(G, c, kind, idx) {
  if (!lawAllowed(G, c, kind, idx)) return false;
  c.pp -= LAWS[kind][idx].cost;
  c.laws[kind] = idx;
  recalcMods(G.S, c);
  return true;
}

// ---------- ticaret
export function setImport(G, c, res, delta) {
  c.imports[res] = clamp(c.imports[res] + delta, 0, 400);
}

// ---------- asker alma ve şablonlar
export function trainNeeds(c, tpl) { return tplStats(c, tpl); }
export function queueTrain(G, c, tplId, n = 1) {
  const tpl = tplOf(c, tplId);
  if (!tplAllowed(c, tpl)) return false;
  for (let i = 0; i < n && c.train.length < 60; i++) c.train.push({ tpl: tpl.id, prog: 0, started: false });
  return true;
}
export function saveTemplate(G, c, id, name, bats) {
  let total = 0;
  const clean = {};
  for (const k of BAT_KEYS) { clean[k] = clamp(Math.round(bats[k] || 0), 0, MAX_BATS); total += clean[k]; }
  if (total < 1 || total > MAX_BATS) return false;
  for (const k of BAT_KEYS) if (clean[k] > 0 && BATTALION[k].req && !c.techs[BATTALION[k].req]) return false;
  let t = c.tpls.find((x) => x.id === id);
  if (!t) { t = { id: 'c' + c.nextTpl++, name, bats: clean }; c.tpls.push(t); } else { t.name = name; t.bats = clean; }
  c._stats = {};
  return t.id;
}

// ---------- günlük ekonomi
export function dailyEconomy(G, c) {
  const S = G.S, m = c._mods;
  c.pp += c._ppGain;

  // inşaat
  let free = c._civFree;
  for (let i = 0; i < c.build.length && free > 0; i++) {
    const b = c.build[i];
    if (S.ctrl[b.prov] !== c.id) { c.build.splice(i--, 1); continue; }
    const n = Math.min(5, free); free -= n;
    b.prog += n * 3.6 * (1 + m.construction) * (0.7 + 0.1 * S.infra[b.prov]);
    if (b.prog >= buildCost(G, b.type, b.prov)) { finishBuild(G, c, b); c.build.splice(i--, 1); }
  }
  c._civIdle = free;

  // üretim
  const cap = effCap(c);
  for (const l of c.lines) {
    if (l.fac <= 0) continue;
    c.stock[l.eq] += lineOutput(c, l);
    if (l.eff < cap) l.eff = Math.min(cap, l.eff + (cap - l.eff) * 0.012 + 0.0004);
  }
  if (c._dock > 0) c.naval += c._dock * 0.35 * (1 + m.navalBuild) * c._output;

  // araştırma
  for (let i = 0; i < c.research.length; i++) {
    const r = c.research[i];
    if (!r) continue;
    const t = TECH_BY_ID[r.id];
    r.prog += 1 / techDays(G, c, t);
    if (r.prog >= 1) {
      c.research[i] = null;
      grantTech(G, c, t.id);
      if (c.id === S.player) pushLog(G, 'tech', `Araştırma tamamlandı: ${t.name}.`);
    }
  }

  // ulusal hedef
  if (c.goal) {
    c.goal.prog += 1 / GOAL_DAYS;
    if (c.goal.prog >= 1) {
      const g = GOAL_BY_ID[c.goal.id];
      c.goal = null; c.goalsDone.push(g.id);
      applyGoal(G, c, g);
      if (c.id === S.player) pushLog(G, 'goal', `Ulusal hedef tamamlandı: ${g.name}.`);
    }
  }

  // eğitim
  let canStart = true;
  for (let i = 0; i < c.train.length; i++) {
    const t = c.train[i];
    const tpl = tplOf(c, t.tpl), st = tplStats(c, tpl);
    if (!t.started) {
      if (!canStart) continue;
      let ok = c._mpFree >= st.mp;
      for (const e in st.eq) if (c.stock[e] < st.eq[e]) ok = false;
      if (!ok) { canStart = false; continue; }
      for (const e in st.eq) c.stock[e] -= st.eq[e];
      c._mpFree -= st.mp; t.started = true;
    }
    t.prog += 1 / st.days;
    if (t.prog >= 1) {
      const p = deployProvince(G, c);
      c.train.splice(i--, 1);
      if (p >= 0) {
        const d = spawnDivision(G, c, tpl.id, p, { g: 0.6 });
        if (c.id === S.player) pushLog(G, 'army', `${d.n} göreve hazır: ${G.world.prov[p].name}.`, p);
      }
    }
  }

  // istikrar ve savaş desteği
  const baseStab = { dem: 66, mon: 60, mil: 56, kol: 52 }[c.ideo];
  let tStab = baseStab + (c.gm._stab || 0), tWs = { dem: 25, mon: 35, mil: 60, kol: 52 }[c.ideo] + S.tension * 0.3 + (c.gm._ws || 0);
  if (c._atWar) {
    const lostShare = c._vpOwn ? c._vpLost / c._vpOwn : 0;
    tStab -= 8 + lostShare * 30; tWs += 25 - lostShare * 30;
  }
  c.stab += clamp(tStab - c.stab, -0.15, 0.15);
  c.ws += clamp(tWs - c.ws, -0.2, 0.2);
  c.stab = clamp(c.stab, 0, 100); c.ws = clamp(c.ws, 0, 100);
}

export function applyGoalPublic(G, c, g) { applyGoal(G, c, g); }
