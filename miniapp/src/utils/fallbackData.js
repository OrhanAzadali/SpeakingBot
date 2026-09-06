// miniapp/src/utils/fallbackData.js
// Client-side fallback data for games, starter flashcard decks, grammar book, and roadmaps.
// Guarantees zero crash and full interactive gameplay even if the backend or AI models are unavailable.

export const STARTER_FLASHCARDS = {
  english: [
    {
      id: "starter_en_1",
      word: "Water",
      correction: "clear liquid essential for life",
      initial_form: "water",
      transcription: "[ˈwɔː.tər]",
      part_of_speech: "noun",
      pronunciation_rule: "The 'a' has a broad /ɔː/ vowel sound; American English uses a flap 't'.",
      grammar_rule: "Uncountable mass noun; never takes plural 'waters' in standard usage.",
      sentence: "Please drink a glass of fresh water every morning.",
      language: "english",
      correct_streak: 1,
    },
    {
      id: "starter_en_2",
      word: "Knowledge",
      correction: "information, skills, and understanding gained through experience",
      initial_form: "knowledge",
      transcription: "[ˈnɒl.ɪdʒ]",
      part_of_speech: "noun",
      pronunciation_rule: "Initial 'k' is completely silent; begins with an 'n' sound.",
      grammar_rule: "Uncountable noun; takes a singular verb: 'Knowledge is power.'",
      sentence: "Books are the greatest source of human knowledge.",
      language: "english",
      correct_streak: 1,
    },
    {
      id: "starter_en_3",
      word: "Courage",
      correction: "the ability to face danger or difficulty with bravery",
      initial_form: "courage",
      transcription: "[ˈkʌr.ɪdʒ]",
      part_of_speech: "noun",
      pronunciation_rule: "Stressed first syllable with short vowel /ʌ/; ending '-age' pronounced /ɪdʒ/.",
      grammar_rule: "Abstract noun often followed by an infinitive: 'courage to speak'.",
      sentence: "It takes great courage to learn a new language.",
      language: "english",
      correct_streak: 0,
    },
    {
      id: "starter_en_4",
      word: "Breathe",
      correction: "to take air into the lungs and expel it",
      initial_form: "breathe",
      transcription: "[briːð]",
      part_of_speech: "verb",
      pronunciation_rule: "Voiced 'th' /ð/ sound; distinct from noun 'breath' [breθ].",
      grammar_rule: "Regular verb: breathe, breathed, breathed.",
      sentence: "Pause for a moment, relax your shoulders, and breathe deeply.",
      language: "english",
      correct_streak: 2,
    },
    {
      id: "starter_en_5",
      word: "Explore",
      correction: "to travel through an unfamiliar area in order to learn about it",
      initial_form: "explore",
      transcription: "[ɪkˈsplɔːr]",
      part_of_speech: "verb",
      pronunciation_rule: "Stress is firmly on the second syllable /plɔːr/.",
      grammar_rule: "Transitive verb taking a direct object: 'explore new concepts'.",
      sentence: "We will explore grammar rules together step by step.",
      language: "english",
      correct_streak: 0,
    },
    {
      id: "starter_en_6",
      word: "Serenity",
      correction: "the state of being calm, peaceful, and untroubled",
      initial_form: "serenity",
      transcription: "[səˈren.ə.ti]",
      part_of_speech: "noun",
      pronunciation_rule: "Stress on second syllable 'ren'; last vowel is a short /i/.",
      grammar_rule: "Derived from the adjective 'serene' + suffix '-ity'.",
      sentence: "A quiet walk in nature always brings true serenity.",
      language: "english",
      correct_streak: 1,
    },
  ],
  russian: [
    {
      id: "starter_ru_1",
      word: "Вода",
      correction: "water / su",
      initial_form: "вода",
      transcription: "[vɐˈda]",
      part_of_speech: "noun",
      pronunciation_rule: "Безударная 'о' в первом слоге редуцируется в звук [ɐ].",
      grammar_rule: "Существительное женского рода, 1-е склонение.",
      sentence: "Утром полезно выпить стакан чистой воды.",
      language: "russian",
      correct_streak: 1,
    },
    {
      id: "starter_ru_2",
      word: "Дружба",
      correction: "friendship / dostluq",
      initial_form: "дружба",
      transcription: "[ˈdruʐ.bə]",
      part_of_speech: "noun",
      pronunciation_rule: "Буква 'ж' перед звонкой согласной 'б' сохраняет озвончение.",
      grammar_rule: "Женский род, ударение на первом слоге.",
      sentence: "Истинная дружба проверяется временем и испытаниями.",
      language: "russian",
      correct_streak: 2,
    },
    {
      id: "starter_ru_3",
      word: "Вдохновение",
      correction: "inspiration / ilham",
      initial_form: "вдохновение",
      transcription: "[vdəxnɐˈvʲe.nʲɪ.je]",
      part_of_speech: "noun",
      pronunciation_rule: "Приставка 'вдо-' произносится слитно с корнем с оглушением.",
      grammar_rule: "Средний род на -ие; в предложном падеже окончание -ии.",
      sentence: "Для изучения языков нужно регулярное вдохновение.",
      language: "russian",
      correct_streak: 0,
    },
  ],
};

export const STARTER_GRAMMAR_TOPICS = [
  {
    id: "starter_rule_1",
    title: "The 12 English Tenses Blueprint (Simple, Continuous, Perfect)",
    category: "Tenses & Aspect",
    rule_summary: "English verb system coordinates 3 time references with 4 aspects.",
    explanation: `### The Complete English Tense System

- **Simple Aspect (State, Routine, Fact):**
  - *Present Simple:* I work (routine).
  - *Past Simple:* I worked (finished event).
  - *Future Simple:* I will work (promise / prediction).

- **Continuous Aspect (In Progress):**
  - *Present Continuous:* I am working right now.
  - *Past Continuous:* I was working when you called.

- **Perfect Aspect (Connection & Result):**
  - *Present Perfect:* I have finished the task (result exists now).
  - *Past Perfect:* I had finished before he arrived.`,
    examples: [
      { target: "I have lived here for 5 years.", translation: "I started 5 years ago and still live here.", note: "Present Perfect experience" },
      { target: "She speaks three languages.", translation: "Permanent ability (Present Simple).", note: "Fact" },
    ],
  },
  {
    id: "starter_rule_2",
    title: "Mastering Articles: When to use A, An, The or Zero Article",
    category: "Articles & Determiners",
    rule_summary: "'A/An' for singular new items, 'The' for shared/specific reference.",
    explanation: `### Article Usage Rules

- **A / An:** Singular countable nouns mentioned for the first time.
  - *A book* (consonant sound), *An apple* (vowel sound), *An hour* (silent 'h').
- **The:** Specific nouns already known to both speaker and listener.
  - *The book on your desk*, *The sun*, *The capital city*.
- **Zero Article (Ø):** General plural or uncountable concepts (*Knowledge is key*, *Birds fly*).`,
    examples: [
      { target: "He is an architect.", translation: "Profession takes indefinite article.", note: "Occupation" },
      { target: "Turn off the lights, please.", translation: "Specific lights in the room.", note: "Known context" },
    ],
  },
];

export function getStarterFlashcards(targetLanguage = "english") {
  const langKey = String(targetLanguage || "english").toLowerCase();
  if (langKey.includes("russ")) return STARTER_FLASHCARDS.russian;
  return STARTER_FLASHCARDS.english;
}

export function getStarterGrammarTopics(targetLanguage = "english") {
  return STARTER_GRAMMAR_TOPICS;
}

export function getClientFallbackGameCards(targetLanguage = "english", round = 1) {
  const langKey = String(targetLanguage || "english").toLowerCase();
  const isRu = langKey.includes("russ");

  if (isRu) {
    if (round === 1) {
      return [
        { id: "c_ru_1", word: "вода", initial_form: "вода", correction: "water", transcription: "[vɐˈda]", part_of_speech: "noun", language: "russian" },
        { id: "c_ru_2", word: "хлеб", initial_form: "хлеб", correction: "bread", transcription: "[xlʲep]", part_of_speech: "noun", language: "russian" },
        { id: "c_ru_3", word: "друг", initial_form: "друг", correction: "friend", transcription: "[druk]", part_of_speech: "noun", language: "russian" },
        { id: "c_ru_4", word: "утро", initial_form: "утро", correction: "morning", transcription: "[ˈutrə]", part_of_speech: "noun", language: "russian" },
        { id: "c_ru_5", word: "дом", initial_form: "дом", correction: "house", transcription: "[dom]", part_of_speech: "noun", language: "russian" },
        { id: "c_ru_6", word: "солнце", initial_form: "солнце", correction: "sun", transcription: "[ˈsont͡sə]", part_of_speech: "noun", language: "russian" },
      ];
    }
    return [
      { id: "c_ru_r2_1", word: "доброе утро", initial_form: "доброе утро", correction: "good morning", transcription: "[ˈdobrəjə ˈutrə]", part_of_speech: "phrase", language: "russian" },
      { id: "c_ru_r2_2", word: "лучший друг", initial_form: "лучший друг", correction: "best friend", transcription: "[ˈlut͡ɕʂɨj druk]", part_of_speech: "phrase", language: "russian" },
      { id: "c_ru_r2_3", word: "свежий хлеб", initial_form: "свежий хлеб", correction: "fresh bread", transcription: "[ˈsvʲeʐɨj xlʲep]", part_of_speech: "phrase", language: "russian" },
      { id: "c_ru_r2_4", word: "холодная вода", initial_form: "холодная вода", correction: "cold water", transcription: "[xɐˈlodnəjə vɐˈda]", part_of_speech: "phrase", language: "russian" },
      { id: "c_ru_r2_5", word: "теплый чай", initial_form: "теплый чай", correction: "warm tea", transcription: "[ˈtʲɵplɨj t͡ɕæj]", part_of_speech: "phrase", language: "russian" },
      { id: "c_ru_r2_6", word: "новое слово", initial_form: "новое слово", correction: "new word", transcription: "[ˈnovəjə ˈsɫovə]", part_of_speech: "phrase", language: "russian" },
    ];
  }

  // English default
  if (round === 1) {
    return [
      { id: "c_en_1", word: "water", initial_form: "water", correction: "clear liquid essential for life", transcription: "[ˈwɔː.tər]", part_of_speech: "noun", language: "english" },
      { id: "c_en_2", word: "bread", initial_form: "bread", correction: "baked food made of flour", transcription: "[bred]", part_of_speech: "noun", language: "english" },
      { id: "c_en_3", word: "friend", initial_form: "friend", correction: "a close companion", transcription: "[frend]", part_of_speech: "noun", language: "english" },
      { id: "c_en_4", word: "morning", initial_form: "morning", correction: "early part of the day", transcription: "[ˈmɔːr.nɪŋ]", part_of_speech: "noun", language: "english" },
      { id: "c_en_5", word: "house", initial_form: "house", correction: "a dwelling place", transcription: "[haʊs]", part_of_speech: "noun", language: "english" },
      { id: "c_en_6", word: "sunlight", initial_form: "sunlight", correction: "light from the sun", transcription: "[ˈsʌn.laɪt]", part_of_speech: "noun", language: "english" },
    ];
  }

  return [
    { id: "c_en_r2_1", word: "fresh bread", initial_form: "fresh bread", correction: "warm recently baked bread", transcription: "[freʃ bred]", part_of_speech: "phrase", language: "english" },
    { id: "c_en_r2_2", word: "good friend", initial_form: "good friend", correction: "loyal companion", transcription: "[ɡʊd frend]", part_of_speech: "phrase", language: "english" },
    { id: "c_en_r2_3", word: "warm sunrise", initial_form: "warm sunrise", correction: "golden morning light", transcription: "[wɔːm ˈsʌnraɪz]", part_of_speech: "phrase", language: "english" },
    { id: "c_en_r2_4", word: "open book", initial_form: "open book", correction: "book ready to read", transcription: "[ˈoʊpən bʊk]", part_of_speech: "phrase", language: "english" },
    { id: "c_en_r2_5", word: "clear water", initial_form: "clear water", correction: "pure drinking water", transcription: "[klɪər ˈwɔːtər]", part_of_speech: "phrase", language: "english" },
    { id: "c_en_r2_6", word: "kind word", initial_form: "kind word", correction: "encouraging polite speech", transcription: "[kaɪnd wɜːrd]", part_of_speech: "phrase", language: "english" },
  ];
}
