import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations.js';

const TranslationContext = createContext(undefined);

export const availableUiLanguages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'az', label: 'Azərbaycanca', flag: '🇦🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export const availableMediatorLanguages = [
  { code: 'az', label: 'Azerbaijani', flag: '🇦🇿', nativeName: 'Azərbaycan dili' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺', nativeName: 'Русский язык' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English (Direct)' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'de', label: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
];

export const TranslationProvider = ({ children }) => {
  const [uiLanguage, setUiLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('speakbot_ui_lang');
      if (saved && translations[saved]) return saved;
    } catch {}
    return 'az'; // Default to Azerbaijani as in SpeakBot, easily switchable to English, etc.
  });

  const setUiLanguage = (lang) => {
    setUiLanguageState(lang);
    try {
      localStorage.setItem('speakbot_ui_lang', lang);
    } catch {}
  };

  const t = (key) => {
    const dict = translations[uiLanguage] || translations.en;
    if (dict && dict[key]) return dict[key];
    return translations.en[key] || key;
  };

  return (
    <TranslationContext.Provider
      value={{
        uiLanguage,
        setUiLanguage,
        t,
        availableUiLanguages,
        availableMediatorLanguages,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
