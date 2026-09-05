// db.js — PostgreSQL version (replaces lowdb)
import pg from "pg";

const { Pool } = pg;

let pool;
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Supabase
    });
  } catch {
    console.warn("DB not connected — mock active");
    pool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }),
    };
  }
} else {
  console.warn("No DATABASE_URL set — in-memory / mock active");
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }),
  };
}

// ── Initialize tables & schema migrations ─────────────────────────────────────

export async function initDB() {
  try {
    if (!process.env.DATABASE_URL) return;
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

    -- Deduplicate existing rows BEFORE creating the unique index below.
    -- CREATE UNIQUE INDEX fails outright if any pre-existing rows already
    -- violate the constraint (exactly what was crashing startup) — this
    -- keeps, per (user_id, language, word), whichever duplicate has the most
    -- quiz progress (correct_streak), tie-broken by the most recent row.
    DELETE FROM flashcards a
    USING flashcards b
    WHERE a.user_id = b.user_id
      AND a.language = b.language
      AND a.word = b.word
      AND (
        a.correct_streak < b.correct_streak
        OR (a.correct_streak = b.correct_streak AND a.id < b.id)
      );

    -- Deduplication index: stops duplicate identical cards for the same user and language
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_flashcard 
    ON flashcards (user_id, language, word);

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id BIGINT PRIMARY KEY,
      roadmap TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Permanent record of mastered words (3-in-a-row correct in Quiz mode).
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

    -- Same preventive deduplication for learned_words, so this index doesn't
    -- hit the identical crash the moment the flashcards index above succeeds.
    DELETE FROM learned_words a
    USING learned_words b
    WHERE a.user_id = b.user_id
      AND a.language = b.language
      AND a.word = b.word
      AND a.id < b.id;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_learned_word 
    ON learned_words (user_id, language, word);

    -- Diagnostic Level Tests history table.
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

    CREATE TABLE IF NOT EXISTS grammar_topics (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      language TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'General Grammar',
      rule_summary TEXT,
      explanation TEXT NOT NULL,
      examples JSONB DEFAULT '[]'::JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_grammar_user_lang ON grammar_topics (user_id, language);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_grammar_topic ON grammar_topics (user_id, language, title);
  `);
    console.log("✅ Database tables & rich linguistic schemas ready");
  } catch (err) {
    console.warn("Database initialization failed (mock active):", err.message);
  }
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

// ── Flashcards (Deduplicating Upsert with Rich Linguistics) ───────────────────

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

  // Uses ON CONFLICT to refresh linguistic details instead of creating duplicates!
  await pool.query(`
    INSERT INTO flashcards (
      user_id, word, correction, context, language,
      initial_form, used_form, part_of_speech, synonyms, explanation, sentence,
      transcription, pronunciation_rule, grammar_rule, orthography_rule, syntax_rule, semantics_note
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (user_id, language, word) DO UPDATE SET
      correction = EXCLUDED.correction,
      used_form = EXCLUDED.used_form,
      part_of_speech = COALESCE(EXCLUDED.part_of_speech, flashcards.part_of_speech),
      synonyms = COALESCE(EXCLUDED.synonyms, flashcards.synonyms),
      explanation = COALESCE(EXCLUDED.explanation, flashcards.explanation),
      sentence = COALESCE(EXCLUDED.sentence, flashcards.sentence),
      transcription = COALESCE(EXCLUDED.transcription, flashcards.transcription),
      pronunciation_rule = COALESCE(EXCLUDED.pronunciation_rule, flashcards.pronunciation_rule),
      grammar_rule = COALESCE(EXCLUDED.grammar_rule, flashcards.grammar_rule),
      orthography_rule = COALESCE(EXCLUDED.orthography_rule, flashcards.orthography_rule),
      syntax_rule = COALESCE(EXCLUDED.syntax_rule, flashcards.syntax_rule),
      semantics_note = COALESCE(EXCLUDED.semantics_note, flashcards.semantics_note)
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id, language, word) DO UPDATE SET
        meaning = EXCLUDED.meaning,
        learned_at = NOW()`,
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
    langFilter = "AND LOWER(language) = LOWER($2)";
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

// ── Grammar Topics & Rules (Dedicated Table, Isolated by User and Language) ───

export async function saveGrammarTopic(userId, language, topicData) {
  const { title, category = "General Grammar", rule_summary = "", explanation = "", examples = [] } = topicData;
  if (!title || !explanation) return null;
  const { rows } = await pool.query(`
    INSERT INTO grammar_topics (user_id, language, title, category, rule_summary, explanation, examples, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id, language, title) DO UPDATE SET
      category = COALESCE(EXCLUDED.category, grammar_topics.category),
      rule_summary = COALESCE(EXCLUDED.rule_summary, grammar_topics.rule_summary),
      explanation = EXCLUDED.explanation,
      examples = COALESCE(EXCLUDED.examples, grammar_topics.examples),
      updated_at = NOW()
    RETURNING *
  `, [userId, language, title.trim(), category.trim(), rule_summary.trim(), explanation.trim(), JSON.stringify(examples)]);
  return rows[0] ?? null;
}

// In db.js:
export async function getGrammarTopics(userId, language) {
  const { rows } = await pool.query(
    "SELECT * FROM grammar_topics WHERE user_id = $1 AND LOWER(language) = LOWER($2) ORDER BY updated_at DESC, id DESC",
    [userId, language]
  );
  return rows;
}


export async function getGrammarTopicById(id, userId = null) {
  if (userId) {
    const { rows } = await pool.query(
      "SELECT * FROM grammar_topics WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (rows[0]) return rows[0];
  }
  // Fallback: look up by primary key ID directly (safe because topic IDs are serial primary keys)
  const { rows } = await pool.query(
    "SELECT * FROM grammar_topics WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function getLatestGrammarTopic(userId, language) {
  const { rows } = await pool.query(
    "SELECT * FROM grammar_topics WHERE user_id = $1 AND language = $2 ORDER BY updated_at DESC, id DESC LIMIT 1",
    [userId, language]
  );
  return rows[0] ?? null;
}

export const getAllUserGrammar = getGrammarTopics;

export default pool;
