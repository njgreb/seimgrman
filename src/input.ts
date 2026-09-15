import Phaser from 'phaser';
import { type Button, type ButtonSource, buttons } from './buttons';
import { TOUCH_ENABLED } from './touch';

type Key = Phaser.Input.Keyboard.Key;

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'shoot' | 'prev' | 'next';

export interface Controls {
  isDown: (action: Action) => boolean;
  // Presses are buffered from key/button events so taps shorter than a frame are never lost.
  pressed: Set<Action>;
}

// Help text and prompts name the buttons of whatever the player touched last.
type Device = 'keyboard' | ButtonSource;
let device: Device = TOUCH_ENABLED ? 'touch' : 'keyboard';
const deviceListeners = new Set<() => void>();
const useDevice = (next: Device) => {
  if (next === device) return;
  device = next;
  for (const l of [...deviceListeners]) l();
};
window.addEventListener('keydown', () => useDevice('keyboard'));
buttons.onPress((_, source) => useDevice(source));

const HELP: Record<Device, string[]> = {
  keyboard: ['ARROWS: MOVE', 'Z / SPACE: JUMP', 'X / C: SHOOT', 'A / S: SWITCH WEAPON', 'ENTER: PAUSE   M: MUTE'],
  touch: ['D-PAD: MOVE', 'A: JUMP    B: SHOOT', 'L / R: SWITCH WEAPON', 'START: PAUSE'],
  gamepad: ['D-PAD / STICK: MOVE', 'A: JUMP    B / X: SHOOT', 'LB / RB: SWITCH WEAPON', 'START: PAUSE'],
};

const PAD_PROMPTS = { start: 'PRESS START', pause: 'START: RESUME   SELECT: QUIT', gameOver: 'A: RETRY    B: BOSS SELECT' };
const PROMPT_TEXT: Record<Device, typeof PAD_PROMPTS> = {
  keyboard: { start: 'PRESS ENTER', pause: 'ENTER: RESUME   ESC: QUIT', gameOver: 'Z: RETRY    X: BOSS SELECT' },
  touch: PAD_PROMPTS,
  gamepad: PAD_PROMPTS,
};

export const controlsHelp = (): string[] => HELP[device];

// On-screen prompts that name a button. Read when the text is created.
export const PROMPTS = {
  get start() {
    return PROMPT_TEXT[device].start;
  },
  get pause() {
    return PROMPT_TEXT[device].pause;
  },
  get gameOver() {
    return PROMPT_TEXT[device].gameOver;
  },
};

// Calls `handler` when the player switches device, until the scene shuts down.
export function onDeviceChange(scene: Phaser.Scene, handler: () => void): void {
  deviceListeners.add(handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => deviceListeners.delete(handler));
}

const BUTTON_ACTIONS: Record<Button, Action | undefined> = {
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

// Button listeners follow the same rules as Phaser's keyboard events: only running (not paused)
// scenes hear them, and they're removed when the scene shuts down.
function onButtonPress(scene: Phaser.Scene, handler: (button: Button) => void): void {
  const off = buttons.onPress((button) => {
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
  const actionButtons = (action: Action) => (Object.keys(BUTTON_ACTIONS) as Button[]).filter((b) => BUTTON_ACTIONS[b] === action);

  const controls: Controls = {
    isDown: (action) => keys[action].some((k) => k.isDown) || actionButtons(action).some(buttons.isDown),
    pressed: new Set(),
  };
  kb.on('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    for (const [action, list] of Object.entries(keys) as [Action, Key[]][]) {
      if (list.some((k) => k.keyCode === e.keyCode)) controls.pressed.add(action);
    }
  });
  onButtonPress(scene, (button) => {
    const action = BUTTON_ACTIONS[button];
    if (action) controls.pressed.add(action);
  });
  return controls;
}

// 'select' only comes from a SELECT button (the keyboard has ESC for quitting).
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

const BUTTON_MENU: Record<Button, MenuAction | undefined> = {
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
  onButtonPress(scene, (button) => {
    const action = BUTTON_MENU[button];
    if (action) handler(action);
  });
}
