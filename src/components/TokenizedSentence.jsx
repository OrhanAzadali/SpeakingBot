export const TokenizedSentence = ({
  tokens,
  onSelectToken,
  className = ""
}) => {
  return <div className={`flex flex-wrap items-center gap-1.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 ${className}`}>
      {tokens.map((token, idx) => {
    const isPunct = token.pos === "PUNCT";
    if (isPunct) {
      return <span key={idx} className="text-slate-400 font-mono self-end pb-1 text-sm">
              {token.text}
            </span>;
    }
    return <button
      key={idx}
      type="button"
      onClick={() => onSelectToken(token)}
      className="group inline-flex flex-col items-center px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-sky-950/60 border border-slate-800 hover:border-sky-500/50 transition-all text-left cursor-pointer active:scale-95"
      title={`Click to inspect token: ${token.text} (${token.pos})`}
    >
            <span className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
              {token.text}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 group-hover:text-sky-400">
                {token.pos}
              </span>
              {token.cefrLevel && <span className="text-[8px] font-bold px-1 rounded bg-slate-800 text-slate-300">
                  {token.cefrLevel}
                </span>}
            </div>
          </button>;
  })}
    </div>;
};
