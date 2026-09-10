

// SERVER2 - YOUR VERSION TO BE FIXED BASED ON THE COMPARISON WITH MINE TO DEFINE WHAT CORE FUNCTIONALITY YOUR VERSION STILL LACKS AND BREAKS
// =====================================================
// SPEAKBOT SERVER — COMPLETE UNIFIED VERSION
// Features: Supabase (SECRET key) + Redis + PDF Engine
// All original functionality preserved, no duplicates
// =====================================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import zlib from "zlib";
import fs from "fs";
import { generateGrammarGuidePdfBuffer, generateRoadmapPdfBuffer, generateVocabularyPdfBuffer, generateClassicStoryPdfBuffer } from './src/utils/pdfServerGenerator.js';
import { GAMES_VOCABULARY } from './src/data/gamesVocabularyData.js';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

dotenv.config();

// =====================================================
// CONFIG
// =====================================================
const currentFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// SUPABASE (NEW SECRET KEY)
// =====================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export const supabase = supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey)
    : null;

if (supabase) {
    console.log('[Supabase] Connected with SECRET key');
} else {
    console.warn('[Supabase] Not configured, using memory fallback');
}

// =====================================================
// REDIS (UPSTASH)
// =====================================================
const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

export const redis = redisUrl && redisToken
    ? new Redis({
        host: new URL(redisUrl).hostname,
        port: 6379,
        password: redisToken,
        tls: {},
        retryStrategy: (times) => {
            if (times > 3) {
                console.warn('[Redis] Retry exhausted, memory fallback active');
                return null;
            }
            return Math.min(times * 100, 3000);
        }
    })
    : null;

if (redis) {
    redis.on('connect', () => console.log('[Redis] Connected to Upstash'));
    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
} else {
    console.warn('[Redis] Not configured, using memory fallback');
}

// =====================================================
// SUPABASE SCHEMA CHECK
// =====================================================
async function ensureSupabaseSchema() {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('pdf_metadata').select('id').limit(1);
        if (error && error.code === '42P01') {
            console.warn('[Supabase] pdf_metadata table missing. Run SQL schema.');
        }
    } catch (e) {
        console.warn('[Supabase] Schema check failed:', e.message);
    }
}
ensureSupabaseSchema();

// =====================================================
// PDF STORAGE (Supabase Storage + Memory Fallback)
// =====================================================
const pdfStorage = {};

async function savePdfToSupabase(pdfBuffer, filename, userId, type) {
    if (!supabase) {
        const fileId = `pdf-${Date.now()}-${filename}`;
        pdfStorage[fileId] = { buffer: pdfBuffer, filename, userId, type, createdAt: new Date().toISOString() };
        return { success: true, id: fileId, url: `/api/pdfs/${fileId}` };
    }

    try {
        const { error: storageError } = await supabase
            .storage
            .from('pdfs')
            .upload(`${userId}/${type}/${filename}`, pdfBuffer, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) throw storageError;

        const { data: urlData } = supabase
            .storage
            .from('pdfs')
            .getPublicUrl(`${userId}/${type}/${filename}`);

        const { error: dbError } = await supabase
            .from('pdf_metadata')
            .insert({
                user_id: userId,
                filename: filename,
                type: type,
                url: urlData.publicUrl,
                created_at: new Date().toISOString()
            });

        if (dbError) throw dbError;

        return { success: true, url: urlData.publicUrl };
    } catch (error) {
        console.error("Supabase save failed, using memory fallback:", error.message);
        const fileId = `pdf-${Date.now()}-${filename}`;
        pdfStorage[fileId] = { buffer: pdfBuffer, filename, userId, type, createdAt: new Date().toISOString() };
        return { success: true, id: fileId, url: `/api/pdfs/${fileId}` };
    }
}

function sendPdf(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
}

// =====================================================
// DICTIONARIES FOR WORD BUILDER
// =====================================================
const customRequire = typeof require !== "undefined" ? require : createRequire(import.meta.url);

let englishWordSet = new Set();
let spanishWordSet = new Set();
let frenchWordSet = new Set();
let germanWordSet = new Set();
let multilingualVocabSet = new Set();

try {
    const enWords = customRequire("an-array-of-english-words");
    englishWordSet = new Set(enWords.map(w => w.toUpperCase()));
    console.log(`[WordBuilder] Loaded ${englishWordSet.size} English words`);
} catch (e) { console.warn("[WordBuilder] English dictionary:", e.message); }

try {
    const esWords = customRequire("an-array-of-spanish-words");
    spanishWordSet = new Set(esWords.map(w => w.toUpperCase()));
    console.log(`[WordBuilder] Loaded ${spanishWordSet.size} Spanish words`);
} catch (e) { console.warn("[WordBuilder] Spanish dictionary:", e.message); }

try {
    const frWords = customRequire("an-array-of-french-words");
    frenchWordSet = new Set(frWords.map(w => w.toUpperCase()));
    console.log(`[WordBuilder] Loaded ${frenchWordSet.size} French words`);
} catch (e) { console.warn("[WordBuilder] French dictionary:", e.message); }

try {
    const deWords = customRequire("an-array-of-german-words");
    germanWordSet = new Set(deWords.map(w => w.toUpperCase()));
    console.log(`[WordBuilder] Loaded ${germanWordSet.size} German words`);
} catch (e) { console.warn("[WordBuilder] German dictionary:", e.message); }

if (Array.isArray(GAMES_VOCABULARY)) {
    GAMES_VOCABULARY.forEach(item => {
        if (item.word) multilingualVocabSet.add(item.word.trim().toUpperCase());
        if (item.translations) {
            Object.values(item.translations).forEach(tr => {
                if (typeof tr === 'string') {
                    tr.split(/[\/,;]/).forEach(token => {
                        const clean = token.trim().toUpperCase();
                        if (clean && clean.length >= 3) multilingualVocabSet.add(clean);
                    });
                }
            });
        }
    });
}

// =====================================================
// PDF PARSER
// =====================================================
let PDFParse = null;
try {
    const pdfModule = customRequire("pdf-parse");
    PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse || pdfModule.default || pdfModule;
} catch (e) {
    console.warn("[PDF Engine] pdf-parse notice:", e.message);
}

// =====================================================
// MIDDLEWARE
// =====================================================
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});

app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ limit: "35mb", extended: true }));

// =====================================================
// GEMINI ENGINE
// =====================================================
let geminiClient = null;
function getGeminiClient() {
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) console.warn("GEMINI_API_KEY is not set.");
        geminiClient = new GoogleGenAI({
            apiKey: apiKey || "dummy-key-for-initialization",
            httpOptions: { headers: { "User-Agent": "aistudio-build" } }
        });
    }
    return geminiClient;
}

async function callGeminiWithResilience(prompt, preferredModel = "gemini-3.6-flash", fallbackModels = [], isJson = true) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const ai = getGeminiClient();
    const candidateModels = [preferredModel, ...fallbackModels];

    for (const model of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`[AI Engine] ${model} (attempt ${attempt + 1})`);
                const generatePromise = ai.models.generateContent({
                    model, contents: prompt,
                    config: isJson ? { responseMimeType: "application/json" } : {}
                });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("TIMEOUT_SPIKE")), 35000)
                );
                const response = await Promise.race([generatePromise, timeoutPromise]);
                if (response && response.text) return response.text;
            } catch (err) {
                const msg = err?.message || String(err);
                console.warn(`[AI Engine] ${model} attempt ${attempt + 1} failed: ${msg.slice(0, 100)}`);
                if (attempt === 0) await new Promise(r => setTimeout(r, 1200));
            }
        }
    }
    return null;
}

async function callOpenRouter(prompt, model = "openai/gpt-oss-20b:free") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] })
        });
        if (!response.ok) throw new Error(`OpenRouter: ${response.statusText}`);
        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (err) {
        console.warn("[AI Engine] OpenRouter failed:", err.message);
        return null;
    }
}

// =====================================================
// GZIP HELPERS
// =====================================================
function zipText(text) {
    if (!text) return "";
    return zlib.gzipSync(Buffer.from(text, "utf-8")).toString("base64");
}

function unzipText(zippedBase64) {
    if (!zippedBase64) return "";
    try {
        return zlib.gunzipSync(Buffer.from(zippedBase64, "base64")).toString("utf-8");
    } catch (e) {
        console.warn("[GZIP] warning:", e?.message);
        return zippedBase64;
    }
}

// =====================================================
// REDIS CACHE HELPERS (for bot.js state)
// =====================================================
async function getFromCache(key) {
    if (!redis) return null;
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('[Redis] get error:', err.message);
        return null;
    }
}

async function setToCache(key, value, ttlSeconds = 3600) {
    if (!redis) return false;
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return true;
    } catch (err) {
        console.error('[Redis] set error:', err.message);
        return false;
    }
}

// =====================================================
// USER DATABASE (In-memory + Disk fallback)
// =====================================================
const syncedUsersDatabase = {
    "default-user": {
        userId: "usr_speakbot_84920482",
        isPremium: false,
        usageCount: 0,
        premiumExpiresAt: null,
        telegramUsername: "@speakbot_learner",
        currentLevel: "B1",
        targetLanguage: "English",
        mediatorLanguage: "az",
        overallScore: 68,
        testHistory: [
            { date: new Date(Date.now() - 864e5 * 3).toISOString(), testType: "Initial Diagnostic /start", level: "B1", score: 68, source: "telegram_bot" }
        ],
        skillLevels: {
            grammar: { level: "B1", score: 65, lastTested: new Date(Date.now() - 864e5 * 2).toISOString() },
            vocabulary: { level: "B2", score: 72, lastTested: new Date(Date.now() - 864e5 * 2).toISOString() },
            listening: { level: "B1", score: 68, lastTested: new Date(Date.now() - 864e5 * 3).toISOString() },
            reading: { level: "B2", score: 75, lastTested: new Date(Date.now() - 864e5 * 4).toISOString() },
            speaking: { level: "B1", score: 60, lastTested: new Date(Date.now() - 864e5 * 1).toISOString() }
        },
        skillScores: { grammar: 65, vocabulary: 72, listening: 68, reading: 75, speaking: 60 },
        vocabularyByLanguage: {
            English: [
                { id: "vocab-en-1", word: "synthesize", translation: "birləşdirmək, sintez etmək", targetLanguage: "English", pos: "verb", ipa: "/ˈsɪnθəsaɪz/", example: "Researchers synthesize novel linguistic data models.", savedAt: new Date().toISOString() },
                { id: "vocab-en-2", word: "meticulous", translation: "hədsiz dərəcədə diqqətli, dəqiq", targetLanguage: "English", pos: "adjective", ipa: "/məˈtɪkjələs/", example: "He maintained meticulous grammatical accuracy.", savedAt: new Date().toISOString() }
            ],
            German: [
                { id: "vocab-de-1", word: "Nachhaltigkeit", translation: "davamlılıq / dayanıqlılıq", targetLanguage: "German", pos: "noun", ipa: "/ˈnaːxhaltɪçkaɪt/", example: "Nachhaltigkeit ist ein zentrales Prinzip moderner Sprachförderung.", savedAt: new Date().toISOString() }
            ]
        },
        savedVocabulary: [],
        lastSyncedAt: new Date().toISOString()
    }
};

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const ROADMAPS_FILE = path.join(process.cwd(), "data", "roadmaps.json");
const GRAMMAR_GUIDES_FILE = path.join(process.cwd(), "data", "grammar_guides.json");
const STORAGE_FILE = path.join(process.cwd(), "data", "stories.json");
const DATA_DIR = path.dirname(STORAGE_FILE);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsersFromDisk() {
    try { return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) : {}; }
    catch { return {}; }
}
function saveUsersToDisk() {
    try { fs.writeFileSync(USERS_FILE, JSON.stringify(syncedUsersDatabase, null, 2)); }
    catch (e) { console.error("Save users failed:", e); }
}
function loadStoriesFromDisk() {
    try {
        if (fs.existsSync(STORAGE_FILE)) return JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    } catch (err) { console.warn("[Storage] load:", err.message); }
    return { userCustomStories: {}, autoFetchedStories: [] };
}
function saveStoriesToDisk() {
    try {
        const payload = { userCustomStories, autoFetchedStories, savedAt: new Date().toISOString() };
        fs.writeFileSync(STORAGE_FILE, zipText(JSON.stringify(payload)));
    } catch (err) { console.error("[Storage] save:", err.message); }
}

const loadedUsers = loadUsersFromDisk();
for (const uid in loadedUsers) {
    if (!syncedUsersDatabase[uid]) syncedUsersDatabase[uid] = loadedUsers[uid];
}

syncedUsersDatabase["default-user"].savedVocabulary =
    syncedUsersDatabase["default-user"].vocabularyByLanguage[syncedUsersDatabase["default-user"].targetLanguage] ||
    syncedUsersDatabase["default-user"].vocabularyByLanguage.English;

function ensureUserVocabStructure(user) {
    if (!user.vocabularyByLanguage) {
        user.vocabularyByLanguage = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"].vocabularyByLanguage));
    }
    const activeLang = user.targetLanguage || "English";
    if (!user.vocabularyByLanguage[activeLang]) user.vocabularyByLanguage[activeLang] = [];
    user.savedVocabulary = user.vocabularyByLanguage[activeLang];
}

const diskData = loadStoriesFromDisk();
let userCustomStories = diskData.userCustomStories || {};
let autoFetchedStories = diskData.autoFetchedStories || [];

// =====================================================
// LANGUAGE CANONICAL MAPPER
// =====================================================
function normalizeLanguageCanonical(lang) {
    if (!lang) return "English";
    const s = String(lang).trim().toLowerCase();
    if (s === "en" || s === "english") return "English";
    if (s === "de" || s === "german" || s === "deutsch") return "German";
    if (s === "es" || s === "spanish" || s === "español") return "Spanish";
    if (s === "fr" || s === "french" || s === "français") return "French";
    if (s === "it" || s === "italian" || s === "italiano") return "Italian";
    if (s === "ru" || s === "russian" || s === "русский") return "Russian";
    if (s === "tr" || s === "turkish" || s === "türkçe") return "Turkish";
    return lang.charAt(0).toUpperCase() + lang.slice(1);
}

// =====================================================
// PDF EXTRACTION ENGINE
// =====================================================
function cleanGutenbergHeaders(text) {
    if (!text) return "";
    let cleaned = text;
    const startMarker = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
    const match = cleaned.match(startMarker);
    if (match) cleaned = cleaned.slice(match.index + match[0].length);
    const endMarker = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
    const endMatch = cleaned.match(endMarker);
    if (endMatch) cleaned = cleaned.slice(0, endMatch.index);
    return cleaned.trim();
}

function cleanExtractedPdfText(text) {
    if (!text) return "";
    return cleanGutenbergHeaders(text)
        .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
        .replace(/[\uFB00-\uFB06]/g, (m) => ({ "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st" }[m] || m))
        .replace(/(\w+)-\s*\n\s*(\w+)/g, "$1$2")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .trim();
}

async function extractTextFromPdfWithOCR(buffer) {
    return '';
}

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
            try { decompressed = zlib.inflateSync(rawChunk).toString("utf-8"); }
            catch (_) {
                try { decompressed = zlib.inflateRawSync(rawChunk).toString("utf-8"); }
                catch (_) { decompressed = rawChunk.toString("utf-8"); }
            }
            if (decompressed && decompressed.length > 10) {
                const tjMatches = decompressed.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
                for (const m of tjMatches) {
                    const parenMatches = m[1].matchAll(/\(([^()]*)\)/g);
                    for (const p of parenMatches) {
                        const token = p[1].replace(/\\([nrtbf()])/g, "$1").trim();
                        if (token) collectedTokens.push(token);
                    }
                }
                const directTj = decompressed.matchAll(/\(([^()]*)\)\s*T[jJ]/g);
                for (const m of directTj) {
                    const token = m[1].replace(/\\([nrtbf()])/g, "$1").trim();
                    if (token) collectedTokens.push(token);
                }
            }
        }
        return collectedTokens.join(" ");
    } catch (err) {
        console.warn("[PDF Engine] Stream extractor:", err.message);
        return "";
    }
}

function isReadableLiteraryText(text) {
    if (!text || text.trim().length < 40) return false;
    const sample = text.slice(0, 4000);
    const pdfInternalMarkers = [
        /<<\s*\/[A-Z]/i, /\/Filter\s*\/[A-Za-z]+/i, /\/Type\s*\/[A-Za-z]+/i,
        /\/MediaBox/i, /\bendobj\b/i, /\bxref\b/i, /\btrailer\s*<</i,
        /\bstartxref\b/i, /\/Font\s*<</i, /\/Length\s+\d+/i
    ];
    let markerHits = 0;
    for (const regex of pdfInternalMarkers) if (regex.test(sample)) markerHits++;
    if (markerHits >= 2) return false;
    const lettersAndSpaces = (sample.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF\s.,!?'"()\-—:;]/g) || []).length;
    if (lettersAndSpaces / sample.length < 0.60) return false;
    const words = sample.split(/\s+/).filter((w) => /[A-Za-z\u00C0-\u024F\u0400-\u04FF]{2,}/.test(w));
    if (words.length < 8) return false;
    return true;
}

async function extractTextFromPdfBuffer(buffer) {
    try {
        console.log(`[PDF Engine] Extracting from ${buffer.length} bytes`);
        if (PDFParse) {
            const ParserClass = typeof PDFParse === "function" ? PDFParse : PDFParse.PDFParse;
            if (ParserClass) {
                try {
                    const parser = new ParserClass({ data: buffer });
                    let res = null;
                    try { res = await parser.getText({ first: 30 }); }
                    catch (_) { res = await parser.getText(); }
                    const raw = typeof res === "string" ? res : (res && res.text ? res.text : "");
                    if (typeof parser.destroy === "function") {
                        try { await parser.destroy(); } catch (_) { }
                    }
                    const cleaned = cleanExtractedPdfText(raw);
                    if (isReadableLiteraryText(cleaned) && cleaned.length > 50) return cleaned;
                } catch (e1) { console.warn("[PDF] PDFParse class:", e1.message); }
                try {
                    const parseFunc = typeof PDFParse === "function" ? PDFParse : PDFParse.default;
                    if (typeof parseFunc === "function") {
                        const res = await parseFunc(buffer, { max: 30 });
                        const raw = typeof res === "string" ? res : (res && res.text ? res.text : "");
                        const cleaned = cleanExtractedPdfText(raw);
                        if (isReadableLiteraryText(cleaned) && cleaned.length > 50) return cleaned;
                    }
                } catch (e2) { console.warn("[PDF] pdf-parse:", e2.message); }
            }
        }
    } catch (err) { console.warn("[PDF Engine] Core parse:", err.message); }

    try {
        const rawStreamText = extractTextFromPdfStreams(buffer);
        if (rawStreamText && rawStreamText.length > 60) {
            const cleaned = cleanExtractedPdfText(rawStreamText);
            if (isReadableLiteraryText(cleaned) && cleaned.length > 50) return cleaned;
        }
    } catch (eStream) { console.warn("[PDF] Stream extraction:", eStream.message); }

    try {
        const rawStr = buffer.toString("utf-8");
        const textMatches = rawStr.match(/\(([^()]*)\)\s*T[jJ]/g);
        if (textMatches && textMatches.length > 0) {
            const extracted = textMatches
                .map((m) => { const match = m.match(/\(([^()]*)\)/); return match ? match[1] : ""; })
                .filter((m) => m.trim().length > 1).join(" ");
            const cleaned = cleanExtractedPdfText(extracted);
            if (isReadableLiteraryText(cleaned) && cleaned.length > 50) return cleaned;
        }
    } catch (eRegex) { console.warn("[PDF] Regex:", eRegex.message); }

    return "";
}

// =====================================================
// BOOK METADATA PARSER
// =====================================================
function parseBookMetadata(fileName = "", bookTitle = "", author = "", rawText = "") {
    let cleanTitle = String(bookTitle || "").replace(/\.[^/.]+$/, "").trim();
    let cleanAuthor = String(author || "").trim();

    const isGenericAuthor = !cleanAuthor ||
        /^(custom author|selected author|uploaded author|author|unknown|various)$/i.test(cleanAuthor);

    const baseName = String(fileName || "").replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim();

    if (cleanTitle.includes("_") || cleanTitle === baseName || isGenericAuthor) {
        const dashParts = baseName.split(/\s*[-–—]\s*/);
        if (dashParts.length >= 2 && isGenericAuthor) {
            cleanTitle = dashParts[0].trim();
            cleanAuthor = dashParts[1].trim();
        }
    }

    cleanTitle = cleanTitle.replace(/_/g, " ").trim();
    cleanAuthor = cleanAuthor.replace(/_/g, " ").trim();

    const probe = (cleanTitle + " " + baseName + " " + (rawText ? rawText.slice(0, 1500) : "")).toLowerCase();

    if (probe.includes("moby") || probe.includes("ishmael") || probe.includes("melville"))
        return { title: "Moby-Dick; or, The Whale", author: "Herman Melville", era: "American Renaissance (1851)", canonKey: "moby_dick" };
    if (probe.includes("dorian gray") || probe.includes("oscar wilde"))
        return { title: "The Picture of Dorian Gray", author: "Oscar Wilde", era: "Victorian Aestheticism (1890)", canonKey: "dorian_gray" };
    if (probe.includes("frankenstein") || probe.includes("mary shelley") || probe.includes("victor frankenstein"))
        return { title: "Frankenstein; or, The Modern Prometheus", author: "Mary Shelley", era: "Romantic Gothic (1818)", canonKey: "frankenstein" };
    if (probe.includes("pride and prejudice") || probe.includes("jane austen") || probe.includes("elizabeth bennet"))
        return { title: "Pride and Prejudice", author: "Jane Austen", era: "Regency Romance & Satire (1813)", canonKey: "pride_and_prejudice" };
    if (probe.includes("gatsby") || probe.includes("fitzgerald") || probe.includes("daisy buchanan"))
        return { title: "The Great Gatsby", author: "F. Scott Fitzgerald", era: "Jazz Age Modernism (1925)", canonKey: "great_gatsby" };
    if (probe.includes("alice") && (probe.includes("wonderland") || probe.includes("carroll")))
        return { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", era: "Victorian Literary Nonsense (1865)", canonKey: "alice_in_wonderland" };
    if (probe.includes("dracula") || probe.includes("bram stoker") || probe.includes("transylvania"))
        return { title: "Dracula", author: "Bram Stoker", era: "Victorian Gothic (1897)", canonKey: "dracula" };
    if (probe.includes("metamorphosis") || probe.includes("kafka") || probe.includes("gregor samsa"))
        return { title: "The Metamorphosis", author: "Franz Kafka", era: "Modernist Absurdism (1915)", canonKey: "metamorphosis" };

    return {
        title: cleanTitle || "Literary Classic",
        author: isGenericAuthor ? "Classic Author" : cleanAuthor,
        era: "World Literature",
        canonKey: null
    };
}

// =====================================================
// LITERARY CANON EXCERPTS (fallback passages)
// =====================================================
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
            "Poetic sensory parallelism linking gloomy external weather with inner existential crisis."
        ],
        vocabulary: [
            { word: "spleen", ipa: "/spliːn/", pos: "noun", translation: "bəd əhval / qüssə", cefr: "B2", example: "It is a way I have of driving off the spleen." },
            { word: "circulation", ipa: "/ˌsɜːrkjəˈleɪʃən/", pos: "noun", translation: "", cefr: "B1", example: "Regulating the circulation of vital spirits." },
            { word: "precisely", ipa: "/prɪˈsaɪsli/", pos: "adverb", translation: "", cefr: "B1", example: "Never mind how long precisely." },
            { word: "drizzly", ipa: "/ˈdrɪzli/", pos: "adjective", translation: "", cefr: "B2", example: "Whenever it is a damp, drizzly November in my soul." }
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

function generateLocalFallbackStory(params) {
    const { bookTitle, author, authorEra, canonKey, targetLanguage, mediatorLanguage, userLevel, excerptSlice, isSimulated } = params;
    const canon = canonKey && LITERARY_CANON_EXCERPTS[canonKey] ? LITERARY_CANON_EXCERPTS[canonKey] : null;
    let sentences = [], translations = [], literaryNotes = [], keyVocabulary = [];

    if (isSimulated) {
        sentences = [
            `This PDF appears to be a scanned document without extractable text.`,
            `Please try uploading a text-based PDF or provide a text file (.txt).`,
            `AI processing was attempted but failed due to lack of text content.`
        ];
    }

    if (canon) {
        sentences = canon.sentences;
        translations = canon.translationsAz.map((az) => mediatorLanguage === "az" ? az : "");
        literaryNotes = canon.literaryNotes;
        keyVocabulary = canon.vocabulary.map((v) => ({
            ...v, translation: mediatorLanguage === "az" ? v.translation : ""
        }));
    } else if (!isSimulated && excerptSlice && !excerptSlice.startsWith("SIMULATION_PROMPT_TRIGGER:") && excerptSlice.length > 50) {
        const rawMatches = excerptSlice.match(/[^.!?]+[.!?]+/g);
        if (rawMatches && rawMatches.length > 0) {
            sentences = rawMatches.map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 240).slice(0, 5);
        }
        if (sentences.length === 0) sentences = [excerptSlice.slice(0, 180).trim() + "."];

        translations = sentences.map(() => "");
        literaryNotes = sentences.map((_, idx) => `Sentence ${idx + 1} extracted from the book.`);

        const stopWords = new Set(["the", "and", "that", "this", "with", "from", "have", "were", "been", "which", "their", "there", "about", "would", "could", "into"]);
        const allWords = sentences.join(" ").replace(/[^\w\s]/g, "").split(/\s+/);
        const candidateWords = Array.from(new Set(allWords.filter((w) => w.length >= 6 && !stopWords.has(w.toLowerCase()))));
        const pickedWords = candidateWords.slice(0, 4);
        if (pickedWords.length === 0) pickedWords.push("example");

        keyVocabulary = pickedWords.map((word) => ({
            word: word.toLowerCase(),
            ipa: `/${word.toLowerCase()}/`,
            pos: "unknown",
            translation: "",
            cefr: userLevel,
            example: sentences.find((s) => s.toLowerCase().includes(word.toLowerCase())) || `Word from the book.`
        }));
    } else if (!canon && !isSimulated) {
        sentences = [
            `This is an excerpt from "${bookTitle}" by ${author}.`,
            `The original text is in ${targetLanguage}.`,
            `AI processing failed. Please try again later.`
        ];
        translations = sentences.map(() => "");
        literaryNotes = sentences.map(() => "Placeholder until AI generates proper content.");
    }

    return {
        title: bookTitle,
        author,
        authorEra: authorEra || "Unknown",
        level: userLevel,
        mode: "both",
        duration: "3 min read • 2 min audio",
        targetLanguage,
        culturalLinguisticContext: `Excerpt from "${bookTitle}" by ${author} (${authorEra || "Unknown"}). Fallback generated because AI could not process the book.`,
        paragraphs: [sentences.join(" ")],
        sentences: sentences.map((s, idx) => ({
            text: s,
            translation: translations[idx] || "",
            literaryNote: literaryNotes[idx] || "",
            audioTime: `0:${String(idx * 7).padStart(2, "0")} - 0:${String((idx + 1) * 7).padStart(2, "0")}`
        })),
        keyVocabulary,
        stylisticDevices: [],
        conversations: [{
            id: "socratic-1", stepNumber: 1, persona: "SpeakBot Mentor", topic: "General",
            prompt: `What is the main topic of this excerpt from "${bookTitle}"?`,
            options: [`The main topic is ${bookTitle} by ${author}.`, `I don't know.`, `It's about philosophy.`],
            correctIndex: 0, botFeedback: `Placeholder. AI processing failed.`, points: 5
        }],
        exercises: [{
            id: "task-1", taskNumber: 1, category: "Comprehension",
            question: `What is the title of this book?`,
            options: [bookTitle, "Unknown", "Not provided"],
            correctIndex: 0, explanation: `The title is "${bookTitle}".`, points: 5
        }]
    };
}

// =====================================================
// DAILY BOT STORY FEEDS (FIXED - feeds variable)
// =====================================================
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
                level: "B1", mode: "both",
                duration: "4 min read • 2 min audio",
                targetLanguage: "English",
                isDailyBotFeed: true,
                sourceBook: "SpeakBot 3x Daily Literary Canon",
                culturalLinguisticContext: "Wordsworth's lyrical celebration of nature exemplifies Romantic SVO prosody.",
                paragraphs: [
                    "Behold her, single in the field, yon solitary Highland Lass! Reaping and singing by herself, stop here, or gently pass!",
                    "Alone she cuts and binds the grain, and sings a melancholy strain. O listen! for the Vale profound is overflowing with the sound."
                ],
                sentences: [
                    { text: "Behold her, single in the field, yon solitary Highland Lass!", translation: "Bax ona, tarlada tək-tənha, o uzaqdakı tənha dağlı qıza!", literaryNote: "Imperative 'Behold' captures immediate sensory attention.", audioTime: "0:00 - 0:08" },
                    { text: "Reaping and singing by herself, stop here, or gently pass!", translation: "Təkbaşına biçir və oxuyur; burada dayan, ya da sakitcə keç!", literaryNote: "Parallel participial clauses maintain rhythmic balance.", audioTime: "0:08 - 0:17" }
                ],
                keyVocabulary: [
                    { word: "solitary", ipa: "/ˈsɒl.ɪ.tər.i/", pos: "adjective", translation: "tənha, tək", cefr: "B2", example: "She lived a solitary life in the hills." },
                    { word: "reap", ipa: "/riːp/", pos: "verb", translation: "biçmək, məhsul yığmaq", cefr: "B2", example: "Farmers reap what they have sown." }
                ],
                stylisticDevices: [{ device: "Imperative Apostrophe", exampleFromText: "Behold her... O listen!", explanation: "Direct rhetorical address urging sensory immersion." }],
                conversations: [{
                    persona: "SpeakBot Literary Socrates",
                    prompt: "Why does the poet urge the passerby to 'stop here, or gently pass'?",
                    options: ["To preserve the sanctity and pure resonance of the song without disturbance.", "Because the reaper asked for agricultural assistance.", "Because the path was closed for maintenance."],
                    correctIndex: 0, botFeedback: "Superb! Preserving the pure acoustic sanctity is paramount."
                }],
                exercises: [{
                    question: "What syntactic role does 'solitary' serve in the opening clause?",
                    options: ["Attributive adjective modifying 'Lass'", "Adverb of manner", "Direct object of the verb"],
                    correctIndex: 0, explanation: "'Solitary' is an adjective characterizing the noun 'Lass'."
                }]
            },
            {
                id: "daily-bot-afternoon-en",
                feedSlot: "Afternoon Dialogue (14:00)",
                title: "The Picture of Dorian Gray: Art and Aesthetics",
                author: "Oscar Wilde",
                authorEra: "Late Victorian (1890)",
                level: "B2", mode: "both",
                duration: "5 min read • 3 min audio",
                targetLanguage: "English",
                isDailyBotFeed: true,
                sourceBook: "SpeakBot 3x Daily Literary Canon",
                culturalLinguisticContext: "Wilde's epigrammatic dialogues showcase Victorian rhetorical wit and inverted syntactic aphorisms.",
                paragraphs: [
                    "The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac.",
                    "In the centre of the room, clamped to an upright easel, stood the full-length portrait of a young man of extraordinary personal beauty."
                ],
                sentences: [
                    { text: "The studio was filled with the rich odour of roses.", translation: "Emalatxana güllərin zəngin ətri ilə dolu idi.", literaryNote: "Sensory olfactory opening establishes the decadent aesthetic ambiance.", audioTime: "0:00 - 0:07" },
                    { text: "In the centre of the room stood the full-length portrait of a young man of extraordinary personal beauty.", translation: "Otağın mərkəzində fövqəladə gözəlliyə malik gənc bir kişinin bütöv boylu portreti dururdu.", literaryNote: "Locative inversion creates suspense before revealing the subject.", audioTime: "0:07 - 0:18" }
                ],
                keyVocabulary: [
                    { word: "odour", ipa: "/ˈəʊ.dər/", pos: "noun", translation: "ətir, qoxu", cefr: "B2", example: "The sweet odour of jasmine filled the hallway." },
                    { word: "easel", ipa: "/ˈiː.zəl/", pos: "noun", translation: "molbert", cefr: "B2", example: "The canvas was resting securely on the wooden easel." },
                    { word: "extraordinary", ipa: "/ɪkˈstrɔː.dɪn.ər.i/", pos: "adjective", translation: "fövqəladə, qeyri-adi", cefr: "B1", example: "She possessed an extraordinary talent for languages." }
                ],
                stylisticDevices: [{ device: "Locative Inversion", exampleFromText: "In the centre of the room stood the portrait...", explanation: "Places spatial prepositional phrase before verb to elevate focus." }],
                conversations: [{
                    persona: "Lord Henry Wotton",
                    prompt: "What does Wilde's locative inversion achieve in introducing the portrait?",
                    options: ["It guides the reader's gaze across the room before unveiling the masterpiece.", "It indicates that the painter was absent from the room.", "It demonstrates colloquial dialogue."],
                    correctIndex: 0, botFeedback: "Precisely! Locative inversion controls scenic cinematography."
                }],
                exercises: [{
                    question: "Which word best matches the meaning of 'extraordinary' in context?",
                    options: ["Remarkable / Exceptional", "Ordinary / Common", "Bizarre / Dangerous"],
                    correctIndex: 0, explanation: "'Extraordinary' denotes remarkably exceptional."
                }]
            },
            {
                id: "daily-bot-evening-en",
                feedSlot: "Evening Literary Masterpiece (20:00)",
                title: "Frankenstein: The Sublime Alpine Solitude",
                author: "Mary Shelley",
                authorEra: "Gothic Romanticism (1818)",
                level: "B2", mode: "both",
                duration: "5 min read • 3 min audio",
                targetLanguage: "English",
                isDailyBotFeed: true,
                sourceBook: "SpeakBot 3x Daily Literary Canon",
                culturalLinguisticContext: "Mary Shelley uses the sublime mountain landscape to mirror Victor Frankenstein's psychological torment.",
                paragraphs: [
                    "The desert mountains and dreary glaciers are my refuge. I have wandered here many days; the caves of ice, which I only do not fear, are a dwelling to me.",
                    "These sublime and magnificent scenes afforded me the greatest consolation that I was capable of receiving."
                ],
                sentences: [
                    { text: "The desert mountains and dreary glaciers are my refuge.", translation: "Kimsəsiz dağlar və tutqun buzlaqlar mənim sığınacağımdır.", literaryNote: "Gothic juxtaposition of inhospitable terrain with 'refuge'.", audioTime: "0:00 - 0:08" },
                    { text: "These sublime and magnificent scenes afforded me the greatest consolation.", translation: "Bu əzəmətli və möhtəşəm mənzərələr mənə ən böyük təsəllini bəxş edirdi.", literaryNote: "'Afforded' means 'provided' or 'bestowed'.", audioTime: "0:08 - 0:19" }
                ],
                keyVocabulary: [
                    { word: "dreary", ipa: "/ˈdrɪə.ri/", pos: "adjective", translation: "tutqun, sıxıcı", cefr: "B2", example: "It was a dreary winter morning." },
                    { word: "refuge", ipa: "/ˈref.juːdʒ/", pos: "noun", translation: "sığınacaq", cefr: "B2", example: "The old library became his refuge." },
                    { word: "sublime", ipa: "/səˈblaɪm/", pos: "adjective", translation: "əzəmətli, ali", cefr: "C1", example: "The majestic peaks evoked sublime awe." },
                    { word: "consolation", ipa: "/ˌkɒn.səˈleɪ.ʃən/", pos: "noun", translation: "təsəlli", cefr: "B2", example: "Music brought him great consolation." }
                ],
                stylisticDevices: [{ device: "Romantic Sublime", exampleFromText: "sublime and magnificent scenes", explanation: "Evokes grandeur and awe inspired by untamed nature." }],
                conversations: [{
                    persona: "Mary Shelley",
                    prompt: "What does 'afforded' mean in 'afforded me the greatest consolation'?",
                    options: ["Provided or granted", "Purchased with money", "Delayed or postponed"],
                    correctIndex: 0, botFeedback: "Exact! 'To afford' often means to provide or bestow."
                }],
                exercises: [{
                    question: "What part of speech is 'dreary' in 'dreary glaciers'?",
                    options: ["Adjective modifying glaciers", "Adverb of place", "Noun subject"],
                    correctIndex: 0, explanation: "'Dreary' is an adjective qualifying 'glaciers'."
                }]
            }
        ],
        german: [
            {
                id: "daily-bot-morning-de",
                feedSlot: "Morgendliche Klassik (08:00)",
                title: "Goethes Faust: Der Tragödie Erster Teil",
                author: "Johann Wolfgang von Goethe",
                authorEra: "Weimarer Klassik (1808)",
                level: "B1", mode: "both",
                duration: "4 min read • 2 min audio",
                targetLanguage: "German",
                isDailyBotFeed: true,
                sourceBook: "SpeakBot 3x Daily Literary Canon",
                culturalLinguisticContext: "Goethes philosophischer Monolog reflektiert den ewigen Drang nach Wissen.",
                paragraphs: [
                    "Habe nun, ach! Philosophie, Juristerei und Medizin, und leider auch Theologie durchaus studiert, mit heißem Bemühn.",
                    "Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor; heiße Magister, heiße Doktor gar."
                ],
                sentences: [
                    { text: "Habe nun, ach! Philosophie, Juristerei und Medizin durchaus studiert.", translation: "Bax indi, ah! Fəlsəfə, hüquq və təbabəti dərindən öyrəndim.", literaryNote: "Voranstellung des finiten Verbs verleiht dramatische Intensität.", audioTime: "0:00 - 0:08" },
                    { text: "Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor.", translation: "Bax indi burada dururam, mən zavallı axmaq! Və əvvəlki kimi ağıllıyam.", literaryNote: "'Tor' ist ein klassisches deutsches Substantiv für einen Narren.", audioTime: "0:08 - 0:17" }
                ],
                keyVocabulary: [
                    { word: "der Tor", ipa: "/toːɐ̯/", pos: "noun", translation: "axmaq, nadan kəs", cefr: "B2", example: "Er fühlte sich wie ein armer Tor." },
                    { word: "studieren", ipa: "/ʃtuˈdiːʁən/", pos: "verb", translation: "təhsil almaq, öyrənmək", cefr: "A1", example: "Ich studiere deutsche Literatur." },
                    { word: "die Theologie", ipa: "/teoloˈɡiː/", pos: "noun", translation: "ilahiyyat", cefr: "B2", example: "Theologie befasst sich mit religiösen Lehren." }
                ],
                stylisticDevices: [{ device: "Klimax & Ausruf", exampleFromText: "Habe nun, ach! ... durchaus studiert", explanation: "Steigerung der Studienfächer bis zur Desillusionierung." }],
                conversations: [{
                    persona: "Goethes Faust",
                    prompt: "Was bedeutet die Wendung 'so klug als wie zuvor'?",
                    options: ["Dass akademische Grade das wahre Wesen des Lebens nicht enthüllen konnten.", "Dass er seine Prüfungen nicht bestanden hat.", "Dass er Arzt werden möchte."],
                    correctIndex: 0, botFeedback: "Hervorragend! Faust beklagt die Beschränktheit rein theoretischen Buchwissens."
                }],
                exercises: [{
                    question: "Welches Genus hat das Substantiv 'Tor' im Sinne von 'Narr'?",
                    options: ["Maskulinum (der Tor)", "Neutrum (das Tor)", "Femininum (die Tor)"],
                    correctIndex: 0, explanation: "'Der Tor' = der Narr / Unwissende; 'das Tor' = große Tür."
                }]
            }
        ],
        spanish: [],
        french: []
    };

    const languageMap = {
        'english': 'english',
        'german': 'german', 'deutsch': 'german',
        'spanish': 'spanish', 'español': 'spanish',
        'french': 'french', 'français': 'french'
    };

    const feedKey = languageMap[lang] || 'english';
    return feeds[feedKey] && feeds[feedKey].length > 0 ? feeds[feedKey] : feeds.english;
}

// =====================================================
// GUTENBERG HELPERS
// =====================================================
function mapGutenbergLanguageToTargetLanguage(rawLangValue) {
    if (!rawLangValue) return null;
    const val = rawLangValue.trim().toLowerCase();
    const table = {
        en: "English", english: "English",
        de: "German", german: "German", deutsch: "German",
        es: "Spanish", spanish: "Spanish", "español": "Spanish",
        fr: "French", french: "French", "français": "French",
        it: "Italian", italian: "Italian", italiano: "Italian",
        ru: "Russian", russian: "Russian", "русский": "Russian",
        tr: "Turkish", turkish: "Turkish", "türkçe": "Turkish"
    };
    return table[val] || null;
}

function detectGutenbergBookLanguage(html) {
    const schemaMatch = html.match(/itemprop=["']inLanguage["']\s+content=["']([a-zA-Z-]+)["']/i);
    if (schemaMatch) {
        const mapped = mapGutenbergLanguageToTargetLanguage(schemaMatch[1].split("-")[0]);
        if (mapped) return mapped;
    }
    const rowMatch = html.match(/Language:?\s*<\/th>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/i);
    if (rowMatch) {
        const mapped = mapGutenbergLanguageToTargetLanguage(rowMatch[1]);
        if (mapped) return mapped;
    }
    return null;
}

function selectBestExcerpt(text, targetWords = 300) {
    if (!text) return "";
    const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 100);
    if (paragraphs.length === 0) return text.slice(0, targetWords);

    const scoreParagraph = (p) => {
        const words = p.split(/\s+/).filter(Boolean);
        const unique = new Set(words.map(w => w.toLowerCase())).size;
        const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        const hasLiteraryMarkers = /\b(shall|might|perhaps|never|soul|heart|mystery|shadow|dawn|twilight|melancholy|sublime)\b/i.test(p);
        return (unique / words.length) * 2 + avgWordLen * 0.3 + (hasLiteraryMarkers ? 5 : 0);
    };

    const sorted = paragraphs.map((p, idx) => ({ text: p, score: scoreParagraph(p), idx })).sort((a, b) => b.score - a.score);

    let excerpt = "", wordCount = 0;
    for (const para of sorted) {
        excerpt += para.text + " ";
        wordCount += para.text.split(/\s+/).length;
        if (wordCount >= targetWords) break;
    }
    return excerpt.trim().substring(0, targetWords * 2);
}

async function fetchRandomGutenbergBook() {
    try {
        const response = await fetch("https://www.gutenberg.org/ebooks/random", { redirect: "follow" });
        const html = await response.text();
        const finalUrl = response.url;

        const detectedLanguage = detectGutenbergBookLanguage(html);
        if (!detectedLanguage) {
            console.warn("[AutoFetch] Could not detect language, skipping.");
            return null;
        }

        let bookId = null;
        const idFromUrl = finalUrl.match(/\/(\d+)(?:\.|\/|$)/);
        if (idFromUrl) bookId = idFromUrl[1];
        if (!bookId) {
            const idFromHtml = html.match(/\/ebooks\/(\d+)/);
            if (idFromHtml) bookId = idFromHtml[1];
        }
        if (!bookId) throw new Error("Could not identify book ID");

        const candidates = [
            `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`,
            `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
            `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
            `https://www.gutenberg.org/ebooks/${bookId}.txt.utf-8`
        ];

        for (const url of candidates) {
            try {
                const textResponse = await fetch(url);
                if (textResponse.ok) {
                    const fullText = await textResponse.text();
                    if (fullText && fullText.trim().length > 100) {
                        const excerpt = selectBestExcerpt(fullText, 300);
                        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
                        const title = titleMatch ? titleMatch[1].split(" by ")[0].trim() : `Gutenberg Book ${bookId}`;
                        return {
                            id: `auto-${Date.now()}`,
                            title, author: "Unknown", targetLanguage: detectedLanguage,
                            excerpt, content: fullText, source: "Project Gutenberg",
                            isAutoFetched: true, createdAt: new Date().toISOString()
                        };
                    }
                }
            } catch (e) { /* next */ }
        }
        throw new Error("Could not find text URL");
    } catch (err) {
        console.error("[AutoFetch] Failed:", err.message);
        return null;
    }
}

// =====================================================
// ROUTE: HEALTH
// =====================================================
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        serverTime: new Date().toISOString(),
        supabaseConnected: Boolean(supabase),
        redisConnected: Boolean(redis),
        pdfParseLoaded: Boolean(PDFParse),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});

// =====================================================
// ROUTE: PDF UPLOAD + NLT STORY SYNTHESIS
// =====================================================
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
            mediatorLanguage = req.body.mediatorLanguage || (syncedUsersDatabase[userId]?.mediatorLanguage) || "en",
            userLevel = "B1"
        } = req.body;

        console.log(`[PDF Endpoint] Processing "${bookTitle}" (${fileName})`);

        if (fileBase64) {
            const approxSizeMb = (fileBase64.length * 0.75) / (1024 * 1024);
            const MAX_ALLOWED_MB = 25;
            if (approxSizeMb > MAX_ALLOWED_MB) {
                return res.status(400).json({
                    success: false,
                    error: `File size too large (${approxSizeMb.toFixed(1)} MB). Max: ${MAX_ALLOWED_MB} MB.`
                });
            }
        }

        let extractedText = String(fileText || "").trim();
        if (!extractedText && fileBase64) {
            try {
                const cleanBase64 = fileBase64.replace(/^data:application\/pdf;base64,/, "").replace(/^data:text\/plain;base64,/, "");
                const buffer = Buffer.from(cleanBase64, "base64");
                extractedText = await extractTextFromPdfBuffer(buffer);
            } catch (err) { console.warn("[PDF Endpoint] parse error:", err.message); }
        }

        const meta = parseBookMetadata(fileName, bookTitle, author, extractedText);
        const { title: resolvedTitle, author: resolvedAuthor, era: resolvedEra } = meta;

        const isTextScannedOrEmpty = !extractedText || extractedText.trim().length < 20;
        let cleanedText = "";

        if (isTextScannedOrEmpty) {
            cleanedText = `SIMULATION_PROMPT_TRIGGER: Generate an iconic authentic excerpt from "${resolvedTitle}" by "${resolvedAuthor}" in ${targetLanguage}.`;
        } else {
            cleanedText = extractedText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }

        const zippedBookContent = zipText(cleanedText);
        const textFromDb = unzipText(zippedBookContent);
        let excerptSlice = "";

        if (textFromDb.startsWith("SIMULATION_PROMPT_TRIGGER:")) {
            excerptSlice = textFromDb;
        } else {
            excerptSlice = selectBestExcerpt(textFromDb, 1000);
        }

        const aiPrompt = `You are SpeakBot's Chief NLP Literary Pedagogical Engine.
The user uploaded a book titled "${resolvedTitle}" by "${resolvedAuthor}".
Literary Era: ${resolvedEra}
Target Language of Book: ${targetLanguage}
User Target CEFR Level: ${userLevel}
Mediator Language for translations: ${mediatorLanguage}

${isTextScannedOrEmpty
                ? `TASK: Generate an authentic 180-260 word literary excerpt from "${resolvedTitle}" by "${resolvedAuthor}" in ${targetLanguage} at CEFR ${userLevel}.`
                : `Here is the authentic text excerpt:\n"""\n${excerptSlice}\n"""`}

Synthesize a complete, interactive Classic Story reading and audio study module.
Return ONLY valid JSON matching:
{
  "title": "${bookTitle}",
  "author": "${author}",
  "authorEra": "Literary Era",
  "level": "${userLevel}",
  "mode": "both",
  "duration": "4 min read • 2 min audio",
  "targetLanguage": "${targetLanguage}",
  "culturalLinguisticContext": "2-sentence context.",
  "paragraphs": ["Paragraph 1", "Paragraph 2"],
  "sentences": [{"text": "...", "translation": "...", "literaryNote": "...", "audioTime": "0:00 - 0:08"}],
  "keyVocabulary": [{"word": "...", "ipa": "/.../", "pos": "noun", "translation": "...", "cefr": "${userLevel}", "example": "..."}],
  "stylisticDevices": [{"device": "...", "exampleFromText": "...", "explanation": "..."}],
  "conversations": [{"id": "socratic-1", "stepNumber": 1, "persona": "SpeakBot Socratic Mentor", "topic": "...", "prompt": "...", "options": ["A","B","C"], "correctIndex": 0, "botFeedback": "...", "points": 25}],
  "exercises": [{"id": "task-1", "taskNumber": 1, "category": "Comprehension", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "points": 25}]
}`;

        let parsedStory = null;
        const rawAiResponse = await callGeminiWithResilience(aiPrompt);

        if (!rawAiResponse) {
            console.log("[PDF Engine] Gemini failed, trying OpenRouter...");
            const openRouterResponse = await callOpenRouter(aiPrompt);
            if (openRouterResponse) parsedStory = openRouterResponse;
        } else {
            try {
                const clean = rawAiResponse.replace(/```json\n?|\n?```/g, "").trim();
                parsedStory = JSON.parse(clean);
            } catch (err) { console.warn("[PDF Engine] JSON parse fallback:", err); }
        }

        if (!parsedStory || !parsedStory.sentences || parsedStory.sentences.length === 0) {
            console.log(`[PDF Engine] Using dynamic fallback for "${resolvedTitle}"`);
            parsedStory = generateLocalFallbackStory({
                bookTitle: resolvedTitle, author: resolvedAuthor, authorEra: resolvedEra,
                canonKey: meta.canonKey, targetLanguage, mediatorLanguage, userLevel,
                excerptSlice, isSimulated: isTextScannedOrEmpty
            });
        }

        if (Array.isArray(parsedStory.conversations)) {
            parsedStory.conversations = parsedStory.conversations.map((c, idx) => ({
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
            parsedStory.exercises = parsedStory.exercises.map((e, idx) => ({
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

        const usedFallback = !parsedStory || !parsedStory.sentences || parsedStory.sentences.length === 0;

        const finalStory = {
            ...parsedStory,
            id: `story-custom-pdf-${Date.now()}`,
            isCustomPdf: true,
            sourceBook: fileName,
            isSimulated: isTextScannedOrEmpty,
            uploadedAt: new Date().toISOString(),
            coverImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80",
            targetLanguage: normalizeLanguageCanonical(targetLanguage),
            isFallback: usedFallback
        };

        if (!userCustomStories[userId]) userCustomStories[userId] = [];
        userCustomStories[userId].unshift(finalStory);
        saveStoriesToDisk();

        res.json({
            success: true,
            story: finalStory,
            message: usedFallback
                ? "PDF processed with fallback (scanned or unreadable text). Content is placeholder."
                : "PDF processed successfully. Interactive story card created!",
            warning: usedFallback
                ? "No extractable text. Please re-upload a text-based PDF or provide a .txt file."
                : null
        });
    } catch (error) {
        console.error("[PDF Engine Error]:", error);
        res.status(500).json({ success: false, error: error?.message || "Failed to process PDF." });
    }
});

// =====================================================
// ROUTE: SOCRATIC CHAT
// =====================================================
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
            mediatorLanguage = req.body.mediatorLanguage || (syncedUsersDatabase[userId]?.mediatorLanguage) || "en"
        } = req.body;

        if (!userMessage || !userMessage.trim()) {
            return res.status(400).json({ success: false, error: "userMessage is required" });
        }

        const aiPrompt = `You are SpeakBot Socratic Mentor, an intellectually stimulating literary tutor having a live Socratic conversation about "${bookTitle}" by ${author}.
Target Language: ${targetLanguage}
Mediator Language: ${mediatorLanguage}

The Excerpt:
"""
${excerpt.slice(0, 1200)}
"""

Recent Chat History:
${chatHistory.slice(-4).map((m) => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${m.text}`).join('\n')}

Learner's latest message:
"${userMessage}"

Respond in genuine Socratic dialogue style.

Return ONLY valid JSON:
{
  "reply": "...",
  "pointsAwarded": 20,
  "pedagogicalTip": "...",
  "suggestedReplies": ["...", "..."]
}`;

        let replyData = null;
        const raw = await callGeminiWithResilience(aiPrompt);
        if (raw) {
            try {
                const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
                replyData = JSON.parse(clean);
            } catch (err) { console.warn("[Socratic Chat] Parse:", err); }
        }

        if (!replyData || !replyData.reply) {
            console.warn(`[Socratic Chat] AI failed for "${bookTitle}", fallback active`);
            replyData = {
                reply: `That is a thoughtful observation about "${bookTitle}". Consider how ${author}'s choice of words shapes the narrator's perspective. What is the author conveying through the imagery?`,
                pointsAwarded: 15,
                pedagogicalTip: `This passage uses ${targetLanguage} syntax to create a specific mood.`,
                suggestedReplies: [
                    `The imagery creates a sense of isolation and introspection.`,
                    `The author uses vivid sensory details to immerse the reader.`
                ]
            };
        }

        if (!syncedUsersDatabase[userId]) {
            syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
            syncedUsersDatabase[userId].userId = userId;
        }
        const user = syncedUsersDatabase[userId];
        user.xp = (user.xp || 0) + (replyData.pointsAwarded || 20);

        res.json({ success: true, ...replyData, totalXp: user.xp });
    } catch (err) {
        console.error("[Socratic Chat Error]:", err);
        res.status(500).json({ success: false, error: err.message || "Socratic chat failed." });
    }
});

// =====================================================
// ROUTE: DOWNLOAD SERVER.JS
// =====================================================
app.get("/api/download/server.js", (req, res) => {
    const serverJsPath = path.join(process.cwd(), "server.js");
    if (fs.existsSync(serverJsPath)) {
        res.setHeader("Content-Disposition", 'attachment; filename="server.js"');
        res.setHeader("Content-Type", "application/javascript");
        res.sendFile(serverJsPath);
    } else {
        res.status(404).send("server.js not found on disk");
    }
});

// =====================================================
// ROUTE: STORIES
// =====================================================
app.get("/api/stories/custom-list", (req, res) => {
    const userId = String(req.query.userId || "default-user");
    const canonicalTarget = normalizeLanguageCanonical(req.query.targetLanguage || "English");
    const userStories = (userCustomStories[userId] || []).filter(s => normalizeLanguageCanonical(s.targetLanguage) === canonicalTarget);
    const autoStories = (autoFetchedStories || []).filter(s => normalizeLanguageCanonical(s.targetLanguage) === canonicalTarget);
    const combined = [...userStories, ...autoStories];
    res.json({ success: true, customStories: combined, dailyFeeds: getDailyBotStoryFeeds(canonicalTarget) });
});

app.delete("/api/stories/custom-story/:storyId", (req, res) => {
    const { storyId } = req.params;
    const userId = String(req.query.userId || "default-user");
    if (userCustomStories[userId]) {
        userCustomStories[userId] = userCustomStories[userId].filter((s) => s.id !== storyId);
        saveStoriesToDisk();
    }
    res.json({ success: true, message: `Story "${storyId}" removed.`, allCustomStories: userCustomStories[userId] || [] });
});

app.get("/api/stories/custom-story/:storyId/pdf", (req, res) => {
    const { storyId } = req.params;
    const userId = String(req.query.userId || "default-user");
    const userStories = userCustomStories[userId] || [];
    let story = userStories.find(s => s.id === storyId);
    if (!story) story = autoFetchedStories.find(s => s.id === storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });
    const buffer = generateClassicStoryPdfBuffer(story);
    sendPdf(res, buffer, `story-${storyId}.pdf`);
});

app.post("/api/stories/generate-daily-excerpt", async (req, res) => {
    try {
        const { targetLanguage = "English", level = "B1", topic = "Literature and philosophy" } = req.body;
        const prompt = `Write a rich, level-${level} story excerpt in ${targetLanguage} about "${topic}". Return ONLY valid JSON with keys: title, level, targetLanguage, paragraphs, sentences, keyVocabulary.`;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
            try {
                const parsed = JSON.parse(clean);
                return res.json({ success: true, story: parsed });
            } catch (err) { console.warn("JSON parse fallback:", err.message); }
        }
        const feeds = getDailyBotStoryFeeds(targetLanguage);
        const fallbackStory = feeds[0] || getDailyBotStoryFeeds("English")[0];
        res.json({ success: true, story: fallbackStory });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/stories/progress", (req, res) => {
    const { userId = "default-user", storyId, completed = true, earnedXp = 50 } = req.body;
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        syncedUsersDatabase[userId].userId = userId;
    }
    const user = syncedUsersDatabase[userId];
    if (!user.completedStories) user.completedStories = [];
    if (storyId && !user.completedStories.includes(storyId)) user.completedStories.push(storyId);
    user.xp = (user.xp || 0) + (earnedXp || 0);
    saveUsersToDisk();
    res.json({ success: true, xp: user.xp, completedStories: user.completedStories });
});

// =====================================================
// ROUTE: USER PROFILE
// =====================================================
app.get("/api/user/profile", (req, res) => {
    const userId = String(req.query.userId || "default-user");
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
    }
    res.json({ success: true, data: syncedUsersDatabase[userId] });
});

app.post("/api/user/mediator-language", (req, res) => {
    const { userId = "default-user", mediatorLanguage } = req.body;
    const actualMediator = mediatorLanguage || syncedUsersDatabase[userId]?.mediatorLanguage || "en";
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        syncedUsersDatabase[userId].userId = userId;
    }
    syncedUsersDatabase[userId].mediatorLanguage = actualMediator;
    saveUsersToDisk();
    res.json({ success: true, actualMediator });
});

app.post("/api/user/target-language", (req, res) => {
    const { userId = "default-user", targetLanguage = "English" } = req.body;
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        syncedUsersDatabase[userId].userId = userId;
    }
    syncedUsersDatabase[userId].targetLanguage = targetLanguage;
    saveUsersToDisk();
    res.json({ success: true, targetLanguage });
});

// =====================================================
// ROUTE: VOCABULARY
// =====================================================
app.get("/api/user/vocabulary", (req, res) => {
    const userId = String(req.query.userId || "default-user");
    let user = syncedUsersDatabase[userId];
    if (!user) {
        user = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        user.userId = userId;
    }
    ensureUserVocabStructure(user);
    const requestedTargetLang = String(req.query.targetLanguage || user.targetLanguage || "English");
    if (!user.vocabularyByLanguage[requestedTargetLang]) user.vocabularyByLanguage[requestedTargetLang] = [];
    const countsByLanguage = {};
    Object.keys(user.vocabularyByLanguage).forEach((lang) => {
        countsByLanguage[lang] = user.vocabularyByLanguage[lang].length;
    });

    if (req.query.format === 'pdf') {
        const buffer = generateVocabularyPdfBuffer(user.vocabularyByLanguage[requestedTargetLang], requestedTargetLang);
        sendPdf(res, buffer, `vocabulary-${requestedTargetLang}-${Date.now()}.pdf`);
        return;
    }

    res.json({
        success: true, targetLanguage: requestedTargetLang,
        data: user.vocabularyByLanguage[requestedTargetLang] || [],
        allVocabularies: user.vocabularyByLanguage, countsByLanguage
    });
});

app.post("/api/user/vocabulary", (req, res) => {
    const { userId = "default-user", targetLanguage = "English", word, translation, cefr = "B1", ipa = "", pos = "" } = req.body;
    if (!word) return res.status(400).json({ success: false, error: "Word is required." });
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        syncedUsersDatabase[userId].userId = userId;
    }
    const user = syncedUsersDatabase[userId];
    ensureUserVocabStructure(user);
    if (!user.vocabularyByLanguage[targetLanguage]) user.vocabularyByLanguage[targetLanguage] = [];

    const existingIndex = user.vocabularyByLanguage[targetLanguage].findIndex(
        (v) => v.word.toLowerCase() === word.toLowerCase()
    );

    const newEntry = {
        id: `custom-word-${Date.now()}`,
        word: word.trim(), translation: translation || "",
        cefr, ipa, pos, addedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        user.vocabularyByLanguage[targetLanguage][existingIndex] = {
            ...user.vocabularyByLanguage[targetLanguage][existingIndex], ...newEntry
        };
    } else {
        user.vocabularyByLanguage[targetLanguage].unshift(newEntry);
    }

    saveUsersToDisk();
    res.json({
        success: true, message: `Added "${word}" to ${targetLanguage} vocabulary.`,
        data: user.vocabularyByLanguage[targetLanguage]
    });
});

app.delete("/api/user/vocabulary", (req, res) => {
    const { userId = "default-user", targetLanguage = "English", wordId, word } = req.body;
    if (!syncedUsersDatabase[userId]) return res.status(404).json({ success: false, error: "User not found." });
    const user = syncedUsersDatabase[userId];
    ensureUserVocabStructure(user);
    if (!user.vocabularyByLanguage[targetLanguage]) return res.json({ success: true, data: [] });

    user.vocabularyByLanguage[targetLanguage] = user.vocabularyByLanguage[targetLanguage].filter(
        (item) => item.id !== wordId && item.word.toLowerCase() !== (word || "").toLowerCase()
    );
    saveUsersToDisk();
    res.json({ success: true, message: "Deleted.", data: user.vocabularyByLanguage[targetLanguage] });
});

// =====================================================
// ROUTE: TESTS
// =====================================================
app.post("/api/user/level-test", (req, res) => {
    const { userId = "default-user", targetLanguage = "English", score = 80 } = req.body;
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
    saveUsersToDisk();
    res.json({ success: true, assessedLevel, score, message: `CEFR ${assessedLevel} for ${targetLanguage}` });
});

app.post("/api/user/skill-test", (req, res) => {
    const { userId = "default-user", skillType = "lexicon", score = 10 } = req.body;
    if (!syncedUsersDatabase[userId]) {
        syncedUsersDatabase[userId] = JSON.parse(JSON.stringify(syncedUsersDatabase["default-user"]));
        syncedUsersDatabase[userId].userId = userId;
    }
    if (!syncedUsersDatabase[userId].skillScores) syncedUsersDatabase[userId].skillScores = {};
    syncedUsersDatabase[userId].skillScores[skillType] = (syncedUsersDatabase[userId].skillScores[skillType] || 0) + score;
    saveUsersToDisk();
    res.json({ success: true, skillScores: syncedUsersDatabase[userId].skillScores });
});

// =====================================================
// ROUTE: BOT SYNC
// =====================================================
app.get("/api/bot/sync", (req, res) => {
    const userId = String(req.query.userId || "default-user");
    const user = syncedUsersDatabase[userId] || syncedUsersDatabase["default-user"];
    res.json({ success: true, synced: true, userState: user, userProfile: user, serverTimestamp: Date.now() });
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
    saveUsersToDisk();
    res.json({ success: true, message: "Sync updated.", userState: user, userProfile: user });
});

// =====================================================
// ROUTE: PREMIUM / USAGE / XP
// =====================================================
app.get("/api/user/premium", (req, res) => {
    const userId = String(req.query.userId || "default-user");
    const user = syncedUsersDatabase[userId] || syncedUsersDatabase["default-user"];
    res.json({
        success: true,
        isPremium: user.isPremium || false,
        usageCount: user.usageCount || 0,
        limit: user.isPremium ? Infinity : 150,
        priceCents: process.env.PREMIUM_PRICE_CENTS || 350,
        currency: process.env.PREMIUM_PRICE_CURRENCY || "usd"
    });
});

app.post("/api/user/usage", (req, res) => {
    const { userId } = req.body;
    if (!syncedUsersDatabase[userId]) syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
    const user = syncedUsersDatabase[userId];
    user.usageCount = (user.usageCount || 0) + 1;
    saveUsersToDisk();
    res.json({ success: true, usageCount: user.usageCount });
});

app.post("/api/user/premium", (req, res) => {
    const { userId, isPremium = true } = req.body;
    if (!syncedUsersDatabase[userId]) syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
    syncedUsersDatabase[userId].isPremium = isPremium;
    syncedUsersDatabase[userId].premiumExpiresAt = isPremium
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    saveUsersToDisk();
    res.json({ success: true, isPremium });
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
    saveUsersToDisk();
    res.json({ success: true, totalXp: user.xp, message: `+${xpEarned} XP for ${gameMode}!` });
});

// =====================================================
// ROUTES: AI GENERATORS
// =====================================================
app.post("/api/gemini/generate-grammar-roadmap", async (req, res) => {
    try {
        const {
            userId = "default-user",
            testScore = 70,
            testedWeaknesses = ["Conditionals", "Inversion"],
            userLevel = "B1",
            targetLanguage = "English",
            mediatorLanguage = "en"
        } = req.body;

        const prompt = `You are a world-class language curriculum designer. Create a personalized grammar roadmap for ${targetLanguage} at CEFR ${userLevel}.
Test score: ${testScore}%. Tested concepts: ${testedWeaknesses.join(", ")}.
Mediator: ${mediatorLanguage}.

Return ONLY valid JSON:
{
  "title": "...",
  "category": "Grammar",
  "level": "${userLevel}",
  "estimatedDuration": "3 Weeks",
  "summary": "...",
  "milestones": [{"step": 1, "title": "...", "description": "...", "grammarPoint": "...", "sampleSentence": "...", "tokens": [{"text": "...", "lemma": "...", "pos": "NOUN", "syntaxRole": "Subject", "cefrLevel": "B1", "ipa": "/.../", "mediatorTranslation": "..."}]}],
  "checkpointQuestions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..."}]
}`;

        let roadmap = null;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            try {
                const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
                roadmap = JSON.parse(clean);
            } catch (err) { console.warn("Roadmap JSON parse:", err.message); }
        }

        if (!roadmap || !Array.isArray(roadmap.milestones) || roadmap.milestones.length === 0) {
            console.warn("[Grammar Roadmap] Using fallback roadmap.");
            roadmap = getFallbackRoadmap(targetLanguage, userLevel);
        }

        if (req.query.format === 'pdf' || req.body.format === 'pdf') {
            const buffer = generateRoadmapPdfBuffer(roadmap);
            const filename = `roadmap-${Date.now()}.pdf`;
            const result = await savePdfToSupabase(buffer, filename, userId || 'default-user', 'roadmap');
            if (result.url) return res.json({ success: true, pdfUrl: result.url, filename });
            sendPdf(res, buffer, filename);
            return;
        }
        saveUsersToDisk();
        res.json({ success: true, roadmap });
    } catch (error) {
        console.error("Grammar roadmap error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/gemini/generate-roadmap", async (req, res) => {
    try {
        const { topic, level = "B1", targetLanguage = "English", mediatorLanguage = "en", customGoal = "" } = req.body;

        const prompt = `Create a detailed roadmap for "${topic}" at CEFR ${level} in ${targetLanguage}.
Mediator: ${mediatorLanguage}. Goal: ${customGoal || "General proficiency"}.
Return JSON with title, summary, milestones, checkpointQuestions.`;

        const aiResponse = await callGeminiWithResilience(prompt);
        let roadmap = null;
        if (aiResponse) {
            try {
                const clean = aiResponse.replace(/```json\s*|\s*```/g, "").trim();
                roadmap = JSON.parse(clean);
            } catch (e) { console.error("Roadmap JSON parse:", e); }
        }

        if (!roadmap || !Array.isArray(roadmap.milestones) || roadmap.milestones.length === 0) {
            console.warn("[Roadmap] Using fallback roadmap.");
            roadmap = getFallbackRoadmap(targetLanguage, level, topic, mediatorLanguage);
        }
        res.json({ success: true, roadmap });
    } catch (error) {
        console.error("Roadmap error:", error);
        const roadmap = getFallbackRoadmap(
            req.body.targetLanguage || "English",
            req.body.level || "B1",
            req.body.topic || "General",
            req.body.mediatorLanguage || "en"
        );
        res.json({ success: true, roadmap });
    }
});

app.post('/api/gemini/generate-grammar-guide', async (req, res) => {
    try {
        const {
            userId = "default-user",
            targetLanguage = "English",
            ruleTitle = "Verb Tenses",
            level = "B1",
            mediatorLanguage = "en"
        } = req.body;

        const prompt = `You are a master grammar expert. Generate a comprehensive grammar study guide for ${targetLanguage} at CEFR ${level} about "${ruleTitle}".
Mediator: ${mediatorLanguage}.

Return ONLY valid JSON:
{
  "title": "...",
  "category": "Grammar",
  "level": "${level}",
  "summary": "...",
  "coreRules": [{"ruleTitle": "...", "explanationInMediator": "...", "formula": "...", "example": "...", "tokens": [{"text": "...", "lemma": "...", "pos": "VERB", "syntaxRole": "Predicate", "cefrLevel": "B1", "ipa": "/.../", "mediatorTranslation": "..."}]}],
  "commonMistakes": [{"incorrect": "...", "correct": "...", "reason": "..."}],
  "practiceExercises": [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}]
}`;

        let guide = null;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            try {
                const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
                guide = JSON.parse(clean);
            } catch (e) { console.warn("Grammar guide JSON:", e.message); }
        }

        if (!guide || !Array.isArray(guide.coreRules) || guide.coreRules.length === 0) {
            console.warn("[Grammar Guide] Using fallback guide.");
            guide = getFallbackGrammarGuide(targetLanguage, ruleTitle, level, mediatorLanguage);
        }

        if (req.query.format === 'pdf' || req.body.format === 'pdf') {
            const buffer = generateGrammarGuidePdfBuffer(guide);
            const filename = `grammar-guide-${Date.now()}.pdf`;
            const result = await savePdfToSupabase(buffer, filename, userId || 'default-user', 'grammar');
            if (result.url) return res.json({ success: true, pdfUrl: result.url, filename });
            sendPdf(res, buffer, filename);
            return;
        }
        saveUsersToDisk();
        res.json({ success: true, guide });
    } catch (error) {
        console.error("Grammar guide error:", error);
        const guide = getFallbackGrammarGuide(
            req.body.targetLanguage || "English",
            req.body.ruleTitle || "Verb Tenses",
            req.body.level || "B1",
            req.body.mediatorLanguage || "en"
        );
        res.json({ success: true, guide });
    }
});

app.post("/api/gemini/tokenize", async (req, res) => {
    try {
        const { sentence = "", targetLanguage = "English" } = req.body;
        if (!sentence) return res.status(400).json({ success: false, error: "Sentence is required." });
        const tokens = defaultTokenizeSentence(sentence, targetLanguage);
        saveUsersToDisk();
        res.json({ success: true, tokens });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// FALLBACK ROADMAP
// =====================================================
function getFallbackRoadmap(lang = "English", level = "B1", topic = "General", mediatorLang = "en") {
    const langDisplay = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
    const topicDisplay = topic.charAt(0).toUpperCase() + topic.slice(1).toLowerCase();

    return {
        title: `Learning Roadmap: ${topicDisplay} (${level} in ${langDisplay})`,
        category: "Grammar", level: level || "B1",
        estimatedDuration: "2 Weeks",
        summary: `Structured plan to achieve ${level} proficiency in ${langDisplay} for "${topicDisplay}".`,
        milestones: [
            {
                step: 1,
                title: `Core Vocabulary & Sentence Structure for ${topicDisplay}`,
                description: `Build foundation for ${topicDisplay}.`,
                grammarPoint: "Subject-Verb-Object (SVO)",
                sampleSentence: `I study ${topicDisplay} every day.`,
                tokens: [
                    { text: "I", lemma: "I", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/aɪ/", mediatorTranslation: mediatorLang === "az" ? "mən" : mediatorLang === "ru" ? "я" : mediatorLang === "tr" ? "ben" : "I" },
                    { text: "study", lemma: "study", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "A1", ipa: "/ˈstʌdi/", mediatorTranslation: mediatorLang === "az" ? "öyrənirəm" : mediatorLang === "ru" ? "изучаю" : mediatorLang === "tr" ? "çalışıyorum" : "study" },
                    { text: topicDisplay, lemma: topicDisplay.toLowerCase(), pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "A1", ipa: `/${topicDisplay.toLowerCase()}/`, mediatorTranslation: topicDisplay }
                ]
            },
            {
                step: 2,
                title: `Tenses for ${topicDisplay}`,
                description: `Understand when to use each tense.`,
                grammarPoint: "Simple tenses (Present, Past, Future)",
                sampleSentence: `She will explore ${topicDisplay} tomorrow.`,
                tokens: [
                    { text: "She", lemma: "she", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/ʃiː/", mediatorTranslation: mediatorLang === "az" ? "o" : mediatorLang === "ru" ? "она" : mediatorLang === "tr" ? "o" : "she" },
                    { text: "will", lemma: "will", pos: "AUX", syntaxRole: "Auxiliary", cefrLevel: "A1", ipa: "/wɪl/", mediatorTranslation: mediatorLang === "az" ? "—acaq" : mediatorLang === "ru" ? "будет" : mediatorLang === "tr" ? "—ecek" : "will" },
                    { text: "explore", lemma: "explore", pos: "VERB", syntaxRole: "Main Verb", cefrLevel: "A1", ipa: "/ɪkˈsplɔːr/", mediatorTranslation: mediatorLang === "az" ? "kəşf edəcək" : mediatorLang === "ru" ? "исследует" : mediatorLang === "tr" ? "keşfedecek" : "explore" },
                    { text: topicDisplay, lemma: topicDisplay.toLowerCase(), pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "A1", ipa: `/${topicDisplay.toLowerCase()}/`, mediatorTranslation: topicDisplay },
                    { text: "tomorrow", lemma: "tomorrow", pos: "NOUN", syntaxRole: "Adverbial", cefrLevel: "A1", ipa: "/təˈmɒroʊ/", mediatorTranslation: mediatorLang === "az" ? "sabah" : mediatorLang === "ru" ? "завтра" : mediatorLang === "tr" ? "yarın" : "tomorrow" }
                ]
            }
        ],
        checkpointQuestions: [
            { question: `Correct word order in English?`, options: ["SVO", "SOV", "VSO", "VOS"], correctIndex: 0, explanation: `English follows Subject-Verb-Object.` },
            { question: `Future form?`, options: ["will + base verb", "past participle", "present continuous", "infinitive"], correctIndex: 0, explanation: "Future simple uses 'will' + base verb." }
        ]
    };
}

// =====================================================
// FALLBACK GRAMMAR GUIDE
// =====================================================
function getFallbackGrammarGuide(lang = "English", rule = "Verb Tenses", level = "B1", mediatorLang = "az") {
    const langDisplay = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
    const ruleDisplay = rule.charAt(0).toUpperCase() + rule.slice(1).toLowerCase();

    const langSpecificContent = {
        English: { explanationPrefix: "Used for facts, habits, and regular actions.", commonMistakeExample: "I have seen him yesterday.", commonMistakeCorrect: "I saw him yesterday.", commonMistakeReason: "Specific past time requires Past Simple." },
        German: { explanationPrefix: "Wird für Fakten und Gewohnheiten verwendet.", commonMistakeExample: "Ich habe ihn gestern gesehen.", commonMistakeCorrect: "Ich sah ihn gestern.", commonMistakeReason: "Vergangenheitszeit erfordert Präteritum." },
        Spanish: { explanationPrefix: "Se utiliza para hechos y hábitos.", commonMistakeExample: "He visto ayer a Juan.", commonMistakeCorrect: "Vi ayer a Juan.", commonMistakeReason: "El pasado específico requiere Pretérito Indefinido." }
    };

    const content = langSpecificContent[langDisplay] || langSpecificContent.English;

    return {
        title: `Comprehensive Guide: ${ruleDisplay} in ${langDisplay}`,
        category: "Grammar", level: level || "B1",
        summary: `Reference covering ${ruleDisplay} with formulas, errors, and drills for ${langDisplay}.`,
        coreRules: [
            {
                ruleTitle: "Present Simple",
                explanationInMediator: content.explanationPrefix,
                formula: "Subject + V1 (s/es for 3rd person)",
                example: "She reads books every evening.",
                tokens: [
                    { text: "She", lemma: "she", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/ʃiː/", mediatorTranslation: mediatorLang === "az" ? "o" : mediatorLang === "ru" ? "она" : mediatorLang === "tr" ? "o" : "she" },
                    { text: "reads", lemma: "read", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "A1", ipa: "/riːdz/", mediatorTranslation: mediatorLang === "az" ? "oxuyur" : mediatorLang === "ru" ? "читает" : mediatorLang === "tr" ? "okur" : "reads" },
                    { text: "books", lemma: "book", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "A1", ipa: "/bʊks/", mediatorTranslation: mediatorLang === "az" ? "kitablar" : mediatorLang === "ru" ? "книги" : mediatorLang === "tr" ? "kitaplar" : "books" }
                ]
            }
        ],
        commonMistakes: [{ incorrect: content.commonMistakeExample, correct: content.commonMistakeCorrect, reason: content.commonMistakeReason }],
        practiceExercises: [{ question: `Past form: 'She _____ to the store.'`, options: ["go", "went", "gone", "going"], correctIndex: 1, explanation: `Past of 'go' is 'went'.` }]
    };
}

function getFallbackPersonalizedGrammarRoadmap(targetLang, userLevel) {
    return getFallbackRoadmap(targetLang, userLevel);
}

function getLanguageGrammarRulesServer(targetLang) {
    return [
        { title: "Definite and Indefinite Articles", cefr: "A1", desc: "Foundational nominal determination." },
        { title: "Past Tense and Aspectual Verb Inflection", cefr: "B1", desc: "Narrating sequential events." },
        { title: "Subjunctive and Hypothetical Moods", cefr: "B2", desc: "Expressing desires, doubts, conditions." },
        { title: "Inversion and Stylistic Emphatic Fronting", cefr: "C1", desc: "Literary discourse composition." }
    ];
}

// =====================================================
// SERVER LEXICON + TOKENIZER
// =====================================================
const SERVER_LEXICON = {
    English: {
        solitary: { ipa: "/ˈsɒl.ɪ.tər.i/", pos: "adj", cefr: "B2", translation: "tənha, tək-tənha", note: "Living alone; secluded." },
        wander: { ipa: "/ˈwɒn.dər/", pos: "verb", cefr: "B1", translation: "gəzişmək, avaralanmaq", note: "Move about without destination." },
        poignant: { ipa: "/ˈpɔɪ.njənt/", pos: "adj", cefr: "C1", translation: "təsirli, ürəkdağlayan", note: "Evoking sadness or regret." },
        resilience: { ipa: "/rɪˈzɪl.jəns/", pos: "noun", cefr: "B2", translation: "dözümlülük, elastiklik", note: "Capacity to recover quickly." },
        eloquence: { ipa: "/ˈel.ə.kwəns/", pos: "noun", cefr: "C1", translation: "natiqlik, bəlağət", note: "Fluent or persuasive speaking." },
        ephemeral: { ipa: "/ɪˈfem.ər.əl/", pos: "adj", cefr: "C2", translation: "müvəqqəti, keçici", note: "Lasting very short time." },
        melancholy: { ipa: "/ˈmel.əŋ.kɒl.i/", pos: "noun", cefr: "B2", translation: "hüzün, qəm", note: "Pensive sadness." },
        profound: { ipa: "/prəˈfaʊnd/", pos: "adj", cefr: "B2", translation: "dərin, mühüm", note: "Very great or intense." }
    },
    German: {
        sehnsucht: { ipa: "/ˈzeːnˌzʊxt/", pos: "noun", cefr: "C1", translation: "həsrət, intizar", note: "Yearning or wistful longing." },
        wanderlust: { ipa: "/ˈvandɐˌlʊst/", pos: "noun", cefr: "B2", translation: "", note: "Strong desire to travel." },
        weltschmerz: { ipa: "/ˈvɛltˌʃmɛrts/", pos: "noun", cefr: "C2", translation: "", note: "World-weariness." },
        zeitgeist: { ipa: "/ˈtsaɪtˌɡaɪst/", pos: "noun", cefr: "C1", translation: "", note: "The spirit of the time." }
    },
    Spanish: {
        soledad: { ipa: "/soleˈðað/", pos: "noun", cefr: "B1", translation: "", note: "State of being alone." },
        esperanza: { ipa: "/espeˈɾanθa/", pos: "noun", cefr: "A2", translation: "", note: "Hope or expectation." },
        mariposa: { ipa: "/maɾiˈposa/", pos: "noun", cefr: "A1", translation: "", note: "Butterfly." }
    },
    French: {
        flâneur: { ipa: "/flɑ.nœʁ/", pos: "noun", cefr: "C1", translation: "", note: "One who saunters." },
        nostalgie: { ipa: "/nɔs.tal.ʒi/", pos: "noun", cefr: "B1", translation: "", note: "Sentimental longing." }
    }
};

function defaultTokenizeSentence(sentence, targetLanguage = "English") {
    const words = sentence.split(/\s+/).filter(Boolean);
    const dict = SERVER_LEXICON[targetLanguage] || SERVER_LEXICON["English"] || {};
    return words.map((rawWord) => {
        const cleanWord = rawWord.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "").toLowerCase();
        const entry = dict[cleanWord];
        return {
            surface: rawWord, clean: cleanWord,
            ipa: entry ? entry.ipa : "",
            pos: entry ? entry.pos : "word",
            cefr: entry ? entry.cefr : "B1",
            translation: entry ? entry.translation : "",
            literaryNote: entry ? entry.note : ""
        };
    });
}

// =====================================================
// CUBEWORD GAME
// =====================================================
const CUBEWORD_TARGET_QUESTS = {
    English: [
        { word: "SOLITARY", clue: "Existing alone; secluded", cefr: "B2", translation: "" },
        { word: "WANDER", clue: "To roam without destination", cefr: "B1", translation: "" },
        { word: "RESILIENCE", clue: "Capacity to recover quickly", cefr: "B2", translation: "" },
        { word: "ELOQUENCE", clue: "Fluent persuasive speech", cefr: "C1", translation: "" }
    ],
    German: [
        { word: "SEHNSUCHT", clue: "Deep yearning or longing", cefr: "C1", translation: "" },
        { word: "ZEITGEIST", clue: "Spirit of the era", cefr: "C1", translation: "" }
    ],
    Spanish: [
        { word: "SOLEDAD", clue: "Solitude or loneliness", cefr: "B1", translation: "" },
        { word: "ESPERANZA", clue: "Hope", cefr: "A2", translation: "" }
    ],
    French: [
        { word: "FLANEUR", clue: "Passionate urban stroller", cefr: "C1", translation: "" },
        { word: "NOSTALGIE", clue: "Poignant longing for the past", cefr: "B1", translation: "" }
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
            if (!faces.includes(randChar)) faces.push(randChar);
        }
        for (let i = faces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [faces[i], faces[j]] = [faces[j], faces[i]];
        }
        return { index, targetChar: correctChar, faces };
    });
    res.json({ success: true, word: targetWord, cubes });
});

app.post("/api/cubeword/verify", (req, res) => {
    const { submittedWord = "", targetWord = "" } = req.body;
    const isCorrect = submittedWord.trim().toUpperCase() === targetWord.trim().toUpperCase();
    saveUsersToDisk();
    res.json({
        success: true, isCorrect,
        earnedXp: isCorrect ? 40 : 5,
        message: isCorrect ? "Word assembled perfectly!" : "Not quite right yet."
    });
});

app.get("/api/cubeword/generate-special-word", async (req, res) => {
    try {
        const mediatorLanguage = req.query.mediatorLanguage || "en";
        const targetLang = req.query.targetLanguage || "English";
        const level = req.query.level || "B2";
        const prompt = `Provide one elegant vocabulary word in ${targetLang} at CEFR ${level}. Return JSON: { "word": "WORD", "clue": "Definition", "translation": "Translation in ${mediatorLanguage}", "cefr": "${level}" }`;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
            const parsed = JSON.parse(clean);
            return res.json({ success: true, item: parsed });
        }
        res.json({ success: true, item: { word: "EPIPHANY", clue: "Sudden striking realization", translation: "", cefr: "C1" } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================
// MEMORY MATCH GAME
// =====================================================
let memoryGames = {};

const FALLBACK_WORDS_MAP = {
    English: ["apple", "banana", "cherry", "date", "elder", "fig", "grape", "honey"],
    Spanish: ["manzana", "plátano", "cereza", "dátil", "saúco", "higo", "uva", "miel"],
    German: ["Apfel", "Banane", "Kirsche", "Dattel", "Holunder", "Feige", "Traube", "Honig"],
    French: ["pomme", "banane", "cerise", "datte", "sureau", "figue", "raisin", "miel"],
    Italian: ["mela", "banana", "ciliegia", "dattero", "sambuco", "fico", "uva", "miele"],
    Russian: ["яблоко", "банан", "вишня", "финик", "бузина", "инжир", "виноград", "мёд"],
    Turkish: ["elma", "muz", "kiraz", "hurma", "mürver", "incir", "üzüm", "bal"]
};

app.post("/api/games/memory/start", (req, res) => {
    const { userId = "default-user", targetLanguage = "English", customWords } = req.body;
    const langKey = normalizeLanguageCanonical(targetLanguage);
    const pool = (Array.isArray(customWords) && customWords.length >= 4)
        ? customWords
        : (FALLBACK_WORDS_MAP[langKey] || FALLBACK_WORDS_MAP["English"]);

    const selectedWords = [...pool].sort(() => 0.5 - Math.random()).slice(0, 6);
    const deck = [];
    selectedWords.forEach((word, pairIdx) => {
        deck.push({ id: pairIdx * 2, word, pairId: pairIdx, matched: false });
        deck.push({ id: pairIdx * 2 + 1, word, pairId: pairIdx, matched: false });
    });
    deck.sort(() => 0.5 - Math.random());
    const cards = deck.map((c, idx) => ({ id: idx, word: c.word, pairId: c.pairId, matched: false }));

    memoryGames[userId] = { cards, matchedCount: 0, targetLanguage };
    res.json({
        success: true,
        cards: cards.map(c => ({ id: c.id, matched: false })),
        totalPairs: selectedWords.length
    });
});

app.post("/api/games/memory/flip", (req, res) => {
    const { userId = "default-user", cardId } = req.body;
    let game = memoryGames[userId];
    if (!game) {
        const pool = FALLBACK_WORDS_MAP["English"];
        const deck = [];
        pool.slice(0, 6).forEach((word, pairIdx) => {
            deck.push({ id: pairIdx * 2, word, pairId: pairIdx, matched: false });
            deck.push({ id: pairIdx * 2 + 1, word, pairId: pairIdx, matched: false });
        });
        deck.sort(() => 0.5 - Math.random());
        const cards = deck.map((c, idx) => ({ id: idx, word: c.word, pairId: c.pairId, matched: false }));
        game = { cards, matchedCount: 0, targetLanguage: "English" };
        memoryGames[userId] = game;
    }
    const card = game.cards.find(p => p.id === cardId);
    if (!card) return res.status(400).json({ error: "Card not found" });
    res.json({ success: true, cardId: card.id, word: card.word, matched: card.matched });
});

app.post("/api/games/memory/match", (req, res) => {
    const { userId = "default-user", card1, card2 } = req.body;
    let game = memoryGames[userId];
    if (!game) return res.json({ success: false, matched: false });
    const c1 = game.cards.find(p => p.id === card1);
    const c2 = game.cards.find(p => p.id === card2);
    if (!c1 || !c2 || c1.id === c2.id) return res.json({ success: false, matched: false });

    if (c1.word.toLowerCase() === c2.word.toLowerCase()) {
        c1.matched = true;
        c2.matched = true;
        game.matchedCount = (game.matchedCount || 0) + 1;
        const totalPairs = game.cards.length / 2;
        const isGameOver = game.matchedCount >= totalPairs;
        res.json({ success: true, matched: true, matchedCount: game.matchedCount, totalPairs, gameOver: isGameOver, xpEarned: 25 });
    } else {
        res.json({ success: true, matched: false });
    }
});

// =====================================================
// WORD BUILDER GAME
// =====================================================
let wordBuilderGames = {};

async function verifyWordInDictionary(word, language = "English") {
    const cleanWord = String(word || "").trim().toUpperCase();
    if (cleanWord.length < 3) return false;
    const lang = String(language || "English").toLowerCase();

    if (lang.includes("en") || lang.includes("ingl")) return englishWordSet.has(cleanWord);
    if (lang.includes("es") || lang.includes("span")) {
        if (spanishWordSet.has(cleanWord)) return true;
        const noAccents = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return spanishWordSet.has(noAccents);
    }
    if (lang.includes("fr")) {
        if (frenchWordSet.has(cleanWord)) return true;
        const noAccents = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return frenchWordSet.has(noAccents);
    }
    if (lang.includes("de") || lang.includes("germ") || lang.includes("alm")) return germanWordSet.has(cleanWord);
    if (multilingualVocabSet.has(cleanWord)) return true;

    try {
        const prompt = `Is "${cleanWord}" a legitimate dictionary word in ${language}? Answer strictly in JSON: {"valid": true} or {"valid": false}`;
        const raw = await callGeminiWithResilience(prompt, "gemini-2.5-flash", ["gemini-2.0-flash"], true);
        if (raw) {
            const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
            const parsed = JSON.parse(clean);
            if (typeof parsed.valid === "boolean") return parsed.valid;
        }
    } catch (err) { console.warn("Dictionary check fallback:", err?.message); }
    return false;
}

function getStaticVocabulary(targetLanguage = "English", userLevel = "B1", count = 12) {
    const normLang = String(targetLanguage || "English").toLowerCase();
    let matches = (GAMES_VOCABULARY || []).filter((v) => (v.language || "English").toLowerCase() === normLang);
    if (matches.length === 0) matches = (GAMES_VOCABULARY || []).filter((v) => (v.language || "English").toLowerCase() === "english");
    if (userLevel && userLevel !== "ALL") {
        const byLvl = matches.filter((v) => v.level === userLevel);
        if (byLvl.length > 0) matches = byLvl;
    }
    return matches.slice(0, count).map((v, idx) => ({
        id: v.id || `static-${idx}`,
        word: v.word,
        translation: v.translations?.en || v.translations?.az || v.definition || "",
        translations: v.translations || {},
        ipa: v.ipa || "", pos: v.pos || "noun",
        level: v.level || userLevel || "B1",
        sentence: v.sentence || "",
        morphology: v.morphology || "", definition: v.definition || ""
    }));
}

app.post("/api/games/wordbuilder/start", (req, res) => {
    const { userId = "default-user", targetWord, targetLanguage = "English" } = req.body;
    const word = (targetWord || "VOCABULARY").toUpperCase();
    wordBuilderGames[userId] = { targetWord: word, targetLanguage, foundWords: [] };
    res.json({ success: true, targetWord: word });
});

app.post("/api/games/wordbuilder/verify", async (req, res) => {
    const { userId = "default-user", word, targetLanguage } = req.body;
    let game = wordBuilderGames[userId];
    if (!game) {
        game = { targetWord: "VOCABULARY", targetLanguage: targetLanguage || "English", foundWords: [] };
        wordBuilderGames[userId] = game;
    }
    const effectiveLang = String(targetLanguage || game.targetLanguage || "English");
    const upperWord = String(word || "").trim().toUpperCase();

    if (upperWord.length < 3) return res.json({ success: false, valid: false, message: "Word must be at least 3 letters long." });

    const targetChars = [...game.targetWord];
    for (const ch of upperWord) {
        const idx = targetChars.indexOf(ch);
        if (idx === -1) return res.json({ success: false, valid: false, message: `Letter "${ch}" not available.` });
        targetChars.splice(idx, 1);
    }

    if (game.foundWords.includes(upperWord)) return res.json({ success: false, valid: false, message: `"${upperWord}" already discovered.` });

    const isRealWord = await verifyWordInDictionary(upperWord, effectiveLang);
    if (!isRealWord) return res.json({ success: false, valid: false, message: `"${upperWord}" not recognized in ${effectiveLang} dictionary.` });

    game.foundWords.push(upperWord);
    res.json({ success: true, valid: true, foundWord: upperWord, foundWords: game.foundWords, score: game.foundWords.length * 10 });
});

// =====================================================
// AI VOCABULARY GENERATION
// =====================================================
app.post("/api/games/generate-words", async (req, res) => {
    const { targetLanguage = "English", userLevel = "B1", count = 6, wordType = "noun" } = req.body || {};
    try {
        const prompt = `Generate exactly ${count} common ${wordType} words in ${targetLanguage} for CEFR ${userLevel}. Return ONLY a JSON array of strings.`;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
            const words = JSON.parse(clean);
            if (Array.isArray(words) && words.length > 0) return res.json({ success: true, words: words.slice(0, count) });
        }
    } catch (err) { console.warn("AI word generation failed:", err.message); }
    const normalizedLang = Object.keys(FALLBACK_WORDS_MAP).find((lang) => lang.toLowerCase() === targetLanguage.toLowerCase()) || "English";
    const words = FALLBACK_WORDS_MAP[normalizedLang].slice(0, count);
    res.json({ success: true, words });
});

app.post("/api/games/generate-vocabulary", async (req, res) => {
    const { targetLanguage = "English", userLevel = "B1", count = 8 } = req.body || {};
    try {
        const prompt = `Generate ${count} vocabulary items for CEFR ${userLevel} in ${targetLanguage}. Provide word, translation, ipa, pos, level, example. Return ONLY JSON array.`;
        const raw = await callGeminiWithResilience(prompt);
        if (raw) {
            const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
            const items = JSON.parse(clean);
            if (Array.isArray(items) && items.length > 0) {
                const vocabulary = items.slice(0, count).map(item => ({
                    word: item.word || "", translation: item.translation || item.meaning || "",
                    ipa: item.ipa || "", pos: item.pos || "noun",
                    level: item.level || userLevel, example: item.example || ""
                })).filter(item => item.word);
                if (vocabulary.length > 0) return res.json({ success: true, vocabulary });
            }
        }
    } catch (err) { console.warn("AI vocabulary generation failed:", err.message); }
    const fallback = getStaticVocabulary(targetLanguage, userLevel, count);
    res.json({ success: true, vocabulary: fallback });
});

// =====================================================
// PDF ROUTES
// =====================================================
app.get('/api/pdfs/:fileId', (req, res) => {
    const { fileId } = req.params;
    const pdfData = pdfStorage[fileId];
    if (!pdfData) return res.status(404).json({ error: 'PDF not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfData.filename}"`);
    res.send(Buffer.from(pdfData.buffer));
});

app.get('/api/user/pdfs', async (req, res) => {
    const userId = String(req.query.userId || 'default-user');
    if (!supabase) {
        const userPdfs = Object.values(pdfStorage).filter(p => p.userId === userId);
        return res.json({ success: true, pdfs: userPdfs });
    }
    try {
        const { data, error } = await supabase.from('pdf_metadata').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, pdfs: data || [] });
    } catch (error) {
        console.error('Failed to fetch PDFs:', error);
        res.json({ success: false, error: error.message });
    }
});

// =====================================================
// START SERVER
// =====================================================
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
        console.log(`[SpeakBot] Supabase: ${supabase ? '✅ Connected' : '❌ Not configured'}`);
        console.log(`[SpeakBot] Redis: ${redis ? '✅ Connected' : '❌ Not configured'}`);
    });
}

startServer();

// =====================================================
// AUTO-FETCH FROM GUTENBERG (every 6 hours)
// =====================================================
setInterval(async () => {
    const rawStory = await fetchRandomGutenbergBook();
    if (!rawStory) return;

    const mediatorLanguage = syncedUsersDatabase["default-user"]?.mediatorLanguage || "en";
    const targetLanguage = rawStory.targetLanguage || "en";
    const computeLevel = () => {
        const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
        return levels[Math.floor(Math.random() * levels.length)];
    };
    const userLevel = computeLevel();

    const aiPrompt = `Synthesize a Classic Story module based on this Gutenberg excerpt.
Book: "${rawStory.title}" by "${rawStory.author || "Unknown"}"
Language: ${targetLanguage}
Level: ${userLevel}
Mediator: ${mediatorLanguage}

Excerpt:
"""
${rawStory.excerpt}
"""

Return ONLY valid JSON with title, author, sentences (with translations, literary notes), keyVocabulary, conversations, exercises.`;

    const parsedStory = await callGeminiWithResilience(aiPrompt);
    if (parsedStory) {
        try {
            const clean = parsedStory.replace(/```json\n?|\n?```/g, "").trim();
            rawStory.storyData = JSON.parse(clean);
        } catch (e) {
            rawStory.storyData = { excerpt: rawStory.excerpt };
        }
        autoFetchedStories.unshift(rawStory);
        saveStoriesToDisk();
        console.log(`[AutoFetch] Added: ${rawStory.title}`);
    }
}, 6 * 60 * 60 * 1000);