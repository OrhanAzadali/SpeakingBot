import { useTranslation } from "../i18n/useTranslation";
import { Volume2, Sparkles, BookOpen, Layers, X } from "lucide-react";
export const NLPInspectorModal = ({ token, onClose }) => {
  const { t } = useTranslation();
  if (!token) return null;
  const playAudio = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(token.text || token.lemma);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };
  const getPosColor = (pos) => {
    switch (pos) {
      case "NOUN":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "VERB":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "ADJ":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "ADV":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "PRON":
        return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
      case "AUX":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "PREP":
        return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      case "CONJ":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "DET":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };
  const getCefrBadge = (level) => {
    switch (level) {
      case "A1":
      case "A2":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "B1":
      case "B2":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "C1":
      case "C2":
        return "bg-violet-500/20 text-violet-300 border-violet-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div
    className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
    onClick={(e) => e.stopPropagation()}
  >
        {
    /* Header */
  }
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">{t("nlpInspectorTitle")}</h3>
              <p className="text-xs text-slate-400">{t("clickTokenToInspect")}</p>
            </div>
          </div>
          <button
    onClick={onClose}
    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
  >
            <X className="w-5 h-5" />
          </button>
        </div>

        {
    /* Word Display & Audio */
  }
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-extrabold tracking-tight text-white">{token.text}</span>
                {token.ipa && <span className="font-mono text-sm text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
                    {token.ipa}
                  </span>}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t("tokenLemma")}: <span className="text-slate-200 font-semibold">{token.lemma}</span>
              </p>
            </div>
            <button
    onClick={playAudio}
    className="p-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-600/20 transition-transform active:scale-95"
    title="Play pronunciation"
  >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          {
    /* Core linguistic tokens */
  }
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">{t("tokenPos")}</span>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md border ${getPosColor(token.pos)}`}>
                {token.pos}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">{t("tokenCefr")}</span>
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md border ${getCefrBadge(token.cefrLevel)}`}>
                {token.cefrLevel || "B1"}
              </span>
            </div>
          </div>

          {
    /* Syntactic Role */
  }
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="flex items-center gap-2 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">{t("tokenSyntaxRole")}</span>
            </div>
            <p className="text-sm font-medium text-slate-100">{token.syntaxRole}</p>
          </div>

          {
    /* Mediator Language Translation */
  }
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">{t("tokenMediatorTrans")}</span>
            </div>
            <p className="text-sm font-semibold text-emerald-100">
              {token.mediatorTranslation || "T\u0259rc\xFCm\u0259 m\xF6vcuddur"}
            </p>
          </div>

          {
    /* Morphology details */
  }
          {token.morphology && <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-400">
              <span className="text-slate-300 font-semibold block mb-0.5">{t("tokenMorphology")}</span>
              {token.morphology}
            </div>}
        </div>

        {
    /* Footer */
  }
        <div className="px-6 py-3.5 bg-slate-950/50 border-t border-slate-800 flex justify-end">
          <button
    onClick={onClose}
    className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
  >
            {t("close")}
          </button>
        </div>
      </div>
    </div>;
};
