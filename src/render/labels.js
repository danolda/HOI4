// Şehir modelleri, şehir adları ve ülke adları.
import THREE from '../three.js';
import { heightAt } from '../worldgen.js';
import { RNG, clamp } from '../rng.js';

function textSprite(text, opts) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = `${opts.weight || 600} ${opts.size}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 16;
  cv.width = w * 2; cv.height = (opts.size + 12) * 2;
  g.scale(2, 2);
  g.font = font; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = 'rgba(10,18,22,0.85)'; g.lineJoin = 'round';
  g.strokeText(text, 8, (opts.size + 12) / 2);
  g.fillStyle = opts.color || '#f2efe2';
  g.fillText(text, 8, (opts.size + 12) / 2);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
  sp.userData.aspect = cv.width / cv.height;
  sp.userData.px = opts.size + 12;
  return sp;
}

export class LabelLayer {
  constructor(map, world) {
    this.map = map; this.world = world;
    this.group = new THREE.Group();
    map.scene.add(this.group);
    this.cityLabels = [];
    this.countryLabels = new Map();
    this.buildCities();
    this.buildCityLabels();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this.buildCityLabels(); this.fontsReady = true; this.dirty = true; });
  }

  buildCities() {
    const W = this.world;
    const rng = new RNG(W.seed + ':cities');
    const items = [];
    for (let p = 0; p < W.NL; p++) {
      const P = W.prov[p];
      if (!P.city || P.vp < 2) continue;
      const n = Math.min(10, 2 + Math.floor(P.vp / 3));
      const k = Math.min(1, Math.sqrt(P.area) / 46); // küçük eyalette küçük şehir
      for (let i = 0; i < n; i++) {
        const a = rng.next() * Math.PI * 2, r = (i === 0 ? 0 : 2 + rng.next() * 7) * k * (P.vp >= 20 ? 1.3 : 1);
        const x = P.cx + Math.cos(a) * r, z = P.cy + Math.sin(a) * r + 5 * k;
        const tall = i === 0 && P.vp >= 20;
        items.push({ x, z, w: (1.4 + rng.next() * 1.8) * k, d: (1.4 + rng.next() * 1.8) * k, h: (tall ? 7 + rng.next() * 2 : 1.3 + rng.next() * (1.6 + P.vp * 0.14)) * k, rot: rng.next() * Math.PI, shade: rng.next() });
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    items.forEach((it, i) => {
      v.set(it.x, heightAt(W, it.x, it.z) - 0.1, it.z); q.setFromAxisAngle(up, it.rot); s.set(it.w, it.h, it.d);
      m.compose(v, q, s); mesh.setMatrixAt(i, m);
      col.setRGB(0.8 + it.shade * 0.14, 0.76 + it.shade * 0.14, 0.66 + it.shade * 0.12); mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    this.cityMesh = mesh;
  }

  buildCityLabels() {
    const W = this.world;
    for (const sp of this.cityLabels) { this.group.remove(sp); sp.material.map.dispose(); sp.material.dispose(); }
    this.cityLabels = [];
    for (let p = 0; p < W.NL; p++) {
      const P = W.prov[p];
      const cap = P.capitalOf !== undefined;
      if (!P.city || (!cap && P.vp < 3)) continue;
      const sp = textSprite((cap ? '★ ' : '') + P.name, { size: cap ? 16 : 13, weight: cap ? 700 : 600, color: cap ? '#fff3c4' : '#f2efe2' });
      sp.center.set(0.5, 1);
      const off = Math.min(12, Math.sqrt(P.area) / 4);
      sp.position.set(P.cx, heightAt(W, P.cx, P.cy + off) + 1, P.cy + off);
      sp.renderOrder = 6;
      sp.userData.cap = cap;
      this.group.add(sp); this.cityLabels.push(sp);
    }
  }

  // Ülke adlarını toprakların en büyük parçası üzerine yatır.
  rebuildCountryLabels(G) {
    const S = G.S, W = this.world, P = W.prov, NL = W.NL;
    const seen = new Uint8Array(NL);
    const picks = [];
    const main = new Map();
    for (let p = 0; p < NL; p++) {
      if (seen[p]) continue;
      const k = S.ctrl[p];
      const comp = [p]; seen[p] = 1;
      let area = 0, hasCap = false;
      for (let h = 0; h < comp.length; h++) { const u = comp[h]; area += P[u].area; if (u === S.C[k].capital) hasCap = true; for (const v of P[u].nb) if (v < NL && !seen[v] && S.ctrl[v] === k) { seen[v] = 1; comp.push(v); } }
      const item = { k, comp, area, hasCap, key: k + ':' + p };
      if (hasCap) main.set(k, item); else if (area >= 16000) picks.push(item);
      else if (!main.has(k) && (!item.alt || area > item.alt)) { const cur = main.get('alt' + k); if (!cur || area > cur.area) main.set('alt' + k, item); }
    }
    for (const [key, item] of main) { if (typeof key === 'number') picks.push(item); else if (!main.has(item.k) && item.area >= 600) picks.push(item); }
    const alive = new Set();
    for (const b of picks) {
      const k = b.k;
      let sx = 0, sz = 0, sw = 0;
      for (const u of b.comp) { sx += P[u].cx * P[u].area; sz += P[u].cy * P[u].area; sw += P[u].area; }
      const cx = sx / sw, cz = sz / sw;
      let cxx = 0, czz = 0, cxz = 0;
      for (const u of b.comp) { const dx = P[u].cx - cx, dz = P[u].cy - cz, w = P[u].area; cxx += dx * dx * w; czz += dz * dz * w; cxz += dx * dz * w; }
      let th = b.comp.length > 1 ? 0.5 * Math.atan2(2 * cxz, cxx - czz) : 0;
      th = clamp(th, -0.6, 0.6);
      const ax = Math.cos(th), az = Math.sin(th);
      let mn = 1e9, mx = -1e9, pmn = 1e9, pmx = -1e9;
      for (const u of b.comp) { const dx = P[u].cx - cx, dz = P[u].cy - cz, r = Math.sqrt(P[u].area) * 0.5; const a = dx * ax + dz * az, c = -dx * az + dz * ax; mn = Math.min(mn, a - r); mx = Math.max(mx, a + r); pmn = Math.min(pmn, c - r); pmx = Math.max(pmx, c + r); }
      const name = W.nations[k].name;
      const along = mx - mn, perp = pmx - pmn;
      const width = clamp(Math.min(along * 0.7, perp * 0.5 * name.length * 0.6), 14, 1300);
      const key = b.hasCap ? 'c' + k : b.key;
      alive.add(key);
      const sig = `${Math.round(cx / 10)}|${Math.round(cz / 10)}|${Math.round(th * 10)}|${Math.round(width / 10)}`;
      let lab = this.countryLabels.get(key);
      if (lab && lab.sig === sig) continue;
      if (!lab) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.nameTexture(name), transparent: true, depthTest: false, depthWrite: false, opacity: 0.5 }));
        mesh.rotation.order = 'YXZ'; mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3;
        this.group.add(mesh);
        lab = { mesh };
        this.countryLabels.set(key, lab);
      }
      lab.sig = sig; lab.width = width;
      lab.mesh.position.set(cx, 7, cz);
      lab.mesh.rotation.y = -th;
      lab.mesh.scale.set(width, width * (150 / 1024), 1);
    }
    for (const [key, lab] of this.countryLabels) if (!alive.has(key)) { this.group.remove(lab.mesh); lab.mesh.material.dispose(); this.countryLabels.delete(key); }
    this.dirty = false;
  }

  nameTexture(name) {
    if (!this.nameTex) this.nameTex = new Map();
    let tex = this.nameTex.get(name);
    if (tex) return tex;
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 150;
    const g = cv.getContext('2d');
    g.font = '800 104px "Big Shoulders Display", "Arial Narrow", sans-serif';
    g.textBaseline = 'middle';
    const txt = name.toLocaleUpperCase('tr');
    const chars = [...txt];
    const widths = chars.map((ch) => g.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const gap = Math.max(4, Math.min(60, (960 - total) / Math.max(1, chars.length - 1)));
    const full = total + gap * (chars.length - 1);
    const sc = Math.min(1, 980 / full);
    g.translate(512, 0); g.scale(sc, 1); g.translate(-full / 2, 0);
    let x = 0;
    g.fillStyle = 'rgba(16,22,26,1)';
    chars.forEach((ch, i) => { g.fillText(ch, x, 80); x += widths[i] + gap; });
    tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
    this.nameTex.set(name, tex);
    return tex;
  }

  clearCountryLabels() {
    for (const lab of this.countryLabels.values()) { this.group.remove(lab.mesh); lab.mesh.material.dispose(); }
    this.countryLabels.clear();
    if (this.nameTex && this.fontsReady && !this.texCleared) { for (const t of this.nameTex.values()) t.dispose(); this.nameTex.clear(); this.texCleared = true; }
  }

  update() {
    const map = this.map, dist = map.cam.dist;
    const polit = map.mode !== 'ter';
    // etiket, ekranda okunabilir boyuttayken görünür: küçük ülkeler yakından, büyükler uzaktan
    for (const lab of this.countryLabels.values()) {
      const px = (lab.width / dist) * 1000;
      const op = polit ? clamp((px - 55) / 60, 0, 1) * clamp((2600 - px) / 900, 0, 1) * 0.5 : 0;
      lab.mesh.visible = op > 0.02; lab.mesh.material.opacity = op;
    }
    const s = clamp(1.25 - dist / 1500, 0.6, 1.05);
    for (const sp of this.cityLabels) {
      const vis = dist < (sp.userData.cap ? 900 : 430);
      sp.visible = vis;
      if (!vis) continue;
      const sy = map.pxScale(sp.userData.px * s);
      sp.scale.set(sy * sp.userData.aspect, sy, 1);
    }
    this.cityMesh.visible = dist < 900;
  }
}
