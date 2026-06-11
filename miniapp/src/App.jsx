import React, { useState, useEffect } from "react";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Summary from "./components/Summary.jsx";

// Fallback: if env var is missing, try to infer from current origin or use empty string
// You MUST set VITE_API_URL in Vercel dashboard under Project → Settings → Environment Variables
const API = import.meta.env.VITE_API_URL || "";
console.log(API);

const DEMO_CARDS = [
  { id: 1, word: "tengo hambre", correction: "I am hungry", context: "Used to express hunger in Spanish" },
  { id: 2, word: "hace calor", correction: "It is hot", context: "Weather expressions in Spanish" },
  { id: 3, word: "me llamo", correction: "My name is", context: "Introducing yourself in Spanish" },
];

export default function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
  const [apiError, setApiError] = useState(null);

  const userId =
    new URLSearchParams(window.location.search).get("userId") ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // If no API URL configured, skip fetch and use demo cards
    if (!API) {
      console.warn("VITE_API_URL is not set — using demo cards");
      setCards(DEMO_CARDS);
      setLoading(false);
      return;
    }

    const url = `${API}/api/flashcards${userId ? `?userId=${userId}` : ""}`;
    console.log("Fetching:", url);

    fetch(url)
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
  }, [userId]);

  function handleResult(cardId, remembered) {
    setStats((prev) => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      forgot: prev.forgot + (remembered ? 0 : 1),
    }));

    if (API) {
      fetch(`${API}/api/flashcards/${cardId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (done || cards.length === 0) {
    return <Summary stats={stats} total={stats.remembered + stats.forgot} />;
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