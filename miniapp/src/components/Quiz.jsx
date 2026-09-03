import React, { useEffect, useState } from "react";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz({ cards, API, authHeaders, onExit }) {
  const [queue, setQueue] = useState(() => shuffle(cards));
  const [current, setCurrent] = useState(null);
  const [questionType, setQuestionType] = useState("type"); // "type" | "choice"
  const [options, setOptions] = useState([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Automatically prepend brand-new words from background polling to top of queue
  useEffect(() => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const freshCards = cards.filter((c) => !existingIds.has(c.id));
      if (freshCards.length === 0) return prev;
      return [...freshCards, ...prev]; // Put new words at the front
    });
  }, [cards]);

  // Pick next question whenever queue advances
  useEffect(() => {
    if (feedback || current) return;
    if (queue.length === 0) return;

    const next = queue[0];

    const distractorPool = cards
      .filter((c) => c.id !== next.id)
      .map((c) => c.correction)
      .filter((text, i, arr) => text && arr.indexOf(text) === i);

    const canOfferChoice = distractorPool.length >= 1;
    const type = canOfferChoice && Math.random() < 0.5 ? "choice" : "type";

    if (type === "choice") {
      const distractors = shuffle(distractorPool).slice(0, 3);
      setOptions(shuffle([next.correction, ...distractors]));
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
      if (API) {
        const res = await fetch(`${API}/api/flashcards/${current.id}/quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ answer }),
        });
        data = await res.json();
      } else {
        // Safe offline/demo fallback
        const isExact = answer.trim().toLowerCase() === current.correction.trim().toLowerCase();
        data = {
          correct: isExact,
          isSynonym: false,
          correctAnswer: current.correction,
          explanation: current.explanation || "Exact meaning match",
          partOfSpeech: current.part_of_speech || "word",
          synonyms: current.synonyms || "",
          sentence: current.sentence || current.context || "",
          mastered: false,
        };
      }

      setAnsweredCount((n) => n + 1);
      if (data.mastered) setMasteredCount((n) => n + 1);

      setFeedback({
        correct: data.correct,
        isSynonym: data.isSynonym,
        correctAnswer: data.correctAnswer || current.correction,
        explanation: data.explanation || current.explanation,
        partOfSpeech: data.partOfSpeech || current.part_of_speech,
        synonyms: data.synonyms || current.synonyms,
        sentence: data.sentence || current.sentence,
        initialForm: data.initialForm || current.initial_form || current.word,
        usedForm: data.usedForm || current.used_form || current.word,
        mastered: data.mastered,
        userAnswer: answer,
      });

      setQueue((prev) => {
        const rest = prev.slice(1);
        return data.mastered ? rest : [...rest, current];
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
          {masteredCount} word{masteredCount !== 1 ? "s" : ""} answered correctly 3 times in a row.
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

  // ── Feedback panel (Synonyms, Grammar Role & Explanation) ───────────────────
  if (feedback) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 text-center max-w-sm mx-auto">
        <div className="text-5xl mb-3">{feedback.correct ? (feedback.isSynonym ? "💡" : "✅") : "❌"}</div>

        <div className="flex items-center gap-2 justify-center mb-1">
          <p className="text-slate-300 font-semibold text-lg">{feedback.initialForm}</p>
          {feedback.partOfSpeech && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {feedback.partOfSpeech}
            </span>
          )}
        </div>

        <h2 className={`text-xl font-bold mb-3 ${feedback.correct ? "text-green-400" : "text-red-400"}`}>
          {feedback.correct ? (feedback.isSynonym ? "Synonym Accepted!" : "Correct!") : "Not quite"}
        </h2>

        {/* Detailed Explanation Box */}
        <div className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-left mb-4 shadow-lg text-sm">
          <p className="text-slate-400 text-xs mb-1">
            Accepted Meaning: <span className="text-white font-semibold">{feedback.correctAnswer}</span>
          </p>

          {feedback.isSynonym && (
            <p className="text-emerald-400 text-xs mb-2">
              ✨ <i>"{feedback.userAnswer}"</i> conveys the same core meaning.
            </p>
          )}

          {feedback.synonyms && (
            <p className="text-indigo-300 text-xs mb-2">
              <span className="text-slate-400 font-semibold">Synonyms:</span> {feedback.synonyms}
            </p>
          )}

          {feedback.explanation && (
            <p className="text-slate-300 text-xs mb-2 leading-relaxed">
              <span className="text-slate-400 font-semibold">Note:</span> {feedback.explanation}
            </p>
          )}

          {feedback.sentence && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <p className="text-[11px] text-slate-400 font-semibold mb-0.5">Example in context:</p>
              <p
                className="text-xs text-slate-300 italic"
                dangerouslySetInnerHTML={{ __html: feedback.sentence }}
              />
            </div>
          )}
        </div>

        {feedback.mastered && (
          <p className="text-indigo-400 font-semibold text-sm mb-4">🎉 Word mastered and saved permanently!</p>
        )}

        <button
          onClick={handleContinue}
          className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
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
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-widest text-indigo-200">What does this mean?</span>
          {current.part_of_speech && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-400/40 text-indigo-200">
              {current.part_of_speech}
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-white leading-snug">{displayWord}</p>
      </div>

      {questionType === "choice" ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
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


// import React, { useEffect, useState } from "react";

// function shuffle(arr) {
//   const a = [...arr];
//   for (let i = a.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [a[i], a[j]] = [a[j], a[i]];
//   }
//   return a;
// }

// export default function Quiz({ cards, API, authHeaders, onExit }) {
//   const [queue, setQueue] = useState(() => shuffle(cards));
//   const [current, setCurrent] = useState(null);
//   const [questionType, setQuestionType] = useState("type"); // "type" | "choice"
//   const [options, setOptions] = useState([]);
//   const [typedAnswer, setTypedAnswer] = useState("");
//   const [feedback, setFeedback] = useState(null); // { correct, correctAnswer, mastered, word }
//   const [submitting, setSubmitting] = useState(false);
//   const [masteredCount, setMasteredCount] = useState(0);
//   const [answeredCount, setAnsweredCount] = useState(0);

//   // Pick the next question whenever the queue advances and nothing is being
//   // shown right now (no feedback panel up, no card in flight).
//   useEffect(() => {
//     if (feedback || current) return;
//     if (queue.length === 0) return;

//     const next = queue[0];

//     // Pull distractors from the full card pool (not just the shrinking
//     // queue) so options stay varied even late in a session.
//     const distractorPool = cards
//       .filter((c) => c.id !== next.id)
//       .map((c) => c.correction)
//       .filter((text, i, arr) => text && arr.indexOf(text) === i);

//     const canOfferChoice = distractorPool.length >= 1;
//     const type = canOfferChoice && Math.random() < 0.5 ? "choice" : "type";

//     if (type === "choice") {
//       const distractors = shuffle(distractorPool).slice(0, 3);
//       setOptions(shuffle([next.correction, ...distractors]));
//     } else {
//       setOptions([]);
//     }

//     setQuestionType(type);
//     setCurrent(next);
//     setTypedAnswer("");
//   }, [queue, feedback, current, cards]);

//   async function submitAnswer(answer) {
//     if (submitting || !current) return;
//     setSubmitting(true);
//     try {
//       const res = await fetch(`${API}/api/flashcards/${current.id}/quiz`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", ...authHeaders },
//         body: JSON.stringify({ answer }),
//       });
//       const data = await res.json();

//       setAnsweredCount((n) => n + 1);
//       if (data.mastered) setMasteredCount((n) => n + 1);

//       setFeedback({
//         correct: data.correct,
//         correctAnswer: data.correctAnswer,
//         mastered: data.mastered,
//         word: current.word,
//       });

//       setQueue((prev) => {
//         const rest = prev.slice(1);
//         return data.mastered ? rest : [...rest, current];
//       });
//     } catch (err) {
//       console.error("Quiz answer error:", err.message);
//       // Don't strand the user on a dead submit — just move on without
//       // crediting or penalizing the card.
//       setQueue((prev) => [...prev.slice(1), current]);
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   function handleContinue() {
//     setFeedback(null);
//     setCurrent(null);
//   }

//   // ── Completion screen ──────────────────────────────────────────────────────
//   if (!current && !feedback && queue.length === 0) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
//         <div className="text-6xl mb-6">🏆</div>
//         <h1 className="text-2xl font-bold text-white mb-2">All words mastered!</h1>
//         <p className="text-slate-400 mb-8">
//           {masteredCount} word{masteredCount !== 1 ? "s" : ""} answered correctly three times in a row.
//         </p>
//         <div className="w-full max-w-xs bg-slate-800 rounded-2xl p-6 mb-6" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
//           <p className="text-3xl font-bold text-indigo-400">{answeredCount}</p>
//           <p className="text-slate-400 text-sm mt-1">Questions answered</p>
//         </div>
//         <button
//           onClick={onExit}
//           className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
//         >
//           Back to games
//         </button>
//       </div>
//     );
//   }

//   // ── Feedback panel ───────────────────────────────────────────────────────────
//   if (feedback) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
//         <div className="text-6xl mb-4">{feedback.correct ? "✅" : "❌"}</div>
//         <p className="text-slate-400 text-sm mb-1">{feedback.word}</p>
//         <h2 className={`text-xl font-bold mb-4 ${feedback.correct ? "text-green-400" : "text-red-400"}`}>
//           {feedback.correct ? "Correct!" : "Not quite"}
//         </h2>
//         {!feedback.correct && (
//           <p className="text-slate-300 mb-2">
//             Correct answer: <span className="text-white font-semibold">{feedback.correctAnswer}</span>
//           </p>
//         )}
//         {feedback.mastered && (
//           <p className="text-indigo-400 font-semibold mb-4">🎉 Mastered — removed from your deck!</p>
//         )}
//         <button
//           onClick={handleContinue}
//           className="mt-4 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
//         >
//           Continue
//         </button>
//       </div>
//     );
//   }

//   // ── Question ──────────────────────────────────────────────────────────────────
//   if (!current) return null; // brief gap while the effect above picks the next question

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
//       <div className="w-full max-w-sm mb-6 text-center">
//         <p className="text-slate-400 text-sm">{queue.length} word{queue.length !== 1 ? "s" : ""} left to master</p>
//       </div>

//       <div
//         className="w-full max-w-sm rounded-2xl p-8 mb-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-center"
//         style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
//       >
//         <p className="text-xs uppercase tracking-widest text-indigo-200 mb-4">What does this mean?</p>
//         <p className="text-3xl font-bold text-white leading-snug">{current.word}</p>
//       </div>

//       {questionType === "choice" ? (
//         <div className="w-full max-w-sm flex flex-col gap-3">
//           {options.map((opt, i) => (
//             <button
//               key={i}
//               disabled={submitting}
//               onClick={() => submitAnswer(opt)}
//               className="w-full py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-left px-4 hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
//             >
//               {opt}
//             </button>
//           ))}
//         </div>
//       ) : (
//         <form
//           className="w-full max-w-sm flex flex-col gap-3"
//           onSubmit={(e) => {
//             e.preventDefault();
//             if (typedAnswer.trim()) submitAnswer(typedAnswer.trim());
//           }}
//         >
//           <input
//             type="text"
//             value={typedAnswer}
//             onChange={(e) => setTypedAnswer(e.target.value)}
//             disabled={submitting}
//             autoFocus
//             placeholder="Type the meaning..."
//             className="w-full py-3.5 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
//           />
//           <button
//             type="submit"
//             disabled={submitting || !typedAnswer.trim()}
//             className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
//           >
//             Submit
//           </button>
//         </form>
//       )}
//     </div>
//   );
// }
