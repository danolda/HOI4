// Tohumdan dünya üretimi: eyalet rasteri, komşuluklar, arazi, yükseklik haritası, ülkeler.
import { RNG, hashString, fbm, ridge, noise2, clamp, smoothstep } from './rng.js';
import { NATIONS, MAJORS, TERRAIN } from './data.js';
import { MinHeap } from './heap.js';

export const MAP_W = 2048, MAP_H = 1280;
export const HS = 2;
export const HW = MAP_W / HS, HH = MAP_H / HS;
export const HEIGHT_SCALE = 44;
export const MINI_W = 256, MINI_H = 160;
const CELL_R = 46;

function poisson(rng, W, H, r, margin) {
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const px = [], py = [], active = [];
  const add = (x, y) => {
    const i = px.length;
    px.push(x); py.push(y); active.push(i);
    grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = i;
  };
  add(W / 2 + rng.range(-60, 60), H / 2 + rng.range(-60, 60));
  while (active.length) {
    const ai = Math.floor(rng.next() * active.length);
    const i = active[ai];
    let found = false;
    for (let k = 0; k < 24; k++) {
      const a = rng.next() * Math.PI * 2, d = r * (1 + rng.next());
      const x = px[i] + Math.cos(a) * d, y = py[i] + Math.sin(a) * d;
      if (x < margin || y < margin || x >= W - margin || y >= H - margin) continue;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(0, cy - 2); yy <= Math.min(gh - 1, cy + 2) && ok; yy++) {
        for (let xx = Math.max(0, cx - 2); xx <= Math.min(gw - 1, cx + 2); xx++) {
          const j = grid[yy * gw + xx];
          if (j >= 0) {
            const dx = px[j] - x, dy = py[j] - y;
            if (dx * dx + dy * dy < r * r) { ok = false; break; }
          }
        }
      }
      if (ok) { add(x, y); found = true; break; }
    }
    if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
  }
  return { px, py };
}

const NAME_A = ['Val', 'Kor', 'Dra', 'Mer', 'Tes', 'Hal', 'Nor', 'Zar', 'Bel', 'Tav', 'Os', 'Lum', 'Ard', 'Vos', 'Is', 'Kel', 'Sar', 'Ren', 'Tor', 'Gal', 'Mir', 'Dun', 'Fal', 'El', 'Ar', 'Or', 'Ul', 'Bran', 'Cas', 'Dor', 'Ev', 'Gor', 'Har', 'Jas', 'Kas', 'Lor', 'Mal', 'Nev', 'Pel', 'Ras', 'Sel', 'Tal', 'Var', 'Yor', 'Zel', 'Ost', 'Vey', 'Kar', 'Sil', 'Tur'];
const NAME_B = ['an', 'en', 'in', 'or', 'ar', 'el', 'is', 'os', 'un', 'ad', 'em', 'ir', 'ov', 'ak', 'et', 'al', 'on', 'ur', 'av', 'id'];
const NAME_C = ['', '', '', 'a', 'ia', 'os', 'um', 'en', 'ova', 'ark', 'holm', 'mar', 'kent', 'dil', 'eth', 'is', 'on', 'ya'];

function makeNamer(rng) {
  const used = new Set();
  return () => {
    for (let t = 0; t < 50; t++) {
      let n = rng.pick(NAME_A) + rng.pick(NAME_B) + rng.pick(NAME_C);
      if (rng.chance(0.18)) n = rng.pick(NAME_A) + rng.pick(NAME_B) + rng.pick(NAME_B) + rng.pick(NAME_C);
      if (!used.has(n)) { used.add(n); return n; }
    }
    const n = rng.pick(NAME_A) + rng.pick(NAME_B) + used.size;
    used.add(n);
    return n;
  };
}

export async function generateWorld(seedStr, step = async () => {}) {
  const W = MAP_W, H = MAP_H;
  const seedNum = hashString(String(seedStr));
  const rng = new RNG(seedNum);
  const sA = (seedNum ^ 0x51f3) | 0, sB = (seedNum ^ 0x9e21) | 0, sC = (seedNum ^ 0x1777) | 0, sD = (seedNum ^ 0x4c05) | 0;

  await step('Kıtalar çiziliyor', 0.05);
  // ---- 1. Hücre tohumları
  const { px, py } = poisson(rng, W, H, CELL_R, 6);
  const NC = px.length;

  // ---- 2. Kara alanı
  const blobs = [];
  blobs.push({ x: W * rng.range(0.2, 0.32), y: H * rng.range(0.32, 0.68), r: rng.range(300, 400), a: 0.85 });
  blobs.push({ x: W * rng.range(0.68, 0.8), y: H * rng.range(0.32, 0.68), r: rng.range(300, 400), a: 0.85 });
  blobs.push({ x: W * rng.range(0.4, 0.6), y: H * rng.range(0.15, 0.85), r: rng.range(150, 220), a: 0.6 });
  for (let i = 0; i < 3; i++) blobs.push({ x: W * rng.range(0.1, 0.9), y: H * rng.range(0.12, 0.88), r: rng.range(110, 190), a: 0.6 });
  for (let i = 0; i < 2; i++) blobs.push({ x: W * rng.range(0.25, 0.75), y: H * rng.range(0.25, 0.75), r: rng.range(120, 200), a: -0.7 });
  const chanX = W * rng.range(0.44, 0.56), chanAmp = rng.range(0.5, 0.75);
  const landField = (x, y) => {
    let f = fbm(x / 340, y / 340, sA, 5) * 1.5;
    const cx = chanX + noise2(y / 260, 3.3, sA + 91) * 170;
    f -= chanAmp * Math.exp(-Math.pow((x - cx) / 80, 2));
    for (const b of blobs) {
      const dx = (x - b.x) / b.r, dy = (y - b.y) / b.r;
      f += b.a * Math.exp(-(dx * dx + dy * dy));
    }
    const e = Math.min(x, W - x, y, H - y);
    f -= (1 - smoothstep(0, 190, e)) * 1.3;
    return f;
  };
  const fieldVals = new Float32Array(NC);
  for (let i = 0; i < NC; i++) fieldVals[i] = landField(px[i], py[i]);
  const sorted = Array.from(fieldVals).sort((a, b) => a - b);
  const thr = sorted[Math.floor(NC * 0.585)];
  const cellLand = new Uint8Array(NC);
  for (let i = 0; i < NC; i++) cellLand[i] = fieldVals[i] > thr ? 1 : 0;

  await step('Eyalet sınırları çiziliyor', 0.15);
  // ---- 3. Hücre rasteri (bükülmüş Voronoi)
  const BS = CELL_R;
  const bw = Math.ceil(W / BS) + 1, bh = Math.ceil(H / BS) + 1;
  const bStart = new Int32Array(bw * bh + 1);
  const bOf = new Int32Array(NC);
  for (let i = 0; i < NC; i++) {
    const b = Math.floor(py[i] / BS) * bw + Math.floor(px[i] / BS);
    bOf[i] = b; bStart[b + 1]++;
  }
  for (let i = 0; i < bw * bh; i++) bStart[i + 1] += bStart[i];
  const bFill = bStart.slice(0, bw * bh);
  const bItems = new Int32Array(NC);
  for (let i = 0; i < NC; i++) bItems[bFill[bOf[i]]++] = i;
  const fpx = Float32Array.from(px), fpy = Float32Array.from(py);

  const WQ = W / 4 + 2, HQ = H / 4 + 2;
  const warpX = new Float32Array(WQ * HQ), warpY = new Float32Array(WQ * HQ);
  for (let y = 0; y < HQ; y++) {
    for (let x = 0; x < WQ; x++) {
      const wx = x * 4, wy = y * 4;
      warpX[y * WQ + x] = fbm(wx / 120, wy / 120, sB, 3) * 34 + noise2(wx / 26, wy / 26, sB + 7) * 5;
      warpY[y * WQ + x] = fbm(wx / 120, wy / 120, sC, 3) * 34 + noise2(wx / 26, wy / 26, sC + 7) * 5;
    }
  }

  const raster = new Uint16Array(W * H);
  const BS2 = BS * BS;
  for (let y = 0; y < H; y++) {
    const gy = y / 4, y0 = gy | 0, fy = gy - y0;
    for (let x = 0; x < W; x++) {
      const gx = x / 4, x0 = gx | 0, fx = gx - x0;
      const i00 = y0 * WQ + x0;
      const ax = warpX[i00] + (warpX[i00 + 1] - warpX[i00]) * fx;
      const bx2 = warpX[i00 + WQ] + (warpX[i00 + WQ + 1] - warpX[i00 + WQ]) * fx;
      const ay = warpY[i00] + (warpY[i00 + 1] - warpY[i00]) * fx;
      const by2 = warpY[i00 + WQ] + (warpY[i00 + WQ + 1] - warpY[i00 + WQ]) * fx;
      const sx = x + ax + (bx2 - ax) * fy, sy = y + ay + (by2 - ay) * fy;
      let cbx = (sx / BS) | 0, cby = (sy / BS) | 0;
      if (cbx < 0) cbx = 0; else if (cbx >= bw) cbx = bw - 1;
      if (cby < 0) cby = 0; else if (cby >= bh) cby = bh - 1;
      let best = 1e12, bi = 0;
      for (let rad = 1; rad <= 2; rad++) {
        const ya = cby - rad < 0 ? 0 : cby - rad, yb = cby + rad >= bh ? bh - 1 : cby + rad;
        const xa = cbx - rad < 0 ? 0 : cbx - rad, xb = cbx + rad >= bw ? bw - 1 : cbx + rad;
        for (let yy = ya; yy <= yb; yy++) {
          const row = yy * bw;
          for (let xx = xa; xx <= xb; xx++) {
            for (let k = bStart[row + xx], ke = bStart[row + xx + 1]; k < ke; k++) {
              const j = bItems[k];
              const dx = fpx[j] - sx, dy = fpy[j] - sy;
              const d = dx * dx + dy * dy;
              if (d < best) { best = d; bi = j; }
            }
          }
        }
        if (best <= BS2) break;
      }
      raster[y * W + x] = bi;
    }
    if ((y & 255) === 255) await step('Eyalet sınırları çiziliyor', 0.15 + 0.3 * (y / H));
  }

  await step('Komşuluklar hesaplanıyor', 0.48);
  // ---- 4. Hücre istatistikleri ve komşuluklar
  const cCnt = new Float64Array(NC), cSx = new Float64Array(NC), cSy = new Float64Array(NC);
  const cEdge = new Uint8Array(NC);
  const cellAdj = new Map();
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const c = raster[row + x];
      cCnt[c]++; cSx[c] += x; cSy[c] += y;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) cEdge[c] = 1;
      if (x + 1 < W) {
        const d = raster[row + x + 1];
        if (d !== c) { const k = c < d ? c * NC + d : d * NC + c; cellAdj.set(k, (cellAdj.get(k) || 0) + 1); }
      }
      if (y + 1 < H) {
        const d = raster[row + W + x];
        if (d !== c) { const k = c < d ? c * NC + d : d * NC + c; cellAdj.set(k, (cellAdj.get(k) || 0) + 1); }
      }
    }
  }
  const cNb = Array.from({ length: NC }, () => []);
  for (const [k, len] of cellAdj) {
    const a = Math.floor(k / NC), b = k % NC;
    if (len >= 3) { cNb[a].push(b); cNb[b].push(a); }
  }
  // Boş kalan hücreler (raster'da hiç pikseli yok) denize çevrilir
  for (let i = 0; i < NC; i++) if (cCnt[i] === 0) cellLand[i] = 0;

  // Göller: kenara bağlanmayan küçük su kümeleri karaya çevrilir
  {
    const seen = new Uint8Array(NC);
    const q = [];
    for (let i = 0; i < NC; i++) if (!cellLand[i] && cEdge[i]) { seen[i] = 1; q.push(i); }
    while (q.length) { const c = q.pop(); for (const n of cNb[c]) if (!cellLand[n] && !seen[n]) { seen[n] = 1; q.push(n); } }
    for (let i = 0; i < NC; i++) {
      if (cellLand[i] || seen[i] || cCnt[i] === 0) continue;
      const comp = [i]; seen[i] = 2;
      for (let h = 0; h < comp.length; h++) for (const n of cNb[comp[h]]) if (!cellLand[n] && !seen[n]) { seen[n] = 2; comp.push(n); }
      if (comp.length <= 3) for (const c of comp) cellLand[c] = 1;
    }
  }

  // ---- 5. Deniz bölgeleri
  const zoneOf = new Int32Array(NC).fill(-1);
  const zoneSeeds = [];
  {
    const seaCells = [];
    for (let i = 0; i < NC; i++) if (!cellLand[i] && cCnt[i] > 0) seaCells.push(i);
    rng.shuffle(seaCells);
    const minD2 = 165 * 165;
    for (const c of seaCells) {
      let ok = true;
      for (const z of zoneSeeds) { const dx = px[z] - px[c], dy = py[z] - py[c]; if (dx * dx + dy * dy < minD2) { ok = false; break; } }
      if (ok) zoneSeeds.push(c);
    }
    let frontier = [];
    zoneSeeds.forEach((c, zi) => { zoneOf[c] = zi; frontier.push(c); });
    const grow = () => {
      while (frontier.length) {
        const next = [];
        for (const c of frontier) for (const n of cNb[c]) if (!cellLand[n] && zoneOf[n] < 0 && cCnt[n] > 0) { zoneOf[n] = zoneOf[c]; next.push(n); }
        frontier = next;
      }
    };
    grow();
    for (const c of seaCells) if (zoneOf[c] < 0) { zoneOf[c] = zoneSeeds.length; zoneSeeds.push(c); frontier = [c]; grow(); }
  }

  // ---- 6. Eyaletler
  const cellToProv = new Int32Array(NC).fill(0);
  const prov = [];
  for (let i = 0; i < NC; i++) {
    if (!cellLand[i]) continue;
    cellToProv[i] = prov.length;
    prov.push({ id: prov.length, land: true, area: cCnt[i], cx: cSx[i] / cCnt[i], cy: cSy[i] / cCnt[i], nb: [], nbLen: [], seaNb: [], landNb: [] });
  }
  const NL = prov.length;
  for (let z = 0; z < zoneSeeds.length; z++) prov.push({ id: NL + z, land: false, area: 0, cx: 0, cy: 0, nb: [], nbLen: [], seaNb: [], landNb: [], sx: 0, sy: 0 });
  const NP = prov.length;
  for (let i = 0; i < NC; i++) {
    if (cellLand[i]) continue;
    const z = zoneOf[i];
    if (z < 0) { cellToProv[i] = NL; continue; }
    cellToProv[i] = NL + z;
    const p = prov[NL + z];
    p.area += cCnt[i]; p.sx += cSx[i]; p.sy += cSy[i];
  }
  for (let z = NL; z < NP; z++) { const p = prov[z]; p.cx = p.sx / Math.max(1, p.area); p.cy = p.sy / Math.max(1, p.area); delete p.sx; delete p.sy; }
  for (let i = 0, n = W * H; i < n; i++) raster[i] = cellToProv[raster[i]];

  const pAdj = new Map();
  for (const [k, len] of cellAdj) {
    const a = cellToProv[Math.floor(k / NC)], b = cellToProv[k % NC];
    if (a === b) continue;
    const kk = a < b ? a * NP + b : b * NP + a;
    pAdj.set(kk, (pAdj.get(kk) || 0) + len);
  }
  for (const [k, len] of pAdj) {
    const a = Math.floor(k / NP), b = k % NP;
    const A = prov[a], B = prov[b];
    if (A.land === B.land) {
      if (len < 5) continue;
      A.nb.push(b); A.nbLen.push(len); B.nb.push(a); B.nbLen.push(len);
    } else {
      if (len < 3) continue;
      const L = A.land ? A : B, S = A.land ? B : A;
      L.seaNb.push(S.id); S.landNb.push(L.id);
    }
  }
  // Ağırlık merkezi eyaletin içinde değilse en yakın iç piksele taşı
  for (const p of prov) {
    if (raster[(p.cy | 0) * W + (p.cx | 0)] === p.id) continue;
    let best = 1e12, bx = p.cx, by = p.cy;
    const R = p.land ? 80 : 320;
    const x0 = Math.max(0, (p.cx | 0) - R), x1 = Math.min(W - 1, (p.cx | 0) + R);
    const y0 = Math.max(0, (p.cy | 0) - R), y1 = Math.min(H - 1, (p.cy | 0) + R);
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      if (raster[y * W + x] !== p.id) continue;
      const d = (x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy);
      if (d < best) { best = d; bx = x; by = y; }
    }
    p.cx = bx; p.cy = by;
  }
  for (const p of prov) p.coastal = p.land && p.seaNb.length > 0;

  await step('Dağlar yükseliyor', 0.58);
  // ---- 7. Yükseklik haritası
  const height = new Float32Array(HW * HH);
  {
    const dl = new Float32Array(HW * HH), ds = new Float32Array(HW * HH);
    const BIG = 1e6;
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
      const land = raster[(y * HS + 1) * W + x * HS + 1] < NL;
      dl[y * HW + x] = land ? BIG : 0; ds[y * HW + x] = land ? 0 : BIG;
    }
    const chamfer = (d) => {
      for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
        const i = y * HW + x; let v = d[i];
        if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
        if (y > 0) {
          if (d[i - HW] + 1 < v) v = d[i - HW] + 1;
          if (x > 0 && d[i - HW - 1] + 1.414 < v) v = d[i - HW - 1] + 1.414;
          if (x < HW - 1 && d[i - HW + 1] + 1.414 < v) v = d[i - HW + 1] + 1.414;
        }
        d[i] = v;
      }
      for (let y = HH - 1; y >= 0; y--) for (let x = HW - 1; x >= 0; x--) {
        const i = y * HW + x; let v = d[i];
        if (x < HW - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
        if (y < HH - 1) {
          if (d[i + HW] + 1 < v) v = d[i + HW] + 1;
          if (x > 0 && d[i + HW - 1] + 1.414 < v) v = d[i + HW - 1] + 1.414;
          if (x < HW - 1 && d[i + HW + 1] + 1.414 < v) v = d[i + HW + 1] + 1.414;
        }
        d[i] = v;
      }
    };
    chamfer(dl); chamfer(ds);
    const tmp = new Float32Array(HW * HH);
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        const i = y * HW + x, wx = x * HS, wy = y * HS;
        if (dl[i] > 0) {
          const d = dl[i];
          const cf = smoothstep(0, 9, d), inland = 0.5 + 0.5 * smoothstep(0, 46, d);
          const E = (0.6 * ridge(wx / 380, wy / 380, sD, 4) + 0.4 * (fbm(wx / 210, wy / 210, sD + 99, 4) * 0.5 + 0.5)) * inland;
          const relief = Math.pow(clamp((E - 0.3) / 0.42, 0, 1), 1.8);
          tmp[i] = cf * (0.045 + 0.955 * relief) + cf * 0.012 * noise2(wx / 14, wy / 14, sD + 5);
        } else {
          tmp[i] = -smoothstep(0, 70, ds[i]);
        }
      }
      if ((y & 127) === 127) await step('Dağlar yükseliyor', 0.58 + 0.2 * (y / HH));
    }
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
      const i = y * HW + x;
      if (x === 0 || y === 0 || x === HW - 1 || y === HH - 1) { height[i] = tmp[i]; continue; }
      height[i] = (tmp[i] * 4 + tmp[i - 1] + tmp[i + 1] + tmp[i - HW] + tmp[i + HW]) / 8;
    }
  }

  await step('Uluslar kuruluyor', 0.82);
  // ---- 8. Arazi tipleri
  {
    const sumH = new Float64Array(NP), cntH = new Float64Array(NP);
    for (let y = 0; y < HH; y += 2) for (let x = 0; x < HW; x += 2) {
      const p = raster[(y * HS + 1) * W + x * HS + 1];
      sumH[p] += height[y * HW + x]; cntH[p]++;
    }
    const lands = [];
    for (let i = 0; i < NL; i++) {
      const p = prov[i];
      p.elev = cntH[i] ? sumH[i] / cntH[i] : 0;
      p.moist = fbm(p.cx / 340, p.cy / 340, sA + 4242, 3) * 0.5 + 0.5;
      p.terrain = 'plains';
      lands.push(p);
    }
    const byElev = lands.slice().sort((a, b) => b.elev - a.elev);
    const nM = Math.round(NL * 0.09), nH = Math.round(NL * 0.17);
    byElev.forEach((p, i) => { if (i < nM) p.terrain = 'mountain'; else if (i < nM + nH) p.terrain = 'hills'; });
    const rest = lands.filter((p) => p.terrain === 'plains');
    const band = (p) => { const lat = p.cy / H; return Math.exp(-Math.pow((lat - 0.72) / 0.2, 2)); };
    const byDry = rest.slice().sort((a, b) => (1 - b.moist) * band(b) - (1 - a.moist) * band(a));
    const nD = Math.round(NL * 0.08);
    byDry.forEach((p, i) => { if (i < nD && (1 - p.moist) * band(p) > 0.22) p.terrain = 'desert'; });
    const rest2 = rest.filter((p) => p.terrain === 'plains').sort((a, b) => b.moist - a.moist);
    const nF = Math.round(NL * 0.22);
    rest2.forEach((p, i) => { if (i < nF) p.terrain = (p.coastal && p.elev < 0.12 && i % 3 === 0) ? 'marsh' : 'forest'; });
  }

  // ---- 9. Ülkeler
  const NN = NATIONS.length;
  const core = new Int32Array(NP).fill(-1);
  const comp = new Int32Array(NL).fill(-1);
  const compSize = [];
  for (let i = 0; i < NL; i++) {
    if (comp[i] >= 0) continue;
    const id = compSize.length; const list = [i]; comp[i] = id;
    for (let h = 0; h < list.length; h++) for (const n of prov[list[h]].nb) if (comp[n] < 0) { comp[n] = id; list.push(n); }
    compSize.push(list.length);
  }
  const capitals = [];
  {
    const dist2 = (a, b) => (prov[a].cx - prov[b].cx) ** 2 + (prov[a].cy - prov[b].cy) ** 2;
    for (let n = 0; n < NN; n++) {
      const minComp = n < MAJORS ? 26 : 5;
      let cands = [];
      for (let i = 0; i < NL; i++) {
        const p = prov[i];
        if (compSize[comp[i]] < minComp || p.terrain === 'mountain' || p.terrain === 'desert') continue;
        if (p.cx < 90 || p.cy < 90 || p.cx > W - 90 || p.cy > H - 90) continue;
        let md = 1e12;
        for (const c of capitals) md = Math.min(md, dist2(i, c));
        if (!capitals.length) md = rng.next();
        cands.push([md, i]);
      }
      if (!cands.length) { for (let i = 0; i < NL; i++) if (!capitals.includes(i)) cands.push([rng.next(), i]); }
      cands.sort((a, b) => b[0] - a[0]);
      capitals.push(cands[Math.floor(rng.next() * Math.min(4, cands.length))][1]);
    }
  }
  {
    const TC = { plains: 1, forest: 1.3, hills: 1.6, mountain: 2.8, desert: 1.5, marsh: 1.6, urban: 1 };
    const power = [];
    for (let n = 0; n < NN; n++) power.push((n < MAJORS ? 1.0 : 0.4) * rng.range(0.85, 1.2));
    const costTo = new Float64Array(NL).fill(1e12);
    const heap = new MinHeap();
    capitals.forEach((c, n) => { costTo[c] = 0; core[c] = n; heap.push(0, c * NN + n); });
    const done = new Uint8Array(NL);
    const jitter = new Float32Array(NL);
    for (let i = 0; i < NL; i++) jitter[i] = rng.range(0.7, 1.45);
    while (heap.size) {
      const v = heap.pop(); const c = Math.floor(v / NN), n = v % NN; const key = heap.topKey;
      if (done[c] || core[c] !== n || key > costTo[c] + 1e-9) continue;
      done[c] = 1;
      for (const q of prov[c].nb) {
        if (done[q]) continue;
        const nc = key + (TC[prov[q].terrain] * jitter[q]) / power[n];
        if (nc < costTo[q]) { costTo[q] = nc; core[q] = n; heap.push(nc, q * NN + n); }
      }
    }
    // Sahipsiz adalar en yakın başkente bağlanır
    const compOwner = new Map();
    for (let i = 0; i < NL; i++) {
      if (core[i] >= 0) continue;
      let o = compOwner.get(comp[i]);
      if (o === undefined) {
        let best = 1e18; o = 0;
        for (let n = 0; n < NN; n++) {
          const c = prov[capitals[n]];
          const d = ((c.cx - prov[i].cx) ** 2 + (c.cy - prov[i].cy) ** 2) / (power[n] * power[n]);
          if (d < best) { best = d; o = n; }
        }
        compOwner.set(comp[i], o);
      }
      core[i] = o;
    }
  }

  // ---- 10. Şehirler, nüfus, sanayi, kaynaklar
  const namer = makeNamer(rng);
  const nations = NATIONS.map((n, i) => ({ ...n, id: i, major: i < MAJORS, capital: capitals[i], provs: [] }));
  for (let i = 0; i < NL; i++) {
    const p = prov[i];
    p.core = core[i]; p.name = namer(); p.vp = 1; p.city = false;
    p.civ0 = 0; p.mil0 = 0; p.dock0 = 0; p.port0 = 0; p.fort0 = 0; p.infra0 = 1;
    p.res0 = { steel: 0, oil: 0, alu: 0 };
    nations[core[i]].provs.push(i);
  }
  const seaKinds = ['Denizi', 'Denizi', 'Körfezi', 'Açıkları', 'Boğazı', 'Suları'];
  for (let i = NL; i < NP; i++) {
    const p = prov[i];
    p.core = -1; p.terrain = 'sea';
    p.name = namer() + ' ' + (p.area > 60000 ? 'Okyanusu' : rng.pick(seaKinds));
  }
  for (const nat of nations) {
    const list = nat.provs;
    const cap = prov[nat.capital];
    cap.vp = nat.major ? 30 : 20; cap.city = true; cap.capitalOf = nat.id; cap.terrain = 'urban';
    const nCities = clamp(Math.round(list.length / 7), 1, 6);
    const chosen = [nat.capital];
    for (let k = 0; k < nCities; k++) {
      let best = -1, bi = -1;
      for (const i of list) {
        if (chosen.includes(i)) continue;
        const p = prov[i];
        let md = 1e12;
        for (const c of chosen) md = Math.min(md, (prov[c].cx - p.cx) ** 2 + (prov[c].cy - p.cy) ** 2);
        const tw = p.terrain === 'plains' ? 1.4 : p.terrain === 'mountain' || p.terrain === 'desert' ? 0.35 : 0.9;
        const s = Math.sqrt(md) * tw * (p.coastal ? 1.25 : 1) * rng.range(0.8, 1.2);
        if (s > best) { best = s; bi = i; }
      }
      if (bi < 0) break;
      chosen.push(bi);
      const p = prov[bi];
      p.city = true; p.vp = rng.int(5, nat.major ? 15 : 10);
      if (p.vp >= 10) p.terrain = 'urban';
    }
    nat.cities = chosen;
    for (const i of list) {
      const p = prov[i];
      p.pop0 = Math.round(TERRAIN[p.terrain === 'urban' ? 'plains' : p.terrain].pop * rng.range(0.6, 1.4) * 1000 + (p.city ? p.vp * 90000 : 0) + (p.capitalOf !== undefined ? 1200000 : 0));
      p.infra0 = p.capitalOf !== undefined ? 4 : p.city ? 3 : (p.terrain === 'plains' ? 2 : 1) + (rng.chance(0.25) ? 1 : 0);
      p.slots0 = clamp(2 + Math.floor(p.pop0 / 500000), 2, 9) + (p.capitalOf !== undefined ? 4 : p.city ? 2 : 0);
    }
    const size = list.length;
    let civ = nat.major ? 15 + size * 0.24 : 3 + size * 0.3;
    let mil = nat.major ? 6 + size * 0.14 : 1.2 + size * 0.15;
    if (nat.ideo === 'mil') mil *= 1.3;
    if (nat.ideo === 'kol') mil *= 1.15;
    if (nat.ideo === 'dem') civ *= 1.15;
    const coastalList = list.filter((i) => prov[i].coastal);
    let dock = coastalList.length ? (nat.major ? rng.int(2, 5) : rng.int(0, 2)) : 0;
    const weights = list.map((i) => (prov[i].city ? prov[i].vp + 2 : 0.5));
    const pickW = (filter) => {
      let tot = 0;
      for (let k = 0; k < list.length; k++) if (!filter || filter(prov[list[k]])) tot += weights[k];
      if (tot <= 0) return -1;
      let r = rng.next() * tot;
      for (let k = 0; k < list.length; k++) {
        if (filter && !filter(prov[list[k]])) continue;
        r -= weights[k]; if (r <= 0) return list[k];
      }
      return -1;
    };
    const free = (p) => p.civ0 + p.mil0 + p.dock0 < p.slots0;
    for (let k = Math.round(civ); k > 0; k--) { const i = pickW(free); if (i >= 0) prov[i].civ0++; }
    for (let k = Math.round(mil); k > 0; k--) { const i = pickW(free); if (i >= 0) prov[i].mil0++; }
    for (let k = dock; k > 0; k--) { const i = pickW((p) => p.coastal && free(p)); if (i >= 0) prov[i].dock0++; }
    for (const i of coastalList) { const p = prov[i]; if (p.city || p.dock0 > 0) p.port0 = 1; }
    if (coastalList.length && !coastalList.some((i) => prov[i].port0)) prov[rng.pick(coastalList)].port0 = 1;
    for (let k = 0; k < 1 + (nat.major ? 1 : 0); k++) if (coastalList.length) prov[rng.pick(coastalList)].port0 = 1;
    // Kaynaklar
    const give = (key, total, pref) => {
      let left = Math.round(total), guard = 0;
      while (left > 0 && guard++ < 40) {
        const cands = list.filter((i) => pref.includes(prov[i].terrain));
        const i = cands.length && rng.chance(0.8) ? rng.pick(cands) : rng.pick(list);
        const amt = Math.min(left, rng.int(3, 12));
        prov[i].res0[key] += amt; left -= amt;
      }
    };
    give('steel', (nat.major ? 14 : 5) + size * rng.range(0.5, 1.3), ['hills', 'mountain']);
    give('oil', rng.chance(nat.major ? 0.45 : 0.25) ? rng.range(14, 36) : rng.range(0, 7), ['desert', 'plains', 'marsh']);
    give('alu', rng.chance(0.55) ? rng.range(8, 24) : rng.range(0, 6), ['hills', 'forest', 'mountain']);
  }

  // Kıyıya uzaklık (sıçrama sayısı) — yapay zekâ için
  const mini = new Uint16Array(MINI_W * MINI_H);
  const mk = W / MINI_W;
  for (let y = 0; y < MINI_H; y++) for (let x = 0; x < MINI_W; x++) mini[y * MINI_W + x] = raster[Math.floor(y * mk + mk / 2) * W + Math.floor(x * mk + mk / 2)];

  await step('Hazır', 1);
  return { seed: String(seedStr), W, H, NL, NP, raster, height, prov, nations, mini };
}

export function heightAt(world, x, y) {
  const gx = clamp(x / HS - 0.5, 0, HW - 1.001), gy = clamp(y / HS - 0.5, 0, HH - 1.001);
  const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
  const h = world.height, i = y0 * HW + x0;
  const a = h[i] + (h[i + 1] - h[i]) * fx, b = h[i + HW] + (h[i + HW + 1] - h[i + HW]) * fx;
  const v = a + (b - a) * fy;
  return v > 0 ? v * HEIGHT_SCALE : 0;
}

export function provAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.W || y >= world.H) return -1;
  return world.raster[(y | 0) * world.W + (x | 0)];
}
