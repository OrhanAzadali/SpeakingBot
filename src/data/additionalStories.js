// Additional classic stories and dialog excerpts expanding the literary immersion library

export const ADDITIONAL_CLASSIC_STORIES = [
  {
    id: 'story-austen-pride-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    authorEra: 'Regency Era (1813)',
    targetLanguage: 'English',
    level: 'B2',
    mode: 'both',
    summary: "The iconic opening and witty dialogue between Mr. and Mrs. Bennet regarding the arrival of Mr. Bingley at Netherfield Park, demonstrating Austen's supreme mastery of irony, free indirect discourse, and social satire.",
    theme: 'Social Conventions, Marriage as Economic Security, Wit vs. Propriety',
    estimatedMinutes: 6,
    audioNarrator: 'Mrs. & Mr. Bennet (Classic British Regency RP, Crisp & Ironical)',
    audioTone: 'Witty, Satirical & Elegant',
    storyText: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"
Mr. Bennet replied that he had not.
"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."
Mr. Bennet made no answer.
"Do you not want to know who has taken it?" cried his wife impatiently.
"You want to tell me, and I have no objection to hearing it."
This was invitation enough.`,
    paragraphs: [
      `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.`,
      `However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.`,
      `"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?" Mr. Bennet replied that he had not. "But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."`,
      `Mr. Bennet made no answer. "Do you not want to know who has taken it?" cried his wife impatiently. "You want to tell me, and I have no objection to hearing it." This was invitation enough.`,
    ],
    sentences: [
      {
        text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        translation: 'Hamı tərəfindən qəbul edilmiş bir həqiqətdir ki, sərvət sahibi olan subay bir kişinin mütləq bir həyat yoldaşına ehtiyacı vardır.',
        literaryNote: "Supreme specimen of dramatic irony: the premise reflects the desperate preoccupation of mothers, not the bachelor's internal desire.",
        startSec: 0,
        endSec: 7.2,
      },
      {
        text: 'However little known the feelings or views of such a man may be, this truth is so well fixed that he is considered rightful property.',
        translation: 'Belə bir kişinin hissləri nə qədər az məlum olsa da, bu fikir o qədər möhkəmlənib ki, o, qızlardan birinin qanuni mülkiyyəti sayılır.',
        literaryNote: 'Commercial dehumanization metaphor ("rightful property") satirizing Regency matrimonial transactions.',
        startSec: 7.2,
        endSec: 15.0,
      },
      {
        text: '"Do you not want to know who has taken it?" cried his wife impatiently.',
        translation: '"Oranı kimin icarəyə götürdüyünü bilmək istəmirsən?" deyə həyat yoldaşı səbirsizliklə qışqırdı.',
        literaryNote: 'Negative interrogative ("Do you not want...") conveying urgent emotional pressure.',
        startSec: 15.0,
        endSec: 20.5,
      },
      {
        text: '"You want to tell me, and I have no objection to hearing it." This was invitation enough.',
        translation: '"Sən mənə danışmaq istəyirsən və mənim də bunu dinləməyə etirazım yoxdur." Bu, kifayət qədər dəvət idi.',
        literaryNote: "Litotes / double negative formulation ('no objection') highlighting Mr. Bennet's detached, dry irony.",
        startSec: 20.5,
        endSec: 28.0,
      },
    ],
    conversations: [
      {
        id: 'conv-austen-1',
        speakerPersona: 'Mr. Bennet',
        dialoguePrompt: 'My dear friend, observe how I handle Mrs. Bennet: "You want to tell me, and I have no objection to hearing it." Why did I decline to ask her directly, yet allow her to proceed?',
        userResponses: [
          {
            id: 'resp-austen-1',
            text: 'By refusing to ask, you maintain conversational supremacy while indulging her desperate desire to gossip without having to forfeit your posture of detachment.',
            analysis: "Magnificent psychological reading! Mr. Bennet preserves his dry, sardonic autonomy while granting Mrs. Bennet the exact stage she craves.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-austen-2',
            text: 'Because you were deaf and did not hear her first question.',
            analysis: "Incorrect. Mr. Bennet's hearing is sharp; his entire personality is grounded in playful verbal parrying.",
            isDeepInsight: false,
            scoreAwarded: 2,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-austen-1',
        type: 'stylistic_syntax',
        question: 'In the famous opening sentence, what grammatical device does Austen use to disguise Mrs. Bennet\'s subjective desire as an objective reality?',
        options: [
          'Impersonal passive voice and universally quantifying modifier ("It is a truth universally acknowledged")',
          'First-person singular subjective confession ("I personally think that...")',
          'Direct imperative command ordering young men to marry',
          'Subjunctive future conditional with modal verbs',
        ],
        correctIndex: 0,
        explanation: "By framing the premise as an impersonal, universally accepted truth, Austen immediately ironizes the social consensus of the era.",
        linguisticIntricacyNote: "Austen's irony works through syntactical elevation of parochial gossip to philosophical dogma.",
      },
    ],
    culturalLinguisticContext: "Published in 1813, Pride and Prejudice revolutionized English narrative voice with Austen's pioneering use of free indirect discourse and dialogue that reflects subtle power dynamics.",
    keyVocabulary: [
      { word: 'universally', pos: 'ADV', meaning: 'Without exception, across all contexts', cefr: 'B2', ipa: '/ˌjuːnɪˈvɜːsəli/', example: 'It is universally recognized that health is wealth.' },
      { word: 'fortune', pos: 'NOUN', meaning: 'Large amount of accumulated wealth and capital', cefr: 'B1', ipa: '/ˈfɔːtʃuːn/', example: 'He inherited an immense fortune from his grandfather.' },
      { word: 'objection', pos: 'NOUN', meaning: 'An expression or feeling of disapproval or opposition', cefr: 'B2', ipa: '/əbˈdʒekʃn/', example: 'I have no objection to your proposal.' },
    ],
    stylisticDevices: [
      { device: 'Socratic Irony', exampleFromText: 'You want to tell me, and I have no objection to hearing it.', explanation: 'Apparent compliance hiding superior intellectual detachment.' },
    ],
  },
  {
    id: 'story-fitzgerald-great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    authorEra: 'Roaring Twenties / Jazz Age (1925)',
    targetLanguage: 'English',
    level: 'B2',
    mode: 'both',
    summary: "Nick Carraway recounts the moral compass imparted by his father in his younger and more vulnerable years—a creed of reserving judgments that exposes both human frailty and Gatsby's gorgeous romantic readiness.",
    theme: 'Moral Ambiguity, The Illusion of the American Dream, Class Consciousness',
    estimatedMinutes: 5,
    audioNarrator: 'Nick Carraway (Reflective, Lyrical, Midwestern Cadence)',
    audioTone: 'Melancholic, Lyrical & Evocative',
    storyText: `In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.

"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven’t had the advantages that you’ve had."

He didn’t say any more, but we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.`,
    paragraphs: [
      `In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.`,
      `"Whenever you feel like criticizing any one," he told me, "just remember that all the people in this world haven’t had the advantages that you’ve had."`,
      `He didn’t say any more, but we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.`,
    ],
    sentences: [
      {
        text: 'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.',
        translation: 'Gənc və daha həssas olduğum illərdə atam mənə elə bir məsləhət verdi ki, o vaxtdan bəri onu ağlımda dönə-dönə götür-qoy edirəm.',
        literaryNote: 'Idiomatic phrasal verb "turning over in my mind" denotes continuous philosophical contemplation.',
        startSec: 0,
        endSec: 7.5,
      },
      {
        text: '"Whenever you feel like criticizing any one, just remember that all the people in this world haven’t had the advantages that you’ve had."',
        translation: '"Nə vaxtsa kimisə tənqid etmək istəsən, sadəcə xatırla ki, bu dünyadakı insanların heç də hamısı sənin sahib olduğun üstünlüklərə malik olmayıb."',
        literaryNote: 'Adverbial clause of condition ("Whenever you feel like...") functioning as a lifelong moral benchmark.',
        startSec: 7.5,
        endSec: 16.0,
      },
      {
        text: 'In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me.',
        translation: 'Nəticədə, mən bütün mühakimələri təxirə salmağa meylli oldum ki, bu vərdiş mənə bir çox qəribə xarakterləri açdı.',
        literaryNote: 'Formal connective "In consequence" introducing the narrator\'s psychological predisposition.',
        startSec: 16.0,
        endSec: 24.0,
      },
    ],
    conversations: [
      {
        id: 'conv-gatsby-1',
        speakerPersona: 'Nick Carraway',
        dialoguePrompt: 'Consider why I call myself "inclined to reserve all judgments" yet spend the entire novel chronicling and dissecting the moral degradation of Tom, Daisy, and Jordan. Is my reserve an absolute shield or a narrative pose?',
        userResponses: [
          {
            id: 'resp-gatsby-1',
            text: 'Your reserve is the precise mechanism that allows people to confess to you; reserving judgment in speech enables you to observe and critique them with devastating clarity on the page.',
            analysis: "Brilliantly perceptive! Nick's silence in conversation makes him the ultimate confidant, allowing his retrospective prose to render the definitive moral verdict.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-gatsby-2',
            text: 'You reserved judgments because you were simply indifferent to everything happening around you.',
            analysis: 'Inaccurate. Nick is intensely passionate about morality, admitting that after returning from the East he wanted the world to be in uniform and at a sort of moral attention forever.',
            isDeepInsight: false,
            scoreAwarded: 3,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-gatsby-1',
        type: 'inference',
        question: 'What double meaning does the phrase "veteran bores" hold in Nick\'s monologue?',
        options: [
          'Men who served in the war and tediously repeated wartime anecdotes to any polite listener',
          'People who are experienced, habitual monopolizers of conversation taking advantage of his tolerant silence',
          'Both a literal nod to WW1 veterans and an idiomatic description of chronic, unceasing conversationalists',
          'Professional drill sergeants teaching military tactics',
        ],
        correctIndex: 2,
        explanation: "Fitzgerald brilliantly layers the post-WW1 atmosphere: 'veteran' touches upon the recent Great War while colloquially qualifying chronic bores.",
        linguisticIntricacyNote: "Polysemy of 'veteran' bridges historical trauma and social nuance.",
      },
    ],
    culturalLinguisticContext: 'Written in 1925, Fitzgerald crafted some of the most musical and rhythmically balanced prose in American letters, capturing the fleeting glamour and profound spiritual vacuum of the post-war boom.',
    keyVocabulary: [
      { word: 'vulnerable', pos: 'ADJ', meaning: 'Susceptible to physical or emotional attack or harm', cefr: 'B2', ipa: '/ˈvʌlnərəbl/', example: 'Young artists are often emotionally vulnerable to harsh criticism.' },
      { word: 'advantages', pos: 'NOUN', meaning: 'Favorable or superior circumstances or benefits', cefr: 'A2', ipa: '/ədˈvɑːntɪdʒɪz/', example: 'Education gave him distinct advantages in his career.' },
      { word: 'inclined', pos: 'ADJ', meaning: 'Disposed or leaning toward a certain action or opinion', cefr: 'B2', ipa: '/ɪnˈklaɪnd/', example: 'I am inclined to agree with your assessment.' },
    ],
    stylisticDevices: [
      { device: 'Chiasmus & Cadence', exampleFromText: 'unusually communicative in a reserved way', explanation: 'Oxymoronic synthesis creating an intimate yet dignified family portrait.' },
    ],
  },
  {
    id: 'story-carroll-alice-wonderland',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    authorEra: 'Victorian Nonsense Literature (1865)',
    targetLanguage: 'English',
    level: 'B1',
    mode: 'both',
    summary: 'The legendary Mad Tea-Party dialogue between Alice, the Mad Hatter, and the March Hare, exploring linguistic literalism, semantic paradoxes, and the philosophical personification of Time.',
    theme: 'Language as a Game, Logic vs. Semantic Absurdity, Victorian Etiquette',
    estimatedMinutes: 5,
    audioNarrator: 'The Mad Hatter & Alice (Vibrant, Playful, Quick-Witted)',
    audioTone: 'Playful, Absurdist & Rapid-Fire',
    storyText: `"Take some more tea," the March Hare said to Alice, very earnestly.

"I’ve had nothing yet," Alice replied in an offended tone, "so I can’t take more."

"You mean you can’t take less," said the Hatter: "it’s very easy to take more than nothing."

"Nobody asked your opinion," said Alice.

"Who’s making personal remarks now?" the Hatter asked triumphantly.

Alice did not quite know what to say to this: so she helped herself to some tea and bread-and-butter, and then turned to the Hatter, and said, "Have you guessed the riddle yet?"

"No, I give it up," Alice replied: "what’s the answer?"

"I haven’t the slightest idea," said the Hatter.
"Nor I," said the March Hare.`,
    paragraphs: [
      `"Take some more tea," the March Hare said to Alice, very earnestly.`,
      `"I’ve had nothing yet," Alice replied in an offended tone, "so I can’t take more." "You mean you can’t take less," said the Hatter: "it’s very easy to take more than nothing."`,
      `"Nobody asked your opinion," said Alice. "Who’s making personal remarks now?" the Hatter asked triumphantly.`,
      `Alice did not quite know what to say to this: so she helped herself to some tea and bread-and-butter, and then turned to the Hatter, and said, "Have you guessed the riddle yet?" "No, I give it up," Alice replied: "what’s the answer?" "I haven’t the slightest idea," said the Hatter. "Nor I," said the March Hare.`,
    ],
    sentences: [
      {
        text: '"Take some more tea," the March Hare said to Alice, very earnestly.',
        translation: '"Bir az daha çay iç," Mart Dovşanı çox ciddi bir tərzdə Elisə dedi.',
        literaryNote: 'Conventional polite invitation twisted into a logical fallacy when addressed to someone who has had none.',
        startSec: 0,
        endSec: 5.0,
      },
      {
        text: '"I’ve had nothing yet, so I can’t take more." "You mean you can’t take less; it’s very easy to take more than nothing."',
        translation: '"Mən hələ heç nə içməmişəm, ona görə də daha çox içə bilmərəm." "Demək istəyirsən ki, daha az içə bilməzsən; heç nədən çox götürmək çox asandır."',
        literaryNote: 'Mathematical logic strictly applied to idiomatic phrasing, subverting social etiquette.',
        startSec: 5.0,
        endSec: 13.5,
      },
      {
        text: '"Have you guessed the riddle yet?" "I haven’t the slightest idea," said the Hatter. "Nor I," said the March Hare.',
        translation: '"Tapmacanı tapdınmı?" "Zərrə qədər də təsəvvürüm yoxdur," dedi Şlyapaçı. "Mənim də," dedi Mart Dovşanı.',
        literaryNote: 'Radical anti-climax exploding the teleological purpose of riddles in literature.',
        startSec: 13.5,
        endSec: 22.0,
      },
    ],
    conversations: [
      {
        id: 'conv-alice-1',
        speakerPersona: 'The Mad Hatter',
        dialoguePrompt: 'Why do you mortals insist on asking riddles with answers? Is not "Why is a raven like a writing-desk?" glorious precisely because the raven flies and the desk remains seated without an answer?',
        userResponses: [
          {
            id: 'resp-alice-1',
            text: 'Because human language assumes communication must resolve into utility, whereas in Wonderland language is an autonomous, playful mathematical system.',
            analysis: "Sublime! You have grasped Carroll's mathematical subversion: language freed from pragmatic utility becomes pure aesthetic game.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-alice-2',
            text: 'Because you forgot to write down the answer in your notebook.',
            analysis: 'Amusing, but Carroll famously confirmed he conceived the riddle without any predetermined answer whatsoever.',
            isDeepInsight: false,
            scoreAwarded: 3,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-alice-1',
        type: 'stylistic_syntax',
        question: 'On what linguistic phenomenon does the Hatter\'s pun "it’s very easy to take more than nothing" depend?',
        options: [
          'Confusion between colloquial quantifier "more" (additional) and mathematical quantity greater than zero',
          'A grammatical error in Alice\'s use of modal auxiliary verbs',
          'Passive voice inversion in Victorian table manners',
          'Irregular past tense conjugation',
        ],
        correctIndex: 0,
        explanation: "Alice uses 'more' idiomatically meaning 'an additional amount'. The Hatter treats 'nothing' as quantity 0, where any quantity x > 0 is mathematically 'more'.",
        linguisticIntricacyNote: 'Pragmatic vs. semantic interpretation clash.',
      },
    ],
    culturalLinguisticContext: 'Charles Dodgson (Lewis Carroll), an Oxford mathematician and logician, used Wonderland to parody the rigid moralizing and pedantic educational conventions imposed upon Victorian children.',
    keyVocabulary: [
      { word: 'earnestly', pos: 'ADV', meaning: 'With sincere and intense conviction', cefr: 'B2', ipa: '/ˈɜːnɪstli/', example: 'He pleaded earnestly for their understanding.' },
      { word: 'slightest', pos: 'ADJ', meaning: 'Smallest in degree or amount', cefr: 'B1', ipa: '/ˈslaɪtɪst/', example: "I don't have the slightest doubt about it." },
      { word: 'riddle', pos: 'NOUN', meaning: 'A question or statement phrased with puzzle-like ingenuity', cefr: 'B1', ipa: '/ˈrɪdl/', example: 'The sphinx posed an ancient riddle to the traveler.' },
    ],
    stylisticDevices: [
      { device: 'Semantic Paraprosdokian', exampleFromText: 'it’s very easy to take more than nothing', explanation: 'An unexpected ending that forces reinterpretation of the prior sentence.' },
    ],
  },
  {
    id: 'story-shelley-frankenstein',
    title: 'Frankenstein; or, The Modern Prometheus',
    author: 'Mary Shelley',
    authorEra: 'Romantic Gothic (1818)',
    targetLanguage: 'English',
    level: 'C1',
    mode: 'both',
    summary: "The breathtaking dialogue on the Mer de Glace between Victor Frankenstein and his abandoned Creature, wherein the Creature delivers one of literature's most articulate indictments of parental and societal abandonment.",
    theme: 'Creation vs. Responsibility, Nature vs. Nurture, The Power of Eloquence',
    estimatedMinutes: 6,
    audioNarrator: 'The Creature (Resonant, Passionate, Poetically Tragic)',
    audioTone: 'Tragic, Poignant & Philosophically Lofty',
    storyText: `"Remember, that I am thy creature; I ought to be thy Adam, but I am rather the fallen angel, whom thou drivest from joy for no misdeed. Everywhere I see bliss, from which I alone am irrevocably excluded. I was benevolent and good; misery made me a fiend. Make me happy, and I shall again be virtuous."

"Begone! I will not hear you. There can be no community between you and me; we are enemies."

"How can I move thee? Will no entreaties cause thee to turn a favourable eye upon thy creature, who implores thy goodness and compassion? Believe me, Frankenstein: I was benevolent; my soul glowed with love and humanity: but am I not alone, miserably alone? You, my creator, abhor me; what hope can I gather from your fellow-creatures, who owe me nothing?"`,
    paragraphs: [
      `"Remember, that I am thy creature; I ought to be thy Adam, but I am rather the fallen angel, whom thou drivest from joy for no misdeed. Everywhere I see bliss, from which I alone am irrevocably excluded. I was benevolent and good; misery made me a fiend. Make me happy, and I shall again be virtuous."`,
      `"Begone! I will not hear you. There can be no community between you and me; we are enemies."`,
      `"How can I move thee? Will no entreaties cause thee to turn a favourable eye upon thy creature, who implores thy goodness and compassion? Believe me, Frankenstein: I was benevolent; my soul glowed with love and humanity: but am I not alone, miserably alone? You, my creator, abhor me; what hope can I gather from your fellow-creatures, who owe me nothing?"`,
    ],
    sentences: [
      {
        text: '"Remember, that I am thy creature; I ought to be thy Adam, but I am rather the fallen angel, whom thou drivest from joy for no misdeed."',
        translation: '"Xatırla ki, mən sənin yaratdığın varlığam; mən sənin Adəmin olmalı idim, lakin heç bir günahım olmadan səadətdən qovduğun süqut etmiş mələyəm."',
        literaryNote: 'Miltonic allusion to Paradise Lost; archaic second-person pronouns ("thy", "thou") invoke sacred covenantal relationship.',
        startSec: 0,
        endSec: 9.0,
      },
      {
        text: '"I was benevolent and good; misery made me a fiend. Make me happy, and I shall again be virtuous."',
        translation: '"Mən xeyirxah və yaxşı idim; bədbəxtlik məni bədheybətə çevirdi. Məni xoşbəxt et və mən yenidən fəzilətli olacağam."',
        literaryNote: 'Rousseauian philosophical axiom: natural human innocence corrupted by societal rejection.',
        startSec: 9.0,
        endSec: 16.5,
      },
      {
        text: '"You, my creator, abhor me; what hope can I gather from your fellow-creatures, who owe me nothing?"',
        translation: '"Sən, mənim yaradıcım olduğun halda məndən iyrənirsən; bəs mənə heç bir borcu olmayan digər həmcinslərindən nə ümid gözləyə bilərəm?"',
        literaryNote: "A fortiori logical argument exposing Victor's moral dereliction of creator duty.",
        startSec: 16.5,
        endSec: 25.0,
      },
    ],
    conversations: [
      {
        id: 'conv-shelley-1',
        speakerPersona: 'The Creature',
        dialoguePrompt: 'Why did Mary Shelley grant me such majestic, neoclassical, elevated rhetoric instead of making me grunt like an illiterate beast?',
        userResponses: [
          {
            id: 'resp-shelley-1',
            text: 'Because your supreme eloquence deepens the tragedy: the monster is intellectually and morally superior to the creator who rejects him based solely on aesthetic prejudice.',
            analysis: 'Devastatingly accurate. Shelley forces the reader to confront their own superficial biases: the being with the horrific exterior possesses the most sensitive, philosophical soul.',
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-shelley-2',
            text: 'Because you swallowed a dictionary when wandering through the forest.',
            analysis: 'No; the Creature painstakingly taught himself language by listening to the De Lacey family and studying Milton, Plutarch, and Goethe.',
            isDeepInsight: false,
            scoreAwarded: 2,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-shelley-1',
        type: 'inference',
        question: 'What philosophical doctrine underpins the Creature\'s assertion: "I was benevolent and good; misery made me a fiend"?',
        options: [
          'Jean-Jacques Rousseau\'s belief in inherent goodness corrupted by social exclusion',
          'Thomas Hobbes\'s view of life in state of nature being solitary, poor, nasty, brutish, and short',
          'Descartes\'s mind-body dualism',
          'Nietzschean will to power',
        ],
        correctIndex: 0,
        explanation: 'Shelley was deeply influenced by Rousseau: humanity is born innately good and compassionate, but ostracism and misery breed villainy.',
        linguisticIntricacyNote: "Causal antithesis: 'benevolent and good' versus 'misery made me a fiend'.",
      },
    ],
    culturalLinguisticContext: 'Written when Shelley was just 18 years old, Frankenstein was published in 1818. Its use of Miltonic syntax and Enlightenment philosophy forged the foundational text of modern science fiction.',
    keyVocabulary: [
      { word: 'benevolent', pos: 'ADJ', meaning: 'Well-meaning, kindly, characterized by goodwill', cefr: 'C1', ipa: '/bəˈnevələnt/', example: 'A benevolent ruler cares for every citizen.' },
      { word: 'irrevocably', pos: 'ADV', meaning: 'In a way that cannot be changed, reversed, or recovered', cefr: 'C1', ipa: '/ɪˈrevəkəbli/', example: 'Their trust was irrevocably shattered.' },
      { word: 'entreaties', pos: 'NOUN', meaning: 'Earnest or humble requests; pleas', cefr: 'C1', ipa: '/ɪnˈtriːtiz/', example: 'Despite her fervent entreaties, the judge held firm.' },
    ],
    stylisticDevices: [
      { device: 'Biblical Typology & Antithesis', exampleFromText: 'I ought to be thy Adam, but I am rather the fallen angel', explanation: 'Contrasts the ideal position of first son with the cursed destiny of Satan.' },
    ],
  },
  {
    id: 'story-twain-tom-sawyer',
    title: 'The Adventures of Tom Sawyer',
    author: 'Mark Twain',
    authorEra: 'American Realism / Gilded Age (1876)',
    targetLanguage: 'English',
    level: 'B1',
    mode: 'both',
    summary: 'Tom Sawyer is tasked with the dreadful punishment of whitewashing Aunt Polly\'s thirty yards of board fence, but uses psychological genius and peer persuasion to transform labor into an elite, coveted privilege.',
    theme: 'Psychology of Desire, American Vernacular, Boyhood Ingenuity',
    estimatedMinutes: 5,
    audioNarrator: 'Tom Sawyer & Ben Rogers (American Missouri Vernacular, Lively)',
    audioTone: 'Playful, Cheerful & Humorous',
    storyText: `Tom appeared on the sidewalk with a bucket of whitewash and a long-handled brush. He surveyed the fence, and all gladness left him and a deep melancholy settled down upon his spirit. Thirty yards of board fence nine feet high. Life to him seemed hollow, and existence but a burden.

Presently Ben Rogers hove in sight—the very boy, of all boys, whose ridicule he had been dreading. Ben was eating an apple, and giving a long, melodious whoop, at intervals, followed by a deep-toned ding-dong-dong. He was personating a steamboat.

Tom went on whitewashing—paid no attention to the steamboat. Ben stared a moment and then said: "Hi-yi! You’re up a stump, ain’t you!"
No answer. Tom surveyed his last touch with the eye of an artist, then he gave his brush another gentle sweep.
Ben said: "Hello, old chap, you got to work, hey?"
Tom wheeled suddenly and said: "Why, it’s you, Ben! I warn’t noticing."
"Say—I’m going in a-swimming, I am. Don’t you wish you could? But of course you’d druther work—wouldn’t you?"
Tom contemplated the boy a bit, and said: "What do you call work?"
"Why, ain’t that work?"
Tom resumed his whitewashing, and answered carelessly: "Well, maybe it is, and maybe it ain’t. All I know, is, it suits Tom Sawyer."`,
    paragraphs: [
      `Tom appeared on the sidewalk with a bucket of whitewash and a long-handled brush. He surveyed the fence, and all gladness left him and a deep melancholy settled down upon his spirit. Thirty yards of board fence nine feet high. Life to him seemed hollow, and existence but a burden.`,
      `Presently Ben Rogers hove in sight—the very boy whose ridicule he had been dreading. Ben was eating an apple, personating the steamboat Big Missouri. Tom went on whitewashing—paid no attention to the steamboat.`,
      `Ben said: "Hello, old chap, you got to work, hey?" Tom wheeled suddenly and said: "Why, it’s you, Ben! I warn’t noticing." "Say—I’m going in a-swimming. Don’t you wish you could? But of course you’d druther work."`,
      `Tom answered carelessly: "Well, maybe it is, and maybe it ain’t. All I know, is, it suits Tom Sawyer. Does a boy get a chance to whitewash a fence every day?" That put the thing in a new light.`,
    ],
    sentences: [
      {
        text: 'Tom appeared on the sidewalk with a bucket of whitewash and a long-handled brush.',
        translation: 'Tom səkidə əlində bir vedrə əhəng məhlulu və uzun saplı fırça ilə peyda oldu.',
        literaryNote: 'Classic narrative exposition introducing the physical burden of child labor.',
        startSec: 0,
        endSec: 5.2,
      },
      {
        text: 'Tom surveyed his last touch with the eye of an artist, then he gave his brush another gentle sweep.',
        translation: 'Tom bir rəssamın gözü ilə fırçasının son toxunuşunu nəzərdən keçirdi və divara daha bir incə zərbə endirdi.',
        literaryNote: 'Theatrical pretense: recasting manual drudgery as fine aesthetic craft.',
        startSec: 5.2,
        endSec: 12.0,
      },
      {
        text: '"Well, maybe it is work, and maybe it ain’t. All I know, is, it suits Tom Sawyer."',
        translation: '"Bəlkə də bu işdir, bəlkə də deyil. Bildiyim bircə şey var: bu, Tom Soyerin könlüncədir."',
        literaryNote: 'Masterclass in cognitive reframing: scarcity and exclusive enjoyment breed desire.',
        startSec: 12.0,
        endSec: 19.5,
      },
    ],
    conversations: [
      {
        id: 'conv-twain-1',
        speakerPersona: 'Tom Sawyer',
        dialoguePrompt: 'Look here, partner: why did I refuse to look at Ben until he begged me to let him try the brush? What is the great law of human action I discovered that afternoon?',
        userResponses: [
          {
            id: 'resp-twain-1',
            text: 'That in order to make a person covet a thing, it is only necessary to make the thing difficult to attain; work is what a body is obliged to do, and play is what a body is not obliged to do.',
            analysis: "Spot on! That is Twain's exact philosophical conclusion: framing an activity as an exclusive privilege instantly turns reluctance into clamoring desire.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-twain-2',
            text: 'You didn\'t look at him because you were really bad at painting fences.',
            analysis: 'Nonsense! Tom was an artist of human psychology and wound up wealthy with marbles and apple cores.',
            isDeepInsight: false,
            scoreAwarded: 2,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-twain-1',
        type: 'vocabulary_in_context',
        question: 'What does the 19th-century American dialect word "druther" mean in Ben\'s taunt ("you’d druther work")?',
        options: [
          'Would rather / would prefer',
          'Do work rather badly',
          'Drink water instead of working',
          'Dry the feathers',
        ],
        correctIndex: 0,
        explanation: "'Druther' is a colloquial phonetic contraction of 'would rather' (preference).",
        linguisticIntricacyNote: 'Mark Twain pioneered the realistic phonetic capture of American regional dialects.',
      },
    ],
    culturalLinguisticContext: 'Published in 1876, Mark Twain revolutionized literature by replacing stilted Victorian grammar with vibrant American colloquial speech, dialect phonetics, and dry humor.',
    keyVocabulary: [
      { word: 'melancholy', pos: 'NOUN', meaning: 'A deep, pensive, and long-lasting sadness', cefr: 'B2', ipa: '/ˈmelənkəli/', example: 'A gloomy mist brought a wave of melancholy over the valley.' },
      { word: 'contemplate', pos: 'VERB', meaning: 'Look thoughtfully at for a long time or consider deeply', cefr: 'B2', ipa: '/ˈkɒntəmpleɪt/', example: 'He sat quietly to contemplate his future moves.' },
      { word: 'burden', pos: 'NOUN', meaning: 'A heavy load, either physical or mental responsibility', cefr: 'B1', ipa: '/ˈbɜːdn/', example: 'Debt was a crushing burden on the young family.' },
    ],
    stylisticDevices: [
      { device: 'Dramatic Irony & Vernacular Realism', exampleFromText: 'I warn’t noticing... it suits Tom Sawyer', explanation: 'The audience knows Tom hates the chore, amplifying the comic tension.' },
    ],
  },
  {
    id: 'story-saint-exupery-petit-prince',
    title: 'Le Petit Prince (The Little Prince)',
    author: 'Antoine de Saint-Exupéry',
    authorEra: 'Mid-20th Century Philosophical Tale (1943)',
    targetLanguage: 'French',
    level: 'A2',
    mode: 'both',
    summary: 'The luminous philosophical encounter between the Little Prince and the Fox, wherein the Fox reveals the sacred meaning of creating bonds ("apprivoiser") and the eternal secret of the heart.',
    theme: 'Friendship, Rituals, Invisible Truths vs. Superficial Utility',
    estimatedMinutes: 5,
    audioNarrator: 'Le Renard & Le Petit Prince (Doux, Poétique et Lumineux)',
    audioTone: 'Poetic, Tender & Philosophical',
    storyText: `— Qu’est-ce que signifie « apprivoiser » ?
— C’est une chose trop oubliée, dit le renard. Ça signifie « créer des liens... »
— Créer des liens ?
— Bien sûr, dit le renard. Tu n’es encore pour moi qu’un petit garçon tout semblable à cent mille petits garçons. Et je n’ai pas besoin de toi. Et tu n’as pas besoin de moi non plus. Je ne suis pour toi qu’un renard semblable à cent mille renards. Mais, si tu m’apprivoises, nous aurons besoin l’un de l’autre. Tu seras pour moi unique au monde. Je serai pour toi unique au monde...

— Adieu, dit le renard. Voici mon secret. Il est très simple : on ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux.`,
    paragraphs: [
      `— Qu’est-ce que signifie « apprivoiser » ? — C’est une chose trop oubliée, dit le renard. Ça signifie « créer des liens... »`,
      `— Bien sûr, dit le renard. Tu n’es encore pour moi qu’un petit garçon tout semblable à cent mille petits garçons. Et je n’ai pas besoin de toi. Et tu n’as pas besoin de moi non plus.`,
      `Mais, si tu m’apprivoises, nous aurons besoin l’un de l’autre. Tu seras pour moi unique au monde. Je serai pour toi unique au monde...`,
      `— Adieu, dit le renard. Voici mon secret. Il est très simple : on ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux.`,
    ],
    sentences: [
      {
        text: 'Qu’est-ce que signifie « apprivoiser » ? Ça signifie « créer des liens... »',
        translation: '«Əhliləşdirmək» nə deməkdir? Bu, «bağlar qurmaq» deməkdir...',
        literaryNote: "Etymological expansion: elevating the domestic verb 'apprivoiser' into an existential act of relational commitment.",
        startSec: 0,
        endSec: 6.0,
      },
      {
        text: 'Si tu m’apprivoises, nous aurons besoin l’un de l’autre. Tu seras pour moi unique au monde.',
        translation: 'Əgər sən məni əhliləşdirsən, bir-birimizə ehtiyacımız olacaq. Sən mənim üçün dünyada tək və bənzərsiz olacaqsan.',
        literaryNote: 'Conditional structure (Si + présent, futur simple) establishing mutual ontological transformation.',
        startSec: 6.0,
        endSec: 14.5,
      },
      {
        text: 'Voici mon secret. Il est très simple : on ne voit bien qu’avec le cœur. L’essentiel est invisible pour les yeux.',
        translation: 'Budur mənim sirrim. Çox sadədir: insan yalnız qəlbi ilə yaxşı görə bilər. Ən başlıca olan şeylər gözə görünməzdir.',
        literaryNote: 'French restrictive negative structure (ne... que) declaring the exclusive primacy of intuitive perception.',
        startSec: 14.5,
        endSec: 24.0,
      },
    ],
    conversations: [
      {
        id: 'conv-prince-1',
        speakerPersona: 'Le Renard',
        dialoguePrompt: 'Mon petit ami, pourquoi ai-je dit que « l’essentiel est invisible pour les yeux » ? Pourquoi les grandes personnes ne le voient-elles pas d\'elles-mêmes ?',
        userResponses: [
          {
            id: 'resp-prince-1',
            text: 'Parce que les adultes ne jugent que par les chiffres, l\'utilité matérielle et l\'apparence extérieure, oubliant que l\'amour et le dévouement ne se mesurent pas physiquement.',
            analysis: "Magnifique et bouleversant ! C'est exactement la critique philosophique de Saint-Exupéry contre le matérialisme stérile des adultes.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-prince-2',
            text: 'Parce que les adultes ont besoin de lunettes.',
            analysis: "Trop littéral. Il ne s'agit pas de cécité physique, mais d'une perte tragique de la sensibilité du cœur.",
            isDeepInsight: false,
            scoreAwarded: 2,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-prince-1',
        type: 'stylistic_syntax',
        question: 'Dans la phrase « on ne voit bien qu’avec le cœur », que signifie la structure restrictive « ne... que » ?',
        options: [
          'Seulement / uniquement avec le cœur',
          'Il est totalement impossible de voir',
          'On voit très mal avec les yeux fermés',
          'Ne jamais regarder avec émotion',
        ],
        correctIndex: 0,
        explanation: "En français, 'ne... que' exprime la restriction, équivalant à 'seulement' (only).",
        linguisticIntricacyNote: "Structure restrictive 'ne... que'.",
      },
    ],
    culturalLinguisticContext: "Écrit pendant l'exil américain de Saint-Exupéry en 1942 et publié en 1943, Le Petit Prince est le livre le plus traduit au monde après la Bible, alliant poésie pure et lucidité morale.",
    keyVocabulary: [
      { word: 'apprivoiser', pos: 'VERB', meaning: 'Rendre sociable, créer des liens profonds et durables', cefr: 'B1', ipa: '/apʁivwaze/', example: 'Il faut du temps et de la patience pour apprivoiser un animal sauvage.' },
      { word: 'essentiel', pos: 'NOUN', meaning: 'Ce qui est le plus important et fondamental', cefr: 'A2', ipa: '/esɑ̃sjɛl/', example: 'Ne perds pas de vue l\'essentiel.' },
      { word: 'semblable', pos: 'ADJ', meaning: 'Qui ressemble, identique en apparence', cefr: 'B1', ipa: '/sɑ̃blabl/', example: 'Des maisons toutes semblables bordaient l\'avenue.' },
    ],
    stylisticDevices: [
      { device: 'Aphorisme Poétique', exampleFromText: 'L’essentiel est invisible pour les yeux', explanation: 'Formulation concise et inoubliable d\'une vérité universelle.' },
    ],
  },
  {
    id: 'story-shakespeare-hamlet',
    title: 'The Tragedy of Hamlet, Prince of Denmark',
    author: 'William Shakespeare',
    authorEra: 'Elizabethan / Jacobean Era (1601)',
    targetLanguage: 'English',
    level: 'C1',
    mode: 'both',
    summary: 'Prince Hamlet\'s immortal contemplation on existence, mortality, and the paralysis of the human will caused by over-thinking ("conscience does make cowards of us all").',
    theme: 'Existential Dread, Thought vs. Action, Mortality and the Unknown',
    estimatedMinutes: 6,
    audioNarrator: 'Prince Hamlet (Shakespearean Theatrical Resonance, Haunting)',
    audioTone: 'Deeply Introspective, Tragic & Philosophic',
    storyText: `To be, or not to be, that is the question:
Whether 'tis nobler in the mind to suffer
The slings and arrows of outrageous fortune,
Or to take arms against a sea of troubles,
And by opposing end them? To die: to sleep;
No more; and by a sleep to say we end
The heart-ache and the thousand natural shocks
That flesh is heir to, 'tis a consummation
Devoutly to be wish'd.

To die, to sleep;
To sleep: perchance to dream: ay, there's the rub;
For in that sleep of death what dreams may come
When we have shuffled off this mortal coil,
Must give us pause.`,
    paragraphs: [
      `To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them?`,
      `To die: to sleep; no more; and by a sleep to say we end the heart-ache and the thousand natural shocks that flesh is heir to, 'tis a consummation devoutly to be wish'd.`,
      `To die, to sleep; to sleep: perchance to dream: ay, there's the rub; for in that sleep of death what dreams may come when we have shuffled off this mortal coil, must give us pause.`,
    ],
    sentences: [
      {
        text: 'To be, or not to be, that is the question.',
        translation: 'Olmaq, ya olmamaq – budur məsələ.',
        literaryNote: 'Antithetical infinitive clauses establishing the foundational ontological dilemma of human consciousness.',
        startSec: 0,
        endSec: 4.5,
      },
      {
        text: "Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles.",
        translation: 'Ağlın içində qəddar taleyin oxlarına dözməkmi daha alicənabdır, yoxsa bəlalar dənizinə qarşı silaha sarılıb son qoymaqmı?',
        literaryNote: 'Mixed martial and aquatic metaphor ("take arms against a sea of troubles") demonstrating psychological turbulence.',
        startSec: 4.5,
        endSec: 13.0,
      },
      {
        text: "To sleep: perchance to dream: ay, there's the rub; for in that sleep of death what dreams may come.",
        translation: 'Yuxuya getmək: bəlkə də yuxu görmək: bax çətinlik də elə bundadır; çünki o ölüm yuxusunda hansı xəyalların gələcəyi bizi duruxdurur.',
        literaryNote: "Metaphor of the 'rub' (an obstacle in the Elizabethan game of lawn bowls) symbolizing metaphysical hesitation.",
        startSec: 13.0,
        endSec: 22.0,
      },
    ],
    conversations: [
      {
        id: 'conv-hamlet-1',
        speakerPersona: 'Prince Hamlet',
        dialoguePrompt: 'Why does the dread of something after death puzzle our will and make us rather bear those ills we have than fly to others that we know not of?',
        userResponses: [
          {
            id: 'resp-hamlet-1',
            text: 'Because human reason, while our greatest gift, becomes our cage: imagination conjures terrifying unknowns about the afterlife that paralyze decisive moral action in the present.',
            analysis: "Magnificently profound. You have struck the core of Hamlet's tragedy: hyper-consciousness transforms heroism into existential paralysis.",
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-hamlet-2',
            text: 'Because you were frightened of the ghost on the castle wall.',
            analysis: 'Too pedestrian. Hamlet is not afraid of physical danger; he is tormented by the moral consequences of action in an incomprehensible universe.',
            isDeepInsight: false,
            scoreAwarded: 3,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-hamlet-1',
        type: 'stylistic_syntax',
        question: 'What does the Elizabethan idiom "there’s the rub" mean in Hamlet\'s soliloquy?',
        options: [
          'That is where the central difficulty or obstacle lies',
          'One should massage one\'s forehead to relieve a headache',
          'There is a physical stain on the royal robes',
          'A musical crescendo in the court orchestra',
        ],
        correctIndex: 0,
        explanation: "Derived from lawn bowls where an unevenness on the green impedes the ball, 'there’s the rub' means the crucial obstacle or dilemma.",
        linguisticIntricacyNote: 'Historical Elizabethan sporting metaphor adopted into universal philosophic English.',
      },
    ],
    culturalLinguisticContext: 'Written circa 1600-1601, Hamlet represents the pinnacle of dramatic poetry. Shakespeare coined over 1,700 words and phrases that defined the Modern English vocabulary.',
    keyVocabulary: [
      { word: 'outrageous', pos: 'ADJ', meaning: 'Shockingly cruel, violently uncontrolled', cefr: 'C1', ipa: '/aʊtˈreɪdʒəs/', example: 'The outrageous injustices of the war sparked nationwide protests.' },
      { word: 'consummation', pos: 'NOUN', meaning: 'The point at which something is complete or finalized', cefr: 'C1', ipa: '/ˌkɒnsəˈmeɪʃn/', example: 'The treaty was the consummation of years of delicate diplomacy.' },
      { word: 'perchance', pos: 'ADV', meaning: 'By some chance; perhaps (archaic / poetic)', cefr: 'B2', ipa: '/pəˈtʃɑːns/', example: 'Perchance we shall meet again when summer returns.' },
    ],
    stylisticDevices: [
      { device: 'Iambic Pentameter with Feminine Endings', exampleFromText: 'To be, or not to be, that is the question', explanation: 'The unstressed 11th syllable reflects Hamlet\'s wavering hesitation and unresolved mind.' },
    ],
  },
  {
    id: 'story-dickens-two-cities',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    authorEra: 'Victorian Era (1859)',
    targetLanguage: 'English',
    level: 'B2',
    mode: 'both',
    summary: 'The celebrated paradox-laden opening of Dickens\'s masterpiece set during the French Revolution, demonstrating the power of anaphora, antithesis, and rhythmic social commentary.',
    theme: 'Duality, Revolution, Social Contrast, Light vs. Darkness',
    estimatedMinutes: 5,
    audioNarrator: 'Victorian Historian (Grand, Urgent, Rhythmic)',
    audioTone: 'Grand, Rhythmic & Prophetic',
    storyText: `It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.

We had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way—in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.`,
    paragraphs: [
      `It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.`,
      `We had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way—in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.`,
    ],
    sentences: [
      {
        text: 'It was the best of times, it was the worst of times.',
        translation: 'Dövrlərin ən yaxşısı idi, dövrlərin ən pisi idi.',
        literaryNote: 'Superlative antithesis opening the most famous anaphoric catalog in English fiction.',
        startSec: 0,
        endSec: 4.5,
      },
      {
        text: 'It was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.',
        translation: 'İşıq fəsli idi, qaranlıq fəsli idi; ümid baharı idi, ümidsizlik qışı idi.',
        literaryNote: 'Seasonal metaphor contrasting spiritual redemption with social catastrophe.',
        startSec: 4.5,
        endSec: 12.0,
      },
      {
        text: 'We had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way.',
        translation: 'Qarşımızda hər şey var idi, qarşımızda heç nə yox idi; hamımız birbaşa cənnətə doğru gedirdik, hamımız birbaşa əks istiqamətə gedirdik.',
        literaryNote: 'Parallelism creating a hypnotic, biblical prophetic cadence.',
        startSec: 12.0,
        endSec: 20.0,
      },
    ],
    conversations: [
      {
        id: 'conv-dickens-1',
        speakerPersona: 'Charles Dickens',
        dialoguePrompt: 'Why did I construct this entire opening using paired, contradictory superlatives instead of simply describing the political events in Paris and London?',
        userResponses: [
          {
            id: 'resp-dickens-1',
            text: 'Because history is lived as contradictory extremes by different social classes simultaneously; the rhetoric captures the bipolar volatility of human civilization.',
            analysis: 'Masterful observation. Dickens shows that history is never uniform: while the aristocracy experienced lavish luxury, the starving proletariat experienced despair.',
            isDeepInsight: true,
            scoreAwarded: 10,
          },
          {
            id: 'resp-dickens-2',
            text: 'Because you couldn\'t decide whether you liked the 18th century or disliked it.',
            analysis: 'Too simplistic. Dickens was deliberately mimicking the dramatic rhetoric of historical chroniclers to show social instability.',
            isDeepInsight: false,
            scoreAwarded: 2,
          },
        ],
      },
    ],
    exercises: [
      {
        id: 'ex-dickens-1',
        type: 'stylistic_syntax',
        question: 'What prominent rhetorical device repeats the initial phrase "it was the..." across consecutive clauses?',
        options: [
          'Anaphora',
          'Epistrophe',
          'Polysyndeton',
          'Asyndeton',
        ],
        correctIndex: 0,
        explanation: 'Anaphora is the deliberate repetition of a word or phrase at the beginning of successive sentences or clauses.',
        linguisticIntricacyNote: 'Dickens uses anaphora to create incantatory rhythm.',
      },
    ],
    culturalLinguisticContext: 'Published in 1859, A Tale of Two Cities was published in weekly installments. Its incisive exploration of the Reign of Terror warned Victorian England against complacency.',
    keyVocabulary: [
      { word: 'epoch', pos: 'NOUN', meaning: "A distinct period of time in history or a person's life", cefr: 'B2', ipa: '/ˈiːpɒk/', example: 'The invention of the printing press inaugurated a new epoch.' },
      { word: 'incredulity', pos: 'NOUN', meaning: 'The state of being unwilling or unable to believe something', cefr: 'C1', ipa: '/ˌɪnkrəˈdjuːləti/', example: 'She shook her head in utter incredulity.' },
      { word: 'superlative', pos: 'ADJ', meaning: 'Of the highest quality or degree', cefr: 'B2', ipa: '/suːˈpɜːlətɪv/', example: 'The performance received superlative praise from the critics.' },
    ],
    stylisticDevices: [
      { device: 'Antithetical Anaphora', exampleFromText: 'it was the age of wisdom, it was the age of foolishness', explanation: 'Repeated grammatical frame filled with polar opposite concepts.' },
    ],
  },
];
