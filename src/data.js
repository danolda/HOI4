// Oyunun sabit verileri: uluslar, teçhizat, birlikler, teknolojiler, hedefler, yasalar.

export const START_YEAR = 1930;

export const IDEOLOGY = {
  dem: { name: 'Cumhuriyetçi', desc: 'Seçimle yönetilen, savaşa geç giren ama sanayisi güçlü devletler.', color: '#5b8fd1' },
  mil: { name: 'Militarist', desc: 'Ordunun yönettiği, yayılmacı ve savaşa hazır devletler.', color: '#9a7fb5' },
  kol: { name: 'Kolektivist', desc: 'Devrimci, kitle seferberliğine dayanan devletler.', color: '#d06a5c' },
  mon: { name: 'Gelenekçi', desc: 'Hanedan ve denge siyasetiyle ayakta duran tarafsız devletler.', color: '#c9a95a' },
};

// İlk 7 ulus büyük güç, kalanlar küçük devlet.
export const NATIONS = [
  { tag: 'VAL', name: 'Valdris', long: 'Valdris İmparatorluğu', ideo: 'mil', color: [124, 98, 148], leader: 'Mareşal Aldric Vorn', flag: { pat: 'cross', c: ['#2b2233', '#d9d2c2', '#b8483e'], em: 'none' } },
  { tag: 'KAE', name: 'Kaerun', long: 'Kaerun Cumhuriyeti', ideo: 'dem', color: [84, 130, 186], leader: 'Başkan Elena Marlow', flag: { pat: 'hband', c: ['#24538f', '#e8e4d8', '#24538f'], em: 'star' } },
  { tag: 'SOL', name: 'Soltera', long: 'Soltera Halk Birliği', ideo: 'kol', color: [186, 88, 76], leader: 'Genel Sekreter Mira Tarkan', flag: { pat: 'plain', c: ['#a8322c', '#e7b93c'], em: 'gear' } },
  { tag: 'NOR', name: 'Norvask', long: 'Norvask Krallığı', ideo: 'mon', color: [88, 156, 140], leader: 'Kral III. Haldor', flag: { pat: 'nordic', c: ['#1f5c57', '#f0ead8', '#d9a13a'], em: 'none' } },
  { tag: 'ISK', name: 'Iskara', long: 'Iskara Federasyonu', ideo: 'dem', color: [204, 168, 78], leader: 'Başbakan Teo Aldani', flag: { pat: 'vband', c: ['#d9a13a', '#f0ead8', '#2f6b4a'], em: 'none' } },
  { tag: 'DAL', name: 'Dalmor', long: 'Dalmor Hanlığı', ideo: 'mil', color: [146, 110, 70], leader: 'Han Batur Kaelan', flag: { pat: 'chevron', c: ['#5b3a1e', '#e0c890', '#1c1c1c'], em: 'none' } },
  { tag: 'ZER', name: 'Zeranth', long: 'Zeranth Konfederasyonu', ideo: 'mon', color: [130, 160, 84], leader: 'Naip Oren Saval', flag: { pat: 'hband', c: ['#3f6b2c', '#f0ead8', '#8a2f2f'], em: 'diamond' } },
  { tag: 'AQU', name: 'Aquilon', long: 'Aquilon Cumhuriyeti', ideo: 'dem', color: [112, 176, 200], leader: 'Cumhurbaşkanı Lucan Verra', flag: { pat: 'vband', c: ['#2b6f8f', '#f0ead8', '#2b6f8f'], em: 'disc' } },
  { tag: 'BEL', name: 'Belgara', long: 'Belgara Dükalığı', ideo: 'mon', color: [182, 142, 176], leader: 'Düşes Amelie Roth', flag: { pat: 'quarter', c: ['#7a3f70', '#e8d9a8'], em: 'none' } },
  { tag: 'TAV', name: 'Tavrosya', long: 'Tavrosya Devleti', ideo: 'mil', color: [158, 92, 122], leader: 'General Kosta Dravin', flag: { pat: 'hband', c: ['#1c1c1c', '#8f2742', '#1c1c1c'], em: 'disc' } },
  { tag: 'ARD', name: 'Ardanya', long: 'Ardanya Krallığı', ideo: 'mon', color: [208, 138, 90], leader: 'Kral II. Edmar', flag: { pat: 'saltire', c: ['#c2622b', '#f0ead8'], em: 'none' } },
  { tag: 'VOS', name: 'Vostra', long: 'Vostra Halk Devleti', ideo: 'kol', color: [196, 112, 112], leader: 'Birinci Sekreter Nadya Volkar', flag: { pat: 'hband', c: ['#a8322c', '#a8322c', '#1c1c1c'], em: 'star' } },
  { tag: 'LUM', name: 'Lumera', long: 'Lumera Serbest Şehirleri', ideo: 'dem', color: [140, 194, 152], leader: 'Konsül Dario Lenz', flag: { pat: 'vband', c: ['#f0ead8', '#3f8f5f', '#f0ead8'], em: 'none' } },
  { tag: 'KOR', name: 'Kordavan', long: 'Kordavan Sultanlığı', ideo: 'mon', color: [214, 180, 108], leader: 'Sultan Selmar', flag: { pat: 'plain', c: ['#1f5c57', '#e7b93c'], em: 'sun' } },
  { tag: 'HAL', name: 'Halvenya', long: 'Halvenya Cumhuriyeti', ideo: 'dem', color: [124, 144, 208], leader: 'Başbakan Ines Halver', flag: { pat: 'nordic', c: ['#f0ead8', '#3a55a8', '#3a55a8'], em: 'none' } },
  { tag: 'MER', name: 'Meruvya', long: 'Meruvya Komünü', ideo: 'kol', color: [164, 82, 82], leader: 'Komiser Anton Reval', flag: { pat: 'chevron', c: ['#8f2a2a', '#1c1c1c', '#e7b93c'], em: 'none' } },
];
export const MAJORS = 7;

export const FACTION_NAMES = {
  dem: 'Hür Devletler Paktı',
  mil: 'Kartal İttifakı',
  kol: 'Emekçi Birliği',
  mon: 'Taçlar Antlaşması',
};

export const TERRAIN = {
  plains: { name: 'Ova', move: 1.0, atk: 0, pop: 620, color: [142, 160, 104] },
  forest: { name: 'Orman', move: 1.4, atk: -0.15, pop: 260, color: [84, 122, 84] },
  hills: { name: 'Tepelik', move: 1.5, atk: -0.25, pop: 230, color: [150, 134, 96] },
  mountain: { name: 'Dağlık', move: 2.3, atk: -0.45, pop: 90, color: [128, 118, 112] },
  desert: { name: 'Çöl', move: 1.25, atk: -0.05, pop: 70, color: [204, 180, 122] },
  marsh: { name: 'Bataklık', move: 1.9, atk: -0.3, pop: 110, color: [96, 128, 116] },
  urban: { name: 'Şehir', move: 1.1, atk: -0.3, pop: 900, color: [150, 150, 150] },
};

export const RESOURCES = {
  steel: { name: 'Çelik' },
  oil: { name: 'Petrol' },
  alu: { name: 'Alüminyum' },
};

// cost: bir adet için üretim puanı. res: hat başına fabrika başı kaynak ihtiyacı.
export const EQUIP = {
  rifle: { name: 'Piyade Teçhizatı', short: 'Piyade T.', cost: 0.55, res: { steel: 2 } },
  arty: { name: 'Topçu', short: 'Topçu', cost: 3.6, res: { steel: 2, alu: 1 } },
  truck: { name: 'Motorlu Araç', short: 'Araç', cost: 2.6, res: { steel: 1, oil: 1 }, req: 'mot1' },
  tank: { name: 'Tank', short: 'Tank', cost: 11, res: { steel: 3, oil: 1 }, req: 'tank1' },
  fighter: { name: 'Avcı Uçağı', short: 'Avcı', cost: 22, res: { alu: 3, oil: 1 }, req: 'fig1' },
  bomber: { name: 'Taarruz Uçağı', short: 'Taarruz U.', cost: 26, res: { alu: 3, oil: 1 }, req: 'cas1' },
};
export const EQ_KEYS = Object.keys(EQUIP);

export const BATTALION = {
  inf: { name: 'Piyade Taburu', mp: 1000, eq: { rifle: 100 }, atk: 6, def: 22, brk: 3, hp: 25, org: 60, speed: 4, width: 2 },
  art: { name: 'Topçu Taburu', mp: 500, eq: { arty: 12 }, atk: 25, def: 10, brk: 6, hp: 5, org: 20, speed: 4, width: 3 },
  mot: { name: 'Motorize Tabur', mp: 1200, eq: { rifle: 100, truck: 35 }, atk: 7, def: 20, brk: 6, hp: 25, org: 60, speed: 12, width: 2, req: 'mot1' },
  tank: { name: 'Tank Taburu', mp: 500, eq: { tank: 50 }, atk: 22, def: 6, brk: 36, hp: 12, org: 15, speed: 8, width: 2, req: 'tank1' },
};
export const BAT_KEYS = Object.keys(BATTALION);
export const MAX_BATS = 12;

export const DEFAULT_TEMPLATES = [
  { id: 't_inf', name: 'Piyade Tümeni', bats: { inf: 7, art: 2, mot: 0, tank: 0 } },
  { id: 't_lig', name: 'Hafif Tugay', bats: { inf: 4, art: 0, mot: 0, tank: 0 } },
  { id: 't_mot', name: 'Motorize Tümen', bats: { inf: 0, art: 2, mot: 6, tank: 0 } },
  { id: 't_arm', name: 'Zırhlı Tümen', bats: { inf: 0, art: 0, mot: 4, tank: 4 } },
];

export const BUILDING = {
  civ: { name: 'Sivil Fabrika', cost: 4200, slot: true, desc: 'İnşaat ve ticaret kapasitesi sağlar.' },
  mil: { name: 'Askeri Fabrika', cost: 3400, slot: true, desc: 'Teçhizat üretir.' },
  dock: { name: 'Tersane', cost: 3000, slot: true, coastal: true, desc: 'Donanma gücünü büyütür.' },
  infra: { name: 'Altyapı', cost: 1400, max: 5, desc: 'İnşaatı ve birlik hareketini hızlandırır.' },
  fort: { name: 'Tahkimat', cost: 900, max: 5, desc: 'Saldırana seviye başına -%12 ceza verir.' },
  port: { name: 'Liman', cost: 1600, max: 1, coastal: true, desc: 'Deniz nakliyesi ve ikmal kaynağı.' },
};

export const LAWS = {
  cons: [
    { name: 'Gönüllü Ordu', rate: 0.015, cost: 0, desc: 'Nüfusun %1,5\'i askere alınabilir.' },
    { name: 'Sınırlı Askerlik', rate: 0.03, cost: 100, desc: 'Nüfusun %3\'ü askere alınabilir.' },
    { name: 'Genel Askerlik', rate: 0.055, cost: 150, need: 'tension25', desc: 'Nüfusun %5,5\'i. Gerginlik %25 veya savaş gerekir.' },
    { name: 'Topyekûn Seferberlik', rate: 0.10, cost: 150, need: 'war', fx: { prodOut: -0.05, construction: -0.1 }, desc: 'Nüfusun %10\'u. Yalnızca savaşta. Üretim -%5.' },
  ],
  eco: [
    { name: 'Sivil Ekonomi', consumer: 0.35, cost: 0, fx: { prodOut: -0.1 }, desc: 'Fabrikaların %35\'i tüketim malına ayrılır.' },
    { name: 'Kısmi Seferberlik', consumer: 0.25, cost: 120, desc: 'Tüketim malı %25.' },
    { name: 'Savaş Ekonomisi', consumer: 0.15, cost: 150, need: 'tension25', fx: { prodOut: 0.1 }, desc: 'Tüketim malı %15, askeri üretim +%10.' },
    { name: 'Topyekûn Savaş', consumer: 0.08, cost: 150, need: 'war', fx: { prodOut: 0.2, construction: 0.1 }, desc: 'Tüketim malı %8, askeri üretim +%20.' },
  ],
};

export const TECH_CATS = {
  inf: 'Piyade', art: 'Topçu', arm: 'Zırhlı', air: 'Hava', nav: 'Deniz', ind: 'Sanayi', sci: 'Bilim', doc: 'Doktrin',
};

const T = (id, cat, name, year, fx, req, extra) => ({ id, cat, name, year, fx: fx || {}, req: req || [], ...(extra || {}) });
export const TECHS = [
  T('inf1', 'inf', 'Piyade Tüfekleri I', 1930, { infAtk: 0.06, infDef: 0.06 }),
  T('inf2', 'inf', 'Piyade Tüfekleri II', 1933, { infAtk: 0.07, infDef: 0.07 }, ['inf1']),
  T('inf3', 'inf', 'Yarı Otomatik Tüfek', 1936, { infAtk: 0.08, infDef: 0.08 }, ['inf2']),
  T('inf4', 'inf', 'Hücum Tüfeği', 1940, { infAtk: 0.1, infDef: 0.1 }, ['inf3']),
  T('sup1', 'inf', 'Makineli Tüfek Bölükleri', 1931, { infDef: 0.08 }, ['inf1']),
  T('sup2', 'inf', 'Havan Takımları', 1935, { infAtk: 0.08 }, ['sup1']),
  T('mot1', 'inf', 'Motorize Piyade', 1932, { speed: 0.04 }, ['inf1'], { unlock: 'Motorize tabur ve motorlu araç üretimi' }),
  T('eng1', 'inf', 'İstihkâm Birlikleri', 1934, { entrench: 0.1, amphib: 0.1 }, ['sup1']),
  T('med1', 'inf', 'Sahra Hastaneleri', 1937, { recovery: 0.25 }, ['eng1']),

  T('art1', 'art', 'Sahra Topçusu I', 1930, { artAtk: 0.1 }),
  T('art2', 'art', 'Sahra Topçusu II', 1934, { artAtk: 0.1 }, ['art1']),
  T('art3', 'art', 'Ağır Topçu', 1938, { artAtk: 0.12 }, ['art2']),
  T('art4', 'art', 'Roket Topçusu', 1941, { artAtk: 0.15 }, ['art3']),
  T('at1', 'art', 'Tanksavar Topu', 1935, { antiTank: 0.2 }, ['art1']),
  T('aa1', 'art', 'Uçaksavar Bataryası', 1936, { antiAir: 0.25 }, ['art1']),

  T('tank1', 'arm', 'Hafif Tank', 1931, {}, [], { unlock: 'Tank taburu ve tank üretimi' }),
  T('tank2', 'arm', 'Orta Tank', 1935, { tankAtk: 0.15, tankBrk: 0.15 }, ['tank1']),
  T('tank3', 'arm', 'Ağır Tank', 1939, { tankAtk: 0.15, tankBrk: 0.2 }, ['tank2']),
  T('tank4', 'arm', 'Ana Muharebe Tankı', 1942, { tankAtk: 0.2, tankBrk: 0.2 }, ['tank3']),
  T('mech1', 'arm', 'Zırhlı Bakım Bölükleri', 1936, { speed: 0.08 }, ['tank1']),

  T('fig1', 'air', 'Avcı Uçağı I', 1931, {}, [], { unlock: 'Avcı uçağı üretimi' }),
  T('fig2', 'air', 'Avcı Uçağı II', 1935, { airPower: 0.2 }, ['fig1']),
  T('fig3', 'air', 'Avcı Uçağı III', 1939, { airPower: 0.25 }, ['fig2']),
  T('fig4', 'air', 'Jet Avcı', 1943, { airPower: 0.35 }, ['fig3']),
  T('cas1', 'air', 'Taarruz Uçağı I', 1932, {}, ['fig1'], { unlock: 'Taarruz uçağı üretimi' }),
  T('cas2', 'air', 'Taarruz Uçağı II', 1936, { casPower: 0.25 }, ['cas1']),
  T('cas3', 'air', 'Taarruz Uçağı III', 1940, { casPower: 0.3 }, ['cas2']),
  T('rad1', 'air', 'Radar Ağı', 1938, { airPower: 0.1, antiAir: 0.1 }, ['fig2']),

  T('nav1', 'nav', 'Muhrip Filoları', 1930, { navalBuild: 0.2 }),
  T('nav2', 'nav', 'Kruvazör Programı', 1934, { navalBuild: 0.2, navalPower: 0.1 }, ['nav1']),
  T('nav3', 'nav', 'Uçak Gemisi', 1938, { navalPower: 0.2 }, ['nav2']),
  T('sub1', 'nav', 'Denizaltı Harbi', 1936, { navalPower: 0.1 }, ['nav1']),
  T('nav4', 'nav', 'Çıkarma Araçları', 1937, { amphib: 0.25 }, ['nav1']),

  T('tool1', 'ind', 'Takım Tezgâhları I', 1931, { prodCap: 0.08 }),
  T('tool2', 'ind', 'Takım Tezgâhları II', 1934, { prodCap: 0.08 }, ['tool1']),
  T('tool3', 'ind', 'Takım Tezgâhları III', 1937, { prodCap: 0.08 }, ['tool2']),
  T('tool4', 'ind', 'Akan Bant Üretimi', 1940, { prodCap: 0.1 }, ['tool3']),
  T('cons1', 'ind', 'İnşaat Teknikleri I', 1931, { construction: 0.1 }),
  T('cons2', 'ind', 'İnşaat Teknikleri II', 1934, { construction: 0.1 }, ['cons1']),
  T('cons3', 'ind', 'İnşaat Teknikleri III', 1937, { construction: 0.1 }, ['cons2']),
  T('cons4', 'ind', 'Prefabrik Yapılar', 1940, { construction: 0.12 }, ['cons3']),
  T('extr1', 'ind', 'Maden İşleme I', 1932, { resources: 0.12 }),
  T('extr2', 'ind', 'Maden İşleme II', 1936, { resources: 0.12 }, ['extr1']),
  T('extr3', 'ind', 'Maden İşleme III', 1940, { resources: 0.14 }, ['extr2']),
  T('conc1', 'ind', 'Yoğun Sanayi I', 1933, { prodOut: 0.06, slots: 1 }, ['tool1']),
  T('conc2', 'ind', 'Yoğun Sanayi II', 1937, { prodOut: 0.06, slots: 1 }, ['conc1']),
  T('conc3', 'ind', 'Yoğun Sanayi III', 1941, { prodOut: 0.08, slots: 1 }, ['conc2']),
  T('fuel1', 'ind', 'Sentetik Yakıt', 1937, { synthOil: 10 }, ['extr1']),

  T('sci1', 'sci', 'Araştırma Enstitüleri I', 1931, { research: 0.06 }),
  T('sci2', 'sci', 'Araştırma Enstitüleri II', 1935, { research: 0.06 }, ['sci1']),
  T('sci3', 'sci', 'Araştırma Enstitüleri III', 1939, { research: 0.07 }, ['sci2']),
  T('sci4', 'sci', 'Hesap Makineleri', 1942, { research: 0.08 }, ['sci3']),
  T('rad0', 'sci', 'Sahra Telsizi', 1932, { org: 0.05 }),
  T('rad2', 'sci', 'Taşınabilir Telsiz', 1937, { org: 0.05, orgRegen: 0.1 }, ['rad0']),
  T('cod1', 'sci', 'Şifreleme', 1936, { def: 0.03 }, ['rad0']),
  T('cod2', 'sci', 'Şifre Çözme', 1940, { atk: 0.04 }, ['cod1']),

  T('doc1', 'doc', 'Siper Savaşı', 1930, { def: 0.05, entrench: 0.1 }),
  T('doc2', 'doc', 'Ateş ve Manevra', 1933, { atk: 0.05 }, ['doc1']),
  T('doc3', 'doc', 'Hareket Savaşı', 1936, { speed: 0.1, brk: 0.1 }, ['doc2']),
  T('doc4', 'doc', 'Derin Harekât', 1939, { atk: 0.05, org: 0.05, orgRegen: 0.15 }, ['doc3']),
  T('doc5', 'doc', 'Birleşik Silahlar', 1942, { atk: 0.08, def: 0.08 }, ['doc4']),
  T('log1', 'doc', 'Lojistik Teşkilatı', 1934, { orgRegen: 0.1, reinforce: 0.25 }, ['doc1']),
  T('log2', 'doc', 'Cephe İkmal Sistemi', 1938, { orgRegen: 0.1, reinforce: 0.25 }, ['log1']),
];
export const TECH_BY_ID = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const TECH_BASE_DAYS = 130;

export const MOD_LABEL = {
  infAtk: 'Piyade saldırısı', infDef: 'Piyade savunması', artAtk: 'Topçu saldırısı', tankAtk: 'Tank saldırısı',
  tankBrk: 'Tank yarma gücü', antiTank: 'Tanksavar etkisi', antiAir: 'Hava savunması', org: 'Teşkilat',
  orgRegen: 'Teşkilat toparlanması', speed: 'Birlik hızı', atk: 'Saldırı', def: 'Savunma', brk: 'Yarma gücü',
  entrench: 'Mevzilenme', airPower: 'Hava gücü', casPower: 'Yakın hava desteği', navalBuild: 'Gemi inşa hızı',
  navalPower: 'Donanma etkinliği', prodCap: 'Üretim verimi tavanı', prodOut: 'Askeri üretim', construction: 'İnşaat hızı',
  resources: 'Kaynak çıkarımı', research: 'Araştırma hızı', manpower: 'Askere alınabilir nüfus', ppGain: 'Günlük nüfuz',
  slots: 'Eyalet yapı yuvası', synthOil: 'Sentetik petrol', coreDef: 'Anavatanda savunma', amphib: 'Çıkarma harekâtı',
  recovery: 'Yaralı geri kazanımı', reinforce: 'Takviye hızı', justify: 'Savaş gerekçesi hızı',
};
export const MOD_FLAT = { slots: 1, synthOil: 1, ppGain: 1 };

// Ulusal hedef ağacı. x: sütun, y: satır.
const GO = (id, name, x, y, desc, fx, req, extra) => ({ id, name, x, y, desc, fx: fx || {}, req: req || [], ...(extra || {}) });
export const GOAL_DAYS = 56;
export const GOAL_BRANCHES = [
  { name: 'Sanayi', from: 0, to: 2 },
  { name: 'Ordu', from: 3, to: 5 },
  { name: 'Siyaset', from: 6, to: 8 },
];
export const GOALS = [
  GO('g_ind1', 'Kalkınma Planı', 1, 0, '2 sivil fabrika kurulur.', { add: { civ: 2 } }),
  GO('g_ind2', 'Kamu Yatırımları', 0, 1, '2 sivil fabrika, üç eyalette altyapı artışı.', { add: { civ: 2, infra: 3 } }, ['g_ind1']),
  GO('g_ind3', 'Silah Fabrikaları', 2, 1, '2 askeri fabrika kurulur.', { add: { mil: 2 } }, ['g_ind1']),
  GO('g_ind4', 'Ağır Sanayi', 0, 2, '3 sivil fabrika, inşaat hızı +%10.', { add: { civ: 3 }, mods: { construction: 0.1 } }, ['g_ind2']),
  GO('g_ind5', 'Teknik Üniversite', 1, 2, 'Bir araştırma yuvası daha açılır.', { add: { research: 1 } }, ['g_ind2']),
  GO('g_ind6', 'Savaş Sanayii', 2, 2, '3 askeri fabrika, askeri üretim +%10.', { add: { mil: 3 }, mods: { prodOut: 0.1 } }, ['g_ind3']),
  GO('g_ind7', 'Maden Seferberliği', 0, 3, 'Yeni çelik, alüminyum ve petrol yatakları açılır.', { add: { res: { steel: 20, alu: 10, oil: 8 } } }, ['g_ind4']),
  GO('g_ind8', 'Bilim Akademisi', 1, 3, 'Bir araştırma yuvası daha, araştırma +%5.', { add: { research: 1 }, mods: { research: 0.05 } }, ['g_ind5']),
  GO('g_ind9', 'Seri Üretim', 2, 3, 'Üretim verimi tavanı +%10.', { mods: { prodCap: 0.1 } }, ['g_ind6']),

  GO('g_arm1', 'Ordu Reformu', 4, 0, 'Teşkilat +%5.', { mods: { org: 0.05 } }),
  GO('g_arm2', 'Topçu Okulu', 3, 1, 'Topçu saldırısı +%10, depoya 150 top.', { mods: { artAtk: 0.1 }, add: { stock: { arty: 150 } } }, ['g_arm1']),
  GO('g_arm3', 'Harp Akademisi', 4, 1, 'Saldırı ve savunma +%5.', { mods: { atk: 0.05, def: 0.05 } }, ['g_arm1']),
  GO('g_arm4', 'Zırhlı Kuvvetler', 5, 1, 'Hafif Tank teknolojisi kazanılır, depoya 80 tank.', { add: { stock: { tank: 80 }, tech: 'tank1' }, mods: { tankAtk: 0.05 } }, ['g_arm1']),
  GO('g_arm5', 'Tahkimat Hattı', 3, 2, 'En tehditkâr komşu sınırına 2. seviye tahkimat.', { special: 'forts' }, ['g_arm2']),
  GO('g_arm6', 'Seferberlik Planı', 4, 2, 'Askere alınabilir nüfus +%1,5, savaş desteği +10.', { mods: { manpower: 0.015 }, add: { warSupport: 10 } }, ['g_arm3']),
  GO('g_arm7', 'Hava Kuvvetleri', 5, 2, 'Avcı Uçağı I kazanılır, depoya 120 avcı, hava gücü +%10.', { add: { stock: { fighter: 120 }, tech: 'fig1' }, mods: { airPower: 0.1 } }, ['g_arm4']),
  GO('g_arm8', 'Donanma Programı', 3, 3, '2 tersane ve 150 donanma gücü.', { add: { dock: 2, naval: 150 } }, ['g_arm5']),
  GO('g_arm9', 'Büyük Strateji', 4, 3, 'Saldırı ve savunma +%8, toparlanma +%10.', { mods: { atk: 0.08, def: 0.08, orgRegen: 0.1 } }, ['g_arm6']),
  GO('g_arm10', 'Yıldırım Harekâtı', 5, 3, 'Birlik hızı +%10, yarma gücü +%10.', { mods: { speed: 0.1, brk: 0.1 } }, ['g_arm7']),

  GO('g_pol1', 'Ulusal Birlik', 7, 0, 'İstikrar +10.', { add: { stability: 10 } }),
  GO('g_pol2', 'Basın ve Propaganda', 6, 1, 'Savaş desteği +10, günlük nüfuz +0,25.', { add: { warSupport: 10 }, mods: { ppGain: 0.25 } }, ['g_pol1']),
  GO('g_pol3', 'Dış Açılım', 8, 1, '60 nüfuz ve aynı ideolojideki devletlerle ilişki +20.', { add: { pp: 60 }, special: 'opinion' }, ['g_pol1']),
  GO('g_pol4', 'Yayılmacı Siyaset', 6, 2, 'Anında kullanılabilir bir savaş gerekçesi hakkı, gerekçe hızı +%30.', { add: { freeGoal: 1 }, mods: { justify: 0.3 } }, ['g_pol2'], { excl: 'g_pol5', need: 'expansion' }),
  GO('g_pol5', 'Tarafsızlık Bildirgesi', 7, 2, 'İstikrar +10, anavatanda savunma +%15.', { add: { stability: 10 }, mods: { coreDef: 0.15 } }, ['g_pol1'], { excl: 'g_pol4' }),
  GO('g_pol6', 'İttifak Siyaseti', 8, 2, 'İdeolojik blok kurulur veya mevcut bloğa katılınır.', { special: 'faction' }, ['g_pol3']),
  GO('g_pol7', 'Topyekûn Savaş Ruhu', 6, 3, 'Savaş desteği +15, asker oranı +%1, saldırı +%5.', { add: { warSupport: 15 }, mods: { manpower: 0.01, atk: 0.05 } }, ['g_pol4']),
  GO('g_pol8', 'İstihbarat Teşkilatı', 7, 3, 'Tüm düşman birlikleri haritada görünür, savunma +%3.', { special: 'intel', mods: { def: 0.03 } }, ['g_pol2']),
  GO('g_pol9', 'Kader Ortaklığı', 8, 3, 'Araştırma +%5, günlük nüfuz +0,15.', { mods: { research: 0.05, ppGain: 0.15 } }, ['g_pol6']),
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Saat sayacından tarih (artık yıl yok: 365 günlük takvim).
export function dateOf(hours) {
  const dayTotal = Math.floor(hours / 24);
  const year = START_YEAR + Math.floor(dayTotal / 365);
  let d = dayTotal % 365, m = 0;
  while (d >= MDAYS[m]) { d -= MDAYS[m]; m++; }
  return { year, month: m, day: d + 1, hour: hours % 24, dayTotal };
}
export function fmtDate(hours, withHour) {
  const d = dateOf(hours);
  return `${d.day} ${MONTHS[d.month]} ${d.year}` + (withHour ? ` ${String(d.hour).padStart(2, '0')}:00` : '');
}
export function yearFrac(hours) { return START_YEAR + hours / (24 * 365); }
