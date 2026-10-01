// Мастерская значков Beautybook (2.5.0). Неоновый рисунок — белые линии на прозрачном фоне
// (neon-lines-512.png, вырезаны из прежнего значка); свечение рисуется заново, фон — розово-чёрный.
// Как собрать: см. README.md в этой папке.

export const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const canvas = size => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
};

// Готовые линии (neon-lines-512.png): холст и рамка рисунка по непрозрачным точкам.
export function linesFrom(img) {
  const S = img.width;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 77) continue;
    const p = (i - 3) / 4, x = p % S, y = (p - x) / S;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { canvas: c, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

// Все значки сайта: приложение мастера (розово-чёрный фон «corners») и администратора («edges» + «АДМИН»).
export const ICONS = [
  ['bb-touch-180.png', { bg: 'corners', size: 180 }],
  ['bb-192.png', { bg: 'corners', size: 192 }],
  ['bb-512.png', { bg: 'corners', size: 512 }],
  ['bb-maskable-512.png', { bg: 'corners', size: 512, height: 0.56 }],
  ['bb-favicon-64.png', { bg: 'corners', size: 64, height: 0.88 }],
  ['bb-admin-180.png', { bg: 'edges', size: 180, height: 0.6, cy: 0.42, badge: 'АДМИН' }],
  ['bb-admin-192.png', { bg: 'edges', size: 192, height: 0.6, cy: 0.42, badge: 'АДМИН' }],
  ['bb-admin-512.png', { bg: 'edges', size: 512, height: 0.6, cy: 0.42, badge: 'АДМИН' }],
  ['bb-admin-maskable-512.png', { bg: 'edges', size: 512, height: 0.44, cy: 0.4, badge: 'АДМИН', badgeBox: [0.27, 0.66, 0.46, 0.12] }],
];

export async function build() {
  const lines = linesFrom(await loadImage('neon-lines-512.png'));
  const saved = [];
  for (const [name, opts] of ICONS) {
    const c = renderIcon(lines, opts);
    await save(c, name);
    show(c, name);
    saved.push(name);
  }
  return saved;
}

// Белые линии рисунка (прозрачный фон) и их рамка. Линии почти белые (G ≈ 236, R = 255),
// фон и свечение темнее (G до 150) — мягкий порог по G и R.
export function extractLines(img) {
  const S = img.width;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, S, S);
  const d = im.data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1];
    const a = Math.max(0, Math.min(1, (g - 165) / 65)) * Math.max(0, Math.min(1, (r - 225) / 25));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = Math.round(a * 255);
    if (a > 0.3) {
      const p = i / 4, x = p % S, y = (p - x) / S;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  ctx.putImageData(im, 0, 0);
  return { canvas: c, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

// Цветная копия линий нужного размера: рисунок в квадрате size, по центру (cx, cy), высотой h.
function tinted(lines, size, color, place) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const { box } = lines;
  const k = place.h / box.h;
  const w = box.w * k;
  ctx.drawImage(lines.canvas, box.x, box.y, box.w, box.h, place.cx - w / 2, place.cy - place.h / 2, w, place.h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Фоны: розово-чёрные варианты.
const BACKGROUNDS = {
  // A: по диагонали — ярко-розовый угол слева вверху, чёрный справа внизу.
  diagonal(ctx, S) {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#ff4f9b');
    g.addColorStop(0.42, '#a61d5c');
    g.addColorStop(1, '#0d080c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  },
  // B: чёрный, розовый свет из левого верхнего и правого нижнего угла.
  corners(ctx, S) {
    ctx.fillStyle = '#0c080b';
    ctx.fillRect(0, 0, S, S);
    for (const [x, y, r, color] of [[0, 0, 0.95, 'rgba(255,64,150,0.95)'], [S, S, 0.7, 'rgba(190,30,105,0.75)']]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, S * r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,64,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
  },
  // C: чёрный центр, розовые края (неон «на тёмной стене»).
  edges(ctx, S) {
    const g = ctx.createRadialGradient(S * 0.5, S * 0.46, S * 0.12, S * 0.5, S * 0.5, S * 0.78);
    g.addColorStop(0, '#120a10');
    g.addColorStop(0.55, '#3d0f27');
    g.addColorStop(1, '#e0367f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  },
};

function gloss(ctx, S) {
  const g = ctx.createLinearGradient(0, 0, 0, S * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.20)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // мягкая косая полоса света, как на прежней иконке
  ctx.save();
  ctx.translate(S * 0.62, 0);
  ctx.rotate(0.38);
  const band = ctx.createLinearGradient(-S * 0.09, 0, S * 0.09, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.07)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-S * 0.09, -S * 0.2, S * 0.18, S * 1.6);
  ctx.restore();
}

// Иконка: фон, свечение, линии; badge — надпись-плашка снизу (иконка администратора).
export function renderIcon(lines, { size: S, bg = 'diagonal', height = 0.74, cy = 0.5, badge = '', badgeBox = [0.2, 0.79, 0.6, 0.16], glow = '#ff2b93', core = '#ffd9ee', passes = [[0.05, 1], [0.026, 1], [0.012, 1], [0.005, 0.9]] }) {
  const c = canvas(S);
  const ctx = c.getContext('2d');
  BACKGROUNDS[bg](ctx, S);
  gloss(ctx, S);
  const place = { cx: S / 2, cy: S * cy, h: S * height };
  const pink = tinted(lines, S, glow, place);
  ctx.globalCompositeOperation = 'screen';
  for (const [blur, alpha] of passes) {
    ctx.filter = `blur(${Math.max(0.6, S * blur)}px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(pink, 0, 0);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tinted(lines, S, core, place), 0, 0);
  if (badge) {
    const [x, y, w, h] = badgeBox.map(v => v * S);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = S * 0.03;
    ctx.fillStyle = '#ff3ea0';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(h * 0.62)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, x + w / 2, y + h / 2 + h * 0.03);
  }
  return c;
}

export async function save(c, name) {
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
  const res = await fetch(`/out/${name}`, { method: 'PUT', body: blob });
  if (!res.ok) throw new Error(`не сохранилось ${name}: ${res.status}`);
  return blob.size;
}

export function show(c, label) {
  const box = document.getElementById('out');
  const fig = document.createElement('figure');
  fig.style.cssText = 'display:inline-block;margin:8px;text-align:center;color:#fff';
  const img = new Image();
  img.src = c.toDataURL('image/png');
  img.style.cssText = 'width:180px;height:180px;border-radius:40px;display:block';
  fig.append(img, Object.assign(document.createElement('figcaption'), { textContent: label }));
  box.append(fig);
}
