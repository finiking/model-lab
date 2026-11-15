import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { openPlanet, root, WIDTH, HEIGHT, FPS, DURATION, FRAMES, beat, step } from './capture-utils.mjs';

const stillsOnly = process.argv.includes('--stills');
const output = '/Users/fini/workspace/codex/artifacts/pocket-planet-sol-gameplay.mp4';
await mkdir(dirname(output), { recursive: true });
const { browser, page, errors, warnings, requests } = await openPlanet();
const shots = new Map([[180, 'shot-1.png'], [338, 'shot-2.png'], [720, 'shot-3.png']]);
const milestones = [];
let encoder, encoderDone, encoderLog = '';
if (!stillsOnly) {
  encoder = spawn('/opt/homebrew/bin/ffmpeg', [
    '-y', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-vf', 'format=yuv420p', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-frames:v', String(FRAMES), '-movflags', '+faststart', output,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  encoder.stderr.on('data', data => { encoderLog += data.toString(); });
  encoderDone = new Promise((resolveDone, rejectDone) => { encoder.on('error', rejectDone); encoder.on('close', code => code === 0 ? resolveDone() : rejectDone(new Error(encoderLog))); });
  encoder.stdin.on('error', err => { errors.push(`ENCODER: ${err.message}`); });
}
try {
  for (let frame = 0; frame < FRAMES; frame++) {
    await beat(page, frame); await step(page);
    if (!stillsOnly) {
      const png = await page.screenshot({ type: 'png', animations: 'allow' });
      if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    }
    if (frame === 150) await page.screenshot({ path: resolve(root, 'dist-wall/cover.jpg'), type: 'jpeg', quality: 95 });
    if (shots.has(frame)) { const path = resolve(root, 'dist-wall', shots.get(frame)); await page.screenshot({ path }); console.log(`Saved ${path} at ${(frame / FPS).toFixed(3)}s`); }
    if ([0, 239, 296, 539, 720, 809, 959].includes(frame)) milestones.push({ frame, second: frame / FPS, ...await page.evaluate(() => window.__planet.metrics()) });
    if ((frame + 1) % 120 === 0) console.log(`Captured ${frame + 1}/${FRAMES} (${((frame + 1) / FPS).toFixed(1)}s)`);
  }
  if (encoder) { encoder.stdin.end(); await encoderDone; }
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  if (requests.length) throw new Error(`External asset requests: ${requests.join(', ')}`);
  const report = { output: stillsOnly ? 'stills only' : output, width: WIDTH, height: HEIGHT, fps: FPS, duration: DURATION, frames: FRAMES, frameTransport: 'lossless PNG', pixelFormat: 'yuv420p', colorRange: 'tv',
    bytes: stillsOnly ? undefined : (await stat(output)).size, pageAndConsoleErrors: errors, warnings, externalRequests: requests, milestones };
  await writeFile(resolve(root, 'dist-wall/capture-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { if (encoder && !encoder.stdin.destroyed) encoder.stdin.end(); await browser.close(); }
