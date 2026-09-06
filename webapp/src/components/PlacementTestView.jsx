import { useState } from "react";
import confetti from "canvas-confetti";
import { useTranslation } from "../i18n/useTranslation";
import {
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Bot,
  Check
} from "lucide-react";
export const PlacementTestView = ({
  questions,
  userProfile,
  onTestCompleted,
  onGoToRoadmaps
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculatedLevel, setCalculatedLevel] = useState(userProfile.currentLevel);
  const [finalScore, setFinalScore] = useState(userProfile.overallScore);
  const currentQ = questions[currentIndex];
  const progressPercent = Math.round((currentIndex + (isFinished ? 1 : 0)) / questions.length * 100);
  const handleSelect = (optionIndex) => {
    if (selectedAnswers[currentIndex] !== void 0) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };
  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      let correctCount = 0;
      questions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctIndex) {
          correctCount++;
        }
      });
      const scorePercent = Math.round(correctCount / questions.length * 100);
      let assignedLevel = "A1";
      if (scorePercent >= 85) assignedLevel = "C1";
      else if (scorePercent >= 70) assignedLevel = "B2";
      else if (scorePercent >= 50) assignedLevel = "B1";
      else if (scorePercent >= 30) assignedLevel = "A2";
      else assignedLevel = "A1";
      setCalculatedLevel(assignedLevel);
      setFinalScore(scorePercent);
      setIsFinished(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
      }
      setIsSubmitting(true);
      try {
        await fetch("/api/user/level-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: assignedLevel,
            score: scorePercent,
            details: {
              correctCount,
              totalQuestions: questions.length
            }
          })
        });
        onTestCompleted(assignedLevel, scorePercent);
      } catch (err) {
        console.error("Failed to sync level test to backend:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setIsFinished(false);
  };
  const getLevelBadgeClass = (lvl) => {
    switch (lvl) {
      case "A1":
      case "A2":
        return "from-emerald-500 to-teal-500 text-white";
      case "B1":
      case "B2":
        return "from-sky-500 to-blue-600 text-white";
      case "C1":
      case "C2":
        return "from-purple-500 to-indigo-600 text-white";
      default:
        return "from-slate-600 to-slate-700 text-white";
    }
  };
  return <div className="max-w-2xl mx-auto space-y-6 pb-16">
      
      {
    /* Top Banner */
  }
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-white">
                  {t("placementTestTitle")}
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/40">
                  /start Command
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t("placementTestSubtitle")}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
              Bot Synced Level
            </span>
            <span className="text-xs font-extrabold text-emerald-400">
              {userProfile.currentLevel} ({userProfile.overallScore}%)
            </span>
          </div>
        </div>

        {
    /* Progress bar */
  }
        {!isFinished && <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>
                {t("questionOf")} {currentIndex + 1} / {questions.length}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-300"
    style={{ width: `${progressPercent}%` }}
  />
            </div>
          </div>}
      </div>

      {
    /* Main Question Card or Results View */
  }
      {!isFinished ? <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 animate-in fade-in">
          
          {
    /* Question category & CEFR tag */
  }
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-950/40 px-3 py-1 rounded-xl border border-sky-800/30">
              {currentQ.category} • {currentQ.level} target
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Diagnostic Q-{currentIndex + 1}
            </span>
          </div>

          {
    /* Prompt */
  }
          <div>
            <p className="text-xs text-slate-400 mb-2">{currentQ.prompt}</p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-sm sm:text-base font-semibold text-slate-100 font-sans tracking-wide">
              {currentQ.contextSentence}
            </div>
          </div>

          {
    /* Options */
  }
          <div className="space-y-2.5">
            {currentQ.options.map((opt, oIdx) => {
    const selectedIdx = selectedAnswers[currentIndex];
    const isSelected = selectedIdx === oIdx;
    const isAnswered = selectedIdx !== void 0;
    const isCorrectOpt = oIdx === currentQ.correctIndex;
    let btnStyle = "bg-slate-950/80 border-slate-800 text-slate-200 hover:bg-slate-850 hover:border-slate-700";
    if (isAnswered) {
      if (isCorrectOpt) {
        btnStyle = "bg-emerald-950/60 border-emerald-500/70 text-emerald-200 font-bold";
      } else if (isSelected) {
        btnStyle = "bg-rose-950/60 border-rose-500/70 text-rose-200";
      } else {
        btnStyle = "bg-slate-950/40 border-slate-800 text-slate-500 opacity-50";
      }
    }
    return <button
      key={oIdx}
      type="button"
      onClick={() => handleSelect(oIdx)}
      disabled={isAnswered}
      className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm text-left transition-all flex items-center justify-between ${btnStyle}`}
    >
                  <span>{opt}</span>
                  {isAnswered && <span>
                      {isCorrectOpt ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : isSelected ? <XCircle className="w-4 h-4 text-rose-400" /> : null}
                    </span>}
                </button>;
  })}
          </div>

          {
    /* Explanation if answered */
  }
          {selectedAnswers[currentIndex] !== void 0 && <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 animate-in fade-in">
              <span className="font-bold text-sky-400 block mb-1">
                Linguistic Grammar Note:
              </span>
              {currentQ.explanation}
            </div>}

          {
    /* Next / Submit Button */
  }
          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
    onClick={handleNext}
    disabled={selectedAnswers[currentIndex] === void 0}
    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-600/25 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
  >
              <span>{currentIndex === questions.length - 1 ? t("finishTest") : t("nextQuestion")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div> : (
    /* Test Completion Celebration Card */
    <div className="p-8 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          
          <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-400 mb-1 shadow-lg">
            <Award className="w-12 h-12" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {t("testCompletedTitle")}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
              {t("testCompletedDesc")}
            </p>
          </div>

          {
      /* Level Assessment Pill */
    }
          <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 max-w-md mx-auto space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Assigned CEFR Level
            </span>
            <div className={`inline-block px-6 py-2 rounded-2xl bg-gradient-to-r ${getLevelBadgeClass(calculatedLevel)} text-2xl font-black shadow-lg`}>
              {calculatedLevel}
            </div>
            <p className="text-xs text-slate-300">
              Overall Score: <span className="text-emerald-400 font-bold">{finalScore}%</span>
            </p>
          </div>

          {
      /* Telegram Sync confirmation banner */
    }
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Updated profile successfully synced with Telegram Bot @SpeakBot for user {userProfile.telegramUsername}!
            </span>
          </div>

          {
      /* Action buttons */
    }
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
      onClick={handleRetake}
      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
    >
              <RotateCcw className="w-4 h-4" />
              <span>{t("retakeTest")}</span>
            </button>

            <button
      onClick={onGoToRoadmaps}
      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/25 transition-all active:scale-95"
    >
              <span>{t("viewPersonalizedRoadmaps")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
  )}

    </div>;
};
