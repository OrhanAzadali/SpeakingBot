import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import zlib from "zlib"; // Нативный модуль Node.js для сжатия данных

const customRequire = typeof require !== "undefined" ? require : createRequire(import.meta.url);

let PDFParse = null;
try {
  const pdfModule = customRequire("pdf-parse");
  PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule.default || pdfModule;
} catch (e) {
  console.warn("[PDF Engine] Notice loading pdf-parse module:", e.message);
}
dotenv.config();

// Если сервер запущен в скомпилированном CJS-формате, эти переменные уже существуют.
// Если мы в dev-режиме ESM, вычисляем их через import.meta.url.
const currentFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app = express();
const PORT = process.env.PORT || 3000;

// Обязательно вставляем сюда, в самый верх!
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ limit: "35mb", extended: true }));


let geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy-key-for-initialization",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
async function callGeminiWithResilience(prompt, preferredModel = "gemini-3.8-flash", fallbackModels = ["gemini-flash-latest", "gemini-3.1-flash-lite"]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  const ai = getGeminiClient();
  const candidateModels = [preferredModel, ...fallbackModels];
  for (const model of candidateModels) {
    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT_503_SPIKE")), 4500);
      });
      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      const isCapacityIssue = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("TIMEOUT_503_SPIKE");
      if (isCapacityIssue) {
        console.warn(`[SpeakBot AI Engine] ${model} experiencing temporary high demand/timeout (503/429). Attempting fallback...`);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      console.warn(`[SpeakBot AI Engine] Request on ${model} not completed (${msg.slice(0, 80)}). Activating local engine.`);
      break;
    }
  }
  return null;
}

// Функция сжатия текста в Base64-строку Gzip
function zipText(text) {
  if (!text) return "";
  const buffer = zlib.gzipSync(Buffer.from(text, "utf-8"));
  return buffer.toString("base64");
}

// Функция распаковки Gzip Base64-строки обратно в читаемый текст
function unzipText(zippedBase64) {
  if (!zippedBase64) return "";
  const buffer = Buffer.from(zippedBase64, "base64");
  return zlib.gunzipSync(buffer).toString("utf-8");
}

const syncedUsersDatabase = {
  "default-user": {
    userId: "usr_speakbot_84920482",
    telegramUsername: "@speakbot_learner",
    currentLevel: "B1",
    targetLanguage: "English",
    mediatorLanguage: "az",
    // Default Azerbaijani, interchangeable with ru, tr, es, en
    overallScore: 68,
    testHistory: [
      {
        date: new Date(Date.now() - 864e5 * 3).toISOString(),
        testType: "Initial Diagnostic /start",
        level: "B1",
        score: 68,
        source: "telegram_bot"
      }
    ],
    skillLevels: {
      grammar: { level: "B1", score: 65, lastTested: new Date(Date.now() - 864e5 * 2).toISOString() },
      vocabulary: { level: "B2", score: 72, lastTested: new Date(Date.now() - 864e5 * 2).toISOString() },
      listening: { level: "B1", score: 68, lastTested: new Date(Date.now() - 864e5 * 3).toISOString() },
      reading: { level: "B2", score: 75, lastTested: new Date(Date.now() - 864e5 * 4).toISOString() },
      speaking: { level: "B1", score: 60, lastTested: new Date(Date.now() - 864e5 * 1).toISOString() }
    },
    skillScores: {
      grammar: 65,
      vocabulary: 72,
      listening: 68,
      reading: 75,
      speaking: 60
    },
    vocabularyByLanguage: {
      English: [
        {
          id: "vocab-en-1",
          word: "synthesize",
          translation: "birləşdirmək, sintez etmək",
          targetLanguage: "English",
          pos: "verb",
          ipa: "/ˈsɪnθəsaɪz/",
          example: "Researchers synthesize novel linguistic data models.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-en-2",
          word: "meticulous",
          translation: "hədsiz dərəcədə diqqətli, dəqiq",
          targetLanguage: "English",
          pos: "adjective",
          ipa: "/məˈtɪkjələs/",
          example: "He maintained meticulous grammatical accuracy.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-en-3",
          word: "epistemic",
          translation: "elmi idrakla bağlı, biliyə aid",
          targetLanguage: "English",
          pos: "adjective",
          ipa: "/ˌɛpɪˈstiːmɪk/",
          example: "Modal verbs express epistemic degrees of certainty.",
          savedAt: new Date().toISOString()
        }
      ],
      German: [
        {
          id: "vocab-de-1",
          word: "Nachhaltigkeit",
          translation: "davamlılıq / dayanıqlılıq",
          targetLanguage: "German",
          pos: "noun",
          ipa: "/ˈnaːxhaltɪçkaɪt/",
          example: "Nachhaltigkeit ist ein zentrales Prinzip moderner Sprachförderung.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-de-2",
          word: "Arbeitsweise",
          translation: "iş prinsipi / metodika",
          targetLanguage: "German",
          pos: "noun",
          ipa: "/ˈaʁbaɪtsˌvaɪzə/",
          example: "Seine methodische Arbeitsweise führte zum schnellen Spracherwerb.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-de-3",
          word: "verinnerlichen",
          translation: "mənimsəmək / dərindən öyrənmək",
          targetLanguage: "German",
          pos: "verb",
          ipa: "/fɛɐ̯ˈʔɪnɐlɪçn̩/",
          example: "Man muss grammatische Strukturen durch ständige Übung verinnerlichen.",
          savedAt: new Date().toISOString()
        }
      ],
      Spanish: [
        {
          id: "vocab-es-1",
          word: "desarrollo",
          translation: "inkişaf / tərəqqi",
          targetLanguage: "Spanish",
          pos: "noun",
          ipa: "/desaˈroʝo/",
          example: "El desarrollo de la fluidez verbal requiere constancia y disciplina.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-es-2",
          word: "sostenible",
          translation: "davamlı / dayanıqlı",
          targetLanguage: "Spanish",
          pos: "adjective",
          ipa: "/sosteˈnible/",
          example: "Adoptamos una metodología de estudio lingüístico sostenible.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-es-3",
          word: "asimilar",
          translation: "mənimsəmək / qavramaq",
          targetLanguage: "Spanish",
          pos: "verb",
          ipa: "/asimiˈlaɾ/",
          example: "Es fundamental asimilar los patrones sintácticos de forma intuitiva.",
          savedAt: new Date().toISOString()
        }
      ],
      French: [
        {
          id: "vocab-fr-1",
          word: "apprentissage",
          translation: "öyrənmə / təlim",
          targetLanguage: "French",
          pos: "noun",
          ipa: "/apʁɑ̃.ti.saʒ/",
          example: "L'apprentissage autonome renforce durablement la mémorisation.",
          savedAt: new Date().toISOString()
        },
        {
          id: "vocab-fr-2",
          word: "durabilité",
          translation: "davamlılıq",
          targetLanguage: "French",
          pos: "noun",
          ipa: "/dy.ʁa.bi.li.te/",
          example: "La durabilité des connaissances dépend de la pratique active.",
          savedAt: new Date().toISOString()
        }
      ],
      Italian: [
        {
          id: "vocab-it-1",
          word: "sviluppo",
          translation: "inkişaf",
          targetLanguage: "Italian",
          pos: "noun",
          ipa: "/zviˈluppo/",
          example: "Lo sviluppo della scioltezza verbale richiede costanza.",
          savedAt: new Date().toISOString()
        }
      ],
      Russian: [
        {
          id: "vocab-ru-1",
          word: "развитие",
          translation: "inkişaf",
          targetLanguage: "Russian",
          pos: "noun",
          ipa: "/rɐzˈvʲitʲɪjə/",
          example: "Систематическое развитие словарного запаса ускоряет беглость речи.",
          savedAt: new Date().toISOString()
        }
      ],
      Turkish: [
        {
          id: "vocab-tr-1",
          word: "sürdürülebilirlik",
          translation: "davamlılıq / dayanıqlılıq",
          targetLanguage: "Turkish",
          pos: "noun",
          ipa: "/syɾdyɾylebiˈliɾlik/",
          example: "Dil öğreniminde sürdürülebilirlik en önemli başarı faktörüdür.",
          savedAt: new Date().toISOString()
        }
      ]
    },
    savedVocabulary: [],
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
};

// Ensure default user has mirror of active targetLanguage in savedVocabulary
syncedUsersDatabase["default-user"].savedVocabulary =
  syncedUsersDatabase["default-user"].vocabularyByLanguage[syncedUsersDatabase["default-user"].targetLanguage] ||
  syncedUsersDatabase["default-user"].vocabularyByLanguage.English;

function ensureUserVocabStructure(user) {
  if (!user.vocabularyByLanguage) {
    user.vocabularyByLanguage = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"].vocabularyByLanguage));
  }
  const activeLang = user.targetLanguage || "English";
  if (!user.vocabularyByLanguage[activeLang]) {
    user.vocabularyByLanguage[activeLang] = [];
  }
  user.savedVocabulary = user.vocabularyByLanguage[activeLang];
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverTime: (/* @__PURE__ */ new Date()).toISOString() });
});

app.get("/api/user/vocabulary", (req, res) => {
  const userId = req.query.userId || "default-user";
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  const requestedTargetLang = req.query.targetLanguage || user.targetLanguage || "English";
  if (!user.vocabularyByLanguage[requestedTargetLang]) {
    user.vocabularyByLanguage[requestedTargetLang] = [];
  }

  const countsByLanguage = {};
  Object.keys(user.vocabularyByLanguage).forEach((lang) => {
    countsByLanguage[lang] = user.vocabularyByLanguage[lang].length;
  });

  res.json({
    success: true,
    targetLanguage: requestedTargetLang,
    data: user.vocabularyByLanguage[requestedTargetLang] || [],
    allVocabularies: user.vocabularyByLanguage,
    countsByLanguage
  });
});

app.post("/api/user/vocabulary", (req, res) => {
  const {
    userId = "default-user",
    targetLanguage,
    word,
    translation,
    meaning,
    pos,
    partOfSpeech,
    ipa,
    example,
    sentence
  } = req.body;

  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  const termWord = String(word || "").trim();
  if (!termWord) {
    return res.status(400).json({ success: false, message: "Word is required" });
  }

  const lang = targetLanguage || user.targetLanguage || "English";
  if (!user.vocabularyByLanguage[lang]) {
    user.vocabularyByLanguage[lang] = [];
  }

  const list = user.vocabularyByLanguage[lang];
  const exists = list.find((v) => v.word.toLowerCase() === termWord.toLowerCase());

  if (!exists) {
    const newEntry = {
      id: `vocab-${lang.toLowerCase().slice(0, 2)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      word: termWord,
      translation: translation || meaning || "Saved term",
      targetLanguage: lang,
      pos: pos || partOfSpeech || "noun",
      ipa: ipa || "",
      example: example || sentence || "",
      savedAt: new Date().toISOString()
    };
    list.unshift(newEntry);
  }

  // Update savedVocabulary mirror for the active targetLanguage
  user.savedVocabulary = user.vocabularyByLanguage[user.targetLanguage || "English"] || [];
  user.lastSyncedAt = new Date().toISOString();

  const countsByLanguage = {};
  Object.keys(user.vocabularyByLanguage).forEach((l) => {
    countsByLanguage[l] = user.vocabularyByLanguage[l].length;
  });

  console.log(`[VOCAB] Saved word "${termWord}" for targetLanguage: ${lang} (User: ${userId}). Total words in ${lang}: ${list.length}`);

  res.json({
    success: true,
    message: `Word "${termWord}" added to ${lang} personal vocabulary`,
    targetLanguage: lang,
    data: list,
    allVocabularies: user.vocabularyByLanguage,
    countsByLanguage
  });
});

app.delete("/api/user/vocabulary", (req, res) => {
  const { userId = "default-user", targetLanguage, word, id } = req.body;
  if (!syncedUsersDatabase[userId]) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  const lang = targetLanguage || user.targetLanguage || "English";
  if (user.vocabularyByLanguage[lang]) {
    user.vocabularyByLanguage[lang] = user.vocabularyByLanguage[lang].filter((item) => {
      if (id && item.id === id) return false;
      if (word && item.word.toLowerCase() === word.toLowerCase()) return false;
      return true;
    });
  }

  user.savedVocabulary = user.vocabularyByLanguage[user.targetLanguage || "English"] || [];
  user.lastSyncedAt = new Date().toISOString();

  const countsByLanguage = {};
  Object.keys(user.vocabularyByLanguage).forEach((l) => {
    countsByLanguage[l] = user.vocabularyByLanguage[l].length;
  });

  res.json({
    success: true,
    message: "Word removed from vocabulary",
    targetLanguage: lang,
    data: user.vocabularyByLanguage[lang] || [],
    allVocabularies: user.vocabularyByLanguage,
    countsByLanguage
  });
});
app.get("/api/user/profile", (req, res) => {
  const userId = req.query.userId || "default-user";
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  res.json({
    success: true,
    data: syncedUsersDatabase[userId]
  });
});
app.post("/api/user/mediator-language", (req, res) => {
  const { userId = "default-user", mediatorLanguage, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  syncedUsersDatabase[userId].mediatorLanguage = mediatorLanguage;
  syncedUsersDatabase[userId].lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[SYNC] Mediator language updated to ${mediatorLanguage} from ${source} for user ${userId}. Synced to Telegram Bot state.`);
  res.json({
    success: true,
    message: "Mediator language updated and synchronized across WebApp, MiniApp, and Telegram Bot",
    data: syncedUsersDatabase[userId]
  });
});
app.post("/api/user/target-language", (req, res) => {
  const { userId = "default-user", targetLanguage, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  user.targetLanguage = targetLanguage || "English";
  if (!user.vocabularyByLanguage[user.targetLanguage]) {
    user.vocabularyByLanguage[user.targetLanguage] = [];
  }
  user.savedVocabulary = user.vocabularyByLanguage[user.targetLanguage];
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[SYNC] Target language updated to ${user.targetLanguage} from ${source} for user ${userId}. Loaded separate vocabulary with ${user.savedVocabulary.length} words.`);

  const countsByLanguage = {};
  Object.keys(user.vocabularyByLanguage).forEach((l) => {
    countsByLanguage[l] = user.vocabularyByLanguage[l].length;
  });

  res.json({
    success: true,
    message: `Target language switched to ${user.targetLanguage}. Switched to separate ${user.targetLanguage} vocabulary.`,
    data: user,
    targetLanguage: user.targetLanguage,
    vocabulary: user.savedVocabulary,
    allVocabularies: user.vocabularyByLanguage,
    countsByLanguage
  });
});
app.post("/api/user/level-test", (req, res) => {
  const { userId = "default-user", level, score, testType = "Diagnostic Level Test", source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  user.currentLevel = level;
  user.overallScore = score;
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType,
    level,
    score,
    source
  });
  res.json({
    success: true,
    message: `Level updated to ${level} and synced with Telegram bot data`,
    data: user
  });
});
app.post("/api/user/skill-test", (req, res) => {
  const { userId = "default-user", skill, level, score, scoreDelta, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  if (!user.skillScores) {
    user.skillScores = {
      grammar: user.skillLevels?.grammar?.score ?? 65,
      vocabulary: user.skillLevels?.vocabulary?.score ?? 72,
      listening: user.skillLevels?.listening?.score ?? 68,
      reading: user.skillLevels?.reading?.score ?? 75,
      speaking: user.skillLevels?.speaking?.score ?? 60
    };
  }
  if (skill in user.skillLevels) {
    const currentScore = user.skillScores[skill] ?? 70;
    const finalScore = score !== void 0 ? score : Math.min(100, Math.max(20, currentScore + (scoreDelta || 0)));
    const finalLevel = level || (finalScore >= 85 ? "C1" : finalScore >= 70 ? "B2" : finalScore >= 50 ? "B1" : "A2");
    user.skillLevels[skill] = {
      level: finalLevel,
      score: finalScore,
      lastTested: (/* @__PURE__ */ new Date()).toISOString()
    };
    user.skillScores[skill] = finalScore;
  }
  const skills = Object.values(user.skillLevels);
  const avgScore = Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length);
  user.overallScore = avgScore;
  if (avgScore >= 90) user.currentLevel = "C2";
  else if (avgScore >= 80) user.currentLevel = "C1";
  else if (avgScore >= 65) user.currentLevel = "B2";
  else if (avgScore >= 50) user.currentLevel = "B1";
  else if (avgScore >= 35) user.currentLevel = "A2";
  else user.currentLevel = "A1";
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType: `${String(skill).toUpperCase()} Skill Test`,
    level: user.skillLevels[skill]?.level || "B1",
    score: user.skillScores[skill] || 70,
    source
  });
  res.json({
    success: true,
    message: `${skill} test synced successfully. Overall level adjusted to ${user.currentLevel}`,
    data: user
  });
});
app.post("/api/stories/progress", (req, res) => {
  const {
    userId = "default-user",
    storyId,
    storyTitle = "Classic Story",
    author = "Classic Author",
    mode = "reading",
    score = 85,
    scoreDelta = 4,
    source = "webapp"
  } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  const skillKey = mode === "listening" ? "listening" : "reading";
  const currentSkillScore = user.skillScores?.[skillKey] ?? 70;
  const newScore = Math.min(100, Math.max(20, currentSkillScore + scoreDelta));
  if (!user.skillScores) {
    user.skillScores = { grammar: 65, vocabulary: 72, listening: 68, reading: 75, speaking: 60 };
  }
  user.skillScores[skillKey] = newScore;
  if (user.skillLevels?.[skillKey]) {
    user.skillLevels[skillKey].score = newScore;
    user.skillLevels[skillKey].lastTested = (/* @__PURE__ */ new Date()).toISOString();
  }
  const skills = Object.values(user.skillScores);
  const avgScore = Math.round(skills.reduce((sum, s) => sum + s, 0) / skills.length);
  user.overallScore = avgScore;
  if (avgScore >= 90) user.currentLevel = "C2";
  else if (avgScore >= 80) user.currentLevel = "C1";
  else if (avgScore >= 65) user.currentLevel = "B2";
  else if (avgScore >= 50) user.currentLevel = "B1";
  else if (avgScore >= 35) user.currentLevel = "A2";
  else user.currentLevel = "A1";
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType: `Classic ${mode === "listening" ? "Audio Listening" : "Reading"}: ${author}`,
    level: user.currentLevel,
    score,
    source
  });
  console.log(`[SYNC] ${mode} story "${storyTitle}" by ${author} completed with score ${score}%. Updated ${skillKey} to ${newScore}%. Synced to Telegram Bot.`);
  res.json({
    success: true,
    message: `Story progress saved. ${skillKey} score boosted to ${newScore}% and synced to @SpeakBot.`,
    data: user
  });
});
app.get("/api/bot/sync", (req, res) => {
  const userId = req.query.userId || "default-user";
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);
  res.json({
    synced: true,
    userState: user,
    botStatus: "CONNECTED",
    telegramChatId: user.userId?.startsWith("tg_") ? user.userId.replace("tg_", "") : "84920482",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/bot/sync", (req, res) => {
  const { userId = "default-user", botUpdate } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  if (botUpdate) {
    if (botUpdate.mediatorLanguage) user.mediatorLanguage = botUpdate.mediatorLanguage;
    if (botUpdate.targetLanguage) {
      user.targetLanguage = botUpdate.targetLanguage;
      if (!user.vocabularyByLanguage[user.targetLanguage]) {
        user.vocabularyByLanguage[user.targetLanguage] = [];
      }
      user.savedVocabulary = user.vocabularyByLanguage[user.targetLanguage];
    }
    if (botUpdate.currentLevel) user.currentLevel = botUpdate.currentLevel;
    if (botUpdate.skillScores) user.skillScores = { ...user.skillScores, ...botUpdate.skillScores };
    if (botUpdate.newWord) {
      const targetL = botUpdate.newWord.targetLanguage || user.targetLanguage || "English";
      if (!user.vocabularyByLanguage[targetL]) user.vocabularyByLanguage[targetL] = [];
      const exists = user.vocabularyByLanguage[targetL].find(
        (w) => w.word.toLowerCase() === botUpdate.newWord.word.toLowerCase()
      );
      if (!exists) {
        user.vocabularyByLanguage[targetL].unshift({
          id: `vocab-${targetL.toLowerCase().slice(0, 2)}-${Date.now()}`,
          ...botUpdate.newWord,
          targetLanguage: targetL,
          savedAt: new Date().toISOString()
        });
      }
      user.savedVocabulary = user.vocabularyByLanguage[user.targetLanguage || "English"];
    }
    user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  res.json({
    synced: true,
    userState: user,
    botStatus: "CONNECTED",
    telegramChatId: user.userId?.startsWith("tg_") ? user.userId.replace("tg_", "") : "84920482",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});

// ==========================================
// CUSTOM PDF STORIES & 3X DAILY BOT EXCERPT SYSTEM
// ==========================================
const userCustomStories = {};
const userPersonalizedRoadmaps = {};

async function extractTextFromPdfBuffer(buffer) {
  try {
    console.log(`[PDF Engine] Attempting extraction from buffer. Size: ${buffer.length} bytes`);

    // Попытка 1: Проверяем, загрузился ли нативный pdf-parse
    if (typeof PDFParse === 'function' || PDFParse) {
      try {
        const parseFunc = typeof PDFParse === 'function' ? PDFParse : (PDFParse.PDFParse || PDFParse.default);
        const res = await parseFunc(buffer);
        if (res && res.text && res.text.trim().length > 0) {
          console.log(`[PDF Engine] Success via pdf-parse. Extracted ${res.text.length} chars.`);
          return res.text;
        }
      } catch (e1) {
        console.warn("[PDF Engine] pdf-parse call failed, trying constructor format:", e1.message);

        // Попытка 2: Формат инстанса класса
        try {
          const parser = new PDFParse({});
          if (typeof parser.load === 'function') {
            await parser.load({ data: buffer });
            const text = await parser.getText();
            if (text && typeof text === 'string' && text.trim().length > 0) {
              return text;
            }
          }
        } catch (e2) {
          console.warn("[PDF Engine] Class instance format failed:", e2.message);
        }
      }
    }
  } catch (err) {
    console.warn("[SpeakBot PDF Engine] Core parse crashed, entering text-stream fallbacks:", err.message);
  }

  // Попытка 3: Безопасный текстовый экстрактор (Regex-стриппер)
  // Если это текстовый PDF (не сканированная картинка), этот код нативно вытащит из него все слова без сторонних библиотек
  try {
    console.log("[PDF Engine] Activating native regex binary text-stream reader...");
    const rawStr = buffer.toString('utf-8');

    // Ищем блоки текста внутри скобок PDF операторов (TJ, Tj)
    const textMatches = rawStr.match(/\(([^()]*)\)\s*T[jJ]/g);
    if (textMatches && textMatches.length > 0) {
      const extracted = textMatches
        .map(m => {
          // Вытаскиваем текст между скобками
          const match = m.match(/\(([^()]*)\)/);
          return match ? match[1] : '';
        })
        .filter(m => m.trim().length > 1)
        .join(' ');

      if (extracted.trim().length > 100) {
        console.log(`[PDF Engine] Success via regex binary stream! Extracted ${extracted.length} chars.`);
        return extracted;
      }
    }

    // Попытка 4: Грубая очистка всего бинарного потока от мусора управляющих символов PDF
    console.log("[PDF Engine] Regex failed. Running absolute brute-force character rescue clean...");
    const cleanChars = rawStr
      .replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u0400-\u04FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanChars.length > 100) {
      console.log(`[PDF Engine] Brute-force success. Rescued ${cleanChars.length} characters.`);
      return cleanChars.slice(0, 40000);
    }

    return buffer.toString('utf-8').slice(0, 15000);
  } catch (e) {
    console.error("[PDF Engine] All text fallbacks failed critically:", e.message);
    return "Fallback error text container empty. Please check file structure.";
  }
}


function getDailyBotStoryFeeds(targetLanguage = "English") {
  const lang = targetLanguage.toLowerCase();
  const feeds = {
    english: [
      {
        id: "daily-bot-morning-en",
        feedSlot: "Morning Classic (08:00)",
        title: "The Solitary Reaper & Wordsworth's Highland Grace",
        author: "William Wordsworth",
        authorEra: "Romantic Era (1807)",
        level: "B1",
        mode: "both",
        duration: "4 min read • 2 min audio",
        targetLanguage: "English",
        isDailyBotFeed: true,
        sourceBook: "SpeakBot 3x Daily Literary Canon",
        coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
        culturalLinguisticContext: "William Wordsworth's lyrical celebration of language and nature exemplifies Romantic SVO prosody and emotive vocabulary.",
        paragraphs: [
          "Behold her, single in the field, yon solitary Highland Lass! Reaping and singing by herself, stop here, or gently pass!",
          "Alone she cuts and binds the grain, and sings a melancholy strain. O listen! for the Vale profound is overflowing with the sound."
        ],
        sentences: [
          {
            text: "Behold her, single in the field, yon solitary Highland Lass!",
            translation: "Bax ona, tarlada tək-tənha, o uzaqdakı tənha dağlı qıza!",
            literaryNote: "Wordsworth employs the imperative 'Behold' to capture immediate listener sensory attention.",
            audioTime: "0:00 - 0:08"
          },
          {
            text: "Reaping and singing by herself, stop here, or gently pass!",
            translation: "Təkbaşına biçir və oxuyur; burada dayan, ya da sakitcə keç!",
            literaryNote: "Parallel participial clauses ('Reaping and singing') maintain rhythmic acoustic balance.",
            audioTime: "0:08 - 0:17"
          },
          {
            text: "Alone she cuts and binds the grain, and sings a melancholy strain.",
            translation: "Təkbaşına taxılı biçir və bağlayır, və həzin bir nəğmə oxuyur.",
            literaryNote: "'Melancholy strain' denotes a poignant, contemplative melodic refrain.",
            audioTime: "0:17 - 0:26"
          }
        ],
        keyVocabulary: [
          { word: "solitary", ipa: "/ˈsɒl.ɪ.tər.i/", pos: "adjective", translation: "tənha, tək", cefr: "B2", example: "She lived a solitary life in the hills." },
          { word: "reap", ipa: "/riːp/", pos: "verb", translation: "biçmək, məhsul yığmaq", cefr: "B2", example: "Farmers reap what they have sown." },
          { word: "melancholy", ipa: "/ˈmel.əŋ.kɒl.i/", pos: "adjective", translation: "həzin, kədərli", cefr: "C1", example: "A melancholy tune echoed through the room." },
          { word: "profound", ipa: "/prəˈfaʊnd/", pos: "adjective", translation: "dərin, mühüm", cefr: "B2", example: "The silence had a profound effect on everyone." }
        ],
        stylisticDevices: [
          { device: "Imperative Apostrophe", exampleFromText: "Behold her... O listen!", explanation: "Direct rhetorical address urging sensory immersion." }
        ],
        conversations: [
          {
            persona: "SpeakBot Literary Socrates",
            prompt: "Why does the poet urge the passerby to 'stop here, or gently pass'?",
            options: [
              "To preserve the sanctity and pure resonance of the song without disturbance.",
              "Because the reaper asked for agricultural assistance.",
              "Because the path was closed for maintenance."
            ],
            correctIndex: 0,
            botFeedback: "Superb! In Romantic poetics, preserving the pure acoustic sanctity of spontaneous emotional expression is paramount."
          }
        ],
        exercises: [
          {
            question: "What syntactic role does 'solitary' serve in the opening clause?",
            options: ["Attributive adjective modifying 'Lass'", "Adverb of manner", "Direct object of the verb"],
            correctIndex: 0,
            explanation: "'Solitary' is an adjective characterizing the noun 'Lass' (Scottish dialect for girl)."
          }
        ]
      },
      {
        id: "daily-bot-afternoon-en",
        feedSlot: "Afternoon Dialogue (14:00)",
        title: "The Picture of Dorian Gray: Art and Aesthetics",
        author: "Oscar Wilde",
        authorEra: "Late Victorian (1890)",
        level: "B2",
        mode: "both",
        duration: "5 min read • 3 min audio",
        targetLanguage: "English",
        isDailyBotFeed: true,
        sourceBook: "SpeakBot 3x Daily Literary Canon",
        coverImage: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=800&q=80",
        culturalLinguisticContext: "Oscar Wilde's epigrammatic dialogues showcase Victorian rhetorical wit and inverted syntactic aphorisms.",
        paragraphs: [
          "The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac.",
          "In the centre of the room, clamped to an upright easel, stood the full-length portrait of a young man of extraordinary personal beauty."
        ],
        sentences: [
          {
            text: "The studio was filled with the rich odour of roses.",
            translation: "Emalatxana güllərin zəngin ətri ilə dolu idi.",
            literaryNote: "Sensory olfactory opening establishes the decadent aesthetic ambiance.",
            audioTime: "0:00 - 0:07"
          },
          {
            text: "In the centre of the room stood the full-length portrait of a young man of extraordinary personal beauty.",
            translation: "Otağın mərkəzində fövqəladə gözəlliyə malik gənc bir kişinin bütöv boylu portreti dururdu.",
            literaryNote: "Locative inversion ('In the centre of the room stood...') creates suspense before revealing the subject.",
            audioTime: "0:07 - 0:18"
          }
        ],
        keyVocabulary: [
          { word: "odour", ipa: "/ˈəʊ.dər/", pos: "noun", translation: "ətir, qoxu", cefr: "B2", example: "The sweet odour of jasmine filled the hallway." },
          { word: "easel", ipa: "/ˈiː.zəl/", pos: "noun", translation: "molbert (rəssam dayağı)", cefr: "B2", example: "The canvas was resting securely on the wooden easel." },
          { word: "extraordinary", ipa: "/ɪkˈstrɔː.dɪn.ər.i/", pos: "adjective", translation: "fövqəladə, qeyri-adi", cefr: "B1", example: "She possessed an extraordinary talent for languages." }
        ],
        stylisticDevices: [
          { device: "Locative Inversion", exampleFromText: "In the centre of the room stood the portrait...", explanation: "Places spatial prepositional phrase before verb to elevate focus." }
        ],
        conversations: [
          {
            persona: "Lord Henry Wotton",
            prompt: "What does Wilde's locative inversion achieve in introducing the portrait?",
            options: [
              "It guides the reader's gaze across the room before unveiling the masterpiece.",
              "It indicates that the painter was absent from the room.",
              "It demonstrates colloquial dialogue."
            ],
            correctIndex: 0,
            botFeedback: "Precisely! Locative inversion controls scenic cinematography."
          }
        ],
        exercises: [
          {
            question: "Which word best matches the meaning of 'extraordinary' in context?",
            options: ["Remarkable / Exceptional", "Ordinary / Common", "Bizarre / Dangerous"],
            correctIndex: 0,
            explanation: "'Extraordinary' denotes remarkably exceptional or superior."
          }
        ]
      },
      {
        id: "daily-bot-evening-en",
        feedSlot: "Evening Literary Masterpiece (20:00)",
        title: "Frankenstein: The Sublime Alpine Solitude",
        author: "Mary Shelley",
        authorEra: "Gothic Romanticism (1818)",
        level: "B2",
        mode: "both",
        duration: "5 min read • 3 min audio",
        targetLanguage: "English",
        isDailyBotFeed: true,
        sourceBook: "SpeakBot 3x Daily Literary Canon",
        coverImage: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
        culturalLinguisticContext: "Mary Shelley uses the sublime mountain landscape of Mont Blanc to mirror Victor Frankenstein's psychological torment.",
        paragraphs: [
          "The desert mountains and dreary glaciers are my refuge. I have wandered here many days; the caves of ice, which I only do not fear, are a dwelling to me.",
          "These sublime and magnificent scenes afforded me the greatest consolation that I was capable of receiving."
        ],
        sentences: [
          {
            text: "The desert mountains and dreary glaciers are my refuge.",
            translation: "Kimsəsiz dağlar və tutqun buzlaqlar mənim sığınacağımdır.",
            literaryNote: "Gothic juxtaposition of inhospitable terrain with the psychological idea of 'refuge'.",
            audioTime: "0:00 - 0:08"
          },
          {
            text: "These sublime and magnificent scenes afforded me the greatest consolation that I was capable of receiving.",
            translation: "Bu əzəmətli və möhtəşəm mənzərələr mənə ala biləcəyim ən böyük təsəllini bəxş edirdi.",
            literaryNote: "'Afforded' functions as a transitive verb meaning 'provided' or 'bestowed'.",
            audioTime: "0:08 - 0:19"
          }
        ],
        keyVocabulary: [
          { word: "dreary", ipa: "/ˈdrɪə.ri/", pos: "adjective", translation: "tutqun, sıxıcı", cefr: "B2", example: "It was a dreary winter morning with thick fog." },
          { word: "refuge", ipa: "/ˈref.juːdʒ/", pos: "noun", translation: "sığınacaq", cefr: "B2", example: "The old library became his refuge from the busy city." },
          { word: "sublime", ipa: "/səˈblaɪm/", pos: "adjective", translation: "əzəmətli, ali", cefr: "C1", example: "The majestic peaks evoked a sense of sublime awe." },
          { word: "consolation", ipa: "/ˌkɒn.səˈleɪ.ʃən/", pos: "noun", translation: "təsəlli", cefr: "B2", example: "Music brought him great consolation during difficult times." }
        ],
        stylisticDevices: [
          { device: "Romantic Sublime", exampleFromText: "sublime and magnificent scenes", explanation: "Evokes grandeur and awe inspired by untamed nature." }
        ],
        conversations: [
          {
            persona: "Mary Shelley",
            prompt: "What does the word 'afforded' mean in 'afforded me the greatest consolation'?",
            options: [
              "Provided or granted",
              "Purchased with money",
              "Delayed or postponed"
            ],
            correctIndex: 0,
            botFeedback: "Exact! In classical prose, 'to afford' often means to provide or bestow naturally."
          }
        ],
        exercises: [
          {
            question: "What part of speech is 'dreary' in 'dreary glaciers'?",
            options: ["Adjective modifying glaciers", "Adverb of place", "Noun subject"],
            correctIndex: 0,
            explanation: "'Dreary' is an adjective qualifying the noun 'glaciers'."
          }
        ]
      }
    ],
    german: [
      {
        id: "daily-bot-morning-de",
        feedSlot: "Morgendliche Klassik (08:00)",
        title: "Goethes Faust: Der Tragödie Erster Teil",
        author: "Johann Wolfgang von Goethe",
        authorEra: "Weimarer Klassik (1808)",
        level: "B1",
        mode: "both",
        duration: "4 min read • 2 min audio",
        targetLanguage: "German",
        isDailyBotFeed: true,
        sourceBook: "SpeakBot 3x Daily Literary Canon",
        coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
        culturalLinguisticContext: "Goethes philosophischer Monolog reflektiert den ewigen menschlichen Drang nach Wissen und die Grenzen der Wissenschaft.",
        paragraphs: [
          "Habe nun, ach! Philosophie, Juristerei und Medizin, und leider auch Theologie durchaus studiert, mit heißem Bemühn.",
          "Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor; heiße Magister, heiße Doktor gar, und ziehe schon an die zehen Jahr herauf, herab und quer und krumm meine Schüler an der Nase herum."
        ],
        sentences: [
          {
            text: "Habe nun, ach! Philosophie, Juristerei und Medizin durchaus studiert.",
            translation: "Bax indi, ah! Fəlsəfə, hüquq və təbabəti dərindən öyrəndim.",
            literaryNote: "Voranstellung des finiten Verbs ('Habe nun...') verleiht dem Monolog dramatische Intensität.",
            audioTime: "0:00 - 0:08"
          },
          {
            text: "Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor.",
            translation: "Bax indi burada dururam, mən zavallı axmaq! Və əvvəlki kimi ağıllıyam (heç nə bilmirəm).",
            literaryNote: "'Tor' ist ein klassisches deutsches Substantiv für einen Narren oder Unwissenden.",
            audioTime: "0:08 - 0:17"
          }
        ],
        keyVocabulary: [
          { word: "der Tor", ipa: "/toːɐ̯/", pos: "noun", translation: "axmaq, nadan kəs", cefr: "B2", example: "Er fühlte sich wie ein armer Tor." },
          { word: "studieren", ipa: "/ʃtuˈdiːʁən/", pos: "verb", translation: "təhsil almaq, öyrənmək", cefr: "A1", example: "Ich studiere deutsche Literatur." },
          { word: "die Theologie", ipa: "/teoloˈɡiː/", pos: "noun", translation: "ilahiyyat", cefr: "B2", example: "Theologie befasst sich mit religiösen Lehren." }
        ],
        stylisticDevices: [
          { device: "Klimax & Ausruf", exampleFromText: "Habe nun, ach! ... durchaus studiert", explanation: "Steigerung der Studienfächer bis zur bitteren Desillusionierung." }
        ],
        conversations: [
          {
            persona: "Goethes Faust",
            prompt: "Was bedeutet die Wendung 'so klug als wie zuvor' im Monolog?",
            options: [
              "Dass alle akademischen Grade das wahre Wesen des Lebens nicht enthüllen konnten.",
              "Dass er seine Prüfungen nicht bestanden hat.",
              "Dass er Arzt werden möchte."
            ],
            correctIndex: 0,
            botFeedback: "Hervorragend! Faust beklagt die Beschränktheit rein theoretischen Buchwissens."
          }
        ],
        exercises: [
          {
            question: "Welches Genus hat das Substantiv 'Tor' im Sinne von 'Narr'?",
            options: ["Maskulinum (der Tor)", "Neutrum (das Tor)", "Femininum (die Tor)"],
            correctIndex: 0,
            explanation: "'Der Tor' = der Narr / Unwissende; im Unterschied zu 'das Tor' = große Tür / Pforte."
          }
        ]
      }
    ]
  };

  return feeds[lang] || feeds.english;
}

// 1. Upload PDF Book & Extract NLP Excerpt to generate interactive Classic Story
app.post("/api/stories/upload-pdf-book", async (req, res) => {
  try {
    const {
      userId = "default-user",
      fileBase64 = "",
      fileText = "",
      fileName = "Custom_Book.pdf",
      bookTitle = "Uploaded Book / Excerpt",
      author = "Uploaded Author",
      targetLanguage = "English",
      mediatorLanguage = "az",
      userLevel = "B1",
      customInstructions = ""
    } = req.body;

    // --- 1. РЕАЛИЗАЦИЯ ЛИМИТА НА РАЗМЕР ФАЙЛА ---
    // Вычисляем примерный размер Base64 строки в Мегабайтах
    if (fileBase64) {
      const approxSizeMb = (fileBase64.length * 0.75) / (1024 * 1024);
      const MAX_ALLOWED_MB = 25; // Безопасный предел для Free-тарифа Render

      if (approxSizeMb > MAX_ALLOWED_MB) {
        return res.status(400).json({
          success: false,
          error: `Размер файла слишком велик (${approxSizeMb.toFixed(1)} MB). Чтобы сервер не упал, лимит для бесплатных аккаунтов составляет ${MAX_ALLOWED_MB} MB. Пожалуйста, сожмите PDF или загрузите только нужную главу в виде .txt.`
        });
      }
    }

    let extractedText = fileText || "";

    // If fileText is empty but fileBase64 is provided, extract from PDF buffer
    if (!extractedText.trim() && fileBase64) {
      try {
        const buffer = Buffer.from(fileBase64, "base64");
        extractedText = await extractTextFromPdfBuffer(buffer);
        console.log(`[PDF Engine] Extracted ${extractedText ? extractedText.length : 0} chars from Base64 PDF buffer.`);
      } catch (pdfErr) {
        console.warn("[PDF Engine] Base64 extraction failed:", pdfErr.message);
        extractedText = "";
      }
    }

    // Проверяем, удалось ли извлечь реальный текст
    let isTextScannedOrEmpty = !extractedText || extractedText.trim().length < 20;
    let cleanedText = "";
    let zippedBookContent = "";

    if (isTextScannedOrEmpty) {
      // Текст не найден (скан или битый файл). Генерируем метку-заглушку для БД.
      console.log(`[PDF Engine] Notice: PDF text layer missing for "${bookTitle}". Activating AI Literary Simulation...`);
      cleanedText = `SIMULATION_PROMPT_TRIGGER: Generate an iconic authentic excerpt from the famous book "${bookTitle}" by "${author}" in ${targetLanguage}.`;
      zippedBookContent = zipText(cleanedText);
    } else {
      // Текст успешно извлечен! Работаем по стандартной схеме
      cleanedText = extractedText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      zippedBookContent = zipText(cleanedText);
    }

    // Эмулируем запись в структуру БД
    const databaseRecordId = `story-custom-pdf-${Date.now()}`;
    const dbMockRecord = {
      id: databaseRecordId,
      title: bookTitle,
      author: author,
      fileName: fileName,
      targetLanguage,
      userLevel,
      zippedContent: zippedBookContent
    };

    // Достаем текст из БД
    const textFromDb = unzipText(dbMockRecord.zippedContent);
    let excerptSlice = "";

    if (textFromDb.startsWith("SIMULATION_PROMPT_TRIGGER:")) {
      // Передаем в Gemini команду воссоздать фрагмент книги
      excerptSlice = textFromDb;
    } else {
      // Вырезаем случайный кусок из реально извлеченного текста
      const words = textFromDb.split(/\s+/);
      const TARGET_WORDS_COUNT = 320;
      if (words.length > TARGET_WORDS_COUNT) {
        const maxStartIndex = words.length - TARGET_WORDS_COUNT;
        const randomStartIndex = Math.floor(Math.random() * maxStartIndex);
        const rawSample = words.slice(randomStartIndex, randomStartIndex + TARGET_WORDS_COUNT).join(" ");

        const firstPeriod = rawSample.indexOf(".");
        const lastPeriod = rawSample.lastIndexOf(".");
        if (firstPeriod !== -1 && lastPeriod > firstPeriod + 100) {
          excerptSlice = rawSample.slice(firstPeriod + 1, lastPeriod + 1).trim();
        } else {
          excerptSlice = rawSample;
        }
      } else {
        excerptSlice = textFromDb;
      }
    }

    console.log(`[SpeakBot PDF Engine] Processed chunk of ${excerptSlice.split(/\s+/).length} words from total ${textFromDb.split(/\s+/).length} words inside "${fileName}". Sending to Gemini...`);

    const aiPrompt = `You are SpeakBot's Chief NLP Literary Pedagogical Engine.
The user uploaded a custom book/story PDF titled "${bookTitle}" by "${author}".
Target Language of Book: ${targetLanguage}
User Target CEFR Level: ${userLevel}
Mediator Language for translations & explanations: ${mediatorLanguage} (e.g. az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English, de: German)

Here is the book chunk or directive: 
"""
${excerptSlice}
(CRITICAL NOTE: If the input starts with 'SIMULATION_PROMPT_TRIGGER:', it means the PDF was an unreadable image scan. In this exact case, you MUST independently recall and generate an iconic, highly accurate, coherent literary 200-300 word chapter/excerpt from the real book "${bookTitle}" by "${author}" in ${targetLanguage} at a CEFR ${userLevel} complexity level, and then perform the standard full NLP tokenization on it as requested below).
"""


Synthesize an interactive Classic Story reading and audio study module based STRICTLY on this excerpt.
Return ONLY valid JSON matching this schema:
{
  "title": "${bookTitle}",
  "author": "${author}",
  "authorEra": "Contemporary / Selected Classic",
  "level": "${userLevel}",
  "mode": "both",
  "duration": "4 min read • 2 min audio",
  "targetLanguage": "${targetLanguage}",
  "culturalLinguisticContext": "2-sentence cultural and linguistic context explaining the style, tone, and grammar in this excerpt.",
  "paragraphs": [
    "Paragraph 1 text from the excerpt",
    "Paragraph 2 text from the excerpt"
  ],
  "sentences": [
    {
      "text": "Exact sentence in ${targetLanguage}",
      "translation": "Accurate, natural translation in ${mediatorLanguage}",
      "literaryNote": "Pedagogical or literary commentary on syntax, phrasing, or rhetoric",
      "audioTime": "0:00 - 0:08"
    }
  ],
  "keyVocabulary": [
    {
      "word": "important word",
      "ipa": "/phonetic/",
      "pos": "noun/verb/adjective/adverb",
      "translation": "translation in ${mediatorLanguage}",
      "cefr": "${userLevel}",
      "example": "Contextual usage sentence in ${targetLanguage}"
    }
  ],
  "stylisticDevices": [
    {
      "device": "Name of literary/grammatical device (e.g. Inversion, Metaphor, SVO Emphasis)",
      "exampleFromText": "quote from excerpt",
      "explanation": "Brief explanation in English/Mediator"
    }
  ],
  "conversations": [
    {
      "persona": "SpeakBot Socratic Mentor",
      "prompt": "Socratic question testing deep comprehension or linguistic nuance of this excerpt",
      "options": [
        "Correct deep interpretation",
        "Plausible but incorrect option",
        "Superficial incorrect option"
      ],
      "correctIndex": 0,
      "botFeedback": "Detailed encouraging feedback explaining why option 1 is correct."
    }
  ],
  "exercises": [
    {
      "question": "Comprehension or grammar in context question regarding this excerpt",
      "options": ["Option A", "Option B", "Option C"],
      "correctIndex": 0,
      "explanation": "Detailed explanation."
    }
  ]
}`;

    let parsedStory = null;
    const rawAiResponse = await callGeminiWithResilience(aiPrompt);

    if (rawAiResponse) {
      try {
        const clean = rawAiResponse.replace(/```json\n?|\n?```/g, "").trim();
        parsedStory = JSON.parse(clean);
      } catch (err) {
        console.warn("[SpeakBot PDF Engine] JSON parse fallback:", err);
      }
    }

    // Fallback if AI was unavailable
    if (!parsedStory || !parsedStory.sentences || parsedStory.sentences.length === 0) {
      const splitSentences = excerptSlice.match(/[^.!?]+[.!?]+/g) || [excerptSlice];
      parsedStory = {
        title: bookTitle,
        author: author,
        authorEra: "Custom Uploaded Excerpt",
        level: userLevel,
        mode: "both",
        duration: "3 min read • 2 min audio",
        targetLanguage: targetLanguage,
        culturalLinguisticContext: `An authentic excerpt from "${bookTitle}" processed for interactive ${targetLanguage} language acquisition.`,
        paragraphs: [excerptSlice],
        sentences: splitSentences.slice(0, 5).map((s, idx) => ({
          text: s.trim(),
          translation: `[${mediatorLanguage.toUpperCase()}] ${s.trim()}`,
          literaryNote: `Syntactic constituent flow analyzed for ${targetLanguage} learners at ${userLevel} level.`,
          audioTime: `0:${String(idx * 7).padStart(2, '0')} - 0:${String((idx + 1) * 7).padStart(2, '0')}`
        })),
        keyVocabulary: (excerptSlice.match(/[\w\u00C0-\u024F\u0400-\u04FF\'-]+/g) || []).slice(0, 4).map(w => ({
          word: w.replace(/[^a-zA-ZäöüÄÖÜßáéíóúÁÉÍÓÚñÑ]/g, ''),
          ipa: `/${w.toLowerCase()}/`,
          pos: "noun",
          translation: `[${mediatorLanguage.toUpperCase()}] ${w}`,
          cefr: userLevel,
          example: `In the excerpt: "${w}" plays a key syntactic role.`
        })),
        stylisticDevices: [
          {
            device: "Narrative Discourse",
            exampleFromText: splitSentences[0] || excerptSlice.slice(0, 40),
            explanation: `Authentic ${targetLanguage} syntax and vocabulary density.`
          }
        ],
        conversations: [
          {
            persona: "SpeakBot Socratic Mentor",
            prompt: `What is the primary thematic tone conveyed in this excerpt from "${bookTitle}"?`,
            options: [
              "Reflective narrative exposition and descriptive imagery.",
              "A technical mathematical manual.",
              "A casual phone text message."
            ],
            correctIndex: 0,
            botFeedback: "Well analyzed! The excerpt establishes descriptive narrative atmosphere."
          }
        ],
        exercises: [
          {
            question: `Which word represents the main topic of the uploaded excerpt from "${bookTitle}"?`,
            options: [words[0] || "Theme", "Unrelated item", "Arbitrary text"],
            correctIndex: 0,
            explanation: "Directly verified against the uploaded text excerpt."
          }
        ]
      };
    }

    const finalStory = {
      ...parsedStory,
      id: `story-custom-pdf-${Date.now()}`,
      isCustomPdf: true,
      sourceBook: fileName,
      uploadedAt: new Date().toISOString(),
      coverImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80"
    };

    if (!userCustomStories[userId]) userCustomStories[userId] = [];
    userCustomStories[userId].unshift(finalStory);

    res.json({
      success: true,
      message: `Successfully processed "${fileName}". Created interactive reading & audio story card!`,
      story: finalStory,
      allCustomStories: userCustomStories[userId]
    });
  } catch (error) {
    console.error("[SpeakBot PDF Engine Error]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process PDF book and generate story."
    });
  }
});

// 2. Get Custom Stories & 3x Daily Bot Excerpt Feeds
app.get("/api/stories/custom-list", (req, res) => {
  const userId = req.query.userId || "default-user";
  const targetLanguage = req.query.targetLanguage || "English";
  const custom = userCustomStories[userId] || [];
  const dailyFeeds = getDailyBotStoryFeeds(targetLanguage);

  res.json({
    success: true,
    customStories: custom,
    dailyFeeds: dailyFeeds,
    timestamp: new Date().toISOString()
  });
});

// 3. Trigger 3x Daily Excerpt on demand
app.post("/api/stories/generate-daily-excerpt", (req, res) => {
  const { targetLanguage = "English", slot = "Morning" } = req.body;
  const feeds = getDailyBotStoryFeeds(targetLanguage);
  const selected = feeds[0] || null;
  res.json({
    success: true,
    feed: selected,
    allFeeds: feeds
  });
});

// 4. Delete a custom story
app.delete("/api/stories/custom-story/:storyId", (req, res) => {
  const userId = req.query.userId || "default-user";
  const { storyId } = req.params;
  if (userCustomStories[userId]) {
    userCustomStories[userId] = userCustomStories[userId].filter(s => s.id !== storyId);
  }
  res.json({
    success: true,
    message: "Custom story removed.",
    remainingStories: userCustomStories[userId] || []
  });
});
app.post("/api/gemini/generate-grammar-roadmap", async (req, res) => {
  const {
    userId = "default-user",
    grammarScore = 70,
    testedConcepts = ["Conditionals", "Inversion", "Subjunctive"],
    targetLanguage = "English",
    mediatorLanguage = "az",
    level = "B1"
  } = req.body;
  try {
    const prompt = `You are SpeakBot's Chief Pedagogical Curriculum Designer.
The learner just finished a Grammar Skill Test for ${targetLanguage} at CEFR Level ${level}.
Test Result: Score = ${grammarScore}%.
Tested Grammar Concepts: ${JSON.stringify(testedConcepts)}.
Mediator Language for explanations: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English).

Generate a STRICTLY PERSONALIZED learning roadmap specifically targeting the gaps and next-level mastery needed based on this test outcome (${grammarScore}%).
If the score is <75%, focus heavily on remedial rules, common pitfalls, and targeted drills.
If the score is >=75%, focus on advanced nuances, stylistic inversion, and formal discourse.

Return strictly JSON with this schema:
{
  "title": "Personalized Grammar Roadmap title",
  "category": "Grammar",
  "level": "${level}",
  "estimatedDuration": "2 Weeks \u2022 4 Milestones",
  "summary": "Brief summary of how this roadmap targets the test results",
  "tags": ["Personalized", "Grammar Test Recovery", "Tested Concepts"],
  "milestones": [
    {
      "step": 1,
      "title": "Milestone Title",
      "description": "Pedagogical objective",
      "grammarPoint": "Rule formula",
      "sampleSentence": "Exemplary sentence",
      "tokens": [
        {
          "text": "word",
          "lemma": "lemma",
          "pos": "NOUN",
          "syntaxRole": "Subject",
          "cefrLevel": "${level}",
          "ipa": "/w\u025C\u02D0d/",
          "mediatorTranslation": "translation in ${mediatorLanguage}"
        }
      ]
    }
  ],
  "checkpointQuestions": [
    {
      "question": "Question testing the weakness",
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "correctIndex": 0,
      "explanation": "Clear explanation"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.milestones) {
        const fullRoadmap = {
          ...parsedData,
          id: `roadmap-personalized-grammar-${Date.now()}`,
          isAiGenerated: true,
          isGrammarPersonalized: true,
          personalizedGrammarMeta: {
            grammarScore,
            testedConcepts,
            generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            targetSkillDelta: `+${Math.max(5, 100 - grammarScore)}% target boost`
          }
        };
        if (!userPersonalizedRoadmaps[userId]) userPersonalizedRoadmaps[userId] = [];
        userPersonalizedRoadmaps[userId].unshift(fullRoadmap);
        return res.json({
          success: true,
          data: fullRoadmap
        });
      }
    }
  } catch (err) {
    console.warn("[SpeakBot Grammar Roadmap] Serving fallback personalized roadmap:", err?.message || err);
  }
  const fallbackPersonalizedRoadmap = getFallbackPersonalizedGrammarRoadmap(
    grammarScore,
    testedConcepts,
    targetLanguage,
    mediatorLanguage,
    level
  );
  if (!userPersonalizedRoadmaps[userId]) userPersonalizedRoadmaps[userId] = [];
  userPersonalizedRoadmaps[userId].unshift(fallbackPersonalizedRoadmap);
  res.json({
    success: true,
    data: fallbackPersonalizedRoadmap,
    fallback: true
  });
});
app.post("/api/gemini/generate-roadmap", async (req, res) => {
  try {
    const {
      topic,
      level = "B1",
      targetLanguage = "English",
      mediatorLanguage = "az",
      customGoal = ""
    } = req.body;
    const ai = getGeminiClient();
    const prompt = `You are the lead linguistic curriculum architect for SpeakBot.
Generate a structured learning Roadmap for a learner studying ${targetLanguage}.
Topic: "${topic}"
Target CEFR Level: ${level}
Learner's Mediator (Instruction) Language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English)
Learner goal: ${customGoal || "Mastery and fluent practical usage"}

Include:
1. Title and engaging description
2. Estimated study duration (e.g. "4 Weeks", "12 Hours")
3. 4 comprehensive milestones/steps with learning objectives, detailed linguistic rules, and practical examples.
4. Key study sentences with full NLP tokenization breakdown for each word (text, lemma, pos, syntaxRole, cefrLevel, ipa, mediatorTranslation).
5. 3 practical checkpoint quiz questions.

Return STRICT JSON adhering to this schema. Do not wrap in markdown quotes if possible or ensure clean json:
{
  "title": "string",
  "category": "Grammar" | "Vocabulary" | "Conversational" | "Tenses" | "Business",
  "level": "${level}",
  "estimatedDuration": "string",
  "summary": "string",
  "milestones": [
    {
      "step": 1,
      "title": "string",
      "description": "string",
      "grammarPoint": "string",
      "sampleSentence": "string",
      "tokens": [
        {
          "text": "string",
          "lemma": "string",
          "pos": "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "AUX" | "DET",
          "syntaxRole": "string",
          "cefrLevel": "string",
          "ipa": "string",
          "mediatorTranslation": "string"
        }
      ]
    }
  ],
  "checkpointQuestions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.milestones) {
        return res.json({
          success: true,
          data: parsedData
        });
      }
    }
    res.json({
      success: true,
      data: getFallbackRoadmap(req.body.topic, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  } catch (error) {
    console.warn("[SpeakBot] Serving fallback roadmap:", error?.message || error);
    res.json({
      success: true,
      data: getFallbackRoadmap(req.body.topic, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  }
});
app.post("/api/gemini/generate-grammar-guide", async (req, res) => {
  try {
    const {
      title,
      level = "B1",
      category = "Grammar",
      mediatorLanguage = "az"
    } = req.body;
    const prompt = `You are SpeakBot's chief grammar and linguistic material creator.
Generate a complete, printable study guide PDF content for:
Topic: "${title}"
Category: ${category}
CEFR Level: ${level}
Mediator Language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English)

Return strict JSON:
{
  "title": "string",
  "category": "${category}",
  "level": "${level}",
  "pagesCount": 3,
  "summary": "string",
  "coreRules": [
    {
      "ruleTitle": "string",
      "explanationInMediator": "string",
      "formula": "string",
      "example": "string",
      "tokens": [
        {
          "text": "string",
          "lemma": "string",
          "pos": "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "AUX" | "DET",
          "syntaxRole": "string",
          "cefrLevel": "string",
          "ipa": "string",
          "mediatorTranslation": "string"
        }
      ]
    }
  ],
  "commonMistakes": [
    {
      "incorrect": "string",
      "correct": "string",
      "reason": "string"
    }
  ],
  "practiceExercises": [
    {
      "instruction": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.coreRules) {
        return res.json({
          success: true,
          data: parsedData
        });
      }
    }
    res.json({
      success: true,
      data: getFallbackGrammarGuide(req.body.title, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  } catch (error) {
    console.warn("[SpeakBot] Serving fallback grammar guide:", error?.message || error);
    res.json({
      success: true,
      data: getFallbackGrammarGuide(req.body.title, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  }
});
app.post("/api/gemini/tokenize", async (req, res) => {
  const { sentence, mediatorLanguage = "az", targetLanguage = "English" } = req.body;
  if (!sentence) {
    return res.status(400).json({ error: "Sentence is required" });
  }
  try {
    const prompt = `You are the lead NLP computational linguist for SpeakBot.
The user is studying ${targetLanguage}.
Analyze this ${targetLanguage} sentence from a deep NLP, syntactic, and morphological perspective: "${sentence}"
Learner mediator (explanation) language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, de: German, fr: French, it: Italian, en: English).

Provide deep morphological, phonological (IPA), and syntactic tokenization for every word token in strict JSON according to ${targetLanguage} grammatical rules:
{
  "tokens": [
    {
      "text": "original word token",
      "lemma": "dictionary base lemma in ${targetLanguage}",
      "pos": "NOUN | VERB | ADJ | ADV | PRON | PREP | CONJ | AUX | DET | PUNCT",
      "syntaxRole": "Subject | Predicate | Direct Object | Indirect Object | Modifier | Prepositional Complement | Determiner | Finite Verb | Non-finite Verb",
      "cefrLevel": "A1 | A2 | B1 | B2 | C1 | C2",
      "ipa": "/phonetic transcription/",
      "mediatorTranslation": "translation into mediator language",
      "morphology": "exact morphological features in ${targetLanguage} (e.g. for German: Substantiv, Kasus, or Verb 3. Person Sing. Präsens; for English: 3rd person singular, etc.)"
    }
  ],
  "syntaxSummary": "Detailed syntactic description explaining the word order, clause architecture, and grammatical structure of this ${targetLanguage} sentence",
  "grammarRulesApplicable": [
    "2-4 authentic grammar directives and rules of ${targetLanguage} governing this sentence (e.g. for German: Verb-Second, Noun Capitalization, Dative/Accusative case governing)"
  ]
}`;
    const rawResult = await callGeminiWithResilience(prompt);
    if (rawResult) {
      const cleanJson = rawResult.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.tokens) && parsed.tokens.length > 0) {
        return res.json({ success: true, data: parsed });
      }
    }
  } catch (err) {
    console.warn("[SpeakBot Tokenizer] Serving linguistic fallback:", err?.message || err);
  }

  const fallbackRules = getLanguageGrammarRulesServer(targetLanguage);
  res.json({
    success: true,
    data: {
      tokens: defaultTokenizeSentence(sentence, mediatorLanguage, targetLanguage),
      syntaxSummary: `Linguistic parsing and morphological decomposition synthesized for ${targetLanguage} by SpeakBot Rule-Engine`,
      grammarRulesApplicable: fallbackRules
    },
    fallback: true
  });
});
function getFallbackRoadmap(topic, level, mediator) {
  return {
    title: topic || "Mastering Advanced English Structures",
    category: "Grammar",
    level: level || "B1",
    estimatedDuration: "3 Weeks \u2022 15 Lessons",
    summary: `Structured comprehensive roadmap designed to elevate your proficiency to ${level} with step-by-step milestones, active tokenized sentences, and interactive checkpoints.`,
    milestones: [
      {
        step: 1,
        title: "Foundational Mechanics & Patterns",
        description: "Understand the underlying structural components and syntax rules.",
        grammarPoint: "Core sentence clauses and verb agreement",
        sampleSentence: "Effective learners consistently analyze linguistic patterns.",
        tokens: [
          { text: "Effective", lemma: "effective", pos: "ADJ", syntaxRole: "Modifier", cefrLevel: "B1", ipa: "/\u026A\u02C8fekt\u026Av/", mediatorTranslation: mediator === "az" ? "Effektiv / t\u0259sirli" : mediator === "ru" ? "\u042D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u0435" : "Effective" },
          { text: "learners", lemma: "learner", pos: "NOUN", syntaxRole: "Subject", cefrLevel: "A2", ipa: "/\u02C8l\u025C\u02D0n\u0259z/", mediatorTranslation: mediator === "az" ? "\xF6yr\u0259n\u0259nl\u0259r" : mediator === "ru" ? "\u0443\u0447\u0430\u0449\u0438\u0435\u0441\u044F" : "learners" },
          { text: "consistently", lemma: "consistently", pos: "ADV", syntaxRole: "Adverbial Modifier", cefrLevel: "B2", ipa: "/k\u0259n\u02C8s\u026Ast\u0259ntli/", mediatorTranslation: mediator === "az" ? "ard\u0131c\u0131l olaraq" : mediator === "ru" ? "\u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E" : "consistently" },
          { text: "analyze", lemma: "analyze", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "B2", ipa: "/\u02C8\xE6n\u0259la\u026Az/", mediatorTranslation: mediator === "az" ? "t\u0259hlil edirl\u0259r" : mediator === "ru" ? "\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u044E\u0442" : "analyze" },
          { text: "linguistic", lemma: "linguistic", pos: "ADJ", syntaxRole: "Attribute", cefrLevel: "C1", ipa: "/l\u026A\u014B\u02C8\u0261w\u026Ast\u026Ak/", mediatorTranslation: mediator === "az" ? "linqvistik / dil\xE7ilik" : mediator === "ru" ? "\u043B\u0438\u043D\u0433\u0432\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435" : "linguistic" },
          { text: "patterns", lemma: "pattern", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B1", ipa: "/\u02C8p\xE6t\u0259nz/", mediatorTranslation: mediator === "az" ? "modell\u0259ri / qanunauy\u011Funluqlar\u0131" : mediator === "ru" ? "\u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B" : "patterns" }
        ]
      },
      {
        step: 2,
        title: "Nuance & Collocations",
        description: "Differentiating subtle register contrasts and natural phrasing in real dialogues.",
        grammarPoint: "Prepositional verb collocations and discourse markers",
        sampleSentence: "We must adapt our communication to diverse contexts.",
        tokens: [
          { text: "We", lemma: "we", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/wi\u02D0/", mediatorTranslation: mediator === "az" ? "Biz" : "We" },
          { text: "must", lemma: "must", pos: "AUX", syntaxRole: "Modal Auxiliary", cefrLevel: "A2", ipa: "/m\u028Cst/", mediatorTranslation: mediator === "az" ? "m\u0259cburuq / -mal\u0131y\u0131q" : "must" },
          { text: "adapt", lemma: "adapt", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "B2", ipa: "/\u0259\u02C8d\xE6pt/", mediatorTranslation: mediator === "az" ? "uy\u011Funla\u015Fd\u0131rmaq" : "adapt" },
          { text: "our", lemma: "our", pos: "DET", syntaxRole: "Possessive Determiner", cefrLevel: "A1", ipa: "/\u02C8a\u028A\u0259/", mediatorTranslation: mediator === "az" ? "bizim" : "our" },
          { text: "communication", lemma: "communication", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B1", ipa: "/k\u0259\u02CCmju\u02D0n\u026A\u02C8ke\u026A\u0283n/", mediatorTranslation: mediator === "az" ? "\xFCnsiyy\u0259timizi" : "communication" }
        ]
      }
    ],
    checkpointQuestions: [
      {
        question: 'Which word in "Effective learners consistently analyze linguistic patterns" acts as the Subject?',
        options: ["Effective", "learners", "consistently", "patterns"],
        correctIndex: 1,
        explanation: '"Learners" is the plural noun performing the action, serving as the grammatical subject.'
      }
    ]
  };
}
function getFallbackGrammarGuide(title, level, mediator) {
  return {
    title: title || "Comprehensive Grammar Study Guide",
    category: "Grammar",
    level: level || "B1",
    pagesCount: 3,
    summary: `Complete grammatical reference breakdown with structural formulas, tokenized sentence breakdowns, and high-frequency exam exercises.`,
    coreRules: [
      {
        ruleTitle: "Rule 1: Syntactic Order and Aspect Precision",
        explanationInMediator: mediator === "az" ? "\u0130ngilis dilind\u0259 c\xFCml\u0259 qurulu\u015Fu ad\u0259t\u0259n M\xFCbt\u0259da + X\u0259b\u0259r + Tamaml\u0131q (SVO) s\u0131ras\u0131na riay\u0259t edir." : "English standard sentences adhere to the Subject + Verb + Object sequence.",
        formula: "Subject + Auxiliary Verb + Main Verb (Aspectual Form) + Object",
        example: "She has completed the complex assessment successfully.",
        tokens: [
          { text: "She", lemma: "she", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/\u0283i\u02D0/", mediatorTranslation: mediator === "az" ? "O (qad\u0131n)" : "She" },
          { text: "has", lemma: "have", pos: "AUX", syntaxRole: "Auxiliary Verb", cefrLevel: "A2", ipa: "/h\xE6z/", mediatorTranslation: mediator === "az" ? "(bitmi\u015Flik k\xF6m\u0259k\xE7isi)" : "has" },
          { text: "completed", lemma: "complete", pos: "VERB", syntaxRole: "Main Verb", cefrLevel: "B1", ipa: "/k\u0259m\u02C8pli\u02D0t\u026Ad/", mediatorTranslation: mediator === "az" ? "tamamlay\u0131b" : "completed" },
          { text: "the", lemma: "the", pos: "DET", syntaxRole: "Definite Article", cefrLevel: "A1", ipa: "/\xF0\u0259/", mediatorTranslation: mediator === "az" ? "m\xFC\u0259yy\u0259nlik artikli" : "the" },
          { text: "complex", lemma: "complex", pos: "ADJ", syntaxRole: "Attribute", cefrLevel: "B2", ipa: "/\u02C8k\u0252mpleks/", mediatorTranslation: mediator === "az" ? "m\xFCr\u0259kk\u0259b" : "complex" },
          { text: "assessment", lemma: "assessment", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B2", ipa: "/\u0259\u02C8sesm\u0259nt/", mediatorTranslation: mediator === "az" ? "qiym\u0259tl\u0259ndirm\u0259ni" : "assessment" },
          { text: "successfully", lemma: "successfully", pos: "ADV", syntaxRole: "Adverbial of Manner", cefrLevel: "B1", ipa: "/s\u0259k\u02C8sesf\u0259li/", mediatorTranslation: mediator === "az" ? "u\u011Furla" : "successfully" }
        ]
      }
    ],
    commonMistakes: [
      {
        incorrect: "She has completed the test yesterday.",
        correct: "She completed the test yesterday.",
        reason: 'Specific past time indicators (like "yesterday") require Simple Past rather than Present Perfect.'
      }
    ],
    practiceExercises: [
      {
        instruction: "Choose the grammatically sound verb aspect for the sentence.",
        question: "By the time the professor arrived, the students _____ their assignment.",
        options: ["already finished", "had already finished", "have already finished", "were finishing"],
        correctIndex: 1,
        explanation: 'The past event occurring prior to another past event requires Past Perfect ("had already finished").'
      }
    ]
  };
}
const SERVER_LEXICON = {
  if: {
    lemma: "if",
    pos: "CONJ",
    syntaxRole: "Subordinating Conjunction",
    cefrLevel: "A1",
    ipa: "/\u026Af/",
    morphology: "Conditional Subordinator",
    translations: { az: "\u0259g\u0259r", ru: "\u0435\u0441\u043B\u0438", tr: "e\u011Fer", es: "si", en: "if" }
  },
  you: {
    lemma: "you",
    pos: "PRON",
    syntaxRole: "Subject",
    cefrLevel: "A1",
    ipa: "/ju\u02D0/",
    morphology: "Personal Pronoun, 2nd Person Nominative",
    translations: { az: "s\u0259n / siz", ru: "\u0442\u044B / \u0432\u044B", tr: "sen / siz", es: "t\xFA / usted", en: "you" }
  },
  consistently: {
    lemma: "consistently",
    pos: "ADV",
    syntaxRole: "Adverbial Modifier",
    cefrLevel: "B2",
    ipa: "/k\u0259n\u02C8s\u026Ast\u0259ntli/",
    morphology: "Manner Adverb, Derived from Adj + -ly",
    translations: { az: "ard\u0131c\u0131l / m\xFCt\u0259madi olaraq", ru: "\u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E", tr: "tutarl\u0131 bir \u015Fekilde", es: "constantemente", en: "consistently" }
  },
  analyze: {
    lemma: "analyze",
    pos: "VERB",
    syntaxRole: "Predicate",
    cefrLevel: "B2",
    ipa: "/\u02C8\xE6n\u0259la\u026Az/",
    morphology: "Verb, Base Form, Active Voice",
    translations: { az: "t\u0259hlil etm\u0259k / analiz etm\u0259k", ru: "\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C", tr: "analiz etmek", es: "analizar", en: "analyze" }
  },
  linguistic: {
    lemma: "linguistic",
    pos: "ADJ",
    syntaxRole: "Attribute / Modifier",
    cefrLevel: "C1",
    ipa: "/l\u026A\u014B\u02C8\u0261w\u026Ast\u026Ak/",
    morphology: "Classifying Adjective",
    translations: { az: "linqvistik / dil\xE7ilik", ru: "\u043B\u0438\u043D\u0433\u0432\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", tr: "dilbilimsel", es: "ling\xFC\xEDstico", en: "linguistic" }
  },
  patterns: {
    lemma: "pattern",
    pos: "NOUN",
    syntaxRole: "Direct Object",
    cefrLevel: "B1",
    ipa: "/\u02C8p\xE6t\u0259nz/",
    morphology: "Count Noun, Plural (-s)",
    translations: { az: "qanunauy\u011Funluqlar / modell\u0259r", ru: "\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u044B / \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B", tr: "kal\u0131plar / desenler", es: "patrones", en: "patterns" }
  },
  your: {
    lemma: "your",
    pos: "DET",
    syntaxRole: "Possessive Determiner",
    cefrLevel: "A1",
    ipa: "/j\u0254\u02D0r/",
    morphology: "Possessive Pronoun/Determiner, 2nd Person",
    translations: { az: "s\u0259nin / sizin", ru: "\u0442\u0432\u043E\u0439 / \u0432\u0430\u0448", tr: "senin / sizin", es: "tu / su", en: "your" }
  },
  conversational: {
    lemma: "conversational",
    pos: "ADJ",
    syntaxRole: "Attribute",
    cefrLevel: "B2",
    ipa: "/\u02CCk\u0252nv\u0259\u02C8se\u026A\u0283\u0259nl/",
    morphology: "Relational Adjective, Derived from Noun + -al",
    translations: { az: "dan\u0131\u015F\u0131q / \xFCnsiyy\u0259t", ru: "\u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u043D\u044B\u0439", tr: "konu\u015Fma diliyle ilgili", es: "conversacional", en: "conversational" }
  },
  fluency: {
    lemma: "fluency",
    pos: "NOUN",
    syntaxRole: "Subject",
    cefrLevel: "B2",
    ipa: "/\u02C8flu\u02D0\u0259nsi/",
    morphology: "Abstract Noun, Non-count",
    translations: { az: "s\u0259lislik / ax\u0131c\u0131l\u0131q", ru: "\u0431\u0435\u0433\u043B\u043E\u0441\u0442\u044C", tr: "ak\u0131c\u0131l\u0131k", es: "fluidez", en: "fluency" }
  },
  will: {
    lemma: "will",
    pos: "AUX",
    syntaxRole: "Modal Auxiliary",
    cefrLevel: "A1",
    ipa: "/w\u026Al/",
    morphology: "Modal Auxiliary, Future Time Reference",
    translations: { az: "-acaq / -\u0259c\u0259k", ru: "\u0431\u0443\u0434\u0435\u0442", tr: "-ecek / -acak", es: "(futuro) / va a", en: "will" }
  },
  improve: {
    lemma: "improve",
    pos: "VERB",
    syntaxRole: "Main Verb / Predicate",
    cefrLevel: "B1",
    ipa: "/\u026Am\u02C8pru\u02D0v/",
    morphology: "Verb, Bare Infinitive with Modal",
    translations: { az: "t\u0259kmill\u0259\u015Fm\u0259k / inki\u015Faf etm\u0259k", ru: "\u0443\u043B\u0443\u0447\u0448\u0430\u0442\u044C\u0441\u044F", tr: "geli\u015Fmek", es: "mejorar", en: "improve" }
  },
  rapidly: {
    lemma: "rapidly",
    pos: "ADV",
    syntaxRole: "Adverbial of Manner",
    cefrLevel: "B2",
    ipa: "/\u02C8r\xE6p\u026Adli/",
    morphology: "Adverb of Manner, Base + -ly",
    translations: { az: "s\xFCr\u0259tl\u0259 / c\u0259ld", ru: "\u0431\u044B\u0441\u0442\u0440\u043E", tr: "h\u0131zla", es: "r\xE1pidamente", en: "rapidly" }
  },
  effective: {
    lemma: "effective",
    pos: "ADJ",
    syntaxRole: "Attribute / Modifier",
    cefrLevel: "B1",
    ipa: "/\u026A\u02C8fekt\u026Av/",
    morphology: "Qualitative Adjective",
    translations: { az: "t\u0259sirli / effektiv", ru: "\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u0439", tr: "etkili", es: "efectivo", en: "effective" }
  },
  learners: {
    lemma: "learner",
    pos: "NOUN",
    syntaxRole: "Subject",
    cefrLevel: "A2",
    ipa: "/\u02C8l\u025C\u02D0n\u0259z/",
    morphology: "Count Noun, Plural, Agentive (-er + -s)",
    translations: { az: "\xF6yr\u0259n\u0259nl\u0259r / t\u0259l\u0259b\u0259l\u0259r", ru: "\u0443\u0447\u0430\u0449\u0438\u0435\u0441\u044F", tr: "\xF6\u011Frenenler", es: "estudiantes", en: "learners" }
  },
  the: {
    lemma: "the",
    pos: "DET",
    syntaxRole: "Determiner",
    cefrLevel: "A1",
    ipa: "/\xF0\u0259/",
    morphology: "Definite Article",
    translations: { az: "m\xFC\u0259yy\u0259nlik artikli", ru: "\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0439 \u0430\u0440\u0442\u0438\u043A\u043B\u044C", tr: "belirtme eki / the", es: "el / la", en: "the" }
  },
  she: {
    lemma: "she",
    pos: "PRON",
    syntaxRole: "Subject",
    cefrLevel: "A1",
    ipa: "/\u0283i\u02D0/",
    morphology: "Personal Pronoun, 3rd Person Singular Female",
    translations: { az: "o (qad\u0131n)", ru: "\u043E\u043D\u0430", tr: "o (kad\u0131n)", es: "ella", en: "she" }
  },
  has: {
    lemma: "have",
    pos: "AUX",
    syntaxRole: "Auxiliary Verb",
    cefrLevel: "A1",
    ipa: "/h\xE6z/",
    morphology: "Auxiliary Verb, 3rd Person Singular Present Perfect Marker",
    translations: { az: "(bitmi\u015Flik k\xF6m\u0259k\xE7isi)", ru: "(\u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0433\u043B\u0430\u0433\u043E\u043B)", tr: "(yard\u0131mc\u0131 fiil)", es: "ha", en: "has" }
  },
  completed: {
    lemma: "complete",
    pos: "VERB",
    syntaxRole: "Main Verb",
    cefrLevel: "B1",
    ipa: "/k\u0259m\u02C8pli\u02D0t\u026Ad/",
    morphology: "Past Participle (-ed), Perfective Aspect",
    translations: { az: "tamamlay\u0131b / bitirib", ru: "\u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B(\u0430)", tr: "tamamlad\u0131", es: "completado", en: "completed" }
  },
  assessment: {
    lemma: "assessment",
    pos: "NOUN",
    syntaxRole: "Direct Object",
    cefrLevel: "B2",
    ipa: "/əˈsesmənt/",
    morphology: "Deverbal Noun (-ment)",
    translations: { az: "qiymətləndirmə", ru: "оценка / тест", tr: "değerlendirme", es: "evaluación", en: "assessment" }
  },
  arbeit: {
    lemma: "Arbeit",
    pos: "NOUN",
    syntaxRole: "Subject / Noun Phrase Head",
    cefrLevel: "A1",
    ipa: "/ˈaʁbaɪt/",
    morphology: "Substantiv, Femininum, Nominativ/Akkusativ",
    translations: { az: "iş / əmək", ru: "работа / труд", tr: "iş / emek", es: "trabajo", de: "Arbeit", en: "work / labor" }
  },
  macht: {
    lemma: "machen",
    pos: "VERB",
    syntaxRole: "Predicate / Finite Verb (V2)",
    cefrLevel: "A1",
    ipa: "/maxt/",
    morphology: "Verb, 3. Person Singular Präsens Indikativ",
    translations: { az: "edir / yaradır", ru: "делает", tr: "yapar / eder", es: "hace", de: "macht", en: "makes / does" }
  },
  mensch: {
    lemma: "Mensch",
    pos: "NOUN",
    syntaxRole: "Direct Object / Predicative Noun",
    cefrLevel: "A1",
    ipa: "/mɛnʃ/",
    morphology: "Substantiv, Maskulinum, Nominativ/Akkusativ",
    translations: { az: "insan / şəxs", ru: "человек", tr: "insan", es: "humano / persona", de: "Mensch", en: "human / person" }
  },
  lernen: {
    lemma: "lernen",
    pos: "VERB",
    syntaxRole: "Predicate / Infinitive",
    cefrLevel: "A1",
    ipa: "/ˈlɛʁnən/",
    morphology: "Verb, Infinitiv Präsens",
    translations: { az: "öyrənmək", ru: "учить / изучать", tr: "öğrenmek", es: "aprender", de: "lernen", en: "learn" }
  },
  erfolg: {
    lemma: "Erfolg",
    pos: "NOUN",
    syntaxRole: "Noun Complement",
    cefrLevel: "B1",
    ipa: "/ɛɐ̯ˈfɔlk/",
    morphology: "Substantiv, Maskulinum, Dativ/Akkusativ",
    translations: { az: "uğur / nailiyyət", ru: "успех", tr: "başarı", es: "éxito", de: "Erfolg", en: "success" }
  },
  sprache: {
    lemma: "Sprache",
    pos: "NOUN",
    syntaxRole: "Noun Phrase Head",
    cefrLevel: "A1",
    ipa: "/ˈʃpʁaːxə/",
    morphology: "Substantiv, Femininum, Nominativ",
    translations: { az: "dil / nitq", ru: "язык / речь", tr: "dil / lisan", es: "idioma", de: "Sprache", en: "language" }
  },
  der: {
    lemma: "der",
    pos: "DET",
    syntaxRole: "Determiner / Artikel",
    cefrLevel: "A1",
    ipa: "/deːɐ̯/",
    morphology: "Bestimmter Artikel",
    translations: { az: "müəyyənlik artikli", ru: "определенный артикль", tr: "belirtme eki", es: "el / la", de: "der", en: "the" }
  },
  die: {
    lemma: "die",
    pos: "DET",
    syntaxRole: "Determiner / Artikel",
    cefrLevel: "A1",
    ipa: "/diː/",
    morphology: "Bestimmter Artikel",
    translations: { az: "müəyyənlik artikli", ru: "определенный артикль", tr: "belirtme eki", es: "la / las", de: "die", en: "the" }
  },
  das: {
    lemma: "das",
    pos: "DET",
    syntaxRole: "Determiner / Artikel",
    cefrLevel: "A1",
    ipa: "/das/",
    morphology: "Bestimmter Artikel",
    translations: { az: "müəyyənlik artikli", ru: "определенный артикль", tr: "belirtme eki", es: "el / lo", de: "das", en: "the" }
  }
};
function getFallbackPersonalizedGrammarRoadmap(grammarScore, testedConcepts = ["Conditionals", "Inversion"], targetLanguage = "English", mediatorLanguage = "az", level = "B1") {
  const needsRemediation = grammarScore < 75;
  const focusTitle = needsRemediation ? `Targeted Grammar Recovery: ${testedConcepts[0] || "Core Syntax"} & Error Prevention` : `Advanced Grammar Mastery: Stylistic Inversion & ${testedConcepts[0] || "Nuanced Structures"}`;
  return {
    id: `roadmap-personalized-grammar-${Date.now()}`,
    title: focusTitle,
    category: "Grammar",
    level,
    estimatedDuration: "2 Weeks \u2022 4 Targeted Milestones",
    summary: `Personalized curriculum generated directly from your recent Grammar Skill Test (${grammarScore}%). It directly targets ${testedConcepts.join(" and ")} to eradicate errors and advance you toward ${level === "B1" ? "B2" : level === "B2" ? "C1" : "C2"} proficiency.`,
    tags: ["Personalized", "Grammar Test Results", level, "Custom Recovery"],
    isAiGenerated: true,
    isGrammarPersonalized: true,
    personalizedGrammarMeta: {
      grammarScore,
      testedConcepts,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      targetSkillDelta: `+${Math.max(6, 100 - grammarScore)}% Score Target`
    },
    milestones: [
      {
        step: 1,
        title: needsRemediation ? "Diagnostic Gap Clarification" : "Stylistic Inversion & Emphatic Fronting",
        description: needsRemediation ? "Pinpoint recurring structural missteps identified in your grammar diagnostic assessment." : "Elevate syntactic complexity through negative adverbial fronting and subject-auxiliary inversion.",
        grammarPoint: needsRemediation ? "Subject-Verb Agreement & Auxiliary Selection formulas" : "Negative Adverb (Seldom / Rarely / Under no circumstances) + Auxiliary + Subject + Verb",
        sampleSentence: needsRemediation ? "The committee has evaluated the preliminary results thoroughly." : "Seldom have we witnessed such remarkable linguistic progression.",
        tokens: defaultTokenizeSentence(
          needsRemediation ? "The committee has evaluated the preliminary results thoroughly." : "Seldom have we witnessed such remarkable linguistic progression.",
          mediatorLanguage
        )
      },
      {
        step: 2,
        title: "Mixed & Inverted Conditionals Mastery",
        description: "Synthesize past hypothetical conditions with present consequential outcomes.",
        grammarPoint: "Third-Second Mixed Conditional: If + Past Perfect, would + bare infinitive",
        sampleSentence: "Had he completed the diagnostic assessment earlier, his learning trajectory would be clearer.",
        tokens: defaultTokenizeSentence(
          "Had he completed the diagnostic assessment earlier, his learning trajectory would be clearer.",
          mediatorLanguage
        )
      },
      {
        step: 3,
        title: "Subjunctive Mood & Mandative Clauses",
        description: "Express formal recommendations, demands, and hypothetical necessities without modal ambiguity.",
        grammarPoint: "Demand verb + that + subject + base form (e.g., recommend that he review...)",
        sampleSentence: "The pedagogical supervisor insisted that the student master the fundamental grammatical paradigms.",
        tokens: defaultTokenizeSentence(
          "The pedagogical supervisor insisted that the student master the fundamental grammatical paradigms.",
          mediatorLanguage
        )
      },
      {
        step: 4,
        title: "Discourse Markers & Complex Synthesis",
        description: "Connect multifaceted argumentative propositions using cohesive syntactic connectors.",
        grammarPoint: "Subordinating concession clauses: Notwithstanding / Inasmuch as / Provided that",
        sampleSentence: "Notwithstanding the intricate syntactic obstacles, consistent deliberate practice ensures fluency.",
        tokens: defaultTokenizeSentence(
          "Notwithstanding the intricate syntactic obstacles, consistent deliberate practice ensures fluency.",
          mediatorLanguage
        )
      }
    ],
    checkpointQuestions: [
      {
        question: "Which sentence correctly demonstrates formal negative fronting based on your test focus?",
        options: [
          "Seldom have I encountered such an intricate grammatical puzzle.",
          "Seldom I have encountered such an intricate grammatical puzzle.",
          "I have encountered seldom such an intricate grammatical puzzle.",
          "Encountered seldom have I such an intricate grammatical puzzle."
        ],
        correctIndex: 0,
        explanation: 'Negative fronting with "Seldom" mandates auxiliary inversion (Seldom have I...).'
      },
      {
        question: "Identify the correct inverted third conditional sentence:",
        options: [
          "Had she reviewed the diagnostic notes, she would have mastered the test.",
          "If she had reviewed the diagnostic notes, she would had mastered the test.",
          "Did she review the diagnostic notes, she would master the test.",
          "Having she reviewed the diagnostic notes, she would have mastered the test."
        ],
        correctIndex: 0,
        explanation: 'Inverted third conditional replaces "If she had" with "Had she reviewed".'
      }
    ]
  };
}
function getLanguageGrammarRulesServer(targetLang = "English") {
  const norm = (targetLang || "English").toLowerCase();
  if (norm.includes("german") || norm.includes("deutsch")) {
    return [
      "German Verb-Second (V2) Word Order in Independent Clauses (Verb-Zweite-Stellung)",
      "Substantive Noun Capitalization (Großschreibung aller Substantive)",
      "Four-Case Declension Paradigm (Kasus: Nominativ, Akkusativ, Dativ, Genitiv)",
      "Subject-Verb Conjugation Agreement (Subjekt-Verb-Kongruenz)"
    ];
  }
  if (norm.includes("spanish") || norm.includes("español")) {
    return [
      "Spanish Canonical SVO Word Order with Flexible Constituent Inversion",
      "Gender and Number Concordance (Concordancia de género y número)",
      "Ser vs. Estar Aspectual and Predicative Distinction",
      "Pro-Drop Subject Pronoun Omission & Inflection"
    ];
  }
  if (norm.includes("french") || norm.includes("français")) {
    return [
      "French SVO Syntactic Core & Preverbal Clitic Placement",
      "Nominal Gender Concord & Definite/Indefinite Article Agreement",
      "Passé Composé vs. Imparfait Aspectual Paradigm"
    ];
  }
  if (norm.includes("italian") || norm.includes("italiano")) {
    return [
      "Italian Pro-Drop Syntax & Flexible Pragmatic Focus Order",
      "Gender-Number Agreement and Articulated Prepositions (Preposizioni articolate)",
      "Verbal Mood and Tense Concordance (Concordanza dei tempi)"
    ];
  }
  if (norm.includes("russian") || norm.includes("русский")) {
    return [
      "Russian Six-Case Morphosyntactic System (Именительный, Родительный, etc.)",
      "Aspectual Verb Differentiation (Совершенный / Несовершенный вид)",
      "Free Expressive Constituent Order Governed by Topic-Focus Articulation"
    ];
  }
  if (norm.includes("turkish") || norm.includes("türkçe")) {
    return [
      "Turkish Agglutinative Morphology & Strict SOV Word Order",
      "Two-fold and Four-fold Vowel Harmony (Büyük ve Küçük Ünlü Uyumu)",
      "Nominal Case Suffix Chaining (İsmin Halleri: Yalın, Belirtme, Yönelme, etc.)"
    ];
  }
  return [
    "Standard English Syntax & Word Order (SVO)",
    "Syntactic Constituent and Dependency Roles",
    "Morphological Inflection & Concord"
  ];
}

function defaultTokenizeSentence(sentence, mediator = "az", targetLanguage = "English") {
  const rawTokens = (sentence || "").match(/[\w\u00C0-\u024F\u0400-\u04FF'-]+|[.,!?;:]/g) || [];
  const normLang = (targetLanguage || "English").toLowerCase();
  const isGerman = normLang.includes("german") || normLang.includes("deutsch");
  const isSpanish = normLang.includes("spanish") || normLang.includes("español");

  return rawTokens.map((rawWord, idx) => {
    const isPunct = /^[.,!?;:]$/.test(rawWord);
    if (isPunct) {
      return {
        text: rawWord,
        lemma: rawWord,
        pos: "PUNCT",
        syntaxRole: "Punctuation Mark",
        cefrLevel: "A1",
        ipa: "",
        mediatorTranslation: "",
        morphology: "Punctuation boundary delimiter"
      };
    }
    const cleanLower = rawWord.toLowerCase().replace(/['’]s$/, "");
    const found = SERVER_LEXICON[cleanLower];
    if (found) {
      return {
        text: rawWord,
        lemma: found.lemma,
        pos: found.pos,
        syntaxRole: found.syntaxRole,
        cefrLevel: found.cefrLevel,
        ipa: found.ipa,
        mediatorTranslation: found.translations[mediator] || found.translations.en || found.translations.de || cleanLower,
        morphology: found.morphology
      };
    }

    let pos = "NOUN";
    let syntaxRole = idx === 0 ? "Subject" : "Constituent";
    let cefrLevel = "B1";
    let lemma = cleanLower;
    let morphology = "Content word";

    if (isGerman) {
      if (/^[A-ZÄÖÜ]/.test(rawWord) && idx > 0) {
        pos = "NOUN";
        syntaxRole = "Noun Phrase Head";
        lemma = rawWord;
        morphology = "Substantiv (Großschreibung)";
      } else if (/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|dieser|diese|dieses|jeder|jede)$/i.test(cleanLower)) {
        pos = "DET";
        syntaxRole = "Determiner / Artikel";
        cefrLevel = "A1";
        morphology = "Bestimmter/Unbestimmter Artikel";
      } else if (/^(in|an|auf|für|mit|von|zu|aus|bei|nach|über|unter|durch|ohne|um|vor|zwischen|hinter|neben)$/i.test(cleanLower)) {
        pos = "PREP";
        syntaxRole = "Präpositionalphrase Head";
        cefrLevel = "A1";
        morphology = "Präposition mit Kasusbindung";
      } else if (/^(und|oder|aber|denn|weil|dass|daß|wenn|ob|obwohl|als|wie|während)$/i.test(cleanLower)) {
        pos = "CONJ";
        syntaxRole = "Konjunktion / Bindewort";
        cefrLevel = "A2";
        morphology = "Konjunktion";
      } else if (/^(ich|du|er|sie|es|wir|ihr|sie|ihnen|mich|dich|ihn|ihm|uns|euch|mein|dein|sein|unser|euer)$/i.test(cleanLower)) {
        pos = "PRON";
        syntaxRole = idx === 0 ? "Subjekt (Pronomen)" : "Pronomen Komplement";
        cefrLevel = "A1";
        morphology = "Personalpronomen / Possessivpronomen";
      } else if (/^(ist|sind|war|waren|sei|sein|haben|hat|hatte|hatten|wird|werden|wurde|kann|können|muss|müssen|will|wollen|soll|sollen|darf|dürfen)$/i.test(cleanLower)) {
        pos = "AUX";
        syntaxRole = "Hilfsverb / Modalverb (V2)";
        cefrLevel = "A1";
        morphology = "Hilfsverb / Modalverb";
      } else if (/(en|t|te|ten|st)$/i.test(cleanLower) && idx === 1) {
        pos = "VERB";
        syntaxRole = "Finites Verb (Prädikat / V2)";
        lemma = cleanLower.replace(/(t|te|ten|st)$/, "en");
        cefrLevel = "A2";
        morphology = "Verbform im Prädikat";
      } else if (/(lich|ig|isch|bar|sam|haft)$/i.test(cleanLower)) {
        pos = "ADJ";
        syntaxRole = "Attribut / Adjektiv";
        cefrLevel = "B1";
        morphology = "Adjektiv";
      }
    } else if (isSpanish) {
      if (/^(el|la|los|las|un|una|unos|unas|este|esta|estos|estas|ese|esa)$/i.test(cleanLower)) {
        pos = "DET";
        syntaxRole = "Determinante / Artículo";
        cefrLevel = "A1";
        morphology = "Artículo";
      } else if (/^(en|de|a|por|para|con|sin|sobre|hacia|desde|hasta|entre)$/i.test(cleanLower)) {
        pos = "PREP";
        syntaxRole = "Preposición";
        cefrLevel = "A1";
        morphology = "Preposición";
      } else if (/^(y|e|o|u|pero|porque|si|que|aunque|cuando|mientras)$/i.test(cleanLower)) {
        pos = "CONJ";
        syntaxRole = "Conjunción";
        cefrLevel = "A1";
        morphology = "Conjunción";
      } else if (/^(yo|tú|él|ella|nosotros|vosotros|ellos|ellas|me|te|se|nos|mi|tu|su)$/i.test(cleanLower)) {
        pos = "PRON";
        syntaxRole = idx === 0 ? "Sujeto" : "Complemento";
        cefrLevel = "A1";
        morphology = "Pronombre";
      } else if (/^(es|son|era|eran|fue|fueron|está|están|estaba|he|has|ha|hemos|han|puede|debe)$/i.test(cleanLower)) {
        pos = "AUX";
        syntaxRole = "Verbo Auxiliar / Cópula";
        cefrLevel = "A1";
        morphology = "Auxiliar";
      } else if (/mente$/i.test(cleanLower)) {
        pos = "ADV";
        syntaxRole = "Modificador Adverbial";
        lemma = cleanLower.replace(/mente$/, "");
        cefrLevel = "B2";
        morphology = "Adverbio en -mente";
      } else if (/(ar|er|ir|ado|ido|ando|iendo|aron|ieron|ó|ió)$/i.test(cleanLower)) {
        pos = "VERB";
        syntaxRole = "Núcleo del Predicado";
        cefrLevel = "B1";
        morphology = "Forma Verbal";
      }
    } else {
      if (/^(the|a|an|this|that|these|those|every|each|some|any)$/i.test(cleanLower)) {
        pos = "DET";
        syntaxRole = "Determiner";
        cefrLevel = "A1";
        morphology = "Determiner";
      } else if (/^(in|on|at|by|for|with|about|against|between|into|through|during|before|after|above|below|to|from|over|under)$/i.test(cleanLower)) {
        pos = "PREP";
        syntaxRole = "Prepositional Head";
        cefrLevel = "A1";
        morphology = "Preposition";
      } else if (/^(and|but|or|so|yet|because|although|since|while|if|unless)$/i.test(cleanLower)) {
        pos = "CONJ";
        syntaxRole = "Conjunction / Connector";
        cefrLevel = "A2";
        morphology = "Conjunction";
      } else if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|their|our)$/i.test(cleanLower)) {
        pos = "PRON";
        syntaxRole = idx === 0 ? "Subject" : "Pronoun Complement";
        cefrLevel = "A1";
        morphology = "Personal / Possessive Pronoun";
      } else if (/^(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must)$/i.test(cleanLower)) {
        pos = "AUX";
        syntaxRole = "Auxiliary Verb / Copula";
        cefrLevel = "A1";
        morphology = "Auxiliary / Modal";
      } else if (/ly$/i.test(cleanLower)) {
        pos = "ADV";
        syntaxRole = "Adverbial Modifier";
        lemma = cleanLower.replace(/ly$/, "");
        cefrLevel = "B2";
        morphology = "Derived Adverb of Manner";
      } else if (/(ed|ing)$/i.test(cleanLower)) {
        pos = "VERB";
        syntaxRole = "Predicate / Verb Form";
        lemma = cleanLower.replace(/(ed|ing)$/, "");
        cefrLevel = "B1";
        morphology = cleanLower.endsWith("ing") ? "Present Participle / Gerund" : "Past Participle / Simple Past";
      } else if (/(tion|sion|ity|ment|ness|ance|ence)$/i.test(cleanLower)) {
        pos = "NOUN";
        syntaxRole = "Noun Phrase Head";
        cefrLevel = "B2";
        morphology = "Nominal Suffixation";
      } else if (/(ful|ous|ive|able|ible|al|ic)$/i.test(cleanLower)) {
        pos = "ADJ";
        syntaxRole = "Attribute / Modifier";
        cefrLevel = "B1";
        morphology = "Adjectival Suffixation";
      }
    }

    return {
      text: rawWord,
      lemma,
      pos,
      syntaxRole,
      cefrLevel,
      ipa: `/${cleanLower}/`,
      mediatorTranslation: `${cleanLower}`,
      morphology
    };
  });
}

// -------------------------------------------------------------
// Polyhedral 3D Cube Tetris & Games Endpoints
// -------------------------------------------------------------
const CUBEWORD_TARGET_QUESTS = {
  english: [
    { word: "ADVENTURE".slice(0, 8), meaning: "An exciting journey", hint: "A bold, exciting undertaking", emoji: "🧭" },
    { word: "HARMONY", meaning: "Pleasing arrangement of parts", hint: "Concord, peaceful agreement", emoji: "🎶" },
    { word: "JOURNEY", meaning: "Traveling from one place to another", hint: "An expedition or voyage", emoji: "🚀" },
    { word: "WISDOM", meaning: "Quality of having experience and knowledge", hint: "Good judgment and deep insight", emoji: "🦉" },
    { word: "COURAGE", meaning: "Strength in the face of pain or grief", hint: "Bravery, mental resilience", emoji: "🦁" },
    { word: "SUNLIGHT", meaning: "Direct light of the sun", hint: "Warm morning radiance", emoji: "☀️" },
    { word: "FREEDOM", meaning: "The power to act or speak freely", hint: "Liberty, unconstrained action", emoji: "🕊️" },
    { word: "EXPLORE", meaning: "Inquire into or discuss in detail", hint: "Discover unfamiliar territories", emoji: "🔍" },
  ],
  russian: [
    { word: "ДРУЖБА", meaning: "Близкие отношения, основанные на взаимном доверии", hint: "Связь между верными друзьями", emoji: "🤝" },
    { word: "СОЛНЦЕ", meaning: "Центральное светило нашей системы", hint: "Дарит дневной свет и тепло", emoji: "☀️" },
    { word: "РАДОСТЬ", meaning: "Чувство удовольствия и веселья", hint: "Светлая душевная эмоция", emoji: "✨" },
    { word: "МУДРОСТЬ", meaning: "Глубокий ум, опирающийся на жизненный опыт", hint: "Рассудительность и проницательность", emoji: "🦉" },
    { word: "СВОБОДА", meaning: "Состояние независимости и воли", hint: "Возможность действовать по своей воле", emoji: "🕊️" },
    { word: "НАДЕЖДА", meaning: "Вера в лучшее будущее", hint: "Оптимистичное ожидание перемен", emoji: "🌱" },
  ],
  spanish: [
    { word: "AMISTAD", meaning: "Afecto personal, puro y desinteresado", hint: "Vínculo entrañable entre personas", emoji: "🤝" },
    { word: "LIBERTAD", meaning: "Facultad de obrar de una manera u otra", hint: "Independencia y autodeterminación", emoji: "🕊️" },
    { word: "VALENTIA", meaning: "Eficacia y valor en las acciones", hint: "Coraje y determinación frente al reto", emoji: "🦁" },
    { word: "ALEGRIA", meaning: "Sentimiento grato y vivo de placer", hint: "Emoción luminosa y gozosa", emoji: "✨" },
    { word: "ESPERANZA", meaning: "Estado de ánimo optimista hacia el porvenir", hint: "Confianza en días mejores", emoji: "🌱" },
  ],
  german: [
    { word: "FREUNDE", meaning: "Enge menschliche Verbindung und Vertrauen", hint: "Was gute Weggefährten verbindet", emoji: "🤝" },
    { word: "FREIHEIT", meaning: "Zustand der Ungebundenheit und Selbstbestimmung", hint: "Das Recht auf freie Entfaltung", emoji: "🕊️" },
    { word: "WEISHEIT", meaning: "Auf Lebenserfahrung beruhende Einsicht", hint: "Tiefes Verstehen der Zusammenhänge", emoji: "🦉" },
    { word: "HOFFNUNG", meaning: "Zuversichtliche innerliche Ausrichtung", hint: "Glaube an eine gelingende Zukunft", emoji: "🌱" },
  ],
  french: [
    { word: "AMITIE", meaning: "Affection réciproque entre deux personnes", hint: "Lien fraternel et sincère", emoji: "🤝" },
    { word: "LIBERTE", meaning: "Pouvoir d'agir sans contrainte", hint: "Idéal d'indépendance humaine", emoji: "🕊️" },
    { word: "SAGESSE", meaning: "Connaissance profonde et mesure", hint: "Modération et discernement lucide", emoji: "🦉" },
    { word: "COURAGE", meaning: "Force morale devant le danger", hint: "Bravoure et détermination résolue", emoji: "🦁" },
  ],
  italian: [
    { word: "AMICIZIA".slice(0, 8), meaning: "Sentimento di vivo affetto tra persone", hint: "Intesa profonda e leale", emoji: "🤝" },
    { word: "LIBERTA", meaning: "Stato di chi non è soggetto a costrizioni", hint: "Diritto inalienabile dell'individuo", emoji: "🕊️" },
    { word: "CORAGGIO", meaning: "Forza d'animo nell'affrontare le difficoltà", hint: "Ardimento di fronte alla sfida", emoji: "🦁" },
  ],
};

app.get("/api/cubeword/target-words", (req, res) => {
  const language = (req.query.language || "english").toLowerCase();
  const mediatorLanguage = (req.query.mediatorLanguage || "en").toLowerCase();
  const minLength = Number(req.query.minLength) || 4;
  const maxLength = Number(req.query.maxLength) || 8;

  const list = CUBEWORD_TARGET_QUESTS[language] || CUBEWORD_TARGET_QUESTS.english;
  const filtered = list.filter(q => q.word.length >= minLength && q.word.length <= maxLength);

  res.json({
    quests: filtered.length > 0 ? filtered : list
  });
});

app.get("/api/cubeword/block-faces", (req, res) => {
  const language = (req.query.language || "english").toLowerCase();
  const targetWord = (req.query.targetWord || "").toUpperCase();

  const vowelsEn = ["A", "E", "I", "O", "U"];
  const consonantsEn = ["T", "N", "S", "R", "L", "D", "C", "M", "P", "B", "K", "G", "F", "V", "W", "H"];

  const vowelsRu = ["А", "Е", "И", "О", "У", "Ы", "Э", "Я"];
  const consonantsRu = ["Б", "В", "Г", "Д", "Ж", "З", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "Ф", "Х", "Ц", "Ч", "Ш"];

  const vowels = language.includes("russ") ? vowelsRu : vowelsEn;
  const consonants = language.includes("russ") ? consonantsRu : consonantsEn;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let front = targetWord ? targetWord[Math.floor(Math.random() * targetWord.length)] : pick(vowels);

  const faces = {
    front,
    back: pick(consonants),
    top: pick(consonants),
    bottom: pick(vowels),
    left: pick(consonants),
    right: pick(consonants),
  };

  res.json({ faces });
});

app.post("/api/cubeword/verify", async (req, res) => {
  const { word, language = "english", mediatorLanguage = "en", recentWords = [], round = 1, targetWord = "" } = req.body;
  if (!word) {
    return res.status(400).json({ isValid: false, reason: "No word provided" });
  }

  const clean = word.trim().toUpperCase();

  // Check recent repeats
  if (recentWords.map(w => w.toUpperCase()).includes(clean)) {
    return res.json({
      isValid: false,
      word: clean,
      reason: "Word was already recognized in recent rounds (anti-repetition rule)",
      points: 0,
      bonusMultiplier: 1,
    });
  }

  const isTarget = targetWord && clean === targetWord.toUpperCase();
  const points = clean.length >= 10 ? 20 : 10;
  const isComplex = clean.length >= 7;
  const bonusMultiplier = isTarget ? 5 : (clean.length >= 10 || isComplex ? 2 : 1);

  // Quick offline check
  const serverLexiconEntry = SERVER_LEXICON[clean.toLowerCase()];
  if (serverLexiconEntry) {
    const localizedDef = serverLexiconEntry.translations?.[mediatorLanguage] || serverLexiconEntry.translations?.en || `Valid ${language} vocabulary word`;
    return res.json({
      isValid: true,
      word: clean,
      partOfSpeech: serverLexiconEntry.pos || "NOUN",
      definition: localizedDef,
      ipa: serverLexiconEntry.ipa || "",
      isComplexTerm: isComplex,
      points: points * bonusMultiplier,
      bonusMultiplier,
    });
  }

  // Gemini AI validation
  try {
    const prompt = `You are an expert lexicographer validating word formation in a fast 3D word puzzle game.
Target Language (the language the word is formed in): ${language}
Word Candidate: "${clean}"
Player's UI/Mediator Language (for the definition): ${mediatorLanguage}

Validate if "${clean}" is an authentic dictionary word or inflected form in ${language}.
Provide the definition translated into the player's UI/mediator language (${mediatorLanguage}).
Return strict JSON:
{
  "isValid": true | false,
  "word": "${clean}",
  "partOfSpeech": "noun | verb | adjective | adverb | expression",
  "definition": "concise meaning in ${mediatorLanguage} (max 12 words)",
  "ipa": "/phonetic transcription/",
  "isComplexTerm": true | false
}`;

    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const cleanJson = raw.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed.isValid === "boolean") {
        return res.json({
          ...parsed,
          word: clean,
          points: parsed.isValid ? points * bonusMultiplier : 0,
          bonusMultiplier: parsed.isValid ? bonusMultiplier : 1,
        });
      }
    }
  } catch (err) {
    console.warn("[CubeWord AI Verify] fallback note:", err?.message || err);
  }

  // Fallback: accept 3+ letter non-repetitive tokens with vowels
  const hasVowels = /[AEIOUYАЕЁИОУЫЭЮЯ]/i.test(clean);
  const isValid = clean.length >= 3 && hasVowels;

  return res.json({
    isValid,
    word: clean,
    partOfSpeech: "noun",
    definition: `Authentic vocabulary term (${language})`,
    ipa: `/${clean.toLowerCase()}/`,
    isComplexTerm: isComplex,
    points: isValid ? points * bonusMultiplier : 0,
    bonusMultiplier: isValid ? bonusMultiplier : 1,
  });
});

app.get("/api/cubeword/generate-special-word", async (req, res) => {
  const { language = "english", mediatorLanguage = "en", minLength = 5, maxLength = 8 } = req.query;
  try {
    const prompt = `Generate 1 evocative, inspiring dictionary word in Target Language: ${language} between ${minLength} and ${maxLength} letters for a 3D word game quest.
The word itself must be in ${language}.
The meaning and playful hint must be translated into the player's UI/Mediator Language (${mediatorLanguage}).
Return strict JSON:
{
  "quest": {
    "word": "STRING_IN_UPPERCASE_IN_${language.toUpperCase()}",
    "meaning": "Short meaning in ${mediatorLanguage} (max 8 words)",
    "hint": "Playful clue in ${mediatorLanguage} (max 10 words)",
    "emoji": "Single relevant emoji"
  }
}`;
    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const cleanJson = raw.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed?.quest?.word) {
        return res.json(parsed);
      }
    }
  } catch { }

  const defaults = CUBEWORD_TARGET_QUESTS[language] || CUBEWORD_TARGET_QUESTS.english;
  const randomQuest = defaults[Math.floor(Math.random() * defaults.length)];
  res.json({ quest: randomQuest });
});

app.post("/api/user/sync-game-xp", (req, res) => {
  const { gameType, score = 0, xp = 10, wordCount = 1 } = req.body;
  const user = syncedUsersDatabase["default-user"];

  const currentVocab = user.skillScores.vocabulary || 65;
  const updatedVocab = Math.min(100, currentVocab + Math.max(1, Math.round(score / 50)));

  user.skillScores.vocabulary = updatedVocab;
  user.skillLevels.vocabulary.score = updatedVocab;
  user.lastSyncedAt = new Date().toISOString();

  res.json({
    success: true,
    message: `Synced ${xp} XP and +${Math.round(score / 50)} Vocabulary skill from ${gameType}`,
    data: user
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = currentDirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SpeakBot Server] Running on http://0.0.0.0:${PORT}`);
  });
}
startServer();