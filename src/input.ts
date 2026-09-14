import Phaser from 'phaser';

type Key = Phaser.Input.Keyboard.Key;

type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'shoot' | 'prev' | 'next';

export interface Controls {
  held: Record<Action, Key[]>;
  // Presses are buffered from keydown events so taps shorter than a frame are never lost.
  pressed: Set<Action>;
}

export const CONTROLS_HELP = ['ARROWS: MOVE', 'Z / SPACE: JUMP', 'X / C: SHOOT', 'A / S: SWITCH WEAPON', 'ENTER: PAUSE   M: MUTE'];

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
  const held = Object.fromEntries(
    Object.entries(codes).map(([action, list]) => [action, list.map((c) => kb.addKey(c, true, false))]),
  ) as Record<Action, Key[]>;
  const controls: Controls = { held, pressed: new Set() };
  kb.on('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    for (const [action, list] of Object.entries(held) as [Action, Key[]][]) {
      if (list.some((k) => k.keyCode === e.keyCode)) controls.pressed.add(action);
    }
  });
  return controls;
}

export const isDown = (keys: Key[]): boolean => keys.some((k) => k.isDown);

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start';

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

export function onMenu(scene: Phaser.Scene, handler: (action: MenuAction) => void): void {
  scene.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    const action = MENU_KEYS[e.code];
    if (action) handler(action);
  });
}
