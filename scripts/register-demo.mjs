#!/usr/bin/env node
/**
 * Stage a new benchmark specimen into model-lab:
 *   node scripts/register-demo.mjs --slug brass-locomotive \
 *     --project /Users/fini/workspace/codex/hydrogen-brass-locomotive \
 *     --title "黄铜蒸汽机车爆炸拆解" \
 *     --model "Gemini 4 Hydrogen"
 */
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'

const args = process.argv.slice(2)
function flag(name, fallback = '') {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

const slug = flag('slug')
const project = flag('project')
const title = flag('title', slug)
const model = flag('model', 'Gemini 4 Hydrogen')
const category = flag('category', '两句盲测')

if (!slug || !project) {
  console.error('Usage: node scripts/register-demo.mjs --slug <slug> --project <dir> [--title <zh>] [--model <name>] [--category <cat>]')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..')
const srcDir = resolve(project)
const demoDst = join(root, 'demos', slug)
const playDst = join(root, 'play', slug)

await mkdir(demoDst, { recursive: true })
await mkdir(playDst, { recursive: true })

const SKIP = new Set(['node_modules', 'dist', 'dist-wall', '.git', '.DS_Store', 'output'])
await cp(srcDir, demoDst, {
  recursive: true,
  verbatimSymlinks: false,
  filter: (source) => {
    const name = basename(source)
    if (SKIP.has(name)) return false
    if (/\.(mp4|mov|wav|m4a|log|zip|tar|gz)$/i.test(name)) return false
    if (/^shot-\d+\.png$/i.test(name)) return false
    return true
  },
})

const bundleCandidates = [
  join(srcDir, 'dist-wall', 'index.html'),
  join(srcDir, 'index.html'),
]
let bundlePath = ''
for (const c of bundleCandidates) {
  try {
    if ((await stat(c)).isFile()) { bundlePath = c; break }
  } catch {}
}
if (!bundlePath) {
  console.error('Could not find dist-wall/index.html or index.html in', srcDir)
  process.exit(1)
}
await cp(bundlePath, join(playDst, 'index.html'))

const coverCandidates = [
  join(srcDir, 'dist-wall', 'shot-1.png'),
  join(srcDir, 'dist-wall', 'cover.jpg'),
]
for (const c of coverCandidates) {
  try {
    if ((await stat(c)).isFile()) {
      execFileSync('/opt/homebrew/bin/ffmpeg', [
        '-y', '-loglevel', 'error', '-i', c,
        '-vf', 'scale=960:540:force_original_aspect_ratio=increase,crop=960:540',
        '-frames:v', '1', '-q:v', '4', join(playDst, 'cover.jpg'),
      ])
      break
    }
  } catch {}
}

const manifestPath = join(root, 'demos.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.updatedAt = new Date().toISOString().slice(0, 10)
if (!manifest.demos.some((d) => d.id === slug)) {
  manifest.demos.unshift({
    id: slug,
    title,
    enTitle: slug,
    date: manifest.updatedAt,
    category,
    tags: ['Three.js', '零外部资产'],
    audio: false,
    featured: false,
    summary: `${model} 实测标本：${title}`,
    controlsHint: '鼠标拖拽旋转视角，滚轮缩放，点击底部控制面板切换状态',
    sourceDir: `demos/${slug}`,
    xPostUrl: null,
    promptSummary: `${model} 原始测试提示词`,
    prompt: '请补充原始测试 Prompt 到 demos.json 与 demos/<slug>/PROMPT.md',
    variants: [
      {
        key: 'primary',
        label: model,
        tier: '单轮直出',
        family: model.toLowerCase().includes('gemini') ? 'gemini' : model.toLowerCase().includes('gpt') ? 'openai' : 'other',
        elapsed: '单轮直出',
        bundleSize: `${((await stat(join(playDst, 'index.html'))).size / 1048576).toFixed(2)} MB`,
        playUrl: `play/${slug}/`,
        cover: `play/${slug}/cover.jpg`,
        sourcePath: `demos/${slug}`,
      },
    ],
  })
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}
console.log(`Registered ${slug} -> demos/${slug} & play/${slug}`)
