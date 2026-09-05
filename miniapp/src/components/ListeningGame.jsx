// ListeningGame.jsx — Fixed Exit Button & Authentic Meaning Payload
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Volume2, CheckCircle2, XCircle } from "lucide-react";

const SPEECH_LANG_CODES = {
  spanish: "es-ES", english: "en-US", french: "fr-FR", german: "de-DE",
  japanese: "ja-JP", italian: "it-IT", portuguese: "pt-BR", russian: "ru-RU",
  arabic: "ar-SA", chinese: "zh-CN", hindi: "hi-IN", korean: "ko-KR",
  turkish: "tr-TR", dutch: "nl-NL", polish: "pl-PL", swedish: "sv-SE",
  vietnamese: "vi-VN", indonesian: "id-ID", thai: "th-TH", filipino: "fil-PH",
  ukrainian: "uk-UA", malay: "ms-MY", romanian: "ro-RO", greek: "el-GR",
  czech: "cs-CZ", hungarian: "hu-HU", azerbaijani: "az-AZ",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ListeningGame({ cards, API, authHeaders, round = 1, onNextRound, onSaveWord, onExit }) {
  const [queue, setQueue] = useState(() => shuffle(cards || []));
  const [current, setCurrent] = useState(null);
  const [questionType, setQuestionType] = useState("choice"); // "type" | "choice"
  const [options, setOptions] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const hasAutoPlayedRef = useRef(false);
  // Inside ListeningGame.jsx:
  const [savedWords, setSavedWords] = useState(() => new Set());

  const handleSaveCurrentWord = async (card) => {
    if (!card) return;
    const wordKey = card.id || card.word;
    if (savedWords.has(wordKey)) return;

    if (typeof onSaveWord === "function") {
      const success = await onSaveWord({
        ...card,
        word: card.initial_form || card.word,
        correction: card.correction || card.meaning
      });
      if (success) {
        setSavedWords((prev) => new Set(prev).add(wordKey));
      }
    }
  };
  useEffect(() => {
    if (Array.isArray(cards) && cards.length > 0) {
      setQueue(shuffle(cards));
      setCurrent(null);
      setFeedback(null);
    }
  }, [cards]);

  useEffect(() => {
    if (feedback || current) return;
    if (queue.length === 0) return;

    const next = queue[0];
    const distractorPool = cards
      .filter((c) => c.id !== next.id)
      .map((c) => c.correction)
      .filter((text, i, arr) => text && arr.indexOf(text) === i);

    const canOfferChoice = distractorPool.length >= 1;
    const type = canOfferChoice ? "choice" : "type";

    if (type === "choice") {
      const distractors = shuffle(distractorPool).slice(0, 3);
      setOptions(shuffle([next.correction, ...distractors]));
    } else {
      setOptions([]);
    }

    setQuestionType(type);
    setCurrent(next);
    setTypedAnswer("");
    setPlayCount(0);
    hasAutoPlayedRef.current = false;
  }, [queue, feedback, current, cards]);

  function speak(text, langKey) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_CODES[langKey?.toLowerCase()] || "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
    setPlayCount((n) => n + 1);
  }

  useEffect(() => {
    if (!current || hasAutoPlayedRef.current) return;
    hasAutoPlayedRef.current = true;
    const displayWord = current.initial_form || current.word;
    const t = setTimeout(() => speak(displayWord, current.language), 300);
    return () => clearTimeout(t);
  }, [current]);

  async function submitAnswer(answer) {
    if (submitting || !current) return;
    setSubmitting(true);

    const targetWord = current.initial_form || current.word;
    const expectedCorrection = current.correction;
    const isAiCard = String(current.id || "").startsWith("ai_") || isNaN(Number(current.id));

    try {
      let data;
      if (API) {
        try {
          const res = await fetch(`${API}/api/flashcards/${current.id}/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              answer,
              word: targetWord,
              correction: expectedCorrection,
              synonyms: current.synonyms || "",
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json && typeof json.correct === "boolean") {
              data = json;
            }
          }
        } catch (_) { }
      }

      if (!data) {
        const cleanA = (answer || "").trim().toLowerCase();
        const cleanTarget = (expectedCorrection || "").trim().toLowerCase();
        const synonymsList = (current.synonyms || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
        const isExact = cleanA === cleanTarget;
        const isSynonym = synonymsList.some((s) => s === cleanA || cleanA.includes(s) || s.includes(cleanA));
        const isCorrect = isExact || isSynonym;

        data = {
          correct: isCorrect,
          isSynonym: isSynonym && !isExact,
          correctAnswer: expectedCorrection,
          explanation: isCorrect ? "✅ Meaning accepted!" : `Expected translation: "${expectedCorrection}"`,
          partOfSpeech: current.part_of_speech || "word",
          transcription: current.transcription || "",
          pronunciation_rule: current.pronunciation_rule || "",
          synonyms: current.synonyms || "",
          sentence: current.sentence || current.context || "",
          initialForm: targetWord,
          usedForm: current.used_form || targetWord,
          mastered: isAiCard ? isCorrect : false,
        };
      }

      setAnsweredCount((n) => n + 1);
      const isCompleted = isAiCard ? data.correct : Boolean(data.mastered);
      if (isCompleted) setMasteredCount((n) => n + 1);

      setFeedback({
        correct: data.correct,
        isSynonym: data.isSynonym,
        correctAnswer: data.correctAnswer || expectedCorrection,
        explanation: data.explanation || current.explanation,
        partOfSpeech: data.partOfSpeech || current.part_of_speech,
        transcription: data.transcription || current.transcription,
        pronunciation_rule: data.pronunciation_rule || current.pronunciation_rule,
        synonyms: data.synonyms || current.synonyms,
        sentence: data.sentence || current.sentence,
        initialForm: targetWord,
        usedForm: data.usedForm || current.used_form || targetWord,
        mastered: isCompleted,
        userAnswer: answer,
      });

      setQueue((prev) => {
        const rest = prev.slice(1);
        return isCompleted ? rest : [...rest, current];
      });
    } catch (err) {
      console.error("Listening game answer error:", err.message);
      setQueue((prev) => [...prev.slice(1), current]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    setFeedback(null);
    setCurrent(null);
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (!current && !feedback && queue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🏆</div>
        <h1 className="text-2xl font-bold text-white mb-2">Round {round} Complete!</h1>
        <p className="text-slate-400 mb-6">
          All audio passages recognized and mastered by ear!
        </p>
        <div className="w-full max-w-xs bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <p className="text-3xl font-bold text-cyan-400">{answeredCount}</p>
          <p className="text-slate-400 text-xs mt-1">Total Audio Challenges</p>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          {onNextRound && (
            <button
              onClick={onNextRound}
              className="w-full py-3.5 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-500 active:scale-95 transition-all text-sm shadow-lg shadow-cyan-600/30"
            >
              Advance to Round {round + 1} 🚀
            </button>
          )}
          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold hover:bg-slate-700 active:scale-95 transition-all text-xs"
          >
            Back to Game Hub
          </button>
        </div>
      </div>
    );
  }

  // ── Feedback panel ────────────────────────────────────────────────────────
  if (feedback) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center max-w-sm mx-auto">
        <div className="text-5xl mb-3">{feedback.correct ? (feedback.isSynonym ? "💡" : "✅") : "❌"}</div>

        <div className="flex items-center gap-2 justify-center mb-1">
          <p className="text-slate-200 font-bold text-xl">{feedback.initialForm}</p>
          {feedback.partOfSpeech && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
              {feedback.partOfSpeech}
            </span>
          )}
        </div>

        {feedback.transcription && (
          <p className="text-xs text-cyan-300 mb-2 font-medium">{feedback.transcription}</p>
        )}

        <h2 className={`text-lg font-bold mb-3 ${feedback.correct ? "text-green-400" : "text-red-400"}`}>
          {feedback.correct ? (feedback.isSynonym ? "Synonym Accepted!" : "Correct!") : "Not quite"}
        </h2>

        <div className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left mb-4 shadow-lg text-xs leading-relaxed space-y-2">
          <p className="text-slate-300">
            <span className="text-slate-400 font-semibold">Accepted Meaning:</span>{" "}
            <span className="text-white font-bold">{feedback.correctAnswer}</span>
          </p>

          {feedback.isSynonym && (
            <p className="text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30">
              ✨ <i>"{feedback.userAnswer}"</i> conveys the same core meaning.
            </p>
          )}

          {feedback.pronunciation_rule && (
            <p className="text-slate-300 bg-slate-700/40 p-2 rounded-lg border border-slate-600/40">
              <span className="text-cyan-300 font-semibold">Pronunciation:</span> {feedback.pronunciation_rule}
            </p>
          )}

          {feedback.explanation && (
            <p className="text-slate-300">
              <span className="text-slate-400 font-semibold">Note:</span> {feedback.explanation}
            </p>
          )}
        </div>
        {/* In-Game Save to Deck Button */}
        <div className="w-full flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={() => handleSaveCurrentWord(current)}
            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm ${savedWords.has(current.id || current.word)
              ? "bg-emerald-900/60 border border-emerald-500/50 text-emerald-300 cursor-default"
              : "bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-95"
              }`}
          >
            {savedWords.has(current.id || current.word) ? (
              <>
                <span>✅</span>
                <span>Saved to Flashcards Deck</span>
              </>
            ) : (
              <>
                <span>⭐</span>
                <span>Save this word to my Flashcards</span>
              </>
            )}
          </button>
        </div>
        <button
          onClick={handleContinue}
          className="w-full py-3.5 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-500 active:scale-95 transition-all text-sm"
        >
          Continue
        </button>
      </div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────────
  if (!current) return null;
  const displayWord = current.initial_form || current.word;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative max-w-sm mx-auto">
      {/* Top Exit Navigation Button */}
      <div className="w-full flex items-center justify-between mb-4">
        <button
          onClick={onExit}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition py-1 px-2.5 rounded-lg bg-slate-800 border border-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Hub
        </button>
        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded-full border border-cyan-800">
          Round {round} &bull; {queue.length} left
        </span>
      </div>

      <div className="w-full mb-3 text-center">
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-cyan-950 text-cyan-300 border border-cyan-800">
          🎧 ПОСЛУШАЙТЕ И {questionType === "choice" ? "ВЫБЕРИТЕ ЗНАЧЕНИЕ" : "НАПИШИТЕ ПЕРЕВОД"}
        </span>
      </div>

      <div
        className="w-full rounded-2xl p-7 mb-6 bg-gradient-to-br from-cyan-600 to-blue-700 text-center flex flex-col items-center"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        <span className="text-xs uppercase tracking-widest text-cyan-200 mb-4">
          Tap speaker to listen to native pronunciation
        </span>

        <button
          type="button"
          onClick={() => speak(displayWord, current.language)}
          className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center text-5xl shadow-lg"
          title="Play the word"
        >
          <Volume2 className="w-10 h-10 text-white" />
        </button>

        <p className="mt-4 text-cyan-100 text-xs">
          {playCount > 1 ? `Replayed ${playCount} times` : "Tap to replay"}
        </p>
      </div>

      {questionType === "choice" ? (
        <div className="w-full flex flex-col gap-2.5">
          {options.map((opt, i) => (
            <button
              key={i}
              disabled={submitting}
              onClick={() => submitAnswer(opt)}
              className="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-left px-4 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 text-sm font-medium"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="w-full flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedAnswer.trim()) submitAnswer(typedAnswer.trim());
          }}
        >
          <input
            type="text"
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            disabled={submitting}
            autoFocus
            placeholder="Type meaning in Russian or English..."
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !typedAnswer.trim()}
            className="w-full py-3.5 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-500 active:scale-95 transition-all disabled:opacity-50 text-sm"
          >
            {submitting ? "Evaluating..." : "Submit Answer"}
          </button>
        </form>
      )}
    </div>
  );
}