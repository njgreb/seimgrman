// Turns AI-generated (or any) images into palette-locked game sprites.
//
//   art/raw/<boss-id>/portrait.png  ->  public/assets/bosses/<boss-id>/portrait.png    (48x48, NES palette)
//                                   ->  public/assets/bosses/<boss-id>/portrait16.png  (96x96, 32 free colors: 16-BIT REMASTER)
//   art/raw/<boss-id>/head.png      ->  public/assets/bosses/<boss-id>/head.png      (16x16, facing right)
//
// Steps: remove flat background (+ defringe) -> crop to subject -> area-average downscale ->
// snap to palette -> cap color count -> outline -> verify palette -> write manifest.json.
//
// Best input: subject on a solid bright green (#00ff00) background, or a transparent PNG.
//
// Usage: npm run art            (all bosses)
//        npx tsx tools/pixelize.ts sync ticket   (only these)

import fs from 'node:fs';
import path from 'node:path';
import { PALETTE, type RGB, colorDistance, hexToRgb, nearestIndex } from '../src/art/palette.ts';
import { ALL_BOSSES } from '../src/data/bosses.ts';
import { type Raw, rawToCanvas, canvasToRaw, readRaw, toSharp } from './image.ts';

const RAW_DIR = 'art/raw';
const OUT_DIR = 'public/assets/bosses';
const MANIFEST = 'public/assets/manifest.json';

const TARGETS = {
  portrait: { size: 48, maxColors: 16, paletteLocked: true },
  portrait16: { size: 96, maxColors: 32, paletteLocked: false },
  head: { size: 16, maxColors: 8, paletteLocked: true },
} as const;
type Kind = keyof typeof TARGETS;

const BG_TOLERANCE = 2600; // redmean distance; ~ "clearly the same flat color"

function removeBackground(img: Raw): number {
  const { data, width, height } = img;
  const px = (x: number, y: number): RGB => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  const alphaCorners = [0, width - 1, (height - 1) * width, height * width - 1].map((i) => data[i * 4 + 3]);
  if (alphaCorners.every((a) => a < 128)) return 0; // already transparent
  // Background = the color most corners agree on. Shoulders often run off the bottom corners,
  // so two matching corners are enough.
  const agreeing = (c: RGB) => corners.filter((o) => colorDistance(c, o) < BG_TOLERANCE).length;
  const bg = corners.reduce((best, c) => (agreeing(c) > agreeing(best) ? c : best));
  if (agreeing(bg) < 2) {
    console.warn('    corners differ; not removing background (use a plain background or a transparent PNG)');
    return 0;
  }
  // flood fill from every border pixel that matches the background color
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  let removed = 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    const x = i % width;
    const y = (i - x) / width;
    if (colorDistance(px(x, y), bg) >= BG_TOLERANCE) continue;
    data[i * 4 + 3] = 0;
    removed++;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }

  // Defringe: anti-aliased edge pixels are partly background; peel them off in a few passes.
  const passes = Math.max(1, Math.round(Math.max(width, height) / 160));
  for (let p = 0; p < passes; p++) {
    const peel: number[] = [];
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (data[i * 4 + 3] < 128) continue;
        const edge = [i - 1, i + 1, i - width, i + width].some((n) => data[n * 4 + 3] < 128);
        if (edge && colorDistance(px(x, y), bg) < BG_TOLERANCE * 6) peel.push(i);
      }
    for (const i of peel) data[i * 4 + 3] = 0;
    removed += peel.length;
  }
  return removed;
}

// Box-filter downscale: each target pixel averages the opaque source pixels it covers,
// and is only opaque if at least half its area was. Much cleaner than lanczos for sprites.
function areaDownscale(img: Raw, bounds: { left: number; top: number; width: number; height: number }, size: number, anchorBottom: boolean): Raw {
  const scale = Math.max(bounds.width, bounds.height) / size;
  const outW = Math.min(size, Math.round(bounds.width / scale));
  const outH = Math.min(size, Math.round(bounds.height / scale));
  const offX = Math.floor((size - outW) / 2);
  const offY = anchorBottom ? size - outH : Math.floor((size - outH) / 2);
  const out = Buffer.alloc(size * size * 4);
  for (let ty = 0; ty < outH; ty++)
    for (let tx = 0; tx < outW; tx++) {
      const x0 = bounds.left + Math.floor(tx * scale);
      const y0 = bounds.top + Math.floor(ty * scale);
      const x1 = Math.max(x0 + 1, bounds.left + Math.floor((tx + 1) * scale));
      const y1 = Math.max(y0 + 1, bounds.top + Math.floor((ty + 1) * scale));
      let r = 0, g = 0, b = 0, n = 0, total = 0;
      for (let y = y0; y < y1 && y < img.height; y++)
        for (let x = x0; x < x1 && x < img.width; x++) {
          total++;
          const i = (y * img.width + x) * 4;
          if (img.data[i + 3] < 128) continue;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          n++;
        }
      if (n === 0 || n < total / 2) continue;
      out.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], ((offY + ty) * size + offX + tx) * 4);
    }
  return { data: out, width: size, height: size };
}

function opaqueBounds({ data, width, height }: Raw) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  if (maxX < 0) throw new Error('image is fully transparent');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Group similar colors (k-means), so detailed shading collapses into a few tones before snapping.
// Snapping pixels one by one makes skin flicker between neighboring palette colors.
function clusterColors(pixels: RGB[], k: number): RGB[] {
  // deterministic farthest-point init, starting from the most common-ish color (the first pixel's nearest mean)
  const centers: RGB[] = [pixels[0]];
  while (centers.length < Math.min(k, pixels.length)) {
    let far = pixels[0];
    let farD = -1;
    for (const p of pixels) {
      const d = Math.min(...centers.map((c) => colorDistance(p, c)));
      if (d > farD) (farD = d), (far = p);
    }
    if (farD <= 0) break;
    centers.push(far);
  }
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pixels) {
      const s = sums[nearestIndex(p, centers)];
      (s[0] += p[0]), (s[1] += p[1]), (s[2] += p[2]), s[3]++;
    }
    sums.forEach((s, i) => {
      if (s[3]) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centers;
}

// Cluster to maxColors, snap each cluster to the palette, then merge the rarest colors into
// their nearest surviving neighbor if snapping still left too many. Unlocked (16-bit) art keeps the cluster colors.
function quantize(img: Raw, maxColors: number, paletteLocked: boolean): Raw {
  const palette = PALETTE.map(hexToRgb);
  const n = img.width * img.height;
  const idx = new Int16Array(n).fill(-1);
  const counts = new Map<number, number>();
  const opaque: RGB[] = [];
  for (let i = 0; i < n; i++) if (img.data[i * 4 + 3] >= 128) opaque.push([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]]);
  const centers = clusterColors(opaque, maxColors);
  if (!paletteLocked) {
    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      if (img.data[i * 4 + 3] < 128) continue;
      const c = centers[nearestIndex([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]], centers)];
      out.set([...c.map(Math.round), 255], i * 4);
    }
    return { data: out, width: img.width, height: img.height };
  }
  const snapped = centers.map((c) => nearestIndex(c, palette));
  for (let i = 0; i < n; i++) {
    if (img.data[i * 4 + 3] < 128) continue;
    const p = snapped[nearestIndex([img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]], centers)];
    idx[i] = p;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  while (counts.size > maxColors) {
    const [rarest] = [...counts.entries()].sort((a, b) => a[1] - b[1])[0];
    counts.delete(rarest);
    const survivors = [...counts.keys()];
    const into = survivors[nearestIndex(palette[rarest], survivors.map((s) => palette[s]))];
    for (let i = 0; i < n; i++) if (idx[i] === rarest) idx[i] = into;
    counts.set(into, (counts.get(into) ?? 0) + 1);
  }
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) if (idx[i] >= 0) out.set([...palette[idx[i]], 255], i * 4);
  return { data: out, width: img.width, height: img.height };
}

function verify(img: Raw, file: string, paletteLocked: boolean): number {
  const allowed = new Set(PALETTE.map((h) => h.toLowerCase()));
  const used = new Set<string>();
  for (let i = 0; i < img.width * img.height; i++) {
    const a = img.data[i * 4 + 3];
    if (a !== 0 && a !== 255) throw new Error(`${file}: semi-transparent pixel`);
    if (a === 0) continue;
    const hex = [0, 1, 2].map((k) => img.data[i * 4 + k].toString(16).padStart(2, '0')).join('');
    if (paletteLocked && !allowed.has(hex)) throw new Error(`${file}: off-palette color #${hex}`);
    used.add(hex);
  }
  return used.size;
}

async function processImage(src: string, kind: Kind, dest: string): Promise<void> {
  const { size, maxColors, paletteLocked } = TARGETS[kind];
  const img = await readRaw(src);
  const removed = removeBackground(img);
  const bounds = opaqueBounds(img);
  // leave a 1px border so the outline fits
  const small = areaDownscale(img, bounds, size - 2, kind !== 'head');
  const padded = await toSharp(small).extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer();
  const quantizedRaw = quantize({ data: padded, width: size, height: size }, maxColors, paletteLocked);
  const quantized = canvasToRaw(rawToCanvas(quantizedRaw).outline());
  const colors = verify(quantized, dest, paletteLocked);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await toSharp(quantized).png().toFile(dest);
  console.log(`  ${kind}: ${src} -> ${dest} (${colors} colors${removed ? `, removed ${removed} bg px` : ''})`);
}

async function main() {
  const only = process.argv.slice(2);
  const knownIds = new Set(ALL_BOSSES.map((b) => b.id));
  const manifest: { bosses: Record<string, Partial<Record<Kind, string>>> } = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
    : { bosses: {} };
  manifest.bosses ??= {};

  const dirs = fs.existsSync(RAW_DIR) ? fs.readdirSync(RAW_DIR).filter((d) => fs.statSync(path.join(RAW_DIR, d)).isDirectory()) : [];
  for (const id of dirs) {
    if (only.length && !only.includes(id)) continue;
    if (!knownIds.has(id)) console.warn(`! art/raw/${id} does not match any boss id (${[...knownIds].join(', ')})`);
    console.log(id);
    const entry: Partial<Record<Kind, string>> = {};
    for (const file of fs.readdirSync(path.join(RAW_DIR, id))) {
      const m = file.match(/^(portrait|head)\.(png|jpe?g|webp)$/i);
      if (!m) continue;
      const source = m[1].toLowerCase() as 'portrait' | 'head';
      // every portrait also gets its 16-BIT REMASTER version
      for (const kind of source === 'portrait' ? (['portrait', 'portrait16'] as const) : ([source] as const)) {
        await processImage(path.join(RAW_DIR, id, file), kind, path.join(OUT_DIR, id, `${kind}.png`));
        entry[kind] = `assets/bosses/${id}/${kind}.png`;
      }
    }
    if (Object.keys(entry).length) manifest.bosses[id] = entry;
    else delete manifest.bosses[id];
  }
  // art/raw folders that were moved or deleted (full runs only)
  if (!only.length) for (const id of Object.keys(manifest.bosses)) if (!dirs.includes(id)) delete manifest.bosses[id];

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${MANIFEST}`);
}

await main();
