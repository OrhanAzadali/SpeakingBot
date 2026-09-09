// miniapp/src/utils/uiTranslations.js
// Multi-language UI Translation System:
// 1. AI-Powered dynamic translation capability with caching
// 2. Comprehensive static native fallbacks for zero downtime (EN, RU, AZ, TR, ES, DE, FR, AR, ZH, JA)
// 3. Script direction metadata (RTL for Arabic/Hebrew)

export const SUPPORTED_UI_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ru", name: "Русский", flag: "🇷🇺", dir: "ltr" },
  { code: "az", name: "Azərbaycan", flag: "🇦🇿", dir: "ltr" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "es", name: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "de", name: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "fr", name: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "ar", name: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "zh", name: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ja", name: "日本語", flag: "🇯🇵", dir: "ltr" }
];

export const STATIC_UI_DICTIONARY = {
  en: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI Language Coach & Interactive Study Hub",
    theme: "Theme",
    shiftColors: "Shift Hue",
    uiLanguage: "UI Language",
    learningLanguage: "Target Language",
    supportLanguage: "Support Language",
    level: "Level",
    backToHub: "Back to Hub",
    tabGames: "Practice & Games",
    tabGrammar: "Grammar Notebook",
    tabRoadmap: "Study Roadmap",
    cubeGameTitle: "3D Word Explorer",
    cubeGameDesc: "Interactive 3D vocabulary matching and spatial memory game with high score tracking.",
    play3D: "Launch 3D Game",
    highScore: "High Score",
    flashcardsTitle: "Smart Flashcards",
    flashcardsDesc: "Spaced-repetition flashcards with phonetics, grammar rules, and audio playback.",
    startPractice: "Start Practice",
    quizTitle: "Proficiency Quiz",
    quizDesc: "Rapid-fire 4-option linguistic challenge to test vocabulary retention.",
    takeQuiz: "Take Quiz",
    listeningTitle: "Audio Listening",
    listeningDesc: "Interactive ear training: listen to native pronunciation and pick the matching phrase.",
    listenNow: "Listen Now",
    matchTitle: "Tile Match Challenge",
    matchDesc: "Fast-paced semantic pairing game matching words with their translations.",
    matchTiles: "Match Tiles",
    speakingTitle: "Speech Practice",
    speakingDesc: "Voice-recognition speech coach to refine your accent and sentence flow.",
    practiceSpeech: "Practice Speech",
    grammarTitle: "Linguistic Blueprint",
    grammarDesc: "Curated grammatical rules, morphological patterns, and downloadable PDF books.",
    openBook: "Open Book",
    roadmapTitle: "7-Day Regimen",
    roadmapDesc: "AI-structured CEFR trajectory, diagnostic milestones, and study schedule.",
    viewRoadmap: "View Roadmap",
    downloadPdf: "Download PDF",
    sendToTelegram: "Send to Telegram",
    generating: "Generating...",
    saveWord: "Save Word",
    round: "Round",
    completed: "Completed!",
    score: "Score",
    streak: "Streak",
    correct: "Correct",
    incorrect: "Incorrect",
    searchPlaceholder: "Search words or rules...",
    noCardsNotice: "No flashcards saved yet. Practice with starter pack or chat with bot!"
  },
  ru: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI Языковой Коуч и Интерактивный Центр Обучения",
    theme: "Тема",
    shiftColors: "Сдвиг оттенка",
    uiLanguage: "Язык интерфейса",
    learningLanguage: "Изучаемый язык",
    supportLanguage: "Язык подсказок",
    level: "Уровень",
    backToHub: "В главное меню",
    tabGames: "Игры и Тренировки",
    tabGrammar: "Книга Грамматики",
    tabRoadmap: "План Обучения",
    cubeGameTitle: "3D Кубические Слова",
    cubeGameDesc: "Интерактивная 3D игра на сопоставление слов и пространственную память с рекордами.",
    play3D: "Запустить 3D Игру",
    highScore: "Рекорд",
    flashcardsTitle: "Умные Карточки",
    flashcardsDesc: "Интервальное повторение с транскрипцией, правилами и озвучкой слов.",
    startPractice: "Начать практику",
    quizTitle: "Быстрый Квиз",
    quizDesc: "Динамичный тест из 4 вариантов для проверки словарного запаса.",
    takeQuiz: "Пройти квиз",
    listeningTitle: "Аудирование",
    listeningDesc: "Тренировка слуха: слушайте произношение носителя и выбирайте правильный вариант.",
    listenNow: "Слушать сейчас",
    matchTitle: "Сопоставление Плиток",
    matchDesc: "Скоростная игра на соединение слов с правильными переводами.",
    matchTiles: "Соединять плитки",
    speakingTitle: "Разговорная Речь",
    speakingDesc: "Голосовой тренажер для оттачивания произношения и беглости речи.",
    practiceSpeech: "Тренировать речь",
    grammarTitle: "База Грамматики",
    grammarDesc: "Грамматические правила, морфология и скачиваемые PDF учебники.",
    openBook: "Открыть книгу",
    roadmapTitle: "План на 7 Дней",
    roadmapDesc: "Структурированная траектория CEFR, контрольные точки и расписание.",
    viewRoadmap: "Открыть план",
    downloadPdf: "Скачать PDF",
    sendToTelegram: "Отправить в Telegram",
    generating: "Генерация...",
    saveWord: "Сохранить слово",
    round: "Раунд",
    completed: "Завершено!",
    score: "Счет",
    streak: "Серия",
    correct: "Верно",
    incorrect: "Ошибка",
    searchPlaceholder: "Поиск слов или правил...",
    noCardsNotice: "Пока нет сохраненных карточек. Используйте стартовый набор или общайтесь с ботом!"
  },
  az: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI Dil Təlimçisi və İnteraktiv Öyrənmə Mərkəzi",
    theme: "Mövzu",
    shiftColors: "Rəngləri dəyiş",
    uiLanguage: "İnterfeys Dili",
    learningLanguage: "Öyrənilən Dil",
    supportLanguage: "Köməkçi Dil",
    level: "Səviyyə",
    backToHub: "Əsas Menyua",
    tabGames: "Oyunlar və Təcrübə",
    tabGrammar: "Qrammatika Kitabı",
    tabRoadmap: "Tədris Planı",
    cubeGameTitle: "3D Kub Sözlər",
    cubeGameDesc: "Məkan yaddaşı və söz uyğunlaşdırması üçün interaktiv 3D oyun.",
    play3D: "3D Oyunu Başlat",
    highScore: "Rekord",
    flashcardsTitle: "Ağıllı Kartlar",
    flashcardsDesc: "Transkripsiya, qrammatika qaydaları və səsli təkrar sistemi.",
    startPractice: "Məşqə Başla",
    quizTitle: "Sürətli Test",
    quizDesc: "Söz ehtiyatını yoxlamaq üçün 4 variantlı interaktiv test.",
    takeQuiz: "Testə Başla",
    listeningTitle: "Dinləmə Təlimi",
    listeningDesc: "Qulaq asın və düzgün tələffüzü tapın.",
    listenNow: "İndi Dinlə",
    matchTitle: "Plitələri Uyğunlaşdır",
    matchDesc: "Sözləri tərcümələri ilə cütləşdirin.",
    matchTiles: "Plitələri Birləşdir",
    speakingTitle: "Danışıq Məşqi",
    speakingDesc: "Tələffüz və danışıq axıcılığını gücləndirən səsli təlimçi.",
    practiceSpeech: "Danışığı Məşq Et",
    grammarTitle: "Qrammatika Bazası",
    grammarDesc: "Strukturlaşdırılmış qaydalar və yüklənə bilən PDF kitabçalar.",
    openBook: "Kitabı Aç",
    roadmapTitle: "7 Günlük Yol Xəritəsi",
    roadmapDesc: "CEFR hədəfləri və gündəlik tədris rejimi.",
    viewRoadmap: "Planı Göstər",
    downloadPdf: "PDF Yüklə",
    sendToTelegram: "Teleqrama Göndər",
    generating: "Hazırlanır...",
    saveWord: "Sözü Saxla",
    round: "Raund",
    completed: "Tamamlandı!",
    score: "Hesab",
    streak: "Ardıcıllıq",
    correct: "Düzgün",
    incorrect: "Səhv",
    searchPlaceholder: "Söz və ya qayda axtar...",
    noCardsNotice: "Hələlik yadda saxlanılmış kart yoxdur. İlkin dəstdən istifadə edin!"
  },
  tr: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI Dil Koçu ve İnteraktif Çalışma Merkezi",
    theme: "Tema",
    shiftColors: "Ton Değiştir",
    uiLanguage: "Arayüz Dili",
    learningLanguage: "Hedef Dil",
    supportLanguage: "Açıklama Dili",
    level: "Seviye",
    backToHub: "Ana Menüye Dön",
    tabGames: "Oyunlar ve Pratik",
    tabGrammar: "Gramer Notları",
    tabRoadmap: "Çalışma Planı",
    cubeGameTitle: "3D Kelime Küpleri",
    cubeGameDesc: "Kelime eşleştirme ve uzamsal hafıza için interaktif 3D oyun.",
    play3D: "3D Oyunu Başlat",
    highScore: "En Yüksek Skor",
    flashcardsTitle: "Akıllı Kartlar",
    flashcardsDesc: "Fonetik, dilbilgisi kuralları ve sesli telaffuzla aralıklı tekrar.",
    startPractice: "Pratiğe Başla",
    quizTitle: "Kelime Testi",
    quizDesc: "Kelime bilginizi sınayan 4 seçenekli hızlı sınav.",
    takeQuiz: "Teste Başla",
    listeningTitle: "Dinleme Alıştırması",
    listeningDesc: "Ana dili konuşanları dinleyin ve doğru ifadeyi eşleştirin.",
    listenNow: "Şimdi Dinle",
    matchTitle: "Kart Eşleştirme",
    matchDesc: "Kelimeleri Türkçe karşılıklarıyla hızla birleştirin.",
    matchTiles: "Eşleştir",
    speakingTitle: "Konuşma Pratiği",
    speakingDesc: "Telaffuz ve akıcılığınızı geliştirmek için sesli koç.",
    practiceSpeech: "Konuşmayı Başlat",
    grammarTitle: "Gramer Rehberi",
    grammarDesc: "Kapsamlı dil kuralları ve indirilebilir PDF kitapları.",
    openBook: "Rehberi Aç",
    roadmapTitle: "7 Günlük Plan",
    roadmapDesc: "CEFR standartlarına göre haftalık çalışma çizelgesi.",
    viewRoadmap: "Planı Gör",
    downloadPdf: "PDF İndir",
    sendToTelegram: "Telegram'a Gönder",
    generating: "Oluşturuluyor...",
    saveWord: "Kelimeyi Kaydet",
    round: "Tur",
    completed: "Tamamlandı!",
    score: "Puan",
    streak: "Seri",
    correct: "Doğru",
    incorrect: "Yanlış",
    searchPlaceholder: "Kelime veya kural ara...",
    noCardsNotice: "Henüz kayıtlı kartınız yok. Başlangıç setiyle hemen başlayın!"
  },
  es: {
    appTitle: "SpeakingBot",
    appSubtitle: "Entrenador de Idiomas con IA y Centro de Aprendizaje",
    theme: "Tema",
    shiftColors: "Cambiar tono",
    uiLanguage: "Idioma de la interfaz",
    learningLanguage: "Idioma objetivo",
    supportLanguage: "Idioma de apoyo",
    level: "Nivel",
    backToHub: "Volver al inicio",
    tabGames: "Juegos y Práctica",
    tabGrammar: "Libro de Gramática",
    tabRoadmap: "Plan de Estudio",
    cubeGameTitle: "3D Cubo de Palabras",
    cubeGameDesc: "Juego 3D interactivo de memoria espacial y vocabulario.",
    play3D: "Iniciar Juego 3D",
    highScore: "Récord",
    flashcardsTitle: "Tarjetas Inteligentes",
    flashcardsDesc: "Repetición espaciada con transcripción fonética y audio.",
    startPractice: "Comenzar",
    quizTitle: "Cuestionario Rápido",
    quizDesc: "Desafío de 4 opciones para afianzar el vocabulario.",
    takeQuiz: "Tomar Prueba",
    listeningTitle: "Comprensión Auditiva",
    listeningDesc: "Escucha la pronunciación nativa y selecciona la frase.",
    listenNow: "Escuchar",
    matchTitle: "Emparejar Fichas",
    matchDesc: "Empareja palabras con su traducción correspondiente.",
    matchTiles: "Emparejar",
    speakingTitle: "Práctica Oral",
    speakingDesc: "Entrenador por voz para perfeccionar tu pronunciación.",
    practiceSpeech: "Hablar Ahora",
    grammarTitle: "Guía Gramatical",
    grammarDesc: "Reglas lingüísticas y libros PDF descargables.",
    openBook: "Abrir Guía",
    roadmapTitle: "Plan de 7 Días",
    roadmapDesc: "Trayectoria según el marco CEFR y metas semanales.",
    viewRoadmap: "Ver Plan",
    downloadPdf: "Descargar PDF",
    sendToTelegram: "Enviar a Telegram",
    generating: "Generando...",
    saveWord: "Guardar palabra",
    round: "Ronda",
    completed: "¡Completado!",
    score: "Puntuación",
    streak: "Racha",
    correct: "Correcto",
    incorrect: "Incorrecto",
    searchPlaceholder: "Buscar palabras o reglas...",
    noCardsNotice: "Aún no hay tarjetas guardadas. ¡Comienza con el paquete inicial!"
  },
  de: {
    appTitle: "SpeakingBot",
    appSubtitle: "KI-Sprachcoach & Interaktives Lernzentrum",
    theme: "Design",
    shiftColors: "Farbton anpassen",
    uiLanguage: "Benutzeroberfläche",
    learningLanguage: "Zielsprache",
    supportLanguage: "Hilfssprache",
    level: "Niveau",
    backToHub: "Zurück zur Übersicht",
    tabGames: "Spiele & Übungen",
    tabGrammar: "Grammatikbuch",
    tabRoadmap: "Lernplan",
    cubeGameTitle: "3D Wort-Würfel",
    cubeGameDesc: "Interaktives 3D-Vokabelspiel mit räumlichem Gedächtnistraining.",
    play3D: "3D-Spiel starten",
    highScore: "Rekord",
    flashcardsTitle: "Smarte Karteikarten",
    flashcardsDesc: "Spaced Repetition mit Phonetik, Regeln und Sprachausgabe.",
    startPractice: "Jetzt Üben",
    quizTitle: "Wortschatz-Quiz",
    quizDesc: "Schnelltest mit 4 Optionen zur Festigung des Wortschatzes.",
    takeQuiz: "Quiz starten",
    listeningTitle: "Hörverständnis",
    listeningDesc: "Muttersprachliche Aussprache hören und zuordnen.",
    listenNow: "Jetzt Anhören",
    matchTitle: "Wort-Paare finden",
    matchDesc: "Ordne Vokabeln blitzschnell den Übersetzungen zu.",
    matchTiles: "Paare finden",
    speakingTitle: "Sprechtraining",
    speakingDesc: "Sprachtrainer zur Verfeinerung von Akzent und Satzbau.",
    practiceSpeech: "Sprechen Üben",
    grammarTitle: "Grammatik-Referenz",
    grammarDesc: "Strukturierte Regeln und herunterladbare PDF-Bücher.",
    openBook: "Buch öffnen",
    roadmapTitle: "7-Tage-Lernplan",
    roadmapDesc: "CEFR-konforme Lernschritte und Wochenübersicht.",
    viewRoadmap: "Plan ansehen",
    downloadPdf: "PDF herunterladen",
    sendToTelegram: "An Telegram senden",
    generating: "Wird erstellt...",
    saveWord: "Wort speichern",
    round: "Runde",
    completed: "Abgeschlossen!",
    score: "Punkte",
    streak: "Serie",
    correct: "Richtig",
    incorrect: "Falsch",
    searchPlaceholder: "Wörter oder Regeln suchen...",
    noCardsNotice: "Noch keine Karten gespeichert. Starte direkt mit dem Starterpaket!"
  },
  fr: {
    appTitle: "SpeakingBot",
    appSubtitle: "Coach Linguistique IA & Centre d'Apprentissage",
    theme: "Thème",
    shiftColors: "Nuance",
    uiLanguage: "Langue de l'interface",
    learningLanguage: "Langue cible",
    supportLanguage: "Langue d'aide",
    level: "Niveau",
    backToHub: "Retour au menu",
    tabGames: "Jeux & Pratique",
    tabGrammar: "Manuel de Grammaire",
    tabRoadmap: "Plan d'Étude",
    cubeGameTitle: "Cube 3D de Mots",
    cubeGameDesc: "Jeu 3D interactif de mémorisation spatiale et de vocabulaire.",
    play3D: "Lancer le Jeu 3D",
    highScore: "Record",
    flashcardsTitle: "Cartes Mémoire",
    flashcardsDesc: "Répétition espacée avec phonétique, règles et audio.",
    startPractice: "Pratiquer",
    quizTitle: "Quiz Rapide",
    quizDesc: "Défi à 4 choix pour tester la rétention du vocabulaire.",
    takeQuiz: "Commencer le Quiz",
    listeningTitle: "Entraînement Audio",
    listeningDesc: "Écoutez la prononciation et trouvez la bonne réponse.",
    listenNow: "Écouter",
    matchTitle: "Association de Cartes",
    matchDesc: "Associez rapidement les mots à leurs traductions.",
    matchTiles: "Associer",
    speakingTitle: "Pratique Orale",
    speakingDesc: "Coach vocal pour parfaire votre accent et fluidité.",
    practiceSpeech: "Parler",
    grammarTitle: "Règles de Grammaire",
    grammarDesc: "Guide grammatical complet et livres PDF téléchargeables.",
    openBook: "Ouvrir le Manuel",
    roadmapTitle: "Programme sur 7 Jours",
    roadmapDesc: "Trajectoire CEFR et calendrier hebdomadaire structuré.",
    viewRoadmap: "Voir le Plan",
    downloadPdf: "Télécharger le PDF",
    sendToTelegram: "Envoyer sur Telegram",
    generating: "Génération...",
    saveWord: "Enregistrer le mot",
    round: "Manche",
    completed: "Terminé !",
    score: "Score",
    streak: "Série",
    correct: "Correct",
    incorrect: "Incorrect",
    searchPlaceholder: "Rechercher des mots ou des règles...",
    noCardsNotice: "Aucune carte enregistrée. Commencez avec le pack initial !"
  },
  ar: {
    appTitle: "SpeakingBot",
    appSubtitle: "مدرب اللغة بالذكاء الاصطناعي ومركز التعلم التفاعلي",
    theme: "المظهر",
    shiftColors: "تبديل الألوان",
    uiLanguage: "لغة الواجهة",
    learningLanguage: "اللغة المستهدفة",
    supportLanguage: "لغة المساعدة",
    level: "المستوى",
    backToHub: "العودة للرئيسية",
    tabGames: "الألعاب والتدريب",
    tabGrammar: "كتاب القواعد",
    tabRoadmap: "خطة التعلم",
    cubeGameTitle: "مكعب الكلمات ثلاثي الأبعاد",
    cubeGameDesc: "لعبة ثلاثية الأبعاد تفاعلية لمطابقة الكلمات وتقوية الذاكرة المكانية.",
    play3D: "بدء اللعبة ثلاثية الأبعاد",
    highScore: "أعلى نتيجة",
    flashcardsTitle: "البطاقات الذكية",
    flashcardsDesc: "تكرار متباعد مع نطق صوتي وقواعد نحوية مبسطة.",
    startPractice: "بدء التدريب",
    quizTitle: "اختبار سريع",
    quizDesc: "تحدٍ سريع من 4 خيارات لاختبار حفظ الكلمات.",
    takeQuiz: "بدء الاختبار",
    listeningTitle: "الاستماع الصوتي",
    listeningDesc: "تدريب الأذن: استمع لنطق الناطق الأصلي واختر العبارة.",
    listenNow: "استمع الآن",
    matchTitle: "مطابقة البطاقات",
    matchDesc: "طابق الكلمات مع ترجمتها الصحيحة بسرعة.",
    matchTiles: "مطابقة",
    speakingTitle: "ممارسة التحدث",
    speakingDesc: "مدرب صوتي ذكي لتحسين النطق وطلاقة اللسان.",
    practiceSpeech: "تحدث الآن",
    grammarTitle: "دليل القواعد",
    grammarDesc: "قواعد لغوية شاملة وكتب بصيغة PDF قابلة للتحميل.",
    openBook: "فتح الكتاب",
    roadmapTitle: "خطة 7 أيام",
    roadmapDesc: "مسار تعليمي وفق معايير CEFR وجدول أسبوعي منظم.",
    viewRoadmap: "عرض الخطة",
    downloadPdf: "تحميل PDF",
    sendToTelegram: "إرسال إلى تيليجرام",
    generating: "جاري الإنشاء...",
    saveWord: "حفظ الكلمة",
    round: "الجولة",
    completed: "تم الإنجاز!",
    score: "النقاط",
    streak: "السلسلة",
    correct: "صحيح",
    incorrect: "خطأ",
    searchPlaceholder: "ابحث عن كلمات أو قواعد...",
    noCardsNotice: "لا توجد بطاقات محفوظة حتى الآن. ابدأ بالمجموعة الأساسية!"
  },
  zh: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI 语言教练与多感官互动学习中心",
    theme: "界面主题",
    shiftColors: "微调色调",
    uiLanguage: "界面语言",
    learningLanguage: "学习目标语言",
    supportLanguage: "辅助解释语言",
    level: "语言级别",
    backToHub: "返回主中心",
    tabGames: "练习与游戏",
    tabGrammar: "语法笔记本",
    tabRoadmap: "学习路线图",
    cubeGameTitle: "3D 词汇探索魔方",
    cubeGameDesc: "空间记忆与单词配对互动3D游戏，支持最高分记录。",
    play3D: "进入3D游戏",
    highScore: "最高记录",
    flashcardsTitle: "智能记忆卡",
    flashcardsDesc: "间隔重复算法、音标发音、语法解析与原生朗读。",
    startPractice: "开始背诵",
    quizTitle: "极速词汇测试",
    quizDesc: "4选1快速辨识挑战，强化词汇即时记忆能力。",
    takeQuiz: "开始测验",
    listeningTitle: "听力训练营",
    listeningDesc: "母语级原声聆听，锻炼语感并识别正确表达。",
    listenNow: "立即收听",
    matchTitle: "卡片极速配对",
    matchDesc: "将目标词汇与对应的释义快速连线匹配。",
    matchTiles: "开始配对",
    speakingTitle: "口语跟读评测",
    speakingDesc: "智能语音识别发音打分，纠正腔调提高流利度。",
    practiceSpeech: "开始口语练习",
    grammarTitle: "语法知识宝典",
    grammarDesc: "系统化语法句型解析与可直接下载的PDF参考书。",
    openBook: "阅读宝典",
    roadmapTitle: "7天学习规划",
    roadmapDesc: "基于CEFR阶梯的阶段目标与每日练习时间表。",
    viewRoadmap: "查看规划",
    downloadPdf: "下载 PDF",
    sendToTelegram: "发送至 Telegram",
    generating: "正在智能生成...",
    saveWord: "收藏单词",
    round: "回合",
    completed: "全部完成！",
    score: "得分",
    streak: "连胜",
    correct: "正确",
    incorrect: "错误",
    searchPlaceholder: "搜索词汇或语法规则...",
    noCardsNotice: "目前尚未保存卡片。立即体验精选新手卡包或与Bot对话！"
  },
  ja: {
    appTitle: "SpeakingBot",
    appSubtitle: "AI 言語コーチ＆インタラクティブ学習ハブ",
    theme: "テーマ",
    shiftColors: "色調変更",
    uiLanguage: "UI 言語",
    learningLanguage: "学習言語",
    supportLanguage: "解説言語",
    level: "レベル",
    backToHub: "ハブに戻る",
    tabGames: "ゲーム＆練習",
    tabGrammar: "文法ノート",
    tabRoadmap: "学習ロードマップ",
    cubeGameTitle: "3D ワードキューブ",
    cubeGameDesc: "空間記憶と単語マッチングの3Dインタラクティブゲーム。",
    play3D: "3Dゲーム開始",
    highScore: "ハイスコア",
    flashcardsTitle: "スマート単語帳",
    flashcardsDesc: "間隔反復、発音記号、文法ルール、ネイティブ音声対応。",
    startPractice: "練習を開始",
    quizTitle: "語彙クイズ",
    quizDesc: "4択スピードクイズで単語の定着度を素早くチェック。",
    takeQuiz: "クイズに挑戦",
    listeningTitle: "リスニング特訓",
    listeningDesc: "ネイティブの発音を聞き取り、正しい単語を選びます。",
    listenNow: "今すぐ聴く",
    matchTitle: "タイルマッチ",
    matchDesc: "単語と翻訳を素早くペアにして消去するゲーム。",
    matchTiles: "マッチ開始",
    speakingTitle: "スピーキング練習",
    speakingDesc: "発音と流暢さを向上させる音声対話コーチ。",
    practiceSpeech: "発話練習",
    grammarTitle: "文法マスター",
    grammarDesc: "体系的な文法解説とダウンロード可能なPDFブック。",
    openBook: "ノートを開く",
    roadmapTitle: "7日間学習プラン",
    roadmapDesc: "CEFR基準の達成目標と毎日の学習スケジュール。",
    viewRoadmap: "プランを見る",
    downloadPdf: "PDFを保存",
    sendToTelegram: "Telegramに送信",
    generating: "生成中...",
    saveWord: "単語を保存",
    round: "ラウンド",
    completed: "完了！",
    score: "スコア",
    streak: "連続正解",
    correct: "正解",
    incorrect: "不正解",
    searchPlaceholder: "単語や文法を検索...",
    noCardsNotice: "保存されたカードはまだありません。スターターパックで始めましょう！"
  }
};

/**
 * Retrieves the translation string for a given key.
 * 1. Checks custom/AI-generated dictionary if provided
 * 2. Checks static native dictionary for the selected UI language
 * 3. Falls back to English
 * 4. Falls back to the raw key
 */
export function getUiString(key, lang = "en", customDict = null) {
  const normLang = String(lang || "en").toLowerCase();

  // 1. Custom or AI-generated translations in memory
  if (customDict && customDict[key]) {
    return customDict[key];
  }

  // 2. LocalStorage cached dynamic translations
  try {
    const cachedStr = localStorage.getItem(`spk_ui_dict_${normLang}`);
    if (cachedStr) {
      const cachedObj = JSON.parse(cachedStr);
      if (cachedObj && cachedObj[key]) return cachedObj[key];
    }
  } catch {}

  // 3. Static native dictionary
  const dict = STATIC_UI_DICTIONARY[normLang];
  if (dict && dict[key]) {
    return dict[key];
  }

  // 4. Default to English static dictionary
  if (STATIC_UI_DICTIONARY.en && STATIC_UI_DICTIONARY.en[key]) {
    return STATIC_UI_DICTIONARY.en[key];
  }

  return key;
}

/**
 * Returns a complete UI dictionary object for the specified language code,
 * layered with English fallbacks and local storage overrides.
 */
export function getEffectiveUiDictionary(lang) {
  if (!lang) return STATIC_UI_DICTIONARY.en;
  const normLang = lang.toLowerCase().trim();

  let cachedOverrides = {};
  try {
    const cachedStr = localStorage.getItem(`spk_ui_dict_${normLang}`);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (parsed && typeof parsed === "object") {
        cachedOverrides = parsed;
      }
    }
  } catch {}

  const staticForLang = STATIC_UI_DICTIONARY[normLang] || {};
  return {
    ...STATIC_UI_DICTIONARY.en,
    ...staticForLang,
    ...cachedOverrides,
  };
}

/**
 * Fetches dynamic AI-powered UI translations for any language requested by the user.
 * Falls back to static dictionary on error.
 */
export async function fetchAiUiTranslation(targetLang, backendUrl) {
  if (!targetLang) return STATIC_UI_DICTIONARY.en;
  const normLang = targetLang.toLowerCase().trim();

  // If already in static dictionary, return immediately
  if (STATIC_UI_DICTIONARY[normLang]) {
    return STATIC_UI_DICTIONARY[normLang];
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(`spk_ui_dict_${normLang}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  try {
    const res = await fetch(`${backendUrl}/api/ui/translate?lang=${encodeURIComponent(normLang)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.translations && typeof data.translations === "object") {
        try {
          localStorage.setItem(`spk_ui_dict_${normLang}`, JSON.stringify(data.translations));
        } catch {}
        return data.translations;
      }
    }
  } catch (err) {
    console.warn("AI UI translation request failed, using static fallback:", err.message);
  }

  // Fallback to English
  return STATIC_UI_DICTIONARY.en;
}



// import React, { useState, useEffect } from "react";
// import {
//   BookOpen,
//   FileText,
//   Download,
//   Send,
//   Sparkles,
//   Layers,
//   GraduationCap,
//   Gamepad2,
//   Headphones,
//   Mic,
//   BrainCircuit,
//   Volume2,
//   Trophy,
//   ArrowLeft,
//   CheckCircle2,
//   AlertCircle,
//   RotateCcw,
//   Palette,
//   RefreshCw,
//   Languages,
// } from "lucide-react";

// import GrammarBook from "./components/GrammarBook.jsx";
// import FlashcardDeck from "./components/FlashcardDeck.jsx";
// import Quiz from "./components/Quiz.jsx";
// import ListeningGame from "./components/ListeningGame.jsx";
// import ListeningMatch from "./components/ListeningMatch.jsx";
// import SpeakingGame from "./components/SpeakingGame.jsx";
// import Summary from "./components/Summary.jsx";
// import { CubeWordCard } from "./components/CubicWords/CubeWordCard.jsx";
// import { CubeWordGame } from "./components/CubicWords/CubeWordGame.jsx";
// import { PRESET_THEMES } from "./utils/colorHarmonizer.js";
// import { getSafeThemeRuleset, persistThemeRuleset } from "./utils/themeRulesetCache.js";
// import { getStarterFlashcards, getStarterGrammarTopics, getClientFallbackGameCards } from "./utils/fallbackData.js";
// import { SUPPORTED_UI_LANGUAGES, fetchAiUiTranslation, getEffectiveUiDictionary } from "./utils/uiTranslations.js";

// export default function App() {
//   // Point directly to your Render backend
//   const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://speakingbot.onrender.com";

//   // Dynamic Color Harmonizer State
//   const [themeId, setThemeId] = useState(() => {
//     try {
//       return localStorage.getItem("spk_theme_id") || "golden_ai";
//     } catch {
//       return "golden_ai";
//     }
//   });
//   const [rotationIndex, setRotationIndex] = useState(0);
//   const [autoCycle, setAutoCycle] = useState(true);

//   // Auto-cycle theme colors smoothly from time to time (every 28 seconds)
//   useEffect(() => {
//     if (!autoCycle) return;
//     const interval = setInterval(() => {
//       setRotationIndex((prev) => (prev + 1) % 8);
//     }, 28000);
//     return () => clearInterval(interval);
//   }, [autoCycle]);

//   const activeTheme = getSafeThemeRuleset(themeId, rotationIndex);
//   const themeColors = activeTheme.colors;

//   // Persist theme selection and sync with ruleset cache
//   useEffect(() => {
//     persistThemeRuleset(themeId, rotationIndex, activeTheme);
//   }, [themeId, rotationIndex, activeTheme]);

//   // Navigation state: 'games' | 'grammar' | 'roadmap'
//   const [activeTab, setActiveTab] = useState("games");
//   // Active game mode: null (hub) | 'flashcards' | 'quiz' | 'listening' | 'match' | 'speaking' | 'summary' | 'cubeGame'
//   const [activeGame, setActiveGame] = useState(null);
//   const [mediatorLanguage, setMediatorLanguage] = useState("english");
//   const [userLevel, setUserLevel] = useState("Beginner");

//   // Global AI-Powered UI Language Switcher (dynamic AI with static dictionary fallback)
//   const [uiLanguage, setUiLanguage] = useState(() => {
//     try {
//       return localStorage.getItem("spk_ui_lang") || "en";
//     } catch {
//       return "en";
//     }
//   });
//   const [uiDict, setUiDict] = useState(() => getEffectiveUiDictionary(uiLanguage));

//   // Language the 3D Cube Word game was launched with (picked on the card, before entering the game)
//   const [cubeGameLanguage, setCubeGameLanguage] = useState("english");
//   const [cubeGameHighScore, setCubeGameHighScore] = useState(() => {
//     try {
//       return Number(localStorage.getItem("cubeword_highscore") || "0");
//     } catch {
//       return 0;
//     }
//   });

//   // Harmonize UI translations with AI and static dictionary
//   useEffect(() => {
//     let isCancelled = false;
//     async function syncUiTranslations() {
//       // 1. Instant static dictionary fallback for zero UI delay
//       const staticDict = getEffectiveUiDictionary(uiLanguage);
//       setUiDict(staticDict);

//       // 2. Fetch AI-powered translations for dynamic enrichment
//       try {
//         const aiDict = await fetchAiUiTranslation(uiLanguage, BACKEND_URL);
//         if (!isCancelled && aiDict) {
//           setUiDict((prev) => ({ ...prev, ...aiDict }));
//         }
//       } catch (err) {
//         console.warn("AI UI translation fetch notice:", err);
//       }
//     }

//     syncUiTranslations();
//     try {
//       localStorage.setItem("spk_ui_lang", uiLanguage);
//     } catch {}

//     // Support RTL scripts (e.g. Arabic)
//     const langMeta = SUPPORTED_UI_LANGUAGES.find((l) => l.code === uiLanguage);
//     if (document.documentElement) {
//       document.documentElement.dir = langMeta?.dir || "ltr";
//       document.documentElement.lang = uiLanguage;
//     }

//     return () => {
//       isCancelled = true;
//     };
//   }, [uiLanguage, BACKEND_URL]);

//   const [targetLanguage, setTargetLanguage] = useState("");
//   const [availableLanguages, setAvailableLanguages] = useState([]);
//   const [grammarTopics, setGrammarTopics] = useState([]);
//   const [flashcards, setFlashcards] = useState([]);
//   // Dedicated cards generated live by AI for practice games
//   const [aiGameCards, setAiGameCards] = useState([]);
//   const [loadingAiGame, setLoadingAiGame] = useState(false);
//   // Tracks the progressive round number for AI games
//   const [gameRound, setGameRound] = useState(1);
//   const [sessionStats, setSessionStats] = useState({ remembered: 0, forgot: 0 });

//   // Notifications & Loaders
//   const [toast, setToast] = useState(null);
//   const [actionLoading, setActionLoading] = useState(null);

//   // Extract real Telegram user ID
//   const tgUser = typeof window !== "undefined" ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;
//   const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
//   const urlParamId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null;

//   const effectiveUserId = tgUser?.id ? String(tgUser.id) : (urlParamId || localStorage.getItem("spk_user_id") || "8291613988");


//   const [newWord, setNewWord] = useState("");
//   const [newMeaning, setNewMeaning] = useState("");
//   const [showAddModal, setShowAddModal] = useState(false);

//   // Launched from the CubeWordCard on the games hub: remember the chosen
//   // language, then switch the main view into the 3D game.
//   const startCubeGame = (lang) => {
//     setCubeGameLanguage(lang || "english");
//     setActiveGame("cubeGame");
//   };

//   // Adapts the 3D game's onSaveToVocabulary(word, definition, partOfSpeech)
//   // callback to this app's shared handleSaveWordToDeck(card) saver so words
//   // discovered in the cube game land in the same flashcard deck as every
//   // other game.
//   const handleSaveWordFromCubeGame = async (word, definition, partOfSpeech) => {
//     const ok = await handleSaveWordToDeck({
//       word,
//       correction: definition,
//       meaning: definition,
//       language: cubeGameLanguage,
//       part_of_speech: partOfSpeech || "word",
//     });
//     if (ok) {
//       try {
//         const stored = Number(localStorage.getItem("cubeword_highscore") || "0");
//         setCubeGameHighScore(stored);
//       } catch {
//         // ignore
//       }
//     }
//     return ok;
//   };

//   const handleAddCustomWord = async (e) => {
//     e.preventDefault();
//     if (!newWord.trim() || !newMeaning.trim()) return;

//     try {
//       const res = await fetch(`${BACKEND_URL}/api/vocabulary/add`, {
//         method: "POST",
//         headers: getHeaders(),
//         body: JSON.stringify({
//           userId: effectiveUserId,
//           word: newWord.trim(),
//           meaning: newMeaning.trim(),
//           language: targetLanguage,
//         }),
//       });
//       if (res.ok) {
//         showToast(`✅ «${newWord}» added to your deck!`);
//         setNewWord("");
//         setNewMeaning("");
//         setShowAddModal(false);
//         fetchFlashcards(targetLanguage);
//       }
//     } catch {
//       showToast("Failed to add word", "error");
//     }
//   };
//   // App.jsx — One-tap save for any word encountered in games
//   const handleSaveWordToDeck = async (card) => {
//     if (!card) return;
//     const targetWord = card.initial_form || card.word;
//     const meaning = card.correction || card.meaning;
//     if (!targetWord || !meaning) return;

//     try {
//       const res = await fetch(`${BACKEND_URL}/api/vocabulary/add`, {
//         method: "POST",
//         headers: getHeaders(),
//         body: JSON.stringify({
//           userId: effectiveUserId,
//           word: targetWord,
//           meaning: meaning,
//           language: card.language || targetLanguage,
//           part_of_speech: card.part_of_speech || "word",
//           sentence: card.sentence || card.context || "",
//           transcription: card.transcription || "",
//           pronunciation_rule: card.pronunciation_rule || "",
//           grammar_rule: card.grammar_rule || "",
//         }),
//       });

//       if (res.ok) {
//         showToast(`⭐ «${targetWord}» saved to your permanent deck!`);
//         fetchFlashcards(targetLanguage); // Refresh count
//         return true;
//       }
//     } catch (err) {
//       console.error("Save word error:", err);
//       showToast("Failed to save word", "error");
//     }
//     return false;
//   };
//   useEffect(() => {
//     if (effectiveUserId && effectiveUserId !== "123456789") {
//       localStorage.setItem("spk_user_id", effectiveUserId);
//     }
//   }, [effectiveUserId]);

//   const getHeaders = () => {
//     const headers = {
//       "Content-Type": "application/json",
//       "x-user-id": effectiveUserId,
//     };
//     if (initData) {
//       headers["Authorization"] = `tma ${initData}`;
//     }
//     return headers;
//   };

//   const showToast = (message, type = "success") => {
//     setToast({ message, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // 1. Initial boot: query the user's active database language  
//   useEffect(() => {
//     if (window.Telegram?.WebApp?.ready) {
//       window.Telegram.WebApp.ready();
//       window.Telegram.WebApp.expand?.();
//     }
//     loadUserProfile();
//   }, [effectiveUserId]);

//   const loadUserProfile = async () => {
//     try {
//       const res = await fetch(`${BACKEND_URL}/api/user?userId=${effectiveUserId}`, {
//         headers: getHeaders(),
//       });
//       if (res.ok) {
//         const data = await res.json();
//         const activeLang = data.language || "english";
//         const medLang = data.mediator || "russian";
//         if (data.level) setUserLevel(data.level);
//         setTargetLanguage(activeLang);
//         setMediatorLanguage(medLang);
//         setAvailableLanguages(data.availableLanguages || [activeLang]);
//         fetchFlashcards(activeLang, medLang);
//         fetchGrammarTopics(activeLang);
//         return;
//       }
//     } catch (err) {
//       console.error("User profile load failed:", err);
//     }
//     fetchFlashcards("english", "russian");
//     fetchGrammarTopics("english");
//   };

//   const fetchFlashcards = async (lang = targetLanguage, med = mediatorLanguage) => {
//     try {
//       const qLang = lang ? `&language=${encodeURIComponent(lang)}` : "";
//       const qMed = med ? `&mediator=${encodeURIComponent(med)}` : "";
//       const res = await fetch(`${BACKEND_URL}/api/flashcards?userId=${effectiveUserId}${qLang}${qMed}`, {
//         headers: getHeaders(),
//       });
//       if (res.ok) {
//         const data = await res.json();
//         if (Array.isArray(data.cards) && data.cards.length > 0) {
//           setFlashcards(data.cards);
//           return;
//         }
//       }
//     } catch (err) {
//       console.error("Failed to fetch flashcards, using safe fallback cards:", err);
//     }
//     // Fallback: Safe curated starter cards
//     setFlashcards(getStarterFlashcards(lang, med));
//   };
//   const fetchGrammarTopics = async (lang = targetLanguage) => {
//     try {
//       const activeLang = String(lang || "russian").toLowerCase().trim();
//       const res = await fetch(`${BACKEND_URL}/api/grammar?userId=${effectiveUserId}&language=${encodeURIComponent(activeLang)}`, {
//         headers: getHeaders(),
//       });
//       if (res.ok) {
//         const data = await res.json();
//         if (Array.isArray(data.topics) && data.topics.length > 0) {
//           setGrammarTopics(data.topics);
//           return;
//         }
//       }
//     } catch (err) {
//       console.error("Failed to fetch grammar topics, using safe fallback topics:", err);
//     }
//     setGrammarTopics(getStarterGrammarTopics(lang, mediatorLanguage));
//   };

//   // Safe PDF Download for Web & Telegram MiniApp
//   const triggerDownload = (endpoint, filename) => {
//     const separator = endpoint.includes("?") ? "&" : "?";
//     // 1. Pass filename to the backend so Content-Disposition sets the exact name
//     const downloadUrl = `${BACKEND_URL}${endpoint}${separator}userId=${effectiveUserId}&filename=${encodeURIComponent(filename || "document.pdf")}`;

//     // 2. In Telegram MiniApp, use openLink so native Telegram app opens the link externally
//     if (window.Telegram?.WebApp?.openLink) {
//       window.Telegram.WebApp.openLink(downloadUrl);
//     } else {
//       // 3. In WebApp (Browser), use an <a> tag with explicit download attribute for clean file naming
//       const a = document.createElement("a");
//       a.href = downloadUrl;
//       if (filename) a.download = filename;
//       a.target = "_blank";
//       document.body.appendChild(a);
//       a.click();
//       document.body.removeChild(a);
//     }
//   };

//   const handleDownloadAllGrammarPdf = () => {
//     const activeLang = String(targetLanguage || "russian").toLowerCase().trim();
//     showToast(`Generating Complete Grammar Book PDF (${activeLang.toUpperCase()})...`, "info");
//     triggerDownload(`/api/grammar/pdf?language=${encodeURIComponent(activeLang)}`, `Grammar_Book_${activeLang}.pdf`);
//   };

//   const handleDownloadVocabPdf = () => {
//     showToast("Generating Vocabulary Notebook PDF...", "info");
//     triggerDownload(
//       `/api/vocabulary/pdf?language=${encodeURIComponent(targetLanguage)}&mediator=${encodeURIComponent(mediatorLanguage)}`,
//       `Vocabulary_${targetLanguage}_${mediatorLanguage}.pdf`
//     );
//   };

//   const handleDownloadRoadmapPdf = () => {
//     showToast("Generating Roadmap PDF...", "info");
//     triggerDownload("/api/roadmap/pdf", `Roadmap_${targetLanguage}.pdf`);
//   };

//   // Direct Telegram Chat PDF Delivery
//   const handleSendToTelegram = async (endpoint, payload = {}, key = "tg-send") => {
//     setActionLoading(key);
//     try {
//       const res = await fetch(`${BACKEND_URL}${endpoint}`, {
//         method: "POST",
//         headers: getHeaders(),
//         body: JSON.stringify({ ...payload, userId: effectiveUserId }),
//       });
//       const data = await res.json();
//       if (res.ok) {
//         showToast("✈️ PDF sent directly to your Telegram chat!", "success");
//       } else {
//         showToast(data.error || "Failed to send PDF", "error");
//       }
//     } catch {
//       showToast("Network error connecting to backend server", "error");
//     } finally {
//       setActionLoading(null);
//     }
//   };

//   // Flashcard Deck Result Callback
//   const handleDeckResult = async (cardId, remembered) => {
//     setSessionStats((prev) => ({
//       remembered: prev.remembered + (remembered ? 1 : 0),
//       forgot: prev.forgot + (remembered ? 0 : 1),
//     }));

//     try {
//       await fetch(`${BACKEND_URL}/api/flashcards/${cardId}/review`, {
//         method: "POST",
//         headers: getHeaders(),
//         body: JSON.stringify({ remembered }),
//       });
//     } catch (_) { }

//     setFlashcards((prev) => {
//       const rest = prev.slice(1);
//       if (rest.length === 0) {
//         setActiveGame("summary");
//         return [];
//       }
//       return rest;
//     });
//   };

//   const startAiGame = async (gameType, nextRound = 1) => {
//     setLoadingAiGame(true);
//     setGameRound(nextRound);
//     showToast(`🤖 Level ${targetLanguage.toUpperCase()}: Round ${nextRound} loading...`, "info");

//     try {
//       const res = await fetch(
//         `${BACKEND_URL}/api/games/ai-cards?userId=${effectiveUserId}&round=${nextRound}`,
//         { headers: getHeaders() }
//       );
//       if (res.ok) {
//         const data = await res.json();
//         if (Array.isArray(data.cards) && data.cards.length > 0) {
//           setAiGameCards(data.cards);
//           setActiveGame(gameType);
//           setLoadingAiGame(false);
//           return;
//         }
//       }
//     } catch (e) {
//       console.warn("AI game generation error, using safe fallback cards:", e.message);
//     }

//     const fallbackCards = getClientFallbackGameCards(targetLanguage, nextRound);
//     setAiGameCards(fallbackCards);
//     setActiveGame(gameType);
//     setLoadingAiGame(false);
//   };

//   return (
//     <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
//       {/* Toast Notification */}
//       {toast && (
//         <div
//           className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in ${toast.type === "success"
//             ? "bg-emerald-600 text-white border-emerald-500"
//             : toast.type === "error"
//               ? "bg-rose-600 text-white border-rose-500"
//               : "bg-indigo-600 text-white border-indigo-500"
//             }`}
//         >
//           {toast.type === "success" ? (
//             <CheckCircle2 className="w-4 h-4 shrink-0" />
//           ) : (
//             <AlertCircle className="w-4 h-4 shrink-0" />
//           )}
//           <span>{toast.message}</span>
//         </div>
//       )}

//       {/* Top Header */}
//       <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-3.5 transition-all">
//         <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
//           <div className="flex items-center gap-3">
//             <div
//               style={themeColors.brand?.iconStyle}
//               className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-lg border transition-all duration-500"
//             >
//               <GraduationCap className="w-5 h-5" />
//             </div>
//             <div>
//               <h1 className="font-black text-base sm:text-lg leading-tight text-white flex items-center gap-2">
//                 <span>{uiDict?.appTitle || "Language Immersion Coach"}</span>
//               </h1>
//               <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
//                 <span className="font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-800/80">
//                   Target: {targetLanguage ? targetLanguage.toUpperCase() : "ENGLISH"}
//                 </span>
//                 <span>•</span>
//                 <span>{flashcards.length} {uiDict?.savedWordsCount || "Words Saved"}</span>
//               </div>
//             </div>
//           </div>

//           <div className="flex items-center gap-2">
//             {/* Global AI-Powered UI Language Switcher */}
//             <div className="relative inline-flex items-center">
//               <Languages className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 pointer-events-none" />
//               <select
//                 id="global-ui-language-select"
//                 value={uiLanguage}
//                 onChange={(e) => {
//                   const newLang = e.target.value;
//                   setUiLanguage(newLang);
//                   const selectedMeta = SUPPORTED_UI_LANGUAGES.find((l) => l.code === newLang);
//                   showToast(`UI Language: ${selectedMeta?.name || newLang}`, "info");
//                 }}
//                 className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold rounded-2xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400 transition cursor-pointer appearance-none shadow-sm hover:border-slate-600"
//                 title="AI-Powered UI Language Switcher (with static fallback)"
//               >
//                 {SUPPORTED_UI_LANGUAGES.map((lang) => (
//                   <option key={lang.code} value={lang.code}>
//                     {lang.flag} {lang.name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             {/* Dynamic AI Color Harmonizer Controls */}
//             <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-inner gap-1">
//               <button
//                 type="button"
//                 id="toggle-palette-theme-btn"
//                 onClick={() => {
//                   const currentIndex = PRESET_THEMES.findIndex((t) => t.id === themeId);
//                   const nextTheme = PRESET_THEMES[(currentIndex + 1) % PRESET_THEMES.length];
//                   setThemeId(nextTheme.id);
//                   try {
//                     localStorage.setItem("spk_theme_id", nextTheme.id);
//                   } catch {}
//                   showToast(`Theme: ${nextTheme.name}`, "info");
//                 }}
//                 style={themeColors.brand?.badgeStyle}
//                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-105 shadow-sm cursor-pointer active:scale-95"
//                 title="Cycle AI Harmonic Theme"
//               >
//                 <Palette className="w-3.5 h-3.5" />
//                 <span className="hidden sm:inline">{activeTheme.themeMeta.name}</span>
//               </button>

//               <button
//                 type="button"
//                 id="shift-hue-rotation-btn"
//                 onClick={() => {
//                   setRotationIndex((prev) => prev + 1);
//                   showToast("Palette hue rotated smoothly!", "info");
//                 }}
//                 className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
//                 title="Shift Colors Now"
//               >
//                 <RefreshCw className="w-3.5 h-3.5" />
//               </button>
//             </div>

//             <button
//               onClick={handleDownloadAllGrammarPdf}
//               className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
//               title="Download Complete Grammar Book (PDF)"
//             >
//               <Download className="w-3.5 h-3.5" />
//               <span className="hidden sm:inline">{uiDict?.grammarBookPdf || "Grammar Book (PDF)"}</span>
//             </button>
//           </div>
//         </div>

//         {/* Navigation Tabs (Only visible when not actively inside a game screen) */}
//         {!activeGame && (
//           <div className="max-w-6xl mx-auto mt-3.5 flex border-b border-slate-800/80 gap-6 sm:gap-8">
//             <button
//               onClick={() => setActiveTab("games")}
//               className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "games"
//                 ? "border-cyan-400 text-cyan-300"
//                 : "border-transparent text-slate-400 hover:text-slate-200"
//                 }`}
//             >
//               <Gamepad2 className="w-4 h-4" />
//               <span>{uiDict?.tabGames || "Practice Games & Drills"}</span>
//             </button>

//             <button
//               onClick={() => setActiveTab("grammar")}
//               className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "grammar"
//                 ? "border-violet-400 text-violet-300"
//                 : "border-transparent text-slate-400 hover:text-slate-200"
//                 }`}
//             >
//               <BookOpen className="w-4 h-4" />
//               <span>{uiDict?.tabGrammar || "Grammar Book & Rules"}</span>
//               <span className="text-[10px] bg-violet-950 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full font-black">
//                 {grammarTopics.length}
//               </span>
//             </button>

//             <button
//               onClick={() => setActiveTab("roadmap")}
//               className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "roadmap"
//                 ? "border-amber-400 text-amber-300"
//                 : "border-transparent text-slate-400 hover:text-slate-200"
//                 }`}
//             >
//               <FileText className="w-4 h-4" />
//               <span>{uiDict?.tabRoadmap || "Learning Roadmap"}</span>
//             </button>
//           </div>
//         )}
//       </header>

//       {/* Main Container */}
//       <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start">
//         {/* ========================================================================= */}
//         {/* ACTIVE GAME SCREENS                                                       */}
//         {/* ========================================================================= */}
//         {activeGame === "flashcards" && (
//           <div className="flex flex-col items-center justify-center flex-1 py-4">
//             <button
//               onClick={() => setActiveGame(null)}
//               className="self-start mb-4 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
//             >
//               <ArrowLeft className="w-4 h-4" /> Back to Game Hub
//             </button>
//             <FlashcardDeck
//               cards={flashcards.length > 0 ? flashcards : getStarterFlashcards(targetLanguage, mediatorLanguage)}
//               onResult={handleDeckResult}
//             />
//           </div>
//         )}

//         {activeGame === "quiz" && (
//           <Quiz
//             cards={flashcards.length > 0 ? flashcards : getStarterFlashcards(targetLanguage, mediatorLanguage)}
//             API={BACKEND_URL}
//             authHeaders={getHeaders()}
//             onExit={() => setActiveGame(null)}
//             onSaveWord={handleSaveWordToDeck}
//           />
//         )}

//         {activeGame === "listening" && (
//           <ListeningGame
//             cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
//             API={BACKEND_URL}
//             authHeaders={getHeaders()}
//             round={gameRound}
//             onNextRound={() => startAiGame("listening", gameRound + 1)}
//             onExit={() => {
//               setActiveGame(null);
//               setAiGameCards([]);
//               setGameRound(1);
//             }}
//             onSaveWord={handleSaveWordToDeck}
//           />
//         )}

//         {activeGame === "match" && (
//           <ListeningMatch
//             cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
//             API={BACKEND_URL}
//             authHeaders={getHeaders()}
//             round={gameRound}
//             onNextRound={() => startAiGame("match", gameRound + 1)}
//             onExit={() => {
//               setActiveGame(null);
//               setAiGameCards([]);
//               setGameRound(1);
//             }}
//             onSaveWord={handleSaveWordToDeck}
//           />
//         )}

//         {activeGame === "speaking" && (
//           <SpeakingGame
//             cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
//             API={BACKEND_URL}
//             authHeaders={getHeaders()}
//             round={gameRound}
//             onNextRound={() => startAiGame("speaking", gameRound + 1)}
//             onExit={() => {
//               setActiveGame(null);
//               setAiGameCards([]);
//               setGameRound(1);
//             }}
//             onSaveWord={handleSaveWordToDeck}
//           />
//         )}

//         {activeGame === "summary" && (
//           <Summary
//             stats={sessionStats}
//             total={sessionStats.remembered + sessionStats.forgot}
//             onExit={() => {
//               setActiveGame(null);
//               fetchFlashcards();
//             }}
//           />
//         )}

//         {activeGame === "cubeGame" && (
//           <CubeWordGame
//             onClose={() => {
//               // Pick up whatever high score the game just wrote to
//               // localStorage so the hub card reflects it immediately.
//               try {
//                 setCubeGameHighScore(Number(localStorage.getItem("cubeword_highscore") || "0"));
//               } catch {
//                 // ignore
//               }
//               setActiveGame(null);
//             }}
//             targetLanguage={targetLanguage || cubeGameLanguage || "english"}
//             mediatorLanguage={mediatorLanguage || "english"}
//             userLevel={userLevel || "Beginner"}
//             apiBase={BACKEND_URL}
//             onSaveToVocabulary={handleSaveWordFromCubeGame}
//           />
//         )}


//         {/* ========================================================================= */}
//         {/* TAB 1: PRACTICE GAMES & INTERACTIVE DRILLS HUB                            */}
//         {/* ========================================================================= */}
//         {!activeGame && activeTab === "games" && (
//           <div className="space-y-6">
//             {/* Action Card Banner */}
//             <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
//               <div className="relative z-10">
//                 <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2.5">
//                   <Sparkles className="w-3 h-3 text-indigo-400" />
//                   <span>Spaced Repetition & Audio Immersion</span>
//                 </div>
//                 <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
//                   {uiDict?.practiceHubTitle || "Interactive Practice Hub"}
//                 </h2>
//                 <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
//                   {uiDict?.practiceHubDesc || "Train your vocabulary, active recall, listening comprehension, and pronunciation with adaptive AI micro-drills."}
//                 </p>

//                 <div className="flex flex-wrap gap-2.5 mt-4">
//                   <button
//                     onClick={handleDownloadVocabPdf}
//                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
//                   >
//                     <Download className="w-3.5 h-3.5 text-indigo-400" />
//                     <span>{uiDict?.downloadVocabPdf || "Download Vocab PDF"}</span>
//                   </button>
//                   <button
//                     onClick={() => handleSendToTelegram("/api/vocabulary/send-pdf", {}, "tg-vocab")}
//                     disabled={actionLoading === "tg-vocab"}
//                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
//                   >
//                     <Send className="w-3.5 h-3.5" />
//                     <span>{actionLoading === "tg-vocab" ? (uiDict?.loading || "Sending...") : (uiDict?.sendVocabTg || "Send Vocab to TG")}</span>
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => setShowAddModal(true)}
//                     className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
//                   >
//                     <span>{uiDict?.addCustomWord || "➕ Add Custom Word"}</span>
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* 0. 3D Cube Word Game (full-width feature card) */}
//             <CubeWordCard
//               onLaunchGame={() => startCubeGame(targetLanguage || cubeGameLanguage || "english")}
//               highScore={cubeGameHighScore}
//               targetLanguage={targetLanguage || cubeGameLanguage || "english"}
//               palette={themeColors.cubeCard}
//               uiDict={uiDict}
//             />

//             {/* 6 Game Mode Cards with Expanded Dimensions & Dynamic Color Harmonizer */}
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
//               {/* 1. Spaced Repetition Flashcards */}
//               <div
//                 id="card-flashcards-deck"
//                 style={themeColors.flashcards?.style}
//                 onClick={() => {
//                   if (flashcards.length > 0) setActiveGame("flashcards");
//                   else showToast("No flashcards saved yet! Chat with bot first.", "error");
//                 }}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.flashcards?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <Layers className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-cyan-200 transition-colors">
//                     {uiDict?.flashcardsTitle || "Vocabulary Flashcards"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.flashcardsDesc || "Spaced repetition deck with base lemmas, phonetics, rules, and example sentences."}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">{flashcards.length} {uiDict?.savedWordsCount || "cards saved"}</span>
//                   <span style={{ color: themeColors.flashcards?.hex || '#a855f7' }}>{uiDict?.startPractice || "Start Practice →"}</span>
//                 </div>
//               </div>

//               {/* 2. Vocabulary Quiz */}
//               <div
//                 id="card-smart-quiz"
//                 style={themeColors.quiz?.style}
//                 onClick={() => {
//                   if (flashcards.length > 0) setActiveGame("quiz");
//                   else showToast("Save at least 1 word before playing Quiz!", "error");
//                 }}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.quiz?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <BrainCircuit className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-emerald-200 transition-colors">
//                     {uiDict?.quizTitle || "Smart Recall Quiz"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.quizDesc || "Test your memory with multiple choice or text entry. Graded dynamically with synonyms accepted!"}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">Adaptive grading</span>
//                   <span style={{ color: themeColors.quiz?.hex || '#10b981' }}>{uiDict?.takeQuiz || "Take Quiz →"}</span>
//                 </div>
//               </div>

//               {/* 3. Listening Quiz */}
//               <div
//                 id="card-listening-game"
//                 style={themeColors.listening?.style}
//                 onClick={() => {
//                   if (!loadingAiGame) startAiGame("listening");
//                 }}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.listening?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <Headphones className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-sky-200 transition-colors">
//                     {uiDict?.listeningTitle || "Listening Comprehension"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.listeningDesc || "Audio-only challenge: listen to the native pronunciation, then type or choose the meaning."}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">Ear training</span>
//                   <span style={{ color: themeColors.listening?.hex || '#38bdf8' }}>{uiDict?.listenNow || "Listen Now →"}</span>
//                 </div>
//               </div>

//               {/* 4. Sound Match */}
//               <div
//                 id="card-sound-match"
//                 style={themeColors.match?.style}
//                 onClick={() => {
//                   if (!loadingAiGame) startAiGame("match");
//                 }}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.match?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <Volume2 className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-amber-200 transition-colors">
//                     {uiDict?.matchTitle || "Sound Match"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.matchDesc || "Fast-paced audio memory game: match the spoken sound tile with its written translation."}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">Combo bonuses</span>
//                   <span style={{ color: themeColors.match?.hex || '#f59e0b' }}>{uiDict?.matchTiles || "Match Tiles →"}</span>
//                 </div>
//               </div>

//               {/* 5. Speaking Drill */}
//               <div
//                 id="card-speaking-drill"
//                 style={themeColors.speaking?.style}
//                 onClick={() => {
//                   if (!loadingAiGame) startAiGame("speaking");
//                 }}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.speaking?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <Mic className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-rose-200 transition-colors">
//                     {uiDict?.speakingTitle || "Pronunciation & Speech"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.speakingDesc || "Speak words into your microphone. Real-time accuracy scoring and phonetic feedback!"}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">Microphone drill</span>
//                   <span style={{ color: themeColors.speaking?.hex || '#f43f5e' }}>{uiDict?.practiceSpeech || "Practice Speech →"}</span>
//                 </div>
//               </div>

//               {/* 6. Grammar Reference Book Tile */}
//               <div
//                 id="card-grammar-book"
//                 style={themeColors.grammar?.style}
//                 onClick={() => setActiveTab("grammar")}
//                 className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
//               >
//                 <div>
//                   <div
//                     style={themeColors.grammar?.iconStyle}
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
//                   >
//                     <BookOpen className="w-6 h-6" />
//                   </div>
//                   <h3 className="font-black text-base sm:text-lg text-white group-hover:text-violet-200 transition-colors">
//                     {uiDict?.grammarTitle || "Grammar Book & Rules"}
//                   </h3>
//                   <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
//                     {uiDict?.grammarDesc || "View saved grammar rules, verb conjugation tables, and download publication-ready PDFs."}
//                   </p>
//                 </div>
//                 <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
//                   <span className="text-slate-400">{grammarTopics.length} saved rules</span>
//                   <span style={{ color: themeColors.grammar?.hex || '#8b5cf6' }}>{uiDict?.openBook || "Open Book →"}</span>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* ========================================================================= */}
//         {/* TAB 2: GRAMMAR REFERENCE BOOK                                             */}
//         {/* ========================================================================= */}
//         {
//           !activeGame && activeTab === "grammar" && (
//             <GrammarBook
//               API={BACKEND_URL}
//               authHeaders={getHeaders()}
//               effectiveUserId={effectiveUserId}
//               onExit={() => setActiveTab("games")}
//             />
//           )
//         }

//         {/* ========================================================================= */}
//         {/* TAB 3: LEARNING ROADMAP & STUDY PLAN                                    */}
//         {/* ========================================================================= */}
//         {
//           !activeGame && activeTab === "roadmap" && (
//             <div className="space-y-6 max-w-2xl mx-auto w-full">
//               <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
//                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-5">
//                   <div>
//                     <h2 className="font-bold text-lg text-white">Personal Study Roadmap</h2>
//                     <p className="text-xs text-slate-400">Auto-updated by AI every 5 messages based on diagnostic progress</p>
//                   </div>

//                   <div className="flex items-center gap-2">
//                     <button
//                       onClick={handleDownloadRoadmapPdf}
//                       className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
//                     >
//                       <Download className="w-3.5 h-3.5 text-indigo-300" />
//                       <span>Roadmap PDF</span>
//                     </button>
//                     <button
//                       onClick={() => handleSendToTelegram("/api/roadmap/send-pdf", {}, "tg-roadmap")}
//                       disabled={actionLoading === "tg-roadmap"}
//                       className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50"
//                     >
//                       <Send className="w-3.5 h-3.5" />
//                       <span>{actionLoading === "tg-roadmap" ? "Sending..." : "Send to TG"}</span>
//                     </button>
//                   </div>
//                 </div>

//                 <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
//                   <div className="p-4 rounded-xl bg-indigo-950/70 border border-indigo-800/80">
//                     <h4 className="font-bold text-indigo-300 text-sm mb-1">🎯 7-Day Targeted Regimen</h4>
//                     <p className="text-xs text-indigo-200">
//                       Your curriculum balances Listening, Speaking, Reading, and Writing with your personalized Grammar Book.
//                     </p>
//                   </div>

//                   <div className="space-y-2">
//                     <p className="font-semibold text-white">Current Milestones:</p>
//                     <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400 pl-1">
//                       <li>Practice 10 due words in the Vocabulary Deck daily.</li>
//                       <li>Complete at least one Sound Match or Listening drill.</li>
//                       <li>Review your latest Grammar Guide PDF with conjugation paradigms.</li>
//                     </ul>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )
//         }
//         {
//           showAddModal && (
//             <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
//               <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-left">
//                 <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
//                   <h3 className="font-bold text-base text-white flex items-center gap-2">
//                     <span>➕ Add Word to Flashcards</span>
//                     <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
//                       {targetLanguage.toUpperCase()}
//                     </span>
//                   </h3>
//                   <button
//                     type="button"
//                     onClick={() => setShowAddModal(false)}
//                     className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
//                   >
//                     ✕
//                   </button>
//                 </div>

//                 <form onSubmit={handleAddCustomWord} className="space-y-4">
//                   <div>
//                     <label className="block text-xs font-semibold text-slate-300 mb-1">
//                       Word in {targetLanguage.toUpperCase()} (Base lemma):
//                     </label>
//                     <input
//                       type="text"
//                       required
//                       placeholder="e.g. apple, книга, laufen..."
//                       value={newWord}
//                       onChange={(e) => setNewWord(e.target.value)}
//                       className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
//                       autoFocus
//                     />
//                   </div>

//                   <div>
//                     <label className="block text-xs font-semibold text-slate-300 mb-1">
//                       Translation / Meaning:
//                     </label>
//                     <input
//                       type="text"
//                       required
//                       placeholder="e.g. яблоко, book, to run..."
//                       value={newMeaning}
//                       onChange={(e) => setNewMeaning(e.target.value)}
//                       className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
//                     />
//                   </div>

//                   <div className="pt-3 border-t border-slate-700 flex justify-end gap-2.5">
//                     <button
//                       type="button"
//                       onClick={() => setShowAddModal(false)}
//                       className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 transition"
//                     >
//                       Cancel
//                     </button>
//                     <button
//                       type="submit"
//                       disabled={!newWord.trim() || !newMeaning.trim()}
//                       className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50"
//                     >
//                       Save to Deck
//                     </button>
//                   </div>
//                 </form>
//               </div>
//             </div>
//           )
//         }
//       </main>
//     </div>
//   );
// }