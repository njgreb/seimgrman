import { FRAMES } from '../art/characters';
import { sfx } from '../audio/sfx';
import { FLOOR_Y, GRAVITY, TILE, WIDTH } from '../config';
import type { BossDef, ShotSpec } from '../data/types';
import type { Boss } from '../entities/Boss';
import type { Capsule } from '../entities/Capsule';
import type { Shot } from '../entities/Shot';
import { between, clamp, homing } from './util';

// The final boss at HQ. Phase 1 pilots THE REORG MACHINE (weak to TICKET SPLIT: break the reorg down),
// phase 2 flees in an escape pod (weak to CALENDAR BLOCK: block off his calendar).
// Every attack is an "ALL-HANDS" remix of a manager you already beat.

const MACHINE_LANE = 150; // right edge of the floor the player can stand on during phase 1

// Lands on the floor and bursts into two subtasks (TICKET MAN's backlog toss).
const burstOnFloor = (b: Boss) => (shot: Shot) => {
  shot.angle += 12;
  if (shot.body.velocity.y <= 0 || shot.y < FLOOR_Y - 6) return;
  for (const dir of [-1, 1]) b.arena.spawnEnemyShot({ texture: 'e-ticket-small', x: shot.x, y: FLOOR_Y - 4, vx: dir * 120, damage: 2 });
  shot.destroy();
};

// Launch velocity for a lob from `from` that lands at floor x `targetX`.
function lob(from: { x: number; y: number }, targetX: number, vy = -300): { vx: number; vy: number } {
  const drop = FLOOR_Y - 6 - from.y;
  const t = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * drop)) / GRAVITY;
  return { vx: (clamp(targetX, TILE + 8, WIDTH - TILE - 8) - from.x) / t, vy };
}

// ---- phase 1: THE REORG MACHINE ----

// PARKER MAN remix: a wall of invites with a gap to slip through, then a homing meeting clock.
async function mandatoryAllHands(b: Boss) {
  b.say('MANDATORY ALL-HANDS');
  await b.telegraph(400);
  for (let wave = 0; wave < (b.enraged ? 2 : 1); wave++) {
    const gap = between(0, 5);
    for (let i = 0; i < 7; i++) {
      if (i === gap || i === gap + 1) continue;
      b.fire({ texture: 'e-invite', x: 24 + i * 21, y: -8, vy: 110 + wave * 25, damage: 3, keepOffscreen: true }, i === 0);
    }
    await b.wait(1000);
  }
  b.fire({ texture: 'e-clock', ...b.velocity(b.angleToPlayer(), 70), damage: 2, effect: 'freeze', lifespan: 4500, update: homing(() => b.player, 45) });
  await b.wait(700);
}

// TICKET MAN remix: the cannon lobs tickets across the room; each bursts into subtasks.
async function backlogDump(b: Boss) {
  b.say('BACKLOG DUMP');
  await b.telegraph(300);
  const count = b.enraged ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const targetX = i === 0 ? b.player.x : between(TILE + 8, MACHINE_LANE);
    b.fire({ texture: 'e-ticket', ...lob(b.muzzle, targetX), gravity: true, damage: 3, update: burstOnFloor(b) });
    await b.wait(450);
  }
  await b.wait(600);
}

// ANDY MAN remix: milestones fall one quarter at a time. Stand between them.
async function fiveYearRoadmap(b: Boss) {
  b.say('5-YEAR ROADMAP');
  await b.telegraph(350);
  const xs = [26, 54, 82, 110, 138];
  const order = b.enraged ? [...xs, ...xs.slice(0, -1).reverse()] : xs;
  for (const [i, x] of order.entries()) {
    const shot = b.fire({ texture: 'e-milestone', x, y: 20, damage: 3 }, i === 0);
    b.arena.time.delayedCall(350, () => shot.active && shot.body.setVelocityY(300));
    await b.wait(b.enraged ? 180 : 230);
  }
  await b.wait(800);
}

// BRENT MAN remix: the floor catches fire where you stand, then a shockwave rolls out of the machine.
async function sevZero(b: Boss) {
  b.say('SEV 0!');
  await b.telegraph(300);
  const xs = [clamp(b.player.x, 24, MACHINE_LANE), between(24, MACHINE_LANE)];
  if (b.enraged) xs.push(between(24, MACHINE_LANE));
  const warnings = xs.map((x) => b.arena.add.image(x, FLOOR_Y - 3, 'e-warning'));
  const blink = b.arena.tweens.add({ targets: warnings, alpha: 0.2, duration: 90, yoyo: true, repeat: -1 });
  try {
    await b.wait(700);
  } finally {
    blink.remove();
    warnings.forEach((w) => w.destroy());
  }
  sfx.boom();
  for (const x of xs) b.fire({ texture: 'e-flame', x, y: FLOOR_Y - 24, damage: 4, pierce: true, lifespan: 600 }, false);
  await b.wait(900);
  b.arena.shake();
  b.fire({ texture: 'e-shockwave', x: b.x - 44, y: FLOOR_Y - 8, vx: b.enraged ? -170 : -130, damage: 4, pierce: true }, false);
  await b.wait(1000);
}

// ---- phase 2: the escape pod ----

const RING = ['e-invite', 'e-ticket-small', 'e-milestone', 'e-page'];

// Teleports in and fires every manager's projectile in a ring.
async function skipLevel(b: Boss) {
  const pod = b as Capsule;
  await pod.teleportTo(between(40, WIDTH - 40), between(48, 100));
  b.say('SKIP-LEVEL!', 600);
  await b.telegraph(350);
  for (let ring = 0; ring < (b.enraged ? 2 : 1); ring++) {
    for (let i = 0; i < 8; i++) {
      b.fire({ texture: RING[i % RING.length], x: b.x, y: b.y, ...b.velocity(i * 45 + ring * 22.5, 105), damage: 3 }, i === 0);
    }
    await b.wait(500);
  }
  await b.wait(400);
}

// Calls the four managers back as holograms, and each one takes a shot at you.
async function allHands(b: Boss) {
  const pod = b as Capsule;
  await pod.flyTo(WIDTH / 2, 40, 170);
  b.say('ALL-HANDS!', 900);
  await b.telegraph(400);

  const shoot = (x: number, y: number, spec: Omit<ShotSpec, 'x' | 'y'>) => {
    sfx.enemyShoot();
    b.arena.spawnEnemyShot({ ...spec, x, y });
  };
  const toPlayer = (x: number, y: number, speed: number, spread = 0) => {
    const a = Math.atan2(b.player.y + 4 - y, b.player.x - x) + (spread * Math.PI) / 180;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  };
  const cast: [id: string, x: number, attack: (x: number, y: number) => void][] = [
    ['sync', 36, (x, y) => [-18, 0, 18].forEach((s) => shoot(x, y, { texture: 'e-invite', ...toPlayer(x, y, 125, s), damage: 3 }))],
    ['ticket', 92, (x, y) => shoot(x, y, { texture: 'e-ticket', ...lob({ x, y }, b.player.x, -200), gravity: true, damage: 3, update: burstOnFloor(b) })],
    ['roadmap', 164, () => {
      const drop = b.arena.spawnEnemyShot({ texture: 'e-milestone', x: clamp(b.player.x, 24, WIDTH - 24), y: 16, damage: 3 });
      b.arena.time.delayedCall(300, () => drop.active && drop.body.setVelocityY(300));
    }],
    ['oncall', 220, (x, y) => [0, 1, 2].forEach((i) => b.arena.time.delayedCall(i * 120, () => shoot(x, y, { texture: 'e-page', ...toPlayer(x, y, 190), damage: 2 })))],
  ];

  const ghosts: Phaser.GameObjects.Sprite[] = [];
  try {
    for (const [id, x] of cast) {
      const ghost = b.arena.add.sprite(x, 118, `boss-${id}`, FRAMES.attack).setAlpha(0).setTint(0x88ccff).setFlipX(b.player.x < x);
      b.arena.tweens.add({ targets: ghost, alpha: 0.75, duration: 250 });
      ghosts.push(ghost);
    }
    sfx.teleport();
    await b.wait(450);
    for (const [i, [, x, attack]] of cast.entries()) {
      ghosts[i].setAlpha(1);
      attack(x, 118);
      await b.wait(b.enraged ? 380 : 540);
      ghosts[i].setAlpha(0.4);
    }
    await b.wait(500);
  } finally {
    ghosts.forEach((g) => g.destroy());
  }
}

// Dives at you, sends shockwaves both ways on impact, then floats back up.
async function rightsizing(b: Boss) {
  const pod = b as Capsule;
  await pod.flyTo(b.player.x, 52, 190);
  b.say('RIGHTSIZING!', 700);
  await b.telegraph(b.enraged ? 250 : 420);
  await pod.flyTo(b.player.x, FLOOR_Y - 20, b.enraged ? 300 : 240);
  sfx.boom();
  b.arena.shake();
  for (const dir of [-1, 1]) b.fire({ texture: 'e-shockwave', x: b.x + dir * 12, y: FLOOR_Y - 8, vx: dir * 150, damage: 3, pierce: true }, false);
  await b.wait(400);
  await pod.flyTo(between(40, WIDTH - 40), between(56, 96), 160);
}

export const ctoMan: BossDef = {
  id: 'cto',
  name: 'CTO MAN',
  manager: 'DANIEL',
  intro: 'THIS REORG IS NON-NEGOTIABLE.',
  defeatQuote: "LET'S NOT PUT THIS IN THE RETRO...",
  credit: 'REORGS FOR FUN',
  look: {
    skin: 'e0ac69',
    hair: '6a4e2e',
    hairStyle: 'buzz',
    facialHair: 'stubble',
    shirt: 'f8f8f8',
    pants: '383838',
    accent: 'a80020',
    accessories: ['tie'],
  },
  theme: { bg: '200008', pattern: '480018', tile: '383838', tileLight: '7c7c7c' },
  weakness: 'ticket',
  reward: 'buster',
  patterns: [mandatoryAllHands, backlogDump, fiveYearRoadmap, sevZero],
  final: true,
  phases: [
    { body: 'machine', weakness: 'ticket', patterns: [mandatoryAllHands, backlogDump, fiveYearRoadmap, sevZero] },
    { body: 'capsule', weakness: 'calendar', patterns: [skipLevel, allHands, rightsizing] },
  ],
};
