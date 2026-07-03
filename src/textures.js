// Procedural canvas textures — no external image assets.
import * as THREE from 'three';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// deterministic-ish noise helper
function jitter(base, amt) {
  return base + (Math.random() * 2 - 1) * amt;
}

export function woodTexture(base = '#4a3320', dark = '#32220f', repeat = 4) {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const plankH = 32;
  for (let y = 0; y < 256; y += plankH) {
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.14})`;
      ctx.lineWidth = jitter(1.2, 0.8);
      const gy = y + Math.random() * plankH;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(64, jitter(gy, 3), 192, jitter(gy, 3), 256, gy);
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    ctx.fillRect(0, y, 256, 2);
    // plank end seams
    const seam = Math.random() * 256;
    ctx.fillRect(seam, y, 2, plankH);
  }
  return toTexture(c, repeat, repeat);
}

export function tileTexture(a = '#20242a', b = '#8a8f96', n = 8, repeat = 3) {
  const [c, ctx] = makeCanvas(256);
  const s = 256 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? a : b;
      ctx.fillRect(i * s, j * s, s, s);
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
      ctx.fillRect(i * s, j * s, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(i * s + 0.5, j * s + 0.5, s - 1, s - 1);
    }
  }
  return toTexture(c, repeat, repeat);
}

export function stoneTexture(base = '#3a3a40', repeat = 4) {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const rows = 5;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = (r % 2) * -30;
    while (x < 256) {
      const w = 50 + Math.random() * 40;
      ctx.fillStyle = `rgba(${jitter(20, 12)},${jitter(20, 12)},${jitter(24, 12)},${0.25 + Math.random() * 0.25})`;
      ctx.fillRect(x + 2, r * rh + 2, w - 4, rh - 4);
      ctx.strokeStyle = 'rgba(10,10,12,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, r * rh, w, rh);
      x += w;
    }
  }
  return toTexture(c, repeat, repeat);
}

export function wallpaperTexture(base = '#2c2a33', stripe = '#242230', repeat = 6) {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = stripe;
    ctx.fillRect(x, 0, 14, 256);
  }
  // faded damask-ish dots
  ctx.fillStyle = 'rgba(120,110,130,0.10)';
  for (let x = 16; x < 256; x += 32) {
    for (let y = 16; y < 256; y += 42) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // grime
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.10})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, jitter(10, 8), jitter(10, 8));
  }
  return toTexture(c, repeat, 2);
}

export function carpetTexture(base = '#4d1f24', motif = '#6b3a2a', repeat = 2) {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = motif;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeRect(26, 26, 204, 204);
  for (let x = 32; x < 256; x += 48) {
    for (let y = 32; y < 256; y += 48) {
      ctx.save();
      ctx.translate(x + 16, y + 16);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.restore();
    }
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return toTexture(c, repeat, repeat);
}
