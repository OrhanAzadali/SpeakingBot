import { useState, useEffect, useTransition, useMemo, useCallback } from "react";
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

// ─── Universal user-id resolver (Telegram WebApp → localStorage → default) ───
// ─── Universal user-id resolver (Telegram WebApp → localStorage → default) ───
function getTelegramUserId() {
  try {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser?.id) {
      const id = String(tgUser.id);
      localStorage.setItem("userId", id);
      return id;
    }
  } catch { /* ignore */ }
  return localStorage.getItem("userId") || "default-user";
}

// ─── fetch wrapper: auto-injects userId into GET query and POST/PUT/DELETE body ───
async function apiFetch(url, opts = {}) {
  const userId = getTelegramUserId();
  const method = (opts.method || "GET").toUpperCase();

  let finalUrl = url;
  const finalOpts = { ...opts };

  if (method === "GET") {
    const sep = url.includes("?") ? "&" : "?";
    if (!url.includes("userId=")) {
      finalUrl = `${url}${sep}userId=${encodeURIComponent(userId)}`;
    }
  } else {
    let body = {};
    try {
      if (typeof opts.body === "string") body = JSON.parse(opts.body || "{}");
      else if (opts.body && typeof opts.body === "object") body = { ...opts.body };
    } catch { body = {}; }
    if (!body.userId) body.userId = userId;
    finalOpts.body = JSON.stringify(body);
    finalOpts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  }

  return fetch(finalUrl, finalOpts);
}

// ═══════════════════════════════════════════════════════════════
// IDENTITY RESOLUTION — pluggable, multi-provider
//
// Priority order:
//   1. Telegram Mini App  initDataUnsafe.user.id  (trusted by Telegram)
//   2. localStorage.userId (from any previous login)
//   3. null → render <LoginGate />
//
// To add a future provider (Google, Apple, JWT cookie):
//   • check its token below,
//   • if found, POST to /api/auth/{provider},
//   • persist userId to localStorage,
//   • return { userId, source, verified: true }.
// No downstream code needs to change.
// ═══════════════════════════════════════════════════════════════
function useIdentity() {
  const [identity, setIdentity] = useState(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) {
        const id = String(tg.initDataUnsafe.user.id);
        return { userId: id, source: "telegram-miniapp", verified: true };
      }
    } catch { /* ignore */ }

    try {
      const stored = localStorage.getItem("userId");
      const src = localStorage.getItem("userIdSource") || "unknown";
      if (stored && stored !== "default-user") {
        return { userId: stored, source: src, verified: src === "telegram-widget" };
      }
    } catch { /* ignore */ }

    return null;
  });

  // If we discover Mini App context AFTER initial state, sync it.
  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) {
        const id = String(tg.initDataUnsafe.user.id);
        if (identity?.userId !== id) {
          localStorage.setItem("userId", id);
          localStorage.setItem("userIdSource", "telegram-miniapp");
          setIdentity({ userId: id, source: "telegram-miniapp", verified: true });
        }
      }
    } catch { /* ignore */ }
  }, [identity?.userId]);

  const loginWithTelegramWidget = useCallback(async (widgetPayload) => {
    const res = await fetch("/api/auth/telegram-widget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(widgetPayload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Login failed");
    localStorage.setItem("userId", json.userId);
    localStorage.setItem("userIdSource", "telegram-widget");
    setIdentity({ userId: json.userId, source: "telegram-widget", verified: true });
    return json;
  }, []);

  const logout = useCallback(() => {
    // Inside Mini App — Telegram identity is authoritative, don't clear
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) return;
    } catch { /* ignore */ }
    localStorage.removeItem("userId");
    localStorage.removeItem("userIdSource");
    setIdentity(null);
  }, []);

  return { identity, loginWithTelegramWidget, logout };
}

// ═══════════════════════════════════════════════════════════════
// LOGIN GATE — shown only when no identity is available AND
// user is outside Telegram Mini App.
// Offers: (A) "Open in Telegram" button, (B) Telegram Login Widget.
// ═══════════════════════════════════════════════════════════════
function LoginGate({ onTelegramAuth }) {
  const [botInfo, setBotInfo] = useState(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: fetch bot username (non-secret) so the widget can render
  useEffect(() => {
    let cancelled = false;
    fetch("/api/config/public")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBotInfo(d); })
      .catch(() => { if (!cancelled) setError("Не удалось получить конфигурацию сервера"); });
    return () => { cancelled = true; };
  }, []);

  // Step 2: load widget once bot username is known
  useEffect(() => {
    if (!botInfo?.botUsername) return;

    window.onTelegramAuth = async (user) => {
      try {
        await onTelegramAuth(user);
      } catch (e) {
        setError(e?.message || "Ошибка входа");
      }
    };

    const container = document.getElementById("tg-login-widget-slot");
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botInfo.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.onload = () => setWidgetReady(true);
    script.onerror = () => setError("Не удалось загрузить Telegram-виджет");
    container.appendChild(script);

    return () => {
      try { delete window.onTelegramAuth; } catch { /* ignore */ }
    };
  }, [botInfo?.botUsername, onTelegramAuth]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        <div className="text-6xl">🤖</div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{botInfo?.appName || "SpeakBot"}</h1>
          <p className="text-sm text-slate-400">Interactive AI Language Engine</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-slate-300">Выберите способ входа:</p>

          <a
            href={botInfo?.botLink || "https://t.me/Speaking213_bot"}

            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-sky-600/20"
          >
            <span>📱</span>
            <span>Открыть в Telegram</span>
          </a>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span className="text-xs text-slate-500 font-medium">или</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          <div id="tg-login-widget-slot" className="flex justify-center min-h-[50px] items-center">
            {!botInfo && !error && <div className="text-xs text-slate-500">Загрузка…</div>}
            {botInfo && !widgetReady && !error && (
              <div className="text-xs text-slate-500">Загрузка виджета…</div>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-lg p-2">
              {error}
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800 pt-4">
          💡 Вход сохраняется на этом устройстве. В дальнейшем вы будете автоматически авторизованы.
        </p>
      </div>
    </div >
  );
}

function MainApp() {

  const { identity, loginWithTelegramWidget } = useIdentity();

  const [isTabPending, startTabTransition] = useTransition();

  const handleTabSwitch = (tab) => {
    startTabTransition(() => {
      setActiveTab(tab);
    });
  };
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

  const activeTheme = useMemo(
    () => getSafeThemeRuleset(themeId, rotationIndex),
    [themeId, rotationIndex]
  );

  const themeColors = useMemo(
    () => activeTheme?.colors || {},
    [activeTheme]
  );

  // Persist theme selection and sync with ruleset cache
  useEffect(() => {
    persistThemeRuleset(themeId, rotationIndex, activeTheme);
  }, [themeId, rotationIndex, activeTheme]);

  const { t } = useTranslation();

  const [userProfile, setUserProfile] = useState({
    userId: identity?.userId || "default-user",
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
  const [isMiniAppMode, setIsMiniAppMode] = useState(false);
  const [storyLaunchConfig, setStoryLaunchConfig] = useState({ mode: "all" });
  const [savedVocabulary, setSavedVocabulary] = useState([]);
  const [allVocabularies, setAllVocabularies] = useState({});
  const [countsByLanguage, setCountsByLanguage] = useState({});
  const [activeTab, setActiveTab] = useState("home");
  const [activeGameId, setActiveGameId] = useState(null);
  // Sync identity.userId → userProfile (covers post-login transition)
  useEffect(() => {
    if (identity?.userId && userProfile.userId !== identity.userId) {
      setUserProfile((prev) => ({ ...prev, userId: identity.userId }));
    }
  }, [identity?.userId]);

  // Читаем URL-параметры при загрузке (Telegram WebApp передаёт query)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const gameParam = params.get('game');

    if (tabParam && ['home', 'roadmaps', 'games', 'grammar-pdfs', 'saved-vocabulary', 'stories', 'placement-test', 'skill-tests', 'nlp-analyzer'].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    if (gameParam) {
      setActiveTab('games');
      setActiveGameId(gameParam);
    }
  }, []); // один раз при загрузке

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

  const [roadmaps, setRoadmaps] = useState(() => {
    try {
      const cached = localStorage.getItem("speakbot_roadmaps");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return INITIAL_ROADMAPS;
  });

  const [grammarPdfs, setGrammarPdfs] = useState(() => {
    try {
      const cached = localStorage.getItem("speakbot_grammar_pdfs");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return INITIAL_GRAMMAR_PDFS;
  });

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalType, setAiModalType] = useState("roadmap");
  const [inspectedToken, setInspectedToken] = useState(null);

  useEffect(() => {
    const fetchPersistedGuidesAndRoadmaps = async () => {
      try {
        const [roadmapsRes, grammarRes] = await Promise.all([
          apiFetch("/api/user/roadmaps").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          apiFetch("/api/user/grammar-pdfs").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        if (roadmapsRes?.success && Array.isArray(roadmapsRes.data) && roadmapsRes.data.length > 0) {
          setRoadmaps(roadmapsRes.data);
          try {
            localStorage.setItem("speakbot_roadmaps", JSON.stringify(roadmapsRes.data));
          } catch { }
        }

        if (grammarRes?.success && Array.isArray(grammarRes.data) && grammarRes.data.length > 0) {
          setGrammarPdfs(grammarRes.data);
          try {
            localStorage.setItem("speakbot_grammar_pdfs", JSON.stringify(grammarRes.data));
          } catch { }
        }
      } catch (err) {
        console.warn("Could not sync persisted guides from server, using local cache:", err);
      }
    };

    fetchPersistedGuidesAndRoadmaps();
  }, []);

  const syncWithTelegramBot = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch("/api/bot/sync");
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
        const res = await apiFetch("/api/user/profile");
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
  }, []);
  // ─── Re-fetch profile when the user returns to Mini App (bot may have changed it) ───
  useEffect(() => {
    const refetch = async () => {
      try {
        const res = await apiFetch("/api/user/profile");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          setUserProfile((prev) => normalizeUserProfile(json.data, prev));
          if (json.data.vocabularyByLanguage) {
            setAllVocabularies(json.data.vocabularyByLanguage);
          }
        }
      } catch { /* silent */ }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);

    // Telegram WebApp provides its own activation event when the mini-app is re-opened
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.onEvent === "function") {
      try { tg.onEvent("activated", refetch); } catch { /* ignore */ }
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, []);
  // Реактивная перезагрузка словаря при смене активного targetLanguage.
  // Без этого savedVocabulary/savedVocabulary.allVocabularies содержат данные СТАРОГО языка.
  useEffect(() => {
    const fetchVocab = async () => {
      try {
        const res = await apiFetch(`/api/user/vocabulary?targetLanguage=${encodeURIComponent(userProfile.targetLanguage || "English")}`);
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
  }, [userProfile.targetLanguage]);

  const handleSaveToVocabulary = async (termObj) => {
    if (!termObj || !termObj.word) return;
    const targetL = termObj.targetLanguage || userProfile.targetLanguage || "English";
    const payload = {
      ...termObj,
      targetLanguage: targetL,
    };
    try {
      const res = await apiFetch("/api/user/vocabulary", {
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
      const res = await apiFetch("/api/user/vocabulary", {
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
      const res = await apiFetch("/api/user/mediator-language", {
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
      const res = await apiFetch("/api/user/target-language", {
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
    setRoadmaps((prev) => {
      const updated = [newRoadmap, ...prev];
      try {
        localStorage.setItem("speakbot_roadmaps", JSON.stringify(updated));
      } catch { }
      return updated;
    });

    apiFetch("/api/user/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userProfile.userId, roadmap: newRoadmap })
    }).catch((e) => console.warn("Could not persist roadmap to server:", e));
  };

  const handleNewGrammarGenerated = (newGuide) => {
    setGrammarPdfs((prev) => {
      const updated = [newGuide, ...prev];
      try {
        localStorage.setItem("speakbot_grammar_pdfs", JSON.stringify(updated));
      } catch { }
      return updated;
    });

    apiFetch("/api/user/grammar-pdfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userProfile.userId, guide: newGuide })
    }).catch((e) => console.warn("Could not persist grammar guide to server:", e));
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
      await apiFetch("/api/user/sync-game-xp", {
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

  const handleCycleTheme = () => {
    const currentIndex = PRESET_THEMES.findIndex((t) => t.id === themeId);
    const nextTheme = PRESET_THEMES[(currentIndex + 1) % PRESET_THEMES.length];
    setThemeId(nextTheme.id);
    try {
      localStorage.setItem("spk_theme_id", nextTheme.id);
    } catch { }
  };
  // ─── Login gate ───
  // All hooks are declared above, so early-return here is safe.
  if (!identity) {
    return <LoginGate onTelegramAuth={loginWithTelegramWidget} />;
  }

  return (<TelegramMiniAppFrame
    isMiniAppMode={isMiniAppMode}
    onExitMiniApp={() => setIsMiniAppMode(false)}
    telegramUsername={userProfile.telegramUsername}
    onTriggerSync={syncWithTelegramBot}
  >


    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white flex flex-col font-sans">

      {
        /* Header with full language toggling & Telegram Bot sync status */
      }
      <Header
        userProfile={userProfile}
        onCycleTheme={handleCycleTheme}
        onUpdateMediatorLanguage={handleUpdateMediatorLanguage}
        onUpdateTargetLanguage={handleUpdateTargetLanguage}
        onOpenPlacementTest={() => setActiveTab("placement-test")}
        activeTab={activeTab}
        setActiveTab={handleTabSwitch}
        isMiniAppMode={isMiniAppMode}
        setIsMiniAppMode={setIsMiniAppMode}
        isSyncing={isSyncing}
        setId={setThemeId}
        themeId={themeId}
        rotationIndex={rotationIndex}
        setRotationIndex={setRotationIndex}
        themeColors={themeColors}
        activeTheme={activeTheme}
        onOpenTestModal={() => setActiveTab("placement-test")}
      />
      {
        /* Main Workspace Body */
      }

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">

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
            initialGameId={activeGameId}
            onCloseGame={handleCloseGame} />
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
            mediatorLanguage={userProfile.mediatorLanguage}
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
                await apiFetch("/api/stories/progress", {
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
        savedVocabulary={savedVocabulary}
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
