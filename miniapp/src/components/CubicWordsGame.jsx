// CubicWordsGame.jsx — Thin wrapper that embeds the 3D Cubic Words game
// directly in this app's own React tree (same bundle, same backend), and
// wires its "save word" action into this app's flashcard deck.
//
// The game's UI/engine lives in ./CubicWords/*. Its API calls (word
// generation & validation) hit the same Render backend as the rest of the
// app (BACKEND_URL / VITE_BACKEND_URL) via the `apiBase` prop — see
// bot/index.js, which mounts the cubeword routes.
import React from "react";
import { CubeWordGame } from "./CubicWords/CubeWordGame.jsx";


export default function CubicWordsGame({ onExit, apiBase, language = "english", onSaveWord }) {
  return (
    <div className="w-full">
      <CubeWordGame
        onClose={onExit}
        initialLanguage={language}
        apiBase={apiBase}
        onSaveToVocabulary={(word, definition, partOfSpeech) => {
          if (onSaveWord) onSaveWord({ word, definition, partOfSpeech });
        }}
      />
    </div>
  );
}
