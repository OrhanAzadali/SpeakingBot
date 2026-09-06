import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3e3;
app.use(express.json({ limit: "10mb" }));
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
async function callGeminiWithResilience(prompt, preferredModel = "gemini-3.8-flash", fallbackModels = ["gemini-flash-latest", "gemini-3.1-flash-lite"]) {
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
        setTimeout(() => reject(new Error("TIMEOUT_503_SPIKE")), 4500);
      });
      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      const isCapacityIssue = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("TIMEOUT_503_SPIKE");
      if (isCapacityIssue) {
        console.warn(`[SpeakBot AI Engine] ${model} experiencing temporary high demand/timeout (503/429). Attempting fallback...`);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      console.warn(`[SpeakBot AI Engine] Request on ${model} not completed (${msg.slice(0, 80)}). Activating local engine.`);
      break;
    }
  }
  return null;
}
const syncedUsersDatabase = {
  "default-user": {
    userId: "usr_speakbot_84920482",
    telegramUsername: "@speakbot_learner",
    currentLevel: "B1",
    targetLanguage: "English",
    mediatorLanguage: "az",
    // Default Azerbaijani, interchangeable with ru, tr, es, en
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
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
};
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverTime: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/user/profile", (req, res) => {
  const userId = req.query.userId || "default-user";
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  res.json({
    success: true,
    data: syncedUsersDatabase[userId]
  });
});
app.post("/api/user/mediator-language", (req, res) => {
  const { userId = "default-user", mediatorLanguage, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  syncedUsersDatabase[userId].mediatorLanguage = mediatorLanguage;
  syncedUsersDatabase[userId].lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[SYNC] Mediator language updated to ${mediatorLanguage} from ${source} for user ${userId}. Synced to Telegram Bot state.`);
  res.json({
    success: true,
    message: "Mediator language updated and synchronized across WebApp, MiniApp, and Telegram Bot",
    data: syncedUsersDatabase[userId]
  });
});
app.post("/api/user/level-test", (req, res) => {
  const { userId = "default-user", level, score, testType = "Diagnostic Level Test", source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  user.currentLevel = level;
  user.overallScore = score;
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType,
    level,
    score,
    source
  });
  res.json({
    success: true,
    message: `Level updated to ${level} and synced with Telegram bot data`,
    data: user
  });
});
app.post("/api/user/skill-test", (req, res) => {
  const { userId = "default-user", skill, level, score, scoreDelta, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  if (!user.skillScores) {
    user.skillScores = {
      grammar: user.skillLevels?.grammar?.score ?? 65,
      vocabulary: user.skillLevels?.vocabulary?.score ?? 72,
      listening: user.skillLevels?.listening?.score ?? 68,
      reading: user.skillLevels?.reading?.score ?? 75,
      speaking: user.skillLevels?.speaking?.score ?? 60
    };
  }
  if (skill in user.skillLevels) {
    const currentScore = user.skillScores[skill] ?? 70;
    const finalScore = score !== void 0 ? score : Math.min(100, Math.max(20, currentScore + (scoreDelta || 0)));
    const finalLevel = level || (finalScore >= 85 ? "C1" : finalScore >= 70 ? "B2" : finalScore >= 50 ? "B1" : "A2");
    user.skillLevels[skill] = {
      level: finalLevel,
      score: finalScore,
      lastTested: (/* @__PURE__ */ new Date()).toISOString()
    };
    user.skillScores[skill] = finalScore;
  }
  const skills = Object.values(user.skillLevels);
  const avgScore = Math.round(skills.reduce((sum, s) => sum + s.score, 0) / skills.length);
  user.overallScore = avgScore;
  if (avgScore >= 90) user.currentLevel = "C2";
  else if (avgScore >= 80) user.currentLevel = "C1";
  else if (avgScore >= 65) user.currentLevel = "B2";
  else if (avgScore >= 50) user.currentLevel = "B1";
  else if (avgScore >= 35) user.currentLevel = "A2";
  else user.currentLevel = "A1";
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType: `${String(skill).toUpperCase()} Skill Test`,
    level: user.skillLevels[skill]?.level || "B1",
    score: user.skillScores[skill] || 70,
    source
  });
  res.json({
    success: true,
    message: `${skill} test synced successfully. Overall level adjusted to ${user.currentLevel}`,
    data: user
  });
});
app.post("/api/user/target-language", (req, res) => {
  const { userId = "default-user", targetLanguage, source = "webapp" } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  user.targetLanguage = targetLanguage || "English";
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[SYNC] Target language updated to ${user.targetLanguage} from ${source} for user ${userId}. Tangibly synced to Telegram Bot.`);
  res.json({
    success: true,
    message: `Target language set to ${user.targetLanguage} and synchronized across WebApp, MiniApp, and Telegram Bot`,
    data: user
  });
});
app.post("/api/stories/progress", (req, res) => {
  const {
    userId = "default-user",
    storyId,
    storyTitle = "Classic Story",
    author = "Classic Author",
    mode = "reading",
    score = 85,
    scoreDelta = 4,
    source = "webapp"
  } = req.body;
  if (!syncedUsersDatabase[userId]) {
    syncedUsersDatabase[userId] = { ...syncedUsersDatabase["default-user"], userId };
  }
  const user = syncedUsersDatabase[userId];
  const skillKey = mode === "listening" ? "listening" : "reading";
  const currentSkillScore = user.skillScores?.[skillKey] ?? 70;
  const newScore = Math.min(100, Math.max(20, currentSkillScore + scoreDelta));
  if (!user.skillScores) {
    user.skillScores = { grammar: 65, vocabulary: 72, listening: 68, reading: 75, speaking: 60 };
  }
  user.skillScores[skillKey] = newScore;
  if (user.skillLevels?.[skillKey]) {
    user.skillLevels[skillKey].score = newScore;
    user.skillLevels[skillKey].lastTested = (/* @__PURE__ */ new Date()).toISOString();
  }
  const skills = Object.values(user.skillScores);
  const avgScore = Math.round(skills.reduce((sum, s) => sum + s, 0) / skills.length);
  user.overallScore = avgScore;
  if (avgScore >= 90) user.currentLevel = "C2";
  else if (avgScore >= 80) user.currentLevel = "C1";
  else if (avgScore >= 65) user.currentLevel = "B2";
  else if (avgScore >= 50) user.currentLevel = "B1";
  else if (avgScore >= 35) user.currentLevel = "A2";
  else user.currentLevel = "A1";
  user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.testHistory.unshift({
    date: (/* @__PURE__ */ new Date()).toISOString(),
    testType: `Classic ${mode === "listening" ? "Audio Listening" : "Reading"}: ${author}`,
    level: user.currentLevel,
    score,
    source
  });
  console.log(`[SYNC] ${mode} story "${storyTitle}" by ${author} completed with score ${score}%. Updated ${skillKey} to ${newScore}%. Synced to Telegram Bot.`);
  res.json({
    success: true,
    message: `Story progress saved. ${skillKey} score boosted to ${newScore}% and synced to @SpeakBot.`,
    data: user
  });
});
app.get("/api/bot/sync", (req, res) => {
  const userId = req.query.userId || "default-user";
  const user = syncedUsersDatabase[userId] || syncedUsersDatabase["default-user"];
  res.json({
    synced: true,
    userState: user,
    botStatus: "CONNECTED",
    telegramChatId: "84920482",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/bot/sync", (req, res) => {
  const { userId = "default-user", botUpdate } = req.body;
  const user = syncedUsersDatabase[userId] || syncedUsersDatabase["default-user"];
  if (botUpdate) {
    if (botUpdate.mediatorLanguage) user.mediatorLanguage = botUpdate.mediatorLanguage;
    if (botUpdate.targetLanguage) user.targetLanguage = botUpdate.targetLanguage;
    if (botUpdate.currentLevel) user.currentLevel = botUpdate.currentLevel;
    if (botUpdate.skillScores) user.skillScores = { ...user.skillScores, ...botUpdate.skillScores };
    user.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  res.json({
    synced: true,
    userState: user,
    botStatus: "CONNECTED",
    telegramChatId: "84920482",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
const userPersonalizedRoadmaps = {};
app.post("/api/gemini/generate-grammar-roadmap", async (req, res) => {
  const {
    userId = "default-user",
    grammarScore = 70,
    testedConcepts = ["Conditionals", "Inversion", "Subjunctive"],
    targetLanguage = "English",
    mediatorLanguage = "az",
    level = "B1"
  } = req.body;
  try {
    const prompt = `You are SpeakBot's Chief Pedagogical Curriculum Designer.
The learner just finished a Grammar Skill Test for ${targetLanguage} at CEFR Level ${level}.
Test Result: Score = ${grammarScore}%.
Tested Grammar Concepts: ${JSON.stringify(testedConcepts)}.
Mediator Language for explanations: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English).

Generate a STRICTLY PERSONALIZED learning roadmap specifically targeting the gaps and next-level mastery needed based on this test outcome (${grammarScore}%).
If the score is <75%, focus heavily on remedial rules, common pitfalls, and targeted drills.
If the score is >=75%, focus on advanced nuances, stylistic inversion, and formal discourse.

Return strictly JSON with this schema:
{
  "title": "Personalized Grammar Roadmap title",
  "category": "Grammar",
  "level": "${level}",
  "estimatedDuration": "2 Weeks \u2022 4 Milestones",
  "summary": "Brief summary of how this roadmap targets the test results",
  "tags": ["Personalized", "Grammar Test Recovery", "Tested Concepts"],
  "milestones": [
    {
      "step": 1,
      "title": "Milestone Title",
      "description": "Pedagogical objective",
      "grammarPoint": "Rule formula",
      "sampleSentence": "Exemplary sentence",
      "tokens": [
        {
          "text": "word",
          "lemma": "lemma",
          "pos": "NOUN",
          "syntaxRole": "Subject",
          "cefrLevel": "${level}",
          "ipa": "/w\u025C\u02D0d/",
          "mediatorTranslation": "translation in ${mediatorLanguage}"
        }
      ]
    }
  ],
  "checkpointQuestions": [
    {
      "question": "Question testing the weakness",
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "correctIndex": 0,
      "explanation": "Clear explanation"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.milestones) {
        const fullRoadmap = {
          ...parsedData,
          id: `roadmap-personalized-grammar-${Date.now()}`,
          isAiGenerated: true,
          isGrammarPersonalized: true,
          personalizedGrammarMeta: {
            grammarScore,
            testedConcepts,
            generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            targetSkillDelta: `+${Math.max(5, 100 - grammarScore)}% target boost`
          }
        };
        if (!userPersonalizedRoadmaps[userId]) userPersonalizedRoadmaps[userId] = [];
        userPersonalizedRoadmaps[userId].unshift(fullRoadmap);
        return res.json({
          success: true,
          data: fullRoadmap
        });
      }
    }
  } catch (err) {
    console.warn("[SpeakBot Grammar Roadmap] Serving fallback personalized roadmap:", err?.message || err);
  }
  const fallbackPersonalizedRoadmap = getFallbackPersonalizedGrammarRoadmap(
    grammarScore,
    testedConcepts,
    targetLanguage,
    mediatorLanguage,
    level
  );
  if (!userPersonalizedRoadmaps[userId]) userPersonalizedRoadmaps[userId] = [];
  userPersonalizedRoadmaps[userId].unshift(fallbackPersonalizedRoadmap);
  res.json({
    success: true,
    data: fallbackPersonalizedRoadmap,
    fallback: true
  });
});
app.post("/api/gemini/generate-roadmap", async (req, res) => {
  try {
    const {
      topic,
      level = "B1",
      targetLanguage = "English",
      mediatorLanguage = "az",
      customGoal = ""
    } = req.body;
    const ai = getGeminiClient();
    const prompt = `You are the lead linguistic curriculum architect for SpeakBot.
Generate a structured learning Roadmap for a learner studying ${targetLanguage}.
Topic: "${topic}"
Target CEFR Level: ${level}
Learner's Mediator (Instruction) Language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English)
Learner goal: ${customGoal || "Mastery and fluent practical usage"}

Include:
1. Title and engaging description
2. Estimated study duration (e.g. "4 Weeks", "12 Hours")
3. 4 comprehensive milestones/steps with learning objectives, detailed linguistic rules, and practical examples.
4. Key study sentences with full NLP tokenization breakdown for each word (text, lemma, pos, syntaxRole, cefrLevel, ipa, mediatorTranslation).
5. 3 practical checkpoint quiz questions.

Return STRICT JSON adhering to this schema. Do not wrap in markdown quotes if possible or ensure clean json:
{
  "title": "string",
  "category": "Grammar" | "Vocabulary" | "Conversational" | "Tenses" | "Business",
  "level": "${level}",
  "estimatedDuration": "string",
  "summary": "string",
  "milestones": [
    {
      "step": 1,
      "title": "string",
      "description": "string",
      "grammarPoint": "string",
      "sampleSentence": "string",
      "tokens": [
        {
          "text": "string",
          "lemma": "string",
          "pos": "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "AUX" | "DET",
          "syntaxRole": "string",
          "cefrLevel": "string",
          "ipa": "string",
          "mediatorTranslation": "string"
        }
      ]
    }
  ],
  "checkpointQuestions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.milestones) {
        return res.json({
          success: true,
          data: parsedData
        });
      }
    }
    res.json({
      success: true,
      data: getFallbackRoadmap(req.body.topic, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  } catch (error) {
    console.warn("[SpeakBot] Serving fallback roadmap:", error?.message || error);
    res.json({
      success: true,
      data: getFallbackRoadmap(req.body.topic, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  }
});
app.post("/api/gemini/generate-grammar-guide", async (req, res) => {
  try {
    const {
      title,
      level = "B1",
      category = "Grammar",
      mediatorLanguage = "az"
    } = req.body;
    const prompt = `You are SpeakBot's chief grammar and linguistic material creator.
Generate a complete, printable study guide PDF content for:
Topic: "${title}"
Category: ${category}
CEFR Level: ${level}
Mediator Language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English)

Return strict JSON:
{
  "title": "string",
  "category": "${category}",
  "level": "${level}",
  "pagesCount": 3,
  "summary": "string",
  "coreRules": [
    {
      "ruleTitle": "string",
      "explanationInMediator": "string",
      "formula": "string",
      "example": "string",
      "tokens": [
        {
          "text": "string",
          "lemma": "string",
          "pos": "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "AUX" | "DET",
          "syntaxRole": "string",
          "cefrLevel": "string",
          "ipa": "string",
          "mediatorTranslation": "string"
        }
      ]
    }
  ],
  "commonMistakes": [
    {
      "incorrect": "string",
      "correct": "string",
      "reason": "string"
    }
  ],
  "practiceExercises": [
    {
      "instruction": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;
    const rawResponse = await callGeminiWithResilience(prompt);
    if (rawResponse) {
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      if (parsedData && parsedData.coreRules) {
        return res.json({
          success: true,
          data: parsedData
        });
      }
    }
    res.json({
      success: true,
      data: getFallbackGrammarGuide(req.body.title, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  } catch (error) {
    console.warn("[SpeakBot] Serving fallback grammar guide:", error?.message || error);
    res.json({
      success: true,
      data: getFallbackGrammarGuide(req.body.title, req.body.level, req.body.mediatorLanguage),
      fallback: true
    });
  }
});
app.post("/api/gemini/tokenize", async (req, res) => {
  const { sentence, mediatorLanguage = "az" } = req.body;
  if (!sentence) {
    return res.status(400).json({ error: "Sentence is required" });
  }
  try {
    const prompt = `Analyze this sentence from an NLP and linguistic perspective: "${sentence}"
Learner mediator language: ${mediatorLanguage} (az: Azerbaijani, ru: Russian, tr: Turkish, es: Spanish, en: English).

Provide deep morphological and syntactic tokenization for every word token in strict JSON:
{
  "tokens": [
    {
      "text": "word",
      "lemma": "dictionary base form",
      "pos": "NOUN | VERB | ADJ | ADV | PRON | PREP | CONJ | AUX | DET | PUNCT",
      "syntaxRole": "Subject | Predicate | Direct Object | Indirect Object | Modifier | Prepositional Complement | Determiner",
      "cefrLevel": "A1 | A2 | B1 | B2 | C1 | C2",
      "ipa": "/phonetic transcription/",
      "mediatorTranslation": "translation in mediator language",
      "morphology": "e.g. 3rd person singular, present perfect, irregular plural"
    }
  ],
  "syntaxSummary": "string",
  "grammarRulesApplicable": ["string"]
}`;
    const rawResult = await callGeminiWithResilience(prompt);
    if (rawResult) {
      const cleanJson = rawResult.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.tokens) && parsed.tokens.length > 0) {
        return res.json({ success: true, data: parsed });
      }
    }
  } catch (err) {
    console.warn("[SpeakBot Tokenizer] Serving linguistic fallback:", err?.message || err);
  }
  res.json({
    success: true,
    data: {
      tokens: defaultTokenizeSentence(sentence, mediatorLanguage),
      syntaxSummary: "Linguistic parsing and morphological decomposition synthesized by SpeakBot Rule-Engine",
      grammarRulesApplicable: [
        "Standard English Syntax & Word Order (SVO)",
        "Syntactic Constituent and Dependency Roles",
        "Morphological Inflection & Concord"
      ]
    },
    fallback: true
  });
});
function getFallbackRoadmap(topic, level, mediator) {
  return {
    title: topic || "Mastering Advanced English Structures",
    category: "Grammar",
    level: level || "B1",
    estimatedDuration: "3 Weeks \u2022 15 Lessons",
    summary: `Structured comprehensive roadmap designed to elevate your proficiency to ${level} with step-by-step milestones, active tokenized sentences, and interactive checkpoints.`,
    milestones: [
      {
        step: 1,
        title: "Foundational Mechanics & Patterns",
        description: "Understand the underlying structural components and syntax rules.",
        grammarPoint: "Core sentence clauses and verb agreement",
        sampleSentence: "Effective learners consistently analyze linguistic patterns.",
        tokens: [
          { text: "Effective", lemma: "effective", pos: "ADJ", syntaxRole: "Modifier", cefrLevel: "B1", ipa: "/\u026A\u02C8fekt\u026Av/", mediatorTranslation: mediator === "az" ? "Effektiv / t\u0259sirli" : mediator === "ru" ? "\u042D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u0435" : "Effective" },
          { text: "learners", lemma: "learner", pos: "NOUN", syntaxRole: "Subject", cefrLevel: "A2", ipa: "/\u02C8l\u025C\u02D0n\u0259z/", mediatorTranslation: mediator === "az" ? "\xF6yr\u0259n\u0259nl\u0259r" : mediator === "ru" ? "\u0443\u0447\u0430\u0449\u0438\u0435\u0441\u044F" : "learners" },
          { text: "consistently", lemma: "consistently", pos: "ADV", syntaxRole: "Adverbial Modifier", cefrLevel: "B2", ipa: "/k\u0259n\u02C8s\u026Ast\u0259ntli/", mediatorTranslation: mediator === "az" ? "ard\u0131c\u0131l olaraq" : mediator === "ru" ? "\u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E" : "consistently" },
          { text: "analyze", lemma: "analyze", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "B2", ipa: "/\u02C8\xE6n\u0259la\u026Az/", mediatorTranslation: mediator === "az" ? "t\u0259hlil edirl\u0259r" : mediator === "ru" ? "\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u044E\u0442" : "analyze" },
          { text: "linguistic", lemma: "linguistic", pos: "ADJ", syntaxRole: "Attribute", cefrLevel: "C1", ipa: "/l\u026A\u014B\u02C8\u0261w\u026Ast\u026Ak/", mediatorTranslation: mediator === "az" ? "linqvistik / dil\xE7ilik" : mediator === "ru" ? "\u043B\u0438\u043D\u0433\u0432\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435" : "linguistic" },
          { text: "patterns", lemma: "pattern", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B1", ipa: "/\u02C8p\xE6t\u0259nz/", mediatorTranslation: mediator === "az" ? "modell\u0259ri / qanunauy\u011Funluqlar\u0131" : mediator === "ru" ? "\u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B" : "patterns" }
        ]
      },
      {
        step: 2,
        title: "Nuance & Collocations",
        description: "Differentiating subtle register contrasts and natural phrasing in real dialogues.",
        grammarPoint: "Prepositional verb collocations and discourse markers",
        sampleSentence: "We must adapt our communication to diverse contexts.",
        tokens: [
          { text: "We", lemma: "we", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/wi\u02D0/", mediatorTranslation: mediator === "az" ? "Biz" : "We" },
          { text: "must", lemma: "must", pos: "AUX", syntaxRole: "Modal Auxiliary", cefrLevel: "A2", ipa: "/m\u028Cst/", mediatorTranslation: mediator === "az" ? "m\u0259cburuq / -mal\u0131y\u0131q" : "must" },
          { text: "adapt", lemma: "adapt", pos: "VERB", syntaxRole: "Predicate", cefrLevel: "B2", ipa: "/\u0259\u02C8d\xE6pt/", mediatorTranslation: mediator === "az" ? "uy\u011Funla\u015Fd\u0131rmaq" : "adapt" },
          { text: "our", lemma: "our", pos: "DET", syntaxRole: "Possessive Determiner", cefrLevel: "A1", ipa: "/\u02C8a\u028A\u0259/", mediatorTranslation: mediator === "az" ? "bizim" : "our" },
          { text: "communication", lemma: "communication", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B1", ipa: "/k\u0259\u02CCmju\u02D0n\u026A\u02C8ke\u026A\u0283n/", mediatorTranslation: mediator === "az" ? "\xFCnsiyy\u0259timizi" : "communication" }
        ]
      }
    ],
    checkpointQuestions: [
      {
        question: 'Which word in "Effective learners consistently analyze linguistic patterns" acts as the Subject?',
        options: ["Effective", "learners", "consistently", "patterns"],
        correctIndex: 1,
        explanation: '"Learners" is the plural noun performing the action, serving as the grammatical subject.'
      }
    ]
  };
}
function getFallbackGrammarGuide(title, level, mediator) {
  return {
    title: title || "Comprehensive Grammar Study Guide",
    category: "Grammar",
    level: level || "B1",
    pagesCount: 3,
    summary: `Complete grammatical reference breakdown with structural formulas, tokenized sentence breakdowns, and high-frequency exam exercises.`,
    coreRules: [
      {
        ruleTitle: "Rule 1: Syntactic Order and Aspect Precision",
        explanationInMediator: mediator === "az" ? "\u0130ngilis dilind\u0259 c\xFCml\u0259 qurulu\u015Fu ad\u0259t\u0259n M\xFCbt\u0259da + X\u0259b\u0259r + Tamaml\u0131q (SVO) s\u0131ras\u0131na riay\u0259t edir." : "English standard sentences adhere to the Subject + Verb + Object sequence.",
        formula: "Subject + Auxiliary Verb + Main Verb (Aspectual Form) + Object",
        example: "She has completed the complex assessment successfully.",
        tokens: [
          { text: "She", lemma: "she", pos: "PRON", syntaxRole: "Subject", cefrLevel: "A1", ipa: "/\u0283i\u02D0/", mediatorTranslation: mediator === "az" ? "O (qad\u0131n)" : "She" },
          { text: "has", lemma: "have", pos: "AUX", syntaxRole: "Auxiliary Verb", cefrLevel: "A2", ipa: "/h\xE6z/", mediatorTranslation: mediator === "az" ? "(bitmi\u015Flik k\xF6m\u0259k\xE7isi)" : "has" },
          { text: "completed", lemma: "complete", pos: "VERB", syntaxRole: "Main Verb", cefrLevel: "B1", ipa: "/k\u0259m\u02C8pli\u02D0t\u026Ad/", mediatorTranslation: mediator === "az" ? "tamamlay\u0131b" : "completed" },
          { text: "the", lemma: "the", pos: "DET", syntaxRole: "Definite Article", cefrLevel: "A1", ipa: "/\xF0\u0259/", mediatorTranslation: mediator === "az" ? "m\xFC\u0259yy\u0259nlik artikli" : "the" },
          { text: "complex", lemma: "complex", pos: "ADJ", syntaxRole: "Attribute", cefrLevel: "B2", ipa: "/\u02C8k\u0252mpleks/", mediatorTranslation: mediator === "az" ? "m\xFCr\u0259kk\u0259b" : "complex" },
          { text: "assessment", lemma: "assessment", pos: "NOUN", syntaxRole: "Direct Object", cefrLevel: "B2", ipa: "/\u0259\u02C8sesm\u0259nt/", mediatorTranslation: mediator === "az" ? "qiym\u0259tl\u0259ndirm\u0259ni" : "assessment" },
          { text: "successfully", lemma: "successfully", pos: "ADV", syntaxRole: "Adverbial of Manner", cefrLevel: "B1", ipa: "/s\u0259k\u02C8sesf\u0259li/", mediatorTranslation: mediator === "az" ? "u\u011Furla" : "successfully" }
        ]
      }
    ],
    commonMistakes: [
      {
        incorrect: "She has completed the test yesterday.",
        correct: "She completed the test yesterday.",
        reason: 'Specific past time indicators (like "yesterday") require Simple Past rather than Present Perfect.'
      }
    ],
    practiceExercises: [
      {
        instruction: "Choose the grammatically sound verb aspect for the sentence.",
        question: "By the time the professor arrived, the students _____ their assignment.",
        options: ["already finished", "had already finished", "have already finished", "were finishing"],
        correctIndex: 1,
        explanation: 'The past event occurring prior to another past event requires Past Perfect ("had already finished").'
      }
    ]
  };
}
const SERVER_LEXICON = {
  if: {
    lemma: "if",
    pos: "CONJ",
    syntaxRole: "Subordinating Conjunction",
    cefrLevel: "A1",
    ipa: "/\u026Af/",
    morphology: "Conditional Subordinator",
    translations: { az: "\u0259g\u0259r", ru: "\u0435\u0441\u043B\u0438", tr: "e\u011Fer", es: "si", en: "if" }
  },
  you: {
    lemma: "you",
    pos: "PRON",
    syntaxRole: "Subject",
    cefrLevel: "A1",
    ipa: "/ju\u02D0/",
    morphology: "Personal Pronoun, 2nd Person Nominative",
    translations: { az: "s\u0259n / siz", ru: "\u0442\u044B / \u0432\u044B", tr: "sen / siz", es: "t\xFA / usted", en: "you" }
  },
  consistently: {
    lemma: "consistently",
    pos: "ADV",
    syntaxRole: "Adverbial Modifier",
    cefrLevel: "B2",
    ipa: "/k\u0259n\u02C8s\u026Ast\u0259ntli/",
    morphology: "Manner Adverb, Derived from Adj + -ly",
    translations: { az: "ard\u0131c\u0131l / m\xFCt\u0259madi olaraq", ru: "\u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E", tr: "tutarl\u0131 bir \u015Fekilde", es: "constantemente", en: "consistently" }
  },
  analyze: {
    lemma: "analyze",
    pos: "VERB",
    syntaxRole: "Predicate",
    cefrLevel: "B2",
    ipa: "/\u02C8\xE6n\u0259la\u026Az/",
    morphology: "Verb, Base Form, Active Voice",
    translations: { az: "t\u0259hlil etm\u0259k / analiz etm\u0259k", ru: "\u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C", tr: "analiz etmek", es: "analizar", en: "analyze" }
  },
  linguistic: {
    lemma: "linguistic",
    pos: "ADJ",
    syntaxRole: "Attribute / Modifier",
    cefrLevel: "C1",
    ipa: "/l\u026A\u014B\u02C8\u0261w\u026Ast\u026Ak/",
    morphology: "Classifying Adjective",
    translations: { az: "linqvistik / dil\xE7ilik", ru: "\u043B\u0438\u043D\u0433\u0432\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439", tr: "dilbilimsel", es: "ling\xFC\xEDstico", en: "linguistic" }
  },
  patterns: {
    lemma: "pattern",
    pos: "NOUN",
    syntaxRole: "Direct Object",
    cefrLevel: "B1",
    ipa: "/\u02C8p\xE6t\u0259nz/",
    morphology: "Count Noun, Plural (-s)",
    translations: { az: "qanunauy\u011Funluqlar / modell\u0259r", ru: "\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u044B / \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u044B", tr: "kal\u0131plar / desenler", es: "patrones", en: "patterns" }
  },
  your: {
    lemma: "your",
    pos: "DET",
    syntaxRole: "Possessive Determiner",
    cefrLevel: "A1",
    ipa: "/j\u0254\u02D0r/",
    morphology: "Possessive Pronoun/Determiner, 2nd Person",
    translations: { az: "s\u0259nin / sizin", ru: "\u0442\u0432\u043E\u0439 / \u0432\u0430\u0448", tr: "senin / sizin", es: "tu / su", en: "your" }
  },
  conversational: {
    lemma: "conversational",
    pos: "ADJ",
    syntaxRole: "Attribute",
    cefrLevel: "B2",
    ipa: "/\u02CCk\u0252nv\u0259\u02C8se\u026A\u0283\u0259nl/",
    morphology: "Relational Adjective, Derived from Noun + -al",
    translations: { az: "dan\u0131\u015F\u0131q / \xFCnsiyy\u0259t", ru: "\u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u043D\u044B\u0439", tr: "konu\u015Fma diliyle ilgili", es: "conversacional", en: "conversational" }
  },
  fluency: {
    lemma: "fluency",
    pos: "NOUN",
    syntaxRole: "Subject",
    cefrLevel: "B2",
    ipa: "/\u02C8flu\u02D0\u0259nsi/",
    morphology: "Abstract Noun, Non-count",
    translations: { az: "s\u0259lislik / ax\u0131c\u0131l\u0131q", ru: "\u0431\u0435\u0433\u043B\u043E\u0441\u0442\u044C", tr: "ak\u0131c\u0131l\u0131k", es: "fluidez", en: "fluency" }
  },
  will: {
    lemma: "will",
    pos: "AUX",
    syntaxRole: "Modal Auxiliary",
    cefrLevel: "A1",
    ipa: "/w\u026Al/",
    morphology: "Modal Auxiliary, Future Time Reference",
    translations: { az: "-acaq / -\u0259c\u0259k", ru: "\u0431\u0443\u0434\u0435\u0442", tr: "-ecek / -acak", es: "(futuro) / va a", en: "will" }
  },
  improve: {
    lemma: "improve",
    pos: "VERB",
    syntaxRole: "Main Verb / Predicate",
    cefrLevel: "B1",
    ipa: "/\u026Am\u02C8pru\u02D0v/",
    morphology: "Verb, Bare Infinitive with Modal",
    translations: { az: "t\u0259kmill\u0259\u015Fm\u0259k / inki\u015Faf etm\u0259k", ru: "\u0443\u043B\u0443\u0447\u0448\u0430\u0442\u044C\u0441\u044F", tr: "geli\u015Fmek", es: "mejorar", en: "improve" }
  },
  rapidly: {
    lemma: "rapidly",
    pos: "ADV",
    syntaxRole: "Adverbial of Manner",
    cefrLevel: "B2",
    ipa: "/\u02C8r\xE6p\u026Adli/",
    morphology: "Adverb of Manner, Base + -ly",
    translations: { az: "s\xFCr\u0259tl\u0259 / c\u0259ld", ru: "\u0431\u044B\u0441\u0442\u0440\u043E", tr: "h\u0131zla", es: "r\xE1pidamente", en: "rapidly" }
  },
  effective: {
    lemma: "effective",
    pos: "ADJ",
    syntaxRole: "Attribute / Modifier",
    cefrLevel: "B1",
    ipa: "/\u026A\u02C8fekt\u026Av/",
    morphology: "Qualitative Adjective",
    translations: { az: "t\u0259sirli / effektiv", ru: "\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u0439", tr: "etkili", es: "efectivo", en: "effective" }
  },
  learners: {
    lemma: "learner",
    pos: "NOUN",
    syntaxRole: "Subject",
    cefrLevel: "A2",
    ipa: "/\u02C8l\u025C\u02D0n\u0259z/",
    morphology: "Count Noun, Plural, Agentive (-er + -s)",
    translations: { az: "\xF6yr\u0259n\u0259nl\u0259r / t\u0259l\u0259b\u0259l\u0259r", ru: "\u0443\u0447\u0430\u0449\u0438\u0435\u0441\u044F", tr: "\xF6\u011Frenenler", es: "estudiantes", en: "learners" }
  },
  the: {
    lemma: "the",
    pos: "DET",
    syntaxRole: "Determiner",
    cefrLevel: "A1",
    ipa: "/\xF0\u0259/",
    morphology: "Definite Article",
    translations: { az: "m\xFC\u0259yy\u0259nlik artikli", ru: "\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0439 \u0430\u0440\u0442\u0438\u043A\u043B\u044C", tr: "belirtme eki / the", es: "el / la", en: "the" }
  },
  she: {
    lemma: "she",
    pos: "PRON",
    syntaxRole: "Subject",
    cefrLevel: "A1",
    ipa: "/\u0283i\u02D0/",
    morphology: "Personal Pronoun, 3rd Person Singular Female",
    translations: { az: "o (qad\u0131n)", ru: "\u043E\u043D\u0430", tr: "o (kad\u0131n)", es: "ella", en: "she" }
  },
  has: {
    lemma: "have",
    pos: "AUX",
    syntaxRole: "Auxiliary Verb",
    cefrLevel: "A1",
    ipa: "/h\xE6z/",
    morphology: "Auxiliary Verb, 3rd Person Singular Present Perfect Marker",
    translations: { az: "(bitmi\u015Flik k\xF6m\u0259k\xE7isi)", ru: "(\u0432\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0433\u043B\u0430\u0433\u043E\u043B)", tr: "(yard\u0131mc\u0131 fiil)", es: "ha", en: "has" }
  },
  completed: {
    lemma: "complete",
    pos: "VERB",
    syntaxRole: "Main Verb",
    cefrLevel: "B1",
    ipa: "/k\u0259m\u02C8pli\u02D0t\u026Ad/",
    morphology: "Past Participle (-ed), Perfective Aspect",
    translations: { az: "tamamlay\u0131b / bitirib", ru: "\u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B(\u0430)", tr: "tamamlad\u0131", es: "completado", en: "completed" }
  },
  assessment: {
    lemma: "assessment",
    pos: "NOUN",
    syntaxRole: "Direct Object",
    cefrLevel: "B2",
    ipa: "/\u0259\u02C8sesm\u0259nt/",
    morphology: "Deverbal Noun (-ment)",
    translations: { az: "qiym\u0259tl\u0259ndirm\u0259", ru: "\u043E\u0446\u0435\u043D\u043A\u0430 / \u0442\u0435\u0441\u0442", tr: "de\u011Ferlendirme", es: "evaluaci\xF3n", en: "assessment" }
  }
};
function getFallbackPersonalizedGrammarRoadmap(grammarScore, testedConcepts = ["Conditionals", "Inversion"], targetLanguage = "English", mediatorLanguage = "az", level = "B1") {
  const needsRemediation = grammarScore < 75;
  const focusTitle = needsRemediation ? `Targeted Grammar Recovery: ${testedConcepts[0] || "Core Syntax"} & Error Prevention` : `Advanced Grammar Mastery: Stylistic Inversion & ${testedConcepts[0] || "Nuanced Structures"}`;
  return {
    id: `roadmap-personalized-grammar-${Date.now()}`,
    title: focusTitle,
    category: "Grammar",
    level,
    estimatedDuration: "2 Weeks \u2022 4 Targeted Milestones",
    summary: `Personalized curriculum generated directly from your recent Grammar Skill Test (${grammarScore}%). It directly targets ${testedConcepts.join(" and ")} to eradicate errors and advance you toward ${level === "B1" ? "B2" : level === "B2" ? "C1" : "C2"} proficiency.`,
    tags: ["Personalized", "Grammar Test Results", level, "Custom Recovery"],
    isAiGenerated: true,
    isGrammarPersonalized: true,
    personalizedGrammarMeta: {
      grammarScore,
      testedConcepts,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      targetSkillDelta: `+${Math.max(6, 100 - grammarScore)}% Score Target`
    },
    milestones: [
      {
        step: 1,
        title: needsRemediation ? "Diagnostic Gap Clarification" : "Stylistic Inversion & Emphatic Fronting",
        description: needsRemediation ? "Pinpoint recurring structural missteps identified in your grammar diagnostic assessment." : "Elevate syntactic complexity through negative adverbial fronting and subject-auxiliary inversion.",
        grammarPoint: needsRemediation ? "Subject-Verb Agreement & Auxiliary Selection formulas" : "Negative Adverb (Seldom / Rarely / Under no circumstances) + Auxiliary + Subject + Verb",
        sampleSentence: needsRemediation ? "The committee has evaluated the preliminary results thoroughly." : "Seldom have we witnessed such remarkable linguistic progression.",
        tokens: defaultTokenizeSentence(
          needsRemediation ? "The committee has evaluated the preliminary results thoroughly." : "Seldom have we witnessed such remarkable linguistic progression.",
          mediatorLanguage
        )
      },
      {
        step: 2,
        title: "Mixed & Inverted Conditionals Mastery",
        description: "Synthesize past hypothetical conditions with present consequential outcomes.",
        grammarPoint: "Third-Second Mixed Conditional: If + Past Perfect, would + bare infinitive",
        sampleSentence: "Had he completed the diagnostic assessment earlier, his learning trajectory would be clearer.",
        tokens: defaultTokenizeSentence(
          "Had he completed the diagnostic assessment earlier, his learning trajectory would be clearer.",
          mediatorLanguage
        )
      },
      {
        step: 3,
        title: "Subjunctive Mood & Mandative Clauses",
        description: "Express formal recommendations, demands, and hypothetical necessities without modal ambiguity.",
        grammarPoint: "Demand verb + that + subject + base form (e.g., recommend that he review...)",
        sampleSentence: "The pedagogical supervisor insisted that the student master the fundamental grammatical paradigms.",
        tokens: defaultTokenizeSentence(
          "The pedagogical supervisor insisted that the student master the fundamental grammatical paradigms.",
          mediatorLanguage
        )
      },
      {
        step: 4,
        title: "Discourse Markers & Complex Synthesis",
        description: "Connect multifaceted argumentative propositions using cohesive syntactic connectors.",
        grammarPoint: "Subordinating concession clauses: Notwithstanding / Inasmuch as / Provided that",
        sampleSentence: "Notwithstanding the intricate syntactic obstacles, consistent deliberate practice ensures fluency.",
        tokens: defaultTokenizeSentence(
          "Notwithstanding the intricate syntactic obstacles, consistent deliberate practice ensures fluency.",
          mediatorLanguage
        )
      }
    ],
    checkpointQuestions: [
      {
        question: "Which sentence correctly demonstrates formal negative fronting based on your test focus?",
        options: [
          "Seldom have I encountered such an intricate grammatical puzzle.",
          "Seldom I have encountered such an intricate grammatical puzzle.",
          "I have encountered seldom such an intricate grammatical puzzle.",
          "Encountered seldom have I such an intricate grammatical puzzle."
        ],
        correctIndex: 0,
        explanation: 'Negative fronting with "Seldom" mandates auxiliary inversion (Seldom have I...).'
      },
      {
        question: "Identify the correct inverted third conditional sentence:",
        options: [
          "Had she reviewed the diagnostic notes, she would have mastered the test.",
          "If she had reviewed the diagnostic notes, she would had mastered the test.",
          "Did she review the diagnostic notes, she would master the test.",
          "Having she reviewed the diagnostic notes, she would have mastered the test."
        ],
        correctIndex: 0,
        explanation: 'Inverted third conditional replaces "If she had" with "Had she reviewed".'
      }
    ]
  };
}
function defaultTokenizeSentence(sentence, mediator) {
  const rawTokens = (sentence || "").match(/[\w'-]+|[.,!?;:]/g) || [];
  return rawTokens.map((rawWord, idx) => {
    const isPunct = /^[.,!?;:]$/.test(rawWord);
    if (isPunct) {
      return {
        text: rawWord,
        lemma: rawWord,
        pos: "PUNCT",
        syntaxRole: "Punctuation Mark",
        cefrLevel: "A1",
        ipa: "",
        mediatorTranslation: "",
        morphology: "Punctuation boundary delimiter"
      };
    }
    const cleanLower = rawWord.toLowerCase().replace(/['’]s$/, "");
    const found = SERVER_LEXICON[cleanLower];
    if (found) {
      return {
        text: rawWord,
        lemma: found.lemma,
        pos: found.pos,
        syntaxRole: found.syntaxRole,
        cefrLevel: found.cefrLevel,
        ipa: found.ipa,
        mediatorTranslation: found.translations[mediator] || found.translations.en || cleanLower,
        morphology: found.morphology
      };
    }
    let pos = "NOUN";
    let syntaxRole = idx === 0 ? "Subject" : "Constituent";
    let cefrLevel = "B1";
    let lemma = cleanLower;
    let morphology = "Content word";
    if (/^(the|a|an|this|that|these|those|every|each|some|any)$/i.test(cleanLower)) {
      pos = "DET";
      syntaxRole = "Determiner";
      cefrLevel = "A1";
      morphology = "Determiner";
    } else if (/^(in|on|at|by|for|with|about|against|between|into|through|during|before|after|above|below|to|from|over|under)$/i.test(cleanLower)) {
      pos = "PREP";
      syntaxRole = "Prepositional Head";
      cefrLevel = "A1";
      morphology = "Preposition";
    } else if (/^(and|but|or|so|yet|because|although|since|while|if|unless)$/i.test(cleanLower)) {
      pos = "CONJ";
      syntaxRole = "Conjunction / Connector";
      cefrLevel = "A2";
      morphology = "Conjunction";
    } else if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|their|our)$/i.test(cleanLower)) {
      pos = "PRON";
      syntaxRole = idx === 0 ? "Subject" : "Pronoun Complement";
      cefrLevel = "A1";
      morphology = "Personal / Possessive Pronoun";
    } else if (/^(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must)$/i.test(cleanLower)) {
      pos = "AUX";
      syntaxRole = "Auxiliary Verb / Copula";
      cefrLevel = "A1";
      morphology = "Auxiliary / Modal";
    } else if (/ly$/i.test(cleanLower)) {
      pos = "ADV";
      syntaxRole = "Adverbial Modifier";
      lemma = cleanLower.replace(/ly$/, "");
      cefrLevel = "B2";
      morphology = "Derived Adverb of Manner";
    } else if (/(ed|ing)$/i.test(cleanLower)) {
      pos = "VERB";
      syntaxRole = "Predicate / Verb Form";
      lemma = cleanLower.replace(/(ed|ing)$/, "");
      cefrLevel = "B1";
      morphology = cleanLower.endsWith("ing") ? "Present Participle / Gerund" : "Past Participle / Simple Past";
    } else if (/(tion|sion|ity|ment|ness|ance|ence)$/i.test(cleanLower)) {
      pos = "NOUN";
      syntaxRole = "Noun Phrase Head";
      cefrLevel = "B2";
      morphology = "Nominal Suffixation";
    } else if (/(ful|ous|ive|able|ible|al|ic)$/i.test(cleanLower)) {
      pos = "ADJ";
      syntaxRole = "Attribute / Modifier";
      cefrLevel = "B1";
      morphology = "Adjectival Suffixation";
    }
    return {
      text: rawWord,
      lemma,
      pos,
      syntaxRole,
      cefrLevel,
      ipa: `/${cleanLower}/`,
      mediatorTranslation: `${cleanLower}`,
      morphology
    };
  });
}
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
