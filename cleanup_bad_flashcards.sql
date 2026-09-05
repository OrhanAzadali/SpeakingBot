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

-- P-JSON:
-- {
--   "name": "language-coach-bot",
--   "version": "1.0.0",
--   "type": "module",
--   "scripts": {
--     "start": "node index.js",
--     "dev": "node --watch index.js"
--   },
--   "dependencies": {
--     "cors": "^2.8.6",
--     "dotenv": "^16.4.5",
--     "express": "^5.2.1",
--     "form-data": "^4.0.0",
--     "grammy": "^1.21.1",
--     "groq-sdk": "^0.3.3",
--     "msedge-tts": "^2.0.5",
--     "node-fetch": "^3.3.2",
--     "pdfkit": "^0.16.0",
--     "pg": "^8.21.0"
--   }
-- }




-- NOW YOU'VE TRICKED US INTO LOTS OF DIFFERENT ISSUES AND ERRORS - LOOK:
-- ==> Deploying...
-- ==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
-- ==> Running 'node index.js'
-- ⏳ Downloading DejaVuSans.ttf for perfect Unicode & Cyrillic PDF rendering...
-- ✅ Database tables & rich linguistic schemas ready
-- API running on port 10000
-- ✅ Telegram command menu registered successfully
-- ✅ Telegram chat menu button set to: https://speaking-bot-ts5q.vercel.app
-- ✅ Webhook running: https://speakingbot.onrender.com/telegram/webhook
-- ==> Your service is live 🎉
-- ==>
-- ==> ///////////////////////////////////////////////////////////
-- ==>
-- ==> Available at your primary URL https://speakingbot.onrender.com
-- ==>
-- ==> ///////////////////////////////////////////////////////////
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Webhook ack sent early — update processing in background.
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-120b" attempt failed (400). Cycling to next model...
-- Model "openai/gpt-oss-20b" attempt failed (400). Cycling to next model...
-- Model "qwen/qwen3.6-27b" attempt failed (400). Cycling to next model...
-- Chat error: BadRequestError: 400 {"error":{"message":"Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.","type":"invalid_request_error","code":"json_validate_failed","failed_generation":""}}
-- at APIError.generate (file:///opt/render/project/src/node_modules/groq-sdk/core/error.mjs:36:20)
-- at Groq.makeStatusError (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:135:32)
-- at Groq.makeRequest (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:277:30)
-- at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
-- at async withModelFallback (file:///opt/render/project/src/bot/ai.js:38:14)
-- at async Promise.all (index 1)
-- at async chat (file:///opt/render/project/src/bot/ai.js:699:52)
-- at async file:///opt/render/project/src/bot/index.js:2200:49
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:578:13
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:62:13 {
-- status: 400,
-- headers: Headers {
-- date: 'Sat, 05 Sep 2026 12:12:15 GMT',
-- 'content-type': 'application/json',
-- 'content-length': '202',
-- connection: 'keep-alive',
-- 'cache-control': 'private, max-age=0, no-store, no-cache, must-revalidate',
-- server: 'cloudflare',
-- vary: 'Origin',
-- 'x-groq-region': 'fra',
-- 'x-ratelimit-limit-requests': '1000',
-- 'x-ratelimit-limit-tokens': '8000',
-- 'x-ratelimit-remaining-requests': '999',
-- 'x-ratelimit-remaining-tokens': '3164',
-- 'x-ratelimit-reset-requests': '1m26.4s',
-- 'x-ratelimit-reset-tokens': '36.27s',
-- 'x-request-id': 'req_01m1rqqjv4eces3wcz645rs9vq',
-- via: '1.1 google',
-- 'cf-cache-status': 'DYNAMIC',
-- 'set-cookie': '__cf_bm=YqC8MC8Ka3J5js2mwhSkO8g4JD.SzuhfqLCyvRTArK8-1788610333.5350575-1.0.1.1-1fsxZEV3UB5tDxMd1XdxlF4GpNtrTyOJKEco2_AcKAcHL.5SQmVhToSgJu.yF281quTqkhnbIKrKtBqxt7Bz4COOaoNn..bB.wQjn7cW_UPXVHf1Khk3ujIh9PFPHf2h; HttpOnly; SameSite=None; Secure; Path=/; Domain=groq.com; Expires=Sat, 05 Sep 2026 12:42:15 GMT',
-- 'strict-transport-security': 'max-age=15552000',
-- 'cf-ray': 'a36524189879e86b-FRA',
-- 'alt-svc': 'h3=":443"; ma=86400'
-- },
-- error: {
-- error: {
-- message: "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
-- type: 'invalid_request_error',
-- code: 'json_validate_failed',
-- failed_generation: ''
-- }
-- }
-- }
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-120b" attempt failed (400). Cycling to next model...
-- Webhook ack sent early — update processing in background.
-- ==> Detected service running on port 10000
-- ==> Docs on specifying a port: https://render.com/docs/web-services#port-binding
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Webhook ack sent early — update processing in background.
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-120b" attempt failed (413). Cycling to next model...
-- Webhook ack sent early — update processing in background.
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-120b" attempt failed (413). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-20b" attempt failed (413). Cycling to next model...
-- Model "qwen/qwen3.6-27b" attempt failed (429). Cycling to next model...
-- Chat error: RateLimitError: 429 {"error":{"message":"Request too large for model qwen/qwen3.6-27b in organization org_01ktt6pk7wedtsby9ysqq32py1 service tier on_demand on output tokens per minute (OTPM): Limit 1000, Requested 2512. The request's expected output tokens exceed the enforced limit; reduce max_tokens (or the request's expected output) and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}
-- at APIError.generate (file:///opt/render/project/src/node_modules/groq-sdk/core/error.mjs:54:20)
-- at Groq.makeStatusError (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:135:32)
-- at Groq.makeRequest (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:277:30)
-- at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
-- at async withModelFallback (file:///opt/render/project/src/bot/ai.js:38:14)
-- at async Promise.all (index 0)
-- at async chat (file:///opt/render/project/src/bot/ai.js:699:52)
-- at async file:///opt/render/project/src/bot/index.js:2200:49
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:578:13
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:62:13 {
-- status: 429,
-- headers: Headers {
-- date: 'Sat, 05 Sep 2026 12:19:13 GMT',
-- 'content-type': 'application/json',
-- 'content-length': '475',
-- connection: 'keep-alive',
-- 'cache-control': 'private, max-age=0, no-store, no-cache, must-revalidate',
-- server: 'cloudflare',
-- vary: 'Origin',
-- 'x-groq-region': 'fra',
-- 'x-ratelimit-limit-requests': '1000',
-- 'x-ratelimit-limit-tokens': '8000',
-- 'x-ratelimit-remaining-requests': '1000',
-- 'x-ratelimit-remaining-tokens': '8000',
-- 'x-ratelimit-reset-requests': '1ms',
-- 'x-ratelimit-reset-tokens': '1ms',
-- 'x-request-id': 'req_01m1rr4ct9e5dt7ma3w22dcqnn',
-- 'x-should-retry': 'false',
-- via: '1.1 google',
-- 'cf-cache-status': 'DYNAMIC',
-- 'set-cookie': '__cf_bm=xvosliicnEHuXk_zI_IDbGR9Fm15bmgPrwJOsZZUf5o-1788610753.3468652-1.0.1.1-IsZAsAHdZexi.RuN8ZeKZSH1v3ctYhUfEs6TzUXkAULd43smvvuBWRg26y7FWLt5t._gJ1K4X2MhnlQcvV5rXEub6xs_DVADPJZIdtp.US3uwiXhDIHrJ2mPCK6Y.Y8U; HttpOnly; SameSite=None; Secure; Path=/; Domain=groq.com; Expires=Sat, 05 Sep 2026 12:49:13 GMT',
-- 'strict-transport-security': 'max-age=15552000',
-- 'cf-ray': 'a3652e586849d26c-FRA',
-- 'alt-svc': 'h3=":443"; ma=86400'
-- },
-- error: {
-- error: {
-- message: "Request too large for model qwen/qwen3.6-27b in organization org_01ktt6pk7wedtsby9ysqq32py1 service tier on_demand on output tokens per minute (OTPM): Limit 1000, Requested 2512. The request's expected output tokens exceed the enforced limit; reduce max_tokens (or the request's expected output) and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing",
-- type: 'tokens',
-- code: 'rate_limit_exceeded'
-- }
-- }
-- }
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "llama-3.3-70b-versatile" attempt failed (404). Cycling to next model...
-- Model "llama-3.1-8b-instant" attempt failed (404). Cycling to next model...
-- Model "openai/gpt-oss-120b" attempt failed (413). Cycling to next model...
-- Model "openai/gpt-oss-20b" attempt failed (413). Cycling to next model...
-- Model "qwen/qwen3.6-27b" attempt failed (429). Cycling to next model...
-- Chat error: RateLimitError: 429 {"error":{"message":"Request too large for model qwen/qwen3.6-27b in organization org_01ktt6pk7wedtsby9ysqq32py1 service tier on_demand on output tokens per minute (OTPM): Limit 1000, Requested 1134. The request's expected output tokens exceed the enforced limit; reduce max_tokens (or the request's expected output) and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}
-- at APIError.generate (file:///opt/render/project/src/node_modules/groq-sdk/core/error.mjs:54:20)
-- at Groq.makeStatusError (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:135:32)
-- at Groq.makeRequest (file:///opt/render/project/src/node_modules/groq-sdk/client.mjs:277:30)
-- at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
-- at async withModelFallback (file:///opt/render/project/src/bot/ai.js:38:14)
-- at async Promise.all (index 0)
-- at async chat (file:///opt/render/project/src/bot/ai.js:699:52)
-- at async file:///opt/render/project/src/bot/index.js:2200:49
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:578:13
-- at async /opt/render/project/src/node_modules/grammy/out/composer.js:62:13 {
-- status: 429,
-- headers: Headers {
-- date: 'Sat, 05 Sep 2026 12:20:10 GMT',
-- 'content-type': 'application/json',
-- 'content-length': '475',
-- connection: 'keep-alive',
-- 'cache-control': 'private, max-age=0, no-store, no-cache, must-revalidate',
-- server: 'cloudflare',
-- vary: 'Origin',
-- 'x-groq-region': 'fra',
-- 'x-ratelimit-limit-requests': '1000',
-- 'x-ratelimit-limit-tokens': '8000',
-- 'x-ratelimit-remaining-requests': '1000',
-- 'x-ratelimit-remaining-tokens': '8000',
-- 'x-ratelimit-reset-requests': '1ms',
-- 'x-ratelimit-reset-tokens': '1ms',
-- 'x-request-id': 'req_01m1rr64qsedav3cxsbzqp98md',
-- 'x-should-retry': 'false',
-- via: '1.1 google',
-- 'cf-cache-status': 'DYNAMIC',
-- 'set-cookie': '_cf_bm=niUyGimJKfZIZGKJR84dZ1d8yWu1RKbXp3SYkgXLKfc-1788610810.6045637-1.0.1.1-3xfEaB.B6D0UrmjRyWIiEwJQ1rLBnpN9dP2YTwtDXS6wGvIkPVzR7ODgpAaQ8k78VsE363ZGiLRIBPKNb4EqDTOqjxyuKQdkg06sdKhzgxpOOD0KAySc7WVY.AU9jNg; HttpOnly; SameSite=None; Secure; Path=/; Domain=groq.com; Expires=Sat, 05 Sep 2026 12:50:10 GMT',
-- 'strict-transport-security': 'max-age=15552000',
-- 'cf-ray': 'a3652fbe4d1c18e1-FRA',
-- 'alt-svc': 'h3=":443"; ma=86400'
-- },
-- error: {
-- error: {
-- message: "Request too large for model qwen/qwen3.6-27b in organization org_01ktt6pk7wedtsby9ysqq32py1 service tier on_demand on output tokens per minute (OTPM): Limit 1000, Requested 1134. The request's expected output tokens exceed the enforced limit; reduce max_tokens (or the request's expected output) and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing",
-- type: 'tokens',
-- code: 'rate_limit_exceeded'
-- }
-- }
-- }

-- BESIDES , THERE IS AN ISSUE WHEN THE USER CHANGES HIS MEDIATOR LANGUAGE - THE EXISTING DB PDF FILES SILL IN THE OLD MEDIATOR LANGUAGE WHICH IS UNACCEPTABLE! FIX THIS TOO!!!

-- AND ENSURE THE PROMPTS ARE UNIVERSAL FOR ALL LANGUAGES SO THAT OUR RESPONSES TO USERS HAD NOT DEPEND ON THE HARDCODED LANGUAGE AND INSTEAD WERE RESPECTIVE TO THEIR LEARNING  TONGUE AND MEDIATOR LANGUAGE - MAKE IT SO 
-- THAT THE RESPONSES  WERE ALWAYS IN THE LANGUAGE HE CHOSES FOR MEDIATOR IF HIS LEVEL IS NOT ADVANCED - I SAY IT SINCE AS FAR AS I SEE CURRENTLY THIS IS BROKEN AND THE USER GETS ANSWERS IN DIFFERENT (ALMOST ANY OR THE LEARNIING ONE) LANGUAGES.  MAKE IT ALSO SO THAT THE RULES OF ANY LANGUAGE WILL BE RESPECTED IN PROMPTS NO MATTER IF IT'S CYRILLIC, LATIN-BASED, ARABIC, URDU, JAPANESE, CHINESE, MANDARIN, KOREAN, OR ANY OTHER TONGUE!


-- ALSO DO MIND THAT THE INTERNAL ERROR ISSUE STILL PERSISTS FOR MINIAPP AND FOR WEB APP EITHER - WE CANNOT DOWNLOAD COMPLETE GRAMMAR BOOK BY CLICKING THE PDF IN BUTTON MINIAPPNOR DO IT IN WEBAPP CLICKING THAT BUTTON! FIX THIS TOO!!!