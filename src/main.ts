import Phaser from 'phaser';
import { GRAVITY, HEIGHT, WIDTH } from './config';
import { sfx } from './audio/sfx';
import { Arena } from './scenes/Arena';
import { Boot } from './scenes/Boot';
import { BossIntro } from './scenes/BossIntro';
import { BossSelect } from './scenes/BossSelect';
import { Ending } from './scenes/Ending';
import { Fortress } from './scenes/Fortress';
import { Leaderboard } from './scenes/Leaderboard';
import { NameEntry } from './scenes/NameEntry';
import { Pause } from './scenes/Pause';
import { Results } from './scenes/Results';
import { Title } from './scenes/Title';
import { WeaponGet } from './scenes/WeaponGet';
import { printConsoleEgg } from './egg';
import { pollGamepads } from './gamepad';
import { TOUCH_ENABLED, mountTouchControls } from './touch';

printConsoleEgg();
mountTouchControls(document.getElementById('app')!);

// Desktop: largest whole-number zoom that fits, so pixels stay square.
// Touch: fill the screen area. Phones are dense enough that uneven pixel widths don't show.
const zoom = () => {
  const screen = document.getElementById('screen')!;
  const fit = Math.min(screen.clientWidth / WIDTH, screen.clientHeight / HEIGHT);
  return TOUCH_ENABLED ? fit : Math.max(1, Math.floor(fit));
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.NONE, zoom: zoom() },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY }, debug: new URLSearchParams(window.location.search).has('debug') },
  },
  scene: [Boot, Title, BossSelect, BossIntro, Arena, Pause, WeaponGet, Fortress, Results, NameEntry, Leaderboard, Ending],
});

game.events.on(Phaser.Core.Events.PRE_STEP, pollGamepads);

const rezoom = () => requestAnimationFrame(() => game.scale.setZoom(zoom()));
window.addEventListener('resize', rezoom);
window.addEventListener('orientationchange', rezoom);
window.visualViewport?.addEventListener('resize', rezoom);
// the screen area also changes size when the on-screen controller hides or shows
new ResizeObserver(rezoom).observe(document.getElementById('screen')!);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') sfx.toggleMute();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});

// Exposed in dev only, for automated playtesting from the browser console.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
