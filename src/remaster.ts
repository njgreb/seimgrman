import Phaser from 'phaser';

// 16-BIT REMASTER: a title screen toggle that swaps in the 96x96 portraits (tools/pixelize.ts) wherever
// portraits are shown big. Remembered per device; ?remaster / ?remaster=0 overrides.

const STORAGE_KEY = 'mega-manager-remaster';
const param = new URLSearchParams(window.location.search).get('remaster');

function load(): boolean {
  if (param !== null) return param !== '0';
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const remaster = {
  enabled: load(),
  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
    } catch {
      // storage unavailable (private mode): the setting just lasts this session
    }
    return this.enabled;
  },
};

// A boss portrait displayed at 96x96: the 16-bit art when the remaster is on, otherwise the 8-bit art doubled.
export function bigPortrait(scene: Phaser.Scene, x: number, y: number, bossId: string): Phaser.GameObjects.Image {
  const hd = `portrait16-${bossId}`;
  if (remaster.enabled && scene.textures.exists(hd)) return scene.add.image(x, y, hd);
  return scene.add.image(x, y, `portrait-${bossId}`).setScale(2);
}
