import { createRequire } from 'module';
import { isValidWordToken, SCRABBLE_NOISE_BLACKLIST } from './wordTokenValidator.js';

const require = createRequire(import.meta.url);

// Cache of loaded word sets per language
const dictionarySets = {
  english: null,
  russian: null,
  spanish: null,
  german: null,
  french: null,
  italian: null,
};

// Normalize string for dictionary matching (removes accents, handles uppercase, maps Ё->Е)
export function normalizeWord(word, lang = 'english') {
  if (!word || typeof word !== 'string') return '';
  let str = word.trim().toUpperCase();

  if (lang === 'russian') {
    str = str.replace(/Ё/g, 'Е');
  } else {
    // Strip diacritics for flexible matching if needed
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  return str;
}

// Lazy-load dictionary set for the requested language
export function getDictionary(lang = 'english') {
  const key = (lang || 'english').toLowerCase();

  if (dictionarySets[key]) {
    return dictionarySets[key];
  }

  const set = new Set();
  const normalizedSet = new Set();

  try {
    let rawList = [];
    if (key === 'english') {
      rawList = require('an-array-of-english-words');
    } else if (key === 'russian') {
      rawList = require('russian-words');
    } else if (key === 'spanish') {
      rawList = require('an-array-of-spanish-words');
    } else if (key === 'french') {
      rawList = require('an-array-of-french-words');
    } else if (key === 'italian') {
      rawList = require('an-array-of-italian-words');
    } else if (key === 'german') {
      rawList = require('all-the-german-words');
    }

    if (Array.isArray(rawList)) {
      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (typeof item === 'string' && item.length >= 3) {
          const up = item.toUpperCase();
          if (!SCRABBLE_NOISE_BLACKLIST.has(up)) {
            set.add(up);
            normalizedSet.add(normalizeWord(up, key));
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Dictionary] Failed to load full dictionary for ${key}:`, err.message);
  }

  // Also include essential core vocabulary & aquatic terms as guaranteed fallback
  const CORE_SUPPLEMENT = {
    english: [
      'CAT', 'DOG', 'SUN', 'SKY', 'SEA', 'WATER', 'FISH', 'BOAT', 'SHIP', 'WAVE', 'WIND',
      'RAIN', 'SAND', 'REEF', 'TIDE', 'DEEP', 'SURF', 'CRAB', 'SEAL', 'BLUE', 'GOLD',
      'STAR', 'MOON', 'TREE', 'BIRD', 'LIFE', 'LOVE', 'HOPE', 'PEACE', 'BEAR', 'LION',
      'SWIM', 'DIVE', 'FLOW', 'SURGE', 'OCEAN', 'SHORE', 'SHELL', 'CORAL', 'PEARL', 'RIVER',
      'LAKE', 'POND', 'AQUA', 'SAIL', 'MAST', 'ROPE', 'NET', 'HOOK', 'KNOT', 'ISLAND',
      'BEACH', 'STORM', 'CALM', 'BREEZE', 'FLOAT', 'DRIFT', 'GLIDE', 'SPLASH', 'BUBBLE',
      'CURRENT', 'FOAM', 'WHALE', 'SHARK', 'TURTLE', 'DOLPHIN', 'SUBMARINE', 'NAUTILUS',
      'AQUARIUM', 'JELLYFISH', 'CORALLINE', 'HYDROSPHERE', 'OCEANOGRAPHER',
    ],
    russian: [
      'КОТ', 'ДОМ', 'МИР', 'САД', 'ЛЕС', 'РЕКА', 'МОРЕ', 'ВОДА', 'РЫБА', 'КИТ', 'ВОЛНА',
      'НЕБО', 'ЛУНА', 'ВЕТЕР', 'ДОЖДЬ', 'СНЕГ', 'ЗИМА', 'ЛЕТО', 'ДЕНЬ', 'НОЧЬ', 'УТРО',
      'ДРУГ', 'РУКА', 'ГЛАЗ', 'ДУША', 'СВЕТ', 'ПТИЦА', 'ЗВЕРЬ', 'ВОЛК', 'ЛИСА', 'ОЛЕНЬ',
      'ПЕСОК', 'ПЛЯЖ', 'ЛОДКА', 'КОРАБЛЬ', 'ПАРУС', 'ЯКОРЬ', 'ОСТРОВ', 'ПРИБОЙ', 'БУРЯ',
      'ШТИЛЬ', 'ОКЕАН', 'ЖЕМЧУГ', 'ДЕЛЬФИН', 'КОРАЛЛ', 'ПОДВОДНИК', 'БАТИСКАФ', 'АКВАЛАНГИСТ',
      'ГИДРОСФЕРА', 'ОКЕАНОЛОГИЯ', 'КОРАЛЛОВЫЙ', 'ЖЕМЧУЖИНА',
    ],
    spanish: [
      'SOL', 'MAR', 'PAN', 'LUZ', 'PAZ', 'AGUA', 'VIDA', 'GATO', 'CIELO', 'PLAYA', 'BARCO',
      'PECES', 'CORAL', 'PERLA', 'ISLA', 'OLA', 'RIO', 'LAGO', 'ARENA', 'BUCEO', 'MAREA',
      'AZUL', 'VIENTO', 'LLUVIA', 'NORTE', 'SUR', 'AMOR', 'TIEMPO', 'MUNDO', 'SUBMARINO',
      'PROFUNDIDAD', 'CORALINO', 'OCEANOGRAFIA', 'HIDROSFERA', 'ARRECIFES', 'ACUATICO',
    ],
    german: [
      'SEE', 'MEER', 'TAG', 'JAHR', 'ZEIT', 'HAUS', 'WORT', 'BUCH', 'HAND', 'AUGE', 'STADT',
      'LAND', 'LEBEN', 'WELT', 'WASSER', 'FEUER', 'SONNE', 'MOND', 'STERN', 'BOOT', 'SCHIFF',
      'WELLE', 'INSEL', 'STRAND', 'FISCH', 'KORALLE', 'PERLE', 'TAUCHEN', 'UNTERWASSER',
      'MEERESTIEFE', 'KORALLENRIFF', 'WASSERFALL', 'TIEFSEEFAHRT', 'PERLMUTT',
    ],
    french: [
      'EAU', 'MER', 'CIEL', 'JOUR', 'NUIT', 'MAIN', 'TEMPS', 'MOT', 'FEU', 'VENT', 'PLUIE',
      'POISSON', 'BATEAU', 'NAVIRE', 'PLAGE', 'SABLE', 'VAGUE', 'ILE', 'CORAIL', 'PERLE',
      'OCEAN', 'BLEU', 'PLONGEE', 'MAREE', 'SUBMERSIBLE', 'PROFONDEUR', 'OCEANOGRAPHE',
      'CORALLIEN', 'AQUATIQUE', 'HYDROSPHERE',
    ],
    italian: [
      'SOL', 'MAR', 'ACQUA', 'MARE', 'VITA', 'CASA', 'LUNA', 'CIELO', 'ONDA', 'ISOLA',
      'PESCE', 'BARCA', 'NAVE', 'VENTO', 'PIOGGIA', 'SPIAGGIA', 'SABBIA', 'CORALLO',
      'PERLA', 'AZZURRO', 'SUBACQUEO', 'OCEANO', 'SOTTOMARINO', 'PROFONDITA', 'OCEANOGRAFO',
      'CORALLINO', 'ACQUATICO', 'IMMERSIONE', 'IDROSFERA',
    ],
  };

  const core = CORE_SUPPLEMENT[key] || [];
  core.forEach((w) => {
    set.add(w.toUpperCase());
    normalizedSet.add(normalizeWord(w, key));
  });

  dictionarySets[key] = { set, normalizedSet };
  console.log(`[Dictionary] Loaded ${set.size.toLocaleString()} words for ${key}`);
  return dictionarySets[key];
}

// Instant check if a word exists in the dictionary and is an authentic word token
export function isWordInDictionary(word, lang = 'english') {
  if (!word || typeof word !== 'string' || word.trim().length < 3) {
    return false;
  }

  const clean = word.trim().toUpperCase();
  // Reject blacklisted Scrabble noise, abbreviations, or invalid phonotactics
  const tokenCheck = isValidWordToken(clean, lang);
  if (!tokenCheck.isValid) {
    return false;
  }

  const dict = getDictionary(lang);
  if (!dict) return false;

  if (dict.set.has(clean)) return true;

  const norm = normalizeWord(clean, lang);
  return dict.normalizedSet.has(norm);
}

// Pick `count` random real dictionary words whose length falls within
// [minLength, maxLength] (inclusive), for ANY topic — used to generate combo
// / target words without tying their subject matter to any particular theme
// (e.g. the game's aquatic background music). Only plain alphabetic words are
// considered (no hyphens, apostrophes, or spaces), since those can't be
// spelled out by falling letter blocks.
export function getRandomWordsByLength(lang = 'english', minLength = 4, maxLength = 8, count = 1) {
  const dict = getDictionary(lang);
  if (!dict || dict.set.size === 0) return [];

  const lo = Math.max(3, Math.min(minLength, maxLength));
  const hi = Math.max(lo, maxLength);

  const candidates = [];
  for (const w of dict.set) {
    if (w.length >= lo && w.length <= hi && /^[A-ZÀ-ʯА-Яа-яЁё]+$/u.test(w)) {
      candidates.push(w);
    }
  }

  if (candidates.length === 0) return [];

  // Shuffle (Fisher-Yates) and take `count`
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}
