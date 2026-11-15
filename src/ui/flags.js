// Bayraklar (basit şekillerle çizilir) ve küçük SVG simgeler.
const cache = new Map();
const hex = (c) => '#' + c;

function emblem(g, kind, x, y, r, col) {
  g.fillStyle = col; g.strokeStyle = col;
  if (kind === 'disc') { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  else if (kind === 'diamond') { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 1.5, y); g.lineTo(x, y + r); g.lineTo(x - r * 1.5, y); g.closePath(); g.fill(); }
  else if (kind === 'plus') { g.fillRect(x - r * 0.28, y - r, r * 0.56, r * 2); g.fillRect(x - r, y - r * 0.28, r * 2, r * 0.56); }
  else if (kind === 'bar') { g.fillRect(x - r * 1.5, y - r * 0.14, r * 3, r * 0.28); }
  else if (kind === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  } else if (kind === 'sun') {
    g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill();
    g.lineWidth = r * 0.16;
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.68, y + Math.sin(a) * r * 0.68); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  } else if (kind === 'crescent') {
    g.beginPath(); g.arc(x - r * 0.25, y, r, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(x + r * 0.05, y, r * 0.8, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    emblem(g, 'star', x + r * 0.75, y, r * 0.45, col);
  }
}
function union(g, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#012169'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#ffffff'; g.lineWidth = h * 0.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
  g.strokeStyle = '#c8102e'; g.lineWidth = h * 0.08; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h); g.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
  g.fillStyle = '#c8102e'; g.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h); g.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
  g.restore();
}

export function flagURL(nat) {
  if (cache.has(nat.tag)) return cache.get(nat.tag);
  const W = 99, H = 66;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#888'; g.fillRect(0, 0, W, H);
  for (const part of String(nat.flag).split('|')) {
    const [t, a, b, c] = part.split(':');
    const cols = (a || '').split(',').map(hex);
    if (t === 'u') union(g, 0, 0, W, H);
    else if (t === 's') {
      for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, (H / 7) * i, W, H / 7 + 1); }
      g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, W * 0.44, (H / 7) * 4);
      g.fillStyle = '#ffffff'; for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(6 + i * 10.5, 7 + j * 11.5, 1.9, 0, 7); g.fill(); }
    } else if (t === 'h') cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (H / cols.length) * i, W, H / cols.length + 1); });
    else if (t === 'v') cols.forEach((col, i) => { g.fillStyle = col; g.fillRect((W / cols.length) * i, 0, W / cols.length + 1, H); });
    else if (t === 'p') { g.fillStyle = cols[0]; g.fillRect(0, 0, W, H); }
    else if (t === 'q') { g.fillStyle = cols[0]; g.fillRect(0, 0, W, H); g.fillStyle = cols[1]; g.fillRect(W / 2, 0, W / 2, H / 2); g.fillRect(0, H / 2, W / 2, H / 2); }
    else if (t === 'x') { g.fillStyle = cols[0]; g.fillRect(27, 0, 17, H); g.fillRect(0, H / 2 - 8.5, W, 17); if (cols[1]) { g.fillStyle = cols[1]; g.fillRect(32, 0, 7, H); g.fillRect(0, H / 2 - 3.5, W, 7); } }
    else if (t === 'k') { g.fillStyle = cols[0]; g.fillRect(0, 0, W * 0.42, H * 0.5); }
    else if (t === 'ku') union(g, 0, 0, W * 0.5, H * 0.5);
    else if (t === 'tri') { g.fillStyle = cols[0]; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.42, H / 2); g.lineTo(0, H); g.closePath(); g.fill(); }
    else if (t === 'e') {
      const pos = c || 'c';
      if (pos === 'tl') emblem(g, a, W * 0.21, H * 0.25, H * 0.17, hex(b));
      else if (pos === 'r') emblem(g, a, W * 0.72, H * 0.55, H * 0.2, hex(b));
      else emblem(g, a, W / 2, H / 2, H * 0.24, hex(b));
    }
  }
  const url = cv.toDataURL('image/png');
  cache.set(nat.tag, url);
  return url;
}

const P = {
  state: '<path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5"/>',
  goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  research: '<path d="M9 3h6M10 3v6l-5.2 9a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3M7.5 15h9"/>',
  production: '<path d="M3 21V10l6 4v-4l6 4V5h5v16H3zM7 17h2M12 17h2"/>',
  build: '<path d="M3 20h18M6 20V9l6-5 6 5v11M10 20v-6h4v6"/>',
  army: '<path d="M4 9l8-5 8 5M4 14l8-5 8 5M4 19l8-5 8 5"/>',
  diplo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5"/>',
  locate: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
