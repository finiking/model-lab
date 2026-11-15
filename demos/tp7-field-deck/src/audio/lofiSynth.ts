// Pure deterministic PCM synthesis for warm Lo-Fi tape loop and mechanical tactile clicks.
// Zero DOM/WebAudio dependencies so both browser WebAudio and Node offline WAV renderer share exact DSP.

export interface StereoLoopBuffer {
  sampleRate: number;
  length: number;
  durationSec: number;
  left: Float32Array;
  right: Float32Array;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function softClip(x: number): number {
  return Math.tanh(x);
}

function addWrapped(
  bufL: Float32Array,
  bufR: Float32Array,
  idx: number,
  valL: number,
  valR: number
): void {
  const n = bufL.length;
  const i = ((idx % n) + n) % n;
  bufL[i] += valL;
  bufR[i] += valR;
}

export function generateLofiTapeLoop(sampleRate = 48000): StereoLoopBuffer {
  const bpm = 84;
  const beatSec = 60 / bpm;
  const totalBeats = 16; // 4 bars @ 4/4
  const durationSec = totalBeats * beatSec; // ~11.428571s
  const length = Math.round(durationSec * sampleRate);

  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const rng = mulberry32(0x70745f37);

  // 1. Warm Rhodes / Analog Tape Chords (8-beat / 4-bar jazzy progression)
  interface ChordEvent {
    startBeat: number;
    durBeats: number;
    notes: number[];
    gain: number;
  }

  const chords: ChordEvent[] = [
    // Bar 1: Fmaj9
    { startBeat: 0.0, durBeats: 2.4, notes: [174.61, 220.0, 261.63, 329.63, 392.0], gain: 0.145 },
    { startBeat: 2.5, durBeats: 1.45, notes: [174.61, 220.0, 261.63, 329.63, 392.0], gain: 0.105 },
    // Bar 2: Em7 (with subtle 9th)
    { startBeat: 4.0, durBeats: 2.4, notes: [164.81, 196.0, 246.94, 293.66, 369.99], gain: 0.14 },
    { startBeat: 6.5, durBeats: 1.45, notes: [164.81, 196.0, 246.94, 293.66, 369.99], gain: 0.10 },
    // Bar 3: Dm9
    { startBeat: 8.0, durBeats: 2.4, notes: [146.83, 174.61, 220.0, 261.63, 329.63], gain: 0.145 },
    { startBeat: 10.5, durBeats: 1.45, notes: [146.83, 174.61, 220.0, 261.63, 329.63], gain: 0.105 },
    // Bar 4: Cmaj9 -> G13sus4 turnaround
    { startBeat: 12.0, durBeats: 1.9, notes: [130.81, 164.81, 196.0, 246.94, 293.66], gain: 0.14 },
    { startBeat: 14.0, durBeats: 1.9, notes: [196.0, 261.63, 293.66, 349.23, 440.0], gain: 0.125 },
  ];

  for (const ch of chords) {
    const startSample = Math.round(ch.startBeat * beatSec * sampleRate);
    const durSamples = Math.round((ch.durBeats + 0.35) * beatSec * sampleRate);
    const holdSamples = ch.durBeats * beatSec * sampleRate;

    for (let v = 0; v < ch.notes.length; v++) {
      const freq = ch.notes[v];
      // Slight chord strum humanization (~14ms per note)
      const strumOffset = Math.round(v * 0.014 * sampleRate);
      const pan = -0.36 + (v / Math.max(1, ch.notes.length - 1)) * 0.72;
      const gL = Math.cos(((pan + 1) * Math.PI) / 4);
      const gR = Math.sin(((pan + 1) * Math.PI) / 4);
      let phaseA = rng() * Math.PI * 2;
      let phaseB = rng() * Math.PI * 2;

      for (let i = 0; i < durSamples; i++) {
        const t = i / sampleRate;
        const atk = Math.min(1, t / 0.018);
        const rel = i > holdSamples ? Math.exp(-(i - holdSamples) / (0.14 * sampleRate)) : 1;
        const bodyDecay = Math.exp(-t * 0.78);
        const env = atk * rel * bodyDecay * ch.gain;

        // Analog chorus detune + warm tape warble
        const wow = 1 + 0.0022 * Math.sin(2 * Math.PI * 0.44 * t + v);
        const dFreqA = freq * wow * 0.9985;
        const dFreqB = freq * wow * 1.0016;
        phaseA += (2 * Math.PI * dFreqA) / sampleRate;
        phaseB += (2 * Math.PI * dFreqB) / sampleRate;

        const warmFundamental =
          0.62 * Math.sin(phaseA) +
          0.38 * Math.sin(phaseB) +
          0.16 * Math.sin(phaseA * 2.0) * Math.exp(-t * 2.2) +
          0.05 * Math.sin(phaseA * 3.0) * Math.exp(-t * 4.5);

        // Rhodes mechanical bell tine on attack
        const tine = 0.14 * Math.sin(phaseA * 4.0) * Math.exp(-t * 16.0);
        const sample = (warmFundamental + tine) * env;
        addWrapped(left, right, startSample + strumOffset + i, sample * gL, sample * gR);
      }
    }
  }

  // 2. Warm Analog Sub-Bass
  const bassNotes: Array<{ startBeat: number; durBeats: number; freq: number; gain: number }> = [
    { startBeat: 0.0, durBeats: 2.3, freq: 87.31, gain: 0.26 }, // F2
    { startBeat: 2.5, durBeats: 1.3, freq: 87.31, gain: 0.21 },
    { startBeat: 4.0, durBeats: 2.3, freq: 82.41, gain: 0.26 }, // E2
    { startBeat: 6.5, durBeats: 1.3, freq: 82.41, gain: 0.21 },
    { startBeat: 8.0, durBeats: 2.3, freq: 73.42, gain: 0.27 }, // D2
    { startBeat: 10.5, durBeats: 1.3, freq: 73.42, gain: 0.22 },
    { startBeat: 12.0, durBeats: 1.85, freq: 65.41, gain: 0.27 }, // C2
    { startBeat: 14.0, durBeats: 1.75, freq: 98.0, gain: 0.24 }, // G2
  ];

  for (const b of bassNotes) {
    const startSample = Math.round(b.startBeat * beatSec * sampleRate);
    const durSamples = Math.round((b.durBeats + 0.16) * beatSec * sampleRate);
    const holdSamples = b.durBeats * beatSec * sampleRate;
    let phase = 0;

    for (let i = 0; i < durSamples; i++) {
      const t = i / sampleRate;
      const atk = Math.min(1, t / 0.012);
      const rel = i > holdSamples ? Math.exp(-(i - holdSamples) / (0.045 * sampleRate)) : 1;
      const env = atk * rel * Math.exp(-t * 0.45) * b.gain;
      phase += (2 * Math.PI * b.freq) / sampleRate;
      const tone = 0.85 * Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.06 * Math.sin(phase * 3);
      const sat = Math.tanh(tone * 1.45) * env;
      addWrapped(left, right, startSample + i, sat, sat);
    }
  }

  // 3. Delicate Warm Tape Lead Motif + Ping-Pong Delay
  const melody: Array<{ startBeat: number; freq: number; durBeats: number; gain: number }> = [
    { startBeat: 0.75, freq: 659.25, durBeats: 0.65, gain: 0.085 }, // E5
    { startBeat: 1.5, freq: 783.99, durBeats: 0.85, gain: 0.09 }, // G5
    { startBeat: 3.0, freq: 523.25, durBeats: 0.75, gain: 0.08 }, // C5
    { startBeat: 4.75, freq: 587.33, durBeats: 0.75, gain: 0.085 }, // D5
    { startBeat: 5.75, freq: 659.25, durBeats: 0.9, gain: 0.085 }, // E5
    { startBeat: 8.75, freq: 659.25, durBeats: 0.65, gain: 0.085 }, // E5
    { startBeat: 9.5, freq: 880.0, durBeats: 1.0, gain: 0.095 }, // A5
    { startBeat: 11.25, freq: 783.99, durBeats: 0.65, gain: 0.08 }, // G5
    { startBeat: 12.75, freq: 587.33, durBeats: 0.85, gain: 0.085 }, // D5
    { startBeat: 14.5, freq: 659.25, durBeats: 0.6, gain: 0.08 }, // E5
    { startBeat: 15.25, freq: 523.25, durBeats: 0.6, gain: 0.075 }, // C5
  ];

  const delayTap1 = Math.round(0.375 * beatSec * sampleRate);
  const delayTap2 = Math.round(0.75 * beatSec * sampleRate);
  const delayTap3 = Math.round(1.125 * beatSec * sampleRate);

  for (const m of melody) {
    const startSample = Math.round(m.startBeat * beatSec * sampleRate);
    const durSamples = Math.round((m.durBeats + 0.3) * beatSec * sampleRate);
    let phase = 0;

    for (let i = 0; i < durSamples; i++) {
      const t = i / sampleRate;
      const atk = Math.min(1, t / 0.008);
      const env = atk * Math.exp(-t * 3.1) * m.gain;
      const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 4.8 * t);
      phase += (2 * Math.PI * m.freq * vibrato) / sampleRate;
      const bell = 0.78 * Math.sin(phase) + 0.22 * Math.sin(phase * 2.0) * Math.exp(-t * 9);
      const s = bell * env;
      addWrapped(left, right, startSample + i, s * 0.65, s * 0.75);
      // Stereo ping-pong tape echo taps
      addWrapped(left, right, startSample + i + delayTap1, s * 0.34, s * 0.12);
      addWrapped(left, right, startSample + i + delayTap2, s * 0.08, s * 0.22);
      addWrapped(left, right, startSample + i + delayTap3, s * 0.11, s * 0.05);
    }
  }

  // 4. Dusty Swung Boom-Bap Lo-Fi Drums
  const renderKick = (beat: number, vel: number) => {
    const start = Math.round(beat * beatSec * sampleRate);
    const dur = Math.round(0.24 * sampleRate);
    let phase = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sampleRate;
      const freq = 46 + 112 * Math.exp(-t * 34);
      phase += (2 * Math.PI * freq) / sampleRate;
      const env = Math.min(1, t / 0.002) * Math.exp(-t * 13.5) * vel;
      const click = (rng() * 2 - 1) * Math.exp(-t * 180) * 0.12 * vel;
      const s = Math.tanh((Math.sin(phase) * env + click) * 1.35) * 0.42;
      addWrapped(left, right, start + i, s, s);
    }
  };

  const renderSnare = (beat: number, vel: number) => {
    const start = Math.round(beat * beatSec * sampleRate);
    const dur = Math.round(0.19 * sampleRate);
    let phase = 0;
    let lp = 0;
    let hpPrevIn = 0;
    let hpPrevOut = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sampleRate;
      const bodyFreq = 188 + 65 * Math.exp(-t * 45);
      phase += (2 * Math.PI * bodyFreq) / sampleRate;
      const body = Math.sin(phase) * Math.exp(-t * 24) * 0.26;
      const white = rng() * 2 - 1;
      // Band-shaped dusty snare noise (warm, not harsh)
      hpPrevOut = 0.88 * (hpPrevOut + white - hpPrevIn);
      hpPrevIn = white;
      lp = lp * 0.62 + hpPrevOut * 0.38;
      const noise = lp * Math.exp(-t * 18.5) * 0.32;
      const s = Math.tanh((body + noise) * vel * 1.2) * 0.36;
      addWrapped(left, right, start + i, s * 0.96, s * 1.04);
    }
  };

  const renderHat = (beat: number, vel: number, open = false) => {
    const start = Math.round(beat * beatSec * sampleRate);
    const dur = Math.round((open ? 0.14 : 0.045) * sampleRate);
    let prevIn = 0;
    let prevOut = 0;
    let lp = 0;
    for (let i = 0; i < dur; i++) {
      const t = i / sampleRate;
      const white = rng() * 2 - 1;
      prevOut = 0.94 * (prevOut + white - prevIn);
      prevIn = white;
      lp = lp * 0.42 + prevOut * 0.58;
      const env = Math.min(1, t / 0.001) * Math.exp(-t * (open ? 28 : 95)) * vel;
      const s = lp * env * 0.125;
      addWrapped(left, right, start + i, s * 0.88, s * 1.12);
    }
  };

  for (let bar = 0; bar < 4; bar++) {
    const b = bar * 4;
    // Kicks
    renderKick(b + 0.0, 1.0);
    renderKick(b + 1.5, 0.78);
    if (bar % 2 === 1) renderKick(b + 2.54, 0.72);
    else renderKick(b + 2.77, 0.88);
    if (bar === 3) renderKick(b + 3.54, 0.58);

    // Snares on 2 & 4
    renderSnare(b + 1.0, 0.96);
    renderSnare(b + 3.0, 1.0);

    // Swung eighth hi-hats
    for (let step = 0; step < 8; step++) {
      const isOff = step % 2 === 1;
      const swingShift = isOff ? 0.065 : 0;
      const vel = isOff ? 0.52 : step % 4 === 0 ? 0.86 : 0.68;
      const isOpen = bar % 2 === 1 && step === 7;
      renderHat(b + step * 0.5 + swingShift, vel, isOpen);
    }
  }

  // 5. Subtle Tape Hiss, Warm Vinyl Crackle & 1-pole Master Tape Glue
  let hissL = 0;
  let hissR = 0;
  let crackleEnv = 0;
  let warmL = 0;
  let warmR = 0;
  const lpAlpha = 0.58; // smooth high-end tape warmth

  for (let i = 0; i < length; i++) {
    const nL = rng() * 2 - 1;
    const nR = rng() * 2 - 1;
    hissL = hissL * 0.82 + nL * 0.18;
    hissR = hissR * 0.82 + nR * 0.18;

    // Sparse dusty vinyl pops
    if (rng() < 0.00055) {
      crackleEnv = (rng() * 0.7 + 0.3) * (rng() > 0.5 ? 1 : -1) * 0.045;
    }
    crackleEnv *= 0.86;

    const rawL = left[i] + hissL * 0.0085 + crackleEnv;
    const rawR = right[i] + hissR * 0.0085 + crackleEnv * 0.75;

    warmL = warmL + lpAlpha * (rawL - warmL);
    warmR = warmR + lpAlpha * (rawR - warmR);

    left[i] = softClip(warmL * 1.15) * 0.82;
    right[i] = softClip(warmR * 1.15) * 0.82;
  }

  return {
    sampleRate,
    length,
    durationSec,
    left,
    right,
  };
}

// Crisp Kailh/TE tactile mechanical switch sound (down or up)
export function synthesizeKeyClick(sampleRate = 48000, isDown = true): Float32Array {
  const durSec = isDown ? 0.042 : 0.03;
  const len = Math.round(durSec * sampleRate);
  const out = new Float32Array(len);
  const rng = mulberry32(isDown ? 0x4b455944 : 0x4b455955);

  let hpIn = 0;
  let hpOut = 0;
  const clickFreq = isDown ? 2150 : 1480;
  const thockFreq = isDown ? 420 : 320;
  let phaseC = 0;
  let phaseT = 0;

  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    hpOut = 0.78 * (hpOut + white - hpIn);
    hpIn = white;

    // Sharp micro-switch snap transient (1.5ms)
    const snap = hpOut * Math.exp(-t * 950) * (isDown ? 0.75 : 0.45);

    // Tactile housing click ping
    phaseC += (2 * Math.PI * clickFreq) / sampleRate;
    const ping = Math.sin(phaseC) * Math.exp(-t * 280) * (isDown ? 0.34 : 0.18);

    // Keycap bottom-out thock
    phaseT += (2 * Math.PI * thockFreq) / sampleRate;
    const thock = Math.sin(phaseT) * Math.exp(-t * 170) * (isDown ? 0.42 : 0.22);

    out[i] = Math.tanh((snap + ping + thock) * 1.35) * 0.75;
  }
  return out;
}

// Crisp heavy aluminum side-rocker mechanical detent clack
export function synthesizeRockerSnap(sampleRate = 48000): Float32Array {
  const durSec = 0.056;
  const len = Math.round(durSec * sampleRate);
  const out = new Float32Array(len);
  const rng = mulberry32(0x524f434b);

  let hpIn = 0;
  let hpOut = 0;
  let p1 = 0;
  let p2 = 0;

  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const white = rng() * 2 - 1;
    hpOut = 0.84 * (hpOut + white - hpIn);
    hpIn = white;

    // Dual micro-detent transient (spring detent leaving + landing 8ms later)
    const burst1 = hpOut * Math.exp(-t * 720) * 0.65;
    const t2 = Math.max(0, t - 0.0075);
    const burst2 = t > 0.0075 ? hpOut * Math.exp(-t2 * 850) * 0.55 : 0;

    p1 += (2 * Math.PI * 1240) / sampleRate;
    p2 += (2 * Math.PI * 3350) / sampleRate;

    const ring =
      Math.sin(p1) * Math.exp(-t * 165) * 0.4 +
      (t > 0.007 ? Math.sin(p2) * Math.exp(-t2 * 310) * 0.28 : 0);

    out[i] = Math.tanh((burst1 + burst2 + ring) * 1.45) * 0.78;
  }
  return out;
}
