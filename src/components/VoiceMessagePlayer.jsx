import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Loader2 } from "lucide-react";

/**
 * Проигрывает текст через MSEdge TTS, с fallback на браузерный SpeechSynthesis.
 * 
 * @param {string} text — текст для озвучки
 * @param {string} language — целевой язык ("English", "German", ...)
 * @param {string} mediatorLanguage — язык-посредник (для выбора голоса)
 */
export const VoiceMessagePlayer = ({ text, language = "English", mediatorLanguage = "az" }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [useFallback, setUseFallback] = useState(false);
    const audioRef = useRef(null);

    // Очистка при размонтировании
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const playWithMSEdge = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/tts/synthesize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, language })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audioRef.current = audio;

            audio.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                console.warn("[TTS] Audio playback error — fallback");
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
                playWithBrowser();
            };

            await audio.play();
            setIsPlaying(true);
        } catch (err) {
            console.warn("[TTS] MSEdge failed, fallback на браузер:", err.message);
            setUseFallback(true);
            playWithBrowser();
        } finally {
            setIsLoading(false);
        }
    };

    const playWithBrowser = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            console.error("[TTS] Браузер не поддерживает SpeechSynthesis");
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const langMap = {
            "English": "en-US", "German": "de-DE", "Spanish": "es-ES",
            "French": "fr-FR", "Italian": "it-IT", "Russian": "ru-RU",
            "Turkish": "tr-TR",
        };
        utterance.lang = langMap[language] || "en-US";
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        window.speechSynthesis.speak(utterance);
    };

    const handleToggle = () => {
        if (isPlaying) {
            // Стоп
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
            setIsPlaying(false);
        } else {
            // Старт
            if (useFallback) {
                playWithBrowser();
            } else {
                playWithMSEdge();
            }
        }
    };

    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border
                ${isPlaying
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-sky-500/40"
                } disabled:opacity-50`}
            title={isPlaying ? "Остановить озвучку" : "Воспроизвести голосом"}
        >
            {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlaying ? (
                <Pause className="w-3.5 h-3.5" />
            ) : (
                <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>{isPlaying ? "Остановить" : "Озвучить"}</span>
        </button>
    );
};