import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { CubeWordCard } from './CubicWords/CubeWordCard';
import { CubeWordGame } from './CubicWords/CubeWordGame';
import { FlashcardsGame } from './games/FlashcardsGame';
import { WordPairsGame } from './games/WordPairsGame';
import { WordQuest3DGame } from './games/WordQuest3DGame';
import { MemoryMatch } from './games/MemoryMatch';
import { WordBuilder } from './games/WordBuilder';
import {
  Gamepad2,
  Sparkles,
  Layers,
  Zap,
  Target,
  ArrowRight,
  X,
  Trophy,
  Flame,
  Volume2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export const GAMES_INFO = [
  {
    id: 'cubeword',
    title: 'Polyhedral 3D Cubic Words',
    description: '3D WebGL physics-based falling block vocabulary game. Match, construct words, and trigger combos before time runs out.',
    icon: '🧊',
    badge: 'WebGL 3D',
    xp: 50,
  },
  {
    id: 'flashcards',
    title: '3D Spaced Repetition Flashcards',
    description: 'Interactive cards with 3D flip animations, IPA phonetics, TTS pronunciation, and Leitner retention tracking.',
    icon: '📇',
    badge: 'Spaced Repetition',
    xp: 30,
  },
  {
    id: 'wordpairs',
    title: 'Rapid-Fire Word Pairs Matcher',
    description: 'Race against the clock matching target vocabulary words with mediator translations to build highest combo streaks.',
    icon: '⚡',
    badge: 'Speed Drill',
    xp: 40,
  },
  {
    id: 'wordquest3d',
    title: 'Word Quest 3D Arena',
    description: 'Spatial puzzle quest where you navigate 3D nodes to discover definitions, phonetic cues, and complete lexical challenges.',
    icon: '🧭',
    badge: '3D Spatial',
    xp: 45,
  },
  {
    id: 'memory',
    title: 'Memory Match Sprint',
    description: 'Flip cards, match synonym pairs, and improve retention with spaced intervals.',
    icon: '🧠',
    badge: 'Cognitive',
    xp: 35,
  },
  {
    id: 'wordbuilder',
    title: 'Word Builder Studio',
    description: 'Construct valid sub-words using interactive letter tiles from target root words.',
    icon: '🔤',
    badge: 'Anagram',
    xp: 40,
  },
];

export const GamesHub = ({
  targetLanguage = 'English',
  mediatorLanguage = 'az',
  onGainXp,
  onSaveToVocabulary,
  onSelectToken,
  initialActiveGame = null,
  onCloseGame,
  asSection = false,
  themeColors = {}
}) => {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState(initialActiveGame);
  const [gameLanguage, setGameLanguage] = useState(targetLanguage);

  useEffect(() => {
    setActiveGame(initialActiveGame);
  }, [initialActiveGame]);

  useEffect(() => {
    setGameLanguage(targetLanguage);
  }, [targetLanguage]);

  const [cubeHighScore, setCubeHighScore] = useState(() => {
    try {
      return Number(localStorage.getItem('cubeword_highscore') || '0');
    } catch {
      return 0;
    }
  });

  const handleLaunchGame = (gameId, lang = targetLanguage) => {
    setGameLanguage(lang);
    setActiveGame(gameId);
  };

  const handleCloseGame = () => {
    setActiveGame(null);
    if (onCloseGame) {
      onCloseGame();
    }
  };

  // If a game is active, render it full-screen taking the entire page space
  if (activeGame === 'cubeword') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200"
        style={themeColors?.brand?.badgeStyle}>
        <div className="max-w-6xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl"
          style={themeColors?.brand?.iconStyle}>
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
            style={themeColors?.brand?.badgeStyle}
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-cyan-400 font-mono"
            style={themeColors?.grammar?.badgeStyle}>
            3D Cube Word Tetris &bull; {gameLanguage || targetLanguage}
          </span>
        </div>
        <div className="max-w-6xl w-full mx-auto pb-12">
          <CubeWordGame
            onClose={handleCloseGame}
            targetLanguage={gameLanguage || targetLanguage}
            initialMediatorLanguage={mediatorLanguage}
            onSaveToVocabulary={onSaveToVocabulary}
            onGainXp={(pts) => {
              if (onGainXp) onGainXp('cubeword', pts, 25);
            }}
            apiBase=""
            themeColors={themeColors}
          />
        </div>
      </div>
    );
  }

  if (activeGame === 'flashcards') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200"
        style={themeColors?.flashcards?.hex ? { color: themeColors.flashcards.hex } : undefined} >
        <div className="max-w-5xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl"
          style={themeColors?.flashcards?.iconStyle}>
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-sky-400 font-mono">
            3D Spaced Repetition &bull; {targetLanguage}
          </span>
        </div>
        <div className="max-w-5xl w-full mx-auto pb-12"
          style={themeColors?.flashcards?.style}>
          <FlashcardsGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            userLevel="B1"
            themeColors={themeColors}
            onSelectToken={onSelectToken}
            onSaveToVocabulary={onSaveToVocabulary}
            onGainXp={(xp) => {
              if (onGainXp) onGainXp('flashcards', xp, 10);
            }}
          />
        </div>
      </div >
    );
  }

  if (activeGame === 'wordpairs') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200">
        <div className="max-w-5xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl">
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-emerald-400 font-mono">
            Speed Matching &bull; {targetLanguage}
          </span>
        </div>
        <div className="max-w-5xl w-full mx-auto pb-12">
          <WordPairsGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            onSaveToVocabulary={onSaveToVocabulary}
            onGainXp={(xp) => {
              if (onGainXp) onGainXp('wordpairs', xp, 20);
            }}
          />
        </div>
      </div>
    );
  }

  if (activeGame === 'wordquest3d') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200">
        <div className="max-w-5xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl">
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-fuchsia-400 font-mono">
            Retro 3D Perspective &bull; {targetLanguage}
          </span>
        </div>
        <div className="max-w-5xl w-full mx-auto pb-12">
          <WordQuest3DGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            onSaveToVocabulary={onSaveToVocabulary}
            onGainXp={(xp) => {
              if (onGainXp) onGainXp('wordquest3d', xp, 25);
            }}
          />
        </div>
      </div>
    );
  }

  if (activeGame === 'memory') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200">
        <div className="max-w-5xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl">
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-sky-400 font-mono">
            Memory Match &bull; {targetLanguage}
          </span>
        </div>
        <div className="max-w-5xl w-full mx-auto pb-12">
          <MemoryMatch
            targetLanguage={targetLanguage}
            userLevel="B1"
            onSaveToVocabulary={onSaveToVocabulary}
            onClose={handleCloseGame}
            onGainXp={(xp) => {
              if (onGainXp) onGainXp('memory', xp, 20);
            }}
          />
        </div>
      </div>
    );
  }

  if (activeGame === 'wordbuilder') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto p-3 sm:p-6 flex flex-col justify-start animate-in fade-in duration-200">
        <div className="max-w-5xl w-full mx-auto mb-4 flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 px-4 shadow-xl">
          <button
            type="button"
            onClick={handleCloseGame}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs font-bold transition border border-slate-700 hover:border-rose-500/40 cursor-pointer shadow-md"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close & Exit Game</span>
          </button>
          <span className="text-xs font-bold text-emerald-400 font-mono">
            Word Builder Anagram &bull; {targetLanguage}
          </span>
        </div>
        <div className="max-w-5xl w-full mx-auto pb-12">
          <WordBuilder
            targetLanguage={targetLanguage}
            userLevel="B1"
            onSaveToVocabulary={onSaveToVocabulary}
            onClose={handleCloseGame}
            onGainXp={(xp) => {
              if (onGainXp) onGainXp('wordbuilder', xp, 25);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Banner (shown if full tab, or compact header if section) */}
      {!asSection ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30">
                  <Gamepad2 className="w-5 h-5" />
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Interactive Language Games
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Synced with @SpeakBot
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl">
                Master vocabulary and lexical recall through immersive 3D Polyhedral Tetris, rapid-fire Word Pairs, 3D Flashcards, and spatial quests with real-time audio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400 font-medium">Best 3D Score:</span>
                <strong className="text-amber-300 font-bold">{cubeHighScore} pts</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Interactive Games & 3D Quests</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold uppercase tracking-wider">
                  6 Interactive Modes
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sharpen lexical agility with WebGL 3D cube physics, spaced repetition, memory sprints, and anagram builders
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Showcase Card: Polyhedral 3D Cubic Words Game */}
      <CubeWordCard
        currentLanguage={targetLanguage.toLowerCase()}
        highScore={cubeHighScore}
        onLaunchGame={(lang) => handleLaunchGame('cubeword', lang)}
        themeColors={themeColors}
      />

      {/* Grid of the other 3 Games: Flashcards, Word Pairs, Word Quest 3D */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: 3D Spaced Repetition Flashcards */}
        <div className="flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all shadow-xl hover:shadow-2xl hover:shadow-sky-950/20 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                3D Flashcards
              </span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                Spaced Repetition
              </span>
            </div>

            <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors mb-2">
              Lexical Flashcards & Audio
            </h3>
            <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
              Interactive 3D double-sided flip cards featuring morphological breakdowns, IPA phonetics, and native speech synthesis.
            </p>

            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dual-sided 3D card flip animation</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Native phonetic pronunciation engine</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart SRS review scheduling</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchGame('flashcards')}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Play Flashcards</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: Fast-Paced Word Pairs */}
        <div className="flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all shadow-xl hover:shadow-2xl hover:shadow-emerald-950/20 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Speed Match
              </span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                60s Blitz
              </span>
            </div>

            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors mb-2">
              Word Pairs Match
            </h3>
            <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
              Match foreign terms with native equivalents against the ticking clock. Build multipliers and trigger victory celebrations!
            </p>

            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Streak combos & score multipliers</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Synthesizer audio harmonic feedback</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>A1 through C2 CEFR difficulty modes</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchGame('wordpairs')}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Play Word Pairs</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 3: 3D Perspective Word Quest */}
        <div className="flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-fuchsia-500/50 transition-all shadow-xl hover:shadow-2xl hover:shadow-fuchsia-950/20 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-fuchsia-500/20 transition-all" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                3D Canvas
              </span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                Retro Arcade
              </span>
            </div>

            <h3 className="text-lg font-bold text-white group-hover:text-fuchsia-300 transition-colors mb-2">
              Word Quest 3D Arena
            </h3>
            <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
              Navigate a 3D perspective depth tunnel, lock on to target floating lexical spheres, and blast correct translations before time expires.
            </p>

            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>60 FPS 3D spatial tunnel rendering</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Particle explosion fireworks on hit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Progressive speed & multi-life mechanics</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchGame('wordquest3d')}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Play Word Quest 3D</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 4: Memory Match Sprint */}
        <div className="flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all shadow-xl hover:shadow-2xl hover:shadow-sky-950/20 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Cognitive Match
              </span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                Spaced Recall
              </span>
            </div>

            <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors mb-2">
              Memory Match Sprint
            </h3>
            <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
              Flip hidden cards to discover matching synonym pairs. Keep track of moves and streak combos to reinforce retention.
            </p>

            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Streak combos & score multipliers</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI-generated CEFR vocabulary cards</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-sky-400" />
                <span>+35 XP completion reward</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchGame('memory')}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Play Memory Match</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 5: Word Builder Studio */}
        <div className="flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all shadow-xl hover:shadow-2xl hover:shadow-emerald-950/20 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Anagram Studio
              </span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                Word Crafting
              </span>
            </div>

            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors mb-2">
              Word Builder Studio
            </h3>
            <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
              Construct valid lexical sub-words using interactive letter tiles from target root words to maximize vocabulary recall.
            </p>

            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dynamic anagram verification</span>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Interactive tile click-and-type input</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-sky-400" />
                <span>+40 XP completion reward</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleLaunchGame('wordbuilder')}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Play Word Builder</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
