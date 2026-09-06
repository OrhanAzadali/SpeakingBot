import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  playRotateSound,
  playMoveSound,
  playLandSound,
  playMagicWordDisappearSound,
  playGameOverSound,
  pronounceWordVoice,
  startAquaticMusic,
  stopAquaticMusic,
  toggleAquaticMusic,
  isAquaticMusicActive,
  resumeAudioAndMusic,
  setAquaticComboWord,
  getAquaticMood,
} from './soundEffects.js';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Zap,
  Volume2,
  VolumeX,
  Flame,
  MoveHorizontal,
  Hand,
  Gauge,
  Waves,
  Target,
  ChevronRight,
} from 'lucide-react';

const CUBE_FACES = ['front', 'right', 'back', 'left', 'top', 'bottom'];

// Target Euler rotations to present each face directly toward camera (+Z)
const FACE_ROTATIONS = {
  front: { x: 0, y: 0 },
  right: { x: 0, y: -Math.PI / 2 },
  back: { x: 0, y: Math.PI },
  left: { x: 0, y: Math.PI / 2 },
  top: { x: Math.PI / 2, y: 0 },
  bottom: { x: -Math.PI / 2, y: 0 },
};

// Rich, high-contrast, vivid palettes for the 6 faces
const FACE_PALETTES = {
  front: {
    name: 'Front',
    light: '#3b82f6',
    dark: '#1d4ed8',
    border: '#93c5fd',
    accent: '#60a5fa',
    textColor: '#ffffff',
    tagBg: '#1e3a8a',
    badgeText: '#bfdbfe',
    cssBg: 'from-blue-600 to-indigo-600',
    cssText: 'text-blue-300',
  },
  right: {
    name: 'Right',
    light: '#c026d3',
    dark: '#7e22ce',
    border: '#f0abfc',
    accent: '#e879f9',
    textColor: '#ffffff',
    tagBg: '#581c87',
    badgeText: '#f5d0fe',
    cssBg: 'from-fuchsia-600 to-purple-600',
    cssText: 'text-fuchsia-300',
  },
  back: {
    name: 'Back',
    light: '#10b981',
    dark: '#047857',
    border: '#a7f3d0',
    accent: '#6ee7b7',
    textColor: '#ffffff',
    tagBg: '#064e3b',
    badgeText: '#a7f3d0',
    cssBg: 'from-emerald-600 to-teal-600',
    cssText: 'text-emerald-300',
  },
  left: {
    name: 'Left',
    light: '#f59e0b',
    dark: '#b45309',
    border: '#fde68a',
    accent: '#fbbf24',
    textColor: '#ffffff',
    tagBg: '#78350f',
    badgeText: '#fef08a',
    cssBg: 'from-amber-500 to-orange-600',
    cssText: 'text-amber-300',
  },
  top: {
    name: 'Top',
    light: '#f43f5e',
    dark: '#be123c',
    border: '#fecdd3',
    accent: '#fb7185',
    textColor: '#ffffff',
    tagBg: '#881337',
    badgeText: '#ffe4e6',
    cssBg: 'from-rose-600 to-pink-600',
    cssText: 'text-rose-300',
  },
  bottom: {
    name: 'Bottom',
    light: '#06b6d4',
    dark: '#0e7490',
    border: '#a5f3fc',
    accent: '#38bdf8',
    textColor: '#ffffff',
    tagBg: '#164e63',
    badgeText: '#cffafe',
    cssBg: 'from-cyan-500 to-blue-500',
    cssText: 'text-cyan-300',
  },
};

// Generate high-resolution, ultra-crisp 512x512 2D canvas texture for a cube face
function createLetterTexture(letter, faceName) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const p = FACE_PALETTES[faceName] || FACE_PALETTES.front;

  // 1. Rich, luminous jewel-tone gradient background
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, p.light);
  grad.addColorStop(0.7, p.dark);
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Thick metallic bevel border
  ctx.lineWidth = 26;
  ctx.strokeStyle = p.border;
  ctx.strokeRect(13, 13, 486, 486);

  // 3. Inner bright neon pinstripe
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(34, 34, 444, 444);

  // 4. Subtle corner metallic rivets/studs
  const drawStud = (x, y) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.accent;
    ctx.stroke();
  };
  drawStud(50, 50);
  drawStud(462, 50);
  drawStud(50, 462);
  drawStud(462, 462);

  // 5. Glossy diagonal sheen on top-left quadrant
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(34, 34);
  ctx.lineTo(478, 34);
  ctx.lineTo(34, 320);
  ctx.closePath();
  const sheen = ctx.createLinearGradient(34, 34, 400, 300);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.restore();

  // 6. High-contrast bold typography for maximum readability
  const char = (letter || '?').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 270px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  // Deep dark shadow for clear 3D separation
  ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 14;

  // Solid dark outline around the letter for extreme legibility from all angles
  ctx.lineWidth = 28;
  ctx.strokeStyle = '#020617';
  ctx.strokeText(char, 256, 268);

  // Pure bright white fill
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(char, 256, 268);

  // 7. Corner face name badge (e.g. "FRONT", "TOP")
  ctx.save();
  const tagText = (p.name || faceName).toUpperCase();
  ctx.font = '800 24px "Plus Jakarta Sans", monospace';
  const tagMetrics = ctx.measureText(tagText);
  const tagW = tagMetrics.width + 24;
  const tagH = 34;
  const tagX = 478 - tagW - 14;
  const tagY = 478 - tagH - 14;

  // Pill box
  ctx.fillStyle = p.tagBg;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagW, tagH, 17);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = p.accent;
  ctx.stroke();

  // Pill text
  ctx.fillStyle = p.badgeText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, tagX + tagW / 2, tagY + tagH / 2 + 1);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Generate high-contrast, ultra-clean 2D floor tile texture showing ONLY the ultimately chosen letter
function create2DTileTexture(letter, faceName) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const p = FACE_PALETTES[faceName] || FACE_PALETTES.front;

  // 1. Sleek jewel-tone gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, p.light);
  grad.addColorStop(1, p.dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Thick luminous metallic border
  ctx.lineWidth = 26;
  ctx.strokeStyle = p.border;
  ctx.strokeRect(13, 13, 486, 486);

  // 3. Inner fine neon border
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(34, 34, 444, 444);

  // 4. Subtle corner studs
  const drawStud = (x, y) => {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.accent;
    ctx.stroke();
  };
  drawStud(52, 52);
  drawStud(460, 52);
  drawStud(52, 460);
  drawStud(460, 460);

  // 5. Giant, ultra-crisp chosen letter centered on the 2D floor tile
  const char = (letter || '?').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 290px "Plus Jakarta Sans", -apple-system, sans-serif';

  // Deep drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;

  // Solid dark outline around the letter for extreme legibility
  ctx.lineWidth = 30;
  ctx.strokeStyle = '#020617';
  ctx.strokeText(char, 256, 266);

  // Pure bright white fill
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(char, 256, 266);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Build 2D flat floor tile mesh (thin 2D slab with the chosen letter face facing forward)
function create2DTileMesh(letter, faceName, unitSize) {
  const tileGeo = new THREE.BoxGeometry(unitSize * 0.98, unitSize * 0.98, 0.05);
  const texture = create2DTileTexture(letter, faceName);

  const frontMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.15,
    metalness: 0.12,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x071126,
    roughness: 0.4,
    metalness: 0.2,
  });

  // Material order for BoxGeometry: [right, left, top, bottom, front, back]
  const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
  const mesh = new THREE.Mesh(tileGeo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const ThreeCubeWordCanvas = ({
  language = 'english',
  round = 1,
  onRoundWin,
  onGameOver,
  onWordDiscovered,
  soundEnabled = true,
  onToggleSound,
  recentWordsHistory = [],
  apiBase = '',
}) => {
  const containerRef = useRef(null);

  // Game rules:
  // Round 1: 8 columns (combo word max length: 8 letters)
  // Round 2: 9 columns (combo word max length: 9 letters)
  // Round 3+: 10 columns (combo word max length: 10 letters — the widest that
  // still comfortably fits on screen)
  const gridCols = round === 1 ? 8 : (round === 2 ? 9 : 10);
  const gridRows = 12;
  // Combo/target words must fit the current round's grid width, so the
  // server is always asked for words no longer than gridCols letters.
  const comboWordMaxLength = gridCols;
  const comboWordMinLength = Math.max(4, comboWordMaxLength - 3);

  // Speed mode state: 'normal' (standard brisk flow) | 'relaxed' | 'brisk'
  const [speedMode, setSpeedMode] = useState('normal');

  // Accelerated, dynamic fall speed (ms per vertical step down).
  // Adjusted for faster, more engaging flow as requested by user.
  const getRoundBaseInterval = (r) => {
    switch (r) {
      case 1:
        return 1400; // 1.4s base for Round 1 (accelerated)
      case 2:
        return 1150; // 1.15s base for Round 2
      case 3:
        return 950;  // 0.95s base for Round 3
      case 4:
        return 800;  // 0.8s base for Round 4
      default:
        return Math.max(480, 800 - (r - 4) * 80);
    }
  };

  const speedMultiplier = speedMode === 'relaxed' ? 1.25 : (speedMode === 'brisk' ? 0.7 : 1.0);
  const fallIntervalMs = Math.round(getRoundBaseInterval(round) * speedMultiplier);
  const targetWordsForRound = round * 15; // 15, 30, 45...

  // Initial combo word shown before the server responds (round-1 sized: <= 8
  // letters, any everyday topic — not tied to the aquatic music theme)
  const INITIAL_COMBO_WORDS = {
    english: { word: 'ADVENTURE'.slice(0, 8), meaning: 'An exciting journey', hint: 'A bold, exciting undertaking', emoji: '🔤' },
    russian: { word: 'ДРУЖБА', meaning: 'Близость между людьми', hint: 'Связь между хорошими друзьями', emoji: '🔤' },
    spanish: { word: 'AMISTAD', meaning: 'Vínculo cercano', hint: 'Lo que comparten los amigos', emoji: '🔤' },
    german: { word: 'FREUNDE', meaning: 'Enge Verbindung', hint: 'Was gute Freunde verbindet', emoji: '🔤' },
    french: { word: 'AMITIE', meaning: 'Lien étroit', hint: 'Ce que partagent les amis', emoji: '🔤' },
    italian: { word: 'AMICIZIA'.slice(0, 8), meaning: 'Legame stretto', hint: 'Ciò che unisce gli amici', emoji: '🔤' },
  };

  // Curated & Dynamic AI Special Bonus Word Quests (sized to the round's grid)
  const [targetQuest, setTargetQuest] = useState(() => {
    const init = INITIAL_COMBO_WORDS[language] || INITIAL_COMBO_WORDS.english;
    setAquaticComboWord(init.word);
    return init;
  });
  const targetQuestRef = useRef(targetQuest);
  targetQuestRef.current = targetQuest;
  const [questList, setQuestList] = useState([]);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isMusicActive, setIsMusicActive] = useState(true);
  const [aquaticMood, setAquaticMood] = useState(() => getAquaticMood());

  // Fetch initial target quests for the selected language, sized to the
  // current round's grid width, and pick a random one so it's fresh each time
  useEffect(() => {
    fetch(`${apiBase}/api/cubeword/target-words?language=${encodeURIComponent(language)}&minLength=${comboWordMinLength}&maxLength=${comboWordMaxLength}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.quests && data.quests.length > 0) {
          setQuestList(data.quests);
          // Pick a random quest so it's fresh each time
          const randomIndex = Math.floor(Math.random() * data.quests.length);
          const chosenQuest = data.quests[randomIndex];
          setTargetQuest(chosenQuest);
          const newMood = setAquaticComboWord(chosenQuest.word);
          setAquaticMood(newMood);
        }
      })
      .catch(() => { });
  }, [language, comboWordMinLength, comboWordMaxLength]);

  // Clean up aquatic music on unmount
  useEffect(() => {
    return () => {
      stopAquaticMusic();
    };
  }, []);

  // Auto-start relaxing background music on first user click, tap, or key interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      resumeAudioAndMusic();
      if (isMusicActive) {
        startAquaticMusic();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isMusicActive]);

  const advanceTargetQuest = useCallback(() => {
    if (questList.length > 0) {
      setTargetQuest((curr) => {
        const currIdx = questList.findIndex((q) => q.word === curr?.word);
        const nextIdx = (currIdx + 1) % questList.length;
        const nextQuest = questList[nextIdx];
        const newMood = setAquaticComboWord(nextQuest.word);
        setAquaticMood(newMood);
        return nextQuest;
      });
    }
  }, [questList]);

  // On-demand AI Combo Word Generator — any topic, sized to the round's grid.
  // Dynamically alters the background music harmony to match the new word!
  const fetchAiSpecialWord = useCallback(async () => {
    setIsGeneratingWord(true);
    try {
      const res = await fetch(`${apiBase}/api/cubeword/generate-special-word?language=${encodeURIComponent(language)}&minLength=${comboWordMinLength}&maxLength=${comboWordMaxLength}`);
      const data = await res.json();
      if (data?.quest?.word && data.quest.word.length >= comboWordMinLength && data.quest.word.length <= comboWordMaxLength) {
        setTargetQuest(data.quest);
        const newMood = setAquaticComboWord(data.quest.word);
        setAquaticMood(newMood);
        flashAnnouncement(
          `✨ New Combo Word: «${data.quest.word}»! Melody shifted to ${newMood.name}`,
          'magic',
          4500
        );
      } else {
        advanceTargetQuest();
      }
    } catch {
      advanceTargetQuest();
    } finally {
      setIsGeneratingWord(false);
    }
  }, [language, advanceTargetQuest]);

  // UI state
  const [roundScore, setRoundScore] = useState(0);
  const [wordsClearedCount, setWordsClearedCount] = useState(0);
  const [isGameOverState, setIsGameOverState] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [activeFaceName, setActiveFaceName] = useState('front');
  const [activeLetter, setActiveLetter] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Anti-repetition word memory across 3 rounds
  const [sessionRecentWords, setSessionRecentWords] = useState(recentWordsHistory);

  // Refs for 3D state & game loop
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const ghostMeshRef = useRef(null);
  const activeCubeLightRef = useRef(null);
  const pointerParallaxRef = useRef({ x: 0, y: 0 });

  const gridDataRef = useRef(
    Array.from({ length: gridRows }, () => Array(gridCols).fill(null))
  );

  const activeBlockRef = useRef(null);
  const isGameOverRef = useRef(false);
  isGameOverRef.current = isGameOverState;
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  const isVerifyingRef = useRef(false);

  // Pointer drag tracking refs
  const isDraggingRef = useRef(false);
  const dragPointerStartRef = useRef({ x: 0, y: 0, time: 0 });
  const hasMovedColRef = useRef(false);

  // Unit spacing in Three.js coordinate space
  const UNIT_SIZE = 1.0;
  const GAP = 0.08;
  const TOTAL_BLOCK_SIZE = UNIT_SIZE + GAP;

  // Converts grid [row, col] to 3D position [x, y, z]
  const gridToWorldPos = (row, col) => {
    const startX = -((gridCols - 1) * TOTAL_BLOCK_SIZE) / 2;
    const startY = ((gridRows - 1) * TOTAL_BLOCK_SIZE) / 2;
    const x = startX + col * TOTAL_BLOCK_SIZE;
    const y = startY - row * TOTAL_BLOCK_SIZE;
    return { x, y, z: 0 };
  };

  const flashAnnouncement = (text, type = 'info', duration = 3000) => {
    setAnnouncement({ text, type });
    setTimeout(() => {
      setAnnouncement((curr) => (curr?.text === text ? null : curr));
    }, duration);
  };

  // Helper to build 3D mesh with 6 materials for the 6 faces
  const createCubeMesh = (faces) => {
    const materials = [
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.right, 'right'),
        roughness: 0.18,
        metalness: 0.08,
      }),
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.left, 'left'),
        roughness: 0.18,
        metalness: 0.08,
      }),
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.top, 'top'),
        roughness: 0.18,
        metalness: 0.08,
      }),
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.bottom, 'bottom'),
        roughness: 0.18,
        metalness: 0.08,
      }),
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.front, 'front'),
        roughness: 0.18,
        metalness: 0.08,
      }),
      new THREE.MeshStandardMaterial({
        map: createLetterTexture(faces.back, 'back'),
        roughness: 0.18,
        metalness: 0.08,
      }),
    ];

    const geometry = new THREE.BoxGeometry(UNIT_SIZE, UNIT_SIZE, UNIT_SIZE);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Spawn new falling block
  const spawnBlock = useCallback(async () => {
    if (isGameOverRef.current || !sceneRef.current) return;

    let faces;
    const targetWord = targetQuestRef.current?.word || '';
    try {
      const targetParam = targetWord ? `&targetWord=${encodeURIComponent(targetWord)}` : '';
      const res = await fetch(`${apiBase}/api/cubeword/block-faces?language=${encodeURIComponent(language)}${targetParam}`);
      if (res.ok) {
        const data = await res.json();
        faces = data.faces;
      } else {
        throw new Error('Fallback faces');
      }
    } catch {
      const vowels = ['A', 'E', 'I', 'O', 'U'];
      const consonants = ['T', 'N', 'S', 'R', 'L', 'D', 'C', 'M', 'P', 'B', 'K', 'G', 'F', 'V'];
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      faces = {
        front: targetWord ? targetWord[Math.floor(Math.random() * targetWord.length)] : pick(vowels),
        back: pick(consonants),
        top: pick(consonants),
        bottom: pick(vowels),
        left: pick(consonants),
        right: pick(consonants),
      };
    }

    const startCol = Math.floor(gridCols / 2) - 1;

    // Check if ceiling reached (game over)
    if (gridDataRef.current[0][startCol] !== null || gridDataRef.current[0][startCol + 1] !== null) {
      triggerGameOver();
      return;
    }

    const mesh = createCubeMesh(faces);
    const { x, y } = gridToWorldPos(0, startCol);
    mesh.position.set(x, y + 1.2, 0);
    sceneRef.current.add(mesh);

    const block = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      faces,
      selectedFace: 'front',
      col: startCol,
      row: 0,
      mesh,
      targetRotation: { x: 0, y: 0 },
      isSettled: false,
    };

    activeBlockRef.current = block;
    setActiveFaceName('front');
    setActiveLetter(faces.front);
  }, [gridCols, language]);

  const triggerGameOver = () => {
    setIsGameOverState(true);
    if (soundEnabled) playGameOverSound();
    flashAnnouncement('💥 Ceiling reached! Unformed heaps overflowed!', 'warning', 4500);
    if (onGameOver) onGameOver();
  };

  // Smooth face rotation around axis
  const rotateActiveFace = useCallback(() => {
    const block = activeBlockRef.current;
    if (!block || isPausedRef.current || isGameOverRef.current) return;

    const currentFace = block.selectedFace;
    const nextIdx = (CUBE_FACES.indexOf(currentFace) + 1) % CUBE_FACES.length;
    const nextFace = CUBE_FACES[nextIdx];

    block.selectedFace = nextFace;
    block.targetRotation = FACE_ROTATIONS[nextFace];
    setActiveFaceName(nextFace);
    setActiveLetter(block.faces[nextFace]);

    // Dynamic 3D tactile pulse on rotation
    if (block.mesh) {
      block.mesh.scale.set(1.14, 1.14, 1.14);
    }

    if (soundEnabled) playRotateSound();
  }, [soundEnabled]);

  // Horizontal movement
  const moveHorizontal = useCallback((dir) => {
    const block = activeBlockRef.current;
    if (!block || isPausedRef.current || isGameOverRef.current) return;

    const nextCol = block.col + dir;
    if (nextCol < 0 || nextCol >= gridCols) return;

    // Collision with settled block
    if (gridDataRef.current[block.row][nextCol] !== null) return;

    block.col = nextCol;
    if (soundEnabled) playMoveSound();
  }, [gridCols, soundEnabled]);

  // Smooth slide to target column (for mouse drag)
  const slideToColumn = useCallback((targetCol) => {
    const block = activeBlockRef.current;
    if (!block || isPausedRef.current || isGameOverRef.current) return;
    if (targetCol === block.col) return;

    const direction = targetCol > block.col ? 1 : -1;
    let candidate = block.col;

    while (candidate !== targetCol) {
      const nextCandidate = candidate + direction;
      if (nextCandidate < 0 || nextCandidate >= gridCols) break;
      // Check collision with settled blocks at current row
      if (gridDataRef.current[block.row][nextCandidate] !== null) break;
      candidate = nextCandidate;
    }

    if (candidate !== block.col) {
      block.col = candidate;
      hasMovedColRef.current = true;
      if (soundEnabled) playMoveSound();
    }
  }, [gridCols, soundEnabled]);

  // Step down
  const moveDown = useCallback(() => {
    const block = activeBlockRef.current;
    if (!block || isPausedRef.current || isGameOverRef.current) return false;

    const nextRow = block.row + 1;

    // Check floor or hit block below
    if (nextRow >= gridRows || gridDataRef.current[nextRow][block.col] !== null) {
      settleActiveBlock(block);
      return false;
    }

    block.row = nextRow;
    return true;
  }, [gridRows]);

  // Hard drop to floor/heap
  const hardDrop = useCallback(() => {
    const block = activeBlockRef.current;
    if (!block || isPausedRef.current || isGameOverRef.current) return;

    let targetRow = block.row;
    while (targetRow + 1 < gridRows && gridDataRef.current[targetRow + 1][block.col] === null) {
      targetRow++;
    }

    block.row = targetRow;
    settleActiveBlock(block);
  }, [gridRows]);

  // Settle block into grid and trigger AI word evaluation
  const settleActiveBlock = async (block) => {
    activeBlockRef.current = null;
    setActiveLetter('');
    if (soundEnabled) playLandSound();

    const chosenFace = block.selectedFace;
    const chosenLetter = block.faces[chosenFace];

    // Convert settled block to 2D floor tile showing ONLY the ultimately chosen letter
    if (block.mesh && sceneRef.current) {
      sceneRef.current.remove(block.mesh);
      if (block.mesh.geometry) block.mesh.geometry.dispose();
      if (Array.isArray(block.mesh.material)) {
        block.mesh.material.forEach((m) => m.dispose());
      }
    }

    // Build flat 2D tile mesh positioned cleanly in the arena grid
    const tileMesh = create2DTileMesh(chosenLetter, chosenFace, UNIT_SIZE);
    const { x, y } = gridToWorldPos(block.row, block.col);
    tileMesh.position.set(x, y, 0);
    tileMesh.rotation.set(0, 0, 0);
    sceneRef.current.add(tileMesh);
    block.mesh = tileMesh;
    block.is2DTile = true;

    // Ceiling condition: if settled on row 0, player forfeits round
    if (block.row === 0) {
      triggerGameOver();
      return;
    }

    gridDataRef.current[block.row][block.col] = block;

    // Scan for contiguous words horizontally (left to right) and vertically (top to down)
    await scanGridForWords();

    if (!isGameOverRef.current) {
      setTimeout(() => {
        spawnBlock();
      }, 180);
    }
  };

  // Scan grid for valid words in both horizontal (rows) and vertical (columns, top to down) directions
  const scanGridForWords = async () => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    try {
      // 1. Horizontal scan across rows (bottom up)
      for (let r = gridRows - 1; r >= 0; r--) {
        const row = gridDataRef.current[r];

        let startCol = -1;
        for (let c = 0; c <= gridCols; c++) {
          const hasBlock = c < gridCols && row[c] !== null;

          if (hasBlock && startCol === -1) {
            startCol = c;
          } else if (!hasBlock && startCol !== -1) {
            const endCol = c - 1;
            const seqLength = endCol - startCol + 1;

            if (seqLength >= 3) {
              const blocksSeq = row.slice(startCol, endCol + 1);
              const fullString = blocksSeq.map((b) => b.faces[b.selectedFace]).join('').toUpperCase();

              for (let len = seqLength; len >= 3; len--) {
                for (let offset = 0; offset <= seqLength - len; offset++) {
                  const candidateWord = fullString.slice(offset, offset + len);
                  const candidateBlocks = blocksSeq.slice(offset, offset + len);

                  // Verify candidate with AI
                  const verification = await verifyWordWithAI(candidateWord);

                  if (verification.isValid) {
                    await handleWordDisappearingMagic(verification, candidateBlocks, { type: 'horizontal', row: r });
                    isVerifyingRef.current = false;
                    return; // Re-scan after gravity collapse
                  }
                }
              }
            }
            startCol = -1;
          }
        }
      }

      // 2. Vertical scan down columns (top to down: reading letters from top to bottom)
      for (let c = 0; c < gridCols; c++) {
        let startRow = -1;
        for (let r = 0; r <= gridRows; r++) {
          const hasBlock = r < gridRows && gridDataRef.current[r][c] !== null;

          if (hasBlock && startRow === -1) {
            startRow = r;
          } else if (!hasBlock && startRow !== -1) {
            const endRow = r - 1;
            const seqLength = endRow - startRow + 1;

            if (seqLength >= 3) {
              const blocksSeq = [];
              for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
                blocksSeq.push(gridDataRef.current[rowIdx][c]);
              }
              const fullString = blocksSeq.map((b) => b.faces[b.selectedFace]).join('').toUpperCase();

              for (let len = seqLength; len >= 3; len--) {
                for (let offset = 0; offset <= seqLength - len; offset++) {
                  const candidateWord = fullString.slice(offset, offset + len);
                  const candidateBlocks = blocksSeq.slice(offset, offset + len);

                  // Verify candidate with AI
                  const verification = await verifyWordWithAI(candidateWord);

                  if (verification.isValid) {
                    await handleWordDisappearingMagic(verification, candidateBlocks, { type: 'vertical', col: c });
                    isVerifyingRef.current = false;
                    return; // Re-scan after gravity collapse
                  }
                }
              }
            }
            startRow = -1;
          }
        }
      }
    } finally {
      isVerifyingRef.current = false;
    }
  };

  // Call Server AI validation endpoint
  const verifyWordWithAI = async (word) => {
    try {
      const res = await fetch(`${apiBase}/api/cubeword/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          language,
          recentWords: sessionRecentWords,
          round,
          targetWord: targetQuestRef.current?.word || '',
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('AI Verification failed:', err);
    }

    return {
      isValid: false,
      word,
      reason: 'unverified',
      points: 0,
      bonusMultiplier: 1,
    };
  };

  // Word Matched: Magic Blinking Animation, Native Voice Pronunciation, and Disappearance
  const handleWordDisappearingMagic = async (verification, matchedBlocks, direction = { type: 'horizontal' }) => {
    const word = verification.word;

    // 1. Native voice distinctively pronounces the word in target language
    if (soundEnabled) {
      pronounceWordVoice(word, language);
    }

    // 2. Play magical arpeggio chime sound
    if (soundEnabled) {
      playMagicWordDisappearSound(verification.bonusMultiplier > 1);
    }

    const isTargetMatch = targetQuestRef.current?.word && word.toUpperCase() === targetQuestRef.current.word.toUpperCase();

    // Calculate points gained according to user rule:
    // "IF FOUND MULTIPLIES THE POINTS BY 5 IF ANY EXIST OR IF NON ADD UP 500 POINTS TO THE USERS POINTS"
    let pointsToAdd = verification.points;
    if (isTargetMatch) {
      if (roundScore > 0) {
        const multipliedTotal = roundScore * 5;
        pointsToAdd = Math.max(multipliedTotal - roundScore, 500);
      } else {
        pointsToAdd = 500;
      }
      verification.points = pointsToAdd;
      verification.bonusMultiplier = 5;

      flashAnnouncement(
        `🌟 8+ LETTER SPECIAL WORD CRACKED! «${word}»! MULTIPLIED BY 5X (+${pointsToAdd} pts)!`,
        'magic',
        5000
      );
      // Immediately regenerate a fresh 8+ letter combo word and shift the aquatic harmony!
      fetchAiSpecialWord();
    } else {
      const isCombo = verification.bonusMultiplier > 1;
      const dirLabel = direction?.type === 'vertical' ? ' (Vertical)' : '';
      flashAnnouncement(
        `✨ «${word}»${dirLabel}! +${verification.points} pts ${isCombo ? '(2X COMBO!)' : ''}`,
        'magic',
        3500
      );
    }

    // 3. Magic Blinking Animation: pulse emissive material several times
    for (let flash = 0; flash < 4; flash++) {
      matchedBlocks.forEach((b) => {
        const mats = Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material];
        mats.forEach((mat) => {
          if (mat.emissive) {
            mat.emissive.setHex(0xfbbf24); // Glowing bright amber/gold
            mat.emissiveIntensity = 2.2;
          }
        });
      });
      await new Promise((r) => setTimeout(r, 120));

      matchedBlocks.forEach((b) => {
        const mats = Array.isArray(b.mesh.material) ? b.mesh.material : [b.mesh.material];
        mats.forEach((mat) => {
          if (mat.emissive) {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        });
      });
      await new Promise((r) => setTimeout(r, 100));
    }

    // 4. Shrink & disappear into ether
    for (let scale = 1.0; scale >= 0.05; scale -= 0.15) {
      matchedBlocks.forEach((b) => {
        b.mesh.scale.set(scale, scale, scale);
      });
      await new Promise((r) => setTimeout(r, 20));
    }

    // Remove meshes from 3D scene
    matchedBlocks.forEach((b) => {
      sceneRef.current.remove(b.mesh);
      gridDataRef.current[b.row][b.col] = null;
    });

    // 5. Gravity: upper blocks collapse downward into vacant spaces
    const affectedCols = new Set(matchedBlocks.map((b) => b.col));
    affectedCols.forEach((col) => {
      const remaining = [];
      for (let r = gridRows - 1; r >= 0; r--) {
        const cell = gridDataRef.current[r][col];
        if (cell !== null) {
          remaining.push(cell);
          gridDataRef.current[r][col] = null;
        }
      }

      remaining.forEach((block, idx) => {
        const targetRow = gridRows - 1 - idx;
        block.row = targetRow;
        gridDataRef.current[targetRow][col] = block;

        // Animate 3D position down
        const { x, y } = gridToWorldPos(targetRow, col);
        block.mesh.position.set(x, y, 0);
      });
    });

    // 6. Update score, word history, and progress
    const newWordsCount = wordsClearedCount + 1;
    const newScore = roundScore + verification.points;
    setWordsClearedCount(newWordsCount);
    setRoundScore(newScore);

    // Anti-repetition: update sliding history
    setSessionRecentWords((prev) => [word, ...prev.slice(0, 44)]);
    if (onWordDiscovered) onWordDiscovered(verification);

    // 7. Check round win condition (15 words in round 1, +15 each next round)
    if (newWordsCount >= targetWordsForRound) {
      flashAnnouncement(`🏆 Round ${round} Complete! ${newWordsCount} words recognized!`, 'magic', 4000);
      if (onRoundWin) onRoundWin(round + 1, newScore);
    }
  };

  // Convert mouse/pointer client coords to Grid Column via 3D Raycasting
  const getColFromPointer = (clientX, clientY) => {
    const container = containerRef.current;
    if (!container || !cameraRef.current) return null;
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();

    if (raycaster.ray.intersectPlane(plane, intersection)) {
      const startX = -((gridCols - 1) * TOTAL_BLOCK_SIZE) / 2;
      const colIndex = Math.round((intersection.x - startX) / TOTAL_BLOCK_SIZE);
      return Math.max(0, Math.min(gridCols - 1, colIndex));
    }
    return null;
  };

  // Pointer Down (Mouse click / Touch start)
  const handlePointerDown = (e) => {
    if (isGameOverState || isPaused) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    hasMovedColRef.current = false;
    dragPointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };

    if (e.target && e.target.setPointerCapture) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    // Immediately evaluate column if clicked on arena
    const col = getColFromPointer(e.clientX, e.clientY);
    if (col !== null) {
      slideToColumn(col);
    }
  };

  // Pointer Move (Mouse Drag / Touch Move & 3D Parallax)
  const handlePointerMove = (e) => {
    // Continuous 3D camera parallax tracking
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      pointerParallaxRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: -((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    }

    if (!isDraggingRef.current || isGameOverState || isPaused) return;

    const dx = e.clientX - dragPointerStartRef.current.x;
    const dy = e.clientY - dragPointerStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const col = getColFromPointer(e.clientX, e.clientY);
      if (col !== null) {
        slideToColumn(col);
      }
    }
  };

  // Pointer Up (End Drag or Detect Quick Click to Rotate)
  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (e.target && e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    const elapsed = Date.now() - dragPointerStartRef.current.time;
    const dist = Math.hypot(
      e.clientX - dragPointerStartRef.current.x,
      e.clientY - dragPointerStartRef.current.y
    );

    // If rapid click without significant drag displacement -> rotate cube face!
    if (dist < 8 && elapsed < 350 && !hasMovedColRef.current) {
      rotateActiveFace();
    }
    hasMovedColRef.current = false;
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    hasMovedColRef.current = false;
  };

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isGameOverState || isPaused) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          moveHorizontal(-1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          moveHorizontal(1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'r':
        case 'R':
          e.preventDefault();
          rotateActiveFace();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          moveDown();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsPaused((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveHorizontal, rotateActiveFace, moveDown, hardDrop, isGameOverState, isPaused]);

  // Main game tick interval - continuous rhythmic descent without freeze during rotation or drag
  useEffect(() => {
    if (isGameOverState || isPaused) return;

    const timer = setInterval(() => {
      moveDown();
    }, fallIntervalMs);

    return () => clearInterval(timer);
  }, [moveDown, fallIntervalMs, isGameOverState, isPaused]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset grid
    gridDataRef.current = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
    setIsGameOverState(false);
    setRoundScore(0);
    setWordsClearedCount(0);

    // Scene with deep vibrant midnight blue background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020713);
    sceneRef.current = scene;

    // Camera with closer auto-framing calculation so blocks are larger & distinct on both mobile and desktop
    const width = container.clientWidth || 560;
    const height = container.clientHeight || 640;
    const aspect = width / height;
    const fov = 44;
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);

    const chamberW = gridCols * TOTAL_BLOCK_SIZE;
    const chamberH = gridRows * TOTAL_BLOCK_SIZE;
    const fovRad = (fov * Math.PI) / 180;
    const zH = (chamberH / 2) / Math.tan(fovRad / 2) + 0.15;
    const zW = (chamberW / 2) / (Math.tan(fovRad / 2) * aspect) + 0.15;
    camera.position.set(0, 0, Math.max(zH, zW));
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x7dd3fc, 1.4);
    dirLight.position.set(6, 14, 12);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const backPointLight = new THREE.PointLight(0xe879f9, 1.1, 25);
    backPointLight.position.set(-7, -4, 5);
    scene.add(backPointLight);

    const goldPointLight = new THREE.PointLight(0xfbbf24, 0.9, 20);
    goldPointLight.position.set(7, 4, 6);
    scene.add(goldPointLight);

    // Dynamic Tracking Point Light for active falling cube
    const activeCubeLight = new THREE.PointLight(0x38bdf8, 2.4, 12);
    activeCubeLight.position.set(0, 0, 2);
    scene.add(activeCubeLight);
    activeCubeLightRef.current = activeCubeLight;

    // Grid Chamber Bounds
    const chamberWidth = gridCols * TOTAL_BLOCK_SIZE;
    const chamberHeight = gridRows * TOTAL_BLOCK_SIZE;

    // Backboard with glowing column lane dividers for extreme legibility
    const backWallGeo = new THREE.PlaneGeometry(chamberWidth + 0.3, chamberHeight + 0.4);
    const backWallMat = new THREE.MeshBasicMaterial({
      color: 0x050e24,
      side: THREE.DoubleSide,
    });
    const backWallMesh = new THREE.Mesh(backWallGeo, backWallMat);
    backWallMesh.position.set(0, 0, -0.65);
    scene.add(backWallMesh);

    // Column lane lines on backboard
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.85,
    });
    for (let c = 0; c <= gridCols; c++) {
      const lineX = -chamberWidth / 2 + c * TOTAL_BLOCK_SIZE;
      const points = [
        new THREE.Vector3(lineX, -chamberHeight / 2, -0.63),
        new THREE.Vector3(lineX, chamberHeight / 2, -0.63),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
    }

    // Floor platform with vibrant cyan/amber neon border
    const floorGeo = new THREE.BoxGeometry(chamberWidth + 0.5, 0.28, 2.6);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.3,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -chamberHeight / 2 - 0.14, 0);
    scene.add(floorMesh);

    // Floor glowing rim
    const floorRimGeo = new THREE.BoxGeometry(chamberWidth + 0.52, 0.05, 0.1);
    const floorRimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const floorRim = new THREE.Mesh(floorRimGeo, floorRimMat);
    floorRim.position.set(0, -chamberHeight / 2, 1.25);
    scene.add(floorRim);

    // Ceiling laser hazard indicator line
    const ceilGeo = new THREE.BoxGeometry(chamberWidth, 0.06, 0.2);
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    const ceilY = chamberHeight / 2 - TOTAL_BLOCK_SIZE / 2;
    ceilMesh.position.set(0, ceilY, 0.6);
    scene.add(ceilMesh);

    // Ghost landing projection mesh (indicates where the dragged cube will land)
    const ghostGeo = new THREE.BoxGeometry(UNIT_SIZE * 0.96, UNIT_SIZE * 0.96, UNIT_SIZE * 0.96);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);
    ghostMeshRef.current = ghostMesh;

    // Spawn first block
    spawnBlock();

    // Animation Render Loop
    let lastTime = performance.now();
    const renderLoop = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Dynamic Three.js camera parallax based on cursor/pointer position
      const targetCamX = pointerParallaxRef.current.x * 0.75;
      const targetCamY = pointerParallaxRef.current.y * 0.45;
      camera.position.x += (targetCamX - camera.position.x) * 3 * delta;
      camera.position.y += (targetCamY - camera.position.y) * 3 * delta;
      camera.lookAt(0, 0, 0);

      const block = activeBlockRef.current;
      if (block && block.mesh) {
        const { x, y } = gridToWorldPos(block.row, block.col);

        // Smooth, responsive position interpolation without drag
        block.mesh.position.x += (x - block.mesh.position.x) * 22 * delta;
        block.mesh.position.y += (y - block.mesh.position.y) * 20 * delta;

        // Dynamic 3D depth lift when dragging: block lifts towards camera in true 3D space!
        const targetZ = isDraggingRef.current ? 0.38 : 0;
        block.mesh.position.z += (targetZ - block.mesh.position.z) * 18 * delta;

        // Immediate, crisp axis rotation to selected face (no freeze/drag)
        const target = block.targetRotation || { x: 0, y: 0 };
        block.mesh.rotation.x += (target.x - block.mesh.rotation.x) * 20 * delta;
        block.mesh.rotation.y += (target.y - block.mesh.rotation.y) * 20 * delta;

        // Subtle organic 3D float wobble
        block.mesh.rotation.z = Math.sin(time * 0.0035) * 0.04;

        // Smooth scale return from 3D face rotation pulse
        block.mesh.scale.x += (1.0 - block.mesh.scale.x) * 14 * delta;
        block.mesh.scale.y += (1.0 - block.mesh.scale.y) * 14 * delta;
        block.mesh.scale.z += (1.0 - block.mesh.scale.z) * 14 * delta;

        // Dynamic point light tracking block in 3D with active face palette color
        if (activeCubeLightRef.current) {
          activeCubeLightRef.current.position.set(
            block.mesh.position.x,
            block.mesh.position.y,
            block.mesh.position.z + 1.25
          );
          const activePalette = FACE_PALETTES[block.selectedFace || 'front'];
          if (activePalette) {
            activeCubeLightRef.current.color.set(activePalette.light);
          }
        }

        // Update Ghost Landing Projection
        if (ghostMeshRef.current) {
          let dropRow = block.row;
          while (
            dropRow + 1 < gridRows &&
            gridDataRef.current[dropRow + 1][block.col] === null
          ) {
            dropRow++;
          }
          const landingPos = gridToWorldPos(dropRow, block.col);
          ghostMeshRef.current.position.set(landingPos.x, landingPos.y, 0);
          ghostMeshRef.current.visible = dropRow > block.row;
        }
      } else if (ghostMeshRef.current) {
        ghostMeshRef.current.visible = false;
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    // Handle Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const a = w / h;
      camera.aspect = a;
      const calcZH = (chamberH / 2) / Math.tan(fovRad / 2) + 0.15;
      const calcZW = (chamberW / 2) / (Math.tan(fovRad / 2) * a) + 0.15;
      camera.position.z = Math.max(calcZH, calcZW);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
    };
  }, [round, gridCols, spawnBlock]);

  const currentFaceMeta = FACE_PALETTES[activeFaceName] || FACE_PALETTES.front;

  return (
    <div className="flex flex-col items-center select-none w-full max-w-2xl mx-auto px-1 sm:px-2">
      {/* Top HUD with scaled-up metrics and prominent aquatic music toggle */}
      <div className="w-full flex items-center justify-between px-3.5 sm:px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-700/80 rounded-2xl mb-2.5 shadow-xl text-xs sm:text-sm backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-slate-950 uppercase tracking-wider text-xs sm:text-sm shadow-md">
            Round {round}
          </span>
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="text-slate-400 font-medium">Goal:</span>
            <strong className="text-emerald-300 font-black text-base sm:text-lg">{wordsClearedCount}</strong>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300 font-bold">{targetWordsForRound} words</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Relaxing Aquatic Background Music Toggle */}
          <button
            type="button"
            onClick={() => {
              const active = toggleAquaticMusic();
              setIsMusicActive(active);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-black transition shadow-md ${isMusicActive
              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-cyan-500/25 ring-2 ring-cyan-400/40'
              : 'bg-slate-800/90 hover:bg-slate-750 border-slate-700 text-slate-400'
              }`}
            title={isMusicActive ? 'Mute Relaxing Aquatic Ocean Music' : 'Play Relaxing Aquatic Ocean Music'}
          >
            <Waves className={`w-4 h-4 ${isMusicActive ? 'text-cyan-300 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Aquatic Music</span>
            <span className={`w-2.5 h-2.5 rounded-full ${isMusicActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
          </button>

          {/* Speed Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setSpeedMode((prev) => (prev === 'normal' ? 'brisk' : prev === 'brisk' ? 'relaxed' : 'normal'));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/95 hover:bg-slate-750 border border-slate-700 text-xs sm:text-sm font-bold transition text-slate-200 shadow-sm"
            title="Toggle fall pace: Normal / Brisk / Relaxed"
          >
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="capitalize">{speedMode}</span>
            <span className="text-[11px] text-cyan-300 font-mono hidden sm:inline">
              {(fallIntervalMs / 1000).toFixed(1)}s
            </span>
          </button>

          {/* Score Badge */}
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 border-2 border-amber-400/40 shadow-sm">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="font-black text-amber-300 text-sm sm:text-base tracking-tight">{roundScore} pts</span>
          </div>

          <button
            type="button"
            onClick={onToggleSound}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Special Word Bonus Card - 5X MULTIPLIER / +500 PTS (Larger size & high readability) */}
      <div className="w-full mb-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900/95 to-indigo-950/70 border-2 border-amber-500/50 shadow-2xl shadow-amber-950/20 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300">
            <Target className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
            <span>AI Special Bonus Word</span>
            <span className="text-xs text-amber-400/80 font-mono font-normal hidden md:inline">
              &bull; Any word is valid; build this for 5X!
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black shadow-md uppercase tracking-wide">
              5X Multiplier or +500 Pts
            </span>
            <button
              type="button"
              onClick={fetchAiSpecialWord}
              disabled={isGeneratingWord}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-300 transition text-xs font-black flex items-center gap-1 border border-slate-700 disabled:opacity-60 shadow-sm"
              title="Generate a fresh Special Word with Gemini AI"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isGeneratingWord ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">AI Re-roll</span>
            </button>
            <button
              type="button"
              onClick={advanceTargetQuest}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition text-xs font-bold flex items-center gap-0.5 border border-slate-700 shadow-sm"
              title="Skip to next target word"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Word Display with Distinct Letter Tiles for 8+ letter words */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center md:justify-start">
            <span className="text-2xl sm:text-3xl mr-1 drop-shadow">{targetQuest?.emoji || '🌊'}</span>
            {targetQuest?.word?.split('').map((char, i) => (
              <span
                key={i}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 min-w-[34px] sm:min-w-[42px] rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-amber-400/90 shadow-xl shadow-amber-950/50 flex items-center justify-center font-black text-white text-base sm:text-xl md:text-2xl tracking-wider ring-1 ring-amber-400/30"
              >
                {char}
              </span>
            ))}
          </div>

          <div className="text-center md:text-right flex flex-col items-center md:items-end">
            <span className="text-sm sm:text-base font-extrabold text-slate-100">
              {targetQuest?.meaning || ''}
            </span>
            <span className="text-xs sm:text-sm text-cyan-300/90 font-medium max-w-xs mt-0.5">
              {targetQuest?.hint || 'Horizontal or vertical (top-to-down) builds both valid!'}
            </span>
          </div>
        </div>

        {/* Dynamic Aquatic Music Harmony Indicator synced with combo word */}
        <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs text-cyan-200/90 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
            <span className="font-semibold text-slate-400">Aquatic Harmony:</span>
            <span className="font-black text-cyan-300 bg-cyan-950/70 px-2.5 py-0.5 rounded-lg border border-cyan-500/40 shadow-sm flex items-center gap-1">
              <span>{aquaticMood?.emoji}</span>
              <span>{aquaticMood?.name}</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 italic hidden sm:inline">
            {aquaticMood?.description} &bull; Changes with every 8+ letter word!
          </span>
        </div>
      </div>

      {/* Dynamic Announcement Banner */}
      {announcement && (
        <div
          className={`w-full text-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black mb-2.5 shadow-xl transition-all animate-in fade-in zoom-in-95 ${announcement.type === 'magic'
            ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 border-2 border-yellow-200 ring-2 ring-yellow-400/40'
            : announcement.type === 'warning'
              ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 text-rose-200 border border-rose-600 ring-1 ring-rose-500/30'
              : 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-indigo-200 border border-indigo-600'
            }`}
        >
          {announcement.text}
        </div>
      )}

      {/* 3D WebGL Canvas Arena Container with Dragging Interaction - Scaled Up Height */}
      <div
        className={`relative w-full h-[560px] sm:h-[630px] md:h-[670px] rounded-2xl overflow-hidden border-2 shadow-2xl bg-gradient-to-b from-[#020713] via-[#040c1e] to-[#01040a] transition-all ${isDragging
          ? 'border-cyan-400 shadow-cyan-500/20 ring-2 ring-cyan-500/40'
          : 'border-slate-800 shadow-black'
          }`}
      >
        {/* Canvas DOM Element */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={`w-full h-full touch-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
        />

        {/* Floating Active Face & Letter Indicator Pill */}
        <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
          <div
            className={`px-3.5 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-lg`}
          >
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${currentFaceMeta.cssBg} flex items-center justify-center text-white font-black text-sm sm:text-base shadow`}
            >
              {activeLetter || '?'}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-semibold uppercase leading-none">
                Face
              </span>
              <span className={`text-xs sm:text-sm font-extrabold uppercase leading-tight ${currentFaceMeta.cssText}`}>
                {currentFaceMeta.name}
              </span>
            </div>
          </div>
        </div>

        {/* Mouse Drag Hint / Status Pill */}
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/70 text-xs font-bold text-slate-300 shadow">
          <Hand className={`w-4 h-4 ${isDragging ? 'text-cyan-400 animate-pulse' : 'text-amber-400'}`} />
          <span>{isDragging ? 'Dragging Cube ⇄' : 'Drag Cube / Click Face'}</span>
        </div>

        {/* Ceiling Hazard Line Label */}
        <div className="absolute top-12 right-3.5 z-10 text-[10px] uppercase tracking-wider text-rose-400 font-mono font-bold pointer-events-none drop-shadow">
          ▲ Hazard Ceiling
        </div>

        {/* Ghost Landing Guideline Pill at bottom right */}
        <div className="absolute bottom-3 right-3.5 z-10 text-[11px] text-cyan-400/80 font-mono pointer-events-none flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
          <span className="w-2 h-2 rounded-full border border-cyan-400/80 inline-block animate-ping" />
          <span>Landing Projection Active</span>
        </div>

        {/* Game Over Screen */}
        {isGameOverState && (
          <div className="absolute inset-0 bg-slate-950/92 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-4xl mb-3 shadow-lg">
              💥
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              Heap Reached Ceiling!
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xs mb-5 leading-relaxed">
              Unrecognized letter cubes stacked to the top laser hazard. Let&apos;s build valid words from the bottom up!
            </p>
            <button
              type="button"
              onClick={() => {
                gridDataRef.current = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
                setIsGameOverState(false);
                setRoundScore(0);
                setWordsClearedCount(0);
                spawnBlock();
              }}
              className="py-3.5 px-7 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-cyan-900/40 transition active:scale-95 flex items-center gap-2"
            >
              <span>Restart Round {round}</span>
              <RotateCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Scaled-Up Tactile & Drag Controls (Touch friendly >48px) */}
      <div className="w-full mt-3 flex items-center justify-center gap-2.5 max-w-lg">
        <button
          type="button"
          onClick={() => moveHorizontal(-1)}
          className="flex-1 py-3.5 sm:py-4 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-md transition"
          title="Move Left (Arrow Left / A or Drag Left)"
        >
          <ArrowLeft className="w-5 h-5 text-cyan-400" />
          <span className="hidden sm:inline">Left</span>
        </button>

        <button
          type="button"
          onClick={rotateActiveFace}
          className={`flex-[1.6] py-3.5 sm:py-4 px-3.5 rounded-2xl bg-gradient-to-r ${currentFaceMeta.cssBg} hover:opacity-95 active:scale-95 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition`}
          title="Rotate 3D Face (Arrow Up / W / Click Cube)"
        >
          <RotateCw className="w-5 h-5" />
          <span>Rotate Face ({currentFaceMeta.name})</span>
        </button>

        <button
          type="button"
          onClick={() => moveHorizontal(1)}
          className="flex-1 py-3.5 sm:py-4 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-md transition"
          title="Move Right (Arrow Right / D or Drag Right)"
        >
          <span className="hidden sm:inline">Right</span>
          <ArrowRight className="w-5 h-5 text-cyan-400" />
        </button>

        <button
          type="button"
          onClick={hardDrop}
          className="py-3.5 sm:py-4 px-4 sm:px-5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
          title="Hard Drop to Floor (Space)"
        >
          <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
          <span>Drop</span>
        </button>
      </div>

      {/* Clear, colorful guidance strip */}
      <div className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left text-xs sm:text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <MoveHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-cyan-300">Drag with mouse / touch</strong> to slide cube &bull;{' '}
            <strong className="text-amber-300">Click cube</strong> to switch 6 faces &bull;{' '}
            <strong className="text-emerald-300">Space</strong> to drop
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Pace: <span className="text-cyan-300 font-bold capitalize">{speedMode}</span> ({(fallIntervalMs / 1000).toFixed(1)}s/step)
        </div>
      </div>
    </div>
  );
};

