import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '/Users/fini/workspace/dsh-plugins/dsh-game-studio/node_modules/playwright-core/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const htmlPath = resolve(projectRoot, 'dist-wall/index.html');
const coverOutPath = resolve(projectRoot, 'dist-wall/cover.jpg');
const shot1Path = resolve(projectRoot, 'dist-wall/shot-1.png');
const shot2Path = resolve(projectRoot, 'dist-wall/shot-2.png');
const shot3Path = resolve(projectRoot, 'dist-wall/shot-3.png');
const videoOutPath = resolve('/Users/fini/workspace/codex/artifacts/pocket-planet-gameplay.mp4');

const WIDTH = 1440;
const HEIGHT = 810;
const FPS = 60;
const DURATION_SEC = 16.0;
const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS);
const DT_MS = 1000 / FPS;

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

// Spawn ffmpeg H.264 60fps encoder reading MJPEG frames over stdin
const ffmpeg = spawn(
  '/opt/homebrew/bin/ffmpeg',
  [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-framerate', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-vf', 'format=yuv420p',
    '-color_range', 'tv',
    '-pix_fmt', 'yuv420p',
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

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const sec = frame / FPS;

  await page.evaluate(
    ({ frameIdx, s, dtMs }) => {
      const dir = window.__pocketDirector;
      const store = window.__pocketPlanet;
      if (!dir || !store) return;

      // Act 1 (0.0s - 4.0s): Golden Day + Brass Astrolabe + Miniature Train + Spring Bloom
      if (frameIdx === 0) {
        dir.setAct('day');
        dir.setView(-0.42, 0.22, 1.0);
        store.trainAngle = 1.02;
      }
      if (s < 4.0) {
        store.astrolabeYaw = -0.42 + s * 0.22;
        store.astrolabePitch = 0.22 + Math.sin(s * 0.8) * 0.04;
      }
      if (frameIdx === Math.round(1.3 * 60)) {
        dir.setAct('spring');
      }

      // Act 2 (4.0s - 9.0s): Flaming Meteor Strike (Ocean Circular Tsunami + Land Lava Crater)
      if (frameIdx === Math.round(4.1 * 60)) {
        dir.setAct('meteor');
        dir.strikeFrontOcean();
      }
      if (frameIdx === Math.round(5.4 * 60)) {
        dir.strikeFrontLand();
      }
      if (s >= 4.0 && s < 9.0) {
        const p = (s - 4.0) / 5.0;
        dir.setSolar(0.40 + p * 0.34);
        store.astrolabeYaw += 0.0014;
        store.astrolabePitch = 0.20 - Math.sin(p * Math.PI) * 0.05;
      }

      // Act 3 (9.0s - 13.5s): Polar Ice Age + Deep Night Bioluminescence + Polar Aurora Ribbons
      if (frameIdx === Math.round(9.0 * 60)) {
        dir.setAct('ice');
      }
      if (s >= 9.0 && s < 13.5) {
        const p = (s - 9.0) / 4.5;
        dir.setSolar((0.68 + p * 0.30) % 1);
        store.astrolabeYaw += 0.0055;
        store.astrolabePitch = 0.20 + Math.min(1, p * 1.4) * 0.22;
      }

      // Act 4 (13.5s - 16.0s): Solar Dawn Sweep back to Golden Morning
      if (frameIdx === Math.round(13.5 * 60)) {
        store.toggleIceAge(false);
        store.toggleSpringBloom(true);
      }
      if (s >= 13.5) {
        const p = (s - 13.5) / 2.5;
        dir.setSolar((0.98 + p * 0.36) % 1);
        store.astrolabeYaw += 0.0055;
        store.astrolabePitch = 0.42 - p * 0.20;
      }

      window.__stepVirtualFrame(dtMs);
    },
    { frameIdx: frame, s: sec, dtMs: DT_MS }
  );

  const jpegBuf = await page.screenshot({ type: 'jpeg', quality: 92 });
  await writeFrameToFfmpeg(jpegBuf);

  if (frame === Math.round(2.6 * FPS)) {
    const png1 = await page.screenshot({ type: 'png' });
    await writeFile(shot1Path, png1);
    const coverBuf = await page.screenshot({ type: 'jpeg', quality: 88 });
    await writeFile(coverOutPath, coverBuf);
    console.log(`Saved shot-1.png & cover.jpg at s=${sec.toFixed(2)}s`);
  }
  if (frame === Math.round(6.8 * FPS)) {
    const png2 = await page.screenshot({ type: 'png' });
    await writeFile(shot2Path, png2);
    console.log(`Saved shot-2.png at s=${sec.toFixed(2)}s`);
  }
  if (frame === Math.round(12.2 * FPS)) {
    const png3 = await page.screenshot({ type: 'png' });
    await writeFile(shot3Path, png3);
    console.log(`Saved shot-3.png at s=${sec.toFixed(2)}s`);
  }

  if ((frame + 1) % 240 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Captured ${frame + 1}/${TOTAL_FRAMES} frames (${((frame + 1) / FPS).toFixed(1)}s)...`);
  }
}

ffmpeg.stdin.end();
const exitCode = await new Promise((res) => ffmpeg.on('close', res));
await browser.close();

if (exitCode !== 0) {
  throw new Error(`ffmpeg failed with exit code ${exitCode}:\n${ffmpegErr}`);
}
if (pageErrors.length > 0) {
  throw new Error(`Detected ${pageErrors.length} page/console errors:\n${pageErrors.join('\n')}`);
}
console.log(`Showcase video encoded successfully (0 page errors): ${videoOutPath}`);
