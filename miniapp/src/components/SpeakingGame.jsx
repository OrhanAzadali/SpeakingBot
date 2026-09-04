// SpeakingGame.jsx
import React, { useState, useEffect, useRef } from "react";

const SPEECH_LANG_CODES = {
    spanish: "es-ES", english: "en-US", french: "fr-FR", german: "de-DE",
    japanese: "ja-JP", italian: "it-IT", portuguese: "pt-BR", russian: "ru-RU",
    arabic: "ar-SA", chinese: "zh-CN", hindi: "hi-IN", korean: "ko-KR",
    turkish: "tr-TR", dutch: "nl-NL", polish: "pl-PL", swedish: "sv-SE",
    vietnamese: "vi-VN", indonesian: "id-ID", thai: "th-TH", filipino: "fil-PH",
    ukrainian: "uk-UA", malay: "ms-MY", romanian: "ro-RO", greek: "el-GR",
    czech: "cs-CZ", hungarian: "hu-HU", azerbaijani: "az-AZ"
};

function normalize(str) {
    return String(str || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function calculateSimilarity(s1, s2) {
    const longer = s1.length >= s2.length ? s1 : s2;
    const shorter = s1.length < s2.length ? s1 : s2;
    if (longer.length === 0) return 1.0;

    const dp = Array.from({ length: shorter.length + 1 }, () => new Array(longer.length + 1).fill(0));
    for (let i = 0; i <= shorter.length; i++) dp[i][0] = i;
    for (let j = 0; j <= longer.length; j++) dp[0][j] = j;

    for (let i = 1; i <= shorter.length; i++) {
        for (let j = 1; j <= longer.length; j++) {
            dp[i][j] = shorter[i - 1] === longer[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    const editDistance = dp[shorter.length][longer.length];
    return Math.max(0, 1 - editDistance / longer.length);
}

export default function SpeakingGame({ cards, API, authHeaders, onExit }) {
    const [index, setIndex] = useState(0);
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [score, setScore] = useState(0);
    const recognitionRef = useRef(null);

    const current = cards[index];

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recog = new SpeechRecognition();
            recog.continuous = false;
            recog.interimResults = false;
            recog.onresult = (e) => {
                const resultText = e.results[0][0].transcript;
                setTranscript(resultText);
                evaluateSpeech(resultText);
            };
            recog.onerror = () => {
                setListening(false);
            };
            recog.onend = () => {
                setListening(false);
            };
            recognitionRef.current = recog;
        }
    }, [current]);

    function playTargetAudio() {
        if (!window.speechSynthesis || !current) return;
        window.speechSynthesis.cancel();
        const textToSpeak = current.initial_form || current.word;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = SPEECH_LANG_CODES[current.language?.toLowerCase()] || "en-US";
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
    }

    function startListening() {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or the native Telegram browser.");
            return;
        }
        setTranscript("");
        setFeedback(null);
        try {
            recognitionRef.current.lang = SPEECH_LANG_CODES[current.language?.toLowerCase()] || "en-US";
            recognitionRef.current.start();
            setListening(true);
        } catch {
            setListening(false);
        }
    }

    function stopListening() {
        if (recognitionRef.current && listening) {
            recognitionRef.current.stop();
            setListening(false);
        }
    }

    function evaluateSpeech(spokenText) {
        const target = normalize(current.initial_form || current.word);
        const spoken = normalize(spokenText);
        const similarity = calculateSimilarity(target, spoken);
        const passed = similarity >= 0.65 || spoken.includes(target) || target.includes(spoken);
        const earnedPts = Math.round(similarity * 100);

        if (passed) {
            setScore((s) => s + earnedPts);
        }

        if (API && current.id) {
            fetch(`${API}/api/flashcards/${current.id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ remembered: passed }),
            }).catch(() => { });
        }

        setFeedback({
            passed,
            spoken: spokenText,
            target: current.initial_form || current.word,
            similarity: earnedPts,
            phonetics: current.transcription,
            pronunciation_rule: current.pronunciation_rule,
        });
    }

    function handleNext() {
        setFeedback(null);
        setTranscript("");
        if (index + 1 < cards.length) {
            setIndex(index + 1);
        } else {
            setIndex(cards.length); // complete
        }
    }

    if (index >= cards.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center py-8">
                <div className="text-6xl mb-4 animate-bounce">🗣️</div>
                <h1 className="text-2xl font-bold text-white mb-2">Speaking Drill Complete!</h1>
                <p className="text-slate-400 text-sm mb-6">Great job practicing your pronunciation and spoken fluency.</p>
                <div className="w-full max-w-xs bg-slate-800 rounded-2xl p-6 mb-6 border border-slate-700">
                    <p className="text-3xl font-extrabold text-emerald-400">{score}</p>
                    <p className="text-slate-400 text-xs mt-1">Total Fluency Points</p>
                </div>
                <button
                    onClick={onExit}
                    className="w-full max-w-xs py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-95 transition-all"
                >
                    Back to games
                </button>
            </div>
        );
    }

    const wordToSpeak = current.initial_form || current.word;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 max-w-sm mx-auto">
            <div className="w-full flex justify-between items-center mb-4 text-xs text-slate-400">
                <span>Word {index + 1} of {cards.length}</span>
                <span className="text-emerald-400 font-bold">{score} pts</span>
            </div>

            {/* Target Word Card */}
            <div className="w-full rounded-2xl p-6 mb-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-center shadow-xl">
                <span className="text-xs uppercase tracking-widest text-indigo-200 block mb-2">Pronounce Aloud</span>
                <p className="text-3xl font-extrabold text-white mb-2">{wordToSpeak}</p>
                {current.transcription && (
                    <p className="text-xs text-indigo-200 bg-indigo-950/40 py-1 px-3 rounded-full inline-block mb-3 border border-indigo-300/20">
                        {current.transcription}
                    </p>
                )}
                <p className="text-xs text-indigo-100 italic block mb-4">"{current.correction}"</p>
                <button
                    type="button"
                    onClick={playTargetAudio}
                    className="py-2 px-4 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 mx-auto"
                >
                    <span>🔊</span> Listen to Native
                </button>
            </div>

            {/* Voice Recording Control */}
            {!feedback ? (
                <div className="w-full flex flex-col items-center gap-4">
                    <button
                        type="button"
                        onClick={listening ? stopListening : startListening}
                        className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all active:scale-90 ${listening
                            ? "bg-rose-600 animate-pulse border-4 border-rose-300"
                            : "bg-emerald-600 hover:bg-emerald-500 border-4 border-emerald-400/50"
                            }`}
                    >
                        {listening ? "⏹" : "🎙"}
                    </button>
                    <p className="text-slate-400 text-xs">
                        {listening ? "Listening... Speak now!" : "Tap microphone and say the word"}
                    </p>
                </div>
            ) : (
                <div className="w-full flex flex-col items-center">
                    <div className={`text-5xl mb-2 ${feedback.passed ? "text-emerald-400" : "text-rose-400"}`}>
                        {feedback.passed ? "✅" : "⚠️"}
                    </div>
                    <h2 className={`text-lg font-bold mb-1 ${feedback.passed ? "text-emerald-400" : "text-rose-400"}`}>
                        {feedback.passed ? "Great Pronunciation!" : "Needs a Little Polish"}
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">Pronunciation Match: {feedback.similarity}%</p>

                    <div className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-4 text-left text-xs leading-relaxed space-y-2 mb-4">
                        <p className="text-slate-300">
                            <span className="text-slate-400 font-semibold">What was heard:</span>{" "}
                            <span className="text-white italic">"{feedback.spoken || "(No speech detected)"}"</span>
                        </p>
                        {feedback.pronunciation_rule && (
                            <p className="text-indigo-300">
                                <span className="text-slate-400 font-semibold">Pronunciation Rule:</span> {feedback.pronunciation_rule}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleNext}
                        className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:scale-95 transition-all"
                    >
                        {index + 1 < cards.length ? "Next Word" : "Finish Practice"}
                    </button>
                </div>
            )}

            <button
                onClick={onExit}
                className="mt-6 text-xs text-slate-500 hover:text-slate-300"
            >
                Exit to game menu
            </button>
        </div>
    );
}