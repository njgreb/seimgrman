// Renders the home-screen icons (public/icon-180.png, public/icon-512.png) from the player portrait.
//
// Usage: npx tsx tools/icons.ts

import sharp from 'sharp';
import { drawPortrait } from '../src/art/characters.ts';
import { PLAYER_LOOK } from '../src/data/weapons.ts';
import { canvasToRaw } from './image.ts';

const BG = '#000020';

async function icon(size: number): Promise<void> {
  const portrait = canvasToRaw(drawPortrait(PLAYER_LOOK));
  const scale = Math.floor((size * 0.8) / portrait.width);
  const art = await sharp(portrait.data, { raw: { width: portrait.width, height: portrait.height, channels: 4 } })
    .resize(portrait.width * scale, portrait.height * scale, { kernel: 'nearest' })
    .png()
    .toBuffer();
  const out = `public/icon-${size}.png`;
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}

await icon(180);
await icon(512);
