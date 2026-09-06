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
  Eye,
  EyeOff,
  Award,
  Feather,
  Layers,
  Clock,
  Compass,
  Info,
  Check,
  Bot
} from "lucide-react";
export const ClassicStoriesView = ({
  userLevel,
  targetLanguage,
  onSelectToken,
  onStoryCompleted,
  initialSelectedStoryId,
  initialMode = "all"
}) => {
  const { t, mediatorLanguage } = useTranslation();
  const [filterMode, setFilterMode] = useState(initialMode);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [activeStory, setActiveStory] = useState(() => {
    if (initialSelectedStoryId) {
      return CLASSIC_STORIES.find((s) => s.id === initialSelectedStoryId) || null;
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
  const [audioProgressSec, setAudioProgressSec] = useState(0);
  const ambientAudioCtxRef = useRef(null);
  const ambientNodeRef = useRef(null);
  const [selectedConvResponses, setSelectedConvResponses] = useState({});
  const [convFeedback, setConvFeedback] = useState({});
  const [selectedExerciseAnswers, setSelectedExerciseAnswers] = useState({});
  const [exerciseSubmitted, setExerciseSubmitted] = useState({});
  const [finalScore, setFinalScore] = useState(0);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState(null);

  // Auto-switch active story or reset when targetLanguage changes
  useEffect(() => {
    if (activeStory && activeStory.targetLanguage?.toLowerCase() !== targetLanguage?.toLowerCase()) {
      const matchingStories = CLASSIC_STORIES.filter(
        (s) => s.targetLanguage?.toLowerCase() === targetLanguage?.toLowerCase()
      );
      setActiveStory(matchingStories[0] || null);
      setStoryStage("story");
      setActiveSentenceIndex(null);
      setIsPlaying(false);
    }
  }, [targetLanguage, activeStory]);

  const filteredStories = CLASSIC_STORIES.filter((story) => {
    const matchesTarget = (story.targetLanguage || '').toLowerCase() === (targetLanguage || 'English').toLowerCase();
    const matchesMode = filterMode === "all" || story.mode === "both" || story.mode === filterMode;
    const matchesLevel = selectedLevel === "ALL" || story.level === selectedLevel;
    return matchesTarget && matchesMode && matchesLevel;
  });
  useEffect(() => {
    if (ambientSound === "none") {
      if (ambientAudioCtxRef.current) {
        ambientAudioCtxRef.current.close().catch(() => {
        });
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
        ambientAudioCtxRef.current.close().catch(() => {
        });
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

  // Full BCP-47 codes per story target language. Always applied to
  // utterance.lang (not just used to search for a matching voice object) —
  // this is what actually tells the browser's speech engine which language
  // to speak in, and is the fix for narration randomly coming out in the
  // wrong language (e.g. German) when no exact voice object was found.
  const STORY_LANGUAGE_CODES = {
    english: "en-US",
    spanish: "es-ES",
    german: "de-DE",
    french: "fr-FR",
    russian: "ru-RU",
    turkish: "tr-TR",
    italian: "it-IT",
    azerbaijani: "az-AZ",
  };

  const resolveLangCode = (targetLanguage) => {
    const key = (targetLanguage || "english").toLowerCase();
    return STORY_LANGUAGE_CODES[key] || "en-US";
  };

  // speechSynthesis.getVoices() frequently returns an empty list on the very
  // first call, since voices load asynchronously — this was the root cause
  // of narration silently falling back to the browser/OS default voice
  // (which can be any language) instead of the story's actual language.
  // This waits for the 'voiceschanged' event (with a timeout safety net) so
  // we always have the real voice list before picking one.
  const getVoicesAsync = () =>
    new Promise((resolve) => {
      const existing = window.speechSynthesis.getVoices();
      if (existing.length > 0) {
        resolve(existing);
        return;
      }
      let settled = false;
      const finish = (voices) => {
        if (settled) return;
        settled = true;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(voices);
      };
      const onVoicesChanged = () => finish(window.speechSynthesis.getVoices());
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      // Safety net in case 'voiceschanged' never fires on this browser
      setTimeout(() => finish(window.speechSynthesis.getVoices()), 500);
    });

  const startAudioNarration = async (fromSentenceIdx = 0) => {
    if (!activeStory) return;
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }
    stopAudio();
    const sentenceToRead = activeStory.sentences[fromSentenceIdx];
    const fullText = sentenceToRead ? sentenceToRead.text : activeStory.storyText;
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = playbackSpeed;

    const langCode = resolveLangCode(activeStory.targetLanguage);
    // Always set this — it's what the speech engine actually uses to choose
    // language/pronunciation, independent of whether a specific voice object
    // is found below.
    utterance.lang = langCode;

    const voices = await getVoicesAsync();
    const langPrefix = langCode.split("-")[0];
    const matchVoice =
      voices.find((v) => v.lang?.toLowerCase() === langCode.toLowerCase()) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(langPrefix));
    if (matchVoice) utterance.voice = matchVoice;

    utterance.onend = () => {
      if (activeSentenceIndex !== null && activeSentenceIndex + 1 < activeStory.sentences.length) {
        setActiveSentenceIndex(activeSentenceIndex + 1);
        startAudioNarration(activeSentenceIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };
    utterance.onerror = () => setIsPlaying(false);
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setActiveSentenceIndex(fromSentenceIdx);
  };
  const togglePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudioNarration(activeSentenceIndex ?? 0);
    }
  };
  const handleSelectStory = (story, mode) => {
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
  };
  const handleCloseStory = () => {
    stopAudio();
    setActiveStory(null);
  };
  const handleSelectSentence = (idx) => {
    setActiveSentenceIndex(idx);
    if (isPlaying) {
      startAudioNarration(idx);
    }
  };
  const handleSelectConversationResponse = (qId, respId) => {
    setSelectedConvResponses((prev) => ({ ...prev, [qId]: respId }));
    setConvFeedback((prev) => ({ ...prev, [qId]: true }));
  };
  const handleSelectExerciseOption = (exerciseId, optionIdx) => {
    setSelectedExerciseAnswers((prev) => ({ ...prev, [exerciseId]: optionIdx }));
    setExerciseSubmitted((prev) => ({ ...prev, [exerciseId]: true }));
  };
  const handleCompleteStory = async () => {
    if (!activeStory) return;
    let totalPoints = 0;
    let maxPoints = 0;
    activeStory.conversations.forEach((conv) => {
      maxPoints += 10;
      const respId = selectedConvResponses[conv.id];
      const found = conv.userResponses.find((r) => r.id === respId);
      if (found) {
        totalPoints += found.scoreAwarded;
      }
    });
    activeStory.exercises.forEach((ex) => {
      maxPoints += 20;
      const ans = selectedExerciseAnswers[ex.id];
      if (ans === ex.correctIndex) {
        totalPoints += 20;
      }
    });
    const calculatedScore = maxPoints > 0 ? Math.round(totalPoints / maxPoints * 100) : 88;
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
    const activeSentence = activeSentenceIndex !== null ? activeStory.sentences[activeSentenceIndex] : null;
    return <div className="space-y-6 pb-12">
        {
      /* Navigation Breadcrumb & Top Bar */
    }
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
      onClick={handleCloseStory}
      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
    >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Stories</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {activeStory.level}
                </span>
                <span className="text-xs font-semibold text-slate-400 font-serif italic">
                  {activeStory.author} ({activeStory.authorEra})
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {activeStory.title}
              </h2>
            </div>
          </div>

          {
      /* Mode Switcher & Stage Tabs */
    }
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
      onClick={() => setCurrentMode("reading")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${currentMode === "reading" ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
    >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reading Mode</span>
              </button>
              <button
      onClick={() => setCurrentMode("listening")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${currentMode === "listening" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
    >
                <Headphones className="w-3.5 h-3.5" />
                <span>Audio Theater</span>
              </button>
            </div>

            {
      /* Stage Selector */
    }
            <div className="hidden sm:flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
      onClick={() => setStoryStage("story")}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${storyStage === "story" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
    >
                1. Text & Audio
              </button>
              <button
      onClick={() => setStoryStage("conversation")}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${storyStage === "conversation" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
    >
                2. Socratic Chat
              </button>
              <button
      onClick={() => setStoryStage("exercises")}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${storyStage === "exercises" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
    >
                3. Exercises
              </button>
            </div>
          </div>
        </div>

        {
      /* STAGE 1: IMMERSIVE STORY TEXT & AUDIO THEATER */
    }
        {storyStage === "story" && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {
      /* Main Reading & Audio Column (7 Cols) */
    }
            <div className="lg:col-span-8 space-y-6">
              {
      /* Audio Controls (Especially prominent in listening mode) */
    }
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
      onClick={togglePlayPause}
      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${isPlaying ? "bg-amber-500 hover:bg-amber-600 animate-pulse" : "bg-emerald-600 hover:bg-emerald-500"}`}
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
                        Tone: {activeStory.audioTone || "Atmospheric & Analytical"}
                      </div>
                    </div>
                  </div>

                  {
      /* Playback Settings */
    }
                  <div className="flex items-center gap-2">
                    {
      /* Speed Selector */
    }
                    <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                      <span className="text-slate-400 text-[10px]">Speed:</span>
                      {[0.8, 1, 1.2].map((spd) => <button
      key={spd}
      onClick={() => {
        setPlaybackSpeed(spd);
        if (isPlaying) {
          stopAudio();
          setTimeout(() => startAudioNarration(activeSentenceIndex ?? 0), 100);
        }
      }}
      className={`px-2 py-0.5 rounded text-xs font-semibold ${playbackSpeed === spd ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"}`}
    >
                          {spd}x
                        </button>)}
                    </div>

                    {
      /* Ambient Acoustic Soundscape */
    }
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

                    {
      /* Blind Listening Toggle */
    }
                    {currentMode === "listening" && <button
      onClick={() => setBlindListening(!blindListening)}
      className={`p-2 rounded-xl border transition flex items-center gap-1 text-xs font-semibold ${blindListening ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"}`}
      title="Blind Listening hides the text to train pure auditory skills"
    >
                        {blindListening ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="hidden sm:inline">{blindListening ? "Blind Mode On" : "Blind Mode"}</span>
                      </button>}
                  </div>
                </div>

                {
      /* Sentence Selector Timeline */
    }
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Sentence: {activeSentenceIndex !== null ? activeSentenceIndex + 1 : 1} of {activeStory.sentences.length}
                  </span>
                  <div className="flex items-center gap-1">
                    {activeStory.sentences.map((_, sIdx) => <button
      key={sIdx}
      onClick={() => handleSelectSentence(sIdx)}
      className={`w-2.5 h-2.5 rounded-full transition ${activeSentenceIndex === sIdx ? "bg-emerald-400 scale-125" : "bg-slate-700 hover:bg-slate-500"}`}
      title={`Go to sentence ${sIdx + 1}`}
    />)}
                  </div>
                </div>
              </div>

              {
      /* Reader Options: Theme & Font Size */
    }
              <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-4 py-2 rounded-2xl text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Theme:</span>
                  <button
      onClick={() => setReaderTheme("dark")}
      className={`px-2.5 py-1 rounded-lg font-medium ${readerTheme === "dark" ? "bg-slate-800 text-white border border-slate-700" : "hover:text-white"}`}
    >
                    Dark
                  </button>
                  <button
      onClick={() => setReaderTheme("sepia")}
      className={`px-2.5 py-1 rounded-lg font-medium ${readerTheme === "sepia" ? "bg-[#f3e5c8] text-[#433422] font-bold" : "hover:text-white"}`}
    >
                    Sepia
                  </button>
                  <button
      onClick={() => setReaderTheme("light")}
      className={`px-2.5 py-1 rounded-lg font-medium ${readerTheme === "light" ? "bg-white text-slate-900 font-bold" : "hover:text-white"}`}
    >
                    Light
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Font:</span>
                  <button
      onClick={() => setFontSize("normal")}
      className={`px-2 py-0.5 rounded ${fontSize === "normal" ? "bg-slate-800 text-white" : "hover:text-white"}`}
    >
                    A
                  </button>
                  <button
      onClick={() => setFontSize("large")}
      className={`px-2 py-0.5 rounded font-bold ${fontSize === "large" ? "bg-slate-800 text-white" : "hover:text-white"}`}
    >
                    A+
                  </button>
                  <button
      onClick={() => setFontSize("huge")}
      className={`px-2 py-0.5 rounded font-black text-sm ${fontSize === "huge" ? "bg-slate-800 text-white" : "hover:text-white"}`}
    >
                    A++
                  </button>
                </div>
              </div>

              {
      /* Story Content Canvas */
    }
              <div
      className={`p-6 sm:p-10 rounded-3xl border shadow-2xl transition-colors ${getThemeClasses()} ${blindListening ? "backdrop-blur-lg filter select-none" : ""}`}
    >
                {blindListening ? <div className="text-center py-16 space-y-4">
                    <Headphones className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                    <h3 className="text-xl font-bold text-white">Blind Listening Mode Active</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                      Text is concealed to maximize pure auditory comprehension. Focus entirely on the narrator’s cadence, tone, and connected speech.
                    </p>
                    <button
      onClick={() => setBlindListening(false)}
      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg"
    >
                      Reveal Transcript
                    </button>
                  </div> : <div className="space-y-6">
                    {
      /* Story Title Header */
    }
                    <div className="border-b pb-4 mb-6 border-current/20 text-center">
                      <div className="text-xs uppercase tracking-widest font-serif opacity-75">
                        {activeStory.authorEra}
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-serif font-black mt-1">
                        {activeStory.title}
                      </h1>
                      <div className="text-xs font-serif italic mt-1 opacity-80">
                        by {activeStory.author}
                      </div>
                    </div>

                    {
      /* Interactive Paragraphs with Sentence Focus */
    }
                    {activeStory.paragraphs.map((para, pIdx) => <p key={pIdx} className={`font-serif leading-relaxed text-justify ${getFontSizeClass()}`}>
                        {para}
                      </p>)}

                    {
      /* Sentence Breakdown for High-Definition Analysis */
    }
                    <div className="mt-8 pt-6 border-t border-current/20 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                        <Feather className="w-3.5 h-3.5" />
                        <span>Click Any Sentence for Socratic & Grammatical Analysis:</span>
                      </div>

                      <div className="space-y-2">
                        {activeStory.sentences.map((s, sIdx) => {
      const isCurrent = activeSentenceIndex === sIdx;
      return <div
        key={sIdx}
        onClick={() => handleSelectSentence(sIdx)}
        className={`p-3 rounded-2xl cursor-pointer transition border text-sm sm:text-base font-serif ${isCurrent ? "bg-emerald-500/20 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/50" : "hover:bg-current/5 border-transparent"}`}
      >
                              <div className="flex items-start gap-2.5">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-current/10 opacity-70 mt-0.5">
                                  {sIdx + 1}
                                </span>
                                <div className="flex-1">
                                  <div className="font-semibold">{s.text}</div>
                                  {s.translation && <div className="text-xs italic opacity-80 mt-1">
                                      {s.translation}
                                    </div>}
                                  {s.literaryNote && <div className="text-[11px] mt-1.5 font-sans px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      💡 <span className="font-semibold">Literary Insight:</span> {s.literaryNote}
                                    </div>}
                                </div>
                              </div>
                            </div>;
    })}
                      </div>
                    </div>
                  </div>}
              </div>

              {
      /* Navigation to Next Stage */
    }
              <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-slate-300">Ready to test your comprehension?</div>
                  <div className="text-xs text-slate-400">Step 2: Engage in Socratic conversation with the author persona.</div>
                </div>
                <button
      onClick={() => setStoryStage("conversation")}
      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition transform active:scale-95"
    >
                  <span>Start Socratic Chat</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {
      /* Sidebar: Linguistic Intricacies, Stylistic Devices & Vocabulary (5 Cols) */
    }
            <div className="lg:col-span-4 space-y-6">
              {
      /* Cultural & Linguistic Context Card */
    }
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Compass className="w-4 h-4" />
                  <span>Cultural & Historical Context</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeStory.culturalLinguisticContext}
                </p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Theme: {activeStory.theme}</span>
                  <span className="font-mono">Level {activeStory.level}</span>
                </div>
              </div>

              {
      /* Key Literary Vocabulary in Context */
    }
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Feather className="w-4 h-4" />
                    <span>Linguistic Intricacy Lexicon</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {activeStory.keyVocabulary.length} Words
                  </span>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {activeStory.keyVocabulary.map((vocab, vIdx) => <div
      key={vIdx}
      className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl hover:border-emerald-500/40 transition group"
    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition">
                          {vocab.word}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                            {vocab.pos}
                          </span>
                          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                            {vocab.cefr}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {vocab.ipa}
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        {vocab.meaning}
                      </div>
                      <div className="text-[11px] text-slate-400 italic mt-1 border-t border-slate-700/50 pt-1">
                        "{vocab.example}"
                      </div>
                    </div>)}
                </div>
              </div>

              {
      /* Stylistic Devices Dissection */
    }
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                  <Layers className="w-4 h-4" />
                  <span>Stylistic Devices Dissection</span>
                </div>

                <div className="space-y-3">
                  {activeStory.stylisticDevices.map((dev, dIdx) => <div
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
                    </div>)}
                </div>
              </div>
            </div>
          </div>}

        {
      /* STAGE 2: SOCRATIC CONVERSATIONAL ANALYSIS */
    }
        {storyStage === "conversation" && <div className="max-w-3xl mx-auto space-y-6">
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

            {
      /* Questions List */
    }
            <div className="space-y-6">
              {activeStory.conversations.map((conv, cIdx) => {
      const selectedRespId = selectedConvResponses[conv.id];
      const isAnswered = Boolean(convFeedback[conv.id]);
      const selectedOption = conv.userResponses.find((r) => r.id === selectedRespId);
      return <div
        key={conv.id}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
      >
                    {
        /* Persona Bubble */
      }
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="flex-1 bg-slate-800/90 border border-slate-700 p-4 rounded-2xl rounded-tl-sm space-y-1">
                        <div className="text-xs font-bold text-indigo-400">
                          {conv.speakerPersona}
                        </div>
                        <p className="text-sm text-white font-medium">
                          "{conv.dialoguePrompt}"
                        </p>
                      </div>
                    </div>

                    {
        /* Learner Response Options */
      }
                    <div className="space-y-2.5 pt-2 pl-4 sm:pl-12">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Select your conversational counter-argument:
                      </div>

                      {conv.userResponses.map((resp) => {
        const isChosen = selectedRespId === resp.id;
        return <button
          key={resp.id}
          onClick={() => handleSelectConversationResponse(conv.id, resp.id)}
          className={`w-full text-left p-4 rounded-2xl border transition text-xs sm:text-sm ${isChosen ? resp.isDeepInsight ? "bg-emerald-500/15 border-emerald-500 text-white font-medium ring-1 ring-emerald-500/50" : "bg-amber-500/15 border-amber-500 text-white font-medium" : "bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600"}`}
        >
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                                {isChosen ? "\u2713" : "\u2022"}
                              </span>
                              <span>{resp.text}</span>
                            </div>
                          </button>;
      })}
                    </div>

                    {
        /* Socratic Feedback Bubble */
      }
                    {isAnswered && selectedOption && <div
        className={`mt-4 p-4 rounded-2xl border text-xs sm:text-sm space-y-1.5 ${selectedOption.isDeepInsight ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-200" : "bg-amber-950/40 border-amber-600/60 text-amber-200"}`}
      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            {selectedOption.isDeepInsight ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-amber-400" />}
                            {selectedOption.isDeepInsight ? "Profound Literary Insight (+10 pts)" : "Literal Perception (+3 pts)"}
                          </span>
                        </div>
                        <p className="leading-relaxed">{selectedOption.analysis}</p>
                      </div>}
                  </div>;
    })}
            </div>

            {
      /* Bottom Actions */
    }
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <button
      onClick={() => setStoryStage("story")}
      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
    >
                Back to Story
              </button>
              <button
      onClick={() => setStoryStage("exercises")}
      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg"
    >
                <span>Proceed to Tasks & Exercises</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>}

        {
      /* STAGE 3: COMPREHENSIVE TASKS & EXERCISES */
    }
        {storyStage === "exercises" && <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-emerald-900/40 via-sky-900/40 to-slate-900 border border-emerald-700/40 p-6 rounded-3xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <Award className="w-4 h-4" />
                <span>Linguistic & Syntactic Exercises</span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Mastery Evaluation & Intricacy Tasks
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Solve these questions targeting comprehension, archaic vocabulary, stylistic inversion, and connected speech. Your score directly boosts your CEFR skill matrix!
              </p>
            </div>

            {
      /* Exercises List */
    }
            <div className="space-y-6">
              {activeStory.exercises.map((ex, exIdx) => {
      const selectedOpt = selectedExerciseAnswers[ex.id];
      const isSubmitted = Boolean(exerciseSubmitted[ex.id]);
      const isCorrect = selectedOpt === ex.correctIndex;
      return <div
        key={ex.id}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
      >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Task #{exIdx + 1} • {ex.type.replace("_", " ").toUpperCase()}
                      </span>
                      {isSubmitted && <span className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                          {isCorrect ? "\u2713 Correct" : "\u2717 Needs Revision"}
                        </span>}
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
        return <button
          key={optIdx}
          disabled={isSubmitted}
          onClick={() => handleSelectExerciseOption(ex.id, optIdx)}
          className={`w-full text-left p-3.5 rounded-2xl border transition text-xs sm:text-sm flex items-start gap-3 ${btnStyle}`}
        >
                            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </button>;
      })}
                    </div>

                    {
        /* Explanation & Linguistic Intricacy Note */
      }
                    {isSubmitted && <div className="mt-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs sm:text-sm space-y-2">
                        <div className="text-slate-300">
                          <span className="font-bold text-white">Explanation: </span>
                          {ex.explanation}
                        </div>
                        {ex.linguisticIntricacyNote && <div className="text-emerald-300 pt-1 border-t border-slate-700/60 flex items-start gap-1.5 text-xs">
                            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Intricacy Masterclass:</strong> {ex.linguisticIntricacyNote}
                            </span>
                          </div>}
                      </div>}
                  </div>;
    })}
            </div>

            {
      /* Complete & Submit Button */
    }
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
      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xl flex items-center gap-2 transition transform active:scale-95 disabled:opacity-50"
    >
                {isSavingProgress ? <span>Syncing with Cloud...</span> : <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete & Sync Score</span>
                  </>}
              </button>
            </div>
          </div>}

        {
      /* STAGE 4: COMPLETION CELEBRATION MODAL */
    }
        {storyStage === "completed" && <div className="max-w-2xl mx-auto bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Story Assessment Accomplished
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {activeStory.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                You deeply delved into {activeStory.author}’s literary nuances, mastering both the Socratic dialogue and intricate syntactic devices.
              </p>
            </div>

            {
      /* Score Cards */
    }
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

            {syncSuccessMessage && <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>{syncSuccessMessage}</span>
              </div>}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
      onClick={handleCloseStory}
      className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
    >
                Browse More Stories
              </button>
              <button
      onClick={() => {
        setStoryStage("story");
        setActiveSentenceIndex(0);
      }}
      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg"
    >
                Review Story Insights
              </button>
            </div>
          </div>}
      </div>;
  }
  return <div className="space-y-6">
      {
    /* Hero Banner with Topic & Immersion Description */
  }
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
              Classical Literature & Audio Theater
            </span>
            <span className="text-xs text-slate-400">
              Target: <strong className="text-white">{targetLanguage}</strong>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Immersive Classic Stories: Reading & Listening
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Delve deeply into classic prose in <span className="text-sky-400 font-semibold">{targetLanguage}</span> with masterworks from legendary authors. Engage in Socratic conversations with literary personas, unpack intricate syntactic fronting, and train pure auditory comprehension with the ambient acoustic audio theater.
          </p>

          {
    /* Quick Metrics Bar */
  }
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>{filteredStories.length} Classical Works</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-emerald-400" />
              <span>High-Fidelity Audio Theater</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>Tangibly Synced to @SpeakBot</span>
            </span>
          </div>
        </div>
      </div>

      {
    /* Filter Tabs: Mode & Level */
  }
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {
    /* Mode Filter */
  }
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
    onClick={() => setFilterMode("all")}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterMode === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
  >
            All Stories
          </button>
          <button
    onClick={() => setFilterMode("reading")}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterMode === "reading" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"}`}
  >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Reading Only</span>
          </button>
          <button
    onClick={() => setFilterMode("listening")}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterMode === "listening" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
  >
            <Headphones className="w-3.5 h-3.5" />
            <span>Audio Listening</span>
          </button>
        </div>

        {
    /* Level Filter */
  }
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 mr-1">Level:</span>
          {["ALL", "A1", "A2", "B1", "B2", "C1"].map((lvl) => <button
    key={lvl}
    onClick={() => setSelectedLevel(lvl)}
    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${selectedLevel === lvl ? "bg-emerald-500 text-white shadow" : "bg-slate-800 text-slate-400 hover:text-white"}`}
  >
              {lvl}
            </button>)}
        </div>
      </div>

      {
    /* Stories Grid */
  }
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStories.map((story) => <div
    key={story.id}
    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl transition group"
  >
            <div className="space-y-3">
              {
    /* Header Badges */
  }
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                    {story.level}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    {story.targetLanguage}
                  </span>
                </div>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {story.estimatedMinutes}m
                </span>
              </div>

              {
    /* Title & Author */
  }
              <div>
                <div className="text-xs text-indigo-400 font-serif italic">
                  {story.author} • {story.authorEra}
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition mt-0.5">
                  {story.title}
                </h3>
              </div>

              {
    /* Summary */
  }
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                {story.summary}
              </p>

              {
    /* Theme & Literary highlights */
  }
              <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                <div>
                  <strong className="text-slate-400">Theme:</strong> {story.theme}
                </div>
                {story.audioTone && <div className="text-emerald-400/90 text-[10px] font-mono">
                    🎧 {story.audioTone}
                  </div>}
              </div>
            </div>

            {
    /* Action Buttons */
  }
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <button
    onClick={() => handleSelectStory(story, "reading")}
    className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
  >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read & Analyze</span>
              </button>

              <button
    onClick={() => handleSelectStory(story, "listening")}
    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
  >
                <Headphones className="w-3.5 h-3.5" />
                <span>Audio Theater</span>
              </button>
            </div>
          </div>)}
      </div>
    </div>;
};
