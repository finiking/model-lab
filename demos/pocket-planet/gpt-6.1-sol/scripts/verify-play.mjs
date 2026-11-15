import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openPlanet, root, step } from './capture-utils.mjs';

const { browser, page, errors, warnings, requests } = await openPlanet();
const checks = [];
async function metrics() { return page.evaluate(() => window.__planet.metrics()); }
try {
  assert.equal((await metrics()).ready, true); checks.push('WebGL scene rendered');
  const initialAngle = (await metrics()).trainAngle;
  await page.locator('#bloom').click(); await step(page, 120);
  assert.ok((await metrics()).spring > .95); assert.ok((await metrics()).trainAngle > initialAngle); checks.push('Spring grows life and accelerates the moving train');
  await page.locator('#meteor').click(); await step(page, 90);
  assert.equal((await metrics()).strikes, 1);
  assert.ok((await metrics()).terrain.uAge > .94); assert.ok((await metrics()).ocean.uAge > .94);
  checks.push('Meteor button reaches the actual terrain crater and ocean tsunami shader uniforms');
  await page.locator('#ice').click(); await step(page, 150);
  assert.ok((await metrics()).ice > .95); assert.ok((await metrics()).night > .98);
  assert.ok((await metrics()).ocean.uIce > .95); assert.ok((await metrics()).aurora.uPower > 1);
  assert.ok((await metrics()).terrain.uNight > .98);
  checks.push('Ice age reaches the rendered ocean, terrain night, and polar aurora uniforms');
  await page.locator('#solar').click(); await step(page, 150);
  assert.ok((await metrics()).night < .02); assert.ok((await metrics()).ice < .03); checks.push('Solar toggle smoothly returns to daylight');
  await page.locator('#solar-dial').fill('75'); await step(page, 120);
  assert.ok((await metrics()).night > .70); checks.push('Solar slider independently controls day/night');
  await page.locator('#reset').click(); await step(page, 1);
  assert.equal((await metrics()).strikes, 0); assert.equal((await metrics()).mode, 'garden'); checks.push('Reset restores the initial planet');
  await page.mouse.move(720, 370); await page.mouse.down(); await page.mouse.move(810, 400, { steps: 8 }); await page.mouse.up();
  await step(page, 2); assert.ok((await metrics()).rotation > .3); assert.equal((await metrics()).strikes, 0); checks.push('Drag spins the astrolabe without an accidental impact');
  await page.mouse.wheel(0, -150); await step(page, 2); assert.ok((await metrics()).zoom > 1.01); checks.push('Scroll zoom changes the camera distance');
  await page.locator('#reset').click(); await step(page, 2); await page.mouse.click(720, 350); await step(page, 1);
  assert.equal((await metrics()).strikes, 1); checks.push('Click on the actual planet calls a meteor at the picked point');
  await page.keyboard.press('1'); await step(page, 1); assert.ok((await metrics()).blooms > 0); checks.push('Keyboard shortcuts work');
  await page.setViewportSize({ width: 390, height: 844 }); await step(page, 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(await page.locator('#bloom').isVisible(), true); checks.push('390px responsive controls fit without page overflow');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); checks.push('Zero page/console errors and zero external asset requests');
  const report = { checks, pageAndConsoleErrors: errors, warnings, externalRequests: requests };
  await writeFile(resolve(root, 'dist-wall/play-verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
