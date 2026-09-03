import React from "react";
export default function Summary({ stats, total, onExit }) {
  const pct = total > 0 ? Math.round((stats.remembered / total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">{pct >= 25 ? "🎉" : pct >= 15 ? "💪" : "📖"}</div>
      <h1 className="text-2xl font-bold text-white mb-2">Session Complete!</h1>
      <p className="text-slate-400 mb-8">Here's how you did:</p>
      <div className="w-full max-w-xs bg-slate-800 rounded-2xl p-6 mb-6" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div className="flex justify-around mb-4">
          <div>
            <p className="text-3xl font-bold text-green-400">{stats.remembered}</p>
            <p className="text-slate-400 text-sm mt-1">Remembered</p>
          </div>
          <div className="w-px bg-slate-700" />
          <div>
            <p className="text-3xl font-bold text-red-400">{stats.forgot}</p>
            <p className="text-slate-400 text-sm mt-1">Forgot</p>
          </div>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-slate-300 mt-3 font-semibold">{pct}% accuracy</p>
      </div>
      <p className="text-slate-400 text-sm">
        {pct >= 70 ? "Amazing work! Keep practicing!" : pct >= 40 ? "Good effort! Review forgotten words tomorrow." : "Keep going — practice makes perfect!"}
      </p>
      {onExit && (
        <button
          onClick={onExit}
          className="mt-8 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
        >
          Back to games
        </button>
      )}
    </div>
  );
}

