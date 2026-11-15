// Kara harekâtı: yol bulma, hareket, muharebe, ikmal, hava ve deniz dengesi.
import { MinHeap } from '../heap.js';
import { TERRAIN } from '../data.js';
import { ST_IDLE, ST_MOVE, ST_RETREAT, atWar, isFriend, divStats, tplOf, pushLog, natName, humansOf } from './core.js';

export const SEA_SPEED = 14; // km/saat (yükleme dâhil ortalama)
const KMH = 0.3; // günlük yürüyüş payı: 4 km/saatlik piyade ≈ 29 km/gün
function distKm(P, a, b) { return Math.hypot(P[a].cx - P[b].cx, P[a].cy - P[b].cy) * (P[a].kmpp + P[b].kmpp) * 0.5; }
const ORG_K = 0.01, HP_K = 0.004;

// ---- dizinler
export function rebuildIndex(G) {
  const S = G.S;
  S._pd = Array.from({ length: G.world.NP }, () => []);
  S._byId = new Map();
  S._bByProv = new Map();
  for (const d of S.divs) { S._pd[d.p].push(d); S._byId.set(d.id, d); }
  for (const b of S.battles) S._bByProv.set(b.prov, b);
}

export function spawnDivision(G, c, tplId, prov, opts = {}) {
  const S = G.S;
  const tpl = tplOf(c, tplId);
  c.divNo[tpl.id] = (c.divNo[tpl.id] || 0) + 1;
  const d = {
    id: S.nextDiv++, o: c.id, t: tpl.id, n: `${c.divNo[tpl.id]}. ${tpl.name}`, p: prov,
    s: opts.s ?? 1, g: opts.g ?? 1, path: [], prog: 0, st: ST_IDLE, b: -1, ent: 0, nos: 0, auto: opts.auto ?? !c.human,
  };
  S.divs.push(d);
  if (S._pd) { S._pd[prov].push(d); S._byId.set(d.id, d); }
  G.unitsDirty = true;
  return d;
}

export function destroyDiv(G, d, lossFrac = 0.7) {
  if (d.dead) return;
  const S = G.S, c = S.C[d.o];
  const st = divStats(S, d);
  const loss = st.mp * d.s * lossFrac;
  c.casualties += loss; c.lost += loss;
  d.dead = true; d.b = -1; d.path = [];
  const arr = S._pd[d.p], i = arr.indexOf(d);
  if (i >= 0) arr.splice(i, 1);
  S._byId.delete(d.id);
  G._sweep = true; G.unitsDirty = true;
}
export function sweepDead(G) {
  if (!G._sweep) return;
  G.S.divs = G.S.divs.filter((d) => !d.dead);
  G._sweep = false;
}

export function canEnter(G, o, p) {
  if (p >= G.world.NL) return true;
  const k = G.S.ctrl[p];
  return k === o || isFriend(G.S, o, k) || atWar(G.S, o, k);
}
function landSpeed(G, st, to) {
  return (st.speed * KMH) / TERRAIN[G.world.prov[to].terrain].move * (1 + 0.06 * (G.S.infra[to] - 1));
}
function canEmbark(G, o, p) {
  const S = G.S, k = S.ctrl[p];
  if (!S.port[p] || !(k === o || isFriend(S, o, k))) return false;
  const c = S.C[o];
  return !c._atWar || (c._navRatio ?? 1) >= 0.28;
}

// ---- A* yol bulma
let pfG = null, pfFrom = null, pfStamp = null, pfClosed = null, pfCur = 0;
const pfHeap = new MinHeap();
export function findPath(G, d, target, landOnly) {
  const S = G.S, W = G.world, NL = W.NL, P = W.prov, o = d.o;
  if (target === d.p) return [];
  if (!canEnter(G, o, target)) return null;
  if (!pfG || pfG.length !== W.NP) {
    pfG = new Float32Array(W.NP); pfFrom = new Int32Array(W.NP); pfStamp = new Uint32Array(W.NP); pfClosed = new Uint32Array(W.NP); pfCur = 0;
  }
  pfCur++;
  const st = divStats(S, d);
  const vmax = Math.max(SEA_SPEED, st.speed * KMH * 1.3) / 3.5; // piksel başına en az 3,5 km
  const tx = P[target].cx, ty = P[target].cy;
  const heap = pfHeap; heap.clear();
  pfG[d.p] = 0; pfStamp[d.p] = pfCur; pfFrom[d.p] = -1;
  heap.push(Math.hypot(P[d.p].cx - tx, P[d.p].cy - ty) / vmax, d.p);
  let found = false, guard = 0;
  while (heap.size && guard++ < 6000) {
    const u = heap.pop();
    if (pfClosed[u] === pfCur) continue;
    pfClosed[u] = pfCur;
    if (u === target) { found = true; break; }
    const pu = P[u], gu = pfG[u];
    const relax = (v, cost) => {
      if (pfClosed[v] === pfCur) return;
      const ng = gu + cost;
      if (pfStamp[v] !== pfCur || ng < pfG[v]) {
        pfG[v] = ng; pfStamp[v] = pfCur; pfFrom[v] = u;
        heap.push(ng + Math.hypot(P[v].cx - tx, P[v].cy - ty) / vmax, v);
      }
    };
    if (u < NL) {
      for (const v of pu.nb) {
        if (!canEnter(G, o, v)) continue;
        const k = S.ctrl[v];
        const hostile = k !== o && !isFriend(S, o, k);
        relax(v, (distKm(P, u, v) / landSpeed(G, st, v)) * (hostile ? 1.5 : 1));
      }
      if (!landOnly && pu.seaNb.length && canEmbark(G, o, u)) {
        for (const v of pu.seaNb) relax(v, distKm(P, u, v) / SEA_SPEED + 36);
      }
    } else {
      for (const v of pu.nb) relax(v, distKm(P, u, v) / SEA_SPEED);
      for (const v of pu.landNb) {
        if (!canEnter(G, o, v)) continue;
        const k = S.ctrl[v];
        const hostile = k !== o && !isFriend(S, o, k);
        relax(v, distKm(P, u, v) / landSpeed(G, st, v) + (hostile ? 60 : 12));
      }
    }
  }
  if (!found) return null;
  const path = [];
  for (let v = target; v !== d.p && v >= 0; v = pfFrom[v]) path.push(v);
  path.reverse();
  return path;
}

// ---- emirler
function leaveBattle(G, d) {
  if (d.b < 0) return;
  const b = G.S._bByProv.get(d.path[0]);
  if (b) { const i = b.att.indexOf(d.id); if (i >= 0) b.att.splice(i, 1); }
  d.b = -1;
}
export function haltDiv(G, d) {
  if (d.st === ST_RETREAT) return;
  leaveBattle(G, d);
  d.path = []; d.st = ST_IDLE; d.prog = 0; d.mis = 0;
  G.unitsDirty = true;
}
export function orderMove(G, d, target, landOnly) {
  if (d.st === ST_RETREAT || d.dead) return false;
  let path = findPath(G, d, target, true);
  if (!path && !landOnly) path = findPath(G, d, target, false);
  if (!path) return false;
  if (!path.length) { haltDiv(G, d); return true; }
  const keep = d.st === ST_MOVE && d.path.length && d.path[0] === path[0];
  if (!keep) { leaveBattle(G, d); d.prog = 0; }
  d.path = path; d.st = ST_MOVE; d.ent = 0;
  G.unitsDirty = true;
  return true;
}

function hasDefenders(S, p, o) {
  const arr = S._pd[p];
  for (let i = 0; i < arr.length; i++) { const dv = arr[i]; if (dv.st !== ST_RETREAT && !dv.dead && atWar(S, o, dv.o)) return true; }
  return false;
}
export function enemyIn(S, p, o) { return hasDefenders(S, p, o); }

function joinBattle(G, d, target) {
  const S = G.S;
  let b = S._bByProv.get(target);
  if (!b) {
    b = { id: S.nextBattle++, prov: target, att: [], start: S.hours, w: 50, luck: 1, ld: -1 };
    S.battles.push(b); S._bByProv.set(target, b);
  }
  if (!b.att.includes(d.id)) b.att.push(d.id);
  d.b = b.id;
  G.unitsDirty = true;
}

export function relocateCapital(G, c) {
  const S = G.S, W = G.world;
  const home = W.nations[c.id].capital;
  if (S.ctrl[home] === c.id) { c.capital = home; return; }
  let best = -1, bv = -1;
  for (let p = 0; p < W.NL; p++) {
    if (S.ctrl[p] !== c.id) continue;
    const v = W.prov[p].vp + (S.owner[p] === c.id ? 100 : 0);
    if (v > bv) { bv = v; best = p; }
  }
  if (best >= 0) c.capital = best;
}

export function setController(G, p, k) {
  const S = G.S, old = S.ctrl[p];
  if (old === k) return;
  S.ctrl[p] = k;
  G.mapDirty = true;
  const oc = S.C[old];
  if (oc.build.length) oc.build = oc.build.filter((b) => b.prov !== p);
  if (S.fort[p] > 0) S.fort[p]--;
  for (const w of S.wars) {
    if ((w.att.includes(old) && w.def.includes(k)) || (w.def.includes(old) && w.att.includes(k))) w.last = S.hours;
  }
  if (oc.capital === p) relocateCapital(G, oc);
  const kc = S.C[k];
  if (G.world.nations[k].capital === p) kc.capital = p;
  else if (S.ctrl[kc.capital] !== k) relocateCapital(G, kc);
  if (oc.deploy === p) oc.deploy = -1;
}

function capture(G, p, by) {
  const S = G.S, owner = S.owner[p];
  const k = owner !== by && isFriend(S, by, owner) && !S.C[owner].capit && S.C[owner].alive ? owner : by;
  setController(G, p, k);
}

function arrive(G, d, next) {
  const S = G.S, NL = G.world.NL;
  const arr = S._pd[d.p], i = arr.indexOf(d);
  if (i >= 0) arr.splice(i, 1);
  d.p = next; S._pd[next].push(d);
  d.path.shift(); d.prog = 0; d.ent = 0;
  if (next < NL) {
    const k = S.ctrl[next];
    if (k !== d.o && atWar(S, d.o, k)) capture(G, next, d.o);
  }
  if (!d.path.length) { d.st = ST_IDLE; d.mis = 0; }
  G.unitsDirty = true;
}

function retreat(G, dv) {
  const S = G.S, W = G.world;
  leaveBattle(G, dv);
  dv.path = []; dv.prog = 0; dv.mis = 0;
  if (dv.p >= W.NL) { dv.st = ST_IDLE; return; }
  const c = S.C[dv.o];
  const cap = W.prov[c.capital];
  let best = -1, bs = 1e18;
  for (const q of W.prov[dv.p].nb) {
    const k = S.ctrl[q];
    if (!(k === dv.o || isFriend(S, dv.o, k))) continue;
    let s = Math.hypot(W.prov[q].cx - cap.cx, W.prov[q].cy - cap.cy);
    if (S._bByProv.has(q)) s += 2000;
    if (k !== dv.o) s += 300;
    if (s < bs) { bs = s; best = q; }
  }
  if (best < 0) {
    const enemy = S.ctrl[dv.p] !== dv.o ? S.ctrl[dv.p] : -1;
    const to = humansOf(S, [dv.o, enemy]);
    if (to.length) pushLog(G, 'battle', `${dv.n} (${natName(G, dv.o)}) kuşatıldı ve teslim oldu.`, dv.p, false, to);
    destroyDiv(G, dv, 0.9);
    return;
  }
  dv.st = ST_RETREAT; dv.path = [best]; dv.g = Math.max(dv.g, 0.03);
  G.unitsDirty = true;
}

function endBattle(G, b, attackerWon, atts, defOwner) {
  const S = G.S;
  const i = S.battles.indexOf(b);
  if (i >= 0) S.battles.splice(i, 1);
  S._bByProv.delete(b.prov);
  for (const id of b.att) {
    const d = S._byId.get(id);
    if (!d) continue;
    d.b = -1;
    if (attackerWon && d.path[0] === b.prov) d.prog = Math.max(d.prog, 0.8);
  }
  G.unitsDirty = true;
  G.emit('battleEnd', { prov: b.prov, won: attackerWon, att: atts && atts[0] ? atts[0].o : -1, def: defOwner ?? -1 });
}

function resolveBattle(G, b) {
  const S = G.S, W = G.world, T = b.prov;
  const atts = [];
  for (const id of b.att) {
    const d = S._byId.get(id);
    if (d && !d.dead && d.b === b.id && d.path[0] === T && d.g > 0) atts.push(d);
  }
  if (!atts.length) { b.att = []; return endBattle(G, b, false, null, S.ctrl[T]); }
  b.att = atts.map((d) => d.id);
  const aOwner = atts[0].o;
  const defs = [];
  for (const dv of S._pd[T]) if (dv.st !== ST_RETREAT && !dv.dead && atWar(S, aOwner, dv.o)) defs.push(dv);
  if (!defs.length) return endBattle(G, b, true, atts, S.ctrl[T]);

  const dirSet = new Set();
  let amphAll = true;
  for (const d of atts) { dirSet.add(d.p); if (d.p < W.NL) amphAll = false; }
  const dirs = Math.min(4, dirSet.size);
  const cap = 60 + 30 * (dirs - 1);
  const pickFront = (list) => {
    list.sort((x, y) => y.g * y.s - x.g * x.s);
    const out = []; let w = 0;
    for (const d of list) {
      const dw = divStats(S, d).width;
      if (out.length && w + dw > cap * 1.1) continue;
      out.push(d); w += dw;
      if (w >= cap) break;
    }
    return out;
  };
  const fa = pickFront(atts), fd = pickFront(defs);

  const day = Math.floor(S.hours / 24);
  if (b.ld !== day) { b.ld = day; b.luck = 0.88 + G.rng.next() * 0.24; }
  const terr = TERRAIN[W.prov[T].terrain] || TERRAIN.plains;
  const terrMult = Math.max(0.25, 1 + terr.atk - 0.12 * S.fort[T]);
  const flank = 1 + 0.07 * (dirs - 1);

  let defAT = 0;
  for (const dv of fd) defAT = Math.max(defAT, S.C[dv.o]._mods.antiTank);
  let Aatk = 0, Abrk = 0, Aw = 0, Aorg = 0;
  for (const d of fa) {
    const st = divStats(S, d), c = S.C[d.o];
    let u = d.s * (d.nos > 2 ? 0.6 : 1) * (1 + (c._airMod || 0));
    if (d.p >= W.NL) u *= Math.min(1, 0.5 + c._mods.amphib);
    u *= 1 - 0.6 * st.armor * defAT;
    Aatk += st.atk * u; Abrk += st.brk * u; Aw += st.width; Aorg += st.org * d.g;
  }
  let Datk = 0, Ddef = 0, Dw = 0, Dorg = 0;
  for (const dv of fd) {
    const st = divStats(S, dv), c = S.C[dv.o], m = c._mods;
    const u = dv.s * (dv.nos > 2 ? 0.6 : 1) * (1 + (c._airMod || 0));
    const ent = 1 + dv.ent * (0.25 + m.entrench);
    const core = S.owner[T] === dv.o ? 1 + m.coreDef : 1;
    Ddef += st.def * u * ent * core; Datk += st.atk * u * (0.5 + 0.5 * ent);
    Dw += st.width; Dorg += st.org * dv.g;
  }
  Aatk *= terrMult * flank * b.luck;
  Abrk *= flank * (0.5 + 0.5 * terrMult);
  const effD = 0.25 * Math.min(Aatk, Ddef) + Math.max(0, Aatk - Ddef);
  const effA = 0.25 * Math.min(Datk, Abrk) + Math.max(0, Datk - Abrk);

  const tA = Aorg / Math.max(0.01, effA), tD = Dorg / Math.max(0.01, effD);
  b.w = Math.round((100 * tA) / (tA + tD));
  b.na = atts.length; b.nd = defs.length; b.ao = aOwner; b.do = defs[0].o;
  b.mods = { terr: terrMult, flank, amph: amphAll };

  const hit = (d, eff, totalW, enemyOwner) => {
    const st = divStats(S, d), c = S.C[d.o];
    const share = st.width / totalW;
    d.g -= (eff * share * ORG_K) / st.org;
    const ds = (eff * share * HP_K) / st.hp;
    d.s -= ds;
    const loss = ds * st.mp;
    c.casualties += loss * (1 - 0.5 * c._mods.recovery); c.lost += loss;
    if (enemyOwner >= 0) S.C[enemyOwner].kills += loss;
  };
  for (const dv of fd) hit(dv, effD, Dw, aOwner);
  for (const d of fa) hit(d, effA, Aw, defs[0].o);

  for (const d of fa) {
    if (d.s < 0.08) destroyDiv(G, d, 1);
    else if (d.g <= 0) { d.g = 0; haltDiv(G, d); }
  }
  for (const dv of fd) {
    if (dv.s < 0.08) destroyDiv(G, dv, 1);
    else if (dv.g <= 0) { dv.g = 0; retreat(G, dv); }
  }
}

// ---- saatlik adım
export function hourlyMilitary(G) {
  const S = G.S, W = G.world, NL = W.NL, P = W.prov;
  // muharebeler
  for (let i = S.battles.length - 1; i >= 0; i--) resolveBattle(G, S.battles[i]);
  // hareket ve toparlanma
  const divs = S.divs;
  for (let i = 0; i < divs.length; i++) {
    const d = divs[i];
    if (d.dead) continue;
    const c = S.C[d.o];
    if (d.st === ST_IDLE) {
      if (d.g < 1 && d.nos <= 2 && !S._bByProv.has(d.p)) d.g = Math.min(1, d.g + 0.011 * (1 + c._mods.orgRegen) * (0.7 + c.ws / 330));
      continue;
    }
    const next = d.path[0];
    if (next === undefined) { d.st = ST_IDLE; continue; }
    const st = divStats(S, d);
    let sp;
    if (next < NL) {
      const k = S.ctrl[next];
      const fr = k === d.o || isFriend(S, d.o, k);
      if (d.st === ST_RETREAT) {
        if (!fr) { retreat(G, d); continue; }
      } else if (!fr) {
        if (!atWar(S, d.o, k)) { haltDiv(G, d); continue; }
        if (hasDefenders(S, next, d.o)) {
          if (d.g <= 0.02) continue;
          if (d.b < 0) joinBattle(G, d, next);
          d.prog = Math.min(0.9, d.prog + (landSpeed(G, st, next) / Math.max(20, distKm(P, d.p, next))) * 0.3);
          continue;
        }
      }
      if (d.b >= 0) d.b = -1;
      sp = landSpeed(G, st, next) * (d.st === ST_RETREAT ? 1.35 : fr ? 1 : 0.75);
    } else {
      if (d.p < NL && !canEmbark(G, d.o, d.p)) { haltDiv(G, d); continue; }
      sp = SEA_SPEED;
    }
    d.prog += sp / Math.max(20, distKm(P, d.p, next));
    if (d.g < 1 && d.nos <= 2) d.g = Math.min(1, d.g + 0.003 * (1 + c._mods.orgRegen));
    if (d.prog >= 1) arrive(G, d, next);
  }
  sweepDead(G);
}

// ---- günlük: ikmal, takviye, hava/deniz
function supplyBfs(G, c) {
  const S = G.S, W = G.world, NL = W.NL;
  if (!c._sup || c._sup.length !== NL) c._sup = new Uint8Array(NL);
  const sup = c._sup; sup.fill(0);
  const q = [];
  const ok = (p) => { const k = S.ctrl[p]; return k === c.id || isFriend(S, c.id, k); };
  if (ok(c.capital)) { sup[c.capital] = 1; q.push(c.capital); }
  const seaOk = !c._atWar || (c._navRatio ?? 1) >= 0.3;
  if (seaOk) for (let p = 0; p < NL; p++) if (S.port[p] && !sup[p] && ok(p)) { sup[p] = 1; q.push(p); }
  while (q.length) {
    const u = q.pop();
    for (const v of W.prov[u].nb) if (!sup[v] && ok(v)) { sup[v] = 1; q.push(v); }
  }
}

export function airNaval(G) {
  const S = G.S;
  for (const c of S.C) {
    c._fEff = c.stock.fighter * (1 + c._mods.airPower);
    c._nEff = c.naval * (1 + c._mods.navalPower);
  }
  for (const c of S.C) {
    if (!c.alive) continue;
    const enemies = c._enemies.filter((e) => !S.C[e].capit);
    if (!enemies.length) { c._airSup = 0.5; c._airMod = 0; c._navRatio = 1; c._eF = 0; c._eN = 0; continue; }
    let oF = 0, oN = 0, eF = 0, eN = 0, aa = 0;
    for (const o of S.C) {
      if (!o.alive || o.capit) continue;
      if (o.id === c.id || (isFriend(S, c.id, o.id) && o._atWar)) { oF += o._fEff; oN += o._nEff; }
    }
    for (const e of enemies) { eF += S.C[e]._fEff; eN += S.C[e]._nEff; aa = Math.max(aa, S.C[e]._mods.antiAir); }
    const sup = (oF + 2) / (oF + eF + 4);
    const adj = 0.5 + (sup - 0.5) * (sup > 0.5 ? 1 - aa : 1);
    const cas = c.stock.bomber * (1 + c._mods.casPower) * adj * 2;
    c._airSup = sup; c._eF = eF; c._eN = eN;
    c._airMod = (adj - 0.5) * 0.4 + 0.25 * (cas / (cas + 400)) * (1 - aa);
    c._navRatio = (oN + 5) / (oN + eN + 10);
  }
}

export function dailyMilitary(G) {
  const S = G.S, NL = G.world.NL;
  airNaval(G);
  const day = Math.floor(S.hours / 24);
  for (const c of S.C) {
    if (!c.alive) continue;
    supplyBfs(G, c);
    const enemies = c._enemies.filter((e) => !S.C[e].capit);
    if (enemies.length) {
      // hava yıpranması
      if (c._eF > 0 && c.stock.fighter > 0) c.stock.fighter = Math.max(0, c.stock.fighter - Math.min(c.stock.fighter * 0.012, c._eF * 0.006 * (1 - c._airSup) * 2));
      if (c._eF > 0 && c.stock.bomber > 0) c.stock.bomber = Math.max(0, c.stock.bomber - c.stock.bomber * 0.008 * (1 - c._airSup) * 2 * Math.min(1, c._eF / 100));
      if (day % 7 === c.id % 7 && c._eN > 0 && c.naval > 0) {
        c.naval = Math.max(0, c.naval - Math.min(c.naval * 0.04, c._eN * 0.014 * (1 - c._navRatio) * 2 * (0.5 + G.rng.next())));
      }
    }
  }
  for (const d of S.divs) {
    if (d.dead) continue;
    const c = S.C[d.o], st = divStats(S, d), m = c._mods;
    const land = d.p < NL;
    const supplied = !land || c._sup[d.p] === 1;
    d.nos = supplied ? 0 : d.nos + 1;
    if (!supplied && d.nos > 2) { d.s -= 0.025; d.g = Math.max(0, d.g - 0.08); }
    if (!land && c._atWar && c._navRatio < 0.5) d.s -= 0.05 * (0.5 - c._navRatio) * 2;
    const inFight = d.b >= 0 || S._bByProv.has(d.p);
    if (supplied && land && d.s < 1) {
      let want = Math.min((inFight ? 0.012 : 0.035) * (1 + m.reinforce), 1 - d.s);
      for (const e in st.eq) { const need = st.eq[e] * want; if (need > 0) want = Math.min(want, (c.stock[e] / need) * want); }
      const mpNeed = st.mp * want;
      if (mpNeed > 0 && c._mpFree < mpNeed) want *= Math.max(0, c._mpFree) / mpNeed;
      if (want > 0.0005) {
        for (const e in st.eq) c.stock[e] = Math.max(0, c.stock[e] - st.eq[e] * want);
        c._mpFree -= st.mp * want;
        d.s += want;
      }
    }
    if (d.st === ST_IDLE && d.b < 0) d.ent = Math.min(1, d.ent + 0.07); else d.ent = 0;
    if (d.s < 0.08) destroyDiv(G, d, 1);
  }
  sweepDead(G);
}

// Barış sonrası yabancı topraktaki birlikleri eve gönder
export function expelStrangers(G) {
  const S = G.S, NL = G.world.NL;
  for (const d of S.divs) {
    if (d.dead || d.p >= NL) continue;
    const k = S.ctrl[d.p];
    if (k === d.o || isFriend(S, d.o, k) || atWar(S, d.o, k)) continue;
    const c = S.C[d.o];
    let home = S.ctrl[c.capital] === c.id ? c.capital : -1;
    if (home < 0) for (let p = 0; p < NL; p++) if (S.ctrl[p] === c.id) { home = p; break; }
    if (home < 0) { destroyDiv(G, d, 0); continue; }
    const arr = S._pd[d.p], i = arr.indexOf(d);
    if (i >= 0) arr.splice(i, 1);
    d.p = home; S._pd[home].push(d);
    d.path = []; d.st = ST_IDLE; d.prog = 0; d.b = -1; d.mis = 0;
  }
  sweepDead(G);
  G.unitsDirty = true;
}

export function deployProvince(G, c) {
  const S = G.S;
  if (c.deploy >= 0 && S.ctrl[c.deploy] === c.id) return c.deploy;
  if (S.ctrl[c.capital] === c.id) return c.capital;
  for (let p = 0; p < G.world.NL; p++) if (S.ctrl[p] === c.id) return p;
  return -1;
}
