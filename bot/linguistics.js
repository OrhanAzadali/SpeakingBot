// bot/linguistics.js
// Advanced multi-language linguistics engine:
// 1. Holistic phrase concord & citation form harmonizer (e.g. "красная луна", NOT "красный луна")
// 2. Multilingual text tokenization (Intl.Segmenter for CJK, Arabic RTL, Cyrillic, Latin)
// 3. Right-to-Left (RTL) and CJK PDF text preparation and shaping

// ── 1. Russian Grammatical Gender & Agreement Knowledge Base ──────────────────
const RU_FEMININE_NOUNS = new Set([
  "луна", "вода", "земля", "ночь", "жизнь", "книга", "звезда", "собака", "машина",
  "стена", "дорога", "река", "голова", "рука", "нога", "любовь", "радость", "площадь",
  "истина", "птица", "трава", "музыка", "минута", "неделя", "сила", "работа", "правда",
  "школа", "природа", "сестра", "дочь", "мать", "весна", "зима", "осень", "комната",
  "песня", "рыба", "кошка", "дверь", "кровать", "мысль", "чашка", "ложка", "тарелка",
  "газета", "статья", "тетрадь", "картина", "погода", "улица", "страна", "деревня",
  "семья", "проблема", "ошибка", "встреча", "помощь", "вещь", "часть", "память",
  "смерть", "боль", "цель", "степь", "тень", "тишина", "красота", "надежда", "вера"
]);

const RU_NEUTER_NOUNS = new Set([
  "солнце", "окно", "море", "небо", "утро", "поле", "время", "имя", "дело", "слово",
  "животное", "здание", "решение", "чувство", "сердце", "яблоко", "лето", "молоко",
  "дерево", "письмо", "лицо", "место", "тело", "платье", "счастье", "здание", "знание",
  "внимание", "состояние", "развитие", "отношение", "правило", "число", "произведение"
]);

// Common verb past/present stems for Russian collocation infinitive restoration
const RU_VERB_CONVERSIONS = [
  { match: /^(встречал[аои]?|встречает|встречают)$/i, inf: "встречать" },
  { match: /^(делал[аои]?|делает|делают)$/i, inf: "делать" },
  { match: /^(принимал[аои]?|принимает|принимают)$/i, inf: "принимать" },
  { match: /^(играл[аои]?|играет|играют)$/i, inf: "играть" },
  { match: /^(говорил[аои]?|говорит|говорят)$/i, inf: "говорить" },
  { match: /^(читал[аои]?|читает|читают)$/i, inf: "читать" },
  { match: /^(писал[аои]?|пишет|пишут)$/i, inf: "писать" },
  { match: /^(смотрел[аои]?|смотрит|смотрят)$/i, inf: "смотреть" },
  { match: /^(слушал[аои]?|слушает|слушают)$/i, inf: "слушать" },
  { match: /^(знал[аои]?|знает|знают)$/i, inf: "знать" },
  { match: /^(думал[аои]?|думает|думают)$/i, inf: "думать" },
  { match: /^(понимал[аои]?|понимает|понимают)$/i, inf: "понимать" },
  { match: /^(любил[аои]?|любит|любят)$/i, inf: "любить" },
  { match: /^(пил[аои]?|пьет|пьют)$/i, inf: "пить" },
  { match: /^(ел[аои]?|ест|едят)$/i, inf: "есть" },
  { match: /^(жил[аои]?|живет|живут)$/i, inf: "жить" }
];

/**
 * Harmonize Russian Adjective to match Noun gender in nominative citation form.
 * Solves: "красный луна" -> "красная луна", "холодный вода" -> "холодная вода", "зеленый яблоко" -> "зеленое яблоко"
 */
function harmonizeRuAdjectiveWithNoun(adj, noun) {
  const normNoun = noun.toLowerCase().trim();
  const normAdj = adj.toLowerCase().trim();

  // Determine gender of the noun
  let gender = "masculine";
  if (
    RU_FEMININE_NOUNS.has(normNoun) ||
    normNoun.endsWith("а") ||
    normNoun.endsWith("я") ||
    (normNoun.endsWith("ь") && !normNoun.endsWith("тель") && RU_FEMININE_NOUNS.has(normNoun))
  ) {
    gender = "feminine";
  } else if (
    RU_NEUTER_NOUNS.has(normNoun) ||
    normNoun.endsWith("о") ||
    normNoun.endsWith("е") ||
    normNoun.endsWith("мя")
  ) {
    gender = "neuter";
  }

  // If already agreeing or not an adjective, keep as is
  if (gender === "feminine") {
    if (normAdj.endsWith("ая") || normAdj.endsWith("яя")) return adj;
    // Base adjective ends in -ый, -ой, -ий
    if (normAdj.endsWith("ый") || normAdj.endsWith("ой")) {
      const stem = adj.slice(0, -2);
      return stem + (adj === normAdj ? "ая" : "АЯ");
    }
    if (normAdj.endsWith("ий")) {
      const stem = adj.slice(0, -2);
      const lastChar = stem.slice(-1).toLowerCase();
      // Velars and sibilants take -ая (г, к, х, ж, ч, ш, щ)
      if (/[гкхжчшщ]/.test(lastChar)) {
        return stem + (adj === normAdj ? "ая" : "АЯ");
      }
      return stem + (adj === normAdj ? "яя" : "ЯЯ");
    }
  } else if (gender === "neuter") {
    if (normAdj.endsWith("ое") || normAdj.endsWith("ее")) return adj;
    if (normAdj.endsWith("ый") || normAdj.endsWith("ой")) {
      const stem = adj.slice(0, -2);
      return stem + (adj === normAdj ? "ое" : "ОЕ");
    }
    if (normAdj.endsWith("ий")) {
      const stem = adj.slice(0, -2);
      const lastChar = stem.slice(-1).toLowerCase();
      if (/[гкх]/.test(lastChar)) {
        return stem + (adj === normAdj ? "ое" : "ОЕ");
      }
      return stem + (adj === normAdj ? "ее" : "ЕЕ");
    }
  } else if (gender === "masculine") {
    // If mistakenly given feminine or neuter ending with masculine noun (e.g. "красная дом")
    if (normAdj.endsWith("ая") || normAdj.endsWith("ое")) {
      const stem = adj.slice(0, -2);
      return stem + (adj === normAdj ? "ый" : "ЫЙ");
    }
  }

  return adj;
}

/**
 * Harmonizes a multi-word phrase into its natural dictionary citation form.
 * Never blindly converts every word in isolation; respects holistic concord.
 */
export function harmonizePhraseLemma(phrase, language = "russian") {
  if (!phrase || typeof phrase !== "string") return "";
  const trimmed = phrase.trim();
  if (!trimmed) return "";

  const lang = String(language || "russian").toLowerCase();

  // If single word, return directly
  if (!trimmed.includes(" ") && !trimmed.includes("-")) {
    return trimmed;
  }

  const words = trimmed.split(/\s+/);

  // 1. Russian Phrasal Infinitivization & Agreement
  if (lang.includes("russ") || lang.includes("ru")) {
    // Check if first word is a conjugated verb
    for (const rule of RU_VERB_CONVERSIONS) {
      if (rule.match.test(words[0])) {
        words[0] = rule.inf;
        return words.join(" ");
      }
    }

    // Two-word Adjective + Noun collocation (e.g. "красный луна", "холодная вода")
    if (words.length === 2) {
      const [first, second] = words;
      // Check if first is adjective-like
      const isAdj = /([ыиое]й|[ая]я|[ое]е|[ыи]е)$/i.test(first);
      if (isAdj) {
        const harmonizedFirst = harmonizeRuAdjectiveWithNoun(first, second);
        return `${harmonizedFirst} ${second}`;
      }
    }

    // Three-word phrases (e.g. "очень холодная вода", "яркая красная луна")
    if (words.length === 3) {
      const last = words[2];
      const middle = words[1];
      if (/([ыиое]й|[ая]я|[ое]е|[ыи]е)$/i.test(middle)) {
        words[1] = harmonizeRuAdjectiveWithNoun(middle, last);
      }
      if (/([ыиое]й|[ая]я|[ое]е|[ыи]е)$/i.test(words[0])) {
        words[0] = harmonizeRuAdjectiveWithNoun(words[0], last);
      }
      return words.join(" ");
    }
  }

  // 2. English Verb Phrase / Collocation Harmonization
  if (lang.includes("eng")) {
    // e.g. "taking care of" -> "take care of", "looking forward to" -> "look forward to"
    const firstLower = words[0].toLowerCase();
    const EN_VERB_ING_MAP = {
      taking: "take",
      making: "make",
      having: "have",
      looking: "look",
      going: "go",
      getting: "get",
      giving: "give",
      putting: "put",
      running: "run",
      paying: "pay",
      keeping: "keep",
      holding: "hold",
      bringing: "bring",
      setting: "set"
    };
    if (EN_VERB_ING_MAP[firstLower]) {
      words[0] = EN_VERB_ING_MAP[firstLower];
      return words.join(" ");
    }
  }

  return trimmed;
}

// ── 2. Multilingual Tokenization (CJK, Hieroglyphs, RTL, Words) ───────────────
export function tokenizeText(text, language = "en") {
  if (!text) return [];
  const langKey = String(language || "en").toLowerCase();

  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(langKey.slice(0, 2), { granularity: "word" });
      const segments = [];
      for (const { segment, isWordLike } of segmenter.segment(text)) {
        if (isWordLike || segment.trim()) {
          segments.push(segment.trim());
        }
      }
      return segments.filter(Boolean);
    }
  } catch {
    // Fallback if Intl.Segmenter fails for unknown locale
  }

  // Fallback regex tokenizer supporting Unicode letters and hieroglyphs
  return (text.match(/[\p{L}\p{N}\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff]+/gu) || []);
}

// ── 3. RTL (Arabic/Hebrew) & Unicode PDF Text Preparer ────────────────────────
export function isRtlScript(text) {
  if (!text) return false;
  // Arabic, Hebrew, Syriac, Thaana, Samaritan
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/u.test(text);
}

export function isCjkScript(text) {
  if (!text) return false;
  // Chinese, Japanese, Korean
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/u.test(text);
}

/**
 * Prepares text for PDFKit rendering so that:
 * - Special characters and hieroglyphs are preserved
 * - Dangerous control codes that crash PDFKit are stripped
 * - RTL text lines are visually reordered for LTR PDF flow
 */
export function prepareTextForPdf(rawText, targetLanguage = "en") {
  if (!rawText) return "";
  let text = String(rawText)
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[\u2010\u2011\u2012]/g, "-")
    .replace(/[\u2013\u2014]/g, " — ")
    .replace(/\u2212/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Strip only unrenderable emoji ranges that lack TTF glyphs in PDFKit
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, "")
    .trim();

  // If text is primarily RTL (Arabic / Hebrew), reverse words for PDFKit visual order
  if (isRtlScript(text)) {
    const lines = text.split("\n");
    const reorderedLines = lines.map((line) => {
      if (isRtlScript(line)) {
        // Reverse token order so PDFKit outputs right-to-left correctly
        return line.split(/\s+/).reverse().join(" ");
      }
      return line;
    });
    return reorderedLines.join("\n");
  }

  return text;
}
