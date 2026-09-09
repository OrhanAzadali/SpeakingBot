import React, { useState } from "react";
import {
  Sparkles,
  BookOpen,
  Volume2,
  Gamepad2,
  FileText,
  BookmarkCheck,
  Languages,
  RotateCw,
  Compass,
  Palette,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { PRESET_THEMES } from "../utils/colorHarmonizer";

const MEDIATOR_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "az", name: "Azərbaycan", flag: "🇦🇿" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
];

export const Header = ({
  activeTab,
  setActiveTab,
  userProfile,
  themeColors = {},
  activeTheme = {},
  onCycleTheme,
  onOpenTestModal,
  onOpenLanguageModal,
  onToggleMiniApp,
  isMiniAppOpen,
  uiLanguage = "en",
  onUiLanguageChange,
}) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const navTabs = [
    { id: "home", label: "Dashboard", icon: Sparkles },
    { id: "stories", label: "Classic Stories", icon: BookOpen },
    { id: "grammar", label: "Grammar PDFs", icon: FileText },
    { id: "games", label: "Games Hub", icon: Gamepad2 },
    { id: "vocab", label: "Saved Vocab", icon: BookmarkCheck },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-fuchsia-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all duration-300">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-sky-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <span className="font-black text-lg text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                SpeakingBot
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AI Coach
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto py-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${isActive
                    ? "bg-slate-800 text-white shadow-md border border-slate-700"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-400"
                      }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Action Controls & Profiles */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Telegram MiniApp Button */}
            {onToggleMiniApp && (
              <button
                type="button"
                id="toggle-telegram-miniapp-btn"
                onClick={onToggleMiniApp}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold transition cursor-pointer active:scale-95"
                title="Preview Telegram Mini App"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>MiniApp</span>
              </button>
            )}

            {/* AI Theme Harmonizer Button */}
            {onCycleTheme && (
              <button
                type="button"
                id="toggle-palette-theme-btn"
                onClick={onCycleTheme}
                style={themeColors?.brand?.badgeStyle || {}}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all hover:scale-105 shadow-sm cursor-pointer active:scale-95"
                title="Cycle AI Harmonic Theme"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {activeTheme?.themeMeta?.name || "Theme"}
                </span>
              </button>
            )}

            {/* UI Language Dropdown */}
            <div className="relative">
              <button
                type="button"
                id="ui-mediator-language-selector-btn"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5 text-indigo-400" />
                <span className="uppercase text-[11px] font-mono">
                  {uiLanguage}
                </span>
              </button>

              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                    Mediator Lang
                  </div>
                  {MEDIATOR_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        if (onUiLanguageChange) onUiLanguageChange(lang.code);
                        setShowLanguageDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition text-left cursor-pointer ${uiLanguage === lang.code
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:bg-slate-800"
                        }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Level & Target Badge */}
            {userProfile && (
              <button
                type="button"
                onClick={onOpenTestModal}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-bold transition cursor-pointer"
                title="Your Current CEFR Level & Target Language"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200">{userProfile.targetLanguage}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-black">
                  {userProfile.level}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};