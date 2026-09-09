import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Sparkles,
    RotateCcw,
    Trophy,
    Clock,
    Flame,
    CheckCircle2,
    BookmarkPlus,
    ArrowRight,
    Shuffle,
    CornerDownLeft,
    X,
    Type,
} from "lucide-react";

const FALLBACK_TARGETS = {
    English: ["DICTIONARY", "VOCABULARY", "CHALLENGE", "EDUCATION", "ADVENTURE", "KNOWLEDGE"],
    Spanish: ["DICCIONARIO", "VOCABULARIO", "EDUCACION", "CONOCIMIENTO", "AVENTURA"],
    German: ["WORTERBUCH", "AUSBILDUNG", "ABENTEUER", "KENNTNISSE", "SPRACHLEHRE"],
    French: ["VOCABULAIRE", "DICTIONNAIRE", "EDUCATION", "AVENTURE", "CONNAISSANCE"],
    Italian: ["VOCABOLARIO", "DIZIONARIO", "EDUCAZIONE", "AVVENTURA", "CONOSCENZA"],
    Russian: ["СЛОВАРЬ", "ОБРАЗОВАНИЕ", "ПРИКЛЮЧЕНИЕ", "ГРАММАТИКА"],
    Turkish: ["KELİMEBİLGİSİ", "SÖZLÜK", "EĞİTİM", "MACERA", "BİLGİSAYAR"]
};

export const WordBuilder = ({
    targetLanguage = "English",
    userLevel = "B1",
    onGainXp,
    onSaveToVocabulary,
    onClose
}) => {
    const [targetWord, setTargetWord] = useState("");
    const [availableTiles, setAvailableTiles] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [currentInput, setCurrentInput] = useState("");
    const [foundWords, setFoundWords] = useState([]);
    const [score, setScore] = useState(0);
    const [timer, setTimer] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }
    const [savedWords, setSavedWords] = useState(new Set());
    const timerRef = useRef(null);

    // Auto-start game on mount
    useEffect(() => {
        startNewGame();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [targetLanguage, userLevel]);

    // Timer
    useEffect(() => {
        if (!isLoading && targetWord) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLoading, targetWord]);

    const startNewGame = async () => {
        setIsLoading(true);
        setCurrentInput("");
        setSelectedIndices([]);
        setFoundWords([]);
        setScore(0);
        setTimer(0);
        setFeedback(null);
        setSavedWords(new Set());

        const pool = FALLBACK_TARGETS[targetLanguage] || FALLBACK_TARGETS["English"];
        let chosenWord = pool[Math.floor(Math.random() * pool.length)];

        try {
            const res = await axios.post("/api/games/generate-words", {
                targetLanguage,
                userLevel,
                count: 1,
                wordType: "long-noun"
            });
            if (res.data?.success && Array.isArray(res.data.words) && res.data.words[0]) {
                const genWord = res.data.words[0].trim().toUpperCase();
                if (genWord.length >= 6) {
                    chosenWord = genWord;
                }
            }
        } catch (err) {
            console.warn("Using fallback target word for Word Builder:", err?.message);
        }

        try {
            const { data } = await axios.post("/api/games/wordbuilder/start", {
                userId: "default-user",
                targetWord: chosenWord,
                targetLanguage
            });
            const activeTarget = data.targetWord || chosenWord;
            setTargetWord(activeTarget);
            setupTiles(activeTarget);
        } catch (err) {
            setTargetWord(chosenWord);
            setupTiles(chosenWord);
        } finally {
            setIsLoading(false);
        }
    };

    const setupTiles = (word) => {
        const letters = [...word].map((ch, idx) => ({ id: idx, char: ch }));
        // Shuffle tile order for puzzle feel
        setAvailableTiles([...letters].sort(() => 0.5 - Math.random()));
    };

    const handleTileClick = (tileIndex) => {
        if (selectedIndices.includes(tileIndex)) {
            // Deselect tile
            const newIndices = selectedIndices.filter((idx) => idx !== tileIndex);
            setSelectedIndices(newIndices);
            setCurrentInput(newIndices.map((idx) => availableTiles[idx].char).join(""));
        } else {
            // Select tile
            const newIndices = [...selectedIndices, tileIndex];
            setSelectedIndices(newIndices);
            setCurrentInput(newIndices.map((idx) => availableTiles[idx].char).join(""));
        }
    };

    const handleShuffleTiles = () => {
        const unselected = availableTiles.filter((_, idx) => !selectedIndices.includes(idx));
        const selected = availableTiles.filter((_, idx) => selectedIndices.includes(idx));
        unselected.sort(() => 0.5 - Math.random());
        setAvailableTiles([...selected, ...unselected]);
    };

    const handleClearCurrent = () => {
        setSelectedIndices([]);
        setCurrentInput("");
    };

    const handleSubmitWord = async () => {
        const wordToSubmit = currentInput.trim().toUpperCase();
        if (!wordToSubmit) return;

        if (wordToSubmit.length < 3) {
            setFeedback({ type: "error", text: "Words must be at least 3 letters long!" });
            setTimeout(() => setFeedback(null), 2500);
            return;
        }

        if (foundWords.includes(wordToSubmit)) {
            setFeedback({ type: "error", text: `"${wordToSubmit}" was already found!` });
            setTimeout(() => setFeedback(null), 2500);
            return;
        }

        try {
            const { data } = await axios.post("/api/games/wordbuilder/verify", {
                userId: "default-user",
                word: wordToSubmit,
                targetLanguage
            });

            if (data.valid) {
                const pts = wordToSubmit.length * 10;
                setFoundWords((prev) => [wordToSubmit, ...prev]);
                setScore((s) => s + pts);
                setFeedback({ type: "success", text: `+${pts} pts for "${wordToSubmit}"!` });
                if (onGainXp) onGainXp(pts);
                handleClearCurrent();
            } else {
                setFeedback({ type: "error", text: data.message || `"${wordToSubmit}" is not a valid dictionary word!` });
            }
        } catch (err) {
            setFeedback({ type: "error", text: err.response?.data?.message || `"${wordToSubmit}" verification failed.` });
        }

        setTimeout(() => setFeedback(null), 2500);
    };

    const handleSaveWord = (word) => {
        if (!word || savedWords.has(word)) return;
        if (onSaveToVocabulary) {
            onSaveToVocabulary({
                word,
                translation: `Constructed word from ${targetWord} (${targetLanguage})`,
                targetLanguage,
                source: "Word Builder Game"
            });
            setSavedWords((prev) => new Set([...prev, word]));
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Top Stats Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Type className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Word Builder Anagram Studio
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                                {targetLanguage} &bull; {userLevel}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400">
                            Construct valid sub-words using the letter tiles from the target word.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className="font-mono font-bold text-white">{formatTime(timer)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span>Score:</span>
                        <span className="font-mono font-bold text-amber-400">{score}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <Flame className="w-4 h-4 text-sky-400" />
                        <span>Words:</span>
                        <span className="font-mono font-bold text-white">{foundWords.length}</span>
                    </div>

                    <button
                        type="button"
                        onClick={startNewGame}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
                        title="Next target word"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">New Word</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                        Synthesizing rich vocabulary anagram for {targetLanguage}...
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Target Word & Tiles Showcase */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm text-center space-y-6 shadow-xl relative overflow-hidden">
                        <div className="space-y-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                                TARGET ROOT WORD
                            </span>
                            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 tracking-widest">
                                {targetWord}
                            </div>
                        </div>

                        {/* Clickable Letter Tiles */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400 block">
                                Tap letters to construct your word:
                            </span>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                {availableTiles.map((tile, idx) => {
                                    const isSelected = selectedIndices.includes(idx);
                                    return (
                                        <button
                                            key={`${tile.id}-${idx}`}
                                            type="button"
                                            onClick={() => handleTileClick(idx)}
                                            className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl text-xl sm:text-2xl font-black flex items-center justify-center transition-all duration-150 cursor-pointer shadow-md select-none ${isSelected
                                                ? "bg-slate-800 border-2 border-slate-700 text-slate-500 scale-90 opacity-50"
                                                : "bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 hover:border-emerald-500 text-white hover:scale-105 shadow-emerald-950/20 active:scale-95"
                                                }`}
                                        >
                                            {tile.char}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Active Word Construction Row */}
                        <div className="max-w-md mx-auto space-y-3 pt-2">
                            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-2 px-3 focus-within:border-emerald-500 transition">
                                <input
                                    type="text"
                                    value={currentInput}
                                    onChange={(e) => setCurrentInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSubmitWord();
                                    }}
                                    placeholder="Click tiles or type..."
                                    className="flex-1 bg-transparent text-lg font-mono font-black text-emerald-400 tracking-widest outline-none uppercase placeholder:text-slate-600"
                                />

                                {currentInput && (
                                    <button
                                        type="button"
                                        onClick={handleClearCurrent}
                                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                                        title="Clear"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleSubmitWord}
                                    disabled={!currentInput.trim()}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30"
                                >
                                    <span>Submit</span>
                                    <CornerDownLeft className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Feedback toast */}
                            {feedback && (
                                <div
                                    className={`text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 ${feedback.type === "success"
                                        ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                                        : "bg-rose-950/80 border border-rose-500/40 text-rose-300"
                                        }`}
                                >
                                    {feedback.type === "success" ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                        <X className="w-3.5 h-3.5 text-rose-400" />
                                    )}
                                    <span>{feedback.text}</span>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleShuffleTiles}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                            >
                                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Shuffle Tiles</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleClearCurrent}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                <span>Reset Selection</span>
                            </button>
                        </div>
                    </div>

                    {/* Discovered Words Shelf */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <span>Discovered Words ({foundWords.length})</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                    Click any word to save to your personal vocabulary
                                </span>
                            </h3>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                                +{score} XP Total
                            </span>
                        </div>

                        {foundWords.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">
                                No words discovered yet. Try constructing 3, 4, or 5-letter words from the tiles!
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2.5">
                                {foundWords.map((w) => {
                                    const isSaved = savedWords.has(w);
                                    return (
                                        <button
                                            key={w}
                                            type="button"
                                            onClick={() => handleSaveWord(w)}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition border cursor-pointer ${isSaved
                                                ? "bg-emerald-950/70 border-emerald-600 text-emerald-300"
                                                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white hover:border-emerald-500"
                                                }`}
                                            title="Save to Vocabulary"
                                        >
                                            <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>{w}</span>
                                            <span className="text-[10px] font-mono text-slate-400">+{w.length * 10}</span>
                                            {isSaved && (
                                                <span className="text-[10px] font-bold text-emerald-400">Saved</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
