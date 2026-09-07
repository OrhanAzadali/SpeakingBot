// soundEffects.js — Web Audio API Sound Synthesizer and Relaxing Aquatic Ambient Background Music

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playRotateSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export function playMoveSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {}
}

export function playLandSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

export function playMagicWordDisappearSound(isCombo = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = isCombo ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.07);
      osc.stop(ctx.currentTime + idx * 0.07 + 0.39);
    });
  } catch {}
}

export function playGameOverSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

const SPEECH_LANG_MAP = {
  english: 'en-US',
  spanish: 'es-ES',
  russian: 'ru-RU',
  german: 'de-DE',
  french: 'fr-FR',
  italian: 'it-IT',
  turkish: 'tr-TR',
};

export function pronounceWordVoice(word, language = 'english') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    const langKey = (language || 'english').toLowerCase();
    utterance.lang = SPEECH_LANG_MAP[langKey] || 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis playback error:', err);
  }
}

// -------------------------------------------------------------
// Joyful & Relaxing Aquatic Background Music Synthesizer (Web Audio API)
// -------------------------------------------------------------
let aquaticMusicTimer = null;
let aquaticBubbleTimer = null;
let aquaticWaveTimer = null;
let aquaticMasterGain = null;
let aquaticFilter = null;
let isMusicPlaying = false;
let currentChordIndex = 0;
let currentMoodIndex = 0;
let currentComboWord = 'SUBMARINE';

export const AQUATIC_MOODS = [
  {
    id: 'coral_shallows',
    name: 'Sunlit Coral Shallows',
    emoji: '🪸',
    description: 'Warm turquoise waters and golden sunlight rippling on reefs',
    chords: [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0],  // G/B
      [130.81, 196.0, 261.63, 329.63, 392.0], // Cmaj9
      [110.0, 164.81, 220.0, 261.63, 329.63], // Am9
      [146.83, 220.0, 261.63, 349.23], // Dm7
      [164.81, 196.0, 246.94, 329.63], // Em7
    ],
    dropletNotes: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51],
    filterFreq: 880,
    waveFreq: 260,
  },
  {
    id: 'bioluminescent_deep',
    name: 'Bioluminescent Abyss',
    emoji: '✨',
    description: 'Mystical deep trench glowing with floating neon jellyfish',
    chords: [
      [207.65, 261.63, 311.13, 392.0], // Abmaj7
      [233.08, 293.66, 349.23, 466.16], // Bb9
      [155.56, 233.08, 311.13, 392.0, 466.16], // Ebmaj9
      [130.81, 196.0, 246.94, 311.13, 392.0], // Cm9
      [174.61, 261.63, 311.13, 415.30], // Fm9
    ],
    dropletNotes: [622.25, 698.46, 783.99, 932.33, 1046.5, 1244.5, 1396.91],
    filterFreq: 750,
    waveFreq: 210,
  },
  {
    id: 'emerald_lagoon',
    name: 'Emerald Kelp Haven',
    emoji: '🌿',
    description: 'Gentle green canopy swaying with tranquil undersea currents',
    chords: [
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7
      [261.63, 329.63, 392.0, 523.25], // C/Bb
      [174.61, 261.63, 349.23, 440.0, 523.25], // Fmaj9
      [146.83, 220.0, 261.63, 349.23, 440.0], // Dm9
      [196.0, 293.66, 349.23, 466.16], // Gm7
    ],
    dropletNotes: [587.33, 659.25, 698.46, 880.0, 987.77, 1174.66, 1318.51],
    filterFreq: 820,
    waveFreq: 240,
  },
  {
    id: 'moonlit_atoll',
    name: 'Moonlit Ocean Atoll',
    emoji: '🌙',
    description: 'Silver moonlight rippling peacefully across silent calm lagoons',
    chords: [
      [138.59, 207.65, 261.63, 329.63], // Dbmaj7
      [155.56, 233.08, 293.66, 369.99], // Eb/Db
      [103.83, 155.56, 207.65, 261.63, 329.63], // Abmaj9
      [116.54, 174.61, 207.65, 261.63, 329.63], // Bbm9
      [130.81, 196.0, 233.08, 293.66], // Cm7
    ],
    dropletNotes: [554.37, 622.25, 698.46, 830.61, 932.33, 1108.73, 1244.5],
    filterFreq: 680,
    waveFreq: 190,
  },
];

export function getAquaticMood() {
  return AQUATIC_MOODS[currentMoodIndex] || AQUATIC_MOODS[0];
}

export function setAquaticComboWord(word) {
  if (!word) return getAquaticMood();
  currentComboWord = word.trim().toUpperCase();

  let hash = 0;
  for (let i = 0; i < currentComboWord.length; i++) {
    hash = (hash * 37 + currentComboWord.charCodeAt(i)) & 0x7fffffff;
  }

  currentMoodIndex = hash % AQUATIC_MOODS.length;
  currentChordIndex = 0;
  const mood = AQUATIC_MOODS[currentMoodIndex];

  if (isMusicPlaying && audioCtx && aquaticFilter && aquaticMasterGain) {
    try {
      const t = audioCtx.currentTime;
      aquaticFilter.frequency.linearRampToValueAtTime(mood.filterFreq, t + 2.0);

      const dropletScale = mood.dropletNotes;
      [0, 1, 2].forEach((step, idx) => {
        const note = dropletScale[Math.min(idx * 2 + 1, dropletScale.length - 1)];
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note * 0.94, t + idx * 0.16);
        osc.frequency.exponentialRampToValueAtTime(note, t + idx * 0.16 + 0.06);

        g.gain.setValueAtTime(0.0001, t + idx * 0.16);
        g.gain.linearRampToValueAtTime(0.07, t + idx * 0.16 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.16 + 0.7);

        osc.connect(g);
        g.connect(aquaticMasterGain);
        osc.start(t + idx * 0.16);
        osc.stop(t + idx * 0.16 + 0.75);
      });
    } catch {}
  }

  return mood;
}

export function isAquaticMusicActive() {
  return isMusicPlaying;
}

export function resumeAudioAndMusic() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function startAquaticMusic() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (isMusicPlaying) return;

  try {
    if (aquaticMusicTimer) clearTimeout(aquaticMusicTimer);
    if (aquaticBubbleTimer) clearTimeout(aquaticBubbleTimer);
    if (aquaticWaveTimer) clearTimeout(aquaticWaveTimer);

    const mood = AQUATIC_MOODS[currentMoodIndex] || AQUATIC_MOODS[0];

    aquaticMasterGain = ctx.createGain();
    aquaticMasterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    aquaticMasterGain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 1.5);

    aquaticFilter = ctx.createBiquadFilter();
    aquaticFilter.type = 'lowpass';
    aquaticFilter.frequency.setValueAtTime(mood.filterFreq, ctx.currentTime);
    aquaticFilter.Q.setValueAtTime(1.8, ctx.currentTime);

    aquaticMasterGain.connect(aquaticFilter);
    aquaticFilter.connect(ctx.destination);

    isMusicPlaying = true;
    currentChordIndex = 0;

    const playNextChord = () => {
      if (!isMusicPlaying || !audioCtx) return;
      const t = audioCtx.currentTime;
      const activeMood = AQUATIC_MOODS[currentMoodIndex] || AQUATIC_MOODS[0];
      const chord = activeMood.chords[currentChordIndex % activeMood.chords.length];
      currentChordIndex++;

      if (aquaticFilter) {
        const targetFreq = (activeMood.filterFreq - 120) + Math.sin(t * 0.5) * 280;
        aquaticFilter.frequency.linearRampToValueAtTime(targetFreq, t + 3.6);
      }

      chord.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const chordGain = audioCtx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        if (idx === 1 || idx === 3) {
          osc.detune.setValueAtTime(Math.sin(t) * 6, t);
        }

        chordGain.gain.setValueAtTime(0.0001, t);
        chordGain.gain.linearRampToValueAtTime(0.082, t + 1.1);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);

        osc.connect(chordGain);
        chordGain.connect(aquaticMasterGain);

        osc.start(t);
        osc.stop(t + 4.3);
      });

      aquaticMusicTimer = setTimeout(playNextChord, 3800);
    };

    const playAquaticBubble = () => {
      if (!isMusicPlaying || !audioCtx) return;
      const t = audioCtx.currentTime;
      const activeMood = AQUATIC_MOODS[currentMoodIndex] || AQUATIC_MOODS[0];
      const notes = activeMood.dropletNotes;
      const note = notes[Math.floor(Math.random() * notes.length)];

      const osc = audioCtx.createOscillator();
      const dropGain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note * 0.94, t);
      osc.frequency.exponentialRampToValueAtTime(note, t + 0.05);

      dropGain.gain.setValueAtTime(0.0001, t);
      dropGain.gain.linearRampToValueAtTime(0.075, t + 0.04);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      osc.connect(dropGain);
      dropGain.connect(aquaticMasterGain);

      osc.start(t);
      osc.stop(t + 0.6);

      const nextDelay = 1000 + Math.random() * 1800;
      aquaticBubbleTimer = setTimeout(playAquaticBubble, nextDelay);
    };

    const playOceanWave = () => {
      if (!isMusicPlaying || !audioCtx) return;
      try {
        const activeMood = AQUATIC_MOODS[currentMoodIndex] || AQUATIC_MOODS[0];
        const centerFreq = activeMood.waveFreq || 240;

        const bufferSize = audioCtx.sampleRate * 2.5;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const waveFilter = audioCtx.createBiquadFilter();
        waveFilter.type = 'bandpass';
        waveFilter.frequency.setValueAtTime(centerFreq, audioCtx.currentTime);
        waveFilter.frequency.linearRampToValueAtTime(centerFreq + 220, audioCtx.currentTime + 1.4);
        waveFilter.frequency.linearRampToValueAtTime(centerFreq - 80, audioCtx.currentTime + 2.8);
        waveFilter.Q.setValueAtTime(2.0, audioCtx.currentTime);

        const waveGain = audioCtx.createGain();
        waveGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        waveGain.gain.linearRampToValueAtTime(0.045, audioCtx.currentTime + 1.3);
        waveGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 2.8);

        whiteNoise.connect(waveFilter);
        waveFilter.connect(waveGain);
        waveGain.connect(aquaticMasterGain);

        whiteNoise.start();
        whiteNoise.stop(audioCtx.currentTime + 2.9);
      } catch {}

      const nextWaveDelay = 5500 + Math.random() * 3000;
      aquaticWaveTimer = setTimeout(playOceanWave, nextWaveDelay);
    };

    playNextChord();
    playAquaticBubble();
    playOceanWave();
  } catch (err) {
    console.warn('Could not initialize aquatic music:', err);
    isMusicPlaying = false;
  }
}

export function stopAquaticMusic() {
  if (!isMusicPlaying) return;
  isMusicPlaying = false;

  if (aquaticMusicTimer) clearTimeout(aquaticMusicTimer);
  if (aquaticBubbleTimer) clearTimeout(aquaticBubbleTimer);
  if (aquaticWaveTimer) clearTimeout(aquaticWaveTimer);

  if (audioCtx && aquaticMasterGain) {
    try {
      aquaticMasterGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
      setTimeout(() => {
        aquaticMasterGain = null;
        aquaticFilter = null;
      }, 500);
    } catch {}
  }
}

export function toggleAquaticMusic() {
  if (isMusicPlaying) {
    stopAquaticMusic();
    return false;
  } else {
    startAquaticMusic();
    return true;
  }
}
