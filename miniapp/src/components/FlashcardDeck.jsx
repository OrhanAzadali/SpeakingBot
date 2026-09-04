// FlashcardDeck.jsx
import React, { useState } from "react";

// Standard BCP 47 language codes for native in-browser Web Speech pronunciation
const SPEECH_LANG_CODES = {
  spanish: "es-ES", english: "en-US", french: "fr-FR", german: "de-DE",
  japanese: "ja-JP", italian: "it-IT", portuguese: "pt-BR", russian: "ru-RU",
  arabic: "ar-SA", chinese: "zh-CN", hindi: "hi-IN", korean: "ko-KR",
  turkish: "tr-TR", dutch: "nl-NL", polish: "pl-PL", swedish: "sv-SE",
  vietnamese: "vi-VN", indonesian: "id-ID", thai: "th-TH", filipino: "fil-PH",
  ukrainian: "uk-UA", malay: "ms-MY", romanian: "ro-RO", greek: "el-GR",
  czech: "cs-CZ", hungarian: "hu-HU", azerbaijani: "az-AZ"
};

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

  // Speaks the target word aloud using native browser speech synthesis
  function playPronunciation(e, text, langKey) {
    e.stopPropagation(); // Crucial: prevents card from flipping when clicking the speaker button
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_CODES[langKey?.toLowerCase()] || "en-US";
    utterance.rate = 0.85; // Slightly slower for crisp pedagogical clarity
    window.speechSynthesis.speak(utterance);
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
        style={{ minHeight: 350, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        {/* FRONT: Base Lemma, Audio Speaker Button, Role & Phonetics */}
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

            {/* Word Display with Native 🔊 Pronunciation Button */}
            <div className="flex items-center justify-center gap-2.5 my-1">
              <p className="text-3xl font-bold text-white leading-snug">{displayWord}</p>
              <button
                type="button"
                onClick={(e) => playPronunciation(e, displayWord, current.language)}
                className="p-2 rounded-full bg-indigo-500/30 hover:bg-indigo-500/50 active:scale-90 transition-all text-indigo-100 hover:text-white border border-indigo-300/30 shadow-sm"
                title="Listen to pronunciation"
              >
                🔊
              </button>
            </div>

            {current.transcription && (
              <p className="text-xs font-medium text-indigo-200 mt-1.5 bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-300/30">
                {current.transcription}
              </p>
            )}

            {hasDifferentUsedForm && (
              <p className="text-xs text-indigo-200 mt-2.5">
                Used in context as: <span className="underline font-semibold">{usedForm}</span>
              </p>
            )}

            <p className="mt-8 text-indigo-200 text-xs flex items-center gap-1.5">
              <span>👆</span> Tap to reveal full grammar, syntax, semantics & rules
            </p>
          </div>
        )}

        {/* BACK: Comprehensive Linguistic Card (Grammar, Syntax, Orthography, Semantics) */}
        {flipped && (
          <div className="absolute inset-0 flex flex-col p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-left overflow-y-auto">
            {/* Header: Meaning & POS */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-widest text-slate-400">Meaning</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => playPronunciation(e, displayWord, current.language)}
                  className="p-1 px-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 active:scale-90 transition-all"
                  title="Listen again"
                >
                  🔊 Listen
                </button>
                {current.part_of_speech && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                    {current.part_of_speech}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xl font-bold text-green-400 mb-2">{current.correction}</p>

            {/* Extended Linguistic Attributes Container */}
            <div className="space-y-2 text-xs leading-relaxed">
              {current.transcription && (
                <p className="text-indigo-300">
                  <span className="text-slate-400 font-semibold">Phonetics:</span> {current.transcription}
                </p>
              )}

              {current.pronunciation_rule && (
                <div className="bg-slate-700/40 p-2 rounded-lg border border-slate-600/40">
                  <p className="text-slate-300">
                    <span className="text-indigo-300 font-semibold">Pronunciation Rule:</span> {current.pronunciation_rule}
                  </p>
                </div>
              )}

              {current.grammar_rule && (
                <div className="bg-slate-700/40 p-2 rounded-lg border border-slate-600/40">
                  <p className="text-slate-300">
                    <span className="text-emerald-300 font-semibold">Grammar & Morphology:</span> {current.grammar_rule}
                  </p>
                </div>
              )}

              {current.syntax_rule && (
                <p className="text-slate-300">
                  <span className="text-slate-400 font-semibold">Syntax & Case Government:</span> {current.syntax_rule}
                </p>
              )}

              {current.orthography_rule && (
                <p className="text-slate-300">
                  <span className="text-slate-400 font-semibold">Orthography:</span> {current.orthography_rule}
                </p>
              )}

              {current.semantics_note && (
                <p className="text-slate-300">
                  <span className="text-slate-400 font-semibold">Semantics & Collocations:</span> {current.semantics_note}
                </p>
              )}

              {current.synonyms && (
                <p className="text-indigo-300">
                  <span className="text-slate-400 font-semibold">Synonyms:</span> {current.synonyms}
                </p>
              )}

              {current.explanation && !current.grammar_rule && (
                <p className="text-slate-300">
                  <span className="text-slate-400 font-semibold">Grammar Note:</span> {current.explanation}
                </p>
              )}

              {(current.sentence || current.context) && (
                <div className="pt-2 border-t border-slate-700/80">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">Example in Context</p>
                  {current.sentence ? (
                    <p
                      className="text-slate-300 italic"
                      dangerouslySetInnerHTML={{ __html: current.sentence }}
                    />
                  ) : (
                    <p className="text-slate-300 italic">{current.context}</p>
                  )}
                </div>
              )}
            </div>
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