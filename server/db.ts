import type { RunStats } from '../src/score.ts';

// Postgres on Railway (DATABASE_URL). Without it, local dev gets an in-memory PGlite database.

type Row = Record<string, unknown>;
export type Query = (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;

export interface Entry {
  id: number;
  rank: number;
  initials: string;
  total: number;
  fightMs: number;
  accuracy: number; // 0..1
  hitsTaken: number;
  finalBossDefeated: boolean;
  createdAt: string;
}

export async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    return (sql, params) => pool.query(sql, params);
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production');
  console.warn('No DATABASE_URL: using an in-memory PGlite database (scores vanish on restart)');
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  return (sql, params) => db.query<Row>(sql, params);
}

export async function migrate(query: Query): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      id BIGSERIAL PRIMARY KEY,
      season TEXT NOT NULL,
      initials CHAR(3) NOT NULL,
      total INTEGER NOT NULL,
      fight_ms INTEGER NOT NULL,
      shots INTEGER NOT NULL,
      shots_landed INTEGER NOT NULL,
      hits_taken INTEGER NOT NULL,
      build TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await query('ALTER TABLE scores ADD COLUMN IF NOT EXISTS final_boss_defeated BOOLEAN NOT NULL DEFAULT false');
  await query('CREATE INDEX IF NOT EXISTS scores_board ON scores (season, total DESC, created_at, id)');
}

const toEntry = (row: Row, rank: number): Entry => {
  const shots = Number(row.shots);
  return {
    id: Number(row.id),
    rank,
    initials: String(row.initials),
    total: Number(row.total),
    fightMs: Number(row.fight_ms),
    accuracy: shots ? Number(row.shots_landed) / shots : 0,
    hitsTaken: Number(row.hits_taken),
    finalBossDefeated: row.final_boss_defeated === true,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
};

// Ties go to whoever got there first.
export async function topScores(query: Query, season: string, limit: number): Promise<Entry[]> {
  const { rows } = await query(
    `SELECT * FROM scores WHERE season = $1 ORDER BY total DESC, created_at ASC, id ASC LIMIT $2`,
    [season, limit],
  );
  return rows.map((row, i) => toEntry(row, i + 1));
}

export async function insertScore(
  query: Query,
  score: { season: string; initials: string; total: number; stats: RunStats; build: string | null; ipHash: string },
): Promise<Entry> {
  const { season, initials, total, stats, build, ipHash } = score;
  const { rows } = await query(
    `INSERT INTO scores (season, initials, total, fight_ms, shots, shots_landed, hits_taken, final_boss_defeated, build, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [season, initials, total, Math.round(stats.fightMs), stats.shots, stats.shotsLanded, stats.hitsTaken, stats.finalBossDefeated, build, ipHash],
  );
  const row = rows[0];
  const ahead = await query(
    `SELECT count(*)::int AS n FROM scores
     WHERE season = $1 AND (total > $2 OR (total = $2 AND (created_at, id) < ($3, $4)))`,
    [season, total, row.created_at, row.id],
  );
  return toEntry(row, Number(ahead.rows[0].n) + 1);
}

export async function deleteScore(query: Query, id: number): Promise<boolean> {
  const { rows } = await query('DELETE FROM scores WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}
