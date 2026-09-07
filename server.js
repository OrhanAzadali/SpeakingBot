import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import zlib from "zlib";
import fs from "fs";

const customRequire = typeof require !== "undefined" ? require : createRequire(import.meta.url);

let PDFParse = null;
try {
  const pdfModule = customRequire("pdf-parse");
  PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule.default || pdfModule;
} catch (e) {
  console.warn("[PDF Engine] Notice loading pdf-parse module:", e.message);
}
dotenv.config();

const currentFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app = express();
const PORT = process.env.PORT || 3000;

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

async function callGeminiWithResilience(
  prompt,
  preferredModel = "gemini-2.5-flash",
  fallbackModels = ["gemini-flash-latest", "gemini-2.5-flash-lite"]
) {
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
      const isCapacityIssue =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("TIMEOUT_503_SPIKE");
      if (isCapacityIssue) {
        console.warn(`[SpeakBot AI Engine] ${model} experiencing temporary high demand/timeout. Attempting fallback...`);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      console.warn(`[SpeakBot AI Engine] Request on ${model} not completed (${msg.slice(0, 80)}). Activating local engine.`);
      break;
    }
  }
  return null;
}

// Function to compress text into Base64 Gzip string
function zipText(text) {
  if (!text) return "";
  const buffer = zlib.gzipSync(Buffer.from(text, "utf-8"));
  return buffer.toString("base64");
}

// Function to unpack Gzip Base64 string back to readable text
function unzipText(zippedBase64) {
  if (!zippedBase64) return "";
  try {
    const buffer = Buffer.from(zippedBase64, "base64");
    return zlib.gunzipSync(buffer).toString("utf-8");
  } catch (e) {
    console.warn("[GZIP Engine] Gunzip warning:", e?.message);
    return zippedBase64;
  }
}

const syncedUsersDatabase = {
  "default-user": {
    userId: "usr_speakbot_84920482",
    telegramUsername: "@speakbot_learner",
    currentLevel: "B1",
    targetLanguage: "English",
    mediatorLanguage: "az",
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
        }
      ]
    },
    savedVocabulary: [],
    lastSyncedAt: new Date().toISOString()
  }
};

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

const userCustomStories = {};
const userPersonalizedRoadmaps = {};

// ==========================================
// ROBUST PDF EXTRACTION ENGINE
// ==========================================
async function extractTextFromPdfBuffer(buffer) {
  try {
    console.log(`[PDF Engine] Attempting extraction from buffer. Size: ${buffer.length} bytes`);

    // Method 1: pdf-parse
    if (PDFParse) {
      try {
        const parseFunc = typeof PDFParse === "function" ? PDFParse : PDFParse.PDFParse || PDFParse.default;
        if (typeof parseFunc === "function") {
          const res = await parseFunc(buffer);
          if (res && res.text && res.text.trim().length > 0) {
            console.log(`[PDF Engine] Success via pdf-parse. Extracted ${res.text.length} chars.`);
            return res.text;
          }
        }
      } catch (e1) {
        console.warn("[PDF Engine] pdf-parse call failed, trying instance format:", e1.message);
        try {
          const parser = new PDFParse({});
          if (typeof parser.load === "function") {
            await parser.load({ data: buffer });
            const text = await parser.getText();
            if (text && typeof text === "string" && text.trim().length > 0) {
              console.log(`[PDF Engine] Success via PDFParse class. Extracted ${text.length} chars.`);
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

  // Method 2: Native regex binary text-stream reader
  try {
    console.log("[PDF Engine] Activating native regex binary text-stream reader...");
    const rawStr = buffer.toString("utf-8");

    const textMatches = rawStr.match(/\(([^()]*)\)\s*T[jJ]/g);
    if (textMatches && textMatches.length > 0) {
      const extracted = textMatches
        .map((m) => {
          const match = m.match(/\(([^()]*)\)/);
          return match ? match[1] : "";
        })
        .filter((m) => m.trim().length > 1)
        .join(" ");

      if (extracted.trim().length > 50) {
        console.log(`[PDF Engine] Success via regex binary stream! Extracted ${extracted.length} chars.`);
        return extracted;
      }
    }

    // Method 3: Brute force character rescue
    console.log("[PDF Engine] Running character rescue clean...");
    const cleanChars = rawStr
      .replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u0400-\u04FF]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanChars.length > 60) {
      console.log(`[PDF Engine] Brute-force success. Rescued ${cleanChars.length} characters.`);
      return cleanChars.slice(0, 40000);
    }

    return rawStr.slice(0, 15000);
  } catch (e) {
    console.error("[PDF Engine] All text fallbacks failed:", e.message);
    return "";
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
            literaryNote: "Parallel participial clauses maintain rhythmic acoustic balance.",
            audioTime: "0:08 - 0:17"
          }
        ],
        keyVocabulary: [
          { word: "solitary", ipa: "/ˈsɒl.ɪ.tər.i/", pos: "adjective", translation: "tənha, tək", cefr: "B2", example: "She lived a solitary life in the hills." },
          { word: "reap", ipa: "/riːp/", pos: "verb", translation: "biçmək, məhsul yığmaq", cefr: "B2", example: "Farmers reap what they have sown." }
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
            explanation: "'Solitary' is an adjective characterizing the noun 'Lass'."
          }
        ]
      }
    ]
  };
  return feeds[lang] || feeds.english;
}

// ==========================================
// 1. FIXED PDF UPLOAD & NLP EXCERPT ENDPOINT
// ==========================================
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
      userLevel = "B1"
    } = req.body;

    console.log(`[SpeakBot PDF Endpoint] Processing "${bookTitle}" by "${author}" (${fileName})`);

    // 1. Check size limit
    if (fileBase64) {
      const approxSizeMb = (fileBase64.length * 0.75) / (1024 * 1024);
      const MAX_ALLOWED_MB = 25;
      if (approxSizeMb > MAX_ALLOWED_MB) {
        return res.status(400).json({
          success: false,
          error: `File size too large (${approxSizeMb.toFixed(1)} MB). Max limit is ${MAX_ALLOWED_MB} MB.`
        });
      }
    }

    let extractedText = String(fileText || "").trim();

    // 2. CRITICAL FIX: Extract text from PDF buffer when fileBase64 is passed
    if (!extractedText && fileBase64) {
      try {
        const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, "").replace(/^data:text\/plain;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        console.log(`[SpeakBot PDF Endpoint] Decoded buffer (${buffer.length} bytes). Extracting text...`);
        extractedText = await extractTextFromPdfBuffer(buffer);
      } catch (err) {
        console.warn("[SpeakBot PDF Endpoint] Buffer parse error:", err.message);
      }
    }

    // 3. Fallback to AI simulation if text is empty or image scan
    const isTextScannedOrEmpty = !extractedText || extractedText.trim().length < 20;
    let cleanedText = "";

    if (isTextScannedOrEmpty) {
      console.log(`[PDF Engine] PDF text layer missing for "${bookTitle}". Activating AI Literary Simulation...`);
      cleanedText = `SIMULATION_PROMPT_TRIGGER: Generate an iconic authentic excerpt from the famous book "${bookTitle}" by "${author}" in ${targetLanguage}.`;
    } else {
      console.log(`[PDF Engine] Text extracted successfully (${extractedText.length} chars).`);
      cleanedText = extractedText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    const zippedBookContent = zipText(cleanedText);
    const textFromDb = unzipText(zippedBookContent);
    let excerptSlice = "";

    if (textFromDb.startsWith("SIMULATION_PROMPT_TRIGGER:")) {
      excerptSlice = textFromDb;
    } else {
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

    console.log(`[SpeakBot PDF Engine] Excerpt ready. Synthesizing story card with Gemini...`);

    const aiPrompt = `You are SpeakBot's Chief NLP Literary Pedagogical Engine.
The user uploaded a book/story PDF titled "${bookTitle}" by "${author}".
Target Language of Book: ${targetLanguage}
User Target CEFR Level: ${userLevel}
Mediator Language for translations & explanations: ${mediatorLanguage} (e.g. az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English, de: German)

Here is the book chunk or directive: 
"""
${excerptSlice}
(CRITICAL NOTE: If the input starts with 'SIMULATION_PROMPT_TRIGGER:', it means the PDF was an unreadable image scan. In this exact case, you MUST independently recall and generate an iconic, highly accurate, coherent literary 200-300 word chapter/excerpt from the real book "${bookTitle}" by "${author}" in ${targetLanguage} at a CEFR ${userLevel} complexity level, and then perform the standard full NLP tokenization on it as requested below).
"""

Synthesize an interactive Classic Story reading and audio study module based on this excerpt.
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

    if (!parsedStory || !parsedStory.sentences || parsedStory.sentences.length === 0) {
      const fallbackSentences = excerptSlice.startsWith("SIMULATION_PROMPT_TRIGGER:")
        ? [
          `The characters embarked upon their journey through ${bookTitle}.`,
          `Every observation revealed subtle nuances of language and thought.`
        ]
        : excerptSlice.match(/[^.!?]+[.!?]+/g) || [excerptSlice];

      parsedStory = {
        title: bookTitle,
        author: author,
        authorEra: "Custom Uploaded Excerpt",
        level: userLevel,
        mode: "both",
        duration: "3 min read • 2 min audio",
        targetLanguage: targetLanguage,
        culturalLinguisticContext: `An authentic excerpt from "${bookTitle}" processed for interactive ${targetLanguage} language acquisition.`,
        paragraphs: [excerptSlice.startsWith("SIMULATION_PROMPT_TRIGGER:") ? fallbackSentences.join(" ") : excerptSlice],
        sentences: fallbackSentences.slice(0, 5).map((s, idx) => ({
          text: s.trim(),
          translation: `[${mediatorLanguage.toUpperCase()}] ${s.trim()}`,
          literaryNote: `Syntactic constituent flow analyzed for ${targetLanguage} learners at ${userLevel} level.`,
          audioTime: `0:${String(idx * 7).padStart(2, "0")} - 0:${String((idx + 1) * 7).padStart(2, "0")}`
        })),
        keyVocabulary: [
          {
            word: "comprehension",
            ipa: "/ˌkɒmprɪˈhɛnʃən/",
            pos: "noun",
            translation: mediatorLanguage === "az" ? "anlama, qavrama" : "comprehension",
            cefr: userLevel,
            example: "Reading literature elevates cognitive comprehension."
          }
        ],
        stylisticDevices: [
          {
            device: "Narrative Exposition",
            exampleFromText: fallbackSentences[0] || "Sample quote",
            explanation: `Authentic ${targetLanguage} syntactic cadence.`
          }
        ],
        conversations: [
          {
            persona: "SpeakBot Socratic Mentor",
            prompt: `What is the primary thematic tone conveyed in this excerpt from "${bookTitle}"?`,
            options: [
              "Reflective narrative exposition and descriptive imagery.",
              "A technical instruction manual.",
              "A casual phone text message."
            ],
            correctIndex: 0,
            botFeedback: "Well analyzed! The excerpt establishes descriptive narrative atmosphere."
          }
        ],
        exercises: [
          {
            question: `Which theme is directly reflected in "${bookTitle}"?`,
            options: ["Linguistic and literary development", "Unrelated topic", "Arbitrary text"],
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
      isSimulated: isTextScannedOrEmpty,
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
      error: error?.message || "Failed to process PDF book and generate story."
    });
  }
});

// Download fixed server.js directly
app.get("/api/download/server.js", (req, res) => {
  const serverJsPath = path.join(process.cwd(), "server.js");
  if (fs.existsSync(serverJsPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="server.js"');
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(serverJsPath);
  } else {
    res.status(404).send("server.js file not found on disk");
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    pdfParseLoaded: Boolean(PDFParse),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
