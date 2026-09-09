import { useState, useEffect, useRef } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { TARGET_LANGUAGES, getTargetLanguageOption } from "../utils/targetLanguages";
import {
  Bot,
  Languages,
  Globe,
  Award,
  Smartphone,
  Monitor,
  ChevronDown,
  Check,
  RefreshCw,
  Palette,
} from "lucide-react";

import { PRESET_THEMES } from "../utils/colorHarmonizer.js";

export const Header = ({
  userProfile = {},
  onUpdateMediatorLanguage,
  onUpdateTargetLanguage,
  onOpenPlacementTest,
  activeTab,
  setActiveTab,
  isMiniAppMode,
  setIsMiniAppMode,
  isSyncing = false,
  setId,
  setThemeId,
  themeId,
  rotationIndex,
  setRotationIndex,
  themeColors = {},
  activeTheme = {},
}) => {
  const {
    uiLanguage,
    setUiLanguage,
    t,
    availableUiLanguages = [],
    availableMediatorLanguages = [],
  } = useTranslation();

  const [isMediatorMenuOpen, setIsMediatorMenuOpen] = useState(false);
  const [isTargetLangMenuOpen, setIsTargetLangMenuOpen] = useState(false);
  const [isUiLangMenuOpen, setIsUiLangMenuOpen] = useState(false);

  // Local fallback for hue rotation if not provided via props
  const [localRotationIndex, setLocalRotationIndex] = useState(0);

  const headerRef = useRef(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setIsMediatorMenuOpen(false);
        setIsTargetLangMenuOpen(false);
        setIsUiLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsMediatorMenuOpen(false);
        setIsTargetLangMenuOpen(false);
        setIsUiLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Safe user profile resolution with defaults
  const safeProfile = {
    targetLanguage: "English",
    mediatorLanguage: "en",
    telegramUsername: "User",
    currentLevel: "A1",
    overallScore: 0,
    ...(userProfile || {}),
  };

  const currentTargetObj = getTargetLanguageOption(safeProfile.targetLanguage || "English");
  const currentMediatorObj =
    availableMediatorLanguages.find((m) => m.code === safeProfile.mediatorLanguage) ||
    availableMediatorLanguages[0] || { code: "en", label: "English", flag: "🇬🇧", nativeName: "English" };
  const currentUiLangObj =
    availableUiLanguages.find((u) => u.code === uiLanguage) ||
    availableUiLanguages[0] || { code: "en", label: "English", flag: "🇬🇧" };

  const tabs = [
    { id: "home", label: t("tabHome") || "Home", icon: "🏠" },
    { id: "saved-vocabulary", label: t("tabVocabulary") || "Saved Lexicon", icon: "📚" },
    { id: "roadmaps", label: t("tabRoadmaps") || "Roadmaps", icon: "🗺️" },
    { id: "games", label: t("tabGames") || "Games", icon: "🎮" },
    { id: "grammar-pdfs", label: t("tabGrammarPdf") || "Grammar PDFs", icon: "📄" },
    { id: "stories", label: t("tabStories") || "Stories", icon: "📖" },
    { id: "placement-test", label: t("tabPlacementTest") || "Placement Test", icon: "🎯" },
    { id: "skill-tests", label: t("tabSkillTests") || "Skill Tests", icon: "📊" },
    { id: "nlp-analyzer", label: t("tabNlpAnalyzer") || "NLP Analyzer", icon: "🔬" },
  ];

  const getLevelColor = (level) => {
    switch (level) {
      case "A1":
      case "A2":
        return "from-emerald-500 to-teal-500 text-emerald-100";
      case "B1":
      case "B2":
        return "from-sky-500 to-blue-600 text-sky-100";
      case "C1":
      case "C2":
        return "from-purple-500 to-indigo-600 text-purple-100";
      default:
        return "from-slate-600 to-slate-700 text-slate-100";
    }
  };

  // Safe theme cycle and badge styles
  const activeThemeId = themeId || activeTheme?.themeMeta?.id || "golden_ai";
  const themeName = activeTheme?.themeMeta?.name || "Golden Ratio AI";
  const themeBadgeStyle = themeColors?.brand?.badgeStyle || {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    color: "#818cf8",
    borderColor: "rgba(99, 102, 241, 0.4)",
  };

  const handleCycleTheme = () => {
    const currentIndex = PRESET_THEMES.findIndex((t) => t.id === activeThemeId);
    const nextTheme = PRESET_THEMES[(currentIndex + 1) % PRESET_THEMES.length];
    if (typeof setId === "function") {
      setId(nextTheme.id);
    } else if (typeof setThemeId === "function") {
      setThemeId(nextTheme.id);
    }
    try {
      localStorage.setItem("spk_theme_id", nextTheme.id);
    } catch { }
  };

  const handleShiftHue = () => {
    if (typeof setRotationIndex === "function") {
      setRotationIndex((prev) => (typeof prev === "number" ? (prev + 1) % 8 : 1));
    } else {
      setLocalRotationIndex((prev) => (prev + 1) % 8);
    }
  };

  return (
    <header
      ref={headerRef}
      id="main-app-header"
      className={`sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 transition-all duration-200 ${isMiniAppMode ? "shadow-sm" : "shadow-md"
        }`}
    >
      {/* Top Banner: Brand & Language Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Logo & Bot status */}
          <button
            type="button"
            id="header-brand-home-btn"
            onClick={() => setActiveTab && setActiveTab("home")}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer text-left focus:outline-none shrink-0 group"
            title="Go to SpeakBot Home"
          >
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-cyan-600 shadow-md shadow-sky-500/20 text-white font-black text-base sm:text-lg group-hover:scale-105 transition-transform duration-300">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white group-hover:text-sky-300 transition-colors">
                  SpeakBot
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{t("botSyncActive")}</span>
                </span>
                {isSyncing && <RefreshCw className="w-3 h-3 text-sky-400 animate-spin shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block truncate max-w-[180px] md:max-w-none">
                {t("telegramChatId")} • @{safeProfile.telegramUsername}
              </p>
            </div>
          </button>

          {/* User Profile Attributes: Current Level, Target Lang, Mediator Lang */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Level Badge (Clickable to retake /start test) */}
            <button
              type="button"
              id="header-placement-level-badge"
              onClick={onOpenPlacementTest}
              className="group flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/40 transition-all text-left cursor-pointer active:scale-95 shrink-0"
              title="Click to take or retake placement test"
            >
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-r ${getLevelColor(
                  safeProfile.currentLevel
                )} text-xs font-black shadow-sm shrink-0`}
              >
                {safeProfile.currentLevel}
              </div>
              <div className="hidden md:block leading-tight">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                  {t("userLevel")}
                </span>
                <span className="text-xs font-bold text-slate-200 group-hover:text-sky-400 transition-colors">
                  {safeProfile.currentLevel} ({safeProfile.overallScore}%)
                </span>
              </div>
              <Award className="w-3.5 h-3.5 text-amber-400 hidden sm:block shrink-0" />
            </button>

            {/* Interactive Target Language Selector */}
            <div className="relative">
              <button
                type="button"
                id="header-target-language-btn"
                onClick={() => {
                  setIsTargetLangMenuOpen(!isTargetLangMenuOpen);
                  setIsMediatorMenuOpen(false);
                  setIsUiLangMenuOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-sky-950/40 hover:bg-sky-950/70 border border-sky-600/40 hover:border-sky-500 text-xs text-slate-200 transition-all shadow-sm cursor-pointer shrink-0"
                title={t("changeTargetLang")}
              >
                <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[9px] text-sky-400/80 block uppercase tracking-wider font-semibold leading-none">
                    {t("targetLang")}
                  </span>
                  <span className="font-bold text-sky-200 flex items-center gap-1">
                    <span>{currentTargetObj.flag}</span>
                    <span className="hidden sm:inline">{currentTargetObj.name}</span>
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-sky-400 ml-0.5 shrink-0" />
              </button>

              {isTargetLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-200">{t("changeTargetLang")}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t("botSyncTooltip")}</p>
                  </div>
                  <div className="space-y-1">
                    {TARGET_LANGUAGES.map((target) => {
                      const isSelected =
                        safeProfile.targetLanguage?.toLowerCase() === target.name.toLowerCase() ||
                        safeProfile.targetLanguage?.toLowerCase() === target.code.toLowerCase();
                      return (
                        <button
                          key={target.code}
                          type="button"
                          onClick={() => {
                            if (typeof onUpdateTargetLanguage === "function") {
                              onUpdateTargetLanguage(target.name);
                            }
                            setIsTargetLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${isSelected
                            ? "bg-sky-600/20 text-sky-300 font-bold border border-sky-500/30"
                            : "text-slate-300 hover:bg-slate-800 border border-transparent"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base shrink-0">{target.flag}</span>
                            <div className="text-left">
                              <span className="block font-medium">{target.name}</span>
                              <span className="text-[10px] text-slate-400">{target.nativeName}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Interchangeable Mediator Language Switcher */}
            <div className="relative">
              <button
                type="button"
                id="header-mediator-language-btn"
                onClick={() => {
                  setIsMediatorMenuOpen(!isMediatorMenuOpen);
                  setIsTargetLangMenuOpen(false);
                  setIsUiLangMenuOpen(false);
                }}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-600/40 hover:border-emerald-500 text-xs text-slate-200 transition-all shadow-sm cursor-pointer shrink-0"
                title={t("mediatorLangHelp")}
              >
                <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[9px] text-emerald-400/80 block uppercase tracking-wider font-semibold leading-none">
                    {t("mediatorLang")}
                  </span>
                  <span className="font-bold text-emerald-200 flex items-center gap-1">
                    <span>{currentMediatorObj.flag}</span>
                    <span className="hidden sm:inline">{currentMediatorObj.label}</span>
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-emerald-400 ml-0.5 shrink-0" />
              </button>

              {isMediatorMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-200">{t("changeMediatorLang")}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t("botSyncTooltip")}</p>
                  </div>
                  <div className="space-y-1">
                    {availableMediatorLanguages.map((lang) => {
                      const isSelected = safeProfile.mediatorLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            if (typeof onUpdateMediatorLanguage === "function") {
                              onUpdateMediatorLanguage(lang.code);
                            }
                            setIsMediatorMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${isSelected
                            ? "bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30"
                            : "text-slate-300 hover:bg-slate-800 border border-transparent"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base shrink-0">{lang.flag}</span>
                            <div className="text-left">
                              <p className="font-medium text-slate-100">{lang.label}</p>
                              <p className="text-[10px] text-slate-400">{lang.nativeName}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic AI Color Harmonizer Controls */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-0.5 sm:p-1 shadow-inner gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                id="toggle-palette-theme-btn"
                onClick={handleCycleTheme}
                style={themeBadgeStyle}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-105 shadow-sm cursor-pointer active:scale-95 shrink-0"
                title="Cycle AI Harmonic Theme"
              >
                <Palette className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{themeName}</span>
              </button>

              <button
                type="button"
                id="shift-hue-rotation-btn"
                onClick={handleShiftHue}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 shrink-0"
                title="Shift Colors Now"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* UI Language Switcher (Fixes untranslated bug by providing 100% dictionary coverage) */}
            <div className="relative">
              <button
                type="button"
                id="header-ui-language-btn"
                onClick={() => {
                  setIsUiLangMenuOpen(!isUiLangMenuOpen);
                  setIsMediatorMenuOpen(false);
                  setIsTargetLangMenuOpen(false);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition-all cursor-pointer shrink-0"
                title={t("switchUiLanguage")}
              >
                <span>{currentUiLangObj.flag}</span>
                <span className="font-semibold hidden sm:inline uppercase">{currentUiLangObj.code}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5 shrink-0" />
              </button>

              {isUiLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-24px)] max-h-72 overflow-y-auto rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 text-[11px] font-bold text-slate-400">
                    {t("switchUiLanguage")}
                  </div>
                  <div className="space-y-1">
                    {availableUiLanguages.map((lang) => {
                      const isSelected = uiLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            if (typeof setUiLanguage === "function") {
                              setUiLanguage(lang.code);
                            }
                            setIsUiLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${isSelected
                            ? "bg-sky-600/20 text-sky-400 font-bold border border-sky-500/30"
                            : "text-slate-300 hover:bg-slate-800 border border-transparent"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Telegram MiniApp vs WebApp mode toggle */}
            <button
              type="button"
              id="header-toggle-miniapp-mode-btn"
              onClick={() => {
                if (typeof setIsMiniAppMode === "function") {
                  setIsMiniAppMode(!isMiniAppMode);
                }
              }}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 ${isMiniAppMode
                ? "bg-sky-600/20 text-sky-400 border-sky-500/40 shadow-sm"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"
                }`}
              title={isMiniAppMode ? t("webAppMode") : t("telegramMiniAppMode")}
            >
              {isMiniAppMode ? (
                <>
                  <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="hidden xl:inline">{t("telegramMiniAppMode")}</span>
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="hidden xl:inline">{t("webAppMode")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 no-scrollbar border-t border-slate-800/70 scroll-smooth">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`nav-tab-${tab.id}`}
                onClick={() => {
                  if (typeof setActiveTab === "function") {
                    setActiveTab(tab.id);
                  }
                }}
                className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${isActive
                  ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 border border-sky-400/30 font-bold"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 border border-transparent"
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;