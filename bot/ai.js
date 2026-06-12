// ai.js
import Groq from "groq-sdk";
import { addFlashcard, addHistory } from "./db.js";
import edgeTTS from "edge-tts";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
};

function buildSystemPrompt(language, level) {
  return `You are a friendly, encouraging ${language} language coach.
The student's level is ${level}.

RULES:
1. Always conduct the conversation IN ${language} (except corrections and flashcard content, which are bilingual).
2. Carefully analyze every message for grammar, vocabulary, and spelling errors.
3. Only save a word or phrase as a flashcard if you are completely certain it is a legitimate, recognized part of ${language} vocabulary. If you are unsure whether a word exists or is correct in ${language}, do NOT save it.
4. Never save slang, typos, invented words, or anything you cannot confidently identify as real ${language} vocabulary.
5. Structure your reply EXACTLY like this (use these exact tags, in this exact order):

[CORRECTION]
If there are errors: write "📝 Correction: <corrected sentence>" and briefly explain the grammar or vocabulary rule in English in one sentence.
If there are NO errors: write "✅ Perfect!"

[FLASHCARD]
If you made a correction AND the corrected word/phrase is a confirmed part of ${language} vocabulary, save it as:
INCORRECT_FORM:::CORRECTED_FORM:::EXAMPLE_OF_CORRECT_USAGE
Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish — "Tengo hambre después de correr."
If there is nothing to save, or you are unsure about the word, write: NONE

[RESPONSE]
Continue the conversation naturally in ${language} at ${level} level.
Ask one simple, engaging follow-up question to keep the dialogue going.
Be warm, patient, and encouraging — like a good tutor would be.

IMPORTANT: Always include all three tags in every response, in this exact order. Never skip a tag.`;
}

export async function chat(userId, userMessage, history, language, level) {
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: buildSystemPrompt(language, level) },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const raw = response.choices[0].message.content;

  const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[FLASHCARD\]/);
  const flashcardMatch = raw.match(/\[FLASHCARD\]([\s\S]*?)(?:\[RESPONSE\]|$)/);
  const responseMatch = raw.match(/\[RESPONSE\]([\s\S]*?)$/);

  const correction = correctionMatch ? correctionMatch[1].trim() : "✅ Perfect!";
  const flashcardRaw = flashcardMatch ? flashcardMatch[1].trim().split("\n")[0] : "NONE";
  const reply = responseMatch ? responseMatch[1].trim() : raw;

  console.log("FLASHCARD RAW:", flashcardRaw);

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

export async function textToSpeech(text, languageKey) {
  const voice = TTS_VOICES[languageKey] || "en-US-GuyNeural";
  const outputPath = join(tmpdir(), `tts_${Date.now()}.mp3`);

  try {
    const tts = new edgeTTS.MsEdgeTTS();
    await tts.setMetadata(voice, edgeTTS.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const readable = tts.toStream(text);

    const chunks = [];
    await new Promise((resolve, reject) => {
      readable.on("data", (chunk) => chunks.push(chunk));
      readable.on("end", resolve);
      readable.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    await writeFile(outputPath, buffer);
    return outputPath;
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
  const file = new File([audioBuffer], filename, { type: "audio/ogg" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
  });
  return transcription;
}