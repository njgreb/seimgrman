export const GAME_TITLE = 'MEGA MANAGER';
export const PLAYER_NAME = 'MEGA DEV';

// NES-ish internal resolution; the canvas is scaled up by whole numbers.
export const WIDTH = 256;
export const HEIGHT = 240;
export const TILE = 16;

// Physics tuned to Mega Man's per-frame numbers at 60fps.
export const GRAVITY = 900;
export const MAX_FALL = 420;
export const RUN_SPEED = 84;
export const JUMP_VELOCITY = -310;
export const BUSTER_SPEED = 300;
export const MAX_BUSTER_SHOTS = 3;

export const MAX_HP = 28;
export const MAX_ENERGY = 28;
export const ENERGY_REGEN_MS = 700; // weapon energy trickles back so nobody gets stuck without their weakness weapon

export const PLAYER_INVULN_MS = 1500;
export const PLAYER_HURT_MS = 400;
export const BOSS_INVULN_MS = 250;
export const CONTACT_DAMAGE = 4;
export const WEAKNESS_DAMAGE = 4;

export const FLOOR_Y = 208; // top of the floor tiles in every arena
