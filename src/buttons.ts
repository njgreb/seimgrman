// Virtual controller buttons, shared by the on-screen touch pad and physical gamepads.
// src/input.ts maps them to game and menu actions.

export type Button = 'left' | 'right' | 'up' | 'down' | 'a' | 'b' | 'l' | 'r' | 'start' | 'select';
export type ButtonSource = 'touch' | 'gamepad';

type Listener = (button: Button, source: ButtonSource) => void;

const heldBySource = new Map<ButtonSource, Set<Button>>();
const listeners = new Set<Listener>();

export const buttons = {
  isDown: (button: Button): boolean => [...heldBySource.values()].some((held) => held.has(button)),

  onPress(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Replaces everything one source is holding and fires listeners for buttons that just went down.
  set(source: ButtonSource, held: Set<Button>): Button[] {
    const before = heldBySource.get(source) ?? new Set();
    heldBySource.set(source, held);
    const pressed = [...held].filter((b) => !before.has(b));
    for (const b of pressed) for (const l of [...listeners]) l(b, source);
    return pressed;
  },
};
