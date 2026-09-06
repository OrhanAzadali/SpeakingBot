import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  RotateCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Sparkles,
  BookOpen,
  Award,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { GAMES_VOCABULARY } from '../../data/gamesVocabularyData';

export const FlashcardsGame = ({
  targetLanguage = 'English',
  mediatorLanguage = 'az',
  onSelectToken,
  onGainXp,
}) => {
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deck, setDeck] = useState([]);
  const [masteredIds, setMasteredIds] = useState(new Set());
  const [reviewQueueIds, setReviewQueueIds] = useState(new Set());
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Initialize or re-filter deck when targetLanguage or level changes
  useEffect(() => {
    const normLang = targetLanguage.toLowerCase();
    let cards = GAMES_VOCABULARY.filter(
      (v) => (v.language || 'English').toLowerCase() === normLang
    );

    if (cards.length < 4 && normLang !== 'english') {
      cards = [
        ...cards,
        ...GAMES_VOCABULARY.filter((v) => (v.language || 'English').toLowerCase() === 'english'),
      ];
    }

    if (selectedLevel !== 'ALL') {
      const byLevel = cards.filter((v) => v.level === selectedLevel);
      if (byLevel.length > 0) cards = byLevel;
    }

    setDeck(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [targetLanguage, selectedLevel]);

  const currentCard = deck[currentIndex] || null;

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (deck.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % deck.length);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (deck.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + deck.length) % deck.length);
    }
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
  };

  const handleRate = (rating) => {
    if (!currentCard) return;

    if (rating === 'easy') {
      setMasteredIds((prev) => new Set([...prev, currentCard.id]));
      setReviewQueueIds((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      if (onGainXp) onGainXp(15, 'Mastered Word');
    } else if (rating === 'good') {
      setReviewQueueIds((prev) => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      if (onGainXp) onGainXp(8, 'Reviewed Word');
    } else {
      // Hard
      setReviewQueueIds((prev) => new Set([...prev, currentCard.id]));
      if (onGainXp) onGainXp(3, 'Study Attempt');
    }

    handleNext();
  };

  const speakWord = (e, text) => {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap = {
        English: 'en-US',
        Spanish: 'es-ES',
        German: 'de-DE',
        French: 'fr-FR',
        Italian: 'it-IT',
        Russian: 'ru-RU',
        Turkish: 'tr-TR',
      };
      utterance.lang = langMap[targetLanguage] || 'en-US';
      utterance.rate = 0.9;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
    }
  };

  const levels = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
              {targetLanguage}
            </span>
            <span className="text-xs text-slate-400">
              Cards: <strong className="text-white">{deck.length}</strong>
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">3D Spaced Repetition Flashcards</h2>
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                setSelectedLevel(lvl);
                setCurrentIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedLevel === lvl
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Progress & Stats Bar */}
      <div className="flex items-center justify-between gap-4 px-2 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mastered: {masteredIds.size}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <RotateCw className="w-3.5 h-3.5" />
            <span>Review: {reviewQueueIds.size}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Card {deck.length > 0 ? currentIndex + 1 : 0} of {deck.length}</span>
          <button
            onClick={handleShuffle}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title="Shuffle deck"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-300"
          style={{
            width: deck.length > 0 ? `${((currentIndex + 1) / deck.length) * 100}%` : '0%',
          }}
        />
      </div>

      {/* 3D Flashcard Container */}
      {currentCard ? (
        <div
          className="relative w-full h-80 sm:h-96 cursor-pointer select-none"
          style={{ perspective: '1200px' }}
          onClick={handleFlip}
        >
          <motion.div
            className="relative w-full h-full rounded-3xl border border-slate-700/80 shadow-2xl transition-all duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT OF CARD */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {/* Top metadata tags */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-bold font-mono">
                    {currentCard.level}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                    {currentCard.pos}
                  </span>
                  {masteredIds.has(currentCard.id) && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Mastered
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => speakWord(e, currentCard.word)}
                  className={`p-2.5 rounded-xl border transition ${
                    isPlayingAudio
                      ? 'bg-sky-500 text-white border-sky-400 scale-110'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Main Center Word & Phonetics */}
              <div className="text-center space-y-2 py-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {currentCard.word}
                </div>
                {currentCard.ipa && (
                  <div className="text-sm font-mono text-sky-400/90 tracking-widest">
                    {currentCard.ipa}
                  </div>
                )}
                {currentCard.sentence && (
                  <p className="text-xs sm:text-sm text-slate-300 italic max-w-md mx-auto pt-2">
                    "{currentCard.sentence}"
                  </p>
                )}
              </div>

              {/* Bottom hint prompt */}
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  Click card or spacebar to reveal translation
                </span>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-500/40"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                  Translation & Linguistic Notes
                </span>
                <button
                  type="button"
                  onClick={(e) => speakWord(e, currentCard.word)}
                  className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl"
                  title="Listen"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Translation & Definition */}
              <div className="space-y-3 text-center my-auto">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {currentCard.translations?.[mediatorLanguage] ||
                    currentCard.translations?.en ||
                    currentCard.translations?.az ||
                    currentCard.word}
                </div>

                {currentCard.definition && (
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md mx-auto">
                    {currentCard.definition}
                  </p>
                )}

                {currentCard.morphology && (
                  <div className="inline-block text-[11px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                    {currentCard.morphology}
                  </div>
                )}
              </div>

              {/* Flip back reminder */}
              <div className="text-center">
                <span className="text-[11px] text-slate-400">
                  Click to flip back to target word
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400">
          No flashcards available for this level filter.
        </div>
      )}

      {/* Navigation & Spaced Repetition Rating Buttons */}
      <div className="space-y-3">
        {/* Rating Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleRate('hard')}
            className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-2xl text-xs sm:text-sm font-bold transition flex flex-col items-center gap-1 active:scale-95"
          >
            <span>Hard</span>
            <span className="text-[10px] text-rose-400 font-normal">Review soon (+3 XP)</span>
          </button>
          <button
            onClick={() => handleRate('good')}
            className="p-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-2xl text-xs sm:text-sm font-bold transition flex flex-col items-center gap-1 active:scale-95"
          >
            <span>Good</span>
            <span className="text-[10px] text-sky-400 font-normal">Keep pacing (+8 XP)</span>
          </button>
          <button
            onClick={() => handleRate('easy')}
            className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs sm:text-sm font-bold transition flex flex-col items-center gap-1 active:scale-95"
          >
            <span>Easy</span>
            <span className="text-[10px] text-emerald-400 font-normal">Mastered (+15 XP)</span>
          </button>
        </div>

        {/* Prev / Next controls */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={handlePrev}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleFlip}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCw className="w-4 h-4" />
            <span>Flip Card</span>
          </button>

          <button
            onClick={handleNext}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
