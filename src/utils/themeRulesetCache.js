// themeRulesetCache.js — Infallible UI Styling Ruleset Storage & Fallback Engine
import { PRESET_THEMES, getHarmonizedTheme } from './colorHarmonizer.js';

const STORAGE_KEY = 'linguo_theme_rulesets_vault';
const ACTIVE_THEME_KEY = 'linguo_active_theme_config';

export const HARDCODED_FALLBACK_RULESETS = {
  golden_ai: {
    themeMeta: PRESET_THEMES[0],
    colors: {
      brand: { hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
      cubeCard: { hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      flashcards: { hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
      quiz: { hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
      listening: { hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      match: { hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      speaking: { hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { hex: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
    },
  },
  cyberpunk: {
    themeMeta: PRESET_THEMES[1],
    colors: PRESET_THEMES[1].colors,
  },
  aurora: {
    themeMeta: PRESET_THEMES[2],
    colors: PRESET_THEMES[2].colors,
  },
  sunset: {
    themeMeta: PRESET_THEMES[3],
    colors: PRESET_THEMES[3].colors,
  },
  ocean: {
    themeMeta: PRESET_THEMES[4],
    colors: PRESET_THEMES[4].colors,
  },
};

function hydrateElementStyles(colors) {
  const safeColors = {};
  const defaultKeys = ['brand', 'cubeCard', 'flashcards', 'quiz', 'listening', 'match', 'speaking', 'grammar'];

  defaultKeys.forEach((key) => {
    const c = (colors && colors[key]) || HARDCODED_FALLBACK_RULESETS.golden_ai.colors[key];
    const hex = c.hex || '#6366f1';
    const glow = c.glow || `rgba(99, 102, 241, 0.4)`;

    safeColors[key] = {
      ...c,
      hex,
      glow,
      style: c.style || {
        borderColor: glow,
        boxShadow: `0 0 20px ${glow}`,
      },
      iconStyle: c.iconStyle || {
        color: hex,
        backgroundColor: `${hex}18`,
        borderColor: `${hex}40`,
      },
      badgeStyle: c.badgeStyle || {
        backgroundColor: `${hex}22`,
        color: hex,
        borderColor: `${hex}50`,
      },
      buttonStyle: c.buttonStyle || {
        background: `linear-gradient(135deg, ${hex}, ${hex}cc)`,
        color: '#ffffff',
        boxShadow: `0 4px 18px ${glow}`,
      },
    };
  });

  return safeColors;
}

export function getPersistedThemeRulesets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('Theme ruleset storage access error:', e.message);
  }
  return {};
}

export function persistThemeRuleset(themeId, rotationIndex, themeData) {
  try {
    const current = getPersistedThemeRulesets();
    const cacheKey = `${themeId}_rot_${rotationIndex || 0}`;
    current[cacheKey] = {
      themeId,
      rotationIndex,
      themeData,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    localStorage.setItem(ACTIVE_THEME_KEY, JSON.stringify({ themeId, rotationIndex }));
  } catch (e) {
    console.warn('Failed to persist theme ruleset:', e.message);
  }
}

export function getSafeThemeRuleset(themeId = 'golden_ai', rotationIndex = 0) {
  try {
    const generated = getHarmonizedTheme(themeId, rotationIndex);
    if (generated && generated.colors && Object.keys(generated.colors).length >= 8) {
      persistThemeRuleset(themeId, rotationIndex, generated);
      return {
        themeMeta: generated.themeMeta,
        colors: hydrateElementStyles(generated.colors),
      };
    }
  } catch (err) {
    console.warn('Harmonic generator warning:', err.message);
  }

  try {
    const vault = getPersistedThemeRulesets();
    const cacheKey = `${themeId}_rot_${rotationIndex || 0}`;
    if (vault[cacheKey]?.themeData?.colors) {
      return {
        themeMeta: vault[cacheKey].themeData.themeMeta || PRESET_THEMES[0],
        colors: hydrateElementStyles(vault[cacheKey].themeData.colors),
      };
    }
  } catch (e) {}

  const hardcoded = HARDCODED_FALLBACK_RULESETS[themeId] || HARDCODED_FALLBACK_RULESETS.golden_ai;
  return {
    themeMeta: hardcoded.themeMeta,
    colors: hydrateElementStyles(hardcoded.colors),
  };
}
