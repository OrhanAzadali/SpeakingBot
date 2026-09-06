import React, { useState } from 'react';
import { Play, Sparkles, Trophy, RotateCw, Volume2, ShieldCheck, Flame } from 'lucide-react';

export const CubeWordCard = ({
  onLaunchGame,
  highScore = 0,
  currentLanguage = 'english',
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  return (
    <div
      id="cubeword-tetris-game-card"
      className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-6 shadow-xl overflow-hidden hover:border-indigo-400/50 transition-all group"
    >
      {/* Ambient background glow effects */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Game Info & Highlights */}
        <div className="space-y-3 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Real 3D WebGL Arena
            </span>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-semibold flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-indigo-400" />
              6-Sided Smooth 3D Axis Rotation
            </span>
            {highScore > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                Best: {highScore} pts
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Polyhedral Cube Tetris
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1">
              Catch 3D letter cubes as they fall from above, rotate through all 6 faces in flight to select your letters, and drag them into position. When contiguous blocks form a valid philological word in your target language, <strong>Gemini AI</strong> validates it, a native voice distinctively pronounces it, and the blocks vanish in a burst of magic!
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>15 Words / Round</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>2X Combo on 10+ Letters</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Native Voice Pronunciation</span>
            </div>
          </div>
        </div>

        {/* 3D Showcase & Launch Action */}
        <div className="flex flex-col items-center sm:items-end justify-center w-full md:w-auto gap-4">
          {/* Animated 3D Preview Cube */}
          <div className="relative w-20 h-20 perspective-[600px] flex items-center justify-center">
            <div className="w-14 h-14 relative transform-style-3d animate-[spin_8s_linear_infinite] shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-black flex items-center justify-center text-xl rounded-lg border-2 border-cyan-300/70 translate-z-[28px] shadow-lg">
                W
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-indigo-700 text-white font-black flex items-center justify-center text-xl rounded-lg border-2 border-purple-300/70 -translate-z-[28px] rotate-y-180">
                O
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-black flex items-center justify-center text-xl rounded-lg border-2 border-emerald-300/70 rotate-x-90 translate-z-[28px]">
                R
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-600 to-pink-700 text-white font-black flex items-center justify-center text-xl rounded-lg border-2 border-rose-300/70 -rotate-x-90 translate-z-[28px]">
                D
              </div>
            </div>
          </div>

          {/* Launch Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400"
            >
              <option value="english">🇬🇧 English</option>
              <option value="spanish">🇪🇸 Spanish</option>
              <option value="russian">🇷🇺 Russian</option>
              <option value="german">🇩🇪 German</option>
              <option value="french">🇫🇷 French</option>
              <option value="italian">🇮🇹 Italian</option>
            </select>

            <button
              type="button"
              id="launch-cubeword-btn"
              onClick={() => onLaunchGame(selectedLanguage)}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40 hover:shadow-cyan-800/60 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Launch 3D Game</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
