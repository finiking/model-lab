import { spawn } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '/Users/fini/workspace/dsh-plugins/dsh-game-studio/node_modules/playwright-core/index.mjs';
import {
  generateLofiTapeLoop,
  synthesizeKeyClick,
  synthesizeRockerSnap,
} from '../src/audio/lofiSynth.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const htmlPath = resolve(projectRoot, 'dist-wall/index.html');
const coverOutPath = resolve(projectRoot, 'dist-wall/cover.jpg');
const shot1Path = resolve(projectRoot, 'dist-wall/shot-1.png');
const shot2Path = resolve(projectRoot, 'dist-wall/shot-2.png');
const shot3Path = resolve(projectRoot, 'dist-wall/shot-3.png');
const wavTempPath = resolve(projectRoot, 'dist-wall/.showcase-audio.wav');
const videoOutPath = resolve('/Users/fini/workspace/codex/artifacts/hydrogen-tp7-deck.mp4');

const WIDTH = 1440;
const HEIGHT = 810;
const FPS = 60;
const DURATION_SEC = 14.0;
const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS);
const DT_MS = 1000 / FPS;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpVec3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Compute scratch velocity profile for Beat 2 (3.5s .. 6.75s)
function evaluateScratchProfile(s) {
  if (s < 3.5 || s >= 6.75) return { active: false, vel: 1.0 };
  if (s < 4.15) return { active: true, vel: 0.0 }; // physical finger brake halt
  if (s < 4.75) {
    const p = (s - 4.15) / 0.6;
    return { active: true, vel: -2.15 * Math.sin(p * Math.PI) };
  }
  if (s < 5.25) {
    const p = (s - 4.75) / 0.5;
    return { active: true, vel: 2.25 * Math.sin(p * Math.PI) };
  }
  if (s < 5.85) {
    const p = (s - 5.25) / 0.6;
    return { active: true, vel: -2.45 * Math.sin(p * Math.PI) };
  }
  if (s < 6.42) {
    const p = (s - 5.85) / 0.57;
    return { active: true, vel: 1.95 * Math.sin(p * Math.PI) };
  }
  return { active: true, vel: 0.0 }; // brief final brake pause before release
}

// Offline-render synchronized 14.0s stereo WAV matching exact showcase events
function renderShowcaseWavBuffer() {
  const sr = 48000;
  const totalSamples = Math.round(DURATION_SEC * sr);
  const loop = generateLofiTapeLoop(sr);
  const clickDown = synthesizeKeyClick(sr, true);
  const clickUp = synthesizeKeyClick(sr, false);
  const rockerSnap = synthesizeRockerSnap(sr);

  const outL = new Float32Array(totalSamples);
  const outR = new Float32Array(totalSamples);

  const mixMono = (buf, atSec, gain) => {
    const start = Math.round(atSec * sr);
    for (let i = 0; i < buf.length; i++) {
      const idx = start + i;
      if (idx >= 0 && idx < totalSamples) {
        outL[idx] += buf[i] * gain;
        outR[idx] += buf[i] * gain;
      }
    }
  };

  const hermite = (buf, pos) => {
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
  };

  let samplePos = 0;
  let smoothVel = 1.0;

  for (let i = 0; i < totalSamples; i++) {
    const s = i / sr;
    const scratch = evaluateScratchProfile(s);

    let targetVel = 1.0;
    if (scratch.active) {
      targetVel = scratch.vel;
    } else if (s >= 8.1 && s < 8.95) {
      targetVel = 2.25; // Rocker UP cue
    } else if (s >= 8.95 && s < 9.75) {
      targetVel = -2.15; // Rocker DOWN rew
    } else if (s >= 10.5 && s < 11.0) {
      targetVel = 0.0; // STOP pressed
    }

    const rate = scratch.active ? 0.0022 : targetVel === 0 ? 0.00025 : 0.0005;
    smoothVel += (targetVel - smoothVel) * rate;
    const absV = Math.abs(smoothVel);

    if (absV >= 0.006) {
      samplePos = (((samplePos + smoothVel) % loop.length) + loop.length) % loop.length;
      const flux = Math.min(1.0, Math.pow(absV / 0.16, 0.52));
      let l = hermite(loop.left, samplePos) * flux;
      let r = hermite(loop.right, samplePos) * flux;

      // REC analog saturation after 10.0s
      if (s >= 10.0) {
        l = Math.tanh(l * 1.48) * 0.85;
        r = Math.tanh(r * 1.48) * 0.85;
      }
      outL[i] += l;
      outR[i] += r;
    }
  }

  // Mix tactile finger-touch, rocker detent snaps, and orange mechanical key clicks
  mixMono(clickUp, 3.5, 0.55); // touch reel
  mixMono(rockerSnap, 8.1, 0.95);
  mixMono(rockerSnap, 8.95, 0.95);
  mixMono(rockerSnap, 9.75, 0.85);
  mixMono(clickDown, 10.0, 0.95); // REC down
  mixMono(clickUp, 10.28, 0.65); // REC up
  mixMono(clickDown, 10.5, 0.95); // STOP down
  mixMono(clickUp, 10.78, 0.65); // STOP up
  mixMono(clickDown, 11.0, 0.95); // PLAY down
  mixMono(clickUp, 11.28, 0.65); // PLAY up

  // Fade in first 40ms and fade out final 350ms cleanly
  const fadeInSamples = Math.round(0.04 * sr);
  const fadeOutSamples = Math.round(0.35 * sr);
  for (let i = 0; i < fadeInSamples; i++) {
    const g = i / fadeInSamples;
    outL[i] *= g;
    outR[i] *= g;
  }
  for (let i = 0; i < fadeOutSamples; i++) {
    const idx = totalSamples - 1 - i;
    const g = i / fadeOutSamples;
    outL[idx] *= g;
    outR[idx] *= g;
  }

  // Encode 16-bit PCM WAV
  const dataBytes = totalSamples * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);

  let off = 44;
  for (let i = 0; i < totalSamples; i++) {
    const sl = Math.max(-1, Math.min(1, outL[i]));
    const srVal = Math.max(-1, Math.min(1, outR[i]));
    buf.writeInt16LE(Math.round(sl * 32767), off);
    buf.writeInt16LE(Math.round(srVal * 32767), off + 2);
    off += 4;
  }
  return buf;
}

console.log('Synthesizing synced 14.0s stereo Lo-Fi + scratch + mechanical click WAV track...');
await mkdir(dirname(wavTempPath), { recursive: true });
await writeFile(wavTempPath, renderShowcaseWavBuffer());

console.log(`Launching headless Chrome GPU capture -> ${videoOutPath} (${WIDTH}x${HEIGHT} @ ${FPS}fps, ${DURATION_SEC}s)...`);
await mkdir(dirname(videoOutPath), { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=metal',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--hide-scrollbars',
  ],
});

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (err) => {
  console.error('[PAGE ERROR]', err.message);
  pageErrors.push(err.message);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.error('[CONSOLE ERROR]', msg.text());
    pageErrors.push(msg.text());
  }
});

// Virtualize clock & requestAnimationFrame for locked 60.000fps zero-jitter capture
await page.addInitScript(() => {
  let virtualNow = 1000;
  const baseEpoch = 1794466000000;
  let rafId = 1;
  const rafCallbacks = new Map();

  performance.now = () => virtualNow;
  Date.now = () => baseEpoch + Math.round(virtualNow);

  window.requestAnimationFrame = (cb) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafCallbacks.delete(id);
  };

  window.__stepVirtualFrame = (dtMs) => {
    virtualNow += dtMs;
    const batch = Array.from(rafCallbacks.values());
    rafCallbacks.clear();
    for (const cb of batch) {
      try {
        cb(virtualNow);
      } catch (err) {
        console.error(err);
      }
    }
  };
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.waitForTimeout(500);

// Warm up 12 frames so Environment PMREM & shaders compile cleanly
for (let i = 0; i < 12; i++) {
  await page.evaluate((dt) => window.__stepVirtualFrame(dt), DT_MS);
}

// Spawn ffmpeg H.264 60fps + AAC muxer
const ffmpeg = spawn(
  '/opt/homebrew/bin/ffmpeg',
  [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-framerate', String(FPS),
    '-i', '-',
    '-i', wavTempPath,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-vf', 'format=yuv420p',
    '-color_range', 'tv',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    videoOutPath,
  ],
  { stdio: ['pipe', 'ignore', 'pipe'] }
);

let ffmpegErr = '';
ffmpeg.stderr.on('data', (chunk) => {
  ffmpegErr += chunk.toString();
});

const writeFrameToFfmpeg = (buf) =>
  new Promise((resolveWrite, rejectWrite) => {
    const ok = ffmpeg.stdin.write(buf, (err) => {
      if (err) rejectWrite(err);
    });
    if (ok) resolveWrite();
    else ffmpeg.stdin.once('drain', resolveWrite);
  });

const HERO_START = [-4.0, 10.3, 13.4];
const HERO_MID = [-3.3, 9.5, 11.8];
const HERO_TARGET = [-0.75, 0.72, -0.18];

const MACRO_REEL_POS = [0.45, 8.2, 6.9];
const MACRO_REEL_TARGET = [0.15, 0.85, -0.55];

const MACRO_ROCKER_POS = [-7.6, 5.5, 6.5];
const MACRO_ROCKER_TARGET = [-0.85, 0.85, -0.05];

const HERO_FINALE = [-3.6, 9.9, 12.6];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const s = frame / FPS;
  const scratch = evaluateScratchProfile(s);

  let camPos = HERO_START;
  let camTarget = HERO_TARGET;

  if (s < 2.6) {
    const t = smoothstep(0.0, 2.6, s);
    camPos = lerpVec3(HERO_START, HERO_MID, t);
    camTarget = HERO_TARGET;
  } else if (s < 4.0) {
    const t = smoothstep(2.6, 4.0, s);
    camPos = lerpVec3(HERO_MID, MACRO_REEL_POS, t);
    camTarget = lerpVec3(HERO_TARGET, MACRO_REEL_TARGET, t);
  } else if (s < 7.2) {
    // Subtle macro breathing drift during platter brake & scratch
    const drift = Math.sin((s - 4.0) * 0.9) * 0.16;
    camPos = [MACRO_REEL_POS[0] + drift, MACRO_REEL_POS[1], MACRO_REEL_POS[2]];
    camTarget = MACRO_REEL_TARGET;
  } else if (s < 8.3) {
    const t = smoothstep(7.2, 8.3, s);
    camPos = lerpVec3(MACRO_REEL_POS, MACRO_ROCKER_POS, t);
    camTarget = lerpVec3(MACRO_REEL_TARGET, MACRO_ROCKER_TARGET, t);
  } else if (s < 11.4) {
    const drift = (s - 8.3) * 0.18;
    camPos = [MACRO_ROCKER_POS[0] + drift, MACRO_ROCKER_POS[1] + drift * 0.25, MACRO_ROCKER_POS[2] + drift * 0.3];
    camTarget = lerpVec3(MACRO_ROCKER_TARGET, [-0.35, 0.8, 0.15], smoothstep(8.3, 11.4, s));
  } else {
    const t = smoothstep(11.4, 14.0, s);
    camPos = lerpVec3(
      [MACRO_ROCKER_POS[0] + 3.1 * 0.18, MACRO_ROCKER_POS[1] + 3.1 * 0.045, MACRO_ROCKER_POS[2] + 3.1 * 0.054],
      HERO_FINALE,
      t
    );
    camTarget = lerpVec3([-0.35, 0.8, 0.15], HERO_TARGET, t);
  }

  await page.evaluate(
    ({ frameIdx, sec, dtMs, pos, target, scratchActive, scratchVel }) => {
      const dir = window.__tp7Director;
      if (!dir) return;

      dir.setCamera(pos, target);
      dir.setScratch(scratchActive, scratchVel);

      if (frameIdx === Math.round(8.1 * 60)) dir.setRocker('up');
      if (frameIdx === Math.round(8.95 * 60)) dir.setRocker('down');
      if (frameIdx === Math.round(9.75 * 60)) dir.setRocker('neutral');

      if (frameIdx === Math.round(10.0 * 60)) {
        dir.pressKey('rec', true);
        dir.setRecArmed(true);
      }
      if (frameIdx === Math.round(10.3 * 60)) dir.pressKey('rec', false);

      if (frameIdx === Math.round(10.5 * 60)) {
        dir.pressKey('stop', true);
        dir.setPlaying(false);
      }
      if (frameIdx === Math.round(10.8 * 60)) dir.pressKey('stop', false);

      if (frameIdx === Math.round(11.0 * 60)) {
        dir.pressKey('play', true);
        dir.setPlaying(true);
      }
      if (frameIdx === Math.round(11.3 * 60)) dir.pressKey('play', false);

      window.__stepVirtualFrame(dtMs);
    },
    {
      frameIdx: frame,
      sec: s,
      dtMs: DT_MS,
      pos: camPos,
      target: camTarget,
      scratchActive: scratch.active,
      scratchVel: scratch.vel,
    }
  );

  const jpegBuf = await page.screenshot({ type: 'jpeg', quality: 92 });
  await writeFrameToFfmpeg(jpegBuf);

  if (frame === Math.round(2.0 * FPS)) {
    const png1 = await page.screenshot({ type: 'png' });
    await writeFile(shot1Path, png1);
    const coverBuf = await page.screenshot({ type: 'jpeg', quality: 90 });
    await writeFile(coverOutPath, coverBuf);
    console.log(`Saved shot-1.png & cover.jpg at s=${s.toFixed(2)}s`);
  }
  if (frame === Math.round(5.55 * FPS)) {
    const png2 = await page.screenshot({ type: 'png' });
    await writeFile(shot2Path, png2);
    console.log(`Saved shot-2.png at s=${s.toFixed(2)}s`);
  }
  if (frame === Math.round(10.18 * FPS)) {
    const png3 = await page.screenshot({ type: 'png' });
    await writeFile(shot3Path, png3);
    console.log(`Saved shot-3.png at s=${s.toFixed(2)}s`);
  }

  if ((frame + 1) % 240 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Captured ${frame + 1}/${TOTAL_FRAMES} frames (${((frame + 1) / FPS).toFixed(1)}s)...`);
  }
}

ffmpeg.stdin.end();
const exitCode = await new Promise((res) => ffmpeg.on('close', res));
await browser.close();
await unlink(wavTempPath).catch(() => {});

if (exitCode !== 0) {
  throw new Error(`ffmpeg failed with exit code ${exitCode}:\n${ffmpegErr}`);
}
if (pageErrors.length > 0) {
  throw new Error(`Detected ${pageErrors.length} page/console errors:\n${pageErrors.join('\n')}`);
}
console.log(`Showcase video encoded successfully with AAC audio (0 page errors): ${videoOutPath}`);
