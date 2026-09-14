import Phaser from 'phaser';
import { PixelCanvas } from './PixelCanvas';
import { FRAME_COUNT, FRAME_H, FRAME_W, FRAMES, drawFrame, drawPortrait, type HeadOverride, type Look } from './characters';
import { shade } from './palette';
import { BOSSES } from '../data/bosses';
import { PLAYER_LOOK, WEAPONS } from '../data/weapons';

export interface Manifest {
  bosses: Record<string, { portrait?: string; head?: string }>;
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

  for (const boss of BOSSES) {
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
