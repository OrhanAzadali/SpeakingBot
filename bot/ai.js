// ai.js
import Groq, { toFile } from "groq-sdk";
import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap, saveGrammarTopic } from "./db.js";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { unlink } from "fs/promises";
import { tmpdir } from "os";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Current production models per Groq's deprecation roadmap. Rate limits are per-model,
// so cycling through distinct models on a 429 accesses separate quota buckets rather
// than retrying the exhausted one. High-throughput Llama models are included alongside
// gpt-oss and qwen to guarantee zero model-deprecation crashes.
const CHAT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b"
];
const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// gpt-oss models spend completion tokens on hidden chain-of-thought before
// writing any visible content. With a low max_tokens, a request that needs
// real reasoning can exhaust the budget on hidden reasoning, returning an empty
// message.content. reasoning_effort:"low" keeps the model from over-spending
// on reasoning for simple turns; other models ignore or omit this parameter.
function reasoningParams(model) {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}

// Tries each model in order, falling back on an actual rate-limit (429) or transient
// failure. Logs a warning and continues down the list, re-throwing only if all models fail.
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
  * Nouns: MUST be singular nominative (e.g. Russian: "вопрос", "дружба", "горшок", "крыша"; German: "Buch", "Freundschaft").
  * Verbs: MUST be bare infinitive (e.g. Russian: "исправить", "читать"; German: "lesen"; Spanish: "tener").
  * Adjectives: MUST be masculine singular nominative base form (e.g. Russian: "разный", "черепичный", "предыдущий").
  * Pronouns: MUST be dictionary headword (e.g. Russian: "мой", "этот").
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
Whenever the student asks to explain words, conjugations, declensions, or grammar rules (e.g. "объясни слова...", "как спрягается...", "что значат...", "how is X conjugated?", "explain grammar"):
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
- If the student expresses confusion (e.g. "не понимаю", "i don't understand", "помоги"), asks for translation, or requests help in ${mediatorLanguage} (e.g. "нет, на русском", "speak English", "russich"):
  1. NEVER stubbornly stay only in ${language}! NEVER say "I only speak ${language}" or "wir bleiben auf ${language}".
  2. Use ${mediatorLanguage} to bridge the gap: explain what the phrase meant, translate it clearly, and give an easy template to reply.
- AUDIO/TEXT SEPARATION (CRITICAL):
  To prevent the ${language} Text-to-Speech voice engine from mispronouncing ${mediatorLanguage} words, wrap the pure ${language} sentences to be read aloud inside [SPEECH]...[/SPEECH] tags!
  Example format for Beginners:
  [SPEECH]
  Hallo! Wie heißt du?
  [/SPEECH]
  Без проблем, давай разберём по-русски! «Wie heißt du?» означает «Как тебя зовут?». Чтобы ответить, скажи: «Ich heiße ... [твоё имя]». Как зовут тебя?`
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

  const explanationDirective = isAdvanced
    ? `Since the student is ADVANCED, all fields ("meaning", "synonyms", "explanation", "pronunciation_rule", "grammar_rule", "orthography_rule", "syntax_rule", "semantics_note") MUST be written 100% in ${language} (monolingual immersion). Do NOT use any mediator language.`
    : `Since the student is ${level}, write all explanations, meanings, transcriptions, and linguistic rules and all your response strictly in the student's mediator language: ${mediatorLanguage.toUpperCase()}. Do NOT introduce any third language, and NEVER copy the target word into the meaning field.`;

  // In ai.js, inside buildAnalysisPrompt:

  return `You are a master ${language} lexicographer, syntactician, and grammar analyst.
Student level: ${level}.
Mediator language: ${mediatorLanguage}.
${explanationDirective}
${linguisticAccuracyBlock(language)}

CRITICAL GRAMMAR TOPIC EXTRACTION MANDATE:
- Whenever the student asks to explain grammar, words, conjugations, declensions, syntax, or cases (e.g. "объясни...", "как спрягается...", "что значат...", "how is X conjugated?", "explain grammar"), OR whenever this turn explains a grammatical rule/table:
  YOU MUST POPULATE "grammar_topic" with a complete, structured breakdown!
  DO NOT set "grammar_topic": null if grammar was explained!

FORMATTING RULES FOR "grammar_topic":
- "explanation": Write clean Markdown headers (###) and tables. NEVER output raw JSON curly braces or string objects like {"target": ...} inside the explanation text!
- "examples": Provide an array of structured objects: [{ "target": "...", "translation": "...", "note": "..." }]

Return your response strictly as a single JSON object with all the messages properly translated in a proper language depending on the level:
{
  "correctionText": "✅ Perfect!" OR "📝 Correction: <corrected sentence> (<1-sentence explanation>)" OR "ℹ️ It seems you got a bit confused, lets dive into it together in ${mediatorLanguage} language!",
  "grammar_topic": {
    "title": "Concise rule title",
    "category": "Sentence Structure | Verb Conjugation | Cases | Syntax | Pronouns",
    "rule_summary": "1-2 sentence core takeaway",
    "explanation": "Full comprehensive explanation formatted in clean Markdown without raw JSON",
    "examples": [
      { "target": "Example sentence in ${language}", "translation": "Translation in ${mediatorLanguage}", "note": "Grammatical usage note" }
    ]
  }, 
  "mistakes": [
    {
      "initial_form": "Pure dictionary lemma/infinitive headword in ${language} native script (e.g. 'вопрос', 'Buch', 'qırmızı')",
      "used_form": "The inflected word exactly as it appeared in the sentence",
      "part_of_speech": "noun | verb | adjective | adverb | pronoun | phrase | preposition",
      "transcription": "IPA + phonetic approximation with stress",
      "pronunciation_rule": "Phonetic rule (stress, silent letters, reductions, diphthongs)",
      "grammar_rule": "Morphological pattern, gender, conjugation/declension",
      "orthography_rule": "Spelling rules, capitalization, diacritics",
      "syntax_rule": "Case government, preposition requirements, word order",
      "semantics_note": "Collocations, nuances, register, false friends",
      "meaning": "Definition/translation (NEVER same as initial_form!)",
      "synonyms": "Comma-separated synonyms",
      "explanation": "Summary note for quick review",
      "sentence": "Full corrected sentence with the word wrapped in <u>word</u> (grammatically adjusted!)"
    }
  ]
};

Always recheck your response content and adjust the text to respect the grammar rules of the specific language you're using while responding`;
}

// ── Call 3: 4-Skill Drill Generator (Level-Aware Instructions & Skill Purity) ─
export async function generateSkillDrill(skill, targetLanguage, mediatorLanguage, level, drillType = "short") {
  const count = drillType === "huge" ? 10 : 5;
  const isAdvanced = level.toLowerCase().includes("advanced");
  const isIntermediate = level.toLowerCase().includes("intermediate");

  const promptLang = (isAdvanced || isIntermediate) ? targetLanguage : mediatorLanguage;

  const prompt = `You are an elite CEFR curriculum designer creating a ${drillType.toUpperCase()} ${skill.toUpperCase()} drill.
Target language being tested: ${targetLanguage}.
Student level: ${level}.
Instruction / Prompt language: ${promptLang}.

CRITICAL ANTI - CIRCULARITY & LEVEL - AWARE RULES:
1. NEVER ask to translate a word from ${targetLanguage} into ${targetLanguage} !
  2. INSTRUCTION LANGUAGE:
- For Advanced and Intermediate students, ALL question prompts MUST be written in ${targetLanguage} !
  - For Beginner students, question prompts are written in ${mediatorLanguage}.
3. ABSOLUTELY NO THIRD LANGUAGES(No English if neither target nor mediator is English).
4. GRAMMATICAL ADJUSTMENT: Words inside cloze sentence gaps must be declined / conjugated to fit sentence syntax.

SKILL PURITY MANDATE:
- If skill is "listening":
  * EVERY QUESTION MUST test LISTENING COMPREHENSION of an audio passage.
  * "audio_script": Spoken narrative / dialogue 100 % in ${targetLanguage} (30 - 50 words) to be read via TTS audio.
  * "prompt": Comprehension question in ${promptLang} asking about a concrete detail from that audio.
  * FORBIDDEN: Never ask to write an email or describe personal weekends in a listening drill!
  - If skill is "reading":
  * "reading_passage": 100 % in ${targetLanguage} (50 - 80 words).
  * "prompt": Comprehension question in ${promptLang}.
- If skill is "speaking":
  * Scenario in ${promptLang} requiring a voice message response in ${targetLanguage}.
- If skill is "writing":
  * Task instructions in ${promptLang} requiring written composition in ${targetLanguage}.

Generate EXACTLY ${count} questions.
Return ONLY JSON:
{
  "skill": "${skill}",
    "drill_type": "${drillType}",
      "questions": [
        {
          "id": 1,
          "type": "${skill === 'speaking' ? 'voice' : (skill === 'writing' ? 'open' : 'choice')}",
          ${skill === 'listening' ? `"audio_script": "Spoken text in ${targetLanguage}...",` : ""}
      ${skill === 'reading' ? `"reading_passage": "Text passage in ${targetLanguage}...",` : ""}
"prompt": "Question text in ${promptLang}...",
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
        max_tokens: 1800,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    const questions = parsed.questions || Object.values(parsed).find(Array.isArray);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("Invalid drill questions structure");
    return { skill, drill_type: drillType, questions };
  } catch (err) {
    console.error(`Skill drill generation failed for ${skill}: `, err.message);
    return {
      skill,
      drill_type: drillType,
      questions: [
        {
          id: 1,
          type: skill === "speaking" ? "voice" : (skill === "listening" ? "open" : "choice"),
          audio_script: skill === "listening" ? `Guten Tag.Der nächste Zug nach Hamburg fährt um vierzehn Uhr ab.` : undefined,
          reading_passage: skill === "reading" ? `Deutschland liegt in Mitteleuropa und besteht aus sechzehn Bundesländern.` : undefined,
          prompt: skill === "listening"
            ? (isAdvanced || isIntermediate ? `Um wie viel Uhr fährt der nächste Zug nach Hamburg ab ? ` : `В какое время отправляется следующий поезд в Гамбург ? `)
            : (skill === "speaking"
              ? `Erzählen Sie kurz über Ihren Tag.`
              : (skill === "writing"
                ? `Schreiben Sie zwei Sätze über Ihre Pläne für morgen.`
                : (isAdvanced || isIntermediate ? `Aus wie vielen Bundesländern besteht Deutschland ? ` : `Из скольких федеральных земель состоит Германия согласно тексту ? `))),
          options: (skill === "reading" || skill === "listening") ? ["A) 12:00", "B) 14:00", "C) 16:00", "D) 18:00"] : undefined,
          correct_answer: "B) 14:00"
        }
      ]
    };
  }
}

// ── Call 4: Universal AI-First Answer & Intent Classifier ─────────────────────
export async function analyzeStudentResponse(targetLanguage, mediatorLanguage, promptQuestion, userAnswer) {
  const prompt = `You are a universal psycholinguistic analyst and CEFR examiner.
A student was assigned a task in ${targetLanguage}.
Mediator language: ${mediatorLanguage}.

Question / Task: "${promptQuestion}"
Student's Actual Input: "${userAnswer}"

Analyze the student's input across ALL world languages (Arabic, Urdu, Mandarin, Spanish, Russian, English, Armenian, Hindi, etc.):

1. "detected_language": Identify the language the student typed in.
2. "is_target_language": true ONLY if the student used ${targetLanguage}. If they typed in ${mediatorLanguage} or any other language, false.
3. "intent": Classify the student's core intent:
  - "ADMIT_NO_KNOWLEDGE": The student is expressing that they do not know, cannot speak, do not understand, want to give up, or know nothing about ${targetLanguage} (e.g. "I don't know", "لا أعرف", "не знаю", "ne znayu", "не могу", "idk").
- "ANSWER_IN_WRONG_LANGUAGE": The student understood the factual question and provided the factual answer, but wrote it in ${mediatorLanguage} or another language instead of ${targetLanguage}.
- "GENUINE_ATTEMPT": The student attempted to answer or produce ${targetLanguage}.
- "UNRELATED_OR_EMPTY": Gibberish, greeting, empty response, or off - topic statement.
4. "target_language_proficiency_demonstrated": true ONLY if the student demonstrated actual vocabulary, grammar, or syntax in ${targetLanguage}.
5. "correct_answer_in_target_language": Give the exact, natural correct answer in ${targetLanguage}.
6. "explanation_in_mediator": Concise feedback written in ${mediatorLanguage} explaining the correct answer without robotic templates.
7. "extracted_mistakes": Extract rich linguistic attributes for any new words:
  - "initial_form": Pure uninflected dictionary lemma headword in ${targetLanguage}.
- "part_of_speech": noun, verb, adjective, etc.
   - "transcription": IPA + phonetic reading.
   - "pronunciation_rule": Phonetic rule.
   - "grammar_rule": Morphological properties.
   - "orthography_rule": Spelling rule.
   - "syntax_rule": Case government and prepositions.
   - "semantics_note": Nuance and collocations.
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
} `;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 850,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    return JSON.parse(extractJsonObject(raw));
  } catch (err) {
    console.error("Universal analysis error:", err.message);
    return {
      detected_language: "unknown",
      is_target_language: false,
      intent: "ADMIT_NO_KNOWLEDGE",
      target_language_proficiency_demonstrated: false,
      score_recommendation: 0,
      correct_answer_in_target_language: "",
      explanation_in_mediator: "Ответ записан.",
      extracted_mistakes: []
    };
  }
}

// ── Call 5: Universal Skill Drill Evaluator ──────────────────────────────────
export async function evaluateSkillAnswer(skill, targetLanguage, mediatorLanguage, level, question, userAnswer, isVoice = false) {
  const analysis = await analyzeStudentResponse(targetLanguage, mediatorLanguage, question.prompt, userAnswer);

  let score = 0;
  let feedback = analysis.explanation_in_mediator;

  switch (analysis.intent) {
    case "ADMIT_NO_KNOWLEDGE":
      score = 0;
      feedback = `Ничего страшного! Вы указали, что не знаете ответ.В ${targetLanguage} правильный ответ: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
      break;

    case "ANSWER_IN_WRONG_LANGUAGE":
      score = 20;
      feedback = `Вы поняли суть вопроса, но ответили на языке ${analysis.detected_language} («${userAnswer}»). Ответ должен быть на ${targetLanguage}: ${analysis.correct_answer_in_target_language}.`;
      break;

    case "GENUINE_ATTEMPT":
      score = Math.max(70, analysis.score_recommendation || 80);
      break;

    case "UNRELATED_OR_EMPTY":
    default:
      score = 0;
      feedback = `Ответ не относится к вопросу.Правильный ответ на ${targetLanguage}: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
      break;
  }

  return {
    score,
    feedback,
    mistakes: analysis.extracted_mistakes || []
  };
}

// ── Call 6: CEFR Placement Test Generator (Level-Calibrated Language) ─────────
export async function generateLevelTest(targetLanguage, mediatorLanguage = "english") {
  const prompt = `You are a certified psychometric CEFR language testing specialist.
Create a diagnostic placement test to assess proficiency in ${targetLanguage}.

DIRECTIONAL & CEFR METHODOLOGY:
1. NEVER ask: "Выберите перевод слова [TargetWord] на [TargetLanguage]".
2. INSTRUCTION LANGUAGE:
- For Q1 - Q3(A1 to B2), write instructions in ${mediatorLanguage}, testing items strictly in ${targetLanguage}.
- For Q4 - Q5(B2 to C1), question instructions must be written directly in ${targetLanguage} !
  3. All cloze gaps(____) must test words grammatically adjusted in context.
4. NO THIRD LANGUAGES.

Return ONLY JSON:
{
  "questions": [
    {
      "id": 1,
      "type": "choice",
      "cefr_target": "A1-A2",
      "skill": "Vocabulary",
      "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "A) ..."
    },
    {
      "id": 2,
      "type": "choice",
      "cefr_target": "B1",
      "skill": "Grammar",
      "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "B) ..."
    },
    {
      "id": 3,
      "type": "choice",
      "cefr_target": "B2",
      "skill": "Syntax",
      "prompt": "Instructions in ${mediatorLanguage} + sentence in ${targetLanguage} with ____",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "C) ..."
    },
    {
      "id": 4,
      "type": "open",
      "cefr_target": "B1-B2",
      "skill": "Morphology",
      "prompt": "Prompt in ${targetLanguage} requiring a specific grammatical form..."
    },
    {
      "id": 5,
      "type": "open",
      "cefr_target": "C1",
      "skill": "Production",
      "prompt": "Production prompt in ${targetLanguage} asking for 1-2 sentences..."
    }
  ]
} `;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    const questions = parsed.questions || Object.values(parsed).find(Array.isArray);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("No questions generated");
    return { questions };
  } catch (err) {
    return {
      questions: [
        {
          id: 1,
          type: "choice",
          cefr_target: "A1-A2",
          skill: "Vocabulary",
          prompt: `Выберите подходящее слово для завершения предложения: \n"Вчера я прочитал интересную _____ в библиотеке."`,
          options: ["A) книгу", "B) хлеб", "C) стол", "D) машину"],
          correct_option: "A) книгу"
        },
        {
          id: 2,
          type: "choice",
          cefr_target: "B1",
          skill: "Grammar",
          prompt: `Выберите правильную форму глагола: \n"Если у меня будет время, я завтра тебе _____."`,
          options: ["A) позвоню", "B) звонил", "C) звонить", "D) позвонили"],
          correct_option: "A) позвоню"
        },
        {
          id: 3,
          type: "choice",
          cefr_target: "B2",
          skill: "Syntax",
          prompt: `Выберите правильный союз: \n"Он пошёл на работу, _____ чувствовал себя не очень хорошо."`,
          options: ["A) потому что", "B) хотя", "C) чтобы", "D) если"],
          correct_option: "B) хотя"
        },
        {
          id: 4,
          type: "open",
          cefr_target: "B1-B2",
          skill: "Morphology",
          prompt: `Напишите глагол «исправить» в форме прошедшего времени мужского рода: `
        },
        {
          id: 5,
          type: "open",
          cefr_target: "C1",
          skill: "Production",
          prompt: `Напишите 1 - 2 предложения, выражающие ваше мнение о роли технологий в образовании: `
        }
      ]
    };
  }
}

// ── Call 7: Universal CEFR Placement Test Evaluator ───────────────────────────
export async function evaluateLevelTest(targetLanguage, mediatorLanguage, questions, userAnswers) {
  const prompt = `You are a certified psychometric CEFR language testing specialist evaluating a full placement test.
Target Language: ${targetLanguage}.
Mediator Language for report: ${mediatorLanguage}.

Questions and Student Answers:
${questions.map((q, i) => `Q${i + 1} (${q.skill}):\nPrompt: ${q.prompt}\nStudent Answer: "${userAnswers[i] || "No answer"}"`).join("\n\n")}

UNIVERSAL EVALUATION MANDATE:
1. SEMANTIC INTENT CHECK:
- If the student states in ANY language that they do not know or cannot answer, they MUST NOT receive vocabulary or syntax points in ${targetLanguage} !
  2. TARGET LANGUAGE PROFICIENCY ONLY:
- Grade ONLY actual words, grammar, and structures produced in ${targetLanguage}.
- Sentences in ${mediatorLanguage} saying they don't know ${targetLanguage} are strictly worth 0 points!
3. SCORING BREAKDOWN(0 to 25 each):
- If no valid ${targetLanguage} was demonstrated, overall score MUST BE 0, and level MUST BE Beginner(A1).

Return ONLY JSON:
{
  "admits_zero_knowledge": true | false,
    "target_language_demonstrated": true | false,
      "detected_level": "Beginner | Intermediate | Advanced",
        "cefr_grade": "A1 | A2 | B1 | B2 | C1 | C2",
          "score": 0,
            "breakdown": {
    "vocabulary": "Score out of 25",
      "grammar": "Score out of 25",
        "syntax": "Score out of 25",
          "production": "Score out of 25"
  },
  "recommendations": "Advice in ${mediatorLanguage}."
} `;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );

    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));

    if (parsed.admits_zero_knowledge || !parsed.target_language_demonstrated) {
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
        recommendations: parsed.recommendations || `Начнем изучение ${targetLanguage} с самого начала: алфавит, простые слова и базовые фразы.`
      };
    }

    return parsed;
  } catch (err) {
    console.error("Evaluation error:", err.message);
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
      recommendations: `Начнем изучение ${targetLanguage} с нуля.`
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

Accept synonyms, paraphrases, and subsets(e.g.if accepted answer is "the rest, other ones", then "rest", "the rest", "others" are ALL 100 % CORRECT).
Return ONLY JSON:
{
  "correct": true,
    "isSynonym": true,
      "explanation": "..."
} `;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 250,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );
    const raw = response.choices[0]?.message?.content?.trim();
    const parsed = JSON.parse(extractJsonObject(raw));
    return {
      correct: Boolean(parsed.correct),
      isSynonym: Boolean(parsed.isSynonym),
      explanation: parsed.explanation || (parsed.correct ? "Correct!" : `Accepted: ${correctAnswer} `)
    };
  } catch (err) {
    return smartFallbackMatch(submitted, correctAnswer, synonyms);
  }
}

function smartFallbackMatch(submitted, correctAnswer, synonyms = "") {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const sub = norm(submitted);
  const targets = [correctAnswer, ...(synonyms ? synonyms.split(",") : [])].flatMap((t) => t.split(/[,;/]/)).map(norm).filter(Boolean);
  for (const t of targets) {
    if (sub === t || t.includes(sub) || sub.includes(t)) {
      return { correct: true, isSynonym: sub !== norm(correctAnswer), explanation: "Accepted!" };
    }
  }
  return { correct: false, isSynonym: false, explanation: `Correct answer: ${correctAnswer} ` };
}

// ── Call: Full Pedagogical Grammar Guide Generator ────────────────────────────
// ── Call: Full Pedagogical Grammar Guide Generator ────────────────────────────

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
        max_tokens: 3500, // <-- Set to 3500 so full tables & paradigms are never truncated
        ...reasoningParams(model),
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
        ...reasoningParams(model),
      })
    ),
  ]);

  const rawReply = conversationResponse.choices[0].message.content?.trim();
  let reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

  // Separate spoken target language from written mediator explanation for clean TTS
  let spokenReply = null;
  const speechMatch = reply.match(/\[SPEECH\]([\s\S]*?)\[\/SPEECH\]/i);
  if (speechMatch) {
    spokenReply = speechMatch[1].trim();
    reply = reply.replace(/\[SPEECH\][\s\S]*?\[\/SPEECH\]/i, "").trim();
  }

  let analysisData = { correctionText: "✅ Perfect!", mistakes: [], grammar_topic: null };
  try {
    const rawAnalysis = analysisResponse.choices[0].message.content?.trim();
    analysisData = JSON.parse(extractJsonObject(rawAnalysis));
  } catch (err) {
    console.error("Failed to parse analysis JSON:", err.message);
  }

  const correction = analysisData.correctionText || "✅ Perfect!";
  const mistakes = Array.isArray(analysisData.mistakes) ? analysisData.mistakes : [];

  for (const m of mistakes) {
    if (!m.initial_form || !m.meaning) continue;

    const cleanWord = m.initial_form.trim();
    if (cleanWord.length <= 1 || cleanWord.toLowerCase() === 'не' || cleanWord.toLowerCase() === 'о' || cleanWord.toLowerCase() === 'а' || cleanWord.toLowerCase() === 'в') continue;

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
      console.error(`Flashcard DB insert failed for "${m.initial_form}": `, err.message);
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
      });
    } catch (err) {
      console.error("Grammar topic DB insert failed:", err.message);
    }
  }

  await addHistory(userId, "user", userMessage);
  await addHistory(userId, "assistant", reply);

  return { correction, reply, spokenReply, grammarTopic: savedTopic };
}

// ── Call 9: Pedagogically Comprehensive Roadmap Builder ──────────────────────

// In ai.js:

export function cleanRoadmapText(raw) {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/[\u2010\u2011]/g, "-") // Convert non-breaking hyphens to regular hyphens
    .replace(/[\u2013\u2014]/g, " — ") // Convert en/em dashes
    .replace(/\u00A0/g, " ") // Non-breaking space
    .replace(/--+/g, " — ")
    .replace(/^[\s]*[-*+]\s+/gm, "• ")
    .replace(/[`*]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRoadmapPrompt(language, level, mediatorLanguage = "english", recentContext = "") {
  const isAdvanced = String(level || "").toLowerCase().includes("advanced");
  // For Advanced learners: 100% Target Language immersion
  // For Beginners & Intermediates: Mediator Language so they understand their curriculum!
  const outputLanguage = isAdvanced ? language : (mediatorLanguage || "english");

  return `You are a senior CEFR curriculum specialist.
Create a structured, in-depth 6-section Learning Roadmap & 7-Day Study Plan for a student learning ${language}.
The student's CEFR level is ${level.toUpperCase()}.
The language you MUST write the entire report and all instructions in: ${outputLanguage.toUpperCase()}.

${isAdvanced
      ? `CRITICAL ADVANCED IMMERSION: The student is ADVANCED. Write 100% of the text, headings, and explanations in ${language.toUpperCase()}.`
      : `CRITICAL BEGINNER/INTERMEDIATE PEDAGOGY: The student is ${level.toUpperCase()}. Write all instructions, analysis, and goals in their mediator language: ${outputLanguage.toUpperCase()}, quoting specific words in ${language}.`}

CRITICAL FORMATTING RULES:
- Never output raw HTML tags (<br>, <u>, <span>, <table>).
- Never output markdown punctuation noise (** or --).
- Use uppercase section headers and clean bullet points ("•").
- Do NOT output flashcard lists or Front/Back tables.

${recentContext ? `STUDENT'S RECENT STUDY CONTEXT:\n${recentContext}\n` : ""}

Structure required:
1. 🎯 Current CEFR Standing & Trajectory (${level})
2. 📈 Recently Demonstrated Strengths
3. 🔍 Diagnostics & Weak Areas Under Repair
4. 🔄 Active Vocabulary to Recycle
5. 🚀 Actionable Milestone Goals (Next 1-2 Weeks)
6. 🗓 7-Day Targeted Practice Regimen`;
}

export async function generateGrammarGuide(targetLanguage, mediatorLanguage, topicOrQuery, userLevel = "Beginner") {
  const isAdvanced = String(userLevel || "").toLowerCase().includes("advanced");
  const guideLanguage = isAdvanced ? targetLanguage : (mediatorLanguage || "english");

  const prompt = `You are an expert university professor of ${targetLanguage} linguistics.
Create a comprehensive, publication-grade Grammar Reference Guide for a student at ${userLevel} level.
Language to write explanations in: ${guideLanguage.toUpperCase()}.
Topic: "${topicOrQuery}"

CRITICAL ANTI-CORRUPTION RULES:
- "explanation" MUST BE plain readable text and markdown tables. NEVER output raw JSON syntax or curly braces like {"target": ...} inside the explanation!
- "examples" MUST BE a real JSON array of objects.

Return strictly JSON:
{
  "title": "Clear concise topic title",
  "category": "Grammar category",
  "rule_summary": "1-2 sentence core takeaway",
  "explanation": "Full comprehensive explanation with clean tables and structural rules (NO raw JSON inside this text!)",
  "examples": [
    { "target": "Natural sentence in ${targetLanguage}", "translation": "Accurate translation", "note": "Grammatical point" }
  ]
}`;

  try {
    const response = await withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    );
    const raw = response.choices[0]?.message?.content?.trim();
    return JSON.parse(extractJsonObject(raw));
  } catch (err) {
    console.error("Grammar guide generation error:", err);
    return null;
  }
}
export async function generateRoadmap(userId, language, level, mediatorLanguage = "english") {
  const recent = await getHistory(userId, 10);
  const contextSnippet = recent
    .map((h) => `${h.role === "user" ? "Student" : "Coach"}: ${h.content}`)
    .join("\n")
    .slice(0, 1500);

  const isAdvanced = level.toLowerCase().includes("advanced");
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
      max_tokens: 2500, // Generous budget ensures zero mid-sentence truncation
      ...reasoningParams(model),
    })
  );

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;

  const clean = cleanRoadmapText(raw);
  await saveRoadmap(userId, clean);
  return clean;
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
