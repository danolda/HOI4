// Başsız simülasyon testi: tüm ülkeleri yapay zekâ yönetir, N yıl koşar ve özet basar.
// Kullanım: node tools/simtest.mjs [tohum] [yıl]
import { generateWorld } from '../src/worldgen.js';
import { Game } from '../src/sim/game.js';
import { fmtDate } from '../src/data.js';

const seed = process.argv[2] || 'MERIDYEN';
const years = Number(process.argv[3] || 8);
const world = await generateWorld(seed);
const G = Game.create(world, { player: 0, diff: 1 });
G.S.observer = true;
const S = G.S;
let majorLogs = 0;
G.on('log', (e, major) => { if (major && (e.type === 'war' || e.type === 'peace')) { majorLogs++; console.log(`  [${fmtDate(e.t)}] ${e.text}`); } });

const t0 = Date.now();
for (let y = 0; y < years; y++) {
  for (let h = 0; h < 24 * 365; h++) G.tickHour();
  const alive = S.C.filter((c) => c.alive);
  const line = alive.map((c) => `${world.nations[c.id].tag}${c.capit ? '†' : ''}:${c._nProv}p/${c._nDiv}d`).join(' ');
  console.log(`${fmtDate(S.hours)} | gerginlik ${S.tension.toFixed(0)} | savaş ${S.wars.length} | muharebe ${S.battles.length} | tümen ${S.divs.length} | ${line}`);
}
const ms = Date.now() - t0;
console.log(`süre ${ms} ms (${(ms / years).toFixed(0)} ms/yıl), önemli olay ${majorLogs}`);

// tutarlılık denetimleri
let bad = 0;
for (const d of S.divs) {
  if (!(d.s > 0 && d.s <= 1.0001) || !(d.g >= 0 && d.g <= 1.0001) || d.p < 0 || d.p >= world.NP) { bad++; console.log('bozuk tümen', d); }
  if (!S.C[d.o].alive) { bad++; console.log('ölü ülkenin tümeni', d.id); }
}
for (const c of S.C) for (const k in c.stock) if (!(c.stock[k] >= 0)) { bad++; console.log('negatif stok', c.id, k, c.stock[k]); }
const json = G.serialize();
const G2 = Game.deserialize(world, json);
for (let h = 0; h < 24 * 30; h++) G2.tickHour();
console.log(`kayıt boyutu ${(json.length / 1024).toFixed(0)} KB, yükleme sonrası 30 gün sorunsuz, hata ${bad}`);
if (bad) process.exit(1);
