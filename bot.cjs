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
const API_BASE = (process.env.MINIAPP_URL || 'https://speakingbot.onrender.com').trim();
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

async function generateVoice(text, lang = 'en-US') {
    const key = `${lang}:${text}`;
    if (ttsCache[key]) return ttsCache[key];

    const tts = new MsEdgeTTS();
    const voice = VOICE_MAP[lang] || VOICE_MAP['en-US'];
    await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    const filePath = path.join(TEMP_DIR, `tts-${Date.now()}.webm`);
    await tts.toFile(filePath, text);
    ttsCache[key] = filePath;
    return filePath;
}

async function convertToOgg(inputPath) {
    const outputPath = inputPath.replace('.webm', '.ogg');
    return new Promise((resolve, reject) => {
        exec(`${ffmpeg} -y -i "${inputPath}" -c:a libopus -b:a 128k "${outputPath}"`, (err) => {
            if (err) reject(err);
            else resolve(outputPath);
        });
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
    const systemPrompt = `You are a patient language tutor. Reply in ${targetLanguage}. Level: ${level}. Use ${mediatorLanguage} for brief clarifications.`;
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
    ];

    let replyText = null;
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile', messages, temperature: 0.7,
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }, timeout: 20000 });
        replyText = response.data.choices[0].message.content;
    } catch (err) {
        console.error('Groq error:', err.message);
        if (OPENROUTER_API_KEY) {
            try {
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'openai/gpt-oss-20b:free', messages,
                }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }, timeout: 15000 });
                replyText = response.data.choices[0].message.content;
            } catch (err2) { console.error('OpenRouter error:', err2.message); }
        }
    }

    if (!replyText) return "Sorry, all AI providers are unavailable right now. Try again in a moment.";

    conversationHistory[userId].push({ role: 'user', content: userMessage });
    conversationHistory[userId].push({ role: 'assistant', content: replyText });
    axios.post(`${API_BASE}/api/user/usage`, { userId }, { timeout: 5000 }).catch(() => { });
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
        const { data } = await axios.get(`${API_BASE}/api/user/profile`, {
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
                doc.fontSize(12).font('Helvetica').text(`• ${r.rule}: ${r.explanation}`);
                doc.fontSize(10).font('Helvetica-Oblique').text(`Example: ${r.example}`);
                doc.moveDown();
            });
            doc.moveDown();
        });
    } else if (data.exercises) {
        data.exercises.forEach((ex, i) => {
            doc.fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${ex.question}`);
            doc.fontSize(11).font('Helvetica').text(`Options: ${(ex.options || []).join(' | ')}`);
            doc.fontSize(10).font('Helvetica-Oblique').text(`Answer: ${(ex.options || [])[ex.correctIndex]}`);
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
            const res = await axios.post(`${API_BASE}${endpoint}`, {
                userId, targetLanguage: targetLang, userLevel: level, mediatorLanguage: mediatorLang, topic,
            }, { timeout: 60000 });
            if (res.data.pdfUrl) return res.data.pdfUrl;
            const inner = res.data.guide || res.data.roadmap || res.data.story || res.data;
            return await generateStructuredPDF(inner, `speakbot_${type}_${Date.now()}`, type.toUpperCase() + ' Guide');
        } catch (err) { console.error(`PDF endpoint error ${type}:`, err.message); }
    }
    const aiPrompt = `Generate ${type} material on "${topic}" for ${targetLang} at CEFR ${level}. Return JSON: {title, modules or exercises}.`;
    const aiResponse = await getTutorResponse(userId, aiPrompt, targetLang, mediatorLang, level);
    let data;
    try { data = JSON.parse(aiResponse); } catch { data = { text: aiResponse }; }
    return await generateStructuredPDF(data, `speakbot_${type}_fallback_${Date.now()}`, type.toUpperCase() + ' Guide');
}

// ==================== SYNC / INTENT ====================
async function syncUser(telegramId, username, language = 'en') {
    axios.post(`${API_BASE}/api/bot/sync`, {
        userId: String(telegramId),
        telegramChatId: String(telegramId),
        telegramUsername: `@${username}`,
        updates: { targetLanguage: language },
    }, { timeout: 8000 }).catch(e => console.error('Sync error:', e.message));
}

function detectIntent(text) {
    const lower = text.toLowerCase();
    if (lower.includes('grammar')) return 'grammar';
    if (lower.includes('roadmap') || lower.includes('plan')) return 'roadmap';
    if (lower.includes('skill') || lower.includes('test') || lower.includes('level')) return 'skills';
    if (lower.includes('listen')) return 'listening';
    if (lower.includes('speak')) return 'speaking';
    if (lower.includes('read')) return 'reading';
    if (lower.includes('write')) return 'writing';
    if (lower.includes('game') || lower.includes('cubeword')) return 'game';
    return 'tutor';
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

bot.action(/^story_open_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const storyId = ctx.match[1];
    try {
        const { data } = await axios.get(`${API_BASE}/api/stories/custom-list`, { params: { userId: ctx.from.id }, timeout: 15000 });
        const story = (data.customStories || []).find(s => s.id === storyId);
        if (!story) return ctx.reply('Not found.');
        await ctx.reply(`📖 ${story.title}\nby ${story.author || 'Unknown'}\nLevel: ${story.level || 'B1'}\n\n${story.culturalLinguisticContext || ''}\n\nOpen Mini App for full content.`);
    } catch (e) { ctx.reply('Failed.'); }
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

    // Voice
    if (ctx.message.voice) {
        await ctx.reply('🎧 Processing voice...');
        try {
            const fileId = ctx.message.voice.file_id;
            const file = await ctx.telegram.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            const buffer = (await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 })).data;
            const inputPath = path.join(TEMP_DIR, `voice-${Date.now()}.oga`);
            fs.writeFileSync(inputPath, buffer);
            const text = await transcribeAudio(inputPath, 'en');
            try { fs.unlinkSync(inputPath); } catch { }

            const intent = detectIntent(text);
            const p = await getUserProfile(ctx.from.id);

            if (['grammar', 'roadmap', 'skills', 'listening', 'reading', 'writing'].includes(intent)) {
                await ctx.reply(`Understanding: "${text}"\nGenerating ${intent} PDF...`);
                const pdfPath = await generatePdf(intent, ctx.from.id, p.targetLanguage, p.currentLevel, p.mediatorLanguage);
                await ctx.replyWithDocument({ source: pdfPath });
                try { fs.unlinkSync(pdfPath); } catch { }
            } else {
                const reply = await getTutorResponse(ctx.from.id, text, p.targetLanguage, p.mediatorLanguage, p.currentLevel);
                const langCode = getTtsVoiceCode(p);
                try {
                    const webm = await generateVoice(reply, langCode);
                    const ogg = await convertToOgg(webm);
                    await ctx.replyWithVoice({ source: ogg });
                    await ctx.reply(`📝 Heard: ${text}`);
                    try { fs.unlinkSync(webm); fs.unlinkSync(ogg); } catch { }
                } catch (e) {
                    ctx.reply(reply);
                }
            }
        } catch (e) {
            console.error('Voice processing failed:', e.message);
            await ctx.reply('Failed to process voice.');
        }
        return;
    }

    // Text
    if (ctx.message.text) {
        const p = await getUserProfile(ctx.from.id);
        const reply = await getTutorResponse(ctx.from.id, ctx.message.text, p.targetLanguage, p.mediatorLanguage, p.currentLevel);
        await ctx.reply(reply);
    }
});

// ==================== LAUNCH ====================
bot.launch();
console.log('[Telegram Bot] Launched (mode: ' + (require.main === module ? 'standalone' : 'embedded') + ')');