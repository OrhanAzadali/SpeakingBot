// db.js — PostgreSQL version (replaces lowdb)
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

// ── Initialize tables & schema migrations ─────────────────────────────────────

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      language TEXT,
      level TEXT,
      state TEXT DEFAULT 'idle'
    );

    -- Subscription / usage-tracking fields
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
    -- Mediator language used for explanations for Beginner/Intermediate learners (e.g. 'english', 'russian', 'spanish')
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mediator_language TEXT DEFAULT 'english';

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

    -- Extended linguistic columns for grammar, syntax, orthography, semantics, and phonetics
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS language TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS initial_form TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS used_form TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS synonyms TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS sentence TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS transcription TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS pronunciation_rule TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS grammar_rule TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS orthography_rule TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS syntax_rule TEXT;
    ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS semantics_note TEXT;

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id BIGINT PRIMARY KEY,
      roadmap TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Permanent record of mastered words (3-in-a-row correct in Quiz mode).
    -- Kept separately from flashcards, which only holds words still being
    -- actively practiced — a mastered word is removed from flashcards but
    -- preserved here instead of being deleted outright.
    CREATE TABLE IF NOT EXISTS learned_words (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      language TEXT,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      learned_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS initial_form TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS used_form TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS synonyms TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS sentence TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS transcription TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS pronunciation_rule TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS grammar_rule TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS orthography_rule TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS syntax_rule TEXT;
    ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS semantics_note TEXT;

    -- Diagnostic Level Tests history table.
    -- Stores CEFR evaluation breakdown and examiner notes.
    -- Retains up to 150 tests per user; when it hits 151, the oldest 10 are deleted.
    CREATE TABLE IF NOT EXISTS level_tests (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      language TEXT NOT NULL,
      detected_level TEXT NOT NULL,
      score INT NOT NULL,
      breakdown JSONB NOT NULL,
      recommendations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- State table for in-progress active diagnostic placement tests
    CREATE TABLE IF NOT EXISTS active_tests (
      user_id BIGINT PRIMARY KEY,
      language TEXT NOT NULL,
      mediator_language TEXT NOT NULL,
      questions JSONB NOT NULL,
      current_index INT DEFAULT 0,
      answers JSONB DEFAULT '[]'::JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Dedicated Skills Tracking: Stores proficiency, mastery score, and drills for each of the 4 sections
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id BIGINT NOT NULL,
      language TEXT NOT NULL,
      skill TEXT NOT NULL, -- 'listening', 'speaking', 'reading', 'writing'
      score INT DEFAULT 0, -- aggregate proficiency 0-100
      drills_completed INT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, language, skill)
    );

    -- Historical drill session results
    CREATE TABLE IF NOT EXISTS skill_progress (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      language TEXT NOT NULL,
      skill TEXT NOT NULL,
      drill_type TEXT NOT NULL, -- 'short' (up to 20) or 'huge' (up to 10)
      total_questions INT NOT NULL,
      score INT NOT NULL,
      feedback TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Active in-progress skill training drill session
    CREATE TABLE IF NOT EXISTS active_drills (
      user_id BIGINT PRIMARY KEY,
      language TEXT NOT NULL,
      mediator_language TEXT NOT NULL,
      skill TEXT NOT NULL,
      drill_type TEXT NOT NULL,
      questions JSONB NOT NULL,
      current_index INT DEFAULT 0,
      answers JSONB DEFAULT '[]'::JSONB,
      scores JSONB DEFAULT '[]'::JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✅ Database tables & rich linguistic schemas ready");
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
  const { language, level, state, mediator_language } = fields;
  await pool.query(`
    INSERT INTO users (user_id, language, level, state, mediator_language)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id) DO UPDATE SET
      language = COALESCE($2, users.language),
      level = COALESCE($3, users.level),
      state = COALESCE($4, users.state),
      mediator_language = COALESCE($5, users.mediator_language)
  `, [userId, language ?? null, level ?? null, state ?? null, mediator_language ?? null]);
}

// ── 4-Skill Progress & Active Drills Management ───────────────────────────────

export async function saveActiveDrill(userId, language, mediatorLanguage, skill, drillType, questions) {
  await pool.query(`
    INSERT INTO active_drills (user_id, language, mediator_language, skill, drill_type, questions, current_index, answers, scores)
    VALUES ($1, $2, $3, $4, $5, $6, 0, '[]'::JSONB, '[]'::JSONB)
    ON CONFLICT (user_id) DO UPDATE SET
      language = $2,
      mediator_language = $3,
      skill = $4,
      drill_type = $5,
      questions = $6,
      current_index = 0,
      answers = '[]'::JSONB,
      scores = '[]'::JSONB,
      created_at = NOW()
  `, [userId, language, mediatorLanguage, skill, drillType, JSON.stringify(questions)]);
}

export async function getActiveDrill(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM active_drills WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function recordDrillAnswer(userId, answerText, score) {
  const drill = await getActiveDrill(userId);
  if (!drill) return null;

  const currentAnswers = Array.isArray(drill.answers) ? drill.answers : [];
  const currentScores = Array.isArray(drill.scores) ? drill.scores : [];
  currentAnswers.push(answerText);
  currentScores.push(score);

  const nextIndex = drill.current_index + 1;

  await pool.query(`
    UPDATE active_drills
    SET current_index = $1, answers = $2, scores = $3
    WHERE user_id = $4
  `, [nextIndex, JSON.stringify(currentAnswers), JSON.stringify(currentScores), userId]);

  return {
    ...drill,
    current_index: nextIndex,
    answers: currentAnswers,
    scores: currentScores,
  };
}

export async function clearActiveDrill(userId) {
  await pool.query("DELETE FROM active_drills WHERE user_id = $1", [userId]);
}

export async function completeDrillSession(userId, language, skill, drillType, totalQuestions, finalScore, feedback) {
  await pool.query(`
    INSERT INTO skill_progress (user_id, language, skill, drill_type, total_questions, score, feedback)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [userId, language, skill, drillType, totalQuestions, finalScore, feedback]);

  await pool.query(`
    INSERT INTO user_skills (user_id, language, skill, score, drills_completed, updated_at)
    VALUES ($1, $2, $3, $4, 1, NOW())
    ON CONFLICT (user_id, language, skill) DO UPDATE SET
      score = ROUND((user_skills.score * user_skills.drills_completed + $4) / (user_skills.drills_completed + 1)),
      drills_completed = user_skills.drills_completed + 1,
      updated_at = NOW()
  `, [userId, language, skill, finalScore]);
}

export async function getUserSkillsOverview(userId, language) {
  const skills = ['listening', 'speaking', 'reading', 'writing'];
  const { rows } = await pool.query(
    "SELECT skill, score, drills_completed FROM user_skills WHERE user_id = $1 AND language = $2",
    [userId, language]
  );

  const profile = {};
  skills.forEach(s => {
    const record = rows.find(r => r.skill === s);
    profile[s] = {
      score: record ? record.score : 0,
      drills_completed: record ? record.drills_completed : 0
    };
  });

  return profile;
}

// ── Diagnostic Level Tests (CEFR Evaluation & Auto-Purge at 151) ──────────────

export async function saveTestResult(userId, language, testData) {
  const { detected_level, score, breakdown, recommendations } = testData;

  await pool.query(
    `INSERT INTO level_tests (user_id, language, detected_level, score, breakdown, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, language, detected_level, score, JSON.stringify(breakdown), recommendations]
  );

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM level_tests WHERE user_id = $1",
    [userId]
  );
  const count = rows[0]?.count ?? 0;

  if (count > 150) {
    await pool.query(`
      DELETE FROM level_tests
      WHERE id IN (
        SELECT id FROM level_tests
        WHERE user_id = $1
        ORDER BY created_at ASC
        LIMIT 10
      )
    `, [userId]);
  }

  await pool.query(
    "UPDATE users SET level = $1, state = 'chatting' WHERE user_id = $2",
    [detected_level, userId]
  );
}

export async function getUserTestHistory(userId, language, limit = 5) {
  const { rows } = await pool.query(
    `SELECT * FROM level_tests
     WHERE user_id = $1 AND language = $2
     ORDER BY created_at DESC LIMIT $3`,
    [userId, language, limit]
  );
  return rows;
}

// ── Active Test Session ───────────────────────────────────────────────────────

export async function saveActiveTest(userId, language, mediatorLanguage, questions) {
  await pool.query(`
    INSERT INTO active_tests (user_id, language, mediator_language, questions, current_index, answers)
    VALUES ($1, $2, $3, $4, 0, '[]'::JSONB)
    ON CONFLICT (user_id) DO UPDATE SET
      language = $2,
      mediator_language = $3,
      questions = $4,
      current_index = 0,
      answers = '[]'::JSONB,
      created_at = NOW()
  `, [userId, language, mediatorLanguage, JSON.stringify(questions)]);
}

export async function getActiveTest(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM active_tests WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? null;
}

export async function recordActiveTestAnswer(userId, answerText) {
  const test = await getActiveTest(userId);
  if (!test) return null;

  const currentAnswers = Array.isArray(test.answers) ? test.answers : [];
  currentAnswers.push(answerText);
  const nextIndex = test.current_index + 1;

  await pool.query(`
    UPDATE active_tests
    SET current_index = $1, answers = $2
    WHERE user_id = $3
  `, [nextIndex, JSON.stringify(currentAnswers), userId]);

  return {
    ...test,
    current_index: nextIndex,
    answers: currentAnswers,
  };
}

export async function clearActiveTest(userId) {
  await pool.query("DELETE FROM active_tests WHERE user_id = $1", [userId]);
}

// ── Subscriptions & Usage Limits ─────────────────────────────────────────────

export async function isPremiumActive(userId) {
  const { rows } = await pool.query(
    "SELECT premium_until FROM users WHERE user_id = $1",
    [userId]
  );
  const until = rows[0]?.premium_until;
  return !!until && new Date(until) > new Date();
}

export async function grantPremium(userId, days) {
  await pool.query(
    `UPDATE users
     SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
         status = 'premium'
     WHERE user_id = $1`,
    [userId, days]
  );
}

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

export async function countUserMessages(userId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM history WHERE user_id = $1 AND role = 'user'",
    [userId]
  );
  return rows[0]?.count ?? 0;
}

// ── Learning Roadmap ─────────────────────────────────────────────────────────

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

// ── Flashcards (Rich Linguistics: Grammar, Orthography, Syntax, Semantics) ───

export async function addFlashcard(userId, cardData) {
  let word, correction, context, language, initial_form, used_form, part_of_speech,
    synonyms, explanation, sentence, transcription, pronunciation_rule,
    grammar_rule, orthography_rule, syntax_rule, semantics_note;

  if (typeof cardData === "object" && cardData !== null && !Array.isArray(cardData)) {
    ({
      word,
      correction,
      context = "",
      language = null,
      initial_form = null,
      used_form = null,
      part_of_speech = null,
      synonyms = null,
      explanation = null,
      sentence = null,
      transcription = null,
      pronunciation_rule = null,
      grammar_rule = null,
      orthography_rule = null,
      syntax_rule = null,
      semantics_note = null,
    } = cardData);
  } else {
    word = arguments[1];
    correction = arguments[2];
    context = arguments[3] ?? "";
    language = arguments[4] ?? null;
  }

  const baseForm = initial_form || word;

  const normWord = String(baseForm || "").toLowerCase().trim();
  const normCorr = String(correction || "").toLowerCase().trim();
  if (!normWord || !normCorr || normWord === normCorr) return;
  if (normWord.length <= 1 || normWord === 'не' || normWord === 'о' || normWord === 'а' || normWord === 'в') return;

  await pool.query(`
    INSERT INTO flashcards (
      user_id, word, correction, context, language,
      initial_form, used_form, part_of_speech, synonyms, explanation, sentence,
      transcription, pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, [
    userId,
    baseForm,
    correction,
    context,
    language,
    baseForm,
    used_form || word,
    part_of_speech,
    synonyms,
    explanation,
    sentence,
    transcription,
    pronunciation_rule,
    grammar_rule,
    orthography_rule,
    syntax_rule,
    semantics_note
  ]);
}

export async function getFlashcardsByLanguage(userId, language) {
  const { rows } = await pool.query(`
    SELECT
      id, user_id,
      COALESCE(NULLIF(initial_form, ''), word) AS word,
      correction, context, language,
      COALESCE(NULLIF(initial_form, ''), word) AS initial_form,
      used_form, part_of_speech, synonyms, explanation, sentence,
      transcription, pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note,
      next_review, ease_factor, interval, correct_streak
    FROM flashcards
    WHERE user_id = $1 AND language = $2
    ORDER BY id DESC
  `, [userId, language]);
  return rows;
}

export async function getFlashcardById(id, userId) {
  const { rows } = await pool.query(`
    SELECT
      id, user_id,
      COALESCE(NULLIF(initial_form, ''), word) AS word,
      correction, context, language,
      COALESCE(NULLIF(initial_form, ''), word) AS initial_form,
      used_form, part_of_speech, synonyms, explanation, sentence,
      transcription, pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note,
      next_review, ease_factor, interval, correct_streak
    FROM flashcards
    WHERE id = $1 AND user_id = $2
  `, [id, userId]);
  return rows[0] ?? null;
}

export async function getDueFlashcards(userId) {
  const { rows } = await pool.query(`
    SELECT
      id, user_id,
      COALESCE(NULLIF(initial_form, ''), word) AS word,
      correction, context, language,
      COALESCE(NULLIF(initial_form, ''), word) AS initial_form,
      used_form, part_of_speech, synonyms, explanation, sentence,
      transcription, pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note,
      next_review, ease_factor, interval, correct_streak
    FROM flashcards
    WHERE user_id = $1 AND next_review <= NOW()
    ORDER BY id DESC LIMIT 20
  `, [userId]);
  return rows;
}

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

// ── Quiz & Learned Words ──────────────────────────────────────────────────────

export async function recordQuizResult(id, userId, correct) {
  const { rows } = await pool.query(
    "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  const card = rows[0];
  if (!card) return null;

  if (!correct) {
    await pool.query("UPDATE flashcards SET correct_streak = 0 WHERE id = $1", [id]);
    return { mastered: false, streak: 0 };
  }

  const streak = (card.correct_streak ?? 0) + 1;
  if (streak >= 3) {
    await pool.query(
      `INSERT INTO learned_words (
        user_id, language, word, meaning, initial_form, used_form,
        part_of_speech, synonyms, explanation, sentence, transcription,
        pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        userId,
        card.language,
        card.initial_form || card.word,
        card.correction,
        card.initial_form || card.word,
        card.used_form || card.word,
        card.part_of_speech,
        card.synonyms,
        card.explanation,
        card.sentence,
        card.transcription,
        card.pronunciation_rule,
        card.grammar_rule,
        card.orthography_rule,
        card.syntax_rule,
        card.semantics_note
      ]
    );
    await pool.query("DELETE FROM flashcards WHERE id = $1", [id]);
    return { mastered: true, streak };
  }

  await pool.query("UPDATE flashcards SET correct_streak = $2 WHERE id = $1", [id, streak]);
  return { mastered: false, streak };
}

export async function getLearnedWords(userId, language) {
  const { rows } = await pool.query(
    "SELECT word, meaning, learned_at FROM learned_words WHERE user_id = $1 AND language = $2 ORDER BY learned_at DESC",
    [userId, language]
  );
  return rows;
}

export async function getAllUserVocabulary(userId, language = null) {
  const params = [userId];
  let langFilter = "";

  if (language) {
    params.push(language);
    langFilter = "AND language = $2";
  }

  const flashcardsQuery = pool.query(
    `SELECT *, COALESCE(NULLIF(initial_form, ''), word) AS display_word, 'Active Flashcard' AS status
     FROM flashcards WHERE user_id = $1 ${langFilter} ORDER BY id DESC`,
    params
  );
  const learnedQuery = pool.query(
    `SELECT *, COALESCE(NULLIF(initial_form, ''), word) AS display_word, 'Mastered' AS status, meaning AS correction
     FROM learned_words WHERE user_id = $1 ${langFilter} ORDER BY learned_at DESC`,
    params
  );

  const [activeRes, learnedRes] = await Promise.all([flashcardsQuery, learnedQuery]);
  return {
    active: activeRes.rows,
    mastered: learnedRes.rows,
    total: activeRes.rows.length + learnedRes.rows.length,
  };
}

export default pool;

// // db.js — PostgreSQL version (replaces lowdb)
// import pg from "pg";

// const { Pool } = pg;

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }, // required for Supabase
// });

// // ── Initialize tables ─────────────────────────────────────────────────────────

// export async function initDB() {
//   await pool.query(`
//     CREATE TABLE IF NOT EXISTS users (
//       user_id BIGINT PRIMARY KEY,
//       language TEXT,
//       level TEXT,
//       state TEXT DEFAULT 'idle'
//     );

//     -- Subscription / usage-tracking fields (safe to re-run: no-ops if already present)
//     ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
//     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;
//     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;
//     ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

//     CREATE TABLE IF NOT EXISTS history (
//       id SERIAL PRIMARY KEY,
//       user_id BIGINT,
//       role TEXT,
//       content TEXT,
//       created_at TIMESTAMPTZ DEFAULT NOW()
//     );

//     CREATE TABLE IF NOT EXISTS flashcards (
//       id SERIAL PRIMARY KEY,
//       user_id BIGINT,
//       word TEXT,
//       correction TEXT,
//       context TEXT,
//       next_review TIMESTAMPTZ DEFAULT NOW(),
//       ease_factor REAL DEFAULT 2.5,
//       interval INTEGER DEFAULT 1
//     );

//     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS language TEXT;
//     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0;

//     CREATE TABLE IF NOT EXISTS user_progress (
//       user_id BIGINT PRIMARY KEY,
//       roadmap TEXT,
//       updated_at TIMESTAMPTZ DEFAULT NOW()
//     );

//     -- Permanent record of mastered words (3-in-a-row correct in Quiz mode).
//     -- Kept separately from flashcards, which only holds words still being
//     -- actively practiced — a mastered word is removed from flashcards but
//     -- preserved here instead of being deleted outright.
//     CREATE TABLE IF NOT EXISTS learned_words (
//       id SERIAL PRIMARY KEY,
//       user_id BIGINT NOT NULL,
//       language TEXT,
//       word TEXT NOT NULL,
//       meaning TEXT NOT NULL,
//       learned_at TIMESTAMPTZ DEFAULT NOW()
//     );
//   `);
//   console.log("✅ Database tables ready");
// }

// // ── Users ─────────────────────────────────────────────────────────────────────

// export async function getUser(userId) {
//   const { rows } = await pool.query(
//     "SELECT * FROM users WHERE user_id = $1",
//     [userId]
//   );
//   return rows[0] ?? null;
// }

// export async function upsertUser(userId, fields = {}) {
//   const { language, level, state } = fields;
//   await pool.query(`
//     INSERT INTO users (user_id, language, level, state)
//     VALUES ($1, $2, $3, $4)
//     ON CONFLICT (user_id) DO UPDATE SET
//       language = COALESCE($2, users.language),
//       level = COALESCE($3, users.level),
//       state = COALESCE($4, users.state)
//   `, [userId, language ?? null, level ?? null, state ?? null]);
// }

// // ── Subscriptions / usage limits ───────────────────────────────────────────────

// export async function isPremiumActive(userId) {
//   const { rows } = await pool.query(
//     "SELECT premium_until FROM users WHERE user_id = $1",
//     [userId]
//   );
//   const until = rows[0]?.premium_until;
//   return !!until && new Date(until) > new Date();
// }

// // Extends (or starts) a user's premium window by `days` from whichever is
// // later: now, or their current expiry (so early renewals stack instead of
// // wasting remaining time).
// export async function grantPremium(userId, days) {
//   await pool.query(
//     `UPDATE users
//      SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
//          status = 'premium'
//      WHERE user_id = $1`,
//     [userId, days]
//   );
// }

// // Checks a free-tier user's daily message quota, resetting the counter if the
// // day has rolled over, then increments it. Premium users always pass. Returns
// // { allowed, premium, count?, limit? } — count/limit are omitted for premium
// // users since they don't apply.
// export async function checkAndIncrementUsage(userId, freeLimit) {
//   if (await isPremiumActive(userId)) {
//     return { allowed: true, premium: true };
//   }

//   const { rows } = await pool.query(
//     "SELECT daily_message_count, daily_reset_date FROM users WHERE user_id = $1",
//     [userId]
//   );
//   const row = rows[0];
//   const today = new Date().toISOString().slice(0, 10);
//   const resetDate = row?.daily_reset_date
//     ? new Date(row.daily_reset_date).toISOString().slice(0, 10)
//     : null;

//   let count = resetDate === today ? (row?.daily_message_count ?? 0) : 0;

//   if (count >= freeLimit) {
//     // Persist the (possibly just-reset) count/date even when blocking, so a
//     // stale reset date from a previous day doesn't linger indefinitely.
//     await pool.query(
//       "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
//       [userId, count, today]
//     );
//     return { allowed: false, premium: false, count, limit: freeLimit };
//   }

//   count += 1;
//   await pool.query(
//     "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
//     [userId, count, today]
//   );
//   return { allowed: true, premium: false, count, limit: freeLimit };
// }

// // ── History ───────────────────────────────────────────────────────────────────

// export async function addHistory(userId, role, content) {
//   await pool.query(
//     "INSERT INTO history (user_id, role, content) VALUES ($1, $2, $3)",
//     [userId, role, content]
//   );
// }

// export async function getHistory(userId, limit = 10) {
//   const { rows } = await pool.query(
//     "SELECT role, content FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
//     [userId, limit]
//   );
//   return rows.reverse();
// }

// export async function clearHistory(userId) {
//   await pool.query("DELETE FROM history WHERE user_id = $1", [userId]);
// }

// // Total user (not assistant) messages ever sent — used to trigger the
// // roadmap update every 5th message. Deliberately not tied to the free-tier
// // daily counter, which resets each day; this should keep counting forever.
// export async function countUserMessages(userId) {
//   const { rows } = await pool.query(
//     "SELECT COUNT(*)::int AS count FROM history WHERE user_id = $1 AND role = 'user'",
//     [userId]
//   );
//   return rows[0]?.count ?? 0;
// }

// // ── Learning roadmap ─────────────────────────────────────────────────────────

// export async function saveRoadmap(userId, roadmapText) {
//   await pool.query(`
//     INSERT INTO user_progress (user_id, roadmap, updated_at)
//     VALUES ($1, $2, NOW())
//     ON CONFLICT (user_id) DO UPDATE SET roadmap = $2, updated_at = NOW()
//   `, [userId, roadmapText]);
// }

// export async function getRoadmap(userId) {
//   const { rows } = await pool.query(
//     "SELECT roadmap, updated_at FROM user_progress WHERE user_id = $1",
//     [userId]
//   );
//   return rows[0] ?? null;
// }

// // ── Flashcards ────────────────────────────────────────────────────────────────

// export async function addFlashcard(userId, word, correction, context, language) {
//   await pool.query(`
//     INSERT INTO flashcards (user_id, word, correction, context, language)
//     VALUES ($1, $2, $3, $4, $5)
//     ON CONFLICT DO NOTHING
//   `, [userId, word, correction, context, language]);
// }

// // Strict match only. Cards with language = NULL (saved before the addFlashcard
// // language-argument bug was fixed) are deliberately excluded here rather than
// // shown under every language — that fallback is what caused Spanish, French,
// // etc. cards to all mix together in one deck. Run the one-time backfill in
// // cleanup_bad_flashcards.sql to tag those old rows with the right language
// // instead of relying on this query to paper over it.
// //
// // Ordered newest-first (DESC) so a freshly-added mistake word appears at the
// // top of the deck the next time the Mini App fetches this list, instead of
// // being buried at the end behind every older card.
// export async function getFlashcardsByLanguage(userId, language) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE user_id = $1 AND language = $2 ORDER BY id DESC",
//     [userId, language]
//   );
//   return rows;
// }

// export async function getFlashcards(userId) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE user_id = $1",
//     [userId]
//   );
//   return rows;
// }

// export async function getFlashcardById(id, userId) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
//     [id, userId]
//   );
//   return rows[0] ?? null;
// }

// export async function getDueFlashcards(userId) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE user_id = $1 AND next_review <= NOW() LIMIT 20",
//     [userId]
//   );
//   return rows;
// }

// // Requires userId so a caller can't update a flashcard belonging to someone
// // else just by guessing/incrementing IDs. Returns true on success, false if
// // the card doesn't exist or doesn't belong to that user.
// export async function updateFlashcard(id, remembered, userId) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
//     [id, userId]
//   );
//   const card = rows[0];
//   if (!card) return false;

//   let { ease_factor, interval } = card;
//   if (remembered) {
//     interval = Math.round(interval * ease_factor);
//     ease_factor = Math.min(ease_factor + 0.1, 3.0);
//   } else {
//     interval = 1;
//     ease_factor = Math.max(ease_factor - 0.2, 1.3);
//   }

//   const nextReview = new Date();
//   nextReview.setDate(nextReview.getDate() + interval);

//   await pool.query(
//     "UPDATE flashcards SET ease_factor = $1, interval = $2, next_review = $3 WHERE id = $4",
//     [ease_factor, interval, nextReview.toISOString(), id]
//   );
//   return true;
// }

// export default pool;

// // ── Quiz mode ─────────────────────────────────────────────────────────────────
// // Tracks a separate correct-in-a-row streak per card, independent of the
// // spaced-repetition fields the Flashcards mode uses. Three correct answers in
// // a row means the word is considered mastered: it's moved out of flashcards
// // (so it stops appearing in Quiz/Flashcards practice) and into learned_words
// // as a permanent record, rather than being deleted outright.
// export async function recordQuizResult(id, userId, correct) {
//   const { rows } = await pool.query(
//     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
//     [id, userId]
//   );
//   const card = rows[0];
//   if (!card) return null;

//   if (!correct) {
//     await pool.query("UPDATE flashcards SET correct_streak = 0 WHERE id = $1", [id]);
//     return { mastered: false, streak: 0 };
//   }

//   const streak = (card.correct_streak ?? 0) + 1;
//   if (streak >= 3) {
//     await pool.query(
//       "INSERT INTO learned_words (user_id, language, word, meaning) VALUES ($1, $2, $3, $4)",
//       [userId, card.language, card.word, card.correction]
//     );
//     await pool.query("DELETE FROM flashcards WHERE id = $1", [id]);
//     return { mastered: true, streak };
//   }

//   await pool.query("UPDATE flashcards SET correct_streak = $2 WHERE id = $1", [id, streak]);
//   return { mastered: false, streak };
// }

// export async function getLearnedWords(userId, language) {
//   const { rows } = await pool.query(
//     "SELECT word, meaning, learned_at FROM learned_words WHERE user_id = $1 AND language = $2 ORDER BY learned_at DESC",
//     [userId, language]
//   );
//   return rows;
// }


// // PREVIOUS VERSION - 1
// // // db.js — PostgreSQL version (replaces lowdb)
// // import pg from "pg";

// // const { Pool } = pg;

// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl: { rejectUnauthorized: false }, // required for Supabase
// // });

// // // ── Initialize tables ─────────────────────────────────────────────────────────

// // export async function initDB() {
// //   await pool.query(`
// //     CREATE TABLE IF NOT EXISTS users (
// //       user_id BIGINT PRIMARY KEY,
// //       language TEXT,
// //       level TEXT,
// //       state TEXT DEFAULT 'idle'
// //     );

// //     -- Subscription / usage-tracking fields (safe to re-run: no-ops if already present)
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

// //     CREATE TABLE IF NOT EXISTS history (
// //       id SERIAL PRIMARY KEY,
// //       user_id BIGINT,
// //       role TEXT,
// //       content TEXT,
// //       created_at TIMESTAMPTZ DEFAULT NOW()
// //     );

// //     CREATE TABLE IF NOT EXISTS flashcards (
// //       id SERIAL PRIMARY KEY,
// //       user_id BIGINT,
// //       word TEXT,
// //       correction TEXT,
// //       context TEXT,
// //       next_review TIMESTAMPTZ DEFAULT NOW(),
// //       ease_factor REAL DEFAULT 2.5,
// //       interval INTEGER DEFAULT 1
// //     );

// //     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS language TEXT;
// //     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0;

// //     CREATE TABLE IF NOT EXISTS user_progress (
// //       user_id BIGINT PRIMARY KEY,
// //       roadmap TEXT,
// //       updated_at TIMESTAMPTZ DEFAULT NOW()
// //     );
// //   `);
// //   console.log("✅ Database tables ready");
// // }

// // // ── Users ─────────────────────────────────────────────────────────────────────

// // export async function getUser(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // export async function upsertUser(userId, fields = {}) {
// //   const { language, level, state } = fields;
// //   await pool.query(`
// //     INSERT INTO users (user_id, language, level, state)
// //     VALUES ($1, $2, $3, $4)
// //     ON CONFLICT (user_id) DO UPDATE SET
// //       language = COALESCE($2, users.language),
// //       level = COALESCE($3, users.level),
// //       state = COALESCE($4, users.state)
// //   `, [userId, language ?? null, level ?? null, state ?? null]);
// // }

// // // ── Subscriptions / usage limits ───────────────────────────────────────────────

// // export async function isPremiumActive(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT premium_until FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   const until = rows[0]?.premium_until;
// //   return !!until && new Date(until) > new Date();
// // }

// // // Extends (or starts) a user's premium window by `days` from whichever is
// // // later: now, or their current expiry (so early renewals stack instead of
// // // wasting remaining time).
// // export async function grantPremium(userId, days) {
// //   await pool.query(
// //     `UPDATE users
// //      SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
// //          status = 'premium'
// //      WHERE user_id = $1`,
// //     [userId, days]
// //   );
// // }

// // // Checks a free-tier user's daily message quota, resetting the counter if the
// // // day has rolled over, then increments it. Premium users always pass. Returns
// // // { allowed, premium, count?, limit? } — count/limit are omitted for premium
// // // users since they don't apply.
// // export async function checkAndIncrementUsage(userId, freeLimit) {
// //   if (await isPremiumActive(userId)) {
// //     return { allowed: true, premium: true };
// //   }

// //   const { rows } = await pool.query(
// //     "SELECT daily_message_count, daily_reset_date FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   const row = rows[0];
// //   const today = new Date().toISOString().slice(0, 10);
// //   const resetDate = row?.daily_reset_date
// //     ? new Date(row.daily_reset_date).toISOString().slice(0, 10)
// //     : null;

// //   let count = resetDate === today ? (row?.daily_message_count ?? 0) : 0;

// //   if (count >= freeLimit) {
// //     // Persist the (possibly just-reset) count/date even when blocking, so a
// //     // stale reset date from a previous day doesn't linger indefinitely.
// //     await pool.query(
// //       "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
// //       [userId, count, today]
// //     );
// //     return { allowed: false, premium: false, count, limit: freeLimit };
// //   }

// //   count += 1;
// //   await pool.query(
// //     "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
// //     [userId, count, today]
// //   );
// //   return { allowed: true, premium: false, count, limit: freeLimit };
// // }

// // // ── History ───────────────────────────────────────────────────────────────────

// // export async function addHistory(userId, role, content) {
// //   await pool.query(
// //     "INSERT INTO history (user_id, role, content) VALUES ($1, $2, $3)",
// //     [userId, role, content]
// //   );
// // }

// // export async function getHistory(userId, limit = 10) {
// //   const { rows } = await pool.query(
// //     "SELECT role, content FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
// //     [userId, limit]
// //   );
// //   return rows.reverse();
// // }

// // export async function clearHistory(userId) {
// //   await pool.query("DELETE FROM history WHERE user_id = $1", [userId]);
// // }

// // // Total user (not assistant) messages ever sent — used to trigger the
// // // roadmap update every 5th message. Deliberately not tied to the free-tier
// // // daily counter, which resets each day; this should keep counting forever.
// // export async function countUserMessages(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT COUNT(*)::int AS count FROM history WHERE user_id = $1 AND role = 'user'",
// //     [userId]
// //   );
// //   return rows[0]?.count ?? 0;
// // }

// // // ── Learning roadmap ─────────────────────────────────────────────────────────

// // export async function saveRoadmap(userId, roadmapText) {
// //   await pool.query(`
// //     INSERT INTO user_progress (user_id, roadmap, updated_at)
// //     VALUES ($1, $2, NOW())
// //     ON CONFLICT (user_id) DO UPDATE SET roadmap = $2, updated_at = NOW()
// //   `, [userId, roadmapText]);
// // }

// // export async function getRoadmap(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT roadmap, updated_at FROM user_progress WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // // ── Flashcards ────────────────────────────────────────────────────────────────

// // export async function addFlashcard(userId, word, correction, context, language) {
// //   await pool.query(`
// //     INSERT INTO flashcards (user_id, word, correction, context, language)
// //     VALUES ($1, $2, $3, $4, $5)
// //     ON CONFLICT DO NOTHING
// //   `, [userId, word, correction, context, language]);
// // }

// // // Strict match only. Cards with language = NULL (saved before the addFlashcard
// // // language-argument bug was fixed) are deliberately excluded here rather than
// // // shown under every language — that fallback is what caused Spanish, French,
// // // etc. cards to all mix together in one deck. Run the one-time backfill in
// // // cleanup_bad_flashcards.sql to tag those old rows with the right language
// // // instead of relying on this query to paper over it.
// // export async function getFlashcardsByLanguage(userId, language) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1 AND language = $2 ORDER BY id",
// //     [userId, language]
// //   );
// //   return rows;
// // }

// // export async function getFlashcards(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows;
// // }

// // export async function getFlashcardById(id, userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // export async function getDueFlashcards(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1 AND next_review <= NOW() LIMIT 20",
// //     [userId]
// //   );
// //   return rows;
// // }

// // // Requires userId so a caller can't update a flashcard belonging to someone
// // // else just by guessing/incrementing IDs. Returns true on success, false if
// // // the card doesn't exist or doesn't belong to that user.
// // export async function updateFlashcard(id, remembered, userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   const card = rows[0];
// //   if (!card) return false;

// //   let { ease_factor, interval } = card;
// //   if (remembered) {
// //     interval = Math.round(interval * ease_factor);
// //     ease_factor = Math.min(ease_factor + 0.1, 3.0);
// //   } else {
// //     interval = 1;
// //     ease_factor = Math.max(ease_factor - 0.2, 1.3);
// //   }

// //   const nextReview = new Date();
// //   nextReview.setDate(nextReview.getDate() + interval);

// //   await pool.query(
// //     "UPDATE flashcards SET ease_factor = $1, interval = $2, next_review = $3 WHERE id = $4",
// //     [ease_factor, interval, nextReview.toISOString(), id]
// //   );
// //   return true;
// // }

// // export default pool;

// // // ── Quiz mode ─────────────────────────────────────────────────────────────────
// // // Tracks a separate correct-in-a-row streak per card, independent of the
// // // spaced-repetition fields the Flashcards mode uses. Three correct answers in
// // // a row means the word is considered mastered: the card is deleted entirely,
// // // so it stops appearing in both Quiz and Flashcards mode going forward.
// // export async function recordQuizResult(id, userId, correct) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   const card = rows[0];
// //   if (!card) return null;

// //   if (!correct) {
// //     await pool.query("UPDATE flashcards SET correct_streak = 0 WHERE id = $1", [id]);
// //     return { mastered: false, streak: 0 };
// //   }

// //   const streak = (card.correct_streak ?? 0) + 1;
// //   if (streak >= 3) {
// //     await pool.query("DELETE FROM flashcards WHERE id = $1", [id]);
// //     return { mastered: true, streak };
// //   }

// //   await pool.query("UPDATE flashcards SET correct_streak = $2 WHERE id = $1", [id, streak]);
// //   return { mastered: false, streak };
// // }


// // PREVIOUS VERSION - 2

// // import pg from "pg";

// // const { Pool } = pg;

// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl: { rejectUnauthorized: false }, // required for Supabase
// // });

// // // ── Initialize tables ─────────────────────────────────────────────────────────

// // export async function initDB() {
// //   await pool.query(`
// //     CREATE TABLE IF NOT EXISTS users (
// //       user_id BIGINT PRIMARY KEY,
// //       language TEXT,
// //       level TEXT,
// //       state TEXT DEFAULT 'idle'
// //     );

// //     -- Subscription / usage-tracking fields (safe to re-run: no-ops if already present)
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_message_count INTEGER DEFAULT 0;
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE;
// //     ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

// //     CREATE TABLE IF NOT EXISTS history (
// //       id SERIAL PRIMARY KEY,
// //       user_id BIGINT,
// //       role TEXT,
// //       content TEXT,
// //       created_at TIMESTAMPTZ DEFAULT NOW()
// //     );

// //     CREATE TABLE IF NOT EXISTS flashcards (
// //       id SERIAL PRIMARY KEY,
// //       user_id BIGINT,
// //       word TEXT,
// //       correction TEXT,
// //       context TEXT,
// //       next_review TIMESTAMPTZ DEFAULT NOW(),
// //       ease_factor REAL DEFAULT 2.5,
// //       interval INTEGER DEFAULT 1
// //     );

// //     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS language TEXT;
// //     ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0;

// //     CREATE TABLE IF NOT EXISTS user_progress (
// //       user_id BIGINT PRIMARY KEY,
// //       roadmap TEXT,
// //       updated_at TIMESTAMPTZ DEFAULT NOW()
// //     );

// //     -- Permanent record of mastered words (3-in-a-row correct in Quiz mode).
// //     -- Kept separately from flashcards, which only holds words still being
// //     -- actively practiced — a mastered word is removed from flashcards but
// //     -- preserved here instead of being deleted outright.
// //     CREATE TABLE IF NOT EXISTS learned_words (
// //       id SERIAL PRIMARY KEY,
// //       user_id BIGINT NOT NULL,
// //       language TEXT,
// //       word TEXT NOT NULL,
// //       meaning TEXT NOT NULL,
// //       learned_at TIMESTAMPTZ DEFAULT NOW()
// //     );
// //   `);
// //   console.log("✅ Database tables ready");
// // }

// // // ── Users ─────────────────────────────────────────────────────────────────────

// // export async function getUser(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // export async function upsertUser(userId, fields = {}) {
// //   const { language, level, state } = fields;
// //   await pool.query(`
// //     INSERT INTO users (user_id, language, level, state)
// //     VALUES ($1, $2, $3, $4)
// //     ON CONFLICT (user_id) DO UPDATE SET
// //       language = COALESCE($2, users.language),
// //       level = COALESCE($3, users.level),
// //       state = COALESCE($4, users.state)
// //   `, [userId, language ?? null, level ?? null, state ?? null]);
// // }

// // // ── Subscriptions / usage limits ───────────────────────────────────────────────

// // export async function isPremiumActive(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT premium_until FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   const until = rows[0]?.premium_until;
// //   return !!until && new Date(until) > new Date();
// // }

// // // Extends (or starts) a user's premium window by `days` from whichever is
// // // later: now, or their current expiry (so early renewals stack instead of
// // // wasting remaining time).
// // export async function grantPremium(userId, days) {
// //   await pool.query(
// //     `UPDATE users
// //      SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ($2 || ' days')::INTERVAL,
// //          status = 'premium'
// //      WHERE user_id = $1`,
// //     [userId, days]
// //   );
// // }

// // // Checks a free-tier user's daily message quota, resetting the counter if the
// // // day has rolled over, then increments it. Premium users always pass. Returns
// // // { allowed, premium, count?, limit? } — count/limit are omitted for premium
// // // users since they don't apply.
// // export async function checkAndIncrementUsage(userId, freeLimit) {
// //   if (await isPremiumActive(userId)) {
// //     return { allowed: true, premium: true };
// //   }

// //   const { rows } = await pool.query(
// //     "SELECT daily_message_count, daily_reset_date FROM users WHERE user_id = $1",
// //     [userId]
// //   );
// //   const row = rows[0];
// //   const today = new Date().toISOString().slice(0, 10);
// //   const resetDate = row?.daily_reset_date
// //     ? new Date(row.daily_reset_date).toISOString().slice(0, 10)
// //     : null;

// //   let count = resetDate === today ? (row?.daily_message_count ?? 0) : 0;

// //   if (count >= freeLimit) {
// //     // Persist the (possibly just-reset) count/date even when blocking, so a
// //     // stale reset date from a previous day doesn't linger indefinitely.
// //     await pool.query(
// //       "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
// //       [userId, count, today]
// //     );
// //     return { allowed: false, premium: false, count, limit: freeLimit };
// //   }

// //   count += 1;
// //   await pool.query(
// //     "UPDATE users SET daily_message_count = $2, daily_reset_date = $3 WHERE user_id = $1",
// //     [userId, count, today]
// //   );
// //   return { allowed: true, premium: false, count, limit: freeLimit };
// // }

// // // ── History ───────────────────────────────────────────────────────────────────

// // export async function addHistory(userId, role, content) {
// //   await pool.query(
// //     "INSERT INTO history (user_id, role, content) VALUES ($1, $2, $3)",
// //     [userId, role, content]
// //   );
// // }

// // export async function getHistory(userId, limit = 10) {
// //   const { rows } = await pool.query(
// //     "SELECT role, content FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
// //     [userId, limit]
// //   );
// //   return rows.reverse();
// // }

// // export async function clearHistory(userId) {
// //   await pool.query("DELETE FROM history WHERE user_id = $1", [userId]);
// // }

// // // Total user (not assistant) messages ever sent — used to trigger the
// // // roadmap update every 5th message. Deliberately not tied to the free-tier
// // // daily counter, which resets each day; this should keep counting forever.
// // export async function countUserMessages(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT COUNT(*)::int AS count FROM history WHERE user_id = $1 AND role = 'user'",
// //     [userId]
// //   );
// //   return rows[0]?.count ?? 0;
// // }

// // // ── Learning roadmap ─────────────────────────────────────────────────────────

// // export async function saveRoadmap(userId, roadmapText) {
// //   await pool.query(`
// //     INSERT INTO user_progress (user_id, roadmap, updated_at)
// //     VALUES ($1, $2, NOW())
// //     ON CONFLICT (user_id) DO UPDATE SET roadmap = $2, updated_at = NOW()
// //   `, [userId, roadmapText]);
// // }

// // export async function getRoadmap(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT roadmap, updated_at FROM user_progress WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // // ── Flashcards ────────────────────────────────────────────────────────────────

// // export async function addFlashcard(userId, word, correction, context, language) {
// //   await pool.query(`
// //     INSERT INTO flashcards (user_id, word, correction, context, language)
// //     VALUES ($1, $2, $3, $4, $5)
// //     ON CONFLICT DO NOTHING
// //   `, [userId, word, correction, context, language]);
// // }

// // // Strict match only. Cards with language = NULL (saved before the addFlashcard
// // // language-argument bug was fixed) are deliberately excluded here rather than
// // // shown under every language — that fallback is what caused Spanish, French,
// // // etc. cards to all mix together in one deck. Run the one-time backfill in
// // // cleanup_bad_flashcards.sql to tag those old rows with the right language
// // // instead of relying on this query to paper over it.
// // export async function getFlashcardsByLanguage(userId, language) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1 AND language = $2 ORDER BY id",
// //     [userId, language]
// //   );
// //   return rows;
// // }

// // export async function getFlashcards(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1",
// //     [userId]
// //   );
// //   return rows;
// // }

// // export async function getFlashcardById(id, userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   return rows[0] ?? null;
// // }

// // export async function getDueFlashcards(userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE user_id = $1 AND next_review <= NOW() LIMIT 20",
// //     [userId]
// //   );
// //   return rows;
// // }

// // // Requires userId so a caller can't update a flashcard belonging to someone
// // // else just by guessing/incrementing IDs. Returns true on success, false if
// // // the card doesn't exist or doesn't belong to that user.
// // export async function updateFlashcard(id, remembered, userId) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   const card = rows[0];
// //   if (!card) return false;

// //   let { ease_factor, interval } = card;
// //   if (remembered) {
// //     interval = Math.round(interval * ease_factor);
// //     ease_factor = Math.min(ease_factor + 0.1, 3.0);
// //   } else {
// //     interval = 1;
// //     ease_factor = Math.max(ease_factor - 0.2, 1.3);
// //   }

// //   const nextReview = new Date();
// //   nextReview.setDate(nextReview.getDate() + interval);

// //   await pool.query(
// //     "UPDATE flashcards SET ease_factor = $1, interval = $2, next_review = $3 WHERE id = $4",
// //     [ease_factor, interval, nextReview.toISOString(), id]
// //   );
// //   return true;
// // }

// // export default pool;

// // // ── Quiz mode ─────────────────────────────────────────────────────────────────
// // // Tracks a separate correct-in-a-row streak per card, independent of the
// // // spaced-repetition fields the Flashcards mode uses. Three correct answers in
// // // a row means the word is considered mastered: it's moved out of flashcards
// // // (so it stops appearing in Quiz/Flashcards practice) and into learned_words
// // // as a permanent record, rather than being deleted outright.
// // export async function recordQuizResult(id, userId, correct) {
// //   const { rows } = await pool.query(
// //     "SELECT * FROM flashcards WHERE id = $1 AND user_id = $2",
// //     [id, userId]
// //   );
// //   const card = rows[0];
// //   if (!card) return null;

// //   if (!correct) {
// //     await pool.query("UPDATE flashcards SET correct_streak = 0 WHERE id = $1", [id]);
// //     return { mastered: false, streak: 0 };
// //   }

// //   const streak = (card.correct_streak ?? 0) + 1;
// //   if (streak >= 3) {
// //     await pool.query(
// //       "INSERT INTO learned_words (user_id, language, word, meaning) VALUES ($1, $2, $3, $4)",
// //       [userId, card.language, card.word, card.correction]
// //     );
// //     await pool.query("DELETE FROM flashcards WHERE id = $1", [id]);
// //     return { mastered: true, streak };
// //   }

// //   await pool.query("UPDATE flashcards SET correct_streak = $2 WHERE id = $1", [id, streak]);
// //   return { mastered: false, streak };
// // }

// // export async function getLearnedWords(userId, language) {
// //   const { rows } = await pool.query(
// //     "SELECT word, meaning, learned_at FROM learned_words WHERE user_id = $1 AND language = $2 ORDER BY learned_at DESC",
// //     [userId, language]
// //   );
// //   return rows;
// // }

