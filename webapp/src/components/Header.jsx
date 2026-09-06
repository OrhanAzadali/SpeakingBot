import { useState } from "react";
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
  RefreshCw
} from "lucide-react";
export const Header = ({
  userProfile,
  onUpdateMediatorLanguage,
  onUpdateTargetLanguage,
  onOpenPlacementTest,
  activeTab,
  setActiveTab,
  isMiniAppMode,
  setIsMiniAppMode,
  isSyncing = false
}) => {
  const {
    uiLanguage,
    setUiLanguage,
    t,
    availableUiLanguages,
    availableMediatorLanguages
  } = useTranslation();
  const [isMediatorMenuOpen, setIsMediatorMenuOpen] = useState(false);
  const [isTargetLangMenuOpen, setIsTargetLangMenuOpen] = useState(false);
  const [isUiLangMenuOpen, setIsUiLangMenuOpen] = useState(false);
  const currentTargetObj = getTargetLanguageOption(userProfile.targetLanguage || "English");
  const currentMediatorObj = availableMediatorLanguages.find(
    (m) => m.code === userProfile.mediatorLanguage
  ) || availableMediatorLanguages[0];
  const currentUiLangObj = availableUiLanguages.find(
    (u) => u.code === uiLanguage
  ) || availableUiLanguages[0];
  const tabs = [
    { id: "roadmaps", label: t("tabRoadmaps"), icon: "\u{1F5FA}\uFE0F" },
    { id: "games", label: t("tabGames"), icon: "\u{1F3AE}" },
    { id: "grammar-pdfs", label: t("tabGrammarPdf"), icon: "\u{1F4C4}" },
    { id: "stories", label: t("tabStories"), icon: "\u{1F4D6}" },
    { id: "placement-test", label: t("tabPlacementTest"), icon: "\u{1F3AF}" },
    { id: "skill-tests", label: t("tabSkillTests"), icon: "\u{1F4CA}" },
    { id: "nlp-analyzer", label: t("tabNlpAnalyzer"), icon: "\u{1F52C}" }
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
  return <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {
    /* Top Banner: Brand & Language Bar */
  }
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {
    /* Logo & Bot status */
  }
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-500/20 text-white font-black text-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">SpeakBot</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t("botSyncActive")}
                </span>
                {isSyncing && <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />}
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                {t("telegramChatId")} • {userProfile.telegramUsername}
              </p>
            </div>
          </div>

          {
    /* User Profile Attributes: Current Level, Target Lang, Mediator Lang */
  }
          <div className="flex items-center gap-2 sm:gap-3">
            
            {
    /* Level Badge (Clickable to retake /start test) */
  }
            <button
    onClick={onOpenPlacementTest}
    className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/40 transition-all text-left"
    title="Click to take or retake placement test"
  >
              <div className={`flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-r ${getLevelColor(userProfile.currentLevel)} text-xs font-black shadow-sm`}>
                {userProfile.currentLevel}
              </div>
              <div className="hidden md:block">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                  {t("userLevel")}
                </span>
                <span className="text-xs font-bold text-slate-200 group-hover:text-sky-400 transition-colors">
                  {userProfile.currentLevel} ({userProfile.overallScore}%)
                </span>
              </div>
              <Award className="w-3.5 h-3.5 text-amber-400 hidden sm:block" />
            </button>

            {
    /* Interactive Target Language Selector */
  }
            <div className="relative">
              <button
    type="button"
    onClick={() => {
      setIsTargetLangMenuOpen(!isTargetLangMenuOpen);
      setIsMediatorMenuOpen(false);
      setIsUiLangMenuOpen(false);
    }}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-950/40 hover:bg-sky-950/70 border border-sky-600/40 hover:border-sky-500 text-xs text-slate-200 transition-all shadow-sm"
    title={t("changeTargetLang")}
  >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <div className="text-left">
                  <span className="text-[9px] text-sky-400/80 block uppercase tracking-wider font-semibold leading-none">
                    {t("targetLang")}
                  </span>
                  <span className="font-bold text-sky-200 flex items-center gap-1">
                    <span>{currentTargetObj.flag}</span>
                    <span className="hidden sm:inline">{currentTargetObj.name}</span>
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-sky-400 ml-0.5" />
              </button>

              {isTargetLangMenuOpen && <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-200">{t("changeTargetLang")}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t("botSyncTooltip")}</p>
                  </div>
                  <div className="space-y-1">
                    {TARGET_LANGUAGES.map((target) => {
    const isSelected = userProfile.targetLanguage?.toLowerCase() === target.name.toLowerCase() || userProfile.targetLanguage?.toLowerCase() === target.code.toLowerCase();
    return <button
      key={target.code}
      type="button"
      onClick={() => {
        onUpdateTargetLanguage(target.name);
        setIsTargetLangMenuOpen(false);
      }}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${isSelected ? "bg-sky-600/20 text-sky-300 font-bold border border-sky-500/30" : "text-slate-300 hover:bg-slate-800"}`}
    >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{target.flag}</span>
                            <div className="text-left">
                              <span className="block font-medium">{target.name}</span>
                              <span className="text-[10px] text-slate-400">{target.nativeName}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </button>;
  })}
                  </div>
                </div>}
            </div>

            {
    /* Interchangeable Mediator Language Switcher */
  }
            <div className="relative">
              <button
    type="button"
    onClick={() => {
      setIsMediatorMenuOpen(!isMediatorMenuOpen);
      setIsUiLangMenuOpen(false);
    }}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-600/40 hover:border-emerald-500 text-xs text-slate-200 transition-all shadow-sm"
    title={t("mediatorLangHelp")}
  >
                <Languages className="w-3.5 h-3.5 text-emerald-400" />
                <div className="text-left">
                  <span className="text-[9px] text-emerald-400/80 block uppercase tracking-wider font-semibold leading-none">
                    {t("mediatorLang")}
                  </span>
                  <span className="font-bold text-emerald-200 flex items-center gap-1">
                    <span>{currentMediatorObj.flag}</span>
                    <span className="hidden sm:inline">{currentMediatorObj.label}</span>
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-emerald-400 ml-0.5" />
              </button>

              {isMediatorMenuOpen && <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-200">{t("changeMediatorLang")}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t("botSyncTooltip")}</p>
                  </div>
                  <div className="space-y-1">
                    {availableMediatorLanguages.map((lang) => {
    const isSelected = userProfile.mediatorLanguage === lang.code;
    return <button
      key={lang.code}
      type="button"
      onClick={() => {
        onUpdateMediatorLanguage(lang.code);
        setIsMediatorMenuOpen(false);
      }}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${isSelected ? "bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30" : "text-slate-300 hover:bg-slate-800"}`}
    >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{lang.flag}</span>
                            <div className="text-left">
                              <p className="font-medium text-slate-100">{lang.label}</p>
                              <p className="text-[10px] text-slate-400">{lang.nativeName}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                        </button>;
  })}
                  </div>
                </div>}
            </div>

            {
    /* UI Language Switcher (Fixes untranslated bug by providing 100% dictionary coverage) */
  }
            <div className="relative">
              <button
    type="button"
    onClick={() => {
      setIsUiLangMenuOpen(!isUiLangMenuOpen);
      setIsMediatorMenuOpen(false);
    }}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition-all"
    title={t("switchUiLanguage")}
  >
                <span>{currentUiLangObj.flag}</span>
                <span className="font-semibold hidden sm:inline">{currentUiLangObj.code.toUpperCase()}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isUiLangMenuOpen && <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 text-[11px] font-bold text-slate-400">
                    {t("switchUiLanguage")}
                  </div>
                  <div className="space-y-1">
                    {availableUiLanguages.map((lang) => {
    const isSelected = uiLanguage === lang.code;
    return <button
      key={lang.code}
      type="button"
      onClick={() => {
        setUiLanguage(lang.code);
        setIsUiLangMenuOpen(false);
      }}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${isSelected ? "bg-sky-600/20 text-sky-400 font-bold border border-sky-500/30" : "text-slate-300 hover:bg-slate-800"}`}
    >
                          <div className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </button>;
  })}
                  </div>
                </div>}
            </div>

            {
    /* Telegram MiniApp vs WebApp mode toggle */
  }
            <button
    onClick={() => setIsMiniAppMode(!isMiniAppMode)}
    className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 ${isMiniAppMode ? "bg-sky-600/20 text-sky-400 border-sky-500/40 shadow-sm" : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700"}`}
    title={isMiniAppMode ? t("webAppMode") : t("telegramMiniAppMode")}
  >
              {isMiniAppMode ? <>
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span className="hidden xl:inline">{t("telegramMiniAppMode")}</span>
                </> : <>
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span className="hidden xl:inline">{t("webAppMode")}</span>
                </>}
            </button>

          </div>
        </div>

        {
    /* Navigation Tabs Bar */
  }
        <div className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar border-t border-slate-800/70">
          {tabs.map((tab) => {
    const isActive = activeTab === tab.id;
    return <button
      key={tab.id}
      type="button"
      onClick={() => setActiveTab(tab.id)}
      className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${isActive ? "bg-sky-600 text-white shadow-md shadow-sky-600/30" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"}`}
    >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>;
  })}
        </div>

      </div>
    </header>;
};
