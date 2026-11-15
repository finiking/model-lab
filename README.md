# 🧪 Fini 的模型实测馆 · Model Lab

> **在线展馆（即点即测 · 支持 AB 模型同屏对比）**：<https://finiking.github.io/model-lab/>  
> **姊妹站 · 游戏墙（完整可玩小游戏合集）**：<https://finiking.github.io/dsh-games/wall/>  
> **作者 X 主页**：[@FiniYang](https://x.com/FiniYang)

这里专门存放我在 X 上公开发布过的**大模型前端 / 3D / 物理 / 音频能力实测标本（Benchmark Demos）**——包括原始测试 Prompt、干净可读的模型生成源码（`demos/`），以及零外部依赖、点开就能在浏览器里把玩的单文件离线包（`play/`）。

与[游戏墙](https://finiking.github.io/dsh-games/wall/)里完整闭环的小游戏不同，这里的每一件展品都是**用来探测模型单轮上限、审美自觉、运动学一致性或物理着色器能力的「试金石标本」**。支持在展馆内一键切换不同模型的同题输出，或开启**左右同屏双开实时对比**。

---

## 📦 已收录实测标本

| 日期 | 标本名称 | 参测模型 | 题型 | 在线实测 | 源码与 Prompt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-11-15` | **TP-7 桌面拉丝铝合金磁带机** | `Gemini 4 Hydrogen (XHigh)` | 两句盲测 · 工业拟物 & 物理搓碟音频 | [▶ 在线试搓](https://finiking.github.io/model-lab/#tp7-field-deck) | [`demos/tp7-field-deck`](./demos/tp7-field-deck/) |
| `2026-11-14` | **掌中造物星盘 · 微缩行星演化球** | `Gemini 4 Hydrogen` (`23:08`) vs `GPT-6.1 Sol Max` (`40:05`) | AB 同题横评 · 微缩沙盘 & 海啸冰封着色器 | [⚖️ 同屏对比](https://finiking.github.io/model-lab/#pocket-planet:split) | [`demos/pocket-planet`](./demos/pocket-planet/) · [𝕏 原帖](https://x.com/FiniYang/status/2121485828568592711) |
| `2026-11-08` | **近日点 · 3D 鹈鹕 360° 立体骑车** | `GPT-6.2 Sol` vs `GPT-6.2 Astra` | AB 同题横评 · 海上竖环 & 日食运动学 | [⚖️ 同屏对比](https://finiking.github.io/model-lab/#pelican-perihelion:split) | [`demos/pelican-perihelion`](./demos/pelican-perihelion/) · [𝕏 Sol](https://x.com/FiniYang/status/2119474691727671736) / [Astra](https://x.com/FiniYang/status/2116856735390683281) |
| `2026-11-01` | **苍岚之境 · 3D 半开放世界 RPG 切片** | `GPT-6.2 Astra` | 单轮极限工程 · 20+ 模块与角色步态特效 | [▶ 在线实测](https://finiking.github.io/model-lab/#ashen-reach) | [`demos/ashen-reach`](./demos/ashen-reach/) · [𝕏 原帖](https://x.com/FiniYang/status/2116886715596243396) |
| `2026-10-23` | **PELICAN // OVERDRIVE · 机甲鹈鹕** | `Gemini 4 Argon` vs `Kimi K3.1 Pro` | AB 同题横评 · 纯内联 SVG 180° 曲柄联动 | [⚖️ 同屏对比](https://finiking.github.io/model-lab/#pelican-overdrive:split) | [`demos/pelican-overdrive`](./demos/pelican-overdrive/) · [𝕏 原帖](https://x.com/FiniYang/status/2113689317545795727) |

---

## 🗂️ 仓库目录结构

```text
model-lab/
├── index.html              # 「Fini 的模型实测馆」交互式展馆主页（支持筛选、Prompt 抽屉、AB 同屏对比）
├── demos.json              # 标本清单元数据（模型、耗时、原始 Prompt、原帖链接、构建体积）
├── demos/                  # 供开发者检阅的干净源码与 PROMPT.md（不含 node_modules 与大体积录屏）
└── play/                   # 零外部依赖的单文件 HTML 试玩包与封面（GitHub Pages 静态直出）
```

## 🚀 本地运行与新增标本

整个展馆是纯静态架构，本地任意静态服务器即可秒开：

```bash
python3 -m http.server 4590
# 浏览器访问 http://127.0.0.1:4590/
```

新增一条实测标本只需执行内置脚本：

```bash
node scripts/register-demo.mjs \
  --slug my-new-benchmark \
  --project /path/to/benchmark-project \
  --title "新模型实测题名称" \
  --model "Gemini 4 Hydrogen" \
  --category "两句盲测"
```
