require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BASE = process.env.API_URL || 'http://localhost:3000';

bot.start((ctx) => {
    ctx.reply('Welcome to SpeakBot! Choose your target language:', Markup.keyboard([
        ['🇬🇧 English', '🇩🇪 German', '🇫🇷 French']
    ]).resize());
});

bot.hears(/🇬🇧|🇩🇪|🇫🇷/, async (ctx) => {
    const lang = ctx.message.text.includes('🇬🇧') ? 'en' :
        ctx.message.text.includes('🇩🇪') ? 'de' : 'fr';
    const userId = ctx.from.id;

    // Fetch stories for the selected language from your API
    const { data } = await axios.get(`${API_BASE}/api/stories/custom-list`, {
        params: { userId, targetLanguage: lang }
    });

    ctx.reply('Your stories are ready!', Markup.inlineKeyboard([
        [Markup.button.webApp('Open Mini App', `https://your-miniapp-url.com?lang=${lang}&userId=${userId}`)]
    ]));
});

bot.launch();