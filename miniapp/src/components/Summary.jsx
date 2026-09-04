// Summary.jsx
import React from "react";

export default function Summary({ stats, total, onExit }) {
  const pct = total > 0 ? Math.round((stats.remembered / total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center py-8">
      {/* Dynamic Milestone Icon */}
      <div className="text-6xl mb-4 animate-bounce">
        {pct >= 75 ? "🎉" : pct >= 40 ? "💪" : "📖"}
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Session Complete!</h1>
      <p className="text-slate-400 text-sm mb-6">Here's your review performance:</p>

      {/* Accuracy & Score Card */}
      <div
        className="w-full max-w-xs bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 mb-6 shadow-xl"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
      >
        <div className="flex justify-around items-center mb-5">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-green-400">{stats.remembered}</p>
            <p className="text-slate-400 text-xs mt-1 font-medium">Remembered</p>
          </div>

          <div className="w-px h-10 bg-slate-700" />

          <div className="text-center">
            <p className="text-3xl font-extrabold text-red-400">{stats.forgot}</p>
            <p className="text-slate-400 text-xs mt-1 font-medium">Forgot</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 bg-slate-700/80 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-indigo-500" : "bg-amber-500"
              }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-slate-200 text-sm font-semibold">{pct}% accuracy</p>
      </div>

      {/* Actionable Advice */}
      <p className="text-slate-400 text-xs max-w-xs mb-8 leading-relaxed">
        {pct >= 75
          ? "Outstanding work! These words are moving closer to permanent mastery."
          : pct >= 40
            ? "Solid practice session! Words marked 'Forgot' will appear for review sooner."
            : "Keep going! Spaced repetition reinforces retention with each daily review."}
      </p>

      {/* Back to Home Button */}
      {onExit && (
        <button
          onClick={onExit}
          className="w-full max-w-xs py-3.5 px-6 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/30"
        >
          Back to games
        </button>
      )}
    </div>
  );
}