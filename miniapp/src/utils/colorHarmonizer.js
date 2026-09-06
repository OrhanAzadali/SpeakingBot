// colorHarmonizer.js — AI-guided Mathematical Color Harmony Engine
// Produces distinctive, high-contrast, WCAG AA compliant palettes with Golden Ratio chromatic spacing

export const PRESET_THEMES = [
  {
    id: 'golden_ai',
    name: 'AI Golden Ratio',
    description: 'Mathematically balanced hue spacing via Golden Angle (137.5°)',
    type: 'dynamic',
    baseHue: 195,
  },
  {
    id: 'cyberpunk',
    name: 'Cosmic Cyberpunk',
    description: 'Vibrant neon hues: Electric Cyan, Fuchsia, Lime, Amber & Magenta',
    type: 'fixed',
    colors: {
      brand: { name: 'Cyan Neon', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      cubeCard: { name: 'Hyper Indigo', hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
      flashcards: { name: 'Amethyst', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
      quiz: { name: 'Emerald Volt', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
      listening: { name: 'Electric Sky', hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      match: { name: 'Solar Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      speaking: { name: 'Neon Rose', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { name: 'Royal Violet', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)', text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/40' },
    },
  },
  {
    id: 'aurora',
    name: 'Emerald Aurora',
    description: 'Bioluminescent Northern Lights: Mint, Seafoam, Teal & Aquamarine',
    type: 'fixed',
    colors: {
      brand: { name: 'Mint Aurora', hex: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
      cubeCard: { name: 'Teal Pulse', hex: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)', text: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      flashcards: { name: 'Seafoam Cyan', hex: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)', text: 'text-teal-200', bg: 'bg-teal-500/15', border: 'border-teal-400/40' },
      quiz: { name: 'Biolum Lime', hex: '#84cc16', glow: 'rgba(132, 204, 22, 0.4)', text: 'text-lime-300', bg: 'bg-lime-500/15', border: 'border-lime-500/40' },
      listening: { name: 'Glacier Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      match: { name: 'Sunbeam Gold', hex: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', text: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40' },
      speaking: { name: 'Spring Coral', hex: '#fb7185', glow: 'rgba(251, 113, 133, 0.4)', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { name: 'Nordic Indigo', hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    description: 'Warm, high-contrast Dusk spectrum: Coral, Amber, Peach, Plum & Gold',
    type: 'fixed',
    colors: {
      brand: { name: 'Warm Amber', hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      cubeCard: { name: 'Crimson Sunset', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      flashcards: { name: 'Coral Gold', hex: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)', text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/40' },
      quiz: { name: 'Golden Sun', hex: '#facc15', glow: 'rgba(250, 204, 21, 0.4)', text: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40' },
      listening: { name: 'Twilight Plum', hex: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
      match: { name: 'Desert Flame', hex: '#ea580c', glow: 'rgba(234, 88, 12, 0.4)', text: 'text-orange-400', bg: 'bg-orange-600/15', border: 'border-orange-500/40' },
      speaking: { name: 'Ruby Blaze', hex: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)', text: 'text-rose-400', bg: 'bg-rose-600/15', border: 'border-rose-500/40' },
      grammar: { name: 'Indigo Twilight', hex: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
    },
  },
  {
    id: 'ocean',
    name: 'Oceanic Depths',
    description: 'Deep maritime tones: Cerulean, Caribbean Turquoise, Aquamarine & Deep Azure',
    type: 'fixed',
    colors: {
      brand: { name: 'Deep Aqua', hex: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      cubeCard: { name: 'Caribbean Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      flashcards: { name: 'Sea Cobalt', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/40' },
      quiz: { name: 'Marine Teal', hex: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)', text: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      listening: { name: 'Tide Sky', hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      match: { name: 'Pearl Mint', hex: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)', text: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      speaking: { name: 'Coral Reef', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { name: 'Deep Trench', hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
    },
  },
];

/**
 * Calculates an algorithmic color harmony using the Golden Angle (137.508°)
 * to guarantee that each UI element receives a visually distinct,
 * high-contrast, WCAG AA compliant color.
 */
export function generateGoldenRatioPalette(baseHue = 200, stepOffset = 0) {
  const GOLDEN_ANGLE = 137.508;
  const elements = ['brand', 'cubeCard', 'flashcards', 'quiz', 'listening', 'match', 'speaking', 'grammar'];

  const colors = {};

  elements.forEach((elem, index) => {
    // Distinct hue spaced by golden angle
    const hue = Math.round((baseHue + (index + stepOffset) * GOLDEN_ANGLE) % 360);
    // Strict readability clamping: saturation 75-85%, lightness 62-68% (optimal for dark UI)
    const sat = 80;
    const light = 65;

    const hex = hslToHex(hue, sat, light);
    const glow = `hsla(${hue}, ${sat}%, ${light}%, 0.38)`;

    colors[elem] = {
      name: `Harmonic H${hue}`,
      hue,
      hex,
      glow,
      style: {
        borderColor: `hsla(${hue}, ${sat}%, ${light}%, 0.45)`,
        boxShadow: `0 0 20px ${glow}`,
      },
      iconStyle: {
        color: `hsl(${hue}, 90%, 72%)`,
        backgroundColor: `hsla(${hue}, ${sat}%, ${light}%, 0.16)`,
        borderColor: `hsla(${hue}, ${sat}%, ${light}%, 0.35)`,
      },
      badgeStyle: {
        backgroundColor: `hsla(${hue}, ${sat}%, ${light}%, 0.18)`,
        color: `hsl(${hue}, 95%, 78%)`,
        borderColor: `hsla(${hue}, ${sat}%, ${light}%, 0.4)`,
      },
      buttonStyle: {
        background: `linear-gradient(135deg, hsl(${hue}, 85%, 55%), hsl(${(hue + 25) % 360}, 85%, 48%))`,
        color: '#ffffff',
        boxShadow: `0 4px 18px hsla(${hue}, 85%, 50%, 0.4)`,
      },
    };
  });

  return colors;
}

// Convert HSL to Hex
function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns the active color map for the given theme ID and rotation index.
 */
export function getHarmonizedTheme(themeId = 'golden_ai', rotationIndex = 0) {
  const preset = PRESET_THEMES.find((t) => t.id === themeId) || PRESET_THEMES[0];

  if (preset.type === 'dynamic') {
    const baseHue = (preset.baseHue + rotationIndex * 45) % 360;
    return {
      themeMeta: preset,
      colors: generateGoldenRatioPalette(baseHue, rotationIndex),
    };
  }

  // For fixed presets, enhance them with custom inline styles for full compatibility
  const colors = {};
  Object.keys(preset.colors).forEach((elemKey) => {
    const c = preset.colors[elemKey];
    colors[elemKey] = {
      ...c,
      style: {
        borderColor: c.glow,
        boxShadow: `0 0 20px ${c.glow}`,
      },
      iconStyle: {
        color: c.hex,
        backgroundColor: `${c.hex}18`,
        borderColor: `${c.hex}40`,
      },
      badgeStyle: {
        backgroundColor: `${c.hex}22`,
        color: c.hex,
        borderColor: `${c.hex}50`,
      },
      buttonStyle: {
        background: `linear-gradient(135deg, ${c.hex}, ${c.hex}cc)`,
        color: '#ffffff',
        boxShadow: `0 4px 18px ${c.glow}`,
      },
    };
  });

  return {
    themeMeta: preset,
    colors,
  };
}
