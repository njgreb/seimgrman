import { type RunStats, formatNumber, formatTime, rankFor, scoreRun } from '../src/score.ts';

// Discord pings: someone loaded the game, started a run, put a manager down, or finished. Off unless
// DISCORD_WEBHOOK_URL is set.
// The webhook lives here, not in the game: a URL shipped in the browser bundle is public and anyone who
// views source can spam the channel with it. The game posts to /events and this relays it.

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? '';
const TIMEOUT_MS = 5000;

export const DISCORD_ENABLED = WEBHOOK.length > 0;

interface Field {
  name: string;
  value: string;
  inline?: boolean;
}

interface Embed {
  title: string;
  description?: string;
  color: number;
  fields?: Field[];
  footer?: { text: string };
  timestamp: string;
}

// Fire-and-forget: a slow or broken webhook must never hold up (or fail) a player's request.
async function post(embed: Embed): Promise<void> {
  if (!DISCORD_ENABLED) return;
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.error(`discord ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  } catch (err) {
    console.error('discord webhook failed:', err);
  }
}

// Who the ping is about: the page-load id the game generated, the address the request came from, and
// which build they're on. Every embed carries the same line so a run can be followed across pings.
export interface Who {
  session: string | null;
  ip: string;
  build: string | null;
  practice: boolean;
}

const footer = (who: Who): { text: string } => ({
  text: [
    who.practice ? 'practice run (dev shortcut, not ranked)' : null,
    `session ${who.session ?? 'unknown'}`,
    `ip ${who.ip}`,
    `build ${who.build ?? 'unknown'}`,
  ]
    .filter(Boolean)
    .join(' · '),
});

export function playerLoaded(who: Who): void {
  void post({
    title: '🎮 A player loaded MEGA MANAGER',
    description: 'Someone just opened the game.',
    color: 0x3cbcfc,
    footer: footer(who),
    timestamp: new Date().toISOString(),
  });
}

export function runStarted(who: Who): void {
  void post({
    title: '🕹️ A run has begun',
    description: 'Someone hit START and went after the managers.',
    color: 0xf8d878,
    footer: footer(who),
    timestamp: new Date().toISOString(),
  });
}

// A manager went down mid-run. The final boss is left to runFinished, which says more.
export function bossDefeated(event: {
  stats: RunStats;
  boss: string;
  bossManager: string | null;
  weapon: string | null;
  defeatedCount: number;
  bossCount: number;
  who: Who;
}): void {
  const { stats, boss, bossManager, weapon, defeatedCount, bossCount, who } = event;
  const accuracy = stats.shots ? stats.shotsLanded / stats.shots : 0;
  const left = Math.max(0, bossCount - defeatedCount);
  void post({
    title: `☠️ ${boss} IS DOWN`,
    description: bossManager ? `${bossManager} has been managed.` : undefined,
    color: 0xa4e4fc,
    fields: [
      { name: 'Managers down', value: bossCount ? `${defeatedCount} of ${bossCount}` : String(defeatedCount), inline: true },
      { name: 'Weapon earned', value: weapon ?? '—', inline: true },
      { name: 'Still standing', value: left ? String(left) : 'none — HQ is next', inline: true },
      { name: 'Run time so far', value: formatTime(stats.fightMs), inline: true },
      { name: 'Accuracy so far', value: `${Math.round(accuracy * 100)}%`, inline: true },
      { name: 'Hits taken so far', value: String(stats.hitsTaken), inline: true },
    ],
    footer: footer(who),
    timestamp: new Date().toISOString(),
  });
}

export function runFinished(event: {
  stats: RunStats;
  managersBeaten: string[];
  finalBoss: string;
  finalBossManager: string;
  who: Who;
}): void {
  const { stats, managersBeaten, finalBoss, finalBossManager, who } = event;
  // The server does the math here too; a total from the browser is never trusted.
  const score = scoreRun(stats);
  const won = stats.finalBossDefeated;
  void post({
    title: won ? `🏆 ${finalBoss} DEFEATED` : '💀 REORGED — YOUR CALENDAR IS FULL',
    description: won
      ? `A player beat ${finalBossManager} and finished the run.`
      : `A player lost to ${finalBossManager} at HQ. The run ends there — no retries.`,
    color: won ? 0x34c759 : 0xf83800,
    fields: [
      { name: 'Score', value: formatNumber(score.total), inline: true },
      { name: 'Rating', value: rankFor(score.total), inline: true },
      { name: `Beat ${finalBossManager}?`, value: won ? 'YES ✅' : 'NO ❌', inline: true },
      { name: 'Fight time', value: formatTime(stats.fightMs), inline: true },
      { name: 'Accuracy', value: `${Math.round(score.accuracy * 100)}%`, inline: true },
      { name: 'Hits taken', value: String(stats.hitsTaken), inline: true },
      { name: 'Managers beaten', value: managersBeaten.length ? managersBeaten.join(', ') : 'none' },
    ],
    footer: footer(who),
    timestamp: new Date().toISOString(),
  });
}
