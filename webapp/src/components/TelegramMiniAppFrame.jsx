import { Bot, MoreVertical, X, CheckCircle2 } from "lucide-react";
import { useTranslation } from "../i18n/useTranslation";
export const TelegramMiniAppFrame = ({
  children,
  onExitMiniApp,
  telegramUsername = "@speakbot_learner",
  isMiniAppMode
}) => {
  const { t } = useTranslation();
  if (!isMiniAppMode) {
    return <>{children}</>;
  }
  return <div className="min-h-screen bg-slate-950 py-4 sm:py-8 px-2 sm:px-4 flex justify-center">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all">
        
        {
    /* Telegram Native MiniApp Top Bar */
  }
        <div className="bg-[#17212b] border-b border-[#232e3c] px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center gap-2.5">
            <button
    type="button"
    onClick={onExitMiniApp}
    className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
    title="Exit MiniApp Mode"
  >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">SpeakBot</span>
                  <CheckCircle2 className="w-3 h-3 text-sky-400" />
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">bot</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Telegram WebApp</span>
            </div>
            <button className="text-slate-400 hover:text-white p-1">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {
    /* MiniApp Body Content */
  }
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {
    /* Telegram MiniApp Bottom Status Indicator */
  }
        <div className="bg-[#17212b] border-t border-[#232e3c] px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Session: {telegramUsername}</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Cloud Synced
          </span>
        </div>

      </div>
    </div>;
};
