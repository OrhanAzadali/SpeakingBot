// App.jsx
import React, { useState, useEffect, useRef } from "react";
import FlashcardDeck from "./components/FlashcardDeck.jsx";
import Summary from "./components/Summary.jsx";
import Quiz from "./components/Quiz.jsx";
import Quiz from "./components/Quiz.jsx";
import ListeningGame from "./components/ListeningGame.jsx";
// Strip any trailing slashes to prevent double-slash 404/CORS errors
const API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
if (!API) {
  console.warn("VITE_API_URL is not set — set it in Vercel → Project Settings → Environment Variables.");
}

// How often to check for newly-added flashcards while the user is actively reviewing
const NEW_CARD_POLL_MS = 6000;

const DEMO_CARDS = [
  {
    id: 1,
    word: "остальной",
    initial_form: "остальной",
    used_form: "остальные",
    part_of_speech: "pronoun / adjective",
    transcription: "[əstɐlʲˈnoj] — а-сталʲ-но́й",
    pronunciation_rule: "Первая «о» редуцируется в [ə], вторая «о» в [ɐ], ударение на третий слог.",
    correction: "the rest, remaining ones",
    synonyms: "rest, others, remaining",
    explanation: "Refers to remaining people or items from a set group.",
    sentence: "Где <u>остальные</u> студенты?",
  },
  {
    id: 2,
    word: "tener hambre",
    initial_form: "tener hambre",
    used_form: "tengo hambre",
    part_of_speech: "idiomatic verb phrase",
    transcription: "[teˈneɾ ˈambɾe] — тэ-нэ́р а́мб-рэ",
    pronunciation_rule: "Буква «h» в слове «hambre» немая и никогда не произносится.",
    correction: "to be hungry",
    synonyms: "famished, starving",
    explanation: "Spanish expresses hunger with 'tener' (to have) instead of 'to be'.",
    sentence: "После пробежки я голоден: <u>tengo hambre</u>.",
  }
];

export default function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // null | "flashcards" | "quiz"
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
  const [apiError, setApiError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Every card id we've already shown this session
  const knownCardIdsRef = useRef(new Set());

  // Helper to dynamically extract trusted Telegram credentials with fallback
  function getAuthHeaders() {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData || "";
    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromUrl = urlParams.get("userId") || tg?.initDataUnsafe?.user?.id;

    const headers = {
      "Content-Type": "application/json",
    };
    if (initData) {
      headers["Authorization"] = `tma ${initData}`;
    }
    if (userIdFromUrl) {
      headers["X-User-Id"] = String(userIdFromUrl);
    }
    return headers;
  }

  // Telegram Native BackButton Integration
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    if (mode) {
      tg.BackButton.show();
      const handleBack = () => backToModeSelect();
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [mode]);

  function loadCards() {
    setLoading(true);
    setDone(false);
    setStats({ remembered: 0, forgot: 0 });

    if (!API) {
      console.warn("VITE_API_URL is not set — using demo cards");
      knownCardIdsRef.current = new Set(DEMO_CARDS.map((c) => c.id));
      setCards(DEMO_CARDS);
      setLoading(false);
      return;
    }

    const headers = getAuthHeaders();
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId") || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "";
    const fetchUrl = `${API}/api/flashcards${userId ? `?userId=${userId}` : ""}`;

    fetch(fetchUrl, { headers })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then((data) => {
        const fresh = data.cards || [];
        knownCardIdsRef.current = new Set(fresh.map((c) => c.id));
        setCards(fresh); // API returns newest cards first (ORDER BY id DESC)
        setApiError(null);
        setLoading(false);
      })
      .catch((error) => {
        console.error("API error loading flashcards:", error.message);
        setApiError(error.message);
        knownCardIdsRef.current = new Set(DEMO_CARDS.map((c) => c.id));
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
  }, []);

  // Background Poller: Prepend newly saved chat mistakes directly to the top of the deck
  useEffect(() => {
    if (done || !API) return;

    const interval = setInterval(async () => {
      try {
        const headers = getAuthHeaders();
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get("userId") || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "";
        const fetchUrl = `${API}/api/flashcards${userId ? `?userId=${userId}` : ""}`;

        const res = await fetch(fetchUrl, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const incomingCards = data.cards || [];
        const brandNewCards = incomingCards.filter((c) => !knownCardIdsRef.current.has(c.id));

        if (brandNewCards.length === 0) return;

        brandNewCards.forEach((c) => knownCardIdsRef.current.add(c.id));
        // Add new cards to the front
        setCards((prev) => [...brandNewCards, ...prev]);
      } catch (error) {
        console.error("Poll for new cards failed:", error.message);
      }
    }, NEW_CARD_POLL_MS);

    return () => clearInterval(interval);
  }, [mode, done]);

  function handleResult(cardId, remembered) {
    setStats((prev) => ({
      remembered: prev.remembered + (remembered ? 1 : 0),
      forgot: prev.forgot + (remembered ? 0 : 1),
    }));

    if (API) {
      const headers = getAuthHeaders();
      fetch(`${API}/api/flashcards/${cardId}/review`, {
        method: "POST",
        headers,
        body: JSON.stringify({ remembered }),
      }).catch((error) => console.error("Review error:", error.message));
    }

    setCards((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      if (next.length === 0) setDone(true);
      return next;
    });
  }

  // Direct in-app PDF Downloader
  async function handleDownloadPdf(endpoint, filename) {
    if (!API) {
      alert("API is not connected in demo mode.");
      return;
    }
    setPdfLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API}${endpoint}`, { headers });
      if (!res.ok) throw new Error(`Download error (HTTP ${res.status})`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("PDF download failed:", err.message);
      alert("Could not download PDF. Please make sure you have saved vocabulary or a roadmap first.");
    } finally {
      setPdfLoading(false);
    }
  }

  function backToModeSelect() {
    setMode(null);
    loadCards();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🌀</div>
          <p className="text-slate-400 text-sm">Loading your vocabulary...</p>
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
          <p className="text-slate-400 text-sm mb-6">Keep chatting with the bot — any mistakes get saved here automatically in base form.</p>
          <button
            onClick={() => handleDownloadPdf("/api/roadmap/pdf", "My_Learning_Roadmap.pdf")}
            disabled={pdfLoading}
            className="py-3 px-5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-2"
          >
            <span>📈</span> {pdfLoading ? "Preparing PDF..." : "Download Learning Roadmap PDF"}
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center py-8">
        <h1 className="text-2xl font-bold text-white mb-1">Choose a game</h1>
        <p className="text-slate-400 mb-6 text-sm">
          {cards.length} word{cards.length !== 1 ? "s" : ""} ready to practice
        </p>

        {/* Game Mode Cards */}
        <div className="w-full max-w-xs flex flex-col gap-4">
          <button
            onClick={() => setMode("flashcards")}
            className="w-full py-5 px-4 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all text-left"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          >
            <div className="text-4xl mb-2">📚</div>
            <div className="text-white font-semibold">Flashcards</div>
            <div className="text-slate-400 text-xs mt-1">Review base lemmas, phonetics, grammar notes, and sentences</div>
          </button>

          <button
            onClick={() => setMode("quiz")}
            className="w-full py-5 px-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:brightness-110 active:scale-95 transition-all text-left"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          >
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-white font-semibold">Smart Quiz</div>
            <div className="text-indigo-100 text-xs mt-1">AI evaluates synonyms & meanings — 3 in a row masters the word</div>
          </button>
          <button
            onClick={() => setMode("listening")}
            className="w-full py-5 px-4 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 hover:brightness-110 active:scale-95 transition-all text-left"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          >
            <div className="text-4xl mb-2">🎧</div>
            <div className="text-white font-semibold">Listening</div>
            <div className="text-cyan-100 text-xs mt-1">Hear the word first — type or pick what it means</div>
          </button>
        </div>

        {/* PDF Materials Download Section */}
        <div className="w-full max-w-xs flex flex-col gap-2.5 mt-6 pt-5 border-t border-slate-800">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold text-center mb-1">
            Downloadable PDF Materials
          </p>

          <button
            onClick={() => handleDownloadPdf("/api/vocabulary/pdf", "My_Vocabulary_Notebook.pdf")}
            disabled={pdfLoading}
            className="w-full py-3 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>📥</span> {pdfLoading ? "Compiling..." : "Download Vocabulary Notebook (PDF)"}
          </button>

          <button
            onClick={() => handleDownloadPdf("/api/roadmap/pdf", "My_Learning_Roadmap.pdf")}
            disabled={pdfLoading}
            className="w-full py-3 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>📈</span> {pdfLoading ? "Compiling..." : "Download Learning Roadmap (PDF)"}
          </button>
        </div>

        {apiError && (
          <p className="text-center text-yellow-500 text-xs mt-6">⚠️ Using demo cards (API: {apiError})</p>
        )}
      </div>
    );
  }
  // ── Listening mode ────────────────────────────────────────────────────────────
  if (mode === "listening") {
    return <ListeningGame cards={cards} API={API} authHeaders={getAuthHeaders()} onExit={backToModeSelect} />;
  }
  // ── Quiz mode ─────────────────────────────────────────────────────────────────
  if (mode === "quiz") {
    return <Quiz cards={cards} API={API} authHeaders={getAuthHeaders()} onExit={backToModeSelect} />;
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
        <p className="text-center text-slate-400 text-xs">
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

      <FlashcardDeck key={cards[0]?.id ?? "empty"} cards={cards} onResult={handleResult} />

      <p className="mt-6 text-slate-500 text-xs text-center">
        Tap to reveal • ✅ remembered • ❌ forgot
      </p>

    </div>
  );
}
// import React, { useState, useEffect, useRef } from "react";
// import FlashcardDeck from "./components/FlashcardDeck.jsx";
// import Summary from "./components/Summary.jsx";
// import Quiz from "./components/Quiz.jsx";

// // You MUST set VITE_API_URL in Vercel dashboard under Project → Settings → Environment Variables.
// // No hardcoded fallback here on purpose: a stale fallback URL silently keeps working
// // after a redeploy and hides the fact that VITE_API_URL was never configured.
// const API = import.meta.env.VITE_API_URL;
// if (!API) {
//   console.warn("VITE_API_URL is not set — set it in Vercel → Project Settings → Environment Variables.");
// }

// // How often to check for newly-added flashcards while the user is actively
// // reviewing (e.g. the bot just caught a fresh mistake in the Telegram chat).
// const NEW_CARD_POLL_MS = 7000;

// const DEMO_CARDS = [
//   { id: 1, word: "tengo hambre", correction: "I am hungry", context: "Used to express hunger in Spanish" },
//   { id: 2, word: "hace calor", correction: "It is hot", context: "Weather expressions in Spanish" },
//   { id: 3, word: "me llamo", correction: "My name is", context: "Introducing yourself in Spanish" },
// ];

// export default function App() {
//   const [cards, setCards] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [mode, setMode] = useState(null); // null | "flashcards" | "quiz"
//   const [done, setDone] = useState(false);
//   const [stats, setStats] = useState({ remembered: 0, forgot: 0 });
//   const [apiError, setApiError] = useState(null);

//   // Every card id we've already shown this session (across loads, merges,
//   // and reviews). Used by the polling effect below to tell a genuinely new
//   // server-side card apart from one already in the deck or already reviewed
//   // away — a plain "not in current cards state" check would be wrong here,
//   // since a mastered/removed card is also "not in current cards state".
//   const knownCardIdsRef = useRef(new Set());

//   // The server derives the trusted user identity — and, from it, which
//   // language's cards to return — from this signed string. It verifies
//   // initData's HMAC using the bot token, so neither the user nor the
//   // language can be spoofed via the URL the way they could before. Outside
//   // of an actual Telegram session, this is empty and the API calls below
//   // will 401, which the existing catch-block handles by falling back to
//   // demo cards.
//   const initData = window.Telegram?.WebApp?.initData || "";
//   const authHeaders = initData ? { Authorization: `tma ${initData}` } : {};

//   function loadCards() {
//     setLoading(true);
//     setDone(false);
//     setStats({ remembered: 0, forgot: 0 });

//     if (!API) {
//       console.warn("VITE_API_URL is not set — using demo cards");
//       knownCardIdsRef.current = new Set(DEMO_CARDS.map((c) => c.id));
//       setCards(DEMO_CARDS);
//       setLoading(false);
//       return;
//     }

//     fetch(`${API}/api/flashcards`, { headers: authHeaders })
//       .then((r) => {
//         if (!r.ok) {
//           // This is what catches 404, 500, etc. — fetch doesn't throw on HTTP errors!
//           throw new Error(`HTTP ${r.status}: ${r.statusText}`);
//         }
//         return r.json();
//       })
//       .then((data) => {
//         const fresh = data.cards || [];
//         knownCardIdsRef.current = new Set(fresh.map((c) => c.id));
//         setCards(fresh);
//         setLoading(false);
//       })
//       .catch((error) => {
//         console.error("API error:", error.message);
//         setApiError(error.message);
//         knownCardIdsRef.current = new Set(DEMO_CARDS.map((c) => c.id));
//         setCards(DEMO_CARDS);
//         setLoading(false);
//       });
//   }

//   useEffect(() => {
//     if (window.Telegram?.WebApp) {
//       window.Telegram.WebApp.ready();
//       window.Telegram.WebApp.expand();
//     }
//     loadCards();
//   }, [initData]);

//   // While actively reviewing flashcards, periodically check whether any new
//   // words showed up server-side (the bot saves a flashcard the instant it
//   // catches a mistake in the Telegram chat, independent of this session).
//   // If so, prepend them to the front of the deck — the API already returns
//   // newest-first, so `fresh` is already in the right order — so the newest
//   // mistake is reviewed next instead of silently waiting off-screen until
//   // the user backs out to the mode-select screen and back in.
//   useEffect(() => {
//     if (mode !== "flashcards" || done || !API) return;

//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(`${API}/api/flashcards`, { headers: authHeaders });
//         if (!res.ok) return;
//         const data = await res.json();
//         const fresh = (data.cards || []).filter((c) => !knownCardIdsRef.current.has(c.id));
//         if (fresh.length === 0) return;

//         fresh.forEach((c) => knownCardIdsRef.current.add(c.id));
//         setCards((prev) => [...fresh, ...prev]);
//       } catch (error) {
//         console.error("Poll for new flashcards failed:", error.message);
//       }
//     }, NEW_CARD_POLL_MS);

//     return () => clearInterval(interval);
//   }, [mode, done, initData]);

//   function handleResult(cardId, remembered) {
//     setStats((prev) => ({
//       remembered: prev.remembered + (remembered ? 1 : 0),
//       forgot: prev.forgot + (remembered ? 0 : 1),
//     }));

//     if (API) {
//       fetch(`${API}/api/flashcards/${cardId}/review`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", ...authHeaders },
//         body: JSON.stringify({ remembered }),
//       }).catch((error) => console.error("Review error:", error.message));
//     }

//     setCards((prev) => {
//       const next = prev.filter((c) => c.id !== cardId);
//       // Check length AFTER filtering (fixes stale state bug)
//       if (next.length === 0) setDone(true);
//       return next;
//     });
//   }

//   // Returning to mode-select re-fetches so both games always start from the
//   // current full set — e.g. words the Quiz just mastered (deleted
//   // server-side) shouldn't still show up if the user picks Flashcards next.
//   function backToModeSelect() {
//     setMode(null);
//     loadCards();
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <div className="text-4xl mb-4 animate-spin">🌀</div>
//           <p className="text-slate-400">Loading your flashcards...</p>
//         </div>
//       </div>
//     );
//   }

//   // ── Mode select ──────────────────────────────────────────────────────────────
//   if (!mode) {
//     if (cards.length === 0) {
//       return (
//         <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
//           <div className="text-6xl mb-6">🎉</div>
//           <h1 className="text-2xl font-bold text-white mb-2">No words to practice yet!</h1>
//           <p className="text-slate-400">Keep chatting with the bot — tricky words get saved here automatically.</p>
//         </div>
//       );
//     }

//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
//         <h1 className="text-2xl font-bold text-white mb-1">Choose a game</h1>
//         <p className="text-slate-400 mb-8">
//           {cards.length} word{cards.length !== 1 ? "s" : ""} ready to practice
//         </p>
//         <div className="w-full max-w-xs flex flex-col gap-4">
//           <button
//             onClick={() => setMode("flashcards")}
//             className="w-full py-5 px-4 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all text-left"
//             style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
//           >
//             <div className="text-4xl mb-2">📚</div>
//             <div className="text-white font-semibold">Flashcards</div>
//             <div className="text-slate-400 text-sm mt-1">Flip each card and rate what you remember</div>
//           </button>
//           <button
//             onClick={() => setMode("quiz")}
//             className="w-full py-5 px-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:brightness-110 active:scale-95 transition-all text-left"
//             style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
//           >
//             <div className="text-4xl mb-2">🎯</div>
//             <div className="text-white font-semibold">Quiz</div>
//             <div className="text-indigo-100 text-sm mt-1">Type or choose the right answer — 3 in a row masters it</div>
//           </button>
//         </div>
//         {apiError && (
//           <p className="text-center text-yellow-500 text-xs mt-6">⚠️ Using demo cards (API: {apiError})</p>
//         )}
//       </div>
//     );
//   }

//   // ── Quiz mode ─────────────────────────────────────────────────────────────────
//   if (mode === "quiz") {
//     return <Quiz cards={cards} API={API} authHeaders={authHeaders} onExit={backToModeSelect} />;
//   }

//   // ── Flashcards mode ───────────────────────────────────────────────────────────
//   if (done || cards.length === 0) {
//     return (
//       <Summary
//         stats={stats}
//         total={stats.remembered + stats.forgot}
//         onExit={backToModeSelect}
//       />
//     );
//   }

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
//       <div className="w-full max-w-sm mb-6">
//         <h1 className="text-xl font-bold text-center text-white mb-1">
//           📚 Flashcard Review
//         </h1>
//         <p className="text-center text-slate-400 text-sm">
//           {cards.length} card{cards.length !== 1 ? "s" : ""} remaining
//         </p>
//         {apiError && (
//           <p className="text-center text-yellow-500 text-xs mt-1">
//             ⚠️ Using demo cards (API: {apiError})
//           </p>
//         )}
//         <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
//           <div
//             className="h-full bg-indigo-500 rounded-full transition-all duration-500"
//             style={{
//               width: `${((stats.remembered + stats.forgot) /
//                 (stats.remembered + stats.forgot + cards.length)) *
//                 100
//                 }%`,
//             }}
//           />
//         </div>
//       </div>

//       {/* Keying on the top card's id forces FlashcardDeck to remount (and
//           reset its local `flipped` state) whenever the front-of-deck card
//           changes — including when the poller above prepends a brand-new
//           card mid-review, so the answer side never leaks through for a card
//           the user hasn't actually flipped yet. */}
//       <FlashcardDeck key={cards[0]?.id ?? "empty"} cards={cards} onResult={handleResult} />

//       <p className="mt-6 text-slate-500 text-xs text-center">
//         Tap the card to reveal • ✅ remembered • ❌ forgot
//       </p>
//     </div>
//   );
// }

// // npm install pdfkit


// // const PDFDocument = require('pdfkit');
// // const fs = require('fs');

// // /**
// //  * Converts raw Telegram text into a PDF file
// //  * @param {string} text - The raw text message from Telegram
// //  * @param {string} outputPath - Where to save the generated PDF file
// //  */
// // function convertTelegramTextToPdf(text, outputPath) {
// //   // 1. Initialize a blank PDF document in server memory
// //   const doc = new PDFDocument({
// //     size: 'A4',
// //     margin: 50
// //   });

// //   // 2. Pipe the PDF data stream directly to a local file
// //   const writeStream = fs.createWriteStream(outputPath);
// //   doc.pipe(writeStream);

// //   // 3. Style and inject the text content
// //   doc
// //     .fontSize(20)
// //     .font('Helvetica-Bold')
// //     .text('Telegram Message Archive', { align: 'center' });

// //   // Add a spacer line
// //   doc.moveDown(1);

// //   doc
// //     .fontSize(12)
// //     .font('Helvetica')
// //     .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });

// //   doc.moveDown(2);

// //   // 4. Inject the actual message text (automatically handles text-wrapping for long text)
// //   doc
// //     .fontSize(14)
// //     .font('Helvetica')
// //     .text(text, {
// //       align: 'left',
// //       lineGap: 4
// //     });

// //   // 5. Finalize the file creation
// //   doc.end();

// //   return new Promise((resolve, reject) => {
// //     writeStream.on('finish', () => resolve(outputPath));
// //     writeStream.on('error', (err) => reject(err));
// //   });
// // }

// // const TelegramBot = require('node-telegram-bot-api');
// // const bot = new TelegramBot('YOUR_TELEGRAM_BOT_TOKEN', { polling: true });

// // bot.on('message', async (msg) => {
// //   // Ignore commands, only process regular text messages
// //   if (msg.text && !msg.text.startsWith('/')) {
// //     const chatId = msg.chat.id;
// //     const filename = `message_${msg.message_id}.pdf`;
// //     const tempPath = `./${filename}`;

// //     try {
// //       // Send a typing/uploading indicator
// //       bot.sendChatAction(chatId, 'upload_document');

// //       // Convert text to PDF file
// //       await convertTelegramTextToPdf(msg.text, tempPath);

// //       // Send the completed PDF back to the user
// //       await bot.sendDocument(chatId, tempPath, {}, {
// //         filename: filename,
// //         contentType: 'application/pdf'
// //       });

// //       // Clean up the local temporary file from the server
// //       fs.unlinkSync(tempPath);

// //     } catch (error) {
// //       console.error('PDF Generation failed:', error);
// //       bot.sendMessage(chatId, 'Sorry, there was an error generating your PDF.');
// //     }
// //   }
// // });
// // Important Rule for Non - English TextIf your Telegram messages contain Cyrillic(Russian), Arabic, or emojis, the default Helvetica font in pdfkit will break or show missing characters.You must load a custom.ttf font file(like Arial or Roboto) that supports your target language:
// // // Register a custom UTF-8 compatible font
// // doc.registerFont('CustomFont', './fonts/Roboto-Regular.ttf');
// // doc.font('CustomFont').text(text);


// // // now lets make the bot so that it would store in db words only in their firts faced, infinitive, initial form if you mean what I mean - in any language, along with the word how it was used in the sentence and the sentence itself, underlined, and so on with each word or prhase.Also, it should add a short explanation for words and synonyms in the explanatory description of each word and store that description in a separate column in db, and show it in the app / flashcard / frontend app alsow.If a word is being questioned is not the same the user answers, but still synonymically equal by meaning, it should show that description along with the word in app / flashcard / quiz.If not, it should show short explanation and the grammatical role(noun, verb, etc)







// // // FOLLOW THESE INSTRUCTIONS - ANALYZE THE CODE FILES, FIX THE ISSUES PROVIDED BELOW - AS A RESULT GIVE ME ALL NECESSARY FILES CODE CONTENT TO COPY AND PAST it in my own files in VS Code on my own:



// // // - Bot SHOULD include a quiz feature that compares user answers to correct answers; goal is to replace character - level string comparison with AI - powered semantic comparison(e.g.via Groq)



// // //   - Bot SHOULD detect mistakes USING GROG AI API in user's textual input by their meaning and grammar - not by their exact strict character equality; goal is full-content mistake detection across all words, not just the first words



// // //     - When new words are added to the database, flashcards should re - render / restart to show new words at the top of the existing list



// // // ANALYZE THE ADDED CODE WITH ALL DUE THOROUGH AND UTTERLY CAREFULLY BEFORE MAKIN CHANGES - try to be spend tokens utterly carefully and useful without wasting any single token!



// // // CONSIDER AS THE MAIN ISSUE THE FOLLOWING: IT SEEMS THAT THE Quiz is not fully AI powered - my answers like 'the rest' or 'rest' instead of 'the rest, other ones' it consideres as wrong though it should have counted them as equal to correct ones since all of these options are the same as the initial 'Остальные' in russian(say I learn russian using english - it translates this russian word in english only using the 'the rest, other ones' phrase and refuse to recognize my other equal answers like 'rest', 'others' or 'the rest ones' or 'the other ones' as correct ones too though it should have done so!) - FIX THIS FIRST AND PROVIDE THE CODE FIRST THEN PROCEED FURTHER, AND SO ON, PROVIDING EACH FIXED CODE FILE RIGHT AFTER IT'S FIXED IN CASE YOU RUN OUT OF THE TOKENS 



// // // gangmanner81 @gmail.com alpa61chino @gmail.com
