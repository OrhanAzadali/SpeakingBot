// YOUR REVISED VERSION - YET STILL BROKEN:
// ai.js — Complete, Un-truncated Language Immersion & Linguistic Engine
// ai.js — Complete, Un-truncated Language Immersion & Linguistic Engine
import Groq, { toFile } from "groq-sdk";
import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap, saveGrammarTopic } from "./db.js";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { unlink } from "fs/promises";
import { tmpdir } from "os";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Active, non-decommissioned Groq production models.
// Active Groq production models. Obsolete llama3-8b-8192 and mixtral have been removed.
const CHAT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-20b"
];
const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

async function withModelFallback(models, callFn) {
  let lastErr;
  for (const model of models) {
    try {
      return await callFn(model);
    } catch (err) {
      lastErr = err;
      console.warn(`Model "${model}" attempt failed (${err?.status || err?.message}). Cycling to next model...`);
      continue;
    }
  }
  throw lastErr;
}

export const LANGUAGES = {
  spanish: "Spanish", english: "English", french: "French", german: "German",
  japanese: "Japanese", italian: "Italian", portuguese: "Portuguese", russian: "Russian",
  arabic: "Arabic", chinese: "Chinese (Mandarin)", hindi: "Hindi", korean: "Korean",
  turkish: "Turkish", dutch: "Dutch", polish: "Polish", swedish: "Swedish",
  vietnamese: "Vietnamese", indonesian: "Indonesian", thai: "Thai", filipino: "Filipino",
  ukrainian: "Ukrainian", malay: "Malay", romanian: "Romanian", greek: "Greek",
  czech: "Czech", hungarian: "Hungarian", tamil: "Tamil", telugu: "Telugu",
  bengali: "Bengali", hebrew: "Hebrew", norwegian: "Norwegian", danish: "Danish",
  finnish: "Finnish", slovak: "Slovak", catalan: "Catalan", persian: "Persian",
  marathi: "Marathi", swahili: "Swahili", afrikaans: "Afrikaans", azerbaijani: "Azerbaijani"
};

// Best Edge TTS neural voice for each supported language
const TTS_VOICES = {
  spanish: "es-ES-AlvaroNeural", english: "en-US-GuyNeural", french: "fr-FR-HenriNeural",
  german: "de-DE-ConradNeural", japanese: "ja-JP-KeitaNeural", italian: "it-IT-DiegoNeural",
  portuguese: "pt-BR-AntonioNeural", russian: "ru-RU-DmitryNeural", arabic: "ar-SA-HamedNeural",
  chinese: "zh-CN-YunxiNeural", hindi: "hi-IN-MadhuramNeural", korean: "ko-KR-InGookNeural",
  turkish: "tr-TR-AhmetNeural", dutch: "nl-NL-MaartenNeural", polish: "pl-PL-MarekNeural",
  swedish: "sv-SE-MattiasNeural", vietnamese: "vi-VN-NamMinhNeural", indonesian: "id-ID-ArdiNeural",
  thai: "th-TH-NiwatNeural", filipino: "fil-PH-AngeloNeural", ukrainian: "uk-UA-OstapNeural",
  malay: "ms-MY-OsmanNeural", romanian: "ro-RO-EmilNeural", greek: "el-GR-NestorasNeural",
  czech: "cs-CZ-AntoninNeural", hungarian: "hu-HU-TamasNeural", tamil: "ta-IN-ValluvarNeural",
  telugu: "te-IN-MohanNeural", bengali: "bn-IN-BashkarNeural", hebrew: "he-IL-AvriNeural",
  norwegian: "nb-NO-FinnNeural", danish: "da-DK-JeppeNeural", finnish: "fi-FI-HarriNeural",
  slovak: "sk-SK-LukasNeural", catalan: "ca-ES-EnricNeural", persian: "fa-IR-FaridNeural",
  marathi: "mr-IN-ManoharNeural", swahili: "sw-KE-RafikiNeural", afrikaans: "af-ZA-WillemNeural",
  azerbaijani: "az-AZ-BabekNeural"
};

function extractJsonObject(raw) {
  if (!raw) throw new Error("Empty response from AI");
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

// ── Strict Lemma & Linguistic Accuracy Rules ──────────────────────────────────
function linguisticAccuracyBlock(language) {
  return `LINGUISTIC ACCURACY & STRICT BASE LEMMA MANDATE:
    - Target language: ${language}.
    - ALWAYS use standard orthography of ${language}, including every diacritic and accent mark.
    - STRICT BASE LEMMA / INFINITIVE RULE FOR DATABASE STORAGE:
  When extracting vocabulary for flashcards, "initial_form" MUST ALWAYS be the uninflected dictionary headword:
  * Nouns: MUST be singular nominative in native script (e.g. Russian: "вопрос", "дружба"; German: "Buch"; Arabic: كتاب; Japanese: 本).
  * Verbs: MUST be bare infinitive (e.g. Russian: "исправить", "читать"; German: "lesen"; Spanish: "tener").
  * Adjectives: MUST be masculine singular nominative base form.
  * Pronouns: MUST be dictionary headword.
  * NEVER save Latin transliterations (reject "BIL", "SHO", "TEM", "TOGO") — convert to native script or discard!
  * NEVER save single-letter particles, prepositions ("о", "а", "не", "в") or proper names as flashcards!
 - IN-CONTEXT MORPHOLOGICAL ADJUSTMENT RULE (FOR QUIZZES & DRILLS):
  When using stored vocabulary words inside questions, example sentences, cloze tests, or drills:
  * DO NOT drop an uninflected lemma into a sentence where syntax requires a declined or conjugated form!
  * You MUST grammatically adjust, decline, and conjugate the word to match the sentence's syntax, tense, gender, and case!`;
}

// ── Call 1: Spoken Conversation with Audio/Text Separation for Beginners ──────
function buildConversationPrompt(language, level, mediatorLanguage = "english") {
  const isBeginner = level.toLowerCase().includes("beginner");
  const isIntermediate = level.toLowerCase().includes("intermediate");
  const isAdvanced = level.toLowerCase().includes("advanced");

  const explanationLang = isAdvanced ? language : mediatorLanguage;

  const grammarBreakdownEngine = `
DEEP GRAMMATICAL, PHONETIC & SYNTACTIC BREAKDOWN ENGINE:
Whenever the student asks to explain words, conjugations, declensions, or grammar rules:
OR whenever introducing essential new verbs/nouns to Beginners/Intermediates:
You MUST provide a structured, in-depth linguistic breakdown in ${explanationLang.toUpperCase()}:

Structure your breakdown cleanly:
1. Meaning & Part of Speech: Grammatical role and primary definition.
2. Phonetics & Transcription: IPA transcription + phonetic approximation in ${explanationLang} characters + stress placement indicator.
3. Pronunciation Rule: Specific phonetic rule (stress shifts, reductions, silent letters, diphthongs, umlauts).
4. Base Form / Lemma: Bare Infinitive (for verbs) or Nominative Singular with article (for nouns).
5. Full Conjugation or Declension Paradigm:
   - For Verbs: Complete person/number conjugation table (1st, 2nd, 3rd person singular and plural) in the relevant tense with translations for every line.
   - For Nouns: Gender, singular/plural, cases (Nominative, Genitive, Dative, Accusative) with articles and translations.
6. Syntax & Usage: Prepositional government, cases required, word order.
7. Contextual Example Sentences: 2 natural examples in ${language} with translations in ${explanationLang}.
8. Actionable Practice Exercise: 1 quick drill for immediate reinforcement.
`;

  const scaffoldingDirective = isBeginner
    ? `BEGINNER SCAFFOLDING & AUDIO SEPARATION MANDATE:
- The student is a complete BEGINNER. Their mediator language is ${mediatorLanguage.toUpperCase()}.
- If the student expresses confusion (e.g. "не понимаю", "i don't understand", "помоги"), asks for translation, or requests help in ${mediatorLanguage}:
  1. NEVER stubbornly stay only in ${language}! Use ${mediatorLanguage} to bridge the gap: explain what the phrase meant, translate it clearly, and give an easy template to reply.
- AUDIO/TEXT SEPARATION (CRITICAL):
  To prevent the ${language} Text-to-Speech voice engine from mispronouncing ${mediatorLanguage} words, wrap the pure ${language} sentences to be read aloud inside [SPEECH]...[/SPEECH] tags!`
    : (isIntermediate
      ? `INTERMEDIATE IMMERSION:
- Conduct conversation primarily in ${language}.
- When student asks for grammatical explanations, explain the grammar/conjugation in ${mediatorLanguage}, but keep conversational follow-ups in ${language}.`
      : `ADVANCED IMMERSION:
- Conduct 100% of the conversation and all grammatical explanations in ${language}. Maintain full target-language immersion.`);

  return `You are a friendly, expert, and voice-enabled ${language} language coach.
The student's level is ${level}.
The student's mediator language is ${mediatorLanguage}.

${linguisticAccuracyBlock(language)}
${grammarBreakdownEngine}
${scaffoldingDirective}

Keep conversational turns natural and supportive. Plain text only: no markdown formatting that disrupts TTS.`;
}

// ── Call 2: Rich Grammar, Syntax, Orthography & Semantics Analysis ────────────
function buildAnalysisPrompt(language, level, mediatorLanguage = "english") {
  const isAdvanced = level.toLowerCase().includes("advanced");
  const responseLang = isAdvanced ? language : mediatorLanguage;

  return `You are a master ${language} lexicographer, syntactician, and grammar analyst.
Student level: ${level}.
Mediator language: ${mediatorLanguage}.

LANGUAGE MANDATE:
Write all explanations, corrections, meanings, and linguistic rules strictly in ${responseLang.toUpperCase()}.

META-COMMUNICATION & HELP REQUEST HANDLING:
- If the student wrote in ${mediatorLanguage} to ask for help, request translation, or state that they don't understand:
  * Set "correctionText" to a supportive acknowledgment in ${mediatorLanguage}.
  * Set "mistakes": [].

CRITICAL GRAMMAR TOPIC EXTRACTION MANDATE:
- Whenever the student asks to explain grammar, words, conjugations, declensions, syntax, or cases, OR whenever this turn explains a grammatical rule/table:
  YOU MUST POPULATE "grammar_topic" with a complete, structured breakdown! Otherwise, set "grammar_topic": null.

FORMATTING RULES:
- "explanation": Write clean Markdown headers (###) and tables. NEVER output raw JSON curly braces or string objects like {"target": ...} inside the explanation text!
- "examples": Provide an array of structured objects: [{ "target": "...", "translation": "...", "note": "..." }]

Return your response strictly as a single JSON object:
{
  "correctionText": "Correction in ${responseLang} or '✅ Perfect!'",
  "grammar_topic": null,
  "mistakes": [
    {
      "initial_form": "Pure dictionary lemma in ${language} native script",
      "used_form": "The inflected word exactly as it appeared in the sentence",
      "part_of_speech": "noun | verb | adjective | adverb | pronoun | phrase | preposition",
      "transcription": "IPA + phonetic approximation with stress",
      "pronunciation_rule": "Phonetic rule in ${responseLang}",
      "grammar_rule": "Morphological pattern in ${responseLang}",
      "orthography_rule": "Spelling rules in ${responseLang}",
      "syntax_rule": "Case government in ${responseLang}",
      "semantics_note": "Nuances in ${responseLang}",
      "meaning": "Definition in ${responseLang}",
      "synonyms": "Comma-separated synonyms",
      "explanation": "Summary note in ${responseLang}",
      "sentence": "Full corrected sentence with the word wrapped in <u>word</u>"
    }
  ]
}`;
}

// ── Call 3: 4-Skill Drill Generator ───────────────────────────────────────────

// ── Call 3: 4-Skill Drill Generator (Anti-Placeholder, Fully Multilingual) ─────
export async function generateSkillDrill(skill, targetLanguage, mediatorLanguage = "english", level = "Intermediate", drillType = "short") {
  const count = drillType === "huge" ? 10 : 5;
  const isAdvanced = String(level).toLowerCase().includes("advanced");
  const isIntermediate = String(level).toLowerCase().includes("intermediate");

  // Instruction language: Target language for Advanced/Intermediate; Mediator language for Beginners
  const promptLang = (isAdvanced || isIntermediate) ? targetLanguage : mediatorLanguage;

  const prompt = `You are a certified CEFR curriculum designer creating an authentic ${drillType.toUpperCase()} ${skill.toUpperCase()} drill.
Target language being tested: ${targetLanguage}.
Student level: ${level}.
Instruction & Question prompt language: ${promptLang}.

CRITICAL ANTI-PLACEHOLDER & QUALITY MANDATE:
- NEVER use placeholder strings like "Option 1", "Option 2", "Verb 1", "1", "2", "Word", or "Sentence".
- Every passage, dialogue, question prompt, and option MUST BE authentic, natural, grammatically correct language!
- ABSOLUTELY NO THIRD LANGUAGES (If target is Russian and mediator is English, use only Russian and English).
- Cloze gaps (____) must test words grammatically inflected to match sentence syntax.

SKILL PURITY SPECIFICATIONS:
- If skill is "listening":
  * "audio_script": Natural spoken narrative or realistic dialogue 100% in ${targetLanguage} (35-60 words) to be read aloud via TTS.
  * "prompt": Comprehension question in ${promptLang} asking about a concrete factual detail from that spoken passage.
  * "options": 4 authentic, distinct, plausible answers in ${promptLang}.
  * "correct_answer": Must match exactly one of the 4 options.
- If skill is "reading":
  * "reading_passage": A coherent 50-80 word paragraph 100% in ${targetLanguage}.
  * "prompt": Specific analytical or factual comprehension question in ${promptLang}.
  * "options": 4 authentic answer choices in ${promptLang}.
  * "correct_answer": Must match exactly one of the 4 options.
- If skill is "speaking":
  * "prompt": A realistic communicative scenario in ${promptLang} prompting the student to speak 2-3 full sentences in ${targetLanguage}.
- If skill is "writing":
  * "prompt": A structured communicative composition task in ${promptLang} prompting the student to write 2-4 sentences in ${targetLanguage}.

Generate EXACTLY ${count} questions.
Return strictly a single valid JSON object:
{
  "skill": "${skill}",
  "drill_type": "${drillType}",
  "questions": [
    {
      "id": 1,
      "type": "${skill === 'speaking' ? 'voice' : (skill === 'writing' ? 'open' : 'choice')}",
      ${skill === 'listening' ? `"audio_script": "Natural spoken text in ${targetLanguage}...",` : ""}
      ${skill === 'reading' ? `"reading_passage": "Natural paragraph in ${targetLanguage}...",` : ""}
      "prompt": "Authentic question in ${promptLang}...",
      ${skill === 'listening' || skill === 'reading' ? `"options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_answer": "A) ..."` : ""}
    }
  ]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    const questions = parsed.questions || Object.values(parsed).find(Array.isArray);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("Invalid drill questions structure");
    return { skill, drill_type: drillType, questions };
  } catch (err) {
    console.warn(`generateSkillDrill fallback activated for ${skill} in ${targetLanguage}:`, err.message);

    const langLower = String(targetLanguage || "").toLowerCase();
    const isRu = langLower.includes("russ");
    const isDe = langLower.includes("germ");
    const isEs = langLower.includes("span");
    const isFr = langLower.includes("fren");

    // Dynamic, authentic language fallback (zero placeholders)
    if (skill === "listening") {
      const audioText = isRu
        ? "Здравствуйте! Наш скорый поезд отправляется с третьего пути ровно в четырнадцать часов тридцать минут. Пожалуйста, не забывайте ваши билеты и документы."
        : (isDe
          ? "Guten Tag! Unser ICE nach Berlin fährt um vierzehn Uhr dreißig von Gleis drei ab. Bitte halten Sie Ihre Fahrkarten bereit."
          : (isEs
            ? "¡Hola! El tren con destino a Madrid saldrá del andén tres a las dos y media de la tarde. Por favor, tengan sus billetes preparados."
            : "Hello! The express train to Central Station departs from platform three at two thirty in the afternoon. Please have your tickets ready."));

      const promptText = (isAdvanced || isIntermediate)
        ? (isRu ? "В какое время отправляется поезд?" : (isDe ? "Um wie viel Uhr fährt der Zug ab?" : (isEs ? "¿A qué hora sale el tren?" : "What time does the train depart?")))
        : (isRu ? "В какое время отправляется поезд согласно объявлению?" : "What time does the train depart according to the announcement?");

      const options = ["A) 13:30", "B) 14:30", "C) 15:00", "D) 16:30"];
      return {
        skill,
        drill_type: drillType,
        questions: [{ id: 1, type: "choice", audio_script: audioText, prompt: promptText, options, correct_answer: "B) 14:30" }]
      };
    }

    if (skill === "reading") {
      const passage = isRu
        ? "Санкт-Петербург был основан Петром Первым в 1703 году. Город известен своими прекрасными каналами, мостами и богатыми музеями, среди которых Эрмитаж является самым известным."
        : (isDe
          ? "Deutschland liegt in der Mitte Europas und besteht aus sechzehn Bundesländern. Berlin ist die Hauptstadt und zugleich die bevölkerungsreichste Stadt des Landes."
          : (isEs
            ? "España es un país situado en el suroeste de Europa. Es conocido mundialmente por su rica historia, su gastronomía variada y sus festivales tradicionales."
            : "The library is located in the center of the city. It contains thousands of historical manuscripts and modern educational books."));

      const promptText = (isAdvanced || isIntermediate)
        ? (isRu ? "В каком году был основан Санкт-Петербург?" : (isDe ? "Aus wie vielen Bundesländern besteht Deutschland?" : (isEs ? "¿En qué parte de Europa está situada España?" : "Where is the library located?")))
        : (isRu ? "В каком году был основан город согласно прочитанному тексту?" : "What fact is stated in the reading passage?");

      const options = isRu
        ? ["A) В 1689 году", "B) В 1703 году", "C) В 1725 году", "D) В 1812 году"]
        : (isDe
          ? ["A) Aus 12 Ländern", "B) Aus 14 Ländern", "C) Aus 16 Ländern", "D) Aus 18 Ländern"]
          : (isEs
            ? ["A) En el norte", "B) En el suroeste", "C) En el este", "D) En el centro"]
            : ["A) In the suburbs", "B) In the center of the city", "C) Near the airport", "D) Outside town"]));

      const correct = isRu ? "B) В 1703 году" : (isDe ? "C) Aus 16 Ländern" : (isEs ? "B) En el suroeste" : "B) In the center of the city"));

      return {
        skill,
        drill_type: drillType,
        questions: [{ id: 1, type: "choice", reading_passage: passage, prompt: promptText, options, correct_answer: correct }]
      };
    }

    if (skill === "speaking") {
      const promptText = (isAdvanced || isIntermediate)
        ? (isRu ? "Расскажите в 2-3 предложениях о вашем любимом времени года и почему оно вам нравится." : (isDe ? "Erzählen Sie in 2-3 Sätzen über Ihre Lieblingsjahreszeit und warum Sie sie mögen." : "Describe your favorite season in 2-3 sentences and explain why you like it."))
        : (isRu ? "Опишите ваше любимое время года (2-3 предложения на изучаемом языке)." : `Describe your favorite season in 2-3 sentences in ${targetLanguage}.`);

      return {
        skill,
        drill_type: drillType,
        questions: [{ id: 1, type: "voice", prompt: promptText }]
      };
    }

    // Writing drill fallback
    const promptText = (isAdvanced || isIntermediate)
      ? (isRu ? "Напишите короткое сообщение (2-3 предложения) другу о ваших планах на предстоящие выходные." : (isDe ? "Schreiben Sie 2-3 Sätze an einen Freund über Ihre Pläne für das kommende Wochenende." : "Write 2-3 sentences to a friend describing your plans for next weekend."))
      : (isRu ? "Напишите 2-3 предложения о ваших планах на выходные на изучаемом языке." : `Write 2-3 sentences about your weekend plans in ${targetLanguage}.`);

    return {
      skill,
      drill_type: drillType,
      questions: [{ id: 1, type: "open", prompt: promptText }]
    };
  }
}

// ── Call 4: Universal AI-First Answer & Intent Classifier ─────────────────────
export async function analyzeStudentResponse(targetLanguage, mediatorLanguage, promptQuestion, userAnswer) {
  const prompt = `You are a universal psycholinguistic analyst and CEFR examiner.
A student was assigned a task in ${targetLanguage}.
Mediator language: ${mediatorLanguage}.

Question/Task: "${promptQuestion}"
Student's Actual Input: "${userAnswer}"

Analyze the student's input across ALL world languages:
1. "detected_language": Identify the language the student typed in.
2. "is_target_language": true ONLY if the student used ${targetLanguage}. If they typed in ${mediatorLanguage} or any other language, false.
3. "intent": Classify the student's core intent:
   - "ADMIT_NO_KNOWLEDGE": The student is expressing that they do not know, cannot speak, do not understand, want to give up, or know nothing about ${targetLanguage}.
   - "ANSWER_IN_WRONG_LANGUAGE": The student understood the factual question and provided the factual answer, but wrote it in ${mediatorLanguage} or another language instead of ${targetLanguage}.
   - "GENUINE_ATTEMPT": The student attempted to answer or produce ${targetLanguage}.
   - "UNRELATED_OR_EMPTY": Gibberish, greeting, empty response, or off-topic statement.
4. "target_language_proficiency_demonstrated": true ONLY if the student demonstrated actual vocabulary, grammar, or syntax in ${targetLanguage}.
5. "correct_answer_in_target_language": Give the exact, natural correct answer in ${targetLanguage}.
6. "explanation_in_mediator": Concise feedback written in ${mediatorLanguage} explaining the correct answer without robotic templates.
7. "extracted_mistakes": Extract rich linguistic attributes for any new words:
   - "initial_form": Pure uninflected dictionary lemma headword in ${targetLanguage}.
   - "part_of_speech": noun, verb, adjective, etc.
   - "transcription": IPA + phonetic reading.
   - "pronunciation_rule": Phonetic rule in ${mediatorLanguage}.
   - "grammar_rule": Morphological properties in ${mediatorLanguage}.
   - "orthography_rule": Spelling rule in ${mediatorLanguage}.
   - "syntax_rule": Case government and prepositions in ${mediatorLanguage}.
   - "semantics_note": Nuance and collocations in ${mediatorLanguage}.
   - "meaning": Meaning in ${mediatorLanguage}.

Return ONLY JSON:
{
  "detected_language": "...",
  "is_target_language": false,
  "intent": "ADMIT_NO_KNOWLEDGE | ANSWER_IN_WRONG_LANGUAGE | GENUINE_ATTEMPT | UNRELATED_OR_EMPTY",
  "target_language_proficiency_demonstrated": false,
  "score_recommendation": 0,
  "correct_answer_in_target_language": "...",
  "explanation_in_mediator": "...",
  "extracted_mistakes": []
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 850,
        response_format: { type: "json_object" },
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    return JSON.parse(extractJsonObject(raw));
  } catch (err) {
    console.error("Universal analysis error:", err.message);
    return {
      detected_language: "unknown",
      is_target_language: false,
      intent: "GENUINE_ATTEMPT",
      target_language_proficiency_demonstrated: true,
      score_recommendation: 80,
      correct_answer_in_target_language: "",
      explanation_in_mediator: "Response recorded.",
      extracted_mistakes: []
    };
  }
}

// ── Call 5: Universal Skill Drill Evaluator (Skill & Level Aware) ─────────────
export async function evaluateSkillAnswer(skill, targetLanguage, mediatorLanguage, level, question, userAnswer, isVoice = false) {
  // Pass skill context so the evaluator grades against the actual skill CEFR rubric
  const analysis = await analyzeStudentResponse(
    targetLanguage,
    mediatorLanguage,
    `[Skill: ${skill.toUpperCase()} | CEFR: ${level}] ${question.prompt}`,
    userAnswer
  );

  let score = 0;
  let feedback = analysis.explanation_in_mediator;

  switch (analysis.intent) {
    case "ADMIT_NO_KNOWLEDGE":
      score = 0;
      feedback = analysis.explanation_in_mediator ||
        `Correct answer in ${targetLanguage}: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}`;
      break;

    case "ANSWER_IN_WRONG_LANGUAGE":
      score = 25;
      feedback = `Answer understood, but written in ${analysis.detected_language} («${userAnswer}»). In a ${skill} drill, responses must be produced in ${targetLanguage}: ${analysis.correct_answer_in_target_language}.`;
      break;

    case "GENUINE_ATTEMPT": {
      const baseScore = analysis.score_recommendation || 85;
      // Skill-specific scoring calibration:
      if (skill === "speaking" && isVoice) {
        // Bonus for acoustic voice production in target language
        score = Math.min(100, Math.max(75, baseScore + 5));
      } else if (skill === "writing") {
        // Writing requires grammatical accuracy
        score = Math.max(65, baseScore);
      } else {
        score = Math.max(70, baseScore);
      }
      break;
    }

    case "UNRELATED_OR_EMPTY":
    default:
      score = 0;
      feedback = `Answer not recognized for this ${skill} task. Expected answer in ${targetLanguage}: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}`;
      break;
  }

  return {
    score,
    skill, // Explicitly return evaluated skill
    feedback,
    mistakes: analysis.extracted_mistakes || []
  };
}

// ── Call 6: CEFR Placement Test Generator ─────────────────────────────────────
// ── Call 6: CEFR Placement Test Generator (Complete Sentences with Safe Cloze Gaps)
export async function generateLevelTest(targetLanguage, mediatorLanguage = "english") {
  const prompt = `You are a certified psychometric CEFR language testing specialist.
Create a high-quality 5-question diagnostic placement test for ${targetLanguage}.
Student mediator language: ${mediatorLanguage}.

CRITICAL MANDATES:
1. EVERY SINGLE QUESTION MUST INCLUDE THE FULL TARGET SENTENCE!
   - For Multiple-Choice Questions (Q1, Q2, Q3):
     * "prompt" MUST contain the instruction in ${mediatorLanguage} PLUS a full natural sentence in ${targetLanguage} containing a clear blank gap "[ ... ]" where the chosen option fits!
     * NEVER output a prompt like "Choose the correct word" without the actual sentence!
     * Example of valid prompt: "Выберите правильное слово для предложения:\n\n«Утром перед работой я обычно пью горячий [ ... ] с молоком.»"
   - For Morphology / Conjugation (Q4):
     * "prompt" MUST explicitly name the base word in quotation marks AND specify the exact target tense/gender/case to produce!
     * Example: "Напишите глагол «исправить» в форме прошедшего времени мужского рода:"
   - For Production (Q5):
     * "prompt" MUST give a clear, specific conversational scenario asking for 1-2 complete sentences in ${targetLanguage}.
2. OPTIONS & DISTRACTORS:
   - "options": Must be 4 authentic, real dictionary words in ${targetLanguage}.
   - "correct_option": Must match exactly one of the 4 options.
   - NEVER use placeholders like "Option 1", "Verb 1", "Word", or "Sentence"!
3. INSTRUCTION LANGUAGE:
   - For Q1-Q3: Instructions in ${mediatorLanguage}, sentences and options strictly in ${targetLanguage}.
   - For Q4-Q5: Clear task prompt in ${mediatorLanguage} or ${targetLanguage}.

Return strictly a valid JSON object:
{
  "questions": [
    {
      "id": 1,
      "type": "choice",
      "cefr_target": "A1-A2",
      "skill": "Vocabulary",
      "prompt": "Instruction in ${mediatorLanguage} + complete sentence in ${targetLanguage} with [ ... ]",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "A) ..."
    },
    {
      "id": 2,
      "type": "choice",
      "cefr_target": "B1",
      "skill": "Grammar",
      "prompt": "Instruction in ${mediatorLanguage} + complete sentence in ${targetLanguage} with [ ... ]",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "B) ..."
    },
    {
      "id": 3,
      "type": "choice",
      "cefr_target": "B2",
      "skill": "Syntax",
      "prompt": "Instruction in ${mediatorLanguage} + complete sentence in ${targetLanguage} with [ ... ]",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "C) ..."
    },
    {
      "id": 4,
      "type": "open",
      "cefr_target": "B1-B2",
      "skill": "Morphology",
      "prompt": "Prompt explicitly providing the base word «...» and requesting specific form in ${targetLanguage}."
    },
    {
      "id": 5,
      "type": "open",
      "cefr_target": "C1",
      "skill": "Production",
      "prompt": "Specific topic prompt asking to compose 1-2 sentences in ${targetLanguage}."
    }
  ]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: "json_object" },
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    const questions = parsed.questions || Object.values(parsed).find(Array.isArray);

    // Verify that every choice question actually contains a sentence with a blank!
    if (Array.isArray(questions) && questions.length >= 5) {
      const allValid = questions.slice(0, 3).every(q => q.prompt && (q.prompt.includes("[ ... ]") || q.prompt.includes("...") || q.prompt.includes("___")));
      if (allValid) {
        // Sanitize any raw underscores from AI output so they don't break Telegram Markdown parser
        questions.forEach(q => {
          if (q.prompt) q.prompt = q.prompt.replace(/_{2,}/g, "[ ... ]");
        });
        return { questions };
      }
    }
    throw new Error("Generated questions lacked required cloze sentences");
  } catch (err) {
    console.warn(`generateLevelTest fallback activated for ${targetLanguage}:`, err.message);

    const langLower = String(targetLanguage || "").toLowerCase();
    const isRu = langLower.includes("russ");
    const isDe = langLower.includes("germ");
    const isEs = langLower.includes("span");
    const isFr = langLower.includes("fren");
    const isIt = langLower.includes("ital");

    // Dynamic, verified complete sentences with safe [ ... ] blanks (ZERO Telegram Markdown parser collisions!)
    return {
      questions: [
        {
          id: 1,
          type: "choice",
          cefr_target: "A1-A2",
          skill: "Vocabulary",
          prompt: isRu
            ? "Выберите подходящее слово, чтобы закончить предложение:\n\n«Утром перед работой я обычно пью горячий [ ... ] с сахаром.»"
            : (isDe
              ? "Wählen Sie das passende Wort, um den Satz zu vervollständigen:\n\n«Morgens vor der Arbeit trinke ich gern heißen [ ... ] mit Zucker.»"
              : (isEs
                ? "Seleccione la palabra correcta para completar la frase:\n\n«Por la mañana antes de trabajar siempre tomo un [ ... ] caliente.»"
                : (isFr
                  ? "Choisissez le mot approprié pour compléter la phrase:\n\n«Le matin avant le travail, je bois toujours un [ ... ] chaud.»"
                  : (isIt
                    ? "Scegli la parola corretta per completare la frase:\n\n«La mattina prima di andare al lavoro bevo sempre un [ ... ] caldo.»"
                    : "Choose the correct word to complete the sentence:\n\n«In the morning before work, I usually drink a hot cup of [ ... ] with milk.»")))),
          options: isRu
            ? ["A) кофе", "B) хлеб", "C) стол", "D) шкаф"]
            : (isDe
              ? ["A) Kaffee", "B) Brot", "C) Tisch", "D) Stuhl"]
              : (isEs
                ? ["A) café", "B) pan", "C) mesa", "D) libro"]
                : (isFr
                  ? ["A) café", "B) pain", "C) livre", "D) train"]
                  : (isIt
                    ? ["A) caffè", "B) pane", "C) libro", "D) treno"]
                    : ["A) coffee", "B) bread", "C) table", "D) chair"])))),
          correct_option: isRu ? "A) кофе" : (isDe ? "A) Kaffee" : (isEs ? "A) café" : (isFr ? "A) café" : (isIt ? "A) caffè" : "A) coffee"))))
        },
        {
          id: 2,
          type: "choice",
          cefr_target: "B1",
          skill: "Grammar",
          prompt: isRu
            ? "Выберите правильную форму глагола для предложения:\n\n«Если завтра не будет дождя, мы обязательно [ ... ] в парк.»"
            : (isDe
              ? "Wählen Sie die richtige Verbform für den Satz:\n\n«Wenn es morgen nicht regnet, [ ... ] wir bestimmt in den Park.»"
              : (isEs
                ? "Seleccione la forma verbal correcta para la frase:\n\n«Si no llueve mañana, nosotros [ ... ] al parque.»"
                : (isFr
                  ? "Choisissez la forme verbale correcte pour la phrase:\n\n«S'il ne pleut pas demain, nous [ ... ] au parc.»"
                  : (isIt
                    ? "Scegli la forma verbale corretta per la frase:\n\n«Se domani non piove, noi [ ... ] al parco.»"
                    : "Choose the correct verb form for the sentence:\n\n«If it doesn't rain tomorrow, we [ ... ] to the park.»")))),
          options: isRu
            ? ["A) пойдём", "B) пошли", "C) ходить", "D) пойдя"]
            : (isDe
              ? ["A) gehen", "B) ging", "C) gegangen", "D) gehst"]
              : (isEs
                ? ["A) iremos", "B) fueron", "C) ir", "D) yendo"]
                : (isFr
                  ? ["A) irons", "B) allés", "C) aller", "D) allant"]
                  : (isIt
                    ? ["A) andremo", "B) andati", "C) andare", "D) andando"]
                    : ["A) will go", "B) went", "C) gone", "D) goes"])))),
          correct_option: isRu ? "A) пойдём" : (isDe ? "A) gehen" : (isEs ? "A) iremos" : (isFr ? "A) irons" : (isIt ? "A) andremo" : "A) will go"))))
        },
        {
          id: 3,
          type: "choice",
          cefr_target: "B2",
          skill: "Syntax",
          prompt: isRu
            ? "Выберите подходящий союз, чтобы связать части предложения:\n\n«Анна решила пойти на прогулку, [ ... ] на улице было достаточно холодно.»"
            : (isDe
              ? "Wählen Sie die passende Konjunktion für das Satzgefüge:\n\n«Anna ging spazieren, [ ... ] es draußen ziemlich kalt war.»"
              : (isEs
                ? "Seleccione la conjunción adecuada para la oración:\n\n«Ana decidió salir a caminar, [ ... ] hacía bastante frío afuera.»"
                : (isFr
                  ? "Choisissez la conjonction appropriée pour la phrase:\n\n«Anne a décidé de se promener, [ ... ] il faisait assez froid dehors.»"
                  : (isIt
                    ? "Scegli la congiunzione corretta per la frase:\n\n«Anna ha deciso di fare una passeggiata, [ ... ] facesse piuttosto freddo fuori.»"
                    : "Choose the appropriate conjunction to complete the sentence:\n\n«Anna decided to go for a walk, [ ... ] it was quite cold outside.»")))),
          options: isRu
            ? ["A) хотя", "B) потому что", "C) чтобы", "D) если"]
            : (isDe
              ? ["A) obwohl", "B) weil", "C) damit", "D) wenn"]
              : (isEs
                ? ["A) aunque", "B) porque", "C) para que", "D) si"]
                : (isFr
                  ? ["A) bien que", "B) parce que", "C) pour que", "D) si"]
                  : (isIt
                    ? ["A) sebbene", "B) perché", "C) affinché", "D) se"]
                    : ["A) although", "B) because", "C) in order to", "D) if"])))),
          correct_option: isRu ? "A) хотя" : (isDe ? "A) obwohl" : (isEs ? "A) aunque" : (isFr ? "A) bien que" : (isIt ? "A) sebbene" : "A) although"))))
        },
        {
          id: 4,
          type: "open",
          cefr_target: "B1-B2",
          skill: "Morphology",
          prompt: isRu
            ? "Поставьте глагол «исправить» в форму прошедшего времени мужского рода единственного числа (Он что сделал?):"
            : (isDe
              ? "Konjugieren Sie das Verb «entscheiden» im Präteritum für die 3. Person Singular (er/sie/es):"
              : (isEs
                ? "Conjuga el verbo «escribir» en pretérito perfecto simple para la primera persona singular (yo):"
                : (isFr
                  ? "Conjuguez le verbe «choisir» au passé composé pour la première personne du singulier (j'ai...):"
                  : (isIt
                    ? "Coniuga il verbo «scegliere» al passato prossimo per la prima persona singolare (io ho...):"
                    : "Provide the simple past tense form of the irregular verb «to choose»:"))))
        },
        {
          id: 5,
          type: "open",
          cefr_target: "C1",
          skill: "Production",
          prompt: isRu
            ? "Напишите 1-2 развернутых предложения на русском языке, выражающих ваше мнение: «Помогает ли искусственный интеллект быстрее осваивать иностранные языки?»"
            : (isDe
              ? "Schreiben Sie 1-2 Sätze auf Deutsch zu der Frage: «Hilft künstliche Intelligenz dabei, Sprachen schneller zu lernen?»"
              : (isEs
                ? "Escribe 1-2 oraciones en español expresando tu opinión: «¿Ayuda la inteligencia artificial a aprender idiomas más rápido?»"
                : (isFr
                  ? "Écrivez 1-2 phrases en français exprimant votre opinion: «L'intelligence artificielle aide-t-elle à apprendre les langues plus rapidement?»"
                  : (isIt
                    ? "Scrivi 1-2 frasi in italiano esprimendo la tua opinione: «L'intelligenza artificiale aiuta a imparare le lingue più velocemente?»"
                    : `Write 1-2 complete sentences in ${targetLanguage} expressing your opinion on modern technology in education.`))))
        }
      ]
    };
  }
}

// ── Call 7: Universal CEFR Placement Test Evaluator ───────────────────────────
// ── Call 7: Universal CEFR Placement Test Evaluator ───────────────────────────
export async function evaluateLevelTest(targetLanguage, mediatorLanguage, questions, userAnswers) {
  const prompt = `You are a certified psychometric CEFR language testing specialist evaluating a full placement test.
Target Language: ${targetLanguage}.
Student Mediator Language: ${mediatorLanguage}.

Questions and Student Answers:
${questions.map((q, i) => `Q${i + 1} (${q.skill}):\nPrompt: ${q.prompt}\nStudent Answer: "${userAnswers[i] || "(No answer)"}"`).join("\n\n")}

UNIVERSAL EVALUATION MANDATE:
1. SEMANTIC INTENT CHECK:
   - If the student writes in ANY language (e.g. Azerbaijani "nə dediyini anlamıram", Russian "не понимаю / не знаю", Turkish "anlamıyorum", English "I don't understand / I don't know") stating they don't understand, don't know, or cannot answer:
     * This is an admission of zero knowledge in ${targetLanguage}.
     * They MUST NOT receive points in ${targetLanguage}!
     * "admits_zero_knowledge" MUST be true.
2. TARGET LANGUAGE PROFICIENCY ONLY:
   - Grade ONLY actual words, grammar, and structures produced in ${targetLanguage}.
   - If no valid ${targetLanguage} was demonstrated, overall score MUST BE 0-20, and detected_level MUST BE "Beginner", cefr_grade "A1".
3. RETURN TYPE REQUIREMENT:
   - "score" must be a number between 0 and 100.
   - "breakdown" MUST be an object with string fields: "vocabulary", "grammar", "syntax", "production".

Return strictly a valid JSON object:
{
  "admits_zero_knowledge": true,
  "target_language_demonstrated": false,
  "detected_level": "Beginner",
  "cefr_grade": "A1",
  "score": 0,
  "breakdown": {
    "vocabulary": "0 / 25",
    "grammar": "0 / 25",
    "syntax": "0 / 25",
    "production": "0 / 25"
  },
  "recommendations": "Advice in ${mediatorLanguage}."
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));

    if (parsed.admits_zero_knowledge || !parsed.target_language_demonstrated) {
      return {
        detected_level: "Beginner",
        cefr_grade: "A1",
        score: typeof parsed.score === "number" ? Math.min(parsed.score, 25) : 0,
        breakdown: {
          vocabulary: parsed.breakdown?.vocabulary || "0 / 25",
          grammar: parsed.breakdown?.grammar || "0 / 25",
          syntax: parsed.breakdown?.syntax || "0 / 25",
          production: parsed.breakdown?.production || "0 / 25"
        },
        recommendations: parsed.recommendations || `Welcome to learning ${targetLanguage}! We will start with basic vocabulary and phrases.`
      };
    }

    return {
      detected_level: parsed.detected_level || "Beginner",
      cefr_grade: parsed.cefr_grade || "A1",
      score: typeof parsed.score === "number" ? parsed.score : 0,
      breakdown: {
        vocabulary: String(parsed.breakdown?.vocabulary || "10 / 25"),
        grammar: String(parsed.breakdown?.grammar || "10 / 25"),
        syntax: String(parsed.breakdown?.syntax || "10 / 25"),
        production: String(parsed.breakdown?.production || "10 / 25")
      },
      recommendations: parsed.recommendations || `Practice regularly to advance your ${targetLanguage} proficiency!`
    };
  } catch (err) {
    console.error("evaluateLevelTest fallback:", err.message);
    return {
      detected_level: "Beginner",
      cefr_grade: "A1",
      score: 0,
      breakdown: {
        vocabulary: "0 / 25",
        grammar: "0 / 25",
        syntax: "0 / 25",
        production: "0 / 25"
      },
      recommendations: `Welcome to learning ${targetLanguage}! We will start from the basics.`
    };
  }
}

// ── Call 8: Semantic Quiz Judge ───────────────────────────────────────────────
export async function checkSemanticAnswer(wordOrPhrase, submittedAnswer, correctAnswer, synonyms = "") {
  const submitted = String(submittedAnswer || "").trim();
  if (!submitted) return { correct: false, isSynonym: false, explanation: "No answer provided." };

  const prompt = `You are a language quiz judge grading a student's answer.
Target Word: "${wordOrPhrase}"
Accepted Answer: "${correctAnswer}"
Known Synonyms: "${synonyms || "none"}"
Student Answer: "${submitted}"

Accept synonyms, paraphrases, and subsets.
Return ONLY JSON:
{
  "correct": true,
  "isSynonym": true,
  "explanation": "..."
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 250,
        response_format: { type: "json_object" },
      })
    );
    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    return {
      correct: Boolean(parsed.correct),
      isSynonym: Boolean(parsed.isSynonym),
      explanation: parsed.explanation || (parsed.correct ? "Correct!" : `Accepted: ${correctAnswer}`)
    };
  } catch (err) {
    return smartFallbackMatch(submitted, correctAnswer, synonyms);
  }
}

export function smartFallbackMatch(submitted, correctAnswer, synonyms = "") {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const sub = norm(submitted);
  const targets = [correctAnswer, ...(synonyms ? synonyms.split(",") : [])].flatMap((t) => t.split(/[,;/]/)).map(norm).filter(Boolean);
  for (const t of targets) {
    if (sub === t || t.includes(sub) || sub.includes(t)) {
      return { correct: true, isSynonym: sub !== norm(correctAnswer), explanation: "Accepted!" };
    }
  }
  return { correct: false, isSynonym: false, explanation: `Correct answer: ${correctAnswer}` };
}

// ── Call: Full Pedagogical Grammar Guide Generator ────────────────────────────
export async function generateGrammarGuide(targetLanguage, mediatorLanguage, topicOrQuery, userLevel = "Beginner") {
  const isAdvanced = String(userLevel || "").toLowerCase().includes("advanced");
  const guideLanguage = isAdvanced ? targetLanguage : (mediatorLanguage || "english");

  const prompt = `You are a world-class university professor of ${targetLanguage} linguistics and pedagogy.
Create an exhaustive, publication-grade Grammar Reference Guide in ${guideLanguage.toUpperCase()} for a student at ${userLevel} level.

Topic/Question: "${topicOrQuery}"

The guide MUST be 100% COMPLETE, RICH, AND FORMATTED FOR AN A4 PDF STUDY SHEET.
Structure required:
1. 🏷 Title & Conceptual Blueprint: Clear explanation of what this rule is and why it exists.
2. 📐 Structural Formula & Word Order Mechanics: Formulas with visual diagrams/tables.
3. 📊 Exhaustive Paradigms & Tables: Complete conjugation/declension tables with IPA and translations for every single row!
4. ⚠️ Common Traps, Exceptions & False Friends: What learners get wrong.
5. 💬 Real-World Context Examples: 4-6 bilingual sentences.
6. 💡 Memory Hacks & Mnemonics: Fast recall tips.

CRITICAL ANTI-CORRUPTION RULES:
- "explanation" MUST BE plain readable text and markdown tables. NEVER output raw JSON syntax or curly braces like {"target": ...} inside the explanation text!
- "examples" MUST BE a real JSON array of objects.

Return ONLY a valid JSON object:
{
  "title": "Clean concise title in ${guideLanguage}",
  "category": "Grammar category",
  "rule_summary": "1-2 sentence overview in ${guideLanguage}",
  "explanation": "Full Markdown content formatted with headers and tables in ${guideLanguage}",
  "examples": [
    { "target": "Sentence in ${targetLanguage}", "translation": "Translation in ${guideLanguage}", "note": "Note in ${guideLanguage}" }
  ]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1600, // Safe limit beneath Groq OTPM ceiling
        response_format: { type: "json_object" },
      })
    );
    const raw = response.choices[0]?.message?.content?.trim();
    return JSON.parse(extractJsonObject(raw));
  } catch (err) {
    console.error("Grammar guide generation error:", err.message);
    return null;
  }
}
// ── Call: Dynamic AI Content Generator for Games (No Database dependency) ───
// ── Call: Dynamic AI Intra-Level Progression Generator ───────────────────────
export async function generateGameSessionWords(targetLanguage, mediatorLanguage = "english", level = "Beginner", round = 1, count = 6) {
  const currentRound = Math.max(1, parseInt(round, 10) || 1);
  const normalizedLevel = String(level || "Beginner").toLowerCase();

  const isBeginner = normalizedLevel.includes("beginner") || normalizedLevel.includes("a1") || normalizedLevel.includes("a2");
  const isIntermediate = normalizedLevel.includes("intermediate") || normalizedLevel.includes("b1") || normalizedLevel.includes("b2");
  const isAdvanced = normalizedLevel.includes("advanced") || normalizedLevel.includes("c1") || normalizedLevel.includes("c2");

  // Define exact intra-level difficulty calibration for this round
  let progressionTier = "";
  if (isBeginner) {
    if (currentRound === 1) {
      progressionTier = `TIER 1 (A1 Baseline): High-frequency individual concrete nouns, cardinal numbers, and basic infinitive verbs.`;
    } else if (currentRound === 2) {
      progressionTier = `TIER 2 (A1+ Expansion): Descriptive adjective-noun combinations and practical daily objects with gender articles/endings.`;
    } else {
      progressionTier = `TIER 3 (A2 Everyday Functional): Unordinary yet strictly beginner communicative micro-phrases, polite requests, and essential conversational fragments. DO NOT cross into B2/C1 grammar.`;
    }
  } else if (isIntermediate) {
    if (currentRound === 1) {
      progressionTier = `TIER 1 (B1 Core): Key situational vocabulary, regular social interactions, and essential connective words.`;
    } else if (currentRound === 2) {
      progressionTier = `TIER 2 (B1+ Idiomatic): Phrasal expressions, contextual collocations, and expressive descriptors.`;
    } else {
      progressionTier = `TIER 3 (B2 Precision): Conceptual terms, nuanced synonyms, and complex conversational connectors.`;
    }
  } else {
    // Advanced
    progressionTier = `ROUND ${currentRound} (C1-C2): Stylistic precision, culturally rooted idioms, professional discourse collocations, and sophisticated lexical nuances.`;
  }

  const prompt = `You are an elite CEFR curriculum architect designing an adaptive gamified language drill for ${targetLanguage}.
Student level: ${level.toUpperCase()}.
Current Game Round: ${currentRound}.
Student's mediator language for definitions: ${mediatorLanguage.toUpperCase()}.

ROUND DIFFICULTY CALIBRATION:
${progressionTier}

CRITICAL PEDAGOGICAL BOUNDARY:
- YOU MUST RESPECT THE CEFR CEILING: If the student is BEGINNER, NEVER introduce abstract C1 vocabulary, archaic idioms, or complex subjunctives!
- Even at Round 3+, a Beginner must receive accessible, practical words or phrases (e.g. "Where is the pharmacy?", "cold morning", "to buy a ticket"), NOT literary poetry.
- As rounds progress, increase lexical interest, depth, and communicative richness.

Return strictly a single valid JSON object containing ${count} unique items:
{
  "items": [
    {
      "word": "Target word or natural micro-phrase in ${targetLanguage}",
      "meaning": "Clear translation / definition in ${mediatorLanguage}",
      "transcription": "IPA phonetic transcription with stress marks",
      "pronunciation_rule": "1 brief sentence explaining the phonetic key",
      "part_of_speech": "noun | verb | adjective | phrase | idiom"
    }
  ]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: Math.min(0.5, 0.2 + currentRound * 0.08), // Slightly more creative lexical breadth in higher rounds
        max_tokens: 1100,
        response_format: { type: "json_object" },
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed.items.map((item, idx) => ({
        id: `ai_r${currentRound}_${Date.now()}_${idx}`,
        word: item.word,
        initial_form: item.word,
        correction: item.meaning,
        transcription: item.transcription || "",
        pronunciation_rule: item.pronunciation_rule || "",
        part_of_speech: item.part_of_speech || "word",
        language: targetLanguage.toLowerCase(),
        round: currentRound
      }));
    }
  } catch (err) {
    console.warn(`generateGameSessionWords (Round ${currentRound}) fallback activated:`, err.message);
  }

  // Graceful multi-language fallback respecting round depth
  const isRu = targetLanguage.toLowerCase().includes("russ");
  if (isRu) {
    if (currentRound === 1) {
      return [
        { id: `r1_1`, word: "вода", initial_form: "вода", correction: "water", transcription: "[vɐˈda]", language: "russian" },
        { id: `r1_2`, word: "хлеб", initial_form: "хлеб", correction: "bread", transcription: "[xlʲep]", language: "russian" },
        { id: `r1_3`, word: "друг", initial_form: "друг", correction: "friend", transcription: "[druk]", language: "russian" }
      ];
    } else if (currentRound === 2) {
      return [
        { id: `r2_1`, word: "холодная вода", initial_form: "холодная вода", correction: "cold water", transcription: "[xɐˈlodnəjə vɐˈda]", language: "russian" },
        { id: `r2_2`, word: "свежий хлеб", initial_form: "свежий хлеб", correction: "fresh bread", transcription: "[ˈsvʲeʐɨj xlʲep]", language: "russian" },
        { id: `r2_3`, word: "лучший друг", initial_form: "лучший друг", correction: "best friend", transcription: "[ˈlut͡ɕʂɨj druk]", language: "russian" }
      ];
    } else {
      return [
        { id: `r3_1`, word: "Где находится вокзал?", initial_form: "Где находится вокзал?", correction: "Where is the train station?", transcription: "[ɡdʲe nɐˈxodʲɪt͡sə vɐɡˈzaɫ]", language: "russian" },
        { id: `r3_2`, word: "Сколько это стоит?", initial_form: "Сколько это стоит?", correction: "How much does this cost?", transcription: "[ˈskolʲkə ˈɛtə ˈstoɪt]", language: "russian" },
        { id: `r3_3`, word: "Приятного аппетита!", initial_form: "Приятного аппетита!", correction: "Enjoy your meal!", transcription: "[prʲɪˈjatnəvə ɐpʲɪˈtʲitə]", language: "russian" }
      ];
    }
  }

  // English target fallback
  if (currentRound === 1) {
    return [
      { id: `en_1`, word: "apple", initial_form: "apple", correction: "alma / яблоко", transcription: "[ˈæp.əl]", language: "english" },
      { id: `en_2`, word: "book", initial_form: "book", correction: "kitab / книга", transcription: "[bʊk]", language: "english" },
      { id: `en_3`, word: "water", initial_form: "water", correction: "su / вода", transcription: "[ˈwɔː.tər]", language: "english" }
    ];
  } else if (currentRound === 2) {
    return [
      { id: `en_r2_1`, word: "green apple", initial_form: "green apple", correction: "yaşıl alma / зеленое яблоко", transcription: "[ɡriːn ˈæp.əl]", language: "english" },
      { id: `en_r2_2`, word: "interesting book", initial_form: "interesting book", correction: "maraqlı kitab / интересная книга", transcription: "[ˈɪn.trɪ.stɪŋ bʊk]", language: "english" }
    ];
  } else {
    return [
      { id: `en_r3_1`, word: "Can you help me?", initial_form: "Can you help me?", correction: "Mənə kömək edə bilərsiniz? / Можете мне помочь?", transcription: "[kæn juː help miː]", language: "english" },
      { id: `en_r3_2`, word: "Have a nice day!", initial_form: "Have a nice day!", correction: "Gününüz xoş keçsin! / Хорошего дня!", transcription: "[hæv ə naɪs deɪ]", language: "english" }
    ];
  }
}
// ── Chat Pipeline ─────────────────────────────────────────────────────────────
export async function chat(userId, userMessage, history, language, level, languageKey, mediatorLanguage = "english") {
  const conversationMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const [conversationResponse, analysisResponse] = await Promise.all([
    withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildConversationPrompt(language, level, mediatorLanguage) },
          ...conversationMessages,
        ],
        temperature: 0.6,
        max_tokens: 1600, // Safe limit beneath Groq OTPM ceiling
      })
    ),
    withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildAnalysisPrompt(language, level, mediatorLanguage) },
          ...conversationMessages.slice(-4),
        ],
        temperature: 0.1,
        max_tokens: 850,
        response_format: { type: "json_object" },
      })
    ),
  ]);

  const rawReply = conversationResponse.choices[0]?.message?.content?.trim();
  let reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

  let spokenReply = null;
  const speechMatch = reply.match(/\[SPEECH\]([\s\S]*?)\[\/SPEECH\]/i);
  if (speechMatch) {
    spokenReply = speechMatch[1].trim();
    reply = reply.replace(/\[SPEECH\][\s\S]*?\[\/SPEECH\]/i, "").trim();
  }

  let analysisData = { correctionText: "✅ Perfect!", mistakes: [], grammar_topic: null };
  try {
    const rawAnalysis = analysisResponse.choices[0]?.message?.content?.trim();
    analysisData = JSON.parse(extractJsonObject(rawAnalysis));
  } catch (err) {
    console.error("Failed to parse analysis JSON:", err.message);
  }

  const correction = analysisData.correctionText || "✅ Perfect!";
  const mistakes = Array.isArray(analysisData.mistakes) ? analysisData.mistakes : [];

  for (const m of mistakes) {
    if (!m.initial_form || !m.meaning) continue;

    const cleanWord = m.initial_form.trim();
    if (cleanWord.length <= 1) continue;

    try {
      await addFlashcard(userId, {
        word: cleanWord,
        correction: m.meaning.trim(),
        context: m.explanation || m.sentence || "",
        language: languageKey,
        initial_form: cleanWord,
        used_form: m.used_form?.trim() || cleanWord,
        part_of_speech: m.part_of_speech?.trim() || "word",
        synonyms: m.synonyms?.trim() || "",
        explanation: m.explanation?.trim() || "",
        sentence: m.sentence?.trim() || userMessage,
        transcription: m.transcription?.trim() || null,
        pronunciation_rule: m.pronunciation_rule?.trim() || null,
        grammar_rule: m.grammar_rule?.trim() || null,
        orthography_rule: m.orthography_rule?.trim() || null,
        syntax_rule: m.syntax_rule?.trim() || null,
        semantics_note: m.semantics_note?.trim() || null
      });
    } catch (err) {
      console.error(`Flashcard DB insert failed for "${m.initial_form}":`, err.message);
    }
  }

  let savedTopic = null;
  if (analysisData.grammar_topic && analysisData.grammar_topic.title) {
    try {
      savedTopic = await saveGrammarTopic(userId, languageKey, {
        title: analysisData.grammar_topic.title,
        category: analysisData.grammar_topic.category || "General Grammar",
        rule_summary: analysisData.grammar_topic.rule_summary || "",
        explanation: analysisData.grammar_topic.explanation || reply,
        examples: analysisData.grammar_topic.examples || []
      }, mediatorLanguage);
    } catch (err) {
      console.error("Grammar topic DB insert failed:", err.message);
    }
  }

  await addHistory(userId, "user", userMessage);
  await addHistory(userId, "assistant", reply);

  return { correction, reply, spokenReply, grammarTopic: savedTopic };
}

// ── Call 9: Pedagogically Comprehensive Roadmap Builder ──────────────────────
export function cleanRoadmapText(raw) {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/[\u2013\u2014]/g, " — ")
    .replace(/\u00A0/g, " ")
    .replace(/--+/g, " — ")
    .replace(/^[\s]*[-*+]\s+/gm, "• ")
    .replace(/[`*]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRoadmapPrompt(language, level, mediatorLanguage = "english", recentContext = "") {
  const isAdvanced = String(level || "").toLowerCase().includes("advanced");
  const outputLanguage = isAdvanced ? language : (mediatorLanguage || "english");

  return `You are a certified senior language acquisition curriculum specialist and CEFR diagnostic coach.
Analyze the student's recent study history to create an in-depth Learning Roadmap.
Target Language to Learn: ${language.toUpperCase()}.
Student's CEFR Level: ${level.toUpperCase()}.
Language to write ALL instructions, section headers, categories, and explanations in: ${outputLanguage.toUpperCase()}.

${isAdvanced
      ? `CRITICAL ADVANCED IMMERSION: The student is ADVANCED. Write 100% of the entire report strictly in ${language.toUpperCase()}.`
      : `CRITICAL BEGINNER/INTERMEDIATE PEDAGOGY:
- The student is ${level.toUpperCase()}.
- Write ALL section titles, bullet descriptions, and category labels strictly in ${outputLanguage.toUpperCase()}!
- ABSOLUTELY NO UNTRANSLATED HEADERS in any third language.
- VOCABULARY MANDATE (SECTION 4): Every cited target word MUST include its translation in ${outputLanguage.toUpperCase()}!
  Example: "Ailə üzvləri — mother (ana), father (ata), brother (qardaş)".`}

CRITICAL SCOPE & ANTI-CORRUPTION MANDATE:
- Never output raw HTML tags like <br>, <u>, <b>, <span>, or <table>.
- Do NOT use double asterisks (**) or markdown noise.
- Use uppercase section headers and clean bullet points ("•").

Structure required:
1. 🎯 CURRENT CEFR STANDING & TRAJECTORY (${level})
2. 📈 RECENTLY DEMONSTRATED STRENGTHS
3. 🔍 DIAGNOSTICS & WEAK AREAS UNDER REPAIR
4. 🔄 ACTIVE VOCABULARY TO RECYCLE (Every word must have translation in ${outputLanguage}!)
5. 🚀 ACTIONABLE MILESTONE GOALS (NEXT 1-2 WEEKS)
6. 🗓 7-DAY TARGETED PRACTICE REGIMEN`;
}

export async function generateRoadmap(userId, language, level, mediatorLanguage = "english") {
  const recent = await getHistory(userId, 10);
  const contextSnippet = recent
    .map((h) => `${h.role === "user" ? "Student" : "Coach"}: ${h.content}`)
    .join("\n")
    .slice(0, 1000);

  const isAdvanced = String(level || "").toLowerCase().includes("advanced");
  const outputLanguage = isAdvanced ? language : mediatorLanguage;

  const response = await withModelFallback(CHAT_MODELS, (model) =>
    groq.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildRoadmapPrompt(language, level, mediatorLanguage, contextSnippet),
        },
        {
          role: "user",
          content: `Please generate my complete, structured 6-section Learning Roadmap & 7-Day Study Plan for ${language} in ${outputLanguage}. Do not output flashcards, HTML tags, or markdown asterisks.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1600, // Safe limit beneath Groq OTPM ceiling
    })
  );

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;

  const clean = cleanRoadmapText(raw);
  const taggedRoadmap = `[Track: ${language} | Level: ${level} | Mediator: ${mediatorLanguage}]\n\n${clean}`;
  await saveRoadmap(userId, taggedRoadmap);
  return taggedRoadmap;
}

export async function maybeGenerateRoadmap(userId, language, level, mediatorLanguage = "english") {
  const userMessageCount = await countUserMessages(userId);
  if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

  const recent = await getHistory(userId, 20);
  if (recent.length === 0) return null;

  return await generateRoadmap(userId, language, level, mediatorLanguage);
}

function stripForSpeech(text) {
  return text
    .replace(/\[SPEECH\][\s\S]*?\[\/SPEECH\]/gi, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/[*_~`#]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function textToSpeech(text, languageKey) {
  const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
  const folder = tmpdir();
  const spokenText = stripForSpeech(text);

  if (!spokenText) return null;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioFilePath } = await tts.toFile(folder, spokenText);
    return audioFilePath;
  } catch (err) {
    console.error("TTS error:", err);
    return null;
  }
}

export async function cleanupFile(filePath) {
  try {
    await unlink(filePath);
  } catch (_) { }
}

export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
  const file = await toFile(audioBuffer, filename, { type: "audio/ogg" });
  return withModelFallback(STT_MODELS, (model) =>
    groq.audio.transcriptions.create({
      file,
      model,
      response_format: "text",
    })
  );
}
// ── Call: Dynamic AI Distractor Generator for Quiz & Listening Games ─────────
export async function generateQuizDistractors(targetWord, correctAnswer, targetLanguage, optionLanguage) {
  const prompt = `You are designing a high-quality language quiz question.
Target word: "${targetWord}" in ${targetLanguage}.
Correct translation / meaning: "${correctAnswer}" in ${optionLanguage}.

Task: Generate EXACTLY 3 plausible, natural distractor meanings in ${optionLanguage.toUpperCase()} that belong to the same part of speech or semantic sphere, but are clearly distinct from "${correctAnswer}".

CRITICAL RULES:
- Write strictly in ${optionLanguage.toUpperCase()}!
- DO NOT use placeholders like "Option 1", "Word 1", "Verb 1".
- The 3 distractors must be realistic, authentic dictionary definitions or words.

Return strictly JSON:
{
  "distractors": ["Distractor 1", "Distractor 2", "Distractor 3"]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
      })
    );
    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    if (Array.isArray(parsed.distractors) && parsed.distractors.length >= 3) {
      return parsed.distractors.slice(0, 3);
    }
  } catch (err) {
    console.warn("Distractor generation fallback:", err.message);
  }
  return [];
}

//INITIAL CODE:
// // ai.js
// import Groq, { toFile } from "groq-sdk";
// import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap, saveGrammarTopic } from "./db.js";
// import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
// import { unlink } from "fs/promises";
// import { tmpdir } from "os";

// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// // Current production models per Groq's deprecation roadmap. Rate limits are per-model,
// // so cycling through distinct models on a 429 accesses separate quota buckets rather
// // than retrying the exhausted one. High-throughput Llama models are included alongside
// // gpt-oss and qwen to guarantee zero model-deprecation crashes.
// const CHAT_MODELS = [
//   "llama-3.3-70b-versatile",
//   "llama-3.1-8b-instant",
//   "openai/gpt-oss-120b",
//   "openai/gpt-oss-20b",
//   "qwen/qwen3.6-27b"
// ];
// const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// // gpt-oss models spend completion tokens on hidden chain-of-thought before
// // writing any visible content. With a low max_tokens, a request that needs
// // real reasoning can exhaust the budget on hidden reasoning, returning an empty
// // message.content. reasoning_effort:"low" keeps the model from over-spending
// // on reasoning for simple turns; other models ignore or omit this parameter.
// function reasoningParams(model) {
//   return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
// }

// // Tries each model in order, falling back on an actual rate-limit (429) or transient
// // failure. Logs a warning and continues down the list, re-throwing only if all models fail.
// async function withModelFallback(models, callFn) {
//   let lastErr;
//   for (const model of models) {
//     try {
//       return await callFn(model);
//     } catch (err) {
//       lastErr = err;
//       console.warn(`Model "${model}" attempt failed (${err?.status || err?.message}). Cycling to next model...`);
//       continue;
//     }
//   }
//   throw lastErr;
// }

// export const LANGUAGES = {
//   spanish: "Spanish", english: "English", french: "French", german: "German",
//   japanese: "Japanese", italian: "Italian", portuguese: "Portuguese", russian: "Russian",
//   arabic: "Arabic", chinese: "Chinese (Mandarin)", hindi: "Hindi", korean: "Korean",
//   turkish: "Turkish", dutch: "Dutch", polish: "Polish", swedish: "Swedish",
//   vietnamese: "Vietnamese", indonesian: "Indonesian", thai: "Thai", filipino: "Filipino",
//   ukrainian: "Ukrainian", malay: "Malay", romanian: "Romanian", greek: "Greek",
//   czech: "Czech", hungarian: "Hungarian", tamil: "Tamil", telugu: "Telugu",
//   bengali: "Bengali", hebrew: "Hebrew", norwegian: "Norwegian", danish: "Danish",
//   finnish: "Finnish", slovak: "Slovak", catalan: "Catalan", persian: "Persian",
//   marathi: "Marathi", swahili: "Swahili", afrikaans: "Afrikaans", azerbaijani: "Azerbaijani"
// };

// // Best Edge TTS neural voice for each supported language
// const TTS_VOICES = {
//   spanish: "es-ES-AlvaroNeural", english: "en-US-GuyNeural", french: "fr-FR-HenriNeural",
//   german: "de-DE-ConradNeural", japanese: "ja-JP-KeitaNeural", italian: "it-IT-DiegoNeural",
//   portuguese: "pt-BR-AntonioNeural", russian: "ru-RU-DmitryNeural", arabic: "ar-SA-HamedNeural",
//   chinese: "zh-CN-YunxiNeural", hindi: "hi-IN-MadhuramNeural", korean: "ko-KR-InGookNeural",
//   turkish: "tr-TR-AhmetNeural", dutch: "nl-NL-MaartenNeural", polish: "pl-PL-MarekNeural",
//   swedish: "sv-SE-MattiasNeural", vietnamese: "vi-VN-NamMinhNeural", indonesian: "id-ID-ArdiNeural",
//   thai: "th-TH-NiwatNeural", filipino: "fil-PH-AngeloNeural", ukrainian: "uk-UA-OstapNeural",
//   malay: "ms-MY-OsmanNeural", romanian: "ro-RO-EmilNeural", greek: "el-GR-NestorasNeural",
//   czech: "cs-CZ-AntoninNeural", hungarian: "hu-HU-TamasNeural", tamil: "ta-IN-ValluvarNeural",
//   telugu: "te-IN-MohanNeural", bengali: "bn-IN-BashkarNeural", hebrew: "he-IL-AvriNeural",
//   norwegian: "nb-NO-FinnNeural", danish: "da-DK-JeppeNeural", finnish: "fi-FI-HarriNeural",
//   slovak: "sk-SK-LukasNeural", catalan: "ca-ES-EnricNeural", persian: "fa-IR-FaridNeural",
//   marathi: "mr-IN-ManoharNeural", swahili: "sw-KE-RafikiNeural", afrikaans: "af-ZA-WillemNeural",
//   azerbaijani: "az-AZ-BabekNeural"
// };

// function extractJsonObject(raw) {
//   if (!raw) throw new Error("Empty response from AI");
//   const match = raw.match(/\{[\s\S]*\}/);
//   return match ? match[0] : raw;
// }

// // ── Strict Lemma & Linguistic Accuracy Rules ──────────────────────────────────
// function linguisticAccuracyBlock(language) {
//   return `LINGUISTIC ACCURACY & STRICT BASE LEMMA MANDATE:
// - Target language: ${language}.
// - ALWAYS use standard orthography of ${language}, including every diacritic and accent mark.
// - STRICT BASE LEMMA / INFINITIVE RULE FOR DATABASE STORAGE:
//   When extracting vocabulary for flashcards, "initial_form" MUST ALWAYS be the uninflected dictionary headword:
//   * Nouns: MUST be singular nominative (e.g. Russian: "вопрос", "дружба", "горшок", "крыша"; German: "Buch", "Freundschaft").
//   * Verbs: MUST be bare infinitive (e.g. Russian: "исправить", "читать"; German: "lesen"; Spanish: "tener").
//   * Adjectives: MUST be masculine singular nominative base form (e.g. Russian: "разный", "черепичный", "предыдущий").
//   * Pronouns: MUST be dictionary headword (e.g. Russian: "мой", "этот").
//   * NEVER save Latin transliterations (reject "BIL", "SHO", "TEM", "TOGO") — convert to native script or discard!
//   * NEVER save single-letter particles, prepositions ("о", "а", "не", "в") or proper names as flashcards!
// - IN-CONTEXT MORPHOLOGICAL ADJUSTMENT RULE (FOR QUIZZES & DRILLS):
//   When using stored vocabulary words inside questions, example sentences, cloze tests, or drills:
//   * DO NOT drop an uninflected lemma into a sentence where syntax requires a declined or conjugated form!
//   * You MUST grammatically adjust, decline, and conjugate the word to match the sentence's syntax, tense, gender, and case!`;
// }

// // ── Call 1: Spoken Conversation with Audio/Text Separation for Beginners ──────
// function buildConversationPrompt(language, level, mediatorLanguage = "english") {
//   const isBeginner = level.toLowerCase().includes("beginner");
//   const isIntermediate = level.toLowerCase().includes("intermediate");
//   const isAdvanced = level.toLowerCase().includes("advanced");

//   const explanationLang = isAdvanced ? language : mediatorLanguage;

//   const grammarBreakdownEngine = `
// DEEP GRAMMATICAL, PHONETIC & SYNTACTIC BREAKDOWN ENGINE:
// Whenever the student asks to explain words, conjugations, declensions, or grammar rules (e.g. "объясни слова...", "как спрягается...", "что значат...", "how is X conjugated?", "explain grammar"):
// OR whenever introducing essential new verbs/nouns to Beginners/Intermediates:
// You MUST provide a structured, in-depth linguistic breakdown in ${explanationLang.toUpperCase()}:

// Structure your breakdown cleanly:
// 1. Meaning & Part of Speech: Grammatical role and primary definition.
// 2. Phonetics & Transcription: IPA transcription + phonetic approximation in ${explanationLang} characters + stress placement indicator.
// 3. Pronunciation Rule: Specific phonetic rule (stress shifts, reductions, silent letters, diphthongs, umlauts).
// 4. Base Form / Lemma: Bare Infinitive (for verbs) or Nominative Singular with article (for nouns).
// 5. Full Conjugation or Declension Paradigm:
//    - For Verbs: Complete person/number conjugation table (1st, 2nd, 3rd person singular and plural) in the relevant tense with translations for every line.
//    - For Nouns: Gender, singular/plural, cases (Nominative, Genitive, Dative, Accusative) with articles and translations.
// 6. Syntax & Usage: Prepositional government, cases required, word order.
// 7. Contextual Example Sentences: 2 natural examples in ${language} with translations in ${explanationLang}.
// 8. Actionable Practice Exercise: 1 quick drill for immediate reinforcement.
// `;

//   const scaffoldingDirective = isBeginner
//     ? `BEGINNER SCAFFOLDING & AUDIO SEPARATION MANDATE:
// - The student is a complete BEGINNER. Their mediator language is ${mediatorLanguage.toUpperCase()}.
// - If the student expresses confusion (e.g. "не понимаю", "i don't understand", "помоги"), asks for translation, or requests help in ${mediatorLanguage} (e.g. "нет, на русском", "speak English", "russich"):
//   1. NEVER stubbornly stay only in ${language}! NEVER say "I only speak ${language}" or "wir bleiben auf ${language}".
//   2. Use ${mediatorLanguage} to bridge the gap: explain what the phrase meant, translate it clearly, and give an easy template to reply.
// - AUDIO/TEXT SEPARATION (CRITICAL):
//   To prevent the ${language} Text-to-Speech voice engine from mispronouncing ${mediatorLanguage} words, wrap the pure ${language} sentences to be read aloud inside [SPEECH]...[/SPEECH] tags!
//   Example format for Beginners:
//   [SPEECH]
//   Hallo! Wie heißt du?
//   [/SPEECH]
//   Без проблем, давай разберём по-русски! «Wie heißt du?» означает «Как тебя зовут?». Чтобы ответить, скажи: «Ich heiße ... [твоё имя]». Как зовут тебя?`
//     : (isIntermediate
//       ? `INTERMEDIATE IMMERSION:
// - Conduct conversation primarily in ${language}.
// - When student asks for grammatical explanations, explain the grammar/conjugation in ${mediatorLanguage}, but keep conversational follow-ups in ${language}.`
//       : `ADVANCED IMMERSION:
// - Conduct 100% of the conversation and all grammatical explanations in ${language}. Maintain full target-language immersion.`);

//   return `You are a friendly, expert, and voice-enabled ${language} language coach.
// The student's level is ${level}.
// The student's mediator language is ${mediatorLanguage}.

// ${linguisticAccuracyBlock(language)}

// ${grammarBreakdownEngine}

// ${scaffoldingDirective}

// Keep conversational turns natural and supportive. Plain text only: no markdown formatting that disrupts TTS.`;
// }

// // ── Call 2: Rich Grammar, Syntax, Orthography & Semantics Analysis ────────────
// function buildAnalysisPrompt(language, level, mediatorLanguage = "english") {
//   const isAdvanced = level.toLowerCase().includes("advanced");

//   const explanationDirective = isAdvanced
//     ? `Since the student is ADVANCED, all fields ("meaning", "synonyms", "explanation", "pronunciation_rule", "grammar_rule", "orthography_rule", "syntax_rule", "semantics_note") MUST be written 100% in ${language} (monolingual immersion). Do NOT use any mediator language.`
//     : `Since the student is ${level}, write all explanations, meanings, transcriptions, and linguistic rules and all your response strictly in the student's mediator language: ${mediatorLanguage.toUpperCase()}. Do NOT introduce any third language, and NEVER copy the target word into the meaning field.`;

//   // In ai.js, inside buildAnalysisPrompt:

//   return `You are a master ${language} lexicographer, syntactician, and grammar analyst.
// Student level: ${level}.
// Mediator language: ${mediatorLanguage}.
// ${explanationDirective}
// ${linguisticAccuracyBlock(language)}

// CRITICAL GRAMMAR TOPIC EXTRACTION MANDATE:
// - Whenever the student asks to explain grammar, words, conjugations, declensions, syntax, or cases (e.g. "объясни...", "как спрягается...", "что значат...", "how is X conjugated?", "explain grammar"), OR whenever this turn explains a grammatical rule/table:
//   YOU MUST POPULATE "grammar_topic" with a complete, structured breakdown!
//   DO NOT set "grammar_topic": null if grammar was explained!

// FORMATTING RULES FOR "grammar_topic":
// - "explanation": Write clean Markdown headers (###) and tables. NEVER output raw JSON curly braces or string objects like {"target": ...} inside the explanation text!
// - "examples": Provide an array of structured objects: [{ "target": "...", "translation": "...", "note": "..." }]

// Return your response strictly as a single JSON object with all the messages properly translated in a proper language depending on the level:
// {
//   "correctionText": "✅ Perfect!" OR "📝 Correction: <corrected sentence> (<1-sentence explanation>)" OR "ℹ️ It seems you got a bit confused, lets dive into it together in ${mediatorLanguage} language!",
//   "grammar_topic": {
//     "title": "Concise rule title",
//     "category": "Sentence Structure | Verb Conjugation | Cases | Syntax | Pronouns",
//     "rule_summary": "1-2 sentence core takeaway",
//     "explanation": "Full comprehensive explanation formatted in clean Markdown without raw JSON",
//     "examples": [
//       { "target": "Example sentence in ${language}", "translation": "Translation in ${mediatorLanguage}", "note": "Grammatical usage note" }
//     ]
//   }, 
//   "mistakes": [
//     {
//       "initial_form": "Pure dictionary lemma/infinitive headword in ${language} native script (e.g. 'вопрос', 'Buch', 'qırmızı')",
//       "used_form": "The inflected word exactly as it appeared in the sentence",
//       "part_of_speech": "noun | verb | adjective | adverb | pronoun | phrase | preposition",
//       "transcription": "IPA + phonetic approximation with stress",
//       "pronunciation_rule": "Phonetic rule (stress, silent letters, reductions, diphthongs)",
//       "grammar_rule": "Morphological pattern, gender, conjugation/declension",
//       "orthography_rule": "Spelling rules, capitalization, diacritics",
//       "syntax_rule": "Case government, preposition requirements, word order",
//       "semantics_note": "Collocations, nuances, register, false friends",
//       "meaning": "Definition/translation (NEVER same as initial_form!)",
//       "synonyms": "Comma-separated synonyms",
//       "explanation": "Summary note for quick review",
//       "sentence": "Full corrected sentence with the word wrapped in <u>word</u> (grammatically adjusted!)"
//     }
//   ]
// };

// Always recheck your response content and adjust the text to respect the grammar rules of the specific language you're using while responding!`;
// }

// // ── Call 3: 4-Skill Drill Generator (Level-Aware Instructions & Skill Purity) ─
// export async function generateSkillDrill(skill, targetLanguage, mediatorLanguage, level, drillType = "short") {
//   const count = drillType === "huge" ? 10 : 5;
//   const isAdvanced = level.toLowerCase().includes("advanced");
//   const isIntermediate = level.toLowerCase().includes("intermediate");

//   const promptLang = (isAdvanced || isIntermediate) ? targetLanguage : mediatorLanguage;

//   const prompt = `You are an elite CEFR curriculum designer creating a ${drillType.toUpperCase()} ${skill.toUpperCase()} drill.
// Target language being tested: ${targetLanguage}.
// Student level: ${level}.
// Instruction / Prompt language: ${promptLang}.

// CRITICAL ANTI - CIRCULARITY & LEVEL - AWARE RULES:
// 1. NEVER ask to translate a word from ${targetLanguage} into ${targetLanguage} !
//   2. INSTRUCTION LANGUAGE:
// - For Advanced and Intermediate students, ALL question prompts MUST be written in ${targetLanguage} !
//   - For Beginner students, question prompts are written in ${mediatorLanguage}.
// 3. ABSOLUTELY NO THIRD LANGUAGES(No English if neither target nor mediator is English).
// 4. GRAMMATICAL ADJUSTMENT: Words inside cloze sentence gaps must be declined / conjugated to fit sentence syntax.

// SKILL PURITY MANDATE:
// - If skill is "listening":
//   * EVERY QUESTION MUST test LISTENING COMPREHENSION of an audio passage.
//   * "audio_script": Spoken narrative / dialogue 100 % in ${targetLanguage} (30 - 50 words) to be read via TTS audio.
//   * "prompt": Comprehension question in ${promptLang} asking about a concrete detail from that audio.
//   * FORBIDDEN: Never ask to write an email or describe personal weekends in a listening drill!
//   - If skill is "reading":
//   * "reading_passage": 100 % in ${targetLanguage} (50 - 80 words).
//   * "prompt": Comprehension question in ${promptLang}.
// - If skill is "speaking":
//   * Scenario in ${promptLang} requiring a voice message response in ${targetLanguage}.
// - If skill is "writing":
//   * Task instructions in ${promptLang} requiring written composition in ${targetLanguage}.

// Generate EXACTLY ${count} questions.
// Return ONLY JSON:
// {
//   "skill": "${skill}",
//     "drill_type": "${drillType}",
//       "questions": [
//         {
//           "id": 1,
//           "type": "${skill === 'speaking' ? 'voice' : (skill === 'writing' ? 'open' : 'choice')}",
//           ${skill === 'listening' ? `"audio_script": "Spoken text in ${targetLanguage}...",` : ""}
//       ${skill === 'reading' ? `"reading_passage": "Text passage in ${targetLanguage}...",` : ""}
// "prompt": "Question text in ${promptLang}...",
//   ${skill === 'listening' || skill === 'reading' ? `"options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_answer": "A) ..."` : ""}
//     }
//   ]
// }`;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.2,
//         max_tokens: 1800,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );

//     const raw = response.choices[0]?.message?.content?.trim();
//     const parsed = JSON.parse(extractJsonObject(raw));
//     const questions = parsed.questions || Object.values(parsed).find(Array.isArray);
//     if (!Array.isArray(questions) || questions.length === 0) throw new Error("Invalid drill questions structure");
//     return { skill, drill_type: drillType, questions };
//   } catch (err) {
//     console.error(`Skill drill generation failed for ${skill}: `, err.message);
//     return {
//       skill,
//       drill_type: drillType,
//       questions: [
//         {
//           id: 1,
//           type: skill === "speaking" ? "voice" : (skill === "listening" ? "open" : "choice"),
//           audio_script: skill === "listening" ? `Guten Tag.Der nächste Zug nach Hamburg fährt um vierzehn Uhr ab.` : undefined,
//           reading_passage: skill === "reading" ? `Deutschland liegt in Mitteleuropa und besteht aus sechzehn Bundesländern.` : undefined,
//           prompt: skill === "listening"
//             ? (isAdvanced || isIntermediate ? `Um wie viel Uhr fährt der nächste Zug nach Hamburg ab ? ` : `В какое время отправляется следующий поезд в Гамбург ? `)
//             : (skill === "speaking"
//               ? `Erzählen Sie kurz über Ihren Tag.`
//               : (skill === "writing"
//                 ? `Schreiben Sie zwei Sätze über Ihre Pläne für morgen.`
//                 : (isAdvanced || isIntermediate ? `Aus wie vielen Bundesländern besteht Deutschland ? ` : `Из скольких федеральных земель состоит Германия согласно тексту ? `))),
//           options: (skill === "reading" || skill === "listening") ? ["A) 12:00", "B) 14:00", "C) 16:00", "D) 18:00"] : undefined,
//           correct_answer: "B) 14:00"
//         }
//       ]
//     };
//   }
// }

// // ── Call 4: Universal AI-First Answer & Intent Classifier ─────────────────────
// export async function analyzeStudentResponse(targetLanguage, mediatorLanguage, promptQuestion, userAnswer) {
//   const prompt = `You are a universal psycholinguistic analyst and CEFR examiner.
// A student was assigned a task in ${targetLanguage}.
// Mediator language: ${mediatorLanguage}.

// Question / Task: "${promptQuestion}"
// Student's Actual Input: "${userAnswer}"

// Analyze the student's input across ALL world languages (Arabic, Urdu, Mandarin, Spanish, Russian, English, Armenian, Hindi, etc.):

// 1. "detected_language": Identify the language the student typed in.
// 2. "is_target_language": true ONLY if the student used ${targetLanguage}. If they typed in ${mediatorLanguage} or any other language, false.
// 3. "intent": Classify the student's core intent:
//   - "ADMIT_NO_KNOWLEDGE": The student is expressing that they do not know, cannot speak, do not understand, want to give up, or know nothing about ${targetLanguage} (e.g. "I don't know", "لا أعرف", "не знаю", "ne znayu", "не могу", "idk").
// - "ANSWER_IN_WRONG_LANGUAGE": The student understood the factual question and provided the factual answer, but wrote it in ${mediatorLanguage} or another language instead of ${targetLanguage}.
// - "GENUINE_ATTEMPT": The student attempted to answer or produce ${targetLanguage}.
// - "UNRELATED_OR_EMPTY": Gibberish, greeting, empty response, or off - topic statement.
// 4. "target_language_proficiency_demonstrated": true ONLY if the student demonstrated actual vocabulary, grammar, or syntax in ${targetLanguage}.
// 5. "correct_answer_in_target_language": Give the exact, natural correct answer in ${targetLanguage}.
// 6. "explanation_in_mediator": Concise feedback written in ${mediatorLanguage} explaining the correct answer without robotic templates.
// 7. "extracted_mistakes": Extract rich linguistic attributes for any new words:
//   - "initial_form": Pure uninflected dictionary lemma headword in ${targetLanguage}.
// - "part_of_speech": noun, verb, adjective, etc.
//    - "transcription": IPA + phonetic reading.
//    - "pronunciation_rule": Phonetic rule.
//    - "grammar_rule": Morphological properties.
//    - "orthography_rule": Spelling rule.
//    - "syntax_rule": Case government and prepositions.
//    - "semantics_note": Nuance and collocations.
//    - "meaning": Meaning in ${mediatorLanguage}.

// Return ONLY JSON:
// {
//   "detected_language": "...",
//     "is_target_language": false,
//       "intent": "ADMIT_NO_KNOWLEDGE | ANSWER_IN_WRONG_LANGUAGE | GENUINE_ATTEMPT | UNRELATED_OR_EMPTY",
//         "target_language_proficiency_demonstrated": false,
//           "score_recommendation": 0,
//             "correct_answer_in_target_language": "...",
//               "explanation_in_mediator": "...",
//                 "extracted_mistakes": []
// } `;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.1,
//         max_tokens: 850,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );

//     const raw = response.choices[0]?.message?.content?.trim();
//     return JSON.parse(extractJsonObject(raw));
//   } catch (err) {
//     console.error("Universal analysis error:", err.message);
//     return {
//       detected_language: "unknown",
//       is_target_language: false,
//       intent: "ADMIT_NO_KNOWLEDGE",
//       target_language_proficiency_demonstrated: false,
//       score_recommendation: 0,
//       correct_answer_in_target_language: "",
//       explanation_in_mediator: "Ответ записан.",
//       extracted_mistakes: []
//     };
//   }
// }

// // ── Call 5: Universal Skill Drill Evaluator ──────────────────────────────────
// export async function evaluateSkillAnswer(skill, targetLanguage, mediatorLanguage, level, question, userAnswer, isVoice = false) {
//   const analysis = await analyzeStudentResponse(targetLanguage, mediatorLanguage, question.prompt, userAnswer);

//   let score = 0;
//   let feedback = analysis.explanation_in_mediator;

//   switch (analysis.intent) {
//     case "ADMIT_NO_KNOWLEDGE":
//       score = 0;
//       feedback = `Ничего страшного! Вы указали, что не знаете ответ.В ${targetLanguage} правильный ответ: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
//       break;

//     case "ANSWER_IN_WRONG_LANGUAGE":
//       score = 20;
//       feedback = `Вы поняли суть вопроса, но ответили на языке ${analysis.detected_language} («${userAnswer}»). Ответ должен быть на ${targetLanguage}: ${analysis.correct_answer_in_target_language}.`;
//       break;

//     case "GENUINE_ATTEMPT":
//       score = Math.max(70, analysis.score_recommendation || 80);
//       break;

//     case "UNRELATED_OR_EMPTY":
//     default:
//       score = 0;
//       feedback = `Ответ не относится к вопросу.Правильный ответ на ${targetLanguage}: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
//       break;
//   }

//   return {
//     score,
//     feedback,
//     mistakes: analysis.extracted_mistakes || []
//   };
// }

// // ── Call 6: CEFR Placement Test Generator (Level-Calibrated Language) ─────────
// export async function generateLevelTest(targetLanguage, mediatorLanguage = "english") {
//   const prompt = `You are a certified psychometric CEFR language testing specialist.
// Create a diagnostic placement test to assess proficiency in ${targetLanguage}.

// DIRECTIONAL & CEFR METHODOLOGY:
// 1. NEVER ask: "Выберите перевод слова [TargetWord] на [TargetLanguage]".
// 2. INSTRUCTION LANGUAGE:
// - For Q1 - Q3(A1 to B2), write instructions in ${mediatorLanguage}, testing items strictly in ${targetLanguage}.
// - For Q4 - Q5(B2 to C1), question instructions must be written directly in ${targetLanguage} !
//   3. All cloze gaps(____) must test words grammatically adjusted in context.
// 4. NO THIRD LANGUAGES.

// Return ONLY JSON:
// {
//   "questions": [
//     {
//       "id": 1,
//       "type": "choice",
//       "cefr_target": "A1-A2",
//       "skill": "Vocabulary",
//       "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
//       "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
//       "correct_option": "A) ..."
//     },
//     {
//       "id": 2,
//       "type": "choice",
//       "cefr_target": "B1",
//       "skill": "Grammar",
//       "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
//       "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
//       "correct_option": "B) ..."
//     },
//     {
//       "id": 3,
//       "type": "choice",
//       "cefr_target": "B2",
//       "skill": "Syntax",
//       "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
//       "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
//       "correct_option": "C) ..."
//     },
//     {
//       "id": 4,
//       "type": "open",
//       "cefr_target": "B1-B2",
//       "skill": "Morphology",
//       "prompt": "Prompt in ${targetLanguage} requiring a specific grammatical form..."
//     },
//     {
//       "id": 5,
//       "type": "open",
//       "cefr_target": "C1",
//       "skill": "Production",
//       "prompt": "Production prompt in ${targetLanguage} asking for 1-2 sentences..."
//     }
//   ]
// } `;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.2,
//         max_tokens: 1500,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );

//     const raw = response.choices[0]?.message?.content?.trim();
//     const parsed = JSON.parse(extractJsonObject(raw));
//     const questions = parsed.questions || Object.values(parsed).find(Array.isArray);
//     if (!Array.isArray(questions) || questions.length === 0) throw new Error("No questions generated");
//     return { questions };
//   } catch (err) {
//     return {
//       questions: [
//         {
//           id: 1,
//           type: "choice",
//           cefr_target: "A1-A2",
//           skill: "Vocabulary",
//           prompt: `Выберите подходящее слово для завершения предложения: \n"Вчера я прочитал интересную _____ в библиотеке."`,
//           options: ["A) книгу", "B) хлеб", "C) стол", "D) машину"],
//           correct_option: "A) книгу"
//         },
//         {
//           id: 2,
//           type: "choice",
//           cefr_target: "B1",
//           skill: "Grammar",
//           prompt: `Выберите правильную форму глагола: \n"Если у меня будет время, я завтра тебе _____."`,
//           options: ["A) позвоню", "B) звонил", "C) звонить", "D) позвонили"],
//           correct_option: "A) позвоню"
//         },
//         {
//           id: 3,
//           type: "choice",
//           cefr_target: "B2",
//           skill: "Syntax",
//           prompt: `Выберите правильный союз: \n"Он пошёл на работу, _____ чувствовал себя не очень хорошо."`,
//           options: ["A) потому что", "B) хотя", "C) чтобы", "D) если"],
//           correct_option: "B) хотя"
//         },
//         {
//           id: 4,
//           type: "open",
//           cefr_target: "B1-B2",
//           skill: "Morphology",
//           prompt: `Напишите глагол «исправить» в форме прошедшего времени мужского рода: `
//         },
//         {
//           id: 5,
//           type: "open",
//           cefr_target: "C1",
//           skill: "Production",
//           prompt: `Напишите 1 - 2 предложения, выражающие ваше мнение о роли технологий в образовании: `
//         }
//       ]
//     };
//   }
// }

// // ── Call 7: Universal CEFR Placement Test Evaluator ───────────────────────────
// export async function evaluateLevelTest(targetLanguage, mediatorLanguage, questions, userAnswers) {
//   const prompt = `You are a certified psychometric CEFR language testing specialist evaluating a full placement test.
// Target Language: ${targetLanguage}.
// Mediator Language for report: ${mediatorLanguage}.

// Questions and Student Answers:
// ${questions.map((q, i) => `Q${i + 1} (${q.skill}):\nPrompt: ${q.prompt}\nStudent Answer: "${userAnswers[i] || "No answer"}"`).join("\n\n")}

// UNIVERSAL EVALUATION MANDATE:
// 1. SEMANTIC INTENT CHECK:
// - If the student states in ANY language that they do not know or cannot answer, they MUST NOT receive vocabulary or syntax points in ${targetLanguage} !
//   2. TARGET LANGUAGE PROFICIENCY ONLY:
// - Grade ONLY actual words, grammar, and structures produced in ${targetLanguage}.
// - Sentences in ${mediatorLanguage} saying they don't know ${targetLanguage} are strictly worth 0 points!
// 3. SCORING BREAKDOWN(0 to 25 each):
// - If no valid ${targetLanguage} was demonstrated, overall score MUST BE 0, and level MUST BE Beginner(A1).

// Return ONLY JSON:
// {
//   "admits_zero_knowledge": true | false,
//     "target_language_demonstrated": true | false,
//       "detected_level": "Beginner | Intermediate | Advanced",
//         "cefr_grade": "A1 | A2 | B1 | B2 | C1 | C2",
//           "score": 0,
//             "breakdown": {
//     "vocabulary": "Score out of 25",
//       "grammar": "Score out of 25",
//         "syntax": "Score out of 25",
//           "production": "Score out of 25"
//   },
//   "recommendations": "Advice in ${mediatorLanguage}."
// } `;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.1,
//         max_tokens: 700,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );

//     const raw = response.choices[0]?.message?.content?.trim();
//     const parsed = JSON.parse(extractJsonObject(raw));

//     if (parsed.admits_zero_knowledge || !parsed.target_language_demonstrated) {
//       return {
//         detected_level: "Beginner",
//         cefr_grade: "A1",
//         score: 0,
//         breakdown: {
//           vocabulary: "0 / 25",
//           grammar: "0 / 25",
//           syntax: "0 / 25",
//           production: "0 / 25"
//         },
//         recommendations: parsed.recommendations || `Начнем изучение ${targetLanguage} с самого начала: алфавит, простые слова и базовые фразы.`
//       };
//     }

//     return parsed;
//   } catch (err) {
//     console.error("Evaluation error:", err.message);
//     return {
//       detected_level: "Beginner",
//       cefr_grade: "A1",
//       score: 0,
//       breakdown: {
//         vocabulary: "0 / 25",
//         grammar: "0 / 25",
//         syntax: "0 / 25",
//         production: "0 / 25"
//       },
//       recommendations: `Начнем изучение ${targetLanguage} с нуля.`
//     };
//   }
// }

// // ── Call 8: Semantic Quiz Judge ───────────────────────────────────────────────
// export async function checkSemanticAnswer(wordOrPhrase, submittedAnswer, correctAnswer, synonyms = "") {
//   const submitted = String(submittedAnswer || "").trim();
//   if (!submitted) return { correct: false, isSynonym: false, explanation: "No answer provided." };

//   const prompt = `You are a language quiz judge grading a student's answer.
// Target Word: "${wordOrPhrase}"
// Accepted Answer: "${correctAnswer}"
// Known Synonyms: "${synonyms || "none"}"
// Student Answer: "${submitted}"

// Accept synonyms, paraphrases, and subsets(e.g.if accepted answer is "the rest, other ones", then "rest", "the rest", "others" are ALL 100 % CORRECT).
// Return ONLY JSON:
// {
//   "correct": true,
//     "isSynonym": true,
//       "explanation": "..."
// } `;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0,
//         max_tokens: 250,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );
//     const raw = response.choices[0]?.message?.content?.trim();
//     const parsed = JSON.parse(extractJsonObject(raw));
//     return {
//       correct: Boolean(parsed.correct),
//       isSynonym: Boolean(parsed.isSynonym),
//       explanation: parsed.explanation || (parsed.correct ? "Correct!" : `Accepted: ${correctAnswer} `)
//     };
//   } catch (err) {
//     return smartFallbackMatch(submitted, correctAnswer, synonyms);
//   }
// }

// function smartFallbackMatch(submitted, correctAnswer, synonyms = "") {
//   const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
//   const sub = norm(submitted);
//   const targets = [correctAnswer, ...(synonyms ? synonyms.split(",") : [])].flatMap((t) => t.split(/[,;/]/)).map(norm).filter(Boolean);
//   for (const t of targets) {
//     if (sub === t || t.includes(sub) || sub.includes(t)) {
//       return { correct: true, isSynonym: sub !== norm(correctAnswer), explanation: "Accepted!" };
//     }
//   }
//   return { correct: false, isSynonym: false, explanation: `Correct answer: ${correctAnswer} ` };
// }

// // ── Call: Full Pedagogical Grammar Guide Generator ────────────────────────────
// // ── Call: Full Pedagogical Grammar Guide Generator ────────────────────────────

// // ── Chat Pipeline ─────────────────────────────────────────────────────────────
// export async function chat(userId, userMessage, history, language, level, languageKey, mediatorLanguage = "english") {
//   const conversationMessages = [
//     ...history.map((h) => ({ role: h.role, content: h.content })),
//     { role: "user", content: userMessage },
//   ];

//   const [conversationResponse, analysisResponse] = await Promise.all([
//     withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: buildConversationPrompt(language, level, mediatorLanguage) },
//           ...conversationMessages,
//         ],
//         temperature: 0.6,
//         max_tokens: 3500, // <-- Set to 3500 so full tables & paradigms are never truncated
//         ...reasoningParams(model),
//       })
//     ),
//     withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: buildAnalysisPrompt(language, level, mediatorLanguage) },
//           ...conversationMessages.slice(-4),
//         ],
//         temperature: 0.1,
//         max_tokens: 850,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     ),
//   ]);

//   const rawReply = conversationResponse.choices[0].message.content?.trim();
//   let reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

//   // Separate spoken target language from written mediator explanation for clean TTS
//   let spokenReply = null;
//   const speechMatch = reply.match(/\[SPEECH\]([\s\S]*?)\[\/SPEECH\]/i);
//   if (speechMatch) {
//     spokenReply = speechMatch[1].trim();
//     reply = reply.replace(/\[SPEECH\][\s\S]*?\[\/SPEECH\]/i, "").trim();
//   }

//   let analysisData = { correctionText: "✅ Perfect!", mistakes: [], grammar_topic: null };
//   try {
//     const rawAnalysis = analysisResponse.choices[0].message.content?.trim();
//     analysisData = JSON.parse(extractJsonObject(rawAnalysis));
//   } catch (err) {
//     console.error("Failed to parse analysis JSON:", err.message);
//   }

//   const correction = analysisData.correctionText || "✅ Perfect!";
//   const mistakes = Array.isArray(analysisData.mistakes) ? analysisData.mistakes : [];

//   for (const m of mistakes) {
//     if (!m.initial_form || !m.meaning) continue;

//     const cleanWord = m.initial_form.trim();
//     if (cleanWord.length <= 1 || cleanWord.toLowerCase() === 'не' || cleanWord.toLowerCase() === 'о' || cleanWord.toLowerCase() === 'а' || cleanWord.toLowerCase() === 'в') continue;

//     try {
//       await addFlashcard(userId, {
//         word: cleanWord,
//         correction: m.meaning.trim(),
//         context: m.explanation || m.sentence || "",
//         language: languageKey,
//         initial_form: cleanWord,
//         used_form: m.used_form?.trim() || cleanWord,
//         part_of_speech: m.part_of_speech?.trim() || "word",
//         synonyms: m.synonyms?.trim() || "",
//         explanation: m.explanation?.trim() || "",
//         sentence: m.sentence?.trim() || userMessage,
//         transcription: m.transcription?.trim() || null,
//         pronunciation_rule: m.pronunciation_rule?.trim() || null,
//         grammar_rule: m.grammar_rule?.trim() || null,
//         orthography_rule: m.orthography_rule?.trim() || null,
//         syntax_rule: m.syntax_rule?.trim() || null,
//         semantics_note: m.semantics_note?.trim() || null
//       });
//     } catch (err) {
//       console.error(`Flashcard DB insert failed for "${m.initial_form}": `, err.message);
//     }
//   }

//   let savedTopic = null;
//   if (analysisData.grammar_topic && analysisData.grammar_topic.title) {
//     try {
//       savedTopic = await saveGrammarTopic(userId, languageKey, {
//         title: analysisData.grammar_topic.title,
//         category: analysisData.grammar_topic.category || "General Grammar",
//         rule_summary: analysisData.grammar_topic.rule_summary || "",
//         explanation: analysisData.grammar_topic.explanation || reply,
//         examples: analysisData.grammar_topic.examples || []
//       });
//     } catch (err) {
//       console.error("Grammar topic DB insert failed:", err.message);
//     }
//   }

//   await addHistory(userId, "user", userMessage);
//   await addHistory(userId, "assistant", reply);

//   return { correction, reply, spokenReply, grammarTopic: savedTopic };
// }

// // ── Call 9: Pedagogically Comprehensive Roadmap Builder ──────────────────────

// // In ai.js:

// export function cleanRoadmapText(raw) {
//   if (!raw) return "";
//   return raw
//     .replace(/<[^>]+>/g, "")
//     .replace(/\*\*(.*?)\*\*/g, "$1")
//     .replace(/\*(.*?)\*/g, "$1")
//     .replace(/__(.*?)__/g, "$1")
//     .replace(/_(.*?)_/g, "$1")
//     .replace(/[\u2010\u2011]/g, "-") // Convert non-breaking hyphens to regular hyphens
//     .replace(/[\u2013\u2014]/g, " — ") // Convert en/em dashes
//     .replace(/\u00A0/g, " ") // Non-breaking space
//     .replace(/--+/g, " — ")
//     .replace(/^[\s]*[-*+]\s+/gm, "• ")
//     .replace(/[`*]/g, "")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim();
// }

// function buildRoadmapPrompt(language, level, mediatorLanguage = "english", recentContext = "") {
//   const isAdvanced = String(level || "").toLowerCase().includes("advanced");
//   // For Advanced learners: 100% Target Language immersion
//   // For Beginners & Intermediates: Mediator Language so they understand their curriculum!
//   const outputLanguage = isAdvanced ? language : (mediatorLanguage || "english");

//   return `You are a senior CEFR curriculum specialist.
// Create a structured, in-depth 6-section Learning Roadmap & 7-Day Study Plan for a student learning ${language}.
// The student's CEFR level is ${level.toUpperCase()}.
// The language you MUST write the entire report and all instructions in: ${outputLanguage.toUpperCase()}.

// ${isAdvanced
//       ? `CRITICAL ADVANCED IMMERSION: The student is ADVANCED. Write 100% of the text, headings, and explanations in ${language.toUpperCase()}.`
//       : `CRITICAL BEGINNER/INTERMEDIATE PEDAGOGY: The student is ${level.toUpperCase()}. Write all instructions, analysis, and goals in their mediator language: ${outputLanguage.toUpperCase()}, quoting specific words in ${language}.`}

// CRITICAL FORMATTING RULES:
// - Never output raw HTML tags (<br>, <u>, <span>, <table>).
// - Never output markdown punctuation noise (** or --).
// - Use uppercase section headers and clean bullet points ("•").
// - Do NOT output flashcard lists or Front/Back tables.

// ${recentContext ? `STUDENT'S RECENT STUDY CONTEXT:\n${recentContext}\n` : ""}

// Structure required:
// 1. 🎯 Current CEFR Standing & Trajectory (${level})
// 2. 📈 Recently Demonstrated Strengths
// 3. 🔍 Diagnostics & Weak Areas Under Repair
// 4. 🔄 Active Vocabulary to Recycle
// 5. 🚀 Actionable Milestone Goals (Next 1-2 Weeks)
// 6. 🗓 7-Day Targeted Practice Regimen`;
// }

// export async function generateGrammarGuide(targetLanguage, mediatorLanguage, topicOrQuery, userLevel = "Beginner") {
//   const isAdvanced = String(userLevel || "").toLowerCase().includes("advanced");
//   const guideLanguage = isAdvanced ? targetLanguage : (mediatorLanguage || "english");

//   const prompt = `You are an expert university professor of ${targetLanguage} linguistics.
// Create a comprehensive, publication-grade Grammar Reference Guide for a student at ${userLevel} level.
// Language to write explanations in: ${guideLanguage.toUpperCase()}.
// Topic: "${topicOrQuery}"

// CRITICAL ANTI-CORRUPTION RULES:
// - "explanation" MUST BE plain readable text and markdown tables. NEVER output raw JSON syntax or curly braces like {"target": ...} inside the explanation!
// - "examples" MUST BE a real JSON array of objects.

// Return strictly JSON:
// {
//   "title": "Clear concise topic title",
//   "category": "Grammar category",
//   "rule_summary": "1-2 sentence core takeaway",
//   "explanation": "Full comprehensive explanation with clean tables and structural rules (NO raw JSON inside this text!)",
//   "examples": [
//     { "target": "Natural sentence in ${targetLanguage}", "translation": "Accurate translation", "note": "Grammatical point" }
//   ]
// }`;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [{ role: "user", content: prompt }],
//         temperature: 0.2,
//         max_tokens: 3500,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );
//     const raw = response.choices[0]?.message?.content?.trim();
//     return JSON.parse(extractJsonObject(raw));
//   } catch (err) {
//     console.error("Grammar guide generation error:", err);
//     return null;
//   }
// }
// export async function generateRoadmap(userId, language, level, mediatorLanguage = "english") {
//   const recent = await getHistory(userId, 10);
//   const contextSnippet = recent
//     .map((h) => `${h.role === "user" ? "Student" : "Coach"}: ${h.content}`)
//     .join("\n")
//     .slice(0, 1500);

//   const isAdvanced = level.toLowerCase().includes("advanced");
//   const outputLanguage = isAdvanced ? language : mediatorLanguage;

//   const response = await withModelFallback(CHAT_MODELS, (model) =>
//     groq.chat.completions.create({
//       model,
//       messages: [
//         {
//           role: "system",
//           content: buildRoadmapPrompt(language, level, mediatorLanguage, contextSnippet),
//         },
//         {
//           role: "user",
//           content: `Please generate my complete, structured 6-section Learning Roadmap & 7-Day Study Plan for ${language} in ${outputLanguage}. Do not output flashcards, HTML tags, or markdown asterisks.`,
//         },
//       ],
//       temperature: 0.3,
//       max_tokens: 2500, // Generous budget ensures zero mid-sentence truncation
//       ...reasoningParams(model),
//     })
//   );

//   const raw = response.choices[0]?.message?.content?.trim();
//   if (!raw) return null;

//   const clean = cleanRoadmapText(raw);
//   await saveRoadmap(userId, clean);
//   return clean;
// }

// export async function maybeGenerateRoadmap(userId, language, level, mediatorLanguage = "english") {
//   const userMessageCount = await countUserMessages(userId);
//   if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

//   const recent = await getHistory(userId, 20);
//   if (recent.length === 0) return null;

//   return await generateRoadmap(userId, language, level, mediatorLanguage);
// }

// function stripForSpeech(text) {
//   return text
//     .replace(/\[SPEECH\][\s\S]*?\[\/SPEECH\]/gi, "")
//     .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
//     .replace(/\*\*(.*?)\*\*/g, "$1")
//     .replace(/__(.*?)__/g, "$1")
//     .replace(/\*(.*?)\*/g, "$1")
//     .replace(/_(.*?)_/g, "$1")
//     .replace(/```[\s\S]*?```/g, "")
//     .replace(/`([^`]*)`/g, "$1")
//     .replace(/^#{1,6}\s*/gm, "")
//     .replace(/^>\s?/gm, "")
//     .replace(/^[\s]*[-*+]\s+/gm, "")
//     .replace(/[*_~`#]/g, "")
//     .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
//     .replace(/\n{2,}/g, ". ")
//     .replace(/\n/g, " ")
//     .replace(/\s{2,}/g, " ")
//     .trim();
// }

// export async function textToSpeech(text, languageKey) {
//   const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
//   const folder = tmpdir();
//   const spokenText = stripForSpeech(text);

//   if (!spokenText) return null;

//   try {
//     const tts = new MsEdgeTTS();
//     await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
//     const { audioFilePath } = await tts.toFile(folder, spokenText);
//     return audioFilePath;
//   } catch (err) {
//     console.error("TTS error:", err);
//     return null;
//   }
// }

// export async function cleanupFile(filePath) {
//   try {
//     await unlink(filePath);
//   } catch (_) { }
// }

// export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
//   const file = await toFile(audioBuffer, filename, { type: "audio/ogg" });
//   return withModelFallback(STT_MODELS, (model) =>
//     groq.audio.transcriptions.create({
//       file,
//       model,
//       response_format: "text",
//     })
//   );
// }
