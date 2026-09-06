import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { isWordInDictionary, getRandomWordsByLength } from './dictionary.js';
import { isValidWordToken, SCRABBLE_NOISE_BLACKLIST } from './wordTokenValidator.js';

export const cubeWordRouter = express.Router();

let genAI = null;
function getGenAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

// Letter pools by language for realistic 6-sided block faces
const LANGUAGE_LETTER_POOLS = {
  english: {
    vowels: ['A', 'E', 'I', 'O', 'U', 'Y'],
    consonants: ['T', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'M', 'W', 'F', 'G', 'Y', 'P', 'B', 'V', 'K', 'J', 'X', 'Z'],
  },
  spanish: {
    vowels: ['A', 'E', 'I', 'O', 'U'],
    consonants: ['S', 'R', 'N', 'D', 'L', 'C', 'T', 'M', 'P', 'B', 'G', 'V', 'Y', 'Q', 'H', 'F', 'Z', 'J', 'Ñ'],
  },
  russian: {
    vowels: ['А', 'Е', 'И', 'О', 'У', 'Ы', 'Э', 'Ю', 'Я'],
    consonants: ['Б', 'В', 'Г', 'Д', 'Ж', 'З', 'К', 'Л', 'М', 'Н', 'П', 'Р', 'С', 'Т', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ'],
  },
  german: {
    vowels: ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü'],
    consonants: ['N', 'R', 'S', 'T', 'D', 'H', 'L', 'C', 'G', 'M', 'B', 'W', 'F', 'K', 'Z', 'P', 'V', 'J'],
  },
  french: {
    vowels: ['A', 'E', 'I', 'O', 'U', 'Y'],
    consonants: ['S', 'N', 'T', 'R', 'L', 'U', 'D', 'C', 'M', 'P', 'G', 'B', 'V', 'H', 'F', 'Q', 'Z', 'J'],
  },
  italian: {
    vowels: ['A', 'E', 'I', 'O', 'U'],
    consonants: ['A', 'E', 'I', 'O', 'S', 'T', 'R', 'N', 'L', 'C', 'D', 'P', 'M', 'V', 'G', 'B', 'F', 'Z'],
  },
};

// Built-in high-frequency lexicon for instant validation and reliable fallback
const HIGH_FREQUENCY_LEXICON = {
  english: new Set([
    'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'ANY', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR',
    'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO',
    'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'CAT', 'DOG', 'SUN', 'SKY', 'RED', 'BLUE',
    'RUN', 'EAT', 'WIN', 'FLY', 'JOY', 'CAR', 'SEA', 'TREE', 'BOOK', 'WORD', 'TIME', 'YEAR', 'WORK', 'LIFE',
    'HAND', 'PART', 'EYE', 'WEEK', 'CASE', 'HOME', 'PAGE', 'CITY', 'ROAD', 'STAR', 'MOON', 'RAIN', 'WIND',
    'FIRE', 'GAME', 'PLAY', 'LOVE', 'HOPE', 'MIND', 'SOUL', 'BIRD', 'FISH', 'GOLD', 'FAST', 'SLOW', 'COLD',
    'WARM', 'DARK', 'LIGHT', 'DEEP', 'HIGH', 'LONG', 'TRUE', 'GOOD', 'BEST', 'FREE', 'WILD', 'OPEN', 'KIND',
    'WATER', 'HOUSE', 'WORLD', 'NIGHT', 'SOUND', 'LIGHT', 'HEART', 'STORY', 'POWER', 'MUSIC', 'RIVER', 'EARTH',
    'DREAM', 'SMILE', 'PEACE', 'BRAIN', 'STONE', 'CLOUD', 'BREAD', 'TABLE', 'CHAIR', 'FLOOR', 'SPACE', 'FORCE',
    'PERSON', 'FAMILY', 'NUMBER', 'FRIEND', 'SCHOOL', 'NATURE', 'WINDOW', 'GARDEN', 'FOREST', 'PLANET', 'ANIMAL',
    'SYSTEM', 'LANGUAGE', 'LEARNING', 'KNOWLEDGE', 'BEAUTIFUL', 'WONDERFUL', 'UNDERSTAND', 'EXPERIENCE', 'EDUCATION',
    'INTELLIGENCE', 'COMPREHENSIVE', 'PHILOSOPHY', 'PHILOLOGY', 'REVOLUTION', 'TRANSLATION', 'EXEMPLARY',
  ]),
  spanish: new Set([
    'QUE', 'DEL', 'POR', 'CON', 'UNA', 'LOS', 'MAS', 'PERO', 'SUS', 'LES', 'SOL', 'MAR', 'PAN', 'LUZ', 'PAZ',
    'CASA', 'VIDA', 'HORA', 'AGUA', 'TIEMPO', 'MUNDO', 'AMOR', 'ALMA', 'GATO', 'PERRO', 'LIBRO', 'MANO', 'CIELO',
    'PLAYA', 'NOCHE', 'TARDE', 'FUEGO', 'TIERRA', 'MADRE', 'PADRE', 'AMIGO', 'CIUDAD', 'CAMINO', 'PALABRA',
    'HISTORIA', 'CORAZON', 'ESTRELLA', 'VENTANA', 'ESCUELA', 'FAMILIA', 'MEMORIA', 'FILOSOFIA', 'FILOLOGIA',
  ]),
  russian: new Set([
    'ТОТ', 'КТО', 'ОНА', 'ОНИ', 'МЫ', 'ВЫ', 'ГОД', 'ДОМ', 'МИР', 'ЧАС', 'ДЕНЬ', 'РУКА', 'ГЛАЗ', 'ДЕЛО',
    'СЛОВО', 'ВОДА', 'ОГОНЬ', 'ЗЕМЛЯ', 'НЕБО', 'КОТ', 'СОБАКА', 'КНИГА', 'ВРЕМЯ', 'ГОРОД', 'ДОРОГА', 'МЫСЛЬ',
    'ДУША', 'ЖИЗНЬ', 'СВЕТ', 'ЛЮБОВЬ', 'ДРУГ', 'СЕМЬЯ', 'СОЛНЦЕ', 'ЗВЕЗДА', 'ОКНО', 'ЛЕС', 'РЕКА', 'ПРАВДА',
    'РАБОТА', 'ШКОЛА', 'МУЗЫКА', 'ИСТОРИЯ', 'ПРИРОДА', 'ЧЕЛОВЕК', 'ЗНАНИЕ', 'ФИЛОЛОГИЯ', 'ОБРАЗОВАНИЕ',
  ]),
  german: new Set([
    'UND', 'DER', 'DIE', 'DAS', 'WIR', 'SIE', 'ICH', 'TAG', 'JAHR', 'ZEIT', 'MANN', 'FRAU', 'KIND', 'HAUS',
    'WORT', 'BUCH', 'HAND', 'AUGE', 'STADT', 'LAND', 'LEBEN', 'WELT', 'WASSER', 'FEUER', 'SONNE', 'MOND',
    'STERN', 'FREUND', 'SCHULE', 'SPRACHE', 'WISSEN', 'PHILOLOGIE',
  ]),
  french: new Set([
    'UNE', 'DES', 'LES', 'PAR', 'SUR', 'AVEC', 'POUR', 'JOUR', 'MAIN', 'TEMPS', 'MOT', 'EAU', 'FEU', 'CIEL',
    'CHAT', 'CHIEN', 'LIVRE', 'MAISON', 'MONDE', 'AMOUR', 'TERRE', 'ETOILE', 'SOLEIL', 'HISTOIRE', 'LANGUE',
    'PHILOLOGIE', 'CONNAISSANCE',
  ]),
  italian: new Set([
    'CHE', 'PER', 'CON', 'UNA', 'NON', 'SOLE', 'MARE', 'PANE', 'VINO', 'CASA', 'VITA', 'TEMPO', 'MONDO',
    'AMORE', 'ANIMA', 'GATTO', 'CANE', 'LIBRO', 'MANO', 'CIELO', 'NOTTE', 'FUOCO', 'TERRA', 'AMICO', 'CITTA',
    'PAROLA', 'CUORE', 'STELLA', 'SCUOLA', 'FILOLOGIA',
  ]),
};

// Small emergency safety-net (a handful of ordinary words per language, on no
// particular topic) used only if the dictionary package for a language fails
// to load AND the AI call also fails. Real target/combo words normally come
// from the language's full dictionary (see getRandomWordsByLength) or from
// Gemini, both of which are free to draw on ANY topic — the game's aquatic
// background music is a purely audio/visual mood and is never used to steer
// word content or meaning.
const NEUTRAL_FALLBACK_WORDS = {
  english: [
    { word: 'ADVENTURE', meaning: 'An exciting or unusual experience', hint: 'A journey into the unknown', emoji: '🔤' },
    { word: 'FRIENDSHIP', meaning: 'A close bond between people', hint: 'What good companions share', emoji: '🔤' },
    { word: 'MOUNTAIN', meaning: 'A large natural elevation of land', hint: 'Something you might climb', emoji: '🔤' },
    { word: 'CHOCOLATE', meaning: 'A sweet food made from cacao', hint: 'A common dessert ingredient', emoji: '🔤' },
    { word: 'ORCHESTRA', meaning: 'A large group of musicians', hint: 'Plays symphonies together', emoji: '🔤' },
  ],
  spanish: [
    { word: 'AVENTURA', meaning: 'Experiencia emocionante', hint: 'Un viaje hacia lo desconocido', emoji: '🔤' },
    { word: 'AMISTAD', meaning: 'Vínculo cercano entre personas', hint: 'Lo que comparten los buenos amigos', emoji: '🔤' },
    { word: 'MONTAÑA', meaning: 'Gran elevación natural de tierra', hint: 'Algo que se puede escalar', emoji: '🔤' },
    { word: 'CHOCOLATE', meaning: 'Alimento dulce hecho de cacao', hint: 'Ingrediente común de postres', emoji: '🔤' },
  ],
  russian: [
    { word: 'ПРИКЛЮЧЕНИЕ', meaning: 'Захватывающее событие', hint: 'Путешествие в неизвестное', emoji: '🔤' },
    { word: 'ДРУЖБА', meaning: 'Близкая связь между людьми', hint: 'То, что разделяют хорошие друзья', emoji: '🔤' },
    { word: 'МУЗЫКАНТ', meaning: 'Человек, играющий музыку', hint: 'Исполнитель на инструменте', emoji: '🔤' },
    { word: 'ШОКОЛАД', meaning: 'Сладкая еда из какао', hint: 'Обычный ингредиент десертов', emoji: '🔤' },
  ],
  german: [
    { word: 'FREUNDSCHAFT', meaning: 'Enge Bindung zwischen Menschen', hint: 'Was gute Freunde teilen', emoji: '🔤' },
    { word: 'ABENTEUER', meaning: 'Aufregendes Erlebnis', hint: 'Eine Reise ins Unbekannte', emoji: '🔤' },
    { word: 'SCHOKOLADE', meaning: 'Süße Speise aus Kakao', hint: 'Häufige Zutat für Desserts', emoji: '🔤' },
  ],
  french: [
    { word: 'AVENTURE', meaning: 'Expérience excitante', hint: 'Un voyage vers l\u2019inconnu', emoji: '🔤' },
    { word: 'AMITIE', meaning: 'Lien étroit entre personnes', hint: 'Ce que partagent de bons amis', emoji: '🔤' },
    { word: 'CHOCOLAT', meaning: 'Aliment sucré à base de cacao', hint: 'Ingrédient courant des desserts', emoji: '🔤' },
  ],
  italian: [
    { word: 'AVVENTURA', meaning: 'Esperienza emozionante', hint: 'Un viaggio verso l\u2019ignoto', emoji: '🔤' },
    { word: 'AMICIZIA', meaning: 'Legame stretto tra persone', hint: 'Ciò che condividono i buoni amici', emoji: '🔤' },
    { word: 'CIOCCOLATO', meaning: 'Cibo dolce a base di cacao', hint: 'Ingrediente comune nei dolci', emoji: '🔤' },
  ],
};

// Clamp/normalize a requested [minLength, maxLength] window. `maxLength`
// mirrors the game's current grid width (round 1 = 8 columns, then 9, 10...)
// so the chosen word always physically fits across the screen.
function resolveLengthWindow(req) {
  const maxLength = Math.max(4, Math.min(20, parseInt(req.query.maxLength, 10) || 8));
  const requestedMin = parseInt(req.query.minLength, 10);
  const minLength = Number.isFinite(requestedMin)
    ? Math.max(3, Math.min(requestedMin, maxLength))
    : Math.max(3, maxLength - 3);
  return { minLength, maxLength };
}

function neutralFallbackQuest(lang, minLength, maxLength) {
  const list = NEUTRAL_FALLBACK_WORDS[lang] || NEUTRAL_FALLBACK_WORDS.english;
  const fitting = list.filter((q) => q.word.length >= minLength && q.word.length <= maxLength);
  const pool = fitting.length > 0 ? fitting : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Prefer everyday, recognizable words (from the built-in high-frequency
// lexicon) over obscure/archaic dictionary entries when picking combo words,
// so the game stays approachable for language learners. Falls back to the
// full dictionary when the high-frequency list has nothing in range.
function pickLearnerFriendlyWords(lang, minLength, maxLength, count) {
  const langLexicon = HIGH_FREQUENCY_LEXICON[lang];
  const fromLexicon = langLexicon
    ? Array.from(langLexicon).filter((w) => w.length >= minLength && w.length <= maxLength)
    : [];

  if (fromLexicon.length >= count) {
    for (let i = fromLexicon.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fromLexicon[i], fromLexicon[j]] = [fromLexicon[j], fromLexicon[i]];
    }
    return fromLexicon.slice(0, count);
  }

  // Not enough common words in this exact window — top up from the full dictionary
  const extra = getRandomWordsByLength(lang, minLength, maxLength, count - fromLexicon.length);
  return [...fromLexicon, ...extra];
}

// Endpoint 0: A batch of real dictionary combo-word quests for the active
// language, sized to fit within [minLength, maxLength]. Topic is unrestricted
// — these are ordinary dictionary words on any subject, not limited to any
// theme.
cubeWordRouter.get('/target-words', async (req, res) => {
  const lang = (req.query.language || 'english').toString().toLowerCase();
  const { minLength, maxLength } = resolveLengthWindow(req);

  const words = pickLearnerFriendlyWords(lang, minLength, maxLength, 12);
  const quests = words.map((word) => ({
    word,
    meaning: '',
    hint: 'A real dictionary word — work out its meaning as you spell it!',
    emoji: '🔤',
  }));

  if (quests.length === 0) {
    quests.push(neutralFallbackQuest(lang, minLength, maxLength));
  }

  res.json({ language: lang, quests, minLength, maxLength });
});

// Endpoint 0b: Generate a fresh AI combo/target word on demand. The word can
// be about ANY topic (nature, tech, emotions, food, sports, science, art...)
// — it is intentionally NOT tied to the game's aquatic background music,
// which is a separate audio mood. Length is constrained to
// [minLength, maxLength] so the word always fits the current round's grid.
cubeWordRouter.get('/generate-special-word', async (req, res) => {
  const lang = (req.query.language || 'english').toString().toLowerCase();
  const { minLength, maxLength } = resolveLengthWindow(req);
  const ai = getGenAI();

  if (ai) {
    try {
      const prompt = `You are a lexicographer choosing a SPECIAL COMBO BONUS TARGET WORD for a word-puzzle game in ${lang}.
Pick a genuine, real, recognizable dictionary word in ${lang} whose length is between ${minLength} and ${maxLength} letters (inclusive).
The word's TOPIC IS COMPLETELY OPEN — choose from any subject you like: nature, technology, emotions, food, sports, science, art, everyday objects, etc.
Do NOT limit yourself to water, ocean, sea, or aquatic-themed words — vary the topic every time. The game's background music is aquatic-themed for ambience only; it has no bearing on which word you should pick.
Rules:
1. Must be a real, valid dictionary word in ${lang}.
2. word.length must be >= ${minLength} and <= ${maxLength}.
3. Provide a short meaning in Russian and English.
4. Provide a brief 1-sentence clue (no need to reference water or the ocean).
5. Output STRICT JSON with no markdown formatting:
{
  "word": "CAPITALIZED_WORD",
  "meaning": "Meaning / Значение",
  "hint": "Short clue about this word",
  "emoji": "🔤"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9,
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        const cleanWord = (parsed.word || '').trim().toUpperCase();
        if (cleanWord && cleanWord.length >= minLength && cleanWord.length <= maxLength) {
          return res.json({
            language: lang,
            quest: {
              word: cleanWord,
              meaning: parsed.meaning || '',
              hint: parsed.hint || '',
              emoji: parsed.emoji || '🔤',
            },
          });
        }
      }
    } catch (err) {
      console.warn('AI special word generation fallback:', err.message);
    }
  }

  // Fallback: pick a real, learner-friendly word in-range (still any topic)
  const [randomWord] = pickLearnerFriendlyWords(lang, minLength, maxLength, 1);
  if (randomWord) {
    return res.json({
      language: lang,
      quest: {
        word: randomWord,
        meaning: '',
        hint: 'A real dictionary word — work out its meaning as you spell it!',
        emoji: '🔤',
      },
    });
  }

  res.json({ language: lang, quest: neutralFallbackQuest(lang, minLength, maxLength) });
});

// Endpoint 1: Smart 6-sided letter distribution for falling 3D cubic block
// Balanced so players can easily form ANY arbitrary word of their choice, with a gentle chance of special word letters
cubeWordRouter.get('/block-faces', (req, res) => {
  const lang = (req.query.language || 'english').toString().toLowerCase();
  const pool = LANGUAGE_LETTER_POOLS[lang] || LANGUAGE_LETTER_POOLS.english;
  const targetWord = (req.query.targetWord || '').toString().trim().toUpperCase();

  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // High-frequency balanced pool (2-3 vowels, 3-4 consonants)
  const faces = {
    front: getRandomItem(pool.vowels),
    right: getRandomItem(pool.consonants),
    back: getRandomItem(pool.consonants),
    left: getRandomItem(pool.vowels),
    top: getRandomItem(pool.consonants),
    bottom: getRandomItem(pool.consonants),
  };

  // Mild chance (40%) to include a letter from the special word on one face
  if (targetWord && targetWord.length >= 3 && Math.random() < 0.4) {
    const targetLetters = targetWord.split('');
    const chosenLetter = getRandomItem(targetLetters);
    const chosenFace = Math.random() < 0.5 ? 'front' : 'right';
    faces[chosenFace] = chosenLetter;
  }

  res.json({ language: lang, faces, targetWord });
});

// Endpoint 2: AI-Powered Philological Word Verification
cubeWordRouter.post('/verify', async (req, res) => {
  try {
    const { word, language = 'english', recentWords = [], round = 1, targetWord = '' } = req.body;

    if (!word || typeof word !== 'string' || word.trim().length < 3) {
      return res.json({
        isValid: false,
        word: word || '',
        reason: 'Word must be at least 3 letters long',
        points: 0,
        bonusMultiplier: 1,
      });
    }

    const cleanWord = word.trim().toUpperCase();
    const cleanTarget = (targetWord || '').trim().toUpperCase();
    const langKey = language.toLowerCase();
    const isTargetMatch = cleanTarget && cleanWord === cleanTarget;

    // 1. Linguistic Tokenization Validation Check (rejects Scrabble noise, abbreviations, non-word syllables)
    const tokenCheck = isValidWordToken(cleanWord, langKey);
    if (!tokenCheck.isValid && !isTargetMatch) {
      return res.json({
        isValid: false,
        word: cleanWord,
        language: langKey,
        reason: tokenCheck.reason || `Invalid word token in ${language}`,
        points: 0,
        bonusMultiplier: 1,
      });
    }

    // 2. Anti-Repetition Guard: Check if word was used in current or previous 2 rounds
    // (Exception: Target Quest words are always permissible if current quest matches)
    const normalizedRecent = (recentWords || []).map((w) => w.trim().toUpperCase());
    if (normalizedRecent.includes(cleanWord) && !isTargetMatch) {
      return res.json({
        isValid: false,
        word: cleanWord,
        language: langKey,
        reason: 'Word already formed in the past 3 rounds (repetition prohibited)!',
        points: 0,
        bonusMultiplier: 1,
      });
    }

    // 3. Base scoring calculation based on user rules
    const wordLength = cleanWord.length;
    let basePoints = wordLength >= 10 ? 20 : 10;
    let isComplexTerm = wordLength >= 10;
    let definition = '';
    let partOfSpeech = tokenCheck.partOfSpeech || 'word';
    let ipa = '';

    // Fast-track check via built-in high-frequency philological lexicon
    const langLexicon = HIGH_FREQUENCY_LEXICON[langKey];
    const isLexiconMatch = langLexicon && langLexicon.has(cleanWord);

    // Call Gemini AI for definitive linguistic and philological validation with strict tokenization directives
    const ai = getGenAI();
    if (ai) {
      try {
        const prompt = `You are a strict lexicographical word token validator for the ${language} language.
Analyze if the following letter sequence is an authentic, truly existing, linguistically recognized valid standalone word token in ${language}.
Word candidate: "${cleanWord}"

CRITICAL TOKENIZATION RULES:
1. The candidate MUST be an authentic, recognized dictionary word or standard valid inflection in ${language} that native speakers or learners would find in a reputable standard dictionary.
2. STRICTLY REJECT: Scrabble abbreviations, archaic letter fragments, isolated syllables (e.g., FES, AHT, ALF, FUB, DZU, ENE, ENG, AMA, AFF, AHU), acronyms, prefixes, or non-existent words.
3. If this candidate is NOT an authentic standalone word in ${language}, you MUST set isValid to false.
4. Output STRICT JSON with no markdown formatting:
{
  "isValid": true | false,
  "word": "${cleanWord}",
  "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | "term",
  "definition": "Brief, elegant 1-sentence definition in English or target language",
  "ipa": "/.../",
  "isComplexTerm": true | false
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text);
          if (typeof parsed.isValid === 'boolean') {
            if (!parsed.isValid) {
              return res.json({
                isValid: false,
                word: cleanWord,
                language: langKey,
                reason: 'Not a recognized word in the language lexicon',
                points: 0,
                bonusMultiplier: 1,
                isSpecialWord: false,
              });
            }

            // Word is valid per AI!
            isComplexTerm = parsed.isComplexTerm || wordLength >= 10;
            const multiplier = isTargetMatch ? 5 : (isComplexTerm ? 2 : 1);
            const finalPoints = basePoints * multiplier;

            return res.json({
              isValid: true,
              word: cleanWord,
              language: langKey,
              definition: parsed.definition || `${cleanWord} (${parsed.partOfSpeech || 'valid word'})`,
              partOfSpeech: parsed.partOfSpeech || 'word',
              ipa: parsed.ipa || '',
              isComplexTerm,
              points: finalPoints,
              bonusMultiplier: multiplier,
              isSpecialWord: Boolean(isTargetMatch),
              reason: 'validated_by_gemini_ai',
            });
          }
        }
      } catch (aiErr) {
        console.warn('Gemini 3.8 Flash evaluation error, checking lexicon fallback:', aiErr.message);
      }
    }

    // Fallback: Check the full offline dictionary (any real word, any topic)
    // if Gemini is unavailable or throttled — not just the small
    // high-frequency lexicon, so the game still reacts to ANY grammatically
    // valid word even without an AI key.
    const isFullDictionaryMatch = isWordInDictionary(cleanWord, langKey);
    if (isLexiconMatch || isFullDictionaryMatch || isTargetMatch) {
      const multiplier = isTargetMatch ? 5 : (isComplexTerm ? 2 : 1);
      const finalPoints = basePoints * multiplier;

      return res.json({
        isValid: true,
        word: cleanWord,
        language: langKey,
        definition: isTargetMatch ? `Target quest special word in ${language}.` : `Recognized dictionary word in ${language}.`,
        partOfSpeech: 'noun',
        ipa: '',
        isComplexTerm,
        points: finalPoints,
        bonusMultiplier: multiplier,
        isSpecialWord: Boolean(isTargetMatch),
        reason: isTargetMatch ? 'validated_by_target_quest' : 'validated_by_dictionary',
      });
    }

    // If neither AI nor lexicon recognizes it
    return res.json({
      isValid: false,
      word: cleanWord,
      language: langKey,
      reason: `Unrecognized letter sequence in ${language}`,
      points: 0,
      bonusMultiplier: 1,
    });
  } catch (err) {
    console.error('Error in /api/cubeword/verify:', err);
    return res.status(500).json({ error: 'Internal server error validating word' });
  }
});
