/**
 * Санитизация текста перед TTS-вызовом.
 */
export function sanitizeForTTS(text, targetLanguage) {
    if (!text || typeof text !== "string") return "";

    let clean = text
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[[^\]]{1,60}\]/g, " ");

    clean = clean.replace(/\s*\(([^)]{1,80})\)\s*/g, (match, inner) => {
        const hasCyrillic = /[\u0400-\u04FF]/.test(inner);
        const hasArabic = /[\u0600-\u06FF]/.test(inner);
        const hasGreek = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(inner);
        const isLatinTarget = /^(english|german|spanish|french|italian|portuguese|dutch)$/i.test(targetLanguage || "");

        if (isLatinTarget && (hasCyrillic || hasArabic || hasGreek)) return " ";
        if (!isLatinTarget && /^[\x20-\x7F]+$/.test(inner.trim())) return " ";
        return match;
    });

    clean = clean.replace(/\s+/g, " ").trim();
    clean = clean.replace(/\s+([,.!?;:])/g, "$1");

    return clean;
}
