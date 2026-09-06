import { useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { TokenizedSentence } from "./TokenizedSentence";
import { requestAiTokenization } from "../nlp/tokenizer";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
export const NLPAnalyzerTab = ({
  mediatorLanguage,
  onSelectToken
}) => {
  const { t } = useTranslation();
  const [inputSentence, setInputSentence] = useState(
    "If you consistently analyze linguistic patterns, your conversational fluency will improve rapidly."
  );
  const [tokens, setTokens] = useState([]);
  const [syntaxSummary, setSyntaxSummary] = useState("");
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!inputSentence.trim()) return;
    setIsLoading(true);
    try {
      const res = await requestAiTokenization(inputSentence, mediatorLanguage);
      setTokens(res.tokens);
      setSyntaxSummary(res.syntaxSummary || "");
      setRules(res.grammarRulesDetected || []);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {
    /* Top Banner */
  }
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
              Deep Linguistic Parser & Syntactic Tokenizer for SpeakBot
            </p>
          </div>
        </div>

        {
    /* Input Form */
  }
        <form onSubmit={handleAnalyze} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Input English Sentence or Phrase:
            </label>
            <textarea
    rows={3}
    value={inputSentence}
    onChange={(e) => setInputSentence(e.target.value)}
    placeholder="Enter any sentence to parse morphology, syntax, and CEFR grading..."
    className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-sans"
  />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Target Mediator: <span className="text-emerald-400 font-bold">{mediatorLanguage.toUpperCase()}</span>
            </span>

            <button
    type="submit"
    disabled={isLoading || !inputSentence.trim()}
    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-600/20 transition-all active:scale-95 disabled:opacity-50"
  >
              {isLoading ? <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Parsing Tokens...</span>
                </> : <>
                  <Sparkles className="w-4 h-4" />
                  <span>Parse NLP Tokens</span>
                </>}
            </button>
          </div>
        </form>
      </div>

      {
    /* Results Display */
  }
      {tokens.length > 0 && <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 animate-in fade-in">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-200">
                Interactive Syntactic Breakdown
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

          {syntaxSummary && <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs space-y-1">
              <span className="text-indigo-400 font-bold block">Syntactic Role Analysis:</span>
              <p className="text-slate-300 leading-relaxed">{syntaxSummary}</p>
            </div>}

          {rules.length > 0 && <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
              <span className="text-emerald-400 font-bold block mb-1.5">Applicable Grammar Directives:</span>
              <ul className="space-y-1">
                {rules.map((r, idx) => <li key={idx} className="text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{r}</span>
                  </li>)}
              </ul>
            </div>}
        </div>}
    </div>;
};
