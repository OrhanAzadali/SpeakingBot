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
// ==================== REDIS SYNC ====================
const Redis = require('ioredis');

const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
    ? new Redis({
        host: new URL(process.env.UPSTASH_REDIS_URL).hostname,
        port: 6379,
        password: process.env.UPSTASH_REDIS_TOKEN,
        tls: process.env.UPSTASH_REDIS_URL.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 2000),
    })
    : null;

if (redis) {
    redis.on('connect', () => console.log('[Redis] Connected to Upstash'));
    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
}

async function getUser(userId) {
    if (!redis) return null;
    try {
        const raw = await redis.get(`spk:user:${userId}`);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('[Redis] getUser failed:', e.message);
        return null;
    }
}

async function saveUser(userId, user) {
    if (!redis) return false;
    try {
        await redis.set(`spk:user:${userId}`, JSON.stringify(user), 'EX', 86400 * 30);
        return true;
    } catch (e) {
        console.error('[Redis] saveUser failed:', e.message);
        return false;
    }
}

// ==================== CONFIG ====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = process.env.MINIAPP_URL || 'https://speakingbot.onrender.com';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// In-memory state (for demo; use Redis/DB in production)
const activeGames = {};
const conversationHistory = {};
const ttsCache = {};


async function generateVoice(text, lang = 'en-US') {
    const key = `${lang}:${text}`;
    if (ttsCache[key]) return ttsCache[key];

    const tts = new MsEdgeTTS();
    const voiceMap = {
        'en-US': 'en-US-AriaNeural', 'en-GB': 'en-GB-SoniaNeural',
        'ru-RU': 'ru-RU-SvetlanaNeural', 'de-DE': 'de-DE-KatjaNeural',
        'fr-FR': 'fr-FR-DeniseNeural', 'es-ES': 'es-ES-ElviraNeural',
        'ja-JP': 'ja-JP-NanamiNeural', 'zh-CN': 'zh-CN-XiaoxiaoNeural',
    };
    const voice = voiceMap[lang] || 'en-US-AriaNeural';
    await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    const filePath = path.join(TEMP_DIR, `tts-${Date.now()}.webm`);
    await tts.toFile(filePath, text);

    ttsCache[key] = filePath; // store for future
    return filePath;
}

async function convertToOgg(inputPath) {
    const outputPath = inputPath.replace('.webm', '.ogg');
    return new Promise((resolve, reject) => {
        exec(`${ffmpeg} -i ${inputPath} -c:a libopus -b:a 128k ${outputPath}`, (err) => {
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
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'multipart/form-data' }
    });
    return response.data.text;
}

// ==================== LLM (Tutor) ====================
async function getTutorResponse(userId, userMessage, targetLanguage = 'en', mediatorLanguage = 'en', level = 'B1') {
    // 1. Premium check
    try {
        const { data } = await axios.get(`${API_BASE}/api/user/premium`, { params: { userId } });
        if (!data.isPremium && data.usageCount >= data.limit) {
            const text = "⚠️ You've approached your free limit (150 queries). Upgrade to premium for unlimited access! Use /premium.";
            await bot.telegram.sendMessage(userId, text, { parse_mode: 'Markdown' });
            return text;
        }
    } catch (err) { console.error('Premium check failed:', err.message); }

    // 2. Try socratic endpoint (single source of truth with Mini App)
    try {
        const { data } = await axios.post(`${API_BASE}/api/socratic/chat`, {
            userId: String(userId),
            bookTitle: "Telegram Session",
            author: "SpeakBot Mentor",
            excerpt: "",
            userMessage,
            chatHistory: (conversationHistory[userId] || []).slice(-4),
            targetLanguage,
            mediatorLanguage,
            level,
            userRequestedTranslation: /\b(translate|translation|what does .* mean|переведи|перевод|tərcümə)\b/i.test(userMessage)
        });
        if (data.success && data.reply) {
            if (!conversationHistory[userId]) conversationHistory[userId] = [];
            conversationHistory[userId].push({ role: 'user', content: userMessage });
            conversationHistory[userId].push({ role: 'assistant', content: data.reply });
            await axios.post(`${API_BASE}/api/user/usage`, { userId }).catch(() => { });
            return data.reply;
        }
    } catch (err) {
        console.error('Socratic API failed:', err.message);
    }

    // 3. Fallback: direct Groq → OpenRouter
    if (!conversationHistory[userId]) conversationHistory[userId] = [];
    const history = conversationHistory[userId].slice(-10);

    const systemPrompt = `You are a patient, insightful language tutor. Engage the learner in Socratic dialogue, explain grammar/vocabulary, ask probing questions, and encourage critical thinking. Always respond in the target language (${targetLanguage}) and keep answers concise but rich. Use ${mediatorLanguage} for explanations when needed. Learner's CEFR level: ${level}.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage }
    ];

    let replyText = null;
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.7
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        replyText = response.data.choices[0].message.content;
    } catch (err) {
        console.error('Groq error:', err.message);
        if (OPENROUTER_API_KEY) {
            try {
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'openai/gpt-oss-20b:free',
                    messages
                }, { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` } });
                replyText = response.data.choices[0].message.content;
            } catch (err2) {
                console.error('OpenRouter error:', err2.message);
            }
        }
    }

    if (!replyText) {
        return "Sorry, all AI providers are unavailable right now. Try again in a moment.";
    }

    conversationHistory[userId].push({ role: 'user', content: userMessage });
    conversationHistory[userId].push({ role: 'assistant', content: replyText });
    await axios.post(`${API_BASE}/api/user/usage`, { userId }).catch(e => console.error('Usage increment failed:', e.message));
    return replyText;
}


// ==================== ENHANCED PDF GENERATION ====================
async function generatePdfFromText(text, filename) {
    const doc = new PDFDocument();
    const filePath = path.join(TEMP_DIR, `${filename}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(14).font('Helvetica-Bold').text('SpeakBot Study Material', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(text);
    doc.end();
    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

async function generateStructuredPDF(data, filename, title) {
    const doc = new PDFDocument();
    const filePath = path.join(TEMP_DIR, `${filename}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown();

    if (data.modules) {
        data.modules.forEach(module => {
            doc.fontSize(14).font('Helvetica-Bold').text(module.title);
            doc.fontSize(12).font('Helvetica').text(module.description);
            module.rules?.forEach(rule => {
                doc.fontSize(12).font('Helvetica').text(`• ${rule.rule}: ${rule.explanation}`);
                doc.fontSize(10).font('Helvetica-Oblique').text(`Example: ${rule.example}`);
                doc.moveDown();
            });
            doc.moveDown();
        });
    } else if (data.exercises) {
        data.exercises.forEach((ex, idx) => {
            doc.fontSize(12).font('Helvetica-Bold').text(`${idx + 1}. ${ex.question}`);
            doc.fontSize(11).font('Helvetica').text(`Options: ${ex.options.join(' | ')}`);
            doc.fontSize(10).font('Helvetica-Oblique').text(`Answer: ${ex.options[ex.correctIndex]}`);
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
    // Try web app endpoints first
    const endpoints = {
        grammar: '/api/gemini/generate-grammar-guide',
        roadmap: '/api/gemini/generate-grammar-roadmap',
        listening: '/api/stories/generate-daily-excerpt',
        speaking: '/api/gemini/generate-roadmap',
        reading: '/api/stories/generate-daily-excerpt',
        writing: '/api/gemini/generate-grammar-guide',
        skills: '/api/user/skill-test'
    };
    const endpoint = endpoints[type];
    if (endpoint) {
        try {
            const res = await axios.post(`${API_BASE}${endpoint}`, {
                userId, targetLanguage: targetLang, userLevel: level, mediatorLanguage: mediatorLang, topic
            });
            if (res.data.pdfUrl) return res.data.pdfUrl; // web app already returns PDF
            // Format the returned data into a structured PDF
            const data = res.data;
            return await generateStructuredPDF(data, `speakbot_${type}_${Date.now()}`, type.toUpperCase() + ' Guide');
        } catch (err) {
            console.error(`PDF endpoint error for ${type}:`, err.message);
        }
    }
    // Fallback: generate via AI locally and create PDF
    const aiPrompt = `Generate a comprehensive ${type} study material on "${topic}" for ${targetLang} at CEFR ${level}. Include clear explanations and 5 practice exercises. Return as JSON with keys: title, modules (if applicable) or exercises.`;
    const aiResponse = await getTutorResponse(userId, aiPrompt, targetLang, mediatorLang, level);
    // Parse AI response as JSON (if possible) else plain text
    let data;
    try { data = JSON.parse(aiResponse); } catch (e) { data = { text: aiResponse }; }
    return await generateStructuredPDF(data, `speakbot_${type}_fallback_${Date.now()}`, type.toUpperCase() + ' Guide');
}

// ==================== SYNC ====================
async function syncUser(telegramId, username, language = 'en') {
    await axios.post(`${API_BASE}/api/bot/sync`, {
        userId: String(telegramId), telegramChatId: String(telegramId),
        telegramUsername: `@${username}`, updates: { targetLanguage: language }
    }).catch(e => console.error('Sync error:', e.message));
}

// ==================== INTENT DETECTION ====================
function detectIntent(text) {
    const lower = text.toLowerCase();
    if (lower.includes('grammar')) return 'grammar';
    if (lower.includes('roadmap') || lower.includes('plan')) return 'roadmap';
    if (lower.includes('skill') || lower.includes('test') || lower.includes('level')) return 'skills';
    if (lower.includes('listen')) return 'listening';
    if (lower.includes('speak') || lower.includes('speaking')) return 'speaking';
    if (lower.includes('read')) return 'reading';
    if (lower.includes('write') || lower.includes('writing')) return 'writing';
    if (lower.includes('game') || lower.includes('cubeword')) return 'game';
    return 'tutor';
}

// ==================== USER PROFILE HELPER ====================
async function getUserProfile(userId) {
    const cached = await getUser(String(userId));
    if (cached) return cached;

    try {
        const { data } = await axios.get(`${API_BASE}/api/user/profile`, {
            params: { userId: String(userId) }
        });
        const profile = data.data;
        if (profile) await saveUser(String(userId), profile);
        return profile;
    } catch (err) {
        console.warn('getUserProfile failed:', err.message);
        return { targetLanguage: 'en', currentLevel: 'B1', mediatorLanguage: 'en', xp: 0, skillScores: {} };
    }
}
// ==================== INLINE KEYBOARD FOR PDFs ====================
const pdfMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback('📖 Grammar', 'pdf_grammar'),
        Markup.button.callback('🗺️ Roadmap', 'pdf_roadmap')
    ],
    [
        Markup.button.callback('👂 Listening', 'pdf_listening'),
        Markup.button.callback('🗣️ Speaking', 'pdf_speaking')
    ],
    [
        Markup.button.callback('📚 Reading', 'pdf_reading'),
        Markup.button.callback('✍️ Writing', 'pdf_writing')
    ],
    [Markup.button.callback('❌ Cancel', 'cancel_pdf')]
]);

// ==================== COMMANDS ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    await syncUser(userId, ctx.from.username || 'user');
    ctx.reply('👋 Welcome to SpeakBot! Use /help to see all commands.\nSend me text or voice to interact!',
        Markup.inlineKeyboard([
            [Markup.button.callback('📚 Stories', 'show_stories')],
            [Markup.button.callback('🎮 Games', 'show_games')],
            [Markup.button.callback('📄 PDF Materials', 'pdf_menu')],
            [Markup.button.callback('👤 Profile', 'show_profile')]
        ]));
});

bot.help((ctx) => {
    ctx.reply(`
**Commands:**
/grammar <topic> - Get grammar guide PDF
/roadmap <topic> - Get learning roadmap PDF
/skills - View skill levels
/listen - Get listening material PDF
/speak - Get speaking prompts PDF
/read - Get reading material PDF
/write - Get writing prompts PDF
/leveltest - Take a level placement test
/skilltest <skill> - Take a skill test
/games - List available games
/cubeword - Start CubeWord game
/memory - Start Memory Match game
/wordbuilder - Start Word Builder game
/vocab <word> - Save word to vocabulary
/tts <text> - Text-to-speech
/premium - Upgrade to premium
/profile - Your profile
    `, { parse_mode: 'Markdown' });
});

// PDF menu callback
bot.action('pdf_menu', (ctx) => {
    ctx.reply('Select PDF type:', pdfMenu);
});

// PDF callback handlers
bot.action('pdf_grammar', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating grammar PDF...');
    const pdfPath = await generatePdf('grammar', userId, profile.targetLanguage, profile.currentLevel, profile.mediatorLanguage);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('pdf_roadmap', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating roadmap PDF...');
    const pdfPath = await generatePdf('roadmap', userId, profile.targetLanguage, profile.currentLevel, profile.mediatorLanguage);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('pdf_listening', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating listening PDF...');
    const pdfPath = await generatePdf('listening', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('pdf_speaking', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating speaking PDF...');
    const pdfPath = await generatePdf('speaking', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('pdf_reading', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating reading PDF...');
    const pdfPath = await generatePdf('reading', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('pdf_writing', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating writing PDF...');
    const pdfPath = await generatePdf('writing', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.action('cancel_pdf', (ctx) => ctx.reply('PDF generation cancelled.'));

// Grammar PDF command
bot.command('grammar', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'Basic Grammar';
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    try {
        await ctx.reply('Generating grammar guide...');
        const pdfPath = await generatePdf('grammar', userId, profile.targetLanguage, profile.currentLevel, profile.mediatorLanguage, topic);
        await ctx.replyWithDocument({ source: pdfPath });
        fs.unlinkSync(pdfPath);
    } catch (err) { ctx.reply('Failed to generate grammar guide.'); }
});

// Roadmap PDF command
bot.command('roadmap', async (ctx) => {
    const topic = ctx.message.text.split(' ').slice(1).join(' ') || 'Comprehensive';
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    try {
        await ctx.reply('Generating roadmap...');
        const pdfPath = await generatePdf('roadmap', userId, profile.targetLanguage, profile.currentLevel, profile.mediatorLanguage, topic);
        await ctx.replyWithDocument({ source: pdfPath });
        fs.unlinkSync(pdfPath);
    } catch (err) { ctx.reply('Failed to generate roadmap.'); }
});

// Skills view
bot.command('skills', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    const skills = profile.skillScores || {};
    ctx.reply(`📊 Skill Scores:\n${Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join('\n')}`);
});

// Listening, Speaking, Reading, Writing PDF commands (similar to grammar, we can reuse)
bot.command('listen', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating listening material...');
    const pdfPath = await generatePdf('listening', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.command('speak', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating speaking prompts...');
    const pdfPath = await generatePdf('speaking', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.command('read', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating reading material...');
    const pdfPath = await generatePdf('reading', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

bot.command('write', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await ctx.reply('Generating writing prompts...');
    const pdfPath = await generatePdf('writing', userId, profile.targetLanguage, profile.currentLevel);
    await ctx.replyWithDocument({ source: pdfPath });
    fs.unlinkSync(pdfPath);
});

// Level test (simplified - real test would need interactive questions)
bot.command('leveltest', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply('Starting level test... Send me a short paragraph in your target language and I will evaluate.');
    // For now, we'll ask for input and evaluate later (placeholder)
    ctx.reply('Type a paragraph and I will assess your level.');
});

// Skill test (interactive)
let skillTestState = {};
bot.command('skilltest', async (ctx) => {
    const skill = ctx.message.text.split(' ')[1] || 'grammar';
    const userId = ctx.from.id;
    skillTestState[userId] = { skill, step: 0, score: 0, questions: [] };
    await ctx.reply(`Starting ${skill} test... I'll ask 5 questions.`);
    // Generate questions (fetch from web app or generate via AI)
    const questions = await generateTestQuestions(skill, userId);
    skillTestState[userId].questions = questions;
    await sendNextQuestion(ctx);
});

async function generateTestQuestions(skill, userId) {
    const profile = await getUserProfile(userId);
    const prompt = `Generate 5 multiple-choice ${skill} questions for a ${profile.currentLevel} learner in ${profile.targetLanguage}. Return ONLY valid JSON array with this exact shape: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0}]. No markdown, no explanations, start with [ and end with ].`;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You return only valid JSON. No markdown.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        const content = response.data.choices[0].message.content;
        const clean = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(clean);

        // Groq json_object может вернуть {"questions": [...]}
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.questions)) return parsed.questions;
        return [];
    } catch (e) {
        console.warn('generateTestQuestions failed:', e.message);
        return [];
    }
}

async function sendNextQuestion(ctx) {
    const userId = ctx.from.id;
    const state = skillTestState[userId];
    if (state.step >= state.questions.length) {
        const finalScore = state.score;
        await axios.post(`${API_BASE}/api/user/skill-test`, { userId, skillType: state.skill, score: finalScore });
        delete skillTestState[userId];
        return ctx.reply(`Test finished! Your score: ${finalScore}/${state.questions.length}`);
    }
    const q = state.questions[state.step];
    const optionsText = q.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    await ctx.reply(`Question ${state.step + 1}/${state.questions.length}:\n${q.question}\n\n${optionsText}`);
    // Wait for answer (we'll handle in text message)
    ctx.reply('Reply with the number (1-4) of your answer.');
}

// Handle answer for skill test (in message handler)
// ==================== GAMES ====================
bot.command('games', (ctx) => {
    ctx.reply('🎮 Available Games:\n1. CubeWord\n2. Memory Match\n3. Word Builder');
});

// CubeWord
bot.command('cubeword', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    const { data } = await axios.get(`${API_BASE}/api/cubeword/target-words`, { params: { targetLanguage: profile.targetLanguage } });
    const word = data.targetWords[0];
    activeGames[userId] = { game: 'cubeword', targetWord: word.word };
    ctx.reply(`🧩 Find the word: ${word.clue}\nUse /cubeword <answer>`);
});

// Vocab save
bot.command('vocab', async (ctx) => {
    const word = ctx.message.text.split(' ')[1];
    if (!word) return ctx.reply('Please provide a word: /vocab <word>');
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    await axios.post(`${API_BASE}/api/user/vocabulary`, { userId, targetLanguage: profile.targetLanguage, word, translation: '' });
    ctx.reply(`Saved "${word}" to your vocabulary.`);
});

// TTS
bot.command('tts', async (ctx) => {
    const text = ctx.message.text.replace('/tts', '').trim();
    if (!text) return ctx.reply('Please provide text: `/tts Hello world!`');
    try {
        const webm = await generateVoice(text, 'en-US');
        const ogg = await convertToOgg(webm);
        await ctx.replyWithVoice({ source: ogg });
        fs.unlinkSync(webm); fs.unlinkSync(ogg);
    } catch (err) { ctx.reply('Failed to generate voice note.'); }
});

// Premium
bot.command('premium', async (ctx) => {
    await ctx.telegram.sendInvoice(ctx.chat.id, 'SpeakBot Premium', 'Unlimited access', 'premium_subscription', '{}', 'XTR', [{ label: 'Premium', amount: 5 }]);
});

// Profile
bot.command('profile', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    ctx.reply(`👤 Level: ${profile.currentLevel}\nTarget: ${profile.targetLanguage}\nXP: ${profile.xp || 0}`);
});

bot.command('memory', async (ctx) => {
    const userId = ctx.from.id;
    const targetLanguage = (await getUserProfile(userId)).targetLanguage || 'en';
    try {
        const { data } = await axios.post(`${API_BASE}/api/games/memory/start`, { userId, targetLanguage });
        if (!data || !Array.isArray(data.cards)) {
            return ctx.reply('Memory Match could not be started. Try again later.');
        }
        const cardIds = data.cards.map(c => c.id).join(', ');
        ctx.reply(`Memory Match started! Cards: ${cardIds}. Use /flip <id> to see a card, /match <id1> <id2> to match.`);
    } catch (err) {
        console.error('Memory start error:', err.message);
        ctx.reply('Memory Match failed to start.');
    }
});

bot.command('flip', async (ctx) => {
    const userId = ctx.from.id;
    const cardId = parseInt(ctx.message.text.split(' ')[1]);
    const { data } = await axios.post(`${API_BASE}/api/games/memory/flip`, { userId, cardId });
    ctx.reply(`Card ${cardId}: ${data.word}`);
});

bot.command('match', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('Usage: /match <id1> <id2>');
    const card1 = parseInt(args[1]);
    const card2 = parseInt(args[2]);
    const { data } = await axios.post(`${API_BASE}/api/games/memory/match`, { userId: ctx.from.id, card1, card2 });
    if (data.matched) {
        ctx.reply(`Match! ${data.matchedCount} pairs found.`);
        if (data.gameOver) ctx.reply('🎉 Game over! You found all pairs!');
    } else {
        ctx.reply('❌ Not a match.');
    }
});

bot.command('wordbuilder', async (ctx) => {
    const userId = ctx.from.id;
    const { data } = await axios.post(`${API_BASE}/api/games/wordbuilder/start`, { userId, targetWord: 'LANGUAGE' });
    ctx.reply(`Word Builder started! Target word: ${data.targetWord}. Use /word <word> to submit.`);
});

bot.command('word', async (ctx) => {
    const word = ctx.message.text.split(' ')[1];
    const { data } = await axios.post(`${API_BASE}/api/games/wordbuilder/verify`, { userId: ctx.from.id, word });
    if (data.valid) ctx.reply(`✅ "${word.toUpperCase()}" added! Found words: ${data.foundWords.join(', ')}`);
    else ctx.reply(data.message || 'Invalid word.');
});

// ==================== CALLBACKS ====================
bot.action('show_stories', async (ctx) => {
    const userId = ctx.from.id;
    const { data } = await axios.get(`${API_BASE}/api/stories/custom-list`, { params: { userId, targetLanguage: 'en' } });
    if (data.customStories.length === 0) return ctx.answerCbQuery('No stories yet.');
    ctx.reply(`📖 Your stories:\n${data.customStories.map(s => `• ${s.title}`).join('\n')}`);
});

bot.action('show_games', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🎮 Games: CubeWord, Memory Match, Word Builder. Use /games to see options.');
});

bot.action('show_tts', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Use /tts <text> to get voice.');
});

bot.action('show_profile', async (ctx) => {
    const userId = ctx.from.id;
    const profile = await getUserProfile(userId);
    ctx.reply(`👤 Level: ${profile.currentLevel}\nTarget: ${profile.targetLanguage}\nXP: ${profile.xp || 0}`);
});

// ==================== PRE-CHECKOUT ====================
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

// ==================== MAIN MESSAGE HANDLER ====================
bot.on('message', async (ctx) => {
    // Handle successful payment
    if (ctx.message.successful_payment) {
        await axios.post(`${API_BASE}/api/user/premium`, { userId: String(ctx.from.id), isPremium: true });
        return ctx.reply('🎉 Premium activated! Unlimited access.');
    }

    // Ignore commands (already handled)
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    // Handle text answer for skill test
    if (skillTestState[ctx.from.id] && ctx.message.text && /^\d+$/.test(ctx.message.text)) {
        const userId = ctx.from.id;
        const state = skillTestState[userId];
        const q = state.questions[state.step];
        const answerIndex = parseInt(ctx.message.text) - 1;
        if (answerIndex === q.correctIndex) state.score++;
        state.step++;
        return sendNextQuestion(ctx);
    }

    // Voice
    if (ctx.message.voice) {
        await ctx.reply('🎧 Processing voice...');
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const buffer = (await axios.get(fileUrl, { responseType: 'arraybuffer' })).data;
        const inputPath = path.join(TEMP_DIR, `voice-${Date.now()}.oga`);
        fs.writeFileSync(inputPath, buffer);
        const text = await transcribeAudio(inputPath, 'en');
        fs.unlinkSync(inputPath);

        const intent = detectIntent(text);
        const userId = ctx.from.id;
        const profile = await getUserProfile(userId);

        if (['grammar', 'roadmap', 'skills', 'listening', 'speaking', 'reading', 'writing'].includes(intent)) {
            await ctx.reply(`Understanding: "${text}"\nGenerating ${intent} PDF...`);
            const pdfPath = await generatePdf(intent, userId, profile.targetLanguage, profile.currentLevel, profile.mediatorLanguage);
            await ctx.replyWithDocument({ source: pdfPath });
            fs.unlinkSync(pdfPath);
        } else if (intent === 'game') {
            await ctx.reply('Starting CubeWord...');
            const profile = await getUserProfile(userId);
            const { data } = await axios.get(`${API_BASE}/api/cubeword/target-words`, {
                params: { targetLanguage: profile.targetLanguage }
            });
            const word = data.targetWords[0];
            activeGames[userId] = { game: 'cubeword', targetWord: word.word };
            await ctx.reply(`🧩 Find the word: ${word.clue}\nUse /cubeword <answer>`);
        } else {
            // Normal tutor response with voice
            const reply = await getTutorResponse(userId, text, profile.targetLanguage, profile.mediatorLanguage, profile.currentLevel);
            const webm = await generateVoice(reply, profile.targetLanguage);
            const ogg = await convertToOgg(webm);
            await ctx.replyWithVoice({ source: ogg });
            await ctx.reply(`📝 Transcribed: ${text}\n💬 Voice reply sent.`);
            fs.unlinkSync(webm); fs.unlinkSync(ogg);
        }
    }

    // Text
    if (ctx.message.text) {
        const userId = ctx.from.id;
        const profile = await getUserProfile(userId);
        const reply = await getTutorResponse(userId, ctx.message.text, profile.targetLanguage, profile.mediatorLanguage, profile.currentLevel);
        ctx.reply(reply);
    }
});
// В самом конце bot.cjs
if (require.main === module) {
    bot.launch();
    console.log('Bot is running in standalone mode...');
} else {
    console.log('[Telegram Bot] Loaded as module, skipping launch');
}