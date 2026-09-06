import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { FlashcardsGame } from "./games/FlashcardsGame";
import { WordPairsGame } from "./games/WordPairsGame";
import { WordQuest3DGame } from "./games/WordQuest3DGame";

// Games tab — a small hub of vocabulary mini-games. These game components
// (Flashcards, Word Pairs, 3D Word Quest) already existed in the codebase but
// were never wired into any tab, so they were effectively invisible in the
// app. This restores them as a proper "Games" tab, in the same card-grid
// style used across the rest of the app.
export function GamesHub({ targetLanguage, mediatorLanguage, onSelectToken, onGainXp }) {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState(null);

  const games = [
    {
      id: "flashcards",
      icon: "\u{1F3B4}",
      title: t("gameFlashcardsTitle"),
      description: t("gameFlashcardsDesc"),
    },
    {
      id: "word-pairs",
      icon: "\u{1F9E9}",
      title: t("gameWordPairsTitle"),
      description: t("gameWordPairsDesc"),
    },
    {
      id: "word-quest-3d",
      icon: "\u{1F3AE}",
      title: t("gameWordQuest3DTitle"),
      description: t("gameWordQuest3DDesc"),
    },
  ];

  if (activeGame) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveGame(null)}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition"
        >
          ← {t("backToGames")}
        </button>

        {activeGame === "flashcards" && (
          <FlashcardsGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            onSelectToken={onSelectToken}
            onGainXp={onGainXp}
          />
        )}
        {activeGame === "word-pairs" && (
          <WordPairsGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            onGainXp={onGainXp}
          />
        )}
        {activeGame === "word-quest-3d" && (
          <WordQuest3DGame
            targetLanguage={targetLanguage}
            mediatorLanguage={mediatorLanguage}
            onGainXp={onGainXp}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map((game) => (
        <div
          key={game.id}
          onClick={() => setActiveGame(game.id)}
          className="cursor-pointer bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-sky-500 p-5 rounded-2xl transition shadow-md flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-900/60 border border-sky-700/50 flex items-center justify-center text-xl mb-3 group-hover:scale-105 transition-transform">
              {game.icon}
            </div>
            <h3 className="font-bold text-sm text-white">{game.title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{game.description}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-sky-400 font-semibold">
            <span>{targetLanguage}</span>
            <span>{t("play")} →</span>
          </div>
        </div>
      ))}
    </div>
  );
}
