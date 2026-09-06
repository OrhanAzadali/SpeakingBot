// Quiz.jsx
import React, { useEffect, useState } from "react";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz({ cards, API, authHeaders, onSaveWord, onExit }) {
  const [queue, setQueue] = useState(() => shuffle(cards));
  const [current, setCurrent] = useState(null);
  const [questionType, setQuestionType] = useState("type"); // "type" | "choice"
  const [options, setOptions] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  // Inside Quiz.jsx:
  const [savedWords, setSavedWords] = useState(() => new Set());

  const handleSaveCurrentWord = async (card) => {
    const wordId = card.id || card.word;
    if (savedWords.has(wordId)) return;

    if (onSaveWord) {
      const success = await onSaveWord(card);
      if (success) {
        setSavedWords((prev) => new Set(prev).add(wordId));
      }
    }
  };
  // Automatically prepend brand-new words from background polling to the top of the queue
  useEffect(() => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const freshCards = cards.filter((c) => !existingIds.has(c.id));
      if (freshCards.length === 0) return prev;
      return [...freshCards, ...prev]; // Put new words at the front
    });
  }, [cards]);



  // Pick the next question
  useEffect(() => {
    if (feedback || current) return;
    if (queue.length === 0) return;

    const next = queue[0];
    const canOfferChoice = Math.random() < 0.5;
    const type = canOfferChoice ? "choice" : "type";

    if (type === "choice") {
      // 1. First set immediate distractors from available cards
      const distractorPool = cards
        .filter((c) => c.id !== next.id)
        .map((c) => c.correction)
        .filter((text, i, arr) => text && arr.indexOf(text) === i);
      const initialOptions = shuffle([next.correction, ...shuffle(distractorPool).slice(0, 3)]);
      setOptions(initialOptions);

      // 2. Fetch AI-generated distractors in the exact right language!
      if (API && next.id) {
        fetch(`${API}/api/flashcards/${next.id}/options`, { headers: authHeaders })
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data.options) && data.options.length >= 2) {
              setOptions(data.options);
            }
          })
          .catch(() => { });
      }
    } else {
      setOptions([]);
    }

    setQuestionType(type);
    setCurrent(next);
    setTypedAnswer("");
  }, [queue, feedback, current, cards]);

  async function submitAnswer(answer) {
    if (submitting || !current) return;
    setSubmitting(true);

    try {
      let data;
      const isAiCard = String(current.id || "").startsWith("ai_") || isNaN(Number(current.id));

      if (API) {
        try {
          const res = await fetch(`${API}/api/flashcards/${current.id}/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              answer,
              word: current.initial_form || current.word,
              correction: current.correction,
              synonyms: current.synonyms
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json && typeof json.correct === "boolean") {
              data = json;
            }
          }
        } catch {
          // Network issue: fall through to local evaluation
        }
      }

      if (!data) {
        // Semantic-aware offline fallback
        const cleanA = (answer || "").trim().toLowerCase();
        const cleanTarget = (current.correction || "").trim().toLowerCase();
        const synonymsList = (current.synonyms || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
        const isExact = cleanA === cleanTarget;
        const isSynonym = synonymsList.some((syn) => syn === cleanA || cleanA.includes(syn) || syn.includes(cleanA));
        const isCorrect = isExact || isSynonym;

        data = {
          correct: isCorrect,
          isSynonym: isSynonym && !isExact,
          correctAnswer: current.correction || current.word,
          explanation: current.explanation || (isCorrect ? "✅ Correct meaning!" : `Expected "${current.correction}"`),
          partOfSpeech: current.part_of_speech || "word",
          transcription: current.transcription || "",
          pronunciation_rule: current.pronunciation_rule || "",
          synonyms: current.synonyms || "",
          sentence: current.sentence || current.context || "",
          initialForm: current.initial_form || current.word,
          usedForm: current.used_form || current.word,
          mastered: isAiCard ? isCorrect : false,
        };
      }

      setAnsweredCount((n) => n + 1);

      // Determine if this card is considered completed in this session:
      // - For AI game cards: Answering correctly retires the card so words REDUCE!
      // - For DB flashcards: Respects 3-in-a-row mastery from PostgreSQL
      const isCompleted = isAiCard ? data.correct : Boolean(data.mastered);

      if (isCompleted) {
        setMasteredCount((n) => n + 1);
      }

      setFeedback({
        correct: data.correct,
        isSynonym: data.isSynonym,
        correctAnswer: data.correctAnswer || current.correction,
        explanation: data.explanation || current.explanation,
        partOfSpeech: data.partOfSpeech || current.part_of_speech,
        transcription: data.transcription || current.transcription,
        pronunciation_rule: data.pronunciation_rule || current.pronunciation_rule,
        synonyms: data.synonyms || current.synonyms,
        sentence: data.sentence || current.sentence,
        initialForm: data.initialForm || current.initial_form || current.word,
        usedForm: data.usedForm || current.used_form || current.word,
        mastered: isCompleted,
        userAnswer: answer,
        word: current.word,
      });

      // Advance the queue: If completed/mastered, remove it from queue; if wrong, recycle it!
      setQueue((prev) => {
        const rest = prev.slice(1);
        return isCompleted ? rest : [...rest, current];
      });

    } catch (err) {
      console.error("Quiz answer error:", err.message);
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
        <h1 className="text-2xl font-bold text-white mb-2">All words mastered!</h1>
        <p className="text-slate-400 mb-8">
          {masteredCount} word{masteredCount !== 1 ? "s" : ""} answered correctly three times in a row.
        </p>
        <div className="w-full max-w-xs bg-slate-800 rounded-2xl p-6 mb-6" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <p className="text-3xl font-bold text-indigo-400">{answeredCount}</p>
          <p className="text-slate-400 text-sm mt-1">Questions answered</p>
        </div>
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
        >
          Back to games
        </button>
      </div>
    );
  }

  // ── Feedback panel (Synonyms, Phonetics, Grammar Role & Explanation) ────────
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
          <p className="text-xs text-indigo-300 mb-2 font-medium">
            {feedback.transcription}
          </p>
        )}

        <h2 className={`text-lg font-bold mb-3 ${feedback.correct ? "text-green-400" : "text-red-400"}`}>
          {feedback.correct ? (feedback.isSynonym ? "Synonym Accepted!" : "Correct!") : "Not quite"}
        </h2>

        {/* Detailed Explanation Box */}
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
              <span className="text-indigo-300 font-semibold">Pronunciation:</span> {feedback.pronunciation_rule}
            </p>
          )}

          {feedback.synonyms && (
            <p className="text-indigo-300">
              <span className="text-slate-400 font-semibold">Synonyms:</span> {feedback.synonyms}
            </p>
          )}

          {feedback.explanation && (
            <p className="text-slate-300">
              <span className="text-slate-400 font-semibold">Grammar Note:</span> {feedback.explanation}
            </p>
          )}

          {feedback.sentence && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-[11px] text-slate-400 font-semibold mb-0.5">Example in context:</p>
              <p
                className="text-slate-300 italic"
                dangerouslySetInnerHTML={{ __html: feedback.sentence }}
              />
            </div>
          )}
        </div>

        {feedback.mastered && (
          <p className="text-indigo-400 font-semibold text-xs mb-3">🎉 Word mastered and archived to your learned vocabulary!</p>
        )}
        {/* In-Game Save to Deck Button in Quiz */}
        <button
          type="button"
          onClick={() => handleSaveCurrentWord(current)}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold mb-3 flex items-center justify-center gap-1.5 transition-all shadow-sm ${savedWords.has(current.id || current.word)
            ? "bg-emerald-900/60 border border-emerald-500/50 text-emerald-300"
            : "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 active:scale-95"
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
              <span>Save to Flashcards for Quiz</span>
            </>
          )}
        </button>
        <button
          onClick={handleContinue}
          className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all text-sm"
        >
          Continue
        </button>
      </div>
    );
  }

  // ── Question screen ─────────────────────────────────────────────────────────
  if (!current) return null;

  const displayWord = current.initial_form || current.word;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm mb-4 text-center">
        <p className="text-slate-400 text-xs">{queue.length} word{queue.length !== 1 ? "s" : ""} left to master</p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-7 mb-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-center"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-widest text-indigo-200">What does this mean?</span>
          {current.part_of_speech && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-400/40 text-indigo-200">
              {current.part_of_speech}
            </span>
          )}
        </div>

        <p className="text-3xl font-bold text-white leading-snug">{displayWord}</p>

        {current.transcription && (
          <p className="text-xs font-medium text-indigo-200 mt-2 bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-300/30 inline-block">
            {current.transcription}
          </p>
        )}
      </div>

      {questionType === "choice" ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="w-full max-w-sm mb-3 text-center">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-indigo-950 text-indigo-300 border border-indigo-800">
              {questionType === "choice"
                ? "👉 ВЫБЕРИТЕ ПЕРЕВОД (SELECT MEANING)"
                : "✍️ ВВЕДИТЕ ЗНАЧЕНИЕ НА РУССКОМ / ENGLISH"}
            </span>
          </div>
          {options.map((opt, i) => (
            <button
              key={i}
              disabled={submitting}
              onClick={() => submitAnswer(opt)}
              className="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-left px-4 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50 text-sm"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="w-full max-w-sm flex flex-col gap-3"
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
            placeholder="Type meaning or synonym in English..."
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !typedAnswer.trim()}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50 text-sm"
          >
            {submitting ? "Judging Answer..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
