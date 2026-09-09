import { useState, useEffect } from "react";
import { TranslationProvider, useTranslation } from "./i18n/useTranslation";
import { Header } from "./components/Header";
import { HomePage } from "./components/HomePage";
import { RoadmapsPage } from "./components/RoadmapsPage";
import { GrammarPDFPage } from "./components/GrammarPDFPage";
import { PlacementTestView } from "./components/PlacementTestView";
import { SkillTestsView } from "./components/SkillTestsView";
import { NLPAnalyzerTab } from "./components/NLPAnalyzerTab";
import { ClassicStoriesView } from "./components/ClassicStoriesView";
import { SavedVocabularyPage } from "./components/SavedVocabularyPage";
import { AIGeneratorModal } from "./components/AIGeneratorModal";
import { NLPInspectorModal } from "./components/NLPInspectorModal";
import { GamesHub } from "./components/GamesHub";
import { TelegramMiniAppFrame } from "./components/TelegramMiniAppFrame";
import { SUPPORTED_UI_LANGUAGES, fetchAiUiTranslation, getEffectiveUiDictionary } from "./utils/uiTranslations.js";
import { PRESET_THEMES } from "./utils/colorHarmonizer.js";
import { getSafeThemeRuleset, persistThemeRuleset } from "./utils/themeRulesetCache.js";

import {
  INITIAL_ROADMAPS,
  INITIAL_GRAMMAR_PDFS,
  DIAGNOSTIC_PLACEMENT_QUESTIONS,
  getDiagnosticQuestionsByLanguage
} from "./data/initialData";
function MainApp() {

  // Dynamic Color Harmonizer State
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem("spk_theme_id") || "golden_ai";
    } catch {
      return "golden_ai";
    }
  });
  const [rotationIndex, setRotationIndex] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);

  // Auto-cycle theme colors smoothly from time to time (every 28 seconds)
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setRotationIndex((prev) => (prev + 1) % 8);
    }, 28000);
    return () => clearInterval(interval);
  }, [autoCycle]);

  const activeTheme = getSafeThemeRuleset(themeId, rotationIndex);
  const themeColors = activeTheme.colors || PRESET_THEMES[themeId].colors;

  // Persist theme selection and sync with ruleset cache
  useEffect(() => {
    persistThemeRuleset(themeId, rotationIndex, activeTheme);
  }, [themeId, rotationIndex, activeTheme]);

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
  const [activeTab, setActiveTab] = useState("home");
  const [isMiniAppMode, setIsMiniAppMode] = useState(false);
  const [storyLaunchConfig, setStoryLaunchConfig] = useState({ mode: "all" });
  const [savedVocabulary, setSavedVocabulary] = useState([]);
  const [allVocabularies, setAllVocabularies] = useState({});
  const [countsByLanguage, setCountsByLanguage] = useState({});
  const [activeGameId, setActiveGameId] = useState(null);

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

  const syncWithTelegramBot = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/bot/sync");
      if (res.ok) {
        const json = await res.json();
        if (json.synced && json.userState) {
          setUserProfile((prev) => normalizeUserProfile(json.userState, prev));
          if (json.userState.vocabularyByLanguage) {
            setAllVocabularies(json.userState.vocabularyByLanguage);
            const activeLang = json.userState.targetLanguage || userProfile.targetLanguage || "English";
            setSavedVocabulary(json.userState.vocabularyByLanguage[activeLang] || []);
          }
        }
      }
    } catch (err) {
      console.warn("Telegram bot sync warning:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setUserProfile((prev) => normalizeUserProfile(json.data, prev));
            if (json.data.vocabularyByLanguage) {
              setAllVocabularies(json.data.vocabularyByLanguage);
            }
          }
        }
      } catch (err) {
        console.warn("Backend profile fetch note (using active state):", err);
      } finally {
        setIsSyncing(false);
      }
    };
    fetchProfile();

    const fetchVocab = async () => {
      try {
        const res = await fetch(`/api/user/vocabulary?targetLanguage=${encodeURIComponent(userProfile.targetLanguage || "English")}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            if (Array.isArray(json.data)) {
              setSavedVocabulary(json.data);
            }
            if (json.allVocabularies) {
              setAllVocabularies(json.allVocabularies);
            }
            if (json.countsByLanguage) {
              setCountsByLanguage(json.countsByLanguage);
            }
          }
        }
      } catch (err) {
        console.warn("Vocabulary fetch error:", err);
      }
    };
    fetchVocab();
  }, []);

  const handleSaveToVocabulary = async (termObj) => {
    if (!termObj || !termObj.word) return;
    const targetL = termObj.targetLanguage || userProfile.targetLanguage || "English";
    const payload = {
      ...termObj,
      targetLanguage: targetL,
    };
    try {
      const res = await fetch("/api/user/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Merge with existing state to avoid overwriting
          setSavedVocabulary((prev) => {
            // Get existing words for this language
            const existingForLang = prev.filter(v => (v.targetLanguage || "English").toLowerCase() === targetL.toLowerCase());
            // Remove duplicate of new word
            const newWord = payload;
            const withoutDup = existingForLang.filter(v => v.word.toLowerCase() !== newWord.word.toLowerCase());
            // Combine all other language words + updated language list
            const otherLangs = prev.filter(v => (v.targetLanguage || "English").toLowerCase() !== targetL.toLowerCase());
            return [...otherLangs, ...withoutDup, newWord];
          });
          // Also update allVocabularies if needed
          if (json.allVocabularies) {
            setAllVocabularies(json.allVocabularies);
          }
          if (json.countsByLanguage) {
            setCountsByLanguage(json.countsByLanguage);
          }
        }
      }
    } catch (err) {
      console.error("Failed to save word to vocabulary:", err);
    }
  };

  const handleDeleteFromVocabulary = async (id, word, targetLanguage) => {
    const targetL = targetLanguage || userProfile.targetLanguage || "English";
    try {
      const res = await fetch("/api/user/vocabulary", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, word, targetLanguage: targetL }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          if (Array.isArray(json.data)) {
            setSavedVocabulary(json.data);
          }
          if (json.allVocabularies) {
            setAllVocabularies(json.allVocabularies);
          }
          if (json.countsByLanguage) {
            setCountsByLanguage(json.countsByLanguage);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete word from vocabulary:", err);
    }
  };
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
        if (data.success) {
          if (data.data) {
            setUserProfile((prev) => normalizeUserProfile(data.data, prev));
          }
          if (data.vocabulary) {
            setSavedVocabulary(data.vocabulary);
          }
          if (data.allVocabularies) {
            setAllVocabularies(data.allVocabularies);
          }
          if (data.countsByLanguage) {
            setCountsByLanguage(data.countsByLanguage);
          }
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

  const handleGainGameXp = async (gameType, xp, score) => {
    const currentVocab = userProfile.skillScores?.vocabulary ?? 65;
    const newVocab = Math.min(100, currentVocab + Math.max(1, Math.round((score || 10) / 25)));
    const updatedSkillScores = {
      ...userProfile.skillScores,
      vocabulary: newVocab,
    };
    setUserProfile((prev) => ({
      ...prev,
      skillScores: updatedSkillScores,
      overallScore: Math.min(100, (prev.overallScore || 68) + 1),
    }));

    try {
      await fetch("/api/user/sync-game-xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType, xp, score }),
      });
    } catch (err) {
      console.warn("Game XP sync note:", err);
    }
  };


  const handleLaunchGame = (gameId) => {
    setActiveGameId(gameId);
    setActiveTab("games");
  };

  const handleCloseGame = () => {
    setActiveGameId(null);
  };

  return (
    <TelegramMiniAppFrame
      isMiniAppMode={isMiniAppMode}
      onExitMiniApp={() => setIsMiniAppMode(false)}
      telegramUsername={userProfile.telegramUsername}
      onTriggerSync={syncWithTelegramBot}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white flex flex-col font-sans" style={{ color: themeColors.grammar.hex }}>

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
          setId={setThemeId}
        />

        {
          /* Main Workspace Body */
        }

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6"
          style={{ color: themeColors.grammar?.hex }}
        >

          {activeTab === "home" && (
            <HomePage
              userProfile={userProfile}
              roadmaps={roadmaps}
              grammarPdfs={grammarPdfs}
              savedVocabulary={savedVocabulary}
              allVocabularies={allVocabularies}
              countsByLanguage={countsByLanguage}
              onNavigateTab={setActiveTab}
              onLaunchGame={handleLaunchGame}
              onStartPlacementTest={() => setActiveTab("placement-test")}
              onLaunchStory={(mode, storyId) => {
                setStoryLaunchConfig({ mode, storyId });
                setActiveTab("stories");
              }}
              onSaveToVocabulary={handleSaveToVocabulary}
              onDeleteFromVocabulary={handleDeleteFromVocabulary}
              onUpdateTargetLanguage={handleUpdateTargetLanguage}
              onSelectToken={(token) => setInspectedToken(token)}
              themeColors={themeColors}
            />
          )}

          {activeTab === "roadmaps" && (
            <RoadmapsPage
              roadmaps={roadmaps}
              onOpenAiGenerator={() => handleOpenAiGenerator("roadmap")}
              onSelectToken={(token) => setInspectedToken(token)}
              themeColors={themeColors}
            />
          )}

          {activeTab === "games" && (
            <GamesHub
              targetLanguage={userProfile.targetLanguage}
              mediatorLanguage={userProfile.mediatorLanguage}
              onGainXp={handleGainGameXp}
              onSaveToVocabulary={handleSaveToVocabulary}
              onSelectToken={(token) => setInspectedToken(token)}
              asSection={false}
              themeColors={themeColors}
            />
          )}

          {activeTab === "grammar-pdfs" && (
            <GrammarPDFPage
              grammarPdfs={grammarPdfs}
              onOpenAiGenerator={() => handleOpenAiGenerator("grammar")}
              onSelectToken={(token) => setInspectedToken(token)}
              onSaveToVocabulary={handleSaveToVocabulary}
              savedVocabulary={savedVocabulary}
            />
          )}

          {activeTab === "saved-vocabulary" && (
            <SavedVocabularyPage
              userProfile={userProfile}
              savedVocabulary={savedVocabulary}
              allVocabularies={allVocabularies}
              countsByLanguage={countsByLanguage}
              onSaveToVocabulary={handleSaveToVocabulary}
              onDeleteFromVocabulary={handleDeleteFromVocabulary}
              onUpdateTargetLanguage={handleUpdateTargetLanguage}
              onSelectToken={(token) => setInspectedToken(token)}
              onTriggerSync={syncWithTelegramBot}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === "stories" && (
            <ClassicStoriesView
              userLevel={userProfile.currentLevel}
              targetLanguage={userProfile.targetLanguage}
              savedVocabulary={savedVocabulary}
              allVocabularies={allVocabularies}
              onSelectToken={(token) => setInspectedToken(token)}
              onSaveToVocabulary={handleSaveToVocabulary}
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
            />
          )}

          {activeTab === "placement-test" && (
            <PlacementTestView
              questions={getDiagnosticQuestionsByLanguage(userProfile.targetLanguage)}
              userProfile={userProfile}
              onTestCompleted={handlePlacementTestCompleted}
              onGoToRoadmaps={() => setActiveTab("roadmaps")}
              onExitTest={() => setActiveTab("home")}
            />
          )}

          {activeTab === "skill-tests" && (
            <SkillTestsView
              userProfile={userProfile}
              onSkillUpdated={handleSkillUpdated}
              onPersonalizedRoadmapGenerated={handleNewRoadmapGenerated}
              onOpenStories={(mode, storyId) => {
                setStoryLaunchConfig({ mode, storyId });
                setActiveTab("stories");
              }}
              onNavigateToRoadmaps={() => setActiveTab("roadmaps")}
            />
          )}

          {activeTab === "nlp-analyzer" && (
            <NLPAnalyzerTab
              targetLanguage={userProfile.targetLanguage}
              mediatorLanguage={userProfile.mediatorLanguage}
              onSelectToken={(token) => setInspectedToken(token)}
            />
          )}

        </main>

        {/* AI Generation Modal */}
        <AIGeneratorModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          type={aiModalType}
          userLevel={userProfile.currentLevel}
          targetLanguage={userProfile.targetLanguage}
          mediatorLanguage={userProfile.mediatorLanguage}
          onGeneratedRoadmap={handleNewRoadmapGenerated}
          onGeneratedGrammar={handleNewGrammarGenerated}
        />

        {/* NLP Token Linguistic Inspector */}
        <NLPInspectorModal
          token={inspectedToken}
          onClose={() => setInspectedToken(null)}
          targetLanguage={userProfile.targetLanguage}
          onSaveToVocabulary={handleSaveToVocabulary}
        />

      </div>
    </TelegramMiniAppFrame>
  );
}
export default function App() {
  return <TranslationProvider>
    <MainApp />
  </TranslationProvider>;
}
