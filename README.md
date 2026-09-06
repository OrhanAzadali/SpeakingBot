# Language Immersion Coach — Setup Guide

## What you need

- Node.js 18+ installed on your PC
- A Telegram bot token (from @BotFather)
- A free Groq API key (groq.com)
- A free Vercel account (vercel.com) for hosting the Mini App

---

## STEP 1 — Get your API keys

### Telegram Bot Token

1. Open Telegram, search @BotFather
2. Send /newbot, follow instructions
3. Copy the token it gives you

### Groq API Key (free)

1. Go to console.groq.com
2. Sign up free
3. Click "API Keys" → "Create API Key"
4. Copy the key

---

## STEP 2 — Set up the Bot

```bash
cd bot
npm install
```

Edit the `.env` file:

```
BOT_TOKEN=your_telegram_bot_token
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key   ← optional, powers the 3D Cubic Words game (see Step 3.5)
MINIAPP_URL=https://your-app.vercel.app   ← fill this after Step 3
```

---

## STEP 3 — Deploy the Mini App to Vercel

```bash
cd miniapp
npm install
npm run build
npx vercel deploy --prod
```

Vercel will give you a URL like `https://language-coach-xxx.vercel.app`
Copy that URL and paste it into `bot/.env` as `MINIAPP_URL=`

---

## STEP 3.5 — 3D Cubic Words game

The game (`3D Cubic Words` tile in the Practice Games hub) ships as part of
this app and its own backend routes ride on your existing bot server —
nothing extra to deploy. It just needs a `GEMINI_API_KEY` on the bot service
(Step 2's `.env`) for AI word generation/validation; without one it
automatically falls back to full offline dictionary word lists, so the game
still works even without that key.

---

## STEP 4 — Run the Bot

```bash
cd bot
node index.js
```

You should see: `✅ Language Coach Bot is running!`

---

## STEP 5 — Use the Bot

1. Open your bot in Telegram
2. Send /start
3. Choose your language and level
4. Start chatting — in text or voice!
5. Send /flashcards to review saved words

---

## How it works

- You chat in any language — bot replies in that language
- If you make a mistake → bot corrects you and explains the rule
- Tricky words get saved automatically as flashcards
- /flashcards opens a swipeable card deck (like Duolingo)
- Bot reminds you to review cards when they're due

---

## Web App (standalone, `webapp/`)

In addition to the Telegram bot + Mini App above, this repo also includes a
standalone browser web app under `webapp/` — Roadmaps, Grammar PDFs, Classic
Stories (reading & listening), Placement/Skill tests, an NLP tokenizer, and a
**Games** tab (Flashcards, Word Pairs, 3D Word Quest). It's a separate app
with its own dependencies and build, not part of the `bot`/`miniapp` npm
workspaces above.

```bash
cd webapp
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev
```

For production:

```bash
npm run build   # builds the client (vite) and bundles server.js -> dist/server.cjs
npm start
```

Both the web app and the Telegram Mini App now ship the same set of games
(Flashcards, Word Pairs / Match, and a 3D word game) — implemented
separately per platform rather than sharing one literal codebase, since
they're built on different stacks.

### Classic Stories — language bug fix
Story narration now always sets `utterance.lang` explicitly and waits for the
browser's voice list to finish loading before picking a voice. Previously,
`speechSynthesis.getVoices()` could return an empty list on the very first
call (voices load asynchronously in most browsers), which silently left the
narrator on the OS/browser's default voice — the actual cause of narration
sometimes coming out in German or another wrong language regardless of the
story's real target language. Switching target language now reliably swaps
to a story in that language.
