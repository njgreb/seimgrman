import { BOSSES, FINAL_BOSS } from './data/bosses';
import type { BossDef } from './data/types';
import { WEAPONS } from './data/weapons';
import { SERVER_URL } from './leaderboard';
import { progress } from './state';

// Discord pings for the four moments worth watching from the channel: someone opened the game, someone
// started a run, a manager went down, a run ended. The game only tells the leaderboard server what
// happened; the webhook itself lives there (server/discord.ts), out of reach of anyone reading this
// bundle. No server configured (no VITE_LEADERBOARD_URL) means no pings.

// One id per page load, on every ping, so a channel full of pings can be read back as individual
// sittings — at an onsite everyone shares one public IP, so this is what actually tells players apart.
// It lives in memory only: a refresh is a new id, and nothing is stored on the device.
const SESSION_ID = ((): string => {
  try {
    // randomUUID needs a secure context (https or localhost); the fallback keeps file:// and old browsers working.
    return crypto.randomUUID();
  } catch {
    return Array.from({ length: 8 }, () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')).join('');
  }
})();

function send(body: Record<string, unknown>): void {
  if (!SERVER_URL) return;
  // The player's IP isn't in here: the server reads the real one off the request, where it can't be faked.
  const payload = JSON.stringify({
    ...body,
    session: SESSION_ID,
    build: import.meta.env.VITE_BUILD_SHA ?? 'dev',
    practice: progress.practice,
  });
  try {
    // keepalive: the ping still goes out if the tab is closed a moment later.
    void fetch(`${SERVER_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // a ping is never worth breaking the game over
  }
}

export function notifyLoaded(): void {
  send({ type: 'load' });
}

// Leaving the title screen for the boss select: the run proper starts here.
export function notifyStarted(): void {
  send({ type: 'start' });
}

// One of the four managers just went down. The final boss is announced by the run card instead.
export function notifyBossDefeated(def: BossDef): void {
  send({
    type: 'boss',
    stats: progress.stats,
    boss: def.name,
    bossManager: def.manager,
    weapon: WEAPONS[def.reward]?.name ?? null,
    defeatedCount: BOSSES.filter((b) => progress.defeated.has(b.id)).length,
    bossCount: BOSSES.length,
  });
}

// Called once the run is over, win or lose, from the score screen.
export function notifyCompleted(): void {
  send({
    type: 'complete',
    stats: progress.stats,
    managersBeaten: BOSSES.filter((b) => progress.defeated.has(b.id)).map((b) => b.name),
    finalBoss: FINAL_BOSS.name,
    finalBossManager: FINAL_BOSS.manager,
  });
}
