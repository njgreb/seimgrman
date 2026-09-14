import Phaser from 'phaser';
import { GRAVITY, HEIGHT, WIDTH } from './config';
import { sfx } from './audio/sfx';
import { Arena } from './scenes/Arena';
import { Boot } from './scenes/Boot';
import { BossIntro } from './scenes/BossIntro';
import { BossSelect } from './scenes/BossSelect';
import { Ending } from './scenes/Ending';
import { Pause } from './scenes/Pause';
import { Title } from './scenes/Title';
import { WeaponGet } from './scenes/WeaponGet';

// Largest whole-number zoom that fits the window, so pixels stay square.
const zoom = () => Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)));

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
  scene: [Boot, Title, BossSelect, BossIntro, Arena, Pause, WeaponGet, Ending],
});

window.addEventListener('resize', () => game.scale.setZoom(zoom()));
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') sfx.toggleMute();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});

// Exposed in dev only, for automated playtesting from the browser console.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
