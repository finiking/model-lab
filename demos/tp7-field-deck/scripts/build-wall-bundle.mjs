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
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d4d8df'/%3E%3Ccircle cx='32' cy='28' r='17' fill='none' stroke='%2323272e' stroke-width='3'/%3E%3Ccircle cx='32' cy='28' r='5' fill='%2323272e'/%3E%3Ccircle cx='42' cy='28' r='3' fill='%23ff4f00'/%3E%3Crect x='14' y='50' width='10' height='6' rx='2' fill='%23ff4f00'/%3E%3Crect x='27' y='50' width='10' height='6' rx='2' fill='%23ff4f00'/%3E%3Crect x='40' y='50' width='10' height='6' rx='2' fill='%23ff4f00'/%3E%3C/svg%3E";

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
        name: 'TP7DeckApp',
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
  '<title>TP–7 // Brushed Aluminum Tape Field Recorder</title>',
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
