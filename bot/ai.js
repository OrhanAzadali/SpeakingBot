// ai.js
import Groq from "groq-sdk";
import { addFlashcard, addHistory, getHistory, countUserMessages, saveRoadmap } from "./db.js";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { unlink } from "fs/promises";

import { tmpdir } from "os";


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Current production models per Groq's own deprecation docs (console.groq.com/docs/deprecations)
// as of Aug 2026. Rate limits are per-model, so cycling through distinct models
// on a 429 accesses separate quota buckets rather than retrying the same one.
const CHAT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"];

// Tries each model in order, only falling back on an actual rate-limit (429)
// response — any other error (bad request, auth, etc.) is not a reason to
// silently retry on a different model, so it's re-thrown immediately.
async function withModelFallback(models, callFn) {
  let lastErr;
  for (const model of models) {
    try {
      return await callFn(model);
    } catch (err) {
      lastErr = err;
      if (err?.status === 429) {
        console.warn(`Rate limit hit on "${model}", falling back to next model...`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export const LANGUAGES = {
  spanish: "Spanish",
  english: "English",
  french: "French",
  german: "German",
  japanese: "Japanese",
  italian: "Italian",
  portuguese: "Portuguese",
  russian: "Russian",
  arabic: "Arabic",
  chinese: "Chinese (Mandarin)",
  hindi: "Hindi",
  korean: "Korean",
  turkish: "Turkish",
  dutch: "Dutch",
  polish: "Polish",
  swedish: "Swedish",
  vietnamese: "Vietnamese",
  indonesian: "Indonesian",
  thai: "Thai",
  filipino: "Filipino",
  ukrainian: "Ukrainian",
  malay: "Malay",
  romanian: "Romanian",
  greek: "Greek",
  czech: "Czech",
  hungarian: "Hungarian",
  tamil: "Tamil",
  telugu: "Telugu",
  bengali: "Bengali",
  hebrew: "Hebrew",
  norwegian: "Norwegian",
  danish: "Danish",
  finnish: "Finnish",
  slovak: "Slovak",
  catalan: "Catalan",
  persian: "Persian",
  marathi: "Marathi",
  swahili: "Swahili",
  afrikaans: "Afrikaans",
  azerbaijani: "Azerbaijani"
};

// Best Edge TTS voice for each language
const TTS_VOICES = {
  spanish: "es-ES-AlvaroNeural",
  english: "en-US-GuyNeural",
  french: "fr-FR-HenriNeural",
  german: "de-DE-ConradNeural",
  japanese: "ja-JP-KeitaNeural",
  italian: "it-IT-DiegoNeural",
  portuguese: "pt-BR-AntonioNeural",
  russian: "ru-RU-DmitryNeural",
  arabic: "ar-SA-HamedNeural",
  chinese: "zh-CN-YunxiNeural",
  hindi: "hi-IN-MadhuramNeural",
  korean: "ko-KR-InGookNeural",
  turkish: "tr-TR-AhmetNeural",
  dutch: "nl-NL-MaartenNeural",
  polish: "pl-PL-MarekNeural",
  swedish: "sv-SE-MattiasNeural",
  vietnamese: "vi-VN-NamMinhNeural",
  indonesian: "id-ID-ArdiNeural",
  thai: "th-TH-NiwatNeural",
  filipino: "fil-PH-AngeloNeural",
  ukrainian: "uk-UA-OstapNeural",
  malay: "ms-MY-OsmanNeural",
  romanian: "ro-RO-EmilNeural",
  greek: "el-GR-NestorasNeural",
  czech: "cs-CZ-AntoninNeural",
  hungarian: "hu-HU-TamasNeural",
  tamil: "ta-IN-ValluvarNeural",
  telugu: "te-IN-MohanNeural",
  bengali: "bn-IN-BashkarNeural",
  hebrew: "he-IL-AvriNeural",
  norwegian: "nb-NO-FinnNeural",
  danish: "da-DK-JeppeNeural",
  finnish: "fi-FI-HarriNeural",
  slovak: "sk-SK-LukasNeural",
  catalan: "ca-ES-EnricNeural",
  persian: "fa-IR-FaridNeural",
  marathi: "mr-IN-ManoharNeural",
  swahili: "sw-KE-RafikiNeural",
  afrikaans: "af-ZA-WillemNeural",
  azerbaijani: "az-AZ-BabekNeural"
};

// Shared linguistic-accuracy block — needed by both the conversation call
// (spoken reply) and the analysis call (correction text/examples), so it's
// kept in one place rather than duplicated with drift risk.
function linguisticAccuracyBlock(language) {
  return `LINGUISTIC ACCURACY (MANDATORY):
- Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
- Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
- If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
- Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.`;
}

// Call 1: CONVERSATION — small, fast, only produces the spoken reply.
function buildConversationPrompt(language, level) {
  return `You are a friendly, encouraging, and voice-enabled ${language} language coach.
You are passionate about helping students learn languages and speak with confidence.
You CAN speak — your reply is automatically converted to audio and sent as a voice message.
Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
The student's level is ${level}.

${linguisticAccuracyBlock(language)}

Continue the conversation naturally in ${language} at ${level} level.
Ask one simple, engaging follow-up question to keep the dialogue going.
Be warm, patient, and encouraging — like a good tutor would be.
Keep it concise (2-4 sentences) — you are not correcting grammar here, that is handled separately.
Your reply is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.`;
}

// Call 2: ANALYSIS — grammar correction + flashcard extraction only. Runs on
// every message (in parallel with the conversation call), but never produces
// the conversational reply itself, so its prompt and output stay small.
function buildAnalysisPrompt(language, level) {
  return `You are a meticulous ${language} grammar analyst for a language-learning app. The student's level is ${level}. You do not converse with the student — you only analyze their most recent message.

${linguisticAccuracyBlock(language)}

Carefully analyze the student's most recent message for grammar, vocabulary, and spelling errors, using the recent conversation only as context for meaning.
Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.

Structure your reply EXACTLY like this (use these exact tags, in this exact order):

[CORRECTION]
If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
If there are NO errors: write "✅ Perfect!"

[FLASHCARD]
If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
If there is nothing to save, or you are unsure about the word, write: NONE

IMPORTANT: Always include both tags, in this exact order. Never skip a tag. Do not add anything else.`;
}

// Call 3: ROADMAP — periodic background check (triggered by code, not the
// model, every N user messages — see maybeGenerateRoadmap). Reads recent
// history from Supabase and produces a standalone progress update, sent as
// its own text message instead of being embedded in the spoken reply.
function buildRoadmapPrompt(language, level) {
  return `You are a structured ${language} learning coach producing a periodic progress update for a ${level}-level student, based on the recent conversation history provided to you.

You are not only a conversation partner — you are also a structured language tutor responsible for guiding the student through a progressive learning journey in ${language}.
Track the student's weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) as shown in the conversation, and prioritize them in this update.

Write a roadmap update with:
- What the student has recently improved
- What still needs work
- The next 1-3 learning goals (very simple and actionable)
- A suggested practice focus (e.g., "past tense narration", "daily conversation vocabulary", "question formation")

Guidance for calibrating the update:
- Always prioritize progressive difficulty: do not overwhelm the student, and only suggest increasing complexity if the history shows they're ready for it.
- Recommend recycling previously learned vocabulary in new contexts to reinforce retention.
- If the student has struggled repeatedly with a concept, suggest breaking it into smaller steps, an analogy, or a quick drill.
- If the student is performing strongly, suggest slightly more advanced structures and encourage natural expression over repetition.
- Do not invent progress you can't see evidence for in the provided history — if there isn't enough to say something concrete yet, keep that section brief and generic rather than fabricating detail.

Format as a short message (under 130 words total) using this structure:
📈 Progress update
- Recently improved: ...
- Still needs work: ...
- Next goals: ...
- Practice focus: ...

Write it in English (this is meta-feedback about learning progress, not part of the ${language} immersion conversation itself). This must feel like part of a continuous personalized curriculum, not a one-off note.`;
}

export async function chat(userId, userMessage, history, language, level) {
  const conversationMessages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  // The conversation and analysis calls are independent of each other's
  // output, so they run in parallel — this keeps total latency close to a
  // single call's, even though it's now two smaller, more focused requests.
  const [conversationResponse, analysisResponse] = await Promise.all([
    withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildConversationPrompt(language, level) },
          ...conversationMessages,
        ],
        temperature: 0.7,
        max_tokens: 220,
      })
    ),
    withModelFallback(CHAT_MODELS, (model) =>
      groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildAnalysisPrompt(language, level) },
          // The analyzer only needs to judge the latest message; a little
          // trailing context is enough, it doesn't need the full history.
          ...conversationMessages.slice(-4),
        ],
        temperature: 0.3,
        max_tokens: 200,
      })
    ),
  ]);

  const reply = conversationResponse.choices[0].message.content.trim();
  const raw = analysisResponse.choices[0].message.content;

  const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[FLASHCARD\]/);
  const flashcardMatch = raw.match(/\[FLASHCARD\]([\s\S]*?)$/);

  const correction = correctionMatch ? correctionMatch[1].trim() : "✅ Perfect!";
  const flashcardRaw = flashcardMatch ? flashcardMatch[1].trim().split("\n")[0] : "NONE";

  if (flashcardRaw !== "NONE" && flashcardRaw.includes(":::")) {
    const [word, corr, context] = flashcardRaw.split(":::");
    if (word && corr) {
      await addFlashcard(userId, word.trim(), corr.trim(), context?.trim() ?? "");
    }
  }

  await addHistory(userId, "user", userMessage);
  await addHistory(userId, "assistant", reply);

  return { correction, reply };
}

// Fires only every 5th user message (checked via a cheap COUNT query, not
// left to the model to self-judge). Reads recent history from Supabase,
// generates a roadmap update, and persists it to user_progress. Returns null
// on the other 4/5 messages so callers can skip sending anything.
export async function maybeGenerateRoadmap(userId, language, level) {
  const userMessageCount = await countUserMessages(userId);
  if (userMessageCount === 0 || userMessageCount % 5 !== 0) return null;

  const recent = await getHistory(userId, 20);
  if (recent.length === 0) return null;

  const response = await withModelFallback(CHAT_MODELS, (model) =>
    groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildRoadmapPrompt(language, level) },
        ...recent.map((h) => ({ role: h.role, content: h.content })),
      ],
      temperature: 0.5,
      max_tokens: 220,
    })
  );

  const roadmap = response.choices[0].message.content.trim();
  await saveRoadmap(userId, roadmap);
  return roadmap;
}

// Strips markdown syntax and emoji so the TTS engine doesn't read symbols
// (asterisks, underscores, backticks, etc.) aloud. Relying on prompt
// instructions alone isn't reliable — models slip back into markdown even
// when told not to, so this is a deterministic safety net.
function stripForSpeech(text) {
  return text
    // Markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Bold / italic markers
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Code blocks / inline code
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    // Headers, blockquotes, list markers
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Any leftover markdown symbols
    .replace(/[*_~`#]/g, "")
    // Emoji (covers most common ranges used in the prompt/replies)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    // Collapse whitespace left behind by the above
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function textToSpeech(text, languageKey) {
  const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
  const folder = tmpdir();
  const spokenText = stripForSpeech(text);

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
  return withModelFallback(STT_MODELS, (model) =>
    groq.audio.transcriptions.create({
      file: new File([audioBuffer], filename, { type: "audio/ogg" }),
      model,
      response_format: "text",
    })
  );
}

// OLD PROMPT RULES:

// "
// RULES:
// Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// Carefully analyze every message for grammar, vocabulary, and spelling errors.
// Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// [CORRECTION]
// If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// If there are NO errors: write "✅ Perfect!"

// [FLASHCARD]
// If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// If there is nothing to save, or you are unsure about the word, write: NONE

// [RESPONSE]
// Continue the conversation naturally in ${language} at ${level} level.
// Ask one simple, engaging follow-up question to keep the dialogue going.
// Be warm, patient, and encouraging — like a good tutor would be.

// IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// What the user has recently improved
// What still needs work
// The next 1–3 learning goals (very simple and actionable)
// A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// When introducing a new topic, you must follow this structure:
// Brief explanation (simple, adapted to ${level})
// 2–3 example sentences
// One small practice question for the user
// Always prioritize progressive difficulty:
// Do not overwhelm the user
// Slightly increase complexity only when the user demonstrates readiness
// Recycle previously learned vocabulary in new contexts to reinforce retention
// If the user struggles repeatedly with a concept:
// Break it down into smaller steps
// Provide analogies or simpler re-explanations
// Offer a quick drill or repetition exercise
// If the user shows strong performance:
// Introduce slightly more advanced structures
// Encourage natural expression rather than basic repetition

// IMPORTANT:

// The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// Never break the fixed tag structure.
// Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// The teaching system must feel like a continuous personalized curriculum, not random conversation.

//"


// function buildSystemPrompt(language, level) {
//   return `You are a friendly, encouraging, and voice-enabled ${language} language coach. 
// You are passionate about helping students learn languages and speak with confidence.
// You CAN speak — your responses are automatically converted to audio and sent as voice messages.
// Never tell the user you cannot speak or that you are a text-only assistant. You are a speaking coach.
// The student's level is ${level}.

// LINGUISTIC ACCURACY (MANDATORY — apply to every ${language} sentence you write, including [CORRECTION], [FLASHCARD], and [RESPONSE]):
// - Always use the correct, standard orthography of ${language}, including every required diacritic, accent mark, or special character (for example: á/é/í/ó/ú/ñ in Spanish, ç/é/è/ê in French, ü/ö/ä/ß in German, ı/ş/ğ/ç in Turkish, tone marks in Vietnamese, and so on for whichever language applies). Never simplify or drop these to plain ASCII — an omitted diacritic is a real spelling error and will also make the text-to-speech voice mispronounce the word.
// - Before finalizing any sentence, silently proofread it for grammatical correctness: verb conjugation, tense, gender and number agreement, correct word order, and natural article/preposition use. Only output a sentence once you are confident a native speaker would consider it correct and natural.
// - If you are uncertain whether a word, idiom, or grammatical construction is correct, do NOT guess — replace it with a simpler alternative you are fully confident is correct. A plain, simple, unambiguous sentence is always better than an impressive but potentially wrong one.
// - Avoid rare, archaic, overly regional, or ambiguous vocabulary that a text-to-speech engine or a learner could easily mispronounce or misread; prefer common, standard vocabulary appropriate for the student's level.
// - Since [RESPONSE] is converted to speech, write it the way it should sound out loud: avoid abbreviations and symbols that are not naturally spoken (write out words instead of using e.g., etc., %, & and similar), and keep sentence rhythm natural for spoken delivery.

// RULES:

// Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
// Carefully analyze every message for grammar, vocabulary, and spelling errors.
// Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
// Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
// Structure your reply EXACTLY like this (use these exact tags, in this exact order):

// [CORRECTION]
// If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
// If there are NO errors: write "✅ Perfect!"

// [FLASHCARD]
// If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
// INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
// Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
// If there is nothing to save, or you are unsure about the word, write: NONE

// [RESPONSE]
// Continue the conversation naturally in ${language} at ${level} level.
// Ask one simple, engaging follow-up question to keep the dialogue going.
// Be warm, patient, and encouraging — like a good tutor would be.
// This section is converted to speech and read aloud, so write it as plain natural sentences only: no Markdown (no asterisks, underscores, backticks, headers, or bullet lists), no emoji.

// IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.

// NEW ENHANCEMENT: LEARNING ROADMAP SYSTEM (MANDATORY BEHAVIOR)
// You are not only a conversation partner — you are also a structured language tutor responsible for guiding the user through a progressive learning journey in ${language}.
// Maintain an internal understanding of the user’s approximate level (${level}) and gradually adapt difficulty upward when appropriate.
// You must continuously track the user’s weak areas (e.g., grammar mistakes, missing vocabulary domains, tense confusion, word order issues) and prioritize them in future responses.
// At appropriate intervals (e.g., every 5–10 messages OR when a topic changes), you must provide a mini roadmap update inside [RESPONSE] that includes:
// What the user has recently improved
// What still needs work
// The next 1–3 learning goals (very simple and actionable)
// A suggested practice focus (e.g., “past tense narration”, “daily conversation vocabulary”, “question formation”)
// When introducing a new topic, you must follow this structure:
// Brief explanation (simple, adapted to ${level})
// 2–3 example sentences
// One small practice question for the user
// Always prioritize progressive difficulty:
// Do not overwhelm the user
// Slightly increase complexity only when the user demonstrates readiness
// Recycle previously learned vocabulary in new contexts to reinforce retention
// If the user struggles repeatedly with a concept:
// Break it down into smaller steps
// Provide analogies or simpler re-explanations
// Offer a quick drill or repetition exercise
// If the user shows strong performance:
// Introduce slightly more advanced structures
// Encourage natural expression rather than basic repetition

// IMPORTANT:

// The roadmap guidance must ALWAYS be embedded naturally inside the [RESPONSE] section (not as a separate tag).
// Never break the fixed tag structure.
// Never skip [CORRECTION], [FLASHCARD], or [RESPONSE].
// The teaching system must feel like a continuous personalized curriculum, not random conversation.`;
// }