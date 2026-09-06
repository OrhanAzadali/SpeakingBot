import React, { useState, useEffect } from 'react';
import { ThreeCubeWordCanvas } from './ThreeCubeWordCanvas.jsx';
import { pronounceWordVoice } from './soundEffects.js';
import {
  Trophy,
  HelpCircle,
  X,
  BookOpen,
  BookmarkPlus,
  Flame,
  Volume2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: 'english', label: 'English', flag: '🇬🇧' },
  { id: 'spanish', label: 'Español', flag: '🇪🇸' },
  { id: 'russian', label: 'Русский', flag: '🇷🇺' },
  { id: 'german', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'french', label: 'Français', flag: '🇫🇷' },
  { id: 'italian', label: 'Italiano', flag: '🇮🇹' },
];

export const CubeWordGame = ({
  onClose,
  initialLanguage = 'english',
  onSaveToVocabulary,
  apiBase = '',
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return Number(localStorage.getItem('cubeword_highscore') || '0');
    } catch {
      return 0;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [savedWordsMap, setSavedWordsMap] = useState({});

  // Discovered words philological notebook
  const [discoveredWords, setDiscoveredWords] = useState([]);
  const [recentWordsAcrossRounds, setRecentWordsAcrossRounds] = useState([]);

  useEffect(() => {
    if (totalScore > highScore) {
      setHighScore(totalScore);
      try {
        localStorage.setItem('cubeword_highscore', String(totalScore));
      } catch {
        // Ignore
      }
    }
  }, [totalScore, highScore]);

  const handleRoundWin = (nextRound, pointsEarned) => {
    setTotalScore((prev) => prev + pointsEarned);
    setRound(nextRound);
  };

  const handleWordDiscovered = (result) => {
    setDiscoveredWords((prev) => [result, ...prev]);
    setRecentWordsAcrossRounds((prev) => [result.word, ...prev.slice(0, 44)]);
  };

  const handleSaveWord = (result) => {
    setSavedWordsMap((prev) => ({ ...prev, [result.word]: true }));
    if (onSaveToVocabulary) {
      onSaveToVocabulary(result.word, result.definition, result.partOfSpeech);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      {/* Top Navbar */}
      <header className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Exit Game"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-slate-950 shadow-md">
              3D
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-tight">
                Polyhedral Cube Tetris
              </h1>
              <span className="text-[11px] text-cyan-400 font-medium">
                AI Philological Word Cascade
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              setRound(1);
              setRecentWordsAcrossRounds([]);
            }}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Best:</span>
            <strong className="text-amber-300">{highScore}</strong>
          </div>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 text-xs font-semibold transition"
            title="View Discovered Words"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Words</span>
            <span className="bg-indigo-500/40 px-1.5 py-0.2 rounded text-[10px] font-bold">
              {discoveredWords.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Game Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3D Game Arena Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-5 relative">
        <ThreeCubeWordCanvas
          key={`canvas-${selectedLanguage}-${round}`}
          language={selectedLanguage}
          round={round}
          onRoundWin={handleRoundWin}
          onGameOver={() => { }}
          onWordDiscovered={handleWordDiscovered}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((prev) => !prev)}
          recentWordsHistory={recentWordsAcrossRounds}
          apiBase={apiBase}
        />
      </main>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">How to Play 3D Cube Tetris</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-cyan-300 mb-1">1. Real 3D Polyhedral Letter Cubes</h4>
                <p>
                  Every falling cube has <strong>distinct letters on each of its 6 sides</strong>. While in flight, smoothly rotate the cube around its axis (press <strong>Arrow Up / W / tap the 3D cube</strong>) to select the letter face you need!
                </p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <span>2. Mid-Flight Mouse Dragging & Stacking</span>
                </h4>
                <p>
                  <strong>Click and drag the cube with your mouse cursor or finger</strong> across the screen to smoothly change its horizontal position along the X-axis! You can also use <strong>Arrow Left / Right</strong> or tactile on-screen buttons.
                </p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-amber-300 mb-1">3. AI Philological Word Recognition</h4>
                <p>
                  When contiguous blocks form an authentic dictionary word in your target language, <strong>Gemini AI</strong> validates it. The entire word <strong>blinks several times with magical gold aura</strong>, a native voice <strong>distinctively pronounces the word</strong>, and blocks vanish!
                </p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-fuchsia-300 mb-1">4. Scoring & 2X Combo Multiplier</h4>
                <ul className="list-disc list-inside space-y-1 mt-1 text-slate-200">
                  <li>Words under 10 letters: <strong>10 points</strong></li>
                  <li>Words of 10+ letters: <strong>20 points</strong></li>
                  <li>10+ letters or complex philological terms: <strong>2X Combo Multiplier (points × 2)!</strong></li>
                </ul>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-rose-300 mb-1">5. Round Goals & Ceiling Hazard</h4>
                <p>
                  • <strong>Round 1:</strong> Win goal is 15 words. Blocks fall slowly.<br />
                  • <strong>Next Rounds:</strong> Win goal increases by +15 words each round. Speed accelerates and blocks adjust to fit 9+ letter terms.<br />
                  • <strong>Anti-Repetition:</strong> Words used in the current or previous 2 rounds cannot be repeated.<br />
                  • <strong>Ceiling Rule:</strong> If unformed heaps stack to the top ceiling, the round is lost!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-xs shadow-lg transition"
            >
              Start Playing! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Discovered Words Notebook Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Discovered Vocabulary</h3>
                <p className="text-xs text-slate-400">
                  Words validated by Gemini AI philology ({discoveredWords.length} words)
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {discoveredWords.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No words formed yet in this session. Stack blocks to form words!
                </div>
              ) : (
                discoveredWords.map((item, idx) => (
                  <div
                    key={`word-${idx}-${item.word}`}
                    className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-cyan-300 tracking-wide">
                          {item.word}
                        </span>
                        {item.ipa && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.ipa}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase font-semibold">
                          {item.partOfSpeech}
                        </span>
                        {item.isComplexTerm && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            2X Combo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{item.definition}</p>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        +{item.points} points awarded
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => pronounceWordVoice(item.word, selectedLanguage)}
                        className="p-2 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition"
                        title="Listen to Native Pronunciation"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveWord(item)}
                        disabled={savedWordsMap[item.word]}
                        className={`p-2 rounded-lg transition flex items-center gap-1 text-xs font-semibold ${savedWordsMap[item.word]
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        title="Save to Personal Flashcards & Vocabulary"
                      >
                        {savedWordsMap[item.word] ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="w-full mt-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs"
            >
              Back to Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
