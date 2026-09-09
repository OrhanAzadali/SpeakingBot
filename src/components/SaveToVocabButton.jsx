import { useState, useEffect } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';

export const SaveToVocabButton = ({
  word,
  translation = '',
  targetLanguage,
  pos = 'noun',
  ipa = '',
  example = '',
  isSaved,
  onSave,
  className = '',
  label = 'Save to Vocabulary',
  compact = false,
}) => {
  const [localSaved, setLocalSaved] = useState(false);
  const isCurrentlySaved = isSaved !== undefined ? Boolean(isSaved) : localSaved;

  useEffect(() => {
    if (isSaved !== undefined) {
      setLocalSaved(Boolean(isSaved));
    }
  }, [isSaved]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isCurrentlySaved && onSave) {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
        try {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } catch (err) {
          // ignore
        }
      }
      setLocalSaved(true);
      onSave({
        word,
        translation,
        targetLanguage,
        pos,
        ipa,
        example,
      });
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isCurrentlySaved}
        title={isCurrentlySaved ? `"${word}" is in your Saved Vocabulary` : `Save "${word}" to Vocabulary`}
        className={`inline-flex items-center justify-center gap-1 p-1.5 rounded-lg text-xs font-semibold transition border ${isCurrentlySaved
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-default'
          : 'bg-slate-800/80 hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 border-slate-700/80 hover:border-sky-500/40 cursor-pointer'
          } ${className}`}
      >
        {isCurrentlySaved ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <BookmarkPlus className="w-3.5 h-3.5 text-sky-400" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCurrentlySaved}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${isCurrentlySaved
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-default'
        : 'bg-slate-800/90 hover:bg-sky-900/40 text-slate-200 hover:text-white border-slate-700 hover:border-sky-500/40 shadow-sm'
        } ${className}`}
    >
      {isCurrentlySaved ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Saved to Lexicon!</span>
        </>
      ) : (
        <>
          <BookmarkPlus className="w-3.5 h-3.5 text-sky-400" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

