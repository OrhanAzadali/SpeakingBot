import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { isWordInDictionary, normalizeWord } from './dictionary.js';

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

// Curated Target Word Quests by language (all 8+ letters long, complicated aquatic & oceanic vocabulary)
const TARGET_WORD_QUESTS = {
  english: [
    { word: 'SUBMARINE', meaning: 'Deep explorer submersible / Подводная лодка', hint: 'Navigates silent abyssal trenches and oceanic depths', emoji: '🚢' },
    { word: 'AQUARIUM', meaning: 'Living aquatic sanctuary / Аквариум', hint: 'Glass-walled haven teeming with vibrant marine life', emoji: '🐠' },
    { word: 'JELLYFISH', meaning: 'Luminescent bell / Медуза', hint: 'Translucent creature pulsating gently with ocean tides', emoji: '🪼' },
    { word: 'CORALLINE', meaning: 'Calcified reef bloom / Коралловый', hint: 'Roseate calcified structure creating underwater cities', emoji: '🪸' },
    { word: 'OCEANOGRAPHER', meaning: 'Deep sea scientist / Океанограф', hint: 'Scholar mapping the mysterious uncharted ocean floor', emoji: '🧭' },
    { word: 'HYDROSPHERE', meaning: 'Earth ocean envelope / Гидросфера', hint: 'Global mantle of living water sustaining all life', emoji: '🌍' },
    { word: 'BIOLUMINESCENCE', meaning: 'Living abyss glow / Биолюминесценция', hint: 'Ethereal blue-green light glowing in the dark depths', emoji: '✨' },
    { word: 'BATHYSPHERE', meaning: 'Abyssal diving orb / Батисфера', hint: 'Reinforced steel chamber venturing into the abyss', emoji: '🔮' },
    { word: 'SEAMOUNT', meaning: 'Underwater mountain / Подводная гора', hint: 'Submerged peak rising thousands of feet from seabed', emoji: '🏔️' },
    { word: 'NAUTILUS', meaning: 'Primordial spiral sailor / Наутилус', hint: 'Living fossil sailing with a perfect geometric spiral shell', emoji: '🐚' },
    { word: 'DEEPWATER', meaning: 'Abyssal ocean realm / Глубоководный', hint: 'Calm, pressurized depths beneath the sunlit surface', emoji: '🌊' },
    { word: 'WHALEFALL', meaning: 'Benthic haven / Оазис глубин', hint: 'Deep sea ecosystem nourished by a gentle leviathan', emoji: '🐋' },
    { word: 'WATERFALL', meaning: 'Mountain torrent / Водопад', hint: 'Dramatic surge of mountain water rushing to the sea', emoji: '🏞️' },
    { word: 'PLANKTONIC', meaning: 'Drifting ocean life / Планктонный', hint: 'Microscopic wanderers drifting upon pelagic currents', emoji: '🦠' },
    { word: 'TRENCHES', meaning: 'Abyssal chasms / Океанические впадины', hint: 'Deepest canyons on Earth shrouded in tranquil silence', emoji: '🕳️' },
  ],
  spanish: [
    { word: 'SUBMARINO', meaning: 'Deep explorer vessel / Подлодка', hint: 'Nave de exploración en profundidades abisales', emoji: '🚢' },
    { word: 'PROFUNDIDAD', meaning: 'Abyssal depth / Глубина', hint: 'Misterio insondable bajo la superficie marina', emoji: '🌊' },
    { word: 'CORALINO', meaning: 'Living coral garden / Коралловый', hint: 'Jardín submarino de calcita viva y colores radiantes', emoji: '🪸' },
    { word: 'OCEANOGRAFIA', meaning: 'Ocean science / Океанография', hint: 'Estudio de corrientes, misterios y vida marina', emoji: '🧭' },
    { word: 'HIDROSFERA', meaning: 'Water mantle / Гидросфера', hint: 'El manto azul acuático que abraza la Tierra', emoji: '🌍' },
    { word: 'ARRECIFES', meaning: 'Living reefs / Рифы', hint: 'Fortaleza viva de biodiversidad y oleaje sereno', emoji: '🏝️' },
    { word: 'ACUATICO', meaning: 'Aquatic realm / Водный', hint: 'Ser nacido para navegar las aguas cristalinas', emoji: '💧' },
    { word: 'NAUTILUS', meaning: 'Primordial cephalopod / Наутилус', hint: 'Fósil viviente navegando con concha perfecta', emoji: '🐚' },
    { word: 'BALLENATO', meaning: 'Young whale / Детеныш кита', hint: 'Cría majestuosa de cetáceo en aguas cálidas', emoji: '🐋' },
    { word: 'MEDUSARIO', meaning: 'Jellyfish haven / Медузарий', hint: 'Espacio flotante donde danzan las medusas luminosas', emoji: '🪼' },
  ],
  russian: [
    { word: 'АКВАЛАНГИСТ', meaning: 'Scuba diver / Подводный исследователь', hint: 'Исследователь таинственных глубин и морских рифов', emoji: '🤿' },
    { word: 'ОКЕАНОЛОГИЯ', meaning: 'Oceanology / Наука об океане', hint: 'Наука о тайнах великих водных просторов планеты', emoji: '🧭' },
    { word: 'ГИДРОСФЕРА', meaning: 'Hydrosphere / Водная оболочка', hint: 'Водная оболочка планеты, питающая каждую каплю жизни', emoji: '🌍' },
    { word: 'КОРАЛЛОВЫЙ', meaning: 'Coralline reef / Коралловый риф', hint: 'Подводный рифовый сад, полный сияющих красок', emoji: '🪸' },
    { word: 'ЖЕМЧУЖИНА', meaning: 'Gleaming pearl / Морская жемчужина', hint: 'Сокровище, рожденное в глубине перламутровой раковины', emoji: '🦪' },
    { word: 'ПОДВОДНИК', meaning: 'Submariner / Глубоководный мореплаватель', hint: 'Покоритель безмолвных и загадочных глубин океана', emoji: '🚢' },
    { word: 'БАТИСКАФ', meaning: 'Bathyscaphe / Глубоководный аппарат', hint: 'Прочный аппарат для погружения на дно Марианской впадины', emoji: '🔮' },
    { word: 'АКВАМАРИН', meaning: 'Aquamarine gem / Морской камень', hint: 'Драгоценный кристалл цвета спокойной морской волны', emoji: '💎' },
    { word: 'МОРЕПЛАВАТЕЛЬ', meaning: 'Navigator / Мореход', hint: 'Смелый искатель новых горизонтов за краем синего моря', emoji: '⛵' },
    { word: 'ГЛУБИННЫЙ', meaning: 'Abyssal / Глубинный житель', hint: 'Таящийся на дне великих океанических желобов', emoji: '🌊' },
    { word: 'ВОДОПАДЫ', meaning: 'Waterfalls / Каскады воды', hint: 'Бурные хрустальные потоки, устремленные к океану', emoji: '🏞️' },
    { word: 'ДЕЛЬФИНАРИЙ', meaning: 'Dolphins sanctuary / Дельфинарий', hint: 'Заповедник умных и грациозных морских обитателей', emoji: '🐬' },
    { word: 'ВОДООЧИСТКА', meaning: 'Water purification / Чистая вода', hint: 'Возвращение воде первозданной чистоты и прозрачности', emoji: '💧' },
  ],
  german: [
    { word: 'UNTERWASSER', meaning: 'Underwater world / Подводный мир', hint: 'Geheimnisvolle Welt unter der spiegelnden Meeresoberfläche', emoji: '🌊' },
    { word: 'MEERESTIEFE', meaning: 'Ocean abyss / Морская глубина', hint: 'Unergründliche Stille und Erhabenheit des tiefen Meeres', emoji: '🚢' },
    { word: 'KORALLENRIFF', meaning: 'Coral reef / Коралловый риф', hint: 'Farbenprächtige Unterwassergärten voller buntem Leben', emoji: '🪸' },
    { word: 'WASSERFALL', meaning: 'Waterfall / Водопад', hint: 'Rauschender Sturz kristallklarer Bergwasser zum Meer', emoji: '🏞️' },
    { word: 'TIEFSEEFAHRT', meaning: 'Deep sea voyage / Глубоководный рейс', hint: 'Reise in die dunkelsten Tiefseegräben der Erde', emoji: '🔮' },
    { word: 'PERLMUTT', meaning: 'Mother-of-pearl / Перламутр', hint: 'Schillernder Glanz aus uralten Muschelschalen', emoji: '🦪' },
    { word: 'MEERESWOGE', meaning: 'Ocean wave / Морская волна', hint: 'Mächtige, friedliche Welle auf dem weiten Ozean', emoji: '🌊' },
    { word: 'NAUTILUS', meaning: 'Spiral cephalopod / Наутилус', hint: 'Uralter Seefahrer mit vollkommener Spiralschale', emoji: '🐚' },
  ],
  french: [
    { word: 'SUBMERSIBLE', meaning: 'Deep submarine / Подводный аппарат', hint: 'Vaisseau explorant les abysses mystérieux et calmes', emoji: '🚢' },
    { word: 'PROFONDEUR', meaning: 'Abyssal depth / Глубина', hint: 'Calme absolu régnant sous le tumulte des vagues', emoji: '🌊' },
    { word: 'OCEANOGRAPHE', meaning: 'Oceanographer / Океанограф', hint: 'Chercheur scrutant les secrets des grands fonds marins', emoji: '🧭' },
    { word: 'CORALLIEN', meaning: 'Coral reef / Коралловый', hint: 'Récif éclatant de lumière et berceau de vie marine', emoji: '🪸' },
    { word: 'AQUATIQUE', meaning: 'Aquatic realm / Водный', hint: 'Royaume fluide baigné de sérénité et d’eau pure', emoji: '💧' },
    { word: 'HYDROSPHERE', meaning: 'Hydrosphere / Гидросфера', hint: 'Voile bleu précieux protégeant la vie terrestre', emoji: '🌍' },
    { word: 'CHELONIEN', meaning: 'Sea turtle / Морская черепаха', hint: 'Tortue marine voyageant paisiblement entre les récifs', emoji: '🐢' },
  ],
  italian: [
    { word: 'SOTTOMARINO', meaning: 'Submarine vessel / Подлодка', hint: 'Esploratore delle profondità silenziose del mare', emoji: '🚢' },
    { word: 'PROFONDITA', meaning: 'Deep sea / Глубина', hint: 'Regno abissale di pace e mistero oceanico', emoji: '🌊' },
    { word: 'OCEANOGRAFO', meaning: 'Oceanographer / Океанограф', hint: 'Scienziato che legge le correnti e i fondali dei mari', emoji: '🧭' },
    { word: 'CORALLINO', meaning: 'Coral marine / Коралловый', hint: 'Sfumature calde dei fondali del Mediterraneo', emoji: '🪸' },
    { word: 'ACQUATICO', meaning: 'Aquatic / Водный', hint: 'Mondo limpido nutrito da acque trasparenti', emoji: '💧' },
    { word: 'IMMERSIONE', meaning: 'Deep dive / Погружение', hint: 'Viaggio quieto nel cuore dell’azzurro infinito', emoji: '🤿' },
    { word: 'IDROSFERA', meaning: 'Hydrosphere / Гидросфера', hint: 'Il grande respiro azzurro d’acqua della Terra', emoji: '🌍' },
    { word: 'CAVALLUCCIO', meaning: 'Seahorse / Морской конек', hint: 'Ippocampo danzante con eleganza tra le alghe', emoji: '🌊' },
  ],
};

// Endpoint 0: Get curated Special Words (all 8+ letters) for the active language
cubeWordRouter.get('/target-words', async (req, res) => {
  const lang = (req.query.language || 'english').toString().toLowerCase();
  const list = (TARGET_WORD_QUESTS[lang] || TARGET_WORD_QUESTS.english).filter((q) => q.word.length >= 8);
  res.json({ language: lang, quests: list });
});

// Endpoint 0b: Generate a fresh AI Special Word dynamically (strictly 8+ letters long)
cubeWordRouter.get('/generate-special-word', async (req, res) => {
  const lang = (req.query.language || 'english').toString().toLowerCase();
  const ai = getGenAI();

  if (ai) {
    try {
      const prompt = `You are a marine linguist creating a SPECIAL COMBO BONUS TARGET WORD for an aquatic word-puzzle game in ${lang}.
Pick an evocative, sophisticated, genuine, and recognizable word in ${lang} AT LEAST 8 LETTERS LONG (strictly between 8 and 14 letters).
CRITICAL REQUIREMENT: The word MUST be 8 letters long or longer! Never return a word shorter than 8 letters.
Theme: Oceanic exploration, aquatic mysteries, deep sea wonders, water ecosystems, marine life, or philological nature.
Rules:
1. Must be a valid dictionary word in ${lang} with word.length >= 8.
2. Provide a short meaning in Russian and English.
3. Provide a brief 1-sentence poetic clue.
4. Output STRICT JSON:
{
  "word": "CAPITALIZED_WORD",
  "meaning": "Meaning / Значение",
  "hint": "Poetic clue about this word",
  "emoji": "🌊"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.85,
        },
      });

      const text = response.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        const cleanWord = (parsed.word || '').trim().toUpperCase();
        if (cleanWord && cleanWord.length >= 8) {
          return res.json({
            language: lang,
            quest: {
              word: cleanWord,
              meaning: parsed.meaning || '',
              hint: parsed.hint || '',
              emoji: parsed.emoji || '🌊',
            },
          });
        }
      }
    } catch (err) {
      console.warn('AI special word generation fallback:', err.message);
    }
  }

  // Fallback to random 8+ letter curated quest
  const fullList = (TARGET_WORD_QUESTS[lang] || TARGET_WORD_QUESTS.english).filter((q) => q.word.length >= 8);
  const randomQuest = fullList[Math.floor(Math.random() * fullList.length)];
  res.json({ language: lang, quest: randomQuest });
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

    // 1. Anti-Repetition Guard: Check if word was used in current or previous 2 rounds
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

    // 2. Base scoring calculation based on user rules
    const wordLength = cleanWord.length;
    let basePoints = wordLength >= 10 ? 20 : 10;
    let isComplexTerm = wordLength >= 10;
    let definition = '';
    let partOfSpeech = 'word';
    let ipa = '';

    // Fast-track check via built-in high-frequency philological lexicon
    const langLexicon = HIGH_FREQUENCY_LEXICON[langKey];
    const isLexiconMatch = langLexicon && langLexicon.has(cleanWord);

    // Call Gemini AI for definitive linguistic and philological validation
    const ai = getGenAI();
    if (ai) {
      try {
        const prompt = `You are an expert philologist, lexicographer, and dictionary editor for the ${language} language.
Analyze if the following letter sequence is an authentic, truly existing, linguistically recognized valid word in ${language}.
Word candidate: "${cleanWord}"

Rules:
1. Accept genuine standard dictionary words, common inflections, nouns, verbs, adjectives, adverbs, and scientific/philological terms.
2. Reject random letter mashups, typos, gibberish, or fabricated syllables.
3. Determine if this word is considered a complex, scientific, literary, or technical specific term.
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

    // Fallback: Check built-in high-frequency lexicon if offline or AI call throttled
    if (isLexiconMatch || isTargetMatch) {
      const multiplier = isTargetMatch ? 5 : (isComplexTerm ? 2 : 1);
      const finalPoints = basePoints * multiplier;

      return res.json({
        isValid: true,
        word: cleanWord,
        language: langKey,
        definition: isTargetMatch ? `Target quest special word in ${language}.` : `Recognized philological vocabulary word in ${language}.`,
        partOfSpeech: 'noun',
        ipa: '',
        isComplexTerm,
        points: finalPoints,
        bonusMultiplier: multiplier,
        isSpecialWord: Boolean(isTargetMatch),
        reason: isTargetMatch ? 'validated_by_target_quest' : 'validated_by_lexicon',
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
