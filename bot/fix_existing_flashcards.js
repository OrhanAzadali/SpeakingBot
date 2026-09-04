// fix_existing_flashcards.js
//
// One-off migration script: re-processes flashcards currently stored in the database so:
// 1. `word` and `initial_form` hold the pure uninflected dictionary headword / infinitive
//    (e.g., Russian: "вопроса" -> "вопрос", "горшками" -> "горшок", "исправь" -> "исправить").
// 2. `transcription` holds the IPA phonetic transcription and reading guide with stress.
// 3. `pronunciation_rule` holds the key pronunciation/orthography rule for that word.
// 4. `part_of_speech` and `synonyms` are extracted and populated.
// 5. `correction` holds an accurate translation (never identical to the target word).
//
// Usage:
//   node fix_existing_flashcards.js            # Dry run — prints proposed updates, writes nothing
//   node fix_existing_flashcards.js --apply    # Actually writes the changes to Supabase
//
// Safe to interrupt (Ctrl+C) and resume anytime.

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

// Words to immediately delete as noise/transliteration slang
const NOISE_WORDS = new Set([
  "bil", "sho", "tem", "togo", "думавладельце", "не", "о", "а", "эрнана кортеса"
]);

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonObject(raw) {
  if (!raw) throw new Error("Empty response from AI");
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

async function reprocessWordToRichLemma(languageName, word, oldMeaning) {
  const prompt = `You are an expert lexicographer and dictionary editor for ${languageName}.

A student saved the word or phrase: "${word}" (existing translation: "${oldMeaning || ""}").

TASK:
1. "lemma": Convert this word into its PURE UNINFLECTED DICTIONARY HEADWORD / INFINITIVE:
   - Nouns MUST be singular nominative (e.g. Russian: "вопроса" -> "вопрос", "горшками" -> "горшок", "крышей" -> "крыша").
   - Verbs MUST be bare infinitive (e.g. Russian: "исправь" -> "исправить", "читал" -> "читать"; German: "heißt" -> "heißen").
   - Adjectives MUST be masculine singular nominative (e.g. Russian: "разными" -> "разный", "черепичной" -> "черепичный").
   - Pronouns MUST be dictionary lemma (e.g. Russian: "мои" -> "мой", "этого" -> "этот").
   - If the input is transliteration slang (like "BIL", "SHO", "TEM"), convert to native script (e.g. "был", "что", "тем") or set "is_noise": true.
2. "part_of_speech": noun | verb | adjective | adverb | pronoun | phrase.
3. "transcription": IPA + approximate phonetic reading with stress indicated.
4. "pronunciation_rule": 1 sentence explaining the key pronunciation/phonetic rule (stress placement, silent letters, reductions, umlauts).
5. "meaning": Accurate English meaning/translation of the lemma (NEVER identical to the lemma).
6. "synonyms": 2-3 comma-separated synonyms.
7. "is_noise": Set to true if the input is a single-letter preposition/particle ("о", "а", "не"), gibberish, or proper name.

Return ONLY a JSON object:
{
  "is_noise": false,
  "lemma": "...",
  "part_of_speech": "...",
  "transcription": "...",
  "pronunciation_rule": "...",
  "meaning": "...",
  "synonyms": "..."
}`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 350,
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));

    if (parsed.is_noise) return { isNoise: true };

    const cleanLemma = String(parsed.lemma || "").trim();
    const cleanMeaning = String(parsed.meaning || "").trim();

    if (!cleanLemma || !cleanMeaning || normalize(cleanLemma) === normalize(cleanMeaning)) {
      return null;
    }

    return {
      isNoise: false,
      lemma: cleanLemma,
      partOfSpeech: parsed.part_of_speech?.trim() || "word",
      transcription: parsed.transcription?.trim() || null,
      pronunciationRule: parsed.pronunciation_rule?.trim() || null,
      meaning: cleanMeaning,
      synonyms: parsed.synonyms?.trim() || null,
    };
  } catch (err) {
    console.error(`AI call failed for "${word}":`, err.message);
    return null;
  }
}

async function main() {
  const { rows } = await pool.query(
    "SELECT id, user_id, word, correction, initial_form, used_form, language FROM flashcards ORDER BY id"
  );
  console.log(`Found ${rows.length} flashcards in database. Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY RUN (no writes)"}\n`);

  let updatedCount = 0;
  let deletedCount = 0;
  let skippedCount = 0;

  for (const card of rows) {
    const cleanWord = String(card.word || "").trim();
    const lowerWord = cleanWord.toLowerCase();

    // 1. Check known noise/slang words to purge
    if (NOISE_WORDS.has(lowerWord) || cleanWord.length <= 1) {
      console.log(`[delete] #${card.id} "${card.word}" — noise or particle`);
      deletedCount++;
      if (APPLY) {
        await pool.query("DELETE FROM flashcards WHERE id = $1", [card.id]);
      }
      continue;
    }

    const languageName = LANGUAGE_NAMES[card.language] || card.language || "the target language";

    try {
      const result = await reprocessWordToRichLemma(languageName, card.word, card.correction);

      if (!result) {
        console.log(`[skip]   #${card.id} "${card.word}" — could not confidently lemmatize`);
        skippedCount++;
        continue;
      }

      if (result.isNoise) {
        console.log(`[delete] #${card.id} "${card.word}" — classified as noise by AI`);
        deletedCount++;
        if (APPLY) {
          await pool.query("DELETE FROM flashcards WHERE id = $1", [card.id]);
        }
        continue;
      }

      console.log(
        `[update] #${card.id} "${card.word}" -> Lemma: "${result.lemma}" [${result.partOfSpeech}] | ` +
        `Phonetics: ${result.transcription || "n/a"} | Meaning: "${result.meaning}"`
      );
      updatedCount++;

      if (APPLY) {
        await pool.query(
          `UPDATE flashcards
           SET word = $1,
               initial_form = $1,
               used_form = COALESCE(used_form, $2),
               correction = $3,
               part_of_speech = $4,
               synonyms = COALESCE(synonyms, $5),
               transcription = COALESCE(transcription, $6),
               pronunciation_rule = COALESCE(pronunciation_rule, $7)
           WHERE id = $8`,
          [
            result.lemma,
            card.word,
            result.meaning,
            result.partOfSpeech,
            result.synonyms,
            result.transcription,
            result.pronunciationRule,
            card.id,
          ]
        );
      }
    } catch (err) {
      console.error(`[error]  #${card.id} "${card.word}":`, err.message);
      skippedCount++;
    }

    // Small delay to comfortably stay within Groq rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`MIGRATION SUMMARY (${APPLY ? "APPLIED TO DATABASE" : "DRY RUN"}):`);
  console.log(`  • Updated: ${updatedCount} words lemmatized & enriched with phonetics`);
  console.log(`  • Deleted: ${deletedCount} noise/slang/particle records removed`);
  console.log(`  • Skipped: ${skippedCount} records`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  if (!APPLY && (updatedCount > 0 || deletedCount > 0)) {
    console.log("To write these changes to Supabase, re-run with the --apply flag:");
    console.log("  node fix_existing_flashcards.js --apply\n");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error during migration:", err);
  process.exit(1);
});