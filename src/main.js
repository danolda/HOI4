// Meridyen Harekâtı — giriş noktası: dünya kurulumu, girdi, oyun döngüsü, kayıt.
import THREE from './three.js';
import { generateWorld, heightAt } from './worldgen.js';
import { dateOf, BUILDING } from './data.js';
import { Game } from './sim/game.js';
import { refreshAll } from './sim/core.js';
import { orderMove } from './sim/military.js';
import { endWar } from './sim/diplomacy.js';
import { canBuild, queueBuild } from './sim/economy.js';
import { MapView } from './render/map.js';
import { UnitLayer } from './render/units.js';
import { LabelLayer } from './render/labels.js';
import { UI } from './ui/ui.js';

const SAVE_KEY = 'meridyen-save-v2', SEED_KEY = 'meridyen-seed';
const SPEEDS = [0, 2, 6, 24, 72, 240];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};

const app = {
  world: null, G: null, map: null, units: null, labels: null, ui: null,
  playing: false, paused: true, speed: 3, acc: 0,
  selection: new Set(), side: null, placement: null,
  startOpts: { player: 0, diff: 1 },
  keys: new Set(), mouse: { x: -1, y: -1, moved: false, over: false },
  get me() { return this.G ? this.G.S.C[this.G.S.player] : null; },

  // ---------- kurulum
  async boot() {
    this.ui = new UI(this);
    this.bindGlobal();
    const hot = window.claude && window.claude.hot;
    const snap = hot && hot.data && hot.data.save ? hot.data : null;
    let seed = store.get(SEED_KEY) || 'MERIDYEN';
    if (snap) { try { seed = JSON.parse(snap.save).seed; } catch (e) { /* yoksay */ } }
    await this.buildWorld(seed);
    if (snap && snap.playing) { try { this.enterGame(Game.deserialize(this.world, snap.save)); return; } catch (e) { /* yeni oyuna düş */ } }
    this.toStart();
  },

  async buildWorld(seed) {
    const load = document.getElementById('loading');
    const fill = load.querySelector('.bar > i'), label = load.querySelector('.step');
    load.hidden = false;
    const step = (text, p) => new Promise((res) => { label.textContent = text + '…'; fill.style.width = Math.round(p * 100) + '%'; requestAnimationFrame(() => setTimeout(res, 0)); });
    await step('Dünya hazırlanıyor', 0.02);
    this.world = await generateWorld(seed, step);
    store.set(SEED_KEY, String(seed));
    this.destroyViews();
    const canvas = document.getElementById('map');
    this.map = new MapView(canvas, this.world);
    this.labels = new LabelLayer(this.map, this.world);
    this.units = new UnitLayer(this.map, this.world);
    this.units.selected = this.selection;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color: 0x7ff5dc, transparent: true, depthTest: false, side: THREE.DoubleSide, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6; ring.visible = false;
    this.map.scene.add(ring); this.ring = ring;
    this.bindCanvas(canvas);
    load.hidden = true;
  },

  destroyViews() {
    if (!this.map) return;
    this.map.renderer.dispose();
    const old = this.map.canvas, fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    this.map = this.units = this.labels = null;
  },

  attach(G) {
    this.G = G;
    this.selection.clear(); this.side = null; this.placement = null;
    this.units.selected = this.selection;
    this.map.sel = -1; this.map.highlight = null;
    this.units.setGame(G);
    this.labels.clearCountryLabels();
    this.map.updatePalette(G);
    this.labels.rebuildCountryLabels(G);
    this.units.rebuild();
    G.on('log', (e, major) => this.onLog(e, major));
    G.on('gameOver', (kind) => this.onGameOver(kind));
    G.on('peaceOffer', (w) => {
      this.ui.popup({ kicker: 'Barış teklifi', title: `${w.name}: karşı taraf barış istiyor`, text: 'Cephe uzun süredir durağan. Kabul edersen savaş mevcut hatlarda biter; herkes elindeki toprağı tutar.', yes: 'Barışı kabul et', no: 'Reddet' }, () => { endWar(G, w, null); this.ui.renderAll(); });
    });
    G.on('day', () => { if (this.playing && dateOf(G.S.hours).day === 1) this.save(false); });
  },

  toStart() {
    this.playing = false; this.paused = true;
    const G = Game.create(this.world, { player: this.startOpts.player, diff: 1 });
    G.S.observer = true;
    this.attach(G);
    this.ui.setPlaying(false);
    this.ui.closeModal();
    this.pickNation(Math.min(this.startOpts.player, this.world.nations.length - 1));
  },
  pickNation(id) {
    this.startOpts.player = id;
    this.focusNation(id, 900);
    this.ui.renderStart();
  },
  async newWorld(seed) {
    await this.buildWorld(seed);
    this.toStart();
  },
  startGame() {
    const G = Game.create(this.world, { player: this.startOpts.player, diff: this.startOpts.diff });
    this.enterGame(G);
    const nat = this.world.nations[G.S.player];
    this.ui.popup({
      kicker: '1 Ocak 1930', title: `${nat.long} senin emrinde`,
      text: 'Zaman duraklatılmış durumda. Önce bir ulusal hedef ve araştırmalar seç, inşaat kuyruğunu doldur; sonra Boşluk tuşuyla zamanı başlat. Üstteki sarı uyarılar eksikleri gösterir.',
      html: '<p class="small muted">Komşularına dikkat et: Militarist ve Kolektivist devletler birkaç yıl içinde saldırmaya başlar. Ordunu sınıra diz ya da Ordu panelinden otomatik cepheyi aç.</p>', yes: 'Göreve başla', no: 'Nasıl oynanır',
    }, null, () => this.ui.showHelp());
  },
  enterGame(G) {
    this.attach(G);
    this.playing = true; this.paused = true; this.speed = 3; this.acc = 0;
    this.ui.st.tab = null; this.ui.st.dipSel = -1;
    this.ui.setPlaying(true);
    this.focusNation(G.S.player, 700);
  },

  // ---------- kayıt
  hasSave() { return !!store.get(SAVE_KEY); },
  save(manual) {
    if (!this.playing || this.G.S.over === 'lose') return;
    const ok = store.set(SAVE_KEY, this.G.serialize());
    if (manual) this.toast(ok ? 'Oyun kaydedildi.' : 'Kaydedilemedi: tarayıcı depolamaya izin vermiyor.');
  },
  async loadSave() {
    const raw = store.get(SAVE_KEY);
    if (!raw) { this.toast('Kayıt bulunamadı.'); return; }
    try {
      const S = JSON.parse(raw);
      if (S.seed !== this.world.seed) await this.buildWorld(S.seed);
      this.enterGame(Game.deserialize(this.world, S));
      this.toast('Kayıt yüklendi.');
    } catch (e) {
      console.error(e);
      this.ui.popup({ kicker: 'Hata', title: 'Kayıt yüklenemedi', text: 'Kayıt dosyası bozuk ya da eski bir sürüme ait. Yeni bir oyun başlatabilirsin.' });
    }
  },

  // ---------- olaylar
  onLog(e, major) {
    if (!this.playing) return;
    this.ui.renderLog();
    const S = this.G.S;
    if (!major || S.observer) return;
    const name = this.world.nations[S.player].name;
    if ((e.type === 'war' || e.type === 'peace') && e.text.includes(name)) {
      this.ui.popup({ kicker: e.type === 'war' ? 'Savaş' : 'Barış', title: e.type === 'war' ? 'Cepheden haber' : 'Silahlar sustu', text: e.text, war: e.type === 'war', yes: 'Tamam', no: e.prov >= 0 ? 'Haritada göster' : '' }, null, () => this.focusProv(e.prov));
    }
  },
  onGameOver(kind) {
    if (kind === 'lose') {
      this.ui.popup({ kicker: 'Yenilgi', title: 'Ülken teslim oldu', text: 'Başkentin ve şehirlerin düştü. Dünyanın geri kalanının kaderini gözlemci olarak izleyebilir ya da yeni bir oyuna başlayabilirsin.', war: true, yes: 'Ana menü', no: 'Gözlemci olarak izle' },
        () => this.toStart(), () => { this.G.S.observer = true; this.G.S.over = null; this.paused = false; this.speed = 4; this.G.unitsDirty = true; this.ui.renderAll(); });
    } else {
      this.ui.popup({ kicker: 'Zafer', title: 'Dünya senin ittifakının', text: 'İttifakın dünya zafer puanlarının %60\'ını elinde tutuyor. Harekât başarıyla tamamlandı. İstersen oynamaya devam edebilirsin.', yes: 'Oynamaya devam et' });
    }
  },
  toast(text) { this.ui.toast(text); },
  confirm(o, onYes) { this.ui.popup({ ...o, no: 'Vazgeç' }, () => { onYes(); refreshAll(this.G); this.G.mapDirty = true; this.ui.renderAll(); }); },

  // ---------- zaman
  setSpeed(n) { this.speed = n; this.paused = false; this.ui.renderTop(); },
  togglePause() { this.paused = !this.paused; this.ui.renderTop(); },

  // ---------- seçim ve emirler
  selectedDivs() {
    const out = [], S = this.G.S;
    for (const id of this.selection) { const d = S._byId.get(id); if (d && !d.dead && d.o === S.player) out.push(d); else this.selection.delete(id); }
    return out;
  },
  selChanged() {
    this.map.sel = !this.selection.size && this.side && this.side.kind === 'prov' ? this.side.prov : -1;
    this.units.dirty = true;
    this.ui.renderSide();
  },
  clearSelection() { this.selection.clear(); this.side = null; this.selChanged(); },
  selectProvince(p) {
    const S = this.G.S;
    this.selection.clear();
    for (const d of S._pd[p]) if (d.o === S.player) this.selection.add(d.id);
    this.side = null; this.selChanged();
  },
  orderSelected(prov) {
    const ds = this.selectedDivs();
    if (!ds.length || prov < 0) return;
    let ok = 0;
    for (const d of ds) if (orderMove(this.G, d, prov)) { d.auto = false; ok++; }
    if (!ok) this.toast('Oraya ulaşılamıyor: tarafsız toprak, yol yok ya da limansız deniz yolu.');
    else {
      const P = this.world.prov[prov];
      this.ring.position.set(P.cx, heightAt(this.world, P.cx, P.cy) + 2.5, P.cy);
      this.ring.userData.t = 0; this.ring.visible = true;
    }
    this.units.dirty = true;
  },
  focusProv(p) { const P = this.world.prov[p]; if (P) this.map.focus(P.cx, P.cy, Math.min(this.map.cam.goalDist, 700)); },
  focusNation(id, dist) {
    const c = this.G.S.C[id], P = this.world.prov[c.capital];
    if (P) this.map.focus(P.cx, P.cy, dist || 760);
  },

  // ---------- yerleşim kipi
  startPlacement(type) { this.placement = { type }; this.selection.clear(); this.side = null; this.selChanged(); this.refreshPlacement(); },
  refreshPlacement() {
    if (!this.placement) return;
    const W = this.world, S = this.G.S, c = this.me, arr = new Uint8Array(W.NP);
    let any = false;
    for (let p = 0; p < W.NL; p++) {
      const ok = this.placement.type === 'deploy' ? S.ctrl[p] === c.id : canBuild(this.G, c, this.placement.type, p);
      if (ok) { arr[p] = 1; any = true; }
    }
    if (!any) { this.stopPlacement(); return; }
    this.map.setHighlight(arr, this.G);
  },
  stopPlacement() { if (!this.placement) return; this.placement = null; this.map.setHighlight(null, this.G); this.ui.renderAll(); },
  placeAt(p) {
    const pl = this.placement, c = this.me;
    if (!this.map.highlight || !this.map.highlight[p]) { this.toast('Bu eyalet uygun değil.'); return; }
    if (pl.type === 'deploy') { c.deploy = p; this.stopPlacement(); this.toast(`Yeni tümenler ${this.world.prov[p].name} eyaletinde konuşlanacak.`); return; }
    if (queueBuild(this.G, c, pl.type, p)) { refreshAll(this.G); this.refreshPlacement(); this.ui.renderAll(); this.toast(`${BUILDING[pl.type].name} kuyruğa eklendi: ${this.world.prov[p].name}.`); }
  },

  // ---------- girdi
  bindGlobal() {
    window.addEventListener('resize', () => { if (this.map) this.map.resize(); });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (!this.playing) return;
      const modal = !this.ui.el.modal.hidden;
      if (k === 'escape') { if (modal) this.ui.closeModal(); else if (this.placement) this.stopPlacement(); else if (this.selection.size || this.side) this.clearSelection(); else this.ui.openTab(null); }
      if (modal) return;
      if (k === ' ') { e.preventDefault(); this.togglePause(); }
      else if (k >= '1' && k <= '5') this.setSpeed(+k);
      else if (k === '+' || k === '=') this.setSpeed(Math.min(5, this.speed + 1));
      else if (k === '-') this.setSpeed(Math.max(1, this.speed - 1));
      else if (k === 'home') this.focusNation(this.G.S.player);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  },

  bindCanvas(canvas) {
    const pts = new Map();
    let drag = null, pinch = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.focus({ preventScroll: true });
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        drag = null; this.ui.el.selbox.hidden = true;
        return;
      }
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, button: e.button, box: e.shiftKey && e.button === 0 && this.playing && !this.G.S.observer, touch: e.pointerType === 'touch', shift: e.shiftKey || e.ctrlKey || e.metaKey };
    });
    canvas.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; this.mouse.over = e.pointerType !== 'touch';
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (d > 10 && pinch.d > 10) { this.map.cam.goalDist = this.map.cam.dist; this.map.zoomBy(pinch.d / d, mx, my); this.map.cam.dist = this.map.cam.goalDist; this.map.placeCamera(); }
        this.map.panPixels(pinch.mx, pinch.my, mx, my);
        pinch = { d, mx, my };
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > (drag.touch ? 9 : 5)) drag.moved = true;
      if (drag.moved) {
        if (drag.box) {
          const r = canvas.getBoundingClientRect(), sb = this.ui.el.selbox;
          sb.hidden = false;
          sb.style.left = Math.min(drag.x0, e.clientX) - r.left + 'px'; sb.style.top = Math.min(drag.y0, e.clientY) - r.top + 'px';
          sb.style.width = Math.abs(e.clientX - drag.x0) + 'px'; sb.style.height = Math.abs(e.clientY - drag.y0) + 'px';
        } else if (drag.button === 2) this.map.rotateBy((e.clientX - drag.lx) * -0.004);
        else this.map.panPixels(drag.lx, drag.ly, e.clientX, e.clientY);
      }
      drag.lx = e.clientX; drag.ly = e.clientY;
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag; drag = null;
      this.ui.el.selbox.hidden = true;
      if (e.type === 'pointercancel') return;
      if (!d.moved) this.click(e, d);
      else if (d.box) {
        const r = canvas.getBoundingClientRect();
        const x0 = Math.min(d.x0, e.clientX) - r.left, x1 = Math.max(d.x0, e.clientX) - r.left, y0 = Math.min(d.y0, e.clientY) - r.top, y1 = Math.max(d.y0, e.clientY) - r.top;
        this.selection.clear();
        for (const st of this.units.stacksInRect(x0, y0, x1, y1)) if (st.rel === 'me') for (const dv of st.divs) this.selection.add(dv.id);
        this.side = null; this.selChanged();
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { this.mouse.over = false; this.map.hov = -1; this.ui.setHover(-1); });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.map.zoomBy(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0016), e.clientX, e.clientY); }, { passive: false });
    this.local = local;
  },

  click(e, d) {
    const map = this.map;
    const pk = map.pick(e.clientX, e.clientY);
    if (!this.playing) {
      if (pk && pk.prov >= 0 && pk.prov < this.world.NL) this.pickNation(this.G.S.owner[pk.prov]);
      return;
    }
    const S = this.G.S;
    const l = this.local(e);
    const hit = this.units.hitTest(l.x, l.y);
    const ownHit = hit && hit.stack && hit.stack.rel === 'me';
    if (d.button === 2 || (d.touch && this.selection.size && !ownHit && !this.placement)) {
      const target = hit && hit.stack ? (hit.stack.next >= 0 && hit.stack.rel !== 'me' ? hit.stack.prov : hit.stack.prov) : pk ? pk.prov : -1;
      if (this.selection.size) this.orderSelected(target);
      return;
    }
    if (d.button !== 0) return;
    if (this.placement) { if (pk && pk.prov >= 0) this.placeAt(pk.prov); return; }
    if (hit && hit.battle) { this.selection.clear(); this.side = { kind: 'battle', id: hit.battle.id }; }
    else if (hit && hit.stack) {
      const st = hit.stack;
      if (st.rel === 'me' && !S.observer) {
        if (!d.shift) this.selection.clear();
        const all = st.divs.every((x) => this.selection.has(x.id));
        for (const dv of st.divs) { if (d.shift && all) this.selection.delete(dv.id); else this.selection.add(dv.id); }
        this.side = null;
      } else { this.selection.clear(); this.side = { kind: 'stack', owner: st.owner, prov: st.prov }; }
    } else if (pk && pk.prov >= 0) { this.selection.clear(); this.side = { kind: 'prov', prov: pk.prov }; }
    else { this.selection.clear(); this.side = null; }
    this.selChanged();
  },

  // ---------- döngü
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const map = this.map, G = this.G;
    if (!map || !G) return;
    if (this.playing && !this.paused && !G.S.over) {
      this.acc += dt * SPEEDS[this.speed];
      const t0 = performance.now();
      let n = 0;
      while (this.acc >= 1 && n < 400 && performance.now() - t0 < 16) { G.tickHour(); this.acc -= 1; n++; }
      if (this.acc > 48) this.acc = 48;
    }
    // klavye ile kaydırma
    const k = this.keys;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dz = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (dx || dz) map.panKeys(dx, dz, dt);
    if (k.has('q')) map.rotateBy(dt * 0.9);
    if (k.has('e')) map.rotateBy(-dt * 0.9);

    this.tUnits = (this.tUnits || 0) + dt; this.tLabels = (this.tLabels || 0) + dt;
    if (G.mapDirty) {
      G.mapDirty = false;
      map.updatePalette(G);
      this.labels.dirty = true; this.ui.miniDirty = true;
      if (this.placement) this.refreshPlacement();
    }
    if ((G.unitsDirty || this.units.dirty || this.tUnits > 0.35) && this.tUnits > 0.08) { G.unitsDirty = false; this.tUnits = 0; this.units.rebuild(); }
    if (this.labels.dirty && this.tLabels > 1.2) { this.tLabels = 0; this.labels.rebuildCountryLabels(G); }

    map.update(dt);
    if (this.mouse.moved && this.mouse.over) {
      this.mouse.moved = false;
      const pk = map.pick(this.mouse.x, this.mouse.y);
      const p = pk ? pk.prov : -1;
      if (p !== map.hov) { map.hov = p; this.ui.setHover(p); }
    }
    this.units.update(dt);
    this.labels.update();
    const ring = this.ring;
    if (ring && ring.visible) {
      ring.userData.t += dt;
      const t = ring.userData.t / 0.7;
      if (t >= 1) ring.visible = false;
      else { const s = map.cam.dist * (0.012 + 0.03 * t); ring.scale.set(s, s, 1); ring.material.opacity = 0.9 * (1 - t); }
    }
    map.render();
    this.ui.frame(dt);
  },
};

window.__app = app;
const start = () => { app.boot().then(() => requestAnimationFrame((t) => app.frame(t))).catch((e) => { console.error(e); const l = document.getElementById('loading'); if (l) { l.hidden = false; l.querySelector('.step').textContent = 'Oyun başlatılamadı: ' + e.message; } }); };
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => (app.playing && app.G ? { save: app.G.serialize(), playing: true } : {}));
if (hot && hot.ready) hot.ready(start); else start();
