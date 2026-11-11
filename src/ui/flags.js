// Prosedürel bayraklar ve küçük SVG simgeler.
const cache = new Map();

function emblem(g, kind, x, y, r, col) {
  g.fillStyle = col; g.strokeStyle = col;
  if (kind === 'disc') { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  else if (kind === 'diamond') { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); g.fill(); }
  else if (kind === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  } else if (kind === 'sun') {
    g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill();
    g.lineWidth = r * 0.16;
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.68, y + Math.sin(a) * r * 0.68); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  } else if (kind === 'gear') {
    g.lineWidth = r * 0.3;
    g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
  }
}

export function flagURL(nat) {
  if (cache.has(nat.tag)) return cache.get(nat.tag);
  const W = 99, H = 66;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const { pat, c, em } = nat.flag;
  g.fillStyle = c[0]; g.fillRect(0, 0, W, H);
  let emCol = c[c.length - 1];
  if (pat === 'hband') { for (let i = 0; i < 3; i++) { g.fillStyle = c[i]; g.fillRect(0, (H / 3) * i, W, H / 3 + 1); } emCol = c[1] === c[0] ? '#f0ead8' : c[0] === c[2] ? c[0] : '#f0ead8'; }
  else if (pat === 'vband') { for (let i = 0; i < 3; i++) { g.fillStyle = c[i]; g.fillRect((W / 3) * i, 0, W / 3 + 1, H); } emCol = c[0]; }
  else if (pat === 'cross') { g.fillStyle = c[1]; g.fillRect(W / 2 - 9, 0, 18, H); g.fillRect(0, H / 2 - 9, W, 18); g.fillStyle = c[2]; g.fillRect(W / 2 - 4, 0, 8, H); g.fillRect(0, H / 2 - 4, W, 8); }
  else if (pat === 'nordic') { g.fillStyle = c[1]; g.fillRect(28, 0, 16, H); g.fillRect(0, H / 2 - 8, W, 16); g.fillStyle = c[2]; g.fillRect(33, 0, 6, H); g.fillRect(0, H / 2 - 3, W, 6); }
  else if (pat === 'chevron') { g.fillStyle = c[1]; g.fillRect(0, H / 2 - 9, W, 18); g.fillStyle = c[2]; g.beginPath(); g.moveTo(0, 0); g.lineTo(40, H / 2); g.lineTo(0, H); g.closePath(); g.fill(); }
  else if (pat === 'saltire') { g.strokeStyle = c[1]; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H); g.moveTo(W, 0); g.lineTo(0, H); g.stroke(); }
  else if (pat === 'quarter') { g.fillStyle = c[1]; g.fillRect(W / 2, 0, W / 2, H / 2); g.fillRect(0, H / 2, W / 2, H / 2); }
  else if (pat === 'plain') emCol = c[1];
  if (em && em !== 'none') emblem(g, em, W / 2, H / 2, pat === 'hband' ? 9 : 15, emCol);
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
