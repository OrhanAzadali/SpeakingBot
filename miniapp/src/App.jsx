import React, { useState, useEffect } from "react";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Summary from "./components/Summary.jsx";
import Quiz from "./components/Quiz.jsx";

// You MUST set VITE_API_URL in Vercel dashboard under Project → Settings → Environment Variables.
// No hardcoded fallback here on purpose: a stale fallback URL silently keeps working
// after a redeploy and hides the fact that VITE_API_URL was never configured.
const API = import.meta.env.VITE_API_URL;
if (!API) {
  console.warn("VITE_API_URL is not set — set it in Vercel → Project Settings → Environment Variables.");
}

const DEMO_CARDS = [
  { id: 1, word: "tengo hambre", correction: "I am hungry", context: "Used to express hunger in Spanish" },
  { id: 2, word: "hace calor", correction: "It is hot", context: "Weather expressions in Spanish" },
  { id: 3, word: "me llamo", correction: "My name is", context: "Introducing yourself in Spanish" },
];

export default function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // null | "flashcards" | "quiz"
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
  const [apiError, setApiError] = useState(null);

  // The server derives the trusted user identity — and, from it, which
  // language's cards to return — from this signed string. It verifies
  // initData's HMAC using the bot token, so neither the user nor the
  // language can be spoofed via the URL the way they could before. Outside
  // of an actual Telegram session, this is empty and the API calls below
  // will 401, which the existing catch-block handles by falling back to
  // demo cards.
  const initData = window.Telegram?.WebApp?.initData || "";
  const authHeaders = initData ? { Authorization: `tma ${initData}` } : {};

  function loadCards() {
    setLoading(true);
    setDone(false);
    setStats({ remembered: 0, forgot: 0 });

    if (!API) {
      console.warn("VITE_API_URL is not set — using demo cards");
      setCards(DEMO_CARDS);
      setLoading(false);
      return;
    }

    fetch(`${API}/api/flashcards`, { headers: authHeaders })
      .then((r) => {
        if (!r.ok) {
          // This is what catches 404, 500, etc. — fetch doesn't throw on HTTP errors!
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then((data) => {
        setCards(data.cards || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("API error:", error.message);
        setApiError(error.message);
        setCards(DEMO_CARDS);
        setLoading(false);
      });
  }

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    loadCards();
  }, [initData]);

  function handleResult(cardId, remembered) {
    setStats((prev) => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      forgot: prev.forgot + (remembered ? 0 : 1),
    }));

    if (API) {
      fetch(`${API}/api/flashcards/${cardId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ remembered }),
      }).catch((error) => console.error("Review error:", error.message));
    }

    setCards((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      // Check length AFTER filtering (fixes stale state bug)
      if (next.length === 0) setDone(true);
      return next;
    });
  }

  // Returning to mode-select re-fetches so both games always start from the
  // current full set — e.g. words the Quiz just mastered (deleted
  // server-side) shouldn't still show up if the user picks Flashcards next.
  function backToModeSelect() {
    setMode(null);
    loadCards();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🌀</div>
          <p className="text-slate-400">Loading your flashcards...</p>
        </div>
      </div>
    );
  }

  // ── Mode select ──────────────────────────────────────────────────────────────
  if (!mode) {
    if (cards.length === 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">No words to practice yet!</h1>
          <p className="text-slate-400">Keep chatting with the bot — tricky words get saved here automatically.</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-1">Choose a game</h1>
        <p className="text-slate-400 mb-8">
          {cards.length} word{cards.length !== 1 ? "s" : ""} ready to practice
        </p>
        <div className="w-full max-w-xs flex flex-col gap-4">
          <button
            onClick={() => setMode("flashcards")}
            className="w-full py-5 px-4 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all text-left"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          >
            <div className="text-4xl mb-2">📚</div>
            <div className="text-white font-semibold">Flashcards</div>
            <div className="text-slate-400 text-sm mt-1">Flip each card and rate what you remember</div>
          </button>
          <button
            onClick={() => setMode("quiz")}
            className="w-full py-5 px-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:brightness-110 active:scale-95 transition-all text-left"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          >
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-white font-semibold">Quiz</div>
            <div className="text-indigo-100 text-sm mt-1">Type or choose the right answer — 3 in a row masters it</div>
          </button>
        </div>
        {apiError && (
          <p className="text-center text-yellow-500 text-xs mt-6">⚠️ Using demo cards (API: {apiError})</p>
        )}
      </div>
    );
  }

  // ── Quiz mode ─────────────────────────────────────────────────────────────────
  if (mode === "quiz") {
    return <Quiz cards={cards} API={API} authHeaders={authHeaders} onExit={backToModeSelect} />;
  }

  // ── Flashcards mode ───────────────────────────────────────────────────────────
  if (done || cards.length === 0) {
    return (
      <Summary
        stats={stats}
        total={stats.remembered + stats.forgot}
        onExit={backToModeSelect}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm mb-6">
        <h1 className="text-xl font-bold text-center text-white mb-1">
          📚 Flashcard Review
        </h1>
        <p className="text-center text-slate-400 text-sm">
          {cards.length} card{cards.length !== 1 ? "s" : ""} remaining
        </p>
        {apiError && (
          <p className="text-center text-yellow-500 text-xs mt-1">
            ⚠️ Using demo cards (API: {apiError})
          </p>
        )}
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{
              width: `${((stats.remembered + stats.forgot) /
                (stats.remembered + stats.forgot + cards.length)) *
                100
                }%`,
            }}
          />
        </div>
      </div>

      <FlashcardDeck cards={cards} onResult={handleResult} />

      <p className="mt-6 text-slate-500 text-xs text-center">
        Tap the card to reveal • ✅ remembered • ❌ forgot
      </p>
    </div>
  );
}