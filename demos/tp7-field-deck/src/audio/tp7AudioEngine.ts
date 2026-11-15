import {
  generateLofiTapeLoop,
  synthesizeKeyClick,
  synthesizeRockerSnap,
  type StereoLoopBuffer,
} from './lofiSynth';
import { notifyTP7, tp7State } from '../state/tp7Store';

function cubicHermite(buf: Float32Array, pos: number): number {
  const n = buf.length;
  const i1 = ((Math.floor(pos) % n) + n) % n;
  const f = pos - Math.floor(pos);
  const i0 = (i1 - 1 + n) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;

  const y0 = buf[i0];
  const y1 = buf[i1];
  const y2 = buf[i2];
  const y3 = buf[i3];

  const c0 = y1;
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * f + c2) * f + c1) * f + c0;
}

class TP7AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private loop: StereoLoopBuffer | null = null;

  private keyDownBuf: AudioBuffer | null = null;
  private keyUpBuf: AudioBuffer | null = null;
  private rockerBuf: AudioBuffer | null = null;

  private audioSamplePos = 0;
  private smoothSpeed = 1.0;
  private dirtFilterL = 0;
  private dirtFilterR = 0;
  private fingerNoiseSeed = 0x1337;

  private initBuffers(ctx: AudioContext): void {
    const sr = ctx.sampleRate;
    this.loop = sr === 48000 ? tp7State.loopBuffer : generateLofiTapeLoop(sr);

    const makeMonoBuf = (pcm: Float32Array): AudioBuffer => {
      const ab = ctx.createBuffer(1, pcm.length, sr);
      ab.getChannelData(0).set(pcm);
      return ab;
    };
    this.keyDownBuf = makeMonoBuf(synthesizeKeyClick(sr, true));
    this.keyUpBuf = makeMonoBuf(synthesizeKeyClick(sr, false));
    this.rockerBuf = makeMonoBuf(synthesizeRockerSnap(sr));
  }

  public unlock(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.initBuffers(this.ctx);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = tp7State.audioMuted ? 0 : 0.92;
        this.masterGain.connect(this.ctx.destination);

        // ScriptProcessorNode works reliably under strict CSP without external blob fetches
        this.processor = this.ctx.createScriptProcessor(512, 0, 2);
        this.audioSamplePos = tp7State.tapeTimeSec * this.ctx.sampleRate;
        this.processor.onaudioprocess = (ev) => this.processAudio(ev);
        this.processor.connect(this.masterGain);
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          tp7State.audioUnlocked = this.ctx?.state === 'running';
          notifyTP7();
        });
      } else if (this.ctx.state === 'running' && !tp7State.audioUnlocked) {
        tp7State.audioUnlocked = true;
        notifyTP7();
      }
    } catch {
      // Headless or audio-restricted environments remain silent with 0 errors
    }
  }

  public setMuted(muted: boolean): void {
    tp7State.audioMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.92, this.ctx.currentTime, 0.02);
    }
    notifyTP7();
  }

  public playKeyClick(isDown: boolean): void {
    tp7State.clickTransient = Math.max(tp7State.clickTransient, isDown ? 0.34 : 0.16);
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const buf = isDown ? this.keyDownBuf : this.keyUpBuf;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = isDown ? 0.9 : 0.65;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  public playRockerSnap(): void {
    tp7State.clickTransient = Math.max(tp7State.clickTransient, 0.42);
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    if (!this.rockerBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.rockerBuf;
    const g = this.ctx.createGain();
    g.gain.value = 0.95;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  private processAudio(ev: AudioProcessingEvent): void {
    const outL = ev.outputBuffer.getChannelData(0);
    const outR = ev.outputBuffer.getChannelData(1);
    const loop = this.loop;
    if (!loop) {
      outL.fill(0);
      outR.fill(0);
      return;
    }

    const n = outL.length;
    const targetSpeed = tp7State.tapeVelocity;
    const len = loop.length;

    // Gentle resync if visual tapeTimeSec drifted noticeably (e.g. director jump)
    const expectedPos = tp7State.tapeTimeSec * loop.sampleRate;
    let diff = expectedPos - this.audioSamplePos;
    if (diff > len * 0.5) diff -= len;
    if (diff < -len * 0.5) diff += len;
    if (Math.abs(diff) > loop.sampleRate * 0.14) {
      this.audioSamplePos = expectedPos;
    }

    const recDrive = tp7State.isRecArmed ? 1.55 : 1.0;
    const dirtAlpha = tp7State.tapeDirtMode ? 0.24 : 0.88;

    for (let i = 0; i < n; i++) {
      this.smoothSpeed += (targetSpeed - this.smoothSpeed) * 0.008;
      const absV = Math.abs(this.smoothSpeed);

      if (absV < 0.006) {
        // Physically braked halt: subtle analog noise floor fades out cleanly
        outL[i] *= 0.2;
        outR[i] *= 0.2;
        continue;
      }

      this.audioSamplePos = (((this.audioSamplePos + this.smoothSpeed) % len) + len) % len;

      let sL = cubicHermite(loop.left, this.audioSamplePos);
      let sR = cubicHermite(loop.right, this.audioSamplePos);

      // Authentic magnetic tape head induction roll-off at very slow speeds
      const headFlux = Math.min(1.0, Math.pow(absV / 0.16, 0.52));
      sL *= headFlux;
      sR *= headFlux;

      // Subtle tactile vinyl/tape-rub friction texture when scratching
      if (tp7State.isScratching && absV > 0.08) {
        this.fingerNoiseSeed = (Math.imul(this.fingerNoiseSeed, 1664525) + 1013904223) >>> 0;
        const rub = ((this.fingerNoiseSeed >>> 16) / 32768 - 1) * 0.018 * Math.min(1, absV * 0.45);
        sL += rub;
        sR += rub * 0.8;
      }

      // Optional 1978 Dusty Tape tone filter + REC analog saturation
      this.dirtFilterL += dirtAlpha * (sL - this.dirtFilterL);
      this.dirtFilterR += dirtAlpha * (sR - this.dirtFilterR);

      if (recDrive > 1.01) {
        outL[i] = Math.tanh(this.dirtFilterL * recDrive) * 0.82;
        outR[i] = Math.tanh(this.dirtFilterR * recDrive) * 0.82;
      } else {
        outL[i] = this.dirtFilterL;
        outR[i] = this.dirtFilterR;
      }
    }
  }
}

export const tp7Audio = new TP7AudioEngine();
