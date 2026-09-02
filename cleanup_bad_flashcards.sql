-- One-time cleanup for flashcards saved before the ai.js fix, where
-- `correction` ended up being a near-duplicate of `word` (the exact
-- "repeating the same word" bug). Run this ONCE against your Supabase DB
-- after deploying the fixed ai.js.
--
-- This uses Postgres's built-in `similarity()` (pg_trgm extension) to catch
-- near-duplicates, not just exact matches (accents/case/typos included).

-- 1) Enable the trigram extension (safe to re-run; no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Preview what would be deleted — RUN THIS FIRST and eyeball the results
--    before running the DELETE below. Adjust the 0.55 threshold if it's
--    catching real translations (lower = stricter, catches fewer) or missing
--    obvious duplicates (higher = catches more).
SELECT id, user_id, word, correction, context
FROM flashcards
WHERE similarity(lower(word), lower(correction)) > 0.55
ORDER BY user_id, id;

-- 3) Once you're satisfied with the preview, delete those rows:
-- DELETE FROM flashcards
-- WHERE similarity(lower(word), lower(correction)) > 0.55;

-- 4) Optional: while you're in here, backfill NULL languages for existing
--    users who only ever studied one language (safe to skip if you have
--    multi-language users, since it can't tell those apart).
-- UPDATE flashcards f
-- SET language = u.language
-- FROM users u
-- WHERE f.user_id = u.user_id AND f.language IS NULL;
