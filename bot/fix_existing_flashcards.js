// fix_existing_flashcards.js
//
// One-off migration script: re-processes flashcards currently stored in the database so:
// 1. `word` and `initial_form` hold the pure uninflected dictionary headword / infinitive
//    (e.g., Russian: "вопроса" -> "вопрос", "горшками" -> "горшок", "исправь" -> "исправить").
// 2. `transcription` holds the IPA phonetic transcription and reading guide with stress.
// 3. `pronunciation_rule` holds the key pronunciation/orthography rule for that word.
// 4. `grammar_rule`, `orthography_rule`, `syntax_rule`, and `semantics_note` are populated.
// 5. `part_of_speech` and `synonyms` are extracted and populated.
// 6. `correction` holds an accurate translation (never identical to the target word).
// 7. Deletes corrupted transliteration slang ("BIL", "SHO", "TEM", "TOGO"), single-letter noise,
//    and hallucinated words ("думавладельце").
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

// Words to immediately delete as noise, slang, single-letter particles, or hallucinations
const NOISE_WORDS = new Set([
  "bil", "sho", "tem", "togo", "думавладельце", "не", "о", "а", "в", "и", "эрнана кортеса"
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

async function reprocessWordToRichLinguistics(languageName, word, oldMeaning) {
  const prompt = `You are an expert lexicographer, grammarian, and dictionary editor for ${languageName}.

A student saved the word or phrase: "${word}" (existing translation: "${oldMeaning || ""}").

TASK:
1. "lemma": Convert this word into its PURE UNINFLECTED DICTIONARY HEADWORD / INFINITIVE:
   - Nouns MUST be singular nominative (e.g. Russian: "вопроса" -> "вопрос", "горшками" -> "горшок", "крышей" -> "крыша").
   - Verbs MUST be bare infinitive (e.g. Russian: "исправь" -> "исправить", "читал" -> "читать"; German: "heißt" -> "heißen").
   - Adjectives MUST be masculine singular nominative (e.g. Russian: "разными" -> "разный", "черепичной" -> "черепичный").
   - Pronouns MUST be dictionary headword (e.g. Russian: "мои" -> "мой", "этого" -> "этот").
   - If the input is transliteration slang (like "BIL", "SHO", "TEM"), convert to native script or set "is_noise": true.
2. "part_of_speech": noun | verb | adjective | adverb | pronoun | phrase.
3. "transcription": IPA + approximate phonetic reading with stress indicated.
4. "pronunciation_rule": 1 sentence explaining key phonetic rules (stress placement, reductions, silent letters, umlauts).
5. "grammar_rule": Morphological properties (gender, declension/conjugation pattern, irregular stems).
6. "orthography_rule": Spelling rule, letter combinations, capitalization, or diacritics.
7. "syntax_rule": Case government, preposition requirements, and word order constraints.
8. "semantics_note": Nuances, register, false friends, collocations, and contextual usage notes.
9. "meaning": Accurate English meaning/translation of the lemma (NEVER identical to the lemma).
10. "synonyms": 2-3 comma-separated synonyms.
11. "is_noise": Set to true if the input is a single-letter preposition/particle ("о", "а", "не"), gibberish, or proper name.

Return ONLY a JSON object:
{
  "is_noise": false,
  "lemma": "...",
  "part_of_speech": "...",
  "transcription": "...",
  "pronunciation_rule": "...",
  "grammar_rule": "...",
  "orthography_rule": "...",
  "syntax_rule": "...",
  "semantics_note": "...",
  "meaning": "...",
  "synonyms": "..."
}`;

  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 650,
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
      grammarRule: parsed.grammar_rule?.trim() || null,
      orthographyRule: parsed.orthography_rule?.trim() || null,
      syntaxRule: parsed.syntax_rule?.trim() || null,
      semanticsNote: parsed.semantics_note?.trim() || null,
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

    // 1. Immediate purge of known noise words or single-letter particles
    if (NOISE_WORDS.has(lowerWord) || cleanWord.length <= 1) {
      console.log(`[delete] #${card.id} "${card.word}" — noise or single-letter particle`);
      deletedCount++;
      if (APPLY) {
        await pool.query("DELETE FROM flashcards WHERE id = $1", [card.id]);
      }
      continue;
    }

    const languageName = LANGUAGE_NAMES[card.language] || card.language || "the target language";

    try {
      const result = await reprocessWordToRichLinguistics(languageName, card.word, card.correction);

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
               pronunciation_rule = COALESCE(pronunciation_rule, $7),
               grammar_rule = COALESCE(grammar_rule, $8),
               orthography_rule = COALESCE(orthography_rule, $9),
               syntax_rule = COALESCE(syntax_rule, $10),
               semantics_note = COALESCE(semantics_note, $11)
           WHERE id = $12`,
          [
            result.lemma,
            card.word,
            result.meaning,
            result.partOfSpeech,
            result.synonyms,
            result.transcription,
            result.pronunciationRule,
            result.grammarRule,
            result.orthographyRule,
            result.syntaxRule,
            result.semanticsNote,
            card.id,
          ]
        );
      }
    } catch (err) {
      console.error(`[error]  #${card.id} "${card.word}":`, err.message);
      skippedCount++;
    }

    // Small delay to stay well within Groq rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`MIGRATION SUMMARY (${APPLY ? "APPLIED TO DATABASE" : "DRY RUN"}):`);
  console.log(`  • Updated: ${updatedCount} words lemmatized & enriched with full linguistics`);
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
