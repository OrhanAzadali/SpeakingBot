// index.js
import "dotenv/config";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import fetch from "node-fetch";
import {
  initDB, getUser, upsertUser, getHistory, clearHistory,
  getDueFlashcards, getFlashcards, updateFlashcard
} from "./db.js";
import { chat, transcribeAudio, textToSpeech, cleanupFile, LANGUAGES } from "./ai.js";

import express from "express";
import cors from "cors";

const bot = new Bot(process.env.BOT_TOKEN);
const MINIAPP_URL = process.env.MINIAPP_URL;

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

app.get("/api/flashcards", async (req, res) => {
  const userId = req.query.userId;
  const cards = await getFlashcards(userId);
  res.json({ cards });
});

app.post("/api/flashcards/:id/review", async (req, res) => {
  const { id } = req.params;
  const { remembered } = req.body;
  await updateFlashcard(Number(id), remembered);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

// ── /start ────────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { state: "choosing_language" });
  await clearHistory(userId);

  const kb = new InlineKeyboard();
  const langs = Object.entries(LANGUAGES);
  for (let i = 0; i < langs.length; i += 2) {
    const row = langs.slice(i, i + 2);
    kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `lang_${key}` })));
  }

  await ctx.reply(
    "👋 Welcome to *Language Immersion Coach*!\n\n" +
    "I'll chat with you in your target language, correct your mistakes in real-time, " +
    "and save words you struggle with as flashcards.\n\n" +
    "🌍 *Choose the language you want to learn:*",
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// ── Language selection ────────────────────────────────────────────────────────

bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  const language = ctx.match[1];
  const userId = ctx.from.id;

  await upsertUser(userId, { language, state: "choosing_level" });

  const kb = new InlineKeyboard()
    .text("🌱 Beginner (A1-A2)", "level_Beginner")
    .row()
    .text("🌿 Intermediate (B1-B2)", "level_Intermediate")
    .row()
    .text("🌳 Advanced (C1-C2)", "level_Advanced");

  await ctx.editMessageText(
    `Great! You chose *${LANGUAGES[language]}* 🎉\n\n📊 Now select your current level:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

// ── Level selection ───────────────────────────────────────────────────────────

bot.callbackQuery(/^level_(.+)$/, async (ctx) => {
  const level = ctx.match[1];
  const userId = ctx.from.id;
  const user = await getUser(userId);

  await upsertUser(userId, { level, state: "chatting" });

  await ctx.editMessageText(
    `Perfect! Let's start your *${LANGUAGES[user.language]}* immersion at *${level}* level! 🚀\n\n` +
    `I'll chat with you entirely in ${LANGUAGES[user.language]}. ` +
    `I'll gently correct any mistakes and save tricky words as flashcards.\n\n` +
    `💬 Say anything to begin — or just say hello!\n` +
    `🎙 Send a voice message and I'll reply with voice too!`,
    { parse_mode: "Markdown" }
  );
});

// ── /flashcards ───────────────────────────────────────────────────────────────

bot.command("flashcards", async (ctx) => {
  const userId = ctx.from.id;
  const cards = await getFlashcards(userId);

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

// ── /reset ────────────────────────────────────────────────────────────────────

bot.command("reset", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { language: null, level: null, state: "idle" });
  await clearHistory(userId);
  await ctx.reply("🔄 Session reset. Send /start to choose a new language.");
});

// ── /help ─────────────────────────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  await ctx.reply(
    "🤖 *Language Immersion Coach*\n\n" +
    "Commands:\n" +
    "  /start — choose language & level\n" +
    "  /flashcards — open your saved words\n" +
    "  /reset — start over with a new language\n\n" +
    "💬 Type or send a voice message to practice!\n" +
    "🎙 Send voice → get voice reply\n" +
    "⌨️ Send text → get text reply\n" +
    "I'll correct you gently and save tricky words automatically.",
    { parse_mode: "Markdown" }
  );
});

// ── Voice messages ────────────────────────────────────────────────────────────

bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user || user.state !== "chatting") {
    await ctx.reply("Please /start first to choose your language.");
    return;
  }

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
      LANGUAGES[user.language], user.level
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

  } catch (err) {
    const safeMessage = String(err?.message || err).replaceAll(process.env.BOT_TOKEN, "[REDACTED]");
    console.error("Voice error:", safeMessage);
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

  if (!user || user.state !== "chatting") {
    await ctx.reply("👋 Send /start to begin your language practice!");
    return;
  }

  const thinking = await ctx.reply("⏳ Thinking...");

  try {
    const history = await getHistory(userId);
    const { correction, reply } = await chat(
      userId, ctx.message.text, history,
      LANGUAGES[user.language], user.level
    );

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `${correction}\n\n${reply}`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("Chat error:", err);
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      "❌ Something went wrong. Please try again."
    );
  }
});

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

initDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  bot.start({
    drop_pending_updates: true,
    onStart: () => console.log("✅ Language Coach Bot is running!"),
  });

}).catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error("Bot error:", err.error);
});