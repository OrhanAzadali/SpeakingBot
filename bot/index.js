// index.js
import "dotenv/config";
import { Bot, InlineKeyboard, InputFile, webhookCallback } from "grammy";
import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import PDFDocument from "pdfkit";

import {
  initDB, getUser, upsertUser, getHistory, clearHistory,
  getDueFlashcards, getFlashcardsByLanguage, getFlashcardById, updateFlashcard, recordQuizResult,
  checkAndIncrementUsage, grantPremium, getRoadmap, getAllUserVocabulary,
  saveActiveTest, getActiveTest, recordActiveTestAnswer, clearActiveTest, saveTestResult, getUserTestHistory
} from "./db.js";
import {
  chat, transcribeAudio, textToSpeech, cleanupFile, LANGUAGES,
  maybeGenerateRoadmap, checkSemanticAnswer, generateLevelTest, evaluateLevelTest
} from "./ai.js";

const bot = new Bot(process.env.BOT_TOKEN);
const MINIAPP_URL = process.env.MINIAPP_URL;

// Free-tier daily message cap and Premium pricing. All configurable via env
// vars so you can tune them without a code change.
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "100", 10);
const PREMIUM_PRICE_STARS = parseInt(process.env.PREMIUM_PRICE_STARS || "150", 10);
const PREMIUM_DURATION_DAYS = parseInt(process.env.PREMIUM_DURATION_DAYS || "30", 10);

// Webhook mode config. Render sets RENDER_EXTERNAL_URL automatically; you can also
// set PUBLIC_URL manually for other hosts. If neither is set, we fall back to polling.
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
const WEBHOOK_PATH = "/telegram/webhook";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional, but recommended

// Allow the deployed Mini App origin, plus any extra origins from ALLOWED_ORIGINS
// (comma-separated), e.g. for local dev: ALLOWED_ORIGINS=http://localhost:5173
const allowedOrigins = [
  MINIAPP_URL,
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
].filter(Boolean);

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header, e.g. curl/server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
}));
app.use(express.json());

app.get("/", (req, res) => res.send("Bot API is running 🚀"));

// Telegram delivers updates here when running in webhook mode.
// IMPORTANT: grammy's default here is to THROW after 10s if bot.handleUpdate()
// hasn't finished, which means Express never sends Telegram a 200 response.
// Telegram then redelivers the same update later — and the bot answers the
// same message twice. Voice messages in particular (download + transcription +
// chat completion + TTS + upload) routinely take longer than 10s, especially
// on a cold Render instance. Instead, we ack quickly and let processing
// continue in the background; the actual reply still goes out via the Bot API
// regardless of what this HTTP response contains.
if (PUBLIC_URL) {
  app.use(
    WEBHOOK_PATH,
    webhookCallback(bot, "express", {
      timeoutMilliseconds: 8_000,
      onTimeout: () => {
        console.log("Webhook ack sent early — update is still processing in the background.");
      },
      secretToken: WEBHOOK_SECRET,
    })
  );
}

// ── Telegram Mini App authentication ────────────────────────────────────────────
// Verifies the initData string every Telegram Mini App receives from
// window.Telegram.WebApp.initData, per Telegram's official algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// This is what actually proves a request came from a real, currently-logged-in
// Telegram session for a given user — a plain ?userId= query param, as this
// API used before, proves nothing and can be set to anyone's ID.
function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // Constant-time comparison to avoid leaking timing information about the hash
  const hashBuf = Buffer.from(hash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  if (hashBuf.length !== computedBuf.length || !crypto.timingSafeEqual(hashBuf, computedBuf)) {
    return null;
  }

  // Reject stale sessions (older than 24h) to limit how long a captured
  // initData string would remain usable if it ever leaked.
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson); // { id, first_name, username, ... }
  } catch {
    return null;
  }
}

function requireTelegramAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const initData = authHeader.startsWith("tma ") ? authHeader.slice(4) : null;

  if (!initData) {
    return res.status(401).json({ error: "Missing Telegram authentication" });
  }

  const user = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
  if (!user?.id) {
    return res.status(401).json({ error: "Invalid or expired Telegram authentication" });
  }

  req.telegramUser = user;
  next();
}

app.get("/api/flashcards", requireTelegramAuth, async (req, res) => {
  const user = await getUser(req.telegramUser.id);
  if (!user?.language) {
    return res.json({ cards: [], language: null });
  }
  const cards = await getFlashcardsByLanguage(req.telegramUser.id, user.language);
  res.json({ cards, language: user.language });
});

app.post("/api/flashcards/:id/review", requireTelegramAuth, async (req, res) => {
  const { id } = req.params;
  const { remembered } = req.body;
  const updated = await updateFlashcard(Number(id), remembered, req.telegramUser.id);
  if (!updated) {
    return res.status(404).json({ error: "Flashcard not found" });
  }
  res.json({ ok: true });
});

// Quiz mode: the server — not the client — decides whether the submitted
// answer was correct. Grading is now AI-powered semantic comparison
// (checkSemanticAnswer, via Groq) instead of character-level string/edit-
// distance comparison, so paraphrases and synonyms are accepted and a
// same-spelling-but-wrong-meaning answer is rejected. This stops a client
// from just claiming { correct: true } to instantly master (and delete) any
// card. 3 correct answers in a row masters the word.
app.post("/api/flashcards/:id/quiz", requireTelegramAuth, async (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;
  if (typeof answer !== "string") {
    return res.status(400).json({ error: "Missing answer" });
  }

  const card = await getFlashcardById(Number(id), req.telegramUser.id);
  if (!card) {
    return res.status(404).json({ error: "Flashcard not found" });
  }

  const evalResult = await checkSemanticAnswer(
    card.initial_form || card.word,
    answer,
    card.correction,
    card.synonyms
  );

  const result = await recordQuizResult(Number(id), req.telegramUser.id, evalResult.correct);

  res.json({
    correct: evalResult.correct,
    isSynonym: evalResult.isSynonym,
    explanation: evalResult.explanation || card.explanation,
    correctAnswer: card.correction,
    initialForm: card.initial_form || card.word,
    usedForm: card.used_form || card.word,
    partOfSpeech: card.part_of_speech || "word",
    synonyms: card.synonyms,
    sentence: card.sentence,
    ...result,
  });
});

// ── PDF Export Utility ────────────────────────────────────────────────────────
// Compiles all active cards and mastered words into a styled PDF document
async function generateVocabularyPdf(userId, language, outputPath) {
  const data = await getAllUserVocabulary(userId, language);
  if (data.total === 0) return null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(22).font("Helvetica-Bold").text("Personal Vocabulary Notebook", { align: "center" });
    doc.fontSize(11).font("Helvetica").text(
      `Language: ${language ? LANGUAGES[language] || language : "All"} | Generated: ${new Date().toLocaleDateString()}`,
      { align: "center" }
    );
    doc.moveDown(1.5);

    const renderWordItem = (item, index) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e293b").text(`${index + 1}. ${item.initial_form || item.word} `, { continued: true });
      if (item.part_of_speech) {
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#64748b").text(`[${item.part_of_speech}]`, { continued: true });
      }
      doc.fontSize(12).font("Helvetica").fillColor("#15803d").text(` — ${item.correction}`);
      if (item.synonyms) doc.fontSize(10).font("Helvetica").fillColor("#475569").text(`   • Synonyms: ${item.synonyms}`);
      if (item.explanation) doc.fontSize(10).font("Helvetica").fillColor("#475569").text(`   • Note: ${item.explanation}`);
      if (item.sentence) {
        const cleanSentence = item.sentence.replace(/<\/?u>/g, "");
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#334155").text(`   • Example: "${cleanSentence}"`);
      }
      doc.moveDown(0.6);
    };

    if (data.active.length > 0) {
      doc.fontSize(15).font("Helvetica-Bold").fillColor("#4338ca").text(`📚 Active Flashcards (${data.active.length})`);
      doc.moveDown(0.5);
      data.active.forEach((w, i) => renderWordItem(w, i));
      doc.moveDown(1);
    }

    if (data.mastered.length > 0) {
      if (doc.y > 650) doc.addPage();
      doc.fontSize(15).font("Helvetica-Bold").fillColor("#047857").text(`🏆 Mastered Words (${data.mastered.length})`);
      doc.moveDown(0.5);
      data.mastered.forEach((w, i) => renderWordItem(w, i));
    }

    doc.end();
    writeStream.on("finish", () => resolve(outputPath));
    writeStream.on("error", reject);
  });
}

// ── Onboarding & Diagnostic Placement Test Flow ──────────────────────────────

const MEDIATOR_LANGS = {
  english: "English 🇬🇧",
  russian: "Russian 🇷🇺",
  spanish: "Spanish 🇪🇸",
  french: "French 🇫🇷",
  german: "German 🇩🇪",
  turkish: "Turkish 🇹🇷",
  azerbaijani: "Azerbaijani 🇦🇿",
};

// ── /start ────────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { state: "choosing_language" });
  await clearHistory(userId);
  await clearActiveTest(userId);

  const kb = new InlineKeyboard();
  const langs = Object.entries(LANGUAGES);
  for (let i = 0; i < langs.length; i += 2) {
    const row = langs.slice(i, i + 2);
    kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `lang_${key}` })));
  }

  await ctx.reply(
    "👋 Welcome to *Language Immersion Coach*!\n\n" +
    "I'll chat with you in your target language, correct your mistakes in real-time, " +
    "and save words you struggle with as smart base-form flashcards.\n\n" +
    "🌍 *Step 1: Choose the language you want to LEARN:*",
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// ── Language selection ────────────────────────────────────────────────────────

bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  const language = ctx.match[1];
  const userId = ctx.from.id;
  await upsertUser(userId, { language, state: "choosing_mediator" });

  const kb = new InlineKeyboard();
  const mediators = Object.entries(MEDIATOR_LANGS);
  for (let i = 0; i < mediators.length; i += 2) {
    const row = mediators.slice(i, i + 2);
    kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `med_${key}` })));
  }

  await ctx.editMessageText(
    `Great! You chose *${LANGUAGES[language]}* 🎉\n\n` +
    `🗣 *Step 2: Choose your Mediator / Explanation Language:*\n` +
    `_(For Beginner and Intermediate levels, I will use this language to explain grammar rules and flashcards. Advanced learners receive 100% target language immersion.)_`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// ── Mediator selection & Mandatory Diagnostic Test Prompt ─────────────────────

bot.callbackQuery(/^med_(.+)$/, async (ctx) => {
  // CRITICAL: Acknowledge Telegram immediately to stop button spinning and double-delivery
  await ctx.answerCallbackQuery();

  const mediator_language = ctx.match[1];
  const userId = ctx.from.id;
  await upsertUser(userId, { mediator_language, state: "starting_test" });

  const kb = new InlineKeyboard().text("🚀 Start Diagnostic Placement Test", "start_placement_test");

  await ctx.editMessageText(
    `✅ Mediator language set to *${MEDIATOR_LANGS[mediator_language] || mediator_language}*.\n\n` +
    `🎯 *Step 3: Mandatory AI Diagnostic Placement Test*\n\n` +
    `Before chatting, our AI examiner will administer a 5-question test (3 multiple-choice, 2 open-ended) to scientifically diagnose your CEFR proficiency level (A1-C2).\n\n` +
    `Ready to begin? Tap below:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});
// Optional Command: User requests a level test anytime
bot.command(["test", "leveltest"], async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please send /start first to configure your target language.");
    return;
  }
  await initiateLevelTest(ctx, user.language, user.mediator_language || "english");
});

// History of Level Tests command
bot.command("testhistory", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please send /start first to configure your target language.");
    return;
  }
  const history = await getUserTestHistory(userId, user.language);
  if (history.length === 0) {
    await ctx.reply("No diagnostic tests recorded yet. Type /test to take one!");
    return;
  }

  let msg = `📊 *Your Diagnostic Level Test History (${LANGUAGES[user.language]}):*\n\n`;
  history.forEach((t, i) => {
    const date = new Date(t.created_at).toLocaleDateString();
    msg += `*${i + 1}. ${t.detected_level}* (Score: ${t.score}/100) — _${date}_\n`;
    if (t.recommendations) msg += `   💡 ${t.recommendations}\n`;
    msg += "\n";
  });
  await ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.callbackQuery("start_placement_test", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  await ctx.answerCallbackQuery();
  await initiateLevelTest(ctx, user.language, user.mediator_language || "english");
});

async function initiateLevelTest(ctx, language, mediatorLanguage) {
  const thinking = await ctx.reply("⏳ Generating your placement test with AI...");
  try {
    const targetName = LANGUAGES[language] || language;
    const testData = await generateLevelTest(targetName, mediatorLanguage);

    if (!testData || !Array.isArray(testData.questions) || testData.questions.length === 0) {
      throw new Error("No questions returned from test generator");
    }

    await saveActiveTest(ctx.from.id, language, mediatorLanguage, testData.questions);
    await upsertUser(ctx.from.id, { state: "in_level_test" });

    // Safe message deletion (never throws if already deleted)
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }

    await presentNextTestQuestion(ctx, ctx.from.id, testData.questions[0], 0, testData.questions.length);
  } catch (err) {
    console.error("Test generation error:", err);
    await ctx.reply("❌ Error generating placement test. Please try /test again.");
  }
}

async function presentNextTestQuestion(ctx, userId, question, index, total) {
  // Use plain text formatting so underscores like `_____` in fill-in-the-blanks NEVER crash Telegram!
  const header = `📝 Question ${index + 1} of ${total} [Target: ${question.cefr_target} • ${question.skill}]\n\n`;

  if (question.type === "choice" && Array.isArray(question.options)) {
    const kb = new InlineKeyboard();
    question.options.forEach((opt, optIdx) => {
      kb.text(opt, `testopt_${index}_${optIdx}`).row();
    });

    const body = `${header}${question.prompt}\n\n👉 Select the best variant below:`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(body, { reply_markup: kb });
    } else {
      await ctx.reply(body, { reply_markup: kb });
    }
  } else {
    // Open question without variants
    const body = `${header}${question.prompt}\n\n✍️ Please type your answer directly in the chat:`;
    if (ctx.callbackQuery) {
      await ctx.editMessageText(body);
    } else {
      await ctx.reply(body);
    }
  }
}

// Handle Multiple-Choice Test Answers
bot.callbackQuery(/^testopt_(\d+)_(\d+)$/, async (ctx) => {
  const qIndex = parseInt(ctx.match[1], 10);
  const optIndex = parseInt(ctx.match[2], 10);
  const userId = ctx.from.id;

  const test = await getActiveTest(userId);
  if (!test || test.current_index !== qIndex) {
    await ctx.answerCallbackQuery({ text: "Question already answered or session expired." });
    return;
  }

  const currentQ = test.questions[qIndex];
  const chosenText = currentQ.options[optIndex];
  await ctx.answerCallbackQuery();

  const updatedTest = await recordActiveTestAnswer(userId, chosenText);
  if (updatedTest.current_index < updatedTest.questions.length) {
    const nextQ = updatedTest.questions[updatedTest.current_index];
    await presentNextTestQuestion(ctx, userId, nextQ, updatedTest.current_index, updatedTest.questions.length);
  } else {
    await finishAndEvaluateTest(ctx, userId, updatedTest);
  }
});

async function finishAndEvaluateTest(ctx, userId, test) {
  const statusMsg = await ctx.reply("🧠 *Evaluating your answers against CEFR benchmarks with AI...*", { parse_mode: "Markdown" });

  try {
    const evaluation = await evaluateLevelTest(
      LANGUAGES[test.language] || test.language,
      test.mediator_language,
      test.questions,
      test.answers
    );

    // Save test result (enforces max 150 test limit / delete oldest 10 at 151)
    await saveTestResult(userId, test.language, evaluation);
    await clearActiveTest(userId);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

    const breakdownMsg =
      `🎯 *CEFR Level Detected:* **${evaluation.detected_level} (${evaluation.cefr_grade})**\n` +
      `📊 *Overall Score:* **${evaluation.score}/100**\n\n` +
      `📈 *Skill Breakdown:*\n` +
      `• *Vocabulary:* ${evaluation.breakdown.vocabulary}\n` +
      `• *Grammar:* ${evaluation.breakdown.grammar}\n` +
      `• *Syntax:* ${evaluation.breakdown.syntax}\n` +
      `• *Production:* ${evaluation.breakdown.production}\n\n` +
      `💡 *Examiner Note:* ${evaluation.recommendations}\n\n` +
      `🚀 *Your practice mode is now set to ${evaluation.detected_level}!* Send any text or voice message to start chatting!`;

    await ctx.reply(breakdownMsg, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Evaluation error:", err);
    await ctx.reply("❌ Error finalizing test. Level set to Intermediate as a fallback. Type /test anytime to retake.");
    await upsertUser(userId, { level: "Intermediate", state: "chatting" });
    await clearActiveTest(userId);
  }
}

// ── Voice messages ────────────────────────────────────────────────────────────

bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user || user.state === "in_level_test") {
    await ctx.reply("You are currently taking the diagnostic level test. Please answer the question above!");
    return;
  }
  if (!user || user.state !== "chatting") {
    await ctx.reply("Please /start first to complete your onboarding setup.");
    return;
  }

  if (!(await enforceUsageLimit(ctx, userId))) return;

  const thinking = await ctx.reply("🎙 Transcribing your voice...");

  try {
    // Download and transcribe voice
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    let buffer;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`status ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (downloadErr) {
      // Never let the token-bearing URL reach a log or thrown message
      throw new Error(`Failed to download voice file (${file.file_path}): ${downloadErr.message}`);
    }

    const transcribed = await transcribeAudio(buffer, "voice.ogg");

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n⏳ Thinking...`,
      { parse_mode: "Markdown" }
    );

    // Get AI response
    const history = await getHistory(userId);
    const { correction, reply } = await chat(
      userId, transcribed, history,
      LANGUAGES[user.language], user.level, user.language,
      user.mediator_language || "english"
    );

    // Send text correction first
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n${correction}`,
      { parse_mode: "Markdown" }
    );

    // Generate and send voice reply
    const audioPath = await textToSpeech(reply, user.language);
    if (audioPath) {
      await ctx.replyWithVoice(new InputFile(audioPath));
      await cleanupFile(audioPath);
    } else {
      // Fallback to text if TTS fails
      await ctx.reply(reply);
    }

    // Every 5th message, a background progress update is generated — sent
    // as its own silent text message rather than spoken, so it doesn't
    // bloat the conversational voice reply.
    const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
    if (roadmap) {
      await ctx.reply(roadmap);
    }

  } catch (err) {
    const redact = (s) => String(s ?? "").replaceAll(process.env.BOT_TOKEN, "[REDACTED]");
    console.error("Voice error:", {
      name: err?.name,
      status: err?.status ?? err?.response?.status,
      message: redact(err?.message || err),
      stack: redact(err?.stack),
    });
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      "❌ Couldn't process voice. Please try again or type instead."
    );
  }
});

// ── Text messages ─────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  // If user is currently taking the Diagnostic Level Test and answering an Open Question
  if (user?.state === "in_level_test") {
    const test = await getActiveTest(userId);
    if (test) {
      const qIndex = test.current_index;
      const currentQ = test.questions[qIndex];
      if (currentQ && currentQ.type === "open") {
        const updatedTest = await recordActiveTestAnswer(userId, ctx.message.text.trim());
        if (updatedTest.current_index < updatedTest.questions.length) {
          const nextQ = updatedTest.questions[updatedTest.current_index];
          await presentNextTestQuestion(ctx, userId, nextQ, updatedTest.current_index, updatedTest.questions.length);
        } else {
          await finishAndEvaluateTest(ctx, userId, updatedTest);
        }
        return;
      }
    }
  }

  if (!user || user.state !== "chatting") {
    await ctx.reply("👋 Send /start to begin your language practice!");
    return;
  }

  if (!(await enforceUsageLimit(ctx, userId))) return;

  const thinking = await ctx.reply("⏳ Thinking...");

  try {
    const history = await getHistory(userId);
    const { correction, reply } = await chat(
      userId, ctx.message.text, history,
      LANGUAGES[user.language], user.level, user.language,
      user.mediator_language || "english"
    );

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `${correction}\n\n${reply}`,
      { parse_mode: "Markdown" }
    );

    const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
    if (roadmap) {
      await ctx.reply(roadmap);
    }

  } catch (err) {
    console.error("Chat error:", err);
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      "❌ Something went wrong. Please try again."
    );
  }
});

// ── /flashcards ───────────────────────────────────────────────────────────────

bot.command("flashcards", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const cards = await getFlashcardsByLanguage(userId, user?.language);

  if (!cards.length) {
    await ctx.reply("📭 No flashcards yet! Keep chatting and I'll save words you struggle with.");
    return;
  }

  const due = await getDueFlashcards(userId);

  const kb = new InlineKeyboard().webApp(
    `📚 Open Flashcards (${due.length} due)`,
    `${MINIAPP_URL}?userId=${userId}`
  );

  await ctx.reply(
    `🗂 You have *${cards.length}* flashcards saved.\n` +
    `⏰ *${due.length}* are due for review now.\n\n` +
    `Tap below to open your flashcard deck:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// ── /pdf and /export ──────────────────────────────────────────────────────────

bot.command(["pdf", "export"], async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const tempPath = path.join(tmpdir(), `vocabulary_${userId}_${Date.now()}.pdf`);

  await ctx.replyWithChatAction("upload_document");

  try {
    const filePath = await generateVocabularyPdf(userId, user?.language, tempPath);
    if (!filePath) {
      await ctx.reply("📭 No saved flashcards or words yet! Practice chatting first.");
      return;
    }

    await ctx.replyWithDocument(new InputFile(filePath, `My_Vocabulary_${user?.language || "all"}.pdf`), {
      caption: `📖 Here is your complete vocabulary PDF with base words, explanations, synonyms, and context sentences!`,
    });

    await cleanupFile(filePath);
  } catch (err) {
    console.error("PDF export error:", err);
    await ctx.reply("❌ Error creating PDF. Please try again.");
  }
});

// ── /reset ────────────────────────────────────────────────────────────────────

bot.command("reset", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { language: null, level: null, state: "idle" });
  await clearHistory(userId);
  await clearActiveTest(userId);
  await ctx.reply("🔄 Session reset. Send /start to choose a new language and take the placement test.");
});

// ── /help ─────────────────────────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  await ctx.reply(
    "🤖 *Language Immersion Coach*\n\n" +
    "Commands:\n" +
    "  /start — choose language, mediator language & take placement test\n" +
    "  /test — retake the CEFR diagnostic placement test anytime\n" +
    "  /testhistory — view your past level test results\n" +
    "  /flashcards — open your saved words\n" +
    "  /pdf — download all words & notes as a PDF notebook\n" +
    "  /roadmap — see your latest progress update\n" +
    "  /reset — start over with a new language\n" +
    "  /upgrade — unlimited daily messages with Premium\n\n" +
    "💬 Type or send a voice message to practice!\n" +
    "🎙 Send voice → get voice reply\n" +
    "⌨️ Send text → get text reply\n" +
    "I'll correct you gently and save tricky words automatically in base form.",
    { parse_mode: "Markdown" }
  );
});

// ── /roadmap ──────────────────────────────────────────────────────────────────
// Re-shows the last saved progress update (generated every 5th message) —
// reads from Supabase directly, no extra Groq call.

bot.command("roadmap", async (ctx) => {
  const progress = await getRoadmap(ctx.from.id);
  if (!progress?.roadmap) {
    await ctx.reply("No progress update yet — keep chatting! One is generated every 5 messages.");
    return;
  }
  await ctx.reply(progress.roadmap);
});

// ── /upgrade — Telegram Stars payment ──────────────────────────────────────────
// Telegram Stars ("XTR") needs no external payment processor account — no
// Stripe keys, no bank/merchant country restrictions, no provider_token.
// Telegram itself collects the payment and settles it to your Stars balance.

bot.command("upgrade", async (ctx) => {
  await ctx.replyWithInvoice(
    "Language Coach Premium",
    `Unlimited daily messages for ${PREMIUM_DURATION_DAYS} days (currently capped at ${FREE_DAILY_LIMIT}/day on the free plan).`,
    "premium_upgrade", // internal payload, not shown to the user
    "XTR",
    [{ label: `Premium (${PREMIUM_DURATION_DAYS} days)`, amount: PREMIUM_PRICE_STARS }]
  );
});

// Telegram requires an answer within 10 seconds of a pre-checkout query.
bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

// Fires once Telegram confirms the Stars payment went through.
bot.on("message:successful_payment", async (ctx) => {
  await grantPremium(ctx.from.id, PREMIUM_DURATION_DAYS);
  await ctx.reply(
    `✅ Premium activated! Unlimited messages for the next ${PREMIUM_DURATION_DAYS} days. Thank you for supporting the bot! 🎉`
  );
});

// Returns true if the user may proceed; otherwise sends an upgrade prompt and
// returns false. Called before any Groq/TTS work so a blocked user doesn't
// burn API calls or eat into the webhook's ack window for nothing.
async function enforceUsageLimit(ctx, userId) {
  const usage = await checkAndIncrementUsage(userId, FREE_DAILY_LIMIT);
  if (usage.allowed) return true;

  await ctx.reply(
    `⏳ You've used all ${usage.limit} free messages today.\n\n` +
    `Send /upgrade for unlimited daily practice with Premium.`
  );
  return false;
}

// ── Daily reminder ────────────────────────────────────────────────────────────

async function sendDailyReminders() {
  try {
    const pool = (await import("./db.js")).default;
    const result = await pool.query("SELECT user_id FROM users WHERE state = 'chatting'");
    for (const { user_id } of result.rows) {
      try {
        const due = await getDueFlashcards(user_id);
        if (due.length >= 3) {
          const kb = new InlineKeyboard().webApp(
            `📚 Review ${due.length} cards`,
            `${MINIAPP_URL}?userId=${user_id}`
          );
          await bot.api.sendMessage(
            user_id,
            `⏰ *Time to review your flashcards!*\n\nYou have *${due.length}* words due for practice.`,
            { parse_mode: "Markdown", reply_markup: kb }
          );
        }
      } catch (userErr) {
        console.error(`Reminder failed for user ${user_id}:`, userErr.message);
        // Continue to the next user instead of aborting the whole batch
      }
    }
  } catch (err) {
    console.error("Reminder error:", err);
  }
}

setInterval(sendDailyReminders, 60 * 60 * 1000);

// ── Launch ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

initDB().then(async () => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));

  if (PUBLIC_URL) {
    // Webhook mode: Telegram pushes updates to us, so there's no polling
    // process that can conflict with another instance (the 409 error this
    // replaces). Safe across Render redeploys where the old instance
    // may still be shutting down.
    try {
      await bot.api.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
        secret_token: WEBHOOK_SECRET,
        drop_pending_updates: true,
      });
      console.log(`✅ Language Coach Bot is running (webhook: ${PUBLIC_URL}${WEBHOOK_PATH})`);
    } catch (err) {
      console.error("Failed to set webhook, falling back to polling:", err.message);
      startPolling();
    }
  } else {
    console.warn("No PUBLIC_URL/RENDER_EXTERNAL_URL set — using long polling instead.");
    startPolling();
  }
}).catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});

function startPolling() {
  // Fire-and-forget on purpose: bot.start() only resolves when polling stops.
  // A rejection here (e.g. another instance already polling — the original
  // 409 conflict) must not crash the process, since the Express API above
  // should keep serving /api/flashcards regardless.
  bot.start({
    drop_pending_updates: true,
    onStart: () => console.log("✅ Language Coach Bot is running (polling)!"),
  }).catch((err) => {
    console.error("Polling failed to start:", err.message);
    console.error("If this is a 409 conflict, another instance of this bot is already running elsewhere.");
  });
}

bot.catch((err) => {
  const ctx = err.ctx;
  console.error("Bot error:", err.error);
});
// // index.js
// import "dotenv/config";
// import { Bot, InlineKeyboard, InputFile, webhookCallback } from "grammy";
// import fetch from "node-fetch";
// import {
//   initDB, getUser, upsertUser, getHistory, clearHistory,
//   getDueFlashcards, getFlashcardsByLanguage, getFlashcardById, updateFlashcard, recordQuizResult,
//   checkAndIncrementUsage, grantPremium, getRoadmap
// } from "./db.js";
// import { chat, transcribeAudio, textToSpeech, cleanupFile, LANGUAGES, maybeGenerateRoadmap, checkSemanticAnswer } from "./ai.js";

// import express from "express";
// import cors from "cors";
// import crypto from "crypto";

// const bot = new Bot(process.env.BOT_TOKEN);
// const MINIAPP_URL = process.env.MINIAPP_URL;

// // Free-tier daily message cap and Premium pricing. All configurable via env
// // vars so you can tune them without a code change.
// const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "100", 10);
// const PREMIUM_PRICE_STARS = parseInt(process.env.PREMIUM_PRICE_STARS || "150", 10);
// const PREMIUM_DURATION_DAYS = parseInt(process.env.PREMIUM_DURATION_DAYS || "30", 10);

// // Webhook mode config. Render sets RENDER_EXTERNAL_URL automatically; you can also
// // set PUBLIC_URL manually for other hosts. If neither is set, we fall back to polling.
// const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
// const WEBHOOK_PATH = "/telegram/webhook";
// const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional, but recommended

// // Allow the deployed Mini App origin, plus any extra origins from ALLOWED_ORIGINS
// // (comma-separated), e.g. for local dev: ALLOWED_ORIGINS=http://localhost:5173
// const allowedOrigins = [
//   MINIAPP_URL,
//   ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
// ].filter(Boolean);

// const app = express();
// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow non-browser requests (no Origin header, e.g. curl/server-to-server)
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.includes(origin)) return callback(null, true);
//     return callback(new Error(`Origin ${origin} not allowed by CORS`));
//   },
// }));
// app.use(express.json());

// app.get("/", (req, res) => res.send("Bot API is running 🚀"));

// // Telegram delivers updates here when running in webhook mode.
// // IMPORTANT: grammy's default here is to THROW after 10s if bot.handleUpdate()
// // hasn't finished, which means Express never sends Telegram a 200 response.
// // Telegram then redelivers the same update later — and the bot answers the
// // same message twice. Voice messages in particular (download + transcription +
// // chat completion + TTS + upload) routinely take longer than 10s, especially
// // on a cold Render instance. Instead, we ack quickly and let processing
// // continue in the background; the actual reply still goes out via the Bot API
// // regardless of what this HTTP response contains.
// if (PUBLIC_URL) {
//   app.use(
//     WEBHOOK_PATH,
//     webhookCallback(bot, "express", {
//       timeoutMilliseconds: 8_000,
//       onTimeout: () => {
//         console.log("Webhook ack sent early — update is still processing in the background.");
//       },
//       secretToken: WEBHOOK_SECRET,
//     })
//   );
// }

// // ── Telegram Mini App authentication ────────────────────────────────────────────
// // Verifies the initData string every Telegram Mini App receives from
// // window.Telegram.WebApp.initData, per Telegram's official algorithm:
// // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// // This is what actually proves a request came from a real, currently-logged-in
// // Telegram session for a given user — a plain ?userId= query param, as this
// // API used before, proves nothing and can be set to anyone's ID.
// function verifyTelegramInitData(initData, botToken) {
//   const params = new URLSearchParams(initData);
//   const hash = params.get("hash");
//   if (!hash) return null;
//   params.delete("hash");

//   const dataCheckString = [...params.entries()]
//     .map(([key, value]) => `${key}=${value}`)
//     .sort()
//     .join("\n");

//   const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
//   const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

//   // Constant-time comparison to avoid leaking timing information about the hash
//   const hashBuf = Buffer.from(hash, "hex");
//   const computedBuf = Buffer.from(computedHash, "hex");
//   if (hashBuf.length !== computedBuf.length || !crypto.timingSafeEqual(hashBuf, computedBuf)) {
//     return null;
//   }

//   // Reject stale sessions (older than 24h) to limit how long a captured
//   // initData string would remain usable if it ever leaked.
//   const authDate = Number(params.get("auth_date"));
//   if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

//   const userJson = params.get("user");
//   if (!userJson) return null;
//   try {
//     return JSON.parse(userJson); // { id, first_name, username, ... }
//   } catch {
//     return null;
//   }
// }

// function requireTelegramAuth(req, res, next) {
//   const authHeader = req.headers["authorization"] || "";
//   const initData = authHeader.startsWith("tma ") ? authHeader.slice(4) : null;

//   if (!initData) {
//     return res.status(401).json({ error: "Missing Telegram authentication" });
//   }

//   const user = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
//   if (!user?.id) {
//     return res.status(401).json({ error: "Invalid or expired Telegram authentication" });
//   }

//   req.telegramUser = user;
//   next();
// }

// app.get("/api/flashcards", requireTelegramAuth, async (req, res) => {
//   const user = await getUser(req.telegramUser.id);
//   if (!user?.language) {
//     return res.json({ cards: [], language: null });
//   }
//   const cards = await getFlashcardsByLanguage(req.telegramUser.id, user.language);
//   res.json({ cards, language: user.language });
// });

// app.post("/api/flashcards/:id/review", requireTelegramAuth, async (req, res) => {
//   const { id } = req.params;
//   const { remembered } = req.body;
//   const updated = await updateFlashcard(Number(id), remembered, req.telegramUser.id);
//   if (!updated) {
//     return res.status(404).json({ error: "Flashcard not found" });
//   }
//   res.json({ ok: true });
// });

// // Quiz mode: the server — not the client — decides whether the submitted
// // answer was correct. Grading is now AI-powered semantic comparison
// // (checkSemanticAnswer, via Groq) instead of character-level string/edit-
// // distance comparison, so paraphrases and synonyms are accepted and a
// // same-spelling-but-wrong-meaning answer is rejected. This stops a client
// // from just claiming { correct: true } to instantly master (and delete) any
// // card. 3 correct answers in a row masters the word.
// app.post("/api/flashcards/:id/quiz", requireTelegramAuth, async (req, res) => {
//   const { id } = req.params;
//   const { answer } = req.body;
//   if (typeof answer !== "string") {
//     return res.status(400).json({ error: "Missing answer" });
//   }

//   const card = await getFlashcardById(Number(id), req.telegramUser.id);
//   if (!card) {
//     return res.status(404).json({ error: "Flashcard not found" });
//   }

//   const correct = await checkSemanticAnswer(card.word, answer, card.correction);
//   const result = await recordQuizResult(Number(id), req.telegramUser.id, correct);
//   res.json({ correct, correctAnswer: card.correction, ...result });
// });

// const PORT = process.env.PORT || 3000;

// // ── /start ────────────────────────────────────────────────────────────────────

// bot.command("start", async (ctx) => {
//   const userId = ctx.from.id;
//   await upsertUser(userId, { state: "choosing_language" });
//   await clearHistory(userId);

//   const kb = new InlineKeyboard();
//   const langs = Object.entries(LANGUAGES);
//   for (let i = 0; i < langs.length; i += 2) {
//     const row = langs.slice(i, i + 2);
//     kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `lang_${key}` })));
//   }

//   await ctx.reply(
//     "👋 Welcome to *Language Immersion Coach*!\n\n" +
//     "I'll chat with you in your target language, correct your mistakes in real-time, " +
//     "and save words you struggle with as flashcards.\n\n" +
//     "🌍 *Choose the language you want to learn:*",
//     { parse_mode: "Markdown", reply_markup: kb }
//   );
// });

// // ── Language selection ────────────────────────────────────────────────────────

// bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
//   const language = ctx.match[1];
//   const userId = ctx.from.id;

//   await upsertUser(userId, { language, state: "choosing_level" });

//   const kb = new InlineKeyboard()
//     .text("🌱 Beginner (A1-A2)", "level_Beginner")
//     .row()
//     .text("🌿 Intermediate (B1-B2)", "level_Intermediate")
//     .row()
//     .text("🌳 Advanced (C1-C2)", "level_Advanced");

//   await ctx.editMessageText(
//     `Great! You chose *${LANGUAGES[language]}* 🎉\n\n📊 Now select your current level:`,
//     { parse_mode: "Markdown", reply_markup: kb }
//   );
// });

// // ── Level selection ───────────────────────────────────────────────────────────

// bot.callbackQuery(/^level_(.+)$/, async (ctx) => {
//   const level = ctx.match[1];
//   const userId = ctx.from.id;
//   const user = await getUser(userId);

//   await upsertUser(userId, { level, state: "chatting" });

//   await ctx.editMessageText(
//     `Perfect! Let's start your *${LANGUAGES[user.language]}* immersion at *${level}* level! 🚀\n\n` +
//     `I'll chat with you entirely in ${LANGUAGES[user.language]}. ` +
//     `I'll gently correct any mistakes and save tricky words as flashcards.\n\n` +
//     `💬 Say anything to begin — or just say hello!\n` +
//     `🎙 Send a voice message and I'll reply with voice too!`,
//     { parse_mode: "Markdown" }
//   );
// });

// // ── /flashcards ───────────────────────────────────────────────────────────────

// bot.command("flashcards", async (ctx) => {
//   const userId = ctx.from.id;
//   const user = await getUser(userId);
//   const cards = await getFlashcardsByLanguage(userId, user?.language);

//   if (!cards.length) {
//     await ctx.reply("📭 No flashcards yet! Keep chatting and I'll save words you struggle with.");
//     return;
//   }

//   const due = await getDueFlashcards(userId);

//   const kb = new InlineKeyboard().webApp(
//     `📚 Open Flashcards (${due.length} due)`,
//     `${MINIAPP_URL}?userId=${userId}`
//   );

//   await ctx.reply(
//     `🗂 You have *${cards.length}* flashcards saved.\n` +
//     `⏰ *${due.length}* are due for review now.\n\n` +
//     `Tap below to open your flashcard deck:`,
//     { parse_mode: "Markdown", reply_markup: kb }
//   );
// });

// // ── /reset ────────────────────────────────────────────────────────────────────

// bot.command("reset", async (ctx) => {
//   const userId = ctx.from.id;
//   await upsertUser(userId, { language: null, level: null, state: "idle" });
//   await clearHistory(userId);
//   await ctx.reply("🔄 Session reset. Send /start to choose a new language.");
// });

// // ── /help ─────────────────────────────────────────────────────────────────────

// bot.command("help", async (ctx) => {
//   await ctx.reply(
//     "🤖 *Language Immersion Coach*\n\n" +
//     "Commands:\n" +
//     "  /start — choose language & level\n" +
//     "  /flashcards — open your saved words\n" +
//     "  /roadmap — see your latest progress update\n" +
//     "  /reset — start over with a new language\n" +
//     "  /upgrade — unlimited daily messages with Premium\n\n" +
//     "💬 Type or send a voice message to practice!\n" +
//     "🎙 Send voice → get voice reply\n" +
//     "⌨️ Send text → get text reply\n" +
//     "I'll correct you gently and save tricky words automatically.",
//     { parse_mode: "Markdown" }
//   );
// });

// // ── /roadmap ──────────────────────────────────────────────────────────────────
// // Re-shows the last saved progress update (generated every 5th message) —
// // reads from Supabase directly, no extra Groq call.

// bot.command("roadmap", async (ctx) => {
//   const progress = await getRoadmap(ctx.from.id);
//   if (!progress?.roadmap) {
//     await ctx.reply("No progress update yet — keep chatting! One is generated every 5 messages.");
//     return;
//   }
//   await ctx.reply(progress.roadmap);
// });

// // ── /upgrade — Telegram Stars payment ──────────────────────────────────────────
// // Telegram Stars ("XTR") needs no external payment processor account — no
// // Stripe keys, no bank/merchant country restrictions, no provider_token.
// // Telegram itself collects the payment and settles it to your Stars balance.

// bot.command("upgrade", async (ctx) => {
//   await ctx.replyWithInvoice(
//     "Language Coach Premium",
//     `Unlimited daily messages for ${PREMIUM_DURATION_DAYS} days (currently capped at ${FREE_DAILY_LIMIT}/day on the free plan).`,
//     "premium_upgrade", // internal payload, not shown to the user
//     "XTR",
//     [{ label: `Premium (${PREMIUM_DURATION_DAYS} days)`, amount: PREMIUM_PRICE_STARS }]
//   );
// });

// // Telegram requires an answer within 10 seconds of a pre-checkout query.
// bot.on("pre_checkout_query", async (ctx) => {
//   await ctx.answerPreCheckoutQuery(true);
// });

// // Fires once Telegram confirms the Stars payment went through.
// bot.on("message:successful_payment", async (ctx) => {
//   await grantPremium(ctx.from.id, PREMIUM_DURATION_DAYS);
//   await ctx.reply(
//     `✅ Premium activated! Unlimited messages for the next ${PREMIUM_DURATION_DAYS} days. Thank you for supporting the bot! 🎉`
//   );
// });

// // Returns true if the user may proceed; otherwise sends an upgrade prompt and
// // returns false. Called before any Groq/TTS work so a blocked user doesn't
// // burn API calls or eat into the webhook's ack window for nothing.
// async function enforceUsageLimit(ctx, userId) {
//   const usage = await checkAndIncrementUsage(userId, FREE_DAILY_LIMIT);
//   if (usage.allowed) return true;

//   await ctx.reply(
//     `⏳ You've used all ${usage.limit} free messages today.\n\n` +
//     `Send /upgrade for unlimited daily practice with Premium.`
//   );
//   return false;
// }

// // ── Voice messages ────────────────────────────────────────────────────────────

// bot.on("message:voice", async (ctx) => {
//   const userId = ctx.from.id;
//   const user = await getUser(userId);

//   if (!user || user.state !== "chatting") {
//     await ctx.reply("Please /start first to choose your language.");
//     return;
//   }

//   if (!(await enforceUsageLimit(ctx, userId))) return;

//   const thinking = await ctx.reply("🎙 Transcribing your voice...");

//   try {
//     // Download and transcribe voice
//     const file = await ctx.getFile();
//     const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

//     let buffer;
//     try {
//       const res = await fetch(fileUrl);
//       if (!res.ok) throw new Error(`status ${res.status}`);
//       buffer = Buffer.from(await res.arrayBuffer());
//     } catch (downloadErr) {
//       // Never let the token-bearing URL reach a log or thrown message
//       throw new Error(`Failed to download voice file (${file.file_path}): ${downloadErr.message}`);
//     }

//     const transcribed = await transcribeAudio(buffer, "voice.ogg");

//     await ctx.api.editMessageText(
//       ctx.chat.id, thinking.message_id,
//       `🎙 *You said:* "${transcribed}"\n\n⏳ Thinking...`,
//       { parse_mode: "Markdown" }
//     );

//     // Get AI response
//     const history = await getHistory(userId);
//     const { correction, reply } = await chat(
//       userId, transcribed, history,
//       LANGUAGES[user.language], user.level, user.language
//     );

//     // Send text correction first
//     await ctx.api.editMessageText(
//       ctx.chat.id, thinking.message_id,
//       `🎙 *You said:* "${transcribed}"\n\n${correction}`,
//       { parse_mode: "Markdown" }
//     );

//     // Generate and send voice reply
//     const audioPath = await textToSpeech(reply, user.language);
//     if (audioPath) {
//       await ctx.replyWithVoice(new InputFile(audioPath));
//       await cleanupFile(audioPath);
//     } else {
//       // Fallback to text if TTS fails
//       await ctx.reply(reply);
//     }

//     // Every 5th message, a background progress update is generated — sent
//     // as its own silent text message rather than spoken, so it doesn't
//     // bloat the conversational voice reply.
//     const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
//     if (roadmap) {
//       await ctx.reply(roadmap);
//     }

//   } catch (err) {
//     const redact = (s) => String(s ?? "").replaceAll(process.env.BOT_TOKEN, "[REDACTED]");
//     console.error("Voice error:", {
//       name: err?.name,
//       status: err?.status ?? err?.response?.status,
//       message: redact(err?.message || err),
//       stack: redact(err?.stack),
//     });
//     await ctx.api.editMessageText(
//       ctx.chat.id, thinking.message_id,
//       "❌ Couldn't process voice. Please try again or type instead."
//     );
//   }
// });

// // ── Text messages ─────────────────────────────────────────────────────────────

// bot.on("message:text", async (ctx) => {
//   const userId = ctx.from.id;
//   const user = await getUser(userId);

//   if (!user || user.state !== "chatting") {
//     await ctx.reply("👋 Send /start to begin your language practice!");
//     return;
//   }

//   if (!(await enforceUsageLimit(ctx, userId))) return;

//   const thinking = await ctx.reply("⏳ Thinking...");

//   try {
//     const history = await getHistory(userId);
//     const { correction, reply } = await chat(
//       userId, ctx.message.text, history,
//       LANGUAGES[user.language], user.level, user.language
//     );

//     await ctx.api.editMessageText(
//       ctx.chat.id, thinking.message_id,
//       `${correction}\n\n${reply}`,
//       { parse_mode: "Markdown" }
//     );

//     const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
//     if (roadmap) {
//       await ctx.reply(roadmap);
//     }

//   } catch (err) {
//     console.error("Chat error:", err);
//     await ctx.api.editMessageText(
//       ctx.chat.id, thinking.message_id,
//       "❌ Something went wrong. Please try again."
//     );
//   }
// });

// // ── Daily reminder ────────────────────────────────────────────────────────────

// async function sendDailyReminders() {
//   try {
//     const pool = (await import("./db.js")).default;
//     const result = await pool.query("SELECT user_id FROM users WHERE state = 'chatting'");
//     for (const { user_id } of result.rows) {
//       try {
//         const due = await getDueFlashcards(user_id);
//         if (due.length >= 3) {
//           const kb = new InlineKeyboard().webApp(
//             `📚 Review ${due.length} cards`,
//             `${MINIAPP_URL}?userId=${user_id}`
//           );
//           await bot.api.sendMessage(
//             user_id,
//             `⏰ *Time to review your flashcards!*\n\nYou have *${due.length}* words due for practice.`,
//             { parse_mode: "Markdown", reply_markup: kb }
//           );
//         }
//       } catch (userErr) {
//         console.error(`Reminder failed for user ${user_id}:`, userErr.message);
//         // Continue to the next user instead of aborting the whole batch
//       }
//     }
//   } catch (err) {
//     console.error("Reminder error:", err);
//   }
// }

// setInterval(sendDailyReminders, 60 * 60 * 1000);

// // ── Launch ────────────────────────────────────────────────────────────────────

// initDB().then(async () => {
//   app.listen(PORT, () => console.log(`API running on port ${PORT}`));

//   if (PUBLIC_URL) {
//     // Webhook mode: Telegram pushes updates to us, so there's no polling
//     // process that can conflict with another instance (the 409 error this
//     // replaces). Safe across Render redeploys where the old instance
//     // may still be shutting down.
//     try {
//       await bot.api.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
//         secret_token: WEBHOOK_SECRET,
//         drop_pending_updates: true,
//       });
//       console.log(`✅ Language Coach Bot is running (webhook: ${PUBLIC_URL}${WEBHOOK_PATH})`);
//     } catch (err) {
//       console.error("Failed to set webhook, falling back to polling:", err.message);
//       startPolling();
//     }
//   } else {
//     console.warn("No PUBLIC_URL/RENDER_EXTERNAL_URL set — using long polling instead.");
//     startPolling();
//   }
// }).catch((err) => {
//   console.error("Startup error:", err);
//   process.exit(1);
// });

// function startPolling() {
//   // Fire-and-forget on purpose: bot.start() only resolves when polling stops.
//   // A rejection here (e.g. another instance already polling — the original
//   // 409 conflict) must not crash the process, since the Express API above
//   // should keep serving /api/flashcards regardless.
//   bot.start({
//     drop_pending_updates: true,
//     onStart: () => console.log("✅ Language Coach Bot is running (polling)!"),
//   }).catch((err) => {
//     console.error("Polling failed to start:", err.message);
//     console.error("If this is a 409 conflict, another instance of this bot is already running elsewhere.");
//   });
// }

// bot.catch((err) => {
//   const ctx = err.ctx;
//   console.error("Bot error:", err.error);
// });


// // // index.js
// // import "dotenv/config";
// // import { Bot, InlineKeyboard, InputFile, webhookCallback } from "grammy";
// // import fetch from "node-fetch";
// // import {
// //   initDB, getUser, upsertUser, getHistory, clearHistory,
// //   getDueFlashcards, getFlashcardsByLanguage, getFlashcardById, updateFlashcard, recordQuizResult,
// //   checkAndIncrementUsage, grantPremium, getRoadmap
// // } from "./db.js";
// // import { chat, transcribeAudio, textToSpeech, cleanupFile, LANGUAGES, maybeGenerateRoadmap } from "./ai.js";

// // import express from "express";
// // import cors from "cors";
// // import crypto from "crypto";

// // const bot = new Bot(process.env.BOT_TOKEN);
// // const MINIAPP_URL = process.env.MINIAPP_URL;

// // // Free-tier daily message cap and Premium pricing. All configurable via env
// // // vars so you can tune them without a code change.
// // const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "100", 10);
// // const PREMIUM_PRICE_STARS = parseInt(process.env.PREMIUM_PRICE_STARS || "150", 10);
// // const PREMIUM_DURATION_DAYS = parseInt(process.env.PREMIUM_DURATION_DAYS || "30", 10);

// // // Webhook mode config. Render sets RENDER_EXTERNAL_URL automatically; you can also
// // // set PUBLIC_URL manually for other hosts. If neither is set, we fall back to polling.
// // const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
// // const WEBHOOK_PATH = "/telegram/webhook";
// // const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional, but recommended

// // // Allow the deployed Mini App origin, plus any extra origins from ALLOWED_ORIGINS
// // // (comma-separated), e.g. for local dev: ALLOWED_ORIGINS=http://localhost:5173
// // const allowedOrigins = [
// //   MINIAPP_URL,
// //   ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
// // ].filter(Boolean);

// // const app = express();
// // app.use(cors({
// //   origin: (origin, callback) => {
// //     // Allow non-browser requests (no Origin header, e.g. curl/server-to-server)
// //     if (!origin) return callback(null, true);
// //     if (allowedOrigins.includes(origin)) return callback(null, true);
// //     return callback(new Error(`Origin ${origin} not allowed by CORS`));
// //   },
// // }));
// // app.use(express.json());

// // app.get("/", (req, res) => res.send("Bot API is running 🚀"));

// // // Telegram delivers updates here when running in webhook mode.
// // // IMPORTANT: grammy's default here is to THROW after 10s if bot.handleUpdate()
// // // hasn't finished, which means Express never sends Telegram a 200 response.
// // // Telegram then redelivers the same update later — and the bot answers the
// // // same message twice. Voice messages in particular (download + transcription +
// // // chat completion + TTS + upload) routinely take longer than 10s, especially
// // // on a cold Render instance. Instead, we ack quickly and let processing
// // // continue in the background; the actual reply still goes out via the Bot API
// // // regardless of what this HTTP response contains.
// // if (PUBLIC_URL) {
// //   app.use(
// //     WEBHOOK_PATH,
// //     webhookCallback(bot, "express", {
// //       timeoutMilliseconds: 8_000,
// //       onTimeout: () => {
// //         console.log("Webhook ack sent early — update is still processing in the background.");
// //       },
// //       secretToken: WEBHOOK_SECRET,
// //     })
// //   );
// // }

// // // ── Telegram Mini App authentication ────────────────────────────────────────────
// // // Verifies the initData string every Telegram Mini App receives from
// // // window.Telegram.WebApp.initData, per Telegram's official algorithm:
// // // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// // // This is what actually proves a request came from a real, currently-logged-in
// // // Telegram session for a given user — a plain ?userId= query param, as this
// // // API used before, proves nothing and can be set to anyone's ID.
// // function verifyTelegramInitData(initData, botToken) {
// //   const params = new URLSearchParams(initData);
// //   const hash = params.get("hash");
// //   if (!hash) return null;
// //   params.delete("hash");

// //   const dataCheckString = [...params.entries()]
// //     .map(([key, value]) => `${key}=${value}`)
// //     .sort()
// //     .join("\n");

// //   const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
// //   const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

// //   // Constant-time comparison to avoid leaking timing information about the hash
// //   const hashBuf = Buffer.from(hash, "hex");
// //   const computedBuf = Buffer.from(computedHash, "hex");
// //   if (hashBuf.length !== computedBuf.length || !crypto.timingSafeEqual(hashBuf, computedBuf)) {
// //     return null;
// //   }

// //   // Reject stale sessions (older than 24h) to limit how long a captured
// //   // initData string would remain usable if it ever leaked.
// //   const authDate = Number(params.get("auth_date"));
// //   if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

// //   const userJson = params.get("user");
// //   if (!userJson) return null;
// //   try {
// //     return JSON.parse(userJson); // { id, first_name, username, ... }
// //   } catch {
// //     return null;
// //   }
// // }

// // function requireTelegramAuth(req, res, next) {
// //   const authHeader = req.headers["authorization"] || "";
// //   const initData = authHeader.startsWith("tma ") ? authHeader.slice(4) : null;

// //   if (!initData) {
// //     return res.status(401).json({ error: "Missing Telegram authentication" });
// //   }

// //   const user = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
// //   if (!user?.id) {
// //     return res.status(401).json({ error: "Invalid or expired Telegram authentication" });
// //   }

// //   req.telegramUser = user;
// //   next();
// // }

// // app.get("/api/flashcards", requireTelegramAuth, async (req, res) => {
// //   const user = await getUser(req.telegramUser.id);
// //   if (!user?.language) {
// //     return res.json({ cards: [], language: null });
// //   }
// //   const cards = await getFlashcardsByLanguage(req.telegramUser.id, user.language);
// //   res.json({ cards, language: user.language });
// // });

// // app.post("/api/flashcards/:id/review", requireTelegramAuth, async (req, res) => {
// //   const { id } = req.params;
// //   const { remembered } = req.body;
// //   const updated = await updateFlashcard(Number(id), remembered, req.telegramUser.id);
// //   if (!updated) {
// //     return res.status(404).json({ error: "Flashcard not found" });
// //   }
// //   res.json({ ok: true });
// // });

// // // Strips punctuation/parenthetical notes and collapses whitespace so minor
// // // formatting differences don't count against the user.
// // function normalizeAnswer(str) {
// //   return String(str || "")
// //     .toLowerCase()
// //     .replace(/\([^)]*\)/g, "") // drop "(not ...)"-style notes
// //     .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation, unicode-aware
// //     .replace(/\s+/g, " ")
// //     .trim();
// // }

// // function levenshtein(a, b) {
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

// // // Used for both typed answers (needs typo tolerance) and multiple-choice
// // // (the submitted text is one of the shown options verbatim, so this reduces
// // // to an exact match after normalization).
// // function isCorrectAnswer(submitted, correctAnswer) {
// //   const a = normalizeAnswer(submitted);
// //   const b = normalizeAnswer(correctAnswer);
// //   if (!a || !b) return false;
// //   if (a === b) return true;
// //   const tolerance = Math.min(3, Math.max(1, Math.floor(b.length / 6)));
// //   return levenshtein(a, b) <= tolerance;
// // }

// // // Quiz mode: the server — not the client — decides whether the submitted
// // // answer was correct, by comparing it against the stored correction. This
// // // stops a client from just claiming { correct: true } to instantly master
// // // (and delete) any card. 3 correct answers in a row masters the word.
// // app.post("/api/flashcards/:id/quiz", requireTelegramAuth, async (req, res) => {
// //   const { id } = req.params;
// //   const { answer } = req.body;
// //   if (typeof answer !== "string") {
// //     return res.status(400).json({ error: "Missing answer" });
// //   }

// //   const card = await getFlashcardById(Number(id), req.telegramUser.id);
// //   if (!card) {
// //     return res.status(404).json({ error: "Flashcard not found" });
// //   }

// //   const correct = isCorrectAnswer(answer, card.correction);
// //   const result = await recordQuizResult(Number(id), req.telegramUser.id, correct);
// //   res.json({ correct, correctAnswer: card.correction, ...result });
// // });

// // const PORT = process.env.PORT || 3000;

// // // ── /start ────────────────────────────────────────────────────────────────────

// // bot.command("start", async (ctx) => {
// //   const userId = ctx.from.id;
// //   await upsertUser(userId, { state: "choosing_language" });
// //   await clearHistory(userId);

// //   const kb = new InlineKeyboard();
// //   const langs = Object.entries(LANGUAGES);
// //   for (let i = 0; i < langs.length; i += 2) {
// //     const row = langs.slice(i, i + 2);
// //     kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `lang_${key}` })));
// //   }

// //   await ctx.reply(
// //     "👋 Welcome to *Language Immersion Coach*!\n\n" +
// //     "I'll chat with you in your target language, correct your mistakes in real-time, " +
// //     "and save words you struggle with as flashcards.\n\n" +
// //     "🌍 *Choose the language you want to learn:*",
// //     { parse_mode: "Markdown", reply_markup: kb }
// //   );
// // });

// // // ── Language selection ────────────────────────────────────────────────────────

// // bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
// //   const language = ctx.match[1];
// //   const userId = ctx.from.id;

// //   await upsertUser(userId, { language, state: "choosing_level" });

// //   const kb = new InlineKeyboard()
// //     .text("🌱 Beginner (A1-A2)", "level_Beginner")
// //     .row()
// //     .text("🌿 Intermediate (B1-B2)", "level_Intermediate")
// //     .row()
// //     .text("🌳 Advanced (C1-C2)", "level_Advanced");

// //   await ctx.editMessageText(
// //     `Great! You chose *${LANGUAGES[language]}* 🎉\n\n📊 Now select your current level:`,
// //     { parse_mode: "Markdown", reply_markup: kb }
// //   );
// // });

// // // ── Level selection ───────────────────────────────────────────────────────────

// // bot.callbackQuery(/^level_(.+)$/, async (ctx) => {
// //   const level = ctx.match[1];
// //   const userId = ctx.from.id;
// //   const user = await getUser(userId);

// //   await upsertUser(userId, { level, state: "chatting" });

// //   await ctx.editMessageText(
// //     `Perfect! Let's start your *${LANGUAGES[user.language]}* immersion at *${level}* level! 🚀\n\n` +
// //     `I'll chat with you entirely in ${LANGUAGES[user.language]}. ` +
// //     `I'll gently correct any mistakes and save tricky words as flashcards.\n\n` +
// //     `💬 Say anything to begin — or just say hello!\n` +
// //     `🎙 Send a voice message and I'll reply with voice too!`,
// //     { parse_mode: "Markdown" }
// //   );
// // });

// // // ── /flashcards ───────────────────────────────────────────────────────────────

// // bot.command("flashcards", async (ctx) => {
// //   const userId = ctx.from.id;
// //   const user = await getUser(userId);
// //   const cards = await getFlashcardsByLanguage(userId, user?.language);

// //   if (!cards.length) {
// //     await ctx.reply("📭 No flashcards yet! Keep chatting and I'll save words you struggle with.");
// //     return;
// //   }

// //   const due = await getDueFlashcards(userId);

// //   const kb = new InlineKeyboard().webApp(
// //     `📚 Open Flashcards (${due.length} due)`,
// //     `${MINIAPP_URL}?userId=${userId}`
// //   );

// //   await ctx.reply(
// //     `🗂 You have *${cards.length}* flashcards saved.\n` +
// //     `⏰ *${due.length}* are due for review now.\n\n` +
// //     `Tap below to open your flashcard deck:`,
// //     { parse_mode: "Markdown", reply_markup: kb }
// //   );
// // });

// // // ── /reset ────────────────────────────────────────────────────────────────────

// // bot.command("reset", async (ctx) => {
// //   const userId = ctx.from.id;
// //   await upsertUser(userId, { language: null, level: null, state: "idle" });
// //   await clearHistory(userId);
// //   await ctx.reply("🔄 Session reset. Send /start to choose a new language.");
// // });

// // // ── /help ─────────────────────────────────────────────────────────────────────

// // bot.command("help", async (ctx) => {
// //   await ctx.reply(
// //     "🤖 *Language Immersion Coach*\n\n" +
// //     "Commands:\n" +
// //     "  /start — choose language & level\n" +
// //     "  /flashcards — open your saved words\n" +
// //     "  /roadmap — see your latest progress update\n" +
// //     "  /reset — start over with a new language\n" +
// //     "  /upgrade — unlimited daily messages with Premium\n\n" +
// //     "💬 Type or send a voice message to practice!\n" +
// //     "🎙 Send voice → get voice reply\n" +
// //     "⌨️ Send text → get text reply\n" +
// //     "I'll correct you gently and save tricky words automatically.",
// //     { parse_mode: "Markdown" }
// //   );
// // });

// // // ── /roadmap ──────────────────────────────────────────────────────────────────
// // // Re-shows the last saved progress update (generated every 5th message) —
// // // reads from Supabase directly, no extra Groq call.

// // bot.command("roadmap", async (ctx) => {
// //   const progress = await getRoadmap(ctx.from.id);
// //   if (!progress?.roadmap) {
// //     await ctx.reply("No progress update yet — keep chatting! One is generated every 5 messages.");
// //     return;
// //   }
// //   await ctx.reply(progress.roadmap);
// // });

// // // ── /upgrade — Telegram Stars payment ──────────────────────────────────────────
// // // Telegram Stars ("XTR") needs no external payment processor account — no
// // // Stripe keys, no bank/merchant country restrictions, no provider_token.
// // // Telegram itself collects the payment and settles it to your Stars balance.

// // bot.command("upgrade", async (ctx) => {
// //   await ctx.replyWithInvoice(
// //     "Language Coach Premium",
// //     `Unlimited daily messages for ${PREMIUM_DURATION_DAYS} days (currently capped at ${FREE_DAILY_LIMIT}/day on the free plan).`,
// //     "premium_upgrade", // internal payload, not shown to the user
// //     "XTR",
// //     [{ label: `Premium (${PREMIUM_DURATION_DAYS} days)`, amount: PREMIUM_PRICE_STARS }]
// //   );
// // });

// // // Telegram requires an answer within 10 seconds of a pre-checkout query.
// // bot.on("pre_checkout_query", async (ctx) => {
// //   await ctx.answerPreCheckoutQuery(true);
// // });

// // // Fires once Telegram confirms the Stars payment went through.
// // bot.on("message:successful_payment", async (ctx) => {
// //   await grantPremium(ctx.from.id, PREMIUM_DURATION_DAYS);
// //   await ctx.reply(
// //     `✅ Premium activated! Unlimited messages for the next ${PREMIUM_DURATION_DAYS} days. Thank you for supporting the bot! 🎉`
// //   );
// // });

// // // Returns true if the user may proceed; otherwise sends an upgrade prompt and
// // // returns false. Called before any Groq/TTS work so a blocked user doesn't
// // // burn API calls or eat into the webhook's ack window for nothing.
// // async function enforceUsageLimit(ctx, userId) {
// //   const usage = await checkAndIncrementUsage(userId, FREE_DAILY_LIMIT);
// //   if (usage.allowed) return true;

// //   await ctx.reply(
// //     `⏳ You've used all ${usage.limit} free messages today.\n\n` +
// //     `Send /upgrade for unlimited daily practice with Premium.`
// //   );
// //   return false;
// // }

// // // ── Voice messages ────────────────────────────────────────────────────────────

// // bot.on("message:voice", async (ctx) => {
// //   const userId = ctx.from.id;
// //   const user = await getUser(userId);

// //   if (!user || user.state !== "chatting") {
// //     await ctx.reply("Please /start first to choose your language.");
// //     return;
// //   }

// //   if (!(await enforceUsageLimit(ctx, userId))) return;

// //   const thinking = await ctx.reply("🎙 Transcribing your voice...");

// //   try {
// //     // Download and transcribe voice
// //     const file = await ctx.getFile();
// //     const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

// //     let buffer;
// //     try {
// //       const res = await fetch(fileUrl);
// //       if (!res.ok) throw new Error(`status ${res.status}`);
// //       buffer = Buffer.from(await res.arrayBuffer());
// //     } catch (downloadErr) {
// //       // Never let the token-bearing URL reach a log or thrown message
// //       throw new Error(`Failed to download voice file (${file.file_path}): ${downloadErr.message}`);
// //     }

// //     const transcribed = await transcribeAudio(buffer, "voice.ogg");

// //     await ctx.api.editMessageText(
// //       ctx.chat.id, thinking.message_id,
// //       `🎙 *You said:* "${transcribed}"\n\n⏳ Thinking...`,
// //       { parse_mode: "Markdown" }
// //     );

// //     // Get AI response
// //     const history = await getHistory(userId);
// //     const { correction, reply } = await chat(
// //       userId, transcribed, history,
// //       LANGUAGES[user.language], user.level, user.language
// //     );

// //     // Send text correction first
// //     await ctx.api.editMessageText(
// //       ctx.chat.id, thinking.message_id,
// //       `🎙 *You said:* "${transcribed}"\n\n${correction}`,
// //       { parse_mode: "Markdown" }
// //     );

// //     // Generate and send voice reply
// //     const audioPath = await textToSpeech(reply, user.language);
// //     if (audioPath) {
// //       await ctx.replyWithVoice(new InputFile(audioPath));
// //       await cleanupFile(audioPath);
// //     } else {
// //       // Fallback to text if TTS fails
// //       await ctx.reply(reply);
// //     }

// //     // Every 5th message, a background progress update is generated — sent
// //     // as its own silent text message rather than spoken, so it doesn't
// //     // bloat the conversational voice reply.
// //     const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
// //     if (roadmap) {
// //       await ctx.reply(roadmap);
// //     }

// //   } catch (err) {
// //     const redact = (s) => String(s ?? "").replaceAll(process.env.BOT_TOKEN, "[REDACTED]");
// //     console.error("Voice error:", {
// //       name: err?.name,
// //       status: err?.status ?? err?.response?.status,
// //       message: redact(err?.message || err),
// //       stack: redact(err?.stack),
// //     });
// //     await ctx.api.editMessageText(
// //       ctx.chat.id, thinking.message_id,
// //       "❌ Couldn't process voice. Please try again or type instead."
// //     );
// //   }
// // });

// // // ── Text messages ─────────────────────────────────────────────────────────────

// // bot.on("message:text", async (ctx) => {
// //   const userId = ctx.from.id;
// //   const user = await getUser(userId);

// //   if (!user || user.state !== "chatting") {
// //     await ctx.reply("👋 Send /start to begin your language practice!");
// //     return;
// //   }

// //   if (!(await enforceUsageLimit(ctx, userId))) return;

// //   const thinking = await ctx.reply("⏳ Thinking...");

// //   try {
// //     const history = await getHistory(userId);
// //     const { correction, reply } = await chat(
// //       userId, ctx.message.text, history,
// //       LANGUAGES[user.language], user.level, user.language
// //     );

// //     await ctx.api.editMessageText(
// //       ctx.chat.id, thinking.message_id,
// //       `${correction}\n\n${reply}`,
// //       { parse_mode: "Markdown" }
// //     );

// //     const roadmap = await maybeGenerateRoadmap(userId, LANGUAGES[user.language], user.level);
// //     if (roadmap) {
// //       await ctx.reply(roadmap);
// //     }

// //   } catch (err) {
// //     console.error("Chat error:", err);
// //     await ctx.api.editMessageText(
// //       ctx.chat.id, thinking.message_id,
// //       "❌ Something went wrong. Please try again."
// //     );
// //   }
// // });

// // // ── Daily reminder ────────────────────────────────────────────────────────────

// // async function sendDailyReminders() {
// //   try {
// //     const pool = (await import("./db.js")).default;
// //     const result = await pool.query("SELECT user_id FROM users WHERE state = 'chatting'");
// //     for (const { user_id } of result.rows) {
// //       try {
// //         const due = await getDueFlashcards(user_id);
// //         if (due.length >= 3) {
// //           const kb = new InlineKeyboard().webApp(
// //             `📚 Review ${due.length} cards`,
// //             `${MINIAPP_URL}?userId=${user_id}`
// //           );
// //           await bot.api.sendMessage(
// //             user_id,
// //             `⏰ *Time to review your flashcards!*\n\nYou have *${due.length}* words due for practice.`,
// //             { parse_mode: "Markdown", reply_markup: kb }
// //           );
// //         }
// //       } catch (userErr) {
// //         console.error(`Reminder failed for user ${user_id}:`, userErr.message);
// //         // Continue to the next user instead of aborting the whole batch
// //       }
// //     }
// //   } catch (err) {
// //     console.error("Reminder error:", err);
// //   }
// // }

// // setInterval(sendDailyReminders, 60 * 60 * 1000);

// // // ── Launch ────────────────────────────────────────────────────────────────────

// // initDB().then(async () => {
// //   app.listen(PORT, () => console.log(`API running on port ${PORT}`));

// //   if (PUBLIC_URL) {
// //     // Webhook mode: Telegram pushes updates to us, so there's no polling
// //     // process that can conflict with another instance (the 409 error this
// //     // replaces). Safe across Render redeploys where the old instance
// //     // may still be shutting down.
// //     try {
// //       await bot.api.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
// //         secret_token: WEBHOOK_SECRET,
// //         drop_pending_updates: true,
// //       });
// //       console.log(`✅ Language Coach Bot is running (webhook: ${PUBLIC_URL}${WEBHOOK_PATH})`);
// //     } catch (err) {
// //       console.error("Failed to set webhook, falling back to polling:", err.message);
// //       startPolling();
// //     }
// //   } else {
// //     console.warn("No PUBLIC_URL/RENDER_EXTERNAL_URL set — using long polling instead.");
// //     startPolling();
// //   }
// // }).catch((err) => {
// //   console.error("Startup error:", err);
// //   process.exit(1);
// // });

// // function startPolling() {
// //   // Fire-and-forget on purpose: bot.start() only resolves when polling stops.
// //   // A rejection here (e.g. another instance already polling — the original
// //   // 409 conflict) must not crash the process, since the Express API above
// //   // should keep serving /api/flashcards regardless.
// //   bot.start({
// //     drop_pending_updates: true,
// //     onStart: () => console.log("✅ Language Coach Bot is running (polling)!"),
// //   }).catch((err) => {
// //     console.error("Polling failed to start:", err.message);
// //     console.error("If this is a 409 conflict, another instance of this bot is already running elsewhere.");
// //   });
// // }

// // bot.catch((err) => {
// //   const ctx = err.ctx;
// //   console.error("Bot error:", err.error);
// // });