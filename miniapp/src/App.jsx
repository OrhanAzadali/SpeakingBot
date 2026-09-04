import React, { useState, useEffect } from "react";
import {
  BookOpen,
  FileText,
  Download,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  BookMarked,
  RotateCcw,
  GraduationCap,
  ListFilter,
  X,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("grammar");
  const [grammarTopics, setGrammarTopics] = useState([]);
  const [targetLanguage, setTargetLanguage] = useState("German");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Flashcards state
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Extract auth info
  const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  const queryUserId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") || "123456789" : "123456789";

  const getHeaders = () => {
    if (initData) {
      return {
        "Content-Type": "application/json",
        Authorization: `tma ${initData}`,
      };
    }
    return {
      "Content-Type": "application/json",
      "x-user-id": queryUserId,
    };
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (window.Telegram?.WebApp?.ready) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand?.();
    }
    fetchGrammarTopics();
    fetchFlashcards();
  }, []);

  const fetchGrammarTopics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/grammar?userId=${queryUserId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setGrammarTopics(data.topics || []);
        if (data.language) setTargetLanguage(data.language);
      }
    } catch (err) {
      console.error("Failed to fetch grammar topics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashcards = async () => {
    try {
      const res = await fetch(`/api/flashcards?userId=${queryUserId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.cards || []);
      }
    } catch (err) {
      console.error("Failed to fetch flashcards:", err);
    }
  };

  // Browser Direct PDF Download
  const handleDownloadTopicPdf = (topicId, title) => {
    showToast(`Preparing PDF for "${title}"...`, "info");
    const downloadUrl = `/api/grammar/${topicId}/pdf?userId=${queryUserId}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${title.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAllGrammarPdf = () => {
    showToast("Generating Complete Grammar Book PDF...", "info");
    const downloadUrl = `/api/grammar/pdf?userId=${queryUserId}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Grammar_Reference_Book_${targetLanguage}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadVocabPdf = () => {
    showToast("Generating Vocabulary Notebook PDF...", "info");
    const downloadUrl = `/api/vocabulary/pdf?userId=${queryUserId}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `My_Vocabulary_${targetLanguage}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadRoadmapPdf = () => {
    showToast("Generating Roadmap PDF...", "info");
    const downloadUrl = `/api/roadmap/pdf?userId=${queryUserId}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Study_Roadmap_${targetLanguage}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Direct Telegram Chat PDF Delivery
  const handleSendGrammarToTelegram = async (topicId) => {
    const actionKey = topicId ? `tg-${topicId}` : "tg-all";
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/grammar/send-pdf", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ topicId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✈️ PDF sent directly to your Telegram chat!", "success");
      } else {
        showToast(data.error || "Failed to send PDF to Telegram", "error");
      }
    } catch {
      showToast("Network error sending PDF", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendVocabToTelegram = async () => {
    setActionLoading("tg-vocab");
    try {
      const res = await fetch("/api/vocabulary/send-pdf", {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✈️ Vocabulary PDF sent to your Telegram chat!", "success");
      } else {
        showToast(data.error || "Failed to send PDF", "error");
      }
    } catch {
      showToast("Network error sending PDF", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRoadmapToTelegram = async () => {
    setActionLoading("tg-roadmap");
    try {
      const res = await fetch("/api/roadmap/send-pdf", {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✈️ Roadmap PDF sent to your Telegram chat!", "success");
      } else {
        showToast(data.error || "Failed to send PDF", "error");
      }
    } catch {
      showToast("Network error sending PDF", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Categories list
  const categories = ["All", ...Array.from(new Set(grammarTopics.map((t) => t.category).filter(Boolean)))];

  const filteredTopics = grammarTopics.filter((t) => {
    const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.rule_summary && t.rule_summary.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const parseExamples = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-sm font-medium transition-all ${toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-indigo-50 text-indigo-800 border-indigo-200"
            }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-900">Grammar & Immersion Coach</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Target: {targetLanguage.toUpperCase()}
                </span>
                <span>•</span>
                <span>Complete PDF Exports</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllGrammarPdf}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              title="Download Complete Grammar Book (PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full Grammar Book (PDF)</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-5xl mx-auto mt-3 flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab("grammar")}
            className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "grammar"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Grammar Book & PDF Rules</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
              {grammarTopics.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("flashcards")}
            className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "flashcards"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Layers className="w-4 h-4" />
            <span>Vocabulary Deck</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
              {flashcards.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "roadmap"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <FileText className="w-4 h-4" />
            <span>Learning Roadmap</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* ========================================================================= */}
        {/* TAB 1: GRAMMAR RULES & PDF REFERENCE BOOK                               */}
        {/* ========================================================================= */}
        {activeTab === "grammar" && (
          <div className="space-y-6">
            {/* Hero Banner with PDF Downloads */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Unrestricted A4 Reference Sheets</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Personal Grammar Rules & Conjugation Paradigms
                </h2>
                <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
                  Every grammatical rule, verb paradigm, and syntax breakdown analyzed in your coaching sessions is automatically saved here. Download single rules or the complete book in publication-ready PDF format.
                </p>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    onClick={handleDownloadAllGrammarPdf}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full Grammar Book (PDF)</span>
                  </button>

                  <button
                    onClick={() => handleSendGrammarToTelegram()}
                    disabled={actionLoading === "tg-all"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>{actionLoading === "tg-all" ? "Sending..." : "Send Book to Telegram Chat"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Controls: Search & Category Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rules, verbs, tenses, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {categories.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <ListFilter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${selectedCategory === cat
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Topics Grid */}
            {filteredTopics.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <BookMarked className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">No Grammar Rules Saved Yet</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Chat with the bot about any grammar topic (e.g. <i>"explain verb conjugation"</i>, <i>"how do cases work?"</i>), or click below to generate your starter grammar sheet!
                </p>
                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => handleSendGrammarToTelegram()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Starter Grammar Book</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTopics.map((topic) => {
                  const examples = parseExamples(topic.examples);
                  return (
                    <div
                      key={topic.id}
                      className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                            {topic.category || "General Grammar"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(topic.updated_at || topic.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-slate-900 leading-snug group-hover:text-indigo-600 transition">
                          {topic.title}
                        </h3>

                        {topic.rule_summary && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">📌 Takeaway: </span>
                            {topic.rule_summary}
                          </div>
                        )}

                        {examples.length > 0 && (
                          <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                            <span className="font-medium text-slate-700">• {examples.length} model sentences with translations</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons for this Rule */}
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedTopic(topic)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>View Full Rule</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDownloadTopicPdf(topic.id, topic.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Download PDF directly to device"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => handleSendGrammarToTelegram(topic.id)}
                            disabled={actionLoading === `tg-${topic.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition disabled:opacity-50"
                            title="Send this rule to Telegram chat"
                          >
                            <Send className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{actionLoading === `tg-${topic.id}` ? "..." : "Send to TG"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FLASHCARDS DECK & REVIEW                                         */}
        {/* ========================================================================= */}
        {activeTab === "flashcards" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-xl text-slate-900">Vocabulary & Spaced Repetition</h2>
                <p className="text-xs text-slate-500">Uninflected base lemmas stored with full morphology & phonetics</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadVocabPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Vocab PDF</span>
                </button>
                <button
                  onClick={handleSendVocabToTelegram}
                  disabled={actionLoading === "tg-vocab"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading === "tg-vocab" ? "Sending..." : "Send to TG"}</span>
                </button>
              </div>
            </div>

            {flashcards.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-base text-slate-800">Deck is Empty</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Words you make mistakes on during conversation or skill drills will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Flashcard Card */}
                {(() => {
                  const card = flashcards[currentCardIdx] || flashcards[0];
                  return (
                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="cursor-pointer bg-white rounded-2xl border-2 border-indigo-100 p-8 min-h-[260px] flex flex-col justify-between shadow-sm hover:border-indigo-300 transition text-center relative"
                    >
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
                        <span className="uppercase font-semibold tracking-wider text-indigo-600">
                          {card.part_of_speech || "Word"}
                        </span>
                      </div>

                      <div className="my-auto py-6">
                        {!isFlipped ? (
                          <>
                            <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                              {card.initial_form || card.word}
                            </h3>
                            {card.transcription && (
                              <p className="text-sm font-mono text-indigo-600 mt-2">
                                {card.transcription}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-4">Tap card to reveal meaning & rules</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xl font-bold text-emerald-600">
                              {card.correction}
                            </p>
                            {card.grammar_rule && (
                              <p className="text-xs text-slate-600 mt-3 max-w-md mx-auto">
                                <span className="font-semibold">Grammar:</span> {card.grammar_rule}
                              </p>
                            )}
                            {card.sentence && (
                              <p className="text-xs italic text-slate-500 mt-2">
                                "{card.sentence.replace(/<\/?u>/g, "")}"
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex justify-center text-xs text-slate-400">
                        <span>Tap to flip</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Card Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIdx((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold text-xs hover:bg-indigo-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Flip Card</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentCardIdx((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LEARNING ROADMAP & STUDY PLAN                                    */}
        {/* ========================================================================= */}
        {activeTab === "roadmap" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="font-bold text-lg text-slate-900">Personal Study Roadmap</h2>
                  <p className="text-xs text-slate-500">Auto-updated by AI every 5 messages based on diagnostic progress</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadRoadmapPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Roadmap PDF</span>
                  </button>
                  <button
                    onClick={handleSendRoadmapToTelegram}
                    disabled={actionLoading === "tg-roadmap"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{actionLoading === "tg-roadmap" ? "Sending..." : "Send to TG"}</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm text-slate-700 leading-relaxed">
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 text-sm mb-1">🎯 7-Day Targeted Regimen</h4>
                  <p className="text-xs text-indigo-800">
                    Your learning curriculum focuses on balanced mastery across Listening, Speaking, Reading, and Writing, alongside your custom grammar book.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">Key Study Objectives:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 pl-1">
                    <li>Review due base lemmas in your Spaced Repetition deck.</li>
                    <li>Read and download your latest Grammar Rule PDF sheet.</li>
                    <li>Complete one 4-Skill Drill session in the Telegram Bot (/skills).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* DETAILED GRAMMAR TOPIC MODAL / DRAWER                                     */}
      {/* ========================================================================= */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <span className="text-xs font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                  {selectedTopic.category || "Grammar Reference"}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">{selectedTopic.title}</h2>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm text-slate-800 leading-relaxed">
              {selectedTopic.rule_summary && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                  <span className="font-bold text-indigo-950">📌 Core Rule Takeaway: </span>
                  {selectedTopic.rule_summary}
                </div>
              )}

              {/* Formatted Markdown Explanation */}
              <div className="prose prose-slate max-w-none text-xs sm:text-sm whitespace-pre-wrap font-sans">
                {selectedTopic.explanation}
              </div>

              {/* Model Sentences */}
              {(() => {
                const examples = parseExamples(selectedTopic.examples);
                if (examples.length === 0) return null;
                return (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-3 text-sm">💬 Real-World Model Examples:</h4>
                    <div className="space-y-2">
                      {examples.map((ex, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                          <p className="font-semibold text-slate-900">{ex.target}</p>
                          <p className="text-slate-600 mt-0.5">— {ex.translation}</p>
                          {ex.note && <p className="text-indigo-600 mt-1 italic">Note: {ex.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer with PDF Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadTopicPdf(selectedTopic.id, selectedTopic.title)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  onClick={() => handleSendGrammarToTelegram(selectedTopic.id)}
                  disabled={actionLoading === `tg-${selectedTopic.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading === `tg-${selectedTopic.id}` ? "Sending..." : "Send to Telegram"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
