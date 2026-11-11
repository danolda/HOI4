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
      if (!P.city) continue;
      const n = Math.min(12, 3 + Math.floor(P.vp / 3));
      for (let i = 0; i < n; i++) {
        const a = rng.next() * Math.PI * 2, r = (i === 0 ? 0 : 3 + rng.next() * 9) * (P.vp >= 20 ? 1.3 : 1);
        const x = P.cx + Math.cos(a) * r, z = P.cy + Math.sin(a) * r + 9;
        const tall = i === 0 && P.vp >= 20;
        items.push({ x, z, w: 1.8 + rng.next() * 2.2, d: 1.8 + rng.next() * 2.2, h: tall ? 9 + rng.next() * 3 : 1.6 + rng.next() * (2 + P.vp * 0.18), rot: rng.next() * Math.PI, shade: rng.next() });
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
      if (!P.city) continue;
      const cap = P.capitalOf !== undefined;
      const sp = textSprite((cap ? '★ ' : '') + P.name, { size: cap ? 17 : 14, weight: cap ? 700 : 600, color: cap ? '#fff3c4' : '#f2efe2' });
      sp.center.set(0.5, 1);
      sp.position.set(P.cx, heightAt(W, P.cx, P.cy + 9) + 1, P.cy + 19);
      sp.renderOrder = 6;
      sp.userData.cap = cap;
      this.group.add(sp); this.cityLabels.push(sp);
    }
  }

  // Ülke adlarını toprakların en büyük parçası üzerine yatır.
  rebuildCountryLabels(G) {
    const S = G.S, W = this.world, P = W.prov, NL = W.NL;
    const seen = new Uint8Array(NL);
    const best = new Map();
    for (let p = 0; p < NL; p++) {
      if (seen[p]) continue;
      const k = S.ctrl[p];
      const comp = [p]; seen[p] = 1;
      let area = 0;
      for (let h = 0; h < comp.length; h++) { const u = comp[h]; area += P[u].area; for (const v of P[u].nb) if (!seen[v] && S.ctrl[v] === k) { seen[v] = 1; comp.push(v); } }
      const b = best.get(k);
      if (!b || area > b.area) best.set(k, { area, comp });
    }
    const alive = new Set();
    for (const [k, b] of best) {
      if (b.comp.length < 2) continue;
      alive.add(k);
      let sx = 0, sz = 0, sw = 0;
      for (const u of b.comp) { sx += P[u].cx * P[u].area; sz += P[u].cy * P[u].area; sw += P[u].area; }
      const cx = sx / sw, cz = sz / sw;
      let cxx = 0, czz = 0, cxz = 0;
      for (const u of b.comp) { const dx = P[u].cx - cx, dz = P[u].cy - cz, w = P[u].area; cxx += dx * dx * w; czz += dz * dz * w; cxz += dx * dz * w; }
      let th = 0.5 * Math.atan2(2 * cxz, cxx - czz);
      th = clamp(th, -0.6, 0.6);
      const ax = Math.cos(th), az = Math.sin(th);
      let mn = 1e9, mx = -1e9, pmn = 1e9, pmx = -1e9;
      for (const u of b.comp) { const dx = P[u].cx - cx, dz = P[u].cy - cz; const a = dx * ax + dz * az, c = -dx * az + dz * ax; mn = Math.min(mn, a); mx = Math.max(mx, a); pmn = Math.min(pmn, c); pmx = Math.max(pmx, c); }
      const name = W.nations[k].name;
      const along = mx - mn + 50, perp = pmx - pmn + 50;
      const width = clamp(Math.min(along * 0.72, perp * 0.5 * name.length * 0.62), 70, 820);
      const sig = `${Math.round(cx / 12)}|${Math.round(cz / 12)}|${Math.round(th * 10)}|${Math.round(width / 16)}`;
      let lab = this.countryLabels.get(k);
      if (lab && lab.sig === sig) continue;
      if (!lab) {
        const cv = document.createElement('canvas');
        cv.width = 1024; cv.height = 150;
        const g = cv.getContext('2d');
        g.font = '800 104px "Big Shoulders Display", "Arial Narrow", sans-serif';
        g.textBaseline = 'middle';
        const txt = name.toLocaleUpperCase('tr');
        const widths = [...txt].map((ch) => g.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0);
        const gap = Math.max(4, (960 - total) / Math.max(1, txt.length - 1));
        let x = (1024 - (total + gap * (txt.length - 1))) / 2;
        g.fillStyle = 'rgba(16,22,26,1)';
        [...txt].forEach((ch, i) => { g.fillText(ch, x, 80); x += widths[i] + gap; });
        const tex = new THREE.CanvasTexture(cv);
        tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.5 }));
        mesh.rotation.order = 'YXZ'; mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3;
        this.group.add(mesh);
        lab = { mesh };
        this.countryLabels.set(k, lab);
      }
      lab.sig = sig;
      lab.mesh.position.set(cx, 48, cz);
      lab.mesh.rotation.y = -th;
      lab.mesh.scale.set(width, width * (150 / 1024), 1);
    }
    for (const [k, lab] of this.countryLabels) if (!alive.has(k)) { this.group.remove(lab.mesh); lab.mesh.material.map.dispose(); lab.mesh.material.dispose(); this.countryLabels.delete(k); }
    this.dirty = false;
  }

  clearCountryLabels() {
    for (const lab of this.countryLabels.values()) { this.group.remove(lab.mesh); lab.mesh.material.map.dispose(); lab.mesh.material.dispose(); }
    this.countryLabels.clear();
  }

  update() {
    const map = this.map, dist = map.cam.dist;
    const polit = map.mode !== 'ter';
    const op = polit ? clamp((dist - 330) / 500, 0, 1) * 0.52 : 0;
    for (const lab of this.countryLabels.values()) { lab.mesh.visible = op > 0.02; lab.mesh.material.opacity = op; }
    const s = clamp(1.25 - dist / 1500, 0.6, 1.05);
    for (const sp of this.cityLabels) {
      const vis = dist < (sp.userData.cap ? 1250 : 760);
      sp.visible = vis;
      if (!vis) continue;
      const sy = map.pxScale(sp.userData.px * s);
      sp.scale.set(sy * sp.userData.aspect, sy, 1);
    }
    this.cityMesh.visible = dist < 1500;
  }
}
