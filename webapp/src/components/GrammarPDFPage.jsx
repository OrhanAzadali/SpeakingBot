import { useState, useMemo } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { AnimatedCard } from "./AnimatedCard";
import { TokenizedSentence } from "./TokenizedSentence";
import { exportGrammarGuideToPdf } from "../utils/pdfGenerator";
import {
  Search,
  Sparkles,
  Download,
  BookOpen,
  FileText,
  CheckCircle2,
  X,
  AlertTriangle,
  HelpCircle,
  FolderDown
} from "lucide-react";
export const GrammarPDFPage = ({
  grammarPdfs,
  onOpenAiGenerator,
  onSelectToken
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [activeGuide, setActiveGuide] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState({});
  const levels = ["ALL", "A1", "A2", "B1", "B2", "C1", "C2"];
  const categories = ["ALL", "Grammar", "Vocabulary", "Tenses", "Conversational", "Academic"];
  const filteredGuides = useMemo(() => {
    return grammarPdfs.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.summary.toLowerCase().includes(searchQuery.toLowerCase()) || item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesLevel = selectedLevel === "ALL" || item.level === selectedLevel;
      const matchesCategory = selectedCategory === "ALL" || item.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesLevel && matchesCategory;
    });
  }, [grammarPdfs, searchQuery, selectedLevel, selectedCategory]);
  const handleSelectOption = (qIdx, optIdx) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
    setShowExplanation((prev) => ({ ...prev, [qIdx]: true }));
  };
  const getLevelBadgeClass = (level) => {
    switch (level) {
      case "A1":
      case "A2":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "B1":
      case "B2":
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "C1":
      case "C2":
        return "bg-violet-500/20 text-violet-300 border-violet-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };
  return <div className="space-y-6 pb-16">
      
      {
    /* Top Header & Search Bar */
  }
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {t("grammarPdfTitle")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl">
              {t("grammarPdfSubtitle")}
            </p>
          </div>

          <button
    onClick={onOpenAiGenerator}
    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-600/25 transition-all active:scale-95 shrink-0"
  >
            <Sparkles className="w-4 h-4" />
            <span>{t("aiGenerateGrammar")}</span>
          </button>
        </div>

        {
    /* Search Bar */
  }
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={t("searchGrammarPlaceholder")}
    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
  />
        </div>

        {
    /* Filter Pills: Levels & Categories */
  }
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {
    /* CEFR Level Filters */
  }
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Level:
            </span>
            {levels.map((lvl) => {
    const active = selectedLevel === lvl;
    return <button
      key={lvl}
      onClick={() => setSelectedLevel(lvl)}
      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${active ? "bg-sky-600 text-white shadow-md shadow-sky-600/20" : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
    >
                  {lvl === "ALL" ? t("allLevels") : lvl}
                </button>;
  })}
          </div>

          {
    /* Category Chips */
  }
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => {
    const active = selectedCategory === cat;
    return <button
      key={cat}
      onClick={() => setSelectedCategory(cat)}
      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${active ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"}`}
    >
                  {cat === "ALL" ? t("allCategories") : cat}
                </button>;
  })}
          </div>
        </div>

      </div>

      {
    /* Grammar Guides Cards Grid with Scroll Appearing/Disappearing Animations */
  }
      {filteredGuides.length === 0 ? <div className="text-center py-16 px-4 bg-slate-900/30 rounded-3xl border border-slate-800">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">{t("noGrammarFound")}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{t("noGrammarFoundDesc")}</p>
          <button
    onClick={onOpenAiGenerator}
    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
  >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t("aiGenerateGrammar")}</span>
          </button>
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide, index) => {
    return <AnimatedCard
      key={guide.id}
      delay={index * 0.05}
      className="h-full"
    >
                <div className="h-full flex flex-col justify-between p-6 rounded-3xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg hover:shadow-2xl hover:shadow-indigo-950/20 group">
                  <div>
                    {
      /* Top Badges */
    }
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${getLevelBadgeClass(guide.level)}`}>
                          {guide.level}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-800">
                          {guide.category}
                        </span>
                      </div>
                      {guide.isAiGenerated && <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Sparkles className="w-3 h-3" />
                          AI
                        </span>}
                    </div>

                    {
      /* Title */
    }
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug mb-2">
                      {guide.title}
                    </h3>

                    {
      /* Summary */
    }
                    <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                      {guide.summary}
                    </p>

                    {
      /* PDF Specs */
    }
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-4 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <div>
                          <span className="text-[9px] text-slate-400 block font-medium">
                            {t("pagesCount")}
                          </span>
                          <span className="font-semibold text-xs">{guide.pagesCount} Pages</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-slate-300">
                        <FolderDown className="w-3.5 h-3.5 text-sky-400" />
                        <div>
                          <span className="text-[9px] text-slate-400 block font-medium">
                            {t("fileSizeLabel")}
                          </span>
                          <span className="font-semibold text-xs">{guide.fileSize}</span>
                        </div>
                      </div>
                    </div>

                    {
      /* Tags */
    }
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {guide.tags.slice(0, 3).map((tag, tIdx) => <span key={tIdx} className="text-[10px] text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-md">
                          #{tag}
                        </span>)}
                    </div>
                  </div>

                  {
      /* Actions: Read Interactive Guide & Download PDF */
    }
                  <div className="pt-4 border-t border-slate-800/70 flex items-center gap-2">
                    <button
      onClick={() => setActiveGuide(guide)}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95"
    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t("readGuideOnline")}</span>
                    </button>

                    <button
      onClick={() => exportGrammarGuideToPdf(guide)}
      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
      title={t("downloadPdfGuide")}
    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </AnimatedCard>;
  })}
        </div>}

      {
    /* Active Grammar Guide In-Depth Reader Modal */
  }
      {activeGuide && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
    className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
    onClick={(e) => e.stopPropagation()}
  >
            {
    /* Modal Top Bar */
  }
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${getLevelBadgeClass(activeGuide.level)}`}>
                  {activeGuide.level}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-100 line-clamp-1">{activeGuide.title}</h2>
                  <p className="text-xs text-slate-400">{activeGuide.category} • {activeGuide.pagesCount} Pages ({activeGuide.fileSize})</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
    onClick={() => exportGrammarGuideToPdf(activeGuide)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
  >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t("downloadPdfGuide")}</span>
                </button>
                <button
    onClick={() => setActiveGuide(null)}
    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
  >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {
    /* Modal Content */
  }
            <div className="p-6 overflow-y-auto space-y-6">
              
              {
    /* Summary */
  }
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-slate-200 mb-1">Study Guide Overview:</p>
                {activeGuide.summary}
              </div>

              {
    /* Core Rules Section */
  }
              <div>
                <h3 className="text-sm font-extrabold text-slate-100 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t("coreRulesTitle")}</span>
                </h3>

                <div className="space-y-4">
                  {activeGuide.coreRules.map((rule, rIdx) => <div key={rIdx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                        {rule.ruleTitle}
                      </h4>

                      <p className="text-xs text-slate-300 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-500/20">
                        {rule.explanationInMediator}
                      </p>

                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-sky-400 font-semibold block mb-0.5">{t("formulaLabel")}</span>
                        <code className="text-slate-200 font-mono text-[11px]">{rule.formula}</code>
                      </div>

                      {rule.tokens && rule.tokens.length > 0 && <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-400">
                              {t("interactiveLesson")}
                            </span>
                            <span className="text-[10px] text-sky-400">
                              {t("clickTokenToInspect")}
                            </span>
                          </div>
                          <TokenizedSentence
    tokens={rule.tokens}
    onSelectToken={onSelectToken}
  />
                        </div>}
                    </div>)}
                </div>
              </div>

              {
    /* Common Mistakes */
  }
              {activeGuide.commonMistakes && activeGuide.commonMistakes.length > 0 && <div>
                  <h3 className="text-sm font-extrabold text-slate-100 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>{t("commonMistakesTitle")}</span>
                  </h3>

                  <div className="space-y-2.5">
                    {activeGuide.commonMistakes.map((m, mIdx) => <div key={mIdx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-rose-400 font-semibold">
                          <span className="font-bold">{t("mistakeIncorrect")}</span>
                          <span>{m.incorrect}</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                          <span className="font-bold">{t("mistakeCorrect")}</span>
                          <span>{m.correct}</span>
                        </div>
                        <div className="text-slate-400 text-[11px] pt-1 border-t border-slate-900">
                          <span className="text-slate-300 font-medium">{t("mistakeReason")}</span> {m.reason}
                        </div>
                      </div>)}
                  </div>
                </div>}

              {
    /* Practice Exercises */
  }
              {activeGuide.practiceExercises && activeGuide.practiceExercises.length > 0 && <div className="pt-4 border-t border-slate-800">
                  <h3 className="text-sm font-extrabold text-slate-100 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-sky-400" />
                    <span>{t("practiceExercisesTitle")}</span>
                  </h3>

                  <div className="space-y-3">
                    {activeGuide.practiceExercises.map((ex, exIdx) => {
    const selectedOpt = selectedAnswers[exIdx];
    const isAnswered = selectedOpt !== void 0;
    const isCorrect = isAnswered && selectedOpt === ex.correctIndex;
    return <div key={exIdx} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                          <p className="text-[11px] font-semibold text-sky-400 mb-1">
                            {ex.instruction}
                          </p>
                          <p className="text-xs font-bold text-slate-200 mb-3">
                            {ex.question}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                            {ex.options.map((opt, oIdx) => {
      let btnStyle = "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850";
      if (isAnswered) {
        if (oIdx === ex.correctIndex) {
          btnStyle = "bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold";
        } else if (oIdx === selectedOpt) {
          btnStyle = "bg-rose-950/60 border-rose-500 text-rose-200";
        } else {
          btnStyle = "bg-slate-900/50 border-slate-800 text-slate-500 opacity-60";
        }
      }
      return <button
        key={oIdx}
        type="button"
        onClick={() => handleSelectOption(exIdx, oIdx)}
        className={`p-2.5 rounded-xl border text-xs text-left transition-all ${btnStyle}`}
      >
                                  {opt}
                                </button>;
    })}
                          </div>

                          {showExplanation[exIdx] && <div className={`p-2.5 rounded-xl text-xs ${isCorrect ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30" : "bg-rose-950/40 text-rose-300 border border-rose-500/30"}`}>
                              <span className="font-bold block mb-0.5">
                                {isCorrect ? t("correctAnswer") : t("wrongAnswer")}
                              </span>
                              <span className="text-slate-300">{ex.explanation}</span>
                            </div>}
                        </div>;
  })}
                  </div>
                </div>}

            </div>

            {
    /* Modal Bottom Bar */
  }
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                SpeakBot Grammar Engine • Print-Ready PDF
              </span>
              <button
    onClick={() => setActiveGuide(null)}
    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
  >
                {t("close")}
              </button>
            </div>
          </div>
        </div>}

    </div>;
};
