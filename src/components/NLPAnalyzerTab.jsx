import { useState, useEffect } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { TokenizedSentence } from "./TokenizedSentence";
import { requestAiTokenization } from "../nlp/tokenizer";
import { Sparkles, Loader2, CheckCircle2, Globe } from "lucide-react";

const SAMPLE_SENTENCES_BY_LANG = {
  German: "Arbeit und kontinuierliches Lernen führen zu nachhaltigem Erfolg.",
  English: "If you consistently analyze linguistic patterns, your conversational fluency will improve rapidly.",
  Spanish: "Si analizas los patrones lingüísticos con constancia, tu fluidez conversacional mejorará rápidamente.",
  French: "Si vous analysez régulièrement les structures linguistiques, votre aisance s'améliorera rapidement.",
  Italian: "Se analizzi con costanza le strutture linguistiche, la tua fluidità conversazionale migliorerà rapidamente.",
  Russian: "Если вы систематически изучаете грамматические структуры, ваша беглость речи улучшится.",
  Turkish: "Dilbilgisi kurallarını düzenli olarak analiz ederseniz, konuşma akıcılığınız hızla gelişir.",
};

export const NLPAnalyzerTab = ({
  targetLanguage = "English",
  mediatorLanguage = "az",
  onSelectToken
}) => {
  const { t } = useTranslation();
  const initialSentence = SAMPLE_SENTENCES_BY_LANG[targetLanguage] || SAMPLE_SENTENCES_BY_LANG.English;
  const [inputSentence, setInputSentence] = useState(initialSentence);
  const [tokens, setTokens] = useState([]);
  const [syntaxSummary, setSyntaxSummary] = useState("");
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize sample sentence when user toggles target language if input was default or empty
  useEffect(() => {
    const defaultSentence = SAMPLE_SENTENCES_BY_LANG[targetLanguage] || SAMPLE_SENTENCES_BY_LANG.English;
    const isPreviousSample = Object.values(SAMPLE_SENTENCES_BY_LANG).includes(inputSentence);
    if (!inputSentence || isPreviousSample) {
      setInputSentence(defaultSentence);
      setTokens([]);
      setSyntaxSummary("");
      setRules([]);
    }
  }, [targetLanguage]);

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!inputSentence.trim()) return;
    setIsLoading(true);
    try {
      const res = await requestAiTokenization(inputSentence, mediatorLanguage, targetLanguage);
      setTokens(res.tokens);
      setSyntaxSummary(res.syntaxSummary || "");
      setRules(res.grammarRulesDetected || []);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              {t("tabNlpAnalyzer")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Deep Linguistic Parser & Syntactic Tokenizer for SpeakBot ({targetLanguage})
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Input {targetLanguage} Sentence or Phrase:
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                Target Language: <strong className="text-white">{targetLanguage}</strong>
              </span>
            </div>
            <textarea
              rows={3}
              value={inputSentence}
              onChange={(e) => setInputSentence(e.target.value)}
              placeholder={`Enter any ${targetLanguage} sentence to parse morphology, syntax, and CEFR grading...`}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-sans"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Target Mediator: <span className="text-emerald-400 font-bold">{mediatorLanguage.toUpperCase()}</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputSentence.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Parsing {targetLanguage} Tokens...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse NLP Tokens</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {tokens.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 animate-in fade-in">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200">
                Interactive Syntactic Breakdown ({targetLanguage})
              </h3>
              <span className="text-xs text-sky-400 font-medium">
                {t("clickTokenToInspect")}
              </span>
            </div>

            <TokenizedSentence
              tokens={tokens}
              onSelectToken={onSelectToken}
            />
          </div>

          {syntaxSummary && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
              <span className="text-indigo-400 font-bold block">Syntactic Role Analysis:</span>
              <p className="text-slate-300 leading-relaxed">{syntaxSummary}</p>
            </div>
          )}

          {rules.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
              <span className="text-emerald-400 font-bold block mb-1.5">Applicable Grammar Directives ({targetLanguage}):</span>
              <ul className="space-y-1">
                {rules.map((r, idx) => (
                  <li key={idx} className="text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
