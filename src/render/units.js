// Haritadaki birlik rozetleri, hareket okları ve muharebe işaretleri.
import THREE from '../three.js';
import { heightAt } from '../worldgen.js';
import { ST_IDLE, ST_RETREAT, atWar, isFriend, divStats } from '../sim/core.js';
import { clamp } from '../rng.js';

const BW = 132, BH = 60;
const REL_COL = { me: '#4fd1b8', friend: '#6aa5e8', enemy: '#ef6a5b', neutral: '#93a3a6' };

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export class UnitLayer {
  constructor(map, world) {
    this.map = map; this.world = world;
    this.group = new THREE.Group();
    map.scene.add(this.group);
    this.sprites = new Map();
    this.tex = new Map();
    this.stacks = [];
    this.battleSprites = new Map();
    this.battleTex = new Map();
    this.selected = new Set();
    this.vis = new Uint8Array(world.NP);
    this.lastDist = 0;
    const MAXV = 90000;
    this.aPos = new Float32Array(MAXV * 3); this.aCol = new Float32Array(MAXV * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.arrows = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.arrows.frustumCulled = false; this.arrows.renderOrder = 5;
    map.scene.add(this.arrows);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this.clearTextures(); this.dirty = true; });
  }
  setGame(G) { this.G = G; this.dirty = true; }
  clearTextures() {
    for (const t of this.tex.values()) t.dispose();
    this.tex.clear();
    for (const s of this.sprites.values()) s.userData.look = '';
    for (const t of this.battleTex.values()) t.dispose();
    this.battleTex.clear();
    for (const s of this.battleSprites.values()) s.userData.look = '';
  }

  relOf(o) {
    const S = this.G.S, me = S.player;
    if (o === me) return S.observer ? 'neutral' : 'me';
    if (S.observer) return 'neutral';
    return atWar(S, me, o) ? 'enemy' : isFriend(S, me, o) ? 'friend' : 'neutral';
  }

  computeVis() {
    const S = this.G.S, W = this.world, vis = this.vis, me = S.player;
    if (S.observer || S.C[me].intel) { vis.fill(1); return; }
    vis.fill(0);
    const mark = (p) => {
      vis[p] = 1;
      const P = W.prov[p];
      for (const q of P.nb) vis[q] = 1;
      for (const q of P.seaNb) vis[q] = 1;
      for (const q of P.landNb) vis[q] = 1;
    };
    for (let p = 0; p < W.NL; p++) { const k = S.ctrl[p]; if (k === me || isFriend(S, me, k)) mark(p); }
    for (const d of S.divs) if (d.o === me || isFriend(S, me, d.o)) mark(d.p);
  }

  badgeTexture(look, st) {
    let t = this.tex.get(look);
    if (t) return t;
    if (this.tex.size > 700) this.clearTextures();
    const cv = document.createElement('canvas');
    cv.width = BW * 2; cv.height = BH * 2;
    const g = cv.getContext('2d');
    g.scale(2, 2);
    const relC = REL_COL[st.rel];
    rr(g, 2, 2, BW - 4, 46, 7);
    g.fillStyle = st.selN ? 'rgba(34,58,66,0.97)' : 'rgba(13,23,29,0.93)'; g.fill();
    g.lineWidth = st.selN ? 3.2 : 1.6; g.strokeStyle = st.selN ? '#f4f0d8' : relC; g.stroke();
    const nc = this.world.nations[st.owner].color;
    rr(g, 7, 7, 38, 36, 4);
    g.fillStyle = `rgb(${nc[0]},${nc[1]},${nc[2]})`; g.fill();
    // tür simgesi: piyade = çapraz, motorize = kamyon, zırhlı = tank; altta tür şeridi
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
    if (st.kind === 'arm') {
      rr(g, 11, 27, 30, 10, 5); g.fill();                       // palet
      g.fillRect(15, 20, 22, 8);                                // gövde
      rr(g, 19, 13, 12, 8, 2); g.fill();                        // kule
      g.lineWidth = 3; g.beginPath(); g.moveTo(31, 17); g.lineTo(42, 17); g.stroke(); // namlu
      g.fillStyle = `rgb(${nc[0]},${nc[1]},${nc[2]})`;
      for (const x of [17, 23, 29, 35]) { g.beginPath(); g.arc(x, 32, 2.1, 0, 7); g.fill(); }
      g.fillStyle = '#f2b84b'; g.fillRect(7, 40, 38, 3);
    } else if (st.kind === 'mot') {
      g.fillRect(11, 14, 19, 15);                               // kasa
      rr(g, 31, 19, 9, 10, 2); g.fill();                        // kabin
      g.fillRect(11, 28, 29, 3);
      for (const x of [17, 34]) { g.beginPath(); g.arc(x, 33, 4.6, 0, 7); g.fill(); }
      g.fillStyle = `rgb(${nc[0]},${nc[1]},${nc[2]})`;
      for (const x of [17, 34]) { g.beginPath(); g.arc(x, 33, 1.9, 0, 7); g.fill(); }
      g.fillStyle = '#6aa5e8'; g.fillRect(7, 40, 38, 3);
    } else {
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(13, 13); g.lineTo(39, 37); g.moveTo(39, 13); g.lineTo(13, 37); g.stroke();
    }
    g.fillStyle = '#eef4f2';
    g.font = '700 30px "Big Shoulders Display", "Arial Narrow", sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(String(st.n), 52, 26);
    // durum işareti
    g.lineWidth = 3; g.lineJoin = 'round';
    if (st.attacking) { g.strokeStyle = '#ff8a4a'; g.beginPath(); g.moveTo(102, 15); g.lineTo(120, 35); g.moveTo(120, 15); g.lineTo(102, 35); g.stroke(); }
    else if (st.st === ST_RETREAT) { g.strokeStyle = '#b6bcbc'; g.beginPath(); g.moveTo(118, 15); g.lineTo(106, 25); g.lineTo(118, 35); g.stroke(); }
    else if (st.next >= 0) { g.strokeStyle = relC; g.beginPath(); g.moveTo(104, 15); g.lineTo(116, 25); g.lineTo(104, 35); g.stroke(); }
    else if (st.auto) { g.fillStyle = relC; g.font = '700 15px "Barlow Semi Condensed", sans-serif'; g.fillText('OTO', 98, 26); }
    if (st.nos) { g.fillStyle = '#f2b84b'; g.beginPath(); g.arc(122, 9, 6, 0, 7); g.fill(); g.fillStyle = '#1a1206'; g.font = '700 10px sans-serif'; g.textAlign = 'center'; g.fillText('!', 122, 9.5); }
    // teşkilat ve güç çubukları
    g.fillStyle = 'rgba(8,14,18,0.9)'; g.fillRect(4, 50, BW - 8, 9);
    g.fillStyle = '#7fd36b'; g.fillRect(4, 50, (BW - 8) * st.org, 4);
    g.fillStyle = '#f2b84b'; g.fillRect(4, 55, (BW - 8) * st.str, 4);
    t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    this.tex.set(look, t);
    return t;
  }

  battleTexture(cls, val) {
    const key = cls + val;
    let t = this.battleTex.get(key);
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const g = cv.getContext('2d');
    const col = cls === 'good' ? '#7fd36b' : cls === 'bad' ? '#ef6a5b' : '#d9d2bd';
    g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fillStyle = 'rgba(13,23,29,0.95)'; g.fill();
    g.lineWidth = 7; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.stroke();
    g.beginPath(); g.arc(48, 48, 40, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * val) / 100); g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.font = '800 38px "Big Shoulders Display", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(val), 48, 51);
    t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    this.battleTex.set(key, t);
    return t;
  }

  // Bölümleri yığınlara ayır ve sprite'ları eşitle.
  rebuild() {
    const G = this.G;
    if (!G) return;
    const S = G.S, W = this.world;
    this.computeVis();
    const map = new Map();
    for (const d of S.divs) {
      if (d.dead || !this.vis[d.p]) continue;
      const next = d.st === ST_IDLE || !d.path.length ? -1 : d.path[0];
      // piyade, motorize ve zırhlı tümenler ayrı rozetlerde gösterilir
      const kind = divStats(S, d).kind;
      const key = `${d.p}|${d.o}|${next}|${d.b >= 0 ? 1 : 0}|${kind}`;
      let st = map.get(key);
      if (!st) {
        st = { key, prov: d.p, owner: d.o, next, st: d.st, attacking: d.b >= 0, divs: [], org: 0, str: 0, prog: 0, kind, selN: 0, auto: 0, nos: 0, rel: this.relOf(d.o) };
        map.set(key, st);
      }
      st.divs.push(d); st.org += d.g; st.str += d.s; st.prog = Math.max(st.prog, d.prog);
      if (this.selected.has(d.id)) st.selN++;
      if (d.auto) st.auto++;
      if (d.nos > 2) st.nos++;
    }
    const perProv = new Map();
    const stacks = [];
    for (const st of map.values()) {
      st.n = st.divs.length; st.org /= st.n; st.str /= st.n;
      st.auto = st.auto === st.n && st.rel === 'me';
      // aynı yerde duran (ya da aynı yöne yürüyen) rozetler yan yana dizilir
      const gk = st.prov + '|' + st.next;
      const l = perProv.get(gk) || [];
      l.push(st); perProv.set(gk, l);
      stacks.push(st);
    }
    const kOrder = { inf: 0, mot: 1, arm: 2 };
    for (const l of perProv.values()) {
      l.sort((a, b) => (a.owner - b.owner) || (kOrder[a.kind] - kOrder[b.kind]) || (a.attacking - b.attacking));
      l.forEach((st, i) => { st.slot = i; st.slots = l.length; });
    }
    this.stacks = stacks;
    // sprite eşitleme
    const seen = new Set();
    for (const st of stacks) {
      seen.add(st.key);
      let sp = this.sprites.get(st.key);
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
        sp.center.set(0.5, 0); sp.renderOrder = 10;
        sp.userData.fresh = true;
        this.group.add(sp); this.sprites.set(st.key, sp);
      }
      const look = `${st.owner}|${st.kind}|${st.n}|${Math.round(st.org * 10)}|${Math.round(st.str * 10)}|${st.rel}|${st.selN ? 1 : 0}|${st.attacking ? 'a' : st.st === ST_RETREAT ? 'r' : st.next >= 0 ? 'm' : st.auto ? 'o' : '-'}|${st.nos ? 1 : 0}`;
      if (sp.userData.look !== look) { sp.material.map = this.badgeTexture(look, st); sp.material.needsUpdate = true; sp.userData.look = look; }
      sp.userData.stack = st;
    }
    for (const [key, sp] of this.sprites) if (!seen.has(key)) { this.group.remove(sp); sp.material.dispose(); this.sprites.delete(key); }

    // muharebeler
    const bSeen = new Set();
    const me = S.player;
    for (const b of S.battles) {
      if (!b.att.length || b.ao === undefined) continue;
      const a0 = S._byId.get(b.att[0]);
      if (!a0 || !(this.vis[b.prov] || this.vis[a0.p])) continue;
      bSeen.add(b.id);
      let sp = this.battleSprites.get(b.id);
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
        sp.renderOrder = 12;
        this.group.add(sp); this.battleSprites.set(b.id, sp);
      }
      const mineAtt = !S.observer && (b.ao === me || isFriend(S, me, b.ao)), mineDef = !S.observer && (b.do === me || isFriend(S, me, b.do));
      const val = clamp(mineDef && !mineAtt ? 100 - b.w : b.w, 1, 99);
      const cls = mineAtt || mineDef ? (val >= 50 ? 'good' : 'bad') : 'neutral';
      const look = cls + val;
      if (sp.userData.look !== look) { sp.material.map = this.battleTexture(cls, val); sp.material.needsUpdate = true; sp.userData.look = look; }
      const A = W.prov[a0.p], T = W.prov[b.prov];
      const x = (A.cx + T.cx) / 2, z = (A.cy + T.cy) / 2;
      sp.position.set(x, heightAt(W, x, z) + 6, z);
      sp.userData.battle = b;
    }
    for (const [id, sp] of this.battleSprites) if (!bSeen.has(id)) { this.group.remove(sp); sp.material.dispose(); this.battleSprites.delete(id); }
    this.rebuildArrows();
    this.dirty = false;
  }

  stackPos(st, out) {
    const W = this.world, A = W.prov[st.prov];
    let x = A.cx, z = A.cy;
    if (st.next >= 0) {
      const B = W.prov[st.next];
      const t = st.attacking ? Math.min(st.prog, 0.3) : st.prog;
      x += (B.cx - A.cx) * t; z += (B.cy - A.cy) * t;
    }
    if (st.slots > 1) x += (st.slot - (st.slots - 1) / 2) * Math.min(46, this.map.cam.dist * 0.07);
    out.x = x; out.z = z; out.y = heightAt(W, x, z) + 3;
    return out;
  }

  rebuildArrows() {
    const G = this.G, S = G.S, W = this.world, P = W.prov;
    const pos = this.aPos, col = this.aCol;
    const maxV = pos.length / 3 - 12;
    let n = 0;
    const dist = this.map.cam.dist;
    this.lastDist = dist;
    const wBase = Math.max(1.3, dist * 0.0042);
    const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, c) => {
      if (n >= maxV) return;
      pos[n * 3] = ax; pos[n * 3 + 1] = ay; pos[n * 3 + 2] = az; col.set(c, n * 4); n++;
      pos[n * 3] = bx; pos[n * 3 + 1] = by; pos[n * 3 + 2] = bz; col.set(c, n * 4); n++;
      pos[n * 3] = cx; pos[n * 3 + 1] = cy; pos[n * 3 + 2] = cz; col.set(c, n * 4); n++;
    };
    const tmp = { x: 0, y: 0, z: 0 };
    for (const st of this.stacks) {
      if (st.next < 0) continue;
      const mine = st.rel === 'me';
      if (!mine && !st.attacking) continue;
      const c = st.attacking ? (st.rel === 'enemy' ? [0.95, 0.36, 0.3, 0.85] : [1, 0.56, 0.3, 0.92])
        : st.st === ST_RETREAT ? [0.75, 0.75, 0.72, 0.45] : st.selN ? [0.5, 0.97, 0.84, 0.95] : [0.42, 0.86, 0.75, 0.42];
      const w = wBase * (st.selN || st.attacking ? 1.25 : 0.9);
      this.stackPos(st, tmp);
      const pts = [[tmp.x, tmp.z]];
      const path = mine ? st.divs[0].path : [st.next];
      for (let i = 0; i < path.length && i < 40; i++) pts.push([P[path[i]].cx, P[path[i]].cy]);
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        if (len < 0.5) continue;
        const dx = (x1 - x0) / len, dz = (z1 - z0) / len, nx = -dz * w, nz = dx * w;
        const last = i + 2 === pts.length;
        const end = last ? Math.max(0, len - w * 4.5) : len;
        const segs = Math.max(1, Math.ceil(end / 16));
        for (let s = 0; s < segs; s++) {
          const a = (end * s) / segs, b = (end * (s + 1)) / segs;
          const ax = x0 + dx * a, az = z0 + dz * a, bx = x0 + dx * b, bz = z0 + dz * b;
          const ay = heightAt(W, ax, az) + 2, by = heightAt(W, bx, bz) + 2;
          tri(ax - nx, ay, az - nz, ax + nx, ay, az + nz, bx + nx, by, bz + nz, c);
          tri(ax - nx, ay, az - nz, bx + nx, by, bz + nz, bx - nx, by, bz - nz, c);
        }
        if (last) {
          const ex = x0 + dx * end, ez = z0 + dz * end, ey = heightAt(W, ex, ez) + 2;
          tri(ex - nx * 2.6, ey, ez - nz * 2.6, ex + nx * 2.6, ey, ez + nz * 2.6, x1, heightAt(W, x1, z1) + 2, z1, c);
        }
      }
    }
    const geo = this.arrows.geometry;
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, n);
  }

  update(dt) {
    if (!this.G) return;
    const map = this.map, dist = map.cam.dist;
    if (Math.abs(dist - this.lastDist) / Math.max(1, this.lastDist) > 0.08) this.rebuildArrows();
    const s = clamp(1.16 - dist / 1500, 0.42, 1.05);
    this.group.visible = dist < 1250; // çok uzaktan rozetler okunmaz, gizlenir
    this.arrows.visible = dist < 1250;
    const hpx = 37 * s;
    const sy = map.pxScale(hpx), sx = sy * (BW / BH);
    const tmp = { x: 0, y: 0, z: 0 };
    const k = Math.min(1, dt * 10);
    for (const sp of this.sprites.values()) {
      const st = sp.userData.stack;
      this.stackPos(st, tmp);
      if (sp.userData.fresh) { sp.position.set(tmp.x, tmp.y, tmp.z); sp.userData.fresh = false; }
      else { sp.position.x += (tmp.x - sp.position.x) * k; sp.position.y += (tmp.y - sp.position.y) * k; sp.position.z += (tmp.z - sp.position.z) * k; }
      sp.scale.set(sx, sy, 1);
    }
    const bs = map.pxScale(30 * s * (1 + 0.06 * Math.sin(map.time * 5)));
    for (const sp of this.battleSprites.values()) sp.scale.set(bs, bs, 1);
    this.hpx = hpx;
  }

  // ekran koordinatında isabet testi
  hitTest(x, y) {
    const map = this.map;
    const h = this.hpx || 30, w = h * (BW / BH);
    for (const sp of this.battleSprites.values()) {
      const p = map.project(sp.position.x, sp.position.y, sp.position.z);
      if (!p.behind && Math.hypot(p.x - x, p.y - y) < 17) return { battle: sp.userData.battle };
    }
    let best = null, bd = 1e9;
    for (const sp of this.sprites.values()) {
      const p = map.project(sp.position.x, sp.position.y, sp.position.z);
      if (p.behind) continue;
      if (x >= p.x - w / 2 && x <= p.x + w / 2 && y >= p.y - h && y <= p.y) {
        const d = Math.abs(p.x - x) + Math.abs(p.y - h / 2 - y);
        if (d < bd) { bd = d; best = sp.userData.stack; }
      }
    }
    return best ? { stack: best } : null;
  }
  stacksInRect(x0, y0, x1, y1) {
    const map = this.map, out = [];
    const h = this.hpx || 30;
    for (const sp of this.sprites.values()) {
      const p = map.project(sp.position.x, sp.position.y, sp.position.z);
      if (p.behind) continue;
      const cy = p.y - h / 2;
      if (p.x >= x0 && p.x <= x1 && cy >= y0 && cy <= y1) out.push(sp.userData.stack);
    }
    return out;
  }
}
