import { sfx } from './audio/sfx';
import { type Button, buttons } from './buttons';

// Physical controllers via the Gamepad API. Browsers only expose gamepads by polling, so this runs
// once per frame (before scenes update). Every connected pad feeds the same virtual buttons.
//
// Indices follow the browser's "standard" layout, named here by Xbox labels. PlayStation, Switch Pro
// and 8BitDo pads map to the same physical positions.
const BUTTON_MAP: [index: number, button: Button][] = [
  [0, 'a'], // A (bottom): jump, confirm
  [1, 'b'], // B (right): shoot, back
  [2, 'b'], // X (left): shoot, back
  [4, 'l'], // LB: previous weapon
  [6, 'l'], // LT
  [5, 'r'], // RB: next weapon
  [7, 'r'], // RT
  [8, 'select'], // View / Back / Select / Minus
  [9, 'start'], // Menu / Start / Options / Plus
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
];

// Left stick: press past STICK_ON, release inside STICK_OFF, so a stick resting near the edge doesn't chatter.
const STICK_ON = 0.5;
const STICK_OFF = 0.3;

let stickHeld = new Set<Button>();

function readStick(axis: number, negative: Button, positive: Button, out: Set<Button>): void {
  for (const [button, value] of [[negative, -axis], [positive, axis]] as const) {
    if (value > (stickHeld.has(button) ? STICK_OFF : STICK_ON)) out.add(button);
  }
}

export function pollGamepads(): void {
  const pads = navigator.getGamepads?.() ?? [];
  const held = new Set<Button>();
  const stick = new Set<Button>();
  for (const pad of pads) {
    if (!pad?.connected) continue;
    for (const [index, button] of BUTTON_MAP) if (pad.buttons[index]?.pressed) held.add(button);
    readStick(pad.axes[0] ?? 0, 'left', 'right', stick);
    readStick(pad.axes[1] ?? 0, 'up', 'down', stick);
  }
  stickHeld = stick;
  for (const b of stick) held.add(b);
  if (buttons.set('gamepad', held).length) sfx.unlock();
}
