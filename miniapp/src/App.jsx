import React, { useState, useEffect } from "react";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Summary from "./components/Summary.jsx";

export default function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });

  // Get userId from URL params or Telegram WebApp
  // try {

  const userId = new URLSearchParams(window.location.search).get("userId")
    ||
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  // }
  // catch (error) { console.log(error.message) };

  useEffect(() => {
    if (window.Telegram?.WebApp) {

      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    console.log(userId);
    // Load flashcards from bot API
    fetch(`/api/flashcards?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards || []);
        setLoading(false);
      })
      .catch((error) => {
        // Demo cards for testing without backend
        setCards([
          { id: 1, word: "tengo hambre", correction: "I am hungry", context: "Used to express hunger in Spanish" },
          { id: 2, word: "hace calor", correction: "It is hot", context: "Weather expressions in Spanish" },
          { id: 3, word: "me llamo", correction: "My name is", context: "Introducing yourself in Spanish" },
        ]);
        setLoading(false);
        console.log(error.message);
      })
  }, [userId]);

  function handleResult(cardId, remembered) {
    // Update stats
    setStats((prev) => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      forgot: prev.forgot + (remembered ? 0 : 1),
    }));

    // Report to backend
    fetch(`/api/flashcards/${cardId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remembered }),
    }).catch((error) => { console.log(error.message) });

    // Remove from deck
    setCards((prev) => prev.filter((c) => c.id !== cardId));

    if (cards.length <= 1) setDone(true);
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
      {/* Header */}
      <div className="w-full max-w-sm mb-6">
        <h1 className="text-xl font-bold text-center text-white mb-1">
          📚 Flashcard Review
        </h1>
        <p className="text-center text-slate-400 text-sm">
          {cards.length} card{cards.length !== 1 ? "s" : ""} remaining
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{
              width: `${((stats.remembered + stats.forgot) /
                (stats.remembered + stats.forgot + cards.length)) * 100}%`,
            }}
          />
        </div>
      </div>

      <FlashcardDeck cards={cards} onResult={handleResult} />

      {/* Instructions */}
      <p className="mt-6 text-slate-500 text-xs text-center">
        Tap the card to reveal • ✅ remembered • ❌ forgot
      </p>
    </div>
  );
}
