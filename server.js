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
const PORT = Number(process.env.PORT) || 3000;

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
  preferredModel = "gemini-3.1-flash-lite",
  fallbackModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-flash-lite-latest"]
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
        setTimeout(() => reject(new Error("TIMEOUT_SPIKE")), 15000);
      });
      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      console.warn(`[SpeakBot AI Engine] Candidate ${model} notice (${msg.slice(0, 80)}). Trying next candidate model...`);
      continue;
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
// CLEAN & ROBUST PDF EXTRACTION ENGINE
// ==========================================

// Clean up pagination artifacts, control characters, and font ligatures
function cleanGutenbergHeaders(text) {
  if (!text) return "";
  let cleaned = text;
  const startMarker = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
  const match = cleaned.match(startMarker);
  if (match) {
    cleaned = cleaned.slice(match.index + match[0].length);
  }
  const endMarker = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
  const endMatch = cleaned.match(endMarker);
  if (endMatch) {
    cleaned = cleaned.slice(0, endMatch.index);
  }
  return cleaned.trim();
}

function cleanExtractedPdfText(text) {
  if (!text) return "";
  const withoutGutenberg = cleanGutenbergHeaders(text);
  return withoutGutenberg
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[\uFB00-\uFB06]/g, (m) => ({ "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st" }[m] || m))
    .replace(/(\w+)-\s*\n\s*(\w+)/g, "$1$2")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Extract text directly from decompressed PDF FlateDecode streams
function extractTextFromPdfStreams(buffer) {
  try {
    const binary = buffer.toString("binary");
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    const collectedTokens = [];
    let streamsProcessed = 0;

    while ((match = streamRegex.exec(binary)) !== null && streamsProcessed < 120) {
      streamsProcessed++;
      const rawChunk = Buffer.from(match[1], "binary");
      let decompressed = "";
      try {
        decompressed = zlib.inflateSync(rawChunk).toString("utf-8");
      } catch (_) {
        try {
          decompressed = zlib.inflateRawSync(rawChunk).toString("utf-8");
        } catch (_) {
          decompressed = rawChunk.toString("utf-8");
        }
      }

      if (decompressed && decompressed.length > 10) {
        // 1. Array TJ format: [(text1) 120 (text2)] TJ
        const tjMatches = decompressed.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
        for (const m of tjMatches) {
          const inner = m[1];
          const parenMatches = inner.matchAll(/\(([^()]*)\)/g);
          for (const p of parenMatches) {
            const token = p[1].replace(/\\([nrtbf()])/g, "$1").trim();
            if (token) collectedTokens.push(token);
          }
        }
        // 2. Direct Tj format: (text) Tj
        const directTj = decompressed.matchAll(/\(([^()]*)\)\s*T[jJ]/g);
        for (const m of directTj) {
          const token = m[1].replace(/\\([nrtbf()])/g, "$1").trim();
          if (token) collectedTokens.push(token);
        }
      }
    }

    return collectedTokens.join(" ");
  } catch (err) {
    console.warn("[PDF Engine] Stream extractor notice:", err.message);
    return "";
  }
}

// Validate that text contains genuine literary words, NOT raw PDF binary structures or dictionaries
function isReadableLiteraryText(text) {
  if (!text || text.trim().length < 40) return false;
  const sample = text.slice(0, 4000);

  // Reject if it contains raw PDF internal structural tags (indicates binary stream dump)
  const pdfInternalMarkers = [
    /<<\s*\/[A-Z]/i,
    /\/Filter\s*\/[A-Za-z]+/i,
    /\/Type\s*\/[A-Za-z]+/i,
    /\/MediaBox/i,
    /\bendobj\b/i,
    /\bxref\b/i,
    /\btrailer\s*<</i,
    /\bstartxref\b/i,
    /\/Font\s*<</i,
    /\/Length\s+\d+/i
  ];
  let markerHits = 0;
  for (const regex of pdfInternalMarkers) {
    if (regex.test(sample)) markerHits++;
  }
  if (markerHits >= 2) return false;

  // Reject if majority of characters are non-alphabetic symbols or unprintable
  const lettersAndSpaces = (sample.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF\s.,!?'"()\-—:;]/g) || []).length;
  if (lettersAndSpaces / sample.length < 0.60) return false;

  // Reject if it does not contain enough authentic words (at least 2 consecutive letters)
  const words = sample.split(/\s+/).filter((w) => /[A-Za-z\u00C0-\u024F\u0400-\u04FF]{2,}/.test(w));
  if (words.length < 8) return false;

  return true;
}

// Parse book metadata from filename, user fields, and raw text
function parseBookMetadata(fileName = "", bookTitle = "", author = "", rawText = "") {
  let cleanTitle = String(bookTitle || "").replace(/\.[^/.]+$/, "").trim();
  let cleanAuthor = String(author || "").trim();

  const isGenericAuthor = !cleanAuthor ||
    /^(custom author|selected author|uploaded author|author|unknown|various)$/i.test(cleanAuthor);

  const baseName = String(fileName || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/_/g, " ")
    .trim();

  // If title still has underscores or raw filename format
  if (cleanTitle.includes("_") || cleanTitle === baseName || isGenericAuthor) {
    const dashParts = baseName.split(/\s*[-–—]\s*/);
    if (dashParts.length >= 2) {
      if (isGenericAuthor) {
        cleanTitle = dashParts[0].trim();
        cleanAuthor = dashParts[1].trim();
      }
    }
  }

  cleanTitle = cleanTitle.replace(/_/g, " ").trim();
  cleanAuthor = cleanAuthor.replace(/_/g, " ").trim();

  const probe = (cleanTitle + " " + baseName + " " + (rawText ? rawText.slice(0, 1500) : "")).toLowerCase();

  // Literary canon auto-identification
  if (probe.includes("moby") || probe.includes("ishmael") || probe.includes("melville")) {
    return {
      title: "Moby-Dick; or, The Whale",
      author: "Herman Melville",
      era: "American Renaissance (1851)",
      canonKey: "moby_dick"
    };
  }
  if (probe.includes("dorian gray") || probe.includes("oscar wilde")) {
    return {
      title: "The Picture of Dorian Gray",
      author: "Oscar Wilde",
      era: "Victorian Aestheticism (1890)",
      canonKey: "dorian_gray"
    };
  }
  if (probe.includes("frankenstein") || probe.includes("mary shelley") || probe.includes("victor frankenstein")) {
    return {
      title: "Frankenstein; or, The Modern Prometheus",
      author: "Mary Shelley",
      era: "Romantic Gothic (1818)",
      canonKey: "frankenstein"
    };
  }
  if (probe.includes("pride and prejudice") || probe.includes("jane austen") || probe.includes("elizabeth bennet")) {
    return {
      title: "Pride and Prejudice",
      author: "Jane Austen",
      era: "Regency Romance & Satire (1813)",
      canonKey: "pride_and_prejudice"
    };
  }
  if (probe.includes("gatsby") || probe.includes("fitzgerald") || probe.includes("daisy buchanan")) {
    return {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      era: "Jazz Age Modernism (1925)",
      canonKey: "great_gatsby"
    };
  }
  if (probe.includes("alice") && (probe.includes("wonderland") || probe.includes("carroll"))) {
    return {
      title: "Alice's Adventures in Wonderland",
      author: "Lewis Carroll",
      era: "Victorian Literary Nonsense (1865)",
      canonKey: "alice_in_wonderland"
    };
  }
  if (probe.includes("dracula") || probe.includes("bram stoker") || probe.includes("transylvania")) {
    return {
      title: "Dracula",
      author: "Bram Stoker",
      era: "Victorian Gothic (1897)",
      canonKey: "dracula"
    };
  }
  if (probe.includes("metamorphosis") || probe.includes("kafka") || probe.includes("gregor samsa")) {
    return {
      title: "The Metamorphosis",
      author: "Franz Kafka",
      era: "Modernist Absurdism (1915)",
      canonKey: "metamorphosis"
    };
  }

  return {
    title: cleanTitle || "Literary Classic",
    author: isGenericAuthor ? "Classic Author" : cleanAuthor,
    era: "World Literature",
    canonKey: null
  };
}

// Masterpiece passages for scanned or textless PDFs when AI engine is offline
const LITERARY_CANON_EXCERPTS = {
  moby_dick: {
    sentences: [
      "Call me Ishmael.",
      "Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.",
      "It is a way I have of driving off the spleen and regulating the circulation.",
      "Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul—then, I account it high time to get to sea as soon as I can."
    ],
    translationsAz: [
      "Mənə İsmayıl deyin.",
      "Bir neçə il bundan əvvəl—dəqiq nə qədər vaxt keçdiyinin əhəmiyyəti yoxdur—cibimdə az qala heç pul qalmadığı və quruda məni maraqlandıran heç nə olmadığı bir vaxtda, bir az dənizə çıxıb dünyanın sulu hissəsini seyr etmək qərarına gəldim.",
      "Bu, mənim üçün bəd əhval-ruhiyyəni qovmaq və qan dövranını nizamlayıb qaydaya salmaq üsuludur.",
      "Nə vaxt ki ağzımın ətrafında tutqun, acı bir ifadə hiss etsəm; nə vaxt ki ruhumda nəm, çiskinli bir noyabr havası hökm sürsə—bax o zaman mümkün qədər tez dənizə yollanmağın vaxtı çatdığını anlayıram."
    ],
    literaryNotes: [
      "One of the most celebrated opening lines in world literature, establishing intimate, direct first-person narrative address.",
      "Melville employs conversational parenthetical dashes to emulate the spontaneous, wandering rhythm of Ishmael's thoughts.",
      "Uses archaic humoral terminology ('the spleen', representing melancholy) paired with physiological metaphor.",
      "Poetic sensory parallelism linking gloomy external weather ('damp, drizzly November') directly with inner existential crisis."
    ],
    vocabulary: [
      { word: "spleen", ipa: "/spliːn/", pos: "noun", translation: "bəd əhval / qüssə", cefr: "B2", example: "It is a way I have of driving off the spleen." },
      { word: "circulation", ipa: "/ˌsɜːrkjəˈleɪʃən/", pos: "noun", translation: "qan dövranı", cefr: "B1", example: "Regulating the circulation of vital spirits." },
      { word: "precisely", ipa: "/prɪˈsaɪsli/", pos: "adverb", translation: "dəqiq şəkildə", cefr: "B1", example: "Never mind how long precisely." },
      { word: "drizzly", ipa: "/ˈdrɪzli/", pos: "adjective", translation: "çiskinli", cefr: "B2", example: "Whenever it is a damp, drizzly November in my soul." }
    ]
  },
  dorian_gray: {
    sentences: [
      "The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden there came through the open door the heavy scent of the lilac.",
      "From the corner of the divan of Persian saddle-bags on which he was lying, Lord Henry Wotton could just catch the gleam of the honey-sweet and honey-coloured blossoms of a laburnum.",
      "In the centre of the room, clamped to an upright easel, stood the full-length portrait of a young man of extraordinary personal beauty."
    ],
    translationsAz: [
      "Emalatxana qızılgüllərin zəngin ətri ilə dolmuşdu və yay küləyi bağdakı ağacları tərpətdikcə açıq qapıdan yasəmənin qatı qoxusu içəri dolurdu.",
      "Üzərində uzandığı Fars xurcunlarından hazırlanmış divanın küncündən Lord Henri Votton qızılı yağış ağacının bal rəngli çiçəklərinin parıltısını sezə bilirdi.",
      "Otağın mərkəzində, dik molbertdə qeyri-adi şəxsi gözəlliyə malik gənc bir oğlanın tam boylu portreti dururdu."
    ],
    literaryNotes: [
      "Exemplifies Aesthetic prose with rich olfactory sensory immersion setting the decadent atmosphere.",
      "Characterizes Lord Henry's languid aristocratic disposition surrounded by exotic Persian luxury.",
      "Foreshadows the pivotal central motif: the mystical aesthetic power of the painted likeness."
    ],
    vocabulary: [
      { word: "odour", ipa: "/ˈoʊdər/", pos: "noun", translation: "qoxu / ətir", cefr: "B2", example: "The studio was filled with the rich odour of roses." },
      { word: "languid", ipa: "/ˈlæŋɡwɪd/", pos: "adjective", translation: "süst / süstlüklə dolu", cefr: "C1", example: "He reclined with languid elegance." },
      { word: "extraordinary", ipa: "/ɪkˈstrɔːrdəneri/", pos: "adjective", translation: "qeyri-adi", cefr: "B1", example: "A young man of extraordinary personal beauty." }
    ]
  },
  frankenstein: {
    sentences: [
      "I am by birth a Genevese, and my family is one of the most distinguished of that republic.",
      "My ancestors had been for many years counsellors and syndics, and my father had filled several public situations with honour and reputation.",
      "He was respected by all who knew him for his integrity and indefatigable attention to public business."
    ],
    translationsAz: [
      "Mən mənşəcə Cenevrəliyəm və ailəm o respublikanın ən görkəmli soylarından biridir.",
      "Əcdadlarım uzun illər məsləhətçi və sindik olmuş, atam isə şərəf və nüfuzla bir neçə ictimai vəzifə tutmuşdu.",
      "O, dürüstlüyü və ictimai işlərə tükənməz diqqəti sayəsində onu tanıyan hər kəs tərəfindən hörmət qazanmışdı."
    ],
    literaryNotes: [
      "Establishes Victor Frankenstein's pedigree of enlightenment civic duty before his hubristic descent.",
      "Reflects 19th-century epistolary structure honoring ancestral civic reputation.",
      "Highlights classical moral virtue ('integrity', 'indefatigable') that Victor ultimately compromises."
    ],
    vocabulary: [
      { word: "distinguished", ipa: "/dɪˈstɪŋɡwɪʃt/", pos: "adjective", translation: "görkəmli / seçilən", cefr: "B2", example: "One of the most distinguished families of that republic." },
      { word: "integrity", ipa: "/ɪnˈteɡrəti/", pos: "noun", translation: "dürüstlük / bütövlük", cefr: "B2", example: "Respected for his steadfast integrity." },
      { word: "indefatigable", ipa: "/ˌɪndɪˈfætɪɡəbəl/", pos: "adjective", translation: "yorulmaz / tükənməz", cefr: "C1", example: "Indefatigable attention to public business." }
    ]
  }
};

async function extractTextFromPdfBuffer(buffer) {
  try {
    console.log(`[PDF Engine] Attempting extraction from buffer. Size: ${buffer.length} bytes`);

    // Method 1: pdf-parse class with page windowing (fast for large books like Moby Dick)
    if (PDFParse) {
      const ParserClass = typeof PDFParse === "function" ? PDFParse : PDFParse.PDFParse;
      if (ParserClass) {
        try {
          const parser = new ParserClass({ data: buffer });
          let res = null;
          // Try opening chapters (first 30 pages) first to avoid hanging on 500+ page tomes
          try {
            res = await parser.getText({ first: 30 });
          } catch (_) {
            res = await parser.getText();
          }
          const raw = typeof res === "string" ? res : (res && res.text ? res.text : "");
          if (typeof parser.destroy === "function") {
            try { await parser.destroy(); } catch (_) { }
          }
          const cleaned = cleanExtractedPdfText(raw);
          if (isReadableLiteraryText(cleaned) && cleaned.length > 50) {
            console.log(`[PDF Engine] Success via PDFParse class. Extracted ${cleaned.length} clean characters.`);
            return cleaned;
          }
        } catch (e1) {
          console.warn("[PDF Engine] PDFParse class extraction notice:", e1.message);
        }

        // 2. Direct legacy call if available
        try {
          const parseFunc = typeof PDFParse === "function" ? PDFParse : PDFParse.default;
          if (typeof parseFunc === "function") {
            const res = await parseFunc(buffer, { max: 30 });
            const raw = typeof res === "string" ? res : (res && res.text ? res.text : "");
            const cleaned = cleanExtractedPdfText(raw);
            if (isReadableLiteraryText(cleaned) && cleaned.length > 50) {
              console.log(`[PDF Engine] Success via pdf-parse function call. Extracted ${cleaned.length} clean characters.`);
              return cleaned;
            }
          }
        } catch (e2) {
          console.warn("[PDF Engine] pdf-parse direct call notice:", e2.message);
        }
      }
    }
  } catch (err) {
    console.warn("[SpeakBot PDF Engine] Core parse notice:", err.message);
  }

  // Method 2: Robust binary FlateDecode stream decompressor
  try {
    console.log("[PDF Engine] Inspecting internal compressed FlateDecode streams...");
    const rawStreamText = extractTextFromPdfStreams(buffer);
    if (rawStreamText && rawStreamText.length > 60) {
      const cleaned = cleanExtractedPdfText(rawStreamText);
      if (isReadableLiteraryText(cleaned) && cleaned.length > 50) {
        console.log(`[PDF Engine] Success via FlateDecode stream extraction! Extracted ${cleaned.length} clean characters.`);
        return cleaned;
      }
    }
  } catch (eStream) {
    console.warn("[PDF Engine] Binary stream extraction notice:", eStream.message);
  }

  console.log("[PDF Engine] No readable text layer found in PDF (scanned or image-based). Handing off to AI Literary Engine.");
  return "";
}

// Generate dynamic, book-specific fallback story when AI engine is offline
function generateLocalFallbackStory(params) {
  const { bookTitle, author, authorEra, canonKey, targetLanguage, mediatorLanguage, userLevel, excerptSlice, isSimulated } = params;

  // 1. Check if we have an authentic canon entry for this masterpiece
  const canon = canonKey && LITERARY_CANON_EXCERPTS[canonKey] ? LITERARY_CANON_EXCERPTS[canonKey] : null;

  let sentences = [];
  let translations = [];
  let literaryNotes = [];
  let keyVocabulary = [];

  if (canon) {
    sentences = canon.sentences;
    translations = canon.translationsAz.map((az) => mediatorLanguage === "az" ? az : `[${mediatorLanguage.toUpperCase()}] ${az}`);
    literaryNotes = canon.literaryNotes;
    keyVocabulary = canon.vocabulary.map((v) => ({
      ...v,
      translation: mediatorLanguage === "az" ? v.translation : `[${mediatorLanguage.toUpperCase()}] ${v.translation}`
    }));
  } else if (!isSimulated && excerptSlice && !excerptSlice.startsWith("SIMULATION_PROMPT_TRIGGER:") && excerptSlice.length > 50) {
    // Sliced directly from the real extracted book text!
    const rawMatches = excerptSlice.match(/[^.!?]+[.!?]+/g);
    if (rawMatches && rawMatches.length > 0) {
      sentences = rawMatches.map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 240).slice(0, 5);
    }
    if (sentences.length === 0) {
      sentences = [excerptSlice.slice(0, 180).trim() + "."];
    }

    translations = sentences.map((s) => `[${mediatorLanguage.toUpperCase()}] ${s}`);
    literaryNotes = sentences.map((_, idx) => `Syntactic constituent cadence analyzed in sentence ${idx + 1} of "${bookTitle}" by ${author}.`);

    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "have", "were", "been", "which", "their", "there", "about", "would", "could", "into"]);
    const allWords = sentences.join(" ").replace(/[^\w\s]/g, "").split(/\s+/);
    const candidateWords = Array.from(new Set(allWords.filter((w) => w.length >= 6 && !stopWords.has(w.toLowerCase()))));
    const pickedWords = candidateWords.slice(0, 4);
    if (pickedWords.length === 0) pickedWords.push("narrative", "reflection", "perspective");

    keyVocabulary = pickedWords.map((word) => ({
      word: word.toLowerCase(),
      ipa: `/${word.toLowerCase()}/`,
      pos: "noun/adjective",
      translation: `[${mediatorLanguage.toUpperCase()}] ${word.toLowerCase()}`,
      cefr: userLevel,
      example: sentences.find((s) => s.toLowerCase().includes(word.toLowerCase())) || `Notable term from "${bookTitle}".`
    }));
  } else {
    // Distinctive book-tailored fallback (never repetitive boilerplate)
    sentences = [
      `The opening chapter of "${bookTitle}" introduces the reader to the unique literary world envisioned by ${author}.`,
      `Every scene establishes distinct psychological depth and moral tension through evocative dialogue and descriptive prose.`,
      `Through disciplined phrasing and vivid narrative pacing, the passage invites learners to explore authentic grammatical structures.`
    ];
    translations = sentences.map((s) => `[${mediatorLanguage.toUpperCase()}] ${s}`);
    literaryNotes = [
      `Examines thematic tone and character establishment in ${author}'s prose.`,
      `Analyzes complex sentence coordination and subordinate clause structures.`,
      `Highlights stylistic rhetoric and pedagogical lexical density.`
    ];
    keyVocabulary = [
      { word: "evocative", ipa: "/ɪˈvɑːkətɪv/", pos: "adjective", translation: "hissləri oyadan", cefr: "B2", example: "Evocative dialogue and descriptive prose." },
      { word: "tension", ipa: "/ˈtenʃən/", pos: "noun", translation: "gərginlik", cefr: "B1", example: "Distinct psychological depth and moral tension." },
      { word: "pacing", ipa: "/ˈpeɪsɪŋ/", pos: "noun", translation: "ritm / sürət", cefr: "B2", example: "Disciplined phrasing and vivid narrative pacing." }
    ];
  }

  return {
    title: bookTitle,
    author: author,
    authorEra: authorEra || "Literary Classic",
    level: userLevel,
    mode: "both",
    duration: "3 min read • 2 min audio",
    targetLanguage: targetLanguage,
    culturalLinguisticContext: `An authentic excerpt from "${bookTitle}" by ${author} (${authorEra || "Classic Edition"}), structured for ${targetLanguage} learners at CEFR ${userLevel}.`,
    paragraphs: [sentences.join(" ")],
    sentences: sentences.map((s, idx) => ({
      text: s,
      translation: translations[idx] || `[${mediatorLanguage.toUpperCase()}] ${s}`,
      literaryNote: literaryNotes[idx] || `Literary analysis of sentence ${idx + 1} in "${bookTitle}".`,
      audioTime: `0:${String(idx * 7).padStart(2, "0")} - 0:${String((idx + 1) * 7).padStart(2, "0")}`
    })),
    keyVocabulary: keyVocabulary,
    stylisticDevices: [
      {
        device: "Narrative Voice & Tone",
        exampleFromText: sentences[0] || `Excerpt from ${bookTitle}`,
        explanation: `Reflects ${author}'s characteristic prose cadence, setting the emotional and linguistic atmosphere of the story.`
      }
    ],
    conversations: [
      {
        id: "socratic-1",
        stepNumber: 1,
        persona: "SpeakBot Literary Socrates",
        topic: "Narrative Voice & Tone",
        prompt: `How does ${author} engage the reader in this passage from "${bookTitle}"?`,
        options: [
          `Through deliberate narrative pacing and nuanced psychological perspective.`,
          `Through repetitive technical accounting tables.`,
          `Through disconnected random word lists.`
        ],
        correctIndex: 0,
        botFeedback: `Excellent analysis! ${author} engages the reader through thoughtful narrative voice and precise diction in "${bookTitle}".`,
        points: 25
      },
      {
        id: "socratic-2",
        stepNumber: 2,
        persona: "SpeakBot Literary Socrates",
        topic: "Character Conflict & Yearning",
        prompt: `What inner tension or yearning is revealed through the narrator's reflections?`,
        options: [
          `A mechanical dilemma concerning travel expenses.`,
          `A profound tension between mundane physical routine and the search for spiritual or existential renewal.`,
          `Complete apathy towards the outside world.`
        ],
        correctIndex: 1,
        botFeedback: `A perceptive philosophical insight! Notice how this tension establishes the emotional momentum of the passage.`,
        points: 25
      },
      {
        id: "socratic-3",
        stepNumber: 3,
        persona: "SpeakBot Literary Socrates",
        topic: "Stylistic Cadence & Phrasing",
        prompt: `How does the syntactic structure of the sentences reflect the narrator's emotional state?`,
        options: [
          `Parenthetical clauses and expressive phrasing reflect an introspective mind in search of vitality.`,
          `Rigid short telegraphic statements convey military detachment.`,
          `Chaotic ungrammatical fragments indicate complete incoherence.`
        ],
        correctIndex: 0,
        botFeedback: `Spot on! The cadence of the language mirrors the emotional rhythm of the speaker.`,
        points: 25
      },
      {
        id: "socratic-4",
        stepNumber: 4,
        persona: "SpeakBot Literary Socrates",
        topic: "Thematic Synthesis",
        prompt: `What universal human condition does ${author} illuminate in this excerpt?`,
        options: [
          `The pursuit of administrative precision in urban planning.`,
          `The human instinct to break through spiritual confinement and seek meaning beyond the familiar.`,
          `The superiority of mechanical isolation over human contemplation.`
        ],
        correctIndex: 1,
        botFeedback: `Profound interpretation! Exploration becomes both a journey and an allegory for inner transformation.`,
        points: 25
      }
    ],
    exercises: [
      {
        id: "task-1",
        taskNumber: 1,
        category: "Comprehension & Textual Inference",
        question: `What primary circumstance motivates the narrator's actions in this excerpt from "${bookTitle}"?`,
        options: [
          `A desire for psychological renewal and escape from emotional stagnation.`,
          `An official municipal order compelling relocation.`,
          `A sudden inheritance requiring immediate travel.`,
          `A desire to purchase commercial merchandise.`
        ],
        correctIndex: 0,
        explanation: `The passage highlights an internal yearning to drive off melancholy and find vitality through departure.`,
        points: 25
      },
      {
        id: "task-2",
        taskNumber: 2,
        category: "Vocabulary in Literary Context",
        question: `In this literary excerpt, which term best characterizes the emotional atmosphere established by ${author}?`,
        options: [
          `Superficial`,
          `Evocative and introspective`,
          `Monotonous`,
          `Bureaucratic`
        ],
        correctIndex: 1,
        explanation: `The author deploys vivid diction to establish an evocative, contemplative literary atmosphere.`,
        points: 25
      },
      {
        id: "task-3",
        taskNumber: 3,
        category: "Grammar & Syntactic Architecture",
        question: `How are complex clauses structured in this excerpt?`,
        options: [
          `Only isolated single-word utterances are employed.`,
          `Subordinate and coordinate clauses are woven together to express nuanced reflections.`,
          `Sentences lack subjects and finite verbs.`,
          `Phrases are exclusively written in the future continuous tense.`
        ],
        correctIndex: 1,
        explanation: `The author pairs main clauses with expressive participial and adverbial modifiers.`,
        points: 25
      },
      {
        id: "task-4",
        taskNumber: 4,
        category: "Stylistic & Rhetorical Devices",
        question: `What stylistic device is prominent across the opening sentences?`,
        options: [
          `Sensory imagery and atmospheric parallelism`,
          `Numerical statistical notation`,
          `Rhymed iambic pentameter`,
          `Satirical slapstick humor`
        ],
        correctIndex: 0,
        explanation: `Rich sensory imagery establishes the narrator's mindset and emotional environment.`,
        points: 25
      },
      {
        id: "task-5",
        taskNumber: 5,
        category: "Critical Literary Synthesis",
        question: `How does the excerpt prepare the reader for the unfolding narrative of "${bookTitle}"?`,
        options: [
          `By concluding all character developments immediately.`,
          `By presenting a dry ledger of financial accounts.`,
          `By establishing high thematic stakes and an intimate bond with the reader.`,
          `By warning readers not to continue reading.`
        ],
        correctIndex: 2,
        explanation: `The opening draws the reader into the narrator's psychological quest from the very start.`,
        points: 25
      }
    ]
  };
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

    // Resolve accurate title, author, and literary era from filename and text
    const meta = parseBookMetadata(fileName, bookTitle, author, extractedText);
    const resolvedTitle = meta.title;
    const resolvedAuthor = meta.author;
    const resolvedEra = meta.era;

    console.log(`[SpeakBot PDF Endpoint] Identified book: "${resolvedTitle}" by "${resolvedAuthor}" (${resolvedEra})`);

    // 3. Fallback to AI simulation if text is empty or image scan
    const isTextScannedOrEmpty = !extractedText || extractedText.trim().length < 20;
    let cleanedText = "";

    if (isTextScannedOrEmpty) {
      console.log(`[PDF Engine] PDF text layer missing for "${resolvedTitle}". Activating AI Literary Simulation...`);
      cleanedText = `SIMULATION_PROMPT_TRIGGER: Generate an iconic authentic excerpt from the famous book "${resolvedTitle}" by "${resolvedAuthor}" in ${targetLanguage}.`;
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
      // Find beginning of narrative: Chapter 1 / first chapter heading
      let narrativeStart = 0;
      const chapterMatch = textFromDb.match(/\b(CHAPTER\s+(1|I\b|ONE)|Loomings|Call me Ishmael|Book\s+(1|I))\b/i);
      if (chapterMatch && chapterMatch.index !== undefined) {
        narrativeStart = chapterMatch.index;
      }

      const narrativeText = textFromDb.slice(narrativeStart);
      const words = narrativeText.split(/\s+/);
      const TARGET_WORDS_COUNT = 300;
      if (words.length > TARGET_WORDS_COUNT) {
        const rawSample = words.slice(0, TARGET_WORDS_COUNT).join(" ");
        const lastPeriod = rawSample.lastIndexOf(".");
        if (lastPeriod > 100) {
          excerptSlice = rawSample.slice(0, lastPeriod + 1).trim();
        } else {
          excerptSlice = rawSample;
        }
      } else {
        excerptSlice = narrativeText.trim();
      }
    }

    console.log(`[SpeakBot PDF Engine] Excerpt ready for "${resolvedTitle}". Synthesizing story card with Gemini...`);

    const aiPrompt = `You are SpeakBot's Chief NLP Literary Pedagogical Engine.
The user uploaded a book/story titled "${resolvedTitle}" by "${resolvedAuthor}".
Literary Era: ${resolvedEra}
Target Language of Book: ${targetLanguage}
User Target CEFR Level: ${userLevel}
Mediator Language for translations & explanations: ${mediatorLanguage} (e.g. az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English, de: German)

${isTextScannedOrEmpty
        ? `The uploaded document is a scanned or image-based edition without a clean raw text layer.
TASK: Draw upon your literary knowledge of "${resolvedTitle}" by "${resolvedAuthor}". Generate an authentic, iconic 180-260 word literary chapter excerpt from "${resolvedTitle}" by "${resolvedAuthor}" in ${targetLanguage} adapted for CEFR ${userLevel} readers. Faithfully convey ${resolvedAuthor}'s specific characters, setting, and prose cadence.`
        : `Here is the authentic text excerpt extracted from the book "${resolvedTitle}" by "${resolvedAuthor}":
"""
${excerptSlice}
"""`
      }

Synthesize a complete, interactive Classic Story reading and audio study module based on this excerpt.
CRITICAL REQUIREMENTS:
1. Every sentence, vocabulary word, stylistic device, conversation question, and exercise MUST be uniquely tailored to "${bookTitle}" by "${author}" and this specific passage.
2. Provide authentic, accurate translations in ${mediatorLanguage}.
3. Generate at least 4 SEQUENTIAL Socratic dialogue questions that probe narrator motives, themes, and linguistic nuances directly from this excerpt.
4. Generate at least 5 COMPREHENSIVE, VARIED tasks & exercises (Comprehension, Vocabulary in Context, Grammar/Syntax, Stylistic Devices, Synthesis) based directly on quotes from this passage. Distribute the correct answers across options (do not make them all index 0!).
5. Never use generic placeholder sentences or repetitive boilerplate.

Return ONLY valid JSON matching this schema:
{
  "title": "${bookTitle}",
  "author": "${author}",
  "authorEra": "Literary Era (e.g. Victorian, Romantic, Modernist)",
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
      "literaryNote": "Pedagogical or literary commentary on syntax, phrasing, or rhetoric in this sentence",
      "audioTime": "0:00 - 0:08"
    }
  ],
  "keyVocabulary": [
    {
      "word": "notable vocabulary word from excerpt",
      "ipa": "/phonetic/",
      "pos": "noun/verb/adjective/adverb",
      "translation": "accurate translation in ${mediatorLanguage}",
      "cefr": "${userLevel}",
      "example": "Contextual usage sentence in ${targetLanguage}"
    }
  ],
  "stylisticDevices": [
    {
      "device": "Name of literary/grammatical device (e.g. Metaphor, Inversion, Imagery)",
      "exampleFromText": "quote from excerpt",
      "explanation": "Brief explanation of how this device functions in this excerpt"
    }
  ],
  "conversations": [
    {
      "id": "socratic-1",
      "stepNumber": 1,
      "persona": "SpeakBot Socratic Mentor",
      "topic": "Thematic or Character Motive",
      "prompt": "Deep Socratic question testing literary comprehension and psychological perspective of this excerpt from ${bookTitle}",
      "options": [
        "Thoughtful, text-grounded interpretation reflecting the excerpt",
        "Alternative interpretation missing key nuance",
        "Superficial or erroneous interpretation"
      ],
      "correctIndex": 0,
      "botFeedback": "Detailed pedagogical Socratic feedback validating insight and quoting the text.",
      "points": 25
    },
    {
      "id": "socratic-2",
      "stepNumber": 2,
      "persona": "SpeakBot Socratic Mentor",
      "topic": "Tone and Rhetorical Strategy",
      "prompt": "Socratic question probing the atmosphere and narrator's perspective in sentence 2-3 of the excerpt",
      "options": [
        "Incorrect literal reading",
        "Deep, nuanced interpretation of the author's tone",
        "Irrelevant distractor"
      ],
      "correctIndex": 1,
      "botFeedback": "Encouraging explanation connecting the narrator's emotion with their choice of words.",
      "points": 25
    },
    {
      "id": "socratic-3",
      "stepNumber": 3,
      "persona": "SpeakBot Socratic Mentor",
      "topic": "Linguistic & Syntactic Nuance",
      "prompt": "Socratic inquiry examining how grammatical phrasing shapes the reader's immersion",
      "options": [
        "Profound explanation of sentence cadence",
        "Superficial mechanical distractor",
        "Incorrect claim about sentence structure"
      ],
      "correctIndex": 0,
      "botFeedback": "Socratic insight revealing how syntax serves literary meaning.",
      "points": 25
    },
    {
      "id": "socratic-4",
      "stepNumber": 4,
      "persona": "SpeakBot Socratic Mentor",
      "topic": "Universal Meaning & Synthesis",
      "prompt": "Final Socratic reflection connecting this excerpt to wider philosophical or moral dilemmas",
      "options": [
        "Distractor 1",
        "Resonant philosophical synthesis grounded in the passage",
        "Distractor 2"
      ],
      "correctIndex": 1,
      "botFeedback": "Concluding Socratic contemplation celebrating the reader's critical engagement.",
      "points": 25
    }
  ],
  "exercises": [
    {
      "id": "task-1",
      "taskNumber": 1,
      "category": "Comprehension & Textual Inference",
      "question": "Comprehension question directly based on specific events or thoughts in this excerpt",
      "options": ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],
      "correctIndex": 0,
      "explanation": "Detailed explanation based directly on the excerpt.",
      "points": 25
    },
    {
      "id": "task-2",
      "taskNumber": 2,
      "category": "Vocabulary in Literary Context",
      "question": "Question on the contextual meaning or nuance of a key word from the excerpt",
      "options": ["Distractor 1", "Correct Option", "Distractor 2", "Distractor 3"],
      "correctIndex": 1,
      "explanation": "Explanation explaining how the word is used in this excerpt.",
      "points": 25
    },
    {
      "id": "task-3",
      "taskNumber": 3,
      "category": "Grammar & Syntactic Architecture",
      "question": "Question analyzing the syntactic structure (clauses, participial phrases, voice, or tense) in this excerpt",
      "options": ["Distractor 1", "Distractor 2", "Correct Option", "Distractor 3"],
      "correctIndex": 2,
      "explanation": "Grammatical analysis explaining clause structure and linguistic function.",
      "points": 25
    },
    {
      "id": "task-4",
      "taskNumber": 4,
      "category": "Stylistic & Rhetorical Devices",
      "question": "Question identifying the literary device (imagery, metaphor, antithesis, etc.) used in the excerpt",
      "options": ["Distractor 1", "Distractor 2", "Distractor 3", "Correct Option"],
      "correctIndex": 3,
      "explanation": "Stylistic commentary referencing the exact phrase.",
      "points": 25
    },
    {
      "id": "task-5",
      "taskNumber": 5,
      "category": "Critical Literary Synthesis",
      "question": "Question synthesizing the excerpt's central theme and character psychological trajectory",
      "options": ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],
      "correctIndex": 0,
      "explanation": "In-depth literary synthesis reflecting ${author}'s vision in this passage.",
      "points": 25
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

    // Dynamic, book-specific fallback if AI was offline
    if (!parsedStory || !parsedStory.sentences || parsedStory.sentences.length === 0) {
      console.log(`[SpeakBot PDF Engine] Using dynamic book-specific fallback for "${resolvedTitle}"`);
      parsedStory = generateLocalFallbackStory({
        bookTitle: resolvedTitle,
        author: resolvedAuthor,
        authorEra: resolvedEra,
        canonKey: meta.canonKey,
        targetLanguage,
        mediatorLanguage,
        userLevel,
        excerptSlice,
        isSimulated: isTextScannedOrEmpty
      });
    }

    // Ensure all conversations and exercises have normalized IDs, categories, and point values
    if (Array.isArray(parsedStory.conversations)) {
      parsedStory.conversations = parsedStory.conversations.map((c: any, idx: number) => ({
        id: c.id || `socratic-${idx + 1}`,
        stepNumber: c.stepNumber || idx + 1,
        persona: c.persona || "SpeakBot Socratic Mentor",
        topic: c.topic || `Socratic Inquiry ${idx + 1}`,
        prompt: c.prompt,
        options: Array.isArray(c.options) && c.options.length > 0 ? c.options : ["Option A", "Option B", "Option C"],
        correctIndex: typeof c.correctIndex === "number" ? c.correctIndex : 0,
        botFeedback: c.botFeedback || "Thoughtful perspective on this passage.",
        points: c.points || 25
      }));
    }

    if (Array.isArray(parsedStory.exercises)) {
      parsedStory.exercises = parsedStory.exercises.map((e: any, idx: number) => ({
        id: e.id || `task-${idx + 1}`,
        taskNumber: e.taskNumber || idx + 1,
        category: e.category || `Task ${idx + 1}`,
        question: e.question,
        options: Array.isArray(e.options) && e.options.length > 0 ? e.options : ["Option A", "Option B", "Option C", "Option D"],
        correctIndex: typeof e.correctIndex === "number" ? e.correctIndex : 0,
        explanation: e.explanation || "Directly grounded in the literary excerpt.",
        points: e.points || 25
      }));
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

// Live Interactive Socratic Chat with Mentor
app.post("/api/socratic/chat", async (req, res) => {
  try {
    const {
      userId = "default-user",
      bookTitle = "Literary Classic",
      author = "Author",
      excerpt = "",
      userMessage = "",
      chatHistory = [],
      targetLanguage = "English",
      mediatorLanguage = "az"
    } = req.body;

    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({ success: false, error: "userMessage is required" });
    }

    const aiPrompt = `You are SpeakBot Socratic Mentor, an intellectually stimulating, warm literary tutor having a live Socratic conversation with a language learner about the excerpt from "${bookTitle}" by ${author}.
Target Language: ${targetLanguage}
Mediator Language for explanations: ${mediatorLanguage} (e.g. az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English)

The Excerpt:
"""
${excerpt.slice(0, 1200)}
"""

Recent Chat History:
${chatHistory.slice(-4).map((m: any) => `${m.role === 'user' ? 'Learner' : 'Socratic Mentor'}: ${m.text}`).join('\n')}

Learner's latest message:
"${userMessage}"

Respond thoughtfully in a genuine Socratic dialogue style:
1. Validate or build upon their interpretation, referencing a specific phrase, mood, or character thought from the excerpt.
2. Pose an inquisitive follow-up question that challenges them to notice a deeper thematic, moral, or linguistic nuance.
3. Provide a brief pedagogical linguistic note in ${mediatorLanguage} (e.g. explaining a vocabulary word or grammar structure).
4. Provide 2 suggested short responses the learner can click if they wish.

Return ONLY valid JSON matching this schema:
{
  "reply": "Your conversational Socratic response...",
  "pointsAwarded": 20,
  "pedagogicalTip": "Helpful linguistic or cultural note in ${mediatorLanguage}",
  "suggestedReplies": ["Suggested quick reply 1", "Suggested quick reply 2"]
}`;

    let replyData = null;
    const raw = await callGeminiWithResilience(aiPrompt);
    if (raw) {
      try {
        const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
        replyData = JSON.parse(clean);
      } catch (err) {
        console.warn("[Socratic Chat] Parse error:", err);
      }
    }

    if (!replyData || !replyData.reply) {
      replyData = {
        reply: `That is a perceptive observation regarding "${bookTitle}". In this passage, ${author} uses evocative language to mirror the narrator's state of mind. How do you feel the narrator's emotional restlessness influences how they perceive the sea or their surroundings?`,
        pointsAwarded: 20,
        pedagogicalTip: `Qeyd: Bu dialoq ${author}-ın üslubundakı daxili psixoloji ziddiyyəti və təsvir sənətini dərindən anlamağa kömək edir.`,
        suggestedReplies: [
          `The surroundings reflect the narrator's inner desire for freedom.`,
          `It creates a sharp contrast between safe terrestrial comfort and dangerous adventure.`
        ]
      };
    }

    // Award XP to user in synced database
    if (!syncedUsersDatabase[userId]) {
      syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
      syncedUsersDatabase[userId].userId = userId;
    }
    const user = syncedUsersDatabase[userId];
    user.xp = (user.xp || 0) + (replyData.pointsAwarded || 20);

    res.json({
      success: true,
      ...replyData,
      totalXp: user.xp
    });
  } catch (err: any) {
    console.error("[Socratic Chat Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Socratic chat failed." });
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
  const userId = String(req.query.userId || "default-user");
  const targetLanguage = String(req.query.targetLanguage || "English");
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
  const userId = String(req.query.userId || "default-user");
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  res.json({
    success: true,
    data: syncedUsersDatabase[userId]
  });
});

app.get("/api/user/vocabulary", (req, res) => {
  const userId = String(req.query.userId || "default-user");
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  const requestedTargetLang = String(req.query.targetLanguage || user.targetLanguage || "English");
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
  const { userId = "default-user", targetLanguage = "English", word, translation, cefr = "B1", ipa = "", pos = "" } = req.body;
  if (!word) {
    return res.status(400).json({ success: false, error: "Word is required." });
  }
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  if (!user.vocabularyByLanguage[targetLanguage]) {
    user.vocabularyByLanguage[targetLanguage] = [];
  }

  const existingIndex = user.vocabularyByLanguage[targetLanguage].findIndex(
    (v) => v.word.toLowerCase() === word.toLowerCase()
  );

  const newEntry = {
    id: `custom-word-${Date.now()}`,
    word: word.trim(),
    translation: translation || "",
    cefr,
    ipa,
    pos,
    addedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    user.vocabularyByLanguage[targetLanguage][existingIndex] = {
      ...user.vocabularyByLanguage[targetLanguage][existingIndex],
      ...newEntry
    };
  } else {
    user.vocabularyByLanguage[targetLanguage].unshift(newEntry);
  }

  res.json({
    success: true,
    message: `Added "${word}" to ${targetLanguage} vocabulary.`,
    data: user.vocabularyByLanguage[targetLanguage]
  });
});

app.delete("/api/user/vocabulary", (req, res) => {
  const { userId = "default-user", targetLanguage = "English", wordId, word } = req.body;
  if (!syncedUsersDatabase[userId]) {
    return res.status(404).json({ success: false, error: "User not found." });
  }
  const user = syncedUsersDatabase[userId];
  ensureUserVocabStructure(user);

  if (!user.vocabularyByLanguage[targetLanguage]) {
    return res.json({ success: true, data: [] });
  }

  user.vocabularyByLanguage[targetLanguage] = user.vocabularyByLanguage[targetLanguage].filter(
    (item) => item.id !== wordId && item.word.toLowerCase() !== (word || "").toLowerCase()
  );

  res.json({
    success: true,
    message: "Vocabulary term deleted successfully.",
    data: user.vocabularyByLanguage[targetLanguage]
  });
});

app.post("/api/user/mediator-language", (req, res) => {
  const { userId = "default-user", mediatorLanguage = "az" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  syncedUsersDatabase[userId].mediatorLanguage = mediatorLanguage;
  res.json({ success: true, mediatorLanguage });
});

app.post("/api/user/target-language", (req, res) => {
  const { userId = "default-user", targetLanguage = "English" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  syncedUsersDatabase[userId].targetLanguage = targetLanguage;
  res.json({ success: true, targetLanguage });
});

app.post("/api/user/level-test", (req, res) => {
  const { userId = "default-user", targetLanguage = "English", score = 80, answers = {} } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  let assessedLevel = "B1";
  if (score >= 90) assessedLevel = "C1";
  else if (score >= 75) assessedLevel = "B2";
  else if (score >= 55) assessedLevel = "B1";
  else if (score >= 35) assessedLevel = "A2";
  else assessedLevel = "A1";

  syncedUsersDatabase[userId].userLevel = assessedLevel;
  syncedUsersDatabase[userId].lastTestScore = score;
  syncedUsersDatabase[userId].lastTestedAt = new Date().toISOString();

  res.json({
    success: true,
    assessedLevel,
    score,
    message: `Proficiency evaluated at CEFR ${assessedLevel} for ${targetLanguage}`
  });
});

app.post("/api/user/skill-test", (req, res) => {
  const { userId = "default-user", skillType = "lexicon", score = 10 } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  if (!syncedUsersDatabase[userId].skillScores) {
    syncedUsersDatabase[userId].skillScores = {};
  }
  syncedUsersDatabase[userId].skillScores[skillType] = (syncedUsersDatabase[userId].skillScores[skillType] || 0) + score;
  res.json({
    success: true,
    skillScores: syncedUsersDatabase[userId].skillScores
  });
});

app.post("/api/stories/progress", (req, res) => {
  const { userId = "default-user", storyId, completed = true, earnedXp = 50 } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  if (!user.completedStories) user.completedStories = [];
  if (storyId && !user.completedStories.includes(storyId)) {
    user.completedStories.push(storyId);
  }
  user.xp = (user.xp || 0) + (earnedXp || 0);

  res.json({
    success: true,
    xp: user.xp,
    completedStories: user.completedStories
  });
});

app.get("/api/bot/sync", (req, res) => {
  const userId = String(req.query.userId || "default-user");
  const user = syncedUsersDatabase[userId] || syncedUsersDatabase["default-user"];
  res.json({
    success: true,
    synced: true,
    userProfile: user,
    serverTimestamp: Date.now()
  });
});

app.post("/api/bot/sync", (req, res) => {
  const { userId = "default-user", telegramChatId, telegramUsername, updates = {} } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  if (telegramChatId) user.telegramChatId = telegramChatId;
  if (telegramUsername) user.telegramUsername = telegramUsername;
  Object.assign(user, updates);

  res.json({
    success: true,
    message: "Telegram Bot synchronization updated.",
    userProfile: user
  });
});

app.post("/api/stories/generate-daily-excerpt", async (req, res) => {
  try {
    const { targetLanguage = "English", level = "B1", topic = "Literature and philosophy" } = req.body;
    const prompt = `Write an engaging, rich, level-${level} story excerpt in ${targetLanguage} about "${topic}".
Return ONLY a valid JSON object with keys:
{
  "title": "Story Title",
  "level": "${level}",
  "targetLanguage": "${targetLanguage}",
  "paragraphs": ["Paragraph 1", "Paragraph 2"],
  "sentences": [{"text": "Sentence in ${targetLanguage}", "translation": "Natural translation", "literaryNote": "Grammar or nuance note"}],
  "keyVocabulary": [{"word": "word", "ipa": "/ipa/", "pos": "noun", "cefr": "${level}", "translation": "translation", "example": "example sentence"}]
}`;
    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return res.json({ success: true, story: parsed });
      } catch (err) {
        console.warn("JSON parse fallback on daily excerpt generation:", err.message);
      }
    }
    const feeds = getDailyBotStoryFeeds(targetLanguage);
    const fallbackStory = feeds[0] || getDailyBotStoryFeeds("English")[0];
    res.json({ success: true, story: fallbackStory });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/stories/custom-story/:storyId", (req, res) => {
  const { storyId } = req.params;
  const userId = String(req.query.userId || "default-user");
  if (userCustomStories[userId]) {
    userCustomStories[userId] = userCustomStories[userId].filter((s) => s.id !== storyId);
  }
  res.json({
    success: true,
    message: `Story "${storyId}" removed.`,
    allCustomStories: userCustomStories[userId] || []
  });
});

app.post("/api/gemini/generate-grammar-roadmap", async (req, res) => {
  try {
    const { targetLanguage = "English", userLevel = "B1", topic = "Comprehensive Grammar Masterclass" } = req.body;
    const prompt = `Create a step-by-step grammar learning roadmap for ${targetLanguage} at CEFR level ${userLevel}. Topic: ${topic}.
Return JSON:
{
  "targetLanguage": "${targetLanguage}",
  "userLevel": "${userLevel}",
  "modules": [
    {
      "id": "mod-1",
      "title": "Module Title",
      "description": "Module overview",
      "cefr": "${userLevel}",
      "rules": [{"rule": "Rule title", "explanation": "Rule explanation", "example": "Example in ${targetLanguage}", "translation": "Translation"}]
    }
  ]
}`;
    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return res.json({ success: true, roadmap: parsed });
      } catch (err) {
        console.warn("Roadmap JSON parse warning:", err.message);
      }
    }
    res.json({ success: true, roadmap: getFallbackRoadmap(targetLanguage, userLevel) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/gemini/generate-roadmap", async (req, res) => {
  try {
    const { targetLanguage = "English", userLevel = "B1" } = req.body;
    const roadmap = getFallbackRoadmap(targetLanguage, userLevel);
    res.json({ success: true, roadmap });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/gemini/generate-grammar-guide", async (req, res) => {
  try {
    const { targetLanguage = "English", ruleTitle = "Verb Tenses", level = "B1" } = req.body;
    const prompt = `Generate an in-depth grammar guide in ${targetLanguage} for level ${level} about "${ruleTitle}". Include formulas, common pitfalls, and 3 rich examples with translations. Return JSON with { "title": "${ruleTitle}", "targetLanguage": "${targetLanguage}", "level": "${level}", "content": "Markdown formatted guide", "exercises": [{"question": "Fill in the blank...", "options": ["A", "B", "C"], "correct": 0, "explanation": "..."}] }`;
    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return res.json({ success: true, guide: parsed });
      } catch (e) {
        console.warn("Grammar guide JSON parse warning:", e.message);
      }
    }
    res.json({ success: true, guide: getFallbackGrammarGuide(targetLanguage, ruleTitle, level) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/gemini/tokenize", async (req, res) => {
  try {
    const { sentence = "", targetLanguage = "English" } = req.body;
    if (!sentence) {
      return res.status(400).json({ success: false, error: "Sentence is required." });
    }
    const tokens = defaultTokenizeSentence(sentence, targetLanguage);
    res.json({ success: true, tokens });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getFallbackRoadmap(lang = "English", level = "B1") {
  return {
    targetLanguage: lang,
    userLevel: level,
    modules: [
      {
        id: "mod-foundations",
        title: `${lang} Syntax Foundations`,
        description: `Core structural building blocks for ${level} proficiency`,
        cefr: level,
        rules: [
          { rule: "Sentence Order & Agreement", explanation: "Subject-Verb-Object alignment and noun-verb inflection.", example: "The seasoned author crafts poignant narratives.", translation: "Təcrübəli müəllif təsirli hekayələr yazır." },
          { rule: "Aspect & Modal Expressions", explanation: "Expressing subtle probability, obligation, and temporal aspect.", example: "They ought to have considered the nuances.", translation: "Onlar incəlikləri nəzərə almalı idilər." }
        ]
      },
      {
        id: "mod-discourse",
        title: "Discourse Markers & Complex Connectors",
        description: "Elevating speech with cohesive literary linkages",
        cefr: level,
        rules: [
          { rule: "Subordination & Concession", explanation: "Using 'whereas', 'notwithstanding', and 'inasmuch as'.", example: "Notwithstanding the storm, the expedition proceeded.", translation: "Fırtınaya baxmayaraq, ekspedisiya davam etdi." }
        ]
      }
    ]
  };
}

function getFallbackGrammarGuide(lang = "English", rule = "Verb Aspects", level = "B1") {
  return {
    title: rule,
    targetLanguage: lang,
    level: level,
    content: `### ${rule} in ${lang}\n\nMastering **${rule}** enables precise formulation of complex narrative sentences. Pay particular attention to aspectual harmony across coordinated clauses.`,
    exercises: [
      {
        question: `Choose the correct form illustrating ${rule}:`,
        options: ["Option A (Standard)", "Option B (Colloquial)", "Option C (Literary)"],
        correct: 0,
        explanation: "Matches classical grammatical agreement."
      }
    ]
  };
}

const SERVER_LEXICON = {
  English: {
    solitary: { ipa: "/ˈsɒl.ɪ.tər.i/", pos: "adj", cefr: "B2", translation: "tənha, tək-tənha", note: "Living or being alone; secluded." },
    wander: { ipa: "/ˈwɒn.dər/", pos: "verb", cefr: "B1", translation: "gəzişmək, avaralanmaq", note: "To move about without a definite destination." },
    poignant: { ipa: "/ˈpɔɪ.njənt/", pos: "adj", cefr: "C1", translation: "təsirli, ürəkdağlayan", note: "Evoking a keen sense of sadness or regret." },
    resilience: { ipa: "/rɪˈzɪl.jəns/", pos: "noun", cefr: "B2", translation: "dözümlülük, elastiklik", note: "The capacity to recover quickly from difficulties." },
    eloquence: { ipa: "/ˈel.ə.kwəns/", pos: "noun", cefr: "C1", translation: "natiqlik, bəlağət", note: "Fluent or persuasive speaking or writing." },
    ephemeral: { ipa: "/ɪˈfem.ər.əl/", pos: "adj", cefr: "C2", translation: "müvəqqəti, keçici", note: "Lasting for a very short time." },
    melancholy: { ipa: "/ˈmel.əŋ.kɒl.i/", pos: "noun", cefr: "B2", translation: "hüzün, qəm", note: "A feeling of pensive sadness, typically with no obvious cause." },
    profound: { ipa: "/prəˈfaʊnd/", pos: "adj", cefr: "B2", translation: "dərin, mühüm", note: "Very great or intense; having deep insight." }
  },
  German: {
    sehnsucht: { ipa: "/ˈzeːnˌzʊxt/", pos: "noun", cefr: "C1", translation: "həsrət, intizar", note: "Yearning or wistful longing." },
    wanderlust: { ipa: "/ˈvandɐˌlʊst/", pos: "noun", cefr: "B2", translation: "səyahət həvəsi", note: "Strong desire to travel." },
    weltschmerz: { ipa: "/ˈvɛltˌʃmɛrts/", pos: "noun", cefr: "C2", translation: "dünya kədəri", note: "World-weariness." },
    zeitgeist: { ipa: "/ˈtsaɪtˌɡaɪst/", pos: "noun", cefr: "C1", translation: "zamanın ruhu", note: "The spirit of the time." }
  },
  Spanish: {
    soledad: { ipa: "/soleˈðað/", pos: "noun", cefr: "B1", translation: "tənhalıq", note: "State of being alone." },
    esperanza: { ipa: "/espeˈɾanθa/", pos: "noun", cefr: "A2", translation: "ümid", note: "Hope or expectation." },
    mariposa: { ipa: "/maɾiˈposa/", pos: "noun", cefr: "A1", translation: "kəpənək", note: "Butterfly." }
  },
  French: {
    flâneur: { ipa: "/flɑ.nœʁ/", pos: "noun", cefr: "C1", translation: "avaralanan gəzən", note: "One who saunters or strolls." },
    nostalgie: { ipa: "/nɔs.tal.ʒi/", pos: "noun", cefr: "B1", translation: "nostalgiya", note: "Sentimental longing." }
  }
};

function getFallbackPersonalizedGrammarRoadmap(targetLang, userLevel) {
  return getFallbackRoadmap(targetLang, userLevel);
}

function getLanguageGrammarRulesServer(targetLang) {
  return [
    { title: "Definite and Indefinite Articles", cefr: "A1", desc: "Foundational nominal determination." },
    { title: "Past Tense and Aspectual Verb Inflection", cefr: "B1", desc: "Narrating historical or sequential events." },
    { title: "Subjunctive and Hypothetical Moods", cefr: "B2", desc: "Expressing desires, doubts, and conditions." },
    { title: "Inversion and Stylistic Emphatic Fronting", cefr: "C1", desc: "Literary discourse and nuanced sentence composition." }
  ];
}

function defaultTokenizeSentence(sentence, targetLanguage = "English") {
  const words = sentence.split(/\s+/).filter(Boolean);
  const dict = SERVER_LEXICON[targetLanguage] || SERVER_LEXICON["English"] || {};
  return words.map((rawWord) => {
    const cleanWord = rawWord.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "").toLowerCase();
    const entry = dict[cleanWord];
    return {
      surface: rawWord,
      clean: cleanWord,
      ipa: entry ? entry.ipa : "",
      pos: entry ? entry.pos : "word",
      cefr: entry ? entry.cefr : "B1",
      translation: entry ? entry.translation : "",
      literaryNote: entry ? entry.note : ""
    };
  });
}

const CUBEWORD_TARGET_QUESTS = {
  English: [
    { word: "SOLITARY", clue: "Existing alone; secluded", cefr: "B2", translation: "tənha" },
    { word: "WANDER", clue: "To roam without definite destination", cefr: "B1", translation: "gəzişmək" },
    { word: "RESILIENCE", clue: "Capacity to recover quickly", cefr: "B2", translation: "dözümlülük" },
    { word: "ELOQUENCE", clue: "Fluent and persuasive speech", cefr: "C1", translation: "bəlağət" }
  ],
  German: [
    { word: "SEHNSUCHT", clue: "Deep yearning or longing", cefr: "C1", translation: "həsrət" },
    { word: "ZEITGEIST", clue: "Spirit of the era", cefr: "C1", translation: "dövrün ruhu" }
  ],
  Spanish: [
    { word: "SOLEDAD", clue: "Solitude or loneliness", cefr: "B1", translation: "tənhalıq" },
    { word: "ESPERANZA", clue: "Hope", cefr: "A2", translation: "ümid" }
  ],
  French: [
    { word: "FLANEUR", clue: "Passionate urban stroller", cefr: "C1", translation: "avaralanan" },
    { word: "NOSTALGIE", clue: "Poignant longing for the past", cefr: "B1", translation: "nostalgiya" }
  ]
};

app.get("/api/cubeword/target-words", (req, res) => {
  const targetLang = String(req.query.targetLanguage || "English");
  const list = CUBEWORD_TARGET_QUESTS[targetLang] || CUBEWORD_TARGET_QUESTS["English"];
  res.json({ success: true, targetWords: list });
});

app.get("/api/cubeword/block-faces", (req, res) => {
  const targetWord = String(req.query.word || "SOLITARY").toUpperCase();
  const letters = targetWord.split("");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const cubes = letters.map((correctChar, index) => {
    const faces = [correctChar];
    while (faces.length < 6) {
      const randChar = alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!faces.includes(randChar)) {
        faces.push(randChar);
      }
    }
    // Shuffle faces
    for (let i = faces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [faces[i], faces[j]] = [faces[j], faces[i]];
    }
    return {
      index,
      targetChar: correctChar,
      faces
    };
  });
  res.json({ success: true, word: targetWord, cubes });
});

app.post("/api/cubeword/verify", (req, res) => {
  const { submittedWord = "", targetWord = "" } = req.body;
  const isCorrect = submittedWord.trim().toUpperCase() === targetWord.trim().toUpperCase();
  res.json({
    success: true,
    isCorrect,
    earnedXp: isCorrect ? 40 : 5,
    message: isCorrect ? "Magnificent! Word assembled perfectly!" : "Not quite right yet. Rotate the cubes and try again."
  });
});

app.get("/api/cubeword/generate-special-word", async (req, res) => {
  try {
    const targetLang = req.query.targetLanguage || "English";
    const level = req.query.level || "B2";
    const prompt = `Provide a single elegant, expressive vocabulary word in ${targetLang} at CEFR level ${level}. Return JSON: { "word": "WORD", "clue": "Definition", "translation": "Azerbaijani translation", "cefr": "${level}" }`;
    const raw = await callGeminiWithResilience(prompt);
    if (raw) {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(clean);
      return res.json({ success: true, item: parsed });
    }
    res.json({
      success: true,
      item: { word: "EPIPHANY", clue: "Sudden striking realization", translation: "qəfil dərketmə", cefr: "C1" }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/user/sync-game-xp", (req, res) => {
  const { userId = "default-user", xpEarned = 25, gameMode = "cubeword" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
    syncedUsersDatabase[userId].userId = userId;
  }
  const user = syncedUsersDatabase[userId];
  user.xp = (user.xp || 0) + xpEarned;
  if (!user.gameHistory) user.gameHistory = [];
  user.gameHistory.push({ gameMode, xpEarned, timestamp: new Date().toISOString() });

  res.json({
    success: true,
    totalXp: user.xp,
    message: `+${xpEarned} XP synchronized for ${gameMode}!`
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
