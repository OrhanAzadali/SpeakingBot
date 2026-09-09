import React, { useState, useEffect } from 'react';
import { ThreeCubeWordCanvas } from './ThreeCubeWordCanvas.jsx';
import { pronounceWordVoice } from './soundEffects.js';
import {
  CUBE_GAME_TRANSLATIONS,
  UI_LANGUAGES,
  normalizeUiLang,
  normalizeTargetLang,
} from './cubeGameI18n.js';

import {
  Trophy,
  HelpCircle,
  X,
  BookOpen,
  BookmarkPlus,
  Volume2,
  Sparkles,
  CheckCircle2,
  Languages,
} from 'lucide-react';

const TARGET_LANG_META = {
  english: { label: 'English', flag: '🇬🇧' },
  spanish: { label: 'Español', flag: '🇪🇸' },
  russian: { label: 'Русский', flag: '🇷🇺' },
  german: { label: 'Deutsch', flag: '🇩🇪' },
  french: { label: 'Français', flag: '🇫🇷' },
  italian: { label: 'Italiano', flag: '🇮🇹' },
};


export const CubeWordGame = ({
  onClose,
  targetLanguage = 'english',
  initialLanguage = '',
  initialMediatorLanguage = 'az',
  onSaveToVocabulary,
  onGainXp,
  apiBase = '',
  themeColors
}) => {
  // Target language represents the linguistic content being formed with 3D blocks
  const resolvedTargetLanguage = normalizeTargetLang(targetLanguage || initialLanguage || 'english');
  const targetMeta = TARGET_LANG_META[resolvedTargetLanguage] || TARGET_LANG_META.english;

  // Mediator language represents the UI and translation interface
  const [mediatorLanguage, setMediatorLanguage] = useState(() =>
    normalizeUiLang(initialMediatorLanguage || 'az')
  );

  const t = CUBE_GAME_TRANSLATIONS[normalizeUiLang(mediatorLanguage)] || CUBE_GAME_TRANSLATIONS.en;

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

  const [discoveredWords, setDiscoveredWords] = useState([]);
  const [recentWordsAcrossRounds, setRecentWordsAcrossRounds] = useState([]);

  useEffect(() => {
    if (totalScore > highScore) {
      setHighScore(totalScore);
      try {
        localStorage.setItem('cubeword_highscore', String(totalScore));
      } catch { }
    }
  }, [totalScore, highScore]);

  const handleRoundWin = (nextRound, pointsEarned) => {
    setTotalScore((prev) => prev + pointsEarned);
    setRound(nextRound);
    if (onGainXp) {
      onGainXp(pointsEarned);
    }
  };

  const handleWordDiscovered = (result) => {
    setDiscoveredWords((prev) => [result, ...prev]);
    setRecentWordsAcrossRounds((prev) => [result.word, ...prev.slice(0, 44)]);
    if (onGainXp && result.points) {
      onGainXp(result.points);
    }
  };

  const handleSaveWord = (result) => {
    setSavedWordsMap((prev) => ({ ...prev, [result.word]: true }));
    if (onSaveToVocabulary) {
      onSaveToVocabulary(result.word, result.definition, result.partOfSpeech);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative"
      style={themeColors.badge?.brandStyle}>
      {/* Top Navbar */}
      <header className="w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between z-30 sticky top-0 gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0"
          style={themeColors.brand?.iconStyle}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Exit Game"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2"
            style={themeColors.grammar?.iconStyle}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-slate-950 shadow-md">
              3D
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-white leading-tight">
                {t.title}
              </h1>
              <span className="text-[10px] sm:text-[11px] text-cyan-400 font-medium">
                {t.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap sm:flex-nowrap">
          {/* Target Language Indicator (Word Content Language) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs shadow-sm"

            style={themeColors.badge?.brandStyle}
            title={`${t.targetLangTitle}: ${t.targetLangDesc}`
            }
          >
            <span className="text-sm">{targetMeta.flag}</span>
            <span className="text-slate-400 font-medium text-[11px] hidden md:inline">
              {t.targetLangTitle}:
            </span>
            <strong className="text-cyan-300 font-bold capitalize">
              {targetMeta.label}
            </strong>
          </div>

          {/* UI Language Toggler (Mediator Language) */}
          <div className="flex items-center gap-1"
            style={themeColors.flashcards?.style}>
            <div className="relative flex items-center">
              <Languages className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                id="cubeword-ui-mediator-select"
                value={mediatorLanguage}
                onChange={(e) => setMediatorLanguage(e.target.value)}
                className="bg-slate-800/95 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-sm transition"
                title={`${t.uiLangTitle}: ${t.uiLangDesc}`}
              >
                {UI_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* High Score Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs"
            style={themeColors.brand?.iconStyle}>
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Best:</span>
            <strong className="text-amber-300">{highScore}</strong>
          </div>

          {/* Words Notebook Button */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 text-xs font-semibold transition cursor-pointer"

            style={themeColors.brand?.iconStyle}
            title="View Discovered Words"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Words</span>
            <span className="bg-indigo-500/40 px-1.5 py-0.2 rounded text-[10px] font-bold">
              {discoveredWords.length}
            </span>
          </button>

          {/* Rules Modal Button */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Game Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3D Game Arena Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-5 relative"
        style={themeColors.cubeCard}>
        <ThreeCubeWordCanvas
          key={`canvas-${resolvedTargetLanguage}-${round}`}
          language={resolvedTargetLanguage}
          mediatorLanguage={mediatorLanguage}
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
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          style={themeColors.grammar?.style}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"

              style={themeColors.brand?.badgeStyle}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4"
              style={themeColors.flashCards?.style}>
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {t.rulesModalTitle}
                </h3>
                <p className="text-[11px] text-cyan-300 font-medium">
                  {t.targetLangTitle}: {targetMeta.label} ({targetMeta.flag}) &bull; UI: {mediatorLanguage.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[68vh] overflow-y-auto pr-1"
              style={themeColors.brand?.style}>
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-cyan-300 mb-1">{t.rule1Title}</h4>
                <p>{t.rule1Body}</p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60" style={themeColors.quiz?.style}>
                <h4 className="font-bold text-emerald-300 mb-1">{t.rule2Title}</h4>
                <p>{t.rule2Body}</p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-amber-300 mb-1">{t.rule3Title}</h4>
                <p>{t.rule3Body}</p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-fuchsia-300 mb-1">{t.rule4Title}</h4>
                <ul className="list-disc list-inside space-y-1 mt-1 text-slate-200">
                  {t.rule4List.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-rose-300 mb-1">{t.rule5Title}</h4>
                <p>{t.rule5Body}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-xs shadow-lg transition"
            >
              {t.startPlayingBtn}
            </button>
          </div>
        </div>
      )}

      {/* Discovered Words Notebook Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          style={themeColors.flashCards?.style}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative" style={themeColors.match?.iconStyle}>
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400"
                style={themeColors.match?.style}>
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white"
                  style={themeColors.listening?.style}>
                  {t.historyModalTitle}
                </h3>
                <p className="text-xs text-slate-400"
                  style={themeColors.badge?.style}>
                  {t.historyModalSub} ({discoveredWords.length}) &bull; {targetMeta.label} {targetMeta.flag}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1"
              style={themeColors.quiz?.style}>
              {discoveredWords.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  {t.noWordsDiscovered}
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
                        +{item.points} {t.pointsAwarded}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => pronounceWordVoice(item.word, resolvedTargetLanguage)}
                        className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition"
                        title={t.listenVoiceTitle}
                        style={themeColors.listening?.style}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveWord(item)}
                        disabled={savedWordsMap[item.word]}
                        className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-semibold ${savedWordsMap[item.word]
                          ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        title={t.saveWordTitle}

                        style={themeColors.cubeCard}
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
              {t.backToGameBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
