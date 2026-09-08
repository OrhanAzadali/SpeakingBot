import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Brain,
    Sparkles,
    RotateCcw,
    Trophy,
    Volume2,
    Clock,
    Flame,
    CheckCircle2,
    BookmarkPlus,
    Play
} from "lucide-react";

const FALLBACK_WORDS = {
    English: ["apple", "banana", "cherry", "date", "elder", "fig", "grape", "honey"],
    Spanish: ["manzana", "plátano", "cereza", "dátil", "saúco", "higo", "uva", "miel"],
    German: ["Apfel", "Banane", "Kirsche", "Dattel", "Holunder", "Feige", "Traube", "Honig"],
    French: ["pomme", "banane", "cerise", "datte", "sureau", "figue", "raisin", "miel"],
    Italian: ["mela", "banana", "ciliegia", "dattero", "sambuco", "fico", "uva", "miele"],
    Russian: ["яблоко", "банан", "вишня", "финик", "бузина", "инжир", "виноград", "мёд"],
    Turkish: ["elma", "muz", "kiraz", "hurma", "mürver", "incir", "üzüm", "bal"]
};

export const MemoryMatch = ({
    targetLanguage = "English",
    userLevel = "B1",
    onGainXp,
    onSaveToVocabulary,
    onClose
}) => {
    const [cards, setCards] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState(new Set());
    const [moves, setMoves] = useState(0);
    const [streak, setStreak] = useState(0);
    const [timer, setTimer] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [savedWords, setSavedWords] = useState(new Set());
    const timerRef = useRef(null);

    // Auto-start the game on mount
    useEffect(() => {
        startNewGame();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [targetLanguage, userLevel]);

    // Start timer when game begins
    useEffect(() => {
        if (!isLoading && !isGameOver) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else if (isGameOver && timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLoading, isGameOver]);

    const startNewGame = async () => {
        setIsLoading(true);
        setIsGameOver(false);
        setFlipped([]);
        setMatched(new Set());
        setMoves(0);
        setStreak(0);
        setTimer(0);
        setSavedWords(new Set());

        let pool = FALLBACK_WORDS[targetLanguage] || FALLBACK_WORDS["English"];
        try {
            const res = await axios.post("/api/games/generate-words", {
                targetLanguage,
                userLevel,
                count: 6,
                wordType: "noun"
            });
            if (res.data?.success && Array.isArray(res.data.words) && res.data.words.length >= 4) {
                pool = res.data.words;
            }
        } catch (err) {
            console.warn("Using fallback vocabulary for Memory Match:", err?.message);
        }

        try {
            const { data } = await axios.post("/api/games/memory/start", {
                userId: "default-user",
                targetLanguage,
                userLevel,
                customWords: pool
            });

            if (data.success && Array.isArray(data.cards)) {
                // Pre-fill cards with unknown words until flipped, matching server state
                const initialCards = data.cards.map((c) => ({
                    id: c.id,
                    word: "",
                    matched: false
                }));
                setCards(initialCards);
            } else {
                // Local fallback deck construction
                setupLocalDeck(pool);
            }
        } catch (err) {
            console.warn("Server start endpoint error, fallback to local deck:", err?.message);
            setupLocalDeck(pool);
        } finally {
            setIsLoading(false);
        }
    };

    const setupLocalDeck = (wordList) => {
        const selected = [...wordList].sort(() => 0.5 - Math.random()).slice(0, 6);
        const deck = [];
        selected.forEach((word, pairIdx) => {
            deck.push({ id: pairIdx * 2, word, pairId: pairIdx });
            deck.push({ id: pairIdx * 2 + 1, word, pairId: pairIdx });
        });
        deck.sort(() => 0.5 - Math.random());
        const finalCards = deck.map((c, idx) => ({ id: idx, word: c.word, pairId: c.pairId }));
        setCards(finalCards);
    };

    const handleCardClick = async (cardId) => {
        if (isLocked || flipped.includes(cardId) || matched.has(cardId)) return;

        let cardWord = "";
        // Check if card word is already known locally
        const existing = cards.find((c) => c.id === cardId);
        if (existing?.word) {
            cardWord = existing.word;
        } else {
            try {
                const { data } = await axios.post("/api/games/memory/flip", {
                    userId: "default-user",
                    cardId
                });
                if (data.success && data.word) {
                    cardWord = data.word;
                    setCards((prev) =>
                        prev.map((c) => (c.id === cardId ? { ...c, word: data.word } : c))
                    );
                }
            } catch (err) {
                cardWord = existing?.word || "Word";
            }
        }

        const nextFlipped = [...flipped, cardId];
        setFlipped(nextFlipped);

        if (nextFlipped.length === 2) {
            setIsLocked(true);
            setMoves((m) => m + 1);
            const [firstId, secondId] = nextFlipped;

            const firstCard = cards.find((c) => c.id === firstId) || { id: firstId, word: "" };
            const secondCard = { id: secondId, word: cardWord };

            // Verify match via server
            try {
                const { data } = await axios.post("/api/games/memory/match", {
                    userId: "default-user",
                    card1: firstId,
                    card2: secondId
                });

                if (data.success && data.matched) {
                    const newMatched = new Set([...matched, firstId, secondId]);
                    setMatched(newMatched);
                    setStreak((s) => s + 1);

                    if (onGainXp) onGainXp(15 + streak * 5);

                    if (newMatched.size >= cards.length || data.gameOver) {
                        setIsGameOver(true);
                        if (onGainXp) onGainXp(50);
                    }
                    setFlipped([]);
                    setIsLocked(false);
                } else {
                    setStreak(0);
                    setTimeout(() => {
                        setFlipped([]);
                        setIsLocked(false);
                    }, 900);
                }
            } catch (err) {
                // Fallback local match check
                const isMatch = firstCard.word && firstCard.word.toLowerCase() === secondCard.word.toLowerCase();
                if (isMatch) {
                    const newMatched = new Set([...matched, firstId, secondId]);
                    setMatched(newMatched);
                    setStreak((s) => s + 1);
                    if (newMatched.size >= cards.length) {
                        setIsGameOver(true);
                        if (onGainXp) onGainXp(50);
                    }
                    setFlipped([]);
                    setIsLocked(false);
                } else {
                    setStreak(0);
                    setTimeout(() => {
                        setFlipped([]);
                        setIsLocked(false);
                    }, 900);
                }
            }
        }
    };

    const handleSaveWord = (word) => {
        if (!word || savedWords.has(word)) return;
        if (onSaveToVocabulary) {
            onSaveToVocabulary({
                word,
                translation: `Memory match term (${targetLanguage})`,
                targetLanguage,
                source: "Memory Match 3D Game"
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
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Brain className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Memory Match Sprint
                            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 border border-sky-800 px-2 py-0.5 rounded-full">
                                {targetLanguage} &bull; {userLevel}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400">
                            Flip the cards, match synonymous lexical pairs, and maximize retention.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <Clock className="w-4 h-4 text-sky-400" />
                        <span className="font-mono font-bold text-white">{formatTime(timer)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Streak:</span>
                        <span className="font-mono font-bold text-amber-400">{streak}x</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
                        <span>Moves:</span>
                        <span className="font-mono font-bold text-white">{moves}</span>
                    </div>

                    <button
                        type="button"
                        onClick={startNewGame}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
                        title="Restart game"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                        <span className="hidden sm:inline">Restart</span>
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                        Synthesizing CEFR {userLevel} lexical pairs in {targetLanguage}...
                    </p>
                </div>
            ) : (
                /* Cards Grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {cards.map((card) => {
                        const isCardFlipped = flipped.includes(card.id) || matched.has(card.id);
                        const isCardMatched = matched.has(card.id);

                        return (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => handleCardClick(card.id)}
                                disabled={isLocked || isCardMatched}
                                className={`h-28 sm:h-32 rounded-2xl p-3 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer transform relative select-none ${isCardMatched
                                    ? "bg-emerald-950/40 border-2 border-emerald-500/60 text-emerald-300 scale-95 shadow-lg shadow-emerald-950/20"
                                    : isCardFlipped
                                        ? "bg-sky-900/60 border-2 border-sky-400 text-white scale-105 shadow-xl shadow-sky-950/40"
                                        : "bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/80 text-slate-400 shadow-md hover:scale-102"
                                    }`}
                            >
                                {isCardFlipped ? (
                                    <div className="text-center space-y-1 animate-in fade-in zoom-in-95 duration-200">
                                        <span className="text-base sm:text-lg font-bold block capitalize tracking-wide text-white">
                                            {card.word || "..."}
                                        </span>
                                        {isCardMatched && (
                                            <span className="text-[10px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Matched
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5 opacity-60">
                                        <Brain className="w-6 h-6 text-slate-500" />
                                        <span className="text-[10px] font-mono tracking-widest text-slate-500 font-bold">
                                            CARD #{card.id + 1}
                                        </span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Game Over Modal / Card */}
            {isGameOver && (
                <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                        <Trophy className="w-8 h-8" />
                    </div>

                    <div className="space-y-2 max-w-md mx-auto">
                        <h3 className="text-2xl font-black text-white tracking-tight">
                            Outstanding Vocabulary Mastery!
                        </h3>
                        <p className="text-sm text-slate-300">
                            You cleared all pairs in <span className="font-bold text-sky-400">{formatTime(timer)}</span> with{" "}
                            <span className="font-bold text-amber-400">{moves} moves</span>!
                        </p>
                    </div>

                    {/* Quick Vocabulary Save Pill List */}
                    <div className="space-y-2 max-w-xl mx-auto text-left bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                        <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                            <span>Matched Lexicon ({targetLanguage}):</span>
                            <span className="text-[10px] text-sky-400">Click to save to notebook</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(cards.map((c) => c.word).filter(Boolean))).map((w) => (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => handleSaveWord(w)}
                                    className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${savedWords.has(w)
                                        ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                                        : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                                        }`}
                                >
                                    <BookmarkPlus className="w-3 h-3" />
                                    <span>{w}</span>
                                    {savedWords.has(w) && <span className="text-[10px] text-emerald-400 font-bold">Saved</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 pt-2">
                        <button
                            type="button"
                            onClick={startNewGame}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 cursor-pointer"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Play Next Round</span>
                        </button>
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
                            >
                                <span>Exit Game</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
