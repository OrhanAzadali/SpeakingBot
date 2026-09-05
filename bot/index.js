// index.js — Main bot server with un-truncated answers, dedicated Grammar PDF generation & full API
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
  checkAndIncrementUsage, grantPremium, getRoadmap, getAllUserVocabulary, addFlashcard,
  saveActiveTest, getActiveTest, recordActiveTestAnswer, clearActiveTest, saveTestResult, getUserTestHistory,
  saveActiveDrill, getActiveDrill, recordDrillAnswer, clearActiveDrill, completeDrillSession, getUserSkillsOverview,
  saveGrammarTopic, getGrammarTopics, getGrammarTopicById, getLatestGrammarTopic, getAllUserGrammar, deleteGrammarTopic
} from "./db.js";
import {
  chat, transcribeAudio, textToSpeech, cleanupFile, LANGUAGES,
  maybeGenerateRoadmap, generateRoadmap, cleanRoadmapText, checkSemanticAnswer, generateLevelTest, evaluateLevelTest,
  generateSkillDrill, evaluateSkillAnswer, generateGrammarGuide
} from "./ai.js";

const bot = new Bot(process.env.BOT_TOKEN);
const MINIAPP_URL = process.env.MINIAPP_URL;

// Free-tier daily message cap and Premium pricing.
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "150", 10);
const PREMIUM_PRICE_STARS = parseInt(process.env.PREMIUM_PRICE_STARS || "150", 10);
const PREMIUM_DURATION_DAYS = parseInt(process.env.PREMIUM_DURATION_DAYS || "30", 10);

const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
const WEBHOOK_PATH = "/telegram/webhook";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const allowedOrigins = [
  MINIAPP_URL,
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
].filter(Boolean);

const app = express();
// ── Drill Question Presenter ──────────────────────────────────────────────────
async function presentNextDrillQuestion(ctx, userId, question, index, total, skill, languageKey) {
  const header = `🎯 ${skill.toUpperCase()} DRILL [${index + 1}/${total}]\n\n`;

  if (skill === "listening" && question.audio_script) {
    try {
      const audioPath = await textToSpeech(question.audio_script, languageKey);
      if (audioPath) {
        await bot.api.sendVoice(userId, new InputFile(audioPath), {
          caption: `🎧 Voice passage for Question ${index + 1}. Listen carefully!`,
        });
        await cleanupFile(audioPath);
      }
    } catch (e) {
      console.warn("TTS drill audio error:", e.message);
    }
  }

  let passageText = "";
  if (skill === "reading" && question.reading_passage) {
    passageText = `📖 Passage:\n"${question.reading_passage}"\n\n`;
  }

  const cleanPrompt = String(question.prompt || "").replace(/_____/g, "[ ... ]");

  if (question.type === "choice" && Array.isArray(question.options)) {
    const kb = new InlineKeyboard();
    question.options.forEach((opt, optIdx) => {
      kb.text(opt, `drillopt_${index}_${optIdx}`).row();
    });

    const body = `${header}${passageText}${cleanPrompt}\n\n👉 Select your answer:`;
    await bot.api.sendMessage(userId, body, { reply_markup: kb });
  } else if (skill === "speaking") {
    const body = `${header}${cleanPrompt}\n\n🎙 Hold the microphone button and SEND A VOICE MESSAGE with your response!`;
    await bot.api.sendMessage(userId, body);
  } else {
    const body = `${header}${passageText}${cleanPrompt}\n\n✍️ Type your answer in the chat below:`;
    await bot.api.sendMessage(userId, body);
  }
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    const isAllowed = allowedOrigins.some((o) => origin.startsWith(o.replace(/\/+$/, "")));
    if (isAllowed) return callback(null, true);
    return callback(null, true);
  },
}));
app.use(express.json());

app.get("/", (req, res) => res.send("Bot API is running 🚀"));

if (PUBLIC_URL) {
  app.use(
    WEBHOOK_PATH,
    webhookCallback(bot, "express", {
      timeoutMilliseconds: 8_000,
      onTimeout: () => console.log("Webhook ack sent early — update processing in background."),
      secretToken: WEBHOOK_SECRET,
    })
  );
}

// ── Telegram Mini App Authentication ──────────────────────────────────────────
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

  const hashBuf = Buffer.from(hash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  if (hashBuf.length !== computedBuf.length || !crypto.timingSafeEqual(hashBuf, computedBuf)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > 86400 * 3) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}
function requireTelegramAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const initData = authHeader.startsWith("tma ") ? authHeader.slice(4) : null;

  if (initData) {
    const user = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
    if (user?.id) {
      req.telegramUser = user;
      return next();
    }
  }

  // Fallback: accept x-user-id header, query parameter, or JSON body
  const fallbackId = req.headers["x-user-id"] || req.query.userId || req.body?.userId;
  if (fallbackId && fallbackId !== "undefined" && fallbackId !== "null") {
    req.telegramUser = { id: Number(fallbackId) };
    return next();
  }

  return res.status(401).json({ error: "Missing or expired Telegram authentication" });
}

// ── Safe Chunked Message Delivery (Anti-Truncation Protection) ────────────────
async function sendSafeChunkedMessage(ctx, fullText, options = {}) {
  const MAX_CHUNK = 3900;
  if (fullText.length <= MAX_CHUNK) {
    try {
      return await ctx.reply(fullText, options);
    } catch {
      return await ctx.reply(fullText, { ...options, parse_mode: undefined });
    }
  }

  const paragraphs = fullText.split(/\n\n+/);
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > MAX_CHUNK) {
      if (currentChunk) chunks.push(currentChunk.trim());
      if (para.length > MAX_CHUNK) {
        const lines = para.split("\n");
        let lineChunk = "";
        for (const line of lines) {
          if ((lineChunk + "\n" + line).length > MAX_CHUNK) {
            chunks.push(lineChunk.trim());
            lineChunk = line;
          } else {
            lineChunk = lineChunk ? lineChunk + "\n" + line : line;
          }
        }
        if (lineChunk) currentChunk = lineChunk;
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  let lastSent;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const chunkOptions = isLast ? options : { parse_mode: options.parse_mode };
    try {
      lastSent = await ctx.reply(chunks[i], chunkOptions);
    } catch {
      lastSent = await ctx.reply(chunks[i], { ...chunkOptions, parse_mode: undefined });
    }
  }
  return lastSent;
}

// ── Unicode Font Detection & Auto-Download for Cyrillic, Accents & Math ───────

function findSystemUnicodeFont() {
  const fontDir = path.join(process.cwd(), "fonts");
  const potentialFonts = [
    path.join(fontDir, "DejaVuSans.ttf"),
    path.join(fontDir, "Roboto-Regular.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ];

  for (const fontPath of potentialFonts) {
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return null;
}

function findSystemBoldFont() {
  const fontDir = path.join(process.cwd(), "fonts");
  const potentialFonts = [
    path.join(fontDir, "DejaVuSans-Bold.ttf"),
    path.join(fontDir, "Roboto-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf"
  ];
  for (const fontPath of potentialFonts) {
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return null;
}

// ── Ensure Unicode TrueType Font Exists on Server Startup ──────────────────── 

// In index.js:

// ── Ensure Unicode TrueType Font Exists on Server Startup ─────────────────────
async function ensureUnicodeFontExists() {
  const fontDir = path.join(process.cwd(), "fonts");
  const fontPath = path.join(fontDir, "DejaVuSans.ttf");
  if (!fs.existsSync(fontPath)) {
    try {
      if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
      console.log("⏳ Downloading DejaVuSans.ttf for perfect Unicode & Cyrillic PDF rendering...");
      const res = await fetch("https://cdn.jsdelivr.net/gh/marnen/dejavu-fonts@master/ttf/DejaVuSans.ttf");
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(fontPath, buffer);
        console.log("✅ DejaVuSans.ttf installed successfully in ./fonts/");
      }
    } catch (err) {
      console.warn("Could not auto-download DejaVu font:", err.message);
    }
  }
}
ensureUnicodeFontExists();

// ── Clean & Sanitize Text for PDFKit (Eliminates [] Window Frames) ────────────
function cleanPdfText(text) {
  if (!text) return "";
  return String(text)
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[\u2010\u2011\u2012]/g, "-")
    .replace(/[\u2013\u2014]/g, " — ")
    .replace(/\u2212/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/--+/g, " — ")
    .replace(/χ/g, "kh")
    .replace(/ɪ/g, "i")
    .replace(/ɐ/g, "a")
    .replace(/ə/g, "e")
    .replace(/ʃ/g, "sh")
    .replace(/ʒ/g, "zh")
    .replace(/ç/g, "ch")
    .replace(/ŋ/g, "ng")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, "")
    .trim();
}

// ── Graceful Markdown & JSON-Object Parser for PDFKit ─────────────────────────
function renderMarkdownContentToPdf(doc, markdownText, setFont) {
  if (!markdownText) return;
  const lines = markdownText.split("\n");
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const numCols = Math.max(...tableRows.map((r) => r.length));
    const startX = 40;
    const totalWidth = 515;
    const colWidth = totalWidth / numCols;

    tableRows.forEach((row, rowIdx) => {
      if (doc.y > 720) {
        doc.addPage();
        doc.x = startX;
      }
      const currentY = doc.y;
      const isHeader = rowIdx === 0;

      if (isHeader) {
        doc.rect(startX, currentY, totalWidth, 22).fill("#3730a3");
        setFont("bold");
        doc.fillColor("#ffffff").fontSize(9);
      } else {
        doc.rect(startX, currentY, totalWidth, 20).fill(rowIdx % 2 === 0 ? "#f8fafc" : "#ffffff");
        doc.rect(startX, currentY, totalWidth, 20).stroke("#e2e8f0");
        setFont("regular");
        doc.fillColor("#0f172a").fontSize(8.5);
      }

      row.forEach((cellText, cIdx) => {
        const cleanCell = cleanPdfText(cellText);
        const maxChars = Math.floor(colWidth / 5.5);
        const safeCell = cleanCell.length > maxChars ? cleanCell.slice(0, maxChars - 1) + "…" : cleanCell;

        doc.text(
          safeCell,
          startX + 6 + cIdx * colWidth,
          currentY + 5.5,
          { width: colWidth - 10, align: "left" }
        );
      });

      doc.x = startX;
      doc.y = currentY + (isHeader ? 23 : 21);
    });

    tableRows = [];
    doc.x = startX;
    doc.moveDown(0.5);
  };

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Detect if the line contains a serialized JSON example object (e.g. {"target": ...})
    if (line.includes('{"target"') || line.includes("{'target'")) {
      try {
        const jsonMatch = line.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const obj = JSON.parse(jsonMatch[0]);
          if (doc.y > 720) { doc.addPage(); doc.x = 40; }
          const itemY = doc.y;
          doc.roundedRect(40, itemY, 515, 34, 4).fill("#f8fafc");
          setFont("bold");
          doc.fontSize(9.5).fillColor("#15803d").text(`• ${cleanPdfText(obj.target || "")}`, 50, itemY + 6, { continued: Boolean(obj.translation) });
          if (obj.translation) {
            setFont("regular");
            doc.fillColor("#1e293b").text(`  —  ${cleanPdfText(obj.translation)}`);
          }
          if (obj.note) {
            setFont("regular");
            doc.fontSize(8.5).fillColor("#64748b").text(`    Note: ${cleanPdfText(obj.note)}`, 50, itemY + 20);
          }
          doc.x = 40;
          doc.y = itemY + 38;
          continue;
        }
      } catch (_) { }
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      const isDivider = cells.every((c) => /^[:-]+$/.test(c));
      if (!isDivider) tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (doc.y > 720) {
      doc.addPage();
      doc.x = 40;
    }

    doc.x = 40;

    if (line.startsWith("###")) {
      doc.moveDown(0.4);
      setFont("bold");
      doc.fontSize(11).fillColor("#4338ca").text(cleanPdfText(line), 40, doc.y, { width: 515 });
      doc.moveDown(0.2);
    } else if (line.startsWith("##")) {
      doc.moveDown(0.5);
      setFont("bold");
      doc.fontSize(13).fillColor("#1e1b4b").text(cleanPdfText(line), 40, doc.y, { width: 515 });
      doc.moveDown(0.2);
    } else if (line.startsWith("#")) {
      doc.moveDown(0.6);
      setFont("bold");
      doc.fontSize(15).fillColor("#0f172a").text(cleanPdfText(line), 40, doc.y, { width: 515 });
      doc.moveDown(0.3);
    } else if (line.startsWith("-") || line.startsWith("•") || line.startsWith("* ")) {
      setFont("regular");
      doc.fontSize(9.5).fillColor("#334155").text(`  •  ${cleanPdfText(line.replace(/^[-•*]\s*/, ""))}`, 40, doc.y, { width: 515, lineGap: 2.5 });
    } else {
      setFont("regular");
      doc.fontSize(9.5).fillColor("#0f172a").text(cleanPdfText(line), 40, doc.y, { width: 515, lineGap: 3.5 });
    }
  }
  flushTable();
}

// ── PDF 1: Individual Grammar Rule PDF Generator ──────────────────────────────
async function generateGrammarTopicPdf(userId, language, topic, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const regularFont = findSystemUnicodeFont();
    const boldFont = findSystemBoldFont();

    const setFont = (type = "regular") => {
      if (regularFont) doc.font(type === "bold" && boldFont ? "BoldFont" : "RegularFont");
      else doc.font(type === "bold" ? "Helvetica-Bold" : "Helvetica");
    };

    if (regularFont) {
      doc.registerFont("RegularFont", regularFont);
      if (boldFont) doc.registerFont("BoldFont", boldFont);
      doc.font("RegularFont");
    }

    setFont("bold");
    doc.fontSize(17);
    const cleanTitle = cleanPdfText(topic.title);
    const titleHeight = doc.heightOfString(cleanTitle, { width: 485 });
    const bannerHeight = Math.max(72, titleHeight + 42);

    const startY = doc.y;
    doc.roundedRect(40, startY, 515, bannerHeight, 8).fill("#1e1b4b");
    doc.fillColor("#ffffff").text(cleanTitle, 55, startY + 12, { width: 485 });

    setFont("regular");
    const langName = language ? (LANGUAGES[language] || language) : "Target Language";
    const subtitleY = startY + titleHeight + 18;
    doc.fontSize(9).fillColor("#a5b4fc").text(
      `Language: ${langName}  |  Category: ${cleanPdfText(topic.category || "Grammar")}  |  Date: ${new Date().toLocaleDateString()}`,
      55, subtitleY, { width: 485 }
    );

    doc.x = 40;
    doc.y = startY + bannerHeight + 14;

    if (topic.rule_summary) {
      const summaryText = cleanPdfText(topic.rule_summary);
      setFont("regular");
      doc.fontSize(9.5);
      const textH = doc.heightOfString(summaryText, { width: 490 });
      const sumH = Math.max(44, textH + 26);

      const sumY = doc.y;
      doc.roundedRect(40, sumY, 515, sumH, 6).fillAndStroke("#f1f5f9", "#cbd5e1");
      setFont("bold");
      doc.fillColor("#0f172a").fontSize(10).text("CORE RULE TAKEAWAY", 52, sumY + 8);
      setFont("regular");
      doc.fillColor("#334155").fontSize(9.5).text(summaryText, 52, sumY + 22, { width: 490 });

      doc.x = 40;
      doc.y = sumY + sumH + 14;
    }

    renderMarkdownContentToPdf(doc, topic.explanation, setFont);

    let examplesList = [];
    try {
      examplesList = typeof topic.examples === "string" ? JSON.parse(topic.examples) : (topic.examples || []);
    } catch (_) { }

    if (Array.isArray(examplesList) && examplesList.length > 0) {
      if (doc.y > 640) {
        doc.addPage();
        doc.x = 40;
      }
      doc.moveDown(0.6);
      setFont("bold");
      doc.fontSize(12).fillColor("#047857").text("Model Sentences & Context Examples:", 40, doc.y);
      doc.moveDown(0.3);

      examplesList.forEach((ex, idx) => {
        if (doc.y > 720) {
          doc.addPage();
          doc.x = 40;
        }
        const cardY = doc.y;
        doc.roundedRect(40, cardY, 515, 34, 4).fill("#f8fafc");
        setFont("bold");
        doc.fontSize(9.5).fillColor("#15803d").text(`${idx + 1}. ${cleanPdfText(ex.target || "")}`, 50, cardY + 7, { continued: Boolean(ex.translation) });
        if (ex.translation) {
          setFont("regular");
          doc.fillColor("#1e293b").text(`  —  ${cleanPdfText(ex.translation)}`);
        }
        if (ex.note) {
          setFont("regular");
          doc.fontSize(8.5).fillColor("#64748b").text(`    Note: ${cleanPdfText(ex.note)}`, 50, cardY + 20);
        }
        doc.x = 40;
        doc.y = cardY + 38;
      });
    }

    doc.end();
    writeStream.on("finish", () => resolve(outputPath));
    writeStream.on("error", reject);
  });
}

// ── PDF 2: Consolidated Multi-Topic Grammar Reference Book ────────────────────
async function generateFullGrammarNotebookPdf(userId, language, outputPath, mediatorLanguage = null) {
  const topics = await getGrammarTopics(userId, language, mediatorLanguage);
  if (!topics || topics.length === 0) return null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const regularFont = findSystemUnicodeFont();
    const boldFont = findSystemBoldFont();

    const setFont = (type = "regular") => {
      if (regularFont) doc.font(type === "bold" && boldFont ? "BoldFont" : "RegularFont");
      else doc.font(type === "bold" ? "Helvetica-Bold" : "Helvetica");
    };

    if (regularFont) {
      doc.registerFont("RegularFont", regularFont);
      if (boldFont) doc.registerFont("BoldFont", boldFont);
      doc.font("RegularFont");
    }

    const langName = language ? (LANGUAGES[language] || language) : "Target Language";

    doc.roundedRect(40, 60, 515, 140, 10).fill("#1e1b4b");
    setFont("bold");
    doc.fontSize(24).fillColor("#ffffff").text("Comprehensive Grammar Notebook", 60, 95, { align: "center", width: 475 });
    setFont("regular");
    doc.fontSize(13).fillColor("#a5b4fc").text(`Language Track: ${langName}`, 60, 135, { align: "center", width: 475 });
    doc.fontSize(9.5).fillColor("#cbd5e1").text(
      `Compiled for User #${userId}  •  ${topics.length} Total Topics  •  ${new Date().toLocaleDateString()}`,
      60, 160, { align: "center", width: 475 }
    );

    doc.y = 230;
    doc.x = 40;
    setFont("bold");
    doc.fontSize(14).fillColor("#0f172a").text("Table of Contents", 40, doc.y);
    doc.moveDown(0.4);

    topics.forEach((t, i) => {
      setFont("regular");
      doc.fontSize(10).fillColor("#334155").text(`${i + 1}. ${cleanPdfText(t.title)} [${cleanPdfText(t.category || "Grammar")}]`, 40, doc.y);
    });

    topics.forEach((topic, idx) => {
      doc.addPage();
      doc.x = 40;
      const headY = doc.y;
      doc.roundedRect(40, headY, 515, 45, 6).fill("#312e81");
      setFont("bold");
      doc.fontSize(15).fillColor("#ffffff").text(`${idx + 1}. ${cleanPdfText(topic.title)}`, 52, headY + 10, { width: 490 });
      setFont("regular");
      doc.fontSize(9).fillColor("#c7d2fe").text(`Category: ${cleanPdfText(topic.category || "Grammar")}  |  Saved: ${new Date(topic.created_at).toLocaleDateString()}`, 52, headY + 28);
      doc.x = 40;
      doc.y = headY + 54;

      if (topic.rule_summary) {
        const sY = doc.y;
        doc.roundedRect(40, sY, 515, 36, 4).fillAndStroke("#f8fafc", "#cbd5e1");
        setFont("bold");
        doc.fillColor("#0f172a").fontSize(9.5).text("Summary:", 50, sY + 6);
        setFont("regular");
        doc.fillColor("#334155").fontSize(9).text(cleanPdfText(topic.rule_summary), 50, sY + 18, { width: 490 });
        doc.x = 40;
        doc.y = sY + 44;
      }

      renderMarkdownContentToPdf(doc, topic.explanation, setFont);
    });

    doc.end();
    writeStream.on("finish", () => resolve(outputPath));
    writeStream.on("error", reject);
  });
}

// ── PDF 3: Vocabulary Notebook PDF Generator ──────────────────────────────────
async function generateVocabularyPdf(userId, language, outputPath) {
  const { active, mastered } = await getAllUserVocabulary(userId, language);
  const allCards = [...active, ...mastered];
  if (allCards.length === 0) return null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const regularFont = findSystemUnicodeFont();
    const boldFont = findSystemBoldFont();

    const setFont = (type = "regular") => {
      if (regularFont) doc.font(type === "bold" && boldFont ? "BoldFont" : "RegularFont");
      else doc.font(type === "bold" ? "Helvetica-Bold" : "Helvetica");
    };

    if (regularFont) {
      doc.registerFont("RegularFont", regularFont);
      if (boldFont) doc.registerFont("BoldFont", boldFont);
      doc.font("RegularFont");
    }

    const startY = doc.y;
    doc.roundedRect(40, startY, 515, 60, 8).fill("#0f172a");
    setFont("bold");
    doc.fontSize(18).fillColor("#ffffff").text("Personal Vocabulary & Morphology Notebook", 55, startY + 12);
    setFont("regular");
    const langName = language ? (LANGUAGES[language] || language) : "Target Language";
    doc.fontSize(9.5).fillColor("#94a3b8").text(`Target Track: ${langName}  |  Total Words: ${allCards.length}  |  Date: ${new Date().toLocaleDateString()}`, 55, startY + 38);
    doc.x = 40;
    doc.y = startY + 75;

    allCards.forEach((card, idx) => {
      if (doc.y > 690) {
        doc.addPage();
        doc.x = 40;
      }

      const cardY = doc.y;
      doc.roundedRect(40, cardY, 515, 50, 4).fill("#f8fafc");
      doc.rect(40, cardY, 515, 50).stroke("#e2e8f0");

      setFont("bold");
      doc.fontSize(11).fillColor("#4338ca").text(`${idx + 1}. ${cleanPdfText(card.initial_form || card.word)}`, 50, cardY + 8, { continued: Boolean(card.part_of_speech) });
      if (card.part_of_speech) {
        setFont("regular");
        doc.fontSize(9).fillColor("#64748b").text(`  [${cleanPdfText(card.part_of_speech)}]`);
      }

      setFont("bold");
      doc.fontSize(9.5).fillColor("#0f172a").text(`Meaning: ${cleanPdfText(card.correction)}`, 50, cardY + 23);

      if (card.grammar_rule || card.pronunciation_rule || card.transcription) {
        setFont("regular");
        const details = [
          card.transcription ? `IPA: ${cleanPdfText(card.transcription)}` : null,
          card.grammar_rule ? `Rule: ${cleanPdfText(card.grammar_rule)}` : null,
        ].filter(Boolean).join("  |  ");
        doc.fontSize(8.5).fillColor("#475569").text(details, 50, cardY + 36, { width: 495 });
      }

      doc.x = 40;
      doc.y = cardY + 56;
    });

    doc.end();
    writeStream.on("finish", () => resolve(outputPath));
    writeStream.on("error", reject);
  });
}

// ── PDF 4: Learning Roadmap Generator ─────────────────────────────────────────
async function generateRoadmapPdf(userId, language, roadmapText, outputPath) {
  if (!roadmapText) return null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const regularFont = findSystemUnicodeFont();
    const boldFont = findSystemBoldFont();

    const setFont = (type = "regular") => {
      if (regularFont) doc.font(type === "bold" && boldFont ? "BoldFont" : "RegularFont");
      else doc.font(type === "bold" ? "Helvetica-Bold" : "Helvetica");
    };

    if (regularFont) {
      doc.registerFont("RegularFont", regularFont);
      if (boldFont) doc.registerFont("BoldFont", boldFont);
      doc.font("RegularFont");
    }

    const startY = doc.y;
    doc.roundedRect(40, startY, 515, 60, 8).fill("#0f172a");
    setFont("bold");
    doc.fontSize(18).fillColor("#ffffff").text("Personal Learning Roadmap & Study Plan", 55, startY + 12);
    setFont("regular");
    const langName = language ? (LANGUAGES[language] || language) : "Target Language";
    doc.fontSize(9.5).fillColor("#94a3b8").text(`Curriculum: ${langName}  |  Generated: ${new Date().toLocaleDateString()}`, 55, startY + 38);
    doc.x = 40;
    doc.y = startY + 75;

    const lines = roadmapText.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (doc.y > 720) {
        doc.addPage();
        doc.x = 40;
      }

      doc.x = 40;

      if (/^[1-6]\./.test(line) || line.startsWith("#") || (line.toUpperCase() === line && line.length > 5)) {
        doc.moveDown(0.6);
        const cardY = doc.y;
        doc.roundedRect(40, cardY, 515, 24, 4).fill("#f1f5f9");
        setFont("bold");
        doc.fontSize(11).fillColor("#312e81").text(cleanPdfText(line), 50, cardY + 6);
        doc.x = 40;
        doc.y = cardY + 28;
      } else if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
        setFont("regular");
        doc.fontSize(9.5).fillColor("#334155").text(`  •  ${cleanPdfText(line.replace(/^[-•*]\s*/, ""))}`, 40, doc.y, { width: 515, lineGap: 2.5 });
      } else {
        setFont("regular");
        doc.fontSize(9.5).fillColor("#1e293b").text(cleanPdfText(line), 40, doc.y, { width: 515, lineGap: 3 });
      }
    }

    doc.end();
    writeStream.on("finish", () => resolve(outputPath));
    writeStream.on("error", reject);
  });
}

// ── 0. User Profile API ──────────────────────────────────────────────────────
app.get("/api/user", requireTelegramAuth, async (req, res) => {
  const userId = req.telegramUser.id;
  const user = await getUser(userId);
  const pool = (await import("./db.js")).default;

  const { rows: cardLangs } = await pool.query(
    "SELECT DISTINCT language FROM flashcards WHERE user_id = $1 AND language IS NOT NULL",
    [userId]
  );
  const { rows: topicLangs } = await pool.query(
    "SELECT DISTINCT language FROM grammar_topics WHERE user_id = $1 AND language IS NOT NULL",
    [userId]
  );

  const foundLangs = Array.from(
    new Set([
      user?.language,
      ...cardLangs.map((r) => r.language),
      ...topicLangs.map((r) => r.language),
    ].filter(Boolean))
  );

  const activeLang = user?.language || foundLangs[0] || "russian";

  res.json({
    userId,
    language: activeLang,
    level: user?.level || "Beginner",
    availableLanguages: foundLangs.length > 0 ? foundLangs : [activeLang],
  });
});

// ── 1. Flashcards API (Filtered strictly by current active language) ──────────
app.get("/api/flashcards", requireTelegramAuth, async (req, res) => {
  const userId = req.telegramUser.id;
  const user = await getUser(userId);
  const requestedLang = req.query.language || user?.language || "russian";
  const pool = (await import("./db.js")).default;

  const { rows } = await pool.query(`
    SELECT *,
      COALESCE(NULLIF(initial_form, ''), word) AS word,
      COALESCE(NULLIF(initial_form, ''), word) AS initial_form
    FROM flashcards
    WHERE user_id = $1 AND LOWER(language) = LOWER($2)
    ORDER BY id DESC
  `, [userId, requestedLang]);

  res.json({ cards: rows, language: requestedLang });
});

app.post("/api/flashcards/:id/review", requireTelegramAuth, async (req, res) => {
  const { id } = req.params;
  const { remembered } = req.body;
  const updated = await updateFlashcard(Number(id), remembered, req.telegramUser.id);
  if (!updated) return res.status(404).json({ error: "Flashcard not found" });
  res.json({ ok: true });
});

app.post("/api/flashcards/:id/quiz", requireTelegramAuth, async (req, res) => {
  const { id } = req.params;
  const { answer } = req.body;
  if (typeof answer !== "string") return res.status(400).json({ error: "Missing answer" });

  const card = await getFlashcardById(Number(id), req.telegramUser.id);
  if (!card) return res.status(404).json({ error: "Flashcard not found" });

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

// ── AI Dynamic Distractor Generator (No more DB recycled wrong answers!) ─────
app.get("/api/flashcards/:id/options", requireTelegramAuth, async (req, res) => {
  const cardId = Number(req.params.id);
  const card = await getFlashcardById(cardId, req.telegramUser.id);
  if (!card) return res.status(404).json({ error: "Card not found" });

  const user = await getUser(req.telegramUser.id);
  const isAdvanced = String(user?.level || "").toLowerCase().includes("advanced");
  const optionLang = isAdvanced ? (card.language || "russian") : (user?.mediator_language || "english");

  const correct = card.correction || card.word;
  const word = card.initial_form || card.word;

  try {
    const distractors = await generateQuizDistractors(word, correct, LANGUAGES[card.language] || card.language, optionLang);
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    res.json({ options, correct });
  } catch {
    res.json({ options: [correct], correct });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 1. Grammar Topics & PDF Delivery Routes
// IMPORTANT: Static route /api/grammar/pdf MUST be registered BEFORE /api/grammar/:id/pdf!
// ─────────────────────────────────────────────────────────────────────────────

// ── GET: Topic List for App ──────────────────────────────────────────────────
app.get("/api/grammar", requireTelegramAuth, async (req, res) => {
  const userId = req.telegramUser.id;
  const user = await getUser(userId);
  const lang = String(req.query.language || user?.language || "russian").toLowerCase().trim();
  const mediator = String(user?.mediator_language || "english").toLowerCase().trim();
  const pool = (await import("./db.js")).default;

  let { rows: topics } = await pool.query(
    "SELECT * FROM grammar_topics WHERE user_id = $1 AND LOWER(language) = LOWER($2) AND (LOWER(mediator_language) = LOWER($3) OR mediator_language IS NULL) ORDER BY updated_at DESC, id DESC",
    [userId, lang, mediator]
  );

  // If no topics exist for this target + mediator combination, auto-generate a starter topic in the new mediator language!
  if (topics.length === 0) {
    const guide = await generateGrammarGuide(
      LANGUAGES[lang] || lang,
      mediator,
      `Основы грамматики и правила (${LANGUAGES[lang] || lang})`,
      user?.level || "Beginner"
    );
    if (guide) {
      const saved = await saveGrammarTopic(userId, lang, guide, mediator);
      if (saved) topics = [saved];
    }
  }

  res.json({ topics, language: lang });
});

// ── GET: Full Grammar Book PDF (STATIC ROUTE - MUST BE DECLARED FIRST) ───────
app.get("/api/grammar/pdf", async (req, res) => {
  const rawId = req.query?.userId || req.headers["x-user-id"] || req.body?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (!userId || userId === 123456789 || isNaN(userId)) {
    return res.status(400).json({ error: "Valid UserID is required" });
  }

  const user = await getUser(userId);
  const lang = String(req.query.language || user?.language || "russian").toLowerCase().trim();
  const mediator = String(user?.mediator_language || "english").toLowerCase().trim();
  const tempPath = path.join(tmpdir(), `grammar_full_${userId}_${Date.now()}.pdf`);

  try {
    let filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath, mediator);

    // Self-heal: If no rules exist in this mediator language, generate one now!
    if (!filePath) {
      const guide = await generateGrammarGuide(
        LANGUAGES[lang] || lang,
        mediator,
        `Grammar Essentials and Structures (${LANGUAGES[lang] || lang})`,
        user?.level || "Beginner"
      );
      if (guide) {
        await saveGrammarTopic(userId, lang, guide, mediator);
        filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath, mediator);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: `No grammar topics found for ${lang}.` });
    }

    const downloadName = req.query.filename || `Complete_Grammar_Notebook_${lang}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("end", async () => {
      await cleanupFile(filePath);
    });
    stream.on("error", (sErr) => {
      console.error("PDF stream error:", sErr);
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    });
  } catch (err) {
    console.error("Full grammar PDF error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate Grammar Notebook PDF" });
  }
});

// ── GET: Specific Topic by ID ────────────────────────────────────────────────
app.get("/api/grammar/:id", requireTelegramAuth, async (req, res) => {
  const topicId = parseInt(req.params.id, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: "Invalid topic ID" });
  }
  const topic = await getGrammarTopicById(topicId, req.telegramUser.id);
  if (!topic) return res.status(404).json({ error: "Grammar topic not found" });
  res.json({ topic });
});

// ── GET: Single Topic PDF (DYNAMIC ROUTE - REGISTERED AFTER STATIC /pdf) ─────
app.get("/api/grammar/:id/pdf", async (req, res) => {
  const topicId = parseInt(req.params.id, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: "Invalid topic ID" });
  }

  const rawUserId = req.query?.userId || req.headers["x-user-id"] || req.body?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawUserId ? Number(rawUserId) : null;
  if (!userId || userId === 123456789 || isNaN(userId)) {
    return res.status(400).json({ error: "Valid UserID is required" });
  }

  const topic = await getGrammarTopicById(topicId, userId);
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  const tempPath = path.join(tmpdir(), `grammar_${topicId}_${Date.now()}.pdf`);

  try {
    const filePath = await generateGrammarTopicPdf(userId, topic.language, topic, tempPath);
    const downloadName = req.query.filename || `${topic.title.replace(/[^\w\d\-]/g, "_")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("end", async () => {
      await cleanupFile(filePath);
    });
    stream.on("error", (sErr) => {
      console.error("PDF stream error:", sErr);
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ── POST: Send Grammar PDF to Telegram Chat ──────────────────────────────────
app.post("/api/grammar/send-pdf", async (req, res) => {
  const rawId = req.body?.userId || req.headers["x-user-id"] || req.query?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (!userId || userId === 123456789 || isNaN(userId)) {
    return res.status(400).json({ error: "Valid User ID is required." });
  }

  const { topicId } = req.body;
  try {
    const user = await getUser(userId);
    const lang = user?.language || "russian";
    const mediator = user?.mediator_language || "english";

    if (topicId) {
      const topic = await getGrammarTopicById(topicId, userId);
      if (!topic) return res.status(404).json({ error: "Topic not found" });

      const tempPath = path.join(tmpdir(), `grammar_${topicId}_${Date.now()}.pdf`);
      const filePath = await generateGrammarTopicPdf(userId, topic.language, topic, tempPath);

      await bot.api.sendDocument(userId, new InputFile(filePath, `${topic.title.replace(/[^\w\d\-]/g, "_")}.pdf`), {
        caption: `📖 *${topic.title}* (${LANGUAGES[topic.language] || topic.language} Grammar Rule PDF)`,
        parse_mode: "Markdown"
      });
      await cleanupFile(filePath);
    } else {
      const tempPath = path.join(tmpdir(), `grammar_full_${userId}_${Date.now()}.pdf`);
      let filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath, mediator);

      if (!filePath) {
        const guide = await generateGrammarGuide(
          LANGUAGES[lang] || lang,
          mediator,
          `Основы грамматики и правила (${LANGUAGES[lang] || lang})`,
          user?.level || "Beginner"
        );
        if (guide) {
          await saveGrammarTopic(userId, lang, guide, mediator);
          filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath, mediator);
        }
      }

      if (!filePath) return res.status(404).json({ error: "No grammar topics found to export." });

      await bot.api.sendDocument(userId, new InputFile(filePath, `Complete_Grammar_Notebook_${lang}.pdf`), {
        caption: `📚 *Complete Grammar Reference Notebook (${LANGUAGES[lang] || lang})*`,
        parse_mode: "Markdown"
      });
      await cleanupFile(filePath);
    }
    res.json({ success: true, message: "PDF sent to your Telegram chat!" });
  } catch (err) {
    console.error("Send grammar PDF error:", err);
    res.status(500).json({ error: err.message || "Failed to send PDF to Telegram" });
  }
});
// ── DELETE: Remove an unwanted grammar topic ─────────────────────────────────
app.delete("/api/grammar/:id", async (req, res) => {
  const topicId = parseInt(req.params.id, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: "Invalid topic ID" });
  }

  const rawUserId = req.query?.userId || req.headers["x-user-id"] || req.body?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawUserId ? Number(rawUserId) : null;
  if (!userId) {
    return res.status(401).json({ error: "Valid User ID is required" });
  }

  const deleted = await deleteGrammarTopic(topicId, userId);
  if (!deleted) {
    return res.status(404).json({ error: "Topic not found or already deleted" });
  }

  res.json({ success: true, message: "Grammar topic deleted successfully" });
});
// ── 2. Roadmap PDF Download (Language & Level Aware with Safe Stream) ─────────

app.get("/api/roadmap/pdf", async (req, res) => {
  const rawId = req.body?.userId || req.headers["x-user-id"] || req.query?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (userId === 123456789 || isNaN(userId)) { return res.status(400).json({ error: "Invalid UserID - Valid UserID is required!" }); }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access! User ID is required!." });
  }
  const user = await getUser(userId);
  const lang = String(req.query.language || user?.language || "russian").toLowerCase().trim();
  const level = user?.level || "Beginner";
  const mediator = String(user?.mediator_language || "english").toLowerCase().trim();

  let progress = await getRoadmap(userId);
  let roadmapText = progress?.roadmap;

  // Verify that cached roadmap matches current target language AND mediator language
  const isMismatch = !roadmapText ||
    isCorruptedRoadmap(roadmapText) ||
    !roadmapText.toLowerCase().includes(lang) ||
    !roadmapText.toLowerCase().includes(mediator);

  if (isMismatch) {
    roadmapText = await generateRoadmap(userId, LANGUAGES[lang] || lang, level, mediator);
  }

  if (!roadmapText) return res.status(404).json({ error: "No roadmap available" });

  const tempPath = path.join(tmpdir(), `roadmap_web_${userId}_${Date.now()}.pdf`);
  try {
    const clean = cleanRoadmapText(roadmapText);
    const filePath = await generateRoadmapPdf(userId, lang, clean, tempPath);
    const downloadName = req.query.filename || `My_${lang}_Roadmap_${level}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("end", async () => {
      await cleanupFile(filePath);
    });
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    });
  } catch (err) {
    console.error("Roadmap PDF error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate Roadmap PDF" });
  }
});

app.post("/api/roadmap/send-pdf", async (req, res) => {
  const rawId = req.body?.userId || req.headers["x-user-id"] || req.query?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (userId === 123456789 || isNaN(userId)) { return res.status(400).json({ error: "Invalid UserID - Valid UserID is required!" }); }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access! User ID is required!." });
  }
  try {
    const success = await sendRoadmapPdfToUser(null, userId);
    if (!success) return res.status(404).json({ error: "No roadmap available to export." });
    res.json({ success: true, message: "Roadmap PDF sent to your Telegram chat!" });
  } catch (err) {
    console.error("Send roadmap PDF error:", err);
    res.status(500).json({ error: err.message || "Failed to send Roadmap PDF to Telegram" });
  }
});


// ── 3. Vocabulary PDF Download (Safe Stream Piping, NO requireTelegramAuth) ───
app.get("/api/vocabulary/pdf", async (req, res) => {
  const rawId = req.body?.userId || req.headers["x-user-id"] || req.query?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (userId === 123456789 || isNaN(userId)) { return res.status(400).json({ error: "Invalid UserID - Valid UserID is required!" }); }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access! User ID is required!." });
  }

  const user = await getUser(userId);
  const lang = String(req.query.language || user?.language || "russian").toLowerCase().trim();
  const tempPath = path.join(tmpdir(), `vocab_web_${userId}_${Date.now()}.pdf`);

  try {
    const filePath = await generateVocabularyPdf(userId, lang, tempPath);
    if (!filePath) return res.status(404).json({ error: "No vocabulary found to export." });

    const downloadName = req.query.filename || `My_${lang}_Vocabulary.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("end", async () => {
      await cleanupFile(filePath);
    });
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).json({ error: "Stream error" });
    });
  } catch (err) {
    console.error("Web PDF error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

app.get("/api/games/ai-cards", async (req, res) => {
  const rawUserId = req.query?.userId || req.headers["x-user-id"] || (req.telegramUser && req.telegramUser.id);
  const userId = rawUserId ? Number(rawUserId) : null;
  const user = userId ? await getUser(userId) : null;

  const targetLang = LANGUAGES[user?.language] || user?.language || "Russian";
  const mediatorLang = LANGUAGES[user?.mediator_language] || user?.mediator_language || "English";
  const level = user?.level || "Beginner";

  const cards = await generateGameSessionWords(targetLang, mediatorLang, level, 6);
  res.json({ cards });
});

app.post("/api/vocabulary/send-pdf", requireTelegramAuth, async (req, res) => {
  const rawId = req.body?.userId || req.headers["x-user-id"] || req.query?.userId || (req.telegramUser && req.telegramUser.id);
  const userId = rawId ? Number(rawId) : null;
  if (userId === 123456789 || isNaN(userId)) { return res.status(400).json({ error: "Invalid UserID - Valid UserID is required!" }); }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access! User ID is required!." });
  } try {
    const success = await sendVocabularyPdfToUser(null, userId);
    if (!success) return res.status(404).json({ error: "No vocabulary found to export" });
    res.json({ ok: true, message: "Vocabulary PDF sent to your Telegram chat!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ── POST: Generate a Brand New Grammar Topic from Prompt ──────────────────────
app.post("/api/grammar/generate", async (req, res) => {
  const rawUserId = req.body?.userId || req.headers["x-user-id"] || (req.telegramUser && req.telegramUser.id);
  const userId = rawUserId ? Number(rawUserId) : null;
  if (!userId) return res.status(401).json({ error: "Valid UserID required" });

  const { topicPrompt } = req.body;
  if (!topicPrompt || !topicPrompt.trim()) {
    return res.status(400).json({ error: "Topic prompt is required" });
  }

  const user = await getUser(userId);
  const lang = user?.language || "russian";
  const mediator = user?.mediator_language || "english";
  const level = user?.level || "Beginner";

  try {
    const guide = await generateGrammarGuide(
      LANGUAGES[lang] || lang,
      mediator,
      topicPrompt.trim(),
      level
    );

    if (!guide || !guide.title) {
      return res.status(500).json({ error: "AI could not generate this rule." });
    }

    const saved = await saveGrammarTopic(userId, lang, guide, mediator);
    res.json({ success: true, topic: saved });
  } catch (err) {
    console.error("API grammar generation error:", err);
    res.status(500).json({ error: "Failed to generate grammar topic" });
  }
});

async function sendRoadmapPdfToUser(ctx, userId) {
  const user = await getUser(userId);
  const lang = user?.language || "russian";
  const level = user?.level || "Beginner";
  const mediator = user?.mediator_language || "english";

  const isAdvanced = String(level).toLowerCase().includes("advanced");
  const expectedLangName = isAdvanced ? (LANGUAGES[lang] || lang) : (LANGUAGES[mediator] || mediator);

  let progress = await getRoadmap(userId);
  let roadmapText = progress?.roadmap;

  // CRITICAL CHECK: Invalidate cached roadmap if level or language changed!
  const isStale = !roadmapText ||
    isCorruptedRoadmap(roadmapText) ||
    !roadmapText.toLowerCase().includes(lang.toLowerCase()) ||
    !roadmapText.toLowerCase().includes(level.toLowerCase());

  if (isStale) {
    roadmapText = await generateRoadmap(
      userId,
      LANGUAGES[lang] || lang,
      level,
      mediator
    );
  }

  if (!roadmapText) return false;

  const tempPath = path.join(tmpdir(), `roadmap_${userId}_${Date.now()}.pdf`);
  try {
    const clean = cleanRoadmapText(roadmapText);
    const filePath = await generateRoadmapPdf(userId, lang, clean, tempPath);
    const docName = `My_${lang}_Roadmap_${level}.pdf`;
    const caption = `📈 *Personal Learning Roadmap (${LANGUAGES[lang] || lang} • ${level})*`;

    // Always use bot.api.sendDocument with explicit chat/user ID
    await bot.api.sendDocument(userId, new InputFile(filePath, docName), { caption, parse_mode: "Markdown" });
    await cleanupFile(filePath);
    return true;
  } catch (err) {
    console.error("Roadmap PDF export error:", err);
    return false;
  }
}

async function sendGrammarPdfToUser(ctx, userId, topicId = null) {
  const user = await getUser(userId);
  const lang = user?.language || "russian";
  const level = user?.level || "Beginner";
  const mediator = user?.mediator_language || "english";

  const tempPath = path.join(tmpdir(), `grammar_chat_${userId}_${Date.now()}.pdf`);

  try {
    let filePath;
    let docName;
    let caption;

    if (topicId) {
      const topic = await getGrammarTopicById(topicId, userId);
      if (!topic) throw new Error("Topic not found");
      filePath = await generateGrammarTopicPdf(userId, topic.language, topic, tempPath);
      docName = `${topic.title.replace(/[^\w\d\-]/g, "_")}.pdf`;
      caption = `📖 *${topic.title}* (${LANGUAGES[topic.language] || topic.language} Grammar Rule PDF)`;
    } else {
      filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath);

      // Self-heal: If no rules exist for this language yet, generate one right now!
      if (!filePath) {
        const guide = await generateGrammarGuide(
          LANGUAGES[lang] || lang,
          mediator,
          `Основы грамматики и правила (${LANGUAGES[lang] || lang})`,
          level
        );
        if (guide) {
          await saveGrammarTopic(userId, lang, guide);
          filePath = await generateFullGrammarNotebookPdf(userId, lang, tempPath);
        }
      }

      if (!filePath) {
        await bot.api.sendMessage(userId, "📭 Не удалось скомпилировать книгу грамматики. Попробуйте написать вопрос боту в чате.");
        return false;
      }

      docName = `Grammar_Notebook_${lang}.pdf`;
      caption = `📚 *Полная книга грамматики (${LANGUAGES[lang] || lang} • ${level})*`;
    }

    // Always use bot.api.sendDocument for guaranteed delivery in both chat and callbacks
    await bot.api.sendDocument(userId, new InputFile(filePath, docName), { caption, parse_mode: "Markdown" });
    await cleanupFile(filePath);
    return true;
  } catch (err) {
    console.error("Grammar PDF export error:", err);
    await bot.api.sendMessage(userId, "❌ Ошибка при отправке PDF в Telegram.");
    return false;
  }
}
async function sendVocabularyPdfToUser(ctx, userId) {
  const user = await getUser(userId);
  const lang = (user?.language || "russian").toLowerCase();
  const tempPath = path.join(tmpdir(), `vocabulary_${userId}_${Date.now()}.pdf`);

  try {
    const filePath = await generateVocabularyPdf(userId, lang, tempPath);
    if (!filePath) {
      await bot.api.sendMessage(userId, `📭 У вас пока нет сохраненных карточек для языка ${LANGUAGES[lang] || lang}. Пообщайтесь с ботом, чтобы добавить слова!`);
      return false;
    }

    const docName = `My_${lang}_Vocabulary.pdf`;
    const caption = `📖 *Ваш персональный словарь (${LANGUAGES[lang] || lang})*`;

    await bot.api.sendDocument(userId, new InputFile(filePath, docName), { caption, parse_mode: "Markdown" });
    await cleanupFile(filePath);
    return true;
  } catch (err) {
    console.error("Vocabulary PDF export error:", err);
    await bot.api.sendMessage(userId, "❌ Ошибка при формировании словаря в PDF.");
    return false;
  }
}

function isCorruptedRoadmap(text) {
  if (!text || text.length < 80) return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("flashcard set") ||
    lower.includes("front\tback") ||
    lower.includes("<br>") ||
    lower.includes("<u>") ||
    text.endsWith("**б") ||
    text.endsWith("**")
  );
}

// ── Usage Enforcement ─────────────────────────────────────────────────────────
async function enforceUsageLimit(ctx, userId) {
  const usage = await checkAndIncrementUsage(userId, FREE_DAILY_LIMIT);
  if (usage.allowed) return true;

  await ctx.reply(
    `⏳ You've used all ${usage.limit} free messages today.\n\n` +
    `Send /upgrade for unlimited daily practice with Premium.`
  );
  return false;
}

// ── Bot Commands ──────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { state: "choosing_language" });
  await clearHistory(userId);
  await clearActiveTest(userId);
  await clearActiveDrill(userId);

  const kb = new InlineKeyboard();
  const langs = Object.entries(LANGUAGES);
  for (let i = 0; i < langs.length; i += 2) {
    const row = langs.slice(i, i + 2);
    kb.row(...row.map(([key, name]) => ({ text: name, callback_data: `lang_${key}` })));
  }

  await ctx.reply(
    "👋 Welcome to *Language Immersion Coach*!\n\n" +
    "🌍 *Step 1: Choose the language you want to LEARN:*",
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.command(["cancel", "exit", "stop"], async (ctx) => {
  const userId = ctx.from.id;
  await clearActiveTest(userId);
  await clearActiveDrill(userId);
  await upsertUser(userId, { state: "chatting" });
  await ctx.reply("⏹ Drill/Test cancelled. You are back in regular conversation mode!");
});

// Dedicated Grammar Commands
bot.command(["grammar", "rules"], async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please /start first to configure your target language.");
    return;
  }

  const topics = await getGrammarTopics(userId, user.language);
  if (topics.length === 0) {
    const emptyKb = new InlineKeyboard()
      .text("✨ Сгенерировать базовый справочник (PDF)", "gen_starter_grammar")
      .row()
      .webApp("📖 Открыть базу в приложении", `${MINIAPP_URL}?userId=${userId}`);

    await ctx.reply(
      `📭 У вас пока нет сохранённых правил для *${LANGUAGES[user.language]}*.\n\n` +
      `Вы можете прямо сейчас нажать кнопку ниже, чтобы сгенерировать базовый грамматический справочник (PDF), ` +
      `или задать любой вопрос по грамматике в чате (например: «как составлять предложения», «спряжение глаголов», «падежи»)!`,
      { parse_mode: "Markdown", reply_markup: emptyKb }
    );
    return;
  }

  const kb = new InlineKeyboard();
  topics.slice(0, 8).forEach((t) => {
    kb.text(`📄 ${t.title.slice(0, 30)}`, `dl_topic_${t.id}`).row();
  });
  kb.text("📚 Скачать всю книгу правил (PDF)", "download_all_grammar_pdf").row();
  kb.webApp("📖 Открыть базу в приложении", `${MINIAPP_URL}?userId=${userId}`);
  kb.text("🗑 Delete", `del_topic_${t.id}`).row();
  await ctx.reply(
    `📚 *Ваша персональная база правил грамматики (${LANGUAGES[user.language]}):*\n\n` +
    `Всего сохранено тем: *${topics.length}*\n\n` +
    `Выберите тему для мгновенного скачивания PDF или скачайте всю книгу целиком:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.command(["grammar_pdf", "grammarpdf"], async (ctx) => {
  await sendGrammarPdfToUser(ctx, ctx.from.id);
});

bot.command(["pdf", "export"], async (ctx) => {
  await sendVocabularyPdfToUser(ctx, ctx.from.id);
});

bot.command(["roadmap_pdf", "roadmappdf"], async (ctx) => {
  await sendRoadmapPdfToUser(ctx, ctx.from.id);
});

bot.command("roadmap", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please /start first to configure your target language.");
    return;
  }

  let progress = await getRoadmap(userId);
  let roadmapText = progress?.roadmap;

  if (!roadmapText || isCorruptedRoadmap(roadmapText)) {
    const thinking = await ctx.reply("⏳ Generating your personalized Learning Roadmap...");
    try {
      roadmapText = await generateRoadmap(
        userId,
        LANGUAGES[user.language] || user.language,
        user.level || "Beginner",
        user.mediator_language || "english"
      );
      try {
        await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
      } catch (_) { }
    } catch (err) {
      console.error("Roadmap generation error:", err);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
      } catch (_) { }
      await ctx.reply("❌ Error generating roadmap. Please try again.");
      return;
    }
  }

  const cleanText = cleanRoadmapText(roadmapText);
  const kb = new InlineKeyboard()
    .text("📥 Download Roadmap as PDF", "download_roadmap_pdf")
    .row()
    .text("🔄 Refresh Roadmap", "refresh_roadmap");

  await sendSafeChunkedMessage(ctx, cleanText, { reply_markup: kb });
});

bot.command("flashcards", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const cards = await getFlashcardsByLanguage(userId, user?.language);

  if (!cards.length) {
    await ctx.reply("📭 No flashcards yet! Keep chatting and I'll save words you struggle with.");
    return;
  }

  const due = await getDueFlashcards(userId);
  const kb = new InlineKeyboard()
    .webApp(`📚 Open Flashcards (${due.length} due)`, `${MINIAPP_URL}?userId=${userId}`)
    .row()
    .text("📥 Download PDF Notebook", "download_pdf_direct");

  await ctx.reply(
    `🗂 You have *${cards.length}* flashcards saved.\n` +
    `⏰ *${due.length}* are due for review now.\n\n` +
    `Tap below to open your deck or download your full notebook:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.command(["skills", "train"], async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please /start first to set up your target language.");
    return;
  }

  const overview = await getUserSkillsOverview(userId, user.language);
  const entries = Object.entries(overview);
  entries.sort((a, b) => a[1].score - b[1].score);
  const weakestSkill = entries[0][0];

  const kb = new InlineKeyboard()
    .text("🎧 Listening", "train_listening")
    .text("🗣 Speaking", "train_speaking")
    .row()
    .text("📖 Reading", "train_reading")
    .text("✍️ Writing", "train_writing")
    .row()
    .text("📖 Правила в PDF", "download_all_grammar_pdf")
    .text("📥 Vocabulary PDF", "download_pdf_direct");

  const msg =
    `🎯 *Skill Mastery Dashboard (${LANGUAGES[user.language]}):*\n\n` +
    `🎧 *Listening:* ${overview.listening.score}% (${overview.listening.drills_completed} drills)\n` +
    `🗣 *Speaking:* ${overview.speaking.score}% (${overview.speaking.drills_completed} drills)\n` +
    `📖 *Reading:* ${overview.reading.score}% (${overview.reading.drills_completed} drills)\n` +
    `✍️ *Writing:* ${overview.writing.score}% (${overview.writing.drills_completed} drills)\n\n` +
    `💡 *AI Recommendation:* Focus on *${weakestSkill.toUpperCase()}* next to balance your skills!\n\n` +
    `Select a skill below or download your PDF materials:`;

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
});

bot.command(["test", "leveltest"], async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Please send /start first to configure your target language.");
    return;
  }
  await initiateLevelTest(ctx, user.language, user.mediator_language || "english");
});

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

bot.command("reset", async (ctx) => {
  const userId = ctx.from.id;
  await upsertUser(userId, { language: null, level: null, state: "idle" });
  await clearHistory(userId);
  await clearActiveTest(userId);
  await clearActiveDrill(userId);
  await ctx.reply("🔄 Session reset. Send /start to begin a new language journey.");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "🤖 *Language Immersion Coach*\n\n" +
    "Commands:\n" +
    "  /grammar — просмотр и скачивание всех правил грамматики в PDF\n" +
    "  /grammar_pdf — скачать полную книгу грамматики по текущему языку (PDF)\n" +
    "  /pdf — скачать персональный словарь новых слов (PDF)\n" +
    "  /skills — тренировка 🎧 Аудирования, 🗣 Говорения, 📖 Чтения, ✍️ Письма\n" +
    "  /flashcards — интерактивные флеш-карточки со словами в начальной форме\n" +
    "  /roadmap — персональный учебный план на 7 дней\n" +
    "  /roadmap_pdf — скачать учебный план в PDF\n" +
    "  /test — повторное CEFR тестирование уровня\n" +
    "  /cancel — отмена текущего теста или тренировки\n" +
    "  /reset — смена языка обучения\n\n" +
    "💬 Вы можете писать любые вопросы по грамматике и фразам — бот всегда даст полный, неурезанный ответ и сохранит его в PDF!",
    { parse_mode: "Markdown" }
  );
});

bot.command("upgrade", async (ctx) => {
  await ctx.replyWithInvoice(
    "Language Coach Premium",
    `Unlimited daily practice for ${PREMIUM_DURATION_DAYS} days (free plan: ${FREE_DAILY_LIMIT}/day).`,
    "premium_upgrade",
    "XTR",
    [{ label: `Premium (${PREMIUM_DURATION_DAYS} days)`, amount: PREMIUM_PRICE_STARS }]
  );
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  await grantPremium(ctx.from.id, PREMIUM_DURATION_DAYS);
  await ctx.reply(`✅ Premium activated for ${PREMIUM_DURATION_DAYS} days! Thank you for your support! 🎉`);
});

// ── Onboarding Callbacks ──────────────────────────────────────────────────────

const MEDIATOR_LANGS = {
  english: "English 🇬🇧",
  russian: "Russian 🇷🇺",
  spanish: "Spanish 🇪🇸",
  french: "French 🇫🇷",
  german: "German 🇩🇪",
  turkish: "Turkish 🇹🇷",
  azerbaijani: "Azerbaijani 🇦🇿",
};

bot.callbackQuery(/^lang_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
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
    `🗣 *Step 2: Choose your Mediator / Support Language:*\n` +
    `_(Used for explanations for Beginner/Intermediate. Advanced learners get 100% immersion.)_`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});


// ── Invalidate Stale Roadmaps & Topics when Mediator Language is Changed ──────
bot.callbackQuery(/^med_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const mediator_language = ctx.match[1];
  const userId = ctx.from.id;
  await upsertUser(userId, { mediator_language, state: "starting_test" });

  // Invalidate old roadmap in user_progress so it regenerates fresh in the new mediator language
  const pool = (await import("./db.js")).default;
  await pool.query("UPDATE user_progress SET roadmap = NULL WHERE user_id = $1", [userId]);

  const kb = new InlineKeyboard().text("🚀 Start Diagnostic Placement Test", "start_placement_test");
  await ctx.editMessageText(
    `✅ Support language set to *${MEDIATOR_LANGS[mediator_language] || mediator_language}*.\n\n` +
    `🎯 *Step 3: Diagnostic Placement Test*\n\n` +
    `Ready to begin? Tap below:`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery("start_placement_test", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id;
  const user = await getUser(userId);
  await initiateLevelTest(ctx, user.language, user.mediator_language || "english");
});

bot.callbackQuery("refresh_roadmap", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Regenerating roadmap..." });
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) return;

  const thinking = await ctx.reply("⏳ Updating your Learning Roadmap based on your latest practice...");
  try {
    const newRoadmap = await generateRoadmap(
      userId,
      LANGUAGES[user.language] || user.language,
      user.level || "Beginner",
      user.mediator_language || "english"
    );
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }

    const cleanText = cleanRoadmapText(newRoadmap);
    const kb = new InlineKeyboard()
      .text("📥 Download Roadmap as PDF", "download_roadmap_pdf")
      .row()
      .text("🔄 Refresh Roadmap", "refresh_roadmap");

    await sendSafeChunkedMessage(ctx, cleanText, { reply_markup: kb });
  } catch (err) {
    console.error("Roadmap refresh error:", err);
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }
    await ctx.reply("❌ Failed to refresh roadmap.");
  }
});

async function initiateLevelTest(ctx, language, mediatorLanguage) {
  const thinking = await ctx.reply("⏳ Generating your CEFR placement test with AI...");
  try {
    const targetName = LANGUAGES[language] || language;
    const testData = await generateLevelTest(targetName, mediatorLanguage);

    await saveActiveTest(ctx.from.id, language, mediatorLanguage, testData.questions);
    await upsertUser(ctx.from.id, { state: "in_level_test" });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }

    await presentNextTestQuestion(ctx, ctx.from.id, testData.questions[0], 0, testData.questions.length);
  } catch (err) {
    console.error("Test generation error:", err);
    await ctx.reply("❌ Error generating placement test. Please try /test again.");
  }
}



bot.callbackQuery(/^testopt_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const qIndex = parseInt(ctx.match[1], 10);
  const optIndex = parseInt(ctx.match[2], 10);
  const userId = ctx.from.id;

  const test = await getActiveTest(userId);
  if (!test || test.current_index !== qIndex) return;

  const currentQ = test.questions[qIndex];
  const chosenText = currentQ.options[optIndex];

  const updatedTest = await recordActiveTestAnswer(userId, chosenText);
  if (updatedTest.current_index < updatedTest.questions.length) {
    const nextQ = updatedTest.questions[updatedTest.current_index];
    await presentNextTestQuestion(ctx, userId, nextQ, updatedTest.current_index, updatedTest.questions.length);
  } else {
    await finishAndEvaluateTest(ctx, userId, updatedTest);
  }
});

// ── Bulletproof CEFR Level Test Finalizer ─────────────────────────────────────
async function finishAndEvaluateTest(ctx, userId, test) {
  let statusMsg = null;
  try {
    statusMsg = await ctx.reply("🧠 Evaluating your answers against CEFR benchmarks with AI...");
  } catch (_) { }

  try {
    const normalizedAnswers = test.questions.map((q, i) => {
      const userAns = String(test.answers[i] || "").trim();
      if (q.type === "choice") {
        const cleanUser = userAns.replace(/^[A-Da-d0-9][\)\.]\s*/, "").trim().toLowerCase();
        const cleanExpected = String(q.correct_option || q.correct_answer || "").replace(/^[A-Da-d0-9][\)\.]\s*/, "").trim().toLowerCase();
        const isMatch = cleanUser === cleanExpected || userAns.toLowerCase() === cleanExpected;
        return isMatch ? `${userAns} [VERIFIED CORRECT]` : `${userAns} [INCORRECT]`;
      }
      return userAns || "(No answer)";
    });

    const targetLangName = LANGUAGES[test.language] || test.language;
    const mediatorLangName = LANGUAGES[test.mediator_language] || test.mediator_language || "english";

    const evaluation = await evaluateLevelTest(
      targetLangName,
      mediatorLangName,
      test.questions,
      normalizedAnswers
    );

    // Save test result and state
    await saveTestResult(userId, test.language, evaluation);
    await clearActiveTest(userId);

    // Invalidate old roadmap safely
    const dbModule = await import("./db.js");
    const dbPool = dbModule.default;
    if (dbPool?.query) {
      await dbPool.query("UPDATE user_progress SET roadmap = NULL WHERE user_id = $1", [userId]).catch(() => { });
    }

    // Safely cleanup the thinking message
    if (statusMsg && ctx.chat?.id) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch (_) { }
    }

    // Safely extract scores and breakdown with fallbacks
    const detectedLevel = evaluation.detected_level || "Beginner";
    const cefrGrade = evaluation.cefr_grade || "A1";
    const overallScore = typeof evaluation.score === "number" ? evaluation.score : 0;

    let vocabScore = "0 / 25";
    let grammarScore = "0 / 25";
    let syntaxScore = "0 / 25";
    let prodScore = "0 / 25";

    if (evaluation.breakdown && typeof evaluation.breakdown === "object") {
      vocabScore = String(evaluation.breakdown.vocabulary || "0 / 25");
      grammarScore = String(evaluation.breakdown.grammar || "0 / 25");
      syntaxScore = String(evaluation.breakdown.syntax || "0 / 25");
      prodScore = String(evaluation.breakdown.production || "0 / 25");
    }

    const recs = evaluation.recommendations || `Welcome to learning ${targetLangName}! We will start with core fundamentals.`;

    const breakdownMsg =
      `🎯 CEFR Level Detected: ${detectedLevel} (${cefrGrade})\n` +
      `📊 Overall Score: ${overallScore}/100\n\n` +
      `📈 Skill Breakdown:\n` +
      `• Vocabulary: ${vocabScore}\n` +
      `• Grammar: ${grammarScore}\n` +
      `• Syntax: ${syntaxScore}\n` +
      `• Production: ${prodScore}\n\n` +
      `💡 Note: ${recs}\n\n` +
      `🚀 Your practice mode is now set to ${detectedLevel}!\n\n` +
      `Type /skills to choose a dedicated drill (Listening 🎧, Speaking 🗣, Reading 📖, Writing ✍️) or chat naturally anytime!`;

    // Send without markdown first to guarantee zero Telegram parsing crashes
    await ctx.reply(breakdownMsg);

  } catch (err) {
    console.error("Test finalization error:", err);
    // Even in case of an unexpected crash, update DB cleanly and give a friendly response
    await upsertUser(userId, { level: "Beginner", state: "chatting" }).catch(() => { });
    await clearActiveTest(userId).catch(() => { });
    await ctx.reply(
      `🎯 Diagnostic Test Complete!\n\n` +
      `Your level has been calibrated to Beginner (A1).\n` +
      `You can now practice conversation freely in chat or train specific skills with /skills!`
    );
  }
}

// ── Callbacks for 4-Skill Drills ─────────────────────────────────────────────

bot.callbackQuery(/^train_(listening|speaking|reading|writing)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const skill = ctx.match[1];

  const kb = new InlineKeyboard()
    .text("⚡ Short Drill (Quick practice)", `drillsize_${skill}_short`)
    .row()
    .text("📚 Huge Drill (In-depth practice)", `drillsize_${skill}_huge`);

  await ctx.editMessageText(
    `Training *${skill.toUpperCase()}* 🎯\n\n` +
    `Choose your drill length:\n` +
    `• *Short Drill:* 5 fast, focused exercises\n` +
    `• *Huge Drill:* 10 deep comprehensive challenges`,
    { parse_mode: "Markdown", reply_markup: kb }
  );
});

bot.callbackQuery(/^drillsize_(listening|speaking|reading|writing)_(short|huge)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const skill = ctx.match[1];
  const drillType = ctx.match[2];
  const userId = ctx.from.id;
  const user = await getUser(userId);

  const thinking = await ctx.reply(`⏳ Generating your ${drillType} ${skill} drill with AI...`);

  try {
    const drill = await generateSkillDrill(
      skill,
      LANGUAGES[user.language] || user.language,
      user.mediator_language || "english",
      user.level || "Intermediate",
      drillType
    );

    await saveActiveDrill(userId, user.language, user.mediator_language || "english", skill, drillType, drill.questions);
    await upsertUser(userId, { state: "in_skill_drill" });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }

    await presentNextDrillQuestion(ctx, userId, drill.questions[0], 0, drill.questions.length, skill, user.language);
  } catch (err) {
    console.error("Drill setup error:", err);
    await ctx.reply("❌ Error generating drill. Please type /skills to retry.");
  }
});


async function presentNextTestQuestion(ctx, userId, question, index, total) {
  const header = `📝 Question ${index + 1} of ${total} [Target: ${question.cefr_target} • ${question.skill}]\n\n`;
  const cleanPrompt = String(question.prompt || "").replace(/_{2,}/g, "[ ... ]");

  if (question.type === "choice" && Array.isArray(question.options)) {
    const kb = new InlineKeyboard();
    question.options.forEach((opt, optIdx) => {
      kb.text(opt, `testopt_${index}_${optIdx}`).row();
    });

    const body = `${header}${cleanPrompt}\n\n👉 Select the best variant below:`;
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(body, { reply_markup: kb });
      } else {
        await ctx.reply(body, { reply_markup: kb });
      }
    } catch {
      // Guaranteed delivery: if editing or markdown parsing ever fails, send as fresh plain text message!
      await bot.api.sendMessage(userId, body, { reply_markup: kb });
    }
  } else {
    const body = `${header}${cleanPrompt}\n\n✍️ Please type your answer directly in the chat:`;
    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(body);
      } else {
        await ctx.reply(body);
      }
    } catch {
      await bot.api.sendMessage(userId, body);
    }
  }
}

bot.callbackQuery(/^drillopt_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const qIndex = parseInt(ctx.match[1], 10);
  const optIndex = parseInt(ctx.match[2], 10);
  const userId = ctx.from.id;

  const drill = await getActiveDrill(userId);
  if (!drill || drill.current_index !== qIndex) return;

  const currentQ = drill.questions[qIndex];
  const chosenAnswer = currentQ.options[optIndex];

  await handleDrillAnswerSubmission(ctx, userId, drill, currentQ, chosenAnswer, false);
});

async function handleDrillAnswerSubmission(ctx, userId, drill, question, answerText, isVoice = false) {
  const user = await getUser(userId);
  let score = 0;
  let feedback = "";
  let mistakes = [];

  if (question.type === "choice") {
    const expected = question.correct_answer || question.correct_option || "";
    const cleanChosen = String(answerText).replace(/^[A-Da-d0-9][\)\.]\s*/, "").trim().toLowerCase();
    const cleanExpected = String(expected).replace(/^[A-Da-d0-9][\)\.]\s*/, "").trim().toLowerCase();

    const isMatch = cleanChosen === cleanExpected || answerText.trim() === expected.trim();
    if (isMatch) {
      score = 100;
      feedback = "✅ Правильно!";
    } else {
      score = 0;
      feedback = `❌ Неправильно. Правильный ответ: ${expected}`;
    }
  } else {
    const thinking = await bot.api.sendMessage(userId, "🔍 Анализирую ответ...");
    const evaluation = await evaluateSkillAnswer(
      drill.skill,
      LANGUAGES[drill.language] || drill.language,
      drill.mediator_language,
      user?.level || "Intermediate",
      question,
      answerText,
      isVoice
    );

    score = evaluation.score;
    feedback = evaluation.feedback;
    mistakes = evaluation.mistakes || [];

    try {
      await bot.api.deleteMessage(userId, thinking.message_id);
    } catch (_) { }
  }

  if (Array.isArray(mistakes)) {
    for (const m of mistakes) {
      if (m.initial_form && m.meaning) {
        const cleanWord = m.initial_form.trim();
        if (cleanWord.length <= 1) continue;

        await addFlashcard(userId, {
          word: cleanWord,
          correction: m.meaning.trim(),
          context: m.explanation || m.sentence || "",
          language: drill.language,
          initial_form: cleanWord,
          used_form: m.used_form?.trim() || cleanWord,
          part_of_speech: m.part_of_speech?.trim() || "word",
          synonyms: m.synonyms?.trim() || "",
          explanation: m.explanation?.trim() || "",
          sentence: m.sentence?.trim() || answerText,
          transcription: m.transcription?.trim() || null,
          pronunciation_rule: m.pronunciation_rule?.trim() || null,
          grammar_rule: m.grammar_rule?.trim() || null,
          orthography_rule: m.orthography_rule?.trim() || null,
          syntax_rule: m.syntax_rule?.trim() || null,
          semantics_note: m.semantics_note?.trim() || null
        });
      }
    }
  }

  await bot.api.sendMessage(userId, `Балл: ${score}/100\n💡 ${feedback}`);

  const updatedDrill = await recordDrillAnswer(userId, answerText, score);
  if (updatedDrill.current_index < updatedDrill.questions.length) {
    const nextQ = updatedDrill.questions[updatedDrill.current_index];
    await presentNextDrillQuestion(ctx, userId, nextQ, updatedDrill.current_index, updatedDrill.questions.length, drill.skill, drill.language);
  } else {
    await finishSkillDrillSession(ctx, userId, updatedDrill);
  }
}

async function finishSkillDrillSession(ctx, userId, drill) {
  const scores = Array.isArray(drill.scores) ? drill.scores : [];
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1));

  await completeDrillSession(
    userId,
    drill.language,
    drill.skill,
    drill.drill_type,
    drill.questions.length,
    averageScore,
    `Completed ${drill.drill_type} drill with score ${averageScore}%`
  );

  await clearActiveDrill(userId);
  await upsertUser(userId, { state: "chatting" });

  const overview = await getUserSkillsOverview(userId, drill.language);
  const otherSkills = Object.entries(overview).filter(([s]) => s !== drill.skill);
  otherSkills.sort((a, b) => a[1].score - b[1].score);
  const nextRecommended = otherSkills[0][0];

  const kb = new InlineKeyboard()
    .text(`Train ${nextRecommended.toUpperCase()} 🚀`, `train_${nextRecommended}`)
    .row()
    .text("📖 Правила в PDF", `dl_all_grammar_${drill.language}`)
    .text("📥 Vocabulary PDF", `dl_all_vocab_${drill.language}`);

  const summary =
    `🎉 *${drill.skill.toUpperCase()} DRILL COMPLETE!*\n\n` +
    `📊 *Session Score:* ${averageScore}/100\n` +
    `📚 *Vocabulary Extracted:* All new words, transcriptions, grammar, syntax, and pronunciation rules have been saved to your deck.\n\n` +
    `Next recommended skill: *${nextRecommended.toUpperCase()}*!`;

  await bot.api.sendMessage(userId, summary, { parse_mode: "Markdown", reply_markup: kb });
}

// ── Grammar & PDF Callbacks ───────────────────────────────────────────────────

bot.callbackQuery("download_all_grammar_pdf", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling full Grammar Book PDF..." });
  await sendGrammarPdfToUser(ctx, ctx.from.id, null);
});

bot.callbackQuery(/^dl_topic_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling Rule PDF..." });
  const topicId = parseInt(ctx.match[1], 10);
  await sendGrammarPdfToUser(ctx, ctx.from.id, topicId);
});

bot.callbackQuery("gen_starter_grammar", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Генерирую грамматический справочник..." });
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user?.language) {
    await ctx.reply("Пожалуйста, сначала выберите язык через /start.");
    return;
  }

  const thinking = await ctx.reply("⏳ ИИ составляет базовый справочник по грамматике и готовит PDF...");
  try {
    const guide = await generateGrammarGuide(
      LANGUAGES[user.language] || user.language,
      user.mediator_language || "english",
      "Основы грамматики, порядок слов и базовое спряжение глаголов",
      user.level || "Beginner"
    );

    if (guide) {
      const saved = await saveGrammarTopic(userId, user.language, guide);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
      } catch (_) { }

      if (saved) {
        await sendGrammarPdfToUser(ctx, userId, saved.id);
        return;
      }
    }
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }
    await ctx.reply("❌ Не удалось создать справочник. Попробуйте еще раз.");
  } catch (err) {
    console.error("gen_starter_grammar error:", err);
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }
    await ctx.reply("❌ Ошибка при генерации справочника.");
  }
});

bot.callbackQuery("download_pdf_direct", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling your Vocabulary PDF..." });
  await sendVocabularyPdfToUser(ctx, ctx.from.id);
});

bot.callbackQuery("download_roadmap_pdf", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling your Roadmap PDF..." });
  await sendRoadmapPdfToUser(ctx, ctx.from.id);
});

bot.callbackQuery(/^dl_all_grammar_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling full Grammar Book PDF..." });
  const lang = ctx.match[1];
  await sendGrammarPdfToUser(ctx, ctx.from.id, null);
});

bot.callbackQuery(/^dl_all_vocab_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Compiling your Vocabulary PDF..." });
  await sendVocabularyPdfToUser(ctx, ctx.from.id);
});


bot.callbackQuery(/^del_topic_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Deleting topic..." });
  const topicId = parseInt(ctx.match[1], 10);
  const userId = ctx.from.id;

  const deleted = await deleteGrammarTopic(topicId, userId);
  if (deleted) {
    await ctx.reply(`🗑 Qayda / Правило #${topicId} uğurla silindi.`);
  } else {
    await ctx.reply("❌ Qayda tapılmadı və ya artıq silinib.");
  }
});
// ── Voice Messages ────────────────────────────────────────────────────────────

bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (user?.state === "in_skill_drill") {
    const drill = await getActiveDrill(userId);
    if (drill && drill.skill === "speaking") {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(fileUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      const transcribed = await transcribeAudio(buffer, "voice.ogg");

      const currentQ = drill.questions[drill.current_index];
      await handleDrillAnswerSubmission(ctx, userId, drill, currentQ, transcribed, true);
      return;
    }
  }

  if (!user || user.state === "in_level_test") {
    await ctx.reply("You are currently taking the placement test. Please answer the question above!");
    return;
  }
  if (!user || user.state !== "chatting") {
    await ctx.reply("Please /start first to complete your onboarding setup.");
    return;
  }

  if (!(await enforceUsageLimit(ctx, userId))) return;

  const thinking = await ctx.reply("🎙 Transcribing your voice...");

  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(fileUrl);
    const buffer = Buffer.from(await res.arrayBuffer());

    const transcribed = await transcribeAudio(buffer, "voice.ogg");

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n⏳ Thinking...`,
      { parse_mode: "Markdown" }
    );

    const history = await getHistory(userId);
    const { correction, reply, spokenReply, grammarTopic } = await chat(
      userId, transcribed, history,
      LANGUAGES[user.language], user.level, user.language,
      user.mediator_language || "english"
    );

    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      `🎙 *You said:* "${transcribed}"\n\n${correction}`,
      { parse_mode: "Markdown" }
    );

    const audioPath = await textToSpeech(spokenReply || reply, user.language);
    if (audioPath) {
      await ctx.replyWithVoice(new InputFile(audioPath), { caption: reply.slice(0, 1024) });
      await cleanupFile(audioPath);
    } else {
      await sendSafeChunkedMessage(ctx, reply, { parse_mode: "Markdown" });
    }

    if (grammarTopic) {
      const kb = new InlineKeyboard()
        .text(`📥 Скачать правило в PDF`, `dl_topic_${grammarTopic.id}`)
        .row()
        .text(`📚 Все правила (${LANGUAGES[user.language]})`, "download_all_grammar_pdf");
      await ctx.reply(`💡 Грамматическое правило «*${grammarTopic.title}*» сохранено в вашу базу!`, {
        parse_mode: "Markdown",
        reply_markup: kb
      });
    }

    const roadmap = await maybeGenerateRoadmap(
      userId,
      LANGUAGES[user.language],
      user.level,
      user.mediator_language || "english"
    );
    if (roadmap) await ctx.reply(roadmap);

  } catch (err) {
    console.error("Voice error:", err);
    await ctx.api.editMessageText(
      ctx.chat.id, thinking.message_id,
      "❌ Couldn't process voice. Please try again or type instead."
    );
  }
});

// ── Text Messages ─────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const userId = ctx.from.id;
  const user = await getUser(userId);
  const text = ctx.message.text.trim();
  const lower = text.toLowerCase();

  if (user?.state === "in_skill_drill") {
    const drill = await getActiveDrill(userId);
    if (drill) {
      const currentQ = drill.questions[drill.current_index];
      if (drill.skill === "speaking") {
        await ctx.reply("🎙 This is a SPEAKING drill! Please hold the microphone button and send a voice message.");
        return;
      }
      await handleDrillAnswerSubmission(ctx, userId, drill, currentQ, text, false);
      return;
    }
  }

  if (user?.state === "in_level_test") {
    const test = await getActiveTest(userId);
    if (test) {
      const currentQ = test.questions[test.current_index];
      if (currentQ && currentQ.type === "open") {
        const updatedTest = await recordActiveTestAnswer(userId, text);
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
    await ctx.reply("👋 Send /start to begin or /skills to train a specific skill!");
    return;
  }

  // ── Intelligent Grammar Query & PDF Generation Detector ────────────────────
  const isGrammarExplanationRequest =
    lower.includes("объясни") || lower.includes("расскажи") || lower.includes("как использовать") ||
    lower.includes("как спрягается") || lower.includes("правило") || lower.includes("грамматик") ||
    lower.includes("explain") || lower.includes("how to use") || lower.includes("grammar") ||
    lower.includes("qayda") || lower.includes("izah et") || lower.includes("düstur");

  const wantsPdf = lower.includes("pdf") || lower.includes("пдф") || lower.includes("файл") || lower.includes("документ");

  // If the user asks about a specific grammar topic OR explicitly asks for a grammar PDF:
  if (isGrammarExplanationRequest && (wantsPdf || text.length > 10)) {
    const thinking = await ctx.reply(`⏳ ИИ анализирует тему «${text.slice(0, 50)}» и составляет специализированное руководство в PDF...`);

    try {
      const guide = await generateGrammarGuide(
        LANGUAGES[user.language] || user.language,
        user.mediator_language || "english",
        text, // Pass the EXACT user prompt/topic to the AI
        user.level || "Beginner"
      );

      if (guide && guide.title) {
        // Save the freshly generated rule in the DB tagged with the current mediator language
        const saved = await saveGrammarTopic(userId, user.language, guide, user.mediator_language || "english");

        try {
          await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
        } catch (_) { }

        // Compile and deliver the brand-new PDF instantly!
        if (saved) {
          await ctx.reply(`✨ *Новое правило готово:* «${guide.title}»\n${guide.rule_summary || ""}`, { parse_mode: "Markdown" });
          await sendGrammarPdfToUser(ctx, userId, saved.id);
          return;
        }
      }
    } catch (gErr) {
      console.error("Custom grammar generation error:", gErr);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
      } catch (_) { }
    }
  }

  if (lower.includes("roadmap") && (lower.includes("pdf") || lower.includes("пдф"))) {
    await sendRoadmapPdfToUser(ctx, userId);
    return;
  }

  if ((lower === "pdf" || lower === "пдф") && !lower.includes("грамматик")) {
    await sendVocabularyPdfToUser(ctx, userId);
    return;
  }

  if (!(await enforceUsageLimit(ctx, userId))) return;

  const thinking = await ctx.reply("⏳ Thinking...");

  try {
    const history = await getHistory(userId);
    const { correction, reply, grammarTopic } = await chat(
      userId, text, history,
      LANGUAGES[user.language], user.level, user.language,
      user.mediator_language || "english"
    );

    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }

    if (correction && !correction.includes("✅ Perfect!")) {
      await ctx.reply(correction, { parse_mode: "Markdown" });
    }

    const fullMessageOptions = { parse_mode: "Markdown" };
    let inlineMarkup = null;

    if (grammarTopic) {
      inlineMarkup = new InlineKeyboard()
        .text(`📥 Скачать правило «${grammarTopic.title.slice(0, 24)}» (PDF)`, `dl_topic_${grammarTopic.id}`)
        .row()
        .text(`📚 Вся грамматика (${LANGUAGES[user.language]} в PDF)`, "download_all_grammar_pdf");
      fullMessageOptions.reply_markup = inlineMarkup;
    }

    await sendSafeChunkedMessage(ctx, reply, fullMessageOptions);

    const roadmap = await maybeGenerateRoadmap(
      userId,
      LANGUAGES[user.language],
      user.level,
      user.mediator_language || "english"
    );
    if (roadmap) await ctx.reply(roadmap);

  } catch (err) {
    console.error("Chat error:", err);
    try {
      await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    } catch (_) { }
    await ctx.reply("❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.");
  }
});

// ── Daily Reminders ───────────────────────────────────────────────────────────

async function sendDailyReminders() {
  try {
    const pool = (await import("./db.js")).default;
    const result = await pool.query("SELECT user_id, language FROM users WHERE state = 'chatting'");
    for (const { user_id, language } of result.rows) {
      try {
        const due = await getDueFlashcards(user_id);
        if (due.length >= 3) {
          const kb = new InlineKeyboard()
            .webApp(`📚 Review ${due.length} cards`, `${MINIAPP_URL}?userId=${user_id}`)
            .row()
            .text("📥 Download PDF Notebook", "download_pdf_direct");

          await bot.api.sendMessage(
            user_id,
            `⏰ *Time to review your flashcards!*\n\nYou have *${due.length}* words due for practice.`,
            { parse_mode: "Markdown", reply_markup: kb }
          );
        }
      } catch (userErr) {
        console.error(`Reminder failed for user ${user_id}:`, userErr.message);
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
  app.listen(PORT, "0.0.0.0", () => console.log(`API running on port ${PORT}`));

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Choose language & CEFR placement test" },
      { command: "grammar", description: "View & download grammar rules in PDF" },
      { command: "grammar_pdf", description: "Download complete Grammar Book (PDF)" },
      { command: "skills", description: "Train Listening, Speaking, Reading, Writing" },
      { command: "flashcards", description: "Open saved vocabulary cards" },
      { command: "pdf", description: "Download vocabulary notebook as PDF" },
      { command: "roadmap", description: "View learning roadmap & study plan" },
      { command: "roadmap_pdf", description: "Download learning roadmap as PDF" },
      { command: "test", description: "Retake CEFR placement test" },
      { command: "testhistory", description: "View placement test results" },
      { command: "cancel", description: "Exit active test or drill" },
      { command: "help", description: "How to use this bot" }
    ]);
    console.log("✅ Telegram command menu registered successfully");

    if (MINIAPP_URL) {
      try {
        await bot.api.setChatMenuButton({
          menu_button: {
            type: "web_app",
            text: "Open App",
            web_app: { url: MINIAPP_URL.replace(/\/+$/, "") },
          },
        });
        console.log(`✅ Telegram chat menu button set to: ${MINIAPP_URL}`);
      } catch (btnErr) {
        console.warn("Could not set chat menu button:", btnErr.message);
      }
    }
  } catch (cmdErr) {
    console.warn("Could not register bot commands:", cmdErr.message);
  }

  if (PUBLIC_URL) {
    try {
      await bot.api.setWebhook(`${PUBLIC_URL}${WEBHOOK_PATH}`, {
        secret_token: WEBHOOK_SECRET,
        drop_pending_updates: true,
      });
      console.log(`✅ Webhook running: ${PUBLIC_URL}${WEBHOOK_PATH}`);
    } catch (err) {
      console.error("Failed to set webhook, falling back to polling:", err.message);
      startPolling();
    }
  } else {
    startPolling();
  }
}).catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});

function startPolling() {
  bot.start({
    drop_pending_updates: true,
    onStart: () => console.log("✅ Polling active!"),
  }).catch((err) => console.error("Polling error:", err.message));
}

bot.catch((err) => console.error("Bot error:", err.error));