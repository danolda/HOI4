// Gerçek dünya haritasından oyun dünyası: bölge rasteri, eyaletler, komşuluklar, arazi, 1936 sınırları.
// Tarayıcılar arasında birebir aynı sonucu vermesi için yalnızca tam belirli aritmetik kullanılır.
import { RNG, hashString, fbm, ridge, noise2, clamp, smoothstep } from './rng.js';
import { NATIONS, MAJORS } from './data.js';
import { GEO } from './geodata.js';

export const MAP_W = GEO.W, MAP_H = GEO.H;
export const HS = 3;
export const HW = MAP_W / HS, HH = MAP_H / HS;
export const HEIGHT_SCALE = 40;
export const MINI_W = 256, MINI_H = 128;
export const WORLD_SEED = 'DUNYA-1936';
const NONE = 0xffff;

function fillRings(buf, W, H, rings, value) {
  let y0 = 1e9, y1 = -1e9;
  for (const r of rings) for (let i = 1; i < r.length; i += 2) { if (r[i] < y0) y0 = r[i]; if (r[i] > y1) y1 = r[i]; }
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(H - 1, Math.ceil(y1));
  const xs = [];
  for (let y = ya; y <= yb; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length;
      for (let i = 0; i < n; i += 2) {
        const ax = r[i], ay = r[i + 1], j = (i + 2) % n, bx = r[j], by = r[j + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const row = y * W;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) buf[row + x] = value;
    }
  }
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, n = poly.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export async function generateWorld(seedStr = WORLD_SEED, step = async () => {}) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const seedNum = hashString(String(seedStr));
  const rng = new RNG(seedNum);
  const sA = (seedNum ^ 0x51f3) | 0, sD = (seedNum ^ 0x4c05) | 0;

  await step('Kıtalar çiziliyor', 0.04);
  // ---- 1. Bölge rasteri (0 deniz, aksi hâlde bölge no + 1)
  const reg = new Uint8Array(N);
  GEO.regions.forEach((r, i) => fillRings(reg, W, H, r.rings, i + 1));
  for (const l of GEO.lakes) fillRings(reg, W, H, [l], 0);

  // ---- 2. Küçük parçaları temizle, bileşenleri say
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const flood = (start, onPix) => {
    const g = reg[start];
    let sp = 0, cnt = 0;
    stack[sp++] = start; seen[start] = 1;
    while (sp) {
      const i = stack[--sp];
      cnt++;
      if (onPix) onPix(i);
      const x = i % W;
      if (x > 0 && !seen[i - 1] && reg[i - 1] === g) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < W - 1 && !seen[i + 1] && reg[i + 1] === g) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (i >= W && !seen[i - W] && reg[i - W] === g) { seen[i - W] = 1; stack[sp++] = i - W; }
      if (i < N - W && !seen[i + W] && reg[i + W] === g) { seen[i + W] = 1; stack[sp++] = i + W; }
    }
    return cnt;
  };
  const KMPP = 13.045, rowCos = GEO.rowCos;
  const kmpp = (y) => KMPP * rowCos[clamp(y >> 3, 0, rowCos.length - 1)];
  {
    const pix = [];
    for (let i = 0; i < N; i++) {
      if (seen[i] || reg[i] === 0) continue;
      pix.length = 0;
      const cnt = flood(i, (p) => { if (pix.length < 400) pix.push(p); });
      const k = kmpp((i / W) | 0);
      if (cnt < 400 && (cnt < 20 || cnt * k * k < 1500)) for (const p of pix) reg[p] = 0;
    }
  }

  await step('Eyaletler bölünüyor', 0.14);
  // ---- 3. Eyalet tohumları (değişken yoğunluklu)
  const dens = GEO.density, defR = GEO.defaultR;
  const spacing = (x, y) => { for (let k = 0; k < dens.length; k++) { const d = dens[k]; if (x >= d[0] && x < d[1] && y >= d[2] && y < d[3]) return d[4]; } return defR; };
  const landR = (x, y) => clamp(spacing(x, y) / kmpp(y), 11, 140);
  const seaR = (x, y) => clamp(clamp(spacing(x, y) * 3.2, 430, 1900) / kmpp(y), 40, 250);
  const BK = 23, bw = Math.ceil(W / BK), bh = Math.ceil(H / BK);
  const sx = [], sy = [], sr = [], sLand = [];
  const buckets = Array.from({ length: bw * bh }, () => []);
  const tryAdd = (x, y, r, land, force) => {
    const bx = (x / BK) | 0, by = (y / BK) | 0, span = Math.ceil((r + 250) / 2 / BK);
    if (!force) {
      for (let yy = Math.max(0, by - span); yy <= Math.min(bh - 1, by + span); yy++) for (let xx = Math.max(0, bx - span); xx <= Math.min(bw - 1, bx + span); xx++) {
        const b = buckets[yy * bw + xx];
        for (let k = 0; k < b.length; k++) {
          const j = b[k];
          if (sLand[j] !== land) continue;
          const dx = sx[j] - x, dy = sy[j] - y, m = (r + sr[j]) / 2;
          if (dx * dx + dy * dy < m * m) return false;
        }
      }
    }
    buckets[by * bw + bx].push(sx.length);
    sx.push(x); sy.push(y); sr.push(r); sLand.push(land);
    return true;
  };
  for (let t = 0; t < 260000; t++) {
    const x = (rng.next() * W) | 0, y = (rng.next() * H) | 0;
    if (reg[y * W + x] === 0) continue;
    tryAdd(x, y, landR(x, y), 1, false);
  }
  for (let t = 0; t < 70000; t++) {
    const x = (rng.next() * W) | 0, y = (rng.next() * H) | 0;
    if (reg[y * W + x] !== 0) continue;
    tryAdd(x, y, seaR(x, y), 0, false);
  }
  // her kara parçasına ve her kapalı denize en az bir tohum
  seen.fill(0);
  for (let s = 0, n0 = sx.length; s < n0; s++) { const i = sy[s] * W + sx[s]; if (!seen[i]) flood(i, null); }
  for (let i = 0; i < N; i++) {
    if (seen[i]) continue;
    let cx = 0, cy = 0;
    const sample = [];
    const cnt = flood(i, (p) => { cx += p % W; cy += (p / W) | 0; if (sample.length < 6000) sample.push(p); });
    if (reg[i] === 0 && cnt < 60) continue;
    cx /= cnt; cy /= cnt;
    if (reg[i] !== 0) {
      // tohum düşmeyen ada: yeterince büyük değilse denize çevir
      const k = kmpp(cy | 0), km2 = cnt * k * k;
      if (km2 < 6000 || (rowCos[clamp((cy | 0) >> 3, 0, rowCos.length - 1)] < 0.47 && km2 < 60000)) { if (cnt <= 6000) for (const p of sample) reg[p] = 0; else continue; continue; }
    }
    let best = i, bd = 1e18;
    const g = reg[i];
    for (const p of sample) { const d = (p % W - cx) ** 2 + (((p / W) | 0) - cy) ** 2; if (d < bd) { bd = d; best = p; } }
    tryAdd(best % W, (best / W) | 0, g ? landR(best % W, (best / W) | 0) : 200, g ? 1 : 0, true);
  }
  const NS = sx.length;

  await step('Sınırlar çiziliyor', 0.26);
  // ---- 4. Etiket yayılımı: aynı bölge içinde gürültülü jeodezik Voronoi
  const WQ = (W >> 2) + 1, HQ = (H >> 2) + 1;
  const cost = new Float32Array(WQ * HQ);
  for (let y = 0; y < HQ; y++) for (let x = 0; x < WQ; x++) cost[y * WQ + x] = 1 + 0.55 * fbm(x / 5.5, y / 5.5, sA, 3) + 0.25 * noise2(x / 1.7, y / 1.7, sA + 9);
  const label = new Uint16Array(N).fill(NONE);
  const dist = new Float32Array(N).fill(1e30);
  for (let s = 0; s < NS; s++) { const i = sy[s] * W + sx[s]; label[i] = s; dist[i] = 0; }
  const D1 = 1, D2 = 1.4142;
  for (let iter = 0; iter < 7; iter++) {
    let changed = 0;
    for (let y = 0; y < H; y++) {
      const row = y * W, crow = (y >> 2) * WQ;
      for (let x = 0; x < W; x++) {
        const i = row + x, g = reg[i], c = cost[crow + (x >> 2)];
        let d = dist[i], l = label[i], nd;
        if (x > 0 && reg[i - 1] === g && (nd = dist[i - 1] + D1 * c) < d) { d = nd; l = label[i - 1]; }
        if (y > 0) {
          if (reg[i - W] === g && (nd = dist[i - W] + D1 * c) < d) { d = nd; l = label[i - W]; }
          if (x > 0 && reg[i - W - 1] === g && (nd = dist[i - W - 1] + D2 * c) < d) { d = nd; l = label[i - W - 1]; }
          if (x < W - 1 && reg[i - W + 1] === g && (nd = dist[i - W + 1] + D2 * c) < d) { d = nd; l = label[i - W + 1]; }
        }
        if (l !== label[i]) changed++;
        dist[i] = d; label[i] = l;
      }
    }
    for (let y = H - 1; y >= 0; y--) {
      const row = y * W, crow = (y >> 2) * WQ;
      for (let x = W - 1; x >= 0; x--) {
        const i = row + x, g = reg[i], c = cost[crow + (x >> 2)];
        let d = dist[i], l = label[i], nd;
        if (x < W - 1 && reg[i + 1] === g && (nd = dist[i + 1] + D1 * c) < d) { d = nd; l = label[i + 1]; }
        if (y < H - 1) {
          if (reg[i + W] === g && (nd = dist[i + W] + D1 * c) < d) { d = nd; l = label[i + W]; }
          if (x < W - 1 && reg[i + W + 1] === g && (nd = dist[i + W + 1] + D2 * c) < d) { d = nd; l = label[i + W + 1]; }
          if (x > 0 && reg[i + W - 1] === g && (nd = dist[i + W - 1] + D2 * c) < d) { d = nd; l = label[i + W - 1]; }
        }
        if (l !== label[i]) changed++;
        dist[i] = d; label[i] = l;
      }
    }
    await step('Sınırlar çiziliyor', 0.26 + 0.05 * (iter + 1));
    if (changed < 400) break;
  }
  // etiketsiz kalan küçük su/kara parçaları: komşu etiketi al (önce aynı tür)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      if (label[i] !== NONE) continue;
      const x = i % W, land = reg[i] !== 0;
      let l = NONE;
      const tryN = (j) => { if (l === NONE && label[j] !== NONE && (pass > 0 || (reg[j] !== 0) === land)) l = label[j]; };
      if (x > 0) tryN(i - 1); if (x < W - 1) tryN(i + 1); if (i >= W) tryN(i - W); if (i < N - W) tryN(i + W);
      if (l !== NONE) { label[i] = l; if (sLand[l] === 0) reg[i] = 0; }
    }
    for (let i = N - 1; i >= 0; i--) {
      if (label[i] !== NONE) continue;
      const x = i % W, land = reg[i] !== 0;
      let l = NONE;
      const tryN = (j) => { if (l === NONE && label[j] !== NONE && (pass > 0 || (reg[j] !== 0) === land)) l = label[j]; };
      if (x > 0) tryN(i - 1); if (x < W - 1) tryN(i + 1); if (i >= W) tryN(i - W); if (i < N - W) tryN(i + W);
      if (l !== NONE) { label[i] = l; if (sLand[l] === 0) reg[i] = 0; }
    }
  }

  await step('Komşuluklar hesaplanıyor', 0.62);
  // ---- 5. Eyaletler: önce kara, sonra deniz
  const seedToProv = new Int32Array(NS).fill(-1);
  const prov = [];
  const cnt = new Float64Array(NS), smx = new Float64Array(NS), smy = new Float64Array(NS);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const l = label[y * W + x]; if (l === NONE) continue; cnt[l]++; smx[l] += x; smy[l] += y; }
  const mk = (s, land) => ({ id: prov.length, land, area: cnt[s], cx: smx[s] / cnt[s], cy: smy[s] / cnt[s], nb: [], nbLen: [], seaNb: [], landNb: [], region: land ? reg[sy[s] * W + sx[s]] - 1 : -1 });
  for (let s = 0; s < NS; s++) if (sLand[s] && cnt[s] > 0 && reg[sy[s] * W + sx[s]] !== 0) { seedToProv[s] = prov.length; prov.push(mk(s, true)); }
  const NL = prov.length;
  for (let s = 0; s < NS; s++) if (seedToProv[s] < 0 && cnt[s] > 0) { seedToProv[s] = prov.length; prov.push(mk(s, false)); }
  const NP = prov.length;
  const raster = label;
  let fallback = NL;
  for (let i = 0; i < N; i++) { const l = raster[i]; raster[i] = l === NONE ? fallback : seedToProv[l] < 0 ? fallback : seedToProv[l]; }

  const pAdj = new Map();
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const c = raster[row + x];
      if (x + 1 < W) { const d = raster[row + x + 1]; if (d !== c) { const k = c < d ? c * NP + d : d * NP + c; pAdj.set(k, (pAdj.get(k) || 0) + 1); } }
      if (y + 1 < H) { const d = raster[row + W + x]; if (d !== c) { const k = c < d ? c * NP + d : d * NP + c; pAdj.set(k, (pAdj.get(k) || 0) + 1); } }
    }
  }
  for (const [k, len] of pAdj) {
    const a = Math.floor(k / NP), b = k % NP;
    const A = prov[a], B = prov[b];
    if (A.land === B.land) {
      if (len < (A.land ? 3 : 4)) continue;
      A.nb.push(b); A.nbLen.push(len); B.nb.push(a); B.nbLen.push(len);
    } else {
      if (len < 2) continue;
      const L = A.land ? A : B, S = A.land ? B : A;
      L.seaNb.push(S.id); S.landNb.push(L.id);
    }
  }
  for (const p of prov) {
    if (raster[(p.cy | 0) * W + (p.cx | 0)] === p.id) continue;
    let best = 1e12, bx = p.cx, by = p.cy;
    const R = p.land ? 90 : 300;
    const x0 = Math.max(0, (p.cx | 0) - R), x1 = Math.min(W - 1, (p.cx | 0) + R), y0 = Math.max(0, (p.cy | 0) - R), y1 = Math.min(H - 1, (p.cy | 0) + R);
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      if (raster[y * W + x] !== p.id) continue;
      const d = (x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy);
      if (d < best) { best = d; bx = x; by = y; }
    }
    p.cx = bx; p.cy = by;
  }
  const provAtPx = (x, y, wantLand) => {
    x = clamp(x | 0, 0, W - 1); y = clamp(y | 0, 0, H - 1);
    let p = raster[y * W + x];
    if (prov[p].land === wantLand) return p;
    for (let r = 1; r <= 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      p = raster[yy * W + xx];
      if (prov[p].land === wantLand) return p;
    }
    return -1;
  };
  const link = (a, b) => { if (a < 0 || b < 0 || a === b || prov[a].nb.includes(b)) return; prov[a].nb.push(b); prov[a].nbLen.push(8); prov[b].nb.push(a); prov[b].nbLen.push(8); };
  for (const l of GEO.seaLinks) link(provAtPx(l[0], l[1], false), provAtPx(l[2], l[3], false));
  for (const l of GEO.landLinks) link(provAtPx(l[0], l[1], true), provAtPx(l[2], l[3], true));
  for (const p of prov) { p.coastal = p.land && p.seaNb.length > 0; p.kmpp = kmpp(p.cy | 0); }

  await step('Dağlar yükseliyor', 0.7);
  // ---- 6. Yükseklik alanı
  const elev = new Float32Array(HW * HH);
  const bump = (t) => { const v = 1 - t * t; return v > 0 ? v * v : 0; };
  for (const r of GEO.ranges) {
    const w = (r.w * 1.7) / HS, pts = r.pts;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k] / HS, ay = pts[k + 1] / HS, bx = pts[k + 2] / HS, by = pts[k + 3] / HS;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - w)), x1 = Math.min(HW - 1, Math.ceil(Math.max(ax, bx) + w));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - w)), y1 = Math.min(HH - 1, Math.ceil(Math.max(ay, by) + w));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
        const px = ax + dx * t - x, py = ay + dy * t - y;
        const v = r.h * bump(Math.sqrt(px * px + py * py) / w);
        const i = y * HW + x;
        if (v > elev[i]) elev[i] = v;
      }
    }
  }
  for (const z of GEO.zones) {
    if (z[0] !== 'high') continue;
    const cx = z[1] / HS, cy = z[2] / HS, rx = (z[3] * 1.25) / HS, ry = (z[4] * 1.25) / HS;
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(HH - 1, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(HW - 1, Math.ceil(cx + rx)); x++) {
      const t = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const v = z[5] * bump(t), i = y * HW + x;
      if (v > elev[i]) elev[i] = v;
    }
  }
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
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
      const i = y * HW + x;
      if (dl[i] > 0) {
        const cf = smoothstep(0, 3.5, dl[i]);
        const e = elev[i];
        const rough = 0.55 + 0.75 * ridge(x / 26, y / 26, sD, 4);
        const base = 0.05 + 0.05 * (fbm(x / 40, y / 40, sD + 99, 3) * 0.5 + 0.5);
        const v = clamp(base + e * rough, 0, 1);
        tmp[i] = cf * (0.03 + 0.97 * v * Math.sqrt(v)) + cf * 0.008 * noise2(x / 3, y / 3, sD + 5);
      } else tmp[i] = -smoothstep(0, 26, ds[i]);
    }
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
      const i = y * HW + x;
      if (x === 0 || y === 0 || x === HW - 1 || y === HH - 1) { height[i] = tmp[i]; continue; }
      height[i] = (tmp[i] * 4 + tmp[i - 1] + tmp[i + 1] + tmp[i - HW] + tmp[i + HW]) / 8;
    }
  }

  await step('Devletler kuruluyor', 0.84);
  // ---- 7. Sahiplik (1936 sınırları), arazi, şehirler
  const inZone = (z, x, y) => ((x - z[1]) / z[3]) ** 2 + ((y - z[2]) / z[4]) ** 2 < 1;
  for (let i = 0; i < NL; i++) {
    const p = prov[i], R = GEO.regions[p.region];
    p.owner0 = R.o; p.core = R.core ? R.o : -1;
    for (const ov of GEO.overrides) {
      if (ov.from === p.region && pointInPoly(p.cx, p.cy, ov.poly)) { p.owner0 = ov.to; p.core = ov.core ? ov.to : -1; break; }
    }
    const e = elev[clamp((p.cy / HS) | 0, 0, HH - 1) * HW + clamp((p.cx / HS) | 0, 0, HW - 1)];
    p.elev = e;
    p.terrain = 'plains';
    if (e >= 0.5) p.terrain = 'mountain';
    else if (e >= 0.22) p.terrain = 'hills';
    else for (const z of GEO.zones) { if (z[0] !== 'high' && inZone(z, p.cx, p.cy)) { p.terrain = z[0]; break; } }
    p.vp = 1; p.city = false; p.cityPop = 0; p.name = '';
    p.civ0 = 0; p.mil0 = 0; p.dock0 = 0; p.port0 = 0; p.fort0 = 0; p.infra0 = 1;
    p.res0 = { steel: 0, oil: 0, alu: 0 };
  }
  for (const c of GEO.cities) {
    const pi = raster[clamp(c[2], 0, H - 1) * W + clamp(c[1], 0, W - 1)];
    if (pi >= NL) continue;
    const p = prov[pi];
    if (c[3] > p.cityPop) { p.cityPop = c[3]; p.name = c[0]; p.city = true; }
  }
  const used = new Set();
  const uniq = (n) => { let v = n, k = 2; const R = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII']; while (used.has(v)) v = n + (R[k] || ' ' + k), k++; used.add(v); return v; };
  for (let i = 0; i < NL; i++) if (prov[i].name) used.add(prov[i].name);
  for (let i = 0; i < NL; i++) {
    const p = prov[i];
    if (p.name) continue;
    let bd = 1e18, bc = null;
    for (const c of GEO.cities) { const d = (c[1] - p.cx) ** 2 + (c[2] - p.cy) ** 2; if (d < bd) { bd = d; bc = c; } }
    const dx = p.cx - bc[1], dy = p.cy - bc[2];
    p.name = uniq(bc[0] + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ' Doğusu' : ' Batısı') : dy > 0 ? ' Güneyi' : ' Kuzeyi'));
  }
  for (let i = NL; i < NP; i++) {
    const p = prov[i];
    p.owner0 = -1; p.core = -1; p.terrain = 'sea';
    let bd = 1e18, bn = 'Açık Deniz';
    for (const sea of GEO.seas) { const d = (sea[1] - p.cx) ** 2 + (sea[2] - p.cy) ** 2; if (d < bd) { bd = d; bn = sea[0]; } }
    p.name = uniq(bn);
  }

  // ---- 8. Uluslar ve başlangıç değerleri
  const nations = NATIONS.map((n, i) => ({ ...n, id: i, major: i < MAJORS, provs: [], capital: -1 }));
  for (let i = 0; i < NL; i++) nations[prov[i].owner0].provs.push(i);
  // kara parçaları (liman dağıtımı için)
  const comp = new Int32Array(NL).fill(-1);
  let nComp = 0;
  for (let i = 0; i < NL; i++) {
    if (comp[i] >= 0) continue;
    const list = [i]; comp[i] = nComp;
    for (let h = 0; h < list.length; h++) for (const q of prov[list[h]].nb) if (q < NL && comp[q] < 0) { comp[q] = nComp; list.push(q); }
    nComp++;
  }
  for (const nat of nations) {
    const cap = GEO.caps[nat.id];
    let ci = provAtPx(cap[0], cap[1], true);
    if (ci < 0 || prov[ci].owner0 !== nat.id) {
      let bd = 1e18; ci = -1;
      for (const i of nat.provs) { const p = prov[i]; if (p.core !== nat.id) continue; const d = (p.cx - cap[0]) ** 2 + (p.cy - cap[1]) ** 2; if (d < bd) { bd = d; ci = i; } }
      if (ci < 0 && nat.provs.length) ci = nat.provs[0];
    }
    nat.capital = ci;
    if (ci < 0) continue;
    const C = prov[ci];
    used.delete(C.name); C.name = nat.cap; C.city = true; C.capitalOf = nat.id;
    C.cityPop = Math.max(C.cityPop, nat.major ? 3000 : 800);
    const coreList = nat.provs.filter((i) => prov[i].core === nat.id);
    const wOf = (p) => 1 + Math.min(8, p.cityPop / 450) + (p.capitalOf !== undefined ? 2 : 0);
    let wSum = 0;
    for (const i of coreList) wSum += wOf(prov[i]);
    for (const i of nat.provs) {
      const p = prov[i], core = p.core === nat.id;
      const big = p.cityPop;
      p.vp = p.capitalOf !== undefined ? (nat.major ? 30 : nat.pop >= 5 ? 20 : 10) : big >= 5000 ? 10 : big >= 2000 ? 7 : big >= 1000 ? 5 : big >= 400 ? 3 : big >= 150 ? 2 : 1;
      if (!core && p.vp > 5) p.vp = 5;
      p.pop0 = core ? Math.round((nat.pop * 1e6 * wOf(p)) / wSum) : Math.round(250000 + Math.min(3e6, big * 120));
      p.infra0 = p.capitalOf !== undefined ? 4 : core ? (big >= 500 ? 3 : 2) : 1;
      p.slots0 = core ? Math.round(2.5 + wOf(p) * 0.9) : 2;
      if (big >= 3500 && p.terrain !== 'mountain') p.terrain = 'urban';
    }
    const weights = coreList.map((i) => wOf(prov[i]) ** 1.6);
    const pickW = (filter) => {
      let tot = 0;
      for (let k = 0; k < coreList.length; k++) if (!filter || filter(prov[coreList[k]])) tot += weights[k];
      if (tot <= 0) return -1;
      let r = rng.next() * tot;
      for (let k = 0; k < coreList.length; k++) { if (filter && !filter(prov[coreList[k]])) continue; r -= weights[k]; if (r <= 0) return coreList[k]; }
      return coreList[coreList.length - 1];
    };
    const put = (key, n, filter) => {
      for (let k = 0; k < n; k++) {
        let i = pickW(filter);
        if (i < 0) i = pickW(null);
        if (i < 0) return;
        const p = prov[i];
        p[key]++;
        if (p.civ0 + p.mil0 + p.dock0 > p.slots0) p.slots0 = p.civ0 + p.mil0 + p.dock0;
      }
    };
    put('civ0', nat.civ); put('mil0', nat.mil); put('dock0', nat.dock, (p) => p.coastal);
    if (coreList.length) prov[nat.capital].res0.steel += Math.max(2, Math.round(nat.mil * 1.2));
    // limanlar: şehirli kıyılar ve her kara parçasında en az bir tane
    const byComp = new Map();
    for (const i of nat.provs) {
      const p = prov[i];
      if (!p.coastal) continue;
      if (p.dock0 > 0 || (p.city && (p.core === nat.id || p.cityPop >= 300))) p.port0 = 1;
      const b = byComp.get(comp[i]);
      if (!b || p.cityPop + p.vp > prov[b].cityPop + prov[b].vp) byComp.set(comp[i], i);
    }
    for (const i of byComp.values()) if (!nat.provs.some((j) => comp[j] === comp[i] && prov[j].port0)) prov[i].port0 = 1;
  }
  for (const d of GEO.deposits) { const pi = provAtPx(d[1], d[2], true); if (pi >= 0) prov[pi].res0[d[0]] += d[3]; }
  // Fransa–Almanya sınırındaki tahkimat hattı
  for (const i of nations[2].provs) if (prov[i].core === 2 && prov[i].nb.some((q) => q < NL && prov[q].owner0 === 0)) prov[i].fort0 = 2;

  const mini = new Uint16Array(MINI_W * MINI_H);
  const mkx = W / MINI_W, mky = H / MINI_H;
  for (let y = 0; y < MINI_H; y++) for (let x = 0; x < MINI_W; x++) mini[y * MINI_W + x] = raster[Math.floor(y * mky + mky / 2) * W + Math.floor(x * mkx + mkx / 2)];

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
