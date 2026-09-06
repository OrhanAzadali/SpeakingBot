// Built-in linguistic dictionary mapping for high-frequency English grammar words and morphology

const LEXICON = {
  effective: {
    lemma: 'effective',
    pos: 'ADJ',
    level: 'B1',
    ipa: '/ɪˈfektɪv/',
    syntaxRole: 'Attribute / Modifier',
    translations: { az: 'təsirli / effektiv', ru: 'эффективный', tr: 'etkili', es: 'efectivo', de: 'wirksam', en: 'effective' },
  },
  learners: {
    lemma: 'learner',
    pos: 'NOUN',
    level: 'A2',
    ipa: '/ˈlɜːnəz/',
    syntaxRole: 'Subject',
    morphology: 'Noun, Plural, Nominative',
    translations: { az: 'öyrənənlər / tələbələr', ru: 'учащиеся', tr: 'öğrenenler', es: 'aprendices / estudiantes', de: 'Lernende', en: 'learners' },
  },
  consistently: {
    lemma: 'consistently',
    pos: 'ADV',
    level: 'B2',
    ipa: '/kənˈsɪstəntli/',
    syntaxRole: 'Adverbial Modifier',
    translations: { az: 'ardıcıl / mütəmadi olaraq', ru: 'последовательно', tr: 'tutarlı bir şekilde', es: 'constantemente', de: 'beständig', en: 'consistently' },
  },
  analyze: {
    lemma: 'analyze',
    pos: 'VERB',
    level: 'B2',
    ipa: '/ˈænəlaɪz/',
    syntaxRole: 'Predicate / Finite Verb',
    morphology: 'Verb, Present, Plural, Active',
    translations: { az: 'təhlil etmək / analiz etmək', ru: 'анализировать', tr: 'analiz etmek', es: 'analizar', de: 'analysieren', en: 'analyze' },
  },
  linguistic: {
    lemma: 'linguistic',
    pos: 'ADJ',
    level: 'C1',
    ipa: '/lɪŋˈɡwɪstɪk/',
    syntaxRole: 'Attribute',
    translations: { az: 'linqvistik / dilçilik', ru: 'лингвистический', tr: 'dilbilimsel', es: 'lingüístico', de: 'linguistisch', en: 'linguistic' },
  },
  patterns: {
    lemma: 'pattern',
    pos: 'NOUN',
    level: 'B1',
    ipa: '/ˈpætənz/',
    syntaxRole: 'Direct Object',
    morphology: 'Noun, Plural, Accusative',
    translations: { az: 'qanunauyğunluqlar / modellər', ru: 'паттерны / структуры', tr: 'kalıplar / desenler', es: 'patrones', de: 'Muster', en: 'patterns' },
  },
  she: {
    lemma: 'she',
    pos: 'PRON',
    level: 'A1',
    ipa: '/ʃiː/',
    syntaxRole: 'Subject',
    morphology: 'Personal Pronoun, 3rd Person Singular Female',
    translations: { az: 'o (qadın)', ru: 'она', tr: 'o (kadın)', es: 'ella', de: 'sie', en: 'she' },
  },
  has: {
    lemma: 'have',
    pos: 'AUX',
    level: 'A1',
    ipa: '/hæz/',
    syntaxRole: 'Auxiliary Verb',
    morphology: 'Auxiliary, Present Perfect Marker',
    translations: { az: '(bitmiş zaman köməkçisi)', ru: '(вспомогательный глагол)', tr: '(yardımcı fiil)', es: 'ha', de: 'hat', en: 'has' },
  },
  completed: {
    lemma: 'complete',
    pos: 'VERB',
    level: 'B1',
    ipa: '/kəmˈpliːtɪd/',
    syntaxRole: 'Main Verb / Past Participle',
    morphology: 'Verb, Past Participle, Aspect: Perfect',
    translations: { az: 'tamamladı / bitirdi', ru: 'завершила', tr: 'tamamladı', es: 'completado', de: 'abgeschlossen', en: 'completed' },
  },
  the: {
    lemma: 'the',
    pos: 'DET',
    level: 'A1',
    ipa: '/ðə/',
    syntaxRole: 'Determiner / Definite Article',
    translations: { az: 'müəyyənlik artikli', ru: 'определенный артикль', tr: 'belirtme eki / the', es: 'el / la', de: 'der / die / das', en: 'the' },
  },
  roadmap: {
    lemma: 'roadmap',
    pos: 'NOUN',
    level: 'B1',
    ipa: '/ˈrəʊdmæp/',
    syntaxRole: 'Direct Object',
    translations: { az: 'yol xəritəsi / inkişaf planı', ru: 'дорожная карта', tr: 'yol haritası', es: 'hoja de ruta', de: 'Fahrplan / Roadmap', en: 'roadmap' },
  },
  mastery: {
    lemma: 'mastery',
    pos: 'NOUN',
    level: 'C1',
    ipa: '/ˈmɑːstəri/',
    syntaxRole: 'Noun Complement',
    translations: { az: 'ustalıq / dərindən bilmə', ru: 'мастерство / владение', tr: 'ustalık', es: 'maestría / dominio', de: 'Beherrschung', en: 'mastery' },
  },
  grammar: {
    lemma: 'grammar',
    pos: 'NOUN',
    level: 'A2',
    ipa: '/ˈɡræmə/',
    syntaxRole: 'Noun Attribute',
    translations: { az: 'qrammatika', ru: 'грамматика', tr: 'dilbilgisi / gramer', es: 'gramática', de: 'Grammatik', en: 'grammar' },
  },
};

// Heuristic POS Tagger and Lemmatizer for any English sentence
export function tokenizeSentenceLocally(sentence, mediatorLang = 'az') {
  if (!sentence) return [];
  // Tokenize words and retain punctuation if needed
  const rawWords = sentence.match(/[\w'-]+|[.,!?;:]/g) || [];

  return rawWords.map((rawToken, index) => {
    const isPunct = /^[.,!?;:]$/.test(rawToken);
    if (isPunct) {
      return {
        text: rawToken,
        lemma: rawToken,
        pos: 'PUNCT',
        syntaxRole: 'Punctuation Mark',
        cefrLevel: 'A1',
        ipa: '',
        mediatorTranslation: '',
        morphology: 'Punctuation delimiter',
      };
    }

    const cleanLower = rawToken.toLowerCase().replace(/['’]s$/, '');
    const known = LEXICON[cleanLower];

    if (known) {
      return {
        text: rawToken,
        lemma: known.lemma,
        pos: known.pos,
        syntaxRole: known.syntaxRole,
        cefrLevel: known.level,
        ipa: known.ipa,
        mediatorTranslation: known.translations[mediatorLang] || known.translations.en,
        morphology: known.morphology || `${known.pos} lexical unit`,
      };
    }

    // Heuristics
    let pos = 'NOUN';
    let role = 'Constituent';
    let level = 'B1';
    let lemma = cleanLower;

    if (/^(the|a|an|this|that|these|those|every|each|some|any)$/i.test(cleanLower)) {
      pos = 'DET';
      role = 'Determiner';
      level = 'A1';
    } else if (/^(in|on|at|by|for|with|about|against|between|into|through|during|before|after|above|below|to|from|up|down|off|over|under)$/i.test(cleanLower)) {
      pos = 'PREP';
      role = 'Prepositional Head';
      level = 'A1';
    } else if (/^(and|but|or|so|yet|because|although|since|while|where|if|unless)$/i.test(cleanLower)) {
      pos = 'CONJ';
      role = 'Conjunction / Connector';
      level = 'A2';
    } else if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|their|our)$/i.test(cleanLower)) {
      pos = 'PRON';
      role = index === 0 ? 'Subject' : 'Complement';
      level = 'A1';
    } else if (/^(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must)$/i.test(cleanLower)) {
      pos = 'AUX';
      role = 'Auxiliary / Copula';
      level = 'A1';
    } else if (/ly$/i.test(cleanLower)) {
      pos = 'ADV';
      role = 'Adverbial Modifier';
      lemma = cleanLower.replace(/ly$/, '');
      level = 'B2';
    } else if (/^(ing|ed)$/i.test(cleanLower) || /(ed|ing)$/i.test(cleanLower)) {
      pos = 'VERB';
      role = 'Predicate / Action';
      lemma = cleanLower.replace(/(ing|ed)$/, '');
      level = 'B1';
    } else if (/(ful|ous|ive|able|ible|al|ic|ish)$/i.test(cleanLower)) {
      pos = 'ADJ';
      role = 'Modifier / Attribute';
      level = 'B2';
    } else if (index === 0) {
      role = 'Subject';
    }

    return {
      text: rawToken,
      lemma,
      pos,
      syntaxRole: role,
      cefrLevel: level,
      ipa: `/${lemma}/`,
      mediatorTranslation: `${lemma} (${mediatorLang})`,
      morphology: `${pos} token in syntactical role [${role}]`,
    };
  });
}

// Call server Gemini API for deep linguistic NLP parsing
export async function requestAiTokenization(sentence, mediatorLang = 'az') {
  try {
    const res = await fetch('/api/gemini/tokenize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, mediatorLanguage: mediatorLang }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.tokens) {
        return {
          tokens: data.data.tokens,
          syntaxSummary: data.data.syntaxSummary,
          grammarRulesDetected: data.data.grammarRulesApplicable,
        };
      }
    }
  } catch (err) {
    console.warn('Backend tokenize call fallback to local rule-engine:', err);
  }
  return {
    tokens: tokenizeSentenceLocally(sentence, mediatorLang),
    syntaxSummary: 'Linguistic parsing executed via SpeakBot Universal Rule-Engine',
    grammarRulesDetected: ['Standard English Syntax (SVO)', 'Constituent Parsing'],
  };
}
