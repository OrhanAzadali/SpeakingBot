import Groq from "groq-sdk";
import { addFlashcard, addHistory } from "./db.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const LANGUAGES = {
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

export { LANGUAGES };

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(language, level) {
  return `You are a friendly, encouraging ${language} language coach. 
The student's level is ${level}.

RULES:
1. Always conduct the conversation IN ${language} (except corrections which are in the user's language).
2. Analyze every message for grammar, vocabulary, and spelling errors.
3. Structure your reply EXACTLY like this (use these exact tags):

[CORRECTION]
If there are errors, write: "📝 Correction: <corrected sentence>" then explain the rule briefly in English in one sentence.
If there are NO errors, write: "✅ Perfect!"

[FLASHCARD]
If you corrected a specific word or phrase, write it as: WORD:::CORRECTION:::CONTEXT
Example: tengo hambre:::I am hungry (not "I have hungry"):::Used to express hunger in Spanish
If no new word to save, write: NONE

[RESPONSE]
Continue the conversation naturally in ${language} at ${level} level. 
Ask one simple follow-up question to keep the dialogue going.
Keep it warm, friendly and encouraging.

IMPORTANT: Always include all three tags in every response, in this exact order.`;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

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

  // Parse the structured response
  const correctionMatch = raw.match(/\[CORRECTION\]([\s\S]*?)\[FLASHCARD\]/);
  const flashcardMatch = raw.match(/\[FLASHCARD\]([\s\S]*?)\[RESPONSE\]/);
  const responseMatch = raw.match(/\[RESPONSE\]([\s\S]*?)$/);

  const correction = correctionMatch ? correctionMatch[1].trim() : "✅ Perfect!";
  const flashcardRaw = flashcardMatch ? flashcardMatch[1].trim() : "NONE";
  const reply = responseMatch ? responseMatch[1].trim() : raw;

  // Save flashcard if present
  if (flashcardRaw !== "NONE" && flashcardRaw.includes(":::")) {
    const [word, corr, context] = flashcardRaw.split(":::");
    if (word && corr) {
      addFlashcard(userId, word.trim(), corr.trim(), context?.trim() ?? "");
    }
  }

  // Save to history
  addHistory(userId, "user", userMessage);
  addHistory(userId, "assistant", reply);

  return { correction, reply };
}

// ── Speech to Text ────────────────────────────────────────────────────────────

export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
  const file = new File([audioBuffer], filename, { type: "audio/ogg" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
  });

  return transcription;
}
