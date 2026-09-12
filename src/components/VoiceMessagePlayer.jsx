import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Loader2 } from "lucide-react";

/**
 * Озвучивает текст через MSEdge TTS с fallback на браузерный SpeechSynthesis.
 * Умеет разбивать смешанный текст (target + mediator в скобках) на сегменты
 * и озвучивать каждый правильным голосом.
 *
 * @param {string} text — текст для озвучки
 * @param {string} language — целевой язык ("English", "German", ...)
 * @param {string} mediatorLanguage — язык-посредник для parenthetical вставок
 */
export const VoiceMessagePlayer = ({
    text,
    language = "English",
    mediatorLanguage = "az",
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [useFallback, setUseFallback] = useState(false);

    const audioRef = useRef(null);
    const queueRef = useRef([]);       // очередь сегментов для последовательного воспроизведения
    const stopRequestedRef = useRef(false);

    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            stopRequestedRef.current = true;
            if (audioRef.current) {
                try { audioRef.current.pause(); } catch (_) { }
                audioRef.current = null;
            }
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // ─────────────────────────────────────────────────────────
    // Разбор текста на сегменты: [{ text, language }, ...]
    // ─────────────────────────────────────────────────────────
    const buildSegments = (rawText) => {
        if (!rawText || typeof rawText !== "string") return [];

        // Убираем markdown-разметку
        let cleaned = rawText
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .replace(/\[[^\]]{1,60}\]/g, " ");   // [Tone: friendly]

        const segments = [];
        // Ищем parenthetical блоки (...)
        const regex = /\s*\(([^)]{1,120})\)\s*/g;
        let lastIndex = 0;
        let match;

        const pushSegment = (str, lang) => {
            const trimmed = str.replace(/\s+/g, " ").trim();
            if (trimmed) segments.push({ text: trimmed, language: lang });
        };

        while ((match = regex.exec(cleaned)) !== null) {
            const before = cleaned.slice(lastIndex, match.index);
            const inner = match[1].trim();

            // Основной текст до скобки — target language
            pushSegment(before, language);

            // Содержимое скобки — определяем язык по скрипту
            const hasCyrillic = /[\u0400-\u04FF]/.test(inner);
            const hasArabic = /[\u0600-\u06FF]/.test(inner);
            const hasGreek = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(inner);
            const isLatinTarget = /^(english|german|spanish|french|italian|portuguese|dutch)$/i.test(language || "");

            let innerLang = language;   // по умолчанию — та же
            if (isLatinTarget && (hasCyrillic || hasArabic || hasGreek)) {
                innerLang = mediatorLanguage;
            } else if (!isLatinTarget && /^[\x20-\x7F]+$/.test(inner)) {
                innerLang = mediatorLanguage;
            }
            pushSegment(inner, innerLang);

            lastIndex = regex.lastIndex;
        }

        // Остаток после последней скобки
        if (lastIndex < cleaned.length) {
            pushSegment(cleaned.slice(lastIndex), language);
        }

        // Если скобок не было — один сегмент
        if (segments.length === 0) {
            pushSegment(cleaned, language);
        }

        return segments;
    };

    // ─────────────────────────────────────────────────────────
    // Озвучка одного сегмента через MSEdge TTS
    // ─────────────────────────────────────────────────────────
    const speakSegmentMSEdge = (segment) => {
        return new Promise(async (resolve, reject) => {
            try {
                const res = await fetch("/api/tts/synthesize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: segment.text,
                        language: segment.language,
                    }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audioRef.current = audio;

                audio.onended = () => {
                    URL.revokeObjectURL(url);
                    audioRef.current = null;
                    resolve();
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    audioRef.current = null;
                    reject(new Error("audio playback error"));
                };

                await audio.play();
            } catch (err) {
                reject(err);
            }
        });
    };

    // ─────────────────────────────────────────────────────────
    // Fallback: браузерный SpeechSynthesis, тоже сегментами
    // ─────────────────────────────────────────────────────────
    const speakSegmentBrowser = (segment) => {
        return new Promise((resolve) => {
            if (typeof window === "undefined" || !("speechSynthesis" in window)) {
                resolve();
                return;
            }
            const utterance = new SpeechSynthesisUtterance(segment.text);
            const langMap = {
                English: "en-US", German: "de-DE", Spanish: "es-ES",
                French: "fr-FR", Italian: "it-IT", Russian: "ru-RU",
                Turkish: "tr-TR", Azerbaijani: "az-AZ",
            };
            utterance.lang = langMap[segment.language] || "en-US";
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    };

    // ─────────────────────────────────────────────────────────
    // Проиграть всю очередь
    // ─────────────────────────────────────────────────────────
    const playQueue = async (segments) => {
        stopRequestedRef.current = false;
        setIsPlaying(true);
        for (let i = 0; i < segments.length; i++) {
            if (stopRequestedRef.current) break;
            const seg = segments[i];
            try {
                if (useFallback) {
                    await speakSegmentBrowser(seg);
                } else {
                    await speakSegmentMSEdge(seg);
                }
            } catch (err) {
                console.warn("[TTS] Segment failed:", err.message);
                // Переключаемся на браузерный для всех последующих сегментов
                setUseFallback(true);
                try {
                    await speakSegmentBrowser(seg);
                } catch (_) { /* ignore */ }
            }
        }
        setIsPlaying(false);
    };

    // ─────────────────────────────────────────────────────────
    // Обработчики
    // ─────────────────────────────────────────────────────────
    const handleToggle = async () => {
        if (isPlaying) {
            // Stop
            stopRequestedRef.current = true;
            if (audioRef.current) {
                try { audioRef.current.pause(); } catch (_) { }
                audioRef.current = null;
            }
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            setIsPlaying(false);
            return;
        }

        // Start
        const segments = buildSegments(text);
        if (segments.length === 0) return;

        setIsLoading(true);
        try {
            await playQueue(segments);
        } finally {
            setIsLoading(false);
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