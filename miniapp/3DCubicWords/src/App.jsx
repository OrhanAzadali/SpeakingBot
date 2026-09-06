import React, { useState, useEffect } from 'react';
import { CubeWordGame } from './components/CubeWordGame/CubeWordGame.jsx';
import { CubeWordCard } from './components/CubeWordGame/CubeWordCard.jsx';
import { pronounceWordVoice } from './components/CubeWordGame/soundEffects.js';
import {
  Sparkles,
  Plus,
  BookOpen,
  Volume2,
  Trash2,
  Trophy,
  Flame,
  Gamepad2,
  X,
} from 'lucide-react';

export default function App() {
  const [activeGame, setActiveGame] = useState('cubeword');
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [mediatorLanguage, setMediatorLanguage] = useState('russian');

  // Stored vocabulary deck
  const [vocabulary, setVocabulary] = useState(() => {
    try {
      const saved = localStorage.getItem('user_vocabulary_deck');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [
      {
        id: '1',
        word: 'KNOWLEDGE',
        meaning: 'знание, познания',
        partOfSpeech: 'noun',
        targetLanguage: 'english',
        mediatorLanguage: 'russian',
        dateAdded: new Date().toLocaleDateString(),
      },
      {
        id: '2',
        word: 'PHILOLOGY',
        meaning: 'филология, наука о языке',
        partOfSpeech: 'noun',
        targetLanguage: 'english',
        mediatorLanguage: 'russian',
        dateAdded: new Date().toLocaleDateString(),
      },
      {
        id: '3',
        word: 'EXEMPLARY',
        meaning: 'образцовый, примерный',
        partOfSpeech: 'adjective',
        targetLanguage: 'english',
        mediatorLanguage: 'russian',
        dateAdded: new Date().toLocaleDateString(),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('user_vocabulary_deck', JSON.stringify(vocabulary));
    } catch {
      // Ignore
    }
  }, [vocabulary]);

  // High score
  const [highScore, setHighScore] = useState(() => {
    try {
      return Number(localStorage.getItem('cubeword_highscore') || '0');
    } catch {
      return 0;
    }
  });

  // Custom word modal
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [customWord, setCustomWord] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const [customPartOfSpeech, setCustomPartOfSpeech] = useState('noun');

  const handleSaveWordFromGame = (word, meaning, partOfSpeech) => {
    const newItem = {
      id: `vocab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      word: word.toUpperCase(),
      meaning,
      partOfSpeech,
      targetLanguage,
      mediatorLanguage,
      dateAdded: new Date().toLocaleDateString(),
    };

    setVocabulary((prev) => {
      if (prev.some((item) => item.word.toUpperCase() === word.toUpperCase())) {
        return prev;
      }
      return [newItem, ...prev];
    });
  };

  const handleAddCustomWordSubmit = (e) => {
    e.preventDefault();
    if (!customWord.trim() || !customMeaning.trim()) return;

    const newItem = {
      id: `vocab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      word: customWord.trim().toUpperCase(),
      meaning: customMeaning.trim(),
      partOfSpeech: customPartOfSpeech,
      targetLanguage,
      mediatorLanguage,
      dateAdded: new Date().toLocaleDateString(),
    };

    setVocabulary((prev) => [newItem, ...prev]);
    setCustomWord('');
    setCustomMeaning('');
    setIsAddWordModalOpen(false);
  };

  const handleDeleteWord = (id) => {
    setVocabulary((prev) => prev.filter((item) => item.id !== id));
  };

  // If 3D Cube Tetris is active, render it directly
  if (activeGame === 'cubeword') {
    return (
      <CubeWordGame
        initialLanguage={targetLanguage}
        onClose={() => {
          setActiveGame('none');
          try {
            setHighScore(Number(localStorage.getItem('cubeword_highscore') || '0'));
          } catch {
            // Ignore
          }
        }}
        onSaveToVocabulary={handleSaveWordFromGame}
      />
    );
  }

  const filteredVocabulary = vocabulary.filter(
    (item) => item.targetLanguage === targetLanguage
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-950/50">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 leading-none">
              LinguaPlay
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-400/30">
                AI Powered
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              3D Interactive Language Learning Games
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider hidden sm:inline">
              Learn:
            </span>
            <select
              id="target-language-select"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="english" className="bg-slate-900">🇬🇧 English</option>
              <option value="spanish" className="bg-slate-900">🇪🇸 Español</option>
              <option value="russian" className="bg-slate-900">🇷🇺 Русский</option>
              <option value="german" className="bg-slate-900">🇩🇪 Deutsch</option>
              <option value="french" className="bg-slate-900">🇫🇷 Français</option>
              <option value="italian" className="bg-slate-900">🇮🇹 Italiano</option>
            </select>
          </div>

          <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Mediator:
            </span>
            <select
              id="mediator-language-select"
              value={mediatorLanguage}
              onChange={(e) => setMediatorLanguage(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="russian" className="bg-slate-900">🇷🇺 Russian</option>
              <option value="english" className="bg-slate-900">🇬🇧 English</option>
              <option value="azerbaijani" className="bg-slate-900">🇦🇿 Azerbaijani</option>
              <option value="turkish" className="bg-slate-900">🇹🇷 Turkish</option>
              <option value="spanish" className="bg-slate-900">🇪🇸 Spanish</option>
            </select>
          </div>

          <button
            type="button"
            id="add-custom-word-btn"
            onClick={() => setIsAddWordModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 shadow transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Word</span>
          </button>
        </div>
      </header>

      {/* Main Hub Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-cyan-400" />
                Featured 3D AI Game
              </h2>
              <p className="text-xs text-slate-400">
                Play real-time 3D interactive polyhedral cube Tetris with Gemini AI verification
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Score Record:</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                {highScore} pts
              </span>
            </div>
          </div>

          {/* Standalone 3D Game Card */}
          <CubeWordCard
            highScore={highScore}
            currentLanguage={targetLanguage}
            onLaunchGame={(lang) => {
              setTargetLanguage(lang);
              setActiveGame('cubeword');
            }}
          />
        </section>

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                High Score
              </div>
              <div className="text-xl font-black text-white">{highScore} pts</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Saved Vocabulary
              </div>
              <div className="text-xl font-black text-white">
                {filteredVocabulary.length} words
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Round Goal
              </div>
              <div className="text-xl font-black text-white">15 Words / Round</div>
            </div>
          </div>
        </section>

        {/* Saved Vocabulary Section */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Personal Vocabulary & Flashcard Deck
              </h3>
              <p className="text-xs text-slate-400">
                Words collected from 3D Cube Tetris and manual entries ({targetLanguage.toUpperCase()})
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddWordModalOpen(true)}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Word to Deck</span>
            </button>
          </div>

          {filteredVocabulary.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
              No words saved for {targetLanguage} yet. Play 3D Cube Tetris to discover words or click "Add Word"!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVocabulary.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 flex items-start justify-between gap-2 transition group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-black text-cyan-300 tracking-wide">
                        {item.word}
                      </strong>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase font-semibold">
                        {item.partOfSpeech}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-medium">{item.meaning}</div>
                    <div className="text-[10px] text-slate-500">
                      Track: {item.targetLanguage} • {item.dateAdded}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => pronounceWordVoice(item.word, item.targetLanguage)}
                      className="p-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-300 transition"
                      title="Pronounce"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWord(item.id)}
                      className="p-1.5 rounded-lg bg-slate-700/70 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                      title="Remove from Deck"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Add Custom Word Modal */}
      {isAddWordModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsAddWordModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Add Custom Word</h3>
                <p className="text-xs text-slate-400">
                  Save to your deck for games, flashcards, and quizzes
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCustomWordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Word ({targetLanguage.toUpperCase()})
                </label>
                <input
                  type="text"
                  required
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  placeholder="e.g. APPLE, WATER, PHILOLOGY"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Meaning in Mediator Language ({mediatorLanguage.toUpperCase()})
                </label>
                <input
                  type="text"
                  required
                  value={customMeaning}
                  onChange={(e) => setCustomMeaning(e.target.value)}
                  placeholder="e.g. яблоко, вода, филология"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Part of Speech
                </label>
                <select
                  value={customPartOfSpeech}
                  onChange={(e) => setCustomPartOfSpeech(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="noun">Noun (существительное)</option>
                  <option value="verb">Verb (глагол)</option>
                  <option value="adjective">Adjective (прилагательное)</option>
                  <option value="adverb">Adverb (наречие)</option>
                  <option value="phrase">Phrase (фраза)</option>
                  <option value="number">Number (число)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddWordModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-xs shadow-lg shadow-cyan-950 transition"
                >
                  Save Word
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
