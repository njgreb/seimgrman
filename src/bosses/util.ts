import type { Shot } from '../entities/Shot';

// Kept free of Phaser imports so boss definitions can be loaded by the Node art tools.

// Shot update that gently steers toward a target (degrees per second).
export function homing(target: () => { x: number; y: number }, degPerSec: number) {
  return (shot: Shot, delta: number) => {
    const body = shot.body;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    const t = target();
    const current = Math.atan2(body.velocity.y, body.velocity.x);
    const desired = Math.atan2(t.y - shot.y, t.x - shot.x);
    let diff = desired - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = ((degPerSec * Math.PI) / 180) * (delta / 1000);
    const next = current + clamp(diff, -maxTurn, maxTurn);
    body.setVelocity(Math.cos(next) * speed, Math.sin(next) * speed);
  };
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
export const between = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
