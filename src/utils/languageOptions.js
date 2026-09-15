import { TARGET_LANGUAGES } from './targetLanguages.js';

/**
 * Возвращает список имён языков (только name) — для dropdown'ов,
 * которым нужен плоский список.
 */
export function getTargetLanguageNames() {
    return TARGET_LANGUAGES.map((l) => l.name);
}

/**
 * Возвращает список опций для <select>, включая код, имя, native name, флаг.
 * Готово к использованию в опциях: { value, label }
 */
export function getTargetLanguageOptions() {
    return TARGET_LANGUAGES.map((l) => ({
        value: l.name,                   // используется в API (передаётся как targetLanguage)
        code: l.code,                    // для internal mapping
        label: `${l.flag} ${l.name}`,    // для отображения
        native: l.nativeName,
        flag: l.flag,
    }));
}

/**
 * Возвращает языки для выбора mediator — тот же список, но с опцией "Native (direct)".
 */
export function getMediatorLanguageOptions() {
    return [
        ...getTargetLanguageOptions(),
        { value: 'Native', code: 'native', label: '🔤 Native (no translation)', native: 'Direct' },
    ];
}