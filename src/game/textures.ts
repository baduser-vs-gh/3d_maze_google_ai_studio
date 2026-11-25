import * as THREE from 'three';
import { TextureCategory } from './types';

export const TEX_SIZE = 128;

export interface ProceduralTextureEntry {
  name: string;
  canvas: HTMLCanvasElement;
  bumpCanvas: HTMLCanvasElement;
  previewUrl: string;
  roughness: number;
  metalness: number;
}

export type TextureLibrary = Record<TextureCategory, ProceduralTextureEntry[]>;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const g = c.getContext('2d')!;
  return { c, g };
}

function wrap(x: number, y: number, fn: (px: number, py: number) => void) {
  const S = TEX_SIZE;
  for (const ox of [-S, 0, S]) {
    for (const oy of [-S, 0, S]) {
      fn(x + ox, y + oy);
    }
  }
}

function grain(g: CanvasRenderingContext2D, amt: number, r: () => number) {
  const S = TEX_SIZE;
  const d = g.getImageData(0, 0, S, S);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const n = (r() - 0.5) * amt;
    a[i] = Math.max(0, Math.min(255, a[i] + n));
    a[i + 1] = Math.max(0, Math.min(255, a[i + 1] + n));
    a[i + 2] = Math.max(0, Math.min(255, a[i + 2] + n));
  }
  g.putImageData(d, 0, 0);
}

function blots(
  g: CanvasRenderingContext2D,
  r: () => number,
  n: number,
  rmin: number,
  rmax: number,
  colFn: (r: () => number) => [number, number, number, number],
) {
  const S = TEX_SIZE;
  for (let i = 0; i < n; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = rmin + r() * (rmax - rmin);
    const [cr, cg, cb, ca] = colFn(r);
    wrap(x, y, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(${cr},${cg},${cb},${ca})`);
      gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = gr;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
}

function cracks(g: CanvasRenderingContext2D, r: () => number, n: number, len: number, color: string) {
  const S = TEX_SIZE;
  g.strokeStyle = color;
  g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = r() * S;
    let y = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < len; j++) {
      x += (r() - 0.5) * 10;
      y += (r() - 0.5) * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

function bevel(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  light: string,
  dark: string,
) {
  g.fillStyle = light;
  g.fillRect(x, y, w, s);
  g.fillRect(x, y, s, h);
  g.fillStyle = dark;
  g.fillRect(x, y + h - s, w, s);
  g.fillRect(x + w - s, y, s, h);
}

function waveLine(
  g: CanvasRenderingContext2D,
  horizontal: boolean,
  base: number,
  amp: number,
  n: number,
  ph: number,
) {
  const S = TEX_SIZE;
  g.beginPath();
  for (let t = 0; t <= S; t += 2) {
    const o = base + Math.sin((t / S) * Math.PI * 2 * n + ph) * amp;
    const [x, y] = horizontal ? [t, o] : [o, t];
    if (t === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Generate a luminance-derived height/bump canvas from an albedo canvas */
function makeBumpFromCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const { c, g } = mkCanvas();
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.min(255, Math.max(0, 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]));
    const boosted = Math.min(255, Math.max(0, (lum - 90) * 1.45 + 128));
    d[i] = d[i + 1] = d[i + 2] = boosted;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ----- 牆壁 -----
function texBrick(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#3a332e';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const cols = 4;
  const bh = S / rows;
  const bw = S / cols;
  for (let row = 0; row < rows; row++) {
    const off = ((row % 2) * bw) / 2;
    const cs: string[] = [];
    for (let i = 0; i < cols; i++) {
      cs.push(`hsl(${8 + r() * 12},${38 + r() * 20}%,${28 + r() * 12}%)`);
    }
    for (let i = -1; i <= cols; i++) {
      const idx = ((i % cols) + cols) % cols;
      const x = i * bw + off;
      const y = row * bh;
      g.fillStyle = cs[idx];
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      bevel(g, x + 1.5, y + 1.5, bw - 3, bh - 3, 1.5, 'rgba(255,225,200,.16)', 'rgba(0,0,0,.35)');
    }
  }
  blots(g, r, 14, 8, 22, () => [20, 10, 5, 0.24]);
  grain(g, 28, r);
  return c;
}

function texStone(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#2a2c30';
  g.fillRect(0, 0, S, S);
  const rows = 4;
  const cols = 2;
  const bh = S / rows;
  const bw = S / cols;
  for (let row = 0; row < rows; row++) {
    const off = ((row % 2) * bw) / 2;
    const cs: string[] = [];
    for (let i = 0; i < cols; i++) {
      cs.push(`hsl(210,${5 + r() * 8}%,${34 + r() * 12}%)`);
    }
    for (let i = -1; i <= cols; i++) {
      const idx = ((i % cols) + cols) % cols;
      const x = i * bw + off;
      const y = row * bh;
      g.fillStyle = cs[idx];
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      bevel(g, x + 2, y + 2, bw - 4, bh - 4, 2, 'rgba(255,255,255,.16)', 'rgba(0,0,0,.44)');
    }
  }
  blots(g, r, 10, 6, 18, () => [0, 0, 0, 0.25]);
  blots(g, r, 6, 6, 16, () => [60, 95, 40, 0.28]);
  cracks(g, r, 5, 6, 'rgba(0,0,0,.45)');
  grain(g, 34, r);
  return c;
}

function texMetal(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#1c2126';
  g.fillRect(0, 0, S, S);
  const P = S / 2;
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const x = i * P;
      const y = j * P;
      g.fillStyle = `hsl(205,${8 + r() * 6}%,${32 + r() * 6}%)`;
      g.fillRect(x + 1, y + 1, P - 2, P - 2);
      bevel(g, x + 1, y + 1, P - 2, P - 2, 2, 'rgba(255,255,255,.14)', 'rgba(0,0,0,.45)');
    }
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * S;
    const y = (r() * S) | 0;
    const len = 10 + r() * 40;
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.09)';
    g.fillRect(x, y, len, 1);
    g.fillRect(x - S, y, len, 1);
  }
  blots(g, r, 7, 5, 14, () => [130, 65, 25, 0.3]);
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      for (const [ox, oy] of [
        [7, 7],
        [P - 7, 7],
        [7, P - 7],
        [P - 7, P - 7],
      ]) {
        const x = i * P + ox;
        const y = j * P + oy;
        g.fillStyle = '#0f1215';
        g.beginPath();
        g.arc(x + 0.8, y + 0.8, 2.8, 0, 7);
        g.fill();
        g.fillStyle = '#8b97a2';
        g.beginPath();
        g.arc(x, y, 2.6, 0, 7);
        g.fill();
        g.fillStyle = '#d4dce3';
        g.beginPath();
        g.arc(x - 0.8, y - 0.8, 0.9, 0, 7);
        g.fill();
      }
    }
  }
  grain(g, 12, r);
  return c;
}

function texWoodWall(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#1a120c';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const bw = S / n;
  for (let p = 0; p < n; p++) {
    const x0 = p * bw;
    g.fillStyle = `hsl(${24 + r() * 8},${38 + r() * 12}%,${22 + r() * 9}%)`;
    g.fillRect(x0 + 1, 0, bw - 2, S);
    g.save();
    g.beginPath();
    g.rect(x0 + 1, 0, bw - 2, S);
    g.clip();
    for (let j = 0; j < 9; j++) {
      g.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.15})`;
      g.lineWidth = 1;
      waveLine(g, false, x0 + 2 + r() * (bw - 4), 1 + r() * 2.5, 1 + ((r() * 3) | 0), r() * 6.28);
    }
    if (r() < 0.6) {
      const kx = x0 + 8 + r() * (bw - 16);
      const ky = 12 + r() * (S - 24);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath();
      g.ellipse(kx, ky, 3, 5, 0, 0, 7);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)';
      g.beginPath();
      g.ellipse(kx, ky, 5, 8, 0, 0, 7);
      g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(255,220,180,.08)';
    g.fillRect(x0 + 1, 0, 1, S);
  }
  grain(g, 14, r);
  return c;
}

// ----- 地板 -----
function texTile(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#121418';
  g.fillRect(0, 0, S, S);
  const P = S / 2;
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const L = 32 + r() * 8 + ((i + j) % 2 ? 4 : 0);
      g.fillStyle = `hsl(215,${8 + r() * 6}%,${L}%)`;
      g.fillRect(i * P + 2, j * P + 2, P - 4, P - 4);
      bevel(g, i * P + 2, j * P + 2, P - 4, P - 4, 2, 'rgba(255,255,255,.14)', 'rgba(0,0,0,.4)');
    }
  }
  blots(g, r, 8, 6, 18, () => [0, 0, 0, 0.22]);
  cracks(g, r, 3, 6, 'rgba(0,0,0,.4)');
  grain(g, 22, r);
  return c;
}

function texCobble(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#101214';
  g.fillRect(0, 0, S, S);
  const n = 6;
  const cell = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * cell + (r() - 0.5) * 5;
      const cy = (j + 0.5) * cell + (r() - 0.5) * 5;
      const rx = cell * 0.42 + r() * 2;
      const ry = cell * 0.36 + r() * 2;
      const rot = r() * Math.PI;
      const L = 28 + r() * 14;
      const sat = 6 + r() * 8;
      wrap(cx, cy, (x, y) => {
        g.save();
        g.translate(x, y);
        g.rotate(rot);
        const gr = g.createRadialGradient(-rx * 0.3, -ry * 0.3, 1, 0, 0, Math.max(rx, ry));
        gr.addColorStop(0, `hsl(30,${sat}%,${L + 12}%)`);
        gr.addColorStop(1, `hsl(30,${sat}%,${L - 8}%)`);
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, 7);
        g.fill();
        g.restore();
      });
    }
  }
  grain(g, 24, r);
  return c;
}

function texWoodFloor(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#140d08';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const bh = S / rows;
  const len = S / 2;
  for (let row = 0; row < rows; row++) {
    const y = row * bh;
    const o = (r() * S) | 0;
    for (let k = 0; k < 2; k++) {
      const col = `hsl(${26 + r() * 8},${34 + r() * 12}%,${25 + r() * 10}%)`;
      for (const ox of [0, -S]) {
        g.fillStyle = col;
        g.fillRect(o + k * len + ox + 1, y + 1, len - 2, bh - 2);
      }
    }
    g.save();
    g.beginPath();
    g.rect(0, y + 1, S, bh - 2);
    g.clip();
    for (let j = 0; j < 4; j++) {
      g.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.12})`;
      g.lineWidth = 1;
      waveLine(g, true, y + 2 + r() * (bh - 4), 0.6 + r(), 1 + ((r() * 3) | 0), r() * 6.28);
    }
    g.restore();
    g.fillStyle = 'rgba(255,230,200,.09)';
    g.fillRect(0, y + 1, S, 1);
  }
  grain(g, 14, r);
  return c;
}

function texDirt(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#3a2d21';
  g.fillRect(0, 0, S, S);
  const cols: [number, number, number, number][] = [
    [70, 55, 40, 0.4],
    [30, 22, 15, 0.4],
    [90, 72, 50, 0.25],
  ];
  blots(g, r, 30, 6, 20, (rr) => cols[(rr() * 3) | 0]);
  for (let i = 0; i < 40; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 1 + r() * 1.6;
    const L = 32 + r() * 20;
    wrap(x, y, (px, py) => {
      g.fillStyle = `hsl(30,8%,${L}%)`;
      g.beginPath();
      g.arc(px, py, rad, 0, 7);
      g.fill();
    });
  }
  grain(g, 38, r);
  return c;
}

// ----- 天花板 -----
function texBeams(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#120c08';
  g.fillRect(0, 0, S, S);
  const rows = 4;
  const bh = S / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * bh;
    g.fillStyle = `hsl(25,30%,${18 + r() * 6}%)`;
    g.fillRect(0, y + 1, S, bh - 2);
    g.save();
    g.beginPath();
    g.rect(0, y + 1, S, bh - 2);
    g.clip();
    for (let j = 0; j < 5; j++) {
      g.strokeStyle = `rgba(0,0,0,${0.15 + r() * 0.12})`;
      g.lineWidth = 1;
      waveLine(g, true, y + 3 + r() * (bh - 6), 0.8 + r(), 1 + ((r() * 2) | 0), r() * 6.28);
    }
    g.restore();
  }
  const bx = S / 2 - 14;
  const bw = 28;
  g.fillStyle = 'hsl(22,35%,14%)';
  g.fillRect(bx, 0, bw, S);
  g.save();
  g.beginPath();
  g.rect(bx, 0, bw, S);
  g.clip();
  for (let j = 0; j < 6; j++) {
    g.strokeStyle = `rgba(0,0,0,${0.2 + r() * 0.15})`;
    waveLine(g, false, bx + 2 + r() * (bw - 4), 1 + r(), 1 + ((r() * 2) | 0), r() * 6.28);
  }
  g.restore();
  g.fillStyle = 'rgba(255,220,180,.10)';
  g.fillRect(bx, 0, 2, S);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillRect(bx + bw - 2, 0, 2, S);
  grain(g, 14, r);
  return c;
}

function texPlaster(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#77746d';
  g.fillRect(0, 0, S, S);
  blots(g, r, 25, 8, 26, (rr) => (rr() < 0.5 ? [255, 255, 250, 0.12] : [0, 0, 0, 0.12]));
  blots(g, r, 3, 14, 26, () => [110, 90, 50, 0.18]);
  cracks(g, r, 4, 8, 'rgba(40,35,30,.5)');
  grain(g, 20, r);
  return c;
}

function texGrate(r: () => number): HTMLCanvasElement {
  const S = TEX_SIZE;
  const { c, g } = mkCanvas();
  g.fillStyle = '#2b3138';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const P = S / n;
  for (let i = 0; i < 200; i++) {
    const x = r() * S;
    const y = (r() * S) | 0;
    const len = 8 + r() * 30;
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)';
    g.fillRect(x, y, len, 1);
    g.fillRect(x - S, y, len, 1);
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * P;
      const y = j * P;
      bevel(g, x, y, P, P, 1, 'rgba(255,255,255,.10)', 'rgba(0,0,0,.35)');
      g.fillStyle = '#07090b';
      g.fillRect(x + 5, y + 5, P - 10, P - 10);
      bevel(g, x + 5, y + 5, P - 10, P - 10, 2, 'rgba(0,0,0,.6)', 'rgba(255,255,255,.14)');
    }
  }
  blots(g, r, 6, 5, 12, () => [130, 65, 25, 0.28]);
  grain(g, 12, r);
  return c;
}

let cachedLibrary: TextureLibrary | null = null;

export function getTextureLibrary(): TextureLibrary {
  if (cachedLibrary) return cachedLibrary;

  const DEFS: Record<
    TextureCategory,
    Array<[string, (r: () => number) => HTMLCanvasElement, number, number]>
  > = {
    wall: [
      ['紅磚', texBrick, 0.88, 0.04],
      ['石塊', texStone, 0.9, 0.05],
      ['金屬板', texMetal, 0.36, 0.72],
      ['木板', texWoodWall, 0.82, 0.02],
    ],
    floor: [
      ['石板地磚', texTile, 0.72, 0.08],
      ['鵝卵石', texCobble, 0.84, 0.05],
      ['木地板', texWoodFloor, 0.68, 0.04],
      ['泥土', texDirt, 0.95, 0.0],
    ],
    ceil: [
      ['木樑', texBeams, 0.86, 0.02],
      ['灰泥', texPlaster, 0.92, 0.0],
      ['金屬格柵', texGrate, 0.42, 0.68],
    ],
  };

  let seed = 1000;
  const out = {} as TextureLibrary;
  (['wall', 'floor', 'ceil'] as TextureCategory[]).forEach((cat) => {
    out[cat] = DEFS[cat].map(([name, fn, roughness, metalness]) => {
      seed += 97;
      const canvas = fn(mulberry32(seed));
      const bumpCanvas = makeBumpFromCanvas(canvas);
      return {
        name,
        canvas,
        bumpCanvas,
        previewUrl: canvas.toDataURL(),
        roughness,
        metalness,
      };
    });
  });

  cachedLibrary = out;
  return out;
}

export function createThreeTextures(
  entry: ProceduralTextureEntry,
  anisotropy: number,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const map = new THREE.CanvasTexture(entry.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = anisotropy;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(entry.bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = anisotropy;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}
