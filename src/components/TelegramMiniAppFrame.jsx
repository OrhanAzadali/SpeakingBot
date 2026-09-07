import { useEffect, useState } from "react";
import { Bot, MoreVertical, X, CheckCircle2, Smartphone, Sparkles, RefreshCw } from "lucide-react";
import { useTranslation } from "../i18n/useTranslation";

export const TelegramMiniAppFrame = ({
  children,
  onExitMiniApp,
  telegramUsername = "@speakbot_learner",
  isMiniAppMode,
  onTriggerSync
}) => {
  const { t } = useTranslation();
  const [isInsideRealTelegram, setIsInsideRealTelegram] = useState(false);
  const [tgVersion, setTgVersion] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor("#0f172a");
        if (tg.setBackgroundColor) tg.setBackgroundColor("#020617");
        if (tg.initData && tg.initData.length > 0) {
          setIsInsideRealTelegram(true);
          setTgVersion(tg.version || "7.0");
        }
      } catch (err) {
        console.warn("Telegram WebApp initialization note:", err);
      }
    }
  }, []);

  // If opened inside actual Telegram WebApp, render directly in native frame with full-bleed responsiveness
  if (isInsideRealTelegram) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col w-full selection:bg-sky-500 selection:text-white">
        {/* Real Telegram WebApp Header Strip */}
        <div className="bg-[#17212b] border-b border-[#232e3c] px-4 py-1.5 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">Telegram Bot WebApp Connected</span>
          </div>
          <span className="text-[11px] font-mono text-sky-400 font-bold">
            {telegramUsername}
          </span>
        </div>
        <div className="flex-1 w-full">
          {children}
        </div>
      </div>
    );
  }

  // If simulated MiniApp mode is toggled on desktop/web
  if (isMiniAppMode) {
    return (
      <div className="min-h-screen bg-slate-950 py-3 sm:py-6 px-2 sm:px-4 flex justify-center items-start">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all">
          
          {/* Telegram Native MiniApp Top Bar */}
          <div className="bg-[#17212b] border-b border-[#232e3c] px-4 py-2.5 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onExitMiniApp}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                title="Exit MiniApp Preview"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">SpeakBot</span>
                    <CheckCircle2 className="w-3 h-3 text-sky-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono">bot menu app</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>TMA Interchangeable Sync</span>
              </div>
              <button
                type="button"
                onClick={onTriggerSync}
                className="text-slate-400 hover:text-sky-300 p-1 transition"
                title="Force Refresh Bot Sync"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* MiniApp Body Content */}
          <div className="flex-1 overflow-y-auto max-h-[85vh] custom-scrollbar">
            {children}
          </div>

          {/* Telegram MiniApp Bottom Status Indicator */}
          <div className="bg-[#17212b] border-t border-[#232e3c] px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Session: <strong className="text-sky-300">{telegramUsername}</strong></span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Telegram Bot State Synced
            </span>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
