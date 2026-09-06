// fallbackData.js — Infallible linguistic & UI styling fallback repository
// Guarantees zero downtime, zero blank screens, and zero crashes if AI APIs (Gemini/Groq) are unavailable.

export const FALLBACK_THEMES = [
  {
    id: "golden",
    name: "AI Golden Ratio",
    tagline: "Harmonic 137.5° angle palette with WCAG AA compliance",
    colors: {
      primary: "#6366f1",
      secondary: "#06b6d4",
      accent: "#f59e0b",
      surface: "#0f172a",
      cardBg: "#1e293b",
    },
    rulesets: {
      body: { backgroundColor: "#020617", color: "#f8fafc" },
      header: { backgroundColor: "rgba(2, 6, 23, 0.92)", borderColor: "rgba(99, 102, 241, 0.25)" },
      brand: {
        iconStyle: { background: "linear-gradient(135deg, #6366f1, #06b6d4)", color: "#ffffff", borderColor: "#818cf8" },
        badgeStyle: { backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#818cf8", borderColor: "rgba(99, 102, 241, 0.35)" },
      },
      cubeCard: {
        hex: "#06b6d4",
        style: { borderColor: "rgba(6, 182, 212, 0.35)", boxShadow: "0 10px 30px -10px rgba(6, 182, 212, 0.2)" },
        badgeStyle: { backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.3)" },
        btnStyle: { background: "linear-gradient(135deg, #06b6d4, #6366f1)", color: "#ffffff" },
      },
      flashcards: {
        hex: "#8b5cf6",
        style: { borderColor: "rgba(139, 92, 246, 0.4)", boxShadow: "0 8px 24px -6px rgba(139, 92, 246, 0.2)" },
        iconStyle: { backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#c084fc", borderColor: "rgba(139, 92, 246, 0.3)" },
      },
      quiz: {
        hex: "#10b981",
        style: { borderColor: "rgba(16, 185, 129, 0.4)", boxShadow: "0 8px 24px -6px rgba(16, 185, 129, 0.2)" },
        iconStyle: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" },
      },
      listening: {
        hex: "#38bdf8",
        style: { borderColor: "rgba(56, 189, 248, 0.4)", boxShadow: "0 8px 24px -6px rgba(56, 189, 248, 0.2)" },
        iconStyle: { backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#7dd3fc", borderColor: "rgba(56, 189, 248, 0.3)" },
      },
      match: {
        hex: "#f59e0b",
        style: { borderColor: "rgba(245, 158, 11, 0.4)", boxShadow: "0 8px 24px -6px rgba(245, 158, 11, 0.2)" },
        iconStyle: { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" },
      },
      speaking: {
        hex: "#f43f5e",
        style: { borderColor: "rgba(244, 63, 94, 0.4)", boxShadow: "0 8px 24px -6px rgba(244, 63, 94, 0.2)" },
        iconStyle: { backgroundColor: "rgba(244, 63, 94, 0.15)", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" },
      },
      grammar: {
        hex: "#818cf8",
        style: { borderColor: "rgba(129, 140, 248, 0.4)", boxShadow: "0 8px 24px -6px rgba(129, 140, 248, 0.2)" },
        iconStyle: { backgroundColor: "rgba(129, 140, 248, 0.15)", color: "#a5b4fc", borderColor: "rgba(129, 140, 248, 0.3)" },
      },
    },
  },
  {
    id: "cyberpunk",
    name: "Cosmic Cyberpunk",
    tagline: "High-contrast neon synth aesthetics with dark matter backdrop",
    colors: { primary: "#06b6d4", secondary: "#d946ef", accent: "#f43f5e" },
    rulesets: {
      body: { backgroundColor: "#030712", color: "#f9fafb" },
      header: { backgroundColor: "rgba(3, 7, 18, 0.94)", borderColor: "rgba(217, 70, 239, 0.3)" },
      brand: {
        iconStyle: { background: "linear-gradient(135deg, #d946ef, #06b6d4)", color: "#ffffff", borderColor: "#e879f9" },
        badgeStyle: { backgroundColor: "rgba(217, 70, 239, 0.18)", color: "#f0abfc", borderColor: "rgba(217, 70, 239, 0.4)" },
      },
      cubeCard: {
        hex: "#d946ef",
        style: { borderColor: "rgba(217, 70, 239, 0.45)", boxShadow: "0 10px 30px -10px rgba(217, 70, 239, 0.25)" },
        badgeStyle: { backgroundColor: "rgba(217, 70, 239, 0.2)", color: "#f5d0fe", borderColor: "rgba(217, 70, 239, 0.4)" },
        btnStyle: { background: "linear-gradient(135deg, #d946ef, #06b6d4)", color: "#ffffff" },
      },
      flashcards: {
        hex: "#06b6d4",
        style: { borderColor: "rgba(6, 182, 212, 0.45)", boxShadow: "0 8px 24px -6px rgba(6, 182, 212, 0.2)" },
        iconStyle: { backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.35)" },
      },
      quiz: {
        hex: "#10b981",
        style: { borderColor: "rgba(16, 185, 129, 0.45)", boxShadow: "0 8px 24px -6px rgba(16, 185, 129, 0.2)" },
        iconStyle: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.35)" },
      },
      listening: {
        hex: "#38bdf8",
        style: { borderColor: "rgba(56, 189, 248, 0.45)", boxShadow: "0 8px 24px -6px rgba(56, 189, 248, 0.2)" },
        iconStyle: { backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#7dd3fc", borderColor: "rgba(56, 189, 248, 0.35)" },
      },
      match: {
        hex: "#f59e0b",
        style: { borderColor: "rgba(245, 158, 11, 0.45)", boxShadow: "0 8px 24px -6px rgba(245, 158, 11, 0.2)" },
        iconStyle: { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.35)" },
      },
      speaking: {
        hex: "#f43f5e",
        style: { borderColor: "rgba(244, 63, 94, 0.45)", boxShadow: "0 8px 24px -6px rgba(244, 63, 94, 0.2)" },
        iconStyle: { backgroundColor: "rgba(244, 63, 94, 0.15)", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.35)" },
      },
      grammar: {
        hex: "#a855f7",
        style: { borderColor: "rgba(168, 85, 247, 0.45)", boxShadow: "0 8px 24px -6px rgba(168, 85, 247, 0.2)" },
        iconStyle: { backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.35)" },
      },
    },
  },
  {
    id: "emerald",
    name: "Emerald Aurora",
    tagline: "Calming botanical greens and cyan bio-luminescence",
    colors: { primary: "#10b981", secondary: "#06b6d4", accent: "#84cc16" },
    rulesets: {
      body: { backgroundColor: "#022c22", color: "#ecfdf5" },
      header: { backgroundColor: "rgba(2, 44, 34, 0.92)", borderColor: "rgba(16, 185, 129, 0.3)" },
      brand: {
        iconStyle: { background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#ffffff", borderColor: "#34d399" },
        badgeStyle: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7", borderColor: "rgba(16, 185, 129, 0.35)" },
      },
      cubeCard: {
        hex: "#10b981",
        style: { borderColor: "rgba(16, 185, 129, 0.4)", boxShadow: "0 10px 30px -10px rgba(16, 185, 129, 0.2)" },
        badgeStyle: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7", borderColor: "rgba(16, 185, 129, 0.35)" },
        btnStyle: { background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#ffffff" },
      },
      flashcards: {
        hex: "#06b6d4",
        style: { borderColor: "rgba(6, 182, 212, 0.4)", boxShadow: "0 8px 24px -6px rgba(6, 182, 212, 0.2)" },
        iconStyle: { backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.3)" },
      },
      quiz: {
        hex: "#10b981",
        style: { borderColor: "rgba(16, 185, 129, 0.4)", boxShadow: "0 8px 24px -6px rgba(16, 185, 129, 0.2)" },
        iconStyle: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" },
      },
      listening: {
        hex: "#14b8a6",
        style: { borderColor: "rgba(20, 184, 166, 0.4)", boxShadow: "0 8px 24px -6px rgba(20, 184, 166, 0.2)" },
        iconStyle: { backgroundColor: "rgba(20, 184, 166, 0.15)", color: "#2dd4bf", borderColor: "rgba(20, 184, 166, 0.3)" },
      },
      match: {
        hex: "#84cc16",
        style: { borderColor: "rgba(132, 204, 22, 0.4)", boxShadow: "0 8px 24px -6px rgba(132, 204, 22, 0.2)" },
        iconStyle: { backgroundColor: "rgba(132, 204, 22, 0.15)", color: "#a3e635", borderColor: "rgba(132, 204, 22, 0.3)" },
      },
      speaking: {
        hex: "#f59e0b",
        style: { borderColor: "rgba(245, 158, 11, 0.4)", boxShadow: "0 8px 24px -6px rgba(245, 158, 11, 0.2)" },
        iconStyle: { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" },
      },
      grammar: {
        hex: "#059669",
        style: { borderColor: "rgba(5, 150, 105, 0.4)", boxShadow: "0 8px 24px -6px rgba(5, 150, 105, 0.2)" },
        iconStyle: { backgroundColor: "rgba(5, 150, 105, 0.15)", color: "#10b981", borderColor: "rgba(5, 150, 105, 0.3)" },
      },
    },
  },
  {
    id: "sunset",
    name: "Sunset Horizon",
    tagline: "Warm copper, violet, and rose twilight glow",
    colors: { primary: "#f43f5e", secondary: "#f59e0b", accent: "#a855f7" },
    rulesets: {
      body: { backgroundColor: "#180d1b", color: "#fff1f2" },
      header: { backgroundColor: "rgba(24, 13, 27, 0.92)", borderColor: "rgba(244, 63, 94, 0.3)" },
      brand: {
        iconStyle: { background: "linear-gradient(135deg, #f43f5e, #f59e0b)", color: "#ffffff", borderColor: "#fb7185" },
        badgeStyle: { backgroundColor: "rgba(244, 63, 94, 0.15)", color: "#fda4af", borderColor: "rgba(244, 63, 94, 0.35)" },
      },
      cubeCard: {
        hex: "#f43f5e",
        style: { borderColor: "rgba(244, 63, 94, 0.4)", boxShadow: "0 10px 30px -10px rgba(244, 63, 94, 0.2)" },
        badgeStyle: { backgroundColor: "rgba(244, 63, 94, 0.15)", color: "#fda4af", borderColor: "rgba(244, 63, 94, 0.35)" },
        btnStyle: { background: "linear-gradient(135deg, #f43f5e, #f59e0b)", color: "#ffffff" },
      },
      flashcards: {
        hex: "#a855f7",
        style: { borderColor: "rgba(168, 85, 247, 0.4)", boxShadow: "0 8px 24px -6px rgba(168, 85, 247, 0.2)" },
        iconStyle: { backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#c084fc", borderColor: "rgba(168, 85, 247, 0.3)" },
      },
      quiz: {
        hex: "#f59e0b",
        style: { borderColor: "rgba(245, 158, 11, 0.4)", boxShadow: "0 8px 24px -6px rgba(245, 158, 11, 0.2)" },
        iconStyle: { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.3)" },
      },
      listening: {
        hex: "#fb7185",
        style: { borderColor: "rgba(251, 113, 133, 0.4)", boxShadow: "0 8px 24px -6px rgba(251, 113, 133, 0.2)" },
        iconStyle: { backgroundColor: "rgba(251, 113, 133, 0.15)", color: "#fda4af", borderColor: "rgba(251, 113, 133, 0.3)" },
      },
      match: {
        hex: "#ea580c",
        style: { borderColor: "rgba(234, 88, 12, 0.4)", boxShadow: "0 8px 24px -6px rgba(234, 88, 12, 0.2)" },
        iconStyle: { backgroundColor: "rgba(234, 88, 12, 0.15)", color: "#fb923c", borderColor: "rgba(234, 88, 12, 0.3)" },
      },
      speaking: {
        hex: "#e11d48",
        style: { borderColor: "rgba(225, 29, 72, 0.4)", boxShadow: "0 8px 24px -6px rgba(225, 29, 72, 0.2)" },
        iconStyle: { backgroundColor: "rgba(225, 29, 72, 0.15)", color: "#f43f5e", borderColor: "rgba(225, 29, 72, 0.3)" },
      },
      grammar: {
        hex: "#c084fc",
        style: { borderColor: "rgba(192, 132, 252, 0.4)", boxShadow: "0 8px 24px -6px rgba(192, 132, 252, 0.2)" },
        iconStyle: { backgroundColor: "rgba(192, 132, 252, 0.15)", color: "#e9d5ff", borderColor: "rgba(192, 132, 252, 0.3)" },
      },
    },
  },
  {
    id: "oceanic",
    name: "Oceanic Depths",
    tagline: "Submerged deep azure, cobalt, and seafoam currents",
    colors: { primary: "#0284c7", secondary: "#0d9488", accent: "#38bdf8" },
    rulesets: {
      body: { backgroundColor: "#082f49", color: "#f0f9ff" },
      header: { backgroundColor: "rgba(8, 47, 73, 0.92)", borderColor: "rgba(2, 132, 199, 0.3)" },
      brand: {
        iconStyle: { background: "linear-gradient(135deg, #0284c7, #0d9488)", color: "#ffffff", borderColor: "#38bdf8" },
        badgeStyle: { backgroundColor: "rgba(2, 132, 199, 0.15)", color: "#7dd3fc", borderColor: "rgba(2, 132, 199, 0.35)" },
      },
      cubeCard: {
        hex: "#0284c7",
        style: { borderColor: "rgba(2, 132, 199, 0.4)", boxShadow: "0 10px 30px -10px rgba(2, 132, 199, 0.2)" },
        badgeStyle: { backgroundColor: "rgba(2, 132, 199, 0.15)", color: "#7dd3fc", borderColor: "rgba(2, 132, 199, 0.35)" },
        btnStyle: { background: "linear-gradient(135deg, #0284c7, #0d9488)", color: "#ffffff" },
      },
      flashcards: {
        hex: "#38bdf8",
        style: { borderColor: "rgba(56, 189, 248, 0.4)", boxShadow: "0 8px 24px -6px rgba(56, 189, 248, 0.2)" },
        iconStyle: { backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#7dd3fc", borderColor: "rgba(56, 189, 248, 0.3)" },
      },
      quiz: {
        hex: "#0d9488",
        style: { borderColor: "rgba(13, 148, 136, 0.4)", boxShadow: "0 8px 24px -6px rgba(13, 148, 136, 0.2)" },
        iconStyle: { backgroundColor: "rgba(13, 148, 136, 0.15)", color: "#2dd4bf", borderColor: "rgba(13, 148, 136, 0.3)" },
      },
      listening: {
        hex: "#0284c7",
        style: { borderColor: "rgba(2, 132, 199, 0.4)", boxShadow: "0 8px 24px -6px rgba(2, 132, 199, 0.2)" },
        iconStyle: { backgroundColor: "rgba(2, 132, 199, 0.15)", color: "#38bdf8", borderColor: "rgba(2, 132, 199, 0.3)" },
      },
      match: {
        hex: "#06b6d4",
        style: { borderColor: "rgba(6, 182, 212, 0.4)", boxShadow: "0 8px 24px -6px rgba(6, 182, 212, 0.2)" },
        iconStyle: { backgroundColor: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.3)" },
      },
      speaking: {
        hex: "#6366f1",
        style: { borderColor: "rgba(99, 102, 241, 0.4)", boxShadow: "0 8px 24px -6px rgba(99, 102, 241, 0.2)" },
        iconStyle: { backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#818cf8", borderColor: "rgba(99, 102, 241, 0.3)" },
      },
      grammar: {
        hex: "#0ea5e9",
        style: { borderColor: "rgba(14, 165, 233, 0.4)", boxShadow: "0 8px 24px -6px rgba(14, 165, 233, 0.2)" },
        iconStyle: { backgroundColor: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", borderColor: "rgba(14, 165, 233, 0.3)" },
      },
    },
  },
];

// ── Fallback Grammar Guides Repository ─────────────────────────────────────────
export const FALLBACK_GRAMMAR_GUIDES = [
  {
    topicKey: "tenses",
    targetLanguage: "english",
    title: "The English 12-Tense Architectural System",
    category: "Tenses & Aspect",
    rule_summary: "English tenses cross 3 time points (Past, Present, Future) with 4 aspects (Simple, Continuous, Perfect, Perfect Continuous).",
    explanation: `### Master Blueprint of English Verb Tenses

1. **Simple Aspect (Fact / Routine):**
   - *Present Simple:* Subject + Base Verb / -s (e.g. *I speak, She speaks*)
   - *Past Simple:* Subject + V2 / -ed (e.g. *I visited*)
   - *Future Simple:* Subject + will + Base Verb (e.g. *I will learn*)

2. **Continuous Aspect (Action in Progress):**
   - *Present Cont.:* Subject + am/is/are + V-ing (e.g. *I am reading*)
   - *Past Cont.:* Subject + was/were + V-ing (e.g. *They were playing*)

3. **Perfect Aspect (Completed with Relevance to Now):**
   - *Present Perfect:* Subject + have/has + V3 (e.g. *I have finished*)
   - *Past Perfect:* Subject + had + V3 (e.g. *She had left before noon*)

### Common Pitfalls:
- Confusing Past Simple (specific finished past time) with Present Perfect (experience / result connected to now).
- Forgetting the 3rd person singular "-s" in Present Simple (*He works*, NOT *He work*).`,
    examples: [
      { target: "I have lived here for five years.", translation: "I moved here 5 years ago and still live here.", note: "Present Perfect + for (ongoing duration)" },
      { target: "While I was studying, the phone rang.", translation: "Past continuous interrupted by Past Simple.", note: "Time clause contrast" },
      { target: "Water boils at 100 degrees Celsius.", translation: "Scientific fact expressed via Present Simple.", note: "Universal fact" },
    ],
  },
  {
    topicKey: "articles",
    targetLanguage: "english",
    title: "Definite vs. Indefinite Articles (A, An, The & Zero Article)",
    category: "Articles & Determiners",
    rule_summary: "Use 'A/An' for singular non-specific countable nouns; 'The' for unique or specific nouns; zero article for general plurals.",
    explanation: `### The Article Decision Tree

- **A / An (Indefinite):** Used only with singular countable nouns mentioned for the first time.
  - Use **a** before consonant sounds: *a car, a university* (starts with /j/ sound).
  - Use **an** before vowel sounds: *an apple, an hour* (silent 'h').

- **The (Definite):** Used when the listener knows exactly which item is referenced.
  - Unique items: *the sun, the president*.
  - Previously mentioned nouns: *I saw a dog. The dog was friendly.*
  - Superlatives: *the tallest building*.

- **Zero Article (Ø):**
  - General plural nouns: *Dogs are loyal animals.*
  - Uncountable abstract nouns: *Love is powerful.*
  - Proper names and most countries: *Japan, Sarah*.`,
    examples: [
      { target: "She is an honest person.", translation: "An used because 'honest' begins with a vowel sound /ɒ/.", note: "Phonetic sound rule" },
      { target: "We had dinner at a great Italian restaurant.", translation: "First mention = indefinite 'a'.", note: "First mention" },
      { target: "The food at the restaurant was superb.", translation: "Second mention = definite 'the'.", note: "Known reference" },
    ],
  },
  {
    topicKey: "modals",
    targetLanguage: "english",
    title: "Modal Auxiliary Verbs: Obligation, Permission & Possibility",
    category: "Modals & Auxiliaries",
    rule_summary: "Modal verbs (can, could, must, should, may, might) never take '-s' and are followed by a bare infinitive without 'to'.",
    explanation: `### Modal Verb Function Matrix

| Modal | Primary Function | Example |
| :--- | :--- | :--- |
| **Can / Could** | Ability / Polite Request | *Can you speak Spanish? Could I borrow this?* |
| **Must** | Strong internal obligation / Certainty | *You must wear a helmet. He must be tired.* |
| **Have to** | External rule / law | *I have to renew my passport.* |
| **Should** | Advice / Recommendation | *You should get some rest.* |
| **May / Might** | Possibility / Probability | *It might rain later this evening.* |

### Syntax Constraints:
- NEVER say *He can to swim* ❌ -> Say *He can swim* ✅
- Question form inverts modal and subject: *Should we begin?*`,
    examples: [
      { target: "You should practice pronunciation daily.", translation: "Advice for learners.", note: "Recommendation" },
      { target: "Visitors must sign in at the front desk.", translation: "Strict regulation.", note: "Mandatory rule" },
      { target: "I can hear music next door.", translation: "Perception ability.", note: "Sensory ability" },
    ],
  },
  {
    topicKey: "russian_cases",
    targetLanguage: "russian",
    title: "Шесть падежей русского языка: Обзор и функции",
    category: "Cases & Declensions",
    rule_summary: "В русском языке 6 падежей: Именительный, Родительный, Дательный, Винительный, Творительный и Предложный.",
    explanation: `### Система падежей русского языка

1. **Именительный (Кто? Что?):** Исходная форма, субъект предложения (*Книга лежит на столе*).
2. **Родительный (Кого? Чего? Чей?):** Владение, отрицание, количество (*чашка кофе, нет времени*).
3. **Дательный (Кому? Чему?):** Косвенное дополнение, адресат действия (*звонить другу, дать сестре*).
4. **Винительный (Кого? Что? Куда?):** Прямой объект действия, направление (*читать книгу, идти в школу*).
5. **Творительный (Кем? Чем? С кем?):** Орудие действия, совместность (*писать ручкой, гулять с другом*).
6. **Предложный (О ком? О чём? Где?):** Тема мысли/речи, местоположение (*думать о будущем, жить в городе*).`,
    examples: [
      { target: "Я читаю интересную книгу.", translation: "I am reading an interesting book.", note: "Винительный падеж (прямой объект)" },
      { target: "Мы едем в Москву летом.", translation: "We are traveling to Moscow in summer.", note: "Винительный падеж направления" },
      { target: "Анна говорит по телефону с коллегой.", translation: "Anna is on the phone with a colleague.", note: "Творительный падеж совместности" },
    ],
  },
];

// ── Fallback Roadmaps Repository ──────────────────────────────────────────────
export const FALLBACK_ROADMAPS = {
  beginner: (lang, mediator) => `[Track: ${lang} | Level: Beginner A1-A2 | Mediator: ${mediator}]

# 🎯 6-STAGE COMPREHENSIVE ROADMAP FOR ${lang.toUpperCase()}

### Phase 1: Phonetics, Alphabet & Core Orthography (Days 1–7)
- Master phonemic pronunciation, stress accents, and vowel harmony.
- Learn standard greetings, numbers 1–100, and cardinal directions.

### Phase 2: Foundational Syntax & High-Frequency Lexicon (Days 8–20)
- Essential 300 everyday nouns (food, home, family, city, transport).
- Basic subject-verb-object declarative sentences and question forms.
- Present tense regular verb conjugations and basic pronouns.

### Phase 3: Conversational Survival & Daily Functional Routines (Days 21–35)
- Ordering at cafes, asking for directions, making purchases.
- Expressing likes, dislikes, habits, and daily schedules.
- Introduction to past simple narration and basic adjectives.

### Phase 4: Grammatical Foundations & Prepositions (Days 36–50)
- Core prepositions of time, location, and motion.
- Modal auxiliaries (can, must, want, need) and polite requests.
- Compound sentences with "because", "and", "but", "if".

### Phase 5: Active Listening & Phrasal Fluency (Days 51–65)
- Audio micro-drills at natural native speaking pace.
- Common idiomatic greetings and conversational fillers.
- Narrative past and immediate future intentions.

### Phase 6: CEFR A2 Milestone Evaluation & Spaced Mastery (Days 66–75)
- Comprehensive diagnostic review across reading, writing, listening, and speaking.
- Mastery of top 800 lemmas in flashcard deck with 3-streak retention.

---

## 📅 7-DAY ACCELERATED STUDY PLAN
- **Day 1:** 15 mins Sound Drill + 10 Flashcards (Greetings).
- **Day 2:** 15 mins Present Tense Conjugation + Smart Quiz review.
- **Day 3:** 20 mins Listening Drill + Food & Dining vocabulary.
- **Day 4:** 15 mins 3D Cube Word Game + Pronunciation check.
- **Day 5:** 20 mins Travel & Directions dialog practice.
- **Day 6:** 20 mins Flashcard Spaced Repetition + Grammar Book reading.
- **Day 7:** Comprehensive Weekly Review Quiz + 5 mins voice recording.`,

  intermediate: (lang, mediator) => `[Track: ${lang} | Level: Intermediate B1-B2 | Mediator: ${mediator}]

# 🎯 6-STAGE ADVANCED COMMUNICATIVE ROADMAP FOR ${lang.toUpperCase()}

### Phase 1: Nuanced Tenses & Aspectual Precision (Weeks 1–2)
- Perfect tenses, conditional structures, and passive voice.
- Subjunctive/conjunctive moods in dependent clauses.

### Phase 2: Collocations, Phrasal Units & Expressive Lexicon (Weeks 3–4)
- 1,500 active lemmas: business, technology, culture, and social debates.
- Natural collocations and idiomatic expressions.

### Phase 3: Spontaneous Conversational Fluency & Debate (Weeks 5–6)
- Defending opinions, agreeing politely, and tactful disagreement.
- Discourse markers (furthermore, however, on the contrary, nevertheless).

### Phase 4: Audio Immersion & Accent Reduction (Weeks 7–8)
- Podcasts, interviews, and news broadcasts with native phonology.
- Connected speech, liaison, elision, and natural cadence.

### Phase 5: Written Stylistics & Formal Registers (Weeks 9–10)
- Formal emails, structured essays, and professional memos.
- Syntactic variety and complex subordination.

### Phase 6: CEFR B2 Mastery & Diagnostic Capstone (Weeks 11–12)
- Comprehensive timed multi-skill assessment with 85%+ proficiency threshold.

---

## 📅 7-DAY IMMERSION PROTOCOL
- **Day 1:** 20 mins Advanced Listening Drill + Idiomatic Flashcards.
- **Day 2:** 20 mins Complex Sentence Construction + Quiz review.
- **Day 3:** 25 mins Native Podcast Analysis + Vocabulary expansion.
- **Day 4:** 20 mins Speaking Pronunciation Drill + 3D Cube lexical search.
- **Day 5:** 25 mins Formal writing prompt + Grammar reference check.
- **Day 6:** 20 mins Sound Match + Spaced repetition flashcards.
- **Day 7:** Full simulated B2 diagnostic challenge.`,
};

// ── Multi-Language Fallback Game Words (Rounds 1, 2, 3) ────────────────────────
export const FALLBACK_GAME_WORDS = {
  english: {
    round1: [
      { id: "fb_en_1", word: "water", initial_form: "water", correction: "clear liquid essential for life", transcription: "[ˈwɔː.tər]", part_of_speech: "noun", language: "english" },
      { id: "fb_en_2", word: "bread", initial_form: "bread", correction: "baked food made of flour", transcription: "[bred]", part_of_speech: "noun", language: "english" },
      { id: "fb_en_3", word: "house", initial_form: "house", correction: "building where people live", transcription: "[haʊs]", part_of_speech: "noun", language: "english" },
      { id: "fb_en_4", word: "friend", initial_form: "friend", correction: "a person with whom one has a bond", transcription: "[frend]", part_of_speech: "noun", language: "english" },
      { id: "fb_en_5", word: "light", initial_form: "light", correction: "natural agent that stimulates sight", transcription: "[laɪt]", part_of_speech: "noun", language: "english" },
      { id: "fb_en_6", word: "smile", initial_form: "smile", correction: "pleased or amused facial expression", transcription: "[smaɪl]", part_of_speech: "verb", language: "english" },
    ],
    round2: [
      { id: "fb_en_r2_1", word: "fresh bread", initial_form: "fresh bread", correction: "warm recently baked bread", transcription: "[freʃ bred]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r2_2", word: "bright light", initial_form: "bright light", correction: "strong luminous beam", transcription: "[braɪt laɪt]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r2_3", word: "warm smile", initial_form: "warm smile", correction: "friendly and welcoming expression", transcription: "[wɔːm smaɪl]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r2_4", word: "open window", initial_form: "open window", correction: "unshut casement letting in air", transcription: "[ˈoʊpən ˈwɪndoʊ]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r2_5", word: "quiet evening", initial_form: "quiet evening", correction: "peaceful close of the day", transcription: "[ˈkwaɪət ˈiːvnɪŋ]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r2_6", word: "good friend", initial_form: "good friend", correction: "loyal companion", transcription: "[ɡʊd frend]", part_of_speech: "phrase", language: "english" },
    ],
    round3: [
      { id: "fb_en_r3_1", word: "Could you help me?", initial_form: "Could you help me?", correction: "Polite request for assistance", transcription: "[kʊd juː help miː]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r3_2", word: "Have a wonderful day!", initial_form: "Have a wonderful day!", correction: "Warm greeting parting wish", transcription: "[hæv ə ˈwʌndərfʊl deɪ]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r3_3", word: "Where is the pharmacy?", initial_form: "Where is the pharmacy?", correction: "Asking for drugstore location", transcription: "[weər ɪz ðə ˈfɑːrməsi]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r3_4", word: "I would like to order.", initial_form: "I would like to order.", correction: "Polite dining request", transcription: "[aɪ wʊd laɪk tuː ˈɔːrdər]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r3_5", word: "Nice to meet you!", initial_form: "Nice to meet you!", correction: "Standard introductory courtesy", transcription: "[naɪs tuː miːt juː]", part_of_speech: "phrase", language: "english" },
      { id: "fb_en_r3_6", word: "Thank you very much.", initial_form: "Thank you very much.", correction: "Heartfelt expression of gratitude", transcription: "[θæŋk juː ˈveri mʌtʃ]", part_of_speech: "phrase", language: "english" },
    ],
  },
  russian: {
    round1: [
      { id: "fb_ru_1", word: "вода", initial_form: "вода", correction: "water / su", transcription: "[vɐˈda]", part_of_speech: "noun", language: "russian" },
      { id: "fb_ru_2", word: "хлеб", initial_form: "хлеб", correction: "bread / çörək", transcription: "[xlʲep]", part_of_speech: "noun", language: "russian" },
      { id: "fb_ru_3", word: "дом", initial_form: "дом", correction: "house / ev", transcription: "[dom]", part_of_speech: "noun", language: "russian" },
      { id: "fb_ru_4", word: "друг", initial_form: "друг", correction: "friend / dost", transcription: "[druk]", part_of_speech: "noun", language: "russian" },
      { id: "fb_ru_5", word: "утро", initial_form: "утро", correction: "morning / səhər", transcription: "[ˈutrə]", part_of_speech: "noun", language: "russian" },
      { id: "fb_ru_6", word: "город", initial_form: "город", correction: "city / şəhər", transcription: "[ˈɡorət]", part_of_speech: "noun", language: "russian" },
    ],
    round2: [
      { id: "fb_ru_r2_1", word: "свежий хлеб", initial_form: "свежий хлеб", correction: "fresh bread", transcription: "[ˈsvʲeʐɨj xlʲep]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r2_2", word: "холодная вода", initial_form: "холодная вода", correction: "cold water", transcription: "[xɐˈlodnəjə vɐˈda]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r2_3", word: "доброе утро", initial_form: "доброе утро", correction: "good morning", transcription: "[ˈdobrəjə ˈutrə]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r2_4", word: "старый город", initial_form: "старый город", correction: "historic old town", transcription: "[ˈstarɨj ˈɡorət]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r2_5", word: "лучший друг", initial_form: "лучший друг", correction: "best friend", transcription: "[ˈlut͡ɕʂɨj druk]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r2_6", word: "уютный дом", initial_form: "уютный дом", correction: "cozy home", transcription: "[ʊˈjutnɨj dom]", part_of_speech: "phrase", language: "russian" },
    ],
    round3: [
      { id: "fb_ru_r3_1", word: "Где находится вокзал?", initial_form: "Где находится вокзал?", correction: "Where is the train station?", transcription: "[ɡdʲe nɐˈxodʲɪt͡sə vɐɡˈzaɫ]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r3_2", word: "Сколько это стоит?", initial_form: "Сколько это стоит?", correction: "How much does this cost?", transcription: "[ˈskolʲkə ˈɛtə ˈstoɪt]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r3_3", word: "Приятного аппетита!", initial_form: "Приятного аппетита!", correction: "Enjoy your meal!", transcription: "[prʲɪˈjatnəvə ɐpʲɪˈtʲitə]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r3_4", word: "Помогите мне, пожалуйста.", initial_form: "Помогите мне, пожалуйста.", correction: "Please help me.", transcription: "[pəmɐˈɡʲitʲe mnʲe pɐˈʐaɫʊjstə]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r3_5", word: "Всего хорошего!", initial_form: "Всего хорошего!", correction: "All the best! (Parting wish)", transcription: "[fsʲɪˈvo xɐˈroʂəvə]", part_of_speech: "phrase", language: "russian" },
      { id: "fb_ru_r3_6", word: "Очень приятно познакомиться.", initial_form: "Очень приятно познакомиться.", correction: "Pleased to meet you.", transcription: "[ˈot͡ɕɪnʲ prʲɪˈjatnə pəznɐˈkomʲɪt͡sə]", part_of_speech: "phrase", language: "russian" },
    ],
  },
  spanish: {
    round1: [
      { id: "fb_es_1", word: "agua", initial_form: "agua", correction: "water", transcription: "[ˈa.ɣwa]", part_of_speech: "noun", language: "spanish" },
      { id: "fb_es_2", word: "pan", initial_form: "pan", correction: "bread", transcription: "[pan]", part_of_speech: "noun", language: "spanish" },
      { id: "fb_es_3", word: "amigo", initial_form: "amigo", correction: "friend", transcription: "[aˈmi.ɣo]", part_of_speech: "noun", language: "spanish" },
      { id: "fb_es_4", word: "casa", initial_form: "casa", correction: "house", transcription: "[ˈka.sa]", part_of_speech: "noun", language: "spanish" },
      { id: "fb_es_5", word: "sol", initial_form: "sol", correction: "sun", transcription: "[sol]", part_of_speech: "noun", language: "spanish" },
      { id: "fb_es_6", word: "libro", initial_form: "libro", correction: "book", transcription: "[ˈli.βɾo]", part_of_speech: "noun", language: "spanish" },
    ],
    round2: [
      { id: "fb_es_r2_1", word: "agua fresca", initial_form: "agua fresca", correction: "cool refreshing water", transcription: "[ˈa.ɣwa ˈfɾes.ka]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r2_2", word: "buen amigo", initial_form: "buen amigo", correction: "good friend", transcription: "[bwen aˈmi.ɣo]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r2_3", word: "casa blanca", initial_form: "casa blanca", correction: "white house", transcription: "[ˈka.sa ˈblaŋ.ka]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r2_4", word: "libro nuevo", initial_form: "libro nuevo", correction: "new book", transcription: "[ˈli.βɾo ˈnwe.βo]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r2_5", word: "día soleado", initial_form: "día soleado", correction: "sunny day", transcription: "[ˈdi.a so.leˈa.ðo]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r2_6", word: "pan caliente", initial_form: "pan caliente", correction: "warm bread", transcription: "[pan kaˈljen.te]", part_of_speech: "phrase", language: "spanish" },
    ],
    round3: [
      { id: "fb_es_r3_1", word: "¿Dónde está la estación?", initial_form: "¿Dónde está la estación?", correction: "Where is the station?", transcription: "[ˈdon.de esˈta la es.taˈsjon]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r3_2", word: "¿Cuánto cuesta esto?", initial_form: "¿Cuánto cuesta esto?", correction: "How much does this cost?", transcription: "[ˈkwan.to ˈkwes.ta ˈes.to]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r3_3", word: "¡Mucho gusto!", initial_form: "¡Mucho gusto!", correction: "Nice to meet you!", transcription: "[ˈmu.tʃo ˈɣus.to]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r3_4", word: "¿Me puede ayudar, por favor?", initial_form: "¿Me puede ayudar, por favor?", correction: "Can you help me, please?", transcription: "[me ˈpwe.ðe a.juˈðaɾ poɾ faˈβoɾ]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r3_5", word: "¡Que tenga un buen día!", initial_form: "¡Que tenga un buen día!", correction: "Have a great day!", transcription: "[ke ˈteŋ.ɡa un bwen ˈdi.a]", part_of_speech: "phrase", language: "spanish" },
      { id: "fb_es_r3_6", word: "La cuenta, por favor.", initial_form: "La cuenta, por favor.", correction: "The check/bill, please.", transcription: "[la ˈkwen.ta poɾ faˈβoɾ]", part_of_speech: "phrase", language: "spanish" },
    ],
  },
};

// ── Linguistic & Semantic Resolver Functions ──────────────────────────────────
export function getFallbackGrammarGuide(targetLanguage = "english", mediatorLanguage = "english", topicQuery = "", userLevel = "Beginner") {
  const query = String(topicQuery || "").toLowerCase();
  const langKey = String(targetLanguage || "english").toLowerCase();

  // Look for direct keyword match in guides repository
  let matched = FALLBACK_GRAMMAR_GUIDES.find((g) => {
    return (
      (g.targetLanguage === langKey || g.targetLanguage === "english") &&
      (query.includes(g.topicKey) || g.title.toLowerCase().includes(query) || g.category.toLowerCase().includes(query))
    );
  });

  if (matched) return matched;

  // If Russian language query
  if (langKey.includes("russ") || query.includes("падеж") || query.includes("case")) {
    return FALLBACK_GRAMMAR_GUIDES.find((g) => g.topicKey === "russian_cases") || FALLBACK_GRAMMAR_GUIDES[0];
  }

  // Fallback to foundational tense architecture
  return FALLBACK_GRAMMAR_GUIDES[0];
}

export function getFallbackRoadmap(language = "english", level = "Beginner", mediatorLanguage = "english") {
  const isIntermediateOrAbove = String(level || "").toLowerCase().includes("inter") || String(level || "").toLowerCase().includes("adv");
  const generator = isIntermediateOrAbove ? FALLBACK_ROADMAPS.intermediate : FALLBACK_ROADMAPS.beginner;
  return generator(language, mediatorLanguage);
}

export function getFallbackGameWords(targetLanguage = "english", mediatorLanguage = "english", level = "Beginner", round = 1, count = 6) {
  const langKey = String(targetLanguage || "english").toLowerCase();
  let langPool = FALLBACK_GAME_WORDS.english;

  if (langKey.includes("russ")) langPool = FALLBACK_GAME_WORDS.russian;
  else if (langKey.includes("span")) langPool = FALLBACK_GAME_WORDS.spanish;

  let roundKey = "round1";
  if (round === 2) roundKey = "round2";
  else if (round >= 3) roundKey = "round3";

  const words = langPool[roundKey] || langPool.round1;
  return words.slice(0, Math.max(1, count));
}
