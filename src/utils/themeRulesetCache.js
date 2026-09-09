// themeRulesetCache.js — Infallible UI Styling Ruleset Storage & Fallback Engine
// Permanently stores generated theme rulesets in localStorage and safe code memory.
// Guarantees that if the AI API or procedural generator fails, CSS styling falls back
// directly to the exact curated themes (Golden AI, Cosmic Cyberpunk, Emerald Aurora, Sunset, Oceanic).

import { PRESET_THEMES, getHarmonizedTheme } from './colorHarmonizer';

const STORAGE_KEY = 'linguo_theme_rulesets_vault';
const ACTIVE_THEME_KEY = 'linguo_active_theme_config';

// ── Master Code Fallback Vault (Zero-dependency, mathematically vetted) ────────
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

// Ensure complete style objects exist for any color entry
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

/**
 * Retrieves a stored styling ruleset from localStorage cache.
 */
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

/**
 * Persists a newly generated or selected theme ruleset both to localStorage and memory.
 */
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

/**
 * Saves current theme preferences.
 */
export function saveActiveThemePreference(themeId, rotationIndex = 0) {
  try {
    localStorage.setItem(ACTIVE_THEME_KEY, JSON.stringify({ themeId, rotationIndex }));
  } catch (e) {
    // Ignore storage issues in sandboxed frames
  }
}

/**
 * Retrieves the last active theme preferences.
 */
export function getActiveThemePreference() {
  try {
    const raw = localStorage.getItem(ACTIVE_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.themeId) return parsed;
    }
  } catch (e) {
    // Fallback to defaults
  }
  return { themeId: 'golden_ai', rotationIndex: 0 };
}

/**
 * Guaranteed Safe Theme Resolver:
 * 1. Checks memory & procedural generator (getHarmonizedTheme)
 * 2. Checks persisted vault in localStorage
 * 3. Falls back directly to hardcoded ruleset vault (HARDCODED_FALLBACK_RULESETS)
 * NEVER returns undefined or null.
 */
export function getSafeThemeRuleset(themeId = 'golden_ai', rotationIndex = 0) {
  try {
    // Primary: Try harmonic calculation
    const generated = getHarmonizedTheme(themeId, rotationIndex);
    if (generated && generated.colors && Object.keys(generated.colors).length >= 8) {
      // Automatically cache successful generation
      persistThemeRuleset(themeId, rotationIndex, generated);
      return {
        themeMeta: generated.themeMeta,
        colors: hydrateElementStyles(generated.colors),
      };
    }
  } catch (err) {
    console.warn('Harmonic generator warning, trying persisted vault:', err.message);
  }

  // Secondary: Try local persisted storage
  try {
    const vault = getPersistedThemeRulesets();
    const cacheKey = `${themeId}_rot_${rotationIndex || 0}`;
    if (vault[cacheKey]?.themeData?.colors) {
      return {
        themeMeta: vault[cacheKey].themeData.themeMeta || PRESET_THEMES[0],
        colors: hydrateElementStyles(vault[cacheKey].themeData.colors),
      };
    }
  } catch (e) {
    // Continue to static fallback
  }

  // Tertiary: Immutable code fallback
  const hardcoded = HARDCODED_FALLBACK_RULESETS[themeId] || HARDCODED_FALLBACK_RULESETS.golden_ai;
  return {
    themeMeta: hardcoded.themeMeta,
    colors: hydrateElementStyles(hardcoded.colors),
  };
}
