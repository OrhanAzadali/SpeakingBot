// ai.js
import Groq, { toFile } from "groq-sdk";
import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap } from "./db.js";
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

// Best Edge TTS voice for each supported language
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

// Robust helper to extract clean JSON even if wrapped in markdown code fences
function extractJsonObject(raw) {
  if (!raw) throw new Error("Empty response from AI");
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? match[0] : raw;
}

// ── Strict Lemma & Linguistic Accuracy Rules ──────────────────────────────────
function linguisticAccuracyBlock(language) {
  return `LINGUISTIC ACCURACY & STRICT BASE LEMMA MANDATE:
- Target language: ${language}.
- ALWAYS use the standard orthography of ${language}, including every diacritic and accent mark.
- STRICT BASE LEMMA / INFINITIVE RULE (MANDATORY):
  When extracting vocabulary for flashcards, "initial_form" MUST ALWAYS be the uninflected dictionary headword:
  * Nouns: MUST be singular nominative (e.g. Russian: "вопрос", "дружба", "книга"; German: "Buch", "Freundschaft"; Azerbaijani: "ev", "kitab").
  * Demonstratives/Pronouns: MUST be dictionary headword (e.g. Russian: "этот"; Azerbaijani: "bu", "o").
  * Verbs: MUST be the bare infinitive (e.g. German: "lesen"; Russian: "читать"; Spanish: "tener"; Azerbaijani: "oxumaq").
  * Adjectives: MUST be masculine singular nominative base form (e.g. German: "rot"; Russian: "красивый"; Azerbaijani: "qırmızı").
  NEVER output an inflected, case-declined, or conjugated form in "initial_form". Put the inflected form inside "used_form" only.`;
}

// ── Call 1: Spoken Conversation with Level-Aware Scaffolding ──────────────────
function buildConversationPrompt(language, level, mediatorLanguage = "english") {
  const isBeginner = level.toLowerCase().includes("beginner");

  const beginnerScaffolding = isBeginner
    ? `BEGINNER SCAFFOLDING & MEDIATOR SUPPORT RULE (MANDATORY FOR BEGINNERS):
- The student is a complete BEGINNER starting ${language} from scratch. Their native/mediator language is ${mediatorLanguage.toUpperCase()}.
- If the student expresses confusion (e.g. "не понимаю", "i don't understand", "what?", "помоги"), asks for translation, or asks to speak in their mediator language (e.g. "нет, на русском", "говори по-русски", "speak in English", "russich", "sprach russo"):
  1. DO NOT stubbornly stay only in ${language}! NEVER say "I only speak ${language}" or "wir bleiben auf ${language}". That prevents beginners from making progress!
  2. Switch to ${mediatorLanguage} to bridge the gap and help them:
     - Warmly acknowledge in ${mediatorLanguage} (e.g. "Без проблем, давай разберем по-русски!").
     - Explain what your previous ${language} sentence meant in ${mediatorLanguage}.
     - Give them the simple ${language} phrase with an exact translation (e.g. "«Wie heißt du?» означает «Как тебя зовут?»").
     - Show them an easy template to answer in ${language} (e.g. "Ответь так: «Ich heiße ... [твое имя]». Попробуй!").
- When introducing new questions or phrases to Beginners, always accompany them with a short helpful translation or clue in ${mediatorLanguage}.`
    : `INTERMEDIATE & ADVANCED IMMERSION RULE:
- The student is ${level.toUpperCase()}.
- You MUST conduct the conversation immersion entirely in ${language}.
- Do NOT switch your conversation replies to ${mediatorLanguage}. Keep them immersed in ${language}. If they struggle, simplify your ${language} vocabulary or rephrase in ${language}, but maintain target-language immersion.`;

  return `You are a friendly, encouraging, and voice-enabled ${language} language coach.
You CAN speak — your reply is automatically converted to audio and sent as a voice message.
The student's level is ${level}.
The student's mediator language is ${mediatorLanguage}.

${linguisticAccuracyBlock(language)}

${beginnerScaffolding}

Keep your replies concise (2-4 sentences). Plain natural sentences only: no markdown (no asterisks, bullet points), no emoji.`;
}

// ── Call 2: Grammar Analysis & Multi-Mistake Extraction ───────────────────────
function buildAnalysisPrompt(language, level, mediatorLanguage = "english") {
  const isAdvanced = level.toLowerCase().includes("advanced");

  const explanationDirective = isAdvanced
    ? `Since the student is ADVANCED, all fields ("meaning", "synonyms", "explanation") MUST be written 100% in ${language} (monolingual immersion). Do NOT use any mediator language.`
    : `Since the student is ${level}, write all explanations, meanings, and synonyms strictly in the student's mediator language: ${mediatorLanguage.toUpperCase()}. Do NOT introduce any third language, and NEVER copy the target word into the meaning field.`;

  return `You are a meticulous ${language} grammar and vocabulary analyst.
Student level: ${level}.
Mediator language: ${mediatorLanguage}.
${explanationDirective}
${linguisticAccuracyBlock(language)}

META-COMMUNICATION & HELP REQUEST HANDLING:
- If the student wrote in ${mediatorLanguage} to ask for help, request translation, or state that they don't understand (e.g. "не понимаю", "я не понимаю тебя", "нет, на русском", "help", "i don't understand", "russich", "sprach russo"):
  * DO NOT mark it as "✅ Perfect!" (it is not a valid ${language} sentence).
  * DO NOT treat it as a broken attempt at ${language} and invent a grammar correction for it (do NOT correct "не понимаю" into "Ich verstehe nicht", and do NOT correct "russich" into "Russisch")!
  * Set "correctionText" to a supportive acknowledgment in ${mediatorLanguage} (e.g. "ℹ️ Запрос помощи на ${mediatorLanguage}. Тренер объяснит фразу!").
  * Set "mistakes": [] (do NOT save flashcards for help cries).

Carefully analyze the student's most recent message for actual ${language} grammar, vocabulary, conjugation, and spelling errors across the ENTIRE message.

Return your response strictly as a single JSON object:
{
  "correctionText": "✅ Perfect!" OR "📝 Correction: <corrected sentence> (<1-sentence explanation>)" OR "ℹ️ Понятно, разбираем по-${mediatorLanguage}!",
  "mistakes": [
    {
      "initial_form": "Pure dictionary lemma/infinitive headword in ${language} native script (e.g. 'вопрос', 'Buch', 'qırmızı')",
      "used_form": "The inflected word exactly as it appeared in the sentence",
      "part_of_speech": "noun | verb | adjective | adverb | pronoun | phrase | preposition",
      "meaning": "Definition/translation of initial_form in ${isAdvanced ? language : mediatorLanguage} (NEVER the same word as initial_form!)",
      "synonyms": "Comma-separated synonyms in ${isAdvanced ? language : mediatorLanguage}",
      "explanation": "Short grammatical rule note in ${isAdvanced ? language : mediatorLanguage}",
      "sentence": "Full corrected sentence with the word wrapped in <u>word</u>"
    }
  ]
}`;
}

// ── Call 3: 4-Skill Drill Generator (Strict Skill Purity & Zero Circularity) ──
export async function generateSkillDrill(skill, targetLanguage, mediatorLanguage, level, drillType = "short") {
  const count = drillType === "huge" ? 10 : 5;

  const prompt = `You are an elite CEFR curriculum designer creating a ${drillType.toUpperCase()} ${skill.toUpperCase()} drill.
Target language being tested: ${targetLanguage}.
Mediator language for instructions: ${mediatorLanguage}.

CRITICAL ANTI-CIRCULARITY & VALIDITY RULES:
1. NEVER ask to translate a word from ${targetLanguage} into ${targetLanguage}!
   - BAD: "Выберите перевод слова «Buch» на немецкий язык" (CIRCULAR & FORBIDDEN).
   - GOOD (In-Context Cloze): Present a sentence in ${targetLanguage} with a blank (____) and provide 4 ${targetLanguage} options to choose from.
   - GOOD (Translation): "Как переводится слово «[слово на ${mediatorLanguage}]» на ${targetLanguage}?" with 4 ${targetLanguage} options.
2. ABSOLUTELY NO THIRD LANGUAGES:
   - Use ONLY ${targetLanguage} (for materials, passages, target phrases) and ${mediatorLanguage} (for instructions).
   - Do NOT use English if neither ${targetLanguage} nor ${mediatorLanguage} is English!

CRITICAL SKILL PURITY MANDATE:
- If skill is "listening":
  * EVERY SINGLE QUESTION (1 to ${count}) MUST test LISTENING COMPREHENSION of an audio passage.
  * "audio_script": Short spoken narrative/dialogue 100% in ${targetLanguage} (30-50 words) to be read via TTS audio.
  * "prompt": Comprehension question in ${mediatorLanguage} asking about a concrete detail or fact from that audio passage.
  * ABSOLUTELY FORBIDDEN: NEVER ask the student to write an email, compose an essay, or describe their weekend in a listening drill!
- If skill is "reading":
  * EVERY QUESTION MUST have a "reading_passage" 100% in ${targetLanguage} (50-80 words) and a comprehension question in ${mediatorLanguage}.
- If skill is "speaking":
  * Scenario in ${mediatorLanguage} requiring a voice message in ${targetLanguage}.
- If skill is "writing":
  * Writing task (email, short paragraph, essay) in ${mediatorLanguage} requiring text production in ${targetLanguage}.

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
      "prompt": "Comprehension question in ${mediatorLanguage}...",
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
    console.error(`Skill drill generation failed for ${skill}:`, err.message);
    return {
      skill,
      drill_type: drillType,
      questions: [
        {
          id: 1,
          type: skill === "speaking" ? "voice" : (skill === "listening" ? "open" : "choice"),
          audio_script: skill === "listening" ? `Der Zug nach Berlin fährt heute von Gleis vier ab und hat zehn Minuten Verspätung.` : undefined,
          reading_passage: skill === "reading" ? `Berlin ist die Hauptstadt von Deutschland. Die Stadt ist bekannt für ihre Museen und Geschichte.` : undefined,
          prompt: skill === "listening"
            ? `С какого пути отправляется поезд в Берлин согласно аудиозаписи?`
            : (skill === "speaking"
              ? `Erzählen Sie kurz über Ihren Tag. (Отправьте голосовое сообщение)`
              : (skill === "writing"
                ? `Schreiben Sie zwei Sätze über Ihre Pläne für morgen.`
                : `Какая столица у Германии согласно тексту?`)),
          options: (skill === "reading" || skill === "listening") ? ["A) Gleis 1", "B) Gleis 4", "C) Gleis 7", "D) Gleis 9"] : undefined,
          correct_answer: "B) Gleis 4"
        }
      ]
    };
  }
}

// ── Call 4: Universal AI-First Answer & Intent Classifier ─────────────────────
export async function analyzeStudentResponse(targetLanguage, mediatorLanguage, promptQuestion, userAnswer) {
  const prompt = `You are a universal psycholinguistic analyst and CEFR examiner.
A student was assigned a task in ${targetLanguage}.
Instructions/Mediator language: ${mediatorLanguage}.

Question/Task: "${promptQuestion}"
Student's Actual Input: "${userAnswer}"

Analyze the student's input across ALL world languages (Arabic, Urdu, Mandarin, Spanish, Russian, English, Armenian, Hindi, etc.):

1. "detected_language": Identify the language the student typed in.
2. "is_target_language": true ONLY if the student used ${targetLanguage}. If they typed in ${mediatorLanguage} or any other language, false.
3. "intent": Classify the student's core intent:
   - "ADMIT_NO_KNOWLEDGE": The student is expressing that they do not know, cannot speak, do not understand, want to give up, or know nothing about ${targetLanguage} (e.g. "I don't know", "لا أعرف", "مجھے معلوم نہیں", "我不会", "չգիտեմ", "не знаю", "no sé", etc.).
   - "ANSWER_IN_WRONG_LANGUAGE": The student understood the factual question and provided the factual answer, but wrote it in ${mediatorLanguage} or another language instead of ${targetLanguage} (e.g. wrote "red" or "красный" instead of ${targetLanguage}).
   - "GENUINE_ATTEMPT": The student attempted to answer or produce ${targetLanguage}.
   - "UNRELATED_OR_EMPTY": Gibberish, greeting, empty response, or off-topic statement.
4. "target_language_proficiency_demonstrated": true ONLY if the student demonstrated actual vocabulary, grammar, or syntax in ${targetLanguage}. If they only wrote in ${mediatorLanguage} or another language, this MUST be false!
5. "correct_answer_in_target_language": Give the exact, natural correct answer in ${targetLanguage}.
6. "explanation_in_mediator": Concise feedback written in ${mediatorLanguage} explaining the correct answer without robotic templates.

Return ONLY a JSON object:
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
        max_tokens: 650,
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
  // Step 1: AI detects language, semantic intent, and target language proficiency
  const analysis = await analyzeStudentResponse(targetLanguage, mediatorLanguage, question.prompt, userAnswer);

  let score = 0;
  let feedback = analysis.explanation_in_mediator;

  // Step 2: Code decides the score based on AI semantic parameters
  switch (analysis.intent) {
    case "ADMIT_NO_KNOWLEDGE":
      score = 0;
      feedback = `Ничего страшного! Вы указали, что не знаете ответ. В ${targetLanguage} правильный ответ: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
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
      feedback = `Ответ не относится к вопросу. Правильный ответ на ${targetLanguage}: ${analysis.correct_answer_in_target_language || question.correct_answer || ""}.`;
      break;
  }

  return {
    score,
    feedback,
    mistakes: analysis.extracted_mistakes || []
  };
}

// ── Call 6: CEFR Placement Test Generator ─────────────────────────────────────
export async function generateLevelTest(targetLanguage, mediatorLanguage = "english") {
  const prompt = `You are a certified psychometric CEFR language testing specialist.
Create a diagnostic placement test to assess proficiency in ${targetLanguage}.
Instructions/prompts in ${mediatorLanguage}, testing items strictly in ${targetLanguage}.

STRICT CEFR METHODOLOGY & ANTI-CIRCULARITY RULES:
1. NEVER ask: "Выберите перевод слова [TargetWord] на [TargetLanguage]". That is circular and completely invalid!
2. FORMAT REQUIREMENTS FOR EACH CEFR LEVEL:
   - Q1 (A1-A2 Vocabulary & Everyday Context): In-Context Cloze sentence in ${targetLanguage} with a gap (____). The student must choose the semantically and grammatically fitting ${targetLanguage} word.
   - Q2 (B1 Grammar & Morphology): Sentence in ${targetLanguage} with a gap testing verb tense, agreement, or preposition case in ${targetLanguage}.
   - Q3 (B2 Syntax & Conjunctions): Sentence in ${targetLanguage} with a gap testing complex clause connectors, conjunctions, or idioms.
   - Q4 (B1-B2 Open Targeted Production - NO VARIANTS): Fill in the missing target word or grammatical form without multiple choice options.
   - Q5 (C1 Open Production - NO VARIANTS): Prompt asking for 1-2 original sentences in ${targetLanguage} giving an opinion or hypothesis.
3. NO THIRD LANGUAGES: Use ONLY ${targetLanguage} and ${mediatorLanguage}.

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
      "prompt": "Targeted prompt in ${mediatorLanguage} requiring a specific ${targetLanguage} form..."
    },
    {
      "id": 5,
      "type": "open",
      "cefr_target": "C1",
      "skill": "Production",
      "prompt": "Free production prompt in ${mediatorLanguage} asking for 1-2 sentences in ${targetLanguage}..."
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
          prompt: `Выберите подходящее слово для завершения предложения:\n"Ich habe gestern ein interessantes _____ in der Bibliothek gelesen."`,
          options: ["A) Buch", "B) Brot", "C) Tisch", "D) Auto"],
          correct_option: "A) Buch"
        },
        {
          id: 2,
          type: "choice",
          cefr_target: "B1",
          skill: "Grammar",
          prompt: `Выберите правильную форму глагола:\n"Wenn ich Zeit habe, _____ ich dich morgen anrufen."`,
          options: ["A) werde", "B) wird", "C) werden", "D) wurde"],
          correct_option: "A) werde"
        },
        {
          id: 3,
          type: "choice",
          cefr_target: "B2",
          skill: "Syntax",
          prompt: `Выберите правильный союз:\n"Er ging zur Arbeit, _____ er sich nicht wohl fühlte."`,
          options: ["A) weil", "B) obwohl", "C) dass", "D) damit"],
          correct_option: "B) obwohl"
        },
        {
          id: 4,
          type: "open",
          cefr_target: "B1-B2",
          skill: "Morphology",
          prompt: `Напишите форму прошедшего времени (Perfekt) глагола «machen» на немецком языке:`
        },
        {
          id: 5,
          type: "open",
          cefr_target: "C1",
          skill: "Production",
          prompt: `Напишите 1-2 предложения на немецком языке, выражающие ваше мнение о роли технологий:`
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

UNIVERSAL EVALUATION MANDATE (APPLIES TO ANY WORLD LANGUAGE):
1. SEMANTIC INTENT CHECK:
   - If the student states in ANY language (e.g. Arabic, Urdu, Russian, English, Chinese, Hindi, etc.) that they do not know, do not understand, or cannot answer, they MUST NOT receive vocabulary or syntax points in ${targetLanguage}!
2. TARGET LANGUAGE PROFICIENCY ONLY:
   - Grade ONLY actual words, grammar, and structures produced in ${targetLanguage}.
   - If a student answers using well-formed sentences in ${mediatorLanguage} (e.g. Russian, English, etc.) saying they don't know ${targetLanguage}, their score in ${targetLanguage} is strictly 0! DO NOT award points for sentences in another language.
3. SCORING BREAKDOWN (0 to 25 each):
   - vocabulary: Points for ${targetLanguage} words demonstrated.
   - grammar: Points for ${targetLanguage} morphology/verb forms.
   - syntax: Points for ${targetLanguage} sentence structure.
   - production: Points for open ${targetLanguage} output.
   - If no valid ${targetLanguage} was demonstrated across the answers, overall score MUST BE 0, and level MUST BE Beginner (A1).

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
}`;

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

    // Code Gate: If AI detected zero knowledge or no target language was demonstrated, code enforces 0/100
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

Accept synonyms, paraphrases, and subsets (e.g. if accepted answer is "the rest, other ones", then "rest", "the rest", "others" are ALL 100% CORRECT).
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
        ...reasoningParams(model),
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

function smartFallbackMatch(submitted, correctAnswer, synonyms = "") {
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
        temperature: 0.7,
        max_tokens: 450,
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
        max_tokens: 650,
        response_format: { type: "json_object" },
        ...reasoningParams(model),
      })
    ),
  ]);

  const rawReply = conversationResponse.choices[0].message.content?.trim();
  const reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

  let analysisData = { correctionText: "✅ Perfect!", mistakes: [] };
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
    try {
      await addFlashcard(userId, {
        word: m.initial_form.trim(),
        correction: m.meaning.trim(),
        context: m.explanation || m.sentence || "",
        language: languageKey,
        initial_form: m.initial_form.trim(),
        used_form: m.used_form?.trim() || m.initial_form.trim(),
        part_of_speech: m.part_of_speech?.trim() || "word",
        synonyms: m.synonyms?.trim() || "",
        explanation: m.explanation?.trim() || "",
        sentence: m.sentence?.trim() || userMessage,
      });
    } catch (err) {
      console.error(`Flashcard DB insert failed for "${m.initial_form}":`, err.message);
    }
  }

  await addHistory(userId, "user", userMessage);
  await addHistory(userId, "assistant", reply);

  return { correction, reply };
}

// ── Call 9: Progress Roadmap Builder ──────────────────────────────────────────
function buildRoadmapPrompt(language, level, mediatorLanguage = "english") {
  return `You are a structured ${language} coach producing a progress update for a ${level}-level student.
Write the progress report entirely in the student's mediator language: ${mediatorLanguage.toUpperCase()} (so beginners and intermediate students can easily read and understand their goals!).

Format as:
📈 Progress update
- Recently improved: ...
- Still needs work: ...
- Next goals: ...
- Practice focus: ...
Keep it under 120 words.`;
}

export async function maybeGenerateRoadmap(userId, language, level, mediatorLanguage = "english") {
  const userMessageCount = await countUserMessages(userId);
  if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

  const recent = await getHistory(userId, 20);
  if (recent.length === 0) return null;

  const response = await withModelFallback(CHAT_MODELS, (model) =>
    groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildRoadmapPrompt(language, level, mediatorLanguage) },
        ...recent.map((h) => ({ role: h.role, content: h.content })),
      ],
      temperature: 0.5,
      max_tokens: 350,
      ...reasoningParams(model),
    })
  );

  const roadmap = response.choices[0].message.content?.trim();
  if (!roadmap) return null;

  await saveRoadmap(userId, roadmap);
  return roadmap;
}

function stripForSpeech(text) {
  return text
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
// // ai.js
// import Groq, { toFile } from "groq-sdk";
// import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap } from "./db.js";
// import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
// import { unlink } from "fs/promises";

// import { tmpdir } from "os";


// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// // Current production models per Groq's own deprecation docs (console.groq.com/docs/deprecations)
// // as of Aug 2026. Rate limits are per-model, so cycling through distinct models
// // on a 429 accesses separate quota buckets rather than retrying the same one.
// const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
// const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// // gpt-oss models spend completion tokens on hidden chain-of-thought before
// // writing any visible content. With a low max_tokens, a request that needs
// // real reasoning (e.g. "tell me about Julius Caesar") can exhaust the whole
// // budget on that hidden reasoning, leaving message.content empty even though
// // the API call itself succeeded — this is what was breaking both the voice
// // reply and its text fallback. reasoning_effort:"low" keeps the model from
// // over-spending on reasoning for what's usually a simple conversational
// // turn; qwen3.6-27b doesn't support this param, so it's added conditionally.
// function reasoningParams(model) {
//   return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
// }

// // Tries each model in order, only falling back on an actual rate-limit (429)
// // response — any other error (bad request, auth, etc.) is not a reason to
// // silently retry on a different model, so it's re-thrown immediately.
// async function withModelFallback(models, callFn) {
//   let lastErr;
//   for (const model of models) {
//     try {
//       return await callFn(model);
//     } catch (err) {
//       lastErr = err;
//       if (err?.status === 429) {
//         console.warn(`Rate limit hit on "${model}", falling back to next model...`);
//         continue;
//       }
//       throw err;
//     }
//   }
//   throw lastErr;
// }

// export const LANGUAGES = {
//   spanish: "Spanish",
//   english: "English",
//   french: "French",
//   german: "German",
//   japanese: "Japanese",
//   italian: "Italian",
//   portuguese: "Portuguese",
//   russian: "Russian",
//   arabic: "Arabic",
//   chinese: "Chinese (Mandarin)",
//   hindi: "Hindi",
//   korean: "Korean",
//   turkish: "Turkish",
//   dutch: "Dutch",
//   polish: "Polish",
//   swedish: "Swedish",
//   vietnamese: "Vietnamese",
//   indonesian: "Indonesian",
//   thai: "Thai",
//   filipino: "Filipino",
//   ukrainian: "Ukrainian",
//   malay: "Malay",
//   romanian: "Romanian",
//   greek: "Greek",
//   czech: "Czech",
//   hungarian: "Hungarian",
//   tamil: "Tamil",
//   telugu: "Telugu",
//   bengali: "Bengali",
//   hebrew: "Hebrew",
//   norwegian: "Norwegian",
//   danish: "Danish",
//   finnish: "Finnish",
//   slovak: "Slovak",
//   catalan: "Catalan",
//   persian: "Persian",
//   marathi: "Marathi",
//   swahili: "Swahili",
//   afrikaans: "Afrikaans",
//   azerbaijani: "Azerbaijani"
// };

// // Best Edge TTS voice for each language
// const TTS_VOICES = {
//   spanish: "es-ES-AlvaroNeural",
//   english: "en-US-GuyNeural",
//   french: "fr-FR-HenriNeural",
//   german: "de-DE-ConradNeural",
//   japanese: "ja-JP-KeitaNeural",
//   italian: "it-IT-DiegoNeural",
//   portuguese: "pt-BR-AntonioNeural",
//   russian: "ru-RU-DmitryNeural",
//   arabic: "ar-SA-HamedNeural",
//   chinese: "zh-CN-YunxiNeural",
//   hindi: "hi-IN-MadhuramNeural",
//   korean: "ko-KR-InGookNeural",
//   turkish: "tr-TR-AhmetNeural",
//   dutch: "nl-NL-MaartenNeural",
//   polish: "pl-PL-MarekNeural",
//   swedish: "sv-SE-MattiasNeural",
//   vietnamese: "vi-VN-NamMinhNeural",
//   indonesian: "id-ID-ArdiNeural",
//   thai: "th-TH-NiwatNeural",
//   filipino: "fil-PH-AngeloNeural",
//   ukrainian: "uk-UA-OstapNeural",
//   malay: "ms-MY-OsmanNeural",
//   romanian: "ro-RO-EmilNeural",
//   greek: "el-GR-NestorasNeural",
//   czech: "cs-CZ-AntoninNeural",
//   hungarian: "hu-HU-TamasNeural",
//   tamil: "ta-IN-ValluvarNeural",
//   telugu: "te-IN-MohanNeural",
//   bengali: "bn-IN-BashkarNeural",
//   hebrew: "he-IL-AvriNeural",
//   norwegian: "nb-NO-FinnNeural",
//   danish: "da-DK-JeppeNeural",
//   finnish: "fi-FI-HarriNeural",
//   slovak: "sk-SK-LukasNeural",
//   catalan: "ca-ES-EnricNeural",
//   persian: "fa-IR-FaridNeural",
//   marathi: "mr-IN-ManoharNeural",
//   swahili: "sw-KE-RafikiNeural",
//   afrikaans: "af-ZA-WillemNeural",
//   azerbaijani: "az-AZ-BabekNeural"
// };

// // Shared linguistic-accuracy block — needed by both the conversation call
// // (spoken reply) and the analysis call (correction text/examples), so it's
// // kept in one place rather than duplicated with drift risk.
// function linguisticAccuracyBlock(language) {
//   return `LINGUISTIC ACCURACY (MANDATORY):
// - Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
// - Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
// - If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
// - Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.
// - TRANSLITERATION HANDLING: if ${language}'s native writing system is not the Latin alphabet (e.g. Cyrillic for Russian/Ukrainian, Arabic script, Greek, Hebrew, Devanagari for Hindi/Marathi, Bengali, Tamil, Telugu, Thai, Chinese characters, Japanese kana/kanji, Hangul for Korean), the student may type using Latin-letter transliteration instead of the native script, because they lack a native-script keyboard — for example in Russian: "dom" for "дом", "bil" for "был", "shto"/"chto" for "что", "chtobi"/"shtobi" for "чтобы". Recognize transliterated input exactly as if it had been typed in ${language}'s own script — never treat it as a foreign word, an English spelling mistake, or gibberish. Silently interpret which native-script word or phrase it represents (applying normal grammar/conjugation correction to that word), and then proceed as usual.
// - OUTPUT SCRIPT: no matter which script the student typed in, every single piece of ${language} text you produce anywhere in your reply — corrections, flashcard fields, example sentences — must be written in ${language}'s own native script. Never output a romanized/transliterated spelling as a "corrected" or saved form of a word; always convert it to native script first.`;
// }
// // Call 1: CONVERSATION — small, fast, only produces the spoken reply.
// function buildConversationPrompt(language, level) {
//   return `You are a friendly, encouraging, and voice-enabled ${language} language coach.
// You are passionate about helping students learn languages and speak with confidence.
// You CAN speak — your reply is automatically converted to audio and sent as a voice message.
// Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
// The student's level is ${level}.

// ${linguisticAccuracyBlock(language)}

// Continue the conversation naturally in ${language} at ${level} level.
// Ask one simple, engaging follow-up question to keep the dialogue going.
// Be warm, patient, and encouraging — like a good tutor would be.
// Keep it concise (2-4 sentences) — you are not correcting grammar here, that is handled separately.
// Your reply is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.`;
// }

// // Call 2: ANALYSIS — grammar correction + flashcard extraction only. Runs on
// // every message (in parallel with the conversation call), but never produces
// // the conversational reply itself, so its prompt and output stay small.
// function buildAnalysisPrompt(language, level) {
//   return `You are a meticulous ${language} grammar analyst for a language-learning app. The student's level is ${level}. You do not converse with the student — you only analyze their most recent message.

// ${linguisticAccuracyBlock(language)}

// Carefully analyze the student's most recent message for grammar, vocabulary, and spelling errors, using the recent conversation only as context for meaning.
// Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.

// Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// [CORRECTION]
// There are three possible cases — pick exactly one:
// 1. The message is grammatically correct and every word is real, recognized ${language} vocabulary: write "✅ Perfect!"
// 2. The message has a grammar, conjugation, or spelling mistake, but is clearly a recognizable variant of one or more real ${language} words (a typo, wrong tense, wrong agreement, etc.): write "📝 Correction: <corrected sentence>" and briefly explain the rule in English in one sentence.
// 3. The message contains a word that is NOT a real, recognized ${language} word at all — invented, gibberish, or not a plausible near-miss typo of any real word you know. Do NOT invent a "correction" for it, explain it as if it were real, or suggest alternative words to use instead — there's no reason to encourage practicing a word that doesn't exist. Instead write exactly: "❓ '<word>' doesn't appear to be a real ${language} word I recognize. Want to try a different word or phrase?" Nothing more — no suggested alternatives, no "::: "-style formatting, just that plain sentence.

// Case 3 is specifically for words that don't exist — never fold it into case 2. If in doubt whether a word is real or invented, treat it as case 3 rather than guessing a correction for it.

// [FLASHCARD]
// Go through the ENTIRE message word by word and phrase by phrase — do not stop after the first mistake you find. A single message can contain several separate, unrelated mistakes (e.g. a wrong verb conjugation AND a wrong word choice later in the same sentence), and every one of them must be captured, not just the first.

// For EACH distinct mistake where the corrected word/phrase is a confirmed part of ${language} vocabulary, output one line in this exact format:
// ${language.toUpperCase()}_WORD_OR_PHRASE:::ENGLISH_MEANING:::EXAMPLE_OF_CORRECT_USAGE

// Output ONE line per mistake, in the order the mistakes appear in the message. Do not merge multiple mistakes into a single line, and do not truncate the list after the first entry.

// Strict rule for the first field, ${language.toUpperCase()}_WORD_OR_PHRASE:
// - It MUST be written in ${language}'s own native script, exactly as linguistic accuracy above requires — even if the student actually typed it using Latin-letter transliteration. Convert to native script before saving; never save the transliterated/romanized spelling as the flashcard's target-language field.

// Strict rules for the second field, ENGLISH_MEANING:
// - It MUST be written in English, and MUST be the meaning/translation of the ${language} word or phrase — never a respelled, re-conjugated, or "corrected" version of the same ${language} text.
// - It MUST NOT be the same word/phrase as the first field, even with different spelling, accents, or capitalization. If the only thing you can produce is a corrected version of the same ${language} text (no English meaning), omit that line instead — do not save a flashcard with two near-identical fields.
// Example line 1: tengo hambre:::I am hungry:::Used to express hunger in Spanish — "Tengo hambre después de correr."
// Example line 2: corrí ayer:::I ran yesterday (past tense of "correr"):::"Corrí ayer por el parque."

// If CORRECTION was case 1 or case 3 (any invented/nonexistent word), or there are no confirmed vocabulary mistakes worth saving anywhere in the message, write a single line: NONE. Never save a flashcard for a word you identified as not real.

// IMPORTANT: Always include both tags, in this exact order. Never skip a tag. Do not add anything else.`;
// }

// // Call 3: ROADMAP — periodic background check (triggered by code, not the
// // model, every N user messages — see maybeGenerateRoadmap). Reads recent
// // history from Supabase and produces a standalone progress update, sent as
// // its own text message instead of being embedded in the spoken reply.
// function buildRoadmapPrompt(language, level) {
//   return `You are a structured ${language} learning coach producing a periodic progress update for a ${level}-level student, based on the recent conversation history provided to you.

// You are not only a conversation partner — you are also a structured language tutor responsible for guiding the student through a progressive learning journey in ${language}.
// Track the student's weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) as shown in the conversation, and prioritize them in this update.

// Write a roadmap update with:
// - What the student has recently improved
// - What still needs work
// - The next 1-3 learning goals (very simple and actionable)
// - A suggested practice focus (e.g., "past tense narration", "daily conversation vocabulary", "question formation")

// Guidance for calibrating the update:
// - Always prioritize progressive difficulty: do not overwhelm the student, and only suggest increasing complexity if the history shows they're ready for it.
// - Recommend recycling previously learned vocabulary in new contexts to reinforce retention.
// - If the student has struggled repeatedly with a concept, suggest breaking it into smaller steps, an analogy, or a quick drill.
// - If the student is performing strongly, suggest slightly more advanced structures and encourage natural expression over repetition.
// - Do not invent progress you can't see evidence for in the provided history — if there isn't enough to say something concrete yet, keep that section brief and generic rather than fabricating detail.

// Format as a short message (under 130 words total) using this structure:
// 📈 Progress update
// - Recently improved: ...
// - Still needs work: ...
// - Next goals: ...
// - Practice focus: ...

// Write it in English (this is meta-feedback about learning progress, not part of the ${language} immersion conversation itself). This must feel like part of a continuous personalized curriculum, not a one-off note.`;
// }

// // Belt-and-suspenders check on top of the prompt instructions above: even a
// // well-instructed model occasionally "corrects" a phrase back to (almost)
// // itself instead of giving its English meaning. Saving that as a flashcard
// // is worse than not saving one at all — it's the exact bug where the quiz's
// // stored "correct answer" ends up being a near-copy of the prompt word, so
// // no genuinely different typed answer can ever be marked correct.
// function normalizeForComparison(str) {
//   return String(str || "")
//     .toLowerCase()
//     .replace(/\([^)]*\)/g, "")
//     .replace(/[^\p{L}\p{N}\s]/gu, "")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function isMeaningfullyDifferent(word, correction) {
//   const a = normalizeForComparison(word);
//   const b = normalizeForComparison(correction);
//   if (!a || !b) return false;
//   if (a === b) return false;
//   // Catches near-duplicates too (accents stripped, one word added/removed,
//   // a typo "fixed") without needing a second dependency — reuses the same
//   // Levenshtein distance used to grade quiz answers in index.js.
//   const maxLen = Math.max(a.length, b.length);
//   const distance = levenshteinDistance(a, b);
//   return distance / maxLen > 0.3; // allow real translations to differ freely, reject near-copies
// }

// function levenshteinDistance(a, b) {
//   const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
//   for (let i = 0; i <= a.length; i++) dp[i][0] = i;
//   for (let j = 0; j <= b.length; j++) dp[0][j] = j;
//   for (let i = 1; i <= a.length; i++) {
//     for (let j = 1; j <= b.length; j++) {
//       dp[i][j] = a[i - 1] === b[j - 1]
//         ? dp[i - 1][j - 1]
//         : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
//     }
//   }
//   return dp[a.length][b.length];
// }

// export async function chat(userId, userMessage, history, language, level, languageKey) {
//   const conversationMessages = [
//     ...history.map((h) => ({ role: h.role, content: h.content })),
//     { role: "user", content: userMessage },
//   ];

//   // The conversation and analysis calls are independent of each other's
//   // output, so they run in parallel — this keeps total latency close to a
//   // single call's, even though it's now two smaller, more focused requests.
//   const [conversationResponse, analysisResponse] = await Promise.all([
//     withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: buildConversationPrompt(language, level) },
//           ...conversationMessages,
//         ],
//         temperature: 0.7,
//         max_tokens: 450,
//         ...reasoningParams(model),
//       })
//     ),
//     withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: buildAnalysisPrompt(language, level) },
//           // The analyzer only needs to judge the latest message; a little
//           // trailing context is enough, it doesn't need the full history.
//           ...conversationMessages.slice(-4),
//         ],
//         temperature: 0.3,
//         max_tokens: 350,
//         ...reasoningParams(model),
//       })
//     ),
//   ]);

//   // Defense in depth: even with the reasoning tuning above, an unusually
//   // demanding request could still exhaust max_tokens on hidden reasoning and
//   // come back empty. Never let that reach Telegram or TTS as empty text —
//   // both reject it outright, which is exactly what caused the "Couldn't
//   // process voice" error with no useful text ever shown to the user.
//   const rawReply = conversationResponse.choices[0].message.content?.trim();
//   const reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

//   const raw = analysisResponse.choices[0].message.content;

//   const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[FLASHCARD\]/);
//   const flashcardMatch = raw.match(/\[FLASHCARD\]([\s\S]*?)$/);

//   const correction = correctionMatch ? correctionMatch[1].trim() : "✅ Perfect!";

//   // The model now lists every mistake it found in the message, one per
//   // line — not just the first one — so all of them need to be parsed and
//   // saved, not only flashcardLines[0].
//   const flashcardBlock = flashcardMatch ? flashcardMatch[1].trim() : "NONE";
//   const flashcardLines = flashcardBlock
//     .split("\n")
//     .map((line) => line.trim())
//     .filter(Boolean);

//   if (flashcardLines.length === 0 || (flashcardLines.length === 1 && flashcardLines[0] === "NONE")) {
//     console.log("Flashcard: model returned NONE this turn.");
//   } else {
//     for (const flashcardRaw of flashcardLines) {
//       if (flashcardRaw === "NONE") continue; // model may still emit a stray NONE alongside real lines; skip it, don't abort the rest
//       if (!flashcardRaw.includes(":::")) {
//         console.log(`Flashcard: skipped — unexpected format (no ":::" found): ${JSON.stringify(flashcardRaw)}`);
//         continue;
//       }
//       const [word, corr, context] = flashcardRaw.split(":::");
//       if (!word || !corr) {
//         console.log(`Flashcard: skipped — missing word or meaning: ${JSON.stringify(flashcardRaw)}`);
//         continue;
//       }
//       if (!isMeaningfullyDifferent(word, corr)) {
//         console.log(`Flashcard: skipped — too similar to be a real translation: "${word.trim()}" vs "${corr.trim()}"`);
//         continue;
//       }
//       // addFlashcard writes to the single `flashcards` table that both the
//       // Flashcards deck and Quiz mode read from, so every mistake caught
//       // here automatically becomes available in both features.
//       try {
//         await addFlashcard(userId, word.trim(), corr.trim(), context?.trim() ?? "", languageKey ?? null);
//         console.log(`Flashcard: saved "${word.trim()}" -> "${corr.trim()}" (language=${languageKey})`);
//       } catch (err) {
//         console.error(`Flashcard: DB insert FAILED for "${word.trim()}":`, err.message);
//       }
//     }
//   }

//   await addHistory(userId, "user", userMessage);
//   await addHistory(userId, "assistant", reply);

//   return { correction, reply };
// }

// // Fires only every 5th user message (checked via a cheap COUNT query, not
// // left to the model to self-judge). Reads recent history from Supabase,
// // generates a roadmap update, and persists it to user_progress. Returns null
// // on the other 4/5 messages so callers can skip sending anything.
// export async function maybeGenerateRoadmap(userId, language, level) {
//   const userMessageCount = await countUserMessages(userId);
//   if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

//   const recent = await getHistory(userId, 20);
//   if (recent.length === 0) return null;

//   const response = await withModelFallback(CHAT_MODELS, (model) =>
//     groq.chat.completions.create({
//       model,
//       messages: [
//         { role: "system", content: buildRoadmapPrompt(language, level) },
//         ...recent.map((h) => ({ role: h.role, content: h.content })),
//       ],
//       temperature: 0.5,
//       max_tokens: 350,
//       ...reasoningParams(model),
//     })
//   );

//   const roadmap = response.choices[0].message.content?.trim();
//   // If this comes back empty, skip silently rather than throw — a missing
//   // progress update shouldn't surface as a full error on a message whose
//   // actual reply already sent successfully.
//   if (!roadmap) return null;

//   await saveRoadmap(userId, roadmap);
//   return roadmap;
// }

// // Strips markdown syntax and emoji so the TTS engine doesn't read symbols
// // (asterisks, underscores, backticks, etc.) aloud. Relying on prompt
// // instructions alone isn't reliable — models slip back into markdown even
// // when told not to, so this is a deterministic safety net.
// function stripForSpeech(text) {
//   return text
//     // Markdown links: [text](url) -> text
//     .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
//     // Bold / italic markers
//     .replace(/\*\*(.*?)\*\*/g, "$1")
//     .replace(/__(.*?)__/g, "$1")
//     .replace(/\*(.*?)\*/g, "$1")
//     .replace(/_(.*?)_/g, "$1")
//     // Code blocks / inline code
//     .replace(/```[\s\S]*?```/g, "")
//     .replace(/`([^`]*)`/g, "$1")
//     // Headers, blockquotes, list markers
//     .replace(/^#{1,6}\s*/gm, "")
//     .replace(/^>\s?/gm, "")
//     .replace(/^[\s]*[-*+]\s+/gm, "")
//     // Any leftover markdown symbols
//     .replace(/[*_~`#]/g, "")
//     // Emoji (covers most common ranges used in the prompt/replies)
//     .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
//     // Collapse whitespace left behind by the above
//     .replace(/\n{2,}/g, ". ")
//     .replace(/\n/g, " ")
//     .replace(/\s{2,}/g, " ")
//     .trim();
// }

// export async function textToSpeech(text, languageKey) {
//   const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
//   const folder = tmpdir();
//   const spokenText = stripForSpeech(text);

//   if (!spokenText) {
//     console.warn("TTS skipped: nothing left to speak after stripping markdown/emoji.");
//     return null;
//   }

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

// // Call: QUIZ ANSWER JUDGE — semantic comparison for grading typed quiz
// // answers. Replaces plain character-distance comparison, which had two
// // failure modes: it rejected valid answers phrased differently than the
// // stored string (synonyms, paraphrases, reordered words), and it could
// // accept a wrong answer that just happened to be a near-miss typo of the
// // *correct* answer's spelling rather than actually knowing the meaning.
// // An AI judge evaluates meaning instead of character overlap.
// function buildQuizJudgePrompt() {
//   return `You are grading a language-learning quiz. The student was shown a word or phrase in the target language and asked to type its meaning in English.

// Judge whether the student's submitted answer conveys the same core meaning as the accepted correct answer. Accept synonyms, paraphrases, reasonable partial answers, and minor spelling/grammar slips that don't change the meaning. Reject answers that describe a different meaning, are empty/gibberish, or are unrelated to the correct answer.

// Respond with ONLY a JSON object and nothing else, in exactly this shape: {"correct": true} or {"correct": false}`;
// }

// export async function checkSemanticAnswer(wordOrPhrase, submittedAnswer, correctAnswer) {
//   const submitted = String(submittedAnswer || "").trim();
//   if (!submitted) return false;

//   try {
//     const response = await withModelFallback(CHAT_MODELS, (model) =>
//       groq.chat.completions.create({
//         model,
//         messages: [
//           { role: "system", content: buildQuizJudgePrompt() },
//           {
//             role: "user",
//             content: `Target-language word/phrase: ${wordOrPhrase}\nAccepted correct answer: ${correctAnswer}\nStudent's submitted answer: ${submitted}`,
//           },
//         ],
//         temperature: 0,
//         // NOTE: this used to be 20. gpt-oss models spend completion tokens on
//         // hidden chain-of-thought *before* writing any visible content (same
//         // issue documented above for the chat()/roadmap calls). At 20 tokens
//         // the hidden reasoning alone exhausted the budget, message.content
//         // came back empty, JSON.parse("") threw, and every single answer
//         // silently fell through to the old character-distance fuzzy match
//         // below — which is why paraphrases like "rest" / "others" for
//         // "the rest, other ones" were being marked wrong: they were never
//         // actually reaching the AI judge's verdict, only Levenshtein distance.
//         max_tokens: 300,
//         response_format: { type: "json_object" },
//         ...reasoningParams(model),
//       })
//     );
//     const raw = response.choices[0]?.message?.content?.trim();
//     const parsed = JSON.parse(extractJsonObject(raw));
//     if (typeof parsed.correct === "boolean") return parsed.correct;
//     throw new Error(`Unexpected judge response shape: ${raw}`);
//   } catch (err) {
//     // Never let a Groq/API hiccup break quiz grading entirely — fall back to
//     // the old fuzzy string match so the feature degrades gracefully instead
//     // of erroring out on every submitted answer. This should now be rare
//     // (network/API errors only) instead of the default path.
//     console.error("Semantic quiz check failed, falling back to fuzzy string match:", err.message);
//     return fuzzyStringMatch(submitted, correctAnswer);
//   }
// }

// // Defense in depth: even with response_format:"json_object", a model can
// // occasionally wrap its answer in ```json fences or add stray whitespace/
// // text around the object. Pulling out the first {...} span makes JSON.parse
// // robust to that instead of throwing and silently degrading to fuzzy match.
// function extractJsonObject(raw) {
//   if (!raw) throw new Error("Empty judge response");
//   const match = raw.match(/\{[\s\S]*\}/);
//   return match ? match[0] : raw;
// }

// // Fallback ONLY — used solely if the AI judge call throws (network/API
// // outage). Character-distance comparison is no longer the primary grading
// // path since it can't judge meaning, only spelling similarity.
// function fuzzyStringMatch(submitted, correctAnswer) {
//   const a = normalizeForComparison(submitted);
//   const b = normalizeForComparison(correctAnswer);
//   if (!a || !b) return false;
//   if (a === b) return true;
//   const tolerance = Math.min(3, Math.max(1, Math.floor(b.length / 6)));
//   return levenshteinDistance(a, b) <= tolerance;
// }

// export async function cleanupFile(filePath) {
//   try {
//     await unlink(filePath);
//   } catch (_) { }
// }

// export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
//   // toFile (from groq-sdk, same lineage as the OpenAI SDK) doesn't depend on
//   // the global Web File API — `new File(...)` requires Node 18.13+ AND a
//   // host that hasn't stripped/polyfilled it differently, which varies across
//   // hosting providers. toFile works from a plain Buffer everywhere, so this
//   // removes one whole category of "works locally, fails on Render" bugs.
//   const file = await toFile(audioBuffer, filename, { type: "audio/ogg" });
//   return withModelFallback(STT_MODELS, (model) =>
//     groq.audio.transcriptions.create({
//       file,
//       model,
//       response_format: "text",
//     })
//   );
// }


// // OLD PROMPT RULES:

// // "
// // RULES:
// // Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// // Carefully analyze every message for grammar, vocabulary, and spelling errors.
// // Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// // Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// // Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// // [CORRECTION]
// // If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// // If there are NO errors: write "✅ Perfect!"

// // [FLASHCARD]
// // If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// // INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// // Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// // If there is nothing to save, or you are unsure about the word, write: NONE

// // [RESPONSE]
// // Continue the conversation naturally in ${language} at ${level} level.
// // Ask one simple, engaging follow-up question to keep the dialogue going.
// // Be warm, patient, and encouraging — like a good tutor would be.

// // IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// // NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// // You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// // Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// // You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// // At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// // What the user has recently improved
// // What still needs work
// // The next 1–3 learning goals (very simple and actionable)
// // A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// // When introducing a new topic, you must follow this structure:
// // Brief explanation (simple, adapted to ${level})
// // 2–3 example sentences
// // One small practice question for the user
// // Always prioritize progressive difficulty:
// // Do not overwhelm the user
// // Slightly increase complexity only when the user demonstrates readiness
// // Recycle previously learned vocabulary in new contexts to reinforce retention
// // If the user struggles repeatedly with a concept:
// // Break it down into smaller steps
// // Provide analogies or simpler re-explanations
// // Offer a quick drill or repetition exercise
// // If the user shows strong performance:
// // Introduce slightly more advanced structures
// // Encourage natural expression rather than basic repetition

// // IMPORTANT:

// // The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// // Never break the fixed tag structure.
// // Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// // The teaching system must feel like a continuous personalized curriculum, not random conversation.

// //"


// // function buildSystemPrompt(language, level) {
// //   return `You are a friendly, encouraging, and voice-enabled ${language} language coach. 
// // You are passionate about helping students learn languages and speak with confidence.
// // You CAN speak — your responses are automatically converted to audio and sent as voice messages.
// // Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
// // The student's level is ${level}.

// // LINGUISTIC ACCURACY (MANDATORY — apply to every ${language} sentence you write, including [CORRECTION], [FLASHCARD], and [RESPONSE]):
// // - Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
// // - Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
// // - If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
// // - Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.
// // - Since [RESPONSE] is converted to speech, write it the way it should sound out loud: avoid abbreviations and symbols that are not naturally spoken (write out words instead of using e.g., etc., %, & and similar), and keep sentence rhythm natural for spoken delivery.

// // RULES:

// // Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// // Carefully analyze every message for grammar, vocabulary, and spelling errors.
// // Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// // Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// // Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// // [CORRECTION]
// // If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// // If there are NO errors: write "✅ Perfect!"

// // [FLASHCARD]
// // If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// // INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// // Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// // If there is nothing to save, or you are unsure about the word, write: NONE

// // [RESPONSE]
// // Continue the conversation naturally in ${language} at ${level} level.
// // Ask one simple, engaging follow-up question to keep the dialogue going.
// // Be warm, patient, and encouraging — like a good tutor would be.
// // This section is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.

// // IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// // NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// // You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// // Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// // You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// // At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// // What the user has recently improved
// // What still needs work
// // The next 1–3 learning goals (very simple and actionable)
// // A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// // When introducing a new topic, you must follow this structure:
// // Brief explanation (simple, adapted to ${level})
// // 2–3 example sentences
// // One small practice question for the user
// // Always prioritize progressive difficulty:
// // Do not overwhelm the user
// // Slightly increase complexity only when the user demonstrates readiness
// // Recycle previously learned vocabulary in new contexts to reinforce retention
// // If the user struggles repeatedly with a concept:
// // Break it down into smaller steps
// // Provide analogies or simpler re-explanations
// // Offer a quick drill or repetition exercise
// // If the user shows strong performance:
// // Introduce slightly more advanced structures
// // Encourage natural expression rather than basic repetition

// // IMPORTANT:

// // The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// // Never break the fixed tag structure.
// // Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// // The teaching system must feel like a continuous personalized curriculum, not random conversation.`;
// // }



// // // ai.js
// // import Groq, { toFile } from "groq-sdk";
// // import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap } from "./db.js";
// // import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
// // import { unlink } from "fs/promises";

// // import { tmpdir } from "os";


// // const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// // // Current production models per Groq's own deprecation docs (console.groq.com/docs/deprecations)
// // // as of Aug 2026. Rate limits are per-model, so cycling through distinct models
// // // on a 429 accesses separate quota buckets rather than retrying the same one.
// // const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
// // const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// // // gpt-oss models spend completion tokens on hidden chain-of-thought before
// // // writing any visible content. With a low max_tokens, a request that needs
// // // real reasoning (e.g. "tell me about Julius Caesar") can exhaust the whole
// // // budget on that hidden reasoning, leaving message.content empty even though
// // // the API call itself succeeded — this is what was breaking both the voice
// // // reply and its text fallback. reasoning_effort:"low" keeps the model from
// // // over-spending on reasoning for what's usually a simple conversational
// // // turn; qwen3.6-27b doesn't support this param, so it's added conditionally.
// // function reasoningParams(model) {
// //   return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
// // }

// // // Tries each model in order, only falling back on an actual rate-limit (429)
// // // response — any other error (bad request, auth, etc.) is not a reason to
// // // silently retry on a different model, so it's re-thrown immediately.
// // async function withModelFallback(models, callFn) {
// //   let lastErr;
// //   for (const model of models) {
// //     try {
// //       return await callFn(model);
// //     } catch (err) {
// //       lastErr = err;
// //       if (err?.status === 429) {
// //         console.warn(`Rate limit hit on "${model}", falling back to next model...`);
// //         continue;
// //       }
// //       throw err;
// //     }
// //   }
// //   throw lastErr;
// // }

// // export const LANGUAGES = {
// //   spanish: "Spanish",
// //   english: "English",
// //   french: "French",
// //   german: "German",
// //   japanese: "Japanese",
// //   italian: "Italian",
// //   portuguese: "Portuguese",
// //   russian: "Russian",
// //   arabic: "Arabic",
// //   chinese: "Chinese (Mandarin)",
// //   hindi: "Hindi",
// //   korean: "Korean",
// //   turkish: "Turkish",
// //   dutch: "Dutch",
// //   polish: "Polish",
// //   swedish: "Swedish",
// //   vietnamese: "Vietnamese",
// //   indonesian: "Indonesian",
// //   thai: "Thai",
// //   filipino: "Filipino",
// //   ukrainian: "Ukrainian",
// //   malay: "Malay",
// //   romanian: "Romanian",
// //   greek: "Greek",
// //   czech: "Czech",
// //   hungarian: "Hungarian",
// //   tamil: "Tamil",
// //   telugu: "Telugu",
// //   bengali: "Bengali",
// //   hebrew: "Hebrew",
// //   norwegian: "Norwegian",
// //   danish: "Danish",
// //   finnish: "Finnish",
// //   slovak: "Slovak",
// //   catalan: "Catalan",
// //   persian: "Persian",
// //   marathi: "Marathi",
// //   swahili: "Swahili",
// //   afrikaans: "Afrikaans",
// //   azerbaijani: "Azerbaijani"
// // };

// // // Best Edge TTS voice for each language
// // const TTS_VOICES = {
// //   spanish: "es-ES-AlvaroNeural",
// //   english: "en-US-GuyNeural",
// //   french: "fr-FR-HenriNeural",
// //   german: "de-DE-ConradNeural",
// //   japanese: "ja-JP-KeitaNeural",
// //   italian: "it-IT-DiegoNeural",
// //   portuguese: "pt-BR-AntonioNeural",
// //   russian: "ru-RU-DmitryNeural",
// //   arabic: "ar-SA-HamedNeural",
// //   chinese: "zh-CN-YunxiNeural",
// //   hindi: "hi-IN-MadhuramNeural",
// //   korean: "ko-KR-InGookNeural",
// //   turkish: "tr-TR-AhmetNeural",
// //   dutch: "nl-NL-MaartenNeural",
// //   polish: "pl-PL-MarekNeural",
// //   swedish: "sv-SE-MattiasNeural",
// //   vietnamese: "vi-VN-NamMinhNeural",
// //   indonesian: "id-ID-ArdiNeural",
// //   thai: "th-TH-NiwatNeural",
// //   filipino: "fil-PH-AngeloNeural",
// //   ukrainian: "uk-UA-OstapNeural",
// //   malay: "ms-MY-OsmanNeural",
// //   romanian: "ro-RO-EmilNeural",
// //   greek: "el-GR-NestorasNeural",
// //   czech: "cs-CZ-AntoninNeural",
// //   hungarian: "hu-HU-TamasNeural",
// //   tamil: "ta-IN-ValluvarNeural",
// //   telugu: "te-IN-MohanNeural",
// //   bengali: "bn-IN-BashkarNeural",
// //   hebrew: "he-IL-AvriNeural",
// //   norwegian: "nb-NO-FinnNeural",
// //   danish: "da-DK-JeppeNeural",
// //   finnish: "fi-FI-HarriNeural",
// //   slovak: "sk-SK-LukasNeural",
// //   catalan: "ca-ES-EnricNeural",
// //   persian: "fa-IR-FaridNeural",
// //   marathi: "mr-IN-ManoharNeural",
// //   swahili: "sw-KE-RafikiNeural",
// //   afrikaans: "af-ZA-WillemNeural",
// //   azerbaijani: "az-AZ-BabekNeural"
// // };

// // // Shared linguistic-accuracy block — needed by both the conversation call
// // // (spoken reply) and the analysis call (correction text/examples), so it's
// // // kept in one place rather than duplicated with drift risk.
// // function linguisticAccuracyBlock(language) {
// //   return `LINGUISTIC ACCURACY (MANDATORY):
// // - Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
// // - Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
// // - If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
// // - Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.`;
// // }

// // // Call 1: CONVERSATION — small, fast, only produces the spoken reply.
// // function buildConversationPrompt(language, level) {
// //   return `You are a friendly, encouraging, and voice-enabled ${language} language coach.
// // You are passionate about helping students learn languages and speak with confidence.
// // You CAN speak — your reply is automatically converted to audio and sent as a voice message.
// // Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
// // The student's level is ${level}.

// // ${linguisticAccuracyBlock(language)}

// // Continue the conversation naturally in ${language} at ${level} level.
// // Ask one simple, engaging follow-up question to keep the dialogue going.
// // Be warm, patient, and encouraging — like a good tutor would be.
// // Keep it concise (2-4 sentences) — you are not correcting grammar here, that is handled separately.
// // Your reply is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.`;
// // }

// // // Call 2: ANALYSIS — grammar correction + flashcard extraction only. Runs on
// // // every message (in parallel with the conversation call), but never produces
// // // the conversational reply itself, so its prompt and output stay small.
// // function buildAnalysisPrompt(language, level) {
// //   return `You are a meticulous ${language} grammar analyst for a language-learning app. The student's level is ${level}. You do not converse with the student — you only analyze their most recent message.

// // ${linguisticAccuracyBlock(language)}

// // Carefully analyze the student's most recent message for grammar, vocabulary, and spelling errors, using the recent conversation only as context for meaning.
// // Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// // Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.

// // Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// // [CORRECTION]
// // There are three possible cases — pick exactly one:
// // 1. The message is grammatically correct and every word is real, recognized ${language} vocabulary: write "✅ Perfect!"
// // 2. The message has a grammar, conjugation, or spelling mistake, but is clearly a recognizable variant of one or more real ${language} words (a typo, wrong tense, wrong agreement, etc.): write "📝 Correction: <corrected sentence>" and briefly explain the rule in English in one sentence.
// // 3. The message contains a word that is NOT a real, recognized ${language} word at all — invented, gibberish, or not a plausible near-miss typo of any real word you know. Do NOT invent a "correction" for it or explain it as if it were real. Instead write exactly: "❓ '<word>' doesn't appear to be a real ${language} word. Did you mean: <2-3 real ${language} words that sound or look similar, each with a short English gloss>?" — if you genuinely can't think of any plausible similar real words, say that honestly instead of inventing options just to fill the format.

// // Case 3 is specifically for words that don't exist — never fold it into case 2. If in doubt whether a word is real or invented, treat it as case 3 rather than guessing a correction for it.

// // [FLASHCARD]
// // If you made a case 2 correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// // ${language.toUpperCase()}_WORD_OR_PHRASE:::ENGLISH_MEANING:::EXAMPLE_OF_CORRECT_USAGE

// // Strict rules for the second field, ENGLISH_MEANING:
// // - It MUST be written in English, and MUST be the meaning/translation of the ${language} word or phrase — never a respelled, re-conjugated, or "corrected" version of the same ${language} text.
// // - It MUST NOT be the same word/phrase as the first field, even with different spelling, accents, or capitalization. If the only thing you can produce is a corrected version of the same ${language} text (no English meaning), write NONE instead — do not save a flashcard with two near-identical fields.
// // Example: tengo hambre:::I am hungry:::Used to express hunger in Spanish — "Tengo hambre después de correr."
// // Example: corrí ayer:::I ran yesterday (past tense of "correr"):::"Corrí ayer por el parque."

// // If CORRECTION was case 1 or case 3 (including any invented/nonexistent word, even if you suggested alternatives for it), or you are unsure about the word, write: NONE. Never save a flashcard for a word you identified as not real — the suggested alternatives in case 3 are for the student's benefit in chat only, not vocabulary to memorize as-is.

// // IMPORTANT: Always include both tags, in this exact order. Never skip a tag. Do not add anything else.`;
// // }

// // // Call 3: ROADMAP — periodic background check (triggered by code, not the
// // // model, every N user messages — see maybeGenerateRoadmap). Reads recent
// // // history from Supabase and produces a standalone progress update, sent as
// // // its own text message instead of being embedded in the spoken reply.
// // function buildRoadmapPrompt(language, level) {
// //   return `You are a structured ${language} learning coach producing a periodic progress update for a ${level}-level student, based on the recent conversation history provided to you.

// // You are not only a conversation partner — you are also a structured language tutor responsible for guiding the student through a progressive learning journey in ${language}.
// // Track the student's weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) as shown in the conversation, and prioritize them in this update.

// // Write a roadmap update with:
// // - What the student has recently improved
// // - What still needs work
// // - The next 1-3 learning goals (very simple and actionable)
// // - A suggested practice focus (e.g., "past tense narration", "daily conversation vocabulary", "question formation")

// // Guidance for calibrating the update:
// // - Always prioritize progressive difficulty: do not overwhelm the student, and only suggest increasing complexity if the history shows they're ready for it.
// // - Recommend recycling previously learned vocabulary in new contexts to reinforce retention.
// // - If the student has struggled repeatedly with a concept, suggest breaking it into smaller steps, an analogy, or a quick drill.
// // - If the student is performing strongly, suggest slightly more advanced structures and encourage natural expression over repetition.
// // - Do not invent progress you can't see evidence for in the provided history — if there isn't enough to say something concrete yet, keep that section brief and generic rather than fabricating detail.

// // Format as a short message (under 130 words total) using this structure:
// // 📈 Progress update
// // - Recently improved: ...
// // - Still needs work: ...
// // - Next goals: ...
// // - Practice focus: ...

// // Write it in English (this is meta-feedback about learning progress, not part of the ${language} immersion conversation itself). This must feel like part of a continuous personalized curriculum, not a one-off note.`;
// // }

// // // Belt-and-suspenders check on top of the prompt instructions above: even a
// // // well-instructed model occasionally "corrects" a phrase back to (almost)
// // // itself instead of giving its English meaning. Saving that as a flashcard
// // // is worse than not saving one at all — it's the exact bug where the quiz's
// // // stored "correct answer" ends up being a near-copy of the prompt word, so
// // // no genuinely different typed answer can ever be marked correct.
// // function normalizeForComparison(str) {
// //   return String(str || "")
// //     .toLowerCase()
// //     .replace(/\([^)]*\)/g, "")
// //     .replace(/[^\p{L}\p{N}\s]/gu, "")
// //     .replace(/\s+/g, " ")
// //     .trim();
// // }

// // function isMeaningfullyDifferent(word, correction) {
// //   const a = normalizeForComparison(word);
// //   const b = normalizeForComparison(correction);
// //   if (!a || !b) return false;
// //   if (a === b) return false;
// //   // Catches near-duplicates too (accents stripped, one word added/removed,
// //   // a typo "fixed") without needing a second dependency — reuses the same
// //   // Levenshtein distance used to grade quiz answers in index.js.
// //   const maxLen = Math.max(a.length, b.length);
// //   const distance = levenshteinDistance(a, b);
// //   return distance / maxLen > 0.3; // allow real translations to differ freely, reject near-copies
// // }

// // function levenshteinDistance(a, b) {
// //   const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
// //   for (let i = 0; i <= a.length; i++) dp[i][0] = i;
// //   for (let j = 0; j <= b.length; j++) dp[0][j] = j;
// //   for (let i = 1; i <= a.length; i++) {
// //     for (let j = 1; j <= b.length; j++) {
// //       dp[i][j] = a[i - 1] === b[j - 1]
// //         ? dp[i - 1][j - 1]
// //         : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
// //     }
// //   }
// //   return dp[a.length][b.length];
// // }

// // export async function chat(userId, userMessage, history, language, level, languageKey) {
// //   const conversationMessages = [
// //     ...history.map((h) => ({ role: h.role, content: h.content })),
// //     { role: "user", content: userMessage },
// //   ];

// //   // The conversation and analysis calls are independent of each other's
// //   // output, so they run in parallel — this keeps total latency close to a
// //   // single call's, even though it's now two smaller, more focused requests.
// //   const [conversationResponse, analysisResponse] = await Promise.all([
// //     withModelFallback(CHAT_MODELS, (model) =>
// //       groq.chat.completions.create({
// //         model,
// //         messages: [
// //           { role: "system", content: buildConversationPrompt(language, level) },
// //           ...conversationMessages,
// //         ],
// //         temperature: 0.7,
// //         max_tokens: 450,
// //         ...reasoningParams(model),
// //       })
// //     ),
// //     withModelFallback(CHAT_MODELS, (model) =>
// //       groq.chat.completions.create({
// //         model,
// //         messages: [
// //           { role: "system", content: buildAnalysisPrompt(language, level) },
// //           // The analyzer only needs to judge the latest message; a little
// //           // trailing context is enough, it doesn't need the full history.
// //           ...conversationMessages.slice(-4),
// //         ],
// //         temperature: 0.3,
// //         max_tokens: 350,
// //         ...reasoningParams(model),
// //       })
// //     ),
// //   ]);

// //   // Defense in depth: even with the reasoning tuning above, an unusually
// //   // demanding request could still exhaust max_tokens on hidden reasoning and
// //   // come back empty. Never let that reach Telegram or TTS as empty text —
// //   // both reject it outright, which is exactly what caused the "Couldn't
// //   // process voice" error with no useful text ever shown to the user.
// //   const rawReply = conversationResponse.choices[0].message.content?.trim();
// //   const reply = rawReply || "Sorry, could you rephrase that? I didn't quite catch it.";

// //   const raw = analysisResponse.choices[0].message.content;

// //   const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[FLASHCARD\]/);
// //   const flashcardMatch = raw.match(/\[FLASHCARD\]([\s\S]*?)$/);

// //   const correction = correctionMatch ? correctionMatch[1].trim() : "✅ Perfect!";
// //   const flashcardRaw = flashcardMatch ? flashcardMatch[1].trim().split("\n")[0] : "NONE";

// //   if (flashcardRaw === "NONE") {
// //     console.log("Flashcard: model returned NONE this turn.");
// //   } else if (!flashcardRaw.includes(":::")) {
// //     console.log(`Flashcard: skipped — unexpected format (no ":::" found): ${JSON.stringify(flashcardRaw)}`);
// //   } else {
// //     const [word, corr, context] = flashcardRaw.split(":::");
// //     if (!word || !corr) {
// //       console.log(`Flashcard: skipped — missing word or meaning: ${JSON.stringify(flashcardRaw)}`);
// //     } else if (!isMeaningfullyDifferent(word, corr)) {
// //       console.log(`Flashcard: skipped — too similar to be a real translation: "${word.trim()}" vs "${corr.trim()}"`);
// //     } else {
// //       try {
// //         await addFlashcard(userId, word.trim(), corr.trim(), context?.trim() ?? "", languageKey ?? null);
// //         console.log(`Flashcard: saved "${word.trim()}" -> "${corr.trim()}" (language=${languageKey})`);
// //       } catch (err) {
// //         console.error(`Flashcard: DB insert FAILED for "${word.trim()}":`, err.message);
// //       }
// //     }
// //   }

// //   await addHistory(userId, "user", userMessage);
// //   await addHistory(userId, "assistant", reply);

// //   return { correction, reply };
// // }

// // // Fires only every 5th user message (checked via a cheap COUNT query, not
// // // left to the model to self-judge). Reads recent history from Supabase,
// // // generates a roadmap update, and persists it to user_progress. Returns null
// // // on the other 4/5 messages so callers can skip sending anything.
// // export async function maybeGenerateRoadmap(userId, language, level) {
// //   const userMessageCount = await countUserMessages(userId);
// //   if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

// //   const recent = await getHistory(userId, 20);
// //   if (recent.length === 0) return null;

// //   const response = await withModelFallback(CHAT_MODELS, (model) =>
// //     groq.chat.completions.create({
// //       model,
// //       messages: [
// //         { role: "system", content: buildRoadmapPrompt(language, level) },
// //         ...recent.map((h) => ({ role: h.role, content: h.content })),
// //       ],
// //       temperature: 0.5,
// //       max_tokens: 350,
// //       ...reasoningParams(model),
// //     })
// //   );

// //   const roadmap = response.choices[0].message.content?.trim();
// //   // If this comes back empty, skip silently rather than throw — a missing
// //   // progress update shouldn't surface as a full error on a message whose
// //   // actual reply already sent successfully.
// //   if (!roadmap) return null;

// //   await saveRoadmap(userId, roadmap);
// //   return roadmap;
// // }

// // // Strips markdown syntax and emoji so the TTS engine doesn't read symbols
// // // (asterisks, underscores, backticks, etc.) aloud. Relying on prompt
// // // instructions alone isn't reliable — models slip back into markdown even
// // // when told not to, so this is a deterministic safety net.
// // function stripForSpeech(text) {
// //   return text
// //     // Markdown links: [text](url) -> text
// //     .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
// //     // Bold / italic markers
// //     .replace(/\*\*(.*?)\*\*/g, "$1")
// //     .replace(/__(.*?)__/g, "$1")
// //     .replace(/\*(.*?)\*/g, "$1")
// //     .replace(/_(.*?)_/g, "$1")
// //     // Code blocks / inline code
// //     .replace(/```[\s\S]*?```/g, "")
// //     .replace(/`([^`]*)`/g, "$1")
// //     // Headers, blockquotes, list markers
// //     .replace(/^#{1,6}\s*/gm, "")
// //     .replace(/^>\s?/gm, "")
// //     .replace(/^[\s]*[-*+]\s+/gm, "")
// //     // Any leftover markdown symbols
// //     .replace(/[*_~`#]/g, "")
// //     // Emoji (covers most common ranges used in the prompt/replies)
// //     .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
// //     // Collapse whitespace left behind by the above
// //     .replace(/\n{2,}/g, ". ")
// //     .replace(/\n/g, " ")
// //     .replace(/\s{2,}/g, " ")
// //     .trim();
// // }

// // export async function textToSpeech(text, languageKey) {
// //   const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
// //   const folder = tmpdir();
// //   const spokenText = stripForSpeech(text);

// //   if (!spokenText) {
// //     console.warn("TTS skipped: nothing left to speak after stripping markdown/emoji.");
// //     return null;
// //   }

// //   try {
// //     const tts = new MsEdgeTTS();
// //     await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
// //     const { audioFilePath } = await tts.toFile(folder, spokenText);
// //     return audioFilePath;
// //   } catch (err) {
// //     console.error("TTS error:", err);
// //     return null;
// //   }
// // }

// // export async function cleanupFile(filePath) {
// //   try {
// //     await unlink(filePath);
// //   } catch (_) { }
// // }

// // export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
// //   // toFile (from groq-sdk, same lineage as the OpenAI SDK) doesn't depend on
// //   // the global Web File API — `new File(...)` requires Node 18.13+ AND a
// //   // host that hasn't stripped/polyfilled it differently, which varies across
// //   // hosting providers. toFile works from a plain Buffer everywhere, so this
// //   // removes one whole category of "works locally, fails on Render" bugs.
// //   const file = await toFile(audioBuffer, filename, { type: "audio/ogg" });
// //   return withModelFallback(STT_MODELS, (model) =>
// //     groq.audio.transcriptions.create({
// //       file,
// //       model,
// //       response_format: "text",
// //     })
// //   );
// // }

// // // OLD PROMPT RULES:

// // // "
// // // RULES:
// // // Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// // // Carefully analyze every message for grammar, vocabulary, and spelling errors.
// // // Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// // // Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// // // Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// // // [CORRECTION]
// // // If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// // // If there are NO errors: write "✅ Perfect!"

// // // [FLASHCARD]
// // // If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// // // INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// // // Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// // // If there is nothing to save, or you are unsure about the word, write: NONE

// // // [RESPONSE]
// // // Continue the conversation naturally in ${language} at ${level} level.
// // // Ask one simple, engaging follow-up question to keep the dialogue going.
// // // Be warm, patient, and encouraging — like a good tutor would be.

// // // IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// // // NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// // // You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// // // Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// // // You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// // // At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// // // What the user has recently improved
// // // What still needs work
// // // The next 1–3 learning goals (very simple and actionable)
// // // A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// // // When introducing a new topic, you must follow this structure:
// // // Brief explanation (simple, adapted to ${level})
// // // 2–3 example sentences
// // // One small practice question for the user
// // // Always prioritize progressive difficulty:
// // // Do not overwhelm the user
// // // Slightly increase complexity only when the user demonstrates readiness
// // // Recycle previously learned vocabulary in new contexts to reinforce retention
// // // If the user struggles repeatedly with a concept:
// // // Break it down into smaller steps
// // // Provide analogies or simpler re-explanations
// // // Offer a quick drill or repetition exercise
// // // If the user shows strong performance:
// // // Introduce slightly more advanced structures
// // // Encourage natural expression rather than basic repetition

// // // IMPORTANT:

// // // The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// // // Never break the fixed tag structure.
// // // Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// // // The teaching system must feel like a continuous personalized curriculum, not random conversation.

// // //"


// // // function buildSystemPrompt(language, level) {
// // //   return `You are a friendly, encouraging, and voice-enabled ${language} language coach. 
// // // You are passionate about helping students learn languages and speak with confidence.
// // // You CAN speak — your responses are automatically converted to audio and sent as voice messages.
// // // Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
// // // The student's level is ${level}.

// // // LINGUISTIC ACCURACY (MANDATORY — apply to every ${language} sentence you write, including [CORRECTION], [FLASHCARD], and [RESPONSE]):
// // // - Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
// // // - Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
// // // - If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
// // // - Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.
// // // - Since [RESPONSE] is converted to speech, write it the way it should sound out loud: avoid abbreviations and symbols that are not naturally spoken (write out words instead of using e.g., etc., %, & and similar), and keep sentence rhythm natural for spoken delivery.

// // // RULES:

// // // Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// // // Carefully analyze every message for grammar, vocabulary, and spelling errors.
// // // Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// // // Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// // // Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// // // [CORRECTION]
// // // If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// // // If there are NO errors: write "✅ Perfect!"

// // // [FLASHCARD]
// // // If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// // // INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// // // Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// // // If there is nothing to save, or you are unsure about the word, write: NONE

// // // [RESPONSE]
// // // Continue the conversation naturally in ${language} at ${level} level.
// // // Ask one simple, engaging follow-up question to keep the dialogue going.
// // // Be warm, patient, and encouraging — like a good tutor would be.
// // // This section is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.

// // // IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// // // NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// // // You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// // // Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// // // You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// // // At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// // // What the user has recently improved
// // // What still needs work
// // // The next 1–3 learning goals (very simple and actionable)
// // // A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// // // When introducing a new topic, you must follow this structure:
// // // Brief explanation (simple, adapted to ${level})
// // // 2–3 example sentences
// // // One small practice question for the user
// // // Always prioritize progressive difficulty:
// // // Do not overwhelm the user
// // // Slightly increase complexity only when the user demonstrates readiness
// // // Recycle previously learned vocabulary in new contexts to reinforce retention
// // // If the user struggles repeatedly with a concept:
// // // Break it down into smaller steps
// // // Provide analogies or simpler re-explanations
// // // Offer a quick drill or repetition exercise
// // // If the user shows strong performance:
// // // Introduce slightly more advanced structures
// // // Encourage natural expression rather than basic repetition

// // // IMPORTANT:

// // // The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// // // Never break the fixed tag structure.
// // // Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// // // The teaching system must feel like a continuous personalized curriculum, not random conversation.`;
// // // }