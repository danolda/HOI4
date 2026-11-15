// Sol panel içerikleri ve oyuncu eylemleri.
import { IDEOLOGY, LAWS, TECHS, TECH_BY_ID, TECH_CATS, GOALS, GOAL_BY_ID, GOAL_BRANCHES, EQUIP, EQ_KEYS, BUILDING, BATTALION, BAT_KEYS, MAX_BATS, MOD_LABEL, MOD_FLAT, RESOURCES, FACTION_NAMES, fmtDate } from '../data.js';
import { atWar, isFriend, tplOf, tplStats, tplAllowed, refreshAll, vpShare, DIFF } from '../sim/core.js';
import * as eco from '../sim/economy.js';
import * as dip from '../sim/diplomacy.js';
import { flagURL, icon } from './flags.js';

export const fmt = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(2).replace('.', ',') + ' Mn';
  if (a >= 1e4) return Math.round(v / 1e3) + ' B';
  return Math.round(v).toLocaleString('tr-TR');
};
export const pct = (v) => Math.round(v * 100) + '%';
const sign = (v) => (v > 0 ? '+' : '') + v;
export const flagImg = (app, id, cls = '') => `<img class="flag ${cls}" src="${flagURL(app.world.nations[id])}" alt="">`;
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i></div>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const btn = (label, act, arg, o = {}) => `<button class="btn ${o.cls || ''} ${o.off ? 'off' : ''}" data-act="${o.off ? '' : act}" data-arg="${arg ?? ''}" ${o.arg2 !== undefined ? `data-arg2="${o.arg2}"` : ''} ${o.tip ? `data-tip="${esc(o.tip)}"` : ''}>${label}</button>`;

export function fxText(fx) {
  const out = [];
  for (const k in fx) {
    if (!MOD_LABEL[k]) continue;
    const v = fx[k];
    out.push(`${MOD_LABEL[k]} ${MOD_FLAT[k] ? sign(v) : sign(Math.round(v * 100)) + '%'}`);
  }
  return out;
}

// ---------------- Devlet
function panelState(app) {
  const G = app.G, S = G.S, c = app.me, nat = app.world.nations[c.id];
  const f = dip.factionOf(S, c);
  const law = (kind, title) => `<div class="sec"><h3>${title}</h3><div class="list">${LAWS[kind].map((L, i) => {
    const cur = c.laws[kind] === i, ok = eco.lawAllowed(G, c, kind, i);
    const why = cur ? 'Yürürlükte' : ok ? `${L.cost} nüfuz` : c.pp < L.cost ? `${L.cost} nüfuz gerekli` : L.need === 'war' ? 'Yalnızca savaşta' : 'Gerginlik %25 veya savaş gerekli';
    return `<button class="item ${cur ? 'sel' : ''} ${!cur && !ok ? 'off' : ''}" data-act="${!cur && ok ? 'law' : ''}" data-arg="${kind}" data-arg2="${i}" data-tip="${esc(L.desc)}"><span class="grow">${L.name}</span><span class="tiny ${cur ? 'acc' : 'muted'}">${why}</span></button>`;
  }).join('')}</div></div>`;
  const wars = dip.warsOf(S, c.id);
  return `
  <div class="row">${flagImg(app, c.id, 'big')}<div class="grow"><h4 style="margin:0;font-size:18px">${nat.long}</h4><div class="small muted">${nat.leader}</div>
    <div class="small"><span style="color:${IDEOLOGY[c.ideo].color}">${IDEOLOGY[c.ideo].name}</span> · ${f ? f.name : 'İttifaksız'}</div></div></div>
  <div class="sec"><h3>Ulusun durumu</h3>
    <div class="kv"><span data-tip="Fabrika verimini ve nüfuz kazancını etkiler.">İstikrar</span><span>${Math.round(c.stab)}%</span></div>${bar(c.stab / 100, 'g')}
    <div class="kv"><span data-tip="Teslim olma eşiğini ve birliklerin toparlanmasını etkiler.">Savaş desteği</span><span>${Math.round(c.ws)}%</span></div>${bar(c.ws / 100, 'w')}
    <div class="kv"><span data-tip="İttifakınla dünya zafer puanlarının %60'ını tutarsan kazanırsın.">İttifakın dünya payı</span><span>${pct(vpShare(S, c))} / 60%</span></div>${bar(vpShare(S, c) / 0.6)}
  </div>
  <div class="sec"><h3>Özet</h3>
    <div class="kv"><span>Eyalet</span><span>${c._nProv}</span></div>
    <div class="kv"><span>Nüfus</span><span>${fmt(c._pop)}</span></div>
    <div class="kv"><span>Askere alınabilir</span><span>${fmt(Math.max(0, c._mpFree))} / ${fmt(c._mpMax)}</span></div>
    <div class="kv"><span>Sivil / askeri fabrika / tersane</span><span>${c._civ} / ${c._mil} / ${c._dock}</span></div>
    <div class="kv"><span>Tümen</span><span>${c._nDiv}</span></div>
    <div class="kv"><span>Verilen / verdirilen kayıp</span><span>${fmt(c.lost)} / ${fmt(c.kills)}</span></div>
  </div>
  ${wars.length ? `<div class="sec"><h3>Savaşlar</h3>${wars.map((w) => {
    const mine = w.att.includes(c.id) ? w.att : w.def, theirs = w.att.includes(c.id) ? w.def : w.att;
    const lead = theirs.find((x) => S.C[x].alive && !S.C[x].capit);
    return `<div class="card"><h4>${w.name}</h4><div class="tiny muted">${fmtDate(w.start)} tarihinden beri</div>
      <div class="row" style="flex-wrap:wrap">${mine.map((x) => flagImg(app, x)).join('')}<span class="muted">karşı</span>${theirs.map((x) => `<span style="opacity:${S.C[x].capit ? 0.35 : 1}">${flagImg(app, x)}</span>`).join('')}</div>
      ${lead !== undefined ? `<div class="row">${btn('Barış teklif et', 'peace', lead, { tip: 'Mevcut hatlarda barış: herkes elindeki toprağı tutar. Karşı taraf güç dengesine göre karar verir.' })}</div>` : ''}</div>`;
  }).join('')}</div>` : ''}
  ${law('cons', 'Askerlik yasası')}${law('eco', 'Ekonomi yasası')}`;
}

// ---------------- Hedefler
function panelGoals(app) {
  const G = app.G, c = app.me, st = app.ui.st;
  const cur = c.goal ? GOAL_BY_ID[c.goal.id] : null;
  const cells = GOALS.map((g) => {
    const done = c.goalsDone.includes(g.id), run = cur && cur.id === g.id, av = eco.goalAvailable(G, c, g);
    return `<button class="goal ${done ? 'done' : run ? 'run' : av ? '' : 'lock'} ${g.y === 0 ? 'root' : ''} ${st.goalSel === g.id ? 'sel' : ''}" style="grid-column:${g.x + 1};grid-row:${g.y + 2}" data-act="goalSel" data-arg="${g.id}">
      <span>${g.name}</span>${run ? bar(c.goal.prog, 'w') : done ? '<span class="tiny">Tamamlandı</span>' : ''}</button>`;
  }).join('');
  const heads = GOAL_BRANCHES.map((b) => `<div class="branch" style="grid-column:${b.from + 1} / ${b.to + 2}">${b.name}</div>`).join('');
  let detail = '<div class="note">Bir hedefe tıklayarak ayrıntısını gör. Hedefler 56 günde tamamlanır ve kalıcı kazanım sağlar.</div>';
  const g = GOAL_BY_ID[st.goalSel];
  if (g) {
    const done = c.goalsDone.includes(g.id), run = cur && cur.id === g.id, av = eco.goalAvailable(G, c, g);
    const req = g.req.map((r) => GOAL_BY_ID[r].name).join(', ');
    let why = '';
    if (!av && !done && !run) why = g.req.some((r) => !c.goalsDone.includes(r)) ? `Önce: ${req}` : g.excl && (c.goalsDone.includes(g.excl) || (cur && cur.id === g.excl)) ? `${GOAL_BY_ID[g.excl].name} ile birlikte seçilemez` : 'Cumhuriyetçiler için küresel gerginlik %50 gerekli';
    detail = `<div class="card sel"><h4>${g.name}</h4><div class="small">${g.desc}</div>
      ${g.excl ? `<div class="tiny warn">${GOAL_BY_ID[g.excl].name} ile birlikte seçilemez.</div>` : ''}
      <div class="row">${done ? '<span class="acc small">Tamamlandı</span>' : run ? `<span class="warn small">Sürüyor · ${Math.ceil((1 - c.goal.prog) * 56)} gün kaldı</span>` : av ? btn(cur ? 'Bununla değiştir' : 'Hedefi başlat', 'goalStart', g.id, { cls: 'pri', tip: cur ? 'Süren hedefin ilerlemesi kaybolur.' : '' }) : `<span class="muted small">${why}</span>`}</div></div>`;
  }
  return `
  <div class="sec"><h3>Süren hedef</h3>${cur ? `<div class="card"><div class="kv"><b>${cur.name}</b><span>${Math.ceil((1 - c.goal.prog) * 56)} gün</span></div>${bar(c.goal.prog, 'w')}<div class="small muted">${cur.desc}</div></div>` : '<div class="note warn">Seçili hedef yok. Ağaçtan bir hedef başlat.</div>'}</div>
  ${detail}
  <div class="sec"><h3>Hedef ağacı</h3><div class="goals" data-scroll="goals">${heads}${cells}</div></div>`;
}

// ---------------- Araştırma
function techTip(G, c, t) {
  const lines = fxText(t.fx);
  if (t.unlock) lines.unshift('Açar: ' + t.unlock);
  lines.push(`Yıl: ${t.year} · yaklaşık ${Math.round(eco.techDays(G, c, t))} gün`);
  if (t.req.length) lines.push('Gerekli: ' + t.req.map((r) => TECH_BY_ID[r].name).join(', '));
  return lines.join('\n');
}
function panelResearch(app) {
  const G = app.G, c = app.me, st = app.ui.st;
  if (st.resSlot >= c.slots) st.resSlot = 0;
  const slots = c.research.map((r, i) => {
    const t = r ? TECH_BY_ID[r.id] : null;
    return `<button class="item ${st.resSlot === i ? 'sel' : ''}" data-act="resSlot" data-arg="${i}"><span class="grow">${t ? `${t.name}<span class="bar w" style="display:block;margin-top:4px"><i style="width:${(r.prog * 100).toFixed(1)}%"></i></span>` : '<span class="warn">Boş yuva — aşağıdan teknoloji seç</span>'}</span>
      <span class="tiny muted">${t ? Math.ceil((1 - r.prog) * eco.techDays(G, c, t)) + ' gün' : ''}</span></button>`;
  }).join('');
  const cats = Object.keys(TECH_CATS).map((k) => `<button class="btn ${st.techCat === k ? 'on' : ''}" data-act="techCat" data-arg="${k}">${TECH_CATS[k]}</button>`).join('');
  const list = TECHS.filter((t) => t.cat === st.techCat).map((t) => {
    const done = c.techs[t.id], run = c.research.some((r) => r && r.id === t.id), av = eco.techAvailable(c, t);
    return `<button class="tech ${done ? 'done' : run ? 'run' : av ? '' : 'lock'}" data-act="${av && !run ? 'research' : ''}" data-arg="${t.id}" data-tip="${esc(techTip(G, c, t))}"><span>${t.name}</span><small>${t.year}${done ? ' · tamam' : run ? ' · araştırılıyor' : ''}</small></button>`;
  }).join('');
  return `
  <div class="sec"><h3>Araştırma yuvaları</h3><div class="list">${slots}</div></div>
  <div class="sec"><h3>Teknolojiler</h3><div class="tabs">${cats}</div><div class="techs">${list}</div>
  <div class="note">Yılından önce araştırılan teknoloji daha uzun sürer. Seçtiğin teknoloji işaretli yuvaya, o doluysa ilk boş yuvaya girer.</div></div>`;
}

// ---------------- Üretim ve ticaret
function panelProduction(app) {
  const G = app.G, c = app.me;
  const lines = c.lines.map((l, i) => {
    const E = EQUIP[l.eq], out = eco.lineOutput(c, l);
    const short = Object.keys(E.res).filter((k) => c._short[k] < 0.999).map((k) => RESOURCES[k].name);
    return `<div class="card"><div class="row"><h4 class="grow">${E.name}</h4><span class="small muted">Depo</span><b class="num">${fmt(c.stock[l.eq])}</b></div>
      <div class="row small"><span class="grow muted">Verim ${pct(l.eff)} / ${pct(eco.effCap(c))} · günde <b class="num" style="color:var(--text)">${out >= 10 ? Math.round(out) : out.toFixed(1).replace('.', ',')}</b></span>
      <span class="step"><button data-act="lineFac" data-arg="${i}" data-arg2="-1" aria-label="Azalt">−</button><b>${l.fac}</b><button data-act="lineFac" data-arg="${i}" data-arg2="1" aria-label="Artır">+</button></span>
      <button class="btn sm" data-act="lineFac" data-arg="${i}" data-arg2="5">+5</button></div>
      ${short.length ? `<div class="tiny bad">Kaynak açığı: ${short.join(', ')} — üretim düşük.</div>` : ''}</div>`;
  }).join('');
  const addable = EQ_KEYS.filter((k) => !c.lines.some((l) => l.eq === k));
  const add = addable.map((k) => { const ok = !EQUIP[k].req || c.techs[EQUIP[k].req]; return btn(EQUIP[k].short, 'lineAdd', k, { cls: 'sm', off: !ok, tip: ok ? `${EQUIP[k].name} için üretim hattı aç` : `Gerekli teknoloji: ${TECH_BY_ID[EQUIP[k].req].name}` }); }).join('');
  const res = Object.keys(RESOURCES).map((k) => `<div class="card"><div class="row"><h4 class="grow">${RESOURCES[k].name}</h4><span class="${c._bal[k] < 0 ? 'bad' : 'good'} num"><b>${sign(c._bal[k])}</b></span></div>
      <div class="row small"><span class="grow muted">Üretim ${c._res[k]} · ihtiyaç ${c._need[k]}</span><span class="muted">İthalat</span>
      <span class="step"><button data-act="import" data-arg="${k}" data-arg2="-8" aria-label="Azalt">−</button><b>${c.imports[k]}</b><button data-act="import" data-arg="${k}" data-arg2="8" aria-label="Artır">+</button></span></div></div>`).join('');
  return `
  <div class="sec"><h3>Askeri fabrikalar</h3><div class="kv"><span>Toplam / atanmamış</span><span><b>${c._mil}</b> / <b class="${c._milFree > 0 ? 'warn' : ''}">${c._milFree}</b></span></div>
  <div class="kv small muted"><span data-tip="İstikrar, yasalar ve teknolojiden gelir.">Üretim çarpanı</span><span>${pct(c._output)}</span></div></div>
  <div class="sec"><h3>Üretim hatları</h3>${lines || '<div class="note">Açık hat yok.</div>'}${add ? `<div class="row" style="flex-wrap:wrap"><span class="small muted">Hat aç:</span>${add}</div>` : ''}</div>
  <div class="sec"><h3>Depo</h3>${EQ_KEYS.map((k) => `<div class="kv small"><span>${EQUIP[k].name}</span><span>${fmt(c.stock[k])}</span></div>`).join('')}
    <div class="kv small"><span data-tip="Tersaneler her gün donanma gücü üretir. Deniz hâkimiyeti çıkarma, ikmal ve ithalatı belirler.">Donanma gücü</span><span>${fmt(c.naval)}</span></div></div>
  <div class="sec"><h3>Kaynaklar ve ticaret</h3>${res}
    <div class="note">Her 8 birim ithalat 1 sivil fabrikaya mal olur (şu an ${c._tradeCiv}). ${c._atWar ? `Abluka nedeniyle ithalatın ${pct(c._blockade)} kadarı ulaşıyor.` : ''} Fazla kaynak ihraç edilir ve inşaata ${c._export} fabrika katar.</div></div>`;
}

// ---------------- İnşaat
function panelBuild(app) {
  const G = app.G, c = app.me, W = app.world;
  const q = c.build.map((b, i) => {
    const cost = eco.buildCost(G, b.type, b.prov);
    return `<div class="item"><span class="grow">${BUILDING[b.type].name} <span class="muted">· ${W.prov[b.prov].name}</span>${bar(b.prog / cost)}</span><span class="tiny muted num">${pct(b.prog / cost)}</span>
      <button class="btn sm" data-act="buildUp" data-arg="${i}" data-tip="Öne al">▲</button><button class="btn sm" data-act="buildCancel" data-arg="${i}" data-tip="İptal et">✕</button></div>`;
  }).join('');
  const types = Object.keys(BUILDING).map((k) => {
    const B = BUILDING[k], can = eco.bestBuildProv(G, c, k) >= 0;
    return `<div class="card ${app.placement && app.placement.type === k ? 'sel' : ''}"><div class="row"><h4 class="grow">${B.name}</h4><span class="tiny muted num">${fmt(B.cost)} puan</span></div><div class="small muted">${B.desc}</div>
      <div class="row">${btn('Haritadan seç', 'place', k, { cls: 'sm', off: !can, tip: can ? 'Uygun eyaletler haritada parlar. Çıkmak için Esc.' : 'Uygun eyalet yok' })}${btn('Otomatik ×1', 'buildAuto', k, { cls: 'sm', arg2: 1, off: !can })}${btn('×5', 'buildAuto', k, { cls: 'sm', arg2: 5, off: !can })}</div></div>`;
  }).join('');
  return `
  <div class="sec"><h3>Sivil fabrikalar</h3>
    <div class="kv"><span>Toplam</span><span>${c._civ}</span></div>
    <div class="kv small muted"><span data-tip="Ekonomi yasasına göre halkın ihtiyacına ayrılan pay.">Tüketim malları</span><span>−${c._consumer}</span></div>
    <div class="kv small muted"><span>Ticaret / ihracat katkısı</span><span>−${c._tradeCiv} / +${c._export}</span></div>
    <div class="kv"><span>İnşaata ayrılan</span><span><b class="acc">${c._civFree}</b></span></div>
    <div class="note">Her proje en çok 5 fabrika kullanır; sıradaki projeler artan fabrikaları alır.</div></div>
  <div class="sec"><h3>İnşaat kuyruğu</h3><div class="list">${q || '<div class="note warn">Kuyruk boş. Aşağıdan bir yapı seç.</div>'}</div></div>
  <div class="sec"><h3>Yeni yapı</h3>${types}</div>`;
}

// ---------------- Ordu
function statLine(s) {
  return `<div class="row tiny muted" style="flex-wrap:wrap;gap:4px 10px"><span>Saldırı <b style="color:var(--text)">${Math.round(s.atk)}</b></span><span>Savunma <b style="color:var(--text)">${Math.round(s.def)}</b></span><span>Yarma <b style="color:var(--text)">${Math.round(s.brk)}</b></span><span>Teşkilat <b style="color:var(--text)">${Math.round(s.org)}</b></span><span>Hız <b style="color:var(--text)">${s.speed.toFixed(1).replace('.', ',')}</b></span><span>Genişlik <b style="color:var(--text)">${s.width}</b></span></div>`;
}
function needLine(c, s) {
  const eq = Object.keys(s.eq).map((e) => `<span class="${c.stock[e] >= s.eq[e] ? '' : 'bad'}">${EQUIP[e].short} ${fmt(s.eq[e])}</span>`).join(' · ');
  return `<div class="tiny"><span class="${c._mpFree >= s.mp ? '' : 'bad'}">Asker ${fmt(s.mp)}</span> · ${eq} · ${s.days} gün</div>`;
}
function panelArmy(app) {
  const G = app.G, S = G.S, c = app.me, st = app.ui.st, W = app.world;
  const tabs = [['rec', 'Asker alma'], ['tpl', 'Şablonlar'], ['frc', 'Kuvvetler']].map(([k, n]) => `<button class="btn ${st.armyTab === k ? 'on' : ''}" data-act="armyTab" data-arg="${k}">${n}</button>`).join('');
  let body = '';
  if (st.armyTab === 'rec') {
    const cards = c.tpls.map((t) => {
      const s = tplStats(c, t), ok = tplAllowed(c, t);
      const comp = BAT_KEYS.filter((k) => t.bats[k]).map((k) => `${t.bats[k]} ${BATTALION[k].name.replace(' Taburu', '').replace(' Tabur', '')}`).join(' · ');
      return `<div class="card"><div class="row"><h4 class="grow">${t.name}</h4>${btn('+1', 'train', t.id, { cls: 'sm pri', arg2: 1, off: !ok, tip: ok ? '' : 'Gerekli teknoloji eksik' })}${btn('+5', 'train', t.id, { cls: 'sm', arg2: 5, off: !ok })}</div>
        <div class="tiny muted">${comp}</div>${statLine(s)}${needLine(c, s)}</div>`;
    }).join('');
    const q = c.train.map((t, i) => {
      const tp = tplOf(c, t.tpl);
      return `<div class="item"><span class="grow">${tp.name}${t.started ? bar(t.prog, 'g') : '<span class="tiny warn" style="display:block">Asker veya teçhizat bekleniyor</span>'}</span><span class="tiny muted num">${t.started ? pct(t.prog) : ''}</span><button class="btn sm" data-act="trainCancel" data-arg="${i}" data-tip="İptal et">✕</button></div>`;
    }).join('');
    const dep = c.deploy >= 0 && S.ctrl[c.deploy] === c.id ? W.prov[c.deploy].name : W.prov[c.capital].name + ' (başkent)';
    body = `<div class="sec"><h3>Kaynak</h3><div class="kv"><span>Askere alınabilir</span><span><b>${fmt(Math.max(0, c._mpFree))}</b></span></div>
      <div class="row small"><span class="grow muted">Konuşlanma yeri: <span style="color:var(--text)">${dep}</span></span>${btn('Değiştir', 'place', 'deploy', { cls: 'sm', tip: 'Yeni tümenlerin çıkacağı eyaleti haritadan seç.' })}</div></div>
      <div class="sec"><h3>Eğitimdeki tümenler</h3><div class="list">${q || '<div class="note">Eğitimde tümen yok.</div>'}</div></div>
      <div class="sec"><h3>Şablonlar</h3>${cards}</div>`;
  } else if (st.armyTab === 'tpl') {
    if (!c.tpls.some((t) => t.id === st.tplSel)) st.tplSel = c.tpls[0].id;
    const t = tplOf(c, st.tplSel), s = tplStats(c, t);
    const total = BAT_KEYS.reduce((a, k) => a + (t.bats[k] || 0), 0);
    const list = c.tpls.map((x) => `<button class="btn sm ${x.id === t.id ? 'on' : ''}" data-act="tplSel" data-arg="${x.id}">${x.name}</button>`).join('');
    const rows = BAT_KEYS.map((k) => {
      const B = BATTALION[k], ok = !B.req || c.techs[B.req];
      return `<div class="row"><span class="grow ${ok ? '' : 'muted'}" data-tip="${esc(`Saldırı ${B.atk} · Savunma ${B.def} · Yarma ${B.brk} · Teşkilat ${B.org} · Hız ${B.speed} · Genişlik ${B.width}`)}">${B.name}${ok ? '' : ` <span class="tiny">(${TECH_BY_ID[B.req].name} gerekli)</span>`}</span>
        <span class="step"><button data-act="${ok ? 'tplBat' : ''}" data-arg="${k}" data-arg2="-1" aria-label="Azalt">−</button><b>${t.bats[k] || 0}</b><button data-act="${ok ? 'tplBat' : ''}" data-arg="${k}" data-arg2="1" aria-label="Artır">+</button></span></div>`;
    }).join('');
    body = `<div class="sec"><h3>Şablon seç</h3><div class="tabs">${list}${btn('+ Yeni', 'tplNew', '', { cls: 'sm' })}</div></div>
      <div class="sec"><h3>${t.name} · ${total}/${MAX_BATS} tabur</h3>${rows}${statLine(s)}${needLine(c, s)}
      <div class="note">Değişiklik bu şablondaki mevcut tümenleri de etkiler; eksikler depodan takviye edilir. Tek cepheden saldırıda genişlik sınırı 60, her ek yön +30.</div></div>`;
  } else {
    const kinds = { inf: 0, mot: 0, arm: 0 };
    let auto = 0, n = 0;
    for (const d of S.divs) if (d.o === c.id) { n++; if (d.auto) auto++; kinds[tplStats(c, tplOf(c, d.t)).kind]++; }
    const stances = ['Savun', 'Dengeli', 'Saldırgan'].map((nm, i) => `<button class="btn sm ${c.auto.stance === i ? 'on' : ''}" data-act="stance" data-arg="${i}">${nm}</button>`).join('');
    body = `<div class="sec"><h3>Kara kuvvetleri</h3>
        <div class="kv"><span>Tümen (piyade / motorize / zırhlı)</span><span>${n} (${kinds.inf} / ${kinds.mot} / ${kinds.arm})</span></div>
        <div class="kv"><span>Silah altındaki asker</span><span>${fmt(c._mpUsed)}</span></div></div>
      <div class="sec"><h3>Otomatik cephe</h3>
        <div class="small muted">Otomatiğe alınan tümenler sınır ve cepheye kendiliğinden dağılır, duruşa göre saldırır. Elle emir verdiğin tümen otomatikten çıkar.</div>
        <div class="kv"><span>Otomatikteki tümen</span><span>${auto} / ${n}</span></div>
        <div class="row">${btn('Tümünü otomatiğe al', 'autoAll', 1, { cls: 'sm' })}${btn('Tümünü elle yönet', 'autoAll', 0, { cls: 'sm' })}</div>
        <div class="row"><span class="small muted">Duruş:</span>${stances}</div></div>
      <div class="sec"><h3>Hava kuvvetleri</h3>
        <div class="kv"><span>Avcı / taarruz uçağı</span><span>${fmt(c.stock.fighter)} / ${fmt(c.stock.bomber)}</span></div>
        ${c._atWar ? `<div class="kv"><span data-tip="Avcı sayına ve teknolojine göre. Muharebelerde saldırı ve savunmayı etkiler.">Hava üstünlüğü</span><span class="${c._airSup >= 0.5 ? 'good' : 'bad'}">${pct(c._airSup)}</span></div>${bar(c._airSup, c._airSup >= 0.5 ? 'g' : 'd')}
        <div class="kv small muted"><span>Muharebelere etkisi</span><span>${sign(Math.round((c._airMod || 0) * 100))}%</span></div>` : '<div class="note">Barışta hava harekâtı yok. Savaşta avcılar üstünlük, taarruz uçakları muharebe desteği sağlar.</div>'}</div>
      <div class="sec"><h3>Donanma</h3>
        <div class="kv"><span>Donanma gücü · tersane</span><span>${fmt(c.naval)} · ${c._dock}</span></div>
        ${c._atWar ? `<div class="kv"><span data-tip="%28'in altında birlikler gemiye binemez, %30'un altında limanlar ikmal sağlamaz.">Deniz hâkimiyeti</span><span class="${c._navRatio >= 0.5 ? 'good' : 'bad'}">${pct(c._navRatio)}</span></div>${bar(c._navRatio, c._navRatio >= 0.5 ? 'g' : 'd')}` : '<div class="note">Birlikler limanı olan eyaletten denize açılır ve herhangi bir kıyıya çıkabilir. Düşman kıyısına çıkarmada saldırı yarıya düşer.</div>'}</div>`;
  }
  return `<div class="tabs">${tabs}</div>${body}`;
}

// ---------------- Diplomasi
export function relChip(app, id) {
  const S = app.G.S, me = app.me.id;
  if (id === me) return '';
  if (atWar(S, me, id)) return '<span class="chip war">SAVAŞ</span>';
  if (isFriend(S, me, id)) return '<span class="chip ally">MÜTTEFİK</span>';
  if (app.me.pacts.some((p) => p.w === id)) return '<span class="chip pact">PAKT</span>';
  return '';
}
function panelDiplo(app) {
  const G = app.G, S = G.S, c = app.me, st = app.ui.st, W = app.world;
  const facs = S.factions.map((f) => `<div class="item"><span class="grow"><b>${f.name}</b> <span class="tiny muted">${IDEOLOGY[f.ideo].name}</span></span>${f.members.map((m) => flagImg(app, m)).join('')}</div>`).join('');
  let detail = '';
  const o = S.C[st.dipSel];
  if (o && o.id !== c.id && o.alive) {
    const nat = W.nations[o.id], f = dip.factionOf(S, o), myF = dip.factionOf(S, c);
    const war = atWar(S, c.id, o.id);
    const acts = [];
    const cj = dip.canJustify(G, c.id, o.id), cd = dip.canDeclare(G, c.id, o.id);
    if (!war) {
      acts.push(btn('İlişkileri geliştir · 25', 'dImprove', o.id, { cls: 'sm', off: c.pp < 25, tip: 'Karşılıklı görüşü yükseltir.' }));
      const hasPact = c.pacts.some((p) => p.w === o.id);
      acts.push(btn(hasPact ? 'Pakt yürürlükte' : 'Saldırmazlık paktı · 30', 'dPact', o.id, { cls: 'sm', off: hasPact || c.pp < 30 || isFriend(S, c.id, o.id), tip: 'Üç yıl boyunca birbirinize savaş ilan edemezsiniz. Karşı tarafın görüşü en az +5 olmalı.' }));
      acts.push(btn(c.guar.includes(o.id) ? 'Garanti verildi' : 'Bağımsızlığı garanti et · 40', 'dGuar', o.id, { cls: 'sm', off: c.guar.includes(o.id) || c.pp < 40, tip: 'Bu ülkeye saldırılırsa savunmasına katılırsın.' }));
      if (f && !myF) { const cj2 = dip.canJoinFaction(G, c, f); acts.push(btn(`${f.name} ittifakına katıl`, 'dJoin', f.id, { cls: 'sm', off: !cj2.ok, tip: cj2.ok ? 'İttifakın bütün savaşlarına girersin.' : cj2.why })); }
      if (myF && myF.leader === c.id && !f) { const ci = dip.canJoinFaction(G, o, myF); acts.push(btn('İttifaka davet et', 'dInvite', o.id, { cls: 'sm', off: !ci.ok, tip: ci.ok ? 'Kabul ederse bütün savaşlarına katılır.' : 'Reddeder: ' + ci.why })); }
      if (c.wargoals.includes(o.id)) acts.push(btn('Savaş ilan et', 'dWar', o.id, { cls: 'sm danger', off: !cd.ok, tip: cd.ok ? 'Geri dönüşü yok: müttefikleri ve garantörleri de savaşa girer.' : cd.why }));
      else {
        const j = c.just.find((x) => x.target === o.id);
        if (j) acts.push(`<span class="small warn">Gerekçe hazırlanıyor: ${pct(j.prog)}</span>`);
        else {
          acts.push(btn(`Savaş gerekçesi üret · ${dip.JUSTIFY_COST}`, 'dJustify', o.id, { cls: 'sm', off: !cj.ok || c.pp < dip.JUSTIFY_COST, tip: cj.ok ? 'Birkaç ay sürer ve küresel gerginliği artırır.' : cj.why }));
          if (c.freeGoals > 0) acts.push(btn(`Hazır gerekçeyi kullan (${c.freeGoals})`, 'dJustifyFree', o.id, { cls: 'sm', off: !cj.ok, tip: cj.ok ? 'Yayılmacı Siyaset hedefinden gelen hak.' : cj.why }));
        }
      }
    } else if (!o.capit) acts.push(btn('Barış teklif et', 'peace', o.id, { cls: 'sm', tip: 'Mevcut hatlarda barış önerir.' }));
    detail = `<div class="card sel"><div class="row">${flagImg(app, o.id, 'big')}<div class="grow"><h4>${nat.long}</h4><div class="small muted">${nat.leader}</div>
      <div class="small"><span style="color:${IDEOLOGY[o.ideo].color}">${IDEOLOGY[o.ideo].name}</span> · ${f ? f.name : 'İttifaksız'} ${relChip(app, o.id)}</div></div>
      <button class="ibtn" data-act="focusNation" data-arg="${o.id}" data-tip="Haritada göster">${icon('locate')}</button></div>
      <div class="kv small"><span>Bize bakışı / bizim bakışımız</span><span>${sign(Math.round(o.op[c.id]))} / ${sign(Math.round(c.op[o.id]))}</span></div>
      <div class="kv small"><span>Eyalet · fabrika (sivil/askeri) · tümen</span><span>${o._nProv} · ${o._civ}/${o._mil} · ${o.capit ? '—' : '~' + Math.round(o._nDiv / 5) * 5}</span></div>
      ${o.capit ? '<div class="tiny bad">Teslim oldu; müttefikleri savaşı sürdürüyor.</div>' : ''}
      ${o.just.some((j) => j.target === c.id) || o.wargoals.includes(c.id) ? '<div class="tiny bad">Bu ülke bize karşı savaş gerekçesi hazırlıyor!</div>' : ''}
      <div class="row" style="flex-wrap:wrap">${acts.join('')}</div></div>`;
  }
  const order = S.C.filter((x) => x.alive && x.id !== c.id).sort((a, b) => (atWar(S, c.id, b.id) - atWar(S, c.id, a.id)) || (b.major - a.major) || (b._nProv - a._nProv));
  const list = order.map((x) => `<button class="item ${st.dipSel === x.id ? 'sel' : ''}" data-act="dipSel" data-arg="${x.id}">${flagImg(app, x.id)}<span class="grow">${W.nations[x.id].name} <span class="tiny" style="color:${IDEOLOGY[x.ideo].color}">${IDEOLOGY[x.ideo].name}</span></span>${relChip(app, x.id)}<span class="tiny num ${x.op[c.id] < -20 ? 'bad' : x.op[c.id] > 20 ? 'good' : 'muted'}">${sign(Math.round(x.op[c.id]))}</span></button>`).join('');
  const myF = dip.factionOf(S, c);
  return `
  <div class="sec"><h3>Küresel gerginlik</h3><div class="kv"><span class="small muted">Savaşlar ve gerekçeler gerginliği artırır; yüksek gerginlik Cumhuriyetçileri harekete geçirir.</span><span><b>${Math.round(S.tension)}%</b></span></div>${bar(S.tension / 100, S.tension > 60 ? 'd' : 'w')}</div>
  ${detail}
  <div class="sec"><h3>İttifaklar</h3><div class="list">${facs || '<div class="note">Henüz ittifak kurulmadı.</div>'}</div>
    ${!myF ? `<div class="row">${btn('Kendi ittifakını kur · 80', 'dCreate', '', { cls: 'sm', off: c.pp < 80, tip: 'İttifak üyeleri bütün savaşlara birlikte girer.' })}</div>` : ''}</div>
  <div class="sec"><h3>Devletler</h3><div class="list">${list}</div></div>`;
}

// ---------------- Menü
function panelMenu(app) {
  const S = app.G.S;
  return `
  <div class="sec"><h3>Oyun</h3>
    <div class="row" style="flex-wrap:wrap">${btn('Kaydet', 'save', '', { cls: 'pri' })}${btn('Son kaydı yükle', 'load', '', { off: !app.hasSave() })}${btn('Ana menü', 'toStart', '')}</div>
    <div class="small muted">Dünya tohumu: <b style="color:var(--text)">${esc(S.seed)}</b> · Zorluk: ${DIFF[S.diff].name} · Oyun her ayın başında kendiliğinden kaydedilir. Kayıt yalnızca bu tarayıcıda durur.</div></div>
  <div class="sec"><h3>Nasıl oynanır</h3>${HELP_HTML}</div>`;
}
export const HELP_HTML = `<div class="help">
  <kbd>Sürükle</kbd><span>Haritayı kaydır. <kbd>Tekerlek</kbd> yakınlaştırır, <kbd>Q</kbd>/<kbd>E</kbd> döndürür, <kbd>W A S D</kbd> kaydırır.</span>
  <kbd>Sol tık</kbd><span>Tümen yığınını veya eyaleti seç. <kbd>Shift</kbd>+sürükle ile kutu içine al.</span>
  <kbd>Sağ tık</kbd><span>Seçili tümenlere hedef göster. Dokunmatik ekranda seçim varken eyalete dokun.</span>
  <kbd>Boşluk</kbd><span>Zamanı durdur ya da başlat. <kbd>1</kbd>–<kbd>5</kbd> hız seçer.</span>
  <kbd>Esc</kbd><span>Seçimi ve yerleşim kipini bırak.</span>
  <span class="acc">Zafer</span><span>İttifakınla dünya zafer puanlarının %60'ını elinde tut. Başkentini ve şehirlerini kaybedersen ülken teslim olur.</span>
  <span class="acc">Muharebe</span><span>Düşman eyaletine yürüyen tümen savaşa girer. Üstünlük için 2–3 kat güç, birden çok yönden saldırı, tank ve hava desteği gerekir. Kuşatılan birlik ikmalsiz kalır.</span>
</div>`;

const TITLES = { state: 'Devlet', goals: 'Ulusal Hedefler', research: 'Araştırma', production: 'Üretim', build: 'İnşaat', army: 'Ordu', diplo: 'Diplomasi', menu: 'Menü' };
export function panelTitle(tab) { return TITLES[tab] || ''; }
export function renderPanel(app, tab) {
  switch (tab) {
    case 'state': return panelState(app);
    case 'goals': return panelGoals(app);
    case 'research': return panelResearch(app);
    case 'production': return panelProduction(app);
    case 'build': return panelBuild(app);
    case 'army': return panelArmy(app);
    case 'diplo': return panelDiplo(app);
    case 'menu': return panelMenu(app);
    default: return '';
  }
}

// ---------------- eylemler
export const ACTS = {
  law: (app, kind, i) => eco.setLaw(app.G, app.me, kind, +i),
  goalSel: (app, id) => { app.ui.st.goalSel = id; },
  goalStart: (app, id) => eco.startGoal(app.G, app.me, id),
  resSlot: (app, i) => { app.ui.st.resSlot = +i; },
  techCat: (app, k) => { app.ui.st.techCat = k; },
  research: (app, id) => {
    const c = app.me, st = app.ui.st;
    let slot = c.research[st.resSlot] ? c.research.findIndex((r) => !r) : st.resSlot;
    if (slot < 0) slot = st.resSlot;
    if (eco.startResearch(app.G, c, slot, id)) { const next = c.research.findIndex((r) => !r); if (next >= 0) st.resSlot = next; }
  },
  lineFac: (app, i, d) => eco.setLineFac(app.G, app.me, +i, +d),
  lineAdd: (app, k) => { if (eco.addLine(app.G, app.me, k)) eco.setLineFac(app.G, app.me, app.me.lines.length - 1, 1); },
  import: (app, k, d) => eco.setImport(app.G, app.me, k, +d),
  place: (app, k) => app.startPlacement(k),
  buildAuto: (app, k, n) => { for (let i = 0; i < +n; i++) { const p = eco.bestBuildProv(app.G, app.me, k); if (p < 0) break; eco.queueBuild(app.G, app.me, k, p); } },
  buildCancel: (app, i) => { app.me.build.splice(+i, 1); },
  buildUp: (app, i) => { const b = app.me.build; i = +i; if (i > 0) { const t = b[i]; b.splice(i, 1); b.unshift(t); } },
  armyTab: (app, k) => { app.ui.st.armyTab = k; },
  train: (app, id, n) => eco.queueTrain(app.G, app.me, id, +n),
  trainCancel: (app, i) => {
    const c = app.me, t = c.train[+i];
    if (!t) return;
    if (t.started) { const s = tplStats(c, tplOf(c, t.tpl)); for (const e in s.eq) c.stock[e] += s.eq[e]; }
    c.train.splice(+i, 1);
  },
  tplSel: (app, id) => { app.ui.st.tplSel = id; },
  tplNew: (app) => { const c = app.me; const id = eco.saveTemplate(app.G, c, null, `Özel Tümen ${c.nextTpl}`, { inf: 6, art: 1 }); if (id) app.ui.st.tplSel = id; },
  tplBat: (app, k, d) => {
    const c = app.me, t = tplOf(c, app.ui.st.tplSel);
    const bats = { ...t.bats }; bats[k] = (bats[k] || 0) + +d;
    eco.saveTemplate(app.G, c, t.id, t.name, bats);
  },
  autoAll: (app, v) => { for (const d of app.G.S.divs) if (d.o === app.me.id) d.auto = !!+v; app.G.unitsDirty = true; },
  stance: (app, i) => { app.me.auto.stance = +i; },
  dipSel: (app, id) => { app.ui.st.dipSel = +id; },
  focusNation: (app, id) => app.focusNation(+id),
  dImprove: (app, id) => dip.improveRelations(app.G, app.me.id, +id),
  dPact: (app, id) => { if (!dip.signPact(app.G, app.me.id, +id)) app.toast(`${app.world.nations[+id].name} saldırmazlık paktını reddetti.`); },
  dGuar: (app, id) => dip.guarantee(app.G, app.me.id, +id),
  dJoin: (app, fid) => dip.joinFaction(app.G, app.me, +fid),
  dInvite: (app, id) => { const o = app.G.S.C[+id]; if (o.op[app.me.id] >= 10 || o._atWar || app.G.S.tension >= 30) dip.joinFaction(app.G, o, app.me.faction); else app.toast(`${app.world.nations[+id].name} daveti reddetti: ilişkiler yeterince iyi değil.`); },
  dCreate: (app) => { if (app.me.pp >= 80) { app.me.pp -= 80; dip.createFaction(app.G, app.me, FACTION_NAMES[app.me.ideo]); } },
  dJustify: (app, id) => dip.startJustify(app.G, app.me.id, +id, false),
  dJustifyFree: (app, id) => dip.startJustify(app.G, app.me.id, +id, true),
  dWar: (app, id) => app.confirm({ kicker: 'Savaş ilanı', title: `${app.world.nations[+id].name} devletine savaş ilan edilsin mi?`, text: 'Müttefikleri ve bağımsızlığını garanti edenler de savaşa girer. Bu karar geri alınamaz.', yes: 'Savaş ilan et', war: true }, () => dip.declareWar(app.G, app.me.id, +id)),
  peace: (app, id) => { if (!dip.offerPeace(app.G, app.me.id, +id)) app.toast(`${app.world.nations[+id].name} barış teklifini reddetti.`); },
  save: (app) => app.save(true),
  load: (app) => app.loadSave(),
  toStart: (app) => app.confirm({ kicker: 'Ana menü', title: 'Oyundan çıkılsın mı?', text: 'Kaydedilmemiş ilerleme kaybolur.', yes: 'Ana menüye dön' }, () => app.toStart()),
};

export function afterAct(app) { refreshAll(app.G); }
