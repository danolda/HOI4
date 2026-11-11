// Oyun nesnesi: kurulum, saatlik/günlük döngü, kayıt ve yükleme.
import { RNG, hashString } from '../rng.js';
import { newState, recalcMods, refreshAll, tplOf, tplStats } from './core.js';
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

  static create(world, opts) {
    const S = newState(world, opts);
    const G = new Game(world, S);
    G.setupStart();
    return G;
  }

  setupStart() {
    const S = this.S, W = this.world, rng = this.rng;
    for (const c of S.C) {
      const nat = W.nations[c.id];
      const mil = c._mil;
      c.stock.rifle = 900 + mil * 130; c.stock.arty = 60 + mil * 14;
      if (c.techs.mot1) c.stock.truck = mil * 16;
      if (c.techs.tank1) c.stock.tank = mil * (c.ideo === 'mil' ? 18 : 9);
      if (c.techs.fig1) c.stock.fighter = 40 + mil * 8;
      if (c.techs.cas1) c.stock.bomber = mil * 3;
      c.naval = Math.round(c._dock * 110 * rng.range(0.7, 1.3) + (c.major && c._dock ? 50 : 0));
      aiLines(this, c);
      for (const l of c.lines) l.eff = 0.35;
      // başlangıç ordusu
      const size = nat.provs.length;
      let n = c.major ? 12 + size * 0.3 : 3 + size * 0.35;
      n *= { mil: 1.3, kol: 1.15, mon: 1, dem: 0.85 }[c.ideo];
      n = Math.max(2, Math.min(Math.round(n), Math.floor((c._mpMax * 0.85) / 9500)));
      const borders = [], seen = new Set();
      for (const p of nat.provs) {
        for (const q of W.prov[p].nb) if (S.owner[q] !== c.id && !seen.has(p)) { seen.add(p); borders.push(p); }
      }
      const spots = borders.length ? borders : nat.provs.filter((p) => W.prov[p].coastal);
      rng.shuffle(spots);
      let nArm = c.techs.tank1 && c.major ? (c.ideo === 'mil' ? 3 : 1) : 0;
      for (let i = 0; i < n; i++) {
        let tpl = 't_inf';
        if (nArm > 0) { tpl = 't_arm'; nArm--; } else if (!c.major && rng.chance(0.4)) tpl = 't_lig';
        const prov = i % 6 === 5 || !spots.length ? c.capital : spots[i % spots.length];
        spawnDivision(this, c, tpl, prov, { s: 1, g: 1 });
      }
    }
    refreshAll(this);
    for (const c of S.C) if (c.id !== S.player || S.observer) aiBootstrap(this, c);
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
      if (c.id !== S.player || S.observer) aiDaily(this, c);
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
    if (S.seed !== world.seed) throw new Error('Kayıt başka bir dünyaya ait.');
    return new Game(world, S);
  }
}

export { hashString, tplOf, tplStats };
