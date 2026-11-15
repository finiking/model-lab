import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  root, configFile: false, plugins: [react()],
  build: {
    target: 'es2022', write: false, cssCodeSplit: false, assetsInlineLimit: 1024 * 1024,
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      input: resolve(root, 'src/main.tsx'),
      output: { format: 'iife', name: 'PocketPlanet', inlineDynamicImports: true },
    },
  },
});
const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
const js = outputs.filter(item => item.type === 'chunk');
if (js.length !== 1) throw new Error(`Expected one JS chunk, received ${js.length}`);
const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n');
const csp = "default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'";
const safe = code => code.replace(/<\/(script)/giu, '<\\/$1').replace(/<!--/gu, '<\\!--');
const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='26' fill='%2307131e' stroke='%23c3a371' stroke-width='3'/%3E%3Cellipse cx='32' cy='32' rx='12' ry='29' transform='rotate(35 32 32)' fill='none' stroke='%23c3a371' stroke-width='3'/%3E%3Ccircle cx='32' cy='32' r='12' fill='%23418a72'/%3E%3C/svg%3E";
const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07131e"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>掌中造物星盘 · Pocket Planet</title><link rel="icon" href="${favicon}"><style>${css}</style></head><body><div id="root"></div><script>${safe(js[0].code)}</script></body></html>\n`;
await mkdir(resolve(root, 'dist-wall'), { recursive: true });
await writeFile(resolve(root, 'dist-wall/index.html'), html);
console.log(`Self-contained terrarium: ${resolve(root, 'dist-wall/index.html')} (${Buffer.byteLength(html)} bytes; zero external assets)`);
