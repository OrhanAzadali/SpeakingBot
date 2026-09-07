// Built-in multilingual linguistic dictionary mapping for high-frequency vocabulary across target languages

const MULTILINGUAL_LEXICON = {
  // German (Deutsch)
  arbeit: {
    lemma: 'Arbeit',
    pos: 'NOUN',
    level: 'A1',
    ipa: '/ˈaʁbaɪt/',
    syntaxRole: 'Subject / Noun Phrase Head',
    morphology: 'Substantiv, Femininum, Nominativ/Akkusativ',
    translations: { az: 'iş / əmək', ru: 'работа / труд', tr: 'iş / emek', es: 'trabajo', de: 'Arbeit', en: 'work / labor' },
  },
  macht: {
    lemma: 'machen',
    pos: 'VERB',
    level: 'A1',
    ipa: '/maxt/',
    syntaxRole: 'Predicate / Finite Verb (V2)',
    morphology: 'Verb, 3. Person Singular Präsens Indikativ',
    translations: { az: 'edir / düzəldir / yaradır', ru: 'делает', tr: 'yapar / eder', es: 'hace', de: 'macht', en: 'makes / does' },
  },
  mensch: {
    lemma: 'Mensch',
    pos: 'NOUN',
    level: 'A1',
    ipa: '/mɛnʃ/',
    syntaxRole: 'Direct Object / Predicative Noun',
    morphology: 'Substantiv, Maskulinum, Nominativ/Akkusativ',
    translations: { az: 'insan / şəxs', ru: 'человек', tr: 'insan', es: 'humano / persona', de: 'Mensch', en: 'human / person' },
  },
  lernen: {
    lemma: 'lernen',
    pos: 'VERB',
    level: 'A1',
    ipa: '/ˈlɛʁnən/',
    syntaxRole: 'Predicate / Infinitive',
    morphology: 'Verb, Infinitiv Präsens',
    translations: { az: 'öyrənmək', ru: 'учить / изучать', tr: 'öğrenmek', es: 'aprender', de: 'lernen', en: 'learn' },
  },
  erfolg: {
    lemma: 'Erfolg',
    pos: 'NOUN',
    level: 'B1',
    ipa: '/ɛɐ̯ˈfɔlk/',
    syntaxRole: 'Noun Complement',
    morphology: 'Substantiv, Maskulinum, Dativ/Akkusativ',
    translations: { az: 'uğur / nailiyyət', ru: 'успех', tr: 'başarı', es: 'éxito', de: 'Erfolg', en: 'success' },
  },
  sprache: {
    lemma: 'Sprache',
    pos: 'NOUN',
    level: 'A1',
    ipa: '/ˈʃpʁaːxə/',
    syntaxRole: 'Noun Phrase Head',
    morphology: 'Substantiv, Femininum, Nominativ',
    translations: { az: 'dil / nitq', ru: 'язык / речь', tr: 'dil / lisan', es: 'idioma / lengua', de: 'Sprache', en: 'language' },
  },
  kontinuierlich: {
    lemma: 'kontinuierlich',
    pos: 'ADJ',
    level: 'B2',
    ipa: '/kɔntinuˈiːɐ̯lɪç/',
    syntaxRole: 'Adverbial Modifier / Attribute',
    morphology: 'Adjektiv / Adverb',
    translations: { az: 'fasiləsiz / davamlı', ru: 'непрерывный / систематический', tr: 'sürekli', es: 'continuo', de: 'kontinuierlich', en: 'continuous' },
  },
  wenn: {
    lemma: 'wenn',
    pos: 'CONJ',
    level: 'A2',
    ipa: '/vɛn/',
    syntaxRole: 'Subordinating Conjunction',
    morphology: 'Subjunktion (Verb-Letzt-Stellung)',
    translations: { az: 'əgər / o zaman ki', ru: 'если / когда', tr: 'eğer / -dığında', es: 'si / cuando', de: 'wenn', en: 'if / when' },
  },
  und: {
    lemma: 'und',
    pos: 'CONJ',
    level: 'A1',
    ipa: '/ʊnt/',
    syntaxRole: 'Coordinating Conjunction',
    morphology: 'Nebenordnende Konjunktion',
    translations: { az: 'və', ru: 'и', tr: 've', es: 'y', de: 'und', en: 'and' },
  },
  der: {
    lemma: 'der',
    pos: 'DET',
    level: 'A1',
    ipa: '/deːɐ̯/',
    syntaxRole: 'Determiner / Definite Article',
    morphology: 'Bestimmter Artikel, Maskulinum Nominativ / Femininum Dativ/Genitiv',
    translations: { az: 'müəyyənlik artikli (kişi/qadın)', ru: 'определенный артикль', tr: 'belirtme eki', es: 'el / la', de: 'der', en: 'the' },
  },
  die: {
    lemma: 'die',
    pos: 'DET',
    level: 'A1',
    ipa: '/diː/',
    syntaxRole: 'Determiner / Definite Article',
    morphology: 'Bestimmter Artikel, Femininum Nominativ/Akkusativ / Plural',
    translations: { az: 'müəyyənlik artikli', ru: 'определенный артикль', tr: 'belirtme eki', es: 'la / las', de: 'die', en: 'the' },
  },
  das: {
    lemma: 'das',
    pos: 'DET',
    level: 'A1',
    ipa: '/das/',
    syntaxRole: 'Determiner / Definite Article',
    morphology: 'Bestimmter Artikel, Neutrum Nominativ/Akkusativ',
    translations: { az: 'müəyyənlik artikli (orta cins)', ru: 'определенный артикль', tr: 'belirtme eki', es: 'el / lo', de: 'das', en: 'the' },
  },

  // English
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

export function getLanguageGrammarRules(targetLang = 'English') {
  const norm = (targetLang || 'English').toLowerCase();
  if (norm.includes('german') || norm.includes('deutsch')) {
    return [
      'German Verb-Second (V2) Word Order in Independent Clauses (Verb-Zweite-Stellung)',
      'Substantive Noun Capitalization (Großschreibung aller Substantive)',
      'Four-Case Declension Paradigm (Kasus: Nominativ, Akkusativ, Dativ, Genitiv)',
      'Subject-Verb Conjugation Agreement (Subjekt-Verb-Kongruenz)'
    ];
  }
  if (norm.includes('spanish') || norm.includes('español')) {
    return [
      'Spanish Canonical SVO Word Order with Flexible Constituent Inversion',
      'Gender and Number Concordance (Concordancia de género y número)',
      'Ser vs. Estar Aspectual and Predicative Distinction',
      'Pro-Drop Subject Pronoun Omission & Inflection'
    ];
  }
  if (norm.includes('french') || norm.includes('français')) {
    return [
      'French SVO Syntactic Core & Preverbal Clitic Placement',
      'Nominal Gender Concord & Definite/Indefinite Article Agreement',
      'Passé Composé vs. Imparfait Aspectual Paradigm'
    ];
  }
  if (norm.includes('italian') || norm.includes('italiano')) {
    return [
      'Italian Pro-Drop Syntax & Flexible Pragmatic Focus Order',
      'Gender-Number Agreement and Articulated Prepositions (Preposizioni articolate)',
      'Verbal Mood and Tense Concordance (Concordanza dei tempi)'
    ];
  }
  if (norm.includes('russian') || norm.includes('русский')) {
    return [
      'Russian Six-Case Morphosyntactic System (Именительный, Родительный, etc.)',
      'Aspectual Verb Differentiation (Совершенный / Несовершенный вид)',
      'Free Expressive Constituent Order Governed by Topic-Focus Articulation'
    ];
  }
  if (norm.includes('turkish') || norm.includes('türkçe')) {
    return [
      'Turkish Agglutinative Morphology & Strict SOV Word Order',
      'Two-fold and Four-fold Vowel Harmony (Büyük ve Küçük Ünlü Uyumu)',
      'Nominal Case Suffix Chaining (İsmin Halleri: Yalın, Belirtme, Yönelme, etc.)'
    ];
  }
  return [
    'Standard English Syntax & Word Order (SVO)',
    'Syntactic Constituent and Dependency Roles',
    'Morphological Inflection & Concord'
  ];
}

// Heuristic POS Tagger and Lemmatizer for sentences in any target language
export function tokenizeSentenceLocally(sentence, mediatorLang = 'az', targetLang = 'English') {
  if (!sentence) return [];
  const rawWords = sentence.match(/[\w\u00C0-\u024F\u0400-\u04FF'-]+|[.,!?;:]/g) || [];
  const normLang = (targetLang || 'English').toLowerCase();
  const isGerman = normLang.includes('german') || normLang.includes('deutsch');
  const isSpanish = normLang.includes('spanish') || normLang.includes('español');
  const isFrench = normLang.includes('french') || normLang.includes('français');

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
    const known = MULTILINGUAL_LEXICON[cleanLower];

    if (known) {
      return {
        text: rawToken,
        lemma: known.lemma,
        pos: known.pos,
        syntaxRole: known.syntaxRole,
        cefrLevel: known.level,
        ipa: known.ipa,
        mediatorTranslation: known.translations[mediatorLang] || known.translations.en || known.translations.de || rawToken,
        morphology: known.morphology || `${known.pos} lexical unit`,
      };
    }

    // Heuristics tailored to target language
    let pos = 'NOUN';
    let role = 'Constituent';
    let level = 'B1';
    let lemma = cleanLower;

    if (isGerman) {
      // German-specific grammar heuristics
      if (/^[A-ZÄÖÜ]/.test(rawToken) && index > 0) {
        pos = 'NOUN';
        role = 'Noun Phrase Head';
        lemma = rawToken;
      } else if (/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|dieser|diese|dieses|jeder|jede)$/i.test(cleanLower)) {
        pos = 'DET';
        role = 'Determiner / Artikel';
        level = 'A1';
      } else if (/^(in|an|auf|für|mit|von|zu|aus|bei|nach|über|unter|durch|ohne|um|vor|zwischen|hinter|neben)$/i.test(cleanLower)) {
        pos = 'PREP';
        role = 'Präpositionalphrase Head';
        level = 'A1';
      } else if (/^(und|oder|aber|denn|weil|dass|daß|wenn|ob|obwohl|als|wie|während)$/i.test(cleanLower)) {
        pos = 'CONJ';
        role = 'Konjunktion / Bindewort';
        level = 'A2';
      } else if (/^(ich|du|er|sie|es|wir|ihr|sie|ihnen|mich|dich|ihn|ihm|uns|euch|mein|dein|sein|unser|euer)$/i.test(cleanLower)) {
        pos = 'PRON';
        role = index === 0 ? 'Subjekt (Pronomen)' : 'Pronomen Komplement';
        level = 'A1';
      } else if (/^(ist|sind|war|waren|sei|sein|haben|hat|hatte|hatten|wird|werden|wurde|kann|können|muss|müssen|will|wollen|soll|sollen|darf|dürfen)$/i.test(cleanLower)) {
        pos = 'AUX';
        role = 'Hilfsverb / Modalverb (V2)';
        level = 'A1';
      } else if (/(en|t|te|ten|st)$/i.test(cleanLower) && index === 1) {
        pos = 'VERB';
        role = 'Finites Verb (Prädikat / V2)';
        lemma = cleanLower.replace(/(t|te|ten|st)$/, 'en');
        level = 'A2';
      } else if (/(lich|ig|isch|bar|sam|haft)$/i.test(cleanLower)) {
        pos = 'ADJ';
        role = 'Attribut / Adjektiv';
        level = 'B1';
      } else if (index === 0) {
        role = 'Subjekt';
      }
    } else if (isSpanish) {
      // Spanish-specific heuristics
      if (/^(el|la|los|las|un|una|unos|unas|este|esta|estos|estas|ese|esa)$/i.test(cleanLower)) {
        pos = 'DET';
        role = 'Determinante / Artículo';
        level = 'A1';
      } else if (/^(en|de|a|por|para|con|sin|sobre|hacia|desde|hasta|entre)$/i.test(cleanLower)) {
        pos = 'PREP';
        role = 'Preposición';
        level = 'A1';
      } else if (/^(y|e|o|u|pero|porque|si|que|aunque|cuando|mientras)$/i.test(cleanLower)) {
        pos = 'CONJ';
        role = 'Conjunción';
        level = 'A1';
      } else if (/^(yo|tú|él|ella|nosotros|vosotros|ellos|ellas|me|te|se|nos|mi|tu|su)$/i.test(cleanLower)) {
        pos = 'PRON';
        role = index === 0 ? 'Sujeto' : 'Complemento';
        level = 'A1';
      } else if (/^(es|son|era|eran|fue|fueron|está|están|estaba|he|has|ha|hemos|han|puede|debe)$/i.test(cleanLower)) {
        pos = 'AUX';
        role = 'Verbo Auxiliar / Cópula';
        level = 'A1';
      } else if (/mente$/i.test(cleanLower)) {
        pos = 'ADV';
        role = 'Modificador Adverbial';
        lemma = cleanLower.replace(/mente$/, '');
        level = 'B2';
      } else if (/(ar|er|ir|ado|ido|ando|iendo|aron|ieron|ó|ió)$/i.test(cleanLower)) {
        pos = 'VERB';
        role = 'Núcleo del Predicado';
        level = 'B1';
      } else if (/(oso|osa|ico|ica|al|ble|ivo|iva)$/i.test(cleanLower)) {
        pos = 'ADJ';
        role = 'Modificador Adjetival';
        level = 'B2';
      } else if (index === 0) {
        role = 'Sujeto';
      }
    } else {
      // English / Generic heuristics
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
export async function requestAiTokenization(sentence, mediatorLang = 'az', targetLanguage = 'English') {
  try {
    const res = await fetch('/api/gemini/tokenize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence,
        mediatorLanguage: mediatorLang,
        targetLanguage: targetLanguage || 'English'
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.tokens) {
        return {
          tokens: data.data.tokens,
          syntaxSummary: data.data.syntaxSummary,
          grammarRulesDetected: data.data.grammarRulesApplicable || getLanguageGrammarRules(targetLanguage),
        };
      }
    }
  } catch (err) {
    console.warn('Backend tokenize call fallback to local rule-engine:', err);
  }
  return {
    tokens: tokenizeSentenceLocally(sentence, mediatorLang, targetLanguage),
    syntaxSummary: `Linguistic parsing and morphological decomposition synthesized for ${targetLanguage} by SpeakBot Rule-Engine`,
    grammarRulesDetected: getLanguageGrammarRules(targetLanguage),
  };
}
