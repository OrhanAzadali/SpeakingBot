import { useState, useEffect } from "react";
import { TranslationProvider, useTranslation } from "./i18n/useTranslation";
import { Header } from "./components/Header";
import { RoadmapsPage } from "./components/RoadmapsPage";
import { GrammarPDFPage } from "./components/GrammarPDFPage";
import { PlacementTestView } from "./components/PlacementTestView";
import { SkillTestsView } from "./components/SkillTestsView";
import { NLPAnalyzerTab } from "./components/NLPAnalyzerTab";
import { ClassicStoriesView } from "./components/ClassicStoriesView";
import { GamesHub } from "./components/GamesHub";
import { AIGeneratorModal } from "./components/AIGeneratorModal";
import { NLPInspectorModal } from "./components/NLPInspectorModal";
import { TelegramMiniAppFrame } from "./components/TelegramMiniAppFrame";
import {
  INITIAL_ROADMAPS,
  INITIAL_GRAMMAR_PDFS,
  DIAGNOSTIC_PLACEMENT_QUESTIONS
} from "./data/initialData";
function MainApp() {
  const { t } = useTranslation();
  const [userProfile, setUserProfile] = useState({
    userId: "usr_84920482",
    telegramUsername: "@speakbot_learner",
    currentLevel: "B1",
    targetLanguage: "English",
    mediatorLanguage: "az",
    overallScore: 68,
    skillScores: {
      grammar: 74,
      vocabulary: 65,
      reading: 80,
      listening: 70,
      speaking: 62
    },
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("roadmaps");
  const [isMiniAppMode, setIsMiniAppMode] = useState(false);
  const [storyLaunchConfig, setStoryLaunchConfig] = useState({ mode: "all" });
  const normalizeUserProfile = (data, prev) => {
    const rawAny = data;
    const grammar = data.skillScores?.grammar ?? rawAny?.skillLevels?.grammar?.score ?? prev.skillScores?.grammar ?? 74;
    const vocabulary = data.skillScores?.vocabulary ?? rawAny?.skillLevels?.vocabulary?.score ?? prev.skillScores?.vocabulary ?? 65;
    const reading = data.skillScores?.reading ?? rawAny?.skillLevels?.reading?.score ?? prev.skillScores?.reading ?? 80;
    const listening = data.skillScores?.listening ?? rawAny?.skillLevels?.listening?.score ?? prev.skillScores?.listening ?? 70;
    const speaking = data.skillScores?.speaking ?? rawAny?.skillLevels?.speaking?.score ?? prev.skillScores?.speaking ?? 62;
    return {
      ...prev,
      ...data,
      skillScores: {
        grammar,
        vocabulary,
        reading,
        listening,
        speaking
      }
    };
  };
  const [roadmaps, setRoadmaps] = useState(INITIAL_ROADMAPS);
  const [grammarPdfs, setGrammarPdfs] = useState(INITIAL_GRAMMAR_PDFS);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalType, setAiModalType] = useState("roadmap");
  const [inspectedToken, setInspectedToken] = useState(null);
  useEffect(() => {
    const fetchProfile = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setUserProfile((prev) => normalizeUserProfile(json.data, prev));
          }
        }
      } catch (err) {
        console.warn("Backend profile fetch note (using active state):", err);
      } finally {
        setIsSyncing(false);
      }
    };
    fetchProfile();
  }, []);
  const handleUpdateMediatorLanguage = async (newMediator) => {
    setUserProfile((prev) => ({
      ...prev,
      mediatorLanguage: newMediator
    }));
    setIsSyncing(true);
    try {
      const res = await fetch("/api/user/mediator-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediatorLanguage: newMediator })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setUserProfile((prev) => normalizeUserProfile(data.data, prev));
        }
      }
    } catch (err) {
      console.error("Failed to sync mediator language to backend:", err);
    } finally {
      setIsSyncing(false);
    }
  };
  const handleUpdateTargetLanguage = async (newTarget) => {
    setUserProfile((prev) => ({
      ...prev,
      targetLanguage: newTarget
    }));
    setIsSyncing(true);
    try {
      const res = await fetch("/api/user/target-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: newTarget })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setUserProfile((prev) => normalizeUserProfile(data.data, prev));
        }
      }
    } catch (err) {
      console.error("Failed to sync target language to backend:", err);
    } finally {
      setIsSyncing(false);
    }
  };
  const handlePlacementTestCompleted = (newLevel, newScore) => {
    setUserProfile((prev) => ({
      ...prev,
      currentLevel: newLevel,
      overallScore: newScore
    }));
  };
  const handleSkillUpdated = (newSkills) => {
    setUserProfile((prev) => ({
      ...prev,
      skillScores: newSkills
    }));
  };
  const handleGainXp = (amount = 1) => {
    setUserProfile((prev) => {
      const currentVocab = prev.skillScores?.vocabulary ?? 65;
      const nextVocab = Math.min(100, currentVocab + amount);
      return {
        ...prev,
        overallScore: Math.min(100, (prev.overallScore ?? 68) + Math.round(amount / 2)),
        skillScores: {
          ...prev.skillScores,
          vocabulary: nextVocab
        }
      };
    });
  };
  const handleOpenAiGenerator = (type) => {
    setAiModalType(type);
    setIsAiModalOpen(true);
  };
  const handleNewRoadmapGenerated = (newRoadmap) => {
    setRoadmaps((prev) => [newRoadmap, ...prev]);
  };
  const handleNewGrammarGenerated = (newGuide) => {
    setGrammarPdfs((prev) => [newGuide, ...prev]);
  };
  return <TelegramMiniAppFrame
    isMiniAppMode={isMiniAppMode}
    onExitMiniApp={() => setIsMiniAppMode(false)}
    telegramUsername={userProfile.telegramUsername}
  >
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white flex flex-col font-sans">
        
        {
    /* Header with full language toggling & Telegram Bot sync status */
  }
        <Header
    userProfile={userProfile}
    onUpdateMediatorLanguage={handleUpdateMediatorLanguage}
    onUpdateTargetLanguage={handleUpdateTargetLanguage}
    onOpenPlacementTest={() => setActiveTab("placement-test")}
    activeTab={activeTab}
    setActiveTab={setActiveTab}
    isMiniAppMode={isMiniAppMode}
    setIsMiniAppMode={setIsMiniAppMode}
    isSyncing={isSyncing}
  />

        {
    /* Main Workspace Body */
  }
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {activeTab === "roadmaps" && <RoadmapsPage
    roadmaps={roadmaps}
    onOpenAiGenerator={() => handleOpenAiGenerator("roadmap")}
    onSelectToken={(token) => setInspectedToken(token)}
  />}

          {activeTab === "games" && <GamesHub
    targetLanguage={userProfile.targetLanguage}
    mediatorLanguage={userProfile.mediatorLanguage}
    onSelectToken={(token) => setInspectedToken(token)}
    onGainXp={handleGainXp}
  />}

          {activeTab === "grammar-pdfs" && <GrammarPDFPage
    grammarPdfs={grammarPdfs}
    onOpenAiGenerator={() => handleOpenAiGenerator("grammar")}
    onSelectToken={(token) => setInspectedToken(token)}
  />}

          {activeTab === "stories" && <ClassicStoriesView
    userLevel={userProfile.currentLevel}
    targetLanguage={userProfile.targetLanguage}
    onSelectToken={(token) => setInspectedToken(token)}
    initialMode={storyLaunchConfig.mode}
    initialSelectedStoryId={storyLaunchConfig.storyId}
    onStoryCompleted={async (result) => {
      const currentScore = userProfile.skillScores?.[result.skill] ?? 70;
      const newScore = Math.min(100, Math.max(20, currentScore + result.scoreDelta));
      const updatedSkillScores = {
        ...userProfile.skillScores,
        [result.skill]: newScore
      };
      setUserProfile((prev) => ({
        ...prev,
        skillScores: updatedSkillScores
      }));
      try {
        await fetch("/api/stories/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: result.storyId,
            mode: result.mode,
            score: result.score,
            completedSentencesCount: 6,
            answersCount: 3
          })
        });
      } catch (err) {
        console.error("Failed to sync story progress:", err);
      }
    }}
  />}

          {activeTab === "placement-test" && <PlacementTestView
    questions={DIAGNOSTIC_PLACEMENT_QUESTIONS}
    userProfile={userProfile}
    onTestCompleted={handlePlacementTestCompleted}
    onGoToRoadmaps={() => setActiveTab("roadmaps")}
  />}

          {activeTab === "skill-tests" && <SkillTestsView
    userProfile={userProfile}
    onSkillUpdated={handleSkillUpdated}
    onPersonalizedRoadmapGenerated={handleNewRoadmapGenerated}
    onOpenStories={(mode, storyId) => {
      setStoryLaunchConfig({ mode, storyId });
      setActiveTab("stories");
    }}
    onNavigateToRoadmaps={() => setActiveTab("roadmaps")}
  />}

          {activeTab === "nlp-analyzer" && <NLPAnalyzerTab
    mediatorLanguage={userProfile.mediatorLanguage}
    onSelectToken={(token) => setInspectedToken(token)}
  />}
        </main>

        {
    /* AI Generation Modal */
  }
        <AIGeneratorModal
    isOpen={isAiModalOpen}
    onClose={() => setIsAiModalOpen(false)}
    type={aiModalType}
    userLevel={userProfile.currentLevel}
    mediatorLanguage={userProfile.mediatorLanguage}
    onGeneratedRoadmap={handleNewRoadmapGenerated}
    onGeneratedGrammar={handleNewGrammarGenerated}
  />

        {
    /* NLP Token Linguistic Inspector */
  }
        <NLPInspectorModal
    token={inspectedToken}
    onClose={() => setInspectedToken(null)}
  />

      </div>
    </TelegramMiniAppFrame>;
}
export default function App() {
  return <TranslationProvider>
      <MainApp />
    </TranslationProvider>;
}
