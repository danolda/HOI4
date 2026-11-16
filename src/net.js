// Çok oyunculu bağlantı: PeerJS (WebRTC) ile iki tarayıcı arasında doğrudan veri kanalı.
// "YEREL" ile başlayan oda kodları aynı tarayıcının sekmeleri arasında BroadcastChannel kullanır (deneme için).
const PREFIX = 'meridyen-harekati-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode() {
  let s = '';
  const buf = new Uint32Array(6);
  (globalThis.crypto || { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32); return a; } }).getRandomValues(buf);
  for (const v of buf) s += ALPHABET[v % ALPHABET.length];
  return s;
}

const ERR = {
  'peer-unavailable': 'Bu kodla açık bir oda bulunamadı. Kodu ve arkadaşının odayı kurduğunu kontrol et.',
  'unavailable-id': 'Bu oda kodu şu an kullanımda. Yeniden dene.',
  network: 'Bağlantı sunucusuna ulaşılamadı. İnternet bağlantını kontrol et; sayfa gömülü bir görüntüleyicide açıksa çevrim içi oyun için yayınlanan siteyi kullan.',
  'browser-incompatible': 'Bu tarayıcı ya da ortam eşler arası bağlantıyı desteklemiyor.',
  disconnected: 'Bağlantı sunucusuyla iletişim koptu.',
  'server-error': 'Bağlantı sunucusu yanıt vermiyor. Biraz sonra yeniden dene.',
  'socket-error': 'Bağlantı sunucusuna ulaşılamadı. Sayfa gömülü bir görüntüleyicide açıksa çevrim içi oyun için yayınlanan siteyi kullan.',
  'socket-closed': 'Bağlantı sunucusuyla iletişim kapandı.',
  webrtc: 'Arkadaşınla doğrudan bağlantı kurulamadı (ağ ya da güvenlik duvarı engelliyor olabilir).',
};

export class Net {
  // h: { onReady(), onOpen(), onMessage(obj), onClose(), onError(metin) }
  constructor(h) { this.h = h; this.open = false; }

  host(code) {
    this.code = code; this.isHost = true;
    if (code.startsWith('YEREL')) return this.local(code);
    this.makePeer(PREFIX + code.toLowerCase(), () => this.h.onReady());
    if (!this.peer) return;
    this.peer.on('connection', (conn) => {
      if (this.conn && this.open) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      if (this.conn) { const old = this.conn; this.conn = null; try { old.close(); } catch (e) { /* yoksay */ } }
      this.attach(conn);
    });
  }

  join(code) {
    this.code = code; this.isHost = false;
    if (code.startsWith('YEREL')) return this.local(code);
    this.makePeer(undefined, () => {
      this.h.onReady();
      this.attach(this.peer.connect(PREFIX + code.toLowerCase(), { reliable: true, serialization: 'binary' }));
      this.timer = setTimeout(() => { if (!this.open) this.h.onError(ERR.webrtc); }, 20000);
    });
  }

  makePeer(id, onOpen) {
    const Peer = globalThis.Peer;
    if (!Peer) { this.h.onError('Çevrim içi bileşen yüklenemedi. Sayfayı yenileyip yeniden dene.'); return; }
    try {
      this.peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    } catch (e) { this.h.onError(ERR['browser-incompatible']); return; }
    this.peer.on('open', onOpen);
    this.peer.on('error', (e) => { if (!this.closed) this.h.onError(ERR[e.type] || 'Bağlantı hatası: ' + (e.type || e.message || 'bilinmiyor')); });
    this.peer.on('disconnected', () => { if (!this.closed && this.peer && !this.peer.destroyed) { try { this.peer.reconnect(); } catch (e) { /* yoksay */ } } });
  }

  attach(conn) {
    this.conn = conn;
    conn.on('open', () => { this.open = true; clearTimeout(this.timer); this.h.onOpen(); });
    conn.on('data', (d) => this.h.onMessage(d));
    conn.on('close', () => { if (this.conn !== conn) return; const was = this.open; this.open = false; this.conn = null; if (was && !this.closed) this.h.onClose(); });
    conn.on('error', () => { if (!this.open && !this.closed) this.h.onError(ERR.webrtc); });
  }

  // aynı tarayıcıda sekmeler arası deneme kanalı
  local(code) {
    const bc = this.bc = new BroadcastChannel(PREFIX + code);
    const me = Math.random().toString(36).slice(2);
    bc.onmessage = (ev) => {
      const m = ev.data;
      if (!m || m.from === me) return;
      if (m.sys === 'hello' && this.isHost) { this.other = m.from; bc.postMessage({ from: me, to: m.from, sys: 'ack' }); if (!this.open) { this.open = true; this.h.onOpen(); } }
      else if (m.sys === 'ack' && !this.isHost && m.to === me) { this.other = m.from; if (!this.open) { this.open = true; this.h.onOpen(); } }
      else if (m.sys === 'bye' && m.from === this.other) { if (this.open) { this.open = false; this.h.onClose(); } }
      else if (m.d && this.open && m.from === this.other) this.h.onMessage(m.d);
    };
    this.localSend = (d) => bc.postMessage({ from: me, d });
    this.localBye = () => bc.postMessage({ from: me, sys: 'bye' });
    setTimeout(() => {
      this.h.onReady();
      if (!this.isHost) {
        bc.postMessage({ from: me, sys: 'hello' });
        this.timer = setTimeout(() => { if (!this.open) this.h.onError(ERR['peer-unavailable']); }, 3000);
      }
    }, 0);
  }

  send(obj) {
    if (!this.open) return false;
    try { if (this.bc) this.localSend(obj); else this.conn.send(obj); return true; } catch (e) { return false; }
  }

  close() {
    this.closed = true; this.open = false;
    clearTimeout(this.timer);
    try { if (this.bc) { this.localBye(); this.bc.close(); } } catch (e) { /* yoksay */ }
    try { if (this.conn) this.conn.close(); } catch (e) { /* yoksay */ }
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* yoksay */ }
  }
}

// ---- anlık görüntü sıkıştırma (destek varsa gzip)
const hasCS = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
export async function pack(text) {
  if (!hasCS) return { raw: text };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { gz: new Uint8Array(await new Response(stream).arrayBuffer()) };
}
export async function unpack(m) {
  if (m.raw !== undefined) return m.raw;
  if (!hasCS) throw new Error('Sıkıştırma desteklenmiyor');
  const stream = new Blob([m.gz]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
