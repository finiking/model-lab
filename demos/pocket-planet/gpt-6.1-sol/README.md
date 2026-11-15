# 掌中造物星盘 · Pocket Planet

A playable brass astrolabe terrarium, built with React Three Fiber, Three.js, and `@react-three/postprocessing`. All geometry, glass, ocean, terrain, engravings, foliage, town, train, clouds, auroras, particles, and environment lighting are generated locally. No external assets, fonts, or network requests are required.

## Play

Open `dist-wall/index.html` directly, or run `npm run dev`.

| Control | Action |
| --- | --- |
| Spring bloom / `1` | Grow a new forest layer, flowers, fireflies, and spring wisps; speed up the train. |
| Meteor strike / `2` | Send a flaming meteor toward the planet; deform a lava crater and send geodesic tsunami rings across the ocean. |
| Click the planet | Place the meteor impact at the picked point on the sphere. |
| Polar ice age / `3` | Freeze the ocean into faceted ice, illuminate polar aurora curtains, and switch to bioluminescent night. Toggle to thaw. |
| Solar dial / `4` | Sweep between golden daylight and night. The slider sets the light continuously. Returning to dawn thaws the ocean. |
| Drag / scroll | Rotate the instrument / zoom. |
| Begin again / `R` | Reset the simulation. |

## Build and verify

```sh
npx tsc --noEmit
npm run build
npm run build:wall
npm run verify
npm run record
```

`dist-wall/index.html` contains the entire app, CSS, shaders, and generated assets in one offline HTML document. Its CSP blocks external connections.

`verify-play.mjs` drives real browser controls, drag, zoom, picking, reset, shortcuts, and the mobile layout. It checks actual rendered shader uniforms as well as simulation state, records page/console errors, and rejects external asset requests. Reports live in `dist-wall`.

The renderer uses explicit separate postprocessing passes, non-multisampled render targets, selective HDR bloom, subtle macro depth of field, ACES tone mapping, FXAA, and vignette. The glass is a transparent Fresnel shader with narrow procedural reflections so the diorama remains clear. The sun, weather, and crater shaders update the material's actual uniforms rather than the copied React prop object.

## Exact showcase

`scripts/record-showcase.mjs` launches the specified Chrome executable with ANGLE Metal. It virtualizes `requestAnimationFrame`, `performance.now`, and `Date.now`, advances exactly 960 frames at 1/60 second each, and pipes lossless PNG frames through the specified Homebrew ffmpeg H.264 pipeline. The output explicitly uses limited range so ffprobe reports `yuv420p`, avoiding MJPEG's inherited `yuvj420p` full-range tag.

| Time | Live control and visual beat |
| --- | --- |
| 0–4 s | Golden daylight, brass and clear glass, orbiting miniature train, spring bloom. |
| 4–9 s | Flaming meteor, impact particles, molten crater, expanding ocean tsunami rings. |
| 9–13.5 s | Polar ice age, emerald/violet auroras, glowing forests, town windows, train headlights. |
| 13.5–16 s | Smooth solar dawn and thaw back to golden morning. |

Output: `/Users/fini/workspace/codex/artifacts/pocket-planet-sol-gameplay.mp4`, 1440×810, 60 fps, 16.0 seconds. Cover and three beat screenshots are saved in `dist-wall`. `npm run record -- --stills` runs the same deterministic sequence without encoding the reel.

Implementation references: [R3F frame hooks](https://github.com/pmndrs/react-three-fiber/blob/master/docs/API/hooks.mdx), [React Postprocessing Bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom), [EffectComposer](https://react-postprocessing.docs.pmnd.rs/effect-composer).
