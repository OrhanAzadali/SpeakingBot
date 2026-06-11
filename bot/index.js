import "dotenv/config";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import fetch from "node-fetch";
import {
  getUser, upsertUser, getHistory, clearHistory,
  getDueFlashcards, getFlashcards
} from "./db.js";
import { chat, transcribeAudio, LANGUAGES } from "./ai.js";

import express from "express";
import cors from "cors";

const bot = new Bot(process.env.BOT_TOKEN);
const MINIAPP_URL = process.env.MINIAPP_URL;

const app = express();

app.use(cors({
  origin: "*"
}));
app.use(express.json());

app.get("/api/flashcards", (req, res) => {
  const userId = req.query.userId;
  const cards = getFlashcards(userId);
  res.json({ cards });
});

app.post("/api/flashcards/:id/review", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

// ── /start ────────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  upsertUser(userId, { state: "choosing_language" });
  clearHistory(userId);

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

  upsertUser(userId, { language, state: "choosing_level" });

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
  const user = getUser(userId);

  upsertUser(userId, { level, state: "chatting" });

  await ctx.editMessageText(
    `Perfect! Let's start your *${LANGUAGES[user.language]}* immersion at *${level}* level! 🚀\n\n` +
    `I'll chat with you entirely in ${LANGUAGES[user.language]}. ` +
    `I'll gently correct any mistakes and save tricky words as flashcards.\n\n` +
    `💬 Say anything to begin — or just say hello!`,
    { parse_mode: "Markdown" }
  );
});

// ── /flashcards ───────────────────────────────────────────────────────────────

bot.command("flashcards", async (ctx) => {
  const userId = ctx.from.id;
  const cards = getFlashcards(userId);

  if (!cards.length) {
    await ctx.reply("📭 No flashcards yet! Keep chatting and I'll save words you struggle with.");
    return;
  }

  const due = getDueFlashcards(userId);

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
  upsertUser(userId, { language: null, level: null, state: "idle" });
  clearHistory(userId);
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
    "💬 Just type or send a voice message to practice!\n" +
    "I'll correct you gently and save tricky words automatically.",
    { parse_mode: "Markdown" }
  );
});

// ── Voice messages ────────────────────────────────────────────────────────────

bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);

  if (!user || user.state !== "chatting") {
    await ctx.reply("Please /start first to choose your language.");
    return;
  }

  const thinking = await ctx.reply("🎙 Transcribing your voice...");

  try {
    // Download voice file
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Transcribe with Groq Whisper
    const transcribed = await transcribeAudio(buffer, "voice.ogg");

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n⏳ Thinking...`,
      { parse_mode: "Markdown" }
    );

    // Process as text
    const history = getHistory(userId);
    const { correction, reply } = await chat(
      userId, transcribed, history,
      LANGUAGES[user.language], user.level
    );

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n${correction}\n\n${reply}`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("Voice error:", err);
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      "❌ Couldn't process voice. Please try again or type instead."
    );
  }
});

// ── Text messages ─────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);

  if (!user || user.state !== "chatting") {
    await ctx.reply("👋 Send /start to begin your language practice!");
    return;
  }

  const thinking = await ctx.reply("⏳ Thinking...");

  try {
    const history = getHistory(userId);
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

// ── Daily flashcard reminder (runs every hour, checks due cards) ──────────────

async function sendDailyReminders() {
  // This is a simple polling approach — for production use a proper scheduler
  const { default: db } = await import("./db.js");
  const users = db.prepare("SELECT user_id FROM users WHERE state = 'chatting'").all();

  for (const { user_id } of users) {
    const due = getDueFlashcards(user_id);
    if (due.length >= 3) {
      try {
        const kb = new InlineKeyboard().webApp(
          `📚 Review ${due.length} cards`,
          `${MINIAPP_URL}?userId=${user_id}`
        );
        await bot.api.sendMessage(
          user_id,
          `⏰ *Time to review your flashcards!*\n\nYou have *${due.length}* words due for practice. Tap below to review them now!`,
          { parse_mode: "Markdown", reply_markup: kb }
        );
      } catch (_) { }
    }
  }
}

setInterval(sendDailyReminders, 60 * 60 * 1000); // every hour

// ── Launch ────────────────────────────────────────────────────────────────────

bot.start();
console.log("✅ Language Coach Bot is running!");
