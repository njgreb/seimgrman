// Renders every character exactly as the game draws them into art/contact-sheet.png,
// so you can eyeball whether the cast looks consistent before booting the game.
//
// Row per character: portrait (imported or generated), then idle / run / jump / shoot / hurt / attack frames.

import fs from 'node:fs';
import sharp from 'sharp';
import { FRAMES, drawFrame, drawPortrait, type HeadOverride, type Look } from '../src/art/characters.ts';
import { PixelCanvas } from '../src/art/PixelCanvas.ts';
import { BOSSES } from '../src/data/bosses.ts';
import { PLAYER_LOOK } from '../src/data/weapons.ts';
import { canvasToRaw, rawToCanvas, readRaw } from './image.ts';

const OUT = 'art/contact-sheet.png';
const SCALE = 4;
const SHOWN = [FRAMES.idle, FRAMES.run1, FRAMES.run2, FRAMES.jump, FRAMES.shoot, FRAMES.hurt, FRAMES.attack];
const ROW_H = 52;
const LABEL_W = 0;
const BG = '203048';

async function optional(file: string): Promise<PixelCanvas | undefined> {
  return fs.existsSync(file) ? rawToCanvas(await readRaw(file)) : undefined;
}

async function main() {
  const rows: { name: string; look: Look; player: boolean; head?: HeadOverride; portrait?: PixelCanvas; imported: string[] }[] = [
    { name: 'PLAYER', look: PLAYER_LOOK, player: true, imported: [] },
  ];
  for (const b of BOSSES) {
    const headImg = await optional(`public/assets/bosses/${b.id}/head.png`);
    const portrait = await optional(`public/assets/bosses/${b.id}/portrait.png`);
    rows.push({
      name: `${b.name} (${b.id})`,
      look: b.look,
      player: false,
      head: headImg ? { canvas: headImg } : undefined,
      portrait,
      imported: [headImg && 'head.png', portrait && 'portrait.png'].filter(Boolean) as string[],
    });
  }

  const width = LABEL_W + 52 + SHOWN.length * 28 + 4;
  const sheet = new PixelCanvas(width, rows.length * ROW_H + 4).rect(0, 0, width, rows.length * ROW_H + 4, BG);
  rows.forEach((r, i) => {
    const y = 12 + i * ROW_H;
    sheet.blit(r.portrait ?? drawPortrait(r.look, r.head), 2, y - 8);
    SHOWN.forEach((f, j) => sheet.blit(drawFrame(r.look, f, r.player, r.head), 52 + j * 28, y + 4));
  });

  const raw = canvasToRaw(sheet, BG);
  const labels = rows
    .map((r, i) => {
      const note = r.imported.length ? `imported: ${r.imported.join(', ')}` : r.player ? '' : 'trait-drawn';
      return `<text x="${52 * SCALE}" y="${(8 + i * ROW_H) * SCALE}" font-family="monospace" font-size="22" fill="#f8f8f8">${r.name} <tspan fill="#a4e4fc">${note}</tspan></text>`;
    })
    .join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${raw.height * SCALE}">${labels}</svg>`);

  await sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } })
    .resize(raw.width * SCALE, raw.height * SCALE, { kernel: 'nearest' })
    .composite([{ input: svg }])
    .png()
    .toFile(OUT);
  console.log(`wrote ${OUT}`);
}

await main();
