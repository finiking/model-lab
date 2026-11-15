import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function inlineSafe(text) {
  return text.replace(/<\/(script)/giu, '<\\/$1').replace(/<!--/gu, '<\\!--');
}

const CSP = [
  "default-src 'none'",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  'worker-src blob:',
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "form-action 'none'",
].join('; ');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23070b14'/%3E%3Ccircle cx='32' cy='32' r='22' fill='none' stroke='%23e2b154' stroke-width='3'/%3E%3Ccircle cx='32' cy='32' r='13' fill='%231b8f8c' stroke='%235ef0c8' stroke-width='1.5'/%3E%3Ccircle cx='50' cy='19' r='3.5' fill='%23ffd278'/%3E%3C/svg%3E";

const result = await build({
  root: projectRoot,
  configFile: false,
  logLevel: 'info',
  plugins: [react()],
  build: {
    target: 'es2022',
    write: false,
    cssCodeSplit: false,
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      input: resolve(projectRoot, 'src/main.tsx'),
      output: {
        format: 'iife',
        name: 'PocketPlanetApp',
        inlineDynamicImports: true,
      },
    },
  },
});

const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : result.output;
const jsChunks = outputs.filter((o) => o.type === 'chunk');
const cssAssets = outputs.filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'));

if (jsChunks.length !== 1) {
  throw new Error(`Expected exactly 1 JS chunk, got ${jsChunks.length}`);
}

const cssCode = cssAssets.map((a) => String(a.source)).join('\n');
const jsCode = jsChunks[0].code;

const html = [
  '<!doctype html>',
  '<html lang="zh-CN">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">',
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
  '<title>掌中造物星盘 · 微缩行星演化球 — Pocket Planet</title>',
  `<link rel="icon" type="image/svg+xml" href="${FAVICON}">`,
  `<style>${cssCode}</style>`,
  '</head>',
  '<body>',
  '<div id="root"></div>',
  `<script>${inlineSafe(jsCode)}</script>`,
  '</body>',
  '</html>',
  '',
].join('\n');

const outDir = resolve(projectRoot, 'dist-wall');
await mkdir(outDir, { recursive: true });
const outFile = resolve(outDir, 'index.html');
await writeFile(outFile, html, 'utf8');

console.log(
  `Built self-contained Game Wall bundle: ${outFile} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`
);
