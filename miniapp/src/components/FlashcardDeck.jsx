import React, { useState } from "react";
export default function FlashcardDeck({ cards, onResult }) {
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(null);

  const current = cards[0];
  if (!current) return null;

  function handleFlip() {
    if (!flipped) setFlipped(true);
  }

  function handleResult(remembered) {
    if (!flipped) return;
    setAnimating(remembered ? "right" : "left");
    setTimeout(() => {
      setFlipped(false);
      setAnimating(null);
      onResult(current.id, remembered);
    }, 280);
  }

  return (
    <div className="w-full max-w-sm">
      <div
        onClick={handleFlip}
        className={`relative w-full rounded-2xl cursor-pointer select-none transition-transform duration-200 active:scale-95 ${animating === "right" ? "animate-slide-right" : ""} ${animating === "left" ? "animate-slide-left" : ""}`}
        style={{ minHeight: 220, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        {!flipped && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700">
            <p className="text-xs uppercase tracking-widest text-indigo-200 mb-4">Word / Phrase</p>
            <p className="text-3xl font-bold text-white text-center leading-snug">{current.word}</p>
            <p className="mt-6 text-indigo-200 text-sm">Tap to reveal answer</p>
          </div>
        )}
        {flipped && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">Correction</p>
            <p className="text-2xl font-bold text-green-400 text-center mb-4">{current.correction}</p>
            {current.context && (
              <>
                <div className="w-12 h-px bg-slate-600 mb-4" />
                <p className="text-slate-300 text-sm text-center leading-relaxed">{current.context}</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className={`flex gap-4 mt-5 transition-opacity duration-300 ${flipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={() => handleResult(false)} className="flex-1 py-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-lg hover:bg-red-500/30 active:scale-95 transition-all">
          ❌ Forgot
        </button>
        <button onClick={() => handleResult(true)} className="flex-1 py-3.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 font-semibold text-lg hover:bg-green-500/30 active:scale-95 transition-all">
          ✅ Got it
        </button>
      </div>
    </div>
  );
}