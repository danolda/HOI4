// Yapay zekâ: ekonomi, araştırma, asker alma, diplomasi ve cephe yönetimi.
import { TECHS, GOALS, EQUIP, TERRAIN, LAWS, FACTION_NAMES, yearFrac } from '../data.js';
import { ST_IDLE, ST_RETREAT, atWar, isFriend, divStats, tplOf, tplStats, tplAllowed } from './core.js';
import { bestBuildProv, queueBuild, addLine, setLineFac, techAvailable, startResearch, goalAvailable, startGoal, lawAllowed, setLaw, queueTrain } from './economy.js';
import { orderMove, haltDiv } from './military.js';
import { canJustify, startJustify, canDeclare, declareWar, findFactionFor, canJoinFaction, joinFaction, createFaction, guarantee, isNeighbor, factionOf, JUSTIFY_COST } from './diplomacy.js';

function weighted(rng, items, wf) {
  let tot = 0;
  const ws = items.map((it) => { const w = Math.max(0, wf(it)); tot += w; return w; });
  if (tot <= 0) return null;
  let r = rng.next() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// ---------- üretim hatları (oyuncunun başlangıç dağılımı için de kullanılır)
export function aiLines(G, c) {
  const S = G.S;
  const target = { rifle: 6000, arty: 500, truck: 700, tank: 500, fighter: 600, bomber: 300 };
  const base = { rifle: 4, arty: 2, truck: 0.8, tank: c.ideo === 'mil' ? 1.8 : 1.3, fighter: 1.4, bomber: 0.6 };
  const want = {};
  let tot = 0;
  for (const k in base) {
    if (EQUIP[k].req && !c.techs[EQUIP[k].req]) continue;
    const w = base[k] * Math.min(1.5, Math.max(0.3, 1.5 - c.stock[k] / target[k]));
    want[k] = w; tot += w;
  }
  const mil = c._mil;
  const alloc = {};
  let used = 0;
  const keys = Object.keys(want);
  for (const k of keys) { alloc[k] = Math.floor((mil * want[k]) / tot); used += alloc[k]; }
  keys.sort((a, b) => want[b] - want[a]);
  for (let i = 0; used < mil && keys.length; i = (i + 1) % keys.length) { alloc[keys[i]]++; used++; }
  for (const k of keys) if (alloc[k] > 0 && !c.lines.some((l) => l.eq === k)) addLine(G, c, k);
  for (let i = 0; i < c.lines.length; i++) { const l = c.lines[i]; const t = alloc[l.eq] || 0; if (l.fac > t) setLineFac(G, c, i, t - l.fac); }
  for (let i = 0; i < c.lines.length; i++) { const l = c.lines[i]; const t = alloc[l.eq] || 0; if (l.fac < t) setLineFac(G, c, i, t - l.fac); }
  c.ai.lastLines = S.hours;
}

function aiEconomy(G, c) {
  const S = G.S, rng = G.rng;
  // ticaret
  for (const k of ['steel', 'oil', 'alu']) {
    const bal = c._bal[k];
    if (bal < 0 && c._tradeCiv < c._civ * 0.3) c.imports[k] += Math.ceil(-bal / 8) * 8;
    else if (bal >= 8 && c.imports[k] > 0) c.imports[k] = Math.max(0, c.imports[k] - Math.floor(bal / 8) * 8);
  }
  if (S.hours - c.ai.lastLines > 24 * 90 || c._milFree > 0) aiLines(G, c);
  // inşaat
  const maxProj = Math.min(8, Math.ceil(c._civFree / 5));
  const coastal = c._ports > 0;
  let guard = 0;
  while (c.build.length < maxProj && guard++ < 12) {
    const yr = yearFrac(S.hours);
    const milW = Math.min(0.8, 0.22 + (c._atWar ? 0.45 : 0) + S.tension / 220 + (c.ideo === 'mil' ? 0.15 : 0) + (yr > 1934 ? 0.1 : 0) + (c.ideo === 'dem' && S.tension >= 40 ? 0.2 : 0));
    const opts = [['mil', milW], ['civ', Math.max(0.12, 0.85 - milW)], ['infra', 0.1], ['dock', coastal ? 0.06 : 0], ['fort', c._atWar ? 0.03 : 0]];
    const pick = weighted(rng, opts, (o) => o[1]);
    const p = bestBuildProv(G, c, pick[0]);
    if (p >= 0) queueBuild(G, c, pick[0], p);
  }
  // yasalar
  if (c.laws.eco < 3 && (c._atWar || S.tension >= 30 || c.ideo === 'mil') && lawAllowed(G, c, 'eco', c.laws.eco + 1) && c.pp >= LAWS.eco[c.laws.eco + 1].cost + 20) setLaw(G, c, 'eco', c.laws.eco + 1);
  if (c.laws.cons < 3 && (c._mpFree < 40000 || c._atWar || (S.tension >= 40 && c.laws.cons < 2)) && lawAllowed(G, c, 'cons', c.laws.cons + 1) && c.pp >= LAWS.cons[c.laws.cons + 1].cost + 20) setLaw(G, c, 'cons', c.laws.cons + 1);
}

function aiResearchGoals(G, c) {
  const S = G.S, rng = G.rng, yr = yearFrac(S.hours);
  const catW = { ind: 1.4, doc: 1.2, inf: 1.2, art: 1, arm: c.ideo === 'mil' ? 1.4 : 0.8, air: 0.9, nav: c._ports > 0 ? 0.5 : 0.08, sci: 1.2 };
  for (let i = 0; i < c.slots; i++) {
    if (c.research[i]) continue;
    const cands = TECHS.filter((t) => techAvailable(c, t) && !c.research.some((r) => r && r.id === t.id));
    const t = weighted(rng, cands, (t) => catW[t.cat] / (1 + Math.max(0, t.year - yr) * 2.5));
    if (t) startResearch(G, c, i, t.id);
  }
  if (!c.goal) {
    const cands = GOALS.filter((g) => goalAvailable(G, c, g));
    const g = weighted(rng, cands, (g) => {
      let w = 1;
      if (g.id.startsWith('g_ind')) w = c.ideo === 'dem' ? 1.6 : 1.2;
      if (g.id.startsWith('g_arm')) w = c.ideo === 'mil' ? 1.6 : 1;
      if (g.id === 'g_pol4') w = c.ideo === 'mil' ? 3 : c.ideo === 'kol' ? 2 : 0.4;
      if (g.id === 'g_pol5') w = c.ideo === 'mon' ? 3 : c.ideo === 'dem' ? 0.8 : 0.15;
      if (g.id === 'g_pol6') w = S.tension > 20 ? 2.5 : 0.8;
      return w;
    });
    if (g) startGoal(G, c, g.id);
  }
}

function aiRecruit(G, c) {
  const S = G.S;
  const maxDivs = Math.min(Math.floor(c._mpMax / 11000), Math.floor(8 + c._mil * 1.5), Math.floor(18 + c._nProv * 0.7));
  const waiting = c.train.filter((t) => !t.started).length;
  if (c._nDiv + c.train.length >= maxDivs || waiting >= 2) return;
  let nArm = 0, nMot = 0;
  for (const d of S.divs) if (d.o === c.id) { const k = divStats(S, d).kind; if (k === 'arm') nArm++; else if (k === 'mot') nMot++; }
  const has = (id) => { const t = tplOf(c, id); if (t.id !== id || !tplAllowed(c, t)) return false; const st = tplStats(c, t); for (const e in st.eq) if (c.stock[e] < st.eq[e]) return false; return c._mpFree >= st.mp; };
  const n = Math.max(1, c._nDiv);
  if (nArm < n * 0.2 && has('t_arm')) queueTrain(G, c, 't_arm', 1);
  else if (nMot < n * 0.15 && has('t_mot')) queueTrain(G, c, 't_mot', 1);
  else if (has('t_inf')) queueTrain(G, c, 't_inf', c.stock.rifle > 2500 ? 2 : 1);
  else if (has('t_lig') && (c._atWar || !c.major)) queueTrain(G, c, 't_lig', 1);
}

function strengthOf(G, id) {
  const S = G.S, c = S.C[id];
  let s = c._str || 0;
  const f = factionOf(S, c);
  if (f) for (const m of f.members) if (m !== id) s += (S.C[m]._str || 0) * 0.8;
  for (const g of S.C) if (g.alive && !g.capit && g.guar.includes(id) && !(f && f.members.includes(g.id))) s += (g._str || 0) * 0.6;
  return s;
}

function pickTarget(G, c) {
  const S = G.S, rng = G.rng;
  let best = -1, bs = 0;
  const my = (c._str || 0) + (factionOf(S, c) ? factionOf(S, c).members.reduce((s, m) => s + (m !== c.id ? (S.C[m]._str || 0) * 0.5 : 0), 0) : 0);
  for (const o of S.C) {
    if (!o.alive || o.capit || o.id === c.id || isFriend(S, c.id, o.id) || !canJustify(G, c.id, o.id).ok) continue;
    if (!isNeighbor(G, c.id, o.id)) continue;
    let r = my / Math.max(1, strengthOf(G, o.id));
    if (o.ideo !== c.ideo) r *= 1.2;
    if (o._atWar) r *= 1.25;
    r *= 0.85 + rng.next() * 0.3;
    if (r > bs) { bs = r; best = o.id; }
  }
  const idleYears = (S.hours - (c.ai.lastWar || 0)) / (24 * 365);
  const need = (c.ideo === 'mil' ? 1.25 : 1.45) - Math.min(0.4, Math.max(0, idleYears - 2) * 0.08);
  return bs >= need ? best : -1;
}

function aiDiplomacy(G, c) {
  const S = G.S, rng = G.rng;
  const threat = S.C.some((o) => o.alive && !o.capit && (o.just.some((j) => j.target === c.id) || o.wargoals.includes(c.id)));
  if (c.faction < 0) {
    const f = findFactionFor(G, c);
    const want = c._atWar || threat || S.tension >= (c.ideo === 'dem' ? 25 : c.ideo === 'mon' ? 45 : 12);
    if (want) {
      if (f && canJoinFaction(G, c, f).ok) joinFaction(G, c, f.id);
      else if (!f && c.major) createFaction(G, c, FACTION_NAMES[c.ideo]);
      else if (c._atWar || threat) {
        for (const g of S.factions) if (canJoinFaction(G, c, g).ok && rng.chance(0.6)) { joinFaction(G, c, g.id); break; }
      }
    }
  }
  if (c.capit) return;
  if (c.ideo === 'dem' && c.major && S.tension >= 20 && c.pp >= 70) {
    const cands = S.C.filter((o) => o.alive && !o.capit && !o.major && o.id !== c.id && (o.ideo === 'dem' || o.ideo === 'mon') && !c.guar.includes(o.id) && !atWar(S, c.id, o.id)
      && S.C.some((a) => a.alive && (a.just.some((j) => j.target === o.id) || a.wargoals.includes(o.id))));
    if (cands.length) guarantee(G, c.id, rng.pick(cands).id);
  }
  const aggressive = c.ideo === 'mil' || c.ideo === 'kol' || (c.ideo === 'mon' && c.major && S.tension > 35);
  if (aggressive) {
    for (const t of c.wargoals.slice()) {
      if (canDeclare(G, c.id, t).ok && (c._str || 0) >= (S.C[t]._str || 0) * 0.9) { declareWar(G, c.id, t); return; }
    }
    if (!c._atWar && S.hours >= c.ai.nextAggro && !c.just.length && !c.wargoals.length) {
      const t = pickTarget(G, c);
      if (t >= 0) {
        if (c.freeGoals > 0) startJustify(G, c.id, t, true);
        else if (c.pp >= JUSTIFY_COST) startJustify(G, c.id, t, false);
      } else c.ai.nextAggro = S.hours + 24 * 120;
    }
  }
  if (c.ideo === 'dem' && c.major && !c._atWar && S.tension >= 55) {
    for (const t of c.wargoals.slice()) if (canDeclare(G, c.id, t).ok) { declareWar(G, c.id, t); return; }
    if (!c.just.length && !c.wargoals.length && c.pp >= JUSTIFY_COST) {
      const cands = S.C.filter((o) => o.alive && !o.capit && o.aggr > 0 && o._atWar && canJustify(G, c.id, o.id).ok && (c._str || 0) > (o._str || 0) * 0.7);
      if (cands.length) startJustify(G, c.id, cands.sort((a, b) => b.aggr - a.aggr)[0].id, false);
    }
  }
}

// ---------- cephe yönetimi
let wgt = null, cnt = null, des = null;
export function aiMilitary(G, c, onlyAuto, stance = 1) {
  const S = G.S, W = G.world, NL = W.NL, P = W.prov;
  if (!wgt || wgt.length !== NL) { wgt = new Float32Array(NL); cnt = new Float32Array(NL); des = new Float32Array(NL); }
  const mine = [];
  for (const d of S.divs) if (d.o === c.id && !d.dead && d.st !== ST_RETREAT && (!onlyAuto || d.auto)) mine.push(d);
  const n = mine.length;
  if (!n) return;
  const war = c._enemies.some((e) => !S.C[e].capit && S.C[e].alive);

  // kaybedilen taarruzlardan çekil
  for (const d of mine) {
    if (d.b < 0) continue;
    const b = S._bByProv.get(d.path[0]);
    if (b && b.w < 27 && S.hours - b.start > 18) haltDiv(G, d);
  }

  const watch = new Float32Array(S.N);
  for (const o of S.C) {
    if (!o.alive || o.id === c.id) continue;
    const hot = o.just.some((j) => j.target === c.id) || o.wargoals.includes(c.id) || c.just.some((j) => j.target === o.id) || c.wargoals.includes(o.id);
    watch[o.id] = hot ? 1 : c.op[o.id] < -25 || o.op[c.id] < -25 ? 0.3 : 0.07;
  }
  wgt.fill(0); cnt.fill(0);
  const targets = new Map();
  let total = 0;
  for (let p = 0; p < NL; p++) {
    const k = S.ctrl[p];
    const own = k === c.id;
    if (!own && !(war && isFriend(S, c.id, k))) continue;
    let w = 0;
    const nb = P[p].nb;
    for (let i = 0; i < nb.length; i++) {
      const q = nb[i], kq = S.ctrl[q];
      if (kq === k || kq === c.id) continue;
      if (atWar(S, c.id, kq)) {
        let es = 0;
        const arr = S._pd[q];
        for (let j = 0; j < arr.length; j++) if (atWar(S, c.id, arr[j].o)) es++;
        w += 1 + es * 0.9;
        let t = targets.get(q);
        if (!t) { t = []; targets.set(q, t); }
        t.push(p);
      } else if (own && !isFriend(S, c.id, kq)) w += watch[kq];
    }
    if (!own) w *= 0.5;
    if (own && war && P[p].coastal && (S.port[p] || P[p].vp >= 5) && c._navRatio < 0.75) w += 0.22 + P[p].vp * 0.02;
    if (p === c.capital) w += 0.55;
    wgt[p] = w; total += w;
  }
  if (total <= 0) return;

  const homeOf = (d) => (d.path.length ? d.path[d.path.length - 1] : d.p);
  for (const d of mine) { const h = homeOf(d); if (h < NL) cnt[h]++; }
  const deficits = [];
  for (let p = 0; p < NL; p++) {
    des[p] = (wgt[p] / total) * n;
    if (des[p] - cnt[p] >= 0.55) deficits.push(p);
  }
  deficits.sort((a, b) => des[b] - cnt[b] - (des[a] - cnt[a]));
  const cands = [];
  for (const d of mine) {
    if (d.b >= 0 || d.mis || S._bByProv.has(d.p)) continue;
    const h = homeOf(d);
    if (h >= NL || wgt[h] === 0 || cnt[h] - des[h] >= 0.9) cands.push(d);
  }
  let moves = 0;
  const maxMoves = Math.max(4, Math.ceil(n / 3));
  for (const p of deficits) {
    if (!cands.length || moves >= maxMoves) break;
    let need = Math.round(des[p] - cnt[p]);
    if (need < 1) need = 1;
    while (need > 0 && cands.length && moves < maxMoves) {
      let bi = -1, bd = 1e18;
      for (let i = 0; i < cands.length; i++) {
        const d = cands[i], h = homeOf(d);
        if (h < NL && wgt[h] > 0 && cnt[h] - des[h] < 0.9) continue; // artık fazlalık değil
        const dist = Math.hypot(P[d.p].cx - P[p].cx, P[d.p].cy - P[p].cy);
        if (dist < bd) { bd = dist; bi = i; }
      }
      if (bi < 0) break;
      const d = cands[bi];
      cands.splice(bi, 1);
      const h = homeOf(d);
      if (orderMove(G, d, p)) { if (h < NL) cnt[h]--; cnt[p]++; need--; moves++; }
    }
  }

  if (!war || stance <= 0) return;
  // taarruz planı
  const thr = stance >= 2 ? 1.2 : 1.55;
  const elig = (d) => d.o === c.id && (!onlyAuto || d.auto) && d.st === ST_IDLE && d.b < 0 && d.g >= 0.55 && d.s >= 0.45 && d.nos <= 2 && !d.mis && !d.dead;
  const plans = [];
  for (const [q, froms] of targets) {
    let defPow = 0, nDef = 0;
    for (const dv of S._pd[q]) {
      if (dv.st === ST_RETREAT || !atWar(S, c.id, dv.o)) continue;
      const st = divStats(S, dv);
      defPow += st.def * dv.s * (0.35 + 0.65 * dv.g) * (1 + dv.ent * 0.25); nDef++;
    }
    const terr = Math.max(0.25, 1 + (TERRAIN[P[q].terrain] || TERRAIN.plains).atk - 0.12 * S.fort[q]);
    let pow = 0, av = 0;
    for (const p of froms) for (const d of S._pd[p]) if (elig(d)) { pow += divStats(S, d).atk * d.s * terr; av++; }
    if (!av) continue;
    if (nDef === 0) plans.push({ q, froms, score: 60 + P[q].vp * 8 + froms.length * 3, nDef, defPow, terr });
    else if (pow / defPow >= thr) plans.push({ q, froms, score: (pow / defPow) * 10 + P[q].vp * 4 + froms.length * 2, nDef, defPow, terr });
  }
  plans.sort((a, b) => b.score - a.score);
  const used = new Set();
  let launched = 0;
  const maxAtk = Math.max(2, Math.ceil(n / 5));
  for (const pl of plans) {
    if (launched >= maxAtk) break;
    const av = [];
    for (const p of pl.froms) for (const d of S._pd[p]) if (elig(d) && !used.has(d.id)) av.push(d);
    if (!av.length) continue;
    if (pl.nDef === 0) {
      av.sort((a, b) => divStats(S, b).speed - divStats(S, a).speed);
      const k = P[pl.q].vp >= 5 ? 2 : 1;
      for (let i = 0; i < Math.min(k, av.length); i++) if (orderMove(G, av[i], pl.q, true)) used.add(av[i].id);
      launched++;
      continue;
    }
    av.sort((a, b) => divStats(S, b).atk * b.s - divStats(S, a).atk * a.s);
    const chosen = [];
    let pow = 0;
    const left = new Map();
    for (const d of av) {
      if (pow >= pl.defPow * thr * 1.25 || chosen.length >= 9) break;
      // yoğun tehdit altındaki eyaleti tamamen boşaltma
      const stay = left.get(d.p) ?? S._pd[d.p].reduce((s, x) => s + (x.o === c.id && x.st === ST_IDLE ? 1 : 0), 0);
      if (stay <= 1 && wgt[d.p] >= 2.8) continue;
      left.set(d.p, stay - 1);
      chosen.push(d); pow += divStats(S, d).atk * d.s * pl.terr;
    }
    if (pow < pl.defPow * thr) continue;
    for (const d of chosen) if (orderMove(G, d, pl.q, true)) used.add(d.id);
    launched++;
  }

  // deniz aşırı çıkarma
  const day = Math.floor(S.hours / 24);
  if (!onlyAuto && day % 10 === c.id % 10 && c._navRatio >= 0.45 && (targets.size === 0 || G.rng.chance(0.2))) {
    const idle = mine.filter((d) => elig(d) && d.p < NL && S.ctrl[d.p] === c.id);
    if (idle.length >= 4) {
      let best = -1, bs = -1e9;
      const cap = P[c.capital];
      for (let q = 0; q < NL; q++) {
        if (!P[q].coastal || !atWar(S, c.id, S.ctrl[q])) continue;
        let defs = 0;
        for (const dv of S._pd[q]) if (atWar(S, c.id, dv.o)) defs++;
        const s = P[q].vp * 3 + (S.port[q] ? 6 : 0) - defs * 6 - Math.hypot(P[q].cx - cap.cx, P[q].cy - cap.cy) / 160 + G.rng.next() * 4;
        if (s > bs) { bs = s; best = q; }
      }
      if (best >= 0) {
        idle.sort((a, b) => Math.hypot(P[a.p].cx - P[best].cx, P[a.p].cy - P[best].cy) - Math.hypot(P[b.p].cx - P[best].cx, P[b.p].cy - P[best].cy));
        const k = Math.min(8, Math.max(3, Math.floor(n / 4)));
        let sent = 0, fails = 0;
        for (const d of idle) {
          if (sent >= k || fails >= 3) break;
          if (orderMove(G, d, best)) { d.mis = 1; sent++; } else fails++;
        }
      }
    }
  }
}

export function aiDaily(G, c) {
  const S = G.S;
  const k = Math.floor(S.hours / 24) + c.id * 3;
  if (!c.capit) {
    if (k % 7 === 0) aiEconomy(G, c);
    if (k % 5 === 0) aiResearchGoals(G, c);
    if (k % 12 === 0) aiRecruit(G, c);
  }
  if (k % 14 === 0) aiDiplomacy(G, c);
  if (!c.capit && (c._atWar || k % 3 === 0)) aiMilitary(G, c, false, c.ideo === 'mil' ? 2 : 1);
}

export function aiBootstrap(G, c) { aiResearchGoals(G, c); aiEconomy(G, c); }
