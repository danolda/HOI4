// Oyuncu komutları: tek oyunculuda doğrudan, çok oyunculuda kurucunun makinesinde çalışır.
// Her komut (G, ülke, ...bağımsız değişkenler) alır; isteğe bağlı olarak oyuncuya gösterilecek bir ileti döndürür.
import { FACTION_NAMES } from '../data.js';
import { refreshAll, tplOf, tplStats, divStats } from './core.js';
import * as eco from './economy.js';
import * as dip from './diplomacy.js';
import { orderMove, haltDiv, destroyDiv, sweepDead } from './military.js';

const nm = (G, id) => G.world.nations[id].name;
const mine = (G, c, ids) => (ids || []).map((id) => G.S._byId.get(id)).filter((d) => d && !d.dead && d.o === c.id);

export const CMD = {
  law: (G, c, kind, i) => { eco.setLaw(G, c, kind, +i); },
  goalStart: (G, c, id) => { eco.startGoal(G, c, id); },
  research: (G, c, slot, id) => { eco.startResearch(G, c, +slot, id); },
  lineFac: (G, c, i, d) => { eco.setLineFac(G, c, +i, +d); },
  lineAdd: (G, c, k) => { if (eco.addLine(G, c, k)) eco.setLineFac(G, c, c.lines.length - 1, 1); },
  import: (G, c, k, d) => { if (k in c.imports) eco.setImport(G, c, k, +d); },
  build: (G, c, type, p) => (eco.queueBuild(G, c, type, +p) ? null : 'Bu eyalette o yapı için yer yok.'),
  buildAuto: (G, c, k, n) => { for (let i = 0; i < Math.min(10, +n); i++) { const p = eco.bestBuildProv(G, c, k); if (p < 0) break; eco.queueBuild(G, c, k, p); } },
  buildCancel: (G, c, i) => { if (c.build[+i]) c.build.splice(+i, 1); },
  buildUp: (G, c, i) => { const b = c.build; i = +i; if (i > 0 && b[i]) { const t = b[i]; b.splice(i, 1); b.unshift(t); } },
  train: (G, c, id, n) => { eco.queueTrain(G, c, id, Math.min(10, +n)); },
  trainCancel: (G, c, i) => {
    const t = c.train[+i];
    if (!t) return;
    if (t.started) { const s = tplStats(c, tplOf(c, t.tpl)); for (const e in s.eq) c.stock[e] += s.eq[e]; }
    c.train.splice(+i, 1);
  },
  tplNew: (G, c) => { eco.saveTemplate(G, c, null, `Özel Tümen ${c.nextTpl}`, { inf: 6, art: 1 }); },
  tplBat: (G, c, tplId, k, d) => { const t = tplOf(c, tplId); const bats = { ...t.bats }; bats[k] = (bats[k] || 0) + +d; eco.saveTemplate(G, c, t.id, t.name, bats); },
  deploy: (G, c, p) => { if (G.S.ctrl[+p] === c.id) c.deploy = +p; },
  autoAll: (G, c, v) => { for (const d of G.S.divs) if (d.o === c.id) d.auto = !!+v; G.unitsDirty = true; },
  stance: (G, c, i) => { c.auto.stance = Math.max(0, Math.min(2, +i)); },
  move: (G, c, ids, prov) => {
    let ok = 0;
    for (const d of mine(G, c, ids)) if (orderMove(G, d, +prov)) { d.auto = false; ok++; }
    return ok ? null : 'Oraya ulaşılamıyor: tarafsız toprak, yol yok ya da limansız deniz yolu.';
  },
  halt: (G, c, ids) => { for (const d of mine(G, c, ids)) { haltDiv(G, d); d.auto = false; } },
  autoSet: (G, c, ids, on) => { for (const d of mine(G, c, ids)) d.auto = !!on; G.unitsDirty = true; },
  disband: (G, c, ids) => {
    for (const d of mine(G, c, ids)) { const s = divStats(G.S, d); for (const e in s.eq) c.stock[e] += s.eq[e] * d.s; destroyDiv(G, d, 0); }
    sweepDead(G);
  },
  dImprove: (G, c, id) => { dip.improveRelations(G, c.id, +id); },
  dPact: (G, c, id) => (dip.signPact(G, c.id, +id) ? null : `${nm(G, +id)} saldırmazlık paktını reddetti.`),
  dGuar: (G, c, id) => { dip.guarantee(G, c.id, +id); },
  dJoin: (G, c, fid) => { dip.joinFaction(G, c, +fid); },
  dInvite: (G, c, id) => {
    const o = G.S.C[+id];
    if (!o || !o.alive || o.human || c.faction < 0) return null;
    if ((o.op[c.id] >= 10 || o._atWar || G.S.tension >= 30) && dip.joinFaction(G, o, c.faction)) return null;
    return `${nm(G, +id)} daveti reddetti.`;
  },
  dCreate: (G, c) => { if (c.pp >= 80 && c.faction < 0) { c.pp -= 80; dip.createFaction(G, c, FACTION_NAMES[c.ideo]); } },
  dJustify: (G, c, id) => { dip.startJustify(G, c.id, +id, false); },
  dJustifyFree: (G, c, id) => { dip.startJustify(G, c.id, +id, true); },
  dWar: (G, c, id) => { dip.declareWar(G, c.id, +id); },
  peace: (G, c, id) => (dip.offerPeace(G, c.id, +id) ? null : `${nm(G, +id)} barış teklifini reddetti.`),
  acceptPeace: (G, c, warId) => { dip.acceptPeace(G, c.id, +warId); },
};

export function runCommand(G, cid, name, args) {
  const c = G.S.C[cid];
  if (!c || !c.alive || c.capit || !Object.prototype.hasOwnProperty.call(CMD, name)) return null;
  let msg = null;
  try { msg = CMD[name](G, c, ...(args || [])) || null; } catch (e) { msg = null; }
  refreshAll(G);
  G.mapDirty = true; G.unitsDirty = true;
  return msg;
}
