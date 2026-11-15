// Oyun nesnesi: kurulum, saatlik/günlük döngü, kayıt ve yükleme.
import { RNG } from '../rng.js';
import { START_GUARANTEES, TAG_INDEX } from '../data.js';
import { newState, recalcMods, refreshAll } from './core.js';
import { rebuildIndex, hourlyMilitary, dailyMilitary, airNaval, spawnDivision } from './military.js';
import { dailyEconomy } from './economy.js';
import { dailyDiplomacy, rebuildRelations } from './diplomacy.js';
import { aiDaily, aiMilitary, aiLines, aiBootstrap } from './ai.js';

export class Game {
  constructor(world, S) {
    this.world = world;
    this.S = S;
    this.rng = new RNG(S.rs0 || 1);
    this.handlers = {};
    this.mapDirty = true;
    this.unitsDirty = true;
    for (const c of S.C) recalcMods(S, c);
    rebuildRelations(this);
    rebuildIndex(this);
    refreshAll(this);
    airNaval(this);
    refreshAll(this);
  }
  on(type, fn) { (this.handlers[type] || (this.handlers[type] = [])).push(fn); }
  emit(type, a, b) { const h = this.handlers[type]; if (h) for (const fn of h) fn(a, b); }

  // opts: { player, humans: [ülke no...], diff }
  static create(world, opts) {
    const S = newState(world, opts);
    const G = new Game(world, S);
    G.setupStart();
    return G;
  }

  setupStart() {
    const S = this.S, W = this.world, rng = this.rng, NL = W.NL;
    // başlangıç ittifakları
    const byName = new Map();
    for (const nat of W.nations) {
      if (!nat.faction || !S.C[nat.id].alive) continue;
      let f = byName.get(nat.faction);
      if (!f) { f = { id: S.factions.length, name: nat.faction, leader: nat.id, members: [], ideo: nat.ideo }; S.factions.push(f); byName.set(nat.faction, f); }
      f.members.push(nat.id); S.C[nat.id].faction = f.id;
    }
    for (const [a, b] of START_GUARANTEES) S.C[TAG_INDEX[a]].guar.push(TAG_INDEX[b]);
    rebuildRelations(this);
    refreshAll(this);

    for (const c of S.C) {
      if (!c.alive) continue;
      const nat = W.nations[c.id];
      const mil = c._mil;
      c.stock.rifle = 700 + mil * 130; c.stock.arty = 40 + mil * 14;
      if (c.techs.mot1) c.stock.truck = mil * 16;
      if (c.techs.tank1) c.stock.tank = mil * (c.ideo === 'mil' ? 18 : 9);
      if (c.techs.fig1) c.stock.fighter = 30 + mil * 9;
      if (c.techs.cas1) c.stock.bomber = mil * 3;
      c.naval = Math.round(c._dock * 110 * rng.range(0.8, 1.2));
      aiLines(this, c);
      for (const l of c.lines) l.eff = 0.35;
      // başlangıç ordusu: anavatan sınırları, başkent ve sömürge garnizonları
      const core = nat.provs.filter((p) => W.prov[p].core === c.id);
      const border = core.filter((p) => W.prov[p].nb.some((q) => q < NL && S.owner[q] !== c.id));
      const coast = core.filter((p) => S.port[p]);
      const colony = nat.provs.filter((p) => W.prov[p].core !== c.id && (S.port[p] || W.prov[p].vp >= 3));
      const spots = border.length ? border : coast.length ? coast : core.length ? core : nat.provs;
      rng.shuffle(spots); rng.shuffle(colony);
      let nArm = c.techs.tank1 && c.major ? (c.ideo === 'mil' ? 3 : c.ideo === 'kol' ? 2 : 1) : 0;
      const light = nat.light ?? (c.major ? 0 : 0.35);
      const n = Math.max(1, Math.min(nat.divs, Math.floor((c._mpMax * 0.9) / 9500) || 1));
      for (let i = 0; i < n; i++) {
        let tpl = 't_inf';
        if (nArm > 0) { tpl = 't_arm'; nArm--; } else if (rng.chance(light)) tpl = 't_lig';
        let prov;
        if (colony.length && i % 6 === 4) { prov = colony[(i / 6 | 0) % colony.length]; tpl = 't_lig'; }
        else if (i % 7 === 6 || !spots.length) prov = c.capital;
        else prov = spots[i % spots.length];
        spawnDivision(this, c, tpl, prov, { s: 1, g: 1 });
      }
      c.ai.baseDivs = n;
    }
    refreshAll(this);
    for (const c of S.C) if (c.alive && !c.human) aiBootstrap(this, c);
    refreshAll(this);
    S.rs0 = this.rng.s;
  }

  tickHour() {
    const S = this.S;
    S.hours++;
    hourlyMilitary(this);
    if (S.hours % 24 === 0) this.daily();
  }

  daily() {
    const S = this.S;
    refreshAll(this);
    for (const c of S.C) if (c.alive && !c.capit) dailyEconomy(this, c);
    dailyMilitary(this);
    dailyDiplomacy(this);
    for (const c of S.C) {
      if (!c.alive) continue;
      if (!c.human) aiDaily(this, c);
      else if (!c.capit) aiMilitary(this, c, true, c.auto.stance);
    }
    refreshAll(this);
    S.rs0 = this.rng.s;
    this.emit('day');
  }

  serialize() {
    return JSON.stringify(this.S, (k, v) => (k[0] === '_' || k === 'dead' ? undefined : v));
  }
  static deserialize(world, json) {
    const S = typeof json === 'string' ? JSON.parse(json) : json;
    if (S.seed !== world.seed || S.v !== 3) throw new Error('Kayıt bu sürümle uyumlu değil.');
    return new Game(world, S);
  }
}
