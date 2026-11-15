import { generateLofiTapeLoop, type StereoLoopBuffer } from '../audio/lofiSynth';

export type CameraPreset = 'hero' | 'reel' | 'rocker' | 'top';
export type RockerState = 'up' | 'neutral' | 'down';

export const BASE_REEL_RPS = 0.58; // ~34.8 RPM visually tactile & rhythmic
export const BASE_REEL_OMEGA = Math.PI * 2 * BASE_REEL_RPS; // rad/s

export interface TP7State {
  loopBuffer: StereoLoopBuffer;
  reelAngle: number;
  angularVelocity: number;
  tapeVelocity: number;
  tapeTimeSec: number;
  displayTimeSec: number;

  isPlaying: boolean;
  isScratching: boolean;
  scratchOmega: number;
  reelDepress: number;

  rockerState: RockerState;
  rockerTilt: number; // -1..1

  keyTravel: {
    rec: number;
    play: number;
    stop: number;
    memo: number;
  };
  keyTarget: {
    rec: number;
    play: number;
    stop: number;
    memo: number;
  };

  isRecArmed: boolean;
  tapeDirtMode: boolean;
  oledPage: 0 | 1 | 2;

  vuLeft: number;
  vuRight: number;
  vuPeakL: number;
  vuPeakR: number;
  vuPeakHoldL: number;
  vuPeakHoldR: number;
  clickTransient: number;

  cameraPreset: CameraPreset;
  cameraRequestNonce: number;
  directorCamera: {
    active: boolean;
    pos: [number, number, number];
    target: [number, number, number];
  };

  audioUnlocked: boolean;
  audioMuted: boolean;
  hoveredPart: string | null;
}

const sharedLoop = generateLofiTapeLoop(48000);

export const tp7State: TP7State = {
  loopBuffer: sharedLoop,
  reelAngle: 0.45,
  angularVelocity: BASE_REEL_OMEGA,
  tapeVelocity: 1.0,
  tapeTimeSec: 0,
  displayTimeSec: 0,

  isPlaying: true,
  isScratching: false,
  scratchOmega: 0,
  reelDepress: 0,

  rockerState: 'neutral',
  rockerTilt: 0,

  keyTravel: { rec: 0, play: 0, stop: 0, memo: 0 },
  keyTarget: { rec: 0, play: 0, stop: 0, memo: 0 },

  isRecArmed: false,
  tapeDirtMode: false,
  oledPage: 0,

  vuLeft: 0.32,
  vuRight: 0.3,
  vuPeakL: 0.55,
  vuPeakR: 0.52,
  vuPeakHoldL: 0,
  vuPeakHoldR: 0,
  clickTransient: 0,

  cameraPreset: 'hero',
  cameraRequestNonce: 0,
  directorCamera: {
    active: false,
    pos: [0, 8.8, 10.6],
    target: [0, 0.7, 0.2],
  },

  audioUnlocked: false,
  audioMuted: false,
  hoveredPart: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeTP7(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyTP7(): void {
  for (const fn of listeners) {
    fn();
  }
}

export function setCameraPreset(preset: CameraPreset): void {
  tp7State.cameraPreset = preset;
  tp7State.directorCamera.active = false;
  tp7State.cameraRequestNonce += 1;
  notifyTP7();
}

export function computeTargetMotorVelocity(): number {
  if (tp7State.rockerState === 'up') return 2.25;
  if (tp7State.rockerState === 'down') return -2.15;
  return tp7State.isPlaying ? 1.0 : 0.0;
}

export function stepTP7Physics(dtRaw: number): void {
  const dt = Math.min(0.05, Math.max(0.0005, dtRaw));

  // 1. Reel angular velocity & tape velocity
  if (tp7State.isScratching) {
    // Finger holds reel: scratchOmega decays quickly toward 0 if finger rests stationary
    const decay = Math.exp(-dt * 24);
    tp7State.scratchOmega *= decay;
    const blend = 1 - Math.exp(-dt * 42);
    tp7State.angularVelocity += (tp7State.scratchOmega - tp7State.angularVelocity) * blend;
    tp7State.reelDepress += (1.0 - tp7State.reelDepress) * (1 - Math.exp(-dt * 30));
  } else {
    const targetVel = computeTargetMotorVelocity();
    const targetOmega = targetVel * BASE_REEL_OMEGA;
    const torqueRate = targetVel === 0 ? 7.5 : 11.5; // motor spin-up vs natural coast-down
    const blend = 1 - Math.exp(-dt * torqueRate);
    tp7State.angularVelocity += (targetOmega - tp7State.angularVelocity) * blend;
    tp7State.reelAngle -= tp7State.angularVelocity * dt;
    tp7State.reelDepress += (0.0 - tp7State.reelDepress) * (1 - Math.exp(-dt * 22));
  }

  // Tape velocity ratio (1.0 = normal forward playback)
  tp7State.tapeVelocity = tp7State.angularVelocity / BASE_REEL_OMEGA;

  // Advance tape head time cleanly inside seamless loop
  const dur = tp7State.loopBuffer.durationSec;
  tp7State.tapeTimeSec = (((tp7State.tapeTimeSec + tp7State.tapeVelocity * dt) % dur) + dur) % dur;
  tp7State.displayTimeSec = Math.max(0, tp7State.displayTimeSec + tp7State.tapeVelocity * dt);

  // 2. Rocker tilt spring-damper
  const rockerGoal = tp7State.rockerState === 'up' ? 1.0 : tp7State.rockerState === 'down' ? -1.0 : 0.0;
  tp7State.rockerTilt += (rockerGoal - tp7State.rockerTilt) * (1 - Math.exp(-dt * 28));

  // 3. Tactile keys travel smoothing
  const keySpeed = 1 - Math.exp(-dt * 36);
  tp7State.keyTravel.rec += (tp7State.keyTarget.rec - tp7State.keyTravel.rec) * keySpeed;
  tp7State.keyTravel.play += (tp7State.keyTarget.play - tp7State.keyTravel.play) * keySpeed;
  tp7State.keyTravel.stop += (tp7State.keyTarget.stop - tp7State.keyTravel.stop) * keySpeed;
  tp7State.keyTravel.memo += (tp7State.keyTarget.memo - tp7State.keyTravel.memo) * keySpeed;

  // 4. Sample-accurate VU meter from actual synthesized PCM loop + click/scratch response
  const buf = tp7State.loopBuffer;
  const centerIdx = Math.floor(tp7State.tapeTimeSec * buf.sampleRate);
  const windowSamples = 512;
  let sumL = 0;
  let sumR = 0;
  for (let i = 0; i < windowSamples; i += 4) {
    const idx = ((centerIdx - i) % buf.length + buf.length) % buf.length;
    const sL = buf.left[idx];
    const sR = buf.right[idx];
    sumL += sL * sL;
    sumR += sR * sR;
  }
  const n = windowSamples / 4;
  const speedGain = Math.min(1.25, Math.pow(Math.min(2.8, Math.abs(tp7State.tapeVelocity)), 0.58));
  const recBoost = tp7State.isRecArmed ? 1.24 : 1.0;
  const rmsL = Math.sqrt(sumL / n);
  const rmsR = Math.sqrt(sumR / n);

  tp7State.clickTransient *= Math.exp(-dt * 18);
  const rawL = Math.min(1, rmsL * 2.55 * speedGain * recBoost + tp7State.clickTransient);
  const rawR = Math.min(1, rmsR * 2.55 * speedGain * recBoost + tp7State.clickTransient * 0.92);

  // Fast attack, smooth analog LED decay
  const atk = 1 - Math.exp(-dt * 38);
  const rel = 1 - Math.exp(-dt * 9.5);
  tp7State.vuLeft += (rawL - tp7State.vuLeft) * (rawL > tp7State.vuLeft ? atk : rel);
  tp7State.vuRight += (rawR - tp7State.vuRight) * (rawR > tp7State.vuRight ? atk : rel);

  if (tp7State.vuLeft >= tp7State.vuPeakL) {
    tp7State.vuPeakL = tp7State.vuLeft;
    tp7State.vuPeakHoldL = 0.45;
  } else if (tp7State.vuPeakHoldL > 0) {
    tp7State.vuPeakHoldL -= dt;
  } else {
    tp7State.vuPeakL = Math.max(tp7State.vuLeft, tp7State.vuPeakL - dt * 0.45);
  }

  if (tp7State.vuRight >= tp7State.vuPeakR) {
    tp7State.vuPeakR = tp7State.vuRight;
    tp7State.vuPeakHoldR = 0.45;
  } else if (tp7State.vuPeakHoldR > 0) {
    tp7State.vuPeakHoldR -= dt;
  } else {
    tp7State.vuPeakR = Math.max(tp7State.vuRight, tp7State.vuPeakR - dt * 0.45);
  }
}
