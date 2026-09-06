// miniapp/src/utils/linguistics.js
// Client-side linguistics & tokenization engine:
// 1. Concord harmonizer for multi-word phrases & collocations
// 2. Multilingual word tokenization (CJK hieroglyphs, Arabic RTL, Cyrillic, Latin)
// 3. Direction and script detection

const RU_FEMININE_NOUNS = new Set([
  "луна", "вода", "земля", "ночь", "жизнь", "книга", "звезда", "собака", "машина",
  "стена", "дорога", "река", "голова", "рука", "нога", "любовь", "радость", "площадь",
  "истина", "птица", "трава", "музыка", "минута", "неделя", "сила", "работа", "правда",
  "школа", "природа", "сестра", "дочь", "мать", "весна", "зима", "осень", "комната",
  "песня", "рыба", "кошка", "дверь", "кровать", "мысль", "чашка", "ложка", "тарелка"
]);

const RU_NEUTER_NOUNS = new Set([
  "солнце", "окно", "море", "небо", "утро", "поле", "время", "имя", "дело", "слово",
  "животное", "здание", "решение", "чувство", "сердце", "яблоко", "лето", "молоко",
  "дерево", "письмо", "лицо", "место", "тело", "платье", "счастье", "знание"
]);

function harmonizeRuAdjectiveWithNoun(adj, noun) {
  const normNoun = noun.toLowerCase().trim();
  const normAdj = adj.toLowerCase().trim();

  let gender = "masculine";
  if (
    RU_FEMININE_NOUNS.has(normNoun) ||
    normNoun.endsWith("а") ||
    normNoun.endsWith("я") ||
    (normNoun.endsWith("ь") && RU_FEMININE_NOUNS.has(normNoun))
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

  if (gender === "feminine") {
    if (normAdj.endsWith("ая") || normAdj.endsWith("яя")) return adj;
    if (normAdj.endsWith("ый") || normAdj.endsWith("ой")) {
      const stem = adj.slice(0, -2);
      return stem + (adj === normAdj ? "ая" : "АЯ");
    }
    if (normAdj.endsWith("ий")) {
      const stem = adj.slice(0, -2);
      const lastChar = stem.slice(-1).toLowerCase();
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
  }

  return adj;
}

export function harmonizePhraseLemma(phrase, language = "russian") {
  if (!phrase || typeof phrase !== "string") return "";
  const trimmed = phrase.trim();
  if (!trimmed) return "";

  const lang = String(language || "russian").toLowerCase();
  if (!trimmed.includes(" ") && !trimmed.includes("-")) {
    return trimmed;
  }

  const words = trimmed.split(/\s+/);
  if (lang.includes("russ") || lang.includes("ru")) {
    if (words.length === 2) {
      const [first, second] = words;
      if (/([ыиое]й|[ая]я|[ое]е|[ыи]е)$/i.test(first)) {
        const harmonizedFirst = harmonizeRuAdjectiveWithNoun(first, second);
        return `${harmonizedFirst} ${second}`;
      }
    }
  }

  return trimmed;
}

export function isRtlScript(text) {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/u.test(text);
}

export function isCjkScript(text) {
  if (!text) return false;
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/u.test(text);
}

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
  } catch {}

  return (text.match(/[\p{L}\p{N}\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u0600-\u06ff]+/gu) || []);
}
