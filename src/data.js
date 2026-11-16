// Oyunun sabit verileri: uluslar, teçhizat, birlikler, teknolojiler, hedefler, yasalar.

export const START_YEAR = 1936;

export const IDEOLOGY = {
  dem: { name: 'Cumhuriyetçi', desc: 'Seçimle yönetilen, savaşa geç giren ama sanayisi güçlü devletler.', color: '#5b8fd1' },
  mil: { name: 'Militarist', desc: 'Ordunun yönettiği, yayılmacı ve savaşa hazır devletler.', color: '#9a7fb5' },
  kol: { name: 'Kolektivist', desc: 'Devrimci, kitle seferberliğine dayanan devletler.', color: '#d06a5c' },
  mon: { name: 'Tarafsız', desc: 'Bloklara mesafeli duran, denge siyaseti izleyen devletler.', color: '#c9a95a' },
};

// 1936 dünyası. İlk 7 ülke büyük güç. Sütunlar:
// etiket, ad, resmî ad, ideoloji, harita rengi, başkent, boylam, enlem, nüfus (Mn), sivil, askeri, tersane, tümen, bayrak
const N = (tag, name, long, ideo, color, cap, lon, lat, pop, civ, mil, dock, divs, flag, x) => ({ tag, name, long, ideo, color, cap, lon, lat, pop, civ, mil, dock, divs, flag, ...(x || {}) });
export const NATIONS = [
  N('GER', 'Almanya', 'Alman İmparatorluğu', 'mil', [108, 112, 120], 'Berlin', 13.4, 52.5, 67, 28, 24, 6, 46, 'h:000000,ffffff,dd0000'),
  N('ENG', 'Britanya', 'Birleşik Krallık', 'dem', [214, 116, 124], 'Londra', -0.1, 51.5, 47, 32, 14, 14, 26, 'u', { faction: 'Müttefikler' }),
  N('FRA', 'Fransa', 'Fransa Cumhuriyeti', 'dem', [86, 122, 196], 'Paris', 2.35, 48.85, 41, 26, 12, 7, 34, 'v:0055a4,ffffff,ef4135'),
  N('ITA', 'İtalya', 'İtalya Krallığı', 'mil', [104, 160, 104], 'Roma', 12.5, 41.9, 43, 20, 14, 8, 30, 'v:009246,ffffff,ce2b37'),
  N('SOV', 'Sovyetler Birliği', 'Sovyet Sosyalist Cumhuriyetler Birliği', 'kol', [150, 48, 54], 'Moskova', 37.6, 55.75, 165, 36, 26, 6, 70, 'p:cc0000|e:star:ffd700:tl'),
  N('USA', 'ABD', 'Amerika Birleşik Devletleri', 'dem', [92, 148, 188], 'Vaşington', -77.0, 38.9, 128, 52, 10, 12, 14, 's', { iso: true }),
  N('JAP', 'Japonya', 'Japon İmparatorluğu', 'mil', [226, 208, 176], 'Tokyo', 139.7, 35.7, 70, 20, 16, 10, 40, 'p:ffffff|e:disc:bc002d'),
  N('CHI', 'Çin', 'Çin Cumhuriyeti', 'mon', [222, 196, 96], 'Nankin', 118.8, 32.05, 400, 8, 5, 1, 44, 'p:de2910|k:1a3a8a|e:sun:ffffff:tl', { light: 0.8 }),
  N('TUR', 'Türkiye', 'Türkiye Cumhuriyeti', 'mon', [232, 104, 62], 'Ankara', 32.85, 39.93, 16, 6, 3, 1, 18, 'p:e30a17|e:crescent:ffffff'),
  N('POL', 'Polonya', 'Polonya Cumhuriyeti', 'mon', [190, 120, 150], 'Varşova', 21.0, 52.2, 34, 9, 5, 1, 30, 'h:ffffff,dc143c'),
  N('SPA', 'İspanya', 'İspanya Cumhuriyeti', 'dem', [220, 186, 90], 'Madrid', -3.7, 40.4, 25, 8, 4, 3, 16, 'h:c60b1e,ffc400,630b57'),
  N('POR', 'Portekiz', 'Portekiz Cumhuriyeti', 'mon', [70, 140, 110], 'Lizbon', -9.1, 38.7, 7, 3, 1, 1, 6, 'v:006600,ff0000|e:disc:ffcc00'),
  N('NED', 'Hollanda', 'Hollanda Krallığı', 'dem', [226, 150, 80], 'Amsterdam', 4.9, 52.4, 8.5, 7, 2, 3, 8, 'h:ae1c28,ffffff,21468b'),
  N('BEL', 'Belçika', 'Belçika Krallığı', 'dem', [196, 170, 70], 'Brüksel', 4.35, 50.85, 8.3, 7, 2, 1, 10, 'v:000000,fae042,ed2939'),
  N('SWI', 'İsviçre', 'İsviçre Konfederasyonu', 'dem', [190, 90, 90], 'Bern', 7.45, 46.95, 4.2, 5, 2, 0, 8, 'p:d52b1e|e:plus:ffffff'),
  N('AUT', 'Avusturya', 'Avusturya Federal Devleti', 'mon', [200, 200, 200], 'Viyana', 16.37, 48.2, 6.7, 5, 2, 0, 7, 'h:ed2939,ffffff,ed2939'),
  N('CZE', 'Çekoslovakya', 'Çekoslovakya Cumhuriyeti', 'dem', [90, 170, 170], 'Prag', 14.4, 50.08, 15, 10, 7, 0, 16, 'h:ffffff,d7141a|tri:11457e'),
  N('HUN', 'Macaristan', 'Macaristan Krallığı', 'mon', [150, 120, 90], 'Budapeşte', 19.05, 47.5, 9, 5, 2, 0, 8, 'h:cd2a3e,ffffff,436f4d'),
  N('ROM', 'Romanya', 'Romanya Krallığı', 'mon', [214, 196, 70], 'Bükreş', 26.1, 44.43, 19, 6, 3, 1, 22, 'v:002b7f,fcd116,ce1126'),
  N('YUG', 'Yugoslavya', 'Yugoslavya Krallığı', 'mon', [80, 100, 150], 'Belgrad', 20.47, 44.8, 15, 5, 2, 1, 18, 'h:0c4076,ffffff,de0000'),
  N('BUL', 'Bulgaristan', 'Bulgaristan Çarlığı', 'mon', [110, 150, 90], 'Sofya', 23.32, 42.7, 6.3, 3, 1, 0, 10, 'h:ffffff,00966e,d62612'),
  N('GRE', 'Yunanistan', 'Yunanistan Krallığı', 'mon', [110, 170, 220], 'Atina', 23.73, 37.98, 7, 3, 1, 2, 10, 'p:0d5eaf|e:plus:ffffff'),
  N('ALB', 'Arnavutluk', 'Arnavutluk Krallığı', 'mon', [160, 60, 90], 'Tiran', 19.82, 41.33, 1, 1, 0, 0, 2, 'p:e41e20|e:diamond:000000'),
  N('SWE', 'İsveç', 'İsveç Krallığı', 'dem', [80, 140, 200], 'Stokholm', 18.07, 59.33, 6.3, 8, 3, 3, 9, 'p:006aa7|x:fecc00'),
  N('NOR', 'Norveç', 'Norveç Krallığı', 'dem', [150, 110, 90], 'Oslo', 10.75, 59.9, 2.9, 4, 1, 2, 5, 'p:ba0c2f|x:ffffff,00205b'),
  N('DEN', 'Danimarka', 'Danimarka Krallığı', 'dem', [180, 100, 90], 'Kopenhag', 12.57, 55.68, 3.7, 5, 1, 2, 4, 'p:c8102e|x:ffffff'),
  N('FIN', 'Finlandiya', 'Finlandiya Cumhuriyeti', 'dem', [220, 220, 235], 'Helsinki', 24.94, 60.17, 3.6, 3, 1, 1, 9, 'p:ffffff|x:003580'),
  N('EST', 'Estonya', 'Estonya Cumhuriyeti', 'mon', [90, 150, 200], 'Tallinn', 24.75, 59.44, 1.1, 1, 0, 0, 3, 'h:0072ce,000000,ffffff'),
  N('LAT', 'Letonya', 'Letonya Cumhuriyeti', 'mon', [140, 70, 80], 'Riga', 24.1, 56.95, 1.9, 2, 0, 0, 3, 'h:9e3039,ffffff,9e3039'),
  N('LIT', 'Litvanya', 'Litvanya Cumhuriyeti', 'mon', [200, 170, 80], 'Kaunas', 23.9, 54.9, 2.5, 1, 0, 0, 3, 'h:fdb913,006a44,c1272d'),
  N('IRE', 'İrlanda', 'İrlanda Özgür Devleti', 'dem', [110, 180, 110], 'Dublin', -6.26, 53.35, 3, 2, 0, 0, 2, 'v:169b62,ffffff,ff883e'),
  N('PER', 'İran', 'İran Şahlığı', 'mon', [120, 150, 130], 'Tahran', 51.4, 35.7, 15, 2, 1, 0, 8, 'h:239f40,ffffff,da0000|e:sun:d4a017'),
  N('IRQ', 'Irak', 'Irak Krallığı', 'mon', [150, 110, 110], 'Bağdat', 44.4, 33.3, 3.5, 1, 0, 0, 3, 'h:000000,ffffff,007a3d|tri:ce1126'),
  N('SAU', 'Suudi Arabistan', 'Suudi Arabistan Krallığı', 'mon', [120, 160, 100], 'Riyad', 46.7, 24.7, 3, 1, 0, 0, 3, 'p:006c35|e:bar:ffffff'),
  N('YEM', 'Yemen', 'Yemen Krallığı', 'mon', [150, 100, 80], 'Sana', 44.2, 15.35, 3, 1, 0, 0, 2, 'p:ce1126|e:star:ffffff'),
  N('AFG', 'Afganistan', 'Afganistan Krallığı', 'mon', [110, 130, 160], 'Kabil', 69.2, 34.5, 8, 1, 0, 0, 4, 'v:000000,d32011,007a36'),
  N('SIA', 'Siyam', 'Siyam Krallığı', 'mon', [200, 180, 120], 'Bangkok', 100.5, 13.75, 14, 2, 1, 1, 6, 'h:a51931,f4f5f8,2d2a4a,f4f5f8,a51931'),
  N('MON', 'Moğolistan', 'Moğolistan Halk Cumhuriyeti', 'kol', [196, 150, 100], 'Ulan Batur', 106.9, 47.9, 0.8, 1, 0, 0, 2, 'p:c4272f|e:sun:f9cf02'),
  N('ETH', 'Etiyopya', 'Etiyopya İmparatorluğu', 'mon', [150, 160, 90], 'Addis Ababa', 38.75, 9.0, 12, 1, 0, 0, 8, 'h:078930,fcdd09,da121a', { light: 1 }),
  N('LIB', 'Liberya', 'Liberya Cumhuriyeti', 'dem', [170, 170, 220], 'Monrovia', -10.8, 6.3, 1, 1, 0, 0, 1, 'h:bf0a30,ffffff,bf0a30,ffffff,bf0a30|k:002868|e:star:ffffff:tl'),
  N('SAF', 'Güney Afrika', 'Güney Afrika Birliği', 'dem', [180, 140, 170], 'Pretoria', 28.2, -25.75, 10, 5, 1, 1, 4, 'h:ff7900,ffffff,004494', { faction: 'Müttefikler' }),
  N('CAN', 'Kanada', 'Kanada Dominyonu', 'dem', [190, 110, 100], 'Ottava', -75.7, 45.4, 11, 10, 2, 2, 5, 'p:c8102e|ku', { faction: 'Müttefikler' }),
  N('AST', 'Avustralya', 'Avustralya Federasyonu', 'dem', [100, 160, 150], 'Canberra', 149.1, -35.3, 6.8, 6, 1, 2, 4, 'p:00247d|ku|e:star:ffffff:r', { faction: 'Müttefikler' }),
  N('NZL', 'Yeni Zelanda', 'Yeni Zelanda Dominyonu', 'dem', [150, 130, 180], 'Wellington', 174.8, -41.3, 1.6, 2, 0, 1, 2, 'p:00247d|ku|e:star:cc142b:r', { faction: 'Müttefikler' }),
  N('MEX', 'Meksika', 'Meksika Birleşik Devletleri', 'mon', [120, 170, 110], 'Meksiko', -99.13, 19.43, 18, 5, 1, 0, 8, 'v:006847,ffffff,ce1126|e:disc:8a6b2b'),
  N('CUB', 'Küba', 'Küba Cumhuriyeti', 'mon', [150, 150, 200], 'Havana', -82.4, 23.1, 4, 1, 0, 0, 2, 'h:002a8f,ffffff,002a8f,ffffff,002a8f|tri:cf142b'),
  N('HAI', 'Haiti', 'Haiti Cumhuriyeti', 'mon', [130, 120, 180], 'Port-au-Prince', -72.34, 18.54, 2.5, 1, 0, 0, 1, 'h:00209f,d21034'),
  N('DOM', 'Dominik', 'Dominik Cumhuriyeti', 'mon', [180, 130, 130], 'Santo Domingo', -69.9, 18.48, 1.5, 1, 0, 0, 1, 'q:002d62,ce1126'),
  N('GUA', 'Guatemala', 'Guatemala Cumhuriyeti', 'mon', [130, 180, 200], 'Guatemala', -90.5, 14.6, 2, 1, 0, 0, 1, 'v:4997d0,ffffff,4997d0'),
  N('HON', 'Honduras', 'Honduras Cumhuriyeti', 'mon', [110, 150, 190], 'Tegucigalpa', -87.2, 14.1, 1, 1, 0, 0, 1, 'h:0073cf,ffffff,0073cf|e:star:0073cf'),
  N('ELS', 'El Salvador', 'El Salvador Cumhuriyeti', 'mon', [170, 190, 220], 'San Salvador', -89.2, 13.7, 1.5, 1, 0, 0, 1, 'h:0f47af,ffffff,0f47af'),
  N('NIC', 'Nikaragua', 'Nikaragua Cumhuriyeti', 'mon', [150, 200, 200], 'Managua', -86.25, 12.13, 0.8, 1, 0, 0, 1, 'h:0067c6,ffffff,0067c6|e:disc:c8a400'),
  N('COS', 'Kosta Rika', 'Kosta Rika Cumhuriyeti', 'dem', [200, 150, 150], 'San José', -84.08, 9.93, 0.6, 1, 0, 0, 1, 'h:002b7f,ffffff,ce1126,ffffff,002b7f'),
  N('PAN', 'Panama', 'Panama Cumhuriyeti', 'dem', [220, 170, 140], 'Panama', -79.52, 8.98, 0.6, 1, 0, 0, 1, 'q:ffffff,d21034'),
  N('COL', 'Kolombiya', 'Kolombiya Cumhuriyeti', 'dem', [220, 200, 110], 'Bogota', -74.08, 4.6, 8.5, 2, 0, 0, 4, 'h:fcd116,fcd116,003893,ce1126'),
  N('VEN', 'Venezuela', 'Venezuela Birleşik Devletleri', 'mon', [200, 150, 90], 'Karakas', -66.9, 10.5, 3.5, 2, 0, 0, 3, 'h:ffcc00,00247d,cf142b'),
  N('ECU', 'Ekvador', 'Ekvador Cumhuriyeti', 'mon', [200, 190, 130], 'Quito', -78.5, -0.2, 2.5, 1, 0, 0, 2, 'h:ffdd00,ffdd00,034ea2,ed1c24'),
  N('PRU', 'Peru', 'Peru Cumhuriyeti', 'mon', [200, 120, 110], 'Lima', -77.03, -12.05, 6.5, 2, 0, 0, 4, 'v:d91023,ffffff,d91023'),
  N('BOL', 'Bolivya', 'Bolivya Cumhuriyeti', 'mon', [170, 190, 110], 'La Paz', -68.15, -16.5, 2.7, 1, 0, 0, 3, 'h:d52b1e,f9e300,007934'),
  N('PAR', 'Paraguay', 'Paraguay Cumhuriyeti', 'mon', [190, 130, 150], 'Asunción', -57.6, -25.3, 1, 1, 0, 0, 3, 'h:d52b1e,ffffff,0038a8'),
  N('URU', 'Uruguay', 'Uruguay Doğu Cumhuriyeti', 'dem', [150, 190, 220], 'Montevideo', -56.2, -34.9, 2, 2, 0, 0, 2, 'h:ffffff,0038a8,ffffff,0038a8,ffffff|k:ffffff|e:sun:fcd116:tl'),
  N('CHL', 'Şili', 'Şili Cumhuriyeti', 'dem', [180, 100, 120], 'Santiago', -70.65, -33.45, 4.7, 3, 1, 1, 5, 'h:ffffff,d52b1e|k:0039a6|e:star:ffffff:tl'),
  N('ARG', 'Arjantin', 'Arjantin Cumhuriyeti', 'mon', [150, 200, 230], 'Buenos Aires', -58.4, -34.6, 13, 7, 2, 2, 8, 'h:74acdf,ffffff,74acdf|e:sun:f6b40e'),
  N('BRA', 'Brezilya', 'Brezilya Birleşik Devletleri', 'mon', [110, 180, 110], 'Rio de Janeiro', -43.2, -22.9, 39, 9, 2, 2, 12, 'p:009b3a|e:diamond:fedf00'),
];
export const MAJORS = 7;
export const TAG_INDEX = Object.fromEntries(NATIONS.map((n, i) => [n.tag, i]));
// Başlangıçta verilmiş bağımsızlık garantileri (garantör -> korunan)
export const START_GUARANTEES = [['SOV', 'MON'], ['ENG', 'POL'], ['FRA', 'POL'], ['FRA', 'CZE'], ['ENG', 'BEL'], ['FRA', 'BEL']];

export const FACTION_NAMES = {
  dem: 'Müttefikler',
  mil: 'Mihver',
  kol: 'Komintern',
  mon: 'Tarafsızlar Bloğu',
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
