import Phaser from 'phaser';
import { FONT_KEY } from '../art/font';
import { hexToInt } from '../art/palette';

export interface TextOptions {
  color?: string;
  align?: 'left' | 'center' | 'right';
  scale?: number;
  depth?: number;
}

export function text(scene: Phaser.Scene, x: number, y: number, str: string, opts: TextOptions = {}): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(x, y, FONT_KEY, str.toUpperCase());
  const align = opts.align ?? 'left';
  t.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
  if (align === 'center') t.setCenterAlign();
  if (align === 'right') t.setRightAlign();
  if (opts.scale) t.setScale(opts.scale);
  if (opts.color) t.setTint(hexToInt(opts.color));
  if (opts.depth !== undefined) t.setDepth(opts.depth);
  return t;
}

// Reveals text one character at a time.
export function typeOut(scene: Phaser.Scene, target: Phaser.GameObjects.BitmapText, full: string, msPerChar = 45, onChar?: () => void): Promise<void> {
  const str = full.toUpperCase();
  target.setText('');
  return new Promise((resolve) => {
    let i = 0;
    scene.time.addEvent({
      delay: msPerChar,
      repeat: str.length - 1,
      callback: () => {
        i++;
        target.setText(str.slice(0, i));
        if (str[i - 1] !== ' ') onChar?.();
        if (i >= str.length) resolve();
      },
    });
    if (str.length === 0) resolve();
  });
}

export function sleep(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

export function starfield(scene: Phaser.Scene, count = 40, speed = 30, band?: { y: number; h: number }): void {
  const stars = Array.from({ length: count }, () => {
    const y = band ? band.y + Math.random() * band.h : Math.random() * scene.scale.height;
    const s = scene.add.image(Math.random() * scene.scale.width, y, 'fx-star').setDepth(-1);
    s.setData('speed', speed * (0.4 + Math.random()));
    s.setAlpha(0.4 + Math.random() * 0.6);
    return s;
  });
  const tick = (_t: number, delta: number) => {
    for (const s of stars) {
      s.x -= (s.getData('speed') * delta) / 1000;
      if (s.x < -2) s.x = scene.scale.width + 2;
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
}
