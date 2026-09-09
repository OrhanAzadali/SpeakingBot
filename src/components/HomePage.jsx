import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Gamepad2,
  BookOpen,
  FileText,
  Headphones,
  Award,
  Sparkles,
  Download,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Flame,
  Bot,
  Layers,
  ChevronRight,
  Compass,
  Play,
  Zap,
  Volume2,
  Trash2,
  Globe,
} from 'lucide-react';
import { CubeWordCard } from './CubicWords/CubeWordCard';
import { GAMES_INFO } from './GamesHub';
import { ScrollDotsNav } from './ScrollDotsNav';
import { SaveToVocabButton } from './SaveToVocabButton';
import { exportGrammarGuideToPdf, exportVocabularyToPdf } from '../utils/pdfGenerator';
import { CLASSIC_STORIES } from '../data/classicStoriesData';

export const HomePage = ({
  userProfile,
  roadmaps = [],
  grammarPdfs = [],
  savedVocabulary = [],
  allVocabularies = {},
  countsByLanguage = {},
  onNavigateTab,
  onLaunchGame,
  onStartPlacementTest,
  onLaunchStory,
  onSaveToVocabulary,
  onDeleteFromVocabulary,
  onUpdateTargetLanguage,
  onSelectToken,
  themeColors
}) => {
  const [vocabSearch, setVocabSearch] = useState('');
  const [selectedVocabLanguage, setSelectedVocabLanguage] = useState(userProfile?.targetLanguage || 'English');

  const availableTargetLanguages = ['English', 'German', 'Spanish', 'French', 'Italian', 'Russian', 'Turkish'];

  // Current list to display based on selected tab or active targetLanguage
  const activeVocabList = allVocabularies[selectedVocabLanguage] || (selectedVocabLanguage === userProfile?.targetLanguage ? savedVocabulary : []);

  const filteredVocab = activeVocabList.filter((item) => {
    const q = vocabSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.word && item.word.toLowerCase().includes(q)) ||
      (item.translation && item.translation.toLowerCase().includes(q)) ||
      (item.meaning && item.meaning.toLowerCase().includes(q)) ||
      (item.pos && item.pos.toLowerCase().includes(q))
    );
  });

  const getLanguageSpeechCode = (lang) => {
    switch ((lang || "").toLowerCase()) {
      case "german":
      case "de":
        return "de-DE";
      case "spanish":
      case "es":
        return "es-ES";
      case "french":
      case "fr":
        return "fr-FR";
      case "italian":
      case "it":
        return "it-IT";
      case "russian":
      case "ru":
        return "ru-RU";
      case "turkish":
      case "tr":
        return "tr-TR";
      default:
        return "en-US";
    }
  };

  const playWordAudio = (word, lang) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = getLanguageSpeechCode(lang || selectedVocabLanguage);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const sections = [
    { id: 'hero-section', label: 'Overview', icon: '🌟' },
    { id: 'games-section', label: '3D Games', icon: '🎮' },
    { id: 'roadmaps-section', label: 'Roadmaps', icon: '🗺️' },
    { id: 'grammar-section', label: 'Grammar & PDFs', icon: '📄' },
    { id: 'stories-section', label: 'Classic Stories', icon: '📖' },
    { id: 'tests-section', label: 'Diagnostics & Tests', icon: '🎯' },
    { id: 'vocabulary-section', label: 'Saved Lexicon', icon: '📚' },
  ];

  // Filter classic stories by target language
  const relevantStories = CLASSIC_STORIES.filter(
    (s) => (s.targetLanguage || 'English').toLowerCase() === (userProfile.targetLanguage || 'English').toLowerCase()
  ).slice(0, 3);

  return (
    <div className="relative pb-24 space-y-20" style={themeColors.grammar?.style}>
      {/* Floating Dot Scrollbar Navigation Rail */}
      <ScrollDotsNav sections={sections} />

      {/* ================= SECTION 1: HERO & DASHBOARD OVERVIEW ================= */}
      <section id="hero-section" className="pt-2" style={themeColors.grammar?.iconStyle}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-6 sm:p-8 shadow-2xl" style={themeColors.grammar?.hex}>
          {/* Subtle glow background */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" style={themeColors.brand?.badgeStyle} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SpeakBot Multi-Tier Learning Ecosystem</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Master <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400">{userProfile.targetLanguage}</span> with Active 3D Recall
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Play immersive 3D games, follow CEFR-structured roadmaps, analyze classical literature, and download comprehensive grammar reference PDFs synced with your Telegram bot.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shrink-0">
              <div className="text-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Level</span>
                <span className="text-xl font-black text-sky-400">{userProfile.currentLevel}</span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Mastery</span>
                <span className="text-xl font-black text-emerald-400">{userProfile.overallScore}%</span>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saved Words</span>
                <span className="text-xl font-black text-amber-400">{savedVocabulary.length}</span>
              </div>
            </div>
          </div>

          {/* Skill Breakdown Trackers */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {Object.entries(userProfile.skillScores || {}).map(([skill, score]) => (
              <div key={skill} className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                <div className="flex justify-between font-bold capitalize text-slate-300 mb-1">
                  <span>{skill}</span>
                  <span className="text-sky-400">{score}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SECTION 2: INTERACTIVE 3D GAMES SHOWCASE ================= */}
      <section id="games-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <Gamepad2 className="w-4 h-4" />
              <span>Immersive Gaming Arena</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">3D Vocabulary & Spatial Word Games</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Launch games in full-screen mode to lock into uninterrupted study flow and build combos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('games')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer self-start sm:self-auto"
          >
            <span>Open Dedicated Games Tab</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
          </button>
        </div>

        {/* 3D Cube Word Tetris Highlight Card */}
        <CubeWordCard
          selectedLanguage={userProfile.targetLanguage}
          onStart={() => onLaunchGame('cubeGame')}
          onOpenVocabulary={() => onNavigateTab('games')}
          onSaveToVocabulary={onSaveToVocabulary}
        />

        {/* Interactive Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES_INFO.filter((g) => g.id !== 'cubeword').map((game) => (
            <div
              key={game.id}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-sky-500/30 transition shadow-lg group"
            >
              <div className="space-y-3" style={themeColors.grammar?.style}>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl group-hover:scale-110 transition" style={themeColors.brand?.iconStyle}>
                    {game.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    {game.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition">
                    {game.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400">+{game.xp} XP</span>
                <button
                  type="button"
                  onClick={() => onLaunchGame(game.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md shadow-sky-600/20 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play Fullscreen</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SECTION 3: PERSONALIZED LEARNING ROADMAPS ================= */}
      <section id="roadmaps-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-4 h-4" />
              <span>Step-by-Step Curriculum</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">Adaptive Learning Roadmaps</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Structured step-by-step pathways tailored to your current {userProfile.currentLevel} level.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('roadmaps')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer self-start sm:self-auto"
          >
            <span>Explore All Roadmaps Tab</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roadmaps.slice(0, 2).map((roadmap) => (
            <div
              key={roadmap.id}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-500/30 transition shadow-lg"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    CEFR {roadmap.level}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {roadmap.steps?.length || 4} Core Milestones
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{roadmap.title}</h3>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    {roadmap.description}
                  </p>
                </div>

                {/* Milestone pills */}
                <div className="space-y-2 pt-2">
                  {(roadmap.steps || []).slice(0, 3).map((step, idx) => (
                    <div
                      key={step.id || idx}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate font-medium">{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Personalized for Telegram Bot</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('roadmaps')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <span>Open Roadmap</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SECTION 4: COMPREHENSIVE GRAMMAR GUIDES & PDF WORKBOOKS ================= */}
      <section id="grammar-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              <span>Rigorous Syntactic Study</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">Grammar Rules & Comprehensive Study PDF Workbooks</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deep, informative rules with syntactic formulas, common pitfalls, and print-ready multi-page PDF generation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('grammar-pdfs')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer self-start sm:self-auto"
          >
            <span>Open All Grammar Guides Tab</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {grammarPdfs.slice(0, 3).map((guide) => (
            <div
              key={guide.id}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-indigo-500/30 transition shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                    {guide.level} &bull; {guide.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {guide.pagesCount} Pages &bull; {guide.fileSize}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white line-clamp-2">{guide.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {guide.summary}
                  </p>
                </div>

                {/* Core rule preview */}
                {guide.coreRules?.[0] && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
                    <span className="font-bold text-sky-300 block">{guide.coreRules[0].ruleTitle}</span>
                    <span className="font-mono text-slate-400 text-[10px] block truncate">
                      {guide.coreRules[0].formula}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  {guide.downloadsCount} learners
                </span>
                <button
                  type="button"
                  onClick={() => exportGrammarGuideToPdf(guide)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SECTION 5: CLASSIC STORIES & AUDIO NARRATIVES ================= */}
      <section id="stories-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-fuchsia-400 text-xs font-bold uppercase tracking-wider">
              <Headphones className="w-4 h-4" />
              <span>Literary Immersion</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">Classic Literature & Audio Story Trainers</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Read and listen to timeless literature in {userProfile.targetLanguage} with sentence-by-sentence linguistic breakdowns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('stories')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer self-start sm:self-auto"
          >
            <span>Open Dedicated Stories Tab</span>
            <ArrowRight className="w-3.5 h-3.5 text-fuchsia-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {relevantStories.map((story) => (
            <div
              key={story.id}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-fuchsia-500/30 transition shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-bold border border-fuchsia-500/30">
                    CEFR {story.level} &bull; {story.genre}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {story.estReadingTimeMin} min read
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-serif">{story.title}</h3>
                  <p className="text-xs text-slate-400 italic">by {story.author}</p>
                  <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                    {story.synopsis}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onLaunchStory('listening', story.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Listen</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchStory('reading', story.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold transition shadow-md shadow-fuchsia-600/20 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read & Analyze</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SECTION 6: DIAGNOSTICS & SKILL TESTS ================= */}
      <section id="tests-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <Award className="w-4 h-4" />
              <span>Assessment & Diagnostics</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">Diagnostic Placement & Skill Calibration</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Take the full adaptive test or calibrate individual grammar, vocabulary, and listening skills.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('skill-tests')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer self-start sm:self-auto"
          >
            <span>Open Skill Tests Tab</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Main Placement Test Card */}
          <div className="bg-gradient-to-br from-slate-900 to-rose-950/40 border border-rose-500/30 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Diagnostic Engine</span>
              </div>
              <h3 className="text-xl font-bold text-white">Full CEFR Placement Diagnostic</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Evaluates morphological accuracy, syntactic inversion, and contextual comprehension to assign your verified CEFR baseline (A1 to C2).
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono text-rose-300 font-bold">Current: {userProfile.currentLevel}</span>
              <button
                type="button"
                onClick={onStartPlacementTest}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <span>Launch Fullscreen Test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Skill Breakdown Calibration Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">Focused Skill Modules</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Test and level up individual competencies to generate customized study plans.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {['Grammar Mastery', 'Lexical Depth', 'Auditory Cadence', 'Reading Comprehension'].map((name) => (
                  <div key={name} className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-medium">
                    &bull; {name}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Auto-synced with @SpeakBot</span>
              <button
                type="button"
                onClick={() => onNavigateTab('skill-tests')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
              >
                <span>Take Skill Test</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 7: SAVED VOCABULARY & LEXICAL NOTEBOOK ================= */}
      <section id="vocabulary-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Bookmark className="w-4 h-4" />
              <span>Personal Lexical Notebook</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-1">Saved Vocabulary & Printable Study PDF</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved words are stored in dedicated vocabulary collections for each target language and preserved across Telegram Bot and WebApp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportVocabularyToPdf(activeVocabList, selectedVocabLanguage)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/20 cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export {selectedVocabLanguage} PDF</span>
          </button>
        </div>

        {/* Per-Target-Language Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {availableTargetLanguages.map((lang) => {
            const count = countsByLanguage[lang] ?? (allVocabularies[lang] ? allVocabularies[lang].length : (lang === userProfile?.targetLanguage ? savedVocabulary.length : 0));
            const isSelected = selectedVocabLanguage === lang;
            const isCurrentActiveTarget = userProfile?.targetLanguage === lang;

            return (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedVocabLanguage(lang)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${isSelected
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                  }`}
              >
                <span>{lang}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected
                    ? 'bg-amber-500/30 text-amber-200'
                    : 'bg-slate-800 text-slate-500'
                    }`}
                >
                  {count}
                </span>
                {isCurrentActiveTarget && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Active Target Language" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Active Language Sync Banner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
          <input
            type="text"
            value={vocabSearch}
            onChange={(e) => setVocabSearch(e.target.value)}
            placeholder={`Search ${selectedVocabLanguage} vocabulary words or translations...`}
            className="w-full sm:max-w-md bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {selectedVocabLanguage !== userProfile?.targetLanguage && onUpdateTargetLanguage && (
              <button
                type="button"
                onClick={() => onUpdateTargetLanguage(selectedVocabLanguage)}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                <span>Set as Active App Language</span>
              </button>
            )}
            <span className="text-xs font-mono font-bold text-amber-400 shrink-0">
              {filteredVocab.length} {selectedVocabLanguage} words
            </span>
          </div>
        </div>

        {/* Word Cards Grid */}
        {filteredVocab.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-6 space-y-3">
            <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">No {selectedVocabLanguage} words saved yet</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Bookmark words in 3D Cube Tetris, Flashcards, Classic Stories, or the NLP Tokenizer while learning {selectedVocabLanguage}!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVocab.map((item, index) => (
              <div
                key={item.id || index}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg font-bold text-white tracking-tight">
                      {item.word}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {item.pos && (
                        <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                          {item.pos}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => playWordAudio(item.word, item.targetLanguage || selectedVocabLanguage)}
                        className="p-1 rounded-md text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition cursor-pointer"
                        title="Pronounce word"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.ipa && (
                    <span className="text-xs font-mono text-slate-400 block mb-1">
                      {item.ipa}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-emerald-400">
                    {item.translation || item.meaning}
                  </p>
                  {item.example && (
                    <p className="text-[11px] text-slate-400 italic mt-2 border-t border-slate-800/80 pt-1.5">
                      "{item.example}"
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span className="text-slate-400">{selectedVocabLanguage} Lexicon</span>
                  <div className="flex items-center gap-2">
                    {onDeleteFromVocabulary && (
                      <button
                        type="button"
                        onClick={() => onDeleteFromVocabulary(item.id, item.word, selectedVocabLanguage)}
                        className="text-slate-500 hover:text-rose-400 transition p-1 rounded opacity-70 group-hover:opacity-100 cursor-pointer"
                        title="Remove word from vocabulary"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
