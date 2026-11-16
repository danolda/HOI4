// Harita üstü çizimler: dağlar, tepeler, şehirler ve yapı simgeleri.
// Hepsi tek bir doku atlasından, haritaya yatırılmış örneklenmiş (instanced) dörtgenlerle çizilir.
import THREE from '../three.js';
import { elevAt, MAP_W, MAP_H } from '../worldgen.js';
import { RNG, clamp } from '../rng.js';

const CELL = 128, COLS = 8;
const C = { peak1: 0, peak2: 1, peak3: 2, hill1: 3, hill2: 4, city1: 5, city2: 6, city3: 7, capital: 8, civ: 9, mil: 10, dock: 11, fort: 12, port: 13, crane: 14, d0: 16 };
const INK = 'rgba(14,18,24,';

// ---------- çizim yardımcıları
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
function poly(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }

// Yarı saydam açık/koyu yüzlerle çizilen doruk: altındaki ülke rengini korur.
function peak(g, cx, by, w, h, snow) {
  const ax = cx - w * 0.05, ay = by - h;
  const L = [cx - w / 2, by], R = [cx + w / 2, by];
  const m1 = [cx + w * 0.04, by - h * 0.58], m2 = [cx - w * 0.07, by - h * 0.3], m3 = [cx + w * 0.07, by];
  g.fillStyle = 'rgba(8,12,18,0.2)';
  g.beginPath(); g.ellipse(cx + w * 0.2, by - 1, w * 0.6, h * 0.12, 0, 0, Math.PI * 2); g.fill();
  poly(g, [L, [ax, ay], m1, m2, m3]); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fill();
  poly(g, [[ax, ay], R, m3, m2, m1]); g.fillStyle = 'rgba(16,20,28,0.46)'; g.fill();
  if (snow) {
    const t = 0.38;
    const lx = ax + (L[0] - ax) * t, ly = ay + (L[1] - ay) * t, rx = ax + (R[0] - ax) * t, ry = ay + (R[1] - ay) * t;
    const zz = (k, dy) => [lx + (rx - lx) * k, ly + (ry - ly) * k + dy * h];
    poly(g, [[ax, ay], [lx, ly], zz(0.22, -0.07), zz(0.42, 0.05), zz(0.6, -0.06), zz(0.8, 0.045), [rx, ry]]);
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.fill();
    const mx = ax + (m1[0] - ax) * 0.62, my = ay + (m1[1] - ay) * 0.62;
    poly(g, [[ax, ay], [mx, my], zz(0.6, -0.06), zz(0.8, 0.045), [rx, ry]]);
    g.fillStyle = 'rgba(150,170,192,0.85)'; g.fill();
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(L[0], L[1]); g.lineTo(ax, ay); g.lineTo(R[0], R[1]);
  g.strokeStyle = INK + '0.66)'; g.lineWidth = 2.6; g.stroke();
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.lineTo(m3[0], m3[1]);
  g.strokeStyle = INK + '0.34)'; g.lineWidth = 1.5; g.stroke();
}

function hill(g, cx, by, w, h) {
  const dome = () => { g.beginPath(); g.moveTo(cx - w / 2, by); g.quadraticCurveTo(cx - w * 0.08, by - h * 1.95, cx + w / 2, by); g.closePath(); };
  g.fillStyle = 'rgba(8,12,18,0.14)';
  g.beginPath(); g.ellipse(cx + w * 0.14, by - 1, w * 0.56, h * 0.16, 0, 0, Math.PI * 2); g.fill();
  dome(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill();
  g.save(); g.beginPath(); g.rect(cx + w * 0.04, by - h * 1.3, w, h * 1.4); g.clip();
  dome(); g.fillStyle = 'rgba(16,20,28,0.36)'; g.fill(); g.restore();
  g.beginPath(); g.moveTo(cx - w / 2, by); g.quadraticCurveTo(cx - w * 0.08, by - h * 1.95, cx + w / 2, by);
  g.strokeStyle = INK + '0.5)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
  g.strokeStyle = INK + '0.26)'; g.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) { const x = cx + w * (0.12 + i * 0.1); g.beginPath(); g.moveTo(x, by - h * (0.62 - i * 0.16)); g.lineTo(x + w * 0.05, by - h * 0.12); g.stroke(); }
}

// Tepeden görülen küçük bir yerleşim: zemin, sokaklar, çatılar.
function town(g, seed, R, n, capital) {
  const rng = new RNG(seed), cx = 64, cy = 64;
  g.fillStyle = 'rgba(6,10,14,0.3)'; circle(g, cx + 2, cy + 4, R + 3); g.fill();
  circle(g, cx, cy, R); g.fillStyle = 'rgba(238,230,210,0.95)'; g.fill();
  g.save(); circle(g, cx, cy, R - 1); g.clip();
  g.strokeStyle = 'rgba(255,253,244,1)'; g.lineWidth = 4.5; g.lineCap = 'butt';
  const a0 = rng.range(0, Math.PI);
  for (let k = 0; k < 2; k++) { const a = a0 + (k * Math.PI) / 2 + rng.range(-0.15, 0.15); g.beginPath(); g.moveTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  const roofs = ['#c8785a', '#b5644a', '#d08f6a', '#7f8d98', '#94a1aa', '#a8553f'];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25), rad = R * (capital && i < 2 ? 0.2 : rng.range(0.34, 0.8));
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    const w = rng.range(10, 18), h = rng.range(7, 12), rot = a0 + (rng.chance(0.5) ? 0 : Math.PI / 2) + rng.range(-0.12, 0.12);
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 + 2, -h / 2 + 2.5, w, h);
    g.fillStyle = rng.pick(roofs); g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(-w / 2, -h / 2, w, h / 2);
    g.strokeStyle = 'rgba(30,26,24,0.7)'; g.lineWidth = 1.2; g.strokeRect(-w / 2, -h / 2, w, h);
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.strokeStyle = 'rgba(30,26,24,0.4)'; g.lineWidth = 1; g.stroke();
    g.restore();
  }
  g.restore();
  circle(g, cx, cy, R); g.strokeStyle = 'rgba(26,30,34,0.7)'; g.lineWidth = 2.2; g.stroke();
  if (capital) {
    circle(g, cx, cy, R + 6); g.strokeStyle = '#f2c14e'; g.lineWidth = 5; g.stroke();
    circle(g, cx, cy, R + 9); g.strokeStyle = 'rgba(26,30,34,0.75)'; g.lineWidth = 1.6; g.stroke();
    circle(g, cx, cy, 15); g.fillStyle = '#1b262c'; g.fill(); g.strokeStyle = '#f2c14e'; g.lineWidth = 2.5; g.stroke();
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.4 : 10.5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#f2c14e'; g.fill();
  }
}

// Yapı simgelerinin ortak zemini: koyu, köşeleri yuvarlak, tür renginde çerçeveli parsel.
function plot(g, edge, fill, dashed) {
  rr(g, 12, 16, 104, 104, 20); g.fillStyle = 'rgba(4,8,12,0.34)'; g.fill();
  rr(g, 12, 10, 104, 104, 20); g.fillStyle = fill || 'rgba(20,31,38,0.94)'; g.fill();
  if (dashed) g.setLineDash([10, 7]);
  g.strokeStyle = edge; g.lineWidth = 4.5; g.stroke(); g.setLineDash([]);
}
const ICONS = {
  civ(g) {
    plot(g, '#4fd1b8');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(29, 52, 74, 48);
    for (let i = 0; i < 5; i++) { const x = 26 + i * 14.8; g.fillStyle = '#2f7f76'; g.fillRect(x, 48, 9, 48); g.fillStyle = '#a9dcd4'; g.fillRect(x + 9, 48, 5.8, 48); }
    g.strokeStyle = '#0f1c1c'; g.lineWidth = 2.4; g.strokeRect(26, 48, 74, 48);
    circle(g, 92, 36, 11); g.fillStyle = '#7a6052'; g.fill(); g.strokeStyle = '#1e1613'; g.lineWidth = 2.2; g.stroke();
    circle(g, 92, 36, 5.5); g.fillStyle = '#1e1613'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; circle(g, 80, 28, 7.5); g.fill(); circle(g, 68, 22, 6); g.fill(); circle(g, 58, 19, 4.5); g.fill();
  },
  mil(g) {
    plot(g, '#f2b84b');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(27, 50, 80, 52);
    g.fillStyle = '#7c8a5c'; g.fillRect(24, 46, 80, 40);
    g.fillStyle = '#5d6a44'; for (let i = 1; i < 5; i++) g.fillRect(24 + i * 16 - 1, 46, 2, 40);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(24, 46, 80, 14);
    g.save(); g.beginPath(); g.rect(24, 86, 80, 12); g.clip();
    g.fillStyle = '#f2b84b'; g.fillRect(24, 86, 80, 12);
    g.strokeStyle = '#1a1a14'; g.lineWidth = 5;
    for (let x = 14; x < 120; x += 14) { g.beginPath(); g.moveTo(x, 100); g.lineTo(x + 12, 84); g.stroke(); }
    g.restore();
    g.strokeStyle = '#161a10'; g.lineWidth = 2.4; g.strokeRect(24, 46, 80, 52);
    for (const x of [38, 62]) { circle(g, x, 31, 10); g.fillStyle = '#9aa1a6'; g.fill(); g.strokeStyle = '#1c2023'; g.lineWidth = 2.2; g.stroke(); g.beginPath(); g.arc(x, 31, 6, Math.PI * 1.05, Math.PI * 1.6); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.2; g.stroke(); }
    g.fillStyle = '#f2b84b'; poly(g, [[86, 22], [98, 31], [86, 40]]); g.fill(); g.strokeStyle = '#1c2023'; g.lineWidth = 1.8; g.stroke();
  },
  dock(g) {
    plot(g, '#6aa5e8', '#1f4d61');
    rr(g, 40, 20, 48, 86, 5); g.fillStyle = '#3b88a6'; g.fill();
    g.fillStyle = '#8a6a4a'; g.fillRect(26, 22, 14, 84); g.fillRect(88, 22, 14, 84);
    g.strokeStyle = '#2a1e14'; g.lineWidth = 2; g.strokeRect(26, 22, 14, 84); g.strokeRect(88, 22, 14, 84);
    g.fillStyle = 'rgba(42,30,20,0.5)'; for (let y = 34; y < 104; y += 12) { g.fillRect(26, y, 14, 1.6); g.fillRect(88, y, 14, 1.6); }
    g.beginPath(); g.moveTo(64, 26); g.bezierCurveTo(78, 38, 80, 48, 80, 58); g.lineTo(80, 98); g.lineTo(48, 98); g.lineTo(48, 58); g.bezierCurveTo(48, 48, 50, 38, 64, 26); g.closePath();
    g.fillStyle = '#6f7b84'; g.fill(); g.strokeStyle = '#14191d'; g.lineWidth = 2.4; g.stroke();
    g.beginPath(); g.moveTo(64, 38); g.bezierCurveTo(72, 46, 73, 52, 73, 60); g.lineTo(73, 92); g.lineTo(55, 92); g.lineTo(55, 60); g.bezierCurveTo(55, 52, 56, 46, 64, 38); g.closePath();
    g.fillStyle = '#c4cbcf'; g.fill();
    g.fillStyle = '#f3f1e7'; g.fillRect(57, 68, 14, 14); g.strokeStyle = '#14191d'; g.lineWidth = 1.6; g.strokeRect(57, 68, 14, 14);
    g.strokeStyle = '#f2b84b'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(33, 44); g.lineTo(62, 56); g.stroke();
    circle(g, 33, 44, 4.5); g.fillStyle = '#f2b84b'; g.fill(); g.strokeStyle = '#2a1e14'; g.lineWidth = 1.5; g.stroke();
  },
  fort(g) {
    plot(g, '#c9c4b6');
    const cx = 64, cy = 64, star = [], pent = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 23 : 42; star.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5; pent.push([cx + Math.cos(a) * 17, cy + Math.sin(a) * 17]); }
    g.save(); g.translate(2.5, 3.5); poly(g, star); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fill(); g.restore();
    poly(g, star); g.fillStyle = '#a9a495'; g.fill(); g.strokeStyle = '#24241f'; g.lineWidth = 2.6; g.lineJoin = 'round'; g.stroke();
    g.save(); poly(g, star); g.clip(); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, 64, 128); g.restore();
    poly(g, pent); g.fillStyle = '#6a665c'; g.fill(); g.strokeStyle = '#24241f'; g.lineWidth = 2; g.stroke();
    circle(g, cx, cy, 5); g.fillStyle = '#24241f'; g.fill();
  },
  port(g) {
    plot(g, '#6aa5e8', '#1f4d61');
    g.strokeStyle = 'rgba(120,190,215,0.55)'; g.lineWidth = 2.4; g.lineCap = 'round';
    for (const y of [94, 104]) { g.beginPath(); g.moveTo(24, y); g.quadraticCurveTo(34, y - 6, 44, y); g.quadraticCurveTo(54, y + 6, 64, y); g.quadraticCurveTo(74, y - 6, 84, y); g.quadraticCurveTo(94, y + 6, 104, y); g.stroke(); }
    const draw = (col, lw) => {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      circle(g, 64, 30, 8); g.stroke();
      g.beginPath(); g.moveTo(64, 38); g.lineTo(64, 90); g.moveTo(47, 50); g.lineTo(81, 50); g.stroke();
      g.beginPath(); g.arc(64, 62, 28, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
      g.beginPath(); g.moveTo(90, 56); g.lineTo(91, 68); g.lineTo(80, 66); g.moveTo(38, 56); g.lineTo(37, 68); g.lineTo(48, 66); g.stroke();
    };
    draw('rgba(8,18,24,0.85)', 11); draw('#f3f1e7', 6.5);
  },
  crane(g) {
    plot(g, '#f2b84b', 'rgba(20,31,38,0.8)', true);
    g.strokeStyle = '#f2b84b'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 6; g.beginPath(); g.moveTo(46, 100); g.lineTo(46, 30); g.moveTo(30, 100); g.lineTo(70, 100); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(28, 36); g.lineTo(100, 36); g.stroke();
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(46, 22); g.lineTo(28, 36); g.moveTo(46, 22); g.lineTo(96, 36); g.moveTo(88, 36); g.lineTo(88, 62); g.stroke();
    g.fillStyle = '#e9dfc8'; g.fillRect(79, 62, 18, 14); g.strokeStyle = '#1a1a14'; g.lineWidth = 2; g.strokeRect(79, 62, 18, 14);
  },
};

function drawAtlas(cv) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const cell = (i, fn) => { g.save(); g.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL); g.beginPath(); g.rect(0, 0, CELL, CELL); g.clip(); fn(g); g.restore(); };
  cell(C.peak1, (c) => { peak(c, 40, 114, 46, 54, false); peak(c, 70, 118, 84, 98, true); });
  cell(C.peak2, (c) => { peak(c, 88, 112, 56, 66, true); peak(c, 46, 118, 68, 86, true); });
  cell(C.peak3, (c) => { peak(c, 30, 112, 44, 48, false); peak(c, 98, 114, 48, 56, false); peak(c, 64, 118, 70, 82, true); });
  cell(C.hill1, (c) => { hill(c, 82, 112, 60, 30); hill(c, 50, 118, 76, 42); });
  cell(C.hill2, (c) => { hill(c, 64, 116, 92, 46); });
  cell(C.city1, (c) => town(c, 11, 30, 7, false));
  cell(C.city2, (c) => town(c, 23, 40, 12, false));
  cell(C.city3, (c) => town(c, 37, 50, 18, false));
  cell(C.capital, (c) => town(c, 51, 44, 15, true));
  for (const k of ['civ', 'mil', 'dock', 'fort', 'port', 'crane']) cell(C[k], ICONS[k]);
  for (let d = 0; d < 10; d++) cell(C.d0 + d, (c) => {
    c.font = '800 112px "Big Shoulders Display", "Arial Narrow", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(8,14,18,0.95)'; c.lineWidth = 16; c.strokeText(String(d), 64, 70);
    c.fillStyle = '#ffffff'; c.fillText(String(d), 64, 70);
  });
}

const VERT = `attribute vec2 aCell; varying vec2 vUv;
void main() { vUv = (aCell + uv) / ${COLS}.0; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform sampler2D tAtlas; uniform float uOpacity; varying vec2 vUv;
void main() { gl_FragColor = texture2D(tAtlas, vUv) * uOpacity; }`;

export function citySize(P) {
  const k = P.capitalOf !== undefined ? 1.15 : P.vp >= 7 ? 1 : P.vp >= 4 ? 0.85 : 0.7;
  return clamp(Math.sqrt(P.area) * 0.27, 3.4, 11) * k;
}

export class DecalLayer {
  constructor(map, world) {
    this.map = map; this.world = world;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = CELL * COLS;
    drawAtlas(this.canvas);
    const tex = this.tex = new THREE.CanvasTexture(this.canvas);
    tex.premultiplyAlpha = true; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
    this.terrain = this.makeMesh(9000, 1);
    this.cities = this.makeMesh(world.NL, 4);
    this.builds = this.makeMesh(world.NL * 10, 4);
    this.buildTerrain();
    this.buildCities();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawAtlas(this.canvas); tex.needsUpdate = true; });
  }

  makeMesh(capacity, order) {
    const geo = new THREE.BufferGeometry();
    // dörtgenin dayanak noktası alt kenarın ortasıdır; kuzeye doğru uzanır
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, -1, 0.5, 0, -1, -0.5, 0, 0, 0.5, 0, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2));
    const mat = new THREE.ShaderMaterial({ uniforms: { tAtlas: { value: this.tex }, uOpacity: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = order;
    mesh.userData.cap = capacity; mesh.userData.m = new THREE.Matrix4();
    this.map.scene.add(mesh);
    return mesh;
  }
  // (x, z): dörtgenin alt-orta noktası
  put(mesh, i, cell, x, z, s, y) {
    if (i >= mesh.userData.cap) return i;
    const m = mesh.userData.m;
    m.makeScale(s, 1, s); m.setPosition(x, y, z);
    mesh.setMatrixAt(i, m);
    mesh.geometry.attributes.aCell.setXY(i, cell % COLS, COLS - 1 - Math.floor(cell / COLS));
    return i + 1;
  }
  commit(mesh, n) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.geometry.attributes.aCell.needsUpdate = true; }

  // Dağ ve tepe çizimleri: yükselti alanına göre serpiştirilir, kuzeyden güneye sıralanır.
  buildTerrain() {
    const W = this.world, rng = new RNG(W.seed + ':relief');
    const items = [];
    const STEP = 6.5;
    for (let gy = 4; gy < MAP_H - 2; gy += STEP) for (let gx = 4; gx < MAP_W - 2; gx += STEP) {
      const x = gx + rng.range(-2.6, 2.6), z = gy + rng.range(-2.6, 2.6), r = rng.next(), v = rng.next();
      if (x < 1 || z < 1 || x >= MAP_W - 1 || z >= MAP_H - 1) continue;
      const h = elevAt(W, x, z);
      if (h < 0.11 || W.raster[(z | 0) * MAP_W + (x | 0)] >= W.NL) continue;
      if (h >= 0.3) { if (r < 0.62) items.push([x, z, 8.5 + Math.min(1, (h - 0.3) / 0.45) * 9 + v * 2.5, v < 0.4 ? C.peak1 : v < 0.75 ? C.peak2 : C.peak3]); }
      else if (r < 0.2 + (h - 0.11) * 1.4) items.push([x, z, 6.5 + v * 3.5, v < 0.5 ? C.hill1 : C.hill2]);
    }
    items.sort((a, b) => a[1] - b[1]);
    let n = 0;
    for (const it of items) n = this.put(this.terrain, n, it[3], it[0], it[1] + it[2] * 0.3, it[2], 0.05);
    this.commit(this.terrain, n);
    this.reliefCount = n;
  }

  buildCities() {
    const W = this.world;
    let n = 0;
    for (let p = 0; p < W.NL; p++) {
      const P = W.prov[p], cap = P.capitalOf !== undefined;
      if (!P.city || (!cap && P.vp < 2)) continue;
      const s = citySize(P);
      n = this.put(this.cities, n, cap ? C.capital : P.vp >= 7 ? C.city3 : P.vp >= 4 ? C.city2 : C.city1, P.cx, P.cy + s / 2, s, 0.08);
    }
    this.commit(this.cities, n);
  }

  // Eyaletlerdeki yapılar: simge + adet. Oyuncunun kuyruğundaki inşaatlar vinçle gösterilir.
  rebuildBuildings(G) {
    const S = G.S, W = this.world, mesh = this.builds;
    const queued = new Set();
    const me = S.player >= 0 && !S.observer ? S.C[S.player] : null;
    if (me) for (const b of me.build) queued.add(b.prov);
    let n = 0;
    const row = [];
    for (let p = 0; p < W.NL; p++) {
      row.length = 0;
      if (S.civ[p] > 0) row.push(C.civ, S.civ[p]);
      if (S.mil[p] > 0) row.push(C.mil, S.mil[p]);
      if (S.dock[p] > 0) row.push(C.dock, S.dock[p]);
      if (S.fort[p] > 0) row.push(C.fort, S.fort[p]);
      if (S.port[p] > 0) row.push(C.port, 1);
      if (queued.has(p)) row.push(C.crane, 1);
      if (!row.length) continue;
      const P = W.prov[p], k = row.length / 2;
      const u = clamp(Math.sqrt(P.area) * 0.15, 2.2, 5.4);
      const hasCity = P.city && (P.capitalOf !== undefined || P.vp >= 2);
      const top = P.cy + (hasCity ? citySize(P) / 2 + u * 0.22 : -u * 0.5);
      for (let i = 0; i < k; i++) {
        const x = P.cx + (i - (k - 1) / 2) * u * 1.06, cnt = row[i * 2 + 1];
        n = this.put(mesh, n, row[i * 2], x, top + u, u, 0.1);
        if (cnt > 1) {
          const str = String(Math.min(99, cnt)), d = u * 0.54;
          for (let j = 0; j < str.length; j++) n = this.put(mesh, n, C.d0 + +str[j], x + u * 0.36 + (j - (str.length - 1)) * d * 0.4, top + u + d * 0.2, d, 0.12);
        }
      }
    }
    this.commit(mesh, n);
  }

  update() {
    const dist = this.map.cam.dist, ter = this.map.mode === 'ter';
    this.terrain.material.uniforms.uOpacity.value = ter ? 1 : 0.92;
    const co = clamp((1500 - dist) / 350, 0, 1);
    this.cities.visible = co > 0.01; this.cities.material.uniforms.uOpacity.value = co;
    const bo = clamp((640 - dist) / 160, 0, 1);
    this.builds.visible = bo > 0.01; this.builds.material.uniforms.uOpacity.value = bo;
  }
}
