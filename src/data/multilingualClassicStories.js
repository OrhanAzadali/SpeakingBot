// Multilingual Classic Literature Stories & Dialogues
// Providing rich reading, listening, conversation, and exercise content for all supported target languages

export const MULTILINGUAL_CLASSIC_STORIES = [
  // SPANISH: Federico García Lorca - Bodas de Sangre
  {
    id: 'story-lorca-blood-wedding',
    title: 'Bodas de Sangre (The Moon and the Forest)',
    author: 'Federico García Lorca',
    targetLanguage: 'Spanish',
    level: 'B2',
    mode: 'both',
    coverEmoji: '🌙',
    estimatedTime: '8 min',
    summary: 'An evocative lyrical scene from Federico García Lorca\'s tragic drama where the poetic voice of the Moon personifies fate in the deep Spanish forest.',
    storyText: `La Luna deja un halo blanco en el bosque silencioso, mientras las ramas tiemblan con un presagio oscuro. 

"Luna de ojos de azogue, déjame pasar", susurra el viento entre los olivos plateados. No hay refugio para los amantes fugitivos en esta noche de pasión y sombra.

Los leñadores avanzan con sus hachas afiladas, buscando el rastro que dejó el galope desesperado. El destino se teje como una red ineludible en el corazón de la tierra andaluza.`,
    sentences: [
      {
        index: 0,
        text: 'La Luna deja un halo blanco en el bosque silencioso, mientras las ramas tiemblan con un presagio oscuro.',
        timestampSec: 0,
        literaryNotes: 'Symbolic personification of the moon (la Luna) as an active cosmic agent of destiny and tragedy.',
        tokens: [
          { text: 'Luna', lemma: 'luna', pos: 'NOUN', syntaxRole: 'Subject', cefrLevel: 'A1', ipa: '/ˈlu.na/', mediatorTranslation: 'Ay / Луна / Moon' },
          { text: 'deja', lemma: 'dejar', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'A2', ipa: '/ˈde.xa/', mediatorTranslation: 'buraxır / оставляет' },
          { text: 'halo', lemma: 'halo', pos: 'NOUN', syntaxRole: 'Direct Object', cefrLevel: 'B2', ipa: '/ˈa.lo/', mediatorTranslation: 'hale / ореол' },
          { text: 'bosque', lemma: 'bosque', pos: 'NOUN', syntaxRole: 'Prepositional Complement', cefrLevel: 'A2', ipa: '/ˈbos.ke/', mediatorTranslation: 'meşə / лес' },
          { text: 'tiemblan', lemma: 'temblar', pos: 'VERB', syntaxRole: 'Subordinate Verb', cefrLevel: 'B1', ipa: '/ˈtjem.blan/', mediatorTranslation: 'əsirlər / дрожат' },
        ],
      },
      {
        index: 1,
        text: '"Luna de ojos de azogue, déjame pasar", susurra el viento entre los olivos plateados.',
        timestampSec: 6,
        literaryNotes: 'Metaphorical reference to "ojos de azogue" (quicksilver eyes), denoting cold, unyielding observation.',
        tokens: [
          { text: 'azogue', lemma: 'azogue', pos: 'NOUN', syntaxRole: 'Noun Attribute', cefrLevel: 'C1', ipa: '/aˈso.ɣe/', mediatorTranslation: 'civə / ртуть' },
          { text: 'susurra', lemma: 'susurrar', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'B1', ipa: '/suˈsu.ra/', mediatorTranslation: 'pıçıldayır / шепчет' },
          { text: 'olivos', lemma: 'olivo', pos: 'NOUN', syntaxRole: 'Complement', cefrLevel: 'A2', ipa: '/oˈli.βos/', mediatorTranslation: 'zeytun ağacları' },
        ],
      },
      {
        index: 2,
        text: 'Los leñadores avanzan con sus hachas afiladas, buscando el rastro que dejó el galope desesperado.',
        timestampSec: 13,
        literaryNotes: 'Sensory imagery evoking urgency, suspense, and impending doom.',
        tokens: [
          { text: 'leñadores', lemma: 'leñador', pos: 'NOUN', syntaxRole: 'Subject', cefrLevel: 'B1', ipa: '/le.ɲaˈdo.ɾes/', mediatorTranslation: 'odunçular / дровосеки' },
          { text: 'afiladas', lemma: 'afilado', pos: 'ADJ', syntaxRole: 'Modifier', cefrLevel: 'B2', ipa: '/a.fiˈla.ðas/', mediatorTranslation: 'iti / острые' },
          { text: 'galope', lemma: 'galope', pos: 'NOUN', syntaxRole: 'Subject', cefrLevel: 'B2', ipa: '/ɡaˈlo.pe/', mediatorTranslation: 'çapış / галоп' },
        ],
      },
      {
        index: 3,
        text: 'El destino se teje como una red ineludible en el corazón de la tierra andaluza.',
        timestampSec: 21,
        literaryNotes: 'Classic mythological motif of fate being woven like a spiderweb.',
        tokens: [
          { text: 'destino', lemma: 'destino', pos: 'NOUN', syntaxRole: 'Subject', cefrLevel: 'B1', ipa: '/desˈti.no/', mediatorTranslation: 'tale / судьба' },
          { text: 'ineludible', lemma: 'ineludible', pos: 'ADJ', syntaxRole: 'Attribute', cefrLevel: 'C1', ipa: '/i.ne.luˈði.βle/', mediatorTranslation: 'qaçılmaz / неизбежный' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Federico García Lorca',
        avatarEmoji: '🎭',
        promptInTarget: '¿Por qué la naturaleza y la luna son personajes tan implacables en mis tragedias?',
        promptTranslation: 'Why are nature and the moon such relentless characters in my tragedies?',
        userResponseOptions: [
          {
            text: 'Porque reflejan el poder insuperable del destino humano sobre la razón.',
            isBestChoice: true,
            feedback: '¡Exactamente! En el teatro lorquiano, las fuerzas elementales representan las pasiones incontrolables.',
          },
          {
            text: 'Porque son simplemente adornos estéticos sin mayor significado.',
            isBestChoice: false,
            feedback: 'No, en Lorca la Luna y el Bosque participan activamente en la catástrofe dramática.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-lorca-1',
        type: 'comprehension',
        question: '¿Qué representa simbólicamente "la luna con ojos de azogue" en el texto?',
        options: [
          'La mirada fría y vigilante del destino trágico',
          'Un farol callejero en la ciudad moderna',
          'Un momento de calma y descanso para los amantes',
          'El amanecer pacífico de Andalucía',
        ],
        correctIndex: 0,
        explanation: 'El azogue (mercurio) evoca frialdad, brillo metálico y observación despiadada del destino.',
      },
    ],
    culturalNotes: 'García Lorca combinó el folclore gitano y andaluz con el vanguardismo poético de la Generación del 27.',
  },

  // GERMAN: Johann Wolfgang von Goethe - Faust
  {
    id: 'story-goethe-faust',
    title: 'Faust (Der Pakt im Studierzimmer)',
    author: 'Johann Wolfgang von Goethe',
    targetLanguage: 'German',
    level: 'B2',
    mode: 'both',
    coverEmoji: '🕯️',
    estimatedTime: '9 min',
    summary: 'The climactic philosophical dialogue between Doctor Faust and Mephistopheles in the dimly lit study, exploring the limits of human knowledge and ambition.',
    storyText: `Habe nun, ach! Philosophie, Juristerei und Medizin, und leider auch Theologie durchaus studiert, mit heißem Bemühn. 

Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor; heiße Magister, heiße Doktor gar, und ziehe schon an die zehen Jahr herauf, herab und quer und krumm meine Schüler an der Nase herum.

Und sehe, dass wir nichts wissen können! Das will mir schier das Herz verbrennen. Darum hab ich mich der Magie ergeben, ob mir durch Geistes Kraft und Mund nicht manch Geheimnis würde kund.`,
    sentences: [
      {
        index: 0,
        text: 'Habe nun, ach! Philosophie, Juristerei und Medizin, und leider auch Theologie durchaus studiert, mit heißem Bemühn.',
        timestampSec: 0,
        literaryNotes: 'The iconic opening lament of Faust expressing the disillusionment of the Renaissance polymath.',
        tokens: [
          { text: 'Philosophie', lemma: 'Philosophie', pos: 'NOUN', syntaxRole: 'Object', cefrLevel: 'B1', ipa: '/filozoˈfiː/', mediatorTranslation: 'fəlsəfə / философия' },
          { text: 'studiert', lemma: 'studieren', pos: 'VERB', syntaxRole: 'Participle', cefrLevel: 'A2', ipa: '/ʃtuˈdiːɐ̯t/', mediatorTranslation: 'öyrənmişəm / изучал' },
          { text: 'Bemühn', lemma: 'Bemühen', pos: 'NOUN', syntaxRole: 'Adverbial', cefrLevel: 'B2', ipa: '/bəˈmyːən/', mediatorTranslation: 'səy / старание' },
        ],
      },
      {
        index: 1,
        text: 'Da steh ich nun, ich armer Tor! Und bin so klug als wie zuvor.',
        timestampSec: 8,
        literaryNotes: '"Armer Tor" is an archaic German expression meaning "poor fool", contrasting knowledge with wisdom.',
        tokens: [
          { text: 'Tor', lemma: 'Tor', pos: 'NOUN', syntaxRole: 'Apposition', cefrLevel: 'C1', ipa: '/toːɐ̯/', mediatorTranslation: 'axmaq / глупец' },
          { text: 'klug', lemma: 'klug', pos: 'ADJ', syntaxRole: 'Predicative', cefrLevel: 'A2', ipa: '/kluːk/', mediatorTranslation: 'ağıllı / умный' },
          { text: 'zuvor', lemma: 'zuvor', pos: 'ADV', syntaxRole: 'Temporal Modifier', cefrLevel: 'B1', ipa: '/tsuˈfoːɐ̯/', mediatorTranslation: 'əvvəllər / прежде' },
        ],
      },
      {
        index: 2,
        text: 'Und sehe, dass wir nichts wissen können! Das will mir schier das Herz verbrennen.',
        timestampSec: 15,
        literaryNotes: 'An echo of the Socratic paradox, phrased with Sturm und Drang emotional intensity.',
        tokens: [
          { text: 'wissen', lemma: 'wissen', pos: 'VERB', syntaxRole: 'Infinitive', cefrLevel: 'A1', ipa: '/ˈvɪsn̩/', mediatorTranslation: 'bilmək / знать' },
          { text: 'schier', lemma: 'schier', pos: 'ADV', syntaxRole: 'Intensifier', cefrLevel: 'C1', ipa: '/ʃiːɐ̯/', mediatorTranslation: 'demək olar ki / почти' },
          { text: 'verbrennen', lemma: 'verbrennen', pos: 'VERB', syntaxRole: 'Infinitive', cefrLevel: 'B1', ipa: '/fɛɐ̯ˈbʁɛnən/', mediatorTranslation: 'yandırmaq / сжечь' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Johann Wolfgang von Goethe',
        avatarEmoji: '📜',
        promptInTarget: 'Was treibt Faust letztlich dazu, einen Pakt mit Mephistopheles zu wagen?',
        promptTranslation: 'What ultimately drives Faust to risk making a pact with Mephistopheles?',
        userResponseOptions: [
          {
            text: 'Sein unstillbares Verlangen nach grenzenloser Erkenntnis und lebendiger Erfahrung.',
            isBestChoice: true,
            feedback: 'Hervorragend! Fausts "Streben" ist der philosophische Kern des gesamten Werks.',
          },
          {
            text: 'Lediglich das Verlangen nach materiellem Reichtum.',
            isBestChoice: false,
            feedback: 'Nein, Faust verachtet bloßen weltlichen Besitz; er strebt nach Transzendenz.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-goethe-1',
        type: 'grammar',
        question: 'Was bedeutet die Redewendung "jemanden an der Nase herumführen" im Kontext?',
        options: [
          'Jemanden täuschen oder an der Nase herumziehen',
          'Einem Schüler eine körperliche Übung zeigen',
          'Jemanden zum Lachen bringen',
          'Einen Text laut vorlesen',
        ],
        correctIndex: 0,
        explanation: 'Die Redewendung bedeutet idiomatisch "jemanden täuschen oder irreleiten".',
      },
    ],
    culturalNotes: 'Goethes Faust gilt als das bedeutendste Werk der deutschen Literaturgeschichte und prägte den Begriff des Faustischen Strebens.',
  },

  // FRENCH: Victor Hugo - Les Misérables
  {
    id: 'story-hugo-miserables',
    title: 'Les Misérables (Jean Valjean and the Bishop\'s Candlesticks)',
    author: 'Victor Hugo',
    targetLanguage: 'French',
    level: 'B2',
    mode: 'both',
    coverEmoji: '🕯️',
    estimatedTime: '10 min',
    summary: 'The transformative moment of grace where Monseigneur Myriel forgives Jean Valjean and hands him the silver candlesticks to buy his soul for goodness.',
    storyText: `Jean Valjean écoutait sans comprendre. L'évêque s'approcha de lui et lui dit à voix basse :

« N'oubliez pas, n'oubliez jamais que vous m'avez promis d'employer cet argent à devenir un honnête homme. »

Jean Valjean, qui n'avait souvenir d'avoir rien promis, demeura interdit. L'évêque avait appuyé sur ces paroles en les prononçant. Il reprit avec une gravité solennelle :

« Jean Valjean, mon frère, vous n'appartenez plus au mal, mais au bien. C'est votre âme que je vous achète ; je la retire aux pensées noires et à l'esprit de perdition, et je la donne à Dieu. »`,
    sentences: [
      {
        index: 0,
        text: 'Jean Valjean écoutait sans comprendre. L\'évêque s\'approcha de lui et lui dit à voix basse.',
        timestampSec: 0,
        literaryNotes: 'Contrast between the hardened ex-convict and the transcendent compassion of the Bishop.',
        tokens: [
          { text: 'écoutait', lemma: 'écouter', pos: 'VERB', syntaxRole: 'Imparfait', cefrLevel: 'A2', ipa: '/e.ku.tɛ/', mediatorTranslation: 'dinləyirdi / слушал' },
          { text: 'évêque', lemma: 'évêque', pos: 'NOUN', syntaxRole: 'Subject', cefrLevel: 'B1', ipa: '/e.vɛk/', mediatorTranslation: 'yepiskop / епископ' },
          { text: 'approcha', lemma: 'approcher', pos: 'VERB', syntaxRole: 'Passé Simple', cefrLevel: 'B2', ipa: '/a.pʁɔ.ʃa/', mediatorTranslation: 'yaxınlaşdı / подошел' },
        ],
      },
      {
        index: 1,
        text: '« N\'oubliez pas, n\'oubliez jamais que vous m\'avez promis d\'employer cet argent à devenir un honnête homme. »',
        timestampSec: 7,
        literaryNotes: 'Imperative repetition emphasizing a moral resurrection through human mercy.',
        tokens: [
          { text: 'oubliez', lemma: 'oublier', pos: 'VERB', syntaxRole: 'Imperative', cefrLevel: 'A2', ipa: '/u.bli.je/', mediatorTranslation: 'unutmayın / забудьте' },
          { text: 'promis', lemma: 'promettre', pos: 'VERB', syntaxRole: 'Past Participle', cefrLevel: 'B1', ipa: '/pʁɔ.mi/', mediatorTranslation: 'söz vermisiniz / обещали' },
          { text: 'honnête', lemma: 'honnête', pos: 'ADJ', syntaxRole: 'Attribute', cefrLevel: 'B1', ipa: '/ɔ.nɛt/', mediatorTranslation: 'namuslu / честный' },
        ],
      },
      {
        index: 2,
        text: '« Jean Valjean, mon frère, vous n\'appartenez plus au mal, mais au bien. »',
        timestampSec: 16,
        literaryNotes: 'The term "mon frère" radically collapses social hierarchy in the spirit of pure fraternity.',
        tokens: [
          { text: 'frère', lemma: 'frère', pos: 'NOUN', syntaxRole: 'Vocative', cefrLevel: 'A1', ipa: '/fʁɛʁ/', mediatorTranslation: 'qardaşım / брат мой' },
          { text: 'appartenez', lemma: 'appartenir', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'B1', ipa: '/a.paʁ.tə.ne/', mediatorTranslation: 'məxsussunuz / принадлежите' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Victor Hugo',
        avatarEmoji: '🖋️',
        promptInTarget: 'Quel est le pouvoir du pardon gratuit dans cette scène fondatrice ?',
        promptTranslation: 'What is the power of unconditional forgiveness in this foundational scene?',
        userResponseOptions: [
          {
            text: 'Il brise le cycle de la haine sociale et rend possible la rédemption spirituelle.',
            isBestChoice: true,
            feedback: 'Magnifique ! Pour Hugo, la grâce et la miséricorde transcendent toute justice pénale.',
          },
          {
            text: 'C\'est une simple transaction financière pour aider un vagabond.',
            isBestChoice: false,
            feedback: 'Ce n\'est pas un geste matériel, mais le rachat d\'une âme blessée.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-hugo-1',
        type: 'grammar',
        question: 'Quel temps verbal est employé dans "approcha" et "dit" ?',
        options: [
          'Le passé simple',
          'L\'imparfait',
          'Le subjonctif présent',
          'Le futur simple',
        ],
        correctIndex: 0,
        explanation: 'Le passé simple est le temps narratif par excellence dans la littérature classique française.',
      },
    ],
    culturalNotes: 'Les Misérables a marqué la conscience universelle en dénonçant la misère sociale et en glorifiant la rédemption morale.',
  },

  // ITALIAN: Dante Alighieri - La Divina Commedia
  {
    id: 'story-dante-inferno',
    title: 'La Divina Commedia (Nel Mezzo del Cammin)',
    author: 'Dante Alighieri',
    targetLanguage: 'Italian',
    level: 'B2',
    mode: 'both',
    coverEmoji: '🌲',
    estimatedTime: '8 min',
    summary: 'The sublime opening tercets of Inferno where Dante finds himself lost in the dark wilderness of moral confusion before meeting Virgil.',
    storyText: `Nel mezzo del cammin di nostra vita
mi ritrovai per una selva oscura,
ché la diritta via era smarrita.

Ahi quanto a dir qual era è cosa dura
esta selva selvaggia e aspra e forte
che nel pensier rinova la paura!

Tant' è amara che poco è più morte;
ma per trattar del ben ch'i' vi trovai,
dirò de l'altre cose ch'i' v'ho scorte.`,
    sentences: [
      {
        index: 0,
        text: 'Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura, ché la diritta via era smarrita.',
        timestampSec: 0,
        literaryNotes: 'Universal allegory: "nostra vita" includes all humanity, while the dark forest symbolizes moral straying.',
        tokens: [
          { text: 'mezzo', lemma: 'mezzo', pos: 'NOUN', syntaxRole: 'Temporal Complement', cefrLevel: 'A2', ipa: '/ˈmɛd.dzo/', mediatorTranslation: 'ortası / середина' },
          { text: 'selva', lemma: 'selva', pos: 'NOUN', syntaxRole: 'Locative', cefrLevel: 'B2', ipa: '/ˈsɛl.va/', mediatorTranslation: 'meşə / чаща' },
          { text: 'oscura', lemma: 'oscuro', pos: 'ADJ', syntaxRole: 'Attribute', cefrLevel: 'B1', ipa: '/osˈku.ro/', mediatorTranslation: 'qaranlıq / темный' },
          { text: 'smarrita', lemma: 'smarrire', pos: 'VERB', syntaxRole: 'Participle', cefrLevel: 'B2', ipa: '/zmarˈri.ta/', mediatorTranslation: 'itirilmiş / утраченный' },
        ],
      },
      {
        index: 1,
        text: 'Ahi quanto a dir qual era è cosa dura esta selva selvaggia e aspra e forte!',
        timestampSec: 9,
        literaryNotes: 'Alliterative triplet ("selva selvaggia... aspra e forte") imitating the physical entanglement of the wild woods.',
        tokens: [
          { text: 'dura', lemma: 'duro', pos: 'ADJ', syntaxRole: 'Predicative', cefrLevel: 'A2', ipa: '/ˈdu.ra/', mediatorTranslation: 'çətin / трудный' },
          { text: 'selvaggia', lemma: 'selvaggio', pos: 'ADJ', syntaxRole: 'Attribute', cefrLevel: 'B1', ipa: '/selˈvad.dʒa/', mediatorTranslation: 'vəhşi / дикий' },
          { text: 'paura', lemma: 'paura', pos: 'NOUN', syntaxRole: 'Object', cefrLevel: 'A1', ipa: '/paˈu.ra/', mediatorTranslation: 'qorxu / страх' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Dante Alighieri',
        avatarEmoji: '👑',
        promptInTarget: 'Perché ho scelto di scrivere questo viaggio in volgare fiorentino e non in latino?',
        promptTranslation: 'Why did I choose to write this journey in the vernacular Florentine rather than Latin?',
        userResponseOptions: [
          {
            text: 'Per rendere la verità morale e teologica accessibile a tutto il popolo, elevando la lingua comune.',
            isBestChoice: true,
            feedback: 'Esatto! Dante ha fondato la moderna lingua italiana rendendo il volgare degno di poesia sublime.',
          },
          {
            text: 'Perché il latino era troppo noioso per i versi poetici.',
            isBestChoice: false,
            feedback: 'No, Dante dominava il latino, ma desiderava consacrare la nobiltà del volgare illustre.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-dante-1',
        type: 'vocabulary',
        question: 'Che cosa simboleggia "la diritta via" nel primo canto?',
        options: [
          'La via della rettitudine e della salvezza morale',
          'Una strada romana lastricata di pietre',
          'Il sentiero più veloce per tornare a Firenze',
          'La rotta commerciale verso l\'Oriente',
        ],
        correctIndex: 0,
        explanation: '"La diritta via" rappresenta allegoricamente la virtù e la conformità al bene spirituale.',
      },
    ],
    culturalNotes: 'La Divina Commedia è la pietra miliare della letteratura italiana e universale, scritta in terzine incatenate.',
  },

  // RUSSIAN: Alexander Pushkin - The Queen of Spades (Пиковая дама)
  {
    id: 'story-pushkin-queen-spades',
    title: 'Пиковая дама (The Secret of Three Cards)',
    author: 'Александр Пушкин (Alexander Pushkin)',
    targetLanguage: 'Russian',
    level: 'B2',
    mode: 'both',
    coverEmoji: '♠️',
    estimatedTime: '9 min',
    summary: 'The thrilling psychological encounter where Hermann visits the aged Countess at midnight, demanding the mystical secret of the three winning cards.',
    storyText: `Германн трепетал. Он вошел в спальню графини. Время шло медленно, и каждый удар часов отдавался в его беспокойном сердце.

Старая графиня сидела в кресле, глядя в пустоту угасшими глазами. Германн приблизился к ней и преклонил колена:

«Графиня, умоляю вас именем неба, откройте мне вашу тайну! Назовите мне эти три карты: тройку, семерку и туз. Для кого бережете вы это знание?»

Графиня молчала, как гранитная статуя, пока зловещая тень судьбы опускалась на холодную петербургскую ночь.`,
    sentences: [
      {
        index: 0,
        text: 'Германн трепетал. Он вошел в спальню графини. Время шло медленно, и каждый удар часов отдавался в его беспокойном сердце.',
        timestampSec: 0,
        literaryNotes: 'Masterful brevity characteristic of Pushkin\'s prose style, creating intense psychological tension.',
        tokens: [
          { text: 'трепетал', lemma: 'трепетать', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'B2', ipa: '/trʲɪpʲɪˈtaɫ/', mediatorTranslation: 'əsim-əsim əsirdi / трепетал' },
          { text: 'спальню', lemma: 'спальня', pos: 'NOUN', syntaxRole: 'Accusative Goal', cefrLevel: 'A2', ipa: '/ˈspalʲ.nʲu/', mediatorTranslation: 'yataq otağı / спальня' },
          { text: 'сердце', lemma: 'сердце', pos: 'NOUN', syntaxRole: 'Locative', cefrLevel: 'A1', ipa: '/ˈsʲɛr.t͡sə/', mediatorTranslation: 'ürək / сердце' },
        ],
      },
      {
        index: 1,
        text: '«Графиня, умоляю вас именем неба, откройте мне вашу тайну! Назовите мне эти три карты: тройку, семерку и туз.»',
        timestampSec: 8,
        literaryNotes: 'The obsession of Hermann crystallizes into the iconic numeric triad (3, 7, Ace).',
        tokens: [
          { text: 'умоляю', lemma: 'умолять', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'B2', ipa: '/ʊmɐˈlʲa.jʊ/', mediatorTranslation: 'yalvarıram / умоляю' },
          { text: 'тайну', lemma: 'тайна', pos: 'NOUN', syntaxRole: 'Direct Object', cefrLevel: 'B1', ipa: '/ˈtaj.nʊ/', mediatorTranslation: 'sirr / тайна' },
          { text: 'туз', lemma: 'туз', pos: 'NOUN', syntaxRole: 'Card Name', cefrLevel: 'B1', ipa: '/tus/', mediatorTranslation: 'tuz (kart) / туз' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Александр Пушкин',
        avatarEmoji: '🎩',
        promptInTarget: 'Какая роковая страсть губит Германна в моей повести?',
        promptTranslation: 'What fatal passion destroys Hermann in my story?',
        userResponseOptions: [
          {
            text: 'Безудержная мания легкого богатства и холодный расчет, вытеснивший человечность.',
            isBestChoice: true,
            feedback: 'Совершенно верно! Германн сочетает в себе профиль Наполеона и душу Мефистофеля.',
          },
          {
            text: 'Неразделенная романтическая любовь к Лизавете.',
            isBestChoice: false,
            feedback: 'Нет, Германн лишь цинично использовал влюбленную девушку ради тайны графини.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-pushkin-1',
        type: 'comprehension',
        question: 'Что символизируют карты «тройка, семерка, туз» в мировоззрении Германна?',
        options: [
          'Магический ключ к мгновенному господству над судьбой',
          'Простой способ развлечения в офицерском клубе',
          'Воспоминание о детской игре в деревне',
          'Шифр к спрятанным драгоценностям царя',
        ],
        correctIndex: 0,
        explanation: 'Для Германна три карты стали символом иллюзорного всемогущества над слепым случаем.',
      },
    ],
    culturalNotes: '«Пиковая дама» Пушкина заложила традиции русского психологического реализма и вдохновила бессмертную оперу Чайковского.',
  },

  // TURKISH: Sabahattin Ali - Kürk Mantolu Madonna
  {
    id: 'story-sabahattin-madonna',
    title: 'Kürk Mantolu Madonna (The Painting in the Gallery)',
    author: 'Sabahattin Ali',
    targetLanguage: 'Turkish',
    level: 'B1',
    mode: 'both',
    coverEmoji: '🎨',
    estimatedTime: '8 min',
    summary: 'Raif Efendi stands mesmerized in the Berlin art gallery before the portrait of Maria Puder, experiencing a profound emotional awakening.',
    storyText: `Sergideki tablonun önünde mıhlanmış gibi duruyordum. Bu portrede öyle bir bakış vardı ki, insanın bütün ruhunu derinliklerine kadar sarsıyordu.

Kürk mantosu içinde başını hafifçe yana eğmiş genç bir kadın, gözlerini doğrudan doğruya bana dikmişti. Bu bakışta hem derin bir hüzün hem de sarsılmaz bir mağrurluk parıldıyordu.

O andan itibaren hayatımın artık eskisi gibi olamayacağını anlamıştım. Bir resim, insanın içinde uyuyan koca bir dünyayı bir saniyede uyandırabilir miydi?`,
    sentences: [
      {
        index: 0,
        text: 'Sergideki tablonun önünde mıhlanmış gibi duruyordum. Bu portrede öyle bir bakış vardı ki, insanın bütün ruhunu derinliklerine kadar sarsıyordu.',
        timestampSec: 0,
        literaryNotes: 'Expressive Turkish idiom "mıhlanmış gibi" (as if nailed down) conveying absolute awe.',
        tokens: [
          { text: 'sergideki', lemma: 'sergi', pos: 'NOUN', syntaxRole: 'Locative Adjective', cefrLevel: 'A2', ipa: '/sæɾ.ɟi.dɛ.ci/', mediatorTranslation: 'sərgidəki / на выставке' },
          { text: 'tablonun', lemma: 'tablo', pos: 'NOUN', syntaxRole: 'Genitive', cefrLevel: 'A2', ipa: '/tɑb.ɫoˈnun/', mediatorTranslation: 'tablonun / картины' },
          { text: 'sarsıyordu', lemma: 'sarsmak', pos: 'VERB', syntaxRole: 'Predicate', cefrLevel: 'B1', ipa: '/sɑɾ.sɯˈjoɾ.du/', mediatorTranslation: 'sarsırdı / потрясал' },
        ],
      },
      {
        index: 1,
        text: 'Bu bakışta hem derin bir hüzün hem de sarsılmaz bir mağrurluk parıldıyordu.',
        timestampSec: 8,
        literaryNotes: 'Poetic duality of melancholy (hüzün) and dignity (mağrurluk) in Turkish romantic realism.',
        tokens: [
          { text: 'hüzün', lemma: 'hüzün', pos: 'NOUN', syntaxRole: 'Conjunction Object', cefrLevel: 'B1', ipa: '/hyˈzyn/', mediatorTranslation: 'kədər / грусть' },
          { text: 'sarsılmaz', lemma: 'sarsılmaz', pos: 'ADJ', syntaxRole: 'Modifier', cefrLevel: 'B2', ipa: '/sɑɾ.sɯɫˈmɑz/', mediatorTranslation: 'sarsılmaz / непоколебимый' },
          { text: 'mağrurluk', lemma: 'mağrurluk', pos: 'NOUN', syntaxRole: 'Subject Element', cefrLevel: 'B2', ipa: '/mɑː.ɾuɾˈɫuk/', mediatorTranslation: 'məğrurluq / гордость' },
        ],
      },
      {
        index: 2,
        text: 'Bir resim, insanın içinde uyuyan koca bir dünyayı bir saniyede uyandırabilir miydi?',
        timestampSec: 15,
        literaryNotes: 'Rhetorical question emphasizing the transcendental power of authentic art.',
        tokens: [
          { text: 'dünyayı', lemma: 'dünya', pos: 'NOUN', syntaxRole: 'Direct Object', cefrLevel: 'A1', ipa: '/dyn.jɑˈjɯ/', mediatorTranslation: 'dünyanı / мир' },
          { text: 'uyandırabilir', lemma: 'uyandırmak', pos: 'VERB', syntaxRole: 'Potential Verb', cefrLevel: 'B1', ipa: '/u.jɑn.dɯ.ɾɑ.biˈliɾ/', mediatorTranslation: 'oyada bilərmi / пробудить' },
        ],
      },
    ],
    conversations: [
      {
        speaker: 'Sabahattin Ali',
        avatarEmoji: '☕',
        promptInTarget: 'Raif Efendi\'nin bu portreye karşı hissettiği yakınlığın sırrı nedir?',
        promptTranslation: 'What is the secret behind the affinity Raif Efendi feels toward this portrait?',
        userResponseOptions: [
          {
            text: 'Yalnız ruhunun ilk defa anlaşılmış olma duygusunu o bakışta bulmasıdır.',
            isBestChoice: true,
            feedback: 'Tebrikler! Raif Efendi, kalabalıklar içinde hissettiği derin yabancılaşmanın panzehirini o tabloda bulur.',
          },
          {
            text: 'Sadece tablonun renklerinin parlak ve pahalı olmasıdır.',
            isBestChoice: false,
            feedback: 'Hayır, Raif Efendi için bu estetik bir hazdan ziyade ruhani bir uyanıştır.',
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-ali-1',
        type: 'vocabulary',
        question: 'Metindeki "mıhlanmış gibi durmak" deyimi ne anlama gelir?',
        options: [
          'Şaşkınlıktan veya hayranlıktan yerinden kımıldayamaz hale gelmek',
          'Tabloyu duvara asmak için çekiç aramak',
          'Müzeden hızla dışarı çıkmak',
          'Resme sırtını dönüp beklemek',
        ],
        correctIndex: 0,
        explanation: 'Bu deyim derin hayret veya büyülenme karşısında hareketsiz kalmayı ifade eder.',
      },
    ],
    culturalNotes: 'Kürk Mantolu Madonna, Sabahattin Ali\'nin insanın iç dünyasındaki hassasiyetleri ve yabancılaşmayı anlatan en sevilen başyapıtıdır.',
  },
];
