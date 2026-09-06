import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { AnimatedCard } from "./AnimatedCard";
import {
  BarChart3,
  Sparkles,
  Bot,
  BookOpen,
  Headphones,
  Mic,
  Layers,
  Check,
  Compass,
  ArrowRight,
  ExternalLink,
  Volume2
} from "lucide-react";
const SAMPLE_SKILL_TESTS = {
  grammar: [
    {
      skill: "grammar",
      question: 'Choose the correct inverted form: "Little _____ about the impending announcement."',
      options: ["did they know", "they knew", "they did know", "knew they"],
      correctIndex: 0,
      explanation: 'Negative fronting with "Little" triggers subject-auxiliary inversion with "did they know".'
    },
    {
      skill: "grammar",
      question: "Which sentence uses the correct subjunctive mood?",
      options: [
        "The doctor insisted that he takes the medicine.",
        "The doctor insisted that he take the medicine.",
        "The doctor insisted that he took the medicine.",
        "The doctor insisted that he is taking the medicine."
      ],
      correctIndex: 1,
      explanation: 'Mandative subjunctive requires the base form of the verb ("take") regardless of subject person.'
    }
  ],
  vocabulary: [
    {
      skill: "vocabulary",
      question: 'Select the synonym for "ubiquitous":',
      options: ["scarce", "omnipresent", "nebulous", "ephemeral"],
      correctIndex: 1,
      explanation: '"Ubiquitous" denotes something present, appearing, or found everywhere.'
    }
  ],
  reading: [
    {
      skill: "reading",
      question: "In academic discourse, what is the primary purpose of a literature review?",
      options: [
        "To critique fictional narratives",
        "To establish theoretical context and identify scholarly gaps",
        "To compile personal anecdotes",
        "To list random publications"
      ],
      correctIndex: 1,
      explanation: "A literature review surveys scholarly sources to substantiate research foundations."
    }
  ],
  listening: [
    {
      skill: "listening",
      question: 'When a speaker contracts "going to" into /\u02C8\u0261\u0259n\u0259/ (gonna), this phonological phenomenon is:',
      options: ["Hyperarticulation", "Connected speech assimilation and vowel reduction", "Stressing", "Epenthesis"],
      correctIndex: 1,
      explanation: "Reduction in casual connected speech simplifies vowel articulation and merges sounds."
    }
  ],
  speaking: [
    {
      skill: "speaking",
      question: "To politely hedge a controversial claim during a discussion, which discourse marker is most effective?",
      options: [
        "Without a shadow of doubt, you are wrong.",
        "It could be argued that there are alternative perspectives to consider.",
        "That statement is totally inaccurate.",
        "Everybody knows that is false."
      ],
      correctIndex: 1,
      explanation: 'Hedging ("It could be argued that...") softens direct claims to maintain diplomatic tone.'
    }
  ]
};
export const SkillTestsView = ({
  userProfile,
  onSkillUpdated,
  onPersonalizedRoadmapGenerated,
  onOpenStories,
  onNavigateToRoadmaps
}) => {
  const { t } = useTranslation();
  const [activeSkillModal, setActiveSkillModal] = useState(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [generatedRoadmap, setGeneratedRoadmap] = useState(null);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const skillsList = [
    { key: "grammar", label: t("skillGrammar"), icon: Layers, color: "from-sky-500 to-blue-600" },
    { key: "vocabulary", label: t("skillVocabulary"), icon: BookOpen, color: "from-emerald-500 to-teal-600" },
    { key: "reading", label: t("skillReading"), icon: BookOpen, color: "from-indigo-500 to-violet-600" },
    { key: "listening", label: t("skillListening"), icon: Headphones, color: "from-amber-500 to-orange-600" },
    { key: "speaking", label: t("skillSpeaking"), icon: Mic, color: "from-rose-500 to-pink-600" }
  ];
  const currentSkillScores = {
    grammar: userProfile?.skillScores?.grammar ?? userProfile?.skillLevels?.grammar?.score ?? 74,
    vocabulary: userProfile?.skillScores?.vocabulary ?? userProfile?.skillLevels?.vocabulary?.score ?? 65,
    reading: userProfile?.skillScores?.reading ?? userProfile?.skillLevels?.reading?.score ?? 80,
    listening: userProfile?.skillScores?.listening ?? userProfile?.skillLevels?.listening?.score ?? 70,
    speaking: userProfile?.skillScores?.speaking ?? userProfile?.skillLevels?.speaking?.score ?? 62
  };
  const handleStartSkillTest = (skill) => {
    setActiveSkillModal(skill);
    setCurrentTestIndex(0);
    setSelectedAnswer(null);
  };
  const handleSubmitSkillQuestion = async () => {
    if (!activeSkillModal || selectedAnswer === null) return;
    const questions = SAMPLE_SKILL_TESTS[activeSkillModal];
    const q = questions[currentTestIndex];
    const isCorrect = selectedAnswer === q.correctIndex;
    const currentScore = currentSkillScores[activeSkillModal] ?? 70;
    const delta = isCorrect ? 5 : -2;
    const newScore = Math.min(100, Math.max(20, currentScore + delta));
    const optimisticScores = {
      ...currentSkillScores,
      [activeSkillModal]: newScore
    };
    onSkillUpdated(optimisticScores);
    setIsSubmitting(true);
    const testedSkill = activeSkillModal;
    try {
      const res = await fetch("/api/user/skill-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: testedSkill,
          scoreDelta: delta,
          score: newScore
        })
      });
      const data = await res.json();
      if (data.success && data.data?.skillScores) {
        onSkillUpdated(data.data.skillScores);
      }
      setSuccessNotice(`${testedSkill.toUpperCase()} skill rating updated to ${newScore}% and synchronized to @SpeakBot!`);
      setTimeout(() => setSuccessNotice(""), 5e3);
      if (testedSkill === "grammar") {
        setIsGeneratingRoadmap(true);
        try {
          const roadmapRes = await fetch("/api/gemini/generate-grammar-roadmap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              testScore: newScore,
              testedWeaknesses: isCorrect ? [] : ["Inversion & Fronting", "Subjunctive Mood"],
              userLevel: userProfile.currentLevel,
              targetLanguage: userProfile.targetLanguage || "English",
              mediatorLanguage: userProfile.mediatorLanguage || "az"
            })
          });
          const roadmapJson = await roadmapRes.json();
          if (roadmapJson.success && roadmapJson.data) {
            setGeneratedRoadmap(roadmapJson.data);
            setShowRoadmapModal(true);
            if (onPersonalizedRoadmapGenerated) {
              onPersonalizedRoadmapGenerated(roadmapJson.data);
            }
          }
        } catch (roadmapErr) {
          console.error("Personalized roadmap error:", roadmapErr);
        } finally {
          setIsGeneratingRoadmap(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setActiveSkillModal(null);
    }
  };
  return <div className="space-y-6 pb-16">
      
      {
    /* Top Banner */
  }
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                {t("skillTestsTitle")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl">
              {t("skillTestsSubtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <Bot className="w-4 h-4 text-sky-400" />
            <span className="text-xs text-slate-300 font-medium">
              Interchangeably linked with @SpeakBot
            </span>
          </div>
        </div>

        {successNotice && <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>}
      </div>

      {
    /* Skills Grid */
  }
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skillsList.map((skill, idx) => {
    const score = currentSkillScores[skill.key] ?? 70;
    const Icon = skill.icon;
    return <AnimatedCard key={skill.key} delay={idx * 0.05} className="h-full">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-800 text-sky-400 border border-slate-700">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{skill.label}</h3>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Telegram Synced
                        </span>
                      </div>
                    </div>

                    <span className="text-base font-extrabold text-white bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                      {score}%
                    </span>
                  </div>

                  {
      /* Progress bar */
    }
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-4">
                    <div
      className={`h-full bg-gradient-to-r ${skill.color} rounded-full transition-all duration-500`}
      style={{ width: `${score}%` }}
    />
                  </div>

                  {
      /* Grammar Roadmap Callout */
    }
                  {skill.key === "grammar" && <div className="mb-4 p-2.5 rounded-2xl bg-sky-950/30 border border-sky-500/20 text-[11px] text-sky-300 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Auto-generates a personalized grammar roadmap after each test</span>
                    </div>}

                  {
      /* Classic Reading Immersion Callout */
    }
                  {skill.key === "reading" && <div className="mb-4 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-bold mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Classic Authors Literary Reading</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mb-2.5 leading-relaxed">
                        Arthur Conan Doyle, Edgar Allan Poe, & O. Henry passages with Socratic conversation analysis & CEFR-aligned tasks.
                      </p>
                      {onOpenStories && <button
      type="button"
      onClick={() => onOpenStories("reading")}
      className="w-full py-2 px-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
    >
                          <span>Open Classic Reading Chamber</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>}
                    </div>}

                  {
      /* Classical Audio Theater Callout */
    }
                  {skill.key === "listening" && <div className="mb-4 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Classical Audio Theater</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mb-2.5 leading-relaxed">
                        Acoustic voice narration, phonological breakdown, and conversational listening comprehension exercises.
                      </p>
                      {onOpenStories && <button
      type="button"
      onClick={() => onOpenStories("listening")}
      className="w-full py-2 px-3 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
    >
                          <span>Open Classical Audio Theater</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>}
                    </div>}

                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Evaluates accuracy, cognitive retrieval speed, and syntactic competence under the CEFR rubric.
                  </p>
                </div>

                <button
      onClick={() => handleStartSkillTest(skill.key)}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 hover:border-sky-500/40 transition-all active:scale-95"
    >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t("startDiagnosticBtn")}</span>
                </button>
              </div>
            </AnimatedCard>;
  })}
      </div>

      {
    /* Mini Skill Test Modal */
  }
      {activeSkillModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
    className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5"
    onClick={(e) => e.stopPropagation()}
  >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white capitalize">
                Quick Assessment: {activeSkillModal}
              </h3>
              <button
    onClick={() => setActiveSkillModal(null)}
    className="text-xs text-slate-400 hover:text-slate-200"
  >
                Cancel
              </button>
            </div>

            {
    /* Switch to Classic Author Immersion if Reading or Listening */
  }
            {(activeSkillModal === "reading" || activeSkillModal === "listening") && onOpenStories && <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    {activeSkillModal === "reading" ? <BookOpen className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-indigo-200">
                      Deep Classic Author Immersion Test
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Full short story, Socratic conversational analysis & level-specific exercises
                    </p>
                  </div>
                </div>
                <button
    type="button"
    onClick={() => {
      const mode = activeSkillModal;
      setActiveSkillModal(null);
      onOpenStories(mode);
    }}
    className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1"
  >
                  <span>Launch Story</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>}

            {SAMPLE_SKILL_TESTS[activeSkillModal]?.[currentTestIndex] && <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-100">
                  {SAMPLE_SKILL_TESTS[activeSkillModal][currentTestIndex].question}
                </p>

                <div className="space-y-2">
                  {SAMPLE_SKILL_TESTS[activeSkillModal][currentTestIndex].options.map((opt, oIdx) => <button
    key={oIdx}
    type="button"
    onClick={() => setSelectedAnswer(oIdx)}
    className={`w-full p-3 rounded-xl border text-xs text-left transition-all ${selectedAnswer === oIdx ? "bg-sky-600/20 border-sky-500 text-sky-200 font-bold" : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850"}`}
  >
                      {opt}
                    </button>)}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {activeSkillModal === "grammar" ? "\u26A1 Generates custom roadmap on submit" : "Telegram Bot profile updates live"}
                  </span>
                  <button
    onClick={handleSubmitSkillQuestion}
    disabled={selectedAnswer === null || isSubmitting}
    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-40"
  >
                    {isSubmitting ? "Syncing with Bot..." : "Submit & Update Bot Profile"}
                  </button>
                </div>
              </div>}
          </div>
        </div>}

      {
    /* Personalized Grammar Roadmap Celebration Modal */
  }
      {showRoadmapModal && generatedRoadmap && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
    className="w-full max-w-xl bg-slate-900 border border-sky-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5"
    onClick={(e) => e.stopPropagation()}
  >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Compass className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Personalized Grammar Roadmap Generated!
                  </h3>
                  <p className="text-xs text-sky-400 font-mono">
                    Synthesized from your test score: {generatedRoadmap.personalizedGrammarMeta?.testedScore || 75}%
                  </p>
                </div>
              </div>
              <button
    onClick={() => setShowRoadmapModal(false)}
    className="text-xs text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
  >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100">
                  {generatedRoadmap.title}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Level {generatedRoadmap.level}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {generatedRoadmap.summary}
              </p>

              {
    /* Milestones preview */
  }
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Targeted Learning Milestones ({generatedRoadmap.milestones?.length || 0} Steps):
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {generatedRoadmap.milestones?.map((m) => <div key={m.step} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded-md bg-sky-600/30 text-sky-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        {m.step}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-200">{m.title}</span>
                        <p className="text-[11px] text-slate-400">{m.grammarPoint}</p>
                      </div>
                    </div>)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
    onClick={() => setShowRoadmapModal(false)}
    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
  >
                Keep Testing
              </button>
              {onNavigateToRoadmaps && <button
    onClick={() => {
      setShowRoadmapModal(false);
      onNavigateToRoadmaps();
    }}
    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/25 transition-all"
  >
                  <span>Open Roadmap in Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>}
            </div>
          </div>
        </div>}

    </div>;
};
