# Meridyen Harekâtı

Tarayıcıda çalışan, three.js ile yazılmış özgün bir büyük strateji oyunu. 1936 dünyasında bir ülke seçersin; sanayini kurar, ordunu eğitir, ittifakını seçer ve haritayı yeniden çizersin. Tek başına ya da bir arkadaşınla çevrim içi oynanır.

Kurulum ve derleme adımı yoktur: depo doğrudan statik site olarak yayınlanır.

## Neler var

- **Gerçek dünya haritası.** Natural Earth verisinden üretilen 612 kara eyaleti ve 137 deniz bölgesi; 64 ülke, sömürge imparatorlukları ve 1936 sınırları.
- **3B harita.** Kabartmalı arazi, eşyükselti çizgileri, ülke adları, şehirler, birlik rozetleri, hareket okları ve muharebe göstergeleri.
- **Ekonomi.** Sivil fabrikalarla inşaat, askeri fabrikalarla teçhizat üretimi, kaynaklar ve ticaret, ekonomi ve askerlik yasaları.
- **Araştırma ve ulusal hedefler.** Sekiz dalda 60'tan fazla teknoloji; sanayi, ordu ve siyaset dallarında 28 hedef.
- **Ordu.** Tabur tabur tümen şablonları, asker alma, ikmal ve kuşatma, mevzilenme, arazi ve tahkimat etkileri, çıkarma harekâtı, hava ve deniz üstünlüğü, otomatik cephe.
- **Diplomasi.** İttifaklar, bağımsızlık garantileri, saldırmazlık paktları, savaş gerekçesi, teslimiyet ve barış; küresel gerginlik.
- **Yapay zekâ.** Bütün ülkeler ekonomisini, araştırmasını, diplomasisini ve cephelerini kendisi yönetir.
- **Çevrim içi iki kişilik oyun.** Oda kodu ile eşler arası bağlantı; oyun sürerken katılma ve yeniden bağlanma.

## Nasıl oynanır

| Girdi | İşlev |
| --- | --- |
| Sürükle | Haritayı kaydır |
| Tekerlek / iki parmak | Yakınlaş, uzaklaş |
| `Q` / `E`, sağ tuşla sürükle | Haritayı döndür |
| `W` `A` `S` `D` | Haritayı kaydır |
| Sol tık | Tümen yığını ya da eyalet seç |
| `Shift` + sürükle | Kutu içindeki tümenleri seç |
| Sağ tık | Seçili tümenlere hedef göster (dokunmatikte eyalete dokun) |
| `Boşluk` | Zamanı durdur ya da başlat |
| `1`–`5` | Oyun hızı |
| `Esc` | Seçimi ve yerleşim kipini bırak |

Zafer koşulu: ittifakınla dünya zafer puanlarının %60'ını elinde tutmak. Anavatanındaki zafer puanlarının çoğunu kaybeden ülke teslim olur.

## Çevrim içi oyun

1. Bir oyuncu ana menüde **Oda kur** der ve çıkan kodu arkadaşına gönderir.
2. Diğer oyuncu ana menüde kodu yazıp **Katıl** der ve kendi ülkesini seçer.
3. Odayı kuran oyunu başlatır.

Oyunu odayı kuranın tarayıcısı yürütür; diğer oyuncunun emirleri ona iletilir ve dünyanın anlık görüntüsü geri gönderilir. Bağlantı [PeerJS](https://peerjs.com) üzerinden doğrudan iki tarayıcı arasında kurulur (WebRTC). Bazı kurumsal ağlar ve katı güvenlik duvarları bu bağlantıyı engelleyebilir. Bağlantı koparsa misafirin ülkesini yapay zekâ devralır; misafir aynı kodla geri dönebilir.

## Yerelde çalıştırma

```bash
node tools/serve.mjs
```

Ardından tarayıcıda `http://localhost:5173` adresini aç. Dosyaları doğrudan `file://` ile açmak modül kısıtları nedeniyle çalışmaz.

Diğer araçlar:

```bash
node tools/simtest.mjs 8     # başsız simülasyon: 8 yıl, tüm ülkeler yapay zekâ
node tools/build-geo.mjs     # Natural Earth'ten src/geodata.js dosyasını yeniden üretir
npm install && node tools/bundle.mjs   # tek dosyalık sürüm: dist/meridyen.html
```

## Yayınlama

`.github/workflows/pages.yml` her gönderimde siteyi GitHub Pages'e yükler. İlk seferde depo ayarlarında **Settings → Pages → Source: GitHub Actions** seçilmiş olmalıdır.

## Yapı

```
index.html            sayfa iskeleti
src/main.js           giriş noktası: girdi, oyun döngüsü, kayıt, çok oyunculu eşitleme
src/worldgen.js       gerçek harita verisinden dünya üretimi
src/geodata.js        üretilmiş coğrafya verisi (tools/build-geo.mjs)
src/data.js           ülkeler, teçhizat, teknolojiler, hedefler, yasalar
src/sim/              simülasyon: ekonomi, ordu, diplomasi, yapay zekâ, komutlar
src/render/           three.js harita, birlikler, etiketler
src/ui/               arayüz panelleri
src/net.js            eşler arası bağlantı
tools/                yerel sunucu, test, coğrafya derleyici, paketleyici
```

## Kaynaklar

- Harita verisi: [Natural Earth](https://www.naturalearthdata.com) (kamu malı).
- [three.js](https://threejs.org) ve [PeerJS](https://peerjs.com) (MIT lisansı), CDN üzerinden yüklenir.
- Yazı tipleri: Big Shoulders Display ve Barlow Semi Condensed (Google Fonts, SIL OFL).

Oyunun adı, arayüzü, eyalet bölünmesi ve kuralları bu projeye özgüdür; ülke ve şehir adları tarihî gerçeklere dayanır.
