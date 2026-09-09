// colorHarmonizer.js — Golden Ratio AI Color Harmonizer & Theme Presets
// Mathematically calculates harmonious color palettes using the Golden Angle (137.5°)
// for natural, high-aesthetic UI themes.

export const GOLDEN_ANGLE = 137.50776405003785;

export const PRESET_THEMES = [
  {
    id: 'golden_ai',
    name: 'Golden Ratio AI (Dynamic)',
    type: 'dynamic',
    baseHue: 245,
    description: 'Dynamic math-driven chromatic harmony based on the Golden Ratio.',
  },
  {
    id: 'cyberpunk',
    name: 'Cosmic Cyberpunk',
    type: 'fixed',
    description: 'High-contrast neon magenta, electric cyan, and laser violet.',
    colors: {
      brand: { hex: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', text: 'text-pink-400', bg: 'bg-pink-500/15', border: 'border-pink-500/40' },
      cubeCard: { hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      flashcards: { hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
      quiz: { hex: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', text: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/40' },
      listening: { hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      match: { hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      speaking: { hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { hex: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)', text: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
    },
  },
  {
    id: 'aurora',
    name: 'Emerald Aurora',
    type: 'fixed',
    description: 'Ethereal northern lights featuring deep jade, boreal mint, and turquoise.',
    colors: {
      brand: { hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
      cubeCard: { hex: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)', text: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      flashcards: { hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      quiz: { hex: '#84cc16', glow: 'rgba(132, 204, 22, 0.4)', text: 'text-lime-400', bg: 'bg-lime-500/15', border: 'border-lime-500/40' },
      listening: { hex: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)', text: 'text-teal-300', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      match: { hex: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', text: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40' },
      speaking: { hex: '#059669', glow: 'rgba(5, 150, 105, 0.4)', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
      grammar: { hex: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
    },
  },
  {
    id: 'sunset',
    name: 'Neo Sunset',
    type: 'fixed',
    description: 'Warm, intense dusk tones blending fiery crimson, solar amber, and dusk violet.',
    colors: {
      brand: { hex: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/40' },
      cubeCard: { hex: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40' },
      flashcards: { hex: '#d946ef', glow: 'rgba(217, 70, 239, 0.4)', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/40' },
      quiz: { hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      listening: { hex: '#fb7185', glow: 'rgba(251, 113, 133, 0.4)', text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      match: { hex: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
      speaking: { hex: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)', text: 'text-rose-500', bg: 'bg-rose-500/15', border: 'border-rose-500/40' },
      grammar: { hex: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
    },
  },
  {
    id: 'ocean',
    name: 'Abyssal Ocean',
    type: 'fixed',
    description: 'Deep oceanic blues, bioluminescent cyan, and pelagic indigos.',
    colors: {
      brand: { hex: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.4)', text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      cubeCard: { hex: '#0284c7', glow: 'rgba(2, 132, 199, 0.4)', text: 'text-sky-500', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      flashcards: { hex: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', text: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/40' },
      quiz: { hex: '#0d9488', glow: 'rgba(13, 148, 136, 0.4)', text: 'text-teal-500', bg: 'bg-teal-500/15', border: 'border-teal-500/40' },
      listening: { hex: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
      match: { hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40' },
      speaking: { hex: '#2563eb', glow: 'rgba(37, 99, 235, 0.4)', text: 'text-blue-500', bg: 'bg-blue-500/15', border: 'border-blue-500/40' },
      grammar: { hex: '#7dd3fc', glow: 'rgba(125, 211, 252, 0.4)', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/40' },
    },
  },
];

/**
 * Generates an 8-color palette based on the Golden Ratio offset from a base hue.
 */
export function generateGoldenRatioPalette(baseHue = 245, rotationIndex = 0) {
  const elements = [
    'brand',
    'cubeCard',
    'flashcards',
    'quiz',
    'listening',
    'match',
    'speaking',
    'grammar',
  ];

  const colors = {};
  const currentBase = (baseHue + rotationIndex * GOLDEN_ANGLE) % 360;

  elements.forEach((elem, index) => {
    const hue = Math.round((currentBase + index * GOLDEN_ANGLE) % 360);
    const sat = 85;
    const light = 60;
    const hex = hslToHex(hue, sat, light);
    const glow = `hsla(${hue}, ${sat}%, ${light}%, 0.4)`;

    colors[elem] = {
      name: `Harmonic H${hue}`,
      hue,
      hex,
      glow,
      text: `text-indigo-300`,
      bg: `bg-indigo-500/15`,
      border: `border-indigo-500/40`,
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
      brandStyle: {
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

  colors.badge = colors.brand;
  colors.flashCards = colors.flashcards;
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
    const badge = {
      backgroundColor: `${c.hex}22`,
      color: c.hex,
      borderColor: `${c.hex}50`,
    };
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
      badgeStyle: badge,
      brandStyle: badge,
      buttonStyle: {
        background: `linear-gradient(135deg, ${c.hex}, ${c.hex}cc)`,
        color: '#ffffff',
        boxShadow: `0 4px 18px ${c.glow}`,
      },
    };
  });

  colors.badge = colors.brand;
  colors.flashCards = colors.flashcards;
  return {
    themeMeta: preset,
    colors,
  };
}