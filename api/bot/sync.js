// bot.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BASE = process.env.API_URL || 'http://localhost:3000';

// Ensure temp directory exists for audio files
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Function to generate TTS using msedge-tts
async function generateVoiceNote(text, lang = 'en-US') {
    const tts = new MsEdgeTTS();
    // Choose a voice based on the language code (you can map more languages)
    const voiceMap = {
        'en-US': 'en-US-AriaNeural',
        'ru-RU': 'ru-RU-SvetlanaNeural',
        'de-DE': 'de-DE-KatjaNeural',
        'fr-FR': 'fr-FR-DeniseNeural',
        'es-ES': 'es-ES-ElviraNeural'
    };
    const voice = voiceMap[lang] || 'en-US-AriaNeural';

    await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
    const filePath = path.join(TEMP_DIR, `tts-${Date.now()}.webm`);
    await tts.toFile(filePath, text);
    return filePath;
}

// Command: /start
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    try {
        // Sync user with web app
        await axios.post(`${API_BASE}/api/bot/sync`, {
            userId: String(userId),
            telegramChatId: String(ctx.chat.id),
            telegramUsername: `@${ctx.from.username || 'user'}`
        });
    } catch (err) {
        console.error('Sync error:', err.message);
    }

    ctx.reply('Welcome to SpeakBot! Use /menu to see options, or /help for commands.',
        Markup.inlineKeyboard([
            [Markup.button.callback('📚 My Stories', 'show_stories')],
            [Markup.button.callback('🔊 Text to Speech', 'show_tts')]
        ])
    );
});

// Command: /menu
bot.command('menu', async (ctx) => {
    ctx.reply('Choose an option:', Markup.inlineKeyboard([
        [
            Markup.button.callback('📚 My Stories', 'show_stories'),
            Markup.button.callback('🎮 Games', 'show_games')
        ],
        [
            Markup.button.callback('🔊 TTS', 'show_tts'),
            Markup.button.callback('👤 Profile', 'show_profile')
        ]
    ]));
});

// Command: /tts
bot.command('tts', async (ctx) => {
    const text = ctx.message.text.replace('/tts', '').trim();
    if (!text) {
        return ctx.reply('Please provide text: `/tts Hello world!`', { parse_mode: 'Markdown' });
    }

    try {
        ctx.reply('Generating voice note...');
        const filePath = await generateVoiceNote(text, 'en-US');
        // Send as voice message (Telegram expects OGG with Opus, but accepts WEBM)
        await ctx.replyWithVoice({ source: filePath });
        fs.unlinkSync(filePath); // Cleanup
    } catch (err) {
        console.error('TTS error:', err);
        ctx.reply('Failed to generate voice note.');
    }
});

// Handle callbacks
bot.action('show_stories', async (ctx) => {
    const userId = ctx.from.id;
    try {
        // Fetch stories from web app API
        const { data } = await axios.get(`${API_BASE}/api/stories/custom-list`, {
            params: { userId: String(userId), targetLanguage: 'English' }
        });

        if (data.customStories.length === 0) {
            return ctx.answerCbQuery('No stories found. Upload a PDF in the web app!');
        }

        const storyList = data.customStories.map(s => `📖 ${s.title}`).join('\n');
        ctx.reply(`Your stories:\n${storyList}`);
    } catch (err) {
        console.error('Error fetching stories:', err);
        ctx.answerCbQuery('Failed to load stories.');
    }
});

bot.action('show_tts', async (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Use `/tts your text here` to generate a voice note.', { parse_mode: 'Markdown' });
});

bot.action('show_profile', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const { data } = await axios.get(`${API_BASE}/api/user/profile`, {
            params: { userId: String(userId) }
        });
        const profile = data.data;
        ctx.reply(`👤 Profile\nTarget Language: ${profile.targetLanguage}\nLevel: ${profile.currentLevel}\nXP: ${profile.xp || 0}`);
    } catch (err) {
        ctx.answerCbQuery('Profile unavailable.');
    }
});

bot.launch();