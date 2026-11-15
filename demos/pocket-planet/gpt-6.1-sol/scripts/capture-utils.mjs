import { chromium } from '/Users/fini/workspace/dsh-plugins/dsh-game-studio/node_modules/playwright-core/index.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WIDTH = 1440, HEIGHT = 810, FPS = 60, DURATION = 16, FRAMES = 960;
export async function openPlanet() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--hide-scrollbars'],
  });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [], warnings = [], requests = [];
  page.on('pageerror', err => errors.push(`PAGE: ${err.message}`));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`); if (msg.type() === 'warning') warnings.push(msg.text()); });
  page.on('request', request => { if (/^https?:/u.test(request.url())) requests.push(request.url()); });
  await page.addInitScript(() => {
    let now = 1000, id = 1; const callbacks = new Map();
    Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
    Date.now = () => 1794614400000 + Math.round(now);
    window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
    window.cancelAnimationFrame = handle => { callbacks.delete(handle); };
    window.__stepVirtualFrame = dt => {
      now += dt; window.__virtualNow = now;
      const batch = Array.from(callbacks.values()); callbacks.clear();
      for (const callback of batch) callback(now);
    };
  });
  await page.goto(pathToFileURL(resolve(root, 'dist-wall/index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__planet);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(150);
  for (let i = 0; i < 24; i++) await step(page);
  await page.evaluate(() => window.__planet.actions.reset());
  return { browser, context, page, errors, warnings, requests };
}
export async function step(page, count = 1) {
  await page.evaluate(({ count, dt }) => { for (let i = 0; i < count; i++) window.__stepVirtualFrame(dt); }, { count, dt: 1000 / FPS });
}
export async function beat(page, frame) {
  if (frame === 0) await page.locator('#bloom').click();
  if (frame === 240) await page.locator('#meteor').click();
  if (frame === 540) await page.locator('#ice').click();
  if (frame === 810) await page.locator('#solar').click();
}
