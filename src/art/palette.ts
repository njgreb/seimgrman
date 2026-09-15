// The locked game palette. Shared by runtime sprite drawing and tools/pixelize.ts,
// so AI-generated art and code-drawn art end up on exactly the same colors.
//
// Base: the classic NES 2C02 palette (duplicates/blacks removed).
// Extensions: skin and hair tones the NES palette can't represent well.

const NES = [
  '7c7c7c', '0000fc', '0000bc', '4428bc', '940084', 'a80020', 'a81000', '881400', '503000', '007800', '006800', '005800', '004058',
  'bcbcbc', '0078f8', '0058f8', '6844fc', 'd800cc', 'e40058', 'f83800', 'e45c10', 'ac7c00', '00b800', '00a800', '00a844', '008888',
  'f8f8f8', '3cbcfc', '6888fc', '9878f8', 'f878f8', 'f85898', 'f87858', 'fca044', 'f8b800', 'b8f818', '58d854', '58f898', '00e8d8', '787878',
  'fcfcfc', 'a4e4fc', 'b8b8f8', 'd8b8f8', 'f8b8f8', 'f8a4c0', 'f0d0b0', 'fce0a8', 'f8d878', 'd8f878', 'b8f8b8', 'b8f8d8', '00fcfc', 'f8d8f8',
  '000000', '101010', '383838',
];

const SKIN = ['ffdbac', 'f1c27d', 'e0ac69', 'c68642', '8d5524', '5c3317', 'd9a67e', 'b07850', '6e4020', '3f2410', 'eca47c', 'd4865c'];
const HAIR = ['1c1410', '2b1b0e', '4a3020', '6a4e2e', 'a87848', 'e8d090', 'd0d0d0', '909090', 'b04020', '5a5a6a'];

export const PALETTE: string[] = [...new Set([...NES, ...SKIN, ...HAIR])];

export const OUTLINE = '101010';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

const PALETTE_RGB = PALETTE.map(hexToRgb);

// "Redmean" weighted distance: cheap and much closer to perceived difference than plain RGB.
export function colorDistance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function nearestIndex(rgb: RGB, candidates: RGB[] = PALETTE_RGB): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const d = colorDistance(rgb, candidates[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function snap(hex: string): string {
  return PALETTE[nearestIndex(hexToRgb(hex))];
}

export function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return rgbToHex([f(r), f(g), f(b)]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
