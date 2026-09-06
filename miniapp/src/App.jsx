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
  RotateCcw,
  Palette,
  RefreshCw
} from "lucide-react";

import GrammarBook from "./components/GrammarBook.jsx";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Quiz from "./components/Quiz.jsx";
import ListeningGame from "./components/ListeningGame.jsx";
import ListeningMatch from "./components/ListeningMatch.jsx";
import SpeakingGame from "./components/SpeakingGame.jsx";
import Summary from "./components/Summary.jsx";
import { CubeWordCard } from "./components/CubicWords/CubeWordCard.jsx";
import { CubeWordGame } from "./components/CubicWords/CubeWordGame.jsx";
import { getHarmonizedTheme, PRESET_THEMES } from "./utils/colorHarmonizer.js";

export default function App() {
  // Point directly to your Render backend
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://speakingbot.onrender.com";

  // Dynamic Color Harmonizer State
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem("spk_theme_id") || "golden_ai";
    } catch {
      return "golden_ai";
    }
  });
  const [rotationIndex, setRotationIndex] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);

  // Auto-cycle theme colors smoothly from time to time (every 28 seconds)
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setRotationIndex((prev) => (prev + 1) % 8);
    }, 28000);
    return () => clearInterval(interval);
  }, [autoCycle]);

  const activeTheme = getHarmonizedTheme(themeId, rotationIndex);
  const themeColors = activeTheme.colors;

  // Navigation state: 'games' | 'grammar' | 'roadmap'
  const [activeTab, setActiveTab] = useState("games");
  // Active game mode: null (hub) | 'flashcards' | 'quiz' | 'listening' | 'match' | 'speaking' | 'summary' | 'cubeGame'
  const [activeGame, setActiveGame] = useState(null);
  const [mediatorLanguage, setMediatorLanguage] = useState("english");
  // Language the 3D Cube Word game was launched with (picked on the card, before entering the game)
  const [cubeGameLanguage, setCubeGameLanguage] = useState("english");
  const [cubeGameHighScore, setCubeGameHighScore] = useState(() => {
    try {
      return Number(localStorage.getItem("cubeword_highscore") || "0");
    } catch {
      return 0;
    }
  });

  const [targetLanguage, setTargetLanguage] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [grammarTopics, setGrammarTopics] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  // Dedicated cards generated live by AI for practice games
  const [aiGameCards, setAiGameCards] = useState([]);
  const [loadingAiGame, setLoadingAiGame] = useState(false);
  // Tracks the progressive round number for AI games
  const [gameRound, setGameRound] = useState(1);
  const [sessionStats, setSessionStats] = useState({ remembered: 0, forgot: 0 });

  // Notifications & Loaders
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Extract real Telegram user ID
  const tgUser = typeof window !== "undefined" ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;
  const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
  const urlParamId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("userId") : null;

  const effectiveUserId = tgUser?.id ? String(tgUser.id) : (urlParamId || localStorage.getItem("spk_user_id") || "8291613988");


  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Launched from the CubeWordCard on the games hub: remember the chosen
  // language, then switch the main view into the 3D game.
  const startCubeGame = (lang) => {
    setCubeGameLanguage(lang || "english");
    setActiveGame("cubeGame");
  };

  // Adapts the 3D game's onSaveToVocabulary(word, definition, partOfSpeech)
  // callback to this app's shared handleSaveWordToDeck(card) saver so words
  // discovered in the cube game land in the same flashcard deck as every
  // other game.
  const handleSaveWordFromCubeGame = async (word, definition, partOfSpeech) => {
    const ok = await handleSaveWordToDeck({
      word,
      correction: definition,
      meaning: definition,
      language: cubeGameLanguage,
      part_of_speech: partOfSpeech || "word",
    });
    if (ok) {
      try {
        const stored = Number(localStorage.getItem("cubeword_highscore") || "0");
        setCubeGameHighScore(stored);
      } catch {
        // ignore
      }
    }
    return ok;
  };

  const handleAddCustomWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/vocabulary/add`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          userId: effectiveUserId,
          word: newWord.trim(),
          meaning: newMeaning.trim(),
          language: targetLanguage,
        }),
      });
      if (res.ok) {
        showToast(`✅ «${newWord}» added to your deck!`);
        setNewWord("");
        setNewMeaning("");
        setShowAddModal(false);
        fetchFlashcards(targetLanguage);
      }
    } catch {
      showToast("Failed to add word", "error");
    }
  };
  // App.jsx — One-tap save for any word encountered in games
  const handleSaveWordToDeck = async (card) => {
    if (!card) return;
    const targetWord = card.initial_form || card.word;
    const meaning = card.correction || card.meaning;
    if (!targetWord || !meaning) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/vocabulary/add`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          userId: effectiveUserId,
          word: targetWord,
          meaning: meaning,
          language: card.language || targetLanguage,
          part_of_speech: card.part_of_speech || "word",
          sentence: card.sentence || card.context || "",
          transcription: card.transcription || "",
          pronunciation_rule: card.pronunciation_rule || "",
          grammar_rule: card.grammar_rule || "",
        }),
      });

      if (res.ok) {
        showToast(`⭐ «${targetWord}» saved to your permanent deck!`);
        fetchFlashcards(targetLanguage); // Refresh count
        return true;
      }
    } catch (err) {
      console.error("Save word error:", err);
      showToast("Failed to save word", "error");
    }
    return false;
  };
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

  // 1. Initial boot: query the user's active database language  
  useEffect(() => {
    if (window.Telegram?.WebApp?.ready) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand?.();
    }
    loadUserProfile();
  }, [effectiveUserId]);

  const loadUserProfile = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user?userId=${effectiveUserId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const activeLang = data.language || "english";
        const medLang = data.mediator || "russian";
        setTargetLanguage(activeLang);
        setMediatorLanguage(medLang);
        setAvailableLanguages(data.availableLanguages || [activeLang]);
        fetchFlashcards(activeLang, medLang);
        fetchGrammarTopics(activeLang);
        return;
      }
    } catch (err) {
      console.error("User profile load failed:", err);
    }
    fetchFlashcards("english", "russian");
    fetchGrammarTopics("english");
  };

  const fetchFlashcards = async (lang = targetLanguage, med = mediatorLanguage) => {
    try {
      const qLang = lang ? `&language=${encodeURIComponent(lang)}` : "";
      const qMed = med ? `&mediator=${encodeURIComponent(med)}` : "";
      const res = await fetch(`${BACKEND_URL}/api/flashcards?userId=${effectiveUserId}${qLang}${qMed}`, {
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
  const fetchGrammarTopics = async (lang = targetLanguage) => {
    try {
      const activeLang = String(lang || "russian").toLowerCase().trim();
      const res = await fetch(`${BACKEND_URL}/api/grammar?userId=${effectiveUserId}&language=${encodeURIComponent(activeLang)}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setGrammarTopics(data.topics || []);
      }
    } catch (err) {
      console.error("Failed to fetch grammar topics:", err);
    }
  };

  // Safe PDF Download for Web & Telegram MiniApp
  const triggerDownload = (endpoint, filename) => {
    const separator = endpoint.includes("?") ? "&" : "?";
    // 1. Pass filename to the backend so Content-Disposition sets the exact name
    const downloadUrl = `${BACKEND_URL}${endpoint}${separator}userId=${effectiveUserId}&filename=${encodeURIComponent(filename || "document.pdf")}`;

    // 2. In Telegram MiniApp, use openLink so native Telegram app opens the link externally
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(downloadUrl);
    } else {
      // 3. In WebApp (Browser), use an <a> tag with explicit download attribute for clean file naming
      const a = document.createElement("a");
      a.href = downloadUrl;
      if (filename) a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadAllGrammarPdf = () => {
    const activeLang = String(targetLanguage || "russian").toLowerCase().trim();
    showToast(`Generating Complete Grammar Book PDF (${activeLang.toUpperCase()})...`, "info");
    triggerDownload(`/api/grammar/pdf?language=${encodeURIComponent(activeLang)}`, `Grammar_Book_${activeLang}.pdf`);
  };

  const handleDownloadVocabPdf = () => {
    showToast("Generating Vocabulary Notebook PDF...", "info");
    triggerDownload(
      `/api/vocabulary/pdf?language=${encodeURIComponent(targetLanguage)}&mediator=${encodeURIComponent(mediatorLanguage)}`,
      `Vocabulary_${targetLanguage}_${mediatorLanguage}.pdf`
    );
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

  const startAiGame = async (gameType, nextRound = 1) => {
    setLoadingAiGame(true);
    setGameRound(nextRound);
    showToast(`🤖 Level ${targetLanguage.toUpperCase()}: Round ${nextRound} loading...`, "info");

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/games/ai-cards?userId=${effectiveUserId}&round=${nextRound}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.cards) && data.cards.length > 0) {
          setAiGameCards(data.cards);
          setActiveGame(gameType);
          setLoadingAiGame(false);
          return;
        }
      }
    } catch (e) {
      console.warn("AI game generation error:", e.message);
    }

    setAiGameCards([]);
    setActiveGame(gameType);
    setLoadingAiGame(false);
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
      <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              style={themeColors.brand?.iconStyle}
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-lg border transition-all duration-500"
            >
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg leading-tight text-white flex items-center gap-2">
                <span>Language Immersion Coach</span>
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-lg border border-cyan-800/80">
                  Target: {targetLanguage ? targetLanguage.toUpperCase() : "ENGLISH"}
                </span>
                <span>•</span>
                <span>{flashcards.length} Words Saved</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dynamic AI Color Harmonizer Controls */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-inner gap-1">
              <button
                type="button"
                id="toggle-palette-theme-btn"
                onClick={() => {
                  const currentIndex = PRESET_THEMES.findIndex((t) => t.id === themeId);
                  const nextTheme = PRESET_THEMES[(currentIndex + 1) % PRESET_THEMES.length];
                  setThemeId(nextTheme.id);
                  try {
                    localStorage.setItem("spk_theme_id", nextTheme.id);
                  } catch {}
                  showToast(`Theme: ${nextTheme.name}`, "info");
                }}
                style={themeColors.brand?.badgeStyle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-105 shadow-sm cursor-pointer active:scale-95"
                title="Cycle AI Harmonic Theme"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{activeTheme.themeMeta.name}</span>
              </button>

              <button
                type="button"
                id="shift-hue-rotation-btn"
                onClick={() => {
                  setRotationIndex((prev) => prev + 1);
                  showToast("Palette hue rotated smoothly!", "info");
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Shift Colors Now"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleDownloadAllGrammarPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              title="Download Complete Grammar Book (PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grammar Book</span> (PDF)
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Only visible when not actively inside a game screen) */}
        {!activeGame && (
          <div className="max-w-6xl mx-auto mt-3.5 flex border-b border-slate-800/80 gap-6 sm:gap-8">
            <button
              onClick={() => setActiveTab("games")}
              className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "games"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Practice Games & Drills</span>
            </button>

            <button
              onClick={() => setActiveTab("grammar")}
              className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "grammar"
                ? "border-violet-400 text-violet-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Grammar Book & Rules</span>
              <span className="text-[10px] bg-violet-950 text-violet-300 border border-violet-800 px-2 py-0.5 rounded-full font-black">
                {grammarTopics.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("roadmap")}
              className={`pb-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "roadmap"
                ? "border-amber-400 text-amber-300"
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
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start">
        {/* ========================================================================= */}
        {/* ACTIVE GAME SCREENS                                                       */}
        {/* ========================================================================= */}
        {activeGame === "flashcards" && (
          <div onClick={async () => {
            if (flashcards.length > 0) {
              setActiveGame("flashcards");
            } else {
              // Instant check to make sure state isn't just stale
              const res = await fetch(`${BACKEND_URL}/api/flashcards?userId=${effectiveUserId}&language=${encodeURIComponent(targetLanguage)}&mediator=${encodeURIComponent(mediatorLanguage)}`, { headers: getHeaders() });
              const data = await res.json();
              if (data.cards && data.cards.length > 0) {
                setFlashcards(data.cards);
                setActiveGame("flashcards");
              } else {
                showToast("No flashcards saved yet for this language and support language! Add words or chat with bot first.", "error");
              }
            }
          }} className="flex flex-col items-center justify-center flex-1 py-4">
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
            onClick={async () => {
              if (flashcards.length > 0) {
                setActiveGame("flashcards");
              } else {
                // Instant check to make sure state isn't just stale
                const res = await fetch(`${BACKEND_URL}/api/flashcards?userId=${effectiveUserId}&language=${encodeURIComponent(targetLanguage)}&mediator=${encodeURIComponent(mediatorLanguage)}`, { headers: getHeaders() });
                const data = await res.json();
                if (data.cards && data.cards.length > 0) {
                  setFlashcards(data.cards);
                  setActiveGame("flashcards");
                } else {
                  showToast("No flashcards saved yet for this language and support language! Add words or chat with bot first.", "error");
                }
              }
            }}
            cards={flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            onExit={() => setActiveGame(null)}
            onSaveWord={handleSaveWordToDeck}

          />
        )}

        {activeGame === "listening" && (
          <ListeningGame
            cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            round={gameRound}
            onNextRound={() => startAiGame("listening", gameRound + 1)}
            onExit={() => {
              setActiveGame(null);
              setAiGameCards([]);
              setGameRound(1);
            }}
            onSaveWord={handleSaveWordToDeck}
          />
        )}

        {activeGame === "match" && (
          <ListeningMatch
            cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            round={gameRound}
            onNextRound={() => startAiGame("match", gameRound + 1)}
            onExit={() => {
              setActiveGame(null);
              setAiGameCards([]);
              setGameRound(1);
            }}
            onSaveWord={handleSaveWordToDeck}
          />
        )}

        {activeGame === "speaking" && (
          <SpeakingGame
            cards={aiGameCards.length > 0 ? aiGameCards : flashcards}
            API={BACKEND_URL}
            authHeaders={getHeaders()}
            round={gameRound}
            onNextRound={() => startAiGame("speaking", gameRound + 1)}
            onExit={() => {
              setActiveGame(null);
              setAiGameCards([]);
              setGameRound(1);
            }}
            onSaveWord={handleSaveWordToDeck}
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

        {activeGame === "cubeGame" && (
          <CubeWordGame
            onClose={() => {
              // Pick up whatever high score the game just wrote to
              // localStorage so the hub card reflects it immediately.
              try {
                setCubeGameHighScore(Number(localStorage.getItem("cubeword_highscore") || "0"));
              } catch {
                // ignore
              }
              setActiveGame(null);
            }}
            initialLanguage={cubeGameLanguage}
            apiBase={BACKEND_URL}
            onSaveToVocabulary={handleSaveWordFromCubeGame}
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
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm"
                  >
                    <span>➕ Add Custom Word</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 0. 3D Cube Word Game (full-width feature card) */}
            <CubeWordCard
              onLaunchGame={startCubeGame}
              highScore={cubeGameHighScore}
              currentLanguage={cubeGameLanguage}
              palette={themeColors.cubeCard}
            />

            {/* 6 Game Mode Cards with Expanded Dimensions & Dynamic Color Harmonizer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {/* 1. Spaced Repetition Flashcards */}
              <div
                id="card-flashcards-deck"
                style={themeColors.flashcards?.style}
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("flashcards");
                  else showToast("No flashcards saved yet! Chat with bot first.", "error");
                }}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.flashcards?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-cyan-200 transition-colors">Vocabulary Flashcards</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Spaced repetition deck with base lemmas, phonetics, rules, and example sentences.
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">{flashcards.length} cards saved</span>
                  <span style={{ color: themeColors.flashcards?.hex || '#a855f7' }}>Start Practice →</span>
                </div>
              </div>

              {/* 2. Vocabulary Quiz */}
              <div
                id="card-smart-quiz"
                style={themeColors.quiz?.style}
                onClick={() => {
                  if (flashcards.length > 0) setActiveGame("quiz");
                  else showToast("Save at least 1 word before playing Quiz!", "error");
                }}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.quiz?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-emerald-200 transition-colors">Smart Recall Quiz</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Test your memory with multiple choice or text entry. Graded dynamically with synonyms accepted!
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Adaptive grading</span>
                  <span style={{ color: themeColors.quiz?.hex || '#10b981' }}>Take Quiz →</span>
                </div>
              </div>

              {/* 3. Listening Quiz */}
              <div
                id="card-listening-game"
                style={themeColors.listening?.style}
                onClick={() => {
                  if (!loadingAiGame) startAiGame("listening");
                }}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.listening?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <Headphones className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-sky-200 transition-colors">Listening Comprehension</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Audio-only challenge: listen to the native pronunciation, then type or choose the meaning.
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Ear training</span>
                  <span style={{ color: themeColors.listening?.hex || '#38bdf8' }}>Listen Now →</span>
                </div>
              </div>

              {/* 4. Sound Match */}
              <div
                id="card-sound-match"
                style={themeColors.match?.style}
                onClick={() => {
                  if (!loadingAiGame) startAiGame("match");
                }}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.match?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-amber-200 transition-colors">Sound Match</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Fast-paced audio memory game: match the spoken sound tile with its written translation.
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Combo bonuses</span>
                  <span style={{ color: themeColors.match?.hex || '#f59e0b' }}>Match Tiles →</span>
                </div>
              </div>

              {/* 5. Speaking Drill */}
              <div
                id="card-speaking-drill"
                style={themeColors.speaking?.style}
                onClick={() => {
                  if (!loadingAiGame) startAiGame("speaking");
                }}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.speaking?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <Mic className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-rose-200 transition-colors">Pronunciation & Speech</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Speak words into your microphone. Real-time accuracy scoring and phonetic feedback!
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Microphone drill</span>
                  <span style={{ color: themeColors.speaking?.hex || '#f43f5e' }}>Practice Speech →</span>
                </div>
              </div>

              {/* 6. Grammar Reference Book Tile */}
              <div
                id="card-grammar-book"
                style={themeColors.grammar?.style}
                onClick={() => setActiveTab("grammar")}
                className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 border-2 p-6 sm:p-7 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between group min-h-[220px] sm:min-h-[240px]"
              >
                <div>
                  <div
                    style={themeColors.grammar?.iconStyle}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border shadow-md"
                  >
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-base sm:text-lg text-white group-hover:text-violet-200 transition-colors">Grammar Book & Rules</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    View saved grammar rules, verb conjugation tables, and download publication-ready PDFs.
                  </p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">{grammarTopics.length} saved rules</span>
                  <span style={{ color: themeColors.grammar?.hex || '#8b5cf6' }}>Open Book →</span>
                </div>
              </div>
            </div>
          </div>
        )
        }

        {/* ========================================================================= */}
        {/* TAB 2: GRAMMAR REFERENCE BOOK                                             */}
        {/* ========================================================================= */}
        {
          !activeGame && activeTab === "grammar" && (
            <GrammarBook
              API={BACKEND_URL}
              authHeaders={getHeaders()}
              effectiveUserId={effectiveUserId}
              onExit={() => setActiveTab("games")}
            />
          )
        }

        {/* ========================================================================= */}
        {/* TAB 3: LEARNING ROADMAP & STUDY PLAN                                    */}
        {/* ========================================================================= */}
        {
          !activeGame && activeTab === "roadmap" && (
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
          )
        }
        {
          showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-left">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>➕ Add Word to Flashcards</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {targetLanguage.toUpperCase()}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddCustomWord} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Word in {targetLanguage.toUpperCase()} (Base lemma):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. apple, книга, laufen..."
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Translation / Meaning:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. яблоко, book, to run..."
                      value={newMeaning}
                      onChange={(e) => setNewMeaning(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-700 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newWord.trim() || !newMeaning.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      Save to Deck
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }
      </main>
    </div>
  );
}