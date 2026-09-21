import { createHash, timingSafeEqual } from 'node:crypto';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { scoreRun } from '../src/score.ts';
import { connect, deleteScore, insertScore, migrate, topScores } from './db.ts';
import { DISCORD_ENABLED, bossDefeated, playerLoaded, runFinished, runStarted } from './discord.ts';
import { EVENTS_PER_MIN, rateLimited, validate, validateEvent } from './rules.ts';
import { staticFiles } from './static.ts';

// MEGA MANAGER server: the built game plus the leaderboard API, so one Railway service hosts both.
//
//   GET    /health
//   GET    /scores?limit=10          top scores for the current season
//   POST   /scores                   { initials, stats, build } -> { entry, scores }
//   POST   /events                   { type: 'load' | 'start' | 'boss' | 'complete', ... } -> Discord ping, nothing stored
//   DELETE /scores/:id               admin only: Authorization: Bearer $ADMIN_TOKEN
//
// Env: PORT, DATABASE_URL, SEASON (bump to start a fresh board), ADMIN_TOKEN, ALLOWED_ORIGINS (comma-separated,
// for the GitHub Pages copy; same-origin play needs none), RATE_LIMIT_PER_MIN (submissions per IP, default 10),
// EVENT_RATE_LIMIT_PER_MIN (Discord pings per IP, default 20), DISCORD_WEBHOOK_URL (unset = no pings),
// STATIC_DIR (built game, default ../dist; set empty to run the API alone).

const PORT = Number(process.env.PORT ?? 8787);
const SEASON = process.env.SEASON ?? '1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'https://njgreb.github.io,http://localhost:5173,http://localhost:8787')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);
const STATIC_DIR = process.env.STATIC_DIR ?? '../dist';
const serveStatic = STATIC_DIR ? staticFiles(STATIC_DIR) : null;
const MAX_BODY_BYTES = 2048;
const BOARD_SIZE = 10;

const query = await connect();
await migrate(query);

function send(req: IncomingMessage, res: ServerResponse, status: number, body: unknown): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Railway's proxy puts the real client first in X-Forwarded-For. Only a hash is stored.
function clientKey(req: IncomingMessage): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  const ip = forwarded || req.socket.remoteAddress || 'unknown';
  return createHash('sha256').update(`${ADMIN_TOKEN}:${ip}`).digest('hex').slice(0, 16);
}

function isAdmin(req: IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers.authorization ?? ''));
  const expected = Buffer.from(`Bearer ${ADMIN_TOKEN}`);
  return ADMIN_TOKEN.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
    }
    res.writeHead(204).end();
    return;
  }

  if (method === 'GET' && url.pathname === '/health') return send(req, res, 200, { ok: true, season: SEASON });

  if (method === 'GET' && url.pathname === '/scores') {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || BOARD_SIZE));
    return send(req, res, 200, { season: SEASON, scores: await topScores(query, SEASON, limit) });
  }

  if (method === 'POST' && url.pathname === '/scores') {
    const key = clientKey(req);
    if (rateLimited(key)) return send(req, res, 429, { error: 'slow down' });
    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      return send(req, res, 400, { error: 'bad request' });
    }
    const submission = validate(body);
    if (typeof submission === 'string') return send(req, res, 422, { error: submission });
    // The server does the math; a submitted total is never trusted.
    const { total } = scoreRun(submission.stats);
    const entry = await insertScore(query, { season: SEASON, total, ipHash: key, ...submission });
    console.log(`score ${entry.initials} ${entry.total} rank ${entry.rank} (id ${entry.id})`);
    return send(req, res, 201, { entry, scores: await topScores(query, SEASON, BOARD_SIZE) });
  }

  // Discord pings. Answered before the webhook call finishes: the game never waits on Discord.
  if (method === 'POST' && url.pathname === '/events') {
    if (!DISCORD_ENABLED) return send(req, res, 202, { ok: true, discord: false });
    if (rateLimited(`event:${clientKey(req)}`, EVENTS_PER_MIN)) return send(req, res, 429, { error: 'slow down' });
    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      return send(req, res, 400, { error: 'bad request' });
    }
    const event = validateEvent(body);
    if (typeof event === 'string') return send(req, res, 422, { error: event });
    const { build, practice } = event;
    if (event.type === 'load') playerLoaded(build, practice);
    else if (event.type === 'start') runStarted(build, practice);
    else if (event.type === 'boss')
      bossDefeated({
        stats: event.stats!,
        boss: event.boss!,
        bossManager: event.bossManager,
        weapon: event.weapon,
        defeatedCount: event.defeatedCount,
        bossCount: event.bossCount,
        build,
        practice,
      });
    else
      runFinished({
        stats: event.stats!,
        managersBeaten: event.managersBeaten,
        finalBoss: event.finalBoss,
        finalBossManager: event.finalBossManager,
        build,
        practice,
      });
    return send(req, res, 202, { ok: true, discord: true });
  }

  const deleteMatch = url.pathname.match(/^\/scores\/(\d+)$/);
  if (method === 'DELETE' && deleteMatch) {
    if (!isAdmin(req)) return send(req, res, 401, { error: 'unauthorized' });
    const deleted = await deleteScore(query, Number(deleteMatch[1]));
    return send(req, res, deleted ? 200 : 404, { deleted });
  }

  if (serveStatic && (await serveStatic(req, res, url.pathname))) return;
  send(req, res, 404, { error: 'not found' });
}

createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(req, res, 500, { error: 'server error' });
  });
}).listen(PORT, () => console.log(`leaderboard listening on :${PORT} (season ${SEASON})`));
