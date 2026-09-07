export const TARGET_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    flag: '🇬🇧',
    nativeName: 'English',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'es',
    name: 'Spanish',
    flag: '🇪🇸',
    nativeName: 'Español',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'de',
    name: 'German',
    flag: '🇩🇪',
    nativeName: 'Deutsch',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'fr',
    name: 'French',
    flag: '🇫🇷',
    nativeName: 'Français',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'it',
    name: 'Italian',
    flag: '🇮🇹',
    nativeName: 'Italiano',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'ru',
    name: 'Russian',
    flag: '🇷🇺',
    nativeName: 'Русский',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    code: 'tr',
    name: 'Turkish',
    flag: '🇹🇷',
    nativeName: 'Türkçe',
    cefrLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
];

export const DEFAULT_TARGET_LANGUAGE = 'English';

export function getTargetLanguageOption(lang) {
  const found = TARGET_LANGUAGES.find(
    (l) => l.name.toLowerCase() === String(lang || '').toLowerCase() || l.code.toLowerCase() === String(lang || '').toLowerCase()
  );
  return found || TARGET_LANGUAGES[0];
}
