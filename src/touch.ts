import { sfx } from './audio/sfx';
import { type Button, buttons } from './buttons';
import './touch.css';

// On-screen controller for phones: a DOM overlay around the canvas, so buttons stay big and sharp
// and never cover the arena. It only reports buttons (src/buttons.ts); src/input.ts maps them to game actions.

const params = new URLSearchParams(window.location.search);
// `?touch` forces the controller on (desktop testing), `?touch=0` forces it off.
export const TOUCH_ENABLED =
  params.has('touch') ? params.get('touch') !== '0' : window.matchMedia('(pointer: coarse)').matches;

const DIRS: Button[][] = [['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left'], ['up'], ['up', 'right']];
const DPAD_DEADZONE = 0.18; // fraction of the d-pad radius
const DPAD_REACH = 1.35; // a thumb can start a little outside the drawn d-pad
const ROUND_REACH = 1.5; // A/B hit circles overlap, so a thumb between them presses both
const RECT_REACH = 12; // px of slop around the small buttons

const MARKUP = `
  <div class="pad-side pad-left">
    <button class="pad-shoulder" data-btn="l">L</button>
    <div class="pad-dpad" data-dpad>
      <i data-dir="up"></i><i data-dir="right"></i><i data-dir="down"></i><i data-dir="left"></i><b></b>
    </div>
    <div class="pad-pills"><button class="pad-pill" data-btn="select">SELECT</button></div>
  </div>
  <div class="pad-side pad-right">
    <button class="pad-shoulder" data-btn="r">R</button>
    <div class="pad-face">
      <button class="pad-round" data-btn="b">B</button>
      <button class="pad-round" data-btn="a">A</button>
    </div>
    <div class="pad-pills">
      <button class="pad-pill" data-btn="start">START</button>
      <button class="pad-pill pad-mute" data-mute>SOUND</button>
    </div>
  </div>
`;

export function mountTouchControls(app: HTMLElement): void {
  if (!TOUCH_ENABLED) return;
  document.body.classList.add('touch');
  app.insertAdjacentHTML('beforeend', MARKUP);

  const dpad = app.querySelector<HTMLElement>('[data-dpad]')!;
  const dirEls = new Map([...dpad.querySelectorAll<HTMLElement>('[data-dir]')].map((el) => [el.dataset.dir as Button, el]));
  const buttonEls = [...app.querySelectorAll<HTMLElement>('[data-btn]')];
  const mute = app.querySelector<HTMLElement>('[data-mute]')!;

  // pointerId -> whether it started on the d-pad (it keeps steering even if the thumb drifts off)
  const pointers = new Map<number, { dpad: boolean; x: number; y: number }>();

  const dpadButtons = (x: number, y: number): Button[] => {
    const r = dpad.getBoundingClientRect();
    const radius = r.width / 2;
    const dx = x - (r.left + radius);
    const dy = y - (r.top + radius);
    if (Math.hypot(dx, dy) < radius * DPAD_DEADZONE) return [];
    const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
    return DIRS[sector];
  };

  const inDpadReach = (x: number, y: number): boolean => {
    const r = dpad.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < (r.width / 2) * DPAD_REACH;
  };

  const buttonsAt = (x: number, y: number): Button[] =>
    buttonEls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (el.classList.contains('pad-round')) {
          return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < (r.width / 2) * ROUND_REACH;
        }
        return x > r.left - RECT_REACH && x < r.right + RECT_REACH && y > r.top - RECT_REACH && y < r.bottom + RECT_REACH;
      })
      .map((el) => el.dataset.btn as Button);

  const refresh = () => {
    const next = new Set<Button>();
    for (const p of pointers.values()) for (const b of p.dpad ? dpadButtons(p.x, p.y) : buttonsAt(p.x, p.y)) next.add(b);
    for (const [dir, el] of dirEls) el.classList.toggle('on', next.has(dir));
    for (const el of buttonEls) el.classList.toggle('on', next.has(el.dataset.btn as Button));
    const pressed = buttons.set('touch', next);
    if (pressed.length && 'vibrate' in navigator) navigator.vibrate(8);
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    sfx.unlock(); // browsers only allow audio to start from a user gesture
    if (mute.contains(e.target as Node)) {
      mute.classList.toggle('off', sfx.toggleMute());
      return;
    }
    pointers.set(e.pointerId, { dpad: inDpadReach(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
    refresh();
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.x = e.clientX;
    p.y = e.clientY;
    refresh();
  };
  const onUp = (e: PointerEvent) => {
    sfx.unlock(); // iOS unlocks audio on touch end, not touch start
    if (!pointers.delete(e.pointerId)) return;
    refresh();
  };
  const release = () => {
    pointers.clear();
    refresh();
  };

  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', release);

  // Stop the browser from zooming, scrolling, selecting or long-press menus mid-fight.
  for (const type of ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
}
