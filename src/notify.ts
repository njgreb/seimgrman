import { BOSSES, FINAL_BOSS } from './data/bosses';
import { SERVER_URL } from './leaderboard';
import { progress } from './state';

// Discord pings for "someone started playing" and "someone finished a run". The game only tells the
// leaderboard server what happened; the webhook itself lives there (server/discord.ts), out of reach of
// anyone reading this bundle. No server configured (no VITE_LEADERBOARD_URL) means no pings.

function send(body: Record<string, unknown>): void {
  if (!SERVER_URL) return;
  const payload = JSON.stringify({ ...body, build: import.meta.env.VITE_BUILD_SHA ?? 'dev', practice: progress.practice });
  try {
    // keepalive: the completion ping still goes out if the tab is closed a moment later.
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
