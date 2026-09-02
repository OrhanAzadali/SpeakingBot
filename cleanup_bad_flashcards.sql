-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: Near-duplicate "correction" cleanup (correction ≈ word itself)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Preview first:
SELECT id, user_id, word, correction, context, language
FROM flashcards
WHERE similarity(lower(word), lower(correction)) > 0.55
ORDER BY user_id, id;

-- Then delete once you're happy with the preview:
-- DELETE FROM flashcards
-- WHERE similarity(lower(word), lower(correction)) > 0.55;


-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: NULL-language cards (the cross-language mixing bug)
-- ═══════════════════════════════════════════════════════════════════════════
-- These are cards saved before the addFlashcard() language-argument bug was
-- fixed. Since you've switched languages before, there is no way to know
-- automatically which language each one belongs to — pick ONE of the two
-- approaches below.

-- Step 1 (always do this first): see what you're dealing with.
SELECT id, user_id, word, correction, context
FROM flashcards
WHERE user_id = YOUR_TELEGRAM_USER_ID
  AND language IS NULL
ORDER BY id;

-- ── OPTION A: Manually re-tag ────────────────────────────────────────────────
-- Look at the word/correction text for each row above, decide which language
-- it belongs to, then group the ids and run one UPDATE per language. Repeat
-- for as many languages as you have untagged cards for. Language values must
-- match the LANGUAGES keys in ai.js exactly (e.g. 'spanish', 'french', 'japanese').

-- UPDATE flashcards SET language = 'spanish' WHERE id IN (1, 4, 9, 12);
-- UPDATE flashcards SET language = 'french'  WHERE id IN (2, 3, 7);

-- ── OPTION B: Archive/delete the untagged cards ─────────────────────────────
-- Simplest option — clears the ambiguity entirely. New cards going forward
-- are unaffected, since they now save with the correct language automatically.

-- DELETE FROM flashcards WHERE user_id = YOUR_TELEGRAM_USER_ID AND language IS NULL;
-- Or, to clear it for every user at once instead of one at a time:
-- DELETE FROM flashcards WHERE language IS NULL;