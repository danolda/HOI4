// 3B harita: arazi ağı, eyalet gölgelendiricisi, kamera ve seçim.
import THREE from '../three.js';
import { MAP_W, MAP_H, HW, HH, HS, HEIGHT_SCALE, heightAt } from '../worldgen.js';
import { TERRAIN, IDEOLOGY } from '../data.js';
import { atWar, isFriend } from '../sim/core.js';
import { clamp } from '../rng.js';

const PALW = 1024;
const FOV = 38;
export const MIN_DIST = 70, MAX_DIST = 2500;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vWorld = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tProv;
uniform sampler2D tPal;
uniform sampler2D tHeight;
uniform vec2 uSize;
uniform vec2 uHSize;
uniform float uPalW;
uniform float uTime;
uniform float uSel;
uniform float uHov;
uniform float uProvLines;
uniform float uTerrainMode;
varying vec2 vUv;
varying vec3 vWorld;

float pid(vec2 texel) {
  vec4 t = texture2D(tProv, (texel + 0.5) / uSize);
  return floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) * 256.0;
}
vec4 pal(float id, float row) { return texture2D(tPal, vec2((id + 0.5) / uPalW, (row + 0.5) / 4.0)); }
float same(float a, float b) { return step(abs(a - b), 0.5); }
float sameK(float a, float b) { return step(abs(a - b), 0.002); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  // 3x3 ikinci derece B-spline ile yumuşatılmış eyalet örneklemesi
  vec2 q = vUv * uSize - 0.5;
  vec2 c = floor(q + 0.5);
  vec2 t = q - c;
  vec3 wx = vec3(0.5 * (0.5 - t.x) * (0.5 - t.x), 0.75 - t.x * t.x, 0.5 * (0.5 + t.x) * (0.5 + t.x));
  vec3 wy = vec3(0.5 * (0.5 - t.y) * (0.5 - t.y), 0.75 - t.y * t.y, 0.5 * (0.5 + t.y) * (0.5 + t.y));
  vec3 ex = vec3(t.x - 0.5, -2.0 * t.x, t.x + 0.5);
  vec3 ey = vec3(t.y - 0.5, -2.0 * t.y, t.y + 0.5);
  float hi = pid(c);
  vec4 hc = pal(hi, 0.0);
  float hk = hc.a;
  vec3 fillRgb = vec3(0.0);
  float land = 0.0, sameP = 0.0, sameC = 0.0, selW = 0.0, hovW = 0.0;
  vec2 gP = vec2(0.0), gC = vec2(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      float w = wx[i] * wy[j];
      vec2 gw = vec2(ex[i] * wy[j], wx[i] * ey[j]);
      float id = pid(c + vec2(float(i - 1), float(j - 1)));
      vec4 pc = pal(id, 0.0);
      float sp = same(id, hi), sc = sameK(pc.a, hk);
      fillRgb += pc.rgb * w;
      land += w * (1.0 - step(0.99, pc.a));
      sameP += w * sp; gP += gw * sp;
      sameC += w * sc; gC += gw * sc;
      selW += w * same(id, uSel);
      hovW += w * same(id, uHov);
    }
  }
  vec4 fill = vec4(fillRgb, land);
  // sınıra piksel cinsinden uzaklık (analitik gradyanla; basamaklanma olmaz)
  float pxPerTexel = 1.0 / max(0.7071 * length(fwidth(q)), 0.00001);
  float dP = abs(sameP - 0.5) / max(length(gP), 0.0001) * pxPerTexel;
  float dC = abs(sameC - 0.5) / max(length(gC), 0.0001) * pxPerTexel;
  float dL = abs(land - 0.5) / max(fwidth(land), 0.0001);
  float lineP = (1.0 - smoothstep(0.3, 1.0, dP)) * uProvLines;
  float lineC = 1.0 - smoothstep(0.8, 1.9, dC);
  float coast = 1.0 - smoothstep(0.6, 1.9, dL);

  // ülke sınırı boyunca iç gölge bandı: yakın yumuşak bant + noktalı geniş bant
  vec2 jit = vec2(hash(gl_FragCoord.xy), hash(gl_FragCoord.yx + 19.0)) * 2.0 - 1.0;
  vec2 cj = floor(q + 0.5 + jit * 1.2);
  float diff = 0.0;
  diff += 1.0 - sameK(pal(pid(cj + vec2(3.0, 0.0)), 0.0).a, hk);
  diff += 1.0 - sameK(pal(pid(cj + vec2(-3.0, 0.0)), 0.0).a, hk);
  diff += 1.0 - sameK(pal(pid(cj + vec2(1.0, 3.0)), 0.0).a, hk);
  diff += 1.0 - sameK(pal(pid(cj + vec2(-1.0, -3.0)), 0.0).a, hk);
  diff += 0.7 * (1.0 - sameK(pal(pid(cj + vec2(4.0, -4.0)), 0.0).a, hk));
  diff += 0.7 * (1.0 - sameK(pal(pid(cj + vec2(-4.0, 4.0)), 0.0).a, hk));
  float band = clamp(diff / 2.6, 0.0, 1.0) * 0.55 + (1.0 - smoothstep(0.5, 1.0, sameC)) * 0.5;

  // yükseklik ve kabartma
  float h = texture2D(tHeight, vUv).r;
  vec2 e = 1.0 / uHSize;
  float hx = texture2D(tHeight, vUv + vec2(e.x, 0.0)).r - texture2D(tHeight, vUv - vec2(e.x, 0.0)).r;
  float hy = texture2D(tHeight, vUv + vec2(0.0, e.y)).r - texture2D(tHeight, vUv - vec2(0.0, e.y)).r;
  float hl = max(h, 0.0);
  vec3 n = normalize(vec3(-hx * 7.5 * step(0.0, h), 1.0, -hy * 7.5 * step(0.0, h)));
  float shade = dot(n, normalize(vec3(-0.55, 0.75, -0.42)));
  shade = 0.62 + 0.52 * smoothstep(0.25, 1.0, shade);

  // kara
  vec3 paper = vec3(0.87, 0.85, 0.77);
  vec3 lcol = mix(paper, fill.rgb, mix(0.8, 0.92, uTerrainMode));
  vec3 rock = vec3(0.74, 0.72, 0.68);
  lcol = mix(lcol, mix(lcol, rock, 0.36), smoothstep(0.3, 0.85, hl));
  lcol = mix(lcol, lcol * vec3(0.66, 0.64, 0.66), band * 0.75);
  lcol *= shade;
  float grain = hash(floor(vWorld.xz * 1.5)) - 0.5;
  lcol += grain * 0.018;
  float cv = hl * 16.0;
  float cl = abs(fract(cv) - 0.5) / max(fwidth(cv), 0.0001);
  lcol *= 1.0 - 0.13 * (1.0 - smoothstep(0.0, 1.3, cl)) * step(0.04, hl);
  // işgal taraması
  float occ = step(0.5, pal(hi, 1.0).b);
  vec3 ocol = pal(hi, 2.0).rgb;
  float stripe = smoothstep(0.42, 0.5, abs(fract((vWorld.x + vWorld.z) / 9.0) - 0.5));
  lcol = mix(lcol, mix(paper, ocol, 0.8) * shade, stripe * occ * 0.6);
  lcol = mix(lcol, vec3(0.1, 0.11, 0.12), lineP * 0.42);
  lcol = mix(lcol, vec3(0.07, 0.07, 0.09), lineC * 0.88);
  // vurgu (inşaat yerleşimi vb.)
  float glow = pal(hi, 2.0).a;
  lcol = mix(lcol, vec3(0.45, 0.95, 0.75), glow * (0.22 + 0.12 * sin(uTime * 3.2)));

  // deniz
  float depth = clamp(-h, 0.0, 1.0);
  vec3 deep = vec3(0.075, 0.155, 0.205), shallow = vec3(0.19, 0.37, 0.42);
  vec3 scol = mix(shallow, deep, smoothstep(0.0, 0.75, depth));
  float bv = depth * 7.0 + 0.04 * sin(vWorld.x * 0.05 + uTime * 0.6) + 0.04 * sin(vWorld.z * 0.06 - uTime * 0.45);
  float bl = abs(fract(bv) - 0.5) / max(fwidth(bv), 0.0001);
  scol += 0.03 * (1.0 - smoothstep(0.0, 1.4, bl));
  scol += 0.06 * (1.0 - smoothstep(0.0, 0.16, depth)) * (0.6 + 0.4 * sin(uTime * 1.3 + vWorld.x * 0.09 + vWorld.z * 0.07));
  scol = mix(scol, scol * 1.35 + 0.02, lineP * 0.3);
  vec3 tint = fill.rgb;
  scol = mix(scol, tint, uTerrainMode * 0.0);

  vec3 col = mix(scol, lcol, smoothstep(0.42, 0.58, land));
  col = mix(col, vec3(0.05, 0.08, 0.1), coast * 0.8);

  // ızgara
  vec2 gq = vWorld.xz / 128.0;
  vec2 gd = abs(fract(gq - 0.5) - 0.5) / max(fwidth(gq), vec2(0.0001));
  col = mix(col, vec3(0.8, 0.9, 0.9), (1.0 - min(min(gd.x, gd.y), 1.0)) * 0.05);

  // seçim ve imleç
  float dS = abs(selW - 0.5) / max(fwidth(selW), 0.0001);
  col = mix(col, col + 0.1, smoothstep(0.45, 0.55, selW));
  col = mix(col, vec3(1.0, 0.97, 0.82), (1.0 - smoothstep(0.8, 2.4, dS)) * step(0.0, uSel));
  col = mix(col, col + 0.055, smoothstep(0.45, 0.55, hovW));

  float ed = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  col *= 0.55 + 0.45 * smoothstep(0.0, 0.035, ed);
  gl_FragColor = vec4(col, 1.0);
}`;

export const MAP_MODES = [
  { id: 'pol', name: 'Siyasi' },
  { id: 'ter', name: 'Arazi' },
  { id: 'dip', name: 'Diplomasi' },
  { id: 'ind', name: 'Sanayi' },
  { id: 'ideo', name: 'İdeoloji' },
];

function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export class MapView {
  constructor(canvas, world) {
    this.world = world;
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(0x0a1318, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 5, 6000);
    this.cam = { tx: MAP_W * 0.52, tz: MAP_H * 0.3, dist: 900, yaw: 0, goalDist: 900, anchor: null };
    this.mode = 'pol';
    this.sel = -1; this.hov = -1;
    this.highlight = null;
    this.time = 0;
    this._v = new THREE.Vector3();
    this._ray = new THREE.Raycaster();

    this.buildTextures();
    this.buildTerrain();
    const amb = new THREE.AmbientLight(0xffffff, 0.62);
    const sun = new THREE.DirectionalLight(0xfff2dd, 0.75);
    sun.position.set(-0.55, 0.75, -0.42);
    this.scene.add(amb, sun);
    this.resize();
  }

  buildTextures() {
    const W = this.world;
    const data = new Uint8Array(MAP_W * MAP_H * 4);
    const ras = W.raster;
    for (let i = 0, n = MAP_W * MAP_H; i < n; i++) { const v = ras[i]; data[i * 4] = v & 255; data[i * 4 + 1] = v >> 8; data[i * 4 + 3] = 255; }
    const tProv = new THREE.DataTexture(data, MAP_W, MAP_H, THREE.RGBAFormat, THREE.UnsignedByteType);
    tProv.minFilter = tProv.magFilter = THREE.NearestFilter; tProv.generateMipmaps = false; tProv.needsUpdate = true;
    this.tProv = tProv;

    const hd = new Uint16Array(HW * HH);
    const toHalf = THREE.DataUtils.toHalfFloat;
    for (let i = 0; i < HW * HH; i++) hd[i] = toHalf(W.height[i]);
    const tH = new THREE.DataTexture(hd, HW, HH, THREE.RedFormat, THREE.HalfFloatType);
    tH.minFilter = tH.magFilter = THREE.LinearFilter; tH.generateMipmaps = false; tH.needsUpdate = true;
    tH.wrapS = tH.wrapT = THREE.ClampToEdgeWrapping;
    this.tHeight = tH;

    this.palData = new Uint8Array(PALW * 4 * 4);
    const tPal = new THREE.DataTexture(this.palData, PALW, 4, THREE.RGBAFormat, THREE.UnsignedByteType);
    tPal.minFilter = tPal.magFilter = THREE.NearestFilter; tPal.generateMipmaps = false; tPal.needsUpdate = true;
    this.tPal = tPal;
  }

  buildTerrain() {
    const W = this.world;
    const GX = 512, GZ = 256;
    const pos = new Float32Array((GX + 1) * (GZ + 1) * 3), uv = new Float32Array((GX + 1) * (GZ + 1) * 2);
    let k = 0, u = 0;
    for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) {
      const x = (i / GX) * MAP_W, z = (j / GZ) * MAP_H;
      pos[k++] = x; pos[k++] = heightAt(W, x, z); pos[k++] = z;
      uv[u++] = i / GX; uv[u++] = j / GZ;
    }
    const idx = new Uint32Array(GX * GZ * 6);
    let t = 0;
    for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
      const a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.uniforms = {
      tProv: { value: this.tProv }, tPal: { value: this.tPal }, tHeight: { value: this.tHeight },
      uSize: { value: new THREE.Vector2(MAP_W, MAP_H) }, uHSize: { value: new THREE.Vector2(HW, HH) },
      uPalW: { value: PALW }, uTime: { value: 0 }, uSel: { value: -1 }, uHov: { value: -1 },
      uProvLines: { value: 1 }, uTerrainMode: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, extensions: { derivatives: true } });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    // haritanın altındaki karanlık zemin
    const under = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * 6, MAP_H * 6), new THREE.MeshBasicMaterial({ color: 0x0a1318 }));
    under.rotation.x = -Math.PI / 2; under.position.set(MAP_W / 2, -2, MAP_H / 2);
    this.scene.add(under);
  }

  // ---- palet (harita kipine göre eyalet renkleri)
  updatePalette(G) {
    const W = this.world, pd = this.palData, NL = W.NL;
    const S = G ? G.S : null;
    const me = S ? S.player : -1;
    const row = (r, id) => (r * PALW + id) * 4;
    let maxInd = 1;
    if (S && this.mode === 'ind') for (let p = 0; p < NL; p++) maxInd = Math.max(maxInd, S.civ[p] + S.mil[p] + S.dock[p]);
    for (let p = 0; p < W.NP; p++) {
      const P = W.prov[p];
      const o0 = row(0, p), o1 = row(1, p), o2 = row(2, p);
      if (!P.land) {
        pd[o0] = 30; pd[o0 + 1] = 62; pd[o0 + 2] = 78; pd[o0 + 3] = 255;
        pd[o1] = 255; pd[o1 + 1] = 0; pd[o1 + 2] = 0; pd[o1 + 3] = 0;
        pd[o2] = 0; pd[o2 + 1] = 0; pd[o2 + 2] = 0; pd[o2 + 3] = 0;
        continue;
      }
      const k = S ? S.ctrl[p] : P.core, o = S ? S.owner[p] : P.core;
      let c = W.nations[k].color;
      const oc = W.nations[o].color;
      if (this.mode === 'ter') c = TERRAIN[P.terrain].color;
      else if (this.mode === 'ideo') c = hexRgb(IDEOLOGY[S ? S.C[k].ideo : W.nations[k].ideo].color);
      else if (this.mode === 'dip' && S) {
        c = k === me ? [92, 186, 160] : atWar(S, me, k) ? [196, 84, 74] : isFriend(S, me, k) ? [92, 140, 200]
          : S.C[me].pacts.some((x) => x.w === k) ? [200, 184, 110] : [150, 150, 142];
      } else if (this.mode === 'ind' && S) {
        const t = Math.sqrt((S.civ[p] + S.mil[p] + S.dock[p]) / maxInd);
        c = [Math.round(70 + 170 * t), Math.round(84 + 100 * t), Math.round(96 - 40 * t)];
      }
      pd[o0] = c[0]; pd[o0 + 1] = c[1]; pd[o0 + 2] = c[2]; pd[o0 + 3] = k;
      pd[o1] = k; pd[o1 + 1] = 0; pd[o1 + 2] = k !== o && this.mode === 'pol' ? 255 : 0; pd[o1 + 3] = 255;
      pd[o2] = oc[0]; pd[o2 + 1] = oc[1]; pd[o2 + 2] = oc[2];
      pd[o2 + 3] = this.highlight && this.highlight[p] ? 255 : 0;
    }
    this.uniforms.uTerrainMode.value = this.mode === 'ter' ? 1 : 0;
    this.tPal.needsUpdate = true;
  }
  setMode(mode, G) { this.mode = mode; this.updatePalette(G); }
  setHighlight(arr, G) { this.highlight = arr; this.updatePalette(G); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  // ---- kamera
  pitch() { return THREE.MathUtils.degToRad(50 + 30 * Math.pow(clamp((this.cam.dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1), 0.7)); }
  placeCamera() {
    const c = this.cam, pt = this.pitch();
    this.camera.position.set(c.tx + c.dist * Math.cos(pt) * Math.sin(c.yaw), c.dist * Math.sin(pt), c.tz + c.dist * Math.cos(pt) * Math.cos(c.yaw));
    this.camera.lookAt(c.tx, 0, c.tz);
    this.camera.updateMatrixWorld();
  }
  clampTarget() {
    const c = this.cam;
    c.tx = clamp(c.tx, 0, MAP_W); c.tz = clamp(c.tz, 0, MAP_H);
  }
  groundAt(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    const o = this._ray.ray.origin, d = this._ray.ray.direction;
    if (d.y >= -1e-4) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t, z: o.z + d.z * t, o, d, t };
  }
  pick(cx, cy) {
    const g = this.groundAt(cx, cy);
    if (!g) return null;
    const { o, d } = g;
    // yükseklik alanına karşı ışın yürütme
    const t0 = (HEIGHT_SCALE - o.y) / d.y, t1 = g.t;
    let ta = Math.max(0, t0), found = t1;
    const steps = 28;
    for (let i = 1; i <= steps; i++) {
      const t = ta + ((t1 - ta) * i) / steps;
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= heightAt(this.world, x, z)) {
        let lo = ta + ((t1 - ta) * (i - 1)) / steps, hi = t;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m <= heightAt(this.world, o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; }
        found = hi; break;
      }
    }
    const x = o.x + d.x * found, z = o.z + d.z * found;
    if (x < 0 || z < 0 || x >= MAP_W || z >= MAP_H) return { x, z, prov: -1 };
    return { x, z, prov: this.world.raster[(z | 0) * MAP_W + (x | 0)] };
  }
  panPixels(x0, y0, x1, y1) {
    const a = this.groundAt(x0, y0), b = this.groundAt(x1, y1);
    if (!a || !b) return;
    this.cam.tx += a.x - b.x; this.cam.tz += a.z - b.z;
    this.clampTarget(); this.placeCamera();
  }
  panKeys(dx, dz, dt) {
    const c = this.cam, sp = c.dist * 0.9 * dt;
    const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    c.tx += (dx * cs + dz * sn) * sp; c.tz += (-dx * sn + dz * cs) * sp;
    this.clampTarget();
  }
  zoomBy(factor, cx, cy) {
    const c = this.cam;
    c.goalDist = clamp(c.goalDist * factor, MIN_DIST, MAX_DIST);
    if (cx !== undefined) { const g = this.groundAt(cx, cy); c.anchor = g ? { cx, cy, x: g.x, z: g.z } : null; } else c.anchor = null;
  }
  rotateBy(a) { this.cam.yaw = clamp(this.cam.yaw + a, -1.2, 1.2); }
  focus(x, z, dist) {
    const c = this.cam;
    c.tx = x; c.tz = z; c.anchor = null;
    if (dist) { c.goalDist = clamp(dist, MIN_DIST, MAX_DIST); }
    this.clampTarget(); this.placeCamera();
  }
  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, behind: v.z > 1 };
  }
  // sabit piksel yüksekliği için sprite ölçeği (sizeAttenuation: false)
  pxScale(px) { return (px / this.h) * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); }

  update(dt) {
    const c = this.cam;
    this.time += dt;
    if (Math.abs(c.dist - c.goalDist) > 0.5) {
      c.dist += (c.goalDist - c.dist) * Math.min(1, dt * 12);
      this.placeCamera();
      if (c.anchor) {
        const g = this.groundAt(c.anchor.cx, c.anchor.cy);
        if (g) { c.tx += c.anchor.x - g.x; c.tz += c.anchor.z - g.z; this.clampTarget(); }
      }
    } else c.anchor = null;
    this.placeCamera();
    const u = this.uniforms;
    u.uTime.value = this.time; u.uSel.value = this.sel; u.uHov.value = this.hov;
    u.uProvLines.value = this.mode === 'ter' ? 0.5 * (1 - clamp((c.dist - 300) / 500, 0, 1)) : 1 - clamp((c.dist - 420) / 520, 0, 0.9);
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
