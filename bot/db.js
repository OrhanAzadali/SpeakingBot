// db.js — PostgreSQL version (replaces lowdb)
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

// ── Initialize tables ─────────────────────────────────────────────────────────

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      language TEXT,
      level TEXT,
      state TEXT DEFAULT 'idle'
    );

    -- Subscription / usage-tracking fields (safe to re-run: no-ops if already present)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      role TEXT,
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id SERIAL PRIMARY KEY,
      user_id BIGINT,
      word TEXT,
      correction TEXT,
      context TEXT,
      next_review TIMESTAMPTZ DEFAULT NOW(),
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id BIGINT PRIMARY KEY,
      roadmap TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✅ Database tables ready");
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUser(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function upsertUser(userId, fields = {}) {
  const { language, level, state } = fields;
  await pool.query(`
    INSERT INTO users (user_id, language, level, state)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      language = COALESCE($2, users.language),
      level = COALESCE($3, users.level),
      state = COALESCE($4, users.state)
  `, [userId, language ?? null, level ?? null, state ?? null]);
}

// ── Subscriptions / usage limits ───────────────────────────────────────────────

export async function isPremiumActive(userId) {
  const { rows } = await pool.query(
    "SELECT premium_until FROM users WHERE user_id = $1",
    [userId]
  );
  const until = rows[0]?.premium_until;
  return !!until && new Date(until) > new Date();
}

// Extends (or starts) a user's premium window by `days` from whichever is
// later: now, or their current expiry (so early renewals stack instead of
// wasting remaining time).
export async function grantPremium(userId, days) {
  await pool.query(
    `UPDATE users
     SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
         status = 'premium'
     WHERE user_id = $1`,
    [userId, days]
  );
}

// Checks a free-tier user's daily message quota, resetting the counter if the
// day has rolled over, then increments it. Premium users always pass. Returns
// { allowed, premium, count?, limit? } — count/limit are omitted for premium
// users since they don't apply.
export async function checkAndIncrementUsage(userId, freeLimit) {
  if (await isPremiumActive(userId)) {
    return { allowed: true, premium: true };
  }

  const { rows } = await pool.query(
    "SELECT daily_message_count, daily_reset_date FROM users WHERE user_id = $1",
    [userId]
  );
  const row = rows[0];
  const today = new Date().toISOString().slice(0, 10);
  const resetDate = row?.daily_reset_date
    ? new Date(row.daily_reset_date).toISOString().slice(0, 10)
    : null;

  let count = resetDate === today ? (row?.daily_message_count ?? 0) : 0;

  if (count >= freeLimit) {
    // Persist the (possibly just-reset) count/date even when blocking, so a
    // stale reset date from a previous day doesn't linger indefinitely.
    await pool.query(
      "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
      [userId, count, today]
    );
    return { allowed: false, premium: false, count, limit: freeLimit };
  }

  count += 1;
  await pool.query(
    "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
    [userId, count, today]
  );
  return { allowed: true, premium: false, count, limit: freeLimit };
}

// ── History ───────────────────────────────────────────────────────────────────

export async function addHistory(userId, role, content) {
  await pool.query(
    "INSERT INTO history (user_id, role, content) VALUES ($1, $2, $3)",
    [userId, role, content]
  );
}

export async function getHistory(userId, limit = 10) {
  const { rows } = await pool.query(
    "SELECT role, content FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return rows.reverse();
}

export async function clearHistory(userId) {
  await pool.query("DELETE FROM history WHERE user_id = $1", [userId]);
}

// Total user (not assistant) messages ever sent — used to trigger the
// roadmap update every 5th message. Deliberately not tied to the free-tier
// daily counter, which resets each day; this should keep counting forever.
export async function countUserMessages(userId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM history WHERE user_id = $1 AND role = 'user'",
    [userId]
  );
  return rows[0]?.count ?? 0;
}

// ── Learning roadmap ─────────────────────────────────────────────────────────

export async function saveRoadmap(userId, roadmapText) {
  await pool.query(`
    INSERT INTO user_progress (user_id, roadmap, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET roadmap = $2, updated_at = NOW()
  `, [userId, roadmapText]);
}

export async function getRoadmap(userId) {
  const { rows } = await pool.query(
    "SELECT roadmap, updated_at FROM user_progress WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? null;
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export async function addFlashcard(userId, word, correction, context) {
  await pool.query(`
    INSERT INTO flashcards (user_id, word, correction, context)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `, [userId, word, correction, context]);
}

export async function getFlashcards(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM flashcards WHERE user_id = $1",
    [userId]
  );
  return rows;
}

export async function getDueFlashcards(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM flashcards WHERE user_id = $1 AND next_review <= NOW() LIMIT 20",
    [userId]
  );
  return rows;
}

// Requires userId so a caller can't update a flashcard belonging to someone
// else just by guessing/incrementing IDs. Returns true on success, false if
// the card doesn't exist or doesn't belong to that user.
export async function updateFlashcard(id, remembered, userId) {
  const { rows } = await pool.query(
    "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  const card = rows[0];
  if (!card) return false;

  let { ease_factor, interval } = card;
  if (remembered) {
    interval = Math.round(interval * ease_factor);
    ease_factor = Math.min(ease_factor + 0.1, 3.0);
  } else {
    interval = 1;
    ease_factor = Math.max(ease_factor - 0.2, 1.3);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  await pool.query(
    "UPDATE flashcards SET ease_factor = $1, interval = $2, next_review = $3 WHERE id = $4",
    [ease_factor, interval, nextReview.toISOString(), id]
  );
  return true;
}

export default pool;