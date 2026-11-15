// Meridyen Harekâtı — giriş noktası: dünya kurulumu, girdi, oyun döngüsü, kayıt ve çok oyunculu eşitleme.
import THREE from './three.js';
import { generateWorld, heightAt } from './worldgen.js';
import { dateOf, BUILDING } from './data.js';
import { Game } from './sim/game.js';
import { refreshAll, vpShare, recalcMods } from './sim/core.js';
import { canBuild } from './sim/economy.js';
import { runCommand } from './sim/commands.js';
import { MapView } from './render/map.js';
import { UnitLayer } from './render/units.js';
import { LabelLayer } from './render/labels.js';
import { UI } from './ui/ui.js';
import { Net, randomCode, pack, unpack } from './net.js';

const SAVE_KEY = 'meridyen-save-v3';
const SPEEDS = [0, 2, 6, 24, 72, 240];
const SNAP_MS = 600;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};

const app = {
  world: null, G: null, map: null, units: null, labels: null, ui: null,
  playing: false, paused: true, speed: 3, acc: 0,
  selection: new Set(), side: null, placement: null,
  startOpts: { player: 8, diff: 1 },
  mp: null, spectator: false, logSeen: 0, seenOffer: {}, defeatShown: false, winShown: false,
  keys: new Set(), mouse: { x: -1, y: -1, moved: false, over: false },
  get me() { return this.G && this.G.S.player >= 0 ? this.G.S.C[this.G.S.player] : null; },
  get isGuest() { return !!this.mp && this.mp.role === 'guest'; },
  get isHost() { return !!this.mp && this.mp.role === 'host'; },

  // ---------- kurulum
  async boot() {
    this.ui = new UI(this);
    this.bindGlobal();
    const hot = window.claude && window.claude.hot;
    const snap = hot && hot.data && hot.data.save ? hot.data : null;
    await this.buildWorld();
    if (snap && snap.playing) { try { this.enterGame(Game.deserialize(this.world, snap.save)); return; } catch (e) { /* yeni oyuna düş */ } }
    this.toStart();
  },

  async buildWorld() {
    const load = document.getElementById('loading');
    const fill = load.querySelector('.bar > i'), label = load.querySelector('.step');
    load.hidden = false;
    const step = (text, p) => new Promise((res) => { label.textContent = text + '…'; fill.style.width = Math.round(p * 100) + '%'; requestAnimationFrame(() => setTimeout(res, 0)); });
    await step('Dünya haritası hazırlanıyor', 0.02);
    this.world = await generateWorld(undefined, step);
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

  // Yeni bir oyun nesnesini görünüme bağlar. keepView: çok oyunculu anlık görüntüde seçim ve paneller korunur.
  attach(G, keepView) {
    this.G = G;
    this.units.setGame(G);
    if (!keepView) {
      this.selection.clear(); this.side = null; this.placement = null;
      this.map.sel = -1; this.map.highlight = null;
      this.labels.clearCountryLabels();
      this.map.updatePalette(G);
      this.labels.rebuildCountryLabels(G);
      this.units.rebuild();
      this.logSeen = G.S.logSeq || 0; this.seenOffer = {}; this.defeatShown = false; this.winShown = false;
      for (const w of G.S.wars) if (w.offer) this.seenOffer[w.id] = w.offer;
    } else { G.mapDirty = true; G.unitsDirty = true; }
    G.on('day', () => {
      if (!this.playing || this.isGuest) return;
      if (dateOf(G.S.hours).day === 1) this.save(false);
      this.processEvents();
    });
  },

  toStart() {
    this.playing = false; this.paused = true; this.spectator = false;
    const G = Game.create(this.world, { player: -1, humans: [], diff: 1 });
    G.S.observer = true;
    this.attach(G);
    this.ui.setPlaying(false);
    this.ui.closeModal(true);
    this.pickNation(this.startOpts.player, true);
  },
  pickNation(id, silent) {
    const mp = this.mp;
    if (mp && !silent) {
      const taken = mp.role === 'host' ? mp.guestCountry : mp.hostCountry;
      if (id === taken) { this.toast('Bu ülkeyi arkadaşın seçti.'); return; }
      if (mp.role === 'guest') mp.net.send({ t: 'pick', country: id });
    }
    this.startOpts.player = id;
    this.focusNation(id);
    this.ui.renderStart();
    if (this.isHost) this.sendLobby();
  },
  startGame() {
    if (this.isGuest) return;
    const humans = [this.startOpts.player];
    if (this.isHost && this.mp.guestCountry >= 0) humans.push(this.mp.guestCountry);
    const G = Game.create(this.world, { player: this.startOpts.player, humans, diff: this.startOpts.diff });
    this.enterGame(G);
    if (this.isHost) { this.mp.started = true; this.sendStart(); }
    const nat = this.world.nations[G.S.player];
    this.ui.popup({
      kicker: '1 Ocak 1936', title: `${nat.name} senin emrinde`,
      text: (this.mp ? 'Çevrim içi oyunda zamanı iki oyuncu da durdurup başlatabilir. ' : 'Zaman duraklatılmış durumda. ') + 'Önce bir ulusal hedef ve araştırmalar seç, inşaat kuyruğunu doldur; sonra Boşluk tuşuyla zamanı başlat. Üstteki sarı uyarılar eksikleri gösterir.',
      html: '<p class="small muted">Komşularına dikkat et: Militarist ve Kolektivist devletler birkaç yıl içinde saldırmaya başlar. Ordunu sınıra diz ya da Ordu panelinden otomatik cepheyi aç.</p>', yes: 'Göreve başla', no: 'Nasıl oynanır',
    }, null, () => this.ui.showHelp());
  },
  enterGame(G) {
    this.attach(G);
    this.playing = true; this.paused = true; this.speed = 3; this.acc = 0; this.spectator = false;
    this.ui.st.tab = null; this.ui.st.dipSel = -1;
    this.ui.setPlaying(true);
    if (G.S.player >= 0) this.focusNation(G.S.player);
  },

  // ---------- komutlar: tek oyunculuda yerelde, çok oyunculuda kurucuda çalışır
  cmd(name, ...args) {
    const G = this.G, me = this.me;
    if (!me || !this.playing || this.spectator) return;
    const msg = runCommand(G, me.id, name, args);
    if (this.isGuest) this.mp.net.send({ t: 'cmd', name, args });
    else { if (msg) this.toast(msg); if (this.isHost) this.mp.snapDue = true; }
    this.units.dirty = true;
  },

  // ---------- çok oyunculu
  mpHandlers() {
    return {
      onReady: () => { if (this.mp) { this.mp.ready = true; this.ui.renderStart(); } },
      onOpen: () => this.mpOpen(),
      onMessage: (m) => this.mpMessage(m),
      onClose: () => this.mpClosed(),
      onError: (text) => { const guest = this.isGuest; if (guest || !this.mp || !this.mp.ready) this.mpLeave(true); this.ui.popup({ kicker: 'Çevrim içi', title: 'Bağlantı kurulamadı', text }); this.ui.renderStart(); },
    };
  },
  mpHost(code) {
    if (this.mp) return;
    this.mp = { role: 'host', code: code || randomCode(), ready: false, connected: false, guestCountry: -1, hostCountry: this.startOpts.player, started: this.playing, lastSnap: 0, seq: 0 };
    this.mp.net = new Net(this.mpHandlers());
    this.mp.net.host(this.mp.code);
    if (this.playing) { this.me.human = true; this.ui.renderAll(); } else this.ui.renderStart();
  },
  mpJoin(code) {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (this.mp || code.length < 4) { this.toast('Geçerli bir oda kodu yaz.'); return; }
    this.mp = { role: 'guest', code, ready: false, connected: false, hostCountry: -1, guestCountry: -1, seq: 0 };
    this.mp.net = new Net(this.mpHandlers());
    this.mp.net.join(code);
    this.ui.renderStart();
  },
  mpLeave(silent) {
    const mp = this.mp;
    if (!mp) return;
    this.mp = null;
    mp.net.close();
    if (mp.role === 'guest' && this.playing) this.toStart();
    else if (!silent) { if (this.playing) this.ui.renderAll(); else this.ui.renderStart(); }
  },
  mpOpen() {
    const mp = this.mp;
    if (!mp) return;
    mp.connected = true; mp.lastHeard = 0; mp.net.open = true;
    if (mp.role === 'guest') mp.net.send({ t: 'hello', v: 3 });
    if (this.playing) this.ui.renderAll(); else this.ui.renderStart();
  },
  mpClosed() {
    const mp = this.mp;
    if (!mp) return;
    if (mp.role === 'guest') {
      this.mp = null; mp.net.close();
      const was = this.playing;
      this.toStart();
      this.ui.popup({ kicker: 'Çevrim içi', title: 'Bağlantı koptu', text: was ? 'Kurucuyla bağlantı kesildi. Aynı oda koduyla yeniden katılabilirsin; ülken seni bekler.' : 'Oda kapandı.' });
      return;
    }
    mp.connected = false;
    if (this.playing && mp.guestCountry >= 0) {
      const c = this.G.S.C[mp.guestCountry];
      c.human = false; recalcMods(this.G.S, c);
      this.toast(`Arkadaşının bağlantısı koptu. ${this.world.nations[c.id].name} yapay zekâya geçti; aynı kodla geri dönebilir.`);
      this.ui.renderAll();
    } else if (!this.playing) { mp.guestCountry = -1; this.ui.renderStart(); }
  },
  sendLobby() {
    const mp = this.mp;
    if (!mp || mp.role !== 'host' || !mp.connected) return;
    mp.hostCountry = this.playing ? this.G.S.player : this.startOpts.player;
    if (mp.guestCountry === mp.hostCountry) mp.guestCountry = -1;
    mp.net.send({ t: 'lobby', host: mp.hostCountry, guest: mp.guestCountry, diff: this.startOpts.diff, started: this.playing });
  },
  async sendStart() {
    const mp = this.mp;
    if (!mp || !mp.connected || mp.guestCountry < 0) return;
    const data = await pack(this.G.serialize());
    mp.net.send({ t: 'start', you: mp.guestCountry, paused: this.paused, speed: this.speed, seq: ++mp.seq, ...data });
  },
  async sendSnap() {
    const mp = this.mp;
    if (!mp || !mp.connected || mp.guestCountry < 0 || mp.packing) return;
    mp.packing = true; mp.snapDue = false; mp.lastSnap = performance.now();
    try {
      const data = await pack(this.G.serialize());
      if (this.mp === mp && mp.connected) mp.net.send({ t: 'snap', paused: this.paused, speed: this.speed, seq: ++mp.seq, ...data });
    } finally { mp.packing = false; }
  },
  async mpMessage(m) {
    const mp = this.mp;
    if (!mp || !m || typeof m !== 'object') return;
    mp.lastHeard = performance.now();
    if (m.t === 'ping') return;
    if (mp.role === 'host') {
      if (m.t === 'hello') {
        if (mp.started && mp.guestCountry >= 0 && this.G.S.C[mp.guestCountry].alive) {
          const c = this.G.S.C[mp.guestCountry];
          c.human = true; recalcMods(this.G.S, c);
          this.toast(`Arkadaşın yeniden bağlandı: ${this.world.nations[c.id].name}.`);
          this.sendStart();
        } else this.sendLobby();
        if (this.playing) this.ui.renderAll(); else this.ui.renderStart();
      } else if (m.t === 'pick') {
        const id = +m.country, host = this.playing ? this.G.S.player : this.startOpts.player;
        if (!(id >= 0 && id < this.world.nations.length) || id === host) { this.sendLobby(); return; }
        if (this.playing) {
          const c = this.G.S.C[id];
          if (!c.alive || c.capit) { this.sendLobby(); return; }
          mp.guestCountry = id; c.human = true; recalcMods(this.G.S, c);
          for (const d of this.G.S.divs) if (d.o === id) d.auto = true;
          this.toast(`Arkadaşın oyuna katıldı: ${this.world.nations[id].name}.`);
          this.sendStart(); this.ui.renderAll();
        } else { mp.guestCountry = id; this.sendLobby(); this.ui.renderStart(); }
      } else if (m.t === 'cmd' && this.playing && mp.guestCountry >= 0) {
        const msg = runCommand(this.G, mp.guestCountry, String(m.name), Array.isArray(m.args) ? m.args : []);
        if (msg) mp.net.send({ t: 'toast', text: msg });
        mp.snapDue = true; this.units.dirty = true;
      } else if (m.t === 'time' && this.playing) {
        if (typeof m.paused === 'boolean') this.paused = m.paused;
        if (m.speed >= 1 && m.speed <= 5) this.speed = Math.round(m.speed);
        mp.snapDue = true; this.ui.renderTop();
      }
      return;
    }
    // misafir
    if (m.t === 'full') { this.mpLeave(true); this.ui.popup({ kicker: 'Çevrim içi', title: 'Oda dolu', text: 'Bu odada zaten iki oyuncu var.' }); this.ui.renderStart(); }
    else if (m.t === 'lobby') {
      mp.hostCountry = m.host; mp.guestCountry = m.guest; mp.started = !!m.started;
      if (typeof m.diff === 'number') this.startOpts.diff = m.diff;
      if (mp.guestCountry >= 0) this.startOpts.player = mp.guestCountry;
      else if (this.startOpts.player === mp.hostCountry) this.startOpts.player = this.world.nations.findIndex((n, i) => i !== mp.hostCountry);
      if (!this.playing) this.ui.renderStart();
    } else if (m.t === 'toast') this.toast(String(m.text || ''));
    else if (m.t === 'start' || m.t === 'snap') {
      if (m.seq <= mp.seq) return;
      let S;
      try { S = JSON.parse(await unpack(m)); } catch (e) { return; }
      if (this.mp !== mp || m.seq <= mp.seq) return;
      mp.seq = m.seq;
      if (m.t === 'start') mp.you = m.you;
      if (mp.you === undefined) return;
      S.player = mp.you; S.observer = this.spectator;
      let G;
      try { G = Game.deserialize(this.world, S); } catch (e) { this.mpLeave(true); this.toStart(); this.ui.popup({ kicker: 'Çevrim içi', title: 'Sürüm uyuşmuyor', text: 'Kurucu ile oyun sürümün farklı. İkiniz de sayfayı yenileyin.' }); return; }
      const first = !this.playing;
      this.paused = !!m.paused; this.speed = m.speed || 3;
      if (first) {
        this.enterGame(G);
        this.paused = !!m.paused; this.speed = m.speed || 3;
        this.ui.closeModal(true);
        this.ui.popup({ kicker: 'Çevrim içi oyun', title: `${this.world.nations[mp.you].name} senin emrinde`, text: 'Oyunu kurucunun bilgisayarı yürütür; emirlerin anında iletilir. Zamanı ikiniz de durdurup başlatabilirsiniz.', yes: 'Göreve başla', no: 'Nasıl oynanır' }, null, () => this.ui.showHelp());
      } else { this.attach(G, true); this.processEvents(); }
      this.ui.renderAll();
    }
  },

  // ---------- kayıt
  hasSave() { return !!store.get(SAVE_KEY); },
  save(manual) {
    if (!this.playing || this.isGuest || this.G.S.observer) return;
    const ok = store.set(SAVE_KEY, this.G.serialize());
    if (manual) this.toast(ok ? 'Oyun kaydedildi.' : 'Kaydedilemedi: tarayıcı depolamaya izin vermiyor.');
  },
  loadSave() {
    if (this.isGuest) return;
    const raw = store.get(SAVE_KEY);
    if (!raw) { this.toast('Kayıt bulunamadı.'); return; }
    try {
      const G = Game.deserialize(this.world, raw);
      // kayıttaki diğer insan oyuncular bağlı değilse yapay zekâya geçer
      for (const c of G.S.C) if (c.human && c.id !== G.S.player) { c.human = false; recalcMods(G.S, c); }
      this.enterGame(G);
      if (this.isHost) { this.mp.started = true; this.mp.guestCountry = -1; this.sendLobby(); }
      this.toast('Kayıt yüklendi.');
    } catch (e) {
      this.ui.popup({ kicker: 'Hata', title: 'Kayıt yüklenemedi', text: 'Kayıt dosyası bozuk ya da eski bir sürüme ait. Yeni bir oyun başlatabilirsin.' });
    }
  },

  // ---------- olaylar: kayıt, barış önerileri, yenilgi ve zafer
  visibleLog(e) { const me = this.me; return !e.to || (me && e.to.includes(me.id)); },
  processEvents() {
    const G = this.G, S = G.S, me = this.me;
    if (!this.playing || !me) return;
    const name = this.world.nations[me.id].name;
    for (const e of S.log) {
      if (e.i <= this.logSeen) continue;
      this.logSeen = e.i;
      if (S.observer || !e.m || !this.visibleLog(e)) continue;
      if ((e.type === 'war' || e.type === 'peace') && e.text.includes(name)) {
        this.ui.popup({ kicker: e.type === 'war' ? 'Savaş' : 'Barış', title: e.type === 'war' ? 'Cepheden haber' : 'Silahlar sustu', text: e.text, war: e.type === 'war', yes: 'Tamam', no: e.prov >= 0 ? 'Haritada göster' : '' }, null, () => this.focusProv(e.prov));
      }
    }
    if (S.observer) return;
    for (const w of S.wars) {
      if (!w.offer || this.seenOffer[w.id] === w.offer || !(w.att.includes(me.id) || w.def.includes(me.id))) continue;
      this.seenOffer[w.id] = w.offer;
      this.ui.popup({ kicker: 'Barış teklifi', title: `${w.name}: karşı taraf barış istiyor`, text: 'Cephe uzun süredir durağan. Kabul edersen savaş mevcut hatlarda biter; herkes elindeki toprağı tutar.', yes: 'Barışı kabul et', no: 'Reddet' }, () => this.cmd('acceptPeace', w.id));
    }
    if (me.capit && !this.defeatShown) {
      this.defeatShown = true;
      this.ui.popup({ kicker: 'Yenilgi', title: 'Ülken teslim oldu', text: 'Başkentin ve şehirlerin düştü. Dünyanın geri kalanının kaderini gözlemci olarak izleyebilir ya da ana menüye dönebilirsin.', war: true, yes: 'Gözlemci olarak izle', no: 'Ana menü' },
        () => this.observe(), () => { if (this.mp) this.mpLeave(true); this.toStart(); });
    } else if (!this.winShown && !me.capit && vpShare(S, me) >= 0.6) {
      this.winShown = true;
      this.ui.popup({ kicker: 'Zafer', title: 'Dünya senin ittifakının', text: 'İttifakın dünya zafer puanlarının %60\'ını elinde tutuyor. Harekât başarıyla tamamlandı. İstersen oynamaya devam edebilirsin.', yes: 'Oynamaya devam et' });
    }
  },
  observe() {
    const S = this.G.S;
    this.spectator = true; S.observer = true;
    if (!this.isGuest) { const me = this.me; if (me) { me.human = false; recalcMods(S, me); } if (!this.mp) { this.paused = false; this.speed = 4; } }
    this.clearSelection(); this.G.unitsDirty = true; this.ui.renderAll();
  },
  toast(text) { this.ui.toast(text); },
  confirm(o, onYes) { this.ui.popup({ ...o, no: 'Vazgeç' }, () => { onYes(); this.ui.renderAll(); }); },

  // ---------- zaman
  setTime(paused, speed) {
    this.paused = paused; this.speed = speed;
    if (this.isGuest) this.mp.net.send({ t: 'time', paused, speed });
    else if (this.isHost) this.mp.snapDue = true;
    this.ui.renderTop();
  },
  setSpeed(n) { this.setTime(false, n); },
  togglePause() { this.setTime(!this.paused, this.speed); },

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
    const ids = this.selectedDivs().map((d) => d.id);
    if (!ids.length || prov < 0) return;
    this.cmd('move', ids, prov);
    const P = this.world.prov[prov];
    this.ring.position.set(P.cx, heightAt(this.world, P.cx, P.cy) + 2.5, P.cy);
    this.ring.userData.t = 0; this.ring.visible = true;
  },
  focusProv(p) { const P = this.world.prov[p]; if (P) this.map.focus(P.cx, P.cy, Math.min(this.map.cam.goalDist, 520)); },
  focusNation(id) {
    const c = this.G.S.C[id], nat = this.world.nations[id], P = this.world.prov[c.capital >= 0 ? c.capital : nat.capital];
    if (!P) return;
    const core = nat.provs.filter((i) => this.world.prov[i].core === id).length;
    this.map.focus(P.cx, P.cy, Math.max(230, Math.min(1100, 150 + Math.sqrt(core) * 120)));
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
    const pl = this.placement;
    if (!this.map.highlight || !this.map.highlight[p]) { this.toast('Bu eyalet uygun değil.'); return; }
    if (pl.type === 'deploy') { this.cmd('deploy', p); this.stopPlacement(); this.toast(`Yeni tümenler ${this.world.prov[p].name} eyaletinde konuşlanacak.`); return; }
    this.cmd('build', pl.type, p);
    this.refreshPlacement(); this.ui.renderAll();
    this.toast(`${BUILDING[pl.type].name} kuyruğa eklendi: ${this.world.prov[p].name}.`);
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
      else if (k === 'home' && this.me) this.focusNation(this.me.id);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('beforeunload', () => { if (this.mp) this.mp.net.close(); });
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
      const target = hit && hit.stack ? hit.stack.prov : pk ? pk.prov : -1;
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
    if (this.playing && !this.paused && !this.isGuest) {
      this.acc += dt * SPEEDS[this.speed];
      const t0 = performance.now();
      let n = 0;
      while (this.acc >= 1 && n < 400 && performance.now() - t0 < 16) { G.tickHour(); this.acc -= 1; n++; }
      if (this.acc > 48) this.acc = 48;
    }
    if (this.mp && this.mp.connected) {
      const mp = this.mp;
      if (mp.role === 'host' && this.playing && (mp.snapDue || (!this.paused && now - mp.lastSnap > SNAP_MS))) this.sendSnap();
      // kalp atışı: karşı taraf 15 sn sessiz kalırsa bağlantı kopmuş sayılır
      if (now - (mp.lastPing || 0) > 3000) { mp.lastPing = now; mp.net.send({ t: 'ping' }); }
      if (!mp.lastHeard) mp.lastHeard = now;
      else if (now - mp.lastHeard > 15000) { mp.lastHeard = 0; mp.net.open = false; this.mpClosed(); }
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
if (hot && hot.snapshot) hot.snapshot(() => (app.playing && app.G && !app.mp ? { save: app.G.serialize(), playing: true } : {}));
if (hot && hot.ready) hot.ready(start); else start();
