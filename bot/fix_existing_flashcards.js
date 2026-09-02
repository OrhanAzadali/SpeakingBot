// fix_existing_flashcards.js
//
// One-off migration: re-processes every flashcard already in the DB so
// `word` holds a grammatically correct phrase (not your original typo/error)
// and `correction` holds its actual English meaning (not a near-duplicate).
//
// Run this ONCE, locally, from your `bot` folder (needs the same
// GROQ_API_KEY and DATABASE_URL as the bot itself — reads them from
// bot/.env automatically):
//
//   cd bot
//   node fix_existing_flashcards.js            # dry run — prints changes, writes nothing
//   node fix_existing_flashcards.js --apply     # actually updates the DB
//
// Safe to interrupt (Ctrl+C) and re-run — it just re-checks every row again.

import "dotenv/config";
import Groq from "groq-sdk";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const APPLY = process.argv.includes("--apply");

// Full language names, same mapping as ai.js's LANGUAGES — needed because the
// flashcards table stores the short key (e.g. "spanish"), but the prompt
// below needs to say "Spanish" to the model.
const LANGUAGE_NAMES = {
  spanish: "Spanish", english: "English", french: "French", german: "German",
  japanese: "Japanese", italian: "Italian", portuguese: "Portuguese", russian: "Russian",
  arabic: "Arabic", chinese: "Chinese (Mandarin)", hindi: "Hindi", korean: "Korean",
  turkish: "Turkish", dutch: "Dutch", polish: "Polish", swedish: "Swedish",
  vietnamese: "Vietnamese", indonesian: "Indonesian", thai: "Thai", filipino: "Filipino",
  ukrainian: "Ukrainian", malay: "Malay", romanian: "Romanian", greek: "Greek",
  czech: "Czech", hungarian: "Hungarian", tamil: "Tamil", telugu: "Telugu",
  bengali: "Bengali", hebrew: "Hebrew", norwegian: "Norwegian", danish: "Danish",
  finnish: "Finnish", slovak: "Slovak", catalan: "Catalan", persian: "Persian",
  marathi: "Marathi", swahili: "Swahili", afrikaans: "Afrikaans", azerbaijani: "Azerbaijani",
};

function normalize(str) {
  return String(str || "").toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

function tooSimilar(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  return levenshtein(na, nb) / Math.max(na.length, nb.length) <= 0.3;
}

async function reprocess(languageName, word, oldMeaning) {
  const prompt = `You are a meticulous ${languageName} grammar corrector for a language-learning flashcard app.

You are given a word or phrase a student saved while learning ${languageName}. It may already be correct, or it may contain a grammar/spelling/conjugation error.

Respond with EXACTLY one line in this format, nothing else:
CORRECTED_FORM:::ENGLISH_MEANING

Rules:
- CORRECTED_FORM must be the grammatically correct, properly spelled ${languageName} version of the input (fix any error; if it's already correct, return it unchanged with correct accents/diacritics).
- ENGLISH_MEANING must be the English translation/meaning of CORRECTED_FORM — never a same-language respelling. It must be clearly different text from CORRECTED_FORM.
- If the input isn't real, recognizable ${languageName} vocabulary at all, respond with exactly: SKIP

Input: "${word}"`;

  const res = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 100,
  });

  const raw = res.choices[0].message.content.trim();
  if (raw === "SKIP" || !raw.includes(":::")) return null;

  const [corrected, meaning] = raw.split(":::").map((s) => s.trim());
  if (!corrected || !meaning || tooSimilar(corrected, meaning)) return null;

  return { corrected, meaning };
}

async function main() {
  const { rows } = await pool.query("SELECT id, user_id, word, correction, language FROM flashcards ORDER BY id");
  console.log(`Found ${rows.length} flashcards. Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}\n`);

  let changed = 0, skipped = 0, errored = 0;

  for (const card of rows) {
    const languageName = LANGUAGE_NAMES[card.language] || card.language || "the target language";
    try {
      const result = await reprocess(languageName, card.word, card.correction);
      if (!result) {
        console.log(`[skip] #${card.id} "${card.word}" — couldn't confidently re-process`);
        skipped++;
        continue;
      }

      const wordChanged = result.corrected !== card.word;
      const meaningChanged = result.meaning !== card.correction;
      if (!wordChanged && !meaningChanged) {
        console.log(`[ok]   #${card.id} "${card.word}" — already fine`);
        continue;
      }

      console.log(`[fix]  #${card.id} "${card.word}" -> "${result.corrected}" | meaning: "${card.correction}" -> "${result.meaning}"`);
      changed++;

      if (APPLY) {
        await pool.query(
          "UPDATE flashcards SET word = $1, correction = $2 WHERE id = $3",
          [result.corrected, result.meaning, card.id]
        );
      }
    } catch (err) {
      console.error(`[error] #${card.id}:`, err.message);
      errored++;
    }
    // Small delay to stay well under Groq's rate limits on a big table.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\nDone. ${changed} would be changed${APPLY ? " (and were written)" : ""}, ${skipped} skipped, ${errored} errored.`);
  if (!APPLY && changed > 0) {
    console.log(`Re-run with --apply to actually write these changes to the database.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
