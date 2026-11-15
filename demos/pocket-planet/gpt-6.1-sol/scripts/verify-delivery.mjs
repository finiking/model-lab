import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, WIDTH, HEIGHT, FPS, FRAMES } from './capture-utils.mjs';

const video = '/Users/fini/workspace/codex/artifacts/pocket-planet-sol-gameplay.mp4';
const probe = spawnSync('/opt/homebrew/bin/ffprobe', [
  '-v', 'error', '-count_frames', '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration:format=duration,size',
  '-of', 'json', video,
], { encoding: 'utf8' });
assert.equal(probe.status, 0, probe.stderr);
const metadata = JSON.parse(probe.stdout), stream = metadata.streams[0];
assert.equal(stream.codec_name, 'h264'); assert.equal(stream.width, WIDTH); assert.equal(stream.height, HEIGHT);
assert.equal(stream.pix_fmt, 'yuv420p'); assert.equal(stream.r_frame_rate, `${FPS}/1`); assert.equal(stream.avg_frame_rate, `${FPS}/1`);
assert.equal(metadata.format.duration, '16.000000'); assert.equal(stream.duration, '16.000000');
assert.equal(Number(stream.nb_read_frames), FRAMES); assert.equal(Number(stream.nb_frames), FRAMES);
const files = [];
for (const path of [resolve(root, 'dist-wall/index.html'), resolve(root, 'dist-wall/cover.jpg'), ...[1, 2, 3].map(n => resolve(root, `dist-wall/shot-${n}.png`)), video]) {
  const data = await readFile(path); const info = await stat(path);
  const item = { path, bytes: info.size, sha256: createHash('sha256').update(data).digest('hex') };
  if (/\.(png|jpg)$/u.test(path)) {
    const imageProbe = spawnSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', path], { encoding: 'utf8' });
    assert.equal(imageProbe.status, 0, imageProbe.stderr);
    Object.assign(item, JSON.parse(imageProbe.stdout).streams[0]);
    assert.equal(item.width, WIDTH); assert.equal(item.height, HEIGHT);
  }
  files.push(item);
}
const capture = JSON.parse(await readFile(resolve(root, 'dist-wall/capture-report.json'), 'utf8'));
const play = JSON.parse(await readFile(resolve(root, 'dist-wall/play-verification.json'), 'utf8'));
assert.equal(capture.frames, FRAMES); assert.equal(capture.output, video);
assert.deepEqual(capture.pageAndConsoleErrors, []); assert.deepEqual(play.pageAndConsoleErrors, []);
assert.deepEqual(capture.externalRequests, []); assert.deepEqual(play.externalRequests, []);
const report = { metadata, files, pageAndConsoleErrors: 0, externalAssetRequests: 0, interactionChecks: play.checks.length };
await writeFile(resolve(root, 'dist-wall/delivery-metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
