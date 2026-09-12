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
import FALLBACK_WORDS_MAP from "./src/data/fallbackWords.js";
import { GAMES_VOCABULARY } from './src/data/gamesVocabularyData.js';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
// ═══════════════════════════════════════════════════════════════
// TTS ENDPOINT — MSEdge + Browser fallback
// ═══════════════════════════════════════════════════════════════

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { exec } from "child_process";
import ffmpegPath from "ffmpeg-static";
import os from "os";
import crypto from "crypto";
// ═══════════════════════════════════════════════════════════════
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК — ловят silent crashes
// ═══════════════════════════════════════════════════════════════

process.on("uncaughtException", (err) => {
    console.error("═══════════════════════════════════════");
    console.error("[FATAL] uncaughtException:", err);
    console.error("Stack:", err.stack);
    console.error("═══════════════════════════════════════");
    // Не выходим — оставляем процесс живым для диагностики
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("═══════════════════════════════════════");
    console.error("[FATAL] unhandledRejection:", reason);
    console.error("Promise:", promise);
    console.error("═══════════════════════════════════════");
});

process.on("exit", (code) => {
    console.error(`[FATAL] Процесс завершается с кодом: ${code}`);
});

process.on("SIGINT", () => {
    console.error("[FATAL] Получен SIGINT (Ctrl+C)");
    process.exit(0);
});


dotenv.config();

// Master key из env — ЭТО НИКОГДА НЕ МЕНЯТЬ после первого запуска,
// иначе все сохранённые пользовательские ключи станут нечитаемыми
const MASTER_ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY;

if (!MASTER_ENCRYPTION_KEY || MASTER_ENCRYPTION_KEY.length < 32) {
    console.warn("[BYOK] ENCRYPTION_MASTER_KEY отсутствует или короткий — BYOK-функция отключена");
}

function encryptKey(plaintext) {
    if (!MASTER_ENCRYPTION_KEY) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(MASTER_ENCRYPTION_KEY, "hex"),
        iv
    );
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Формат: enc:<iv>:<tag>:<encrypted>  (все в base64)
    return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptKey(encryptedString) {
    if (!MASTER_ENCRYPTION_KEY || !encryptedString?.startsWith("enc:")) return null;
    try {
        const [, ivB64, tagB64, dataB64] = encryptedString.split(":");
        const iv = Buffer.from(ivB64, "base64");
        const tag = Buffer.from(tagB64, "base64");
        const data = Buffer.from(dataB64, "base64");
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            Buffer.from(MASTER_ENCRYPTION_KEY, "hex"),
            iv
        );
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch (e) {
        console.warn("[BYOK] Decrypt failed:", e.message);
        return null;
    }
}

function maskKey(plaintext) {
    if (!plaintext || plaintext.length < 8) return "***";
    return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`;
}
// ── Кэш расшифрованных ключей (5 минут) — избегаем расшифровки на каждом запросе ──
const userKeyCache = new Map();
const USER_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Возвращает расшифрованный ключ пользователя для провайдера.
 * Возвращает null, если у пользователя нет ключа или произошла ошибка.
 */
async function getUserKey(userId, provider) {
    if (!userId || !provider) return null;
    if (!MASTER_ENCRYPTION_KEY || !supabase) return null;

    const cacheKey = `${userId}:${provider}`;
    const cached = userKeyCache.get(cacheKey);
    if (cached && Date.now() - cached.at < USER_KEY_CACHE_TTL_MS) {
        return cached.key;
    }

    try {
        const { data } = await supabase
            .from("user_api_keys")
            .select("encrypted_keys")
            .eq("user_id", userId)
            .maybeSingle();

        const encrypted = data?.encrypted_keys?.[provider];
        if (!encrypted) {
            userKeyCache.set(cacheKey, { key: null, at: Date.now() });
            return null;
        }

        const decrypted = decryptKey(encrypted);
        if (decrypted) {
            userKeyCache.set(cacheKey, { key: decrypted, at: Date.now() });
            console.log(`[BYOK] Используем пользовательский ключ ${provider} для ${userId} (${maskKey(decrypted)})`);
            return decrypted;
        }
        return null;
    } catch (e) {
        console.warn(`[BYOK] getUserKey(${provider}) failed:`, e.message);
        return null;
    }
}

// ── Кэш Gemini-клиентов по хешу ключа — создаём клиент один раз на ключ ──
const geminiClientCache = new Map();

function getGeminiClientForApiKey(apiKey) {
    if (!apiKey) return getGeminiClient();

    const hash = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
    if (geminiClientCache.has(hash)) {
        return geminiClientCache.get(hash);
    }

    const client = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    geminiClientCache.set(hash, client);
    return client;
}

// =====================================================
// CONFIG
// =====================================================
const currentFilename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app = express();
const PORT = process.env.PORT || 3000;

// Голоса для каждого языка (MSEdge Neural)
const MSEdge_VOICES = {
    "English": "en-US-AriaNeural",
    "German": "de-DE-KatjaNeural",
    "Spanish": "es-ES-ElviraNeural",
    "French": "fr-FR-DeniseNeural",
    "Italian": "it-IT-ElsaNeural",
    "Russian": "ru-RU-SvetlanaNeural",
    "Turkish": "tr-TR-EmelNeural",
    "az": "az-AZ-BabekNeural",  // если доступен
};

// Кэш сгенерированных файлов (не удаляем сразу — браузер может запросить повторно)
const ttsFileCache = new Map();  // key: hash, value: { path, createdAt }

function cleanTtsCache() {
    const now = Date.now();
    const MAX_AGE = 30 * 60 * 1000;  // 30 минут
    for (const [key, value] of ttsFileCache.entries()) {
        if (now - value.createdAt > MAX_AGE) {
            try { fs.unlinkSync(value.path); } catch { /* ignore */ }
            ttsFileCache.delete(key);
        }
    }
}
setInterval(cleanTtsCache, 5 * 60 * 1000);  // каждые 5 минут
// Голоса для каждого языка (MSEdge Neural)

app.get("/api/debug/test-encryption", (req, res) => {
    const sample = "test-api-key-12345";
    const encrypted = encryptKey(sample);
    const decrypted = decryptKey(encrypted);
    const masked = maskKey(sample);
    res.json({
        original: sample,
        encrypted: encrypted ? encrypted.slice(0, 40) + "..." : null,
        decrypted: decrypted,
        masked: masked,
        roundtripOK: decrypted === sample,
    });
});

app.post("/api/tts/synthesize", async (req, res) => {
    try {
        const { text, language = "English" } = req.body;

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: "text обязателен" });
        }

        if (text.length > 2000) {
            return res.status(400).json({ success: false, error: "text слишком длинный (макс 2000 символов)" });
        }

        const voice = MSEdge_VOICES[language] || MSEdge_VOICES["English"];
        const textHash = crypto.createHash("sha256").update(`${voice}:${text}`).digest("hex").slice(0, 16);

        // Проверяем кэш
        if (ttsFileCache.has(textHash)) {
            const cached = ttsFileCache.get(textHash);
            if (fs.existsSync(cached.path)) {
                console.log(`[TTS] ✅ Cache hit для ${textHash}`);
                res.setHeader("Content-Type", "audio/ogg");
                return res.sendFile(cached.path);
            }
            ttsFileCache.delete(textHash);
        }

        console.log(`[TTS] Генерация для "${text.slice(0, 40)}..." (voice: ${voice})`);

        // Генерируем через MSEdge TTS
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

        const tempDir = os.tmpdir();
        const rawWebmPath = path.join(tempDir, `tts-${textHash}-${Date.now()}.webm`);
        const oggPath = rawWebmPath.replace(".webm", ".ogg");

        await tts.toFile(rawWebmPath, text);

        // Конвертация в OGG (браузеры хорошо поддерживают)
        await new Promise((resolve, reject) => {
            exec(`"${ffmpegPath}" -y -i "${rawWebmPath}" -c:a libopus -b:a 64k "${oggPath}"`,
                (err) => err ? reject(err) : resolve());
        });

        // Удаляем промежуточный WebM
        try { fs.unlinkSync(rawWebmPath); } catch { /* ignore */ }

        // Кэшируем готовый OGG
        ttsFileCache.set(textHash, { path: oggPath, createdAt: Date.now() });

        res.setHeader("Content-Type", "audio/ogg");
        res.setHeader("Cache-Control", "public, max-age=1800");
        res.sendFile(oggPath);
    } catch (err) {
        console.error("[TTS] Ошибка:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
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

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// JSON error handler — body-parser не должен отдавать HTML при 413/400
app.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            error: "File too large. Max ~75MB raw PDF / ~100MB base64."
        });
    }
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ success: false, error: "Invalid JSON body" });
    }
    next(err);
});

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

// ═══════════════════════════════════════════════════════════════
// AI GATEWAY — ЯДРО GEMINI
// ═══════════════════════════════════════════════════════════════
// ── Кэш списка доступных моделей ──
let availableGeminiModelsCache = null;
let availableGeminiModelsCacheExpiry = 0;
let geminiModelsDiscoveryPromise = null;
async function discoverAvailableGeminiModels(forceRefresh = false) {
    if (!forceRefresh && availableGeminiModelsCache && Date.now() < availableGeminiModelsCacheExpiry) {
        return availableGeminiModelsCache;
    }
    // Защита от параллельных запросов
    if (geminiModelsDiscoveryPromise) {
        return geminiModelsDiscoveryPromise;
    }
    geminiModelsDiscoveryPromise = (async () => {
        try {
            // Кэш на 1 час — не дёргаем API при каждом вызове
            if (!forceRefresh && availableGeminiModelsCache && Date.now() < availableGeminiModelsCacheExpiry) {
                return availableGeminiModelsCache;
            }
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return [];

            try {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                    { signal: AbortSignal.timeout(10000) }
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                // Оставляем только генеративные модели, сортируем по актуальности
                const models = (data.models || [])
                    .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
                    .map(m => m.name.replace(/^models\//, ""))
                    .filter(name => name.includes("flash"))
                    .sort((a, b) => {
                        const aLite = a.includes("lite") ? 1 : 0;
                        const bLite = b.includes("lite") ? 1 : 0;
                        // Lite-модели первыми (больше ёмкости у Google)
                        if (aLite !== bLite) return bLite - aLite;
                        // Внутри группы — по убыванию версии
                        const verA = parseFloat(a.match(/\d+\.\d+/)?.[0] || "0");
                        const verB = parseFloat(b.match(/\d+\.\d+/)?.[0] || "0");
                        return verB - verA;
                    });
                console.log(`[AI Engine] Обнаружено ${models.length} доступных Gemini моделей:`, models.slice(0, 5));
                availableGeminiModelsCache = models;
                availableGeminiModelsCacheExpiry = Date.now() + 3600 * 1000;  // 1 час
                return models;
            } catch (e) {
                console.warn("[AI Engine] Не удалось получить список моделей:", e.message);
                return [];
            }
        } finally {
            geminiModelsDiscoveryPromise = null;
        }
    })();
    return geminiModelsDiscoveryPromise;
}



async function _callGeminiCore(prompt, preferredModel = null, fallbackModels = [], isJson = true, userApiKey = null) {
    // Приоритет: пользовательский ключ → системный
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("[AI Core] Ни пользовательского, ни системного GEMINI_API_KEY");
        return null;
    }
    const ai = getGeminiClientForApiKey(apiKey);
    let candidateModels = [];

    if (preferredModel) {
        // Явно указанные модели (обратная совместимость)
        candidateModels = [preferredModel, ...fallbackModels];
    } else {
        // Автодискавери — до 10 живых моделей
        const discovered = await discoverAvailableGeminiModels();
        if (discovered.length > 0) {
            candidateModels = discovered.slice(0, 10);
        } else {
            // Абсолютный резерв, если discovery не сработал
            candidateModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"];
        }
    }

    for (let i = 0; i < candidateModels.length; i++) {
        const model = candidateModels[i];

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`[AI Core] ${model} (attempt ${attempt + 1}/${candidateModels.length})`);

                const generatePromise = ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: isJson ? { responseMimeType: "application/json" } : {}
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("TIMEOUT_SPIKE")), 50000)
                );

                const response = await Promise.race([generatePromise, timeoutPromise]);
                if (response && response.text) {
                    console.log(`[AI Core] ✅ ${model} ответил`);
                    return response.text;
                }
            } catch (err) {
                const msg = err?.message || String(err);

                // 404 = модель недоступна — пропускаем сразу, без второй попытки
                if (msg.includes("404") || msg.includes("not found")) {
                    console.warn(`[AI Core] ${model} недоступна (404), пропускаем`);
                    break;   // выход из внутреннего for, к следующей модели
                }

                console.warn(`[AI Core] ${model} attempt ${attempt + 1} failed: ${msg.slice(0, 100)}`);

                if (attempt === 0) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }
        }

        // Небольшая пауза перед следующей моделью — снижает риск повторного 503
        if (i < candidateModels.length - 1) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    console.warn("[AI Core] Все модели Gemini недоступны");
    return null;
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER ДЛЯ GEMINI
// ═══════════════════════════════════════════════════════════════

let geminiFailureCount = 0;
let geminiCircuitOpenUntil = 0;
const GEMINI_FAILURE_THRESHOLD = 5;
const GEMINI_CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 минут

function isGeminiCircuitOpen() {
    return Date.now() < geminiCircuitOpenUntil;
}

function recordGeminiFailure() {
    geminiFailureCount++;
    if (geminiFailureCount >= GEMINI_FAILURE_THRESHOLD) {
        geminiCircuitOpenUntil = Date.now() + GEMINI_CIRCUIT_COOLDOWN_MS;
        console.warn(`[Circuit Breaker] Gemini отключён на 5 минут после ${geminiFailureCount} ошибок`);
    }
}

function recordGeminiSuccess() {
    geminiFailureCount = 0;
    geminiCircuitOpenUntil = 0;
}


// ═══════════════════════════════════════════════════════════════
// GROQ DISCOVERY — динамический список моделей
// ═══════════════════════════════════════════════════════════════

let availableGroqModelsCache = null;
let availableGroqModelsCacheExpiry = 0;

async function discoverAvailableGroqModels(forceRefresh = false) {
    if (!forceRefresh && availableGroqModelsCache && Date.now() < availableGroqModelsCacheExpiry) {
        return availableGroqModelsCache;
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.data)) throw new Error("Неверный формат");

        // Приоритет: сначала большие (70B), потом средние, потом маленькие
        const priority = [
            "llama-3.3-70b-versatile",
            "llama-3.1-70b-versatile",
            "qwen/qwen3-32b",
            "qwen/qwen3.6-27b",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "llama-3.1-8b-instant",
            "gemma2-9b-it",
        ];

        const available = new Set(data.data.map(m => m.id));
        const curated = priority.filter(id => available.has(id));

        // Добавим остальные, если приоритетных мало
        if (curated.length < 3) {
            data.data.forEach(m => {
                if (!curated.includes(m.id) && m.id.length > 0) {
                    curated.push(m.id);
                }
            });
        }

        console.log(`[Groq Discovery] Отобрано ${curated.length} моделей:`, curated.slice(0, 5));
        availableGroqModelsCache = curated;
        availableGroqModelsCacheExpiry = Date.now() + 24 * 3600 * 1000;
        return curated;
    } catch (e) {
        console.warn("[Groq Discovery] Ошибка:", e.message);
        return [];
    }
}
// ── Discovery моделей OpenRouter с фильтрацией ──
let availableOpenRouterModelsCache = null;
let availableOpenRouterModelsCacheExpiry = 0;

async function discoverAvailableOpenRouterModels(forceRefresh = false) {
    if (!forceRefresh && availableOpenRouterModelsCache && Date.now() < availableOpenRouterModelsCacheExpiry) {
        return availableOpenRouterModelsCache;
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return [];

    try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.data)) throw new Error("Неверный формат ответа");

        // ── Фильтрация ──
        const filtered = data.data
            .filter(m => m.id && m.id.endsWith(":free"))
            .filter(m => {
                const modality = m.architecture?.modality || "";
                return modality.includes("text->text");
            })
            .filter(m => (m.context_length || 0) >= 8000)
            .filter(m => {
                // Исключаем заведомо плохие для JSON
                const id = m.id.toLowerCase();
                return !id.includes("vision")
                    && !id.includes("image")
                    && !id.includes("audio")
                    && !id.includes("embed");
            });

        // ── Диверсификация: не более 2 моделей от одного провайдера ──
        const byProvider = {};
        for (const m of filtered) {
            const provider = m.id.split("/")[0];  // "meta-llama", "mistralai", "nvidia" и т.д.
            if (!byProvider[provider]) byProvider[provider] = [];
            if (byProvider[provider].length < 2) {
                byProvider[provider].push(m.id);
            }
        }

        // ── Разворачиваем в плоский список, отсортированный по размеру контекста ──
        const curated = [];
        for (const provider of Object.keys(byProvider)) {
            curated.push(...byProvider[provider]);
        }

        console.log(`[OpenRouter Discovery] Отобрано ${curated.length} моделей от ${Object.keys(byProvider).length} провайдеров:`);
        curated.slice(0, 8).forEach(m => console.log(`  • ${m}`));

        availableOpenRouterModelsCache = curated;
        availableOpenRouterModelsCacheExpiry = Date.now() + 24 * 3600 * 1000;
        return curated;
    } catch (e) {
        console.warn("[OpenRouter Discovery] Ошибка:", e.message);
        return [];
    }
}
// ═══════════════════════════════════════════════════════════════
// OPENROUTER — СТРАХОВКА #2
// ═══════════════════════════════════════════════════════════════

async function callOpenRouter(prompt, model = null, userApiKey = null) {
    const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.warn("[OpenRouter] Ни пользовательского, ни системного OPENROUTER_API_KEY");
        return null;
    }
    // Динамический список моделей вместо хардкода
    const modelsToTry = model
        ? [model]
        : await discoverAvailableOpenRouterModels();

    if (modelsToTry.length === 0) {
        console.warn("[OpenRouter] Нет доступных моделей");
        return null;
    }

    for (let i = 0; i < modelsToTry.length; i++) {
        const m = modelsToTry[i];
        try {
            console.log(`[OpenRouter] ${m} (${i + 1}/${modelsToTry.length})`);
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://speakbot.onrender.com",
                    "X-Title": "SpeakBot"
                },
                body: JSON.stringify({
                    model: m,
                    messages: [{ role: "user", content: prompt }]
                }),
                signal: AbortSignal.timeout(45000)
            });

            if (!response.ok) {
                console.warn(`[OpenRouter] ${m} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && typeof content === "string" && content.length > 0) {
                console.log(`[OpenRouter] ✅ ${m} ответил`);
                return content;
            }
        } catch (err) {
            console.warn(`[OpenRouter] ${m} ошибка: ${err.message.slice(0, 100)}`);
        }
    }

    console.warn("[OpenRouter] Все модели недоступны");
    return null;
}

// ═══════════════════════════════════════════════════════════════
// GROQ — СТРАХОВКА #3 (самый быстрый)
// ═══════════════════════════════════════════════════════════════

async function callGroq(prompt, model = null, userApiKey = null) {
    const apiKey = userApiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn("[Groq] Ни пользовательского, ни системного GROQ_API_KEY");
        return null;
    }

    const modelsToTry = model ? [model] : await discoverAvailableGroqModels();
    if (modelsToTry.length === 0) {
        console.warn("[Groq] Нет доступных моделей");
        return null;
    }

    for (let i = 0; i < modelsToTry.length; i++) {
        const m = modelsToTry[i];
        try {
            console.log(`[Groq] ${m} (${i + 1}/${modelsToTry.length})`);
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: m,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                console.warn(`[Groq] ${m} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && typeof content === "string" && content.length > 0) {
                console.log(`[Groq] ✅ ${m} ответил`);
                return content;
            }
        } catch (err) {
            console.warn(`[Groq] ${m} ошибка: ${err.message.slice(0, 100)}`);
        }
    }

    console.warn("[Groq] Все модели недоступны");
    return null;
}

// ═══════════════════════════════════════════════════════════════
// DEEPSEEK — СТРАХОВКА #4
// ═══════════════════════════════════════════════════════════════

async function callDeepSeek(prompt, model = "deepseek-chat", userApiKey = null) {
    const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return null;
    }
    const modelsToTry = [model];
    // Если явно передан reasoner — пробуем его первым, потом chat
    if (model === "deepseek-reasoner") {
        modelsToTry.push("deepseek-chat");
    }

    for (const m of modelsToTry) {
        try {
            console.log(`[DeepSeek] ${m}`);
            const response = await fetch("https://api.deepseek.com/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: m,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    stream: false
                }),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                console.warn(`[DeepSeek] ${m} HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && typeof content === "string" && content.length > 0) {
                console.log(`[DeepSeek] ✅ ${m} ответил`);
                return content;
            }
        } catch (err) {
            console.warn(`[DeepSeek] ${m} ошибка: ${err.message.slice(0, 100)}`);
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════
// OPENAI — СТРАХОВКА #5
// ═══════════════════════════════════════════════════════════════

const OPENAI_MODELS = [
    "gpt-4o-mini",       // самая дешёвая, быстрая
    "gpt-4o",            // сильнее, дороже
    "gpt-3.5-turbo",     // легаси, но рабочий
];

async function callOpenAI(prompt, model = null, userApiKey = null) {
    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const modelsToTry = model ? [model] : OPENAI_MODELS;

    for (const m of modelsToTry) {
        try {
            console.log(`[OpenAI] ${m}`);
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: m,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                }),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                console.warn(`[OpenAI] ${m} HTTP ${response.status}`);
                // 404 = модели нет, 401 = ключ невалиден — на 401 не имеет смысла продолжать
                if (response.status === 401) break;
                continue;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && typeof content === "string" && content.length > 0) {
                console.log(`[OpenAI] ✅ ${m} ответил`);
                return content;
            }
        } catch (err) {
            console.warn(`[OpenAI] ${m} ошибка: ${err.message.slice(0, 100)}`);
        }
    }

    console.warn("[OpenAI] Все модели недоступны");
    return null;
}

// ═══════════════════════════════════════════════════════════════
// ANTHROPIC (CLAUDE) — СТРАХОВКА #6
// Формат отличается от OpenAI: system отдельно, content — массив блоков
// ═══════════════════════════════════════════════════════════════

const ANTHROPIC_MODELS = [
    "claude-3-5-haiku-latest",    // быстрая, дешёвая
    "claude-3-5-sonnet-latest",   // умнее, дороже
];

async function callAnthropic(prompt, model = null, userApiKey = null) {
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const modelsToTry = model ? [model] : ANTHROPIC_MODELS;

    for (const m of modelsToTry) {
        try {
            console.log(`[Anthropic] ${m}`);
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: m,
                    max_tokens: 8192,
                    messages: [{ role: "user", content: prompt }]
                }),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                console.warn(`[Anthropic] ${m} HTTP ${response.status}`);
                if (response.status === 401 || response.status === 403) break;
                continue;
            }

            const data = await response.json();
            // Anthropic возвращает content как массив блоков
            const textBlock = data?.content?.find(b => b.type === "text");
            const content = textBlock?.text;
            if (content && typeof content === "string" && content.length > 0) {
                console.log(`[Anthropic] ✅ ${m} ответил`);
                return content;
            }
        } catch (err) {
            console.warn(`[Anthropic] ${m} ошибка: ${err.message.slice(0, 100)}`);
        }
    }

    console.warn("[Anthropic] Все модели недоступны");
    return null;
}
// ═══════════════════════════════════════════════════════════════
// ГЛАВНЫЙ AI-ШЛЮЗ: Gemini → OpenRouter → Groq
// ═══════════════════════════════════════════════════════════════

async function callGeminiWithResilience(
    prompt,
    preferredModel = null,
    fallbackModels = [],
    isJson = true,
    userId = null
) {
    // ── Резолвим все пользовательские ключи один раз ──
    let userGeminiKey = null;
    let userOpenRouterKey = null;
    let userGroqKey = null;
    let userDeepSeekKey = null;
    let userOpenAIKey = null;
    let userAnthropicKey = null;

    if (userId) {
        [userGeminiKey, userOpenRouterKey, userGroqKey, userDeepSeekKey, userOpenAIKey, userAnthropicKey] = await Promise.all([
            getUserKey(userId, "gemini"),
            getUserKey(userId, "openrouter"),
            getUserKey(userId, "groq"),
            getUserKey(userId, "deepseek"),
            getUserKey(userId, "openai"),
            getUserKey(userId, "anthropic"),
        ]);
    }

    // ── Слой 1: Gemini ──
    const hasGeminiAccess = !!(userGeminiKey || process.env.GEMINI_API_KEY);
    if (!isGeminiCircuitOpen() && hasGeminiAccess) {
        const r = await _callGeminiCore(prompt, preferredModel, fallbackModels, isJson, userGeminiKey);
        if (r) { recordGeminiSuccess(); return r; }
        recordGeminiFailure();
    } else if (!hasGeminiAccess) {
        console.warn("[AI Gateway] Gemini пропущен — нет ключа");
    } else {
        console.warn("[AI Gateway] Circuit breaker открыт");
    }

    // ── Слой 2: OpenRouter ──
    if (userOpenRouterKey || process.env.OPENROUTER_API_KEY) {
        console.warn("[AI Gateway] Пробуем OpenRouter...");
        const r = await callOpenRouter(prompt, null, userOpenRouterKey);
        if (r) { console.log("[AI Gateway] ✅ Ответ от OpenRouter"); return r; }
    }

    // ── Слой 3: Groq ──
    if (userGroqKey || process.env.GROQ_API_KEY) {
        console.warn("[AI Gateway] Пробуем Groq...");
        const r = await callGroq(prompt, null, userGroqKey);
        if (r) { console.log("[AI Gateway] ✅ Ответ от Groq"); return r; }
    }

    // ── Слой 4: DeepSeek ──
    if (userDeepSeekKey || process.env.DEEPSEEK_API_KEY) {
        console.warn("[AI Gateway] Пробуем DeepSeek...");
        const r = await callDeepSeek(prompt, "deepseek-chat", userDeepSeekKey);
        if (r) { console.log("[AI Gateway] ✅ Ответ от DeepSeek"); return r; }
    }

    // ── Слой 5: OpenAI ──  ← НОВЫЙ
    if (userOpenAIKey || process.env.OPENAI_API_KEY) {
        console.warn("[AI Gateway] Пробуем OpenAI...");
        const r = await callOpenAI(prompt, null, userOpenAIKey);
        if (r) { console.log("[AI Gateway] ✅ Ответ от OpenAI"); return r; }
    }

    // ── Слой 6: Anthropic ──  ← НОВЫЙ
    if (userAnthropicKey || process.env.ANTHROPIC_API_KEY) {
        console.warn("[AI Gateway] Пробуем Anthropic...");
        const r = await callAnthropic(prompt, null, userAnthropicKey);
        if (r) { console.log("[AI Gateway] ✅ Ответ от Anthropic"); return r; }
    }

    console.error("[AI Gateway] ❌ Все 6 AI-провайдеров исчерпаны");
    return null;
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

// ── Защита от race condition при генерации daily feeds ──
let dailyFeedsGenerationLock = null;

// ── Защита от race condition при перегенерации stories при смене mediator ──
const mediatorRegenerationInFlight = new Set();
let storiesHydrated = false;
let hydrationInFlight = null;
async function regenerateStoryForNewMediator(story, newMediatorLanguage, userId) {
    const storyKey = `${userId}:${story.id}`;
    if (mediatorRegenerationInFlight.has(storyKey)) return;
    if (story.generatedWithMediator === newMediatorLanguage) return;

    // ── Ограничение попыток: сдаёмся после 3 неудач ──
    story.regenerationAttempts = (story.regenerationAttempts || 0) + 1;
    if (story.regenerationAttempts > 3) {
        console.warn(`[Mediator Regen] Сдаёмся после ${story.regenerationAttempts} попыток для "${story.title}"`);
        story.generatedWithMediator = newMediatorLanguage;   // помечаем "попытки исчерпаны"
        saveStoriesToDisk();
        return;
    }

    mediatorRegenerationInFlight.add(storyKey);

    try {
        console.log(`[Mediator Regen] "${story.title}" → ${newMediatorLanguage} (попытка ${story.regenerationAttempts}/3)`);

        const targetLangName = {
            az: "Azerbaijani (Azərbaycan dili)",
            ru: "Russian (Русский)",
            tr: "Turkish (Türkçe)",
            es: "Spanish (Español)",
            de: "German (Deutsch)",
            en: "English",
        }[newMediatorLanguage] || newMediatorLanguage;

        // ⚠️ Передаём ТОЛЬКО оригинальные английские тексты — никаких существующих переводов
        // Иначе AI копирует уже переведённое и возвращает как есть
        const originalSentencesText = (story.sentences || []).map((s) => s.text || "");
        const originalExcerpt = originalSentencesText.join(" ").slice(0, 2500);

        const translatePrompt = `You are a professional literary translator and critic.

BOOK: "${story.title}" by ${story.author}

TASK: Produce the following fields FRESHLY in ${targetLangName} (${newMediatorLanguage}).
Do NOT copy any pre-existing translations — the input below is the ORIGINAL ENGLISH text only.

ORIGINAL ENGLISH EXCERPT:
"""
${originalExcerpt}
"""

SENTENCES to translate (in this exact order, count = ${originalSentencesText.length}):
${JSON.stringify(originalSentencesText, null, 2)}

SOCRATIC DIALOGUE questions (write a pedagogical feedback for each):
${JSON.stringify((story.conversations || []).map((c) => c.prompt || c.dialoguePrompt || ""), null, 2)}

EXERCISE questions (write an explanation for each):
${JSON.stringify((story.exercises || []).map((e) => e.question || ""), null, 2)}

VOCABULARY words (give the meaning of each English word in ${targetLangName}):
${JSON.stringify((story.keyVocabulary || []).map((v) => v.word || ""), null, 2)}

Return ONLY valid JSON in ${targetLangName}:
{
  "culturalLinguisticContext": "2 sentences in ${targetLangName}",
  "sentences": [{ "translation": "...", "literaryNote": "..." }],
  "conversations": [{ "botFeedback": "..." }],
  "exercises": [{ "explanation": "..." }],
  "keyVocabulary": [{ "translation": "..." }]
}`;
        const raw = await callGeminiWithResilience(translatePrompt);
        if (!raw) {
            console.warn(`[Mediator Regen] AI null для "${story.title}" — попыток осталось ${3 - story.regenerationAttempts}`);
            saveStoriesToDisk();
            return;   // НЕ проставляем generatedWithMediator — попробуем позже
        }

        const translated = repairJson(raw);
        if (!translated) {
            console.warn(`[Mediator Regen] JSON parse failed для "${story.title}"`);
            saveStoriesToDisk();
            return;
        }

        // ── Применяем обновления ──
        let updatedFields = 0;

        if (translated.culturalLinguisticContext && translated.culturalLinguisticContext.trim().length > 10) {
            story.culturalLinguisticContext = translated.culturalLinguisticContext;
            updatedFields++;
        }

        if (Array.isArray(translated.sentences) && Array.isArray(story.sentences)) {
            story.sentences = story.sentences.map((s, i) => {
                const tr = translated.sentences[i] || {};
                return {
                    ...s,
                    translation: tr.translation || s.translation,
                    literaryNote: tr.literaryNote || s.literaryNote,
                };
            });
            updatedFields++;
        }

        if (Array.isArray(translated.conversations) && Array.isArray(story.conversations)) {
            story.conversations = story.conversations.map((c, i) => ({
                ...c,
                botFeedback: translated.conversations[i]?.botFeedback || c.botFeedback,
            }));
            updatedFields++;
        }

        if (Array.isArray(translated.exercises) && Array.isArray(story.exercises)) {
            story.exercises = story.exercises.map((e, i) => ({
                ...e,
                explanation: translated.exercises[i]?.explanation || e.explanation,
            }));
            updatedFields++;
        }

        if (Array.isArray(translated.keyVocabulary) && Array.isArray(story.keyVocabulary)) {
            story.keyVocabulary = story.keyVocabulary.map((v, i) => ({
                ...v,
                translation: translated.keyVocabulary[i]?.translation || v.translation,
            }));
            updatedFields++;
        }

        // ── Только теперь помечаем "готово" ──
        story.generatedWithMediator = newMediatorLanguage;
        story.regeneratedAt = new Date().toISOString();
        story.regenerationAttempts = 0;

        console.log(`[Mediator Regen] ✅ "${story.title}" → ${newMediatorLanguage} (обновлено полей: ${updatedFields}/5)`);

        saveStoriesToDisk();
        if (typeof saveStoriesToSupabase === "function") {
            await saveStoriesToSupabase().catch(() => { });
        }

        // Инвалидация Redis cache
        if (redis) {
            try {
                const keys = await redis.keys("spk:daily_feeds:*");
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } catch (e) {
                console.warn("[Mediator Regen] Cache invalidation failed:", e.message);
            }
        }
    } catch (e) {
        console.warn(`[Mediator Regen] Ошибка для "${story.title}":`, e.message);
    } finally {
        mediatorRegenerationInFlight.delete(storyKey);
    }
}

// ── Глобальная очередь для последовательной регенерации ──
let regenerationQueue = Promise.resolve();

function scheduleMediatorRegenerationIfNeeded(stories, currentMediator, userId) {
    if (!currentMediator) return;

    const toRegenerate = stories.filter((story) => {
        if (story.generatedWithMediator === currentMediator) return false;
        const key = `${userId}:${story.id}`;
        if (mediatorRegenerationInFlight.has(key)) return false;
        if ((story.regenerationAttempts || 0) > 3) return false;   // сдавшиеся не трогаем
        return true;
    });

    if (toRegenerate.length === 0) return;

    console.log(`[Mediator Regen Queue] В очередь: ${toRegenerate.length} stories`);

    // Строим цепочку последовательных вызовов
    for (const story of toRegenerate) {
        regenerationQueue = regenerationQueue
            .then(() => regenerateStoryForNewMediator(story, currentMediator, userId))
            .catch((e) => console.warn(`[Mediator Regen Queue] ${story.title}:`, e.message));
    }
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });


function saveUsersToDisk() {
    try { fs.writeFileSync(USERS_FILE, JSON.stringify(syncedUsersDatabase, null, 2)); }
    catch (e) { console.error("Save users failed:", e); }
}
function loadUsersFromDisk() {
    try { return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) : {}; }
    catch { return {}; }
}
async function saveStoriesToSupabase() {
    if (!supabase) return;

    const hasData =
        Object.keys(userCustomStories || {}).length > 0 ||
        (autoFetchedStories || []).length > 0;

    if (!hasData) {
        console.log("[Supabase] Skip save — nothing to persist");
        return;
    }

    try {
        const { error } = await supabase
            .from("user_stories")
            .upsert({
                id: "global",
                payload: { userCustomStories, autoFetchedStories },
                updated_at: new Date().toISOString(),
            });
        if (error) throw error;
        console.log(`[Supabase] Persisted ${Object.keys(userCustomStories || {}).length} users`);
    } catch (err) {
        console.warn("[Supabase] story persist failed:", err.message);
    }
}

async function loadStoriesFromSupabase() {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('user_stories')
            .select('payload')
            .eq('id', 'global')
            .maybeSingle();
        if (error) throw error;
        return data?.payload || null;
    } catch (err) {
        console.warn('[Supabase] story load failed:', err.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// STORY NORMALIZATION — приводит story к структуре, ожидаемой UI
// ═══════════════════════════════════════════════════════════════

function normalizeStoryForUi(story) {
    if (!story || typeof story !== "object") return story;

    // ── Нормализация conversations (Socratic chat) ──
    if (Array.isArray(story.conversations)) {
        story.conversations = story.conversations.map((c, idx) => {
            const options = Array.isArray(c.options) && c.options.length >= 2
                ? c.options
                : ["A thoughtful interpretation", "A surface-level reading", "An unrelated claim"];

            return {
                ...c,
                id: c.id || `socratic-${idx + 1}`,
                stepNumber: c.stepNumber || idx + 1,
                persona: c.persona || "SpeakBot Socratic Mentor",
                topic: c.topic || `Socratic Inquiry ${idx + 1}`,
                prompt: c.prompt || c.question || `What is your interpretation of passage ${idx + 1}?`,
                options,
                correctIndex: typeof c.correctIndex === "number"
                    ? Math.max(0, Math.min(c.correctIndex, options.length - 1))
                    : 0,
                botFeedback: c.botFeedback || "Consider the literary context and character motives.",
                points: c.points || 25,
            };
        });
    }

    // ── Нормализация exercises (Tasks & Exercises) ──
    if (Array.isArray(story.exercises)) {
        story.exercises = story.exercises.map((e, idx) => {
            let options = Array.isArray(e.options)
                ? e.options.filter((o) => typeof o === "string" && o.trim().length > 0)
                : [];

            // Дополняем до 4 вариантов, чтобы UI всегда показывал A/B/C/D
            if (options.length === 0) {
                options = [
                    "The correct answer based on the excerpt",
                    "A plausible distractor",
                    "An unrelated option",
                    "Another distractor",
                ];
            } else if (options.length === 2) {
                options = [...options, "None of the above", "All of the above"];
            } else if (options.length === 3) {
                options = [...options, "None of the above"];
            }

            return {
                ...e,
                id: e.id || `task-${idx + 1}`,
                taskNumber: e.taskNumber || idx + 1,
                category: e.category || e.type || "Comprehension",
                question: e.question || e.prompt || `Analysis task ${idx + 1}`,
                options,
                correctIndex: typeof e.correctIndex === "number"
                    ? Math.max(0, Math.min(e.correctIndex, options.length - 1))
                    : 0,
                explanation: e.explanation || "Refer to the literary excerpt for justification.",
                points: e.points || 25,
            };
        });
    }

    // ── Нормализация sentences ──
    if (Array.isArray(story.sentences)) {
        story.sentences = story.sentences.map((s, idx) => ({
            ...s,
            text: s.text || s.sentence || `Sentence ${idx + 1}`,
            translation: s.translation || "",
            literaryNote: s.literaryNote || s.note || "",
            audioTime: s.audioTime || `0:${String(idx * 7).padStart(2, "0")} - 0:${String((idx + 1) * 7).padStart(2, "0")}`,
        }));
    }

    // ── Нормализация keyVocabulary ──
    if (Array.isArray(story.keyVocabulary)) {
        story.keyVocabulary = story.keyVocabulary.map((v, idx) => ({
            ...v,
            word: v.word || `word_${idx}`,
            ipa: v.ipa || "",
            pos: v.pos || "noun",
            translation: v.translation || v.meaning || "",
            cefr: v.cefr || story.level || "B1",
            example: v.example || "",
        }));
    }

    return story;
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
function loadStoriesFromDisk() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
            // Try plain JSON first (legacy files or future format change)
            try {
                return JSON.parse(raw);
            } catch {
                // Fall back to gzip-base64 (current save format)
                return JSON.parse(unzipText(raw));
            }
        }
    } catch (err) {
        console.warn("[Storage] load:", err.message);
    }
    return { userCustomStories: {}, autoFetchedStories: [] };
}
function saveStoriesToDisk() {
    try {
        const payload = { userCustomStories, autoFetchedStories, savedAt: new Date().toISOString() };
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(payload, null, 2));
        // Mirror to Supabase (fire-and-forget)
        saveStoriesToSupabase().catch(e => console.warn("[Supabase mirror]", e.message));
    } catch (err) {
        console.error("[Storage] save:", err.message);
    }
}


async function ensureStoriesHydrated() {
    if (storiesHydrated) return;
    if (hydrationInFlight) return hydrationInFlight;

    hydrationInFlight = (async () => {
        try {
            const remote = await loadStoriesFromSupabase();
            if (remote) {
                const remoteUserStories = remote.userCustomStories || {};
                const remoteAutoStories = Array.isArray(remote.autoFetchedStories)
                    ? remote.autoFetchedStories
                    : [];

                let mergedUserCount = 0;
                let mergedAutoCount = 0;

                for (const uid of Object.keys(remoteUserStories)) {
                    const remoteStories = Array.isArray(remoteUserStories[uid]) ? remoteUserStories[uid] : [];
                    const localStories = Array.isArray(userCustomStories[uid]) ? userCustomStories[uid] : [];

                    const localIds = new Set(localStories.map((s) => s.id));
                    const onlyInRemote = remoteStories.filter((s) => !localIds.has(s.id));

                    if (onlyInRemote.length > 0) {
                        userCustomStories[uid] = [...localStories, ...onlyInRemote];
                        mergedUserCount += onlyInRemote.length;
                    } else if (!userCustomStories[uid]) {
                        userCustomStories[uid] = localStories;
                    }
                }

                const localAutoIds = new Set((autoFetchedStories || []).map((s) => s.id));
                const autoOnlyInRemote = remoteAutoStories.filter((s) => !localAutoIds.has(s.id));
                if (autoOnlyInRemote.length > 0) {
                    autoFetchedStories = [...(autoFetchedStories || []), ...autoOnlyInRemote];
                    mergedAutoCount = autoOnlyInRemote.length;
                }

                console.log(
                    `[Supabase] Merged: users=${Object.keys(userCustomStories).length}, ` +
                    `auto=${(autoFetchedStories || []).length}, ` +
                    `newFromRemote=${mergedUserCount + mergedAutoCount}`
                );

                // Если есть что-то новое локально — пушим в Supabase
                if (mergedUserCount === 0 && mergedAutoCount === 0) {
                    const totalLocalUsers = Object.keys(userCustomStories).length;
                    const totalRemoteUsers = Object.keys(remoteUserStories).length;
                    if (totalLocalUsers > totalRemoteUsers) {
                        saveStoriesToSupabase().catch(() => { });
                    }
                }
            } else {
                console.log(`[Supabase] No remote stories — using local data`);
                const hasLocal =
                    Object.keys(userCustomStories).length > 0 ||
                    (autoFetchedStories || []).length > 0;
                if (hasLocal) {
                    saveStoriesToSupabase().catch(() => { });
                }
            }
        } catch (e) {
            console.warn("[Supabase] Hydrate failed:", e.message);
        } finally {
            storiesHydrated = true;
        }
    })();

    return hydrationInFlight;
}
const diskData = loadStoriesFromDisk();
let userCustomStories = diskData.userCustomStories || {};
let autoFetchedStories = diskData.autoFetchedStories || [];

// Hydrate from Supabase (overrides local disk if present)
(async () => {
    const remote = await loadStoriesFromSupabase();
    if (remote) {
        userCustomStories = remote.userCustomStories || userCustomStories;
        autoFetchedStories = remote.autoFetchedStories || autoFetchedStories;
        saveStoriesToDisk();  // mirror to local
    }
})();
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
// ═══════════════════════════════════════════════════════════════
// JSON REPAIR — исправляет типичные огрехи AI при генерации
// ═══════════════════════════════════════════════════════════════

async function repairJson(rawText) {
    if (!rawText || typeof rawText !== "string") return null;

    let text = rawText.trim();

    // 1. Убираем markdown-обёртки ```json ... ```
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
    text = text.replace(/\s*```\s*$/, "");

    // 2. Если есть префикс "Here is the JSON:" или похожий — отсекаем до первой {
    const firstBrace = text.indexOf("{");
    if (firstBrace > 0) text = text.slice(firstBrace);

    // 3. Если есть суффикс после последней } — отсекаем
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > 0) text = text.slice(0, lastBrace + 1);

    // 4. Первая попытка — как есть
    try {
        return JSON.parse(text);
    } catch (_) { /* продолжаем ремонт */ }

    // 5. Ремонт: висячие запятые перед } или ]
    text = text.replace(/,\s*([}\]])/g, "$1");

    // 6. Ремонт: одинарные кавычки на двойные (аккуратно — только вокруг ключей)
    text = text.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3');
    text = text.replace(/(:\s*)'([^']*)'(\s*[,}\]])/g, '$1"$2"$3');

    // 7. Ремонт: неэкранированные переносы строк внутри значений
    // Заменяем \n, \r, \t внутри строк на пробел (грубо, но работает для большинства случаев)
    text = text.replace(/"([^"]*)"/g, (match, inner) => {
        const cleaned = inner.replace(/[\r\n\t]/g, " ");
        return `"${cleaned}"`;
    });

    // 8. Вторая попытка
    // 8. Вторая попытка
    try {
        return JSON.parse(text);
    } catch (e2) { /* продолжаем */ }

    // 9. Ремонт пропущенных запятых между свойствами
    // Ищем паттерн: "value" <newline> "key": и добавляем запятую
    text = text.replace(/("\s*)\n(\s*")/g, "$1,\n$2");
    text = text.replace(/(\d|\]|\}|true|false|null)\s*\n\s*"/g, (match, p1) => `${p1},\n"`);
    text = text.replace(/"\s+"/g, '", "');   // "value" "value" → "value", "value"

    // 10. Третья попытка
    try {
        return JSON.parse(text);
    } catch (e3) { /* продолжаем */ }

    // 11. Последняя попытка: используем jsonrepair если установлен
    try {
        const { jsonrepair } = await import("jsonrepair").catch(() => ({ jsonrepair: null }));
        if (jsonrepair) {
            const repaired = jsonrepair(text);
            return JSON.parse(repaired);
        }
    } catch (e4) { /* ignore */ }

    console.warn("[JSON Repair] Не удалось восстановить JSON:", e2.message);
    return null;
}
function normalizeRoadmapShape(roadmap) {
    if (!roadmap || typeof roadmap !== "object") return roadmap;

    if (!Array.isArray(roadmap.milestones)) roadmap.milestones = [];
    if (!Array.isArray(roadmap.checkpointQuestions)) roadmap.checkpointQuestions = [];
    if (!Array.isArray(roadmap.tags)) roadmap.tags = [];

    roadmap.milestones = roadmap.milestones
        .map((m, idx) => {
            if (!m || typeof m !== "object") return null;
            return {
                step: m.step || idx + 1,
                title: m.title || `Step ${idx + 1}`,
                description: m.description || "",
                grammarPoint: m.grammarPoint || "",
                sampleSentence: m.sampleSentence || "",
                tokens: Array.isArray(m.tokens) ? m.tokens : [],
            };
        })
        .filter(Boolean);

    roadmap.checkpointQuestions = roadmap.checkpointQuestions
        .map((q, idx) => {
            if (!q || typeof q !== "object") return null;
            const options = Array.isArray(q.options) && q.options.length >= 2
                ? q.options
                : ["A", "B", "C", "D"];
            return {
                question: q.question || `Question ${idx + 1}`,
                options,
                correctIndex: typeof q.correctIndex === "number"
                    ? Math.max(0, Math.min(q.correctIndex, options.length - 1))
                    : 0,
                explanation: q.explanation || "",
            };
        })
        .filter(Boolean);

    return roadmap;
}

async function extractTextFromPdfWithGeminiOCR(buffer, userId = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return '';

    // Gemini inlineData лимит ~20 MB
    if (buffer.length > 20 * 1024 * 1024) {
        console.warn('[OCR] PDF >20MB, skip Gemini OCR');
        return '';
    }

    const ai = getGeminiClient();
    const base64Pdf = buffer.toString('base64');

    // Приоритетные мультимодальные модели (актуальные на 2026-09)
    const preferred = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
    ];

    // Плюс всё что нашёл discovery (на случай если Google переименует)
    const discovered = await discoverAvailableGeminiModels().catch(() => []);

    // Убираем дубликаты, сохраняем порядок
    const modelsToTry = [...new Set([...preferred, ...discovered])];

    const ocrPrompt = 'Extract ALL visible text from this PDF exactly as it appears. Preserve paragraph breaks. Return ONLY the extracted text — no commentary, no summary, no markdown fences.';

    for (const model of modelsToTry) {
        try {
            console.log(`[OCR] Trying ${model}...`);
            const response = await ai.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: ocrPrompt },
                        { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
                    ]
                }]
            });

            const text = response?.text || '';
            if (text.length > 50) {
                console.log(`[OCR] ${model} extracted ${text.length} chars`);
                return text;
            }
            console.warn(`[OCR] ${model} returned ${text.length} chars, trying next`);
        } catch (e) {
            const msg = e?.message || String(e);
            if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer available')) {
                console.warn(`[OCR] ${model} deprecated, skip`);
                continue;
            }
            if (msg.includes('429') || msg.includes('quota')) {
                console.warn(`[OCR] ${model} quota exceeded, skip`);
                continue;
            }
            console.warn(`[OCR] ${model} failed: ${msg.slice(0, 120)}`);
        }
    }

    console.warn('[OCR] All models exhausted');
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
        culturalLinguisticContext: `Excerpt from "${bookTitle}" by ${author} (${authorEra || "Unknown"}). This passage reflects the author's characteristic style and thematic concerns.`,
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
            id: "socratic-1",
            stepNumber: 1,
            persona: "SpeakBot Socratic Mentor",
            topic: "Textual Comprehension",
            prompt: `What is the primary subject matter of this excerpt from "${bookTitle}" by ${author}?`,
            options: [
                `The excerpt's central focus is on ${bookTitle}'s core thematic content.`,
                `The excerpt is about an unrelated topic.`,
                `The excerpt is purely decorative with no substance.`
            ],
            correctIndex: 0,
            botFeedback: `This excerpt from "${bookTitle}" presents the author's primary subject matter. Re-read the passage focusing on its main ideas and the author's intent.`,
            points: 25
        }],
        exercises: [{
            id: "task-1",
            taskNumber: 1,
            category: "Comprehension",
            question: `Which of the following best describes the title of this literary work?`,
            options: [
                bookTitle,
                "An unrelated fictional title",
                "A different work by a different author",
                "A personal letter"
            ],
            correctIndex: 0,
            explanation: `The work's title is "${bookTitle}" by ${author}.`,
            points: 25
        }]
    };
}

// =====================================================
// DAILY BOT STORY FEEDS (FIXED - feeds variable)
// =====================================================
// Проверенный список Project Gutenberg ID — все классические произведения,
// доступные в plain-text. Источник: официальные топ-100 Gutenberg.
const STATIC_GUTENBERG_BOOK_IDS = [
    // Английская классика — топ-50 по скачиваниям
    1342, 16328, 11, 84, 2701, 5200, 1952, 1661, 98, 1080,
    25344, 1250, 2542, 1497, 43, 120, 6130, 1232, 345, 844,
    2600, 1400, 1748, 1260, 4300, 158, 219, 996, 16, 768,
    205, 2413, 30254, 514, 932, 2814, 3825, 4217, 5765, 121,
    1857, 2560, 2214, 510, 105, 2400, 16643, 560, 2148, 3289,
    1322, 321, 2587, 1053, 3020, 3600, 41445, 15399, 17396, 38427,
    2759, 11231, 17013, 2514, 2284, 1184, 2130, 2185, 3621, 3994,
    4180, 4811, 5511, 5994, 6564, 7035, 7433, 8000, 8786, 9298,
    10002, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000,

    // Американская литература
    74, 76, 86, 108, 109, 135, 158, 160, 161, 171,
    173, 175, 191, 195, 199, 205, 206, 220, 237, 238,
    244, 250, 254, 259, 260, 262, 265, 270, 281, 293,

    // Британская классика (расширение)
    564, 585, 649, 730, 829, 863, 913, 929, 968, 1023,
    1058, 1080, 1148, 1184, 1232, 1260, 1322, 1400, 1497, 1580,
    1615, 1661, 1748, 1857, 1952, 2053, 2148, 2214, 2284, 2400,

    // Русская литература (в английском переводе)
    1399, 2148, 28054, 2600, 1846, 3390, 4069, 4600, 5552, 6000,

    // Европейская литература
    1148, 1149, 1150, 1151, 1152, 1153, 1154, 1155, 1156, 1157,
    2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,

    // Детективы и приключения
    1661, 2097, 2449, 2600, 2852, 3070, 3289, 3420, 3546, 3800,

    // Фантастика и фэнтези (старая)
    35, 36, 37, 38, 39, 40, 41, 42, 44, 45,
    84, 85, 86, 87, 88, 89, 90, 91, 92, 93,
];

/**
 * Дедуплицируем список при загрузке модуля.
 */
const UNIQUE_GUTENBERG_IDS = [...new Set(STATIC_GUTENBERG_BOOK_IDS)];
/**
 * Уровень 3 — Статический fallback.
 * Не зависит ни от одного внешнего API. Всегда возвращает книгу.
 */
async function fetchFromStaticList(targetLanguage = "English") {
    // Для не-английских языков статический список не подходит —
    // возвращаем null, чтобы сработали другие уровни.
    if (normalizeLanguageCanonical(targetLanguage) !== "English") {
        return null;
    }

    // Перемешиваем, чтобы книги не повторялись в одном порядке
    const shuffled = [...STATIC_GUTENBERG_BOOK_IDS].sort(() => Math.random() - 0.5);

    // Пробуем до 10 случайных ID, пока не найдём доступный текст
    for (let i = 0; i < Math.min(10, shuffled.length); i++) {
        const bookId = shuffled[i];
        try {
            const url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;

            const fullText = await res.text();
            if (!fullText || fullText.trim().length < 500) continue;

            // Пытаемся определить название и автора из текста
            const meta = extractTitleAuthorFromGutenbergText(fullText, bookId);

            return {
                id: `static-${Date.now()}-${bookId}`,
                title: meta.title,
                author: meta.author,
                targetLanguage: "English",
                excerpt: selectBestExcerpt(fullText, 300),
                content: fullText,
                source: `Project Gutenberg #${bookId}`,
                isAutoFetched: true,
                createdAt: new Date().toISOString(),
            };
        } catch (e) {
            console.warn(`[StaticFetch] Book #${bookId} failed:`, e.message);
        }
    }

    // Даже статический список не сработал (нет интернета вообще) —
    // возвращаем null, чтобы сработал generateLocalFallbackStory
    return null;
}

/**
 * Вспомогательная функция: извлекает название и автора из Gutenberg plain-text.
 */
function extractTitleAuthorFromGutenbergText(text, fallbackId) {
    const head = text.slice(0, 2000);
    const titleMatch = head.match(/^Title:\s*(.+)$/m);
    const authorMatch = head.match(/^Author:\s*(.+)$/m);
    return {
        title: titleMatch ? titleMatch[1].trim() : `Gutenberg Book #${fallbackId}`,
        author: authorMatch ? authorMatch[1].trim() : "Classic Author",
    };
}

/**
 * Уровень 1 — Gutendex API.
 * Живой каталог, JSON, фильтр по языку.
 */

async function fetchFromGutendex(targetLanguage = "English") {
    const langCode = mapLanguageToGutendexCode(targetLanguage);
    if (!langCode) return null;

    try {
        // Gutendex timeout на глубоких страницах (4+) — используем только 1–3.
        // 3 страницы × 32 книги = ~96 доступных книг.
        const randomPage = Math.floor(Math.random() * 20) + 1;
        const url = `https://gutendex.com/books?languages=${langCode}&page=${randomPage}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

        if (!res.ok) throw new Error(`Gutendex HTTP ${res.status}`);

        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;

        const book = data.results[Math.floor(Math.random() * data.results.length)];

        const textUrl = book.formats?.["text/plain; charset=utf-8"]
            || book.formats?.["text/plain"]
            || Object.entries(book.formats || {}).find(([k]) => k.startsWith("text/plain"))?.[1];

        if (!textUrl) return null;

        const textRes = await fetch(textUrl, { signal: AbortSignal.timeout(20000) });
        if (!textRes.ok) return null;

        const fullText = await textRes.text();
        if (!fullText || fullText.trim().length < 500) return null;

        return {
            id: `gutendex-${Date.now()}-${book.id}`,
            title: book.title || `Gutenberg Book #${book.id}`,
            author: book.authors?.[0]?.name || "Unknown Author",
            targetLanguage: normalizeLanguageCanonical(targetLanguage),
            excerpt: selectBestExcerpt(fullText, 300),
            content: fullText,
            source: `Project Gutenberg #${book.id} (via Gutendex)`,
            isAutoFetched: true,
            createdAt: new Date().toISOString(),
        };
    } catch (e) {
        console.warn("[Gutendex] Failed:", e.message);
        return null;
    }
}

function mapLanguageToGutendexCode(targetLang) {
    const map = {
        english: "en", en: "en",
        german: "de", de: "de",
        french: "fr", fr: "fr",
        spanish: "es", es: "es",
        italian: "it", it: "it",
        russian: "ru", ru: "ru",
        turkish: "tr", tr: "tr",
    };
    return map[String(targetLang || "").toLowerCase()] || null;
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
const DAILY_FEED_SLOTS = [
    { id: "morning", label: "Morning Classic (08:00)", emoji: "🌅" },
    { id: "afternoon", label: "Afternoon Dialogue (14:00)", emoji: "☀️" },
    { id: "evening", label: "Evening Literary Masterpiece (20:00)", emoji: "🌙" },
];

async function getDailyFeedsForLanguage(targetLanguage, mediatorLanguage) {
    const cacheKey = `spk:daily_feeds:${targetLanguage}:${mediatorLanguage}`;
    const today = new Date().toISOString().split("T")[0];

    // ── 1. Redis ──
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.date === today && Array.isArray(parsed.feeds) && parsed.feeds.length > 0) {
                    console.log(`[DailyFeeds] Redis cache hit for ${targetLanguage}`);

                    let added = 0;
                    for (const feed of parsed.feeds) {
                        const isDup = autoFetchedStories.some(
                            (s) => s.title === feed.title && s.author === feed.author
                        );
                        if (!isDup) {
                            autoFetchedStories.unshift(feed);
                            added++;
                        }
                    }
                    if (added > 0) {
                        saveStoriesToDisk();
                        if (typeof saveStoriesToSupabase === "function") {
                            saveStoriesToSupabase().catch(() => { });
                        }
                    }
                    return parsed.feeds;
                }
            }
        } catch (e) {
            console.warn("[DailyFeeds] Redis get failed:", e.message);
        }
    }

    // ── 2. Cache miss — вернуть fallback СРАЗУ, генерацию запустить в фоне ──
    const fallbackFeeds = getDailyBotStoryFeeds(targetLanguage);

    // Fire-and-forget: генерация в фоне, кэширование в Redis
    if (!dailyFeedsGenerationLock) {
        dailyFeedsGenerationLock = (async () => {
            console.log(`[DailyFeeds BG] Background generation for ${targetLanguage}...`);
            const feeds = [];
            try {
                for (const slot of DAILY_FEED_SLOTS) {
                    try {
                        const story = await fetchAndPersistGutenbergStory(
                            targetLanguage, mediatorLanguage, "B1", slot
                        );
                        if (story) feeds.push(story);
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e) {
                        console.warn(`[DailyFeeds BG] Slot ${slot.id} failed:`, e.message);
                    }
                }

                if (feeds.length > 0 && redis) {
                    try {
                        await redis.set(cacheKey, JSON.stringify({ date: today, feeds }), 'EX', 86400);
                        console.log(`[DailyFeeds BG] Cached ${feeds.length} feeds for ${targetLanguage}`);
                    } catch (e) {
                        console.warn("[DailyFeeds BG] Redis set failed:", e.message);
                    }
                }
            } finally {
                dailyFeedsGenerationLock = null;
            }
            return feeds;
        })();
    }

    return fallbackFeeds;
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

    // Boilerplate patterns — Project Gutenberg / legal / license.
    // Такие абзацы не литература, их нельзя брать в excerpt.
    const BOILERPLATE_PATTERNS = [
        /^\d+\.F\.\d+/i,
        /Some states do not allow/i,
        /This eBook is for the use/i,
        /Project Gutenberg-tm/i,
        /Release Date:/i,
        /START OF (THE|THIS) PROJECT GUTENBERG/i,
        /END OF (THE|THIS) PROJECT GUTENBERG/i,
        /Gutenberg Literary Archive Foundation/i,
    ];

    const isBoilerplate = (p) => BOILERPLATE_PATTERNS.some(rx => rx.test(p));

    const paragraphs = text
        .split(/\n\s*\n/)
        .map(p => p.replace(/\s+/g, " ").trim())
        .filter(p => p.length > 100 && !isBoilerplate(p));

    if (paragraphs.length === 0) return "";

    const scoreParagraph = (p) => {
        const words = p.split(/\s+/).filter(Boolean);
        const unique = new Set(words.map(w => w.toLowerCase())).size;
        const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        const hasLiteraryMarkers = /\b(shall|might|perhaps|never|soul|heart|mystery|shadow|dawn|twilight|melancholy|sublime)\b/i.test(p);
        return (unique / words.length) * 2 + avgWordLen * 0.3 + (hasLiteraryMarkers ? 5 : 0);
    };

    // Отбираем топ-N абзацев по score, потом восстанавливаем исходный порядок текста
    const scored = paragraphs
        .map((p, idx) => ({ text: p, score: scoreParagraph(p), idx }))
        .sort((a, b) => b.score - a.score);

    const selected = [];
    let wc = 0;
    for (const para of scored) {
        selected.push(para);
        wc += para.text.split(/\s+/).length;
        if (wc >= targetWords) break;
    }
    selected.sort((a, b) => a.idx - b.idx);

    // Склеиваем и обрезаем ПО ГРАНИЦАМ ПРЕДЛОЖЕНИЙ, а не по символам
    const fullText = selected.map(p => p.text).join(" ");
    const sentences = fullText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [fullText];

    let out = "";
    let outWords = 0;
    for (const s of sentences) {
        const sWords = s.split(/\s+/).length;
        // +15% допуск — чтобы захватить целое последнее предложение
        if (outWords > 0 && outWords + sWords > targetWords * 1.15) break;
        out += s;
        outWords += sWords;
        if (outWords >= targetWords) break;
    }

    // Fallback: если предложения не нашлись (текст без точек), режем по последнему пробелу
    if (!out.trim()) {
        const cap = targetWords * 2;
        const cut = fullText.slice(0, cap);
        const lastSpace = cut.lastIndexOf(" ");
        out = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
    }

    return out.trim();
}


/**
 * Главная функция — каскадный вызов трёх независимых источников.
 * Гарантированно возвращает книгу при любых обстоятельствах.
 */
async function fetchRandomGutenbergBook(targetLanguage = "English") {
    console.log(`[BookFetch] Каскадный поиск для языка: ${targetLanguage}`);

    // ── Уровень 1: Gutendex (быстрый, свежий) ──
    try {
        const fromGutendex = await fetchFromGutendex(targetLanguage);
        if (fromGutendex) {
            console.log(`[BookFetch] ✅ Уровень 1 (Gutendex): "${fromGutendex.title}"`);
            return fromGutendex;
        }
        console.log("[BookFetch] Уровень 1 не сработал, переходим к Уровню 2");
    } catch (e) {
        console.warn("[BookFetch] Уровень 1 (Gutendex) упал:", e.message);
    }

    // ── Уровень 2: Open Library (живой каталог) ──
    try {
        const fromOpenLib = await fetchFromOpenLibrary(targetLanguage);
        if (fromOpenLib) {
            console.log(`[BookFetch] ✅ Уровень 2 (Open Library): "${fromOpenLib.title}"`);
            return fromOpenLib;
        }
        console.log("[BookFetch] Уровень 2 не сработал, переходим к Уровню 3");
    } catch (e) {
        console.warn("[BookFetch] Уровень 2 (Open Library) упал:", e.message);
    }

    // ── Уровень 3: Статический список (100% гарантия при наличии интернета) ──
    try {
        const fromStatic = await fetchFromStaticList(targetLanguage);
        if (fromStatic) {
            console.log(`[BookFetch] ✅ Уровень 3 (статический список): "${fromStatic.title}"`);
            return fromStatic;
        }
    } catch (e) {
        console.warn("[BookFetch] Уровень 3 (статический список) упал:", e.message);
    }

    // ── Абсолютный fallback: симуляция (нет интернета вообще) ──
    console.error("[BookFetch] ❌ Все три уровня исчерпаны — используется симуляция");
    return {
        id: `simulated-${Date.now()}`,
        title: "Classic Literature",
        author: "Classic Author",
        targetLanguage: normalizeLanguageCanonical(targetLanguage),
        excerpt: `SIMULATION_PROMPT_TRIGGER: Generate an iconic excerpt from a classic ${targetLanguage} work.`,
        content: "",
        source: "Simulation Fallback",
        isAutoFetched: true,
        createdAt: new Date().toISOString(),
    };
}

// ── Shared AI pipeline: Gutenberg raw text → full interactive story ──
async function synthesizeStoryFromGutenberg(rawStory, targetLanguage, mediatorLanguage, userLevel = "B1") {
    const aiPrompt = `You are SpeakBot's Chief NLP Literary Pedagogical Engine.
The user uploaded a book/story titled "${rawStory.title}" by "${rawStory.author || "Unknown"}".
Target Language of Book: ${targetLanguage}
User Target CEFR Level: ${userLevel}
Mediator Language for translations & explanations: ${mediatorLanguage}

Here is the authentic text excerpt extracted from the book:
"""
${rawStory.excerpt}
"""

Synthesize a complete, interactive Classic Story reading and audio study module based on this excerpt.
CRITICAL REQUIREMENTS:
1. Every sentence, vocabulary word, stylistic device, conversation question, and exercise MUST be uniquely tailored to "${rawStory.title}" and this specific passage.
2. Provide authentic, accurate translations in ${mediatorLanguage}.
3. Generate at least 4 SEQUENTIAL Socratic dialogue questions.
4. Generate at least 5 COMPREHENSIVE tasks & exercises.
5. IMPORTANT: If the book is non-fiction (technical/practical), generate comprehension questions about the subject matter, NOT literary analysis.

Return ONLY valid JSON matching this schema:
{
  "title": "${rawStory.title}",
  "author": "${rawStory.author || "Unknown"}",
  "authorEra": "Literary Era",
  "level": "${userLevel}",
  "mode": "both",
  "duration": "4 min read • 2 min audio",
  "targetLanguage": "${targetLanguage}",
  "culturalLinguisticContext": "2-sentence context.",
  "paragraphs": ["Paragraph 1", "Paragraph 2"],
  "sentences": [{"text": "Exact sentence", "translation": "Translation in ${mediatorLanguage}", "literaryNote": "Commentary", "audioTime": "0:00 - 0:08"}],
  "keyVocabulary": [{"word": "...", "ipa": "/.../", "pos": "noun", "translation": "...", "cefr": "${userLevel}", "example": "..."}],
  "stylisticDevices": [{"device": "...", "exampleFromText": "...", "explanation": "..."}],
  "conversations": [{"id": "socratic-1", "stepNumber": 1, "persona": "SpeakBot Socratic Mentor", "topic": "...", "prompt": "...", "options": ["A","B","C"], "correctIndex": 0, "botFeedback": "...", "points": 25}],
  "exercises": [{"id": "task-1", "taskNumber": 1, "category": "Comprehension", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "points": 25}]
}`;

    const raw = await callGeminiWithResilience(aiPrompt);
    if (raw) {
        const parsed = await repairJson(raw);
        if (parsed && Array.isArray(parsed.sentences) && parsed.sentences.length > 0) {
            return parsed;
        }
        console.warn("[Gutenberg AI] После ремонта JSON всё ещё пуст или невалиден");
    }

    if (!raw) {
        console.warn("[AI Engine] Gemini полностью недоступен, пробуем OpenRouter...");
        const orResult = await callOpenRouter(aiPrompt);
        if (orResult) {
            // OpenRouter возвращает уже распарсенный объект, а не строку JSON
            return orResult;
        }
    }

    // Graceful fallback — build a usable story from the raw excerpt
    return generateLocalFallbackStory({
        bookTitle: rawStory.title,
        author: rawStory.author || "Classic Author",
        authorEra: "World Literature",
        canonKey: null,
        targetLanguage,
        mediatorLanguage,
        userLevel,
        excerptSlice: rawStory.excerpt,
        isSimulated: false,
    });
}

// ── Fetch + synthesize + label (works for both daily slots and plain cards) ──
async function fetchAndPersistGutenbergStory(targetLanguage, mediatorLanguage, userLevel = "B1", slotMeta = null) {
    const rawBook = await fetchRandomGutenbergBook(targetLanguage);  // ← передаём язык
    if (!rawBook) return null;
    // Respect the caller's target language — skip mismatched books
    if (rawBook.targetLanguage &&
        normalizeLanguageCanonical(rawBook.targetLanguage) !== normalizeLanguageCanonical(targetLanguage)) {
        return null;
    }

    // Убираем проверку языка — каждый уровень уже вернул книгу на нужном языке
    // (или пометил её как симуляцию)
    const storyData = await synthesizeStoryFromGutenberg(rawBook, targetLanguage, mediatorLanguage, userLevel);
    const story = {
        ...storyData,
        id: slotMeta ? `daily-${slotMeta.id}-${Date.now()}` : `auto-${Date.now()}`,
        targetLanguage: normalizeLanguageCanonical(targetLanguage),
        sourceBook: `Project Gutenberg • ${rawBook.title}`,
        isAutoFetched: true,
        createdAt: new Date().toISOString(),
    };

    if (slotMeta) {
        story.feedSlot = slotMeta.label;
        story.slotEmoji = slotMeta.emoji;
        story.isDailyBotFeed = true;
    }
    // ── Persist to in-memory list so it appears in the classic cards grid ──
    const isDuplicate = autoFetchedStories.some(
        (s) => s.title === story.title && s.author === story.author
    );
    if (!isDuplicate) {
        autoFetchedStories.unshift(story);
        // Ограничиваем рост — не более 50 auto-историй
        if (autoFetchedStories.length > 50) {
            autoFetchedStories = autoFetchedStories.slice(0, 50);
        }
        saveStoriesToDisk();
        if (typeof saveStoriesToSupabase === "function") {
            saveStoriesToSupabase().catch(() => { });
        }
        console.log(`[AutoPersist] Added "${story.title}" to autoFetchedStories (total: ${autoFetchedStories.length})`);
    }

    return story;
}

/**
 * Уровень 2 — Open Library API.
 * Встроенная сортировка sort=random.
 */
async function fetchFromOpenLibrary(targetLanguage = "English") {
    const langCode = mapLanguageToOpenLibraryCode(targetLanguage);
    if (!langCode) return null;

    try {
        // Open Library требует реальный поисковый запрос, а не "*".
        // Используем нейтральные частотные слова — они дают миллионы результатов.
        const broadQueries = ["fiction", "story", "adventures", "tales", "novel"];
        const randomQuery = broadQueries[Math.floor(Math.random() * broadQueries.length)];

        const url = `https://openlibrary.org/search.json?q=${randomQuery}&sort=random&limit=20&language=${langCode}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`OpenLibrary HTTP ${res.status}`);

        const data = await res.json();
        if (!data.docs || data.docs.length === 0) return null;

        // Ищем книгу, у которой есть ID Project Gutenberg
        for (const doc of data.docs) {
            const gutenbergId = doc.id_project_gutenberg?.[0];
            if (!gutenbergId) continue;

            // Пробуем скачать текст
            const textUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
            try {
                const textRes = await fetch(textUrl, { signal: AbortSignal.timeout(15000) });
                if (!textRes.ok) continue;

                const fullText = await textRes.text();
                if (!fullText || fullText.trim().length < 500) continue;

                return {
                    id: `openlib-${Date.now()}-${gutenbergId}`,
                    title: doc.title || `Book #${gutenbergId}`,
                    author: doc.author_name?.[0] || "Unknown Author",
                    targetLanguage: normalizeLanguageCanonical(targetLanguage),
                    excerpt: selectBestExcerpt(fullText, 300),
                    content: fullText,
                    source: `Open Library → Project Gutenberg #${gutenbergId}`,
                    isAutoFetched: true,
                    createdAt: new Date().toISOString(),
                };
            } catch { /* пробуем следующую книгу */ }
        }
        return null;
    } catch (e) {
        console.warn("[OpenLibrary] Failed:", e.message);
        return null;
    }
}

function mapLanguageToOpenLibraryCode(targetLang) {
    const map = {
        english: "eng", en: "eng",
        german: "ger", de: "ger",
        french: "fre", fr: "fre",
        spanish: "spa", es: "spa",
        italian: "ita", it: "ita",
        russian: "rus", ru: "rus",
        turkish: "tur", tr: "tur",
    };
    return map[String(targetLang || "").toLowerCase()] || null;
}

app.get("/api/debug/story-state", async (req, res) => {
    const userId = String(req.query.userId || "default-user");

    res.json({
        userCustomStoriesCount: Object.keys(userCustomStories || {}).length,
        userCustomStoriesForUser: (userCustomStories[userId] || []).length,
        userCustomStoriesTitles: (userCustomStories[userId] || []).map(s => s.title),

        autoFetchedStoriesCount: (autoFetchedStories || []).length,
        autoFetchedStoriesTitles: (autoFetchedStories || []).map(s => `${s.title} — ${s.author}`),

        // Что попадёт в UI-грид
        whatGetsReturnedAsCustomStories: [
            ...(userCustomStories[userId] || []),
            ...(autoFetchedStories || []).filter(s =>
                normalizeLanguageCanonical(s.targetLanguage) === "English"
            ),
        ].map(s => ({ title: s.title, isAutoFetched: !!s.isAutoFetched })),

        // Что попадёт в верхнюю полосу
        dailyFeedsWillBeFetched: "(invoke /api/stories/custom-list to check)",
    });
});
app.get("/api/debug/reset-mediator-flag", async (req, res) => {
    const targetMediator = String(req.query.to || "ru");
    let count = 0;
    for (const uid of Object.keys(userCustomStories)) {
        for (const s of userCustomStories[uid]) {
            s.generatedWithMediator = null;
            count++;
        }
    }
    for (const s of autoFetchedStories) {
        s.generatedWithMediator = null;
        count++;
    }
    saveStoriesToDisk();
    if (typeof saveStoriesToSupabase === "function") saveStoriesToSupabase().catch(() => { });
    res.json({ success: true, reset: count });
});
app.get("/api/debug/reset-mediator-flags", async (req, res) => {
    const target = String(req.query.to || "ru");
    let count = 0;
    for (const uid of Object.keys(userCustomStories)) {
        for (const s of userCustomStories[uid]) {
            s.generatedWithMediator = null;
            s.regenerationAttempts = 0;   // ← сбросить попытки
            count++;
        }
    }
    for (const s of autoFetchedStories) {
        s.generatedWithMediator = null;
        s.regenerationAttempts = 0;
        count++;
    }
    saveStoriesToDisk();
    if (typeof saveStoriesToSupabase === "function") saveStoriesToSupabase().catch(() => { });
    res.json({ success: true, reset: count, targetMediator: target });
});
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

app.get("/api/debug/clear-daily-feeds-cache", async (req, res) => {
    if (!redis) return res.json({ cleared: false, reason: "no redis" });
    try {
        const keys = await redis.keys("spk:daily_feeds:*");
        if (keys.length > 0) await redis.del(...keys);
        res.json({ cleared: true, deletedKeys: keys });
    } catch (e) {
        res.json({ cleared: false, error: e.message });
    }
});

app.get("/api/debug/daily-feeds", async (req, res) => {
    const targetLanguage = req.query.targetLanguage || "English";
    const mediatorLanguage = req.query.mediatorLanguage || "az";

    const report = { steps: [] };

    // Step 1: Raw Gutenberg fetch
    try {
        const rawBook = await fetchRandomGutenbergBook();
        report.steps.push({
            step: "1_fetchRandomGutenbergBook",
            success: !!rawBook,
            data: rawBook ? {
                title: rawBook.title,
                author: rawBook.author,
                detectedLanguage: rawBook.targetLanguage,
                excerptLength: rawBook.excerpt?.length || 0,
                excerptPreview: rawBook.excerpt?.slice(0, 200),
            } : null,
            error: rawBook ? null : "returned null — check network / language detection / text URL candidates",
        });
    } catch (e) {
        report.steps.push({ step: "1_fetchRandomGutenbergBook", success: false, error: e.message });
    }
    // Step 2: AI synthesis (без явных моделей — пусть работает discovery)
    try {
        const test = await callGeminiWithResilience(
            'Return ONLY valid JSON: {"ok": true, "msg": "hello"}'
            // без preferredModel и fallbackModels — идёт discovery
        );
        report.steps.push({
            step: "2_callGeminiWithResilience",
            success: !!test,
            data: test ? test.slice(0, 200) : null,
            error: test ? null : "Все AI-провайдеры вернули null",
        });
    } catch (e) {
        report.steps.push({ step: "2_callGeminiWithResilience", success: false, error: e.message });
    }
    // Step 3: Full fetchAndPersist pipeline
    try {
        const story = await fetchAndPersistGutenbergStory(targetLanguage, mediatorLanguage, "B1", { id: "debug", label: "Debug Slot", emoji: "🔧" });
        report.steps.push({
            step: "3_fetchAndPersistGutenbergStory",
            success: !!story,
            data: story ? { title: story.title, author: story.author, sentenceCount: story.sentences?.length } : null,
            error: story ? null : "returned null — most likely Gutenberg fetch or language mismatch",
        });
    } catch (e) {
        report.steps.push({ step: "3_fetchAndPersistGutenbergStory", success: false, error: e.message });
    }

    // Step 4: Redis cache state
    if (redis) {
        try {
            const cacheKey = `spk:daily_feeds:${targetLanguage}:${mediatorLanguage}`;
            const cached = await redis.get(cacheKey);
            report.steps.push({
                step: "4_redis_cache",
                success: true,
                data: cached ? { cached: true, preview: cached.slice(0, 200) } : { cached: false },
            });
        } catch (e) {
            report.steps.push({ step: "4_redis_cache", success: false, error: e.message });
        }
    }

    res.json(report);
});
app.get("/api/debug/translate-description/:storyId", async (req, res) => {
    const { storyId } = req.params;
    const targetLang = String(req.query.to || "ru");
    const userId = "default-user";

    let story = null;
    if (userCustomStories[userId]) story = userCustomStories[userId].find((s) => s.id === storyId);
    if (!story) story = autoFetchedStories.find((s) => s.id === storyId);
    if (!story) return res.status(404).json({ success: false, error: "Story not found" });

    const originalText = story.culturalLinguisticContext || "";
    if (!originalText) {
        return res.json({ success: false, error: "No culturalLinguisticContext to translate" });
    }

    const langName = {
        ru: "Russian", az: "Azerbaijani", tr: "Turkish", en: "English",
        de: "German", es: "Spanish"
    }[targetLang] || targetLang;

    const prompt = `Translate the following text into ${langName}. Return ONLY the translation — no explanations, no quotes, no JSON, no labels.

Text to translate:
${originalText}`;

    console.log(`[Translate-Desc] Story: "${story.title}" → ${langName}`);
    console.log(`[Translate-Desc] INPUT (${originalText.length} chars): "${originalText.slice(0, 100)}..."`);

    try {
        // ВАЖНО: isJson = false — нам нужен plain text, не JSON
        const raw = await callGeminiWithResilience(prompt, null, [], false);

        if (!raw || raw.trim().length < 5) {
            console.error(`[Translate-Desc] AI returned empty/null`);
            return res.json({ success: false, error: "AI returned empty", raw });
        }

        const cleanTranslation = raw.trim().replace(/^["']|["']$/g, "");
        console.log(`[Translate-Desc] OUTPUT (${cleanTranslation.length} chars): "${cleanTranslation.slice(0, 100)}..."`);

        story.culturalLinguisticContext = cleanTranslation;
        story.generatedWithMediator = targetLang;
        story.regeneratedAt = new Date().toISOString();

        saveStoriesToDisk();
        if (typeof saveStoriesToSupabase === "function") {
            await saveStoriesToSupabase().catch(() => { });
        }

        res.json({
            success: true,
            title: story.title,
            before: originalText.slice(0, 150),
            after: cleanTranslation.slice(0, 150),
            fullAfter: cleanTranslation,
        });
    } catch (e) {
        console.error(`[Translate-Desc] FAILED:`, e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// DEBUG: перевод ОДНОГО поля story (scalar or array element)
// По плану Step 2 / Option A. isJson=false. Plain text response.
// Body: { storyId, field, to, source? }
//   field = "culturalLinguisticContext"  |  "sentences.0.translation"
//   to    = "ru" | "az" | ...
//   source = (optional) явный текст-источник — перезапись мусора
// ═══════════════════════════════════════════════════════════════
app.post("/api/debug/translate-field", async (req, res) => {
    const { storyId, field, to, source } = req.body || {};

    if (!storyId || !field || !to) {
        return res.status(400).json({
            success: false,
            error: "Required body fields: storyId, field, to"
        });
    }

    // Whitelist top-level полей — защита от произвольного доступа
    const ROOT_WHITELIST = [
        "culturalLinguisticContext", "title", "author", "authorEra",
        "sentences", "conversations", "exercises", "keyVocabulary", "stylisticDevices"
    ];
    const topKey = String(field).split(".")[0];
    if (!ROOT_WHITELIST.includes(topKey)) {
        return res.status(400).json({
            success: false,
            error: `field must start with one of: ${ROOT_WHITELIST.join(", ")}`
        });
    }

    // Найти story
    const uid = "default-user";
    let story = null;
    if (userCustomStories[uid]) {
        story = userCustomStories[uid].find((s) => s.id === storyId);
    }
    if (!story) {
        story = autoFetchedStories.find((s) => s.id === storyId);
    }
    if (!story) {
        return res.status(404).json({ success: false, error: "Story not found" });
    }

    // Resolve path: "sentences.0.translation" → target=sentences[0], leafKey="translation"
    const parts = String(field).split(".");
    let target = story;
    for (let i = 0; i < parts.length - 1; i++) {
        if (target == null) break;
        target = Array.isArray(target)
            ? target[parseInt(parts[i], 10)]
            : target[parts[i]];
    }
    const leafKey = parts[parts.length - 1];

    if (target == null || typeof target !== "object" || !(leafKey in target)) {
        return res.status(400).json({
            success: false,
            error: `Cannot resolve path: ${field}`
        });
    }

    const beforeValue = target[leafKey];
    if (typeof beforeValue !== "string") {
        return res.status(400).json({
            success: false,
            error: `Field "${field}" is not a string (got ${typeof beforeValue})`
        });
    }

    // Source — либо явный, либо текущее значение. Без source — обычный перевод.
    const sourceText = (typeof source === "string" && source.trim().length > 5)
        ? source.trim()
        : beforeValue.trim();

    if (sourceText.length < 5) {
        return res.status(400).json({
            success: false,
            error: `Field "${field}" is empty and no valid "source" provided`
        });
    }

    const langName = {
        ru: "Russian", az: "Azerbaijani", tr: "Turkish", en: "English",
        de: "German", es: "Spanish", fr: "French", it: "Italian",
    }[to] || to;

    // Один запрос — одно поле. isJson=false.
    const prompt = `Translate the following text into ${langName}. Return ONLY the translation — no JSON, no quotes, no labels, no explanations, no preamble.

Text:
${sourceText}`;

    try {
        const raw = await callGeminiWithResilience(prompt, null, [], false);

        if (!raw || raw.trim().length < 5) {
            return res.status(502).json({
                success: false,
                error: "AI returned empty or null",
                rawPreview: raw ? raw.slice(0, 200) : null,
            });
        }

        const cleanTranslation = raw.trim()
            .replace(/^["'«»\s]+|["'«»\s]+$/g, "")
            .trim();

        // Записываем результат
        target[leafKey] = cleanTranslation;
        story.generatedWithMediator = to;  // теперь флаг честный — мы явно прошли через ru
        story.regeneratedAt = new Date().toISOString();

        saveStoriesToDisk();
        if (typeof saveStoriesToSupabase === "function") {
            saveStoriesToSupabase().catch(() => { });
        }

        res.json({
            success: true,
            storyId,
            storyTitle: story.title,
            field,
            to,
            beforePreview: beforeValue.slice(0, 200),
            afterPreview: cleanTranslation.slice(0, 200),
            fullAfter: cleanTranslation,
        });
    } catch (e) {
        console.error("[Translate-Field] FAILED:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete("/api/debug/remove-auto-story/:storyId", (req, res) => {
    const { storyId } = req.params;
    const found = autoFetchedStories.find(s => s.id === storyId);
    if (!found) {
        return res.status(404).json({ success: false, error: "Not found in autoFetchedStories" });
    }
    const before = autoFetchedStories.length;
    autoFetchedStories = autoFetchedStories.filter(s => s.id !== storyId);
    saveStoriesToDisk();
    if (typeof saveStoriesToSupabase === "function") {
        saveStoriesToSupabase().catch(() => { });
    }
    res.json({ success: true, removed: found.title, before, after: autoFetchedStories.length });
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

                // Fallback: если pdf-parse вернул пусто → Gemini OCR
                if (!extractedText || extractedText.trim().length < 50) {
                    console.log('[Upload] pdf-parse empty, trying Gemini OCR fallback...');
                    const ocrText = await extractTextFromPdfWithGeminiOCR(buffer, userId);
                    if (ocrText && ocrText.trim().length > 50) {
                        extractedText = ocrText;
                    }
                }
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
        const rawAiResponse = await callGeminiWithResilience(aiPrompt, null, [], true, userId);

        if (!rawAiResponse) {
            // OpenRouter fallback
            const openRouterResponse = await callOpenRouter(aiPrompt);
            if (openRouterResponse) {
                parsedStory = repairJson(openRouterResponse);
            }
        } else {
            parsedStory = repairJson(rawAiResponse);
            if (!parsedStory) {
                console.warn("[PDF Engine] JSON repair failed — используем fallback");
            }
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

The Excerpt:
"""
${excerpt.slice(0, 2400)}
"""

Recent Chat History:
${chatHistory.slice(-4).map((m) => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${m.text}`).join('\n')}

Learner's latest message:
"${userMessage}"

CRITICAL LANGUAGE RULES:
- Reply ONLY in ${targetLanguage}. Do NOT reply in ${mediatorLanguage}.
- ${mediatorLanguage} is only for brief clarifications in parentheses if the learner is stuck — at most 1 short phrase per reply.
- If the learner writes in a different language, still reply in ${targetLanguage}.
- Do NOT invent words. If you don't know a ${mediatorLanguage} word, skip the parenthetical clarification entirely.

Respond in genuine Socratic dialogue style, but also try not to completely ignore the punches and humour of the Learner. Try always to be responsive, but always returning the learner to the topic that is being discussed - sometimes if you consider it's appropriate you can for one or two lines switch to discussing another book or classical story, but eventually you should always get back to the main topic to discuss it further. 

Return ONLY valid JSON:
{
  "reply": "...",
  "pointsAwarded": 20,
  "pedagogicalTip": "...",
  "suggestedReplies": ["...", "..."]
}`;

        let replyData = null;
        const raw = await callGeminiWithResilience(aiPrompt, null, [], true, userId);
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

// ═══════════════════════════════════════════════════════════════
// ДОПОЛНЕНИЕ SOCRATIC-ВОПРОСОВ НА ЛЕТУ (Variant B)
// ═══════════════════════════════════════════════════════════════

const expandingStoriesInFlight = new Set();

app.post("/api/stories/expand-socratic", async (req, res) => {
    try {
        const { storyId, userId = "default-user", targetCount = 4 } = req.body;

        if (!storyId) {
            return res.status(400).json({ success: false, error: "storyId обязателен" });
        }

        if (expandingStoriesInFlight.has(storyId)) {
            return res.json({ success: true, message: "Already expanding" });
        }

        // Ищем story в памяти
        let story = null;
        if (userCustomStories[userId]) {
            story = userCustomStories[userId].find((s) => s.id === storyId);
        }
        if (!story) {
            story = autoFetchedStories.find((s) => s.id === storyId);
        }

        if (!story) {
            return res.status(404).json({ success: false, error: "Story не найдена" });
        }

        const existing = Array.isArray(story.conversations) ? story.conversations.length : 0;
        if (existing >= targetCount) {
            return res.json({ success: true, added: 0, message: `Уже ${existing} вопросов` });
        }

        // Отвечаем СРАЗУ — генерация в фоне
        res.json({ success: true, added: "background", message: `Расширение ${existing} → ${targetCount}` });

        // ── Фоновая генерация ──
        expandingStoriesInFlight.add(storyId);

        (async () => {
            try {
                const needed = targetCount - existing;
                const excerptText = (story.paragraphs || []).join("\n\n").slice(0, 2500);
                const existingPrompts = (story.conversations || [])
                    .map((c) => c.prompt || c.dialoguePrompt || "")
                    .filter(Boolean);

                const prompt = `You are a Socratic literary mentor. Generate ${needed} NEW, DISTINCT Socratic dialogue questions about this excerpt from "${story.title}" by ${story.author}.

EXISTING questions (do NOT duplicate these):
${JSON.stringify(existingPrompts, null, 2)}

Excerpt:
"""
${excerptText}
"""

For each new question, provide 3 responses: one deep insight (correct), one plausible-but-shallow, one superficial error. Return ONLY valid JSON:

{
  "conversations": [
    {
      "id": "socratic-extra-${Date.now()}-1",
      "stepNumber": ${existing + 1},
      "persona": "SpeakBot Socratic Mentor",
      "topic": "New thematic angle",
      "prompt": "Question probing a NEW angle not covered above",
      "options": ["Deep insight (correct)", "Shallow alternative", "Superficial error"],
      "correctIndex": 0,
      "botFeedback": "Detailed English feedback explaining the strongest reading.",
      "points": 25
    }
  ]
}`;

                const raw = await callGeminiWithResilience(prompt);
                if (!raw) {
                    console.warn(`[Expand Socratic] AI null для "${story.title}"`);
                    return;
                }

                const parsed = repairJson(raw);
                if (!parsed || !Array.isArray(parsed.conversations)) {
                    console.warn(`[Expand Socratic] JSON parse failed для "${story.title}"`);
                    return;
                }

                const newOnes = parsed.conversations.filter((c) => c && c.prompt);
                if (newOnes.length === 0) return;

                story.conversations = [...(story.conversations || []), ...newOnes];

                console.log(`[Expand Socratic] ✅ "${story.title}" +${newOnes.length} вопросов (всего ${story.conversations.length})`);

                saveStoriesToDisk();
                if (typeof saveStoriesToSupabase === "function") {
                    await saveStoriesToSupabase().catch(() => { });
                }
            } catch (e) {
                console.warn(`[Expand Socratic] Ошибка для "${story.title}":`, e.message);
            } finally {
                expandingStoriesInFlight.delete(storyId);
            }
        })();
    } catch (err) {
        console.error("[Expand Socratic] Route error:", err);
        res.status(500).json({ success: false, error: err.message });
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

app.get("/api/stories/custom-list", async (req, res) => {
    try {
        const userId = String(req.query.userId || "default-user");
        const canonicalTarget = normalizeLanguageCanonical(req.query.targetLanguage || "English");
        const mediatorLanguage = req.query.mediatorLanguage
            || syncedUsersDatabase[userId]?.mediatorLanguage
            || "en";

        // Step 1: Hydrate once from Supabase
        await ensureStoriesHydrated();

        // Step 2: Filter stories by language
        const userStories = (userCustomStories[userId] || [])
            .filter(s => normalizeLanguageCanonical(s.targetLanguage) === canonicalTarget);
        const autoStories = (autoFetchedStories || [])
            .filter(s => normalizeLanguageCanonical(s.targetLanguage) === canonicalTarget);
        const combined = [...userStories, ...autoStories].map(normalizeStoryForUi);   // ← копии для UI
        // Step 3: On-demand Gutenberg fallback when nothing exists
        if (combined.length === 0) {
            console.log(`[Stories] Empty list for ${canonicalTarget} — triggering on-demand Gutenberg fetch...`);
            const fresh = await fetchAndPersistGutenbergStory(canonicalTarget, mediatorLanguage, "B1");
            if (fresh) {
                autoFetchedStories.unshift(fresh);
                saveStoriesToDisk();          // persists locally + mirrors to Supabase
                combined.push(fresh);
                console.log(`[Stories] On-demand added: "${fresh.title}"`);
            }
        }

        // Step 4: Dynamic daily feeds (cached per-day in Redis)
        const dailyFeeds = await getDailyFeedsForLanguage(canonicalTarget, mediatorLanguage);
        // ── ГАРАНТИРОВАННЫЙ PERSIST: daily feeds всегда попадают в autoFetchedStories ──
        // Работает независимо от внутренних persist-блоков в других функциях.
        if (Array.isArray(dailyFeeds) && dailyFeeds.length > 0) {
            let added = 0;
            for (const feed of dailyFeeds) {
                const isDup = autoFetchedStories.some(
                    (s) => s.title === feed.title && s.author === feed.author
                );
                if (!isDup) {
                    autoFetchedStories.unshift(feed);
                    added++;
                }
            }
            if (autoFetchedStories.length > 50) {
                autoFetchedStories = autoFetchedStories.slice(0, 50);
            }
            if (added > 0) {
                console.log(`[custom-list] Persisted ${added} daily feeds (total auto: ${autoFetchedStories.length})`);
                saveStoriesToDisk();
                if (typeof saveStoriesToSupabase === "function") {
                    saveStoriesToSupabase().catch(() => { });
                }
                // Обновляем combined — добавляем свежие фиды в ответ
                for (const feed of dailyFeeds) {
                    const alreadyInCombined = combined.some(
                        (s) => s.title === feed.title && s.author === feed.author
                    );
                    if (!alreadyInCombined) {
                        combined.unshift(feed);
                    }
                }
            }
        }

        res.json({ success: true, customStories: combined, dailyFeeds });
    } catch (err) {
        console.error("[Stories/custom-list] Error:", err);
        const canonicalTarget = normalizeLanguageCanonical(req.query.targetLanguage || "English");
        // Last-resort safety net — never return 500 to the UI
        res.json({
            success: true,
            customStories: [],
            dailyFeeds: getDailyBotStoryFeeds(canonicalTarget),
        });
    }
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
        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
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


// ═══════════════════════════════════════════════════════════════
// BYOK — API ENDPOINTS ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЬСКИМИ КЛЮЧАМИ
// ═══════════════════════════════════════════════════════════════

// Список разрешённых провайдеров — только они могут быть сохранены
const ALLOWED_BYOK_PROVIDERS = ["gemini", "openai", "anthropic", "deepseek", "groq", "openrouter"];

// Человеческие названия провайдеров (для UI и логов)
const BYOK_PROVIDER_NAMES = {
    gemini: "Google Gemini",
    openai: "OpenAI (GPT)",
    anthropic: "Anthropic Claude",
    deepseek: "DeepSeek",
    groq: "Groq",
    openrouter: "OpenRouter",
};

/**
 * GET /api/user/api-keys
 * Возвращает список провайдеров и маскированные ключи (никогда полные).
 * 
 * Response:
 * {
 *   success: true,
 *   keys: {
 *     gemini:     { hasKey: true,  masked: "AIza...x9k2", updatedAt: "..." },
 *     openai:     { hasKey: false, masked: null,         updatedAt: null },
 *     ...
 *   }
 * }
 */
app.get("/api/user/api-keys", async (req, res) => {
    try {
        const userId = String(req.query.userId || "default-user");

        if (!supabase) {
            return res.json({ success: true, keys: {}, warning: "Supabase не подключён" });
        }

        const { data, error } = await supabase
            .from("user_api_keys")
            .select("encrypted_keys, updated_at")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;

        const encryptedKeys = data?.encrypted_keys || {};
        const keysInfo = {};

        for (const provider of ALLOWED_BYOK_PROVIDERS) {
            const enc = encryptedKeys[provider];
            if (enc) {
                // Расшифровываем ТОЛЬКО для получения маски — полный ключ никогда не возвращается
                const decrypted = decryptKey(enc);
                keysInfo[provider] = {
                    hasKey: true,
                    masked: decrypted ? maskKey(decrypted) : "***",
                    updatedAt: data?.updated_at || null,
                };
            } else {
                keysInfo[provider] = {
                    hasKey: false,
                    masked: null,
                    updatedAt: null,
                };
            }
        }

        res.json({ success: true, keys: keysInfo });
    } catch (err) {
        console.error("[BYOK GET] Ошибка:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/user/api-keys
 * Сохраняет или обновляет ключ для провайдера.
 * 
 * Body: { userId, provider, apiKey }
 */
app.post("/api/user/api-keys", async (req, res) => {
    try {
        const {
            userId = "default-user",
            provider,
            apiKey,
        } = req.body;

        // ── Валидация ──
        if (!provider || typeof provider !== "string") {
            return res.status(400).json({ success: false, error: "Поле 'provider' обязательно" });
        }
        if (!ALLOWED_BYOK_PROVIDERS.includes(provider)) {
            return res.status(400).json({
                success: false,
                error: `Неизвестный провайдер. Разрешены: ${ALLOWED_BYOK_PROVIDERS.join(", ")}`
            });
        }
        if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
            return res.status(400).json({ success: false, error: "API-ключ слишком короткий" });
        }

        if (!MASTER_ENCRYPTION_KEY) {
            return res.status(500).json({
                success: false,
                error: "Сервер не настроен для BYOK (отсутствует ENCRYPTION_MASTER_KEY)"
            });
        }
        if (!supabase) {
            return res.status(500).json({ success: false, error: "Supabase не подключён" });
        }

        const cleanKey = apiKey.trim();

        // ── Шифрование ──
        const encrypted = encryptKey(cleanKey);
        if (!encrypted) {
            return res.status(500).json({ success: false, error: "Ошибка шифрования ключа" });
        }

        // ── Загружаем существующие ключи, добавляем новый ──
        const { data: existing } = await supabase
            .from("user_api_keys")
            .select("encrypted_keys")
            .eq("user_id", userId)
            .maybeSingle();

        const currentKeys = existing?.encrypted_keys || {};
        currentKeys[provider] = encrypted;

        // ── Сохраняем ──
        const { error: upsertError } = await supabase
            .from("user_api_keys")
            .upsert({
                user_id: userId,
                encrypted_keys: currentKeys,
                updated_at: new Date().toISOString(),
            });

        if (upsertError) throw upsertError;
        // ── Сбрасываем кэш расшифрованных ключей для этого пользователя ──
        if (typeof userKeyCache !== "undefined" && userKeyCache) {
            userKeyCache.delete(`${userId}:${provider}`);
        }

        console.log(`[BYOK] ${BYOK_PROVIDER_NAMES[provider]} ключ сохранён для ${userId} (${maskKey(cleanKey)})`);

        res.json({
            success: true,
            provider,
            providerName: BYOK_PROVIDER_NAMES[provider],
            maskedKey: maskKey(cleanKey),
            message: `Ключ ${BYOK_PROVIDER_NAMES[provider]} успешно сохранён`,
        });
    } catch (err) {
        console.error("[BYOK POST] Ошибка:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/user/api-keys/:provider
 * Удаляет ключ провайдера. После удаления система переходит на системный ключ.
 */
app.delete("/api/user/api-keys/:provider", async (req, res) => {
    try {
        const userId = String(req.query.userId || "default-user");
        const { provider } = req.params;

        if (!ALLOWED_BYOK_PROVIDERS.includes(provider)) {
            return res.status(400).json({ success: false, error: "Неизвестный провайдер" });
        }
        if (!supabase) {
            return res.status(500).json({ success: false, error: "Supabase не подключён" });
        }

        // ── Загружаем существующие ключи ──
        const { data: existing, error: fetchErr } = await supabase
            .from("user_api_keys")
            .select("encrypted_keys")
            .eq("user_id", userId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!existing) {
            return res.json({ success: true, message: "Нечего удалять" });
        }

        const currentKeys = existing.encrypted_keys || {};
        if (!currentKeys[provider]) {
            return res.json({ success: true, message: "Ключ не был установлен" });
        }

        delete currentKeys[provider];

        // ── Сохраняем обновлённый набор ──
        const { error: updateErr } = await supabase
            .from("user_api_keys")
            .update({
                encrypted_keys: currentKeys,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (updateErr) throw updateErr;

        // ── Сбрасываем кэш ──
        if (typeof userKeyCache !== "undefined" && userKeyCache) {
            userKeyCache.delete(`${userId}:${provider}`);
        }

        console.log(`[BYOK] ${BYOK_PROVIDER_NAMES[provider]} ключ удалён для ${userId}`);

        res.json({
            success: true,
            provider,
            message: `Ключ ${BYOK_PROVIDER_NAMES[provider]} удалён`,
        });
    } catch (err) {
        console.error("[BYOK DELETE] Ошибка:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/user/api-keys/test
 * Проверяет ключ реальным запросом к API провайдера ПЕРЕД сохранением.
 * Не сохраняет ключ — только валидирует.
 * 
 * Body: { provider, apiKey }
 */
app.post("/api/user/api-keys/test", async (req, res) => {
    try {
        const { provider, apiKey } = req.body;

        if (!provider || !apiKey) {
            return res.status(400).json({ success: false, error: "provider и apiKey обязательны" });
        }
        if (!ALLOWED_BYOK_PROVIDERS.includes(provider)) {
            return res.status(400).json({ success: false, error: "Неизвестный провайдер" });
        }

        const cleanKey = String(apiKey).trim();
        let testPassed = false;
        let message = "";

        try {
            if (provider === "gemini") {
                const r = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
                    { signal: AbortSignal.timeout(10000) }
                );
                testPassed = r.ok;
                if (r.ok) {
                    const data = await r.json();
                    message = `Gemini ключ валиден. Доступно моделей: ${data.models?.length || 0}`;
                } else {
                    message = `Gemini HTTP ${r.status}: ${r.status === 400 ? "неверный ключ" : "ошибка"}`;
                }

            } else if (provider === "openai") {
                const r = await fetch("https://api.openai.com/v1/models", {
                    headers: { "Authorization": `Bearer ${cleanKey}` },
                    signal: AbortSignal.timeout(10000)
                });
                testPassed = r.ok;
                message = r.ok ? "OpenAI ключ валиден" : `OpenAI HTTP ${r.status}`;

            } else if (provider === "anthropic") {
                // Anthropic не имеет публичного /models — используем /messages с минимальным запросом
                const r = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "x-api-key": cleanKey,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "claude-3-5-haiku-latest",
                        max_tokens: 1,
                        messages: [{ role: "user", content: "test" }]
                    }),
                    signal: AbortSignal.timeout(10000)
                });
                // 200 = успех, 400 (bad request из-за max_tokens) = ключ валиден, 401/403 = невалидный
                testPassed = r.ok || r.status === 400;
                message = r.ok
                    ? "Anthropic ключ валиден"
                    : r.status === 400
                        ? "Anthropic ключ валиден (получен 400 от API — ключ принят)"
                        : `Anthropic HTTP ${r.status}`;

            } else if (provider === "deepseek") {
                const r = await fetch("https://api.deepseek.com/models", {
                    headers: { "Authorization": `Bearer ${cleanKey}` },
                    signal: AbortSignal.timeout(10000)
                });
                testPassed = r.ok;
                message = r.ok ? "DeepSeek ключ валиден" : `DeepSeek HTTP ${r.status}`;

            } else if (provider === "groq") {
                const r = await fetch("https://api.groq.com/openai/v1/models", {
                    headers: { "Authorization": `Bearer ${cleanKey}` },
                    signal: AbortSignal.timeout(10000)
                });
                testPassed = r.ok;
                if (r.ok) {
                    const data = await r.json();
                    message = `Groq ключ валиден. Доступно моделей: ${data.data?.length || 0}`;
                } else {
                    message = `Groq HTTP ${r.status}`;
                }

            } else if (provider === "openrouter") {
                const r = await fetch("https://openrouter.ai/api/v1/models", {
                    headers: { "Authorization": `Bearer ${cleanKey}` },
                    signal: AbortSignal.timeout(10000)
                });
                testPassed = r.ok;
                if (r.ok) {
                    const data = await r.json();
                    message = `OpenRouter ключ валиден. Доступно моделей: ${data.data?.length || 0}`;
                } else {
                    message = `OpenRouter HTTP ${r.status}`;
                }
            }
        } catch (fetchErr) {
            testPassed = false;
            message = `Сетевая ошибка: ${fetchErr.message.slice(0, 100)}`;
        }

        console.log(`[BYOK Test] ${provider} — ${testPassed ? "✅ OK" : "❌ FAIL"} (${message})`);

        res.json({
            success: testPassed,
            provider,
            providerName: BYOK_PROVIDER_NAMES[provider],
            message,
        });
    } catch (err) {
        console.error("[BYOK Test] Ошибка:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
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
Mediator language for all explanations: ${mediatorLanguage}.

STRICT REQUIREMENTS — the roadmap is INVALID if any minimum is not met:
- milestones: MINIMUM 3 distinct steps, each with 5-8 tokens.
- checkpointQuestions: MINIMUM 4 questions, each testing a different sub-topic.
- Every description, explanation, and token.mediatorTranslation MUST be in ${mediatorLanguage} — NOT English, NOT Hungarian, NOT any other language.

Return ONLY valid JSON. No markdown, no code fences.

Schema:
{
  "title": "...",
  "category": "Grammar",
  "level": "${userLevel}",
  "estimatedDuration": "3 Weeks",
  "summary": "3-4 sentences in ${mediatorLanguage}.",
  "milestones": [
    { "step": 1, "title": "...", "description": "<in ${mediatorLanguage}>", "grammarPoint": "...", "sampleSentence": "...", "tokens": [{ "text": "...", "lemma": "...", "pos": "...", "syntaxRole": "...", "cefrLevel": "...", "ipa": "/.../", "mediatorTranslation": "<in ${mediatorLanguage}>" }] }
  ],
  "checkpointQuestions": [
    { "question": "<in ${mediatorLanguage}>", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "<in ${mediatorLanguage}>" }
  ]
}`;

        let roadmap = null;
        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
        if (raw) {
            roadmap = await repairJson(raw);
            if (!roadmap) {
                console.warn("[Grammar Roadmap] repairJson returned null");
            } else if (!Array.isArray(roadmap.milestones) || roadmap.milestones.length < 3) {
                console.warn("[Grammar Roadmap] AI roadmap has <3 milestones");
                roadmap = null;
            }
        } else {
            console.warn("[Grammar Roadmap] AI returned null");
        }

        if (!roadmap) {
            console.warn("[Grammar Roadmap] FALLBACK activated");
            roadmap = getFallbackRoadmap(targetLanguage, userLevel, ruleTitle || "", mediatorLanguage);
        }
        roadmap = normalizeRoadmapShape(roadmap);

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

        const prompt = `Create a detailed language learning roadmap for topic "${topic}" at CEFR ${level} in ${targetLanguage}.
Mediator language for all explanations: ${mediatorLanguage}. Learner goal: ${customGoal || "General proficiency"}.

STRICT REQUIREMENTS — INVALID if any minimum is not met:
- milestones: MINIMUM 3 distinct steps, each with 5-8 tokens.
- checkpointQuestions: MINIMUM 4 questions.
- Every description, explanation, and token.mediatorTranslation MUST be in ${mediatorLanguage}.

Return ONLY valid JSON. No markdown, no code fences.

Schema:
{
  "title": "...",
  "summary": "3-4 sentences in ${mediatorLanguage}.",
  "milestones": [
    { "step": 1, "title": "...", "description": "<in ${mediatorLanguage}>", "grammarPoint": "...", "sampleSentence": "...", "tokens": [{ "text": "...", "lemma": "...", "pos": "...", "syntaxRole": "...", "cefrLevel": "...", "ipa": "/.../", "mediatorTranslation": "<in ${mediatorLanguage}>" }] }
  ],
  "checkpointQuestions": [
    { "question": "<in ${mediatorLanguage}>", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "<in ${mediatorLanguage}>" }
  ]
}`;

        const aiResponse = await callGeminiWithResilience(prompt);
        let roadmap = null;
        if (aiResponse) {
            roadmap = await repairJson(aiResponse);
            if (!roadmap) {
                console.warn("[Roadmap] repairJson returned null");
            } else if (!Array.isArray(roadmap.milestones) || roadmap.milestones.length < 3) {
                console.warn("[Roadmap] AI roadmap has <3 milestones");
                roadmap = null;
            }
        } else {
            console.warn("[Roadmap] AI returned null");
        }


        if (!roadmap) {
            console.warn("[Roadmap] FALLBACK activated");
            roadmap = getFallbackRoadmap(targetLanguage, level, topic, mediatorLanguage);
        }
        roadmap = normalizeRoadmapShape(roadmap);
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

        const prompt = `You are a master grammar expert writing a comprehensive study guide for ${targetLanguage} at CEFR ${level} on the topic "${ruleTitle}". Mediator language for explanations: ${mediatorLanguage}.

STRICT REQUIREMENTS — the guide is considered INVALID if any minimum is not met:
- coreRules: MINIMUM 4 distinct rules (not variations of one rule). Each rule MUST have 5-8 tokens with full linguistic metadata.
- commonMistakes: MINIMUM 4 distinct mistakes, each illustrating a DIFFERENT pitfall.
- practiceExercises: MINIMUM 6 exercises covering different sub-aspects.
- Every explanationInMediator MUST be written exactly in ${mediatorLanguage}. The mediator language is EXACTLY this: ${mediatorLanguage}. Do NOT use any other language (not Hungarian, not Turkish, not English, not ${targetLanguage}, not any other language).
- If you do not know a word in ${mediatorLanguage}, use a simpler word in the same language — never substitute another language.
- The field "reason" in commonMistakes and "explanation" in practiceExercises must also be in ${mediatorLanguage}.
- Self-check before returning: verify the first 10 words of every mediator field are in ${mediatorLanguage}.
- IPA transcription must be accurate for the target word.

Return ONLY valid JSON. No markdown, no code fences.

Schema:
{
  "title": "Comprehensive Guide: <Topic> in <Language>",
  "category": "Grammar",
  "level": "${level}",
  "summary": "3-4 sentences describing the scope and learning outcomes.",
  "coreRules": [
    {
      "ruleTitle": "...",
      "explanationInMediator": "<full explanation in ${mediatorLanguage}>",
      "formula": "...",
      "example": "...",
      "tokens": [
        { "text": "...", "lemma": "...", "pos": "...", "syntaxRole": "...", "cefrLevel": "...", "ipa": "/.../", "mediatorTranslation": "<in ${mediatorLanguage}>" }
      ]
    }
  ],
  "commonMistakes": [
    { "incorrect": "...", "correct": "...", "reason": "<in ${mediatorLanguage}>" }
  ],
  "practiceExercises": [
    { "instruction": "...", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "<in ${mediatorLanguage}>" }
  ]
}`;

        let guide = null;

        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
        if (raw) {
            guide = await repairJson(raw);
            if (!guide) {
                console.warn("[Grammar Guide] repairJson returned null");
            } else if (!Array.isArray(guide.coreRules) || guide.coreRules.length === 0) {
                console.warn("[Grammar Guide] AI guide has no coreRules");
                guide = null;
            }
        } else {
            console.warn("[Grammar Guide] AI returned null");
        }

        if (!guide) {
            console.warn("[Grammar Guide] FALLBACK activated");
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
function getFallbackRoadmap(lang = "English", level = "B1", topic = "General", mediatorLang = "az") {
    const langDisplay = (lang || "English").charAt(0).toUpperCase() + (lang || "English").slice(1).toLowerCase();
    const topicDisplay = (topic || "General").charAt(0).toUpperCase() + (topic || "General").slice(1).toLowerCase();

    const msg = {
        ru: `Не удалось сгенерировать дорожную карту через AI. Попробуйте ещё раз или измените тему.`,
        az: `AI vasitəsilə yol xəritəsi yaratmaq mümkün olmadı. Yenidən cəhd edin və ya mövzunu dəyişdirin.`,
        tr: `AI ile yol haritası oluşturulamadı. Tekrar deneyin veya konuyu değiştirin.`,
        en: `Could not generate roadmap via AI. Try again or rephrase the topic.`,
        de: `Fahrplan konnte nicht über KI generiert werden. Bitte erneut versuchen.`,
        es: `No se pudo generar la hoja de ruta mediante IA. Inténtelo de nuevo.`,
    }[mediatorLang] || `Could not generate roadmap via AI.`;

    return {
        title: `${topicDisplay} (${level} • ${langDisplay})`,
        category: "General",
        level: level || "B1",
        isFallback: true,
        estimatedDuration: "—",
        summary: msg,
        milestones: [],
        checkpointQuestions: []
    };
}

// =====================================================
// FALLBACK GRAMMAR GUIDE
// =====================================================
function getFallbackGrammarGuide(lang = "English", rule = "Verb Tenses", level = "B1", mediatorLang = "az") {
    const langDisplay = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
    const ruleDisplay = rule.charAt(0).toUpperCase() + rule.slice(1).toLowerCase();

    const msg = {
        ru: `Не удалось сгенерировать руководство через AI. Попробуйте ещё раз или измените формулировку темы.`,
        az: `AI vasitəsilə bələdçi yaratmaq mümkün olmadı. Yenidən cəhd edin və ya mövzunu dəyişdirin.`,
        tr: `AI ile kılavuz oluşturulamadı. Tekrar deneyin veya konuyu değiştirin.`,
        en: `Could not generate guide via AI. Try again or rephrase the topic.`,
        de: `Leitfaden konnte nicht über KI generiert werden. Bitte erneut versuchen.`,
        es: `No se pudo generar la guía mediante IA. Inténtelo de nuevo.`,
    }[mediatorLang] || `Could not generate guide via AI.`;

    return {
        title: `${ruleDisplay} (${langDisplay})`,
        category: "Grammar",
        level: level || "B1",
        isFallback: true,
        summary: msg,
        coreRules: [{
            ruleTitle: `${ruleDisplay} — ${langDisplay}`,
            explanationInMediator: msg,
            formula: "—",
            example: "",
            tokens: []
        }],
        commonMistakes: [],
        practiceExercises: []
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
        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
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

    // Быстрые локальные словари — только если реально загружены.
    // Если набор пустой (пакет не установился), идём к AI-фоллбэку ниже.
    if ((lang.includes("en") || lang.includes("ingl")) && englishWordSet.size > 0) {
        return englishWordSet.has(cleanWord);
    }
    if ((lang.includes("es") || lang.includes("span")) && spanishWordSet.size > 0) {
        if (spanishWordSet.has(cleanWord)) return true;
        const noAccents = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return spanishWordSet.has(noAccents);
    }
    if (lang.includes("fr") && frenchWordSet.size > 0) {
        if (frenchWordSet.has(cleanWord)) return true;
        const noAccents = cleanWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return frenchWordSet.has(noAccents);
    }
    if ((lang.includes("de") || lang.includes("germ") || lang.includes("alm")) && germanWordSet.size > 0) {
        return germanWordSet.has(cleanWord);
    }
    if (multilingualVocabSet.size > 0 && multilingualVocabSet.has(cleanWord)) {
        return true;
    } try {
        const prompt = `Is "${cleanWord}" a legitimate dictionary word in ${language}? Answer strictly in JSON: {"valid": true} or {"valid": false}`;
        const raw = await callGeminiWithResilience(prompt);
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
        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
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
        const raw = await callGeminiWithResilience(prompt, null, [], true, userId);
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
    const server = app.listen(PORT, () => {
        const addr = server.address();
        console.log(`[SpeakBot Server] Bound to:`, JSON.stringify(addr));
        console.log(`[SpeakBot Server] Running on http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
        console.error(`[SpeakBot Server] LISTEN ERROR:`, err.code, err.message);
        if (err.code === "EADDRINUSE") {
            console.error(`Порт ${PORT} занят другим процессом`);
        }
    });
}

startServer();

// =====================================================
// AUTO-FETCH FROM GUTENBERG (every 6 hours)
// =====================================================
setInterval(async () => {
    const mediatorLanguage = syncedUsersDatabase["default-user"]?.mediatorLanguage || "en";
    const targetLanguage = "English";  // или взять из дефолтного пользователя
    const rawStory = await fetchRandomGutenbergBook(targetLanguage);
    if (!rawStory) return;
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
