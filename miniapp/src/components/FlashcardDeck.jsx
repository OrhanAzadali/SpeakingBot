// FlashcardDeck.jsx
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

  // Pure dictionary lemma / base form display
  const displayWord = current.initial_form || current.word;
  const usedForm = current.used_form || current.word;
  const hasDifferentUsedForm = usedForm && usedForm.toLowerCase() !== displayWord.toLowerCase();

  return (
    <div className="w-full max-w-sm">
      <div
        onClick={handleFlip}
        className={`relative w-full rounded-2xl cursor-pointer select-none transition-transform duration-200 active:scale-95 ${animating === "right" ? "animate-slide-right" : ""
          } ${animating === "left" ? "animate-slide-left" : ""}`}
        style={{ minHeight: 300, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        {/* FRONT: Base Lemma, Grammatical Role & Phonetic Transcription */}
        {!flipped && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-widest text-indigo-200 font-medium">Base Lemma</span>
              {current.part_of_speech && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-400/40 text-indigo-200">
                  {current.part_of_speech}
                </span>
              )}
            </div>

            <p className="text-3xl font-bold text-white leading-snug">{displayWord}</p>

            {current.transcription && (
              <p className="text-sm font-medium text-indigo-200 mt-2 bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-300/30">
                {current.transcription}
              </p>
            )}

            {hasDifferentUsedForm && (
              <p className="text-xs text-indigo-200 mt-2">
                Used in context as: <span className="underline font-semibold">{usedForm}</span>
              </p>
            )}

            <p className="mt-6 text-indigo-200 text-xs flex items-center gap-1.5">
              <span>👆</span> Tap to reveal meaning, grammar & pronunciation rules
            </p>
          </div>
        )}

        {/* BACK: Meaning, Pronunciation Rules, Synonyms, Grammar & Context Sentence */}
        {flipped && (
          <div className="absolute inset-0 flex flex-col justify-center p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-left overflow-y-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-widest text-slate-400">Meaning</span>
              {current.part_of_speech && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                  {current.part_of_speech}
                </span>
              )}
            </div>

            <p className="text-2xl font-bold text-green-400 mb-2">{current.correction}</p>

            {current.transcription && (
              <p className="text-xs text-indigo-300 mb-1.5 font-medium">
                <span className="text-slate-400 font-semibold">Phonetics:</span> {current.transcription}
              </p>
            )}

            {current.pronunciation_rule && (
              <p className="text-xs text-slate-300 mb-2 leading-relaxed bg-slate-700/40 p-2 rounded-lg border border-slate-600/40">
                <span className="text-indigo-300 font-semibold">Pronunciation Rule:</span> {current.pronunciation_rule}
              </p>
            )}

            {current.synonyms && (
              <p className="text-xs text-indigo-300 mb-1.5">
                <span className="font-semibold text-slate-400">Synonyms:</span> {current.synonyms}
              </p>
            )}

            {current.explanation && (
              <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                <span className="font-semibold text-slate-400">Grammar Note:</span> {current.explanation}
              </p>
            )}

            {(current.sentence || current.context) && (
              <div className="mt-2 pt-2 border-t border-slate-700/80">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Context Sentence</p>
                {current.sentence ? (
                  <p
                    className="text-slate-300 text-xs leading-relaxed italic"
                    dangerouslySetInnerHTML={{ __html: current.sentence }}
                  />
                ) : (
                  <p className="text-slate-300 text-xs leading-relaxed italic">{current.context}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result Buttons */}
      <div className={`flex gap-4 mt-5 transition-opacity duration-300 ${flipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button
          onClick={() => handleResult(false)}
          className="flex-1 py-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-base hover:bg-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>❌</span> Forgot
        </button>
        <button
          onClick={() => handleResult(true)}
          className="flex-1 py-3.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 font-semibold text-base hover:bg-green-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>✅</span> Got it
        </button>
      </div>
    </div>
  );
}