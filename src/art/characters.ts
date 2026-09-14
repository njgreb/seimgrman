import { PixelCanvas } from './PixelCanvas';
import { shade } from './palette';

// Everyone (player and every boss) uses this one rig. What makes a character recognizable
// is the head (from traits or an imported head.png) plus clothing colors and accessories.

export type HairStyle = 'short' | 'buzz' | 'bald' | 'long' | 'curly' | 'spiky' | 'bun' | 'ponytail' | 'helmet';
export type FacialHair = 'none' | 'beard' | 'mustache' | 'goatee' | 'stubble';
export type Glasses = 'none' | 'square' | 'round';
export type Accessory = 'headphones' | 'cap' | 'tie' | 'hoodie' | 'lanyard' | 'mug';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  facialHair?: FacialHair;
  glasses?: Glasses;
  shirt: string;
  pants: string;
  shoes?: string;
  accent?: string; // cap / tie / helmet trim / buster color
  accessories?: Accessory[];
}

export const FRAME_W = 24;
export const FRAME_H = 32;

type Legs = 'stand' | 'run1' | 'run2' | 'run3' | 'jump' | 'hurt';
type Arms = 'down' | 'shoot' | 'up';

export const FRAMES = {
  idle: 0,
  run1: 1,
  run2: 2,
  run3: 3,
  jump: 4,
  shoot: 5,
  runShoot1: 6,
  runShoot2: 7,
  runShoot3: 8,
  jumpShoot: 9,
  hurt: 10,
  attack: 11,
} as const;

const POSES: [Legs, Arms][] = [
  ['stand', 'down'],
  ['run1', 'down'],
  ['run2', 'down'],
  ['run3', 'down'],
  ['jump', 'up'],
  ['stand', 'shoot'],
  ['run1', 'shoot'],
  ['run2', 'shoot'],
  ['run3', 'shoot'],
  ['jump', 'shoot'],
  ['hurt', 'up'],
  ['stand', 'up'],
];

export const FRAME_COUNT = POSES.length;

function drawLegs(pc: PixelCanvas, look: Look, legs: Legs, bob: number): void {
  const pants = look.pants;
  const pantsDark = shade(pants, 0.7);
  const shoes = look.shoes ?? '383838';

  // hips
  pc.rect(8, 23 + bob, 9, 2, pants);

  switch (legs) {
    case 'stand':
      pc.rect(9, 25, 3, 5, pantsDark).rect(8, 30, 4, 2, shoes);
      pc.rect(13, 25, 3, 5, pants).rect(13, 30, 4, 2, shoes);
      break;
    case 'run1':
      pc.rect(7, 25, 3, 4, pantsDark).rect(5, 29, 4, 2, shoes);
      pc.rect(14, 25, 3, 5, pants).rect(15, 30, 4, 2, shoes);
      break;
    case 'run2':
      pc.rect(10, 24, 3, 5, pantsDark).rect(9, 29, 4, 2, shoes);
      pc.rect(12, 24, 3, 6, pants).rect(12, 30, 4, 2, shoes);
      break;
    case 'run3':
      pc.rect(14, 25, 3, 5, pantsDark).rect(15, 30, 4, 2, shoes);
      pc.rect(7, 25, 3, 4, pants).rect(5, 29, 4, 2, shoes);
      break;
    case 'jump':
      pc.rect(9, 25, 3, 5, pantsDark).rect(8, 30, 4, 2, shoes);
      pc.rect(13, 24, 4, 3, pants).rect(15, 26, 3, 3, pants).rect(16, 28, 4, 2, shoes);
      break;
    case 'hurt':
      pc.rect(8, 25, 3, 5, pantsDark).rect(6, 30, 4, 2, shoes);
      pc.rect(14, 25, 3, 5, pants).rect(15, 30, 4, 2, shoes);
      break;
  }
}

function drawTorso(pc: PixelCanvas, look: Look, bob: number): void {
  const shirt = look.shirt;
  pc.rect(8, 15 + bob, 9, 8, shirt);
  pc.rect(8, 15 + bob, 1, 8, shade(shirt, 0.8));
  pc.rect(15, 16 + bob, 1, 2, shade(shirt, 1.25)); // highlight

  const acc = look.accessories ?? [];
  const accent = look.accent ?? 'f83800';
  if (acc.includes('tie')) {
    pc.rect(13, 15 + bob, 2, 1, shade(accent, 0.8)).rect(13, 16 + bob, 2, 5, accent);
  }
  if (acc.includes('lanyard')) {
    pc.pixels([[10, 15 + bob], [11, 16 + bob], [12, 17 + bob], [13, 18 + bob]], 'f8f8f8');
    pc.rect(12, 19 + bob, 3, 3, 'f8f8f8').set(13, 20 + bob, accent);
  }
  if (acc.includes('hoodie')) {
    pc.rect(6, 13 + bob, 4, 3, shade(shirt, 0.75));
    pc.pixels([[14, 16 + bob], [14, 17 + bob], [12, 16 + bob], [12, 17 + bob]], 'f8f8f8');
  }
}

function drawArm(pc: PixelCanvas, look: Look, arms: Arms, bob: number, front: boolean, isPlayer: boolean): void {
  const sleeve = front ? shade(look.shirt, 0.85) : shade(look.shirt, 0.65);
  const hand = front ? look.skin : shade(look.skin, 0.8);
  const accent = look.accent ?? '3cbcfc';

  if (arms === 'shoot' && front) {
    pc.rect(14, 17 + bob, 5, 3, sleeve);
    if (isPlayer) pc.rect(18, 16 + bob, 5, 5, accent).rect(22, 17 + bob, 1, 3, shade(accent, 0.6));
    else pc.rect(19, 17 + bob, 3, 3, hand);
    if ((look.accessories ?? []).includes('mug') && !isPlayer) pc.rect(19, 15 + bob, 3, 2, 'f8f8f8');
    return;
  }
  if (arms === 'up') {
    if (front) pc.rect(15, 15 + bob, 4, 2, sleeve).rect(19, 10 + bob, 3, 7, sleeve).rect(19, 7 + bob, 3, 3, hand);
    else pc.rect(2, 10 + bob, 3, 7, sleeve).rect(4, 15 + bob, 4, 2, sleeve).rect(2, 7 + bob, 3, 3, hand);
    return;
  }
  // down (and the back arm while shooting)
  if (front) {
    pc.rect(12, 16 + bob, 3, 6, sleeve).rect(12, 22 + bob, 3, 2, hand);
    if ((look.accessories ?? []).includes('mug') && !isPlayer) pc.rect(14, 21 + bob, 3, 3, 'f8f8f8').set(17, 22 + bob, 'f8f8f8');
  } else {
    pc.rect(6, 16 + bob, 3, 6, sleeve).rect(6, 22 + bob, 3, 2, hand);
  }
}

// Head occupies roughly x 4..19, y 0..15, facing right.
export function drawHead(pc: PixelCanvas, look: Look, bob = 0): void {
  const skin = look.skin;
  const skinDark = shade(skin, 0.8);
  const hair = look.hair;
  const hairDark = shade(hair, 0.7);
  const y = bob;
  const acc = look.accessories ?? [];

  // back hair layers go behind the face
  if (look.hairStyle === 'long') pc.rect(5, 4 + y, 5, 12, hairDark);
  if (look.hairStyle === 'ponytail') pc.rect(3, 5 + y, 3, 8, hairDark);
  if (look.hairStyle === 'bun') pc.round(3, 1 + y, 5, 5, hairDark);
  if (look.hairStyle === 'curly') pc.round(4, 2 + y, 7, 10, hairDark);

  // face
  pc.rect(7, 4 + y, 10, 10, skin);
  pc.rect(6, 5 + y, 1, 7, skin);
  pc.rect(17, 6 + y, 1, 6, skin);
  pc.set(18, 9 + y, skin); // nose
  pc.rect(7, 13 + y, 1, 1, null);
  pc.rect(8, 11 + y, 1, 3, skinDark); // jaw shade

  // hair
  switch (look.hairStyle) {
    case 'short':
    case 'long':
    case 'ponytail':
    case 'bun':
      pc.round(6, 2 + y, 12, 3, hair);
      pc.rect(6, 4 + y, 4, 4, hair);
      pc.rect(15, 5 + y, 3, 1, hair);
      pc.rect(7, 3 + y, 6, 1, hairDark);
      break;
    case 'buzz':
      pc.rect(7, 3 + y, 10, 2, hair);
      pc.rect(6, 4 + y, 3, 3, hair);
      break;
    case 'bald':
      pc.rect(8, 3 + y, 8, 1, skin);
      pc.set(12, 4 + y, shade(skin, 1.2));
      pc.rect(6, 7 + y, 2, 3, hair);
      break;
    case 'curly': {
      pc.round(5, 1 + y, 14, 5, hair);
      pc.rect(5, 5 + y, 4, 5, hair);
      pc.pixels([[6, 0 + y], [9, 0 + y], [12, 0 + y], [15, 0 + y], [18, 3 + y], [4, 6 + y], [4, 9 + y]], hair);
      pc.pixels([[8, 2 + y], [11, 3 + y], [14, 2 + y], [6, 6 + y], [7, 8 + y], [16, 4 + y]], hairDark);
      break;
    }
    case 'spiky':
      pc.round(6, 2 + y, 12, 3, hair);
      pc.rect(6, 4 + y, 4, 4, hair);
      pc.pixels([[7, 1 + y], [8, 0 + y], [10, 1 + y], [11, 0 + y], [13, 1 + y], [14, 0 + y], [16, 1 + y], [17, 0 + y], [18, 3 + y]], hair);
      pc.rect(7, 3 + y, 6, 1, hairDark);
      break;
    case 'helmet': {
      const helm = look.shirt;
      const trim = look.accent ?? '3cbcfc';
      pc.round(5, 1 + y, 14, 5, helm);
      pc.rect(5, 4 + y, 5, 8, helm);
      pc.rect(16, 5 + y, 3, 1, helm);
      pc.rect(11, 1 + y, 3, 3, trim);
      pc.round(6, 7 + y, 4, 4, trim);
      break;
    }
  }

  // ear (hidden under helmets)
  if (look.hairStyle !== 'helmet') pc.rect(9, 8 + y, 2, 2, skinDark);

  // eyes
  pc.rect(12, 8 + y, 1, 2, '101010');
  pc.rect(15, 8 + y, 1, 2, '101010');
  pc.set(11, 8 + y, 'f8f8f8');

  // mouth
  pc.rect(14, 12 + y, 2, 1, shade(skin, 0.6));

  switch (look.facialHair ?? 'none') {
    case 'beard':
      pc.rect(9, 10 + y, 9, 4, hair).rect(10, 14 + y, 6, 1, hair).rect(7, 9 + y, 3, 3, hair);
      pc.rect(14, 12 + y, 2, 1, hairDark);
      break;
    case 'mustache':
      pc.rect(13, 11 + y, 5, 1, hair);
      break;
    case 'goatee':
      pc.rect(13, 11 + y, 5, 1, hair).rect(14, 13 + y, 3, 2, hair);
      break;
    case 'stubble':
      pc.pixels([[10, 12 + y], [12, 13 + y], [14, 13 + y], [16, 12 + y], [11, 11 + y], [13, 11 + y], [16, 11 + y], [9, 11 + y]], skinDark);
      break;
  }

  if (look.glasses && look.glasses !== 'none') {
    const g = '101010';
    pc.rect(11, 7 + y, 3, 1, g).rect(14, 7 + y, 4, 1, g);
    pc.rect(11, 10 + y, 3, 1, g).rect(14, 10 + y, 4, 1, g);
    pc.pixels([[11, 8 + y], [11, 9 + y], [17, 8 + y], [17, 9 + y], [10, 8 + y], [9, 8 + y]], g);
    if (look.glasses === 'round') pc.pixels([[11, 7 + y], [17, 7 + y], [11, 10 + y], [17, 10 + y]], skin);
    pc.set(12, 8 + y, 'a4e4fc');
  }

  if (acc.includes('headphones')) {
    const hp = '383838';
    pc.rect(8, 0 + y, 8, 1, hp).set(7, 1 + y, hp).set(16, 1 + y, hp);
    pc.round(7, 6 + y, 4, 5, hp).set(7, 1 + y, look.accent ?? 'f83800').set(16, 1 + y, look.accent ?? 'f83800');
  }
  if (acc.includes('cap')) {
    const cap = look.accent ?? 'f83800';
    pc.round(6, 0 + y, 12, 4, cap).rect(15, 3 + y, 5, 2, shade(cap, 0.75));
  }
}

export interface HeadOverride {
  canvas: PixelCanvas; // 16x16, facing right
}

export function drawFrame(look: Look, frame: number, isPlayer: boolean, head?: HeadOverride): PixelCanvas {
  const [legs, arms] = POSES[frame];
  const pc = new PixelCanvas(FRAME_W, FRAME_H);
  const bob = legs === 'run2' ? -1 : 0;

  drawArm(pc, look, arms === 'shoot' ? 'down' : arms, bob, false, isPlayer);
  drawLegs(pc, look, legs, bob);
  drawTorso(pc, look, bob);
  if (head) pc.blit(head.canvas, 4, bob);
  else drawHead(pc, look, bob);
  drawArm(pc, look, arms, bob, true, isPlayer);

  return pc.outline();
}

// Bust used on boss select / intro screens when no portrait.png has been provided.
export function drawPortrait(look: Look, head?: HeadOverride): PixelCanvas {
  const frame = drawFrame(look, FRAMES.idle, false, head);
  return frame.crop(0, 0, 24, 24).scale(2);
}
