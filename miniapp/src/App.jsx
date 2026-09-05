import React, { useState, useEffect } from "react";
import {
  BookOpen,
  FileText,
  Download,
  Send,
  Sparkles,
  Layers,
  GraduationCap,
  Gamepad2,
  Headphones,
  Mic,
  BrainCircuit,
  Volume2,
  Trophy,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from "lucide-react";

import GrammarBook from "./components/GrammarBook.jsx";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Quiz from "./components/Quiz.jsx";
import ListeningGame from "./components/ListeningGame.jsx";
import ListeningMatch from "./components/ListeningMatch.jsx";
import SpeakingGame from "./components/SpeakingGame.jsx";
import Summary from "./components/Summary.jsx";

export default function App() {
  // Point directly to your Render backend
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://speakingbot.onrender.com";

  // Navigation state: 'games' | 'grammar' | 'roadmap'
  const [activeTab, setActiveTab] = useState("games");
  // Active game mode: null (hub) | 'flashcards' | 'quiz' | 'listening' | 'match' | 'speaking' | 'summary'
  const [activeGame, setActiveGame] = useState(null);

  const [grammarTopics, setGrammarTopics] = useState([]);
  const [targetLanguage, setTargetLanguage] = useState("German");
  const [flashcards, setFlashcards] = useState([]);
  const [sessionStats, setSessionStats] = useState({ remembered: 0, forgot: 0 });

  // Notifications & Loaders
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Extract real Telegram user ID from Telegram WebApp, or URL param, or localStorage
  const tgUser = typeof window !== "undefined" ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;
  // Auth Info
  const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  const urlParamId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null;

  // Real effective user ID (checks Telegram WebApp user, then URL, then stored ID)
  const effectiveUserId = tgUser?.id ? String(tgUser.id) : (urlParamId || localStorage.getItem("spk_user_id") || "8291613988");

  // Save for persistence across web browser sessions
  useEffect(() => {
    if (effectiveUserId && effectiveUserId !== "123456789") {
      localStorage.setItem("spk_user_id", effectiveUserId);
    }
  }, [effectiveUserId]);

  const getHeaders = () => {
    const headers = {
      "Content-Type": "application/json",
      "x-user-id": effectiveUserId,
    };
    if (initData) {
      headers["Authorization"] = `tma ${initData}`;
    }
    return headers;
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
    try {
      const res = await fetch(`${BACKEND_URL}/api/grammar?userId=${effectiveUserId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setGrammarTopics(data.topics || []);
        if (data.language) setTargetLanguage(data.language);
      }
    } catch (err) {
      console.error("Failed to fetch grammar topics:", err);
    }
  };

  const fetchFlashcards = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards?userId=${effectiveUserId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.cards || []);
        if (data.language) setTargetLanguage(data.language);
      }
    } catch (err) {
      console.error("Failed to fetch flashcards:", err);
    }
  };

  // Safe PDF Download for Web & Telegram MiniApp
  const triggerDownload = (endpoint, filename) => {
    const downloadUrl = `${BACKEND_URL}${endpoint}?userId=${effectiveUserId}`;
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(downloadUrl);
    } else {
      window.open(downloadUrl, "_blank");
    }
  };


  const handleDownloadAllGrammarPdf = () => {
    showToast("Generating Complete Grammar Book PDF...", "info");
    triggerDownload("/api/grammar/pdf", `Grammar_Book_${targetLanguage}.pdf`);
  };

  const handleDownloadVocabPdf = () => {
    showToast("Generating Vocabulary Notebook PDF...", "info");
    triggerDownload("/api/vocabulary/pdf", `Vocabulary_${targetLanguage}.pdf`);
  };

  const handleDownloadRoadmapPdf = () => {
    showToast("Generating Roadmap PDF...", "info");
    triggerDownload("/api/roadmap/pdf", `Roadmap_${targetLanguage}.pdf`);
  };

  // Direct Telegram Chat PDF Delivery
  const handleSendToTelegram = async (endpoint, payload = {}, key = "tg-send") => {
    setActionLoading(key);
    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ ...payload, userId: effectiveUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✈️ PDF sent directly to your Telegram chat!", "success");
      } else {
        showToast(data.error || "Failed to send PDF", "error");
      }
    } catch {
      showToast("Network error connecting to backend server", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Flashcard Deck Result Callback
  const handleDeckResult = async (cardId, remembered) => {
    setSessionStats((prev) => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      forgot: prev.forgot + (remembered ? 0 : 1),
    }));

    try {
      await fetch(`${BACKEND_URL}/api/flashcards/${cardId}/review`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ remembered }),
      });
    } catch (_) { }

    setFlashcards((prev) => {
      const rest = prev.slice(1);
      if (rest.length === 0) {
        setActiveGame("summary");
        return [];
      }
      return rest;
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-semibold animate-in fade-in ${toast.type === "success"
            ? "bg-emerald-600 text-white border-emerald-500"
            : toast.type === "error"
              ? "bg-rose-600 text-white border-rose-500"
              : "bg-indigo-600 text-white border-indigo-500"
            }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-900/40">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base leading-tight text-white">Language Immersion Coach</h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="font-semibold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/80">
                  Target: {targetLanguage.toUpperCase()}
                </span>
                <span>•</span>
                <span>{flashcards.length} Words Saved</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAllGrammarPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
              title="Download Complete Grammar Book (PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grammar Book</span> (PDF)
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Only visible when not actively inside a game screen) */}
        {!activeGame && (
          <div className="max-w-4xl mx-auto mt-3 flex border-b border-slate-800 gap-6">
            <button
              onClick={() => setActiveTab("games")}
              className={`pb-2 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "games"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Practice Games & Drills</span>
            </button>

            <button
              onClick={() => setActiveTab("grammar")}
              className={`pb-2 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "grammar"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Grammar Book & Rules</span>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded-full">
                {grammarTopics.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("roadmap")}
              className={`pb-2 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition ${activeTab === "roadmap"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>Learning Roadmap</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start">
        {/* ========================================================================= */}
        {/* ACTIVE GAME SCREENS                                                       */}
        {/* ========================================================================= */}
        {activeGame === "flashcards" && (
          <div className="flex flex-col items-center justify-center flex-1 py-4">
            <button
              onClick={() => setActiveGame(null)}
              className="self-start mb-4 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Game Hub
            </button>
            {flashcards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No flashcards due for review!</p>
                <button
                  onClick={() => setActiveGame(null)}
                  className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-semibold"
                >
                  Return to Hub
                </button>
              </div>
            ) : (
              <FlashcardDeck cards={flashcards} onResult={handleDeckResult} />
            )}
          </div>
        )}

        {activeGame === "quiz" && (
          <Quiz
            cards={flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            onExit={() => setActiveGame(null)}
          />
        )}

        {activeGame === "listening" && (
          <ListeningGame
            cards={flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            onExit={() => setActiveGame(null)}
          />
        )}

        {activeGame === "match" && (
          <ListeningMatch
            cards={flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            onExit={() => setActiveGame(null)}
          />
        )}

        {activeGame === "speaking" && (
          <SpeakingGame
            cards={flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            onExit={() => setActiveGame(null)}
          />
        )}

        {activeGame === "summary" && (
          <Summary
            stats={sessionStats}
            total={sessionStats.remembered + sessionStats.forgot}
            onExit={() => {
              setActiveGame(null);
              fetchFlashcards();
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 1: PRACTICE GAMES & INTERACTIVE DRILLS HUB                            */}
        {/* ========================================================================= */}
        {!activeGame && activeTab === "games" && (
          <div className="space-y-6">
            {/* Action Card Banner */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Spaced Repetition & Audio Immersion</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Interactive Practice Hub
                </h2>
                <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
                  Train your vocabulary, active recall, listening comprehension, and pronunciation with adaptive AI micro-drills.
                </p>

                <div className="flex flex-wrap gap-2.5 mt-4">
                  <button
                    onClick={handleDownloadVocabPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download Vocab PDF</span>
                  </button>
                  <button
                    onClick={() => handleSendToTelegram("/api/vocabulary/send-pdf", {}, "tg-vocab")}
                    disabled={actionLoading === "tg-vocab"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{actionLoading === "tg-vocab" ? "Sending..." : "Send Vocab to TG"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 6 Game Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. Spaced Repetition Flashcards */}
              <div
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("flashcards");
                  else showToast("No flashcards saved yet! Chat with bot first.", "error");
                }}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Vocabulary Flashcards</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Spaced repetition deck with base lemmas, phonetics, rules, and example sentences.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-indigo-400 font-semibold">
                  <span>{flashcards.length} cards available</span>
                  <span>Start →</span>
                </div>
              </div>

              {/* 2. Vocabulary Quiz */}
              <div
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("quiz");
                  else showToast("Save at least 1 word before playing Quiz!", "error");
                }}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Smart Recall Quiz</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Test your memory with multiple choice or text entry. Graded dynamically with synonyms accepted!
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span>Adaptive grading</span>
                  <span>Play →</span>
                </div>
              </div>

              {/* 3. Listening Quiz */}
              <div
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("listening");
                  else showToast("Save words to enable Listening Drill!", "error");
                }}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-cyan-900/60 border border-cyan-700/50 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Listening Comprehension</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Audio-only challenge: listen to the native pronunciation, then type or choose the meaning.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-cyan-400 font-semibold">
                  <span>Ear training</span>
                  <span>Listen →</span>
                </div>
              </div>

              {/* 4. Sound Match */}
              <div
                onClick={() => {
                  if (flashcards.length >= 3) setActiveGame("match");
                  else showToast("Needs at least 3 saved words to play Sound Match!", "error");
                }}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-900/60 border border-amber-700/50 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Sound Match</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Fast-paced audio memory game: match the spoken sound tile with its written translation.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Combo bonuses</span>
                  <span>Match →</span>
                </div>
              </div>

              {/* 5. Speaking Drill */}
              <div
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("speaking");
                  else showToast("Save words to practice speaking!", "error");
                }}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-rose-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-rose-900/60 border border-rose-700/50 flex items-center justify-center text-rose-400 mb-3 group-hover:scale-105 transition-transform">
                    <Mic className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Pronunciation & Speech</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Speak words into your microphone. Real-time accuracy scoring and phonetic feedback!
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-rose-400 font-semibold">
                  <span>Microphone drill</span>
                  <span>Speak →</span>
                </div>
              </div>

              {/* 6. Grammar Reference Book Tile */}
              <div
                onClick={() => setActiveTab("grammar")}
                className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-violet-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-violet-900/60 border border-violet-700/50 flex items-center justify-center text-violet-400 mb-3 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Grammar Book & Rules</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    View saved grammar rules, verb conjugation tables, and download publication-ready PDFs.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-violet-400 font-semibold">
                  <span>{grammarTopics.length} saved rules</span>
                  <span>Open Book →</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GRAMMAR REFERENCE BOOK                                             */}
        {/* ========================================================================= */}
        {!activeGame && activeTab === "grammar" && (
          <GrammarBook
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            effectiveUserId={queryUserId}
            onExit={() => setActiveTab("games")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LEARNING ROADMAP & STUDY PLAN                                    */}
        {/* ========================================================================= */}
        {!activeGame && activeTab === "roadmap" && (
          <div className="space-y-6 max-w-2xl mx-auto w-full">
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-5">
                <div>
                  <h2 className="font-bold text-lg text-white">Personal Study Roadmap</h2>
                  <p className="text-xs text-slate-400">Auto-updated by AI every 5 messages based on diagnostic progress</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadRoadmapPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-300" />
                    <span>Roadmap PDF</span>
                  </button>
                  <button
                    onClick={() => handleSendToTelegram("/api/roadmap/send-pdf", {}, "tg-roadmap")}
                    disabled={actionLoading === "tg-roadmap"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{actionLoading === "tg-roadmap" ? "Sending..." : "Send to TG"}</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <div className="p-4 rounded-xl bg-indigo-950/70 border border-indigo-800/80">
                  <h4 className="font-bold text-indigo-300 text-sm mb-1">🎯 7-Day Targeted Regimen</h4>
                  <p className="text-xs text-indigo-200">
                    Your curriculum balances Listening, Speaking, Reading, and Writing with your personalized Grammar Book.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-white">Current Milestones:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400 pl-1">
                    <li>Practice 10 due words in the Vocabulary Deck daily.</li>
                    <li>Complete at least one Sound Match or Listening drill.</li>
                    <li>Review your latest Grammar Guide PDF with conjugation paradigms.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}