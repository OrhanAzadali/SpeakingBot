-- -- ═══════════════════════════════════════════════════════════════════════════
-- -- PART 1: Near-duplicate "correction" cleanup (correction ≈ word itself)
-- -- ═══════════════════════════════════════════════════════════════════════════
-- -- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -- Preview first:
-- -- SELECT id, user_id, word, correction, context, language
-- -- FROM flashcards
-- -- WHERE similarity(lower(word), lower(correction)) > 0.55
-- -- ORDER BY user_id, id;

-- -- Then delete once you're happy with the preview:
-- -- DELETE FROM flashcards
-- -- WHERE similarity(lower(word), lower(correction)) > 0.55;


-- -- ═══════════════════════════════════════════════════════════════════════════
-- -- PART 2: NULL-language cards (the cross-language mixing bug)
-- -- ═══════════════════════════════════════════════════════════════════════════
-- -- These are cards saved before the addFlashcard() language-argument bug was
-- -- fixed. Since you've switched languages before, there is no way to know
-- -- automatically which language each one belongs to — pick ONE of the two
-- -- approaches below.

-- -- Step 1 (always do this first): see what you're dealing with.
-- -- SELECT id, user_id, word, correction, context
-- -- FROM flashcards
-- -- WHERE user_id = 8291613988
-- --   AND language IS NULL
-- -- ORDER BY id;

-- -- ── OPTION A: Manually re-tag ────────────────────────────────────────────────
-- -- Look at the word/correction text for each row above, decide which language
-- -- it belongs to, then group the ids and run one UPDATE per language. Repeat
-- -- for as many languages as you have untagged cards for. Language values must
-- -- match the LANGUAGES keys in ai.js exactly (e.g. 'spanish', 'french', 'japanese').

-- -- UPDATE flashcards SET language = 'spanish' WHERE id IN (1, 4, 9, 12);
-- -- UPDATE flashcards SET language = 'french'  WHERE id IN (2, 3, 7);

-- -- ── OPTION B: Archive/delete the untagged cards ─────────────────────────────
-- -- Simplest option — clears the ambiguity entirely. New cards going forward
-- -- are unaffected, since they now save with the correct language automatically.

-- -- DELETE FROM flashcards WHERE user_id = 8291613988 AND language IS NULL;
-- -- Or, to clear it for every user at once instead of one at a time:
-- -- DELETE FROM flashcards;

-- SELECT user_id, language, COUNT(*) 
-- FROM flashcards 
-- GROUP BY user_id, language 
-- ORDER BY user_id, language;


-- -- CREATE TABLE IF NOT EXISTS level_tests (
-- --   id SERIAL PRIMARY KEY,
-- --   user_id BIGINT NOT NULL,
-- --   language TEXT NOT NULL,
-- --   detected_level TEXT NOT NULL,
-- --   score INT NOT NULL,
-- --   breakdown JSONB NOT NULL,
-- --   recommendations TEXT,
-- --   created_at TIMESTAMPTZ DEFAULT NOW()
-- -- );

-- -- CREATE TABLE IF NOT EXISTS active_tests (
-- --   user_id BIGINT PRIMARY KEY,
-- --   language TEXT NOT NULL,
-- --   mediator_language TEXT NOT NULL,
-- --   questions JSONB NOT NULL,
-- --   current_index INT DEFAULT 0,
-- --   answers JSONB DEFAULT '[]'::JSONB,
-- --   created_at TIMESTAMPTZ DEFAULT NOW()
-- -- );

-- -- ============================================================================
-- -- SUPABASE VOCABULARY DATABASE CLEANUP & LEMMATIZATION SCRIPT
-- -- ============================================================================

-- -- 1. Delete transliterated English noise, single-letter particles, and gibberish
-- DELETE FROM flashcards
-- WHERE word ILIKE ANY (ARRAY[
--   'BIL', 'SHO', 'TEM', 'TOGO', 'не', 'а', 'о', 'Эрнана Кортеса'
-- ])
-- OR LENGTH(TRIM(word)) <= 1;

-- DELETE FROM learned_words
-- WHERE word ILIKE ANY (ARRAY[
--   'BIL', 'SHO', 'TEM', 'TOGO', 'думавладельце'
-- ])
-- OR LENGTH(TRIM(word)) <= 1;

-- -- 2. Lemmatize inflected nouns, adjectives, and verbs into base dictionary forms
-- -- in FLASHCARDS
-- UPDATE flashcards SET
--   word = 'горшок',
--   initial_form = 'горшок',
--   correction = 'pot (noun, masculine)',
--   part_of_speech = 'noun'
-- WHERE word ILIKE 'горшками%';

-- UPDATE flashcards SET
--   word = 'разный',
--   initial_form = 'разный',
--   correction = 'different, various',
--   part_of_speech = 'adjective'
-- WHERE word ILIKE 'разными%';

-- UPDATE flashcards SET
--   word = 'установленный',
--   initial_form = 'установленный',
--   correction = 'installed, established',
--   part_of_speech = 'participle/adjective'
-- WHERE word ILIKE 'установленным%';

-- UPDATE flashcards SET
--   word = 'крыльцо',
--   initial_form = 'крыльцо',
--   correction = 'porch, steps (noun, neuter)',
--   part_of_speech = 'noun'
-- WHERE word ILIKE 'крылцом%' OR word ILIKE 'крыльцом%';

-- UPDATE flashcards SET
--   word = 'крыша',
--   initial_form = 'крыша',
--   correction = 'roof (noun, feminine)',
--   part_of_speech = 'noun'
-- WHERE word ILIKE 'крышей%';

-- UPDATE flashcards SET
--   word = 'черепичный',
--   initial_form = 'черепичный',
--   correction = 'tiled, ceramic',
--   part_of_speech = 'adjective'
-- WHERE word ILIKE 'черепичной%';

-- UPDATE flashcards SET
--   word = 'крашеный',
--   initial_form = 'крашеный',
--   correction = 'painted, dyed',
--   part_of_speech = 'adjective'
-- WHERE word ILIKE 'крашеной%';

-- UPDATE flashcards SET
--   word = 'вопрос',
--   initial_form = 'вопрос',
--   correction = 'question (noun, masculine)',
--   part_of_speech = 'noun'
-- WHERE word ILIKE 'вопроса%';

-- UPDATE flashcards SET
--   word = 'ошибка',
--   initial_form = 'ошибка',
--   correction = 'mistake, error (noun, feminine)',
--   part_of_speech = 'noun'
-- WHERE word ILIKE 'ошибки%';

-- UPDATE flashcards SET
--   word = 'мой',
--   initial_form = 'мой',
--   correction = 'my, mine (possessive pronoun)',
--   part_of_speech = 'pronoun'
-- WHERE word ILIKE 'мои%';

-- UPDATE flashcards SET
--   word = 'исправить',
--   initial_form = 'исправить',
--   correction = 'to correct, to fix (verb, perfective)',
--   part_of_speech = 'verb'
-- WHERE word ILIKE 'исправь%';

-- -- 3. Lemmatize inflected words in LEARNED_WORDS
-- UPDATE learned_words SET
--   word = 'предыдущий',
--   initial_form = 'предыдущий',
--   meaning = 'previous, preceding',
--   part_of_speech = 'adjective'
-- WHERE word ILIKE 'предыдущего%';

-- UPDATE learned_words SET
--   word = 'провалить тест',
--   initial_form = 'провалить тест',
--   meaning = 'to fail a test (verbal phrase)',
--   part_of_speech = 'phrase'
-- WHERE word ILIKE 'провалил тест%';

-- -- 4. Fill in missing initial_form for any legacy rows
-- UPDATE flashcards
-- SET initial_form = word
-- WHERE initial_form IS NULL OR initial_form = '';

-- UPDATE learned_words
-- SET initial_form = word
-- WHERE initial_form IS NULL OR initial_form = '';

-- UPDATE user_progress SET roadmap = NULL WHERE user_id = 8291613988;
-- UPDATE user_progress SET roadmap = NULL;

-- -- 1. Add columns if not present
-- ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS mediator_language TEXT DEFAULT 'english';
-- ALTER TABLE learned_words ADD COLUMN IF NOT EXISTS mediator_language TEXT DEFAULT 'english';

-- -- 2. Tag words that have Russian Cyrillic letters in correction as 'russian'
-- UPDATE flashcards 
-- SET mediator_language = 'russian' 
-- WHERE correction ~ '[а-яА-ЯёЁ]';

-- -- 3. Tag words that have Azerbaijani letters (ə, ı, ğ, ç, ş) as 'azerbaijani'
-- UPDATE flashcards 
-- SET mediator_language = 'azerbaijani' 
-- WHERE correction ~ '[əƏıIğĞçÇşŞüÜöÖ]' OR word IN ('one', 'two', 'dog', 'apple', 'to eat');

-- -- 4. Do the same for learned_words
-- UPDATE learned_words 
-- SET mediator_language = 'russian' 
-- WHERE meaning ~ '[а-яА-ЯёЁ]';

-- UPDATE learned_words 
-- SET mediator_language = 'azerbaijani' 
-- WHERE meaning ~ '[əƏıIğĞçÇşŞüÜöÖ]';

-- Active development project for a speaking/language-practice bot with flashcard and quiz features

-- FOLLOW THESE INSTRUCTIONS - ANALYZE THE REPO, IF ANY ISSUE FOUND FIX, ALSO FIX THESE ISSUES IF FOUND AS BELOW - AS A RESULT GIVE ME ALL NECESSARY FILES CODE CONTENT TO COPY AND PAST IN MY LOCAL REPO CODE FILES CONTENT FOR ME:





-- Project repository is at github.com/OrhanAzadali/SpeakingBot



-- Bot includes a quiz feature that compares user answers to correct answers; goal is to replace character-level string comparison with AI-powered semantic comparison (e.g. via Groq)



-- Bot detects mistakes in user's textual input; goal is full-content mistake detection across all words, not just the first words



-- Detected mistake words and their corrections should be added to both flashcard and quiz databases



-- When new words are added to the database, flashcards should re-render/restart to show new words at the top of the existing list



-- THE WORKING PLAN:



-- Exploring a repository's structure and access methods.

-- Let me examine the relevant files.

-- Upgrading flashcard quiz grading with AI-driven semantic matching.

-- Confirming flashcards share one table across modes.

-- Tracing how card data loads and updates in the app.

-- Investigating why new flashcards fail to appear live.

-- Reviewing database code for consistency across functions.

-- Locating the correct spot to insert code changes.

-- Now strip the huge dead comment block at the end of the file

-- Now clean up trailing blank lines and verify the file is syntactically sound
 
 


-- LAST PROMPT:
-- now another issue - it suggests as options not the real words or sentences but  like Verb1, Verb2, Verb3, Verb4 or Option1 and Option2 - you know, as if placeholders instead of the real words. Besides, it seems the bot takes all the answers for quiz questions from our databases - now I want it to take as answers only words generated using AI in a respective language (using mediator only if it asks for meaning from beginner or intermediate users, and the learning language itself if the level is advanced) - so that there were not any misunderstanding or misconceptions

-- also you should handle all the posssible isues with users shifting from one mediator to another - htis should change the explanation and description languages for pdf all the existing files to the respective one each time the user makes this kind of shift. 

-- another issue is that we have still have issue with Doownload Grammar in PDF buttons in miniapp and in webapp either - it redirects us to the page with this error object: {
-- "error": "Invalid topic ID"
-- }

-- NOW ANALYZE THE WHOOLE PROMPT, ALSO ANALYZE ALL THE GIVEN FILES AND DOCUMENTS, ALL WE HAVE DISCUSSED SO FAR, AND AFTER DOING SOME DEEP RESEARCH IF NEEDED AND WHERE NEEDED MAKE A FINAL ULTIMATE COMPREHENSIVE CONLUSION REGARDING HOW TO FIX ALL THESE ISSUES AND GIVE ME AS AN OUTPUT OF YOUR THINKING PROCESS THE NECESSARY PIECES WITH INFO ON WHERE TO PASTE IT IN THE RESPECTIVE FILES:

-- LOOK HERE AT OUR VOCAVULARY IN PDF CONTENTS: "Personal Vocabulary & Morphology Notebook
-- Target Track: English | Total Words: 29 | Date: 9/5/2026
-- 1. one [number]
-- Meaning: bir
-- 2. old house [phrase]
-- Meaning: старый дом
-- 3. small bag [phrase]
-- Meaning: маленькая сумка
-- 4. cold water [phrase]
-- Meaning: холодная вода
-- 5. big apple [phrase]
-- Meaning: большое яблоко
-- 6. new book [phrase]
-- Meaning: новая книга
-- 7. water [noun]
-- Meaning: вода
-- 8. dog [noun]
-- Meaning: it
-- 9. three [number]
-- Meaning: три
-- 10. hat [word]
-- Meaning: шляпа
-- 11. book [noun]
-- Meaning: книга
-- 12. apple [noun]
-- Meaning: alma
-- 13. to eat [verb]
-- Meaning: yemek
-- 14. two [number]
-- Meaning: iki
-- 15. big [adjective]
-- Meaning: большой
-- 16. cat [noun]
-- Meaning: кот
-- 17. the [article]
-- Meaning: определённый артикль, указывает на конкретный объект
-- 18. quit [verb]
-- Meaning: прекращать, останавливаться
-- 19. to know [phrase]
-- Meaning: не знать, не иметь информации
-- 20. no [adverb]
-- Meaning: нет, отрицание
-- 21. in [preposition]
-- Meaning: в, внутри
-- 22. remember [verb]
-- Meaning: запоминать, помнить
-- 23. skill [noun]
-- Meaning: навык, умение
-- 24. she [pronoun]
-- Meaning: она
-- 25. word [noun]
-- Meaning: слово
-- 26. Achilles' heel [noun]
-- Meaning: слабое место, уязвимая точка
-- 27. something [pronoun]
-- Meaning: что-то, нечто
-- 28. nothing [adverb]
-- Meaning: ничего, ничего не
-- 29. old library [noun phrase]
-- Meaning: старый библиотека"   - BUT it should not mix words from different mediators though learning the same language when user saves the words - it should separate them also by mediator language so that the same language vocabulary would have different wordlists for different mediators of the same user

-- besides, even though we have words in vocabulary flashcards and quizzes still refuse to work saying there is not words saved and recommending to save some words first - but the vocabulary have words 10_ - why ?  fix all these issues!!!!