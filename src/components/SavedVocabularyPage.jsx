import { useState, useMemo } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { TARGET_LANGUAGES } from "../utils/targetLanguages";
import { jsPDF } from "jspdf";
import {
  BookMarked,
  Search,
  Volume2,
  Trash2,
  Plus,
  Download,
  Layers,
  Sparkles,
  Bot,
  Filter,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  VolumeX,
  FileText
} from "lucide-react";

export const SavedVocabularyPage = ({
  userProfile,
  savedVocabulary = [],
  allVocabularies = {},
  countsByLanguage = {},
  onSaveToVocabulary,
  onDeleteFromVocabulary,
  onUpdateTargetLanguage,
  onSelectToken,
  onTriggerSync,
  isSyncing = false
}) => {
  const { t, mediatorLanguage } = useTranslation();
  const currentTargetLang = userProfile.targetLanguage || "English";
  const [activeLangTab, setActiveLangTab] = useState(currentTargetLang);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCefr, setSelectedCefr] = useState("ALL");
  const [selectedPos, setSelectedPos] = useState("ALL");
  const [sortBy, setSortBy] = useState("recent");
  const [studyMode, setStudyMode] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [speakingWord, setSpeakingWord] = useState(null);

  // New word form state
  const [newWord, setNewWord] = useState("");
  const [newTranslation, setNewTranslation] = useState("");
  const [newPos, setNewPos] = useState("noun");
  const [newCefr, setNewCefr] = useState("B1");
  const [newExample, setNewExample] = useState("");
  const [newIpa, setNewIpa] = useState("");
  const [isAnalyzingNewWord, setIsAnalyzingNewWord] = useState(false);

  // Ensure we get words for the currently selected language tab
  const activeLangWords = useMemo(() => {
    if (activeLangTab === currentTargetLang && savedVocabulary && savedVocabulary.length > 0) {
      return savedVocabulary;
    }
    if (allVocabularies[activeLangTab] && Array.isArray(allVocabularies[activeLangTab])) {
      return allVocabularies[activeLangTab];
    }
    return savedVocabulary.filter(
      (v) => (v.targetLanguage || "English").toLowerCase() === activeLangTab.toLowerCase()
    );
  }, [activeLangTab, currentTargetLang, savedVocabulary, allVocabularies]);

  // Filtered & Sorted vocabulary list
  const filteredWords = useMemo(() => {
    return activeLangWords
      .filter((item) => {
        const query = searchTerm.toLowerCase().trim();
        const matchesQuery =
          !query ||
          (item.word || "").toLowerCase().includes(query) ||
          (item.translation || "").toLowerCase().includes(query) ||
          (item.example || "").toLowerCase().includes(query);

        const matchesCefr =
          selectedCefr === "ALL" || (item.cefr || item.cefrLevel || "B1").toUpperCase() === selectedCefr;

        const matchesPos =
          selectedPos === "ALL" || (item.pos || "").toLowerCase() === selectedPos.toLowerCase();

        return matchesQuery && matchesCefr && matchesPos;
      })
      .sort((a, b) => {
        if (sortBy === "alphabetical") {
          return (a.word || "").localeCompare(b.word || "");
        }
        if (sortBy === "level") {
          return (a.cefr || "B1").localeCompare(b.cefr || "B1");
        }
        // Recent
        return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      });
  }, [activeLangWords, searchTerm, selectedCefr, selectedPos, sortBy]);

  const handleSwitchLanguage = (lang) => {
    setActiveLangTab(lang);
    setFlashcardIndex(0);
    setIsFlipped(false);
    if (onUpdateTargetLanguage && lang !== currentTargetLang) {
      onUpdateTargetLanguage(lang);
    }
  };

  const playSpeech = (wordText, lang = activeLangTab) => {
    if (!("speechSynthesis" in window) || !wordText) return;
    window.speechSynthesis.cancel();
    setSpeakingWord(wordText);

    const utterance = new SpeechSynthesisUtterance(wordText);
    const langCodeMap = {
      English: "en-US",
      German: "de-DE",
      Spanish: "es-ES",
      French: "fr-FR",
      Italian: "it-IT",
      Russian: "ru-RU",
      Turkish: "tr-TR"
    };
    utterance.lang = langCodeMap[lang] || "en-US";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingWord(null);
    utterance.onerror = () => setSpeakingWord(null);

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  };

  const handleAnalyzeWord = async () => {
    if (!newWord.trim()) return;
    setIsAnalyzingNewWord(true);
    try {
      const res = await fetch("/api/gemini/tokenize-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: newWord.trim(),
          targetLanguage: activeLangTab,
          mediatorLanguage: userProfile.mediatorLanguage || "az"
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && Array.isArray(json.data.tokens) && json.data.tokens[0]) {
          const tkn = json.data.tokens[0];
          setNewTranslation(tkn.mediatorTranslation || tkn.translation || "");
          setNewPos(tkn.pos?.toLowerCase() || "noun");
          setNewCefr(tkn.cefrLevel || "B1");
          setNewIpa(tkn.ipa || "");
          setNewExample(
            `In ${activeLangTab}: "${tkn.lemma || newWord}" is a foundational vocabulary asset.`
          );
        }
      }
    } catch (err) {
      console.warn("Linguistic NLP helper:", err);
    } finally {
      setIsAnalyzingNewWord(false);
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    if (onSaveToVocabulary) {
      onSaveToVocabulary({
        word: newWord.trim(),
        translation: newTranslation.trim() || newWord.trim(),
        pos: newPos,
        cefr: newCefr,
        ipa: newIpa.trim(),
        example: newExample.trim(),
        targetLanguage: activeLangTab
      });
    }
    setNewWord("");
    setNewTranslation("");
    setNewExample("");
    setNewIpa("");
    setIsAddModalOpen(false);
  };

  const handleExportPDF = () => {
    if (filteredWords.length === 0) return;
    const doc = new jsPDF();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`SpeakBot Lexicon: ${activeLangTab} Vocabulary Notebook`, 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`User: ${userProfile.telegramUsername} • Level: ${userProfile.currentLevel} • Total: ${filteredWords.length} terms`, 14, 23);

    let y = 40;
    doc.setTextColor(30, 41, 59);

    filteredWords.forEach((item, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${index + 1}. ${item.word}`, 14, y);

      if (item.ipa) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${item.ipa}`, 70, y);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(16, 185, 129);
      doc.text(`[${item.pos || "word"}] [${item.cefr || "B1"}]`, 130, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Translation: ${item.translation || "—"}`, 18, y);

      if (item.example) {
        y += 5;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const splitEx = doc.splitTextToSize(`"${item.example}"`, 175);
        doc.text(splitEx, 18, y);
        y += (splitEx.length - 1) * 4;
      }

      y += 8;
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y - 2, 196, y - 2);
      y += 4;
    });

    doc.save(`SpeakBot_${activeLangTab}_Vocabulary_${Date.now()}.pdf`);
  };

  const activeCard = filteredWords[flashcardIndex] || null;

  return (
    <div className="pb-24 space-y-8 animate-in fade-in duration-300">
      {/* Page Header & Telegram Sync Banner */}
      <div className="bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 border border-sky-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
              <BookMarked className="w-4 h-4" />
              <span>Dedicated Lexicon Repository & Notebook</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Saved Vocabulary & Idiomatic Lexicon
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every word, phrase, and collocated term saved from Classic Stories, Grammar Guides, Tokenizer analyses, and Telegram bot chats is securely recorded per target language and mediator translation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 shadow-sm transition"
              title="Sync with Telegram @SpeakBot"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-sky-400" : "text-emerald-400"}`} />
              <span>{isSyncing ? "Syncing Bot..." : "Sync Bot State"}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={filteredWords.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              title="Export printable PDF vocabulary guide"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Word</span>
            </button>
          </div>
        </div>

        {/* Telegram Bot Sync Metadata Badge */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">Active Bot User:</span>
            <span className="text-sky-300">{userProfile.telegramUsername}</span>
            <span className="text-slate-500">•</span>
            <span>Mediator: <strong className="text-amber-300 uppercase">{userProfile.mediatorLanguage || "az"}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span>Total Saved: <strong className="text-white">{activeLangWords.length}</strong> words</span>
            <span>Current CEFR: <strong className="text-emerald-400">{userProfile.currentLevel}</strong></span>
          </div>
        </div>
      </div>

      {/* Target Language Switcher Rail */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TARGET_LANGUAGES.map((lang) => {
          const isActive = activeLangTab.toLowerCase() === lang.name.toLowerCase();
          const wordCount = countsByLanguage[lang.name] || allVocabularies[lang.name]?.length || (lang.name === currentTargetLang ? savedVocabulary.length : 0);
          return (
            <button
              key={lang.id}
              onClick={() => handleSwitchLanguage(lang.name)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2.5 transition whitespace-nowrap border shrink-0 ${isActive
                ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white border-sky-400 shadow-md shadow-sky-500/20 scale-105"
                : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isActive ? "bg-black/30 text-sky-200" : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
              >
                {wordCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode Bar: List View vs. Flashcard Practice */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-4 rounded-3xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStudyMode(false)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${!studyMode ? "bg-slate-800 text-white border border-slate-700 shadow-sm" : "text-slate-400 hover:text-white"
              }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Lexicon Table ({filteredWords.length})</span>
          </button>
          <button
            onClick={() => {
              setStudyMode(true);
              setFlashcardIndex(0);
              setIsFlipped(false);
            }}
            disabled={filteredWords.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-40 ${studyMode ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "text-slate-400 hover:text-white"
              }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Interactive Flashcards</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeLangTab} vocabulary...`}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={selectedCefr}
            onChange={(e) => setSelectedCefr(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Levels</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
            <option value="C2">C2</option>
          </select>

          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All POS</option>
            <option value="noun">Nouns</option>
            <option value="verb">Verbs</option>
            <option value="adj">Adjectives</option>
            <option value="adv">Adverbs</option>
            <option value="idiom">Idioms / Phrases</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="recent">Recent</option>
            <option value="alphabetical">A-Z</option>
            <option value="level">Level</option>
          </select>
        </div>
      </div>

      {/* FLASHCARD STUDY MODE VIEW */}
      {studyMode && activeCard && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Card {flashcardIndex + 1} of {filteredWords.length}</span>
            <span>Target: <strong className="text-sky-300">{activeLangTab}</strong></span>
          </div>

          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[280px] sm:min-h-[320px] bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500/50 transition duration-200 relative group select-none"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activeCard.cefr || "B1"}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                {activeCard.pos || "word"}
              </span>
            </div>

            {!isFlipped ? (
              <div className="space-y-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-white group-hover:text-sky-300 transition">
                  {activeCard.word}
                </div>
                {activeCard.ipa && (
                  <div className="text-sm font-mono text-slate-400">
                    {activeCard.ipa}
                  </div>
                )}
                <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 pt-4">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Click card to reveal translation & context</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
                  Mediator Translation ({userProfile.mediatorLanguage || "az"})
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {activeCard.translation}
                </div>
                {activeCard.example && (
                  <p className="text-sm text-slate-300 italic max-w-md mx-auto pt-2 border-t border-slate-800">
                    "{activeCard.example}"
                  </p>
                )}
                <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 pt-2">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Click card to return to prompt</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playSpeech(activeCard.word);
              }}
              className="absolute bottom-4 left-4 p-2.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition"
              title="Pronounce word"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Flashcard Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => {
                setFlashcardIndex((prev) => Math.max(0, prev - 1));
                setIsFlipped(false);
              }}
              disabled={flashcardIndex === 0}
              className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Card</span>
            </button>

            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              {isFlipped ? "Show Word" : "Flip Translation"}
            </button>

            <button
              onClick={() => {
                setFlashcardIndex((prev) => Math.min(filteredWords.length - 1, prev + 1));
                setIsFlipped(false);
              }}
              disabled={flashcardIndex >= filteredWords.length - 1}
              className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-40"
            >
              <span>Next Card</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* LEXICON GRID / TABLE VIEW */}
      {!studyMode && (
        <div className="space-y-4">
          {filteredWords.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto border border-sky-500/20">
                <BookMarked className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">No saved words for {activeLangTab}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Start bookmarking vocabulary directly from Classic Stories, Grammar PDF Guides, Tokenizer analyses, or tap below to add words manually!
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg transition"
              >
                + Add First Word in {activeLangTab}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWords.map((item, idx) => {
                const isSpeaking = speakingWord === item.word;
                return (
                  <div
                    key={item.id || `${item.word}-${idx}`}
                    className="bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-white group-hover:text-sky-300 transition">
                              {item.word}
                            </span>
                            <button
                              type="button"
                              onClick={() => playSpeech(item.word)}
                              className={`p-1 rounded-lg transition ${isSpeaking
                                ? "bg-sky-500 text-white"
                                : "bg-slate-800 hover:bg-sky-600 text-slate-400 hover:text-white"
                                }`}
                              title="Listen to pronunciation"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {item.ipa && (
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {item.ipa}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {item.pos || "noun"}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.cefr || "B1"}
                          </span>
                        </div>
                      </div>

                      {/* Translation */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500">
                          Mediator Meaning ({userProfile.mediatorLanguage || "az"}):
                        </div>
                        <div className="text-xs font-semibold text-slate-200 mt-0.5">
                          {item.translation || "—"}
                        </div>
                      </div>

                      {/* Example sentence */}
                      {item.example && (
                        <div className="text-xs text-slate-400 italic mt-2.5 line-clamp-2">
                          "{item.example}"
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectToken) {
                            onSelectToken({
                              text: item.word,
                              lemma: item.word,
                              pos: (item.pos || "NOUN").toUpperCase(),
                              cefrLevel: item.cefr || "B1",
                              ipa: item.ipa || "",
                              mediatorTranslation: item.translation,
                              syntaxRole: "Vocabulary Lexicon Unit"
                            });
                          }
                        }}
                        className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                      >
                        <span>NLP Inspector</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>

                      {onDeleteFromVocabulary && (
                        <button
                          type="button"
                          onClick={() => onDeleteFromVocabulary(item.id, item.word, activeLangTab)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remove word from vocabulary"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADD CUSTOM WORD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Add Vocabulary Word to {activeLangTab}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Saves directly to your active lexicon & Telegram bot memory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Word or Phrase ({activeLangTab})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="e.g. serendipity, unentwegt, desafortunadamente..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeWord}
                    disabled={!newWord.trim() || isAnalyzingNewWord}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold flex items-center gap-1.5 border border-slate-700 disabled:opacity-40"
                    title="Auto-fetch IPA, translation, POS via NLP"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingNewWord ? "animate-spin" : ""}`} />
                    <span>AI Lookup</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Translation / Meaning ({userProfile.mediatorLanguage || "az"})
                </label>
                <input
                  type="text"
                  required
                  value={newTranslation}
                  onChange={(e) => setNewTranslation(e.target.value)}
                  placeholder="Meaning in your native mediator language..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Part of Speech
                  </label>
                  <select
                    value={newPos}
                    onChange={(e) => setNewPos(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="noun">Noun</option>
                    <option value="verb">Verb</option>
                    <option value="adj">Adjective</option>
                    <option value="adv">Adverb</option>
                    <option value="idiom">Idiom</option>
                    <option value="phrase">Phrase</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CEFR Level
                  </label>
                  <select
                    value={newCefr}
                    onChange={(e) => setNewCefr(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phonetic (IPA)
                  </label>
                  <input
                    type="text"
                    value={newIpa}
                    onChange={(e) => setNewIpa(e.target.value)}
                    placeholder="/.../"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Example Sentence
                </label>
                <textarea
                  rows={2}
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  placeholder="Contextual usage example..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg transition"
                >
                  Save to {activeLangTab} Lexicon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
