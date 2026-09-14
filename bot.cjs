require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { exec } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const PDFDocument = require('pdfkit');
const Redis = require('ioredis');

// ==================== REDIS ====================
const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
    ? new Redis({
        host: new URL(process.env.UPSTASH_REDIS_URL).hostname,
        port: 6379,
        password: process.env.UPSTASH_REDIS_TOKEN,
        tls: process.env.UPSTASH_REDIS_URL.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: 20,
        retryStrategy: (times) => Math.min(times * 500, 30000),
        enableOfflineQueue: true,
        connectTimeout: 10000,
        keepAlive: 30000,
        lazyConnect: false,
        enableReadyCheck: false,
    })
    : null;

if (redis) {
    let redisFirstConnect = true;
    redis.on('connect', () => {
        if (redisFirstConnect) {
            console.log('[Redis] Connected to Upstash');
            redisFirstConnect = false;
        }
    });
    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
}

async function getUser(userId) {
    if (!redis) return null;
    try {
        const raw = await Promise.race([
            redis.get(`spk:user:${userId}`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 3000))
        ]);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('[Redis] getUser failed:', e.message);
        return null;
    }
}

async function saveUser(userId, user) {
    if (!redis) return false;
    try {
        await Promise.race([
            redis.set(`spk:user:${userId}`, JSON.stringify(user), 'EX', 86400 * 30),
            new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_TIMEOUT')), 3000))
        ]);
        return true;
    } catch (e) {
        console.error('[Redis] saveUser failed:', e.message);
        return false;
    }
}

// ==================== CONFIG ====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_API_BASE = 'https://speakingbot.onrender.com';

function resolveApiBase() {
    const raw = (process.env.MINIAPP_URL || '').trim();
    if (!raw) {
        console.warn('[Bot] MINIAPP_URL not set — using default:', DEFAULT_API_BASE);
        return DEFAULT_API_BASE;
    }
    // Coerce into a valid URL. Common failure: missing "//" or missing scheme.
    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
        candidate = 'https://' + candidate.replace(/^\/+/, '');
    }
    try {
        const u = new URL(candidate);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            throw new Error('bad protocol: ' + u.protocol);
        }
        return candidate.replace(/\/+$/, '');   // strip trailing slash
    } catch (e) {
        console.error(
            '[Bot] MINIAPP_URL invalid:', JSON.stringify(raw),
            '— reason:', e.message,
            '— falling back to', DEFAULT_API_BASE
        );
        return DEFAULT_API_BASE;
    }
}

const API_BASE = resolveApiBase();
console.log('[Bot] API_BASE =', API_BASE);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_BASE || !API_BASE.startsWith('http')) {
    console.error('[Bot] FATAL: API_BASE invalid:', JSON.stringify(process.env.MINIAPP_URL));
    process.exit(1);
}
console.log('[Bot] API_BASE =', API_BASE);

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// State
const activeGames = {};
const conversationHistory = {};
const ttsCache = {};
const botTtsCache = {};
let skillTestState = {};

// ==================== VOICE (MSEdge TTS) ====================
const VOICE_MAP = {
    'en-US': 'en-US-AriaNeural',
    'en-GB': 'en-GB-SoniaNeural',
    'ru-RU': 'ru-RU-SvetlanaNeural',
    'de-DE': 'de-DE-KatjaNeural',
    'fr-FR': 'fr-FR-DeniseNeural',
    'es-ES': 'es-ES-ElviraNeural',
    'it-IT': 'it-IT-ElsaNeural',
    'tr-TR': 'tr-TR-EmelNeural',
};

// ─── Language code → full display name (для промптов) ───
function langCodeToName(code) {
    if (!code) return "English";
    const c = String(code).toLowerCase().trim();
    const map = {
        en: "English", english: "English",
        ru: "Russian", russian: "Russian", "русский": "Russian",
        az: "Azerbaijani", azerbaijani: "Azerbaijani", azeri: "Azerbaijani",
        "azərbaycan": "Azerbaijani",
        tr: "Turkish", turkish: "Turkish", "türkçe": "Turkish",
        de: "German", german: "German", deutsch: "German",
        es: "Spanish", spanish: "Spanish", "español": "Spanish",
        fr: "French", french: "French", "français": "French",
        it: "Italian", italian: "Italian", italiano: "Italian",
    };
    return map[c] || (code.charAt(0).toUpperCase() + code.slice(1));
}
// ─── Compact CEFR-level contract for the Groq/OpenRouter fallback path ───
// Mirrors server.js LEVEL_PEDAGOGY but condensed (Groq has smaller context).
const LEVEL_CONTRACT = {
    A1: "3-6 word single-clause sentences. Present tense only. Top-500 words (greetings, numbers, colours, family, food, objects). Listening+speaking dominate. Correct every target error. Drill: repeat / name / yes-no / translate 1 word. Opening move: sounds → greetings → self-intro → numbers → daily objects. Max 3 new items per turn, then WAIT for the learner's answer.",
    A2: "6-10 words, 1-2 clauses. Past + future + modals (can/must/should). Top-1500 words (shopping, travel, routine, weather). Speaking-first across all 4 skills. Correct form explicitly. Drill: fill gap / short translation / answer full question. Opening move: one A1 check → pick a daily-life theme → 4-6 exchanges. 1 grammar + 3-5 words per turn.",
    B1: "10-15 word multi-clause sentences. Present perfect, conditionals 1-2, relatives, reported speech. ~2500 words. Balanced 4 skills, expect productive output. Correct meaning first, form only when comprehension breaks. Drill: roleplay / describe / give opinion / react to short text. Opening move: 30s warm-up in target → find one weak point → 3-5 turn thread. Expect 2-3 sentence learner output.",
    B2: "15-25 word complex sentences. Conditional 3, inversion, cleft, mixed tenses, discourse markers, hedging. ~4000 words abstract+register-appropriate. Debate, essays, film/article listening. Correct only if it breaks register. Drill: debate / summarize / rewrite register / paraphrase. Opening move: real-world topic + open question → 5-8 turn dialogue. Expect 3-5 sentence learner output.",
    C1: "20-35 words, embedded clauses, nominalization, dense hedging. Subjunctive, impersonal passives, cleft, cohesion devices. 8000+ words including idioms and professional jargon. Register-appropriate production. Correct only register/style. Drill: paragraph in a register / 60s opinion / summarize argument / register-switch. Opening move: assume competence, start demanding, NO greetings warm-up.",
    C2: "Any length. Rare structures, stylistic devices, archaic/formal/dialectal registers. Native-equivalent precision. Correct only factual and stylistic. Drill: essays / nuanced argumentation / prose editing / register-faithful translation. Opening move: literary or formal topic; treat learner as a peer, no scaffolding.",
};

function buildLevelContractShort(level) {
    return LEVEL_CONTRACT[level] || LEVEL_CONTRACT.B1;
}
function getTtsVoiceCode(profile) {
    const isBeginner = (profile.currentLevel === 'A1' || profile.currentLevel === 'A2');
    const voiceLangName = isBeginner
        ? (profile.mediatorLanguage || 'en')
        : (profile.targetLanguage || 'English');

    const map = {
        en: 'en-US', ru: 'ru-RU', az: 'az-AZ', tr: 'tr-TR',
        de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
        English: 'en-US', Russian: 'ru-RU', Azerbaijani: 'az-AZ',
        Turkish: 'tr-TR', German: 'de-DE', Spanish: 'es-ES',
        French: 'fr-FR', Italian: 'it-IT',
    };
    // az-AZ в MSEdge voice map отсутствует → fallback на ru-RU (фонетически ближе)
    const code = map[voiceLangName] || 'en-US';
    return code === 'az-AZ' ? 'ru-RU' : code;
}

// ─── Sanitize text before sending to any TTS provider ───
function sanitizeForBotTts(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')          // bold markdown
        .replace(/\*(.+?)\*/g, '$1')              // italic markdown
        .replace(/`(.+?)`/g, '$1')                // code
        .replace(/\[([^\]]{1,40})\]/g, ' ')       // [tag]
        .replace(/\s+/g, ' ')                     // collapse whitespace
        .trim();
}

// ─── Provider 1: msedge-tts (2 attempts) ───
async function tryMsEdgeTTS(text, lang, fileBase) {
    const voice = VOICE_MAP[lang] || VOICE_MAP['en-US'];
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const tts = new MsEdgeTTS();
            await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
            const filePath = `${fileBase}.webm`;
            await tts.toFile(filePath, text);
            console.log(`[TTS] msedge OK (attempt ${attempt})`);
            return filePath;
        } catch (e) {
            lastErr = e;
            console.warn(`[TTS] msedge attempt ${attempt} failed: ${e.message}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 800));
        }
    }
    throw lastErr || new Error('msedge failed');
}

// ─── Provider 2: StreamElements (free, no key, MP3) ───
async function tryStreamElementsTTS(text, lang, fileBase) {
    // StreamElements voice names — use the same Neural voice IDs as msedge
    const voiceMap = {
        'en-US': 'Brian', 'en-GB': 'Amy',
        'ru-RU': 'Filip', 'de-DE': 'Vicki',
        'fr-FR': 'Celine', 'es-ES': 'Lucia',
        'it-IT': 'Bianca', 'tr-TR': 'Filiz',
        'az-AZ': 'Filip',   // no AZ voice — fallback to RU narrator
    };
    const voice = voiceMap[lang] || 'Brian';
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text.slice(0, 400))}`;
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'SpeakBot/1.0' },
    });
    if (res.status !== 200 || !res.data || res.data.byteLength < 500) {
        throw new Error(`StreamElements bad response (status=${res.status})`);
    }
    const filePath = `${fileBase}.mp3`;
    fs.writeFileSync(filePath, Buffer.from(res.data));
    console.log(`[TTS] StreamElements OK (${voice}, ${res.data.byteLength} bytes)`);
    return filePath;
}

// ─── Provider 3: Google Translate TTS (free, no key, MP3, ~200 chars) ───
async function tryGoogleTranslateTTS(text, lang, fileBase) {
    const langCode = (lang || 'en-US').split('-')[0];   // "en-US" → "en", "az-AZ" → "az"
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(text.slice(0, 190))}`;
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SpeakBot/1.0)',
            'Referer': 'https://translate.google.com/',
        },
    });
    if (res.status !== 200 || !res.data || res.data.byteLength < 500) {
        throw new Error(`GoogleTranslate bad response (status=${res.status})`);
    }
    const filePath = `${fileBase}.mp3`;
    fs.writeFileSync(filePath, Buffer.from(res.data));
    console.log(`[TTS] GoogleTranslate OK (${langCode}, ${res.data.byteLength} bytes)`);
    return filePath;
}

// ─── Orchestrator: cascade with cache ───
async function generateVoice(text, lang = 'en-US') {
    const clean = sanitizeForBotTts(text);
    if (!clean) throw new Error('empty text after sanitize');

    const cacheKey = `${lang}:${clean}`;
    if (ttsCache[cacheKey] && fs.existsSync(ttsCache[cacheKey])) {
        return ttsCache[cacheKey];
    }

    const fileBase = path.join(TEMP_DIR, `tts-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);

    // Cascade: msedge → StreamElements → GoogleTranslate
    const providers = [
        { name: 'msedge', fn: tryMsEdgeTTS },
        { name: 'stream-e', fn: tryStreamElementsTTS },
        { name: 'gtranslate', fn: tryGoogleTranslateTTS },
    ];

    for (const p of providers) {
        try {
            const filePath = await p.fn(clean, lang, fileBase);
            ttsCache[cacheKey] = filePath;
            return filePath;
        } catch (e) {
            console.warn(`[TTS] ${p.name} exhausted: ${e.message}`);
        }
    }

    // All providers failed — throw, caller (respond()) falls back to text-only
    throw new Error('All TTS providers failed (msedge, streamelements, googletranslate)');
}

async function convertToOgg(inputPath) {
    // Handle ANY source extension (.webm, .mp3, .oga, .wav) — not just .webm
    const outputPath = inputPath.replace(/\.[a-z0-9]+$/i, '') + '.ogg';
    return new Promise((resolve, reject) => {
        exec(
            `"${ffmpeg}" -y -i "${inputPath}" -c:a libopus -b:a 96k -ac 1 "${outputPath}"`,
            (err) => {
                if (err) reject(new Error(`ffmpeg: ${err.message}`));
                else resolve(outputPath);
            }
        );
    });
}

// ==================== STT ====================
async function transcribeAudio(filePath, lang = 'en') {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-large-v3');
    formData.append('language', lang);
    formData.append('response_format', 'json');
    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
    });
    return response.data.text;
}

// ==================== TUTOR ====================
async function getTutorResponse(userId, userMessage, targetLanguage = 'en', mediatorLanguage = 'en', level = 'B1') {
    return Promise.race([
        getTutorResponseInternal(userId, userMessage, targetLanguage, mediatorLanguage, level),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TUTOR_TIMEOUT')), 60000))
    ]).catch(err => {
        console.error('getTutorResponse timed out:', err.message);
        return "Sorry, the AI mentor is busy right now. Please try again in a moment.";
    });
}

async function getTutorResponseInternal(userId, userMessage, targetLanguage = 'en', mediatorLanguage = 'en', level = 'B1') {
    // Premium check
    try {
        const { data } = await axios.get(`${API_BASE}/api/user/premium`, {
            params: { userId }, timeout: 8000,
        });
        if (!data.isPremium && data.usageCount >= data.limit) {
            const text = "⚠️ You've reached your free limit. Upgrade with /premium.";
            await bot.telegram.sendMessage(userId, text, { parse_mode: 'Markdown' });
            return text;
        }
    } catch (err) { console.error('Premium check failed:', err.message); }

    // Socratic endpoint
    try {
        const { data } = await axios.post(`${API_BASE}/api/socratic/chat`, {
            userId: String(userId),
            bookTitle: "Telegram Session",
            author: "SpeakBot Mentor",
            excerpt: "",
            userMessage,
            chatHistory: (conversationHistory[userId] || []).slice(-4),
            targetLanguage, mediatorLanguage, level,
            userRequestedTranslation: /\b(translate|translation|what does .* mean|переведи|перевод|tərcümə)\b/i.test(userMessage),
            mode: "language",       // ← ЯЗЫКОВОЙ ТЬЮТОР, не литература
        }, { timeout: 25000 });
        if (data.success && data.reply) {
            if (!conversationHistory[userId]) conversationHistory[userId] = [];
            conversationHistory[userId].push({ role: 'user', content: userMessage });
            conversationHistory[userId].push({ role: 'assistant', content: data.reply });
            axios.post(`${API_BASE}/api/user/usage`, { userId }, { timeout: 5000 }).catch(() => { });
            return data.reply;
        }
    } catch (err) { console.error('Socratic API failed:', err.message); }

    // Groq → OpenRouter fallback
    if (!conversationHistory[userId]) conversationHistory[userId] = [];
    const history = conversationHistory[userId].slice(-10);
    const mediatorName = langCodeToName(mediatorLanguage);
    const targetName = langCodeToName(targetLanguage);
    const isBeginner = (level === 'A1' || level === 'A2');

    const levelContract = buildLevelContractShort(level);

    const systemPrompt = isBeginner
        ? `You are SpeakBot Language Tutor — a focused ${targetName} teacher for a ${level} BEGINNER.
ABSOLUTE RULES:
1. YOUR ENTIRE REPLY MUST BE IN ${mediatorName}. The only ${targetName} words allowed are the specific words you are teaching — each immediately followed by its ${mediatorName} translation in parentheses.
2. DETECT THE CONVERSATION STATE: look at the last assistant message. If it ended with a question / exercise / "translate this" / "now you say…", the learner's short reply is AN ANSWER — evaluate it (correct/wrong), praise briefly, and continue with the next small step.
3. NEVER treat a short answer (e.g. "привет", "hello") as a new greeting. NEVER restart the lesson. NEVER say "welcome".
4. You are a language teacher, not a chatbot. Do not discuss books or unrelated topics.
5. End every reply with exactly ONE small next-step prompt (translate / repeat / answer / fill the gap).

═══ LEVEL CONTRACT (${level}) ═══
${levelContract}
STAY INSIDE THIS CONTRACT. Do NOT teach above ${level}.`
        : `You are SpeakBot Language Tutor — a patient teacher of ${targetName} for a ${level} learner.
- Reply in ${targetName}. Use ${mediatorName} only for the learner's explicit translation requests.
- Detect whether the learner's message answers your previous question (evaluate it) or asks something new (answer it). Never restart the lesson.
- Every reply ends with exactly ONE next-step prompt.

═══ LEVEL CONTRACT (${level}) ═══
${levelContract}
STAY INSIDE THIS CONTRACT. Do NOT teach above ${level}. Do NOT restart from zero — the learner is NOT a beginner at ${level}.
1. YOUR ENTIRE REPLY MUST BE IN ${mediatorName}. The only ${targetName} words allowed are the specific words you are teaching — each immediately followed by its ${mediatorName} translation in parentheses.
2. DETECT THE CONVERSATION STATE: look at the last assistant message.If it ended with a question / exercise / "translate this" / "now you say…", the learner's short reply is AN ANSWER — evaluate it (correct/wrong), praise briefly, and continue with the next small step.
3. NEVER treat a short answer(e.g. "привет", "hello") as a new greeting. NEVER restart the lesson.NEVER say "welcome".
4. You are a language teacher, not a chatbot. Do not discuss books or unrelated topics.
5. End every reply with exactly ONE small next - step prompt(translate / repeat / answer / fill the gap).`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
    ];
    let replyText = null;
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile', messages, temperature: 0.7,
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY} ` }, timeout: 20000 });
        replyText = response.data.choices[0].message.content;
    } catch (err) {
        console.error('Groq error:', err.message);
        if (OPENROUTER_API_KEY) {
            try {
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'openai/gpt-oss-20b:free', messages,
                }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY} ` }, timeout: 15000 });
                replyText = response.data.choices[0].message.content;
            } catch (err2) { console.error('OpenRouter error:', err2.message); }
        }
    }

    if (!replyText) return "Sorry, all AI providers are unavailable right now. Try again in a moment.";

    conversationHistory[userId].push({ role: 'user', content: userMessage });
    conversationHistory[userId].push({ role: 'assistant', content: replyText });
    axios.post(`${API_BASE} /api/user / usage`, { userId }, { timeout: 5000 }).catch(() => { });
    return replyText;
}

// ==================== PROFILE (with hard timeouts) ====================
async function getUserProfile(userId) {
    return Promise.race([
        getUserProfileInternal(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), 8000)),
    ]).catch(err => {
        console.warn('getUserProfile timeout:', err.message);
        return { targetLanguage: 'English', currentLevel: 'B1', mediatorLanguage: 'en', xp: 0, skillScores: {} };
    });
}

async function getUserProfileInternal(userId) {
    const cached = await getUser(String(userId));
    if (cached) return cached;
    try {
        const { data } = await axios.get(`${API_BASE} /api/user / profile`, {
            params: { userId: String(userId) }, timeout: 5000,
        });
        const profile = data.data;
        if (profile) saveUser(String(userId), profile).catch(() => { });
        return profile;
    } catch (err) {
        console.warn('getUserProfile failed:', err.message);
        return { targetLanguage: 'English', currentLevel: 'B1', mediatorLanguage: 'en', xp: 0, skillScores: {} };
    }
}

// ==================== PDF GENERATION ====================
async function generateStructuredPDF(data, filename, title) {
    const doc = new PDFDocument();
    const filePath = path.join(TEMP_DIR, `${filename}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown();
    if (data.modules) {
        data.modules.forEach(m => {
            doc.fontSize(14).font('Helvetica-Bold').text(m.title || '');
            doc.fontSize(12).font('Helvetica').text(m.description || '');
            (m.rules || []).forEach(r => {
                doc.fontSize(12).font('Helvetica').text(`• ${r.rule}: ${r.explanation} `);
                doc.fontSize(10).font('Helvetica-Oblique').text(`Example: ${r.example} `);
                doc.moveDown();
            });
            doc.moveDown();
        });
    } else if (data.exercises) {
        data.exercises.forEach((ex, i) => {
            doc.fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${ex.question} `);
            doc.fontSize(11).font('Helvetica').text(`Options: ${(ex.options || []).join(' | ')} `);
            doc.fontSize(10).font('Helvetica-Oblique').text(`Answer: ${(ex.options || [])[ex.correctIndex]} `);
            doc.moveDown();
        });
    } else {
        doc.fontSize(12).font('Helvetica').text(JSON.stringify(data, null, 2));
    }
    doc.end();
    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

async function generatePdf(type, userId, targetLang, level, mediatorLang = 'en', topic = '') {
    const endpoints = {
        grammar: '/api/gemini/generate-grammar-guide',
        roadmap: '/api/gemini/generate-grammar-roadmap',
        listening: '/api/stories/generate-daily-excerpt',
        reading: '/api/stories/generate-daily-excerpt',
        writing: '/api/gemini/generate-grammar-guide',
    };
    const endpoint = endpoints[type];
    if (endpoint) {
        try {
            const res = await axios.post(`${API_BASE}${endpoint} `, {
                userId, targetLanguage: targetLang, userLevel: level, mediatorLanguage: mediatorLang, topic,
            }, { timeout: 60000 });
            if (res.data.pdfUrl) return res.data.pdfUrl;
            const inner = res.data.guide || res.data.roadmap || res.data.story || res.data;
            return await generateStructuredPDF(inner, `speakbot_${type}_${Date.now()} `, type.toUpperCase() + ' Guide');
        } catch (err) { console.error(`PDF endpoint error ${type}: `, err.message); }
    }
    const aiPrompt = `Generate ${type} material on "${topic}" for ${targetLang} at CEFR ${level}. Return JSON: { title, modules or exercises }.`;
    const aiResponse = await getTutorResponse(userId, aiPrompt, targetLang, mediatorLang, level);
    let data;
    try { data = JSON.parse(aiResponse); } catch { data = { text: aiResponse }; }
    return await generateStructuredPDF(data, `speakbot_${type}_fallback_${Date.now()} `, type.toUpperCase() + ' Guide');
}

// ==================== SYNC / INTENT ====================
async function syncUser(telegramId, username, language = 'en') {
    axios.post(`${API_BASE} /api/bot / sync`, {
        userId: String(telegramId),
        telegramChatId: String(telegramId),
        telegramUsername: `@${username} `,
        updates: { targetLanguage: language },
    }, { timeout: 8000 }).catch(e => console.error('Sync error:', e.message));
}

function detectIntent(text) {
    const lower = (text || '').toLowerCase();

    // Word-boundary aware matcher. Prevents "explanations" → roadmap,
    // "already" → reading, "bespoke" → speaking, etc.
    const has = (...words) => words.some(w => {
        const rx = new RegExp(`(^|[^a-zà-ÿ])${w}([^a-zà-ÿ]|$)`, 'i');
        return rx.test(lower);
    });

    // Order matters: most-specific first
    if (has('cubeword', 'cube word')) return 'game';
    if (has('game', 'games')) return 'game';

    if (has('grammar')) return 'grammar';
    if (has('roadmap', 'road map', 'study plan', 'learning plan', 'curriculum')) return 'roadmap';

    if (has('skill test', 'skill-test', 'test my', 'take a test', 'take test')) return 'skills';

    if (has('listening', 'listen')) return 'listening';
    if (has('speaking', 'speak')) return 'speaking';
    if (has('reading', 'read')) return 'reading';
    if (has('writing', 'write', 'essay')) return 'writing';

    return 'tutor';
}
// ────────────────────────────────────────────────────────────
// Unified text router — SAME logic for text AND voice input.
// Returns one of:
//   { action: 'switch_language', lang }
//   { action: 'howto' }
//   { action: 'pdf', intent }         // grammar/roadmap/skills/listening/reading/writing
//   { action: 'tutor' }               // freeform chat with the AI tutor
//   { action: 'game' }                // games hint (only when text explicitly asks)
// Caller decides whether to speak the reply or print it.
// ────────────────────────────────────────────────────────────
async function classifyAndRouteText(text, userProfile) {
    const clean = (text || '').trim();
    if (!clean) return { action: 'tutor' };

    const p = userProfile || {};

    // ── 0. Marker from AI tutor: SWITCH_REQUEST::Spanish ──
    const markerMatch = clean.match(/^SWITCH_REQUEST::([A-Za-zÀ-ÿ]+)/i);
    if (markerMatch && markerMatch[1]) {
        const lang = markerMatch[1].charAt(0).toUpperCase() + markerMatch[1].slice(1).toLowerCase();
        return { action: 'switch_target', lang };
    }

    // ── 1. Fast regex language switch (now returns object) ──
    const fastSwitch = detectLanguageSwitchIntent(clean);
    if (fastSwitch) {
        if (fastSwitch.intent === 'target_and_mediator') {
            return {
                action: 'switch_both',
                targetLang: fastSwitch.targetLanguage,
                mediatorLang: fastSwitch.mediatorLanguage,
            };
        }
        if (fastSwitch.intent === 'mediator') {
            return { action: 'switch_mediator', lang: fastSwitch.language };
        }
        // default: target
        return { action: 'switch_target', lang: fastSwitch.language };
    }

    // ── 2. How-to intent ──
    if (detectHowToIntent(clean)) return { action: 'howto' };

    // ── 3. AI classifier for suspicious short messages ──
    if (looksLikeLanguageRequest(clean)) {
        const aiIntent = await classifyIntentWithAI(clean, p.targetLanguage, p.mediatorLanguage);
        if (aiIntent?.intent === 'switch_language' && aiIntent.language) {
            return { action: 'switch_target', lang: aiIntent.language };
        }
        if (aiIntent?.intent === 'switch_mediator' && aiIntent.language) {
            return { action: 'switch_mediator', lang: aiIntent.language };
        }
    }

    // ── 4. Intent detection (PDF / games / tutor) ──
    const intent = detectIntent(clean);
    if (['grammar', 'roadmap', 'skills', 'listening', 'reading', 'writing'].includes(intent)) {
        return { action: 'pdf', intent };
    }
    if (intent === 'game') return { action: 'game' };
    return { action: 'tutor' };
}
// ==================== LANGUAGE SWITCH INTENT ====================
const LANG_NAME_MAP = {
    // English name → canonical
    'english': 'English',
    'german': 'German', 'deutsch': 'German',
    'spanish': 'Spanish', 'espanol': 'Spanish', 'español': 'Spanish',
    'french': 'French', 'francais': 'French', 'français': 'French',
    'italian': 'Italian', 'italiano': 'Italian',
    'russian': 'Russian', 'русский': 'Russian',
    'turkish': 'Turkish', 'türkçe': 'Turkish',
    'azerbaijani': 'Azerbaijani', 'azeri': 'Azerbaijani', 'azərbaycan': 'Azerbaijani',
};

function extractLanguageFromText(text) {
    const lower = text.toLowerCase();
    for (const [key, canonical] of Object.entries(LANG_NAME_MAP)) {
        // word boundary check
        const re = new RegExp(`\\b${key} \\b`, 'i');
        if (re.test(lower)) return canonical;
    }
    return null;
}

// Returns { intent: 'target'|'mediator', language: 'Russian' } or null.
function detectLanguageSwitchIntent(text) {
    if (!text) return null;
    const lower = text.toLowerCase().trim().replace(/[.!?,]+$/g, '');

    const tryExtractAll = (s) => {
        // Return ALL canonical language names found, preserving order of appearance
        const found = [];
        const LANG_MAP_LOCAL = {
            'english': 'English',
            'german': 'German', 'deutsch': 'German',
            'spanish': 'Spanish', 'espanol': 'Spanish', 'español': 'Spanish',
            'french': 'French', 'francais': 'French', 'français': 'French',
            'italian': 'Italian', 'italiano': 'Italian',
            'russian': 'Russian', 'русский': 'Russian',
            'turkish': 'Turkish', 'türkçe': 'Turkish',
            'azerbaijani': 'Azerbaijani', 'azeri': 'Azerbaijani', 'azərbaycan': 'Azerbaijani',
        };
        const positions = [];
        for (const [k, canon] of Object.entries(LANG_MAP_LOCAL)) {
            const rx = new RegExp(`\\b${k}\\b`, 'i');
            const m = lower.match(rx);
            if (m) positions.push({ pos: m.index, lang: canon });
        }
        positions.sort((a, b) => a.pos - b.pos);
        // Dedup while preserving order
        const seen = new Set();
        for (const p of positions) {
            if (!seen.has(p.lang)) {
                seen.add(p.lang);
                found.push(p.lang);
            }
        }
        return found;
    };

    // ═══════════════════════════════════════════════════════
    // PATTERN 0: BOTH mediator + target mentioned in one sentence
    // "switch mediator to russian and target to spanish"
    // "mediate in russian, teach me spanish"
    // ═══════════════════════════════════════════════════════
    const hasMediatorWord = /\b(mediator|native|explain(?:ed)?|explanations?|clarif\w*|translat\w*)\b/i.test(lower);
    const hasTargetWord = /\b(target|learn|teach|study|speak|practice|master)\b/i.test(lower);

    if (hasMediatorWord && hasTargetWord) {
        const langs = tryExtractAll(lower);
        if (langs.length >= 2) {
            // Heuristic: mediator = the one nearest to a mediator keyword,
            // target = the one nearest to a target keyword.
            const medIdx = langs.findIndex(l => new RegExp(l.toLowerCase() + '|' + mapShort(l), 'i').test(
                lower.slice(Math.max(0, lower.search(/\b(mediator|native|explain|explanations?|clarif|translat)/i)))
            ));
            // Simpler: first-mentioned language in "mediator…X…target…Y" is mediator, second is target.
            // If "target…X…mediator…Y" — reverse. Detect which keyword comes first.
            const medKeywordPos = lower.search(/\b(mediator|native|explain|explanations?|clarif|translat)/i);
            const tgtKeywordPos = lower.search(/\b(target|learn|teach|study|speak|practice|master)/i);
            if (medKeywordPos >= 0 && tgtKeywordPos >= 0 && medKeywordPos < tgtKeywordPos) {
                return {
                    intent: 'target_and_mediator',
                    targetLanguage: langs[1],
                    mediatorLanguage: langs[0],
                };
            } else if (tgtKeywordPos >= 0 && medKeywordPos >= 0 && tgtKeywordPos < medKeywordPos) {
                return {
                    intent: 'target_and_mediator',
                    targetLanguage: langs[0],
                    mediatorLanguage: langs[1],
                };
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // PATTERN 1: MEDIATOR-only switch
    // "switch mediator to russian", "объясняй по-русски", "in russian please"
    // ═══════════════════════════════════════════════════════
    const mediatorOnlyPattern = /\b(mediator|native|explanations?|explanations? (?:in|to)|clarif\w* (?:in|to)|translate (?:into|to)|speak to me in|in my (?:own|native)|по[- ]?русски|на русском|на азербайджанском|на турецком|на английском|azərbaycanca|rusca|türkcə)\b/i;
    if (mediatorOnlyPattern.test(lower)) {
        // If a target-switch keyword is also present, let Pattern 0 handle it.
        if (!hasTargetWord) {
            const langs = tryExtractAll(lower);
            if (langs.length >= 1) {
                return { intent: 'mediator', language: langs[0] };
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // PATTERN 2: TARGET-only switch (previous behaviour, kept)
    // ═══════════════════════════════════════════════════════
    const SWITCH_KEYWORDS = [
        'switch', 'change', 'shift', 'move', 'instead', 'prefer',
        'learn', 'study', 'start', 'teach', 'want', 'need',
        'переключ', 'смен', 'учить', 'изучать', 'хочу', 'давай', 'надо',
        'keç', 'dəyiş', 'öyrən', 'istəyirəm', 'başla',
    ];
    if (SWITCH_KEYWORDS.some(k => lower.includes(k))) {
        const langs = tryExtractAll(lower);
        if (langs.length >= 1) {
            return { intent: 'target', language: langs[0] };
        }
    }

    // ═══════════════════════════════════════════════════════
    // PATTERN 3: bare language name as a very short message
    // ═══════════════════════════════════════════════════════
    const BARE = /^(?:to|in|into|auf|en|по)?\s*([a-zà-ÿ]+)$/i;
    const mBare = lower.match(BARE);
    if (mBare) {
        const langs = tryExtractAll(mBare[1]);
        if (langs.length >= 1) return { intent: 'target', language: langs[0] };
    }

    // ═══════════════════════════════════════════════════════
    // PATTERN 4: explicit verb + language
    // ═══════════════════════════════════════════════════════
    const VERB_PATTERNS = [
        /(?:switch|change|shift|move)\s+(?:to\s+)?([a-zà-ÿ]+)/i,
        /(?:teach|start teaching|help me (?:learn|with|study))\s+(?:me\s+)?([a-zà-ÿ]+)/i,
        /(?:learn|study|start|master|speak|practice)\s+([a-zà-ÿ]+)/i,
        /(?:i\s+(?:want|would like|'d like|need)\s+to\s+(?:learn|study|speak|master))\s+([a-zà-ÿ]+)/i,
    ];
    for (const p of VERB_PATTERNS) {
        const m = lower.match(p);
        if (m && m[1]) {
            const langs = tryExtractAll(m[1]);
            if (langs.length >= 1) return { intent: 'target', language: langs[0] };
        }
    }

    return null;
}

// Tiny helper used above — maps a canonical name to short regex alternatives
function mapShort(canon) {
    const m = {
        English: 'english|en', Russian: 'russian|русский|ru',
        Azerbaijani: 'azerbaijani|azeri|azərbaycan|az',
        Turkish: 'turkish|türkçe|tr',
        German: 'german|deutsch|de', Spanish: 'spanish|español|es',
        French: 'french|français|fr', Italian: 'italian|italiano|it',
    };
    return m[canon] || canon.toLowerCase();
}
function detectHowToIntent(text) {
    const lower = text.toLowerCase();
    const patterns = [
        /what should i (do|press|click|tap)/,
        /which (page|button|tab|menu)/,
        /how (to|do i) (start|begin|switch|change|learn)/,
        /where (do i|can i|to) (start|go|find|switch|change|learn)/,
        /what to press/,
    ];
    return patterns.some(p => p.test(lower));
}

async function handleLanguageSwitch(ctx, newLang, opts = {}) {
    const userId = ctx.from.id;
    const requestUrl = `${API_BASE}/api/user/target-language`;
    const silent = !!opts.silent;

    // Unified responder — respects silent flag everywhere
    const reply = silent
        ? async () => { /* suppressed */ }
        : (...args) => ctx.reply(...args);

    try {
        const { data } = await axios.post(requestUrl, {
            userId: String(userId),
            targetLanguage: newLang,
        }, { timeout: 10000 });

        if (!data || !data.success) {
            throw new Error((data && data.error) || 'server refused switch');
        }

        // Sync local Redis cache
        try {
            const cached = await getUser(String(userId));
            if (cached) {
                cached.targetLanguage = newLang;
                await saveUser(String(userId), cached);
            }
        } catch (cacheErr) {
            console.warn('[LangSwitch] cache update failed:', cacheErr.message);
        }

        // ⚠️ ВАЖНО: reply(), а НЕ ctx.reply()
        return reply(
            `✅ Target language switched to *${newLang}*!\n\n` +
            `Your profile now:\n` +
            `• Target: ${newLang}\n` +
            `• Mediator: ${data.data?.mediatorLanguage || 'unchanged'}\n` +
            `• Level: ${data.data?.currentLevel || 'B1'}\n\n` +
            `Start learning — try:\n` +
            `• /grammar — a grammar guide in ${newLang}\n` +
            `• /read — reading test in ${newLang}\n` +
            `• /games — vocabulary games\n` +
            `• Or just send me a message in ${newLang}!`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error(`[LangSwitch] POST ${requestUrl} failed:`, e.message, e.code || '');

        // ── FALLBACK: update local cache anyway, so at least this session switches ──
        try {
            const cached = await getUser(String(userId));
            if (cached) {
                cached.targetLanguage = newLang;
                await saveUser(String(userId), cached);
                console.log(`[LangSwitch] local cache updated to ${newLang} (server sync failed)`);
                return reply(
                    `✅ Switched to *${newLang}* locally.\n\n` +
                    `⚠️ Server sync failed (${e.message.slice(0, 80)}), so this may not persist across restarts.\n\n` +
                    `Try: /grammar — a guide in ${newLang}`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (localErr) {
            console.error('[LangSwitch] local cache fallback failed:', localErr.message);
        }

        return reply(
            `⚠️ Failed to switch to ${newLang}: ${e.message}\n\n` +
            `Diagnostic: API_BASE = ${API_BASE}`
        );
    }
}
async function handleMediatorSwitch(ctx, newLang, opts = {}) {
    const userId = ctx.from.id;
    const silent = !!opts.silent;

    const reply = silent
        ? async () => { /* suppressed */ }
        : (...args) => ctx.reply(...args);

    const langCodeMap = {
        English: 'en', Russian: 'ru', Azerbaijani: 'az', azeri: 'az',
        Turkish: 'tr', German: 'de', Spanish: 'es', French: 'fr', Italian: 'it',
    };
    const code = langCodeMap[newLang] || String(newLang).toLowerCase().slice(0, 2);

    try {
        const { data } = await axios.post(`${API_BASE}/api/user/mediator-language`, {
            userId: String(userId),
            mediatorLanguage: code,
        }, { timeout: 10000 });

        if (!data || !data.success) {
            throw new Error((data && data.error) || 'server refused');
        }

        try {
            const cached = await getUser(String(userId));
            if (cached) {
                cached.mediatorLanguage = code;
                await saveUser(String(userId), cached);
            }
        } catch (cacheErr) {
            console.warn('[MediatorSwitch] cache update failed:', cacheErr.message);
        }

        return reply(
            `✅ Mediator language switched to *${newLang}*.\n\n` +
            `Explanations will now be in ${newLang}.`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('[MediatorSwitch] failed:', e.message);

        try {
            const cached = await getUser(String(userId));
            if (cached) {
                cached.mediatorLanguage = code;
                await saveUser(String(userId), cached);
                return reply(
                    `✅ Mediator set to *${newLang}* locally.\n\n` +
                    `⚠️ Server sync failed (${e.message.slice(0, 80)}).`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch { /* ignore */ }

        return reply(
            `⚠️ Failed to switch mediator to ${newLang}: ${e.message}`
        );
    }
}
// ==================== AI INTENT CLASSIFIER ====================

async function classifyIntentWithAI(text, currentTarget, currentMediator) {
    // Быстрый AI-классификатор. Возвращает { intent, language } или null.
    // Используем Groq (быстрый + дешёвый) для скорости.

    const systemPrompt = `You are an intent classifier for a language-learning Telegram bot.

Current user settings:
- Target language (what they learn): ${currentTarget}
- Mediator language (for explanations): ${currentMediator}

Classify the user's message into EXACTLY ONE of these intents:

1. "switch_language" — user wants to CHANGE their target language (the language they are learning).
2. "switch_mediator" — user wants to change their MEDIATOR language (for explanations only).
3. "chat" — anything else (asking questions, discussing literature, greetings, requests to explain grammar, etc.).

RULES:
- Only classify as "switch_language" if the user CLEARLY expresses desire to change target.
- "I'm reading about German literature" → "chat" (mention ≠ switch)
- "to french" → "switch_language" with language="French"
- "switch to spanish" → "switch_language" with language="Spanish"
- "can we do German instead?" → "switch_language" with language="German"
- "hello" → "chat"
- "what is Romanticism?" → "chat"

Return ONLY valid JSON:
{ "intent": "switch_language", "language": "French" }
or
{ "intent": "switch_mediator", "language": "Russian" }
or
{ "intent": "chat" }`;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
            max_tokens: 100,
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
            timeout: 8000,
        });

        const content = response.data.choices[0].message.content;
        const parsed = JSON.parse(content);
        if (parsed && parsed.intent) return parsed;
    } catch (e) {
        console.warn('[Intent] AI classifier failed:', e.message);
    }
    return null;
}
function looksLikeLanguageRequest(text) {
    // Быстрая эвристика — стоит ли вообще вызывать AI-классификатор
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    if (lower.length > 200) return false;              // длинные тексты — точно chat

    const KEYWORDS = [
        'switch', 'change', 'shift', 'move', 'instead',
        'learn', 'study', 'start', 'try', 'prefer',
        'to french', 'to german', 'to spanish', 'to italian', 'to russian', 'to turkish',
        'to english', 'to azerbaijani',
        'на ', 'переключ', 'смен', 'учить', 'изучать',
        'keç', 'dəyiş', 'öyrən',
    ];
    if (KEYWORDS.some(k => lower.includes(k))) return true;

    // Голое имя языка: "french", "to french", "in french"
    const LANG_NAMES = [
        'english', 'german', 'spanish', 'french', 'italian',
        'russian', 'turkish', 'azerbaijani',
        'deutsch', 'español', 'français', 'italiano',
    ];
    const words = lower.split(/\s+/);
    if (words.length <= 3 && LANG_NAMES.some(n => lower.includes(n))) return true;

    return false;
}
// ==================== COMMANDS ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    await syncUser(userId, ctx.from.username || 'user');
    await ctx.reply(
        '👋 Welcome to SpeakBot!\n\n' +
        '🎯 Chat with AI about literature\n' +
        '🎮 Play language games\n' +
        '📄 Generate PDF materials\n' +
        '🗣 Send voice messages for STT + TTS\n\n' +
        'Use buttons below:',
        Markup.inlineKeyboard([
            [Markup.button.callback('📚 Stories', 'show_stories')],
            [Markup.button.callback('🎮 Games', 'show_games')],
            [Markup.button.callback('📄 PDF Materials', 'pdf_menu')],
            [Markup.button.callback('👤 Profile', 'show_profile')],
            [Markup.button.callback('🆘 Help', 'show_help')],
        ])
    );
});

bot.action('show_help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        'Commands:\n\n' +
        '/start — main menu\n' +
        '/profile — learning profile\n' +
        '/skills — skill scores\n' +
        '/grammar <topic> — grammar PDF\n' +
        '/roadmap <topic> — roadmap PDF\n' +
        '/games — play games\n' +
        '/cubeword — find the word\n' +
        '/memory — memory match\n' +
        '/wordbuilder — build words\n' +
        '/vocab <word> — save to vocabulary\n' +
        '/tts <text> — text-to-speech\n' +
        '/premium — upgrade\n\n' +
        'Or just send text/voice to chat.'
    );
});

bot.help((ctx) => {
    ctx.reply('/start — menu\n/profile — profile\n/games — games\n/tts <text> — voice\n/help — this');
});

bot.action('pdf_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('📄 Select PDF type:', Markup.inlineKeyboard([
        [Markup.button.callback('📖 Grammar', 'pdf_grammar'), Markup.button.callback('🗺️ Roadmap', 'pdf_roadmap')],
        [Markup.button.callback('👂 Listening', 'pdf_listening'), Markup.button.callback('📚 Reading', 'pdf_reading')],
        [Markup.button.callback('✍️ Writing', 'pdf_writing')],
        [Markup.button.callback('⬅ Back', 'back_to_main')],
    ]));
});

bot.action('pdf_grammar', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply('Generating grammar PDF...');
    try {
        const pdfPath = await generatePdf('grammar', ctx.from.id, p.targetLanguage, p.currentLevel, p.mediatorLanguage);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed: ' + e.message); }
});

bot.action('pdf_roadmap', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply('Generating roadmap PDF...');
    try {
        const pdfPath = await generatePdf('roadmap', ctx.from.id, p.targetLanguage, p.currentLevel, p.mediatorLanguage);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed: ' + e.message); }
});

bot.action('pdf_listening', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply('Generating listening PDF...');
    try {
        const pdfPath = await generatePdf('listening', ctx.from.id, p.targetLanguage, p.currentLevel);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed: ' + e.message); }
});

bot.action('pdf_reading', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply('Generating reading PDF...');
    try {
        const pdfPath = await generatePdf('reading', ctx.from.id, p.targetLanguage, p.currentLevel);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed: ' + e.message); }
});

bot.action('pdf_writing', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply('Generating writing PDF...');
    try {
        const pdfPath = await generatePdf('writing', ctx.from.id, p.targetLanguage, p.currentLevel);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed: ' + e.message); }
});

bot.action('cancel_pdf', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Cancelled.');
});

['read', 'write', 'listen', 'speak'].forEach(skill => {
    bot.command(skill, async (ctx) => {
        const skillMap = { read: 'reading', write: 'writing', listen: 'listening', speak: 'speaking' };
        const skillName = skillMap[skill];
        const userId = ctx.from.id;
        const p = await getUserProfile(userId);

        await ctx.reply(`📝 Generating ${skillName} test...`);

        try {
            const { data } = await axios.post(`${API_BASE}/api/tests/generate-skill`, {
                userId,
                skill: skillName,
                targetLanguage: p.targetLanguage,
                userLevel: p.currentLevel,
                mediatorLanguage: p.mediatorLanguage,
                count: 5,
            }, { timeout: 60000 });

            if (!data.success || !data.test?.questions || data.test.questions.length === 0) {
                return ctx.reply('Failed to generate test.');
            }

            skillTestState[userId] = {
                skill: skillName,
                step: 0,
                score: 0,
                questions: data.test.questions,
            };

            await sendNextQuestion(ctx);
        } catch (e) {
            console.error(`${skill} test error:`, e.message);
            ctx.reply('Failed to start test.');
        }
    });
});
// PDF commands
bot.command('grammar', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'Basic Grammar';
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply(`📖 Generating grammar guide for "${topic}"...`);

    try {
        const { data } = await axios.post(`${API_BASE}/api/gemini/generate-grammar-guide`, {
            userId: ctx.from.id,
            targetLanguage: p.targetLanguage,
            ruleTitle: topic,
            level: p.currentLevel,
            mediatorLanguage: p.mediatorLanguage,
        }, { timeout: 60000 });

        const guide = data.guide;
        if (!guide) throw new Error('No guide');

        // Форматируем текстом
        const lines = [
            `📖 *${guide.title}*`,
            `Level: ${guide.level || p.currentLevel}`,
            '',
            guide.summary || '',
            '',
            '*Core Rules:*',
        ];
        (guide.coreRules || []).slice(0, 4).forEach((rule, i) => {
            lines.push(`${i + 1}. *${rule.ruleTitle}*`);
            lines.push(`   ${rule.explanationInMediator}`);
            lines.push(`   📐 ${rule.formula}`);
            lines.push(`   💬 ${rule.example}`);
            lines.push('');
        });

        if (guide.commonMistakes?.length) {
            lines.push('*Common Mistakes:*');
            guide.commonMistakes.slice(0, 3).forEach(m => {
                lines.push(`❌ ${m.incorrect}`);
                lines.push(`✅ ${m.correct}`);
                lines.push(`   ${m.reason}`);
                lines.push('');
            });
        }

        lines.push('_Full PDF: /grammar_pdf ' + topic + '_');

        const text = lines.join('\n');
        // Telegram limit 4096 chars per message
        if (text.length > 4000) {
            await ctx.reply(text.slice(0, 4000), { parse_mode: 'Markdown' });
            await ctx.reply(text.slice(4000), { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error('grammar error:', e.message);
        ctx.reply('Failed to generate grammar guide.');
    }
});

bot.command('roadmap', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'General';
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply(`🗺️ Generating roadmap for "${topic}"...`);

    try {
        const { data } = await axios.post(`${API_BASE}/api/gemini/generate-grammar-roadmap`, {
            userId: ctx.from.id,
            targetLanguage: p.targetLanguage,
            userLevel: p.currentLevel,
            mediatorLanguage: p.mediatorLanguage,
            topic,
        }, { timeout: 60000 });

        const roadmap = data.roadmap;
        if (!roadmap) throw new Error('No roadmap');

        const lines = [
            `🗺️ *${roadmap.title}*`,
            `Level: ${roadmap.level || p.currentLevel} • ${roadmap.estimatedDuration || ''}`,
            '',
            roadmap.summary || '',
            '',
            '*Milestones:*',
        ];
        (roadmap.milestones || []).slice(0, 5).forEach(m => {
            lines.push(`📍 Step ${m.step}: *${m.title}*`);
            lines.push(`   ${m.description}`);
            if (m.sampleSentence) lines.push(`   💬 ${m.sampleSentence}`);
            lines.push('');
        });

        if (roadmap.checkpointQuestions?.length) {
            lines.push('*Checkpoint Questions:*');
            roadmap.checkpointQuestions.slice(0, 3).forEach((q, i) => {
                lines.push(`${i + 1}. ${q.question}`);
            });
        }

        lines.push('_Full PDF: /roadmap_pdf ' + topic + '_');

        const text = lines.join('\n');
        if (text.length > 4000) {
            await ctx.reply(text.slice(0, 4000), { parse_mode: 'Markdown' });
            await ctx.reply(text.slice(4000), { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(text, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error('roadmap error:', e.message);
        ctx.reply('Failed to generate roadmap.');
    }
});
bot.command('grammar_pdf', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'Basic Grammar';
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply(`📄 Generating grammar PDF for "${topic}"...`);
    try {
        const pdfPath = await generatePdf('grammar', ctx.from.id, p.targetLanguage, p.currentLevel, p.mediatorLanguage, topic);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed to generate PDF.'); }
});

bot.command('roadmap_pdf', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'General';
    const p = await getUserProfile(ctx.from.id);
    await ctx.reply(`📄 Generating roadmap PDF for "${topic}"...`);
    try {
        const pdfPath = await generatePdf('roadmap', ctx.from.id, p.targetLanguage, p.currentLevel, p.mediatorLanguage, topic);
        await ctx.replyWithDocument({ source: pdfPath });
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (e) { ctx.reply('Failed to generate PDF.'); }
});
bot.command('skills', async (ctx) => {
    const p = await getUserProfile(ctx.from.id);
    const skills = p.skillScores || {};
    const text = Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join('\n') || 'No skills yet';
    ctx.reply(`📊 Skill Scores:\n${text}`);
});

bot.command('profile', async (ctx) => {
    const p = await getUserProfile(ctx.from.id);
    ctx.reply(`👤 Level: ${p.currentLevel}\nTarget: ${p.targetLanguage}\nMediator: ${p.mediatorLanguage}\nXP: ${p.xp || 0}`);
});

bot.command('premium', async (ctx) => {
    await ctx.telegram.sendInvoice(ctx.chat.id, 'SpeakBot Premium', 'Unlimited access', 'premium_subscription', '{}', 'XTR', [{ label: 'Premium', amount: 5 }]);
});

// Skilltest
bot.command('skilltest', async (ctx) => {
    const skill = ctx.message.text.split(' ')[1] || 'grammar';
    const userId = ctx.from.id;
    const p = await getUserProfile(userId);

    await ctx.reply(`📝 Generating ${skill} test...`);

    try {
        const { data } = await axios.post(`${API_BASE}/api/tests/generate-skill`, {
            userId,
            skill,
            targetLanguage: p.targetLanguage,
            userLevel: p.currentLevel,
            mediatorLanguage: p.mediatorLanguage,
            count: 5,
        }, { timeout: 60000 });

        if (!data.success || !data.test?.questions || data.test.questions.length === 0) {
            return ctx.reply('Failed to generate test questions.');
        }

        skillTestState[userId] = {
            skill,
            step: 0,
            score: 0,
            questions: data.test.questions,
        };

        await sendNextQuestion(ctx);
    } catch (e) {
        console.error('skilltest error:', e.message);
        ctx.reply('Failed to start skill test.');
    }
});

async function sendNextQuestion(ctx) {
    const userId = ctx.from.id;
    const state = skillTestState[userId];
    if (!state) return;

    if (state.step >= state.questions.length) {
        // Финальный результат
        const total = state.questions.length;
        const score = state.score || 0;
        const percent = Math.round((score / total) * 100);
        const scoreDelta = Math.round((score / total) * 20);   // макс +20

        try {
            await axios.post(`${API_BASE}/api/user/skill-test`, {
                userId,
                skill: state.skill,
                scoreDelta,
            }, { timeout: 8000 });
        } catch (e) { /* ignore */ }

        delete skillTestState[userId];
        return ctx.reply(
            `✅ Test finished!\n\n` +
            `Score: ${score}/${total} (${percent}%)\n` +
            `Skill boost: +${scoreDelta}% to ${state.skill}`
        );
    }

    const q = state.questions[state.step];
    const opts = q.options.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const num = state.step + 1;

    let msg = `Q${num}/${state.questions.length}: ${q.question}\n\n${opts}\n\nReply with 1-4.`;
    if (q.audioText) {
        msg = `🔊 Audio: "${q.audioText}"\n\n` + msg;
    }

    await ctx.reply(msg);
}

// Games
bot.command('games', async (ctx) => {
    await ctx.reply(
        '🎮 Choose a game — it will open in the Mini App:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('🧩 CubeWord', `${API_BASE}/?game=cubeword`)],
            [Markup.button.webApp('📇 Flashcards', `${API_BASE}/?game=flashcards`)],
            [Markup.button.webApp('⚡ Word Pairs', `${API_BASE}/?game=wordpairs`)],
            [Markup.button.webApp('🧭 Word Quest 3D', `${API_BASE}/?game=wordquest3d`)],
            [Markup.button.webApp('🎴 Memory Match', `${API_BASE}/?game=memory`)],
            [Markup.button.webApp('🔨 Word Builder', `${API_BASE}/?game=wordbuilder`)],
        ])
    );
});
bot.action('close_menu', async (ctx) => { await ctx.answerCbQuery(); ctx.deleteMessage().catch(() => { }); });

bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => { });
    await ctx.reply('🏠 Main menu:', Markup.inlineKeyboard([
        [Markup.button.callback('📚 Stories', 'show_stories')],
        [Markup.button.callback('🎮 Games', 'show_games')],
        [Markup.button.callback('📄 PDF Materials', 'pdf_menu')],
        [Markup.button.callback('👤 Profile', 'show_profile')],
    ]));
});

bot.command('vocab', async (ctx) => {
    const word = ctx.message.text.split(' ')[1];
    if (!word) return ctx.reply('Usage: /vocab <word>');
    const p = await getUserProfile(ctx.from.id);
    try {
        await axios.post(`${API_BASE}/api/user/vocabulary`, { userId: ctx.from.id, targetLanguage: p.targetLanguage, word, translation: '' }, { timeout: 8000 });
        ctx.reply(`Saved "${word}".`);
    } catch (e) { ctx.reply('Failed.'); }
});

// TTS
bot.command('tts', async (ctx) => {
    const text = ctx.message.text.replace('/tts', '').trim();
    if (!text) return ctx.reply('Usage: /tts <text>');
    const p = await getUserProfile(ctx.from.id);
    const langCode = getTtsVoiceCode(p);
    try {
        const webm = await generateVoice(text, langCode);
        const ogg = await convertToOgg(webm);
        await ctx.replyWithVoice({ source: ogg });
        try { fs.unlinkSync(webm); fs.unlinkSync(ogg); } catch { }
    } catch (err) {
        console.error('TTS failed:', err.message);
        ctx.reply('Failed to generate voice.');
    }
});

bot.action('show_tts', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    const isBeginner = (p.currentLevel === 'A1' || p.currentLevel === 'A2');
    const voiceLang = isBeginner ? (p.mediatorLanguage || 'en') : (p.targetLanguage || 'English');
    await ctx.reply(
        `🔊 Text-to-Speech\n\nVoice language: ${voiceLang}\n(${isBeginner ? 'mediator for A1/A2' : 'target for B1+'})\n\nSend text or use /tts <text>.`
    );
});

// Stories
bot.action('show_stories', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    try {
        const { data } = await axios.get(`${API_BASE}/api/stories/custom-list`, {
            params: { userId: ctx.from.id, targetLanguage: p.targetLanguage || 'English' }, timeout: 15000,
        });
        const stories = data.customStories || [];
        if (stories.length === 0) return ctx.reply(`📚 No stories for ${p.targetLanguage || 'English'}.`);
        const buttons = stories.slice(0, 5).map(s => [Markup.button.callback(`📖 ${(s.title || '').slice(0, 40)}`, `story_open_${s.id}`)]);
        buttons.push([Markup.button.callback('⬅ Back', 'back_to_main')]);
        await ctx.reply(`📚 Available (${stories.length}):`, Markup.inlineKeyboard(buttons));
    } catch (e) { ctx.reply('Failed to load stories.'); }
});

// ─── HTML escape helper for Telegram parse_mode="HTML" ───
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Build a rich excerpt message (≤3800 chars) for Telegram ───

function buildStoryExcerptMessage(story, fromIndex = 0, sentencesPerPage = 4) {
    const parts = [];
    parts.push(`📖 <b>${escapeHtml(story.title || 'Untitled')}</b>`);
    parts.push(`<i>by ${escapeHtml(story.author || 'Unknown')}</i>`);
    parts.push(`Level: ${escapeHtml(story.level || 'B1')} • ${escapeHtml(story.targetLanguage || 'English')}`);
    if (story.culturalLinguisticContext) {
        parts.push('');
        parts.push(`🎭 <b>Context:</b> ${escapeHtml(story.culturalLinguisticContext)}`);
    }

    const allSentences = Array.isArray(story.sentences) ? story.sentences : [];
    const slice = allSentences.slice(fromIndex, fromIndex + sentencesPerPage);

    if (slice.length > 0) {
        parts.push('');
        parts.push(`📝 <b>Excerpt</b> (${fromIndex + 1}–${fromIndex + slice.length} of ${allSentences.length}):`);
        for (const s of slice) {
            parts.push('');
            parts.push(`▸ <b>${escapeHtml(s.text || '')}</b>`);
            if (s.translation) parts.push(`   <i>${escapeHtml(s.translation)}</i>`);
            if (s.literaryNote) parts.push(`   💡 ${escapeHtml(s.literaryNote)}`);
        }
    }

    // Key vocabulary — only on first page
    if (fromIndex === 0 && Array.isArray(story.keyVocabulary) && story.keyVocabulary.length > 0) {
        parts.push('');
        parts.push('📚 <b>Key Vocabulary:</b>');
        for (const v of story.keyVocabulary.slice(0, 5)) {
            parts.push(`• <b>${escapeHtml(v.word || '')}</b> — ${escapeHtml(v.translation || v.meaning || '')}`);
        }
    }

    let text = parts.join('\n');
    if (text.length > 3800) text = text.slice(0, 3790) + '…';
    return text;
}

bot.action(/^story_open_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const storyId = ctx.match[1];
    try {
        const { data } = await axios.get(`${API_BASE}/api/stories/custom-story/${storyId}`, {
            params: { userId: ctx.from.id },
            timeout: 15000,
        });
        if (!data || !data.success || !data.story) {
            return ctx.reply('Story not found.');
        }
        const story = data.story;

        const text = buildStoryExcerptMessage(story, 0, 4);
        const totalSentences = (story.sentences || []).length;

        const buttons = [];
        if (totalSentences > 4) {
            buttons.push([
                Markup.button.callback(
                    `📖 Continue (5–${Math.min(8, totalSentences)})`,
                    `story_more_${storyId}_4`
                )
            ]);
        }
        buttons.push([
            Markup.button.webApp('📱 Full story in Mini App', `${API_BASE}/?tab=stories&storyId=${storyId}`)
        ]);
        buttons.push([Markup.button.callback('⬅ Back to list', 'show_stories')]);

        await ctx.reply(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons),
        });
    } catch (e) {
        console.error('[story_open] failed:', e.message);
        ctx.reply('Failed to load story.');
    }
});

// ─── Pagination for long stories ───
bot.action(/^story_more_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const storyId = ctx.match[1];
    const fromIndex = parseInt(ctx.match[2], 10);
    try {
        const { data } = await axios.get(`${API_BASE}/api/stories/custom-story/${storyId}`, {
            params: { userId: ctx.from.id },
            timeout: 15000,
        });
        if (!data || !data.success || !data.story) return ctx.reply('Story not found.');
        const story = data.story;

        const text = buildStoryExcerptMessage(story, fromIndex, 4);
        const totalSentences = (story.sentences || []).length;
        const nextIndex = fromIndex + 4;

        const buttons = [];
        if (nextIndex < totalSentences) {
            buttons.push([
                Markup.button.callback(
                    `📖 Continue (${nextIndex + 1}–${Math.min(nextIndex + 4, totalSentences)})`,
                    `story_more_${storyId}_${nextIndex}`
                )
            ]);
        }
        buttons.push([
            Markup.button.webApp('📱 Full story in Mini App', `${API_BASE}/?tab=stories&storyId=${storyId}`)
        ]);
        buttons.push([Markup.button.callback('⬅ Back to list', 'show_stories')]);

        await ctx.reply(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons),
        });
    } catch (e) {
        console.error('[story_more] failed:', e.message);
        ctx.reply('Failed to load more.');
    }
});

bot.action('show_games', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('🎮 Available Games:', Markup.inlineKeyboard([
        [Markup.button.callback('🧩 CubeWord', 'start_cubeword')],
        [Markup.button.callback('🎴 Memory Match', 'start_memory')],
        [Markup.button.callback('🔨 Word Builder', 'start_wordbuilder')],
        [Markup.button.callback('⬅ Back', 'back_to_main')],
    ]));
});

bot.action('show_profile', async (ctx) => {
    await ctx.answerCbQuery();
    const p = await getUserProfile(ctx.from.id);
    ctx.reply(`👤 Level: ${p.currentLevel}\nTarget: ${p.targetLanguage}\nMediator: ${p.mediatorLanguage}\nXP: ${p.xp || 0}`);
});

// Pre-checkout
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

// ==================== MAIN MESSAGE HANDLER ====================
bot.on('message', async (ctx) => {
    // Payment
    if (ctx.message.successful_payment) {
        axios.post(`${API_BASE}/api/user/premium`, { userId: String(ctx.from.id), isPremium: true }, { timeout: 8000 }).catch(() => { });
        return ctx.reply('🎉 Premium activated!');
    }

    // Skip commands
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    // Skill test answer
    if (skillTestState[ctx.from.id] && ctx.message.text && /^\d+$/.test(ctx.message.text)) {
        const userId = ctx.from.id;
        const state = skillTestState[userId];
        const q = state.questions[state.step];
        const answerIndex = parseInt(ctx.message.text) - 1;

        if (answerIndex === q.correctIndex) {
            state.score = (state.score || 0) + 1;
            await ctx.reply('✅ Correct!');
        } else {
            const correctOpt = q.options[q.correctIndex] || '';
            await ctx.reply(
                `❌ Wrong.\n\n✅ Correct: ${q.correctIndex + 1}. ${correctOpt}` +
                (q.explanation ? `\n\n💡 ${q.explanation}` : '')
            );
        }
        state.step++;
        return sendNextQuestion(ctx);
    }

    // Digits outside test
    if (ctx.message.text && /^\d+$/.test(ctx.message.text) && !skillTestState[ctx.from.id]) {
        return ctx.reply('💡 Use buttons instead of numbers.\nTry /games.', Markup.inlineKeyboard([
            [Markup.button.callback('🎮 Games', 'show_games')],
        ]));
    }

    // ═══════════════════════════════════════════════════════════
    // UNIFIED HANDLER — voice + text share the SAME routing logic
    // ═══════════════════════════════════════════════════════════

    const isVoice = Boolean(ctx.message.voice);
    const isText = Boolean(ctx.message.text);
    if (!isVoice && !isText) return;

    const userId = ctx.from.id;
    let userText = '';

    // ── 1. Acquire the text (transcribe if voice) ──
    if (isVoice) {
        await ctx.reply('🎧 Processing voice...');
        try {
            const fileId = ctx.message.voice.file_id;
            const file = await ctx.telegram.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            const buffer = (await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 })).data;
            const inputPath = path.join(TEMP_DIR, `voice-${Date.now()}.oga`);
            fs.writeFileSync(inputPath, buffer);

            userText = await transcribeAudio(inputPath, 'en');
            await ctx.reply(`📝 Heard: "${userText}"`);
        } catch (e) {
            console.error('Voice transcription failed:', e.message);
            return ctx.reply('Failed to process voice.');
        }
    } else {
        userText = ctx.message.text;
    }

    // ── 2. Load profile (same for both) ──
    const p = await getUserProfile(userId);

    // ── 3. Route through unified classifier ──
    const route = await classifyAndRouteText(userText, { ...p, userId });

    // Helper: send reply — voice-mode also speaks it, text-mode only prints
    const respond = async (text, opts = {}) => {
        await ctx.reply(text, opts);
        if (isVoice && p) {
            try {
                const langCode = getTtsVoiceCode(p);
                const webm = await generateVoice(text, langCode);
                const ogg = await convertToOgg(webm);
                await ctx.replyWithVoice({ source: ogg });
                try { fs.unlinkSync(webm); fs.unlinkSync(ogg); } catch { }
            } catch (e) {
                console.warn('[voice reply TTS] failed:', e.message);
            }
        }
    };

    // ── 4. Dispatch ──
    switch (route.action) {
        case 'switch_target':
            return await handleLanguageSwitch(ctx, route.lang);

        case 'switch_mediator': {
            return await handleMediatorSwitch(ctx, route.lang);
        }

        case 'switch_both': {
            // target first (server has to accept), then mediator
            await handleLanguageSwitch(ctx, route.targetLang, { silent: true });
            await handleMediatorSwitch(ctx, route.mediatorLang, { silent: true });
            return ctx.reply(
                `✅ Switched!\n\n` +
                `• Target language: *${route.targetLang}*\n` +
                `• Mediator language: *${route.mediatorLang}*\n\n` +
                `Explanations will now be in ${route.mediatorLang}, and you'll be learning ${route.targetLang}.\n` +
                `Try: /grammar — a guide in ${route.targetLang}`,
                { parse_mode: 'Markdown' }
            );
        }

        case 'howto':
            return await respond(
                `🎯 *To start learning:*\n\n` +
                `1. Open the Mini App — tap the menu button next to the text input\n` +
                `2. Go to *Profile* tab\n` +
                `3. Change *Target Language* and *Mediator Language*\n` +
                `4. Come back here and start chatting\n\n` +
                `Or use:\n` +
                `• /start — main menu\n` +
                `• /profile — see current settings\n` +
                `• /games — vocabulary games\n` +
                `• /read — reading skill test`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp('📱 Open Mini App', `${API_BASE}/`)],
                        [Markup.button.callback('👤 Profile', 'show_profile')],
                    ]),
                }
            );

        case 'pdf': {
            await ctx.reply(`📄 Generating ${route.intent} PDF...`);
            try {
                const pdfPath = await generatePdf(
                    route.intent, userId, p.targetLanguage, p.currentLevel, p.mediatorLanguage
                );
                await ctx.replyWithDocument({ source: pdfPath });
                try { fs.unlinkSync(pdfPath); } catch { }
            } catch (e) {
                console.error(`${route.intent} PDF failed:`, e.message);
                await ctx.reply('Failed to generate PDF.');
            }
            return;
        }

        case 'game':
            return ctx.reply('🎮 Open the Mini App or use /games to see interactive games.');

        case 'tutor':
        default: {
            const reply = await getTutorResponse(
                userId, userText, p.targetLanguage, p.mediatorLanguage, p.currentLevel
            );

            // Belt-and-suspenders: if the tutor returned SWITCH_REQUEST::X, re-route
            const markerReply = (reply || '').match(/^SWITCH_REQUEST::([A-Za-zÀ-ÿ]+)/i);
            if (markerReply && markerReply[1]) {
                const lang = markerReply[1].charAt(0).toUpperCase() + markerReply[1].slice(1).toLowerCase();
                return await handleLanguageSwitch(ctx, lang);
            }

            return await respond(reply);
        }
    }
});
// ==================== LAUNCH ====================
bot.launch();
console.log('[Telegram Bot] Launched (mode: ' + (require.main === module ? 'standalone' : 'embedded') + ')');