import { useState, useEffect, useRef } from "react";
import { CLASSIC_STORIES } from "../data/classicStoriesData";
import { useTranslation } from "../i18n/useTranslation";
import {
  BookOpen,
  Headphones,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  ChevronRight,
  ArrowLeft,
  Flame,
  Award,
  Feather,
  Layers,
  Clock,
  Compass,
  Info,
  Check,
  Bot,
  Upload,
  FileText,
  Plus,
  Trash2,
  Sunrise,
  Sun,
  Moon,
  RefreshCw,
  AlertCircle,
  BookMarked
} from "lucide-react";
import { SaveToVocabButton } from "./SaveToVocabButton";

export const ClassicStoriesView = ({
  userLevel = "B1",
  targetLanguage = "English",
  onSelectToken,
  onStoryCompleted,
  onSaveToVocabulary,
  savedVocabulary = [],
  allVocabularies = {},
  initialSelectedStoryId,
  initialMode = "all"
}) => {
  const { t, mediatorLanguage } = useTranslation();
  const [filterMode, setFilterMode] = useState(initialMode);
  const [selectedSentence, setSelectedSentence] = useState(null);
  const [socraticInput, setSocraticInput] = useState('');
  const [socraticMessages, setSocraticMessages] = useState([]); // {role: 'user'|'assistant', text}
  const [customStories, setCustomStories] = useState([]);
  const [dailyFeeds, setDailyFeeds] = useState([]);
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);

  // PDF Upload Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBookTitle, setPdfBookTitle] = useState("");
  const [pdfAuthor, setPdfAuthor] = useState("");
  const [pdfLevel, setPdfLevel] = useState(userLevel || "B1");
  const [customExcerptText, setCustomExcerptText] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  const [activeStory, setActiveStory] = useState(() => {
    if (initialSelectedStoryId) {
      const found = CLASSIC_STORIES.find((s) => s.id === initialSelectedStoryId);
      if (found && (found.targetLanguage || '').toLowerCase() === (targetLanguage || 'English').toLowerCase()) {
        return found;
      }
    }
    return null;
  });

  const [storyStage, setStoryStage] = useState("story");
  const [currentMode, setCurrentMode] = useState("reading");
  const [fontSize, setFontSize] = useState("normal");
  const [readerTheme, setReaderTheme] = useState("dark");
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(null);
  const [blindListening, setBlindListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [ambientSound, setAmbientSound] = useState("none");
  const ambientAudioCtxRef = useRef(null);
  const ambientNodeRef = useRef(null);
  const [selectedConvResponses, setSelectedConvResponses] = useState({});
  const [convFeedback, setConvFeedback] = useState({});
  const [selectedExerciseAnswers, setSelectedExerciseAnswers] = useState({});
  const [exerciseSubmitted, setExerciseSubmitted] = useState({});
  const [finalScore, setFinalScore] = useState(0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState(null);

  // Load custom stories and 3x daily feeds from backend
  const loadCustomStoriesAndFeeds = async () => {
    setIsLoadingFeeds(true);
    try {
      const res = await fetch(`/api/stories/custom-list?targetLanguage=${encodeURIComponent(targetLanguage)}&userId=default-user`);
      const data = await res.json();
      if (data.success) {
        setCustomStories(data.customStories || []);
        setDailyFeeds(data.dailyFeeds || []);
      }
    } catch (err) {
      console.warn("Could not load custom stories/feeds:", err);
    } finally {
      setIsLoadingFeeds(false);
    }
  };

  useEffect(() => {
    loadCustomStoriesAndFeeds();
  }, [targetLanguage]);

  // Auto-switch active story or reset when targetLanguage changes
  useEffect(() => {
    if (activeStory && activeStory.targetLanguage?.toLowerCase() !== targetLanguage?.toLowerCase()) {
      const matchingStories = [
        ...customStories.filter((s) => s.targetLanguage?.toLowerCase() === targetLanguage?.toLowerCase()),
        ...CLASSIC_STORIES.filter((s) => s.targetLanguage?.toLowerCase() === targetLanguage?.toLowerCase())
      ];
      setActiveStory(matchingStories[0] || null);
      setStoryStage("story");
      setActiveSentenceIndex(null);
      setIsPlaying(false);
    }
  }, [targetLanguage, activeStory, customStories]);

  // Combined stories pool
  const allAvailableStories = [...customStories, ...CLASSIC_STORIES];

  const filteredStories = allAvailableStories.filter((story) => {
    const matchesTarget = (story.targetLanguage || '').toLowerCase() === (targetLanguage || 'English').toLowerCase();
    const matchesMode = filterMode === "all" || story.mode === "both" || story.mode === filterMode;
    const matchesLevel = selectedLevel === "ALL" || story.level === selectedLevel;
    return matchesTarget && matchesMode && matchesLevel;
  });

  // Ambient sound synthesizer
  useEffect(() => {
    if (ambientSound === "none") {
      if (ambientAudioCtxRef.current) {
        ambientAudioCtxRef.current.close().catch(() => { });
        ambientAudioCtxRef.current = null;
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ambientAudioCtxRef.current = ctx;
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.04;
        b6 = white * 0.115926;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = ambientSound === "fireplace" ? "lowpass" : "bandpass";
      filter.frequency.value = ambientSound === "fireplace" ? 420 : 1200;
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      ambientNodeRef.current = noise;
    } catch (e) {
      console.warn("Ambient synthesizer unavailable:", e);
    }
    return () => {
      if (ambientAudioCtxRef.current) {
        ambientAudioCtxRef.current.close().catch(() => { });
      }
    };
  }, [ambientSound]);

  const speechUtteranceRef = useRef(null);
  const stopAudio = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const startAudioNarration = (fromSentenceIdx = 0) => {
    if (!activeStory) return;
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser environment.");
      return;
    }
    window.speechSynthesis.cancel();
    const sentences = activeStory.sentences || [];
    if (sentences.length === 0) return;

    let currentIdx = fromSentenceIdx;
    const playNext = () => {
      if (currentIdx >= sentences.length) {
        setIsPlaying(false);
        setActiveSentenceIndex(null);
        return;
      }
      setActiveSentenceIndex(currentIdx);
      const textToSpeak = sentences[currentIdx].text;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      speechUtteranceRef.current = utterance;

      const langMap = {
        English: "en-GB",
        German: "de-DE",
        Spanish: "es-ES",
        French: "fr-FR",
        Italian: "it-IT",
        Russian: "ru-RU",
        Turkish: "tr-TR"
      };
      utterance.lang = langMap[activeStory.targetLanguage] || "en-US";
      utterance.rate = playbackSpeed;
      utterance.pitch = 0.95;

      utterance.onend = () => {
        currentIdx++;
        playNext();
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    setIsPlaying(true);
    playNext();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudioNarration(activeSentenceIndex !== null ? activeSentenceIndex : 0);
    }
  };

  const handleSelectStory = (story, mode = "reading") => {
    stopAudio();
    setActiveStory(story);
    setCurrentMode(mode);
    setStoryStage("story");
    setActiveSentenceIndex(0);
    setSelectedConvResponses({});
    setConvFeedback({});
    setSelectedExerciseAnswers({});
    setExerciseSubmitted({});
    setFinalScore(0);
    setSyncSuccessMessage(null);
    setSelectedSentence(null);
  };

  const handleCloseStory = () => {
    stopAudio();
    setActiveStory(null);
  };

  const handleSelectSentence = (idx) => {
    setActiveSentenceIndex(idx);
    if (activeStory?.sentences?.[idx]) {
      setSelectedSentence(activeStory.sentences[idx]);
    }
    if (isPlaying) startAudioNarration(idx);
  };

  const handleSelectConversationResponse = (qId, respId) => {
    setSelectedConvResponses((prev) => ({ ...prev, [qId]: respId }));
    setConvFeedback((prev) => ({ ...prev, [qId]: true }));
  };

  const sendSocraticMessage = async () => {
    if (!socraticInput.trim()) return;
    const userMsg = socraticInput.trim();
    setSocraticInput('');
    setSocraticMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    try {
      const res = await fetch('/api/socratic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default-user',
          bookTitle: activeStory.title,
          author: activeStory.author,
          excerpt: selectedSentence ? selectedSentence.text : activeStory.paragraphs?.[0] || activeStory.storyText,
          userMessage: userMsg,
          targetLanguage: targetLanguage,
          mediatorLanguage: mediatorLanguage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSocraticMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setSocraticMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I could not generate a response.' }]);
      }
    } catch (err) {
      console.error('Socratic chat error:', err);
      setSocraticMessages((prev) => [...prev, { role: 'assistant', text: 'Connection error.' }]);
    }
  };

  const handleSelectExerciseOption = (exerciseId, optionIdx) => {
    setSelectedExerciseAnswers((prev) => ({ ...prev, [exerciseId]: optionIdx }));
    setExerciseSubmitted((prev) => ({ ...prev, [exerciseId]: true }));
  };

  const handleCompleteStory = async () => {
    if (!activeStory) return;
    let totalPoints = 0;
    let maxPoints = 0;

    if (activeStory.conversations) {
      activeStory.conversations.forEach((conv) => {
        maxPoints += 10;
        const respId = selectedConvResponses[conv.id];
        if (conv.userResponses) {
          const found = conv.userResponses.find((r) => r.id === respId);
          if (found) {
            totalPoints += found.scoreAwarded;
          }
        } else if (conv.options) {
          if (respId === conv.correctIndex) {
            totalPoints += 10;
          }
        }
      });
    }

    if (activeStory.exercises) {
      activeStory.exercises.forEach((ex) => {
        maxPoints += 20;
        const ans = selectedExerciseAnswers[ex.id];
        if (ans === ex.correctIndex) {
          totalPoints += 20;
        }
      });
    }

    const calculatedScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 88;
    setFinalScore(calculatedScore);
    setStoryStage("completed");
    setIsSavingProgress(true);

    try {
      const scoreDelta = calculatedScore >= 75 ? 5 : 2;
      const skillKey = currentMode === "listening" ? "listening" : "reading";
      const resp = await fetch("/api/stories/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "default-user",
          storyId: activeStory.id,
          storyTitle: activeStory.title,
          author: activeStory.author,
          mode: currentMode,
          score: calculatedScore,
          scoreDelta,
          source: "webapp"
        })
      });
      const data = await resp.json();
      if (data.success) {
        setSyncSuccessMessage(`Progress saved! ${skillKey.toUpperCase()} boosted by +${scoreDelta}% & synced to @SpeakBot`);
        if (onStoryCompleted) {
          onStoryCompleted({
            storyId: activeStory.id,
            mode: currentMode,
            score: calculatedScore,
            skill: skillKey,
            scoreDelta
          });
        }
      }
    } catch (err) {
      console.warn("Could not sync story progress:", err);
    } finally {
      setIsSavingProgress(false);
    }
  };

  // Upload Custom PDF or Text Book Excerpt
  const handleUploadPdfBook = async (e) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!pdfFile && !customExcerptText.trim()) {
      setUploadError("Please choose a PDF file or enter an excerpt from your book.");
      return;
    }

    setIsUploadingPdf(true);

    try {
      let fileBase64 = null;
      let fileName = pdfFile ? pdfFile.name : `${pdfBookTitle || 'Custom Book'}.txt`;

      if (pdfFile) {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(pdfFile);
        });
      }

      const res = await fetch("/api/stories/upload-pdf-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "default-user",
          pdfData: fileBase64,
          fileText: customExcerptText,
          fileName,
          bookTitle: pdfBookTitle || fileName.replace(/\.[^/.]+$/, ""),
          author: pdfAuthor || "Custom Author",
          targetLanguage,
          mediatorLanguage,
          userLevel: pdfLevel
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Server failed to process book excerpt.");
      }

      setUploadSuccess(`"${data.story.title}" processed successfully with NLP tokenization!`);
      setCustomStories((prev) => [data.story, ...prev]);

      // Reset form
      setPdfFile(null);
      setPdfBookTitle("");
      setPdfAuthor("");
      setCustomExcerptText("");

      setTimeout(() => {
        setIsPdfModalOpen(false);
        handleSelectStory(data.story, "reading");
      }, 1200);
    } catch (err) {
      console.error("PDF upload error:", err);
      setUploadError(err.message || "Failed to process PDF book.");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleDeleteCustomStory = async (e, storyId) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/stories/custom-story/${storyId}?userId=default-user`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setCustomStories((prev) => prev.filter((s) => s.id !== storyId));
        if (activeStory?.id === storyId) {
          handleCloseStory();
        }
      }
    } catch (err) {
      console.error("Failed to delete custom story:", err);
    }
  };

  // Check if a word is in savedVocabulary for the active story language
  const checkIsWordSaved = (wordStr) => {
    if (!wordStr) return false;
    const cleanWord = wordStr.toLowerCase().trim();
    const activeTarget = (activeStory?.targetLanguage || targetLanguage || 'English').toLowerCase();

    // Check in current language array
    return savedVocabulary.some((v) => {
      const vWord = (v.word || '').toLowerCase().trim();
      const vLang = (v.targetLanguage || targetLanguage || 'English').toLowerCase();
      return vWord === cleanWord && vLang === activeTarget;
    });
  };

  const getThemeClasses = () => {
    switch (readerTheme) {
      case "sepia":
        return "bg-[#fbf0d9] text-[#433422] border-[#e6d3b3]";
      case "light":
        return "bg-white text-slate-800 border-slate-200";
      case "dark":
      default:
        return "bg-slate-900 text-slate-100 border-slate-800";
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case "huge":
        return "text-xl sm:text-2xl leading-relaxed";
      case "large":
        return "text-lg sm:text-xl leading-relaxed";
      case "normal":
      default:
        return "text-base sm:text-lg leading-relaxed";
    }
  };

  if (activeStory) {
    return (
      <div className="space-y-6 pb-12">
        {/* Navigation Breadcrumb & Top Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseStory}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Library</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {activeStory.level}
                </span>
                {activeStory.isCustomPdf && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono font-bold">
                    Custom PDF Excerpt
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-400 font-serif italic">
                  {activeStory.author} ({activeStory.authorEra || 'Classic Literature'})
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {activeStory.title}
              </h2>
            </div>
          </div>

          {/* Mode Switcher & Stage Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setCurrentMode("reading")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${currentMode === "reading" ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reading Mode</span>
              </button>
              <button
                onClick={() => setCurrentMode("listening")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${currentMode === "listening" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Audio Theater</span>
              </button>
            </div>

            {/* Stage Selector */}
            <div className="hidden sm:flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setStoryStage("story")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${storyStage === "story" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                1. Text & Audio
              </button>
              <button
                onClick={() => setStoryStage("conversation")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${storyStage === "conversation" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                2. Socratic Chat
              </button>
              <button
                onClick={() => setStoryStage("exercises")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${storyStage === "exercises" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                3. Exercises
              </button>
            </div>
          </div>
        </div>

        {/* STAGE 1: IMMERSIVE STORY TEXT & AUDIO THEATER */}
        {storyStage === "story" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Reading & Audio Column (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Audio Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${isPlaying ? "bg-amber-500 hover:bg-amber-600 animate-pulse" : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      title={isPlaying ? "Pause Narration" : "Play Narration"}
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>
                    <div>
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{activeStory.audioNarrator || "Literary Audio Narration"}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Tone: {activeStory.audioTone || "Atmospheric & Pedagogical"}
                      </div>
                    </div>
                  </div>

                  {/* Playback Settings */}
                  <div className="flex items-center gap-2">
                    {/* Speed Selector */}
                    <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                      <span className="text-slate-400 text-[10px]">Speed:</span>
                      {[0.8, 1, 1.2].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => {
                            setPlaybackSpeed(spd);
                            if (isPlaying) {
                              stopAudio();
                              setTimeout(() => startAudioNarration(activeSentenceIndex ?? 0), 100);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${playbackSpeed === spd ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                            }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    {/* Ambient Acoustic Soundscape */}
                    <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <select
                        value={ambientSound}
                        onChange={(e) => setAmbientSound(e.target.value)}
                        className="bg-transparent text-slate-200 text-xs border-none focus:outline-none cursor-pointer"
                        title="Ambient Acoustic Atmosphere"
                      >
                        <option value="none" className="bg-slate-900">Ambient: Off</option>
                        <option value="fireplace" className="bg-slate-900">Fireplace Crackle</option>
                        <option value="vinyl" className="bg-slate-900">Vintage Vinyl Grain</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Blind Listening Toggle */}
                {currentMode === "listening" && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-300">
                      Blind Ear Training: conceal text to build direct acoustic recognition
                    </span>
                    <button
                      onClick={() => setBlindListening(!blindListening)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${blindListening ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                    >
                      {blindListening ? "Conceal Mode Active" : "Conceal Text"}
                    </button>
                  </div>
                )}
              </div>

              {/* Reader Options Bar */}
              <div className="flex items-center justify-between px-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Theme:</span>
                  <button
                    onClick={() => setReaderTheme("dark")}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${readerTheme === "dark" ? "bg-slate-800 text-white font-bold" : "hover:text-white"}`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setReaderTheme("sepia")}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${readerTheme === "sepia" ? "bg-[#fbf0d9] text-[#433422] font-bold" : "hover:text-white"}`}
                  >
                    Sepia
                  </button>
                  <button
                    onClick={() => setReaderTheme("light")}
                    className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${readerTheme === "light" ? "bg-white text-slate-900 font-bold" : "hover:text-white"}`}
                  >
                    Light
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Font:</span>
                  <button
                    onClick={() => setFontSize("normal")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${fontSize === "normal" ? "bg-slate-800 text-white" : "hover:text-white"}`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setFontSize("large")}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${fontSize === "large" ? "bg-slate-800 text-white" : "hover:text-white"}`}
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setFontSize("huge")}
                    className={`px-2 py-0.5 rounded font-black text-sm cursor-pointer ${fontSize === "huge" ? "bg-slate-800 text-white" : "hover:text-white"}`}
                  >
                    A++
                  </button>
                </div>
              </div>

              {/* Story Content Canvas */}
              <div
                className={`p-6 sm:p-10 rounded-3xl border shadow-2xl transition-colors ${getThemeClasses()} ${blindListening ? "backdrop-blur-lg filter select-none" : ""
                  }`}
              >
                {blindListening ? (
                  <div className="text-center py-16 space-y-4">
                    <Headphones className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                    <h3 className="text-xl font-bold text-white">Blind Listening Mode Active</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Text is concealed to maximize pure auditory comprehension. Focus entirely on the narrator’s cadence, tone, and connected speech.
                    </p>
                    <button
                      onClick={() => setBlindListening(false)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg cursor-pointer"
                    >
                      Reveal Transcript
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Story Title Header */}
                    <div className="border-b pb-4 mb-6 border-current/20 text-center">
                      <div className="text-xs uppercase tracking-widest font-serif opacity-75">
                        {activeStory.authorEra || 'Classic Work'}
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-serif font-black mt-1">
                        {activeStory.title}
                      </h1>
                      <div className="text-xs font-serif italic mt-1 opacity-80">
                        by {activeStory.author}
                      </div>
                    </div>

                    {/* Interactive Paragraphs */}
                    {activeStory.paragraphs.map((para, pIdx) => (
                      <p key={pIdx} className={`font-serif leading-relaxed text-justify ${getFontSizeClass()}`}>
                        {para}
                      </p>
                    ))}

                    {/* Sentence Breakdown for High-Definition Analysis */}
                    <div className="mt-8 pt-6 border-t border-current/20 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                        <Feather className="w-3.5 h-3.5" />
                        <span>Click Any Sentence for Socratic & Grammatical Analysis:</span>
                      </div>

                      <div className="space-y-2">
                        {activeStory.sentences.map((s, sIdx) => {
                          const isCurrent = activeSentenceIndex === sIdx;
                          return (
                            <div
                              key={sIdx}
                              onClick={() => handleSelectSentence(sIdx)}
                              className={`p-3 rounded-2xl cursor-pointer transition border text-sm sm:text-base font-serif ${isCurrent
                                ? "bg-emerald-500/20 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/50"
                                : "hover:bg-current/5 border-transparent"
                                }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-current/10 opacity-70 mt-0.5">
                                  {sIdx + 1}
                                </span>
                                <div className="flex-1">
                                  <div className="font-semibold">{s.text}</div>
                                  {s.translation && (
                                    <div className="text-xs italic opacity-80 mt-1">
                                      {s.translation}
                                    </div>
                                  )}
                                  {s.literaryNote && (
                                    <div className="text-[11px] mt-1.5 font-sans px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      💡 <span className="font-semibold">Literary Insight:</span> {s.literaryNote}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation to Next Stage */}
              <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-slate-300">Ready to test your comprehension?</div>
                  <div className="text-xs text-slate-400">Step 2: Engage in Socratic conversation with the author persona.</div>
                </div>
                <button
                  onClick={() => setStoryStage("conversation")}
                  disabled={!selectedSentence}
                  className={`px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition transform active:scale-95 cursor-pointer ${!selectedSentence ? 'opacity-50 cursor-not-allowed' : ''}`}

                >
                  <span>Start Socratic Chat</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sidebar: Linguistic Intricacies, Devices & Saved Vocabulary (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Cultural & Linguistic Context Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Compass className="w-4 h-4" />
                  <span>Cultural & Historical Context</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeStory.culturalLinguisticContext}
                </p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Theme: {activeStory.theme || 'Literature'}</span>
                  <span className="font-mono">Level {activeStory.level}</span>
                </div>
              </div>

              {/* Key Literary Vocabulary in Context */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Feather className="w-4 h-4" />
                    <span>Linguistic Intricacy Lexicon</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {activeStory.keyVocabulary?.length || 0} Words
                  </span>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {activeStory.keyVocabulary?.map((vocab, vIdx) => {
                    const isSaved = checkIsWordSaved(vocab.word);
                    return (
                      <div
                        key={vIdx}
                        className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl hover:border-emerald-500/40 transition group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition">
                            {vocab.word}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {onSaveToVocabulary && (
                              <SaveToVocabButton
                                word={vocab.word}
                                translation={vocab.meaning || vocab.translation}
                                targetLanguage={activeStory.targetLanguage || targetLanguage}
                                pos={vocab.pos}
                                ipa={vocab.ipa}
                                example={vocab.example}
                                isSaved={isSaved}
                                onSave={onSaveToVocabulary}
                                compact={true}
                              />
                            )}
                            <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                              {vocab.pos}
                            </span>
                            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                              {vocab.cefr}
                            </span>
                          </div>
                        </div>
                        {vocab.ipa && (
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {vocab.ipa}
                          </div>
                        )}
                        <div className="text-xs text-slate-300 mt-1">
                          {vocab.meaning || vocab.translation}
                        </div>
                        {vocab.example && (
                          <div className="text-[11px] text-slate-400 italic mt-1 border-t border-slate-700/50 pt-1">
                            "{vocab.example}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stylistic Devices Dissection */}
              {activeStory.stylisticDevices?.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>Stylistic Devices Dissection</span>
                  </div>

                  <div className="space-y-3">
                    {activeStory.stylisticDevices.map((dev, dIdx) => (
                      <div
                        key={dIdx}
                        className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-1.5"
                      >
                        <div className="text-xs font-bold text-sky-300">
                          {dev.device}
                        </div>
                        <div className="text-xs font-serif italic text-slate-300 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                          "{dev.exampleFromText}"
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {dev.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE 2: SOCRATIC CONVERSATIONAL ANALYSIS */}
        {storyStage === "conversation" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900 border border-indigo-700/40 p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                <MessageSquare className="w-4 h-4" />
                <span>Socratic Dialogue & Literary Questioning</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Conversational Inquiry: Delving into Intricacies
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Step into dialogue with the literary persona. Choose the response that best unravels the character psychology and linguistic mechanics of the text.
              </p>
            </div>
            {/* Live Socratic Chat (based on selected sentence) */}
            {selectedSentence && (
              <div className="mt-8 p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
                <div className="text-xs font-bold text-sky-300 mb-2">Live Socratic Chat – based on selected sentence:</div>
                <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
                  {socraticMessages.map((msg, idx) => (
                    <div key={idx} className={`p-2 rounded-lg ${msg.role === 'user' ? 'bg-sky-600/30 text-right' : 'bg-slate-900 text-left'}`}>
                      <span className="text-xs">{msg.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={socraticInput}
                    onChange={(e) => setSocraticInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') sendSocraticMessage(); }}
                    placeholder="Ask a question about this sentence..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <button onClick={sendSocraticMessage} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">Send</button>
                </div>
              </div>
            )}
            {/* Conversation Dialogues List */}
            <div className="space-y-6">
              {activeStory.conversations?.map((conv) => {
                const isAnswered = Boolean(convFeedback[conv.id]);
                const selectedRespId = selectedConvResponses[conv.id];

                // Options could be userResponses array or options string array
                const hasComplexResponses = Boolean(conv.userResponses);

                return (
                  <div
                    key={conv.id || conv.prompt}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-300">{conv.persona}</div>
                        <div className="text-xs text-slate-400">Literary Persona Question:</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 font-serif text-sm sm:text-base text-slate-200 leading-relaxed">
                      "{conv.prompt}"
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Select Your Socratic Response:
                      </div>

                      {hasComplexResponses
                        ? conv.userResponses.map((resp) => {
                          const isChosen = selectedRespId === resp.id;
                          let btnClasses = "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800";
                          if (isAnswered) {
                            if (resp.isDeepInsight) {
                              btnClasses = "bg-emerald-500/20 border-emerald-500 text-emerald-200 font-medium";
                            } else if (isChosen) {
                              btnClasses = "bg-amber-500/20 border-amber-500 text-amber-200";
                            }
                          } else if (isChosen) {
                            btnClasses = "bg-indigo-500/20 border-indigo-500 text-indigo-200 font-medium";
                          }

                          return (
                            <button
                              key={resp.id}
                              disabled={isAnswered}
                              onClick={() => handleSelectConversationResponse(conv.id, resp.id)}
                              className={`w-full text-left p-3.5 rounded-2xl border transition text-xs sm:text-sm cursor-pointer ${btnClasses}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="text-slate-400 font-mono text-[10px] mt-0.5">
                                  ▶
                                </span>
                                <span>{resp.text}</span>
                              </div>
                            </button>
                          );
                        })
                        : conv.options?.map((opt, optIdx) => {
                          const isChosen = selectedRespId === optIdx;
                          let btnClasses = "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800";
                          if (isAnswered) {
                            if (optIdx === conv.correctIndex) {
                              btnClasses = "bg-emerald-500/20 border-emerald-500 text-emerald-200 font-medium";
                            } else if (isChosen) {
                              btnClasses = "bg-rose-500/20 border-rose-500 text-rose-200";
                            }
                          } else if (isChosen) {
                            btnClasses = "bg-indigo-500/20 border-indigo-500 text-indigo-200 font-medium";
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={isAnswered}
                              onClick={() => handleSelectConversationResponse(conv.id || conv.prompt, optIdx)}
                              className={`w-full text-left p-3.5 rounded-2xl border transition text-xs sm:text-sm cursor-pointer ${btnClasses}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="text-slate-400 font-mono text-[10px] mt-0.5">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{opt}</span>
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    {isAnswered && (
                      <div className="mt-4 p-4 rounded-2xl border bg-emerald-950/40 border-emerald-600/60 text-emerald-200 text-xs sm:text-sm space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Socratic Insight Analysis</span>
                        </div>
                        <p className="leading-relaxed">
                          {conv.botFeedback || "Thoughtful deduction unraveling the text's psychological core."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
                onClick={() => setStoryStage("story")}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Back to Story
              </button>
              <button
                onClick={() => setStoryStage("exercises")}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <span>Proceed to Tasks & Exercises</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: COMPREHENSIVE TASKS & EXERCISES */}
        {storyStage === "exercises" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-emerald-900/40 via-sky-900/40 to-slate-900 border border-emerald-700/40 p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <Award className="w-4 h-4" />
                <span>Linguistic & Syntactic Exercises</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Mastery Evaluation & Intricacy Tasks
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Solve these questions targeting comprehension, vocabulary, and syntactic patterns. Your score directly boosts your CEFR skill matrix!
              </p>
            </div>

            {/* Exercises List */}
            <div className="space-y-6">
              {activeStory.exercises?.map((ex, exIdx) => {
                const exKey = ex.id || `ex-${exIdx}`;
                const selectedOpt = selectedExerciseAnswers[exKey];
                const isSubmitted = Boolean(exerciseSubmitted[exKey]);
                const isCorrect = selectedOpt === ex.correctIndex;

                return (
                  <div
                    key={exKey}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Task #{exIdx + 1} • {(ex.type || 'Comprehension').replace("_", " ").toUpperCase()}
                      </span>
                      {isSubmitted && (
                        <span className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                          {isCorrect ? "✓ Correct" : "✗ Needs Revision"}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-semibold text-white">
                      {ex.question}
                    </h3>

                    <div className="space-y-2">
                      {ex.options.map((opt, optIdx) => {
                        const isThisChosen = selectedOpt === optIdx;
                        let btnStyle = "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800";
                        if (isSubmitted) {
                          if (optIdx === ex.correctIndex) {
                            btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-200 font-medium";
                          } else if (isThisChosen) {
                            btnStyle = "bg-rose-500/20 border-rose-500 text-rose-200";
                          }
                        } else if (isThisChosen) {
                          btnStyle = "bg-sky-500/20 border-sky-500 text-sky-200 font-medium";
                        }
                        return (
                          <button
                            key={optIdx}
                            disabled={isSubmitted}
                            onClick={() => handleSelectExerciseOption(exKey, optIdx)}
                            className={`w-full text-left p-3.5 rounded-2xl border transition text-xs sm:text-sm flex items-start gap-3 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isSubmitted && (
                      <div className="mt-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm space-y-2">
                        <div className="text-slate-300">
                          <span className="font-bold text-white">Explanation: </span>
                          {ex.explanation}
                        </div>
                        {ex.linguisticIntricacyNote && (
                          <div className="text-emerald-300 pt-1 border-t border-slate-700/60 flex items-start gap-1.5 text-xs">
                            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Intricacy Masterclass:</strong> {ex.linguisticIntricacyNote}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Complete & Submit Button */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-white">Finished all tasks?</div>
                <div className="text-xs text-slate-400">
                  Submit to calculate your CEFR skill boost and sync with @SpeakBot.
                </div>
              </div>
              <button
                onClick={handleCompleteStory}
                disabled={isSavingProgress}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xl flex items-center gap-2 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSavingProgress ? (
                  <span>Syncing with Cloud...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete & Sync Score</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: COMPLETED SUMMARY & VOCABULARY BOOKMARKING */}
        {storyStage === "completed" && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Story Masterclass Completed!</h2>
              <p className="text-sm text-slate-300">
                You thoroughly unpacked "{activeStory.title}" by {activeStory.author}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Evaluation Score</div>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-1">{finalScore}%</div>
              </div>
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {currentMode === "listening" ? "Listening" : "Reading"} Boost
                </div>
                <div className="text-3xl font-black text-sky-400 font-mono mt-1">
                  +{finalScore >= 75 ? "5" : "2"}%
                </div>
              </div>
            </div>

            {syncSuccessMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>{syncSuccessMessage}</span>
              </div>
            )}

            {/* Story Vocabulary Save Panel */}
            {activeStory.keyVocabulary?.length > 0 && onSaveToVocabulary && (
              <div className="pt-2 text-left space-y-2 max-w-lg mx-auto bg-slate-950/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <BookMarked className="w-4 h-4 text-emerald-400" />
                    <span>Bookmark Key Words from this Story:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      activeStory.keyVocabulary.forEach((v) => {
                        onSaveToVocabulary({
                          word: v.word,
                          translation: v.meaning || v.translation,
                          targetLanguage: activeStory.targetLanguage || targetLanguage,
                          pos: v.pos,
                          ipa: v.ipa,
                          example: v.example
                        });
                      });
                    }}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    + Save All {activeStory.keyVocabulary.length} Words
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                  {activeStory.keyVocabulary.map((v, i) => {
                    const isSaved = checkIsWordSaved(v.word);
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-white block truncate">{v.word}</span>
                          <span className="text-[10px] text-emerald-400 block truncate">{v.meaning || v.translation}</span>
                        </div>
                        <SaveToVocabButton
                          word={v.word}
                          translation={v.meaning || v.translation}
                          targetLanguage={activeStory.targetLanguage || targetLanguage}
                          pos={v.pos}
                          ipa={v.ipa}
                          example={v.example}
                          isSaved={isSaved}
                          onSave={onSaveToVocabulary}
                          compact={true}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCloseStory}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Browse More Stories
              </button>
              <button
                onClick={() => {
                  setStoryStage("story");
                  setActiveSentenceIndex(0);
                }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
              >
                Review Story Insights
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner with Topic & Immersion Description */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                Classical Literature & Audio Theater
              </span>
              <span className="text-xs text-slate-400">
                Target: <strong className="text-white">{targetLanguage}</strong>
              </span>
            </div>

            {/* Upload Custom PDF Book Button */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Custom PDF Book / Story</span>
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Immersive Classic Stories: Reading & Listening
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Delve deeply into classic prose in <span className="text-sky-400 font-semibold">{targetLanguage}</span> with masterworks from legendary authors or upload your own PDF books. SpeakBot uses deep NLP tokenization to parse syntactic fronting, generate Socratic literary dialogues, and create high-fidelity acoustic theater exercises.
          </p>

          {/* Quick Metrics Bar */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>{filteredStories.length} Works Available</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>High-Fidelity Audio Theater</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>3x Daily Bot Excerpt Feed Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3x Daily Bot Excerpt Feed Strip */}
      {dailyFeeds.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>3x Daily AI Story Excerpt Feed (Bot Broadcast)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Morning • Afternoon • Evening
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dailyFeeds.map((feed, fIdx) => {
              const icons = [Sunrise, Sun, Moon];
              const SlotIcon = icons[fIdx % icons.length];
              return (
                <div
                  key={feed.id || fIdx}
                  onClick={() => handleSelectStory(feed, "both")}
                  className="p-3.5 bg-slate-800/80 border border-slate-700/70 hover:border-amber-500/50 rounded-2xl cursor-pointer transition group flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <SlotIcon className="w-3.5 h-3.5 text-amber-400" />
                      {feed.feedSlot || `Daily Excerpt #${fIdx + 1}`}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      {feed.level}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-amber-200 transition line-clamp-1">
                      {feed.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 italic line-clamp-1">
                      {feed.author}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-700/40 pt-1.5">
                    <span>{feed.targetLanguage}</span>
                    <span className="text-sky-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                      Open Excerpt <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs: Mode & Level */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {/* Mode Filter */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filterMode === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
          >
            All Stories ({filteredStories.length})
          </button>
          <button
            onClick={() => setFilterMode("reading")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filterMode === "reading" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Reading Only</span>
          </button>
          <button
            onClick={() => setFilterMode("listening")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filterMode === "listening" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Audio Listening</span>
          </button>
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">Level:</span>
          {["ALL", "A1", "A2", "B1", "B2", "C1"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${selectedLevel === lvl ? "bg-emerald-500 text-white shadow" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/60 rounded-3xl border border-slate-800 space-y-4">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-200">
              No {targetLanguage} stories found for the selected filter
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Try resetting the level filter to ALL or upload your own PDF book to synthesize new reading exercises!
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedLevel("ALL");
                setFilterMode("all");
              }}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF Book</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map((story) => (
            <div
              key={story.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl transition group relative overflow-hidden"
            >
              <div className="space-y-3">
                {/* Header Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                      {story.level}
                    </span>
                    {story.isCustomPdf && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Custom PDF
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                      {story.targetLanguage}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {story.estimatedMinutes || 4}m
                    </span>
                    {story.isCustomPdf && (
                      <button
                        onClick={(e) => handleDeleteCustomStory(e, story.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        title="Delete custom book"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Author */}
                <div>
                  <div className="text-xs text-indigo-400 font-serif italic">
                    {story.author} • {story.authorEra || 'Classical Masterpiece'}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition mt-0.5 line-clamp-2">
                    {story.title}
                  </h3>
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {story.summary || story.culturalLinguisticContext || (story.paragraphs && story.paragraphs[0])}
                </p>

                {/* Theme & Literary highlights */}
                <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                  <div>
                    <strong className="text-slate-400">Theme:</strong> {story.theme || 'Language & Thought'}
                  </div>
                  {story.audioTone && (
                    <div className="text-emerald-400/90 text-[10px] font-mono">
                      🎧 {story.audioTone}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => handleSelectStory(story, "reading")}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read & Analyze</span>
                </button>

                <button
                  onClick={() => handleSelectStory(story, "listening")}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Audio Theater</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Book Upload Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload Custom PDF Book / Story</h3>
                  <p className="text-xs text-slate-400">
                    Extract excerpts & synthesize interactive cards for <strong className="text-sky-300">{targetLanguage}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadPdfBook} className="space-y-4">
              {/* File Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Select Book File (.PDF or .TXT):
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-4 text-center cursor-pointer transition bg-slate-800/50">
                  <input
                    type="file"
                    accept=".pdf,.txt,.epub"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const f = e.target.files[0];
                        setPdfFile(f);
                        if (!pdfBookTitle) {
                          setPdfBookTitle(f.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                  />
                  {pdfFile && (
                    <div className="text-xs text-emerald-400 font-semibold mt-2 flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready to extract: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Author */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Book / Story Title:</label>
                  <input
                    type="text"
                    required
                    value={pdfBookTitle}
                    onChange={(e) => setPdfBookTitle(e.target.value)}
                    placeholder="e.g., Der Steppenwolf, Don Quijote"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Author Name:</label>
                  <input
                    type="text"
                    value={pdfAuthor}
                    onChange={(e) => setPdfAuthor(e.target.value)}
                    placeholder="e.g., Hermann Hesse, Miguel de Cervantes"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* CEFR Level */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Target CEFR Complexity Level:</label>
                <div className="flex gap-2">
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPdfLevel(lvl)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${pdfLevel === lvl ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Excerpt / Fallback Text */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Optional: Paste Specific Excerpt or Chapter in {targetLanguage}:
                </label>
                <textarea
                  rows={3}
                  value={customExcerptText}
                  onChange={(e) => setCustomExcerptText(e.target.value)}
                  placeholder={`If you prefer pasting text directly or highlighting a passage from ${targetLanguage} literature...`}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-serif"
                />
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPdf}
                  className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isUploadingPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing with NLP Tokenizer...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Synthesize Story Card</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
