// Natural Earth (kamu malı) verisinden oyunun 1936 dünya haritası verisini üretir: src/geodata.js
// Kullanım: node tools/build-geo.mjs [geojson klasörü]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIONS, TAG_INDEX } from '../src/data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = process.argv[2] || path.join(root, 'tools', '.geo-cache');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
async function load(name) {
  const f = path.join(cache, name + '.geojson');
  if (!fs.existsSync(f)) {
    fs.mkdirSync(cache, { recursive: true });
    const r = await fetch(BASE + name + '.geojson');
    if (!r.ok) throw new Error('indirilemedi: ' + name);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// ---- izdüşüm: Merkator, -169° boylamından kesilmiş
const W = 3072, H = 1536, LON0 = -169, LAT_S = -56;
const SCALE = W / (2 * Math.PI);
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const yN = merc(LAT_S) + H / SCALE;
const LAT_N = (2 * Math.atan(Math.exp(yN)) - Math.PI / 2) * (180 / Math.PI);
const px = (lon) => (((lon - LON0) % 360 + 360) % 360) / 360 * W;
const py = (lat) => (yN - merc(Math.max(LAT_S - 1.5, Math.min(LAT_N + 1.5, lat)))) * SCALE;
const P = (lon, lat) => [px(lon), py(lat)];
const r1 = (v) => Math.round(v * 4) / 4;

// ---- modern ülke kodu -> 1936 sahibi. '*' anavatan (çekirdek) demek.
const OWN = {
  GER: 'DEU*', ENG: 'GBR* IMN* IND PAK BGD MMR LKA NPL BTN MYS BRN SGP EGY SDN SDS KEN UGA TZA ZMB ZWE MWI BWA NGA GHA SLE GMB SOL JOR ISR PSX KWT OMN ARE QAT BHR GUY BLZ JAM BHS TTO CYP CYN MLT FLK KAS',
  FRA: 'FRA* DZA TUN MAR MRT MLI NER TCD SEN GIN CIV BFA BEN TGO CMR CAF GAB COG MDG DJI SYR LBN VNM LAO KHM NCL', ITA: 'ITA* LBY ERI SOM',
  SOV: 'RUS* UKR* BLR* KAZ* UZB* TKM* KGZ* TJK* GEO* ARM* AZE*', USA: 'USA* PHL PRI', JAP: 'JPN* PRK KOR TWN', CHI: 'CHN*', MON: 'MNG*', TUR: 'TUR*', POL: 'POL*',
  SPA: 'ESP* SAH GNQ', POR: 'PRT* AGO MOZ GNB TLS', NED: 'NLD* IDN SUR', BEL: 'BEL* LUX* COD RWA BDI', SWI: 'CHE* LIE*', AUT: 'AUT*', CZE: 'CZE* SVK*', HUN: 'HUN*',
  ROM: 'ROU* MDA*', YUG: 'SRB* HRV* SVN* BIH* MNE* MKD* KOS*', BUL: 'BGR*', GRE: 'GRC*', ALB: 'ALB*', SWE: 'SWE*', NOR: 'NOR*', DEN: 'DNK* GRL ISL FRO', FIN: 'FIN* ALD*',
  EST: 'EST*', LAT: 'LVA*', LIT: 'LTU*', IRE: 'IRL*', PER: 'IRN*', IRQ: 'IRQ*', SAU: 'SAU*', YEM: 'YEM*', AFG: 'AFG*', SIA: 'THA*', ETH: 'ETH*', LIB: 'LBR*',
  SAF: 'ZAF* NAM LSO SWZ', CAN: 'CAN*', AST: 'AUS* PNG', NZL: 'NZL*', MEX: 'MEX*', CUB: 'CUB*', HAI: 'HTI*', DOM: 'DOM*', GUA: 'GTM*', HON: 'HND*', ELS: 'SLV*', NIC: 'NIC*',
  COS: 'CRI*', PAN: 'PAN*', COL: 'COL*', VEN: 'VEN*', ECU: 'ECU*', PRU: 'PER*', BOL: 'BOL*', PAR: 'PRY*', URU: 'URY*', CHL: 'CHL*', ARG: 'ARG*', BRA: 'BRA*',
};
const A3 = {};
for (const tag in OWN) for (const c of OWN[tag].split(' ')) A3[c.replace('*', '')] = { tag, core: c.endsWith('*') ? 1 : 0 };

// ---- sınır düzeltmeleri (1936): [kaynak modern kodlar, yeni sahip, çekirdek mi, çokgen (boylam, enlem)]
const OVERRIDES = [
  ['RUS', 'GER', 1, [[19.3, 54.2], [23.0, 54.2], [23.0, 55.4], [19.3, 55.4]]],
  ['POL', 'GER', 1, [[14.0, 54.8], [16.3, 54.7], [17.0, 54.0], [16.6, 53.3], [15.9, 52.9], [15.8, 52.0], [17.0, 51.5], [18.3, 51.0], [19.0, 50.5], [18.9, 49.8], [14.5, 49.8], [14.0, 51.0]]],
  ['POL', 'GER', 1, [[19.3, 54.5], [22.6, 54.5], [22.6, 53.3], [19.5, 53.3]]],
  ['UKR', 'CZE', 1, [[22.0, 49.1], [24.7, 48.6], [24.5, 47.8], [22.1, 47.9]]],
  ['UKR', 'ROM', 1, [[28.0, 46.6], [30.4, 46.6], [30.4, 45.1], [28.0, 45.1]]],
  ['UKR', 'ROM', 1, [[25.0, 48.5], [26.7, 48.5], [26.7, 47.9], [25.0, 47.9]]],
  ['BLR', 'POL', 1, [[23.0, 56.3], [26.3, 56.3], [26.3, 51.2], [23.0, 51.2]]],
  ['UKR', 'POL', 1, [[23.4, 51.9], [26.6, 51.9], [26.6, 49.0], [25.6, 48.2], [24.2, 48.3], [22.6, 49.0], [22.6, 50.5]]],
  ['LTU', 'POL', 1, [[24.6, 55.3], [26.9, 55.7], [26.9, 53.8], [24.6, 53.9]]],
  ['CHN', 'JAP', 0, [[119.5, 53.6], [135.2, 53.6], [135.2, 42.5], [131.0, 42.3], [128.0, 41.3], [124.3, 39.8], [121.0, 38.6], [119.2, 40.0], [118.0, 41.6], [116.5, 43.5], [116.0, 46.5], [117.5, 49.7]]],
  ['RUS', 'JAP', 0, [[141.3, 50.0], [145.0, 50.0], [145.0, 45.5], [141.3, 45.5]]],
];

// ---- eyalet aralığı (km): [boylam0, boylam1, enlem0, enlem1, km] — ilk eşleşen geçerli
const DENSITY = [
  [-11, 31, 35, 60, 150], [25, 45, 34, 42.5, 170], [31, 50, 42.5, 62, 260], [4, 32, 60, 71, 300], [-10, 37, 29, 35, 330], [34, 62, 24, 40, 400],
  [112, 146, 22, 46, 220], [98, 112, 18, 42, 420], [66, 98, 5, 36, 480], [95, 155, -11, 22, 520], [-100, -66, 24, 50, 420], [-125, -100, 28, 50, 600],
];
const DEFAULT_R = 800;

// ---- dağ sıraları: [yükseklik, genişlik(°), noktalar...]
const RANGES = [
  [0.9, 1.2, 6.5, 44.5, 8, 46, 11, 46.8, 14, 47.2, 16, 47.5], [0.7, 0.8, -1.8, 43, 0.5, 42.7, 2.8, 42.4], [0.5, 0.7, 9, 44.3, 12, 43.2, 13.8, 42, 15.5, 40.8, 16.3, 39.5],
  [0.6, 0.9, 18, 49.3, 21, 49.2, 24, 48.5, 25.5, 47, 26, 45.7, 24, 45.5, 22.5, 45.3], [0.55, 1.0, 14.5, 45.5, 17, 44, 19.5, 42.5, 21, 41.5, 22, 40], [0.5, 0.6, 23, 42.8, 26.5, 42.7],
  [0.6, 1.6, 6, 60, 8, 61.5, 13, 64.5, 16, 67, 19, 68.5], [0.9, 1.0, 38.5, 44.2, 42, 43.2, 45, 42.6, 48.5, 41], [0.45, 1.2, 59, 51.5, 58.5, 55, 59.5, 59, 60, 62, 62, 66],
  [0.6, 1.0, 32, 41.2, 36, 40.8, 40, 40.5, 43, 40.3], [0.6, 1.0, 29.5, 36.8, 33, 37, 36, 37.8, 39, 38.5, 43, 38.5], [0.7, 1.5, 44.5, 37, 47, 34.5, 50, 32, 53, 29.5, 56, 28],
  [0.7, 0.7, 49, 37, 52, 36.2, 55, 36.8], [0.95, 1.8, 65, 34.5, 69, 35.5, 72, 37, 75, 38], [1.0, 1.8, 74, 35, 78, 32.5, 82, 30, 86, 28.2, 90, 28, 94, 28.5, 97, 28.5],
  [0.8, 1.4, 70, 41.5, 76, 42, 82, 42.8, 88, 43.3, 93, 43], [0.65, 1.5, 84, 50.5, 88, 49, 92, 47.5, 96, 46], [0.8, 1.2, 78, 36.5, 85, 36, 92, 36, 98, 35.5],
  [0.5, 1.0, 104, 34, 108, 33.8, 112, 33.5], [0.6, 0.7, 131, 33, 134, 34.8, 137, 36, 139, 37, 141, 39.5, 142.5, 43.5], [0.5, 0.6, 127.5, 40.5, 128.5, 38, 129, 36],
  [0.5, 2.5, 110, 56, 120, 57, 130, 58.5, 138, 60, 145, 63, 155, 65], [0.6, 1.4, 94, 53, 100, 52, 104, 51.5], [0.5, 0.8, 103, 20, 105.5, 17.5, 107.5, 14.5], [0.55, 0.8, 93.5, 24, 94.5, 20.5],
  [0.45, 0.6, 73.5, 19, 75, 15, 76.8, 11], [0.6, 1.0, -8.5, 31, -5, 32.5, -1, 34, 3, 35.5, 7, 36], [0.55, 1.2, 30, -1, 36, -2, 37.5, -3.3], [0.55, 1.0, 28, -31, 29.5, -29, 30.5, -25.5],
  [0.75, 2.2, -133, 60, -126, 55, -118, 51, -114, 47, -110.5, 43.5, -106.5, 39.5, -105.5, 35.5], [0.6, 0.9, -122, 48.5, -121.7, 44, -120, 39.5, -118.3, 36], [0.8, 1.3, -153, 62, -147, 63.3, -141, 61],
  [0.4, 1.0, -84.5, 34.5, -81, 37, -78, 40, -74.5, 42.5, -71, 44.5], [0.6, 1.0, -108, 29, -106, 25.5, -104, 22, -101, 19.5], [0.6, 1.0, -100.5, 25.5, -98.5, 21, -97, 18.5],
  [0.5, 0.6, -92, 15.5, -88, 14, -84.5, 11, -82.5, 9], [0.95, 1.5, -73, 10.5, -76, 5, -78.5, -1, -78, -6, -75.5, -11.5, -71, -15.5, -68.5, -19, -68, -24, -69.8, -30, -70.3, -36, -71.5, -42, -72.5, -48, -71, -53],
  [0.4, 0.9, 145.5, -17, 147.5, -22, 151, -27.5, 150, -33, 147.5, -37], [0.65, 0.6, 167.5, -45.5, 170.5, -43.5, 172.5, -42], [0.5, 0.5, -7, 43, -4, 43.1], [0.45, 0.5, -6.5, 40.3, -3.5, 41],
  [0.5, 0.5, -4, 37, -2.5, 37.2], [0.7, 0.9, 137, -4, 141, -5, 145, -6], [0.5, 0.6, 96.5, 4.5, 100.5, -0.5, 103.5, -4.5], [0.6, 0.9, 43, 21, 44, 16, 45, 14], [0.5, 0.7, 21, 41, 21.5, 39.5, 22.3, 38.3],
];
// ---- yayla ve bölgeler: [tür, boylam, enlem, rx(°), ry(°), değer]
const ZONES = [
  ['high', 88, 33, 12, 4.5, 0.7], ['high', 101, 26, 4, 4, 0.5], ['high', 39, 10, 4, 5, 0.65], ['high', 6, 23.5, 2.5, 2, 0.4], ['high', 18, 21, 2, 1.5, 0.45], ['high', -44, -18, 5, 6, 0.3],
  ['high', -62, 5, 4, 2.2, 0.4], ['high', -5, 57, 1.3, 1, 0.32], ['high', 3, 45, 1.3, 1.2, 0.33], ['high', 114, 2.5, 2.5, 2, 0.4], ['high', 47, -19, 1.2, 5, 0.38], ['high', -42, 69, 14, 6, 0.55],
  ['high', 35, 39, 4, 1.5, 0.3], ['high', 57, 33, 5, 4, 0.3], ['high', 66, 33.5, 3, 2, 0.5],
  ['desert', 10, 23.5, 26, 7.5], ['desert', 25, 25, 8, 6], ['desert', 47, 23, 8, 7], ['desert', 39, 32.5, 4, 2.5], ['desert', 56, 32.5, 4.5, 3.5], ['desert', 60, 41, 7, 3.5], ['desert', 83, 39, 7, 2.2],
  ['desert', 104, 43, 10, 3.5], ['desert', 71, 27, 3, 3], ['desert', 22, -24, 5, 4.5], ['desert', 15, -23, 1.5, 5], ['desert', 132, -25, 14, 6.5], ['desert', -108, 30, 6, 4.5], ['desert', -116, 39, 4, 3.5],
  ['desert', -69.5, -23, 1.5, 5], ['desert', -69, -45, 3, 6],
  ['forest', 85, 61, 60, 5.5], ['forest', -95, 56, 35, 6], ['forest', -62, -4, 12, 7.5], ['forest', 22, 0, 9, 5.5], ['forest', 102, 16, 7, 8], ['forest', 113, -1, 16, 5], ['forest', 16, 62, 6, 5],
  ['forest', -124, 48, 3, 6], ['forest', 111, 26, 7, 4], ['forest', 125, 56, 20, 6], ['forest', -5, 6.5, 9, 2.5], ['forest', -87, 14, 6, 3], ['forest', 10, 49.5, 3, 2], ['forest', 27, 57, 5, 3],
  ['marsh', 27.5, 52, 3, 1], ['marsh', 72, 60, 8, 3],
];
// ---- kaynak yatakları: [tür, boylam, enlem, miktar]
const DEPOSITS = [
  ['steel', 7.2, 51.5, 34], ['steel', 18.6, 50.4, 14], ['steel', 6.1, 49.1, 22], ['steel', -1.8, 52.6, 26], ['steel', 20.2, 67.8, 22], ['steel', 33.4, 47.9, 26], ['steel', 59, 53.4, 22], ['steel', 86.1, 53.8, 14],
  ['steel', -80, 40.4, 40], ['steel', -92.5, 47.5, 30], ['steel', -86.8, 33.5, 12], ['steel', -2.9, 43.25, 10], ['steel', 5.5, 50.4, 10], ['steel', 9.2, 45.5, 8], ['steel', 18.2, 49.8, 12], ['steel', 123, 41.1, 16],
  ['steel', 130.8, 33.9, 8], ['steel', 86.2, 22.8, 12], ['steel', 151.8, -32.9, 8], ['steel', -43.9, -19.9, 10], ['steel', 114.3, 30.6, 8], ['steel', 28, -26.2, 8], ['steel', 20.6, 50.9, 6], ['steel', 15.4, 47.1, 6],
  ['steel', 32.6, 41.2, 7], ['steel', 38.1, 39.4, 5], ['steel', 20.8, 48.1, 4], ['steel', 21.9, 45.3, 6], ['steel', 17.9, 44.2, 5], ['steel', -5.8, 43.4, 6], ['steel', -79.9, 43.3, 10], ['steel', -70.3, -27.4, 4],
  ['steel', -100.3, 25.7, 5], ['steel', 60.6, 56.8, 16], ['steel', 37.6, 54.2, 10], ['steel', 139.5, 36.5, 6], ['steel', 16.0, 59.6, 8], ['steel', 2.5, 50.4, 8], ['steel', -58.5, -34.0, 3],
  ['oil', 49.9, 40.4, 36], ['oil', 45.7, 43.3, 12], ['oil', 26, 44.9, 16], ['oil', -97, 31.5, 48], ['oil', -97.5, 35.5, 20], ['oil', -118.7, 34.5, 22], ['oil', -71.6, 10.6, 30], ['oil', 48.3, 30.3, 24],
  ['oil', 44.4, 35.5, 14], ['oil', 104.7, -3, 18], ['oil', 116.8, -1.3, 12], ['oil', -97.9, 22.2, 14], ['oil', 94.9, 20.5, 6], ['oil', -73.9, 7, 4], ['oil', -81.3, -4.6, 3], ['oil', -67.5, -45.9, 4],
  ['oil', 23.5, 49.3, 3], ['oil', 142.9, 52, 3], ['oil', -114, 51, 3], ['oil', 9.9, 52.4, 2], ['oil', 48, 29.3, 2], ['oil', 33, 28.3, 2], ['oil', 19.7, 40.7, 1], ['oil', 16.8, 48.5, 1], ['oil', 41.2, 37.9, 1],
  ['alu', 6.1, 43.5, 16], ['alu', 17.9, 47.1, 14], ['alu', 16.4, 43.7, 10], ['alu', 15.9, 41.7, 6], ['alu', -92.6, 34.6, 26], ['alu', -58.3, 6, 14], ['alu', -55.2, 5.6, 12], ['alu', 33.5, 59.6, 12],
  ['alu', 60, 59.8, 10], ['alu', 22.6, 38.5, 6], ['alu', 104.5, 1, 8], ['alu', 84, 22, 6], ['alu', 12.3, 51.3, 4], ['alu', 6.1, 61.2, 8], ['alu', -71.2, 48.4, 12], ['alu', 7.5, 46.3, 4],
  ['alu', 137, 35, 3], ['alu', -4, 57, 3], ['alu', -2, 6.5, 4], ['alu', 103.5, 3, 6], ['alu', -46, -21, 4], ['alu', 118, 36.5, 4], ['alu', 146, -38, 3], ['alu', -0.5, 39.5, 2], ['alu', 31.8, 37.4, 3], ['alu', 22.5, 46.5, 3],
];
// ---- boğazlar: deniz bölgeleri arasında bağlantı [boylam, enlem, boylam, enlem]
const SEA_LINKS = [[29.4, 41.7, 25.6, 40.0], [32.4, 31.7, 34.6, 27.4], [-79.9, 9.7, -79.5, 8.5], [11.4, 57.4, 12.0, 54.8], [-6.5, 35.9, -4.3, 36.1]];
// ---- kara geçişleri: dar su üstünden komşu sayılan eyaletler
const LAND_LINKS = [[28.3, 41.3, 29.8, 40.8], [15.9, 38.2, 15.3, 38.1], [9.4, 55.4, 11.9, 55.5], [36.2, 45.3, 37.0, 45.2], [131.1, 34.1, 130.8, 33.7]];

const SEAS = [
  ['Kuzey Denizi', 3, 56], ['Baltık Denizi', 19, 57], ['Norveç Denizi', 5, 67], ['Barents Denizi', 38, 72], ['Manş Denizi', -1, 50.2], ['Biskay Körfezi', -4.5, 45.5], ['Batı Akdeniz', 5, 39],
  ['Tiren Denizi', 12, 40], ['Adriyatik Denizi', 16, 43], ['İyon Denizi', 18.5, 37.5], ['Ege Denizi', 25, 38.5], ['Doğu Akdeniz', 30, 34], ['Karadeniz', 34, 43.3], ['Hazar Denizi', 51, 41.5],
  ['Kızıldeniz', 38, 21], ['Basra Körfezi', 51, 27], ['Umman Denizi', 63, 19], ['Bengal Körfezi', 89, 15], ['Güney Çin Denizi', 114, 13], ['Doğu Çin Denizi', 125, 29], ['Sarı Deniz', 123, 36],
  ['Japon Denizi', 135, 40], ['Ohotsk Denizi', 150, 54], ['Bering Denizi', 178, 58], ['Filipin Denizi', 132, 18], ['Mercan Denizi', 155, -16], ['Tasman Denizi', 160, -38], ['Cava Denizi', 112, -5],
  ['Arafura Denizi', 135, -9], ['Meksika Körfezi', -90, 25], ['Karayip Denizi', -75, 15], ['Hudson Körfezi', -85, 60], ['Labrador Denizi', -55, 58], ['Kuzey Atlantik', -35, 45], ['Orta Atlantik', -40, 20],
  ['Güney Atlantik', -15, -25], ['Gine Körfezi', 2, 1], ['Hint Okyanusu', 75, -15], ['Mozambik Kanalı', 41, -18], ['Kuzey Pasifik', -150, 40], ['Orta Pasifik', -140, 5], ['Güney Pasifik', -120, -30],
  ['Alaska Körfezi', -145, 57], ['Kaliforniya Açıkları', -122, 32], ['Grönland Denizi', -10, 72], ['İrlanda Denizi', -5, 53.7], ['Büyük Göller', -85, 45], ['Andaman Denizi', 96, 10],
  ['Batı Pasifik', 160, 20], ['Güneybatı Pasifik', 175, -20], ['Doğu Pasifik', -100, -10], ['Şili Açıkları', -78, -38], ['Arjantin Denizi', -58, -42], ['Brezilya Açıkları', -35, -12],
  ['Ümit Burnu Açıkları', 18, -38], ['Sargasso Denizi', -60, 30], ['Batı Hint Okyanusu', 55, 0], ['Avustralya Koyu', 130, -37], ['Kanarya Açıkları', -20, 28], ['Aral Gölü', 60, 45],
];

const TR = {
  Moscow: 'Moskova', Rome: 'Roma', London: 'Londra', Vienna: 'Viyana', Warsaw: 'Varşova', Athens: 'Atina', Beijing: 'Pekin', 'Washington, D.C.': 'Vaşington', Cairo: 'Kahire', Bucharest: 'Bükreş',
  Belgrade: 'Belgrad', Budapest: 'Budapeşte', Prague: 'Prag', Lisbon: 'Lizbon', Brussels: 'Brüksel', Copenhagen: 'Kopenhag', Stockholm: 'Stokholm', Sofia: 'Sofya', Tirana: 'Tiran', Tehran: 'Tahran',
  Baghdad: 'Bağdat', Riyadh: 'Riyad', Kabul: 'Kabil', 'Mexico City': 'Meksiko', Ottawa: 'Ottava', Caracas: 'Karakas', Damascus: 'Şam', Jerusalem: 'Kudüs', Aleppo: 'Halep', Thessaloniki: 'Selanik',
  'St. Petersburg': 'Leningrad', Volgograd: 'Stalingrad', Munich: 'Münih', Cologne: 'Köln', Naples: 'Napoli', Milan: 'Milano', Turin: 'Torino', Venice: 'Venedik', Marseille: 'Marsilya', Geneva: 'Cenevre',
  Tunis: 'Tunus', Algiers: 'Cezayir', Tripoli: 'Trablus', Alexandria: 'İskenderiye', Mecca: 'Mekke', Medina: 'Medine', Delhi: 'Delhi', Mumbai: 'Bombay', Kolkata: 'Kalküta', Chennai: 'Madras',
  Yangon: 'Rangun', 'Ho Chi Minh City': 'Saygon', Jakarta: 'Batavya', Seoul: 'Seul', Pyongyang: 'Pyongyang', Shenyang: 'Mukden', Nanjing: 'Nankin', Guangzhou: 'Kanton', Kiev: 'Kiev', Kyiv: 'Kiev',
  Tbilisi: 'Tiflis', Yerevan: 'Erivan', Baku: 'Bakü', Tashkent: 'Taşkent', Almaty: 'Alma Ata', Ulaanbaatar: 'Ulan Batur', Havana: 'Havana', Hamburg: 'Hamburg', Kaliningrad: 'Königsberg', Wroclaw: 'Breslau', 'Wrocław': 'Breslau', 'Gdańsk': 'Danzig', 'Poznań': 'Posen',
  Gdansk: 'Danzig', Szczecin: 'Stettin', Lviv: 'Lwów', Vilnius: 'Wilno', Chisinau: 'Kişinev', Istanbul: 'İstanbul', Izmir: 'İzmir', Ankara: 'Ankara', 'New York': 'New York', Singapore: 'Singapur',
  Nizhny: 'Gorki', 'Nizhny Novgorod': 'Gorki', Yekaterinburg: 'Sverdlovsk', Samara: 'Kuybışev', Volgograd2: '', Changchun: 'Hsinking', Harbin: 'Harbin', Taipei: 'Taihoku', Krakow: 'Krakov', Kraków: 'Krakov',
};

// ---- çokgen yardımcıları
function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function projectRing(ring, minArea) {
  let pts = ring.map(([lon, lat]) => P(lon, lat));
  let mn = 1e9, mx = -1e9;
  for (const p of pts) { mn = Math.min(mn, p[0]); mx = Math.max(mx, p[0]); }
  if (mx - mn > W / 2) return null; // kesim boylamını aşan halka
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  // kapalı halkayı en uzak noktadan ikiye bölerek sadeleştir
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const h1 = simplify(pts.slice(0, far + 1), 0.3), h2 = simplify(pts.slice(far).concat([pts[0]]), 0.3);
  pts = h1.concat(h2.slice(1, -1));
  if (pts.length < 3 || Math.abs(ringArea(pts)) < minArea) return null;
  const flat = [];
  for (const p of pts) flat.push(r1(p[0]), r1(p[1]));
  return flat;
}

const countries = await load('ne_50m_admin_0_countries');
const lakesSrc = await load('ne_50m_lakes');
const places = await load('ne_10m_populated_places_simple');

const regions = [];
const unmapped = [];
for (const f of countries.features) {
  const a3 = f.properties.ADM0_A3;
  const m = A3[a3];
  if (!m) { if (a3 !== 'ATA') unmapped.push(a3 + ':' + f.properties.NAME); continue; }
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    const c = poly[0];
    let lonSum = 0; for (const p of c) lonSum += p[0];
    const lonAvg = lonSum / c.length;
    if (a3 === 'USA' && (lonAvg < -169 || lonAvg > 170)) continue;
    const outer = projectRing(c, 3);
    if (!outer) continue;
    rings.push(outer);
    for (let h = 1; h < poly.length; h++) { const hole = projectRing(poly[h], 6); if (hole) rings.push(hole); }
  }
  if (rings.length) regions.push({ a3, o: TAG_INDEX[m.tag], core: m.core, rings });
}
const lakes = [];
for (const f of lakesSrc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) { const r = projectRing(poly[0], 150); if (r) lakes.push(r); }
}
// şehirler
const cand = places.features.map((f) => f.properties).filter((p) => (p.pop_max >= 150000 || p.adm0cap === 1) && p.latitude > LAT_S && p.latitude < LAT_N)
  .sort((a, b) => b.pop_max - a.pop_max);
const cities = [];
for (const p of cand) {
  const x = px(p.longitude), y = py(p.latitude);
  if (cities.some((c) => Math.hypot(c[1] - x, c[2] - y) < 9)) continue;
  const name = TR[p.name] || p.name;
  cities.push([name, Math.round(x), Math.round(y), Math.round(p.pop_max / 1000)]);
  if (cities.length >= 1500) break;
}
const idx = Object.fromEntries(regions.map((r, i) => [r.a3, i]));
const geo = {
  W, H,
  regions: regions.map((r) => ({ a3: r.a3, o: r.o, core: r.core, rings: r.rings })),
  lakes,
  cities,
  caps: NATIONS.map((n) => P(n.lon, n.lat).map(Math.round)),
  overrides: OVERRIDES.map(([from, to, core, poly]) => ({ from: idx[from], to: TAG_INDEX[to], core, poly: poly.flatMap(([lo, la]) => P(lo, la).map(Math.round)) })),
  density: DENSITY.map(([l0, l1, a0, a1, r]) => [Math.round(px(l0)), Math.round(px(l1)), Math.round(py(a1)), Math.round(py(a0)), r]),
  defaultR: DEFAULT_R,
  // 8 satırlık bantlar için cos(enlem): piksel başına km = 13.045 * rowCos
  rowCos: Array.from({ length: H / 8 }, (_, i) => { const m = yN - (i * 8 + 4) / SCALE; return Math.round((2 / (Math.exp(m) + Math.exp(-m))) * 1000) / 1000; }),
  ranges: RANGES.map(([h, w, ...c]) => { const pts = []; for (let i = 0; i < c.length; i += 2) pts.push(...P(c[i], c[i + 1]).map(Math.round)); return { h, w: Math.round(w * (W / 360) * 10) / 10, pts }; }),
  zones: ZONES.map(([t, lo, la, rx, ry, v]) => { const [x, y] = P(lo, la); const y0 = py(la + ry), y1 = py(la - ry); return [t, Math.round(x), Math.round(y), Math.round(rx * (W / 360)), Math.round((y1 - y0) / 2), v || 0]; }),
  deposits: DEPOSITS.map(([k, lo, la, amt]) => [k, ...P(lo, la).map(Math.round), amt]),
  seaLinks: SEA_LINKS.map(([a, b, c, d]) => [...P(a, b).map(Math.round), ...P(c, d).map(Math.round)]),
  seas: SEAS.map(([n, lo, la]) => [n, ...P(lo, la).map(Math.round)]),
  landLinks: LAND_LINKS.map(([a, b, c, d]) => [...P(a, b).map(Math.round), ...P(c, d).map(Math.round)]),
};
const out = '// Bu dosya tools/build-geo.mjs tarafından üretilir. Kaynak: Natural Earth (kamu malı).\nexport const GEO = ' + JSON.stringify(geo) + ';\n';
fs.writeFileSync(path.join(root, 'src', 'geodata.js'), out);
const pts = regions.reduce((s, r) => s + r.rings.reduce((a, g) => a + g.length / 2, 0), 0);
console.log(`geodata.js ${(out.length / 1024).toFixed(0)} KB · bölge ${regions.length} · nokta ${pts} · göl ${lakes.length} · şehir ${cities.length} · kuzey sınırı ${LAT_N.toFixed(1)}°`);
console.log('eşlenmeyen:', unmapped.join(' '));
