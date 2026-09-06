import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Heart,
  Flame,
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  Crosshair,
  Award,
  Play,
} from 'lucide-react';
import { GAMES_VOCABULARY } from '../../data/gamesVocabularyData';

export const WordQuest3DGame = ({
  targetLanguage = 'English',
  mediatorLanguage = 'az',
  onGainXp,
}) => {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [isGameOver, setIsGameOver] = useState(false);

  // Internal state refs for 60fps requestAnimationFrame loop
  const gameStateRef = useRef({
    orbs: [],
    particles: [],
    cameraY: 0,
    mouseX: 0,
    mouseY: 0,
    gridOffset: 0,
    targetPrompt: null,
  });

  // Sound generator using Web Audio API
  const playSfx = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'damage') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  // Generate a linguistic prompt and 3 candidate 3D orbs
  const generateNewQuestion = () => {
    const normLang = targetLanguage.toLowerCase();
    let pool = GAMES_VOCABULARY.filter(
      (v) => (v.language || 'English').toLowerCase() === normLang
    );
    if (pool.length < 3 && normLang !== 'english') {
      pool = [
        ...pool,
        ...GAMES_VOCABULARY.filter((v) => (v.language || 'English').toLowerCase() === 'english'),
      ];
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const correctWord = shuffled[0];
    const distractors = shuffled.slice(1, 3);
    const candidates = [correctWord, ...distractors].sort(() => Math.random() - 0.5);

    // Form prompt sentence with blank
    let promptSentence = correctWord.sentence || '';
    if (promptSentence) {
      const regex = new RegExp(`\\b${correctWord.word}\\b`, 'i');
      promptSentence = promptSentence.replace(regex, '_______');
    } else {
      promptSentence = `Identify the word meaning: "${correctWord.definition || '...'}"`;
    }

    const promptObj = {
      correctId: correctWord.id,
      correctWord: correctWord.word,
      sentence: promptSentence,
      nativeHint:
        correctWord.translations?.[mediatorLanguage] ||
        correctWord.translations?.en ||
        correctWord.translations?.az,
      pos: correctWord.pos,
    };

    setCurrentPrompt(promptObj);
    gameStateRef.current.targetPrompt = promptObj;

    // Position 3 3D orbs spread horizontally in space
    const xOffsets = [-220, 0, 220];
    const colors = [
      { base: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
      { base: '#818cf8', glow: 'rgba(129, 140, 248, 0.4)' },
      { base: '#34d399', glow: 'rgba(52, 211, 153, 0.4)' },
    ];

    const orbs = candidates.map((c, idx) => ({
      id: c.id,
      text: c.word,
      x: xOffsets[idx] + (Math.random() * 40 - 20),
      y: -20 + (Math.random() * 40 - 20),
      z: 750 + idx * 40,
      radius: 46,
      color: colors[idx % colors.length],
      isCorrect: c.id === correctWord.id,
      rotation: Math.random() * Math.PI,
    }));

    gameStateRef.current.orbs = orbs;
  };

  // Start game session
  const startGame = () => {
    setScore(0);
    setStreak(0);
    setLives(3);
    setLevel(1);
    setIsGameOver(false);
    setIsPlaying(true);
    generateNewQuestion();
  };

  // 3D Canvas Render & Animation Loop
  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const fov = 350;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2 + 30;

      // 1. Clear dark space background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw 3D Perspective Cyber-Grid on the floor
      const state = gameStateRef.current;
      state.gridOffset = (state.gridOffset + 1.2) % 40;

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;

      // Vanishing lines to horizon
      const horizonY = centerY - 40;
      for (let x = -width; x <= width * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(centerX, horizonY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal depth lines
      for (let z = 20; z < 400; z += 30) {
        const lineZ = (z + state.gridOffset) % 400;
        const lineY = horizonY + (lineZ * lineZ) / 450;
        if (lineY < height) {
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(width, lineY);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 3. Update & Draw floating 3D Word Spheres
      const orbs = state.orbs;
      for (let i = 0; i < orbs.length; i++) {
        const orb = orbs[i];

        // Move orb forward towards player
        orb.z -= 1.6 + level * 0.3;
        orb.rotation += 0.02;

        // If orb reaches behind the camera, deduct life and trigger next question
        if (orb.z < 50) {
          if (orb.isCorrect) {
            playSfx('damage');
            setLives((prev) => {
              const next = prev - 1;
              if (next <= 0) {
                setIsGameOver(true);
                setIsPlaying(false);
              }
              return next;
            });
            setStreak(0);
          }
          generateNewQuestion();
          break;
        }

        // 3D Perspective Projection
        const scale = fov / (fov + orb.z);
        const screenX = centerX + orb.x * scale;
        const screenY = centerY + orb.y * scale;
        const screenRadius = Math.max(16, orb.radius * scale);

        // Store screen coords for mouse click hit testing
        orb.screenX = screenX;
        orb.screenY = screenY;
        orb.screenRadius = screenRadius;

        // Draw 3D glowing sphere
        ctx.save();

        // Outer glow
        const glowGrad = ctx.createRadialGradient(
          screenX,
          screenY,
          screenRadius * 0.4,
          screenX,
          screenY,
          screenRadius * 1.6
        );
        glowGrad.addColorStop(0, orb.color.glow);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // 3D Spherical Radial Lighting
        const sphereGrad = ctx.createRadialGradient(
          screenX - screenRadius * 0.35,
          screenY - screenRadius * 0.35,
          screenRadius * 0.1,
          screenX,
          screenY,
          screenRadius
        );
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.3, orb.color.base);
        sphereGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.fill();

        // Rotating Orbital Ring
        ctx.strokeStyle = orb.color.base;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(
          screenX,
          screenY,
          screenRadius * 1.35,
          screenRadius * 0.45,
          orb.rotation,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        // 3D Floating Word Label Box
        const fontSize = Math.max(12, Math.min(22, 18 * scale));
        ctx.font = `bold ${fontSize}px Plus Jakarta Sans, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Word pill background
        const textWidth = ctx.measureText(orb.text).width;
        const pillHeight = fontSize + 10;
        const pillY = screenY + screenRadius + pillHeight / 2 + 4;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = orb.color.base;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(
          screenX - textWidth / 2 - 8,
          pillY - pillHeight / 2,
          textWidth + 16,
          pillHeight,
          6
        );
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(orb.text, screenX, pillY);

        ctx.restore();
      }

      // 4. Update & Draw 3D particle bursts
      const particles = state.particles;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.life -= 0.025;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const pScale = fov / (fov + p.z);
        const px = centerX + p.x * pScale;
        const py = centerY + p.y * pScale;
        const pRadius = Math.max(2, p.radius * pScale);

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(px, py, pRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Draw Targeting Reticle
      const mx = state.mouseX || centerX;
      const my = state.mouseY || centerY;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 18, 0, Math.PI * 2);
      ctx.moveTo(mx - 24, my);
      ctx.lineTo(mx + 24, my);
      ctx.moveTo(mx, my - 24);
      ctx.lineTo(mx, my + 24);
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, level]);

  // Handle canvas clicks to shoot/target spheres
  const handleCanvasClick = (e) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const state = gameStateRef.current;
    const orbs = state.orbs;

    // Check hit collision with any sphere
    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      if (!orb.screenX) continue;

      const dx = clickX - orb.screenX;
      const dy = clickY - orb.screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Hit detected!
      if (dist <= orb.screenRadius * 1.3 || (clickY > orb.screenY && clickY < orb.screenY + 40 && Math.abs(dx) < 50)) {
        if (orb.isCorrect) {
          // CORRECT HIT!
          playSfx('hit');

          // Spawn 3D particle explosion
          for (let p = 0; p < 24; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            state.particles.push({
              x: orb.x,
              y: orb.y,
              z: orb.z,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              vz: (Math.random() - 0.5) * 4,
              radius: 3.5,
              color: orb.color.base,
              life: 1.0,
            });
          }

          const newStreak = streak + 1;
          setStreak(newStreak);
          const points = 120 + newStreak * 25;
          setScore((prev) => prev + points);

          if (newStreak % 5 === 0) {
            setLevel((prev) => prev + 1);
            try {
              confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
            } catch {}
          }

          if (onGainXp) onGainXp(12, '3D Orb Target Hit');

          // Next question immediately
          generateNewQuestion();
        } else {
          // WRONG SPHERE HIT!
          playSfx('damage');
          setStreak(0);
          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              setIsGameOver(true);
              setIsPlaying(false);
            }
            return next;
          });
        }
        break;
      }
    }
  };

  // Track mouse / touch position for targeting reticle
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    gameStateRef.current.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    gameStateRef.current.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  };

  // Resize canvas to match display container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 700;
      canvas.height = 400;
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="space-y-4 max-w-4xl mx-auto select-none">
      {/* HUD Top Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
              3D Word Quest
            </span>
            <span className="text-xs text-slate-400">
              Target: <strong className="text-white">{targetLanguage}</strong>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
            Aim & Capture Floating Linguistic Orbs
          </h2>
        </div>

        {/* Lives, Score, Streak, Sound Toggle */}
        <div className="flex items-center gap-3">
          {/* Hearts */}
          <div className="flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            {[1, 2, 3].map((heartIdx) => (
              <Heart
                key={heartIdx}
                className={`w-4 h-4 ${
                  heartIdx <= lives ? 'text-rose-500 fill-rose-500' : 'text-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Score */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 font-mono text-xs">
            <span className="text-slate-400">XP:</span>{' '}
            <strong className="text-amber-400">{score}</strong>
          </div>

          {/* Streak */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 font-mono text-xs flex items-center gap-1 text-orange-400">
            <Flame className="w-3.5 h-3.5" />
            <span>x{streak}</span>
          </div>

          {/* Sound */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Active Challenge Prompt Bar */}
      {isPlaying && currentPrompt && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-sky-500/40 rounded-2xl p-4 text-center space-y-1 shadow-xl">
          <div className="text-[11px] font-mono text-sky-400 uppercase tracking-widest">
            Challenge Exemplar
          </div>
          <div className="text-base sm:text-lg font-bold text-white">
            {currentPrompt.sentence}
          </div>
          {currentPrompt.nativeHint && (
            <div className="text-xs text-slate-300">
              Clue in native language: <strong className="text-emerald-400">{currentPrompt.nativeHint}</strong>
            </div>
          )}
        </div>
      )}

      {/* 3D Canvas Stage */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-slate-700 shadow-2xl bg-[#090d16] flex justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className="cursor-crosshair w-full block"
          style={{ height: '400px' }}
        />

        {/* Start / Game Over Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/10">
              {isGameOver ? <Award className="w-8 h-8 text-amber-400" /> : <Crosshair className="w-8 h-8" />}
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-white">
                {isGameOver ? 'Mission Finished!' : '3D Perspective Word Quest'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                {isGameOver
                  ? `Spectacular effort! Final Score: ${score} pts • Highest Combo: x${streak}`
                  : 'Navigate a 3D linguistic horizon. Target and click the correct 3D floating orb to complete sentences and master vocabulary!'}
              </p>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-bold shadow-xl flex items-center gap-2 transition transform active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isGameOver ? 'Play Again' : 'Launch 3D Quest'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Touch / Quick Choice Controls for Mobile & Mini-App */}
      {isPlaying && currentPrompt && (
        <div className="grid grid-cols-3 gap-2">
          {gameStateRef.current.orbs.map((orb, idx) => (
            <button
              key={orb.id || idx}
              onClick={() => {
                // Trigger programmatic click on orb center
                handleCanvasClick({
                  clientX: orb.screenX || 0,
                  clientY: orb.screenY || 0,
                });
              }}
              className="p-3 bg-slate-900 border border-slate-700 hover:border-sky-400 text-white font-bold rounded-2xl text-xs sm:text-sm transition flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: orb.color.base }} />
              <span>{orb.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
