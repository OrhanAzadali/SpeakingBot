import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Timer,
  Flame,
  Award,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Zap,
  Volume2,
} from 'lucide-react';
import { GAMES_VOCABULARY } from '../../data/gamesVocabularyData';

export const WordPairsGame = ({
  targetLanguage = 'English',
  mediatorLanguage = 'az',
  onGainXp,
}) => {
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [tiles, setTiles] = useState([]);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [matchedPairKeys, setMatchedPairKeys] = useState(new Set());
  const [mismatchedIds, setMismatchedIds] = useState([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const totalPairsRef = useRef(6);

  // Audio Synth for pleasant feedback
  const playSound = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'match') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'mismatch') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'victory') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // Start / Restart game board
  const startNewGame = () => {
    const normLang = targetLanguage.toLowerCase();
    let wordsPool = GAMES_VOCABULARY.filter(
      (v) => (v.language || 'English').toLowerCase() === normLang
    );

    if (wordsPool.length < 6 && normLang !== 'english') {
      wordsPool = [
        ...wordsPool,
        ...GAMES_VOCABULARY.filter((v) => (v.language || 'English').toLowerCase() === 'english'),
      ];
    }

    if (selectedLevel !== 'ALL') {
      const byLevel = wordsPool.filter((v) => v.level === selectedLevel);
      if (byLevel.length >= 4) wordsPool = byLevel;
    }

    // Pick 6 unique words
    const shuffledPool = [...wordsPool].sort(() => Math.random() - 0.5).slice(0, 6);
    totalPairsRef.current = shuffledPool.length;

    // Build pairs: one tile with Target word, one with Mediator translation
    const generatedTiles = [];
    shuffledPool.forEach((item, idx) => {
      const pairKey = `pair-${idx}-${item.word}`;
      const translation =
        item.translations?.[mediatorLanguage] ||
        item.translations?.en ||
        item.translations?.az ||
        item.word;

      // Target language tile
      generatedTiles.push({
        id: `${pairKey}-target`,
        pairKey,
        text: item.word,
        subtext: item.ipa || item.pos,
        type: 'target',
        level: item.level,
      });

      // Mediator language tile
      generatedTiles.push({
        id: `${pairKey}-mediator`,
        pairKey,
        text: translation,
        subtext: 'Translation',
        type: 'mediator',
        level: item.level,
      });
    });

    // Randomize tile positions
    const randomized = generatedTiles.sort(() => Math.random() - 0.5);
    setTiles(randomized);
    setSelectedTileId(null);
    setMatchedPairKeys(new Set());
    setMismatchedIds([]);
    setMatchedCount(0);
    setScore(0);
    setStreak(0);
    setTimeLeft(60);
    setIsGameOver(false);
    setIsVictory(false);
  };

  useEffect(() => {
    startNewGame();
  }, [targetLanguage, selectedLevel]);

  // Countdown timer
  useEffect(() => {
    if (isGameOver || isVictory || timeLeft <= 0) {
      if (timeLeft <= 0 && !isVictory) {
        setIsGameOver(true);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isGameOver, isVictory]);

  const handleTileClick = (tile) => {
    if (isGameOver || isVictory) return;
    if (matchedPairKeys.has(tile.pairKey)) return;
    if (selectedTileId === tile.id) return; // already selected

    if (!selectedTileId) {
      // First tile of pair clicked
      setSelectedTileId(tile.id);
      return;
    }

    // Second tile clicked
    const firstTile = tiles.find((t) => t.id === selectedTileId);
    if (!firstTile) {
      setSelectedTileId(tile.id);
      return;
    }

    // Check if matching pair
    if (firstTile.pairKey === tile.pairKey && firstTile.id !== tile.id) {
      // SUCCESSFUL MATCH!
      playSound('match');
      setMatchedPairKeys((prev) => new Set([...prev, tile.pairKey]));
      setSelectedTileId(null);

      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      const points = 100 + newStreak * 25;
      setScore((prev) => prev + points);
      setMatchedCount((prev) => {
        const next = prev + 1;
        if (next >= totalPairsRef.current) {
          // VICTORY!
          setIsVictory(true);
          playSound('victory');
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
            });
          } catch {}
          if (onGainXp) {
            onGainXp(60 + newStreak * 10, 'Cleared Word Pairs Game');
          }
        }
        return next;
      });
    } else {
      // MISMATCH
      playSound('mismatch');
      setMismatchedIds([firstTile.id, tile.id]);
      setStreak(0);

      setTimeout(() => {
        setMismatchedIds([]);
        setSelectedTileId(null);
      }, 700);
    }
  };

  const levels = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top HUD */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              Word Pairs Match
            </span>
            <span className="text-xs text-slate-400">
              Target: <strong className="text-white">{targetLanguage}</strong>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
            Connect Target Words & Native Meanings
          </h2>
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition ${
                selectedLevel === lvl
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row: Timer, Score, Streak, Pairs Remaining */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 font-mono text-center">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <Timer className="w-3 h-3 text-sky-400" /> Time
          </div>
          <div className={`text-xl sm:text-2xl font-black mt-0.5 ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Score
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
            {score}
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" /> Streak
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-400 mt-0.5">
            x{streak}
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Pairs
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
            {matchedCount}/{totalPairsRef.current}
          </div>
        </div>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const isSelected = selectedTileId === tile.id;
          const isMatched = matchedPairKeys.has(tile.pairKey);
          const isMismatched = mismatchedIds.includes(tile.id);

          return (
            <button
              key={tile.id}
              disabled={isMatched || isGameOver || isVictory}
              onClick={() => handleTileClick(tile)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between min-h-[96px] select-none ${
                isMatched
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 opacity-60 pointer-events-none scale-95'
                  : isMismatched
                  ? 'bg-rose-500/20 border-rose-500 text-rose-200 animate-shake'
                  : isSelected
                  ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/20 scale-[1.03] ring-2 ring-sky-400'
                  : tile.type === 'target'
                  ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 text-white hover:bg-slate-800/80 active:scale-95'
                  : 'bg-slate-900/70 border-indigo-500/30 hover:border-indigo-500/50 text-slate-200 hover:bg-slate-800/80 active:scale-95'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    tile.type === 'target'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-indigo-500/20 text-indigo-300'
                  }`}
                >
                  {tile.type === 'target' ? tile.level : 'Native'}
                </span>

                {isMatched && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>

              <div className="my-1">
                <div className="text-sm sm:text-base font-bold tracking-tight line-clamp-2">
                  {tile.text}
                </div>
                {tile.subtext && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {tile.subtext}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Victory / Game Over Overlay */}
      {(isVictory || isGameOver) && (
        <div className="p-6 bg-slate-900 border border-slate-700 rounded-3xl text-center space-y-4 shadow-2xl animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            {isVictory ? <Award className="w-8 h-8" /> : <Timer className="w-8 h-8 text-rose-400" />}
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">
              {isVictory ? 'All Word Pairs Matched!' : 'Time Expired!'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isVictory
                ? `Phenomenal memory! Score: ${score} pts • Max Streak: x${maxStreak}`
                : `You matched ${matchedCount} of ${totalPairsRef.current} pairs. Practice again to beat the clock!`}
            </p>
          </div>

          <button
            onClick={startNewGame}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg transition flex items-center gap-2 mx-auto"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      )}
    </div>
  );
};
