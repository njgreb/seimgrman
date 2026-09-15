import Phaser from 'phaser';
import { type Button, TOUCH_ENABLED, touch } from './touch';

type Key = Phaser.Input.Keyboard.Key;

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'shoot' | 'prev' | 'next';

export interface Controls {
  isDown: (action: Action) => boolean;
  // Presses are buffered from keydown/touch events so taps shorter than a frame are never lost.
  pressed: Set<Action>;
}

export const CONTROLS_HELP = TOUCH_ENABLED
  ? ['D-PAD: MOVE', 'A: JUMP    B: SHOOT', 'L / R: SWITCH WEAPON', 'START: PAUSE']
  : ['ARROWS: MOVE', 'Z / SPACE: JUMP', 'X / C: SHOOT', 'A / S: SWITCH WEAPON', 'ENTER: PAUSE   M: MUTE'];

// On-screen prompts that name a button.
export const PROMPTS = TOUCH_ENABLED
  ? { start: 'PRESS START', pause: 'START: RESUME   SELECT: QUIT', gameOver: 'A: RETRY    B: BOSS SELECT' }
  : { start: 'PRESS ENTER', pause: 'ENTER: RESUME   ESC: QUIT', gameOver: 'Z: RETRY    X: BOSS SELECT' };

const TOUCH_ACTIONS: Record<Button, Action | undefined> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  a: 'jump',
  b: 'shoot',
  l: 'prev',
  r: 'next',
  select: 'next',
  start: undefined,
};

// Touch listeners follow the same rules as Phaser's keyboard events: only running (not paused)
// scenes hear them, and they're removed when the scene shuts down.
function onTouchPress(scene: Phaser.Scene, handler: (button: Button) => void): void {
  const off = touch.onPress((button) => {
    if (scene.sys.isActive()) handler(button);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  scene.events.once(Phaser.Scenes.Events.DESTROY, off);
}

export function createControls(scene: Phaser.Scene): Controls {
  const kb = scene.input.keyboard!;
  const K = Phaser.Input.Keyboard.KeyCodes;
  const codes: Record<Action, number[]> = {
    left: [K.LEFT],
    right: [K.RIGHT],
    up: [K.UP],
    down: [K.DOWN],
    jump: [K.Z, K.SPACE, K.K],
    shoot: [K.X, K.C, K.J],
    prev: [K.A],
    next: [K.S],
  };
  const keys = Object.fromEntries(
    Object.entries(codes).map(([action, list]) => [action, list.map((c) => kb.addKey(c, true, false))]),
  ) as Record<Action, Key[]>;
  const touchButtons = (action: Action) => (Object.keys(TOUCH_ACTIONS) as Button[]).filter((b) => TOUCH_ACTIONS[b] === action);

  const controls: Controls = {
    isDown: (action) => keys[action].some((k) => k.isDown) || touchButtons(action).some(touch.isDown),
    pressed: new Set(),
  };
  kb.on('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    for (const [action, list] of Object.entries(keys) as [Action, Key[]][]) {
      if (list.some((k) => k.keyCode === e.keyCode)) controls.pressed.add(action);
    }
  });
  onTouchPress(scene, (button) => {
    const action = TOUCH_ACTIONS[button];
    if (action) controls.pressed.add(action);
  });
  return controls;
}

// 'select' only comes from the touch SELECT button (the keyboard has ESC for quitting).
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start' | 'select';

const MENU_KEYS: Record<string, MenuAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyZ: 'confirm',
  Space: 'confirm',
  KeyX: 'back',
  Escape: 'back',
  Enter: 'start',
  NumpadEnter: 'start',
};

const TOUCH_MENU: Record<Button, MenuAction | undefined> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  a: 'confirm',
  b: 'back',
  start: 'start',
  select: 'select',
  l: undefined,
  r: undefined,
};

export function onMenu(scene: Phaser.Scene, handler: (action: MenuAction) => void): void {
  scene.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    const action = MENU_KEYS[e.code];
    if (action) handler(action);
  });
  onTouchPress(scene, (button) => {
    const action = TOUCH_MENU[button];
    if (action) handler(action);
  });
}
