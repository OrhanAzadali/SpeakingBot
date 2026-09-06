import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { Sparkles, X, Loader2, Layers } from "lucide-react";
export const AIGeneratorModal = ({
  isOpen,
  onClose,
  type,
  userLevel,
  mediatorLanguage,
  onGeneratedRoadmap,
  onGeneratedGrammar
}) => {
  const { t } = useTranslation();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(userLevel || "B1");
  const [category, setCategory] = useState("Grammar");
  const [customGoal, setCustomGoal] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  if (!isOpen) return null;
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg("Please specify a topic or learning objective.");
      return;
    }
    setIsGenerating(true);
    setErrorMsg("");
    try {
      if (type === "roadmap") {
        const res = await fetch("/api/gemini/generate-roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            level,
            mediatorLanguage,
            customGoal
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          const newRoadmap = {
            id: `roadmap-ai-${Date.now()}`,
            title: json.data.title || topic,
            category: json.data.category || category,
            level: json.data.level || level,
            estimatedDuration: json.data.estimatedDuration || "3 Weeks",
            summary: json.data.summary || "Custom generated AI Roadmap with NLP tokenization.",
            milestones: json.data.milestones || [],
            checkpointQuestions: json.data.checkpointQuestions || [],
            isAiGenerated: true,
            tags: ["AI Generated", category, level],
            pagesCount: 5,
            fileSize: "1.9 MB"
          };
          if (onGeneratedRoadmap) onGeneratedRoadmap(newRoadmap);
          onClose();
        } else {
          throw new Error("Could not generate roadmap data.");
        }
      } else {
        const res = await fetch("/api/gemini/generate-grammar-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: topic,
            level,
            category,
            mediatorLanguage
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          const newGuide = {
            id: `pdf-ai-${Date.now()}`,
            title: json.data.title || topic,
            category: json.data.category || category,
            level: json.data.level || level,
            pagesCount: json.data.pagesCount || 4,
            fileSize: "2.1 MB",
            summary: json.data.summary || "Custom generated AI Grammar Guide with NLP tokenization.",
            coreRules: json.data.coreRules || [],
            commonMistakes: json.data.commonMistakes || [],
            practiceExercises: json.data.practiceExercises || [],
            isAiGenerated: true,
            tags: ["AI Generated", category, level],
            downloadsCount: 1
          };
          if (onGeneratedGrammar) onGeneratedGrammar(newGuide);
          onClose();
        } else {
          throw new Error("Could not generate grammar study guide.");
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate content. Please retry.");
    } finally {
      setIsGenerating(false);
    }
  };
  const categories = [
    "Grammar",
    "Vocabulary",
    "Tenses",
    "Conversational",
    "Business & Formal",
    "Pronunciation"
  ];
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
    className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
    onClick={(e) => e.stopPropagation()}
  >
        {
    /* Modal Header */
  }
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {type === "roadmap" ? t("modalRoadmapTitle") : t("modalGrammarTitle")}
              </h3>
              <p className="text-xs text-slate-400">
                Powered by Gemini 3.8 Flash • Full NLP Tokenization
              </p>
            </div>
          </div>
          <button
    onClick={onClose}
    disabled={isGenerating}
    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
  >
            <X className="w-5 h-5" />
          </button>
        </div>

        {
    /* Modal Form */
  }
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          {errorMsg && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>}

          {
    /* Topic */
  }
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {t("modalTopicLabel")}
            </label>
            <input
    type="text"
    value={topic}
    onChange={(e) => setTopic(e.target.value)}
    placeholder={t("modalTopicPlaceholder")}
    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
    required
  />
          </div>

          {
    /* Level & Category Grid */
  }
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {t("modalLevelLabel")}
              </label>
              <select
    value={level}
    onChange={(e) => setLevel(e.target.value)}
    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
  >
                {levels.map((lvl) => <option key={lvl} value={lvl}>
                    {lvl} Level
                  </option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {t("modalCategoryLabel")}
              </label>
              <select
    value={category}
    onChange={(e) => setCategory(e.target.value)}
    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
  >
                {categories.map((cat) => <option key={cat} value={cat}>
                    {cat}
                  </option>)}
              </select>
            </div>
          </div>

          {
    /* Custom Goal */
  }
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {t("modalCustomGoalLabel")}
            </label>
            <input
    type="text"
    value={customGoal}
    onChange={(e) => setCustomGoal(e.target.value)}
    placeholder={t("modalCustomGoalPlaceholder")}
    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
  />
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Generated output includes complete token-by-token syntactic roles, POS tags, and translations in your selected mediator language ({mediatorLanguage.toUpperCase()}).
            </span>
          </div>

          {
    /* Actions */
  }
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
    type="button"
    onClick={onClose}
    disabled={isGenerating}
    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
  >
              {t("modalCancelBtn")}
            </button>
            <button
    type="submit"
    disabled={isGenerating}
    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-600/30 transition-all active:scale-95 disabled:opacity-50"
  >
              {isGenerating ? <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("modalGenerating")}</span>
                </> : <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t("modalGenerateBtn")}</span>
                </>}
            </button>
          </div>
        </form>
      </div>
    </div>;
};
