// Arayüz kabuğu: üst şerit, ray, paneller, seçim paneli, uyarılar, kayıt, küçük harita, pencereler.
import { IDEOLOGY, TERRAIN, BUILDING, RESOURCES, fmtDate, dateOf, MONTHS } from '../data.js';
import { ST_MOVE, ST_RETREAT, atWar, divStats, DIFF } from '../sim/core.js';
import * as eco from '../sim/economy.js';
import { factionOf } from '../sim/diplomacy.js';
import { MAP_MODES } from '../render/map.js';
import { MINI_W, MINI_H, MAP_W, MAP_H } from '../worldgen.js';
import { flagURL, icon } from './flags.js';
import { renderPanel, panelTitle, ACTS, fmt, pct, flagImg, relChip, HELP_HTML } from './panels.js';

const TABS = [['state', 'Devlet'], ['goals', 'Hedefler'], ['research', 'Araştırma'], ['production', 'Üretim'], ['build', 'İnşaat'], ['army', 'Ordu'], ['diplo', 'Diplomasi']];
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i></div>`;
const LOG_MS = 30000;
const SPEED_NAMES = ['', 'Çok yavaş', 'Yavaş', 'Normal', 'Hızlı', 'Çok hızlı'];

export class UI {
  constructor(app) {
    this.app = app;
    this.st = { tab: null, goalSel: null, resSlot: 0, techCat: 'ind', armyTab: 'rec', tplSel: 't_inf', dipSel: -1 };
    this.toasts = [];
    this.timers = { top: 0, panel: 0, side: 0, mini: 0, log: 0 };
    this.holding = false;
    const root = this.root = document.getElementById('app');
    root.insertAdjacentHTML('beforeend', `
      <div id="hud" hidden>
        <header id="topbar"></header>
        <nav id="rail" aria-label="Yönetim sekmeleri"></nav>
        <aside id="panel" hidden><div class="p-head"><h2 id="panel-title"></h2><button class="ibtn" data-act="closePanel" aria-label="Paneli kapat">${icon('close')}</button></div><div class="p-body" id="panel-body" data-scroll="panel"></div></aside>
        <aside id="side" hidden></aside>
        <div id="alerts"></div>
        <div id="banner" hidden></div>
        <div id="bl"><div id="log"></div><div id="hover"></div></div>
        <div id="br"><div id="modes"></div><canvas id="minimap" width="${MINI_W}" height="${MINI_H}" aria-label="Küçük harita"></canvas></div>
        <div id="selbox" hidden></div>
      </div>
      <div id="start" hidden></div>
      <div id="modal" hidden></div>
      <div id="tooltip" hidden></div>`);
    const $ = (id) => document.getElementById(id);
    this.el = { hud: $('hud'), top: $('topbar'), rail: $('rail'), panel: $('panel'), ptitle: $('panel-title'), pbody: $('panel-body'), side: $('side'), alerts: $('alerts'), banner: $('banner'), log: $('log'), hover: $('hover'), modes: $('modes'), mini: $('minimap'), selbox: $('selbox'), start: $('start'), modal: $('modal'), tip: $('tooltip') };
    this.miniCtx = this.el.mini.getContext('2d');
    this.miniImg = this.miniCtx.createImageData(MINI_W, MINI_H);
    this.bind();
  }

  bind() {
    const root = this.root;
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      const act = t.dataset.act;
      if (!act) return;
      e.preventDefault();
      this.dispatch(act, t.dataset.arg, t.dataset.arg2, t);
    });
    root.addEventListener('pointerdown', (e) => { if (e.target.closest('#hud > *:not(#selbox), #modal, #start')) this.holding = true; });
    window.addEventListener('pointerup', () => { setTimeout(() => { this.holding = false; if (this.pending) { this.pending = false; this.renderAll(); } }, 0); });
    window.addEventListener('pointercancel', () => { this.holding = false; });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const t = e.target.closest ? e.target.closest('[data-tip]') : null;
      const tip = this.el.tip;
      if (!t || !t.dataset.tip) { tip.hidden = true; return; }
      if (tip.textContent !== t.dataset.tip) tip.textContent = t.dataset.tip;
      tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, e.clientX + 14)) + 'px';
      tip.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, e.clientY + 16)) + 'px';
    });
    root.addEventListener('pointerleave', () => { this.el.tip.hidden = true; });
    const mini = this.el.mini;
    const miniGo = (e) => {
      const r = mini.getBoundingClientRect();
      this.app.map.focus(((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H);
    };
    mini.addEventListener('pointerdown', (e) => { mini.setPointerCapture(e.pointerId); this.miniDrag = true; miniGo(e); });
    mini.addEventListener('pointermove', (e) => { if (this.miniDrag) miniGo(e); });
    mini.addEventListener('pointerup', () => { this.miniDrag = false; });
  }

  dispatch(act, arg, arg2, el) {
    const app = this.app;
    const own = {
      tab: () => this.openTab(this.st.tab === arg ? null : arg),
      closePanel: () => this.openTab(null),
      speed: () => app.setSpeed(+arg),
      speedDelta: () => app.setSpeed(Math.max(1, Math.min(5, app.speed + +arg))),
      pause: () => app.togglePause(),
      mode: () => { app.map.setMode(arg, app.G); this.renderModes(); this.miniDirty = true; },
      logGo: () => { if (+arg >= 0) app.focusProv(+arg); },
      openDiplo: () => { const id = +arg; if (app.me && id === app.me.id) this.openTab('state'); else if (app.G.S.C[id] && app.G.S.C[id].alive) { this.st.dipSel = id; this.openTab('diplo'); } },
      closeSide: () => app.clearSelection(),
      modalClose: () => this.closeModal(),
      modalYes: () => { const fn = this.modalYes; this.closeModal(); if (fn) fn(); },
      modalNo: () => { const fn = this.modalNo; this.closeModal(); if (fn) fn(); },
      cancelPlace: () => app.stopPlacement(),
      halt: () => app.cmd('halt', app.selectedDivs().map((d) => d.id)),
      autoSel: () => { const ds = app.selectedDivs(); app.cmd('autoSet', ds.map((d) => d.id), !ds.every((d) => d.auto)); },
      disband: () => app.confirm({ kicker: 'Terhis', title: `${app.selection.size} tümen dağıtılsın mı?`, text: 'Askerler ve teçhizat depoya döner.', yes: 'Dağıt' }, () => { app.cmd('disband', app.selectedDivs().map((d) => d.id)); app.clearSelection(); }),
      selOne: () => { app.selection = new Set([+arg]); app.units.selected = app.selection; app.selChanged(); },
      selProvAll: () => app.selectProvince(+arg),
      quickBuild: () => app.cmd('build', arg, +arg2),
      setDeploy: () => app.cmd('deploy', +arg),
      startPick: () => app.pickNation(+arg),
      startDiff: () => { if (!app.isGuest) { app.startOpts.diff = +arg; this.renderStart(); app.sendLobby(); } },
      startGo: () => app.startGame(),
      startLoad: () => app.loadSave(),
      mpHost: () => app.mpHost(),
      mpJoin: () => { const el = document.getElementById('room-input'); app.mpJoin(el ? el.value : ''); },
      mpLeave: () => app.mpLeave(),
      mpCopy: () => { const code = app.mp ? app.mp.code : ''; const done = () => app.toast('Oda kodu kopyalandı: ' + code); try { navigator.clipboard.writeText(code).then(done, () => app.toast('Kod: ' + code)); } catch (e) { app.toast('Kod: ' + code); } },
      help: () => this.showHelp(),
    };
    if (own[act]) own[act]();
    else if (ACTS[act]) ACTS[act](app, arg, arg2, el);
    this.el.tip.hidden = true;
    this.holding = false;
    if (app.playing) this.renderAll();
  }

  setPlaying(on) {
    this.el.hud.hidden = !on;
    this.el.start.hidden = on;
    if (on) { this.renderRail(); this.renderModes(); this.renderAll(); this.miniDirty = true; }
  }

  openTab(tab) {
    this.st.tab = tab;
    if (tab !== 'build' && this.app.placement && this.app.placement.type !== 'deploy') this.app.stopPlacement();
    this.renderRail();
    this.renderPanel(true);
  }

  // ---------- çizim
  withScroll(container, html) {
    const keep = [];
    for (const n of [container, ...container.querySelectorAll('[data-scroll]')]) if (n.dataset && n.dataset.scroll) keep.push([n.dataset.scroll, n.scrollTop, n.scrollLeft]);
    container.innerHTML = html;
    for (const [k, t, l] of keep) {
      const n = container.dataset.scroll === k ? container : container.querySelector(`[data-scroll="${k}"]`);
      if (n) { n.scrollTop = t; n.scrollLeft = l; }
    }
  }
  renderAll() {
    if (!this.app.playing) return;
    if (this.holding) { this.pending = true; return; }
    this.renderTop(); this.renderPanel(); this.renderSide(); this.renderAlerts(); this.renderLog(); this.renderBanner();
  }
  renderRail() {
    const c = this.app.me;
    const dots = c ? { goals: !c.goal, research: c.research.some((r) => !r), production: c._milFree > 0, build: c._civIdle > 0 && !c.build.length } : {};
    this.el.rail.innerHTML = TABS.map(([k, n]) => `<button class="${this.st.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}">${icon(k)}<span>${n}</span>${dots[k] ? '<i class="dot"></i>' : ''}</button>`).join('')
      + `<span class="spacer"></span><button class="${this.st.tab === 'menu' ? 'on' : ''}" data-act="tab" data-arg="menu">${icon('menu')}<span>Menü</span></button>`;
  }
  renderTop() {
    const app = this.app, G = app.G, S = G.S, c = app.me, nat = app.world.nations[c.id];
    const f = factionOf(S, c);
    const stat = (label, val, tip, cls = '') => `<div class="stat" data-tip="${tip}"><i>${label}</i><b class="${cls}">${val}</b></div>`;
    const resS = Object.keys(RESOURCES).map((k) => stat(RESOURCES[k].name, (c._bal[k] > 0 ? '+' : '') + c._bal[k], `${RESOURCES[k].name}: üretim ${c._res[k]}, ithalat ${c.imports[k]}, ihtiyaç ${c._need[k]}`, c._bal[k] < 0 ? 'bad' : '')).join('');
    const d = dateOf(S.hours);
    this.el.top.innerHTML = `
      <button class="tb-nation" data-act="tab" data-arg="state" data-tip="Devlet panelini aç"><img src="${flagURL(nat)}" alt=""><span><b>${nat.name}</b><small>${S.observer ? 'Gözlemci' : IDEOLOGY[c.ideo].name}${f ? ' · ' + f.name : ''}${app.mp ? ` · <span class="${app.mp.connected ? 'acc' : 'warn'}">${app.mp.connected ? 'çevrim içi' : 'arkadaş bekleniyor'}</span>` : ''}</small></span></button>
      <div class="tb-stats">
        ${stat('Nüfuz', `${Math.floor(c.pp)}<small>+${c._ppGain.toFixed(1).replace('.', ',')}</small>`, 'Yasalar ve diplomasi için harcanır.')}
        ${stat('İstikrar', Math.round(c.stab) + '%', 'Üretimi ve nüfuz kazancını etkiler.')}
        ${stat('Savaş desteği', Math.round(c.ws) + '%', 'Teslim olma eşiğini etkiler.')}
        ${stat('Asker', fmt(Math.max(0, c._mpFree)), 'Askere alınabilir serbest nüfus.', c._mpFree < 10000 ? 'warn' : '')}
        ${stat('Fabrika', `${c._civ}<small>sivil</small> ${c._mil}<small>askeri</small>`, 'Sivil fabrikalar inşaat yapar, askeri fabrikalar teçhizat üretir.')}
        ${stat('Tümen', c._nDiv, 'Sahadaki tümen sayısı.')}
        ${resS}
        ${stat('Gerginlik', Math.round(S.tension) + '%', 'Küresel gerginlik.', S.tension > 60 ? 'bad' : '')}
      </div>
      <div class="tb-time">
        <div class="date"><b>${d.day} ${MONTHS[d.month]} ${d.year}</b><small class="${app.paused ? 'paused' : ''}">${app.paused ? 'Duraklatıldı' : SPEED_NAMES[app.speed]} · ${String(d.hour).padStart(2, '0')}:00</small></div>
        <div class="speed">
          <button class="ibtn ${app.paused ? 'on' : ''}" data-act="pause" data-tip="Duraklat / sürdür (Boşluk)" aria-label="Duraklat ya da sürdür">${icon(app.paused ? 'play' : 'pause')}</button>
          <div class="pips">${[1, 2, 3, 4, 5].map((i) => `<button class="${i <= app.speed ? 'on' : ''}" data-act="speed" data-arg="${i}" aria-label="Hız ${i}" data-tip="Hız ${i}: ${SPEED_NAMES[i]}"></button>`).join('')}</div>
        </div>
      </div>`;
  }
  renderPanel(force) {
    const tab = this.st.tab, el = this.el;
    el.panel.hidden = !tab;
    if (!tab) return;
    if (!force && document.activeElement && document.activeElement.tagName === 'INPUT') return;
    el.panel.classList.toggle('wide', tab === 'goals');
    el.panel.classList.toggle('mid', tab === 'research');
    el.ptitle.textContent = panelTitle(tab);
    if (force) el.pbody.scrollTop = 0;
    this.withScroll(el.pbody, renderPanel(this.app, tab));
  }
  renderModes() {
    this.el.modes.innerHTML = MAP_MODES.map((m) => `<button class="btn ${this.app.map.mode === m.id ? 'on' : ''}" data-act="mode" data-arg="${m.id}">${m.name}</button>`).join('');
  }
  renderBanner() {
    const p = this.app.placement, el = this.el.banner;
    el.hidden = !p;
    if (p) el.innerHTML = `<span>${p.type === 'deploy' ? 'Konuşlanma yeri' : BUILDING[p.type].name}: parlayan eyaletlerden birini seç</span><button class="btn sm" data-act="cancelPlace">Bitir (Esc)</button>`;
  }
  renderAlerts() {
    const app = this.app, c = app.me, S = app.G.S;
    if (S.observer) { this.el.alerts.innerHTML = ''; return; }
    const a = [];
    if (!c.goal) a.push(['Ulusal hedef seçilmedi', 'goals']);
    if (c.research.some((r) => !r)) a.push(['Boş araştırma yuvası', 'research']);
    if (c._milFree > 0) a.push([`${c._milFree} atanmamış askeri fabrika`, 'production']);
    if (!c.build.length && c._civFree > 0) a.push(['İnşaat kuyruğu boş', 'build']);
    if (Object.values(c._bal).some((v) => v < 0)) a.push(['Kaynak açığı', 'production']);
    if (c.wargoals.length) a.push(['Savaş gerekçesi hazır', 'diplo']);
    const threat = S.C.find((o) => o.alive && !o.capit && (o.just.some((j) => j.target === c.id) || o.wargoals.includes(c.id)));
    if (threat) a.push([`${app.world.nations[threat.id].name} bize karşı hazırlanıyor`, 'diplo', 'red']);
    this.el.alerts.innerHTML = a.slice(0, 5).map(([t, tab, cls]) => `<button class="${cls || ''}" data-act="tab" data-arg="${tab}">${t}</button>`).join('');
    this.renderRail();
  }
  // Sol alttaki bildirimler: her kayıt ilk göründüğü andan 30 saniye sonra kendiliğinden kaybolur.
  resetLog(S) {
    this.logAt = new Map();
    for (const e of S.log) this.logAt.set(e.i, -1e12); // oyuna girerken eski kayıtları gösterme
    this.logHtml = null;
  }
  renderLog() {
    const S = this.app.G.S, now = performance.now();
    if (!this.logAt) this.logAt = new Map();
    const items = [];
    for (const e of S.log) {
      if (!this.app.visibleLog(e)) continue;
      let t = this.logAt.get(e.i);
      if (t === undefined) { t = now; this.logAt.set(e.i, t); }
      if (now - t < LOG_MS) items.push(e);
    }
    if (this.logAt.size > 400) { const min = (S.logSeq || 0) - 200; for (const k of this.logAt.keys()) if (k < min) this.logAt.delete(k); }
    const html = this.toasts.map((t) => `<button class="warn">${t.text}</button>`).join('')
      + items.slice(-4).map((e) => `<button class="${e.type}" data-act="logGo" data-arg="${e.prov}"><time>${fmtDate(e.t)}</time>${e.text}</button>`).join('');
    if (html !== this.logHtml) { this.logHtml = html; this.el.log.innerHTML = html; }
  }
  toast(text) {
    const t = { text };
    this.toasts.push(t);
    setTimeout(() => { this.toasts = this.toasts.filter((x) => x !== t); this.renderLog(); }, 5000);
    this.renderLog();
  }
  setHover(p) {
    const app = this.app, W = app.world;
    if (p < 0 || !app.playing) { this.el.hover.textContent = ''; this.el.hover.hidden = true; return; }
    const P = W.prov[p];
    this.el.hover.hidden = false;
    this.el.hover.textContent = P.land ? `${P.name} · ${TERRAIN[P.terrain].name} · ${W.nations[app.G.S.ctrl[p]].name}${P.vp > 1 ? ' · ' + P.vp + ' zafer puanı' : ''}` : P.name;
  }

  // ---------- sağ panel
  renderSide() {
    const app = this.app, G = app.G, S = G.S, W = app.world, el = this.el.side;
    const head = (t, sub = '') => `<div class="p-head"><h2>${t}${sub ? `<small>${sub}</small>` : ''}</h2><button class="ibtn" data-act="closeSide" aria-label="Kapat">${icon('close')}</button></div>`;
    const unitRow = (d, clickable) => {
      const st = divStats(S, d);
      const status = d.st === ST_RETREAT ? 'Çekiliyor' : d.b >= 0 ? 'Saldırıyor' : d.nos > 2 ? 'İkmalsiz' : d.st === ST_MOVE ? (d.p >= W.NL ? 'Denizde' : 'Yürüyor') : S._bByProv.has(d.p) ? 'Savunuyor' : d.auto && d.o === S.player ? 'Otomatik' : 'Bekliyor';
      const tag = clickable ? 'button' : 'div';
      return `<${tag} class="unit" ${clickable ? `data-act="selOne" data-arg="${d.id}"` : ''} data-tip="Saldırı ${Math.round(st.atk)} · Savunma ${Math.round(st.def)} · Yarma ${Math.round(st.brk)}&#10;Teşkilat ${pct(d.g)} · Güç ${pct(d.s)}">
        <span>${d.n}</span><span class="tiny ${d.b >= 0 ? 'warn' : d.nos > 2 || d.st === ST_RETREAT ? 'bad' : 'muted'}">${status}</span>
        <span class="bars">${bar(d.g, 'g')}${bar(d.s, 'w')}</span></${tag}>`;
    };
    const side = app.side;
    let html = '';
    if (app.selection.size) {
      const ds = app.selectedDivs();
      if (!ds.length) { app.clearSelection(); return; }
      const org = ds.reduce((s, d) => s + d.g, 0) / ds.length, str = ds.reduce((s, d) => s + d.s, 0) / ds.length;
      const allAuto = ds.every((d) => d.auto);
      html = head(`${ds.length} tümen`, 'seçili') + `<div class="p-body">
        <div class="kv small"><span>Ortalama teşkilat</span><span>${pct(org)}</span></div>${bar(org, 'g')}
        <div class="kv small"><span>Ortalama güç</span><span>${pct(str)}</span></div>${bar(str, 'w')}
        <div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="halt" data-tip="Emri iptal et, yerinde kal">Durdur</button>
          <button class="btn sm ${allAuto ? 'on' : ''}" data-act="autoSel" data-tip="Açıkken tümenler cepheye kendiliğinden dağılır ve saldırır.">Otomatik cephe: ${allAuto ? 'açık' : 'kapalı'}</button>
          <button class="btn sm danger" data-act="disband">Dağıt</button></div>
        <div class="note">Sağ tıkla hedef göster. Düşman eyaletine yürüyen tümen saldırır.</div>
        <div class="list">${ds.slice(0, 40).map((d) => unitRow(d, true)).join('')}${ds.length > 40 ? `<div class="tiny muted">…ve ${ds.length - 40} tümen daha</div>` : ''}</div></div>`;
    } else if (side && side.kind === 'battle') {
      const b = S.battles.find((x) => x.id === side.id);
      if (!b || b.ao === undefined) { app.side = null; el.hidden = true; return; }
      const atts = b.att.map((id) => S._byId.get(id)).filter(Boolean);
      const defs = S._pd[b.prov].filter((d) => d.st !== ST_RETREAT && atWar(S, b.ao, d.o));
      const m = b.mods || {};
      html = head(`${W.prov[b.prov].name} Muharebesi`) + `<div class="p-body">
        <div class="row">${flagImg(app, b.ao)}<span class="grow">${W.nations[b.ao].name} <span class="muted">saldırıyor</span></span><b>${atts.length}</b></div>
        <div class="row">${flagImg(app, b.do)}<span class="grow">${W.nations[b.do].name} <span class="muted">savunuyor</span></span><b>${defs.length}</b></div>
        <div class="kv small"><span>Saldıranın üstünlüğü</span><span class="${b.w >= 50 ? 'good' : 'bad'}">${b.w} / 100</span></div>${bar(b.w / 100, b.w >= 50 ? 'g' : 'd')}
        <div class="tiny muted">Arazi ve tahkimat: saldırı ×${(m.terr || 1).toFixed(2)} · Yön sayısı: ×${(m.flank || 1).toFixed(2)}${m.amph ? ' · Çıkarma harekâtı' : ''} · ${Math.max(1, Math.round((S.hours - b.start) / 24))}. gün</div>
        <div class="sec"><h3>Saldıranlar</h3><div class="list">${atts.slice(0, 12).map((d) => unitRow(d, false)).join('')}</div></div>
        <div class="sec"><h3>Savunanlar</h3><div class="list">${defs.slice(0, 12).map((d) => unitRow(d, false)).join('')}</div></div></div>`;
    } else if (side && side.kind === 'stack') {
      const ds = S.divs.filter((d) => d.o === side.owner && d.p === side.prov && !d.dead);
      if (!ds.length) { app.side = null; el.hidden = true; return; }
      html = head(W.nations[side.owner].name, `${ds.length} tümen`) + `<div class="p-body"><button class="item natlink" data-act="openDiplo" data-arg="${side.owner}" data-tip="${W.nations[side.owner].name} ile diplomasi sayfasını aç">${flagImg(app, side.owner)}<span class="grow"><b>${W.nations[side.owner].name}</b> <span class="muted">· ${W.prov[side.prov].name}</span></span>${relChip(app, side.owner)}<span class="tiny acc">Diplomasi ›</span></button>
        <div class="list">${ds.slice(0, 30).map((d) => unitRow(d, false)).join('')}</div></div>`;
    } else if (side && side.kind === 'prov') {
      const p = side.prov, P = W.prov[p];
      if (!P.land) html = head(P.name) + `<div class="p-body"><div class="small muted">Deniz bölgesi. Birlikler limanlı eyaletlerden buraya açılabilir.</div></div>`;
      else {
        const o = S.owner[p], k = S.ctrl[p], c = app.me;
        const mine = k === c.id && o === c.id && !S.observer;
        const slots = eco.provSlots(G, S.C[k], p), used = S.civ[p] + S.mil[p] + S.dock[p];
        const here = new Map();
        for (const d of S._pd[p]) if (app.units.vis[p]) here.set(d.o, (here.get(d.o) || 0) + 1);
        const quick = mine ? `<div class="sec"><h3>Buraya inşa et</h3><div class="row" style="flex-wrap:wrap">${Object.keys(BUILDING).map((t) => `<button class="btn sm ${eco.canBuild(G, c, t, p) ? '' : 'off'}" data-act="${eco.canBuild(G, c, t, p) ? 'quickBuild' : ''}" data-arg="${t}" data-arg2="${p}" data-tip="${BUILDING[t].desc}">${BUILDING[t].name}</button>`).join('')}</div>
          <div class="row"><button class="btn sm ${c.deploy === p ? 'on' : ''}" data-act="setDeploy" data-arg="${p}" data-tip="Yeni eğitilen tümenler burada göreve başlar.">Konuşlanma yeri yap</button></div></div>` : '';
        html = head(P.name, TERRAIN[P.terrain].name) + `<div class="p-body">
          <button class="item natlink" data-act="openDiplo" data-arg="${k}" data-tip="${k === c.id ? 'Devlet panelini aç' : W.nations[k].name + ' ile diplomasi sayfasını aç'}">${flagImg(app, k)}<span class="grow"><b>${W.nations[k].name}</b>${k !== o ? ' <span class="tiny warn">işgalinde</span>' : ''}</span>${relChip(app, k)}<span class="tiny acc">${k === c.id ? 'Devlet' : 'Diplomasi'} ›</span></button>
          ${k !== o ? `<button class="item natlink" data-act="openDiplo" data-arg="${o}" data-tip="${W.nations[o].name} ile diplomasi sayfasını aç">${flagImg(app, o)}<span class="grow">Sahibi: <b>${W.nations[o].name}</b></span>${relChip(app, o)}<span class="tiny acc">${o === c.id ? 'Devlet' : 'Diplomasi'} ›</span></button>` : ''}
          <div class="kv small"><span>Zafer puanı</span><span>${P.vp}${P.capitalOf !== undefined ? ' · başkent' : ''}</span></div>
          <div class="kv small"><span>Nüfus</span><span>${fmt(S.pop[p])}</span></div>
          <div class="kv small"><span>Altyapı · tahkimat · liman</span><span>${S.infra[p]} · ${S.fort[p]} · ${S.port[p] ? 'var' : 'yok'}</span></div>
          <div class="kv small"><span>Fabrika (sivil / askeri / tersane)</span><span>${S.civ[p]} / ${S.mil[p]} / ${S.dock[p]} <span class="muted">· ${used}/${slots} yuva</span></span></div>
          <div class="kv small"><span>Çelik · petrol · alüminyum</span><span>${S.rs[p]} · ${S.ro[p]} · ${S.ra[p]}</span></div>
          <div class="tiny muted">Arazi saldırana ${Math.round(TERRAIN[P.terrain].atk * 100)}% etki eder${P.coastal ? ' · kıyı eyaleti' : ''}.</div>
          ${here.size ? `<div class="sec"><h3>Buradaki birlikler</h3>${[...here].map(([oid, n]) => `<div class="row">${flagImg(app, oid)}<span class="grow">${W.nations[oid].name}</span><b>${n}</b>${oid === c.id && !S.observer ? `<button class="btn sm" data-act="selProvAll" data-arg="${p}">Seç</button>` : ''}</div>`).join('')}</div>` : ''}
          ${quick}</div>`;
      }
    }
    el.hidden = !html;
    if (html) this.withScroll(el, html.replace('class="p-body"', 'class="p-body" data-scroll="side"'));
  }

  // ---------- küçük harita
  drawMinimap() {
    const app = this.app, W = app.world, S = app.G.S, img = this.miniImg, d = img.data, mini = W.mini;
    if (this.miniDirty) {
      for (let i = 0; i < MINI_W * MINI_H; i++) {
        const p = mini[i];
        let r = 18, g = 38, b = 50;
        if (p < W.NL) { const c = W.nations[S.ctrl[p]].color; r = c[0]; g = c[1]; b = c[2]; }
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      this.miniDirty = false;
    }
    const g = this.miniCtx;
    g.putImageData(img, 0, 0);
    const map = app.map, r = map.canvas.getBoundingClientRect();
    const pts = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]].map(([x, y]) => map.groundAt(x, y));
    if (pts.every(Boolean)) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.2;
      g.beginPath();
      pts.forEach((p, i) => { const x = (p.x / MAP_W) * MINI_W, y = (p.z / MAP_H) * MINI_H; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath(); g.stroke();
    }
  }

  frame(dt) {
    const t = this.timers, app = this.app;
    if (!app.playing) return;
    t.top += dt; t.panel += dt; t.mini += dt;
    if (t.top > 0.25) { t.top = 0; if (!this.holding) { this.renderTop(); this.renderSide(); } }
    if (t.panel > 0.7 && !app.paused) { t.panel = 0; if (!this.holding) { this.renderPanel(); this.renderAlerts(); } }
    if (t.mini > 0.2) { t.mini = 0; this.drawMinimap(); }
    t.log += dt;
    if (t.log > 1) { t.log = 0; if (!this.holding) this.renderLog(); } // süresi dolan bildirimleri kaldır
  }

  // ---------- pencereler
  showModal(html, onYes, onNo) {
    const app = this.app;
    if (this.el.modal.hidden && !app.mp && app.playing) { this.wasPaused = app.paused; app.paused = true; this.pausedByModal = true; }
    this.modalYes = onYes; this.modalNo = onNo;
    this.el.modal.innerHTML = html;
    this.el.modal.hidden = false;
    const b = this.el.modal.querySelector('.btn.pri') || this.el.modal.querySelector('.btn');
    if (b) b.focus();
  }
  closeModal(all) {
    if (all) this.queue = [];
    if (this.el.modal.hidden) return;
    this.el.modal.hidden = true;
    if (this.pausedByModal) { this.pausedByModal = false; if (!this.app.mp) this.app.paused = this.wasPaused; }
    if (this.queue && this.queue.length) { const q = this.queue.shift(); this.showModal(q[0], q[1], q[2]); }
    else if (this.app.playing) this.renderTop();
  }
  popup(o, onYes, onNo) {
    const html = `<div class="dialog ${o.war ? 'war' : ''}" role="dialog" aria-modal="true"><div class="kicker">${o.kicker || ''}</div><h2>${o.title}</h2>${o.text ? `<p>${o.text}</p>` : ''}${o.html || ''}
      <div class="row">${o.no ? `<button class="btn" data-act="modalNo">${o.no}</button>` : ''}<button class="btn pri" data-act="modalYes">${o.yes || 'Tamam'}</button></div></div>`;
    if (!this.el.modal.hidden) { (this.queue || (this.queue = [])).push([html, onYes, onNo]); return; }
    this.showModal(html, onYes, onNo);
  }
  showHelp() { this.popup({ kicker: 'Kılavuz', title: 'Nasıl oynanır', html: HELP_HTML, yes: 'Anladım' }); }

  // ---------- giriş ekranı
  renderStart() {
    const app = this.app, W = app.world, S = app.G.S, o = app.startOpts, mp = app.mp;
    const taken = mp ? (mp.role === 'host' ? mp.guestCountry : mp.hostCountry) : -1;
    const item = (n) => { const c = S.C[n.id]; return `<button class="item ${o.player === n.id ? 'sel' : ''} ${taken === n.id ? 'off' : ''}" data-act="startPick" data-arg="${n.id}">${flagImg(app, n.id)}<span class="grow">${n.name}</span>${taken === n.id ? '<span class="tiny warn">arkadaşın</span>' : `<span class="tiny" style="color:${IDEOLOGY[n.ideo].color}">${IDEOLOGY[n.ideo].name}</span>`}<span class="tiny muted num">${c._nDiv} tümen</span></button>`; };
    const minors = W.nations.filter((x) => !x.major && S.C[x.id].alive).sort((a, b) => b.pop - a.pop);
    const n = W.nations[o.player], c = S.C[o.player];
    let online;
    if (!mp) online = `<div class="row" style="flex-wrap:wrap"><button class="btn" data-act="mpHost" data-tip="Bir oda kodu üretir; arkadaşın bu kodla katılır.">Oda kur</button><span class="seed" style="flex:1;min-width:150px"><input id="room-input" placeholder="Oda kodu" aria-label="Oda kodu" maxlength="12" autocomplete="off" autocapitalize="characters"><button class="btn" data-act="mpJoin">Katıl</button></span></div>
      <div class="tiny muted">Arkadaşınla aynı dünyada iki ayrı ülkeyi yönetirsiniz. Oyunu odayı kuranın bilgisayarı yürütür.</div>`;
    else if (mp.role === 'host') online = `<div class="row"><span class="grow">Oda kodu <b class="code">${mp.ready ? mp.code : '…'}</b></span><button class="btn sm" data-act="mpCopy">Kopyala</button><button class="btn sm" data-act="mpLeave">Kapat</button></div>
      <div class="small ${mp.connected ? 'acc' : 'warn'}">${!mp.ready ? 'Oda açılıyor…' : mp.connected ? (mp.guestCountry >= 0 ? `Arkadaşın bağlandı: ${W.nations[mp.guestCountry].name}` : 'Arkadaşın bağlandı, ülkesini seçiyor…') : 'Kodu arkadaşına gönder; katılması bekleniyor…'}</div>`;
    else online = `<div class="row"><span class="grow">Oda <b class="code">${mp.code}</b></span><button class="btn sm" data-act="mpLeave">Ayrıl</button></div>
      <div class="small ${mp.connected ? 'acc' : 'warn'}">${!mp.connected ? 'Bağlanılıyor…' : mp.guestCountry < 0 ? (mp.started ? 'Oyun sürüyor. Soldan bir ülke seç, hemen katıl.' : 'Bağlandın. Soldan ülkeni seç.') : `Ülken: ${W.nations[mp.guestCountry].name}. Kurucunun oyunu başlatması bekleniyor…`}${mp.connected && mp.hostCountry >= 0 ? ` Kurucu: ${W.nations[mp.hostCountry].name}.` : ''}</div>`;
    const guest = mp && mp.role === 'guest';
    const prev = this.el.start.querySelector('[data-scroll="nations"]'), keepTop = prev ? prev.scrollTop : 0, roomEl = document.getElementById('room-input'), roomVal = roomEl ? roomEl.value : '';
    this.el.start.innerHTML = `
      <div class="st-left">
        <div class="st-title"><div class="kicker">Büyük strateji · 1936</div><h1>Meridyen Harekâtı</h1><p>Gerçek dünya haritası, altmışı aşkın devlet, yedi büyük güç. Bir ülke seç; sanayini kur, ordunu eğit, ittifakını seç ve haritayı yeniden çiz. Tek başına ya da bir arkadaşınla çevrim içi.</p></div>
        <div class="st-list" data-scroll="nations"><h3>Büyük güçler</h3>${W.nations.filter((x) => x.major).map(item).join('')}<h3>Diğer devletler</h3>${minors.map(item).join('')}</div>
      </div>
      <div class="st-right">
        <div class="row">${flagImg(app, n.id, 'big')}<div class="grow"><h2>${n.name}</h2><div class="small muted">${n.long} · başkent ${n.cap}</div></div></div>
        <div class="small"><b style="color:${IDEOLOGY[n.ideo].color}">${IDEOLOGY[n.ideo].name}.</b> ${IDEOLOGY[n.ideo].desc}</div>
        <div class="kv small"><span>Eyalet · nüfus</span><span>${c._nProv} · ${fmt(c._pop)}</span></div>
        <div class="kv small"><span>Sivil / askeri fabrika · tersane</span><span>${c._civ} / ${c._mil} · ${c._dock}</span></div>
        <div class="kv small"><span>Tümen · donanma gücü</span><span>${c._nDiv} · ${fmt(c.naval)}</span></div>
        <div class="kv small"><span>Çelik · petrol · alüminyum</span><span>${c._res.steel} · ${c._res.oil} · ${c._res.alu}</span></div>
        <div class="sec"><h3>Zorluk</h3><div class="tabs">${DIFF.map((d, i) => `<button class="btn ${o.diff === i ? 'on' : ''} ${guest ? 'off' : ''}" data-act="${guest ? '' : 'startDiff'}" data-arg="${i}">${d.name}</button>`).join('')}</div></div>
        <div class="sec"><h3>Çevrim içi</h3>${online}</div>
        <div class="row" style="flex-wrap:wrap">${guest ? '<button class="btn pri off" style="flex:1;padding:9px 12px;font-size:17px">Kurucu bekleniyor</button>' : `<button class="btn pri" data-act="startGo" style="flex:1;padding:9px 12px;font-size:17px">${n.name} ile başla</button>`}</div>
        <div class="row" style="flex-wrap:wrap">${!guest && app.hasSave() ? '<button class="btn" data-act="startLoad">Kayıtlı oyuna devam et</button>' : ''}<button class="btn" data-act="help">Nasıl oynanır</button></div>
      </div>`;
    const list = this.el.start.querySelector('[data-scroll="nations"]');
    if (list) list.scrollTop = keepTop;
    const re = document.getElementById('room-input');
    if (re && roomVal) re.value = roomVal;
  }
}
