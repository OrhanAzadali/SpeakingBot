// Dynamically and safely import compromise so the server never crashes if missing
import { isWordInDictionary } from './dictionary.js';

let nlp = null;
try {
  const mod = await import('compromise');
  nlp = mod.default || mod;
} catch (e) {
  // Compromise is optional; phonotactics and verified lexicons provide full protection
  nlp = null;
}

// Comprehensive set of verified, unambiguous, authentic 3-letter words in English.
// Obscure Scrabble abbreviations/fragments (e.g. "AAL", "ABW", "ADZ", "AFF", "AHT",
// "AHU", "ALF", "ALY", "AMA", "FES", "FUB", "DZU", "CWM", "ENE", "ENG", "ENS", "ERS",
// "FAW", "FEH", "FEU", "FEY", "FID", "FIE", "FIL") are strictly excluded.
export const VERIFIED_3_LETTER_ENGLISH = new Set([
  'ACT', 'ADD', 'AGE', 'AGO', 'AID', 'AIM', 'AIR', 'ALL', 'AND', 'ANT', 'ANY', 'APE',
  'APT', 'ARC', 'ARM', 'ART', 'ASH', 'ASK', 'BAD', 'BAG', 'BAN', 'BAR', 'BAT', 'BAY',
  'BED', 'BEE', 'BEG', 'BET', 'BIG', 'BIN', 'BIT', 'BLU', 'BOW', 'BOX', 'BOY', 'BUG',
  'BUS', 'BUT', 'BUY', 'BYE', 'CAB', 'CAN', 'CAP', 'CAR', 'CAT', 'COW', 'CRY', 'CUP',
  'CUT', 'DAD', 'DAM', 'DAY', 'DEN', 'DEW', 'DID', 'DIE', 'DIG', 'DIM', 'DIP', 'DOG',
  'DOT', 'DRY', 'DUE', 'EAR', 'EAT', 'EGG', 'EGO', 'ELM', 'END', 'ERA', 'EVE', 'EYE',
  'FAN', 'FAR', 'FAT', 'FEE', 'FEW', 'FIG', 'FIT', 'FIX', 'FLY', 'FOG', 'FOR', 'FOX',
  'FRY', 'FUN', 'FUR', 'GAP', 'GAS', 'GEL', 'GEM', 'GET', 'GOD', 'GOT', 'GUM', 'GUN',
  'GUT', 'GUY', 'GYM', 'HAD', 'HAM', 'HAS', 'HAT', 'HAY', 'HEN', 'HER', 'HIM', 'HIS',
  'HIT', 'HOP', 'HOT', 'HOW', 'HUG', 'HUT', 'ICE', 'ILL', 'INK', 'INN', 'ION', 'IVY',
  'JAM', 'JAR', 'JAW', 'JAY', 'JET', 'JOB', 'JOG', 'JOY', 'JUG', 'KEY', 'KID', 'KIN',
  'KIT', 'LAB', 'LAD', 'LAP', 'LAW', 'LAY', 'LEG', 'LET', 'LID', 'LIE', 'LIP', 'LIT',
  'LOG', 'LOT', 'LOW', 'MAD', 'MAN', 'MAP', 'MAT', 'MAY', 'MEN', 'MET', 'MID', 'MIX',
  'MOM', 'MOP', 'MUD', 'MUG', 'NAP', 'NET', 'NEW', 'NOD', 'NOT', 'NOW', 'NUT', 'OAK',
  'OAR', 'ODD', 'OFF', 'OIL', 'OLD', 'ONE', 'OPT', 'ORB', 'ORE', 'OUR', 'OUT', 'OWL',
  'OWN', 'PAD', 'PAN', 'PAW', 'PAY', 'PEA', 'PEG', 'PEN', 'PET', 'PIE', 'PIG', 'PIN',
  'PIT', 'POD', 'POP', 'POT', 'PRO', 'PUB', 'PUP', 'RAD', 'RAG', 'RAM', 'RAN', 'RAP',
  'RAT', 'RAW', 'RAY', 'RED', 'RIB', 'RID', 'RIM', 'RIP', 'ROB', 'ROD', 'ROT', 'ROW',
  'RUB', 'RUG', 'RUN', 'RUT', 'RYE', 'SAD', 'SAG', 'SAP', 'SAT', 'SAW', 'SAY', 'SEA',
  'SEE', 'SET', 'SEW', 'SHY', 'SIN', 'SIP', 'SIR', 'SIT', 'SIX', 'SKI', 'SKY', 'SON',
  'SPY', 'SUM', 'SUN', 'TAB', 'TAG', 'TAN', 'TAP', 'TAR', 'TAX', 'TEA', 'TEN', 'THE',
  'TIE', 'TIN', 'TIP', 'TOE', 'TON', 'TOO', 'TOP', 'TOW', 'TOY', 'TRY', 'TUB', 'TWO',
  'URN', 'USE', 'VAN', 'VET', 'VIA', 'VOW', 'WAR', 'WAS', 'WAY', 'WEB', 'WET', 'WHO',
  'WHY', 'WIG', 'WIN', 'WOK', 'WON', 'YAK', 'YES', 'YET', 'YOU', 'ZEN', 'ZIP', 'ZOO',
]);

export const VERIFIED_3_LETTER_RUSSIAN = new Set([
  'КОТ', 'ДОМ', 'МИР', 'САД', 'ЛЕС', 'РЕКА', 'ВОДА', 'МОРЕ', 'ЧАС', 'ДЕНЬ', 'НОЧЬ',
  'ЛУЧ', 'МЯЧ', 'СЫН', 'ДЕД', 'БОГ', 'ВЕК', 'ВИД', 'ВОР', 'ГАЗ', 'ГОД', 'ГУСЬ',
  'ДАР', 'ДНО', 'ДУБ', 'ДУХ', 'ДЫМ', 'ЖАР', 'ЖУК', 'ЗОВ', 'ЗУБ', 'ИГЛА', 'ИМЯ',
  'ИСК', 'КАР', 'КИТ', 'КОД', 'КОМ', 'КОН', 'КРАЙ', 'КРЮК', 'КУБ', 'КУМ', 'ЛАЗ',
  'ЛАК', 'ЛЕД', 'ЛЕН', 'ЛОБ', 'ЛОВ', 'ЛОМ', 'ЛУГ', 'ЛУК', 'МАГ', 'МАЙ', 'МАК',
  'МАТ', 'МЕД', 'МЕЛ', 'МЕХ', 'МЕЧ', 'МИГ', 'МОХ', 'МУЖ', 'НОС', 'ОКО', 'ОСА',
  'ПАХ', 'ПИР', 'ПОЛ', 'ПОТ', 'ПУХ', 'РАБ', 'РАД', 'РАЙ', 'РАК', 'РОГ', 'РОД',
  'РОЙ', 'РОК', 'РОТ', 'РЯД', 'САМ', 'СЕВ', 'СЕМ', 'СЕТ', 'СИГ', 'СОК', 'СОН',
  'СОР', 'СУК', 'СУП', 'ТАЗ', 'ТИК', 'ТИП', 'ТИР', 'ТОК', 'ТОМ', 'ТОН', 'ТОП',
  'ТОР', 'ТУР', 'УХО', 'УЮТ', 'ФОН', 'ХОР', 'ХОД', 'ЦЕХ', 'ЧАЙ', 'ЧАН', 'ЧИН',
  'ШАГ', 'ШАР', 'ШИП', 'ШОК', 'ШУМ', 'ЩИТ', 'ЭХО', 'ЮГА', 'ЯМА',
]);

export const VERIFIED_3_LETTER_SPANISH = new Set([
  'SOL', 'MAR', 'PAN', 'LUZ', 'PAZ', 'VOZ', 'REY', 'LEY', 'MES', 'DIA', 'ANO', 'GAS',
  'GOL', 'RED', 'SAL', 'SED', 'SUR', 'TIO', 'TIA', 'UVA', 'VIA', 'PIE', 'DON', 'DOS',
  'UNO', 'MAS', 'SIN', 'CON', 'POR', 'QUE', 'DEL', 'LOS', 'LAS', 'UNA', 'SER', 'VER',
  'DAR', 'IR', 'OIR', 'FIN', 'MAL', 'BIEN', 'ORO', 'OJO', 'OLA', 'OSA', 'OSO', 'RIO',
]);

export const VERIFIED_3_LETTER_GERMAN = new Set([
  'SEE', 'TAG', 'MUT', 'NOT', 'ROT', 'GUT', 'ALT', 'NEU', 'TOR', 'EIS', 'OEL', 'WEG',
  'RAT', 'ARM', 'BEI', 'DAS', 'DER', 'DIE', 'EIN', 'FUS', 'GAS', 'HER', 'HIN', 'ICH',
  'IHM', 'IHN', 'IHR', 'IST', 'MIT', 'NUR', 'OFT', 'OPI', 'OMA', 'PAS', 'RAD', 'RUH',
  'SAT', 'SIE', 'TAT', 'TON', 'VOR', 'WAR', 'WIR', 'ZUG',
]);

export const VERIFIED_3_LETTER_FRENCH = new Set([
  'EAU', 'MER', 'AMI', 'BON', 'CIEL', 'COQ', 'DIU', 'DUC', 'ETE', 'FEU', 'FEE', 'FOU',
  'GAZ', 'JEU', 'JOUR', 'LAC', 'LOI', 'MAI', 'MAL', 'MER', 'MOT', 'MUR', 'NEZ', 'NID',
  'NON', 'OIE', 'OUI', 'PAR', 'PAS', 'PEU', 'PIE', 'PLI', 'POU', 'PRE', 'PUR', 'RUE',
  'SAC', 'SEL', 'SKI', 'SOL', 'SUD', 'TAS', 'THE', 'TIR', 'TOI', 'TON', 'VAL', 'VIE',
  'VIN', 'VOL', 'VUE',
]);

export const VERIFIED_3_LETTER_ITALIAN = new Set([
  'SOL', 'MAR', 'BAR', 'BEL', 'BLU', 'BUO', 'CHE', 'CHI', 'CON', 'DIO', 'DUE', 'ERA',
  'ERO', 'EST', 'GIA', 'GLI', 'HAI', 'HAN', 'LUI', 'MAI', 'MIO', 'NON', 'ORA', 'ORO',
  'PER', 'PIU', 'POI', 'PUB', 'QUA', 'QUI', 'REI', 'SIA', 'SUA', 'SUO', 'TRA', 'TRE',
  'TUA', 'TUO', 'UNO', 'VIA', 'ZIO', 'ZIA',
]);

export const SCRABBLE_NOISE_BLACKLIST = new Set([
  'AAL', 'ABA', 'ABB', 'ABO', 'ABW', 'ABY', 'ADZ', 'AFF', 'AHT', 'AHU', 'ALF', 'ALY',
  'AMA', 'AME', 'ANI', 'ARB', 'ARD', 'ARF', 'ARS', 'ARY', 'ATT', 'AUF', 'AVA', 'AVO',
  'AWA', 'AWN', 'AZO', 'BAA', 'BAP', 'BEL', 'BEN', 'BEY', 'BIS', 'BOP', 'BOS', 'BOU',
  'CPO', 'CRU', 'CWM', 'DAW', 'DEB', 'DEE', 'DIF', 'DIS', 'DIT', 'DIV', 'DOB', 'DOF',
  'DOH', 'DOL', 'DOM', 'DOR', 'DOS', 'DOW', 'DOY', 'DSO', 'DUB', 'DUD', 'DUH', 'DUI',
  'DUM', 'DUP', 'DUR', 'DUX', 'DZU', 'EDH', 'EHS', 'ELL', 'ELS', 'EME', 'EMF', 'EMS',
  'ENE', 'ENG', 'ENS', 'ERG', 'ERN', 'ERR', 'ERS', 'ESS', 'ETA', 'ETH', 'FAW', 'FAY',
  'FEH', 'FEM', 'FEN', 'FER', 'FES', 'FET', 'FEU', 'FEY', 'FEZ', 'FID', 'FIE', 'FIZ',
  'FOB', 'FOH', 'FON', 'FOP', 'FOU', 'FOY', 'FRO', 'FUB', 'FUD', 'FUG', 'FUM',
  'ПРЕ', 'ПРИ', 'ПОД', 'НАД', 'РАЗ', 'ИЗО', 'ОТО', 'БЕЗ', 'МНР', 'МПС', 'НКО',
  'ЫЫЫ', 'ЩЩЩ', 'ЦЦЦ', 'ФФФ', 'ХХХ',
]);

export function hasValidPhonotactics(word, lang = 'english') {
  if (!word || word.length < 3) return false;

  const isRussian = lang === 'russian';
  const vowels = isRussian ? /[АЕЁИОУЫЭЮЯ]/i : /[AEIOUYÀ-ʯ]/i;

  if (!vowels.test(word)) {
    return false;
  }

  if (/(.)\1\1\1/i.test(word)) {
    return false;
  }

  if (!isRussian && /[^AEIOUY]{5,}/i.test(word)) {
    return false;
  }

  return true;
}

function validateEnglishTokenWithCompromise(word) {
  const clean = word.trim().toUpperCase();

  if (SCRABBLE_NOISE_BLACKLIST.has(clean)) {
    return { isValid: false, reason: 'Scrabble noise / abbreviation' };
  }

  if (clean.length === 3) {
    if (VERIFIED_3_LETTER_ENGLISH.has(clean)) {
      return { isValid: true, cleanWord: clean, partOfSpeech: 'word' };
    }
    return { isValid: false, reason: 'Not a recognized 3-letter English word' };
  }

  // Must be in authentic English dictionary
  if (!isWordInDictionary(clean, 'english')) {
    return { isValid: false, cleanWord: clean, reason: 'Word not found in English dictionary' };
  }

  let partOfSpeech = 'word';
  if (nlp) {
    try {
      const doc = nlp(clean.toLowerCase());
      const jsonDocs = doc.json();
      const termList = jsonDocs[0]?.terms || [];
      if (termList.length > 0) {
        const tags = new Set(termList[0].tags || []);
        const validTags = [
          'Noun', 'Verb', 'Adjective', 'Adverb', 'Value',
          'Pronoun', 'Preposition', 'Conjunction', 'Determiner',
          'Expression', 'Person', 'Place', 'Organization', 'Infinitive',
          'Gerund', 'PastTense', 'PresentTense'
        ];
        const primaryTag = validTags.find((tag) => tags.has(tag));
        if (primaryTag) {
          partOfSpeech = primaryTag.toLowerCase();
        }
      }
    } catch {
      // NLP tag extraction is optional
    }
  }

  return { isValid: true, cleanWord: clean, partOfSpeech };
}

export function isValidWordToken(rawWord, language = 'english') {
  if (!rawWord || typeof rawWord !== 'string') {
    return { isValid: false, cleanWord: '', reason: 'Empty candidate' };
  }

  const cleanWord = rawWord.trim().toUpperCase();
  const langKey = (language || 'english').toLowerCase();

  if (cleanWord.length < 3) {
    return { isValid: false, cleanWord, reason: 'Word too short (< 3 letters)' };
  }

  if (SCRABBLE_NOISE_BLACKLIST.has(cleanWord)) {
    return { isValid: false, cleanWord, reason: 'Scrabble noise / non-word token' };
  }

  if (!hasValidPhonotactics(cleanWord, langKey)) {
    return { isValid: false, cleanWord, reason: 'Violates language phonotactics' };
  }

  // 1. Check verified 100k+ dictionary
  if (isWordInDictionary(cleanWord, langKey)) {
    return { isValid: true, cleanWord, partOfSpeech: 'word' };
  }

  // 2. Language-specific 3-letter sets and NLP validation
  if (langKey === 'english') {
    return validateEnglishTokenWithCompromise(cleanWord);
  }

  if (langKey === 'russian') {
    if (cleanWord.length === 3 && VERIFIED_3_LETTER_RUSSIAN.has(cleanWord)) {
      return { isValid: true, cleanWord, partOfSpeech: 'слово' };
    }
    return { isValid: false, cleanWord, reason: 'Слово не найдено в словаре русского языка' };
  }

  if (langKey === 'spanish') {
    if (cleanWord.length === 3 && VERIFIED_3_LETTER_SPANISH.has(cleanWord)) {
      return { isValid: true, cleanWord, partOfSpeech: 'palabra' };
    }
    return { isValid: false, cleanWord, reason: 'Palabra no encontrada en el diccionario' };
  }

  if (langKey === 'german') {
    if (cleanWord.length === 3 && VERIFIED_3_LETTER_GERMAN.has(cleanWord)) {
      return { isValid: true, cleanWord, partOfSpeech: 'Wort' };
    }
    return { isValid: false, cleanWord, reason: 'Wort nicht im Wörterbuch gefunden' };
  }

  if (langKey === 'french') {
    if (cleanWord.length === 3 && VERIFIED_3_LETTER_FRENCH.has(cleanWord)) {
      return { isValid: true, cleanWord, partOfSpeech: 'mot' };
    }
    return { isValid: false, cleanWord, reason: 'Mot non trouvé dans le dictionnaire' };
  }

  if (langKey === 'italian') {
    if (cleanWord.length === 3 && VERIFIED_3_LETTER_ITALIAN.has(cleanWord)) {
      return { isValid: true, cleanWord, partOfSpeech: 'parola' };
    }
    return { isValid: false, cleanWord, reason: 'Parola non trovata nel dizionario' };
  }

  return { isValid: false, cleanWord, reason: 'Unrecognized word in language dictionary' };
}
