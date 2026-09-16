import Phaser from 'phaser';
import { PixelCanvas } from './PixelCanvas';
import { FRAME_COUNT, FRAME_H, FRAME_W, FRAMES, drawFrame, drawPortrait, type HeadOverride, type Look } from './characters';
import { shade } from './palette';
import { ALL_BOSSES, FINAL_BOSS } from '../data/bosses';
import { PLAYER_LOOK, WEAPONS } from '../data/weapons';

export interface Manifest {
  bosses: Record<string, { portrait?: string; portrait16?: string; head?: string }>;
}

function addCanvasTexture(scene: Phaser.Scene, key: string, pc: PixelCanvas): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, pc.width, pc.height)!;
  pc.writeTo(tex.getContext());
  tex.refresh();
}

function addSheet(scene: Phaser.Scene, key: string, frames: PixelCanvas[]): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = frames[0].width;
  const h = frames[0].height;
  const tex = scene.textures.createCanvas(key, w * frames.length, h)!;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    f.writeTo(ctx, i * w, 0);
    tex.add(i, 0, i * w, 0, w, h);
  });
  tex.refresh();
}

function characterSheet(scene: Phaser.Scene, key: string, look: Look, isPlayer: boolean, head?: HeadOverride): void {
  const frames = Array.from({ length: FRAME_COUNT }, (_, i) => drawFrame(look, i, isPlayer, head));
  addSheet(scene, key, frames);
  const f = (n: number) => ({ key, frame: n });
  scene.anims.create({ key: `${key}-run`, frames: [f(FRAMES.run1), f(FRAMES.run2), f(FRAMES.run3), f(FRAMES.run2)], frameRate: 10, repeat: -1 });
  scene.anims.create({
    key: `${key}-runShoot`,
    frames: [f(FRAMES.runShoot1), f(FRAMES.runShoot2), f(FRAMES.runShoot3), f(FRAMES.runShoot2)],
    frameRate: 10,
    repeat: -1,
  });
}

function imageCanvas(scene: Phaser.Scene, key: string): PixelCanvas | undefined {
  if (!scene.textures.exists(key)) return undefined;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  return PixelCanvas.fromImage(src);
}

export function generateCharacters(scene: Phaser.Scene): void {
  for (const w of Object.values(WEAPONS)) {
    const look: Look = { ...PLAYER_LOOK, shirt: w.colors[0], accent: w.colors[1], pants: shade(w.colors[0], 0.75), shoes: shade(w.colors[0], 0.5) };
    characterSheet(scene, `player-${w.id}`, look, true);
  }
  addCanvasTexture(scene, 'portrait-player', drawPortrait(PLAYER_LOOK));

  for (const boss of ALL_BOSSES) {
    const headImg = imageCanvas(scene, `raw-head-${boss.id}`);
    const head = headImg ? { canvas: headImg } : undefined;
    characterSheet(scene, `boss-${boss.id}`, boss.look, false, head);
    const portraitImg = imageCanvas(scene, `raw-portrait-${boss.id}`);
    addCanvasTexture(scene, `portrait-${boss.id}`, portraitImg ?? drawPortrait(boss.look, head));
  }
}

export function generateProps(scene: Phaser.Scene): void {
  const K = '101010';
  const W = 'f8f8f8';
  const make = (key: string, w: number, h: number, draw: (pc: PixelCanvas) => void, outline = true) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    addCanvasTexture(scene, key, outline ? pc.outline() : pc);
  };

  // player shots
  make('shot-buster', 8, 6, (pc) => pc.round(1, 1, 6, 4, 'f8d878').rect(2, 2, 2, 2, W));
  make('shot-calendar', 10, 10, (pc) => pc.rect(1, 2, 8, 7, W).rect(1, 2, 8, 2, 'f83800').pixels([[3, 1], [6, 1]], '787878').pixels([[3, 5], [5, 5], [7, 5], [3, 7], [5, 7]], '787878'));
  make('shot-ticket', 10, 8, (pc) => pc.rect(1, 1, 8, 6, '3cbcfc').rect(2, 2, 3, 1, W).rect(2, 4, 5, 1, '0058f8'));
  make('shot-pivot', 12, 12, (pc) => pc.grid(1, 1, [
    '....aa....',
    '...aaaa...',
    '..aa..aa..',
    '.aa....aa.',
    'aa......aa',
    'a........a',
  ], { a: 'fca044' }).grid(1, 7, ['aa......aa', '.a......a.'], { a: 'e45c10' }));
  make('shot-pager', 10, 14, (pc) => pc.grid(1, 1, [
    '...aa...',
    '..abba..',
    '..abba..',
    '.abbbba.',
    '.abccba.',
    'abbccbba',
    'abcccbba',
    'abccccba',
    'aabccbaa',
    '.aaaaaa.',
    '..aaaa..',
    '...aa...',
  ], { a: 'f83800', b: 'fca044', c: 'fce0a8' }));

  // enemy shots
  make('e-invite', 10, 8, (pc) => pc.rect(1, 1, 8, 6, W).pixels([[1, 1], [2, 2], [3, 3], [4, 4], [5, 4], [6, 3], [7, 2], [8, 1]], 'f85898'));
  make('e-clock', 12, 12, (pc) => pc.round(1, 1, 10, 10, 'f8d878').round(2, 2, 8, 8, W).rect(6, 3, 1, 4, K).rect(6, 6, 3, 1, K));
  make('e-ticket', 10, 12, (pc) => pc.rect(1, 1, 8, 10, 'f8f8f8').rect(1, 1, 8, 2, '0078f8').rect(2, 4, 6, 1, '787878').rect(2, 6, 4, 1, '787878').rect(2, 8, 5, 1, '787878'));
  make('e-ticket-small', 8, 8, (pc) => pc.rect(1, 1, 6, 6, W).rect(1, 1, 6, 2, '0078f8').rect(2, 4, 3, 1, '787878'));
  make('e-arrow', 14, 8, (pc) => pc.rect(1, 3, 9, 2, '00a844').grid(9, 1, ['aa..', 'aaaa', 'aaaa', 'aa..'].map((r, i) => (i === 0 ? '.a..' : i === 3 ? '.a..' : r)), { a: '00a844' }));
  make('e-milestone', 12, 12, (pc) => pc.grid(1, 1, [
    '....aa....',
    '...abba...',
    '..abbbba..',
    '.abbbbbba.',
    'abbbbbbbba',
    'abbbbbbbba',
    '.abbbbbba.',
    '..abbbba..',
    '...abba...',
    '....aa....',
  ], { a: 'f8b800', b: 'f8d878' }));
  make('e-page', 8, 8, (pc) => pc.round(1, 1, 6, 6, 'f83800').rect(3, 3, 2, 2, 'fce0a8'));
  make('e-shockwave', 10, 16, (pc) => pc.grid(1, 1, [
    '...aa...',
    '..abba..',
    '.abbba..',
    '.abcbba.',
    'abbcbbba',
    'abccbbba',
    'abcccbba',
    'abcccbba',
    'abccccba',
    'abccccba',
    'abbccbba',
    'aabbbbaa',
    '.aaaaaa.',
    '........',
  ], { a: 'e40058', b: 'f83800', c: 'fca044' }));
  make('e-flame', 16, 48, (pc) => {
    for (let y = 1; y < 47; y++) {
      const wob = [0, 1, 1, 0, -1, -1][y % 6];
      pc.rect(2 + wob, y, 12, 1, 'f83800');
      pc.rect(4 + wob, y, 8, 1, 'fca044');
      pc.rect(6 + wob, y, 4, 1, 'fce0a8');
    }
  });
  make('e-warning', 16, 6, (pc) => pc.rect(1, 1, 14, 4, 'f8b800').pixels([[3, 2], [4, 3], [7, 2], [8, 3], [11, 2], [12, 3]], K), false);

  // effects
  make('fx-orb', 12, 12, (pc) => pc.round(1, 1, 10, 10, '3cbcfc').round(3, 3, 6, 6, W));
  make('fx-orb-boss', 12, 12, (pc) => pc.round(1, 1, 10, 10, 'f87858').round(3, 3, 6, 6, W));
  make('fx-spark', 8, 8, (pc) => pc.pixels([[3, 0], [3, 1], [3, 5], [3, 6], [0, 3], [1, 3], [5, 3], [6, 3], [3, 3], [2, 2], [4, 4], [2, 4], [4, 2]], W), false);
  make('fx-beam', 6, 16, (pc) => pc.rect(1, 0, 4, 16, '3cbcfc').rect(2, 0, 2, 16, W), false);
  make('fx-pellet', 6, 6, (pc) => pc.round(0, 0, 6, 6, W), false);
  make('fx-star', 2, 2, (pc) => pc.rect(0, 0, 2, 2, W), false);
  make('px', 1, 1, (pc) => pc.set(0, 0, W), false);
}

// CTO MAN's two phase bodies and the HQ skyline. The pilot is the final boss's own trait-drawn head.
export const MACHINE_W = 80;
export const MACHINE_H = 80; // short enough that the cockpit sits at jump-shot height
export const COCKPIT = { x: 22, y: 2, w: 36, h: 28 }; // dome, in machine texture pixels

export function generateFinalBoss(scene: Phaser.Scene): void {
  const K = '101010';
  const pilot = drawFrame(FINAL_BOSS.look, FRAMES.idle, false).crop(3, 0, 18, 20);

  const m = new PixelCanvas(MACHINE_W, MACHINE_H);
  // treads
  m.round(3, 65, 74, 15, '383838').rect(5, 66, 70, 2, '505058');
  for (const x of [7, 22, 37, 52, 63]) m.round(x, 69, 10, 10, '7c7c7c').rect(x + 4, 73, 2, 2, K);
  // hips and body
  m.rect(16, 56, 48, 10, '4c4c58');
  m.rect(8, 30, 64, 28, '7c7c7c').rect(8, 30, 64, 2, 'bcbcbc').rect(66, 32, 6, 26, '5c5c64');
  // calendar screen: a week with no free slots left
  m.rect(12, 33, 34, 18, K).rect(13, 34, 32, 16, '002040');
  m.rect(13, 34, 32, 2, '505058');
  for (let x = 16; x < 45; x += 6) m.rect(x, 34, 1, 2, 'f8f8f8');
  m.rect(14, 37, 5, 5, 'f83800').rect(20, 37, 5, 8, '3cbcfc').rect(26, 38, 5, 4, '58d854').rect(32, 37, 5, 6, 'f8b800');
  m.rect(38, 39, 6, 5, 'f85898').rect(14, 43, 5, 6, 'd800cc').rect(26, 43, 10, 3, 'e45c10');
  m.rect(20, 46, 5, 3, 'f8b800').rect(37, 45, 7, 4, '3cbcfc').rect(28, 47, 8, 2, '58d854');
  // side panel lights
  m.rect(52, 34, 10, 15, '5c5c64').rect(54, 36, 6, 2, 'f83800').rect(54, 40, 6, 2, 'f8b800').rect(54, 44, 6, 2, '58d854');
  // hazard stripe
  m.rect(8, 52, 58, 5, 'f8b800');
  for (let x = 8; x < 66; x += 6) m.rect(x, 52, 3, 5, K);
  // cannon arm (left, toward the player)
  m.round(6, 34, 12, 14, '4c4c58').rect(0, 38, 12, 8, '5c5c64').rect(0, 39, 3, 6, K);
  // neck, rim and cockpit dome with the pilot
  m.rect(33, 26, 14, 6, '505058');
  m.round(COCKPIT.x, COCKPIT.y, COCKPIT.w, COCKPIT.h, 'a4e4fc');
  m.blit(pilot.flipX(), 31, 8);
  m.pixels([[27, 7], [28, 6], [29, 5], [27, 9]], 'f8f8f8');
  m.rect(COCKPIT.x - 2, 26, COCKPIT.w + 4, 4, 'bcbcbc');
  addCanvasTexture(scene, 'cto-machine', m.outline());

  const shutter = new PixelCanvas(COCKPIT.w, COCKPIT.h - 4);
  shutter.round(0, 0, COCKPIT.w, COCKPIT.h - 4, 'bcbcbc').rect(0, 12, COCKPIT.w, 4, 'e40058');
  shutter.rect(COCKPIT.w / 2 - 1, 0, 2, COCKPIT.h - 4, '7c7c7c');
  shutter.pixels([[6, 6], [29, 6], [6, 19], [29, 19], [12, 3], [23, 3]], '505058');
  addCanvasTexture(scene, 'cto-shutter', shutter.outline());

  const cap = new PixelCanvas(36, 32);
  cap.round(6, 0, 24, 18, 'a4e4fc');
  cap.blit(pilot.crop(0, 0, 18, 16), 9, 2);
  cap.pixels([[10, 3], [9, 4]], 'f8f8f8');
  cap.round(0, 14, 36, 10, '7c7c7c').rect(2, 17, 32, 2, 'bcbcbc');
  cap.pixels([[5, 20], [12, 21], [18, 21], [24, 21], [30, 20]], 'f8b800').pixels([[8, 21], [15, 21], [21, 21], [27, 21]], 'f83800');
  cap.rect(12, 24, 12, 4, '505058').rect(14, 28, 8, 3, 'fca044').rect(16, 30, 4, 2, 'fce0a8');
  addCanvasTexture(scene, 'cto-capsule', cap.outline());

  // HQ: skyline with a skull on the tallest tower
  const hq = new PixelCanvas(128, 96);
  const windows = (x: number, y: number, w: number, h: number) => {
    for (let wy = y + 4; wy < y + h - 4; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 5) if ((wx * 7 + wy * 13) % 5 !== 0) hq.rect(wx, wy, 2, 3, (wx + wy) % 3 ? 'f8d878' : 'f83800');
  };
  hq.rect(0, 40, 30, 56, '203048');
  windows(0, 40, 30, 56);
  hq.rect(98, 48, 30, 48, '203048');
  windows(98, 48, 30, 48);
  hq.rect(30, 58, 20, 38, '283858');
  windows(30, 58, 20, 38);
  hq.rect(78, 62, 20, 34, '283858');
  windows(78, 62, 20, 34);
  hq.rect(48, 30, 32, 66, '383838');
  windows(48, 36, 32, 60);
  hq.round(48, 2, 32, 28, 'f8f8f8').rect(54, 24, 20, 8, 'f8f8f8');
  hq.round(53, 10, 9, 9, K).round(66, 10, 9, 9, K).rect(62, 19, 4, 4, K);
  for (let x = 55; x < 74; x += 4) hq.rect(x, 27, 2, 5, K);
  hq.rect(63, 0, 2, 3, 'f83800');
  addCanvasTexture(scene, 'fx-hq', hq.outline());
}

export function generateTiles(scene: Phaser.Scene, key: string, base: string, light: string): void {
  const dark = shade(base, 0.6);
  const floor = new PixelCanvas(16, 16)
    .rect(0, 0, 16, 16, base)
    .rect(0, 0, 16, 1, light)
    .rect(0, 0, 1, 16, light)
    .rect(15, 0, 1, 16, dark)
    .rect(0, 15, 16, 1, dark)
    .rect(3, 3, 2, 2, light)
    .rect(11, 11, 2, 2, dark)
    .rect(3, 11, 2, 2, dark)
    .rect(11, 3, 2, 2, light);
  addCanvasTexture(scene, key, floor);
}

export function generateBackground(scene: Phaser.Scene, key: string, bg: string, pattern: string): void {
  const pc = new PixelCanvas(32, 32).rect(0, 0, 32, 32, bg);
  // office window grid
  pc.rect(2, 2, 12, 12, pattern).rect(18, 2, 12, 12, pattern).rect(2, 18, 12, 12, pattern).rect(18, 18, 12, 12, pattern);
  pc.rect(3, 3, 10, 10, bg).rect(19, 3, 10, 10, bg).rect(3, 19, 10, 10, bg).rect(19, 19, 10, 10, bg);
  pc.rect(4, 4, 2, 1, pattern).rect(20, 20, 2, 1, pattern);
  addCanvasTexture(scene, key, pc);
}

export { FRAME_W, FRAME_H };
