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
        // Language switch detection (голосом)
        await ctx.reply(`📝 Heard: "${text}"`);

        const userId = ctx.from.id;
        const p = await getUserProfile(userId);
        // ── 0. Catch tutor's SWITCH_REQUEST marker (belt-and-suspenders) ──
        if (/^SWITCH_REQUEST::/i.test((ctx.message.text || '').trim())) {
            const m = ctx.message.text.match(/SWITCH_REQUEST::([A-Za-zÀ-ÿ]+)/);
            if (m && m[1]) {
                const lang = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
                return await handleLanguageSwitch(ctx, lang);
            }
        }
        // Fast regex
        const langSwitch = detectLanguageSwitchIntent(text);
        if (langSwitch) {
            return await handleLanguageSwitch(ctx, langSwitch);
        }

        // How-to
        if (detectHowToIntent(text)) {
            return await ctx.reply(
                `🎯 Open the Mini App and go to *Profile* to change settings. Or say "switch to German".`,
                { parse_mode: 'Markdown' }
            );
        }

        // AI classifier для voice тоже
        if (looksLikeLanguageRequest(text)) {
            const aiIntent = await classifyIntentWithAI(text, p.targetLanguage, p.mediatorLanguage);
            if (aiIntent?.intent === 'switch_language' && aiIntent.language) {
                return await handleLanguageSwitch(ctx, aiIntent.language);
            }
        }

        const intent = detectIntent(text);

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
    const text = ctx.message.text;
    const userId = ctx.from.id;
    const p = await getUserProfile(userId);

    // ── 1. Fast regex check (без AI) ──
    const fastSwitch = detectLanguageSwitchIntent(text);
    if (fastSwitch) {
        return await handleLanguageSwitch(ctx, fastSwitch);
    }

    // ── 2. How-to intent (regex) ──
    if (detectHowToIntent(text)) {
        return await ctx.reply(
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
    }

    // ── 3. AI intent classifier (только для подозрительных коротких сообщений) ──
    if (looksLikeLanguageRequest(text)) {
        const aiIntent = await classifyIntentWithAI(text, p.targetLanguage, p.mediatorLanguage);

        if (aiIntent?.intent === 'switch_language' && aiIntent.language) {
            console.log(`[Intent] AI detected switch to ${aiIntent.language}`);
            return await handleLanguageSwitch(ctx, aiIntent.language);
        }

        if (aiIntent?.intent === 'switch_mediator' && aiIntent.language) {
            // Смена mediator — отдельный endpoint
            try {
                await axios.post(`${API_BASE}/api/user/mediator-language`, {
                    userId: String(userId),
                    mediatorLanguage: aiIntent.language.toLowerCase().slice(0, 2),
                }, { timeout: 8000 });
                const cached = await getUser(String(userId));
                if (cached) {
                    cached.mediatorLanguage = aiIntent.language;
                    await saveUser(String(userId), cached);
                }
                return await ctx.reply(
                    `✅ Mediator language switched to *${aiIntent.language}*.\n\nExplanations will now be in ${aiIntent.language}.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.error('Mediator switch failed:', e.message);
                return ctx.reply('Failed to switch mediator language.');
            }
        }
    }

    // ── 4. Fallback: Socratic AI ──
    const reply = await getTutorResponse(userId, text, p.targetLanguage, p.mediatorLanguage, p.currentLevel);
    await ctx.reply(reply);
}