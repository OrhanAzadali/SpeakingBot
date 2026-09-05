// ListeningMatch.jsx
//
// NEW LISTENING GAME: "Sound Match"
// A memory/matching game — tap a 🔊 tile to hear a word, then tap the meaning
// tile you think matches it. Correct pairs lock in green with a combo bonus;
// wrong pairs shake and reset your streak. This is a different listening
// mechanic from ListeningGame.jsx (which is a linear type/choice quiz) —
// Sound Match is round-based, score-driven, and rewards quick ears.
//
// Drop this file next to ListeningGame.jsx. It does not modify or import
// anything from your existing games, so nothing else changes.
//
// Usage (wherever you currently render <ListeningGame .../>):
//
//   import ListeningMatch from "./ListeningMatch";
//   ...
//   <ListeningMatch cards={cards} API={API} authHeaders={authHeaders} onExit={() => setView("games")} />
//
// Same props contract as ListeningGame.jsx: cards (array of flashcards),
// API (base url or null for offline/demo), authHeaders, onExit.

import React, { useEffect, useRef, useState } from "react";

// Same BCP 47 map ListeningGame.jsx / FlashcardDeck.jsx use for native TTS
const SPEECH_LANG_CODES = {
  spanish: "es-ES", english: "en-US", french: "fr-FR", german: "de-DE",
  japanese: "ja-JP", italian: "it-IT", portuguese: "pt-BR", russian: "ru-RU",
  arabic: "ar-SA", chinese: "zh-CN", hindi: "hi-IN", korean: "ko-KR",
  turkish: "tr-TR", dutch: "nl-NL", polish: "pl-PL", swedish: "sv-SE",
  vietnamese: "vi-VN", indonesian: "id-ID", thai: "th-TH", filipino: "fil-PH",
  ukrainian: "uk-UA", malay: "ms-MY", romanian: "ro-RO", greek: "el-GR",
  czech: "cs-CZ", hungarian: "hu-HU", azerbaijani: "az-AZ",
};

const MIN_PAIRS = 3;
const MAX_PAIRS = 6;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Pick `count` cards, preferring ones not used in the previous round so
// repeat rounds feel fresh instead of showing the same set again.
function pickRoundCards(pool, count, excludeIds) {
  const fresh = pool.filter((c) => !excludeIds.has(c.id));
  const chosenFromFresh = shuffle(fresh).slice(0, count);
  if (chosenFromFresh.length >= count) return chosenFromFresh;
  const remaining = count - chosenFromFresh.length;
  const usedIds = new Set(chosenFromFresh.map((c) => c.id));
  const backfill = shuffle(pool.filter((c) => !usedIds.has(c.id))).slice(0, remaining);
  return [...chosenFromFresh, ...backfill];
}

export default function ListeningMatch({ cards, API, authHeaders, onExit }) {
  const [roundNumber, setRoundNumber] = useState(1);
  const [pairCount, setPairCount] = useState(Math.min(MAX_PAIRS, Math.max(MIN_PAIRS, cards.length)));
  const [roundCards, setRoundCards] = useState([]);
  const [audioTiles, setAudioTiles] = useState([]);
  const [meaningTiles, setMeaningTiles] = useState([]);
  const [selectedAudioId, setSelectedAudioId] = useState(null);
  const [matchedIds, setMatchedIds] = useState(() => new Set());
  const [wrongPulse, setWrongPulse] = useState(null); // { audioId, meaningId }
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const lastRoundIdsRef = useRef(new Set());
  const timerRef = useRef(null);

  function startRound(count) {
    const chosen = pickRoundCards(cards, count, lastRoundIdsRef.current);
    lastRoundIdsRef.current = new Set(chosen.map((c) => c.id));
    setRoundCards(chosen);
    setAudioTiles(shuffle(chosen));
    setMeaningTiles(shuffle(chosen));
    setSelectedAudioId(null);
    setMatchedIds(new Set());
    setWrongPulse(null);
    setElapsed(0);
    setFinished(false);
  }

  // Kick off the first round once we know how many cards are available
  useEffect(() => {
    if (cards.length >= MIN_PAIRS) startRound(pairCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Round timer
  useEffect(() => {
    if (finished || roundCards.length === 0) return;
    timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [finished, roundCards]);

  // Detect round completion
  useEffect(() => {
    if (roundCards.length > 0 && matchedIds.size === roundCards.length) {
      clearInterval(timerRef.current);
      setFinished(true);
    }
  }, [matchedIds, roundCards]);

  function speak(text, langKey) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_CODES[langKey?.toLowerCase()] || "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  function recordReview(cardId, remembered) {
    if (!API) return;
    fetch(`${API}/api/flashcards/${cardId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ remembered }),
    }).catch((err) => console.error("Sound Match review error:", err.message));
  }

  function handleAudioTap(card) {
    if (matchedIds.has(card.id)) return;
    const displayWord = card.initial_form || card.word;
    speak(displayWord, card.language);
    setSelectedAudioId(card.id);
  }

  function handleMeaningTap(card) {
    if (matchedIds.has(card.id)) return;
    if (!selectedAudioId) return; // must pick a sound first

    if (selectedAudioId === card.id) {
      // ✅ correct match
      const bonus = 10 + streak * 2;
      setScore((s) => s + bonus);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      setMatchedIds((prev) => new Set(prev).add(card.id));
      setSelectedAudioId(null);
      recordReview(card.id, true);
    } else {
      // ❌ wrong match
      setMistakes((m) => m + 1);
      setStreak(0);
      setWrongPulse({ audioId: selectedAudioId, meaningId: card.id });
      setTimeout(() => {
        setWrongPulse(null);
        setSelectedAudioId(null);
      }, 480);
    }
  }

  function handlePlayAgain() {
    const nextCount = Math.min(MAX_PAIRS, Math.max(MIN_PAIRS, cards.length));
    // Ramp difficulty a little each time the player clears a round cleanly
    const grownCount = mistakes === 0 ? Math.min(nextCount, pairCount + 1) : pairCount;
    const finalCount = Math.min(grownCount, cards.length);
    setPairCount(finalCount);
    setRoundNumber((n) => n + 1);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    startRound(finalCount);
  }

  // ── Not enough words yet ────────────────────────────────────────────────
  if (cards.length < MIN_PAIRS) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🎧</div>
        <h1 className="text-2xl font-bold text-white mb-2">Sound Match needs a few more words</h1>
        <p className="text-slate-400 mb-8 max-w-xs">
          Save at least {MIN_PAIRS} flashcards to unlock this game — you currently have {cards.length}.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-500 active:scale-95 transition-all"
        >
          Back to games
        </button>
      </div>
    );
  }

  // ── Round complete screen ───────────────────────────────────────────────
  // Find the finished condition in ListeningMatch.jsx and ensure it has safe fallbacks:
  if (finished || (roundCards.length > 0 && matchedIds.size === roundCards.length)) {
    const flawless = mistakes === 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center py-8 bg-slate-900 text-white">
        <div className="text-6xl mb-4 animate-bounce">{flawless ? "🏆" : "🎧"}</div>
        <h1 className="text-2xl font-bold text-white mb-1">
          {flawless ? "Flawless round!" : `Round ${roundNumber} complete!`}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {roundCards.length} pairs matched in {formatTime(elapsed)}
        </p>

        <div
          className="w-full max-w-xs bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 mb-6 shadow-xl"
        >
          <div className="flex justify-around items-center mb-5">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-cyan-400">{score}</p>
              <p className="text-slate-400 text-xs mt-1 font-medium">Score</p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="text-center">
              <p className="text-3xl font-extrabold text-emerald-400">{bestStreak}</p>
              <p className="text-slate-400 text-xs mt-1 font-medium">Best streak</p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="text-center">
              <p className="text-3xl font-extrabold text-red-400">{mistakes}</p>
              <p className="text-slate-400 text-xs mt-1 font-medium">Mistakes</p>
            </div>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            {flawless
              ? "Perfect ears! Ready for the next difficulty tier."
              : "Good work! Keep practicing to increase accuracy."}
          </p>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => {
              if (onNextRound) {
                onNextRound();
              } else {
                handlePlayAgain();
              }
            }}
            className="w-full py-3.5 rounded-xl bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-500 active:scale-95 transition-all shadow-lg shadow-cyan-600/30"
          >
            Advance to Round {roundNumber + 1} 🚀
          </button>
          <button
            onClick={onExit}
            className="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm hover:bg-slate-700 active:scale-95 transition-all"
          >
            Back to Game Hub
          </button>
        </div>
        {/* In ListeningMatch.jsx Round Complete Screen */}
        <div className="w-full max-w-xs mb-4 text-left">
          <p className="text-slate-400 text-xs font-semibold mb-2">Round Vocabulary:</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {roundCards.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs"
              >
                <span className="text-cyan-300 font-semibold">{c.initial_form || c.word}</span>
                <span className="text-slate-300 text-[11px] truncate max-w-[120px]">{c.correction}</span>
                <button
                  type="button"
                  onClick={() => onSaveWord && onSaveWord(c)}
                  className="p-1 rounded text-amber-400 hover:text-amber-300 text-xs"
                  title="Save word to deck"
                >
                  ⭐ Save
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Active round ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6">
      <style>{`
        @keyframes soundMatchShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .sound-match-shake { animation: soundMatchShake 0.42s ease-in-out; }
        @keyframes soundMatchPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .sound-match-pop { animation: soundMatchPop 0.28s ease-out; }
      `}</style>

      {/* Header / HUD */}
      <div className="w-full max-w-sm flex items-center justify-between mb-1 text-xs text-slate-400">
        <span>Round {roundNumber} &middot; {roundCards.length} pairs</span>
        <span>{formatTime(elapsed)}</span>
      </div>
      <div className="w-full max-w-sm flex items-center justify-between mb-5">
        <span className="text-cyan-300 font-bold text-lg">{score} pts</span>
        {streak > 1 && (
          <span className="text-amber-400 font-semibold text-sm">🔥 {streak}x streak</span>
        )}
      </div>

      <p className="text-slate-400 text-xs text-center mb-4 max-w-sm">
        Tap a 🔊 to hear a word, then tap the meaning you think it matches.
      </p>

      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        {/* Sound column */}
        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300 text-center mb-0.5">Listen</p>
          {audioTiles.map((card) => {
            const isMatched = matchedIds.has(card.id);
            const isSelected = selectedAudioId === card.id;
            const isWrong = wrongPulse?.audioId === card.id;
            return (
              <button
                key={`audio-${card.id}`}
                type="button"
                disabled={isMatched}
                onClick={() => handleAudioTap(card)}
                className={[
                  "h-16 rounded-xl flex items-center justify-center text-2xl transition-all active:scale-95",
                  isMatched
                    ? "bg-emerald-500/15 border border-emerald-500/40 opacity-60 cursor-default"
                    : isSelected
                      ? "bg-cyan-500/30 border-2 border-cyan-400 shadow-lg shadow-cyan-500/20"
                      : "bg-gradient-to-br from-cyan-600 to-blue-700 border border-cyan-400/30 hover:opacity-90",
                  isWrong ? "sound-match-shake border-red-400" : "",
                ].join(" ")}
              >
                {isMatched ? "✅" : "🔊"}
              </button>
            );
          })}
        </div>

        {/* Meaning column */}
        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 text-center mb-0.5">Meaning</p>
          {meaningTiles.map((card) => {
            const isMatched = matchedIds.has(card.id);
            const isWrong = wrongPulse?.meaningId === card.id;
            return (
              <button
                key={`meaning-${card.id}`}
                type="button"
                disabled={isMatched}
                onClick={() => handleMeaningTap(card)}
                className={[
                  "h-16 rounded-xl flex items-center justify-center text-center px-2 text-xs font-medium leading-tight transition-all active:scale-95",
                  isMatched
                    ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 opacity-60 cursor-default sound-match-pop"
                    : "bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700",
                  isWrong ? "sound-match-shake border-red-400 text-red-300" : "",
                ].join(" ")}
              >
                {isMatched ? "Matched" : card.correction}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onExit}
        className="mt-8 px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 active:scale-95 transition-all"
      >
        Exit game
      </button>
    </div>
  );
}
