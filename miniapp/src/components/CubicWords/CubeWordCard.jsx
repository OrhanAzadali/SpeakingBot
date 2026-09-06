import React, { useState } from 'react';
import { Play, Sparkles, Trophy, RotateCw, Volume2, ShieldCheck, Flame, Cpu, Compass } from 'lucide-react';

export const CubeWordCard = ({
  onLaunchGame,
  highScore = 0,
  currentLanguage = 'english',
  palette = null,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  // Dynamic palette styles or default fallback
  const cardBorder = palette?.style?.borderColor || 'rgba(99, 102, 241, 0.4)';
  const cardShadow = palette?.style?.boxShadow || '0 0 25px rgba(99, 102, 241, 0.2)';
  const badgeStyle = palette?.badgeStyle || {
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    color: '#67e8f9',
    borderColor: 'rgba(6, 182, 212, 0.4)',
  };
  const launchButtonStyle = palette?.buttonStyle || {
    background: 'linear-gradient(135deg, #06b6d4, #4f46e5)',
    boxShadow: '0 4px 20px rgba(6, 182, 212, 0.45)',
  };

  return (
    <div
      id="cubeword-tetris-game-card"
      style={{
        borderColor: cardBorder,
        boxShadow: cardShadow,
      }}
      className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-2 p-6 sm:p-7 md:p-8 shadow-2xl overflow-hidden transition-all duration-500 group animate-glow-pulse w-full"
    >
      {/* Dynamic Ambient Background Glow Orbs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/25 transition-all duration-700 animate-chromatic-aura" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/25 transition-all duration-700" />

      <div className="relative z-10 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 lg:gap-8">
        {/* Left Column: Game Info & Metrics */}
        <div className="space-y-4 flex-1 min-w-0">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span
              style={badgeStyle}
              className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
              Real 3D WebGL Arena
            </span>

            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
              6-Sided Smooth 3D Rotation
            </span>

            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Tokenized NLP Validation
            </span>

            {highScore > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black flex items-center gap-1.5 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Best: {highScore} pts
              </span>
            )}
          </div>

          {/* Title & Description */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Polyhedral Cube Tetris</span>
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-widest font-mono hidden sm:inline">
                WebGL 3D
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mt-2 max-w-2xl">
              Catch 3D letter cubes falling from above, rotate through all 6 faces in flight to pick your letters, and drag them into position. Valid words are recognized with strict linguistic tokenization, pronounced by native voice, and cleared in an arpeggio burst!
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs sm:text-sm text-slate-200 flex items-center gap-2.5 shadow-sm hover:border-slate-600 transition">
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">15 Words / Round</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs sm:text-sm text-slate-200 flex items-center gap-2.5 shadow-sm hover:border-slate-600 transition">
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">2X on 10+ Letters</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs sm:text-sm text-slate-200 flex items-center gap-2.5 shadow-sm hover:border-slate-600 transition col-span-2 sm:col-span-1">
              <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-semibold">Native Audio Voice</span>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Preview Cube & Launch Controls (Guaranteed No Overflow) */}
        <div className="flex flex-col sm:flex-row xl:flex-col items-center justify-center gap-5 shrink-0 w-full xl:w-auto pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800/80">
          {/* Animated 3D Preview Cube with Floating Animation */}
          <div className="relative w-24 h-24 perspective-[800px] flex items-center justify-center animate-float-slow shrink-0">
            <div className="w-16 h-16 relative transform-style-3d animate-[spin_10s_linear_infinite] shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-2xl rounded-xl border-2 border-cyan-300/80 translate-z-[32px] shadow-lg shadow-cyan-500/30">
                W
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-700 text-white font-black flex items-center justify-center text-2xl rounded-xl border-2 border-purple-300/80 -translate-z-[32px] rotate-y-180 shadow-lg shadow-purple-500/30">
                O
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-700 text-white font-black flex items-center justify-center text-2xl rounded-xl border-2 border-emerald-300/80 rotate-x-90 translate-z-[32px] shadow-lg shadow-emerald-500/30">
                R
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-600 via-pink-600 to-orange-700 text-white font-black flex items-center justify-center text-2xl rounded-xl border-2 border-rose-300/80 -rotate-x-90 translate-z-[32px] shadow-lg shadow-rose-500/30">
                D
              </div>
            </div>
          </div>

          {/* Launch Controls Container: Clean Responsive Layout */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Language Selection */}
            <select
              id="cubeword-language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700 text-slate-100 text-xs sm:text-sm font-bold rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-400 transition shadow-md cursor-pointer w-full sm:w-44 shrink-0"
            >
              <option value="english">🇬🇧 English</option>
              <option value="spanish">🇪🇸 Spanish</option>
              <option value="russian">🇷🇺 Russian</option>
              <option value="german">🇩🇪 German</option>
              <option value="french">🇫🇷 French</option>
              <option value="italian">🇮🇹 Italian</option>
            </select>

            {/* Launch 3D Game Button (Responsive Sizing, Shimmer Light Sweep, No Overflow) */}
            <button
              type="button"
              id="launch-cubeword-btn"
              onClick={() => onLaunchGame(selectedLanguage)}
              style={launchButtonStyle}
              className="shimmer-button w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-95 hover:scale-105 shrink-0 shadow-xl cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white shrink-0" />
              <span className="whitespace-nowrap">Launch 3D Game</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

