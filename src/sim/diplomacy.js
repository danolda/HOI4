// Diplomasi: savaşlar, ittifaklar, gerekçeler, teslimiyet ve barış.
import { FACTION_NAMES, MAJORS } from '../data.js';
import { clamp } from '../rng.js';
import { atWar, isFriend, sameFaction, buildWarMatrix, buildFriendMatrix, baseOpinion, pushLog, natName, refreshAll, vpShare } from './core.js';
import { setController, relocateCapital, destroyDiv, sweepDead, expelStrangers } from './military.js';

export function rebuildRelations(G) { buildWarMatrix(G.S); buildFriendMatrix(G.S); }

export function addTension(G, v) { G.S.tension = clamp(G.S.tension + v, 0, 100); }
function shiftOpinion(S, of, about, v) { S.C[of].op[about] = clamp(S.C[of].op[about] + v, -100, 100); }

export function warsOf(S, id) { return S.wars.filter((w) => w.att.includes(id) || w.def.includes(id)); }
export function warBetween(S, a, b) { return S.wars.find((w) => (w.att.includes(a) && w.def.includes(b)) || (w.att.includes(b) && w.def.includes(a))); }
export function isNeighbor(G, a, b) {
  const S = G.S, W = G.world;
  for (let p = 0; p < W.NL; p++) {
    if (S.ctrl[p] !== a) continue;
    for (const q of W.prov[p].nb) if (S.ctrl[q] === b) return true;
  }
  return false;
}

// ---------- ittifaklar
export function factionOf(S, c) { return c.faction >= 0 ? S.factions.find((f) => f.id === c.faction) : null; }
export function findFactionFor(G, c) {
  const S = G.S;
  let best = null;
  for (const f of S.factions) {
    const L = S.C[f.leader];
    if (!L.alive || f.ideo !== c.ideo) continue;
    if (f.members.some((m) => atWar(S, m, c.id))) continue;
    if (!best || f.members.length > best.members.length) best = f;
  }
  return best;
}
export function createFaction(G, c, name) {
  const S = G.S;
  if (c.faction >= 0) return null;
  const id = S.factions.reduce((mx, f) => Math.max(mx, f.id), -1) + 1;
  let nm = name || FACTION_NAMES[c.ideo];
  if (S.factions.some((f) => f.name === nm)) nm = `${natName(G, c.id)} Bloğu`;
  const f = { id, name: nm, leader: c.id, members: [c.id], ideo: c.ideo };
  S.factions.push(f); c.faction = id;
  rebuildRelations(G);
  pushLog(G, 'diplo', `${natName(G, c.id)}, ${nm} adlı ittifakı kurdu.`, c.capital, c.major || c.id === S.player);
  return f;
}
export function canJoinFaction(G, c, f) {
  const S = G.S;
  if (c.faction >= 0 || !f) return { ok: false, why: 'Zaten bir ittifaktasın.' };
  if (f.members.some((m) => atWar(S, m, c.id))) return { ok: false, why: 'İttifak üyeleriyle savaştasın.' };
  // üyenin düşmanıyla aynı safta olamaz
  for (const m of f.members) for (const e of S.C[m]._enemies) if (isFriend(S, c.id, e)) return { ok: false, why: 'İttifakın düşmanlarıyla müttefiksin.' };
  for (const e of c._enemies) if (f.members.some((m) => isFriend(S, m, e))) return { ok: false, why: 'Düşmanların bu ittifakın dostu.' };
  const L = S.C[f.leader];
  if (c.ideo === 'dem' && f.ideo === 'dem' && S.tension < 15 && !c._atWar) return { ok: false, why: 'Küresel gerginlik %15 olmadan Cumhuriyetçiler ittifaka girmez.' };
  if (L.op[c.id] < (f.ideo === c.ideo ? -10 : 35)) return { ok: false, why: 'İttifak lideri seni yeterince sevmiyor.' };
  return { ok: true };
}
export function joinFaction(G, c, fid, force) {
  const S = G.S, f = S.factions.find((x) => x.id === fid);
  if (!f) return false;
  if (!force && !canJoinFaction(G, c, f).ok) return false;
  if (c.faction >= 0) return false;
  f.members.push(c.id); c.faction = f.id;
  // ittifakın savaşlarına katıl
  for (const w of S.wars) {
    const inAtt = w.att.some((m) => f.members.includes(m) && m !== c.id), inDef = w.def.some((m) => f.members.includes(m) && m !== c.id);
    if (inAtt && !w.att.includes(c.id) && !w.def.includes(c.id)) w.att.push(c.id);
    else if (inDef && !w.def.includes(c.id) && !w.att.includes(c.id)) w.def.push(c.id);
  }
  // yeni üyenin savaşlarına ittifak katılır
  for (const w of S.wars) {
    const side = w.att.includes(c.id) ? w.att : w.def.includes(c.id) ? w.def : null;
    if (!side) continue;
    const other = side === w.att ? w.def : w.att;
    for (const m of f.members) if (!side.includes(m) && !other.includes(m) && S.C[m].alive) side.push(m);
  }
  rebuildRelations(G);
  pushLog(G, 'diplo', `${natName(G, c.id)}, ${f.name} ittifakına katıldı.`, c.capital, c.major || c.id === S.player);
  return true;
}
function leaveFaction(G, c) {
  const S = G.S, f = factionOf(S, c);
  if (!f) return;
  f.members = f.members.filter((m) => m !== c.id);
  c.faction = -1;
  if (!f.members.length) S.factions = S.factions.filter((x) => x !== f);
  else if (f.leader === c.id) f.leader = f.members.slice().sort((a, b) => (S.C[b]._str || 0) - (S.C[a]._str || 0))[0];
}

// ---------- savaş gerekçesi ve ilanı
export function canJustify(G, a, b) {
  const S = G.S, A = S.C[a], B = S.C[b];
  if (a === b || !B.alive || B.capit) return { ok: false, why: 'Geçersiz hedef.' };
  if (atWar(S, a, b)) return { ok: false, why: 'Zaten savaştasınız.' };
  if (isFriend(S, a, b)) return { ok: false, why: 'Müttefikine gerekçe üretemezsin.' };
  if (A.pacts.some((p) => p.w === b)) return { ok: false, why: 'Aranızda saldırmazlık paktı var.' };
  if (A.wargoals.includes(b)) return { ok: false, why: 'Zaten bir savaş gerekçen var.' };
  if (A.just.some((j) => j.target === b)) return { ok: false, why: 'Gerekçe hazırlanıyor.' };
  if (A.ideo === 'dem') {
    const need = B.aggr > 0 ? 20 : 40;
    if (S.tension < need) return { ok: false, why: `Cumhuriyetçi devletler küresel gerginlik %${need} olmadan gerekçe üretemez.` };
    if (B.ideo === 'dem') return { ok: false, why: 'Cumhuriyetçi devletler birbirine saldırmaz.' };
  }
  return { ok: true };
}
export const JUSTIFY_COST = 50;
export function startJustify(G, a, b, free) {
  const S = G.S, A = S.C[a];
  if (!canJustify(G, a, b).ok) return false;
  if (free) {
    if (A.freeGoals <= 0) return false;
    A.freeGoals--; A.wargoals.push(b);
  } else {
    if (A.pp < JUSTIFY_COST) return false;
    A.pp -= JUSTIFY_COST;
    A.just.push({ target: b, prog: 0, days: S.C[b].major ? 150 : 110 });
  }
  addTension(G, S.C[b].major ? 3 : 2);
  shiftOpinion(S, b, a, -25);
  if (b === S.player || a === S.player) pushLog(G, 'diplo', `${natName(G, a)}, ${natName(G, b)} aleyhine savaş gerekçesi hazırlıyor.`, S.C[b].capital, b === S.player);
  return true;
}
export function canDeclare(G, a, b) {
  const S = G.S, A = S.C[a], B = S.C[b];
  if (a === b || !B.alive || B.capit || !A.alive || A.capit) return { ok: false, why: 'Geçersiz hedef.' };
  if (atWar(S, a, b)) return { ok: false, why: 'Zaten savaştasınız.' };
  if (isFriend(S, a, b)) return { ok: false, why: 'Müttefikine savaş ilan edemezsin.' };
  if (A.pacts.some((p) => p.w === b)) return { ok: false, why: 'Saldırmazlık paktı sürüyor.' };
  if (!A.wargoals.includes(b)) return { ok: false, why: 'Önce savaş gerekçesi gerekli.' };
  return { ok: true };
}
export function declareWar(G, a, b) {
  const S = G.S, A = S.C[a], B = S.C[b];
  if (!canDeclare(G, a, b).ok) return false;
  const att = new Set([a]), def = new Set([b]);
  const fa = factionOf(S, A), fb = factionOf(S, B);
  if (fa) for (const m of fa.members) att.add(m);
  if (fb) for (const m of fb.members) def.add(m);
  for (const g of S.C) {
    if (!g.alive || g.capit || att.has(g.id) || !g.guar.includes(b)) continue;
    def.add(g.id);
    const fg = factionOf(S, g);
    if (fg) for (const m of fg.members) if (!att.has(m)) def.add(m);
  }
  for (const d of def) att.delete(d);
  const ok = (id) => S.C[id].alive && !S.C[id].capit;
  const w = { id: S.nextWar++, name: `${natName(G, a)}–${natName(G, b)} Savaşı`, att: [...att].filter(ok), def: [...def].filter(ok), start: S.hours, last: S.hours };
  if (!w.att.includes(a)) w.att.unshift(a);
  S.wars.push(w);
  for (const x of w.att) for (const y of w.def) {
    S.C[x].pacts = S.C[x].pacts.filter((p) => p.w !== y); S.C[y].pacts = S.C[y].pacts.filter((p) => p.w !== x);
    S.C[x].wargoals = S.C[x].wargoals.filter((t) => t !== y); S.C[y].wargoals = S.C[y].wargoals.filter((t) => t !== x);
    S.C[x].just = S.C[x].just.filter((j) => j.target !== y); S.C[y].just = S.C[y].just.filter((j) => j.target !== x);
    shiftOpinion(S, x, y, -60); shiftOpinion(S, y, x, -60);
  }
  A.aggr++;
  addTension(G, B.major ? 12 : 6);
  for (const o of S.C) if (o.id !== a && o.ideo !== A.ideo) shiftOpinion(S, o.id, a, o.ideo === 'dem' ? -15 : -8);
  rebuildRelations(G);
  G.mapDirty = true;
  const allies = w.def.length > 1 ? ` ${w.def.filter((x) => x !== b).map((x) => natName(G, x)).join(', ')} savunmaya katıldı.` : '';
  pushLog(G, 'war', `${natName(G, a)}, ${natName(G, b)} devletine savaş ilan etti!${allies}`, B.capital, true);
  return true;
}

// ---------- küçük diplomatik eylemler
export function improveRelations(G, a, b) {
  const S = G.S, A = S.C[a];
  if (A.pp < 25 || atWar(S, a, b)) return false;
  A.pp -= 25;
  shiftOpinion(S, b, a, 12); shiftOpinion(S, a, b, 6);
  return true;
}
export function pactAccepted(G, a, b) {
  const S = G.S, B = S.C[b];
  if (atWar(S, a, b)) return false;
  if (B.just.some((j) => j.target === a) || B.wargoals.includes(a)) return false;
  return B.op[a] >= 5;
}
export function signPact(G, a, b) {
  const S = G.S, A = S.C[a], B = S.C[b];
  if (A.pp < 30 || A.pacts.some((p) => p.w === b) || !pactAccepted(G, a, b)) return false;
  A.pp -= 30;
  const until = S.hours + 24 * 365 * 3;
  A.pacts.push({ w: b, until }); B.pacts.push({ w: a, until });
  A.just = A.just.filter((j) => j.target !== b); A.wargoals = A.wargoals.filter((t) => t !== b);
  pushLog(G, 'diplo', `${natName(G, a)} ile ${natName(G, b)} arasında saldırmazlık paktı imzalandı.`, B.capital, a === S.player || b === S.player);
  return true;
}
export function guarantee(G, a, b) {
  const S = G.S, A = S.C[a];
  if (A.pp < 40 || A.guar.includes(b) || atWar(S, a, b) || a === b) return false;
  A.pp -= 40; A.guar.push(b);
  shiftOpinion(S, b, a, 20);
  pushLog(G, 'diplo', `${natName(G, a)}, ${natName(G, b)} devletinin bağımsızlığını garanti etti.`, S.C[b].capital, a === S.player || b === S.player);
  return true;
}

// ---------- teslimiyet ve barış
function killCountry(G, c) {
  const S = G.S;
  c.alive = false; c.capit = true;
  for (const d of S.divs) if (d.o === c.id) destroyDiv(G, d, 0);
  sweepDead(G);
  leaveFaction(G, c);
  for (const o of S.C) { o.guar = o.guar.filter((x) => x !== c.id); o.just = o.just.filter((j) => j.target !== c.id); o.wargoals = o.wargoals.filter((x) => x !== c.id); o.pacts = o.pacts.filter((p) => p.w !== c.id); }
  for (const w of S.wars) { w.att = w.att.filter((x) => x !== c.id); w.def = w.def.filter((x) => x !== c.id); }
  S.wars = S.wars.filter((w) => w.att.length && w.def.length);
  c.train = []; c.build = []; c.just = []; c.wargoals = [];
}

export function capitulate(G, c) {
  const S = G.S, W = G.world;
  if (c.capit) return;
  c.capit = true;
  const occ = new Map();
  for (let p = 0; p < W.NL; p++) {
    const k = S.ctrl[p];
    if (S.owner[p] === c.id && k !== c.id && atWar(S, c.id, k)) occ.set(k, (occ.get(k) || 0) + W.prov[p].vp);
  }
  let winner = -1, best = -1;
  for (const [k, v] of occ) if (v > best) { best = v; winner = k; }
  if (winner < 0) winner = c._enemies.find((e) => !S.C[e].capit) ?? -1;
  for (const d of S.divs) if (d.o === c.id) destroyDiv(G, d, 0.3);
  sweepDead(G);
  // kalan toprakları komşu işgalcilere dağıt
  const q = [];
  for (let p = 0; p < W.NL; p++) if (S.ctrl[p] !== c.id && atWar(S, c.id, S.ctrl[p])) q.push(p);
  for (let h = 0; h < q.length; h++) {
    const u = q[h], k = S.ctrl[u];
    for (const v of W.prov[u].nb) {
      if (S.ctrl[v] !== c.id) continue;
      const o = S.owner[v];
      setController(G, v, o !== c.id && atWar(S, c.id, o) && !S.C[o].capit ? o : k);
      q.push(v);
    }
  }
  if (winner >= 0) for (let p = 0; p < W.NL; p++) if (S.ctrl[p] === c.id) {
    const o = S.owner[p];
    setController(G, p, o !== c.id && atWar(S, c.id, o) && !S.C[o].capit ? o : winner);
  }
  c.train = []; c.build = []; c.just = [];
  addTension(G, c.major ? 4 : 2);
  pushLog(G, 'war', `${natName(G, c.id)} teslim oldu!` + (winner >= 0 ? ` Topraklarının çoğu ${natName(G, winner)} işgalinde.` : ''), c.capital, true);
  rebuildRelations(G);
  // savaşın bitip bitmediğini denetle
  for (const w of S.wars.slice()) {
    const side = w.att.includes(c.id) ? 'att' : w.def.includes(c.id) ? 'def' : null;
    if (!side) continue;
    if (w[side].every((m) => S.C[m].capit || !S.C[m].alive)) endWar(G, w, side === 'att' ? 'def' : 'att');
  }
  if (c.id === S.player && !S.observer) { S.over = 'lose'; G.emit('gameOver', 'lose'); }
  G.mapDirty = true; G.unitsDirty = true;
}

export function endWar(G, w, winner) {
  const S = G.S, W = G.world;
  if (!S.wars.includes(w)) return;
  const att = w.att.slice(), def = w.def.slice();
  const all = att.concat(def);
  let annexed = 0;
  if (winner) {
    const win = winner === 'att' ? att : def, lose = winner === 'att' ? def : att;
    for (let p = 0; p < W.NL; p++) {
      const o = S.owner[p], k = S.ctrl[p];
      if (lose.includes(o)) {
        if (win.includes(k)) { S.owner[p] = k; annexed++; }
      } else if (win.includes(o) && k !== o && (lose.includes(k) || win.includes(k))) setController(G, p, o);
    }
  } else {
    for (let p = 0; p < W.NL; p++) {
      const o = S.owner[p], k = S.ctrl[p];
      if (o === k) continue;
      const opp = (att.includes(o) && def.includes(k)) || (def.includes(o) && att.includes(k));
      if (opp) { S.owner[p] = k; annexed++; } else if (all.includes(o) && all.includes(k) && !S.C[o].capit) setController(G, p, o);
    }
  }
  S.wars = S.wars.filter((x) => x !== w);
  // ülkelerin akıbeti
  const owned = new Array(S.N).fill(0);
  for (let p = 0; p < W.NL; p++) owned[S.owner[p]]++;
  for (const id of all) {
    const c = S.C[id];
    if (!c.alive) continue;
    if (!owned[id]) { killCountry(G, c); continue; }
    if (c.capit && !warsOf(S, id).length) {
      c.capit = false;
      for (let p = 0; p < W.NL; p++) if (S.owner[p] === id && S.ctrl[p] !== id && !atWar(S, id, S.ctrl[p])) setController(G, p, id);
    }
    relocateCapital(G, c);
    c.ai.nextAggro = S.hours + 24 * (420 + ((id * 97 + S.hours) % 600));
    c.ai.lastWar = S.hours;
  }
  for (const x of att) for (const y of def) if (S.C[x].alive && S.C[y].alive) { shiftOpinion(S, x, y, 30); shiftOpinion(S, y, x, 30); }
  addTension(G, Math.min(15, (annexed / W.NL) * 120));
  rebuildRelations(G);
  expelStrangers(G);
  refreshAll(G);
  G.mapDirty = true; G.unitsDirty = true;
  const txt = winner ? `${w.name} sona erdi. Kazanan taraf: ${(winner === 'att' ? att : def).filter((x) => S.C[x].alive).map((x) => natName(G, x)).join(', ') || '—'}.` : `${w.name} mevcut hatlarda barışla sona erdi.`;
  pushLog(G, 'peace', txt, -1, true);
}

// Barış teklifini karşı taraf kabul eder mi? (a teklif eder, b'nin tarafı değerlendirir)
export function peaceAcceptance(G, w, askerSide) {
  const S = G.S, W = G.world;
  const mine = askerSide === 'att' ? w.att : w.def, theirs = askerSide === 'att' ? w.def : w.att;
  const str = (list) => list.reduce((s, id) => s + (S.C[id].alive && !S.C[id].capit ? S.C[id]._str || 0 : 0), 0);
  const sm = str(mine), st = str(theirs);
  let gainMine = 0, gainTheirs = 0;
  for (let p = 0; p < W.NL; p++) {
    const o = S.owner[p], k = S.ctrl[p];
    if (o === k) continue;
    if (theirs.includes(o) && mine.includes(k)) gainMine += W.prov[p].vp;
    if (mine.includes(o) && theirs.includes(k)) gainTheirs += W.prov[p].vp;
  }
  const days = (S.hours - w.start) / 24, stale = (S.hours - w.last) / 24;
  let score = 0;
  score += stale > 400 ? 40 : stale > 200 ? 20 : 0;
  score += days < 120 ? -40 : days > 365 ? 10 : 0;
  score += ((sm - st) / Math.max(1, sm + st)) * 60;
  if (gainTheirs > gainMine) score += 15;
  if (st > sm) score -= clamp(gainMine - gainTheirs, 0, 40) * 0.5;
  return score;
}
export function offerPeace(G, a, b) {
  const S = G.S, w = warBetween(S, a, b);
  if (!w) return false;
  const side = w.att.includes(a) ? 'att' : 'def';
  if (peaceAcceptance(G, w, side) >= 30) { endWar(G, w, null); return true; }
  return false;
}

// ---------- günlük
export function dailyDiplomacy(G) {
  const S = G.S;
  const day = Math.floor(S.hours / 24);
  for (const c of S.C) {
    if (!c.alive) continue;
    // gerekçeler
    for (let i = c.just.length - 1; i >= 0; i--) {
      const j = c.just[i];
      j.prog += (1 + c._mods.justify + S.tension / 100) / j.days;
      if (j.prog >= 1) {
        c.just.splice(i, 1);
        if (S.C[j.target].alive && !c.wargoals.includes(j.target)) c.wargoals.push(j.target);
        if (c.id === S.player) pushLog(G, 'diplo', `${natName(G, j.target)} aleyhine savaş gerekçesi hazır.`, S.C[j.target].capital, true);
      }
    }
    if (c.pacts.length) c.pacts = c.pacts.filter((p) => p.until > S.hours && S.C[p.w].alive);
    // teslimiyet
    if (!c.capit && c._atWar && c._vpOwn > 0) {
      const thr = 0.6 + c.ws * 0.003;
      if (c._vpLost / c._vpOwn >= thr || (c._nProv === 0)) capitulate(G, c);
    }
  }
  if (day % 30 === 0) {
    const anyWar = S.wars.length > 0;
    if (!anyWar) addTension(G, -0.6);
    for (const a of S.C) for (const b of S.C) {
      if (a === b || !a.alive || !b.alive || atWar(S, a.id, b.id)) continue;
      let base = baseOpinion(a, b) + (sameFaction(S, a.id, b.id) ? 40 : 0) - b.aggr * (a.ideo === 'dem' ? 8 : 3);
      a.op[b.id] += clamp(base - a.op[b.id], -1.5, 1.5);
    }
  }
  // savaşsız bir dünyada aşırı güçlenen ittifak içten çatlar
  if (day % 30 === 15 && !S.wars.length) {
    for (const f of S.factions) {
      if (f.members.length < 2) continue;
      let held = 0;
      for (const m of f.members) held += S.C[m]._vpHeld || 0;
      if (held / Math.max(1, S._worldVp) < 0.5) continue;
      const order = f.members.slice().sort((a, b) => (S.C[b]._str || 0) - (S.C[a]._str || 0));
      const rebel = S.C[order[1]], lead = S.C[order[0]];
      if (rebel.id === S.player && !S.observer) continue;
      leaveFaction(G, rebel);
      shiftOpinion(S, rebel.id, lead.id, -70); shiftOpinion(S, lead.id, rebel.id, -70);
      rebel.ai.nextAggro = S.hours + 24 * 200; lead.ai.nextAggro = S.hours + 24 * 260;
      rebuildRelations(G); expelStrangers(G);
      pushLog(G, 'diplo', `${natName(G, rebel.id)}, ${f.name} ittifakından ayrıldı. Galipler arasında yeni bir rekabet başlıyor.`, rebel.capital, true);
      break;
    }
  }
  // durağan savaşlar (oyuncu taraf değilse) kendiliğinden biter
  for (const w of S.wars.slice()) {
    const stale = (S.hours - w.last) / 24;
    const playerIn = !S.observer && (w.att.includes(S.player) || w.def.includes(S.player));
    if (stale > 540 && !playerIn) endWar(G, w, null);
    else if (stale > 420 && playerIn && day % 90 === 0) G.emit('peaceOffer', w);
  }
  // zafer denetimi
  if (!S.over && !S.won && !S.observer) {
    const P = S.C[S.player];
    if (P.alive && !P.capit && vpShare(S, P) >= 0.6) { S.won = true; G.emit('gameOver', 'win'); }
  }
}
