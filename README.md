> v1.5.0: Reduced HUD clutter (optional debug display), upright/larger spatial bag, faster phone camera and taps on both halves, door placement/collision recovery, stale-light-result protection, improved 32px pixel-art materials. Existing saves and mesh format are unchanged.

> v1.4.0: Fixed inventory card clicking using the current pointer pixel, separated touch look gestures from hologram hover, adjusted player height to fit through the existing door, included light sources throughout the local light volume, and reduced naturally spawned sheep to six with wider spacing. No save or voxel-grid changes.

> v1.3.2: Mobile inventory keeps left-zone movement and right-zone camera input, selecting a card only on a right-zone tap release. Narrow mobile quickbars scroll without pushing the tool button offscreen.

> v1.3.2: Replaced repetitive horizontal wood stripes with irregular vertical bark grain and knots, concentric wood-end rings and softer plank structure. Texture stays 32×32 and the GPU vertex layout is unchanged.

> v1.3.2: Restored PC pointer-lock camera on C (right-drag remains for free cursor), preserved movement and camera control in the in-world inventory, redesigned HUD/settings/help. No world format changes.

> v1.2.0: Mobile gesture overhaul. Left-zone drag moves without placing; right-zone tap builds/uses, right-zone long hold mines, right-zone drag looks around. Two fingers can act independently. Minor finger jitter is filtered; interrupted gestures reset safely. The missing `canvasCursor` implementation is restored; pointer targeting uses CSS-pixel coordinates.

> v1.1.1 hotfix: PWA JS cache version mixing prevention, occluded 3D inventory card visibility, and runtime error diagnostics.

# MakTwo · Endless Night v1.5.0

An unhurried, moonlit voxel garden. **Morning never comes**: build a warm place in an endless gentle night. Built on a dependency-free WebGL2 voxel sandbox. The world loads immediately, with no start menu. The desktop mouse remains free for precise click-to-build; hold the right mouse button and drag to look around. Inspired by the block-building genre; no Minecraft assets, copyrighted textures, code, or external libraries.

## Run

```bash
python3 -m http.server 8080
# visit http://localhost:8080
```

No build or external dependencies are required. Node 18+ is needed for tests. WebGL2 must be available in the browser. Do **not** open `index.html` with `file://`, because ES modules normally need an HTTP origin.

```bash
npm test
```

## Current controls (v1.5)

| Input | Action |
|---|---|
| PC WASD / Space / Shift | Move / jump / crouch |
| PC **right mouse drag** | Look around without capturing the pointer |
| PC **short left click** | Place one block at the **clicked pixel** if an item is equipped; click a wooden door to open/close it |
| PC **hold left click (420ms+)** | Mine the exact block under the held cursor; hold for the target block's break time |
| Phone **drag left half** | Analog movement, based on displacement from touch start (no joystick overlay) |
| Phone **drag right half** | Look around; two simultaneous fingers supported |
| Phone **tap** | Place at the tapped screen position; tapping a door opens/closes it |
| Phone **stationary hold either half (420ms+)** | Mine a targeted block until completed; moving to look cancels the hold |
| Phone Jump / Descend buttons | Jump or fly downward |
| 1..0 / bottom hotbar / wheel | Select block; tap same slot again or Q to unequip |
| E / I / Bag | Open an **in-world** holographic bag. Its center stays anchored; its face billboard-rotates toward your character |
| L | Switch between building blocks and lights |
| M / Settings icon | Open HTML settings, switch world, save and recover water |
| F / P | Toggle flight / save the current world |

## Offline & installation

- GitHub Pages supports installable PWA mode: open the game once while online, then install from the browser menu (Android: *Install app*; iOS Safari: *Add to Home Screen*).
- Service Worker caches the complete static app shell, workers, WebGL shaders and icons for the selected scope. Subsequent launches and gameplay can work without network **after the first successful cache install**. No cloud synchronization exists.
- Saves remain in `localStorage`, same keys and chunk coordinates as before. Browser storage cleanup or uninstalling app/browser data may remove saves. Back up important worlds before clearing site data.
- Gameplay still requires a browser with WebGL2. Desktop and mobile rendering require device checks; Node tests do not measure FPS or guarantee browser GPU compatibility.

## Physical scale and performance

- One voxel side is physically **0.8 m**, including the WebGL world/hologram projection. The logical grid, chunk IDs, generated terrain and saved edits remain **integer voxel coordinates**. The player collision height is now 1.76 voxels (1.41 m) and eye height is 1.59 voxels (1.27 m), below the 1.88-voxel door mesh. Creature render meshes remain metric-sized.
- Streaming loads 37 chunks in a rounded 3-chunk ring instead of 49 square-ring chunks, with a smaller 56-chunk residency target. No change to the existing 16×16×64 storage size or generation algorithm.
- PC/multitouch gestures are handled as discrete taps versus holds at their actual screen coordinates. The game world can be manipulated without pointer lock; desktop right-drag rotates the camera.

## Historical version notes (superseded controls are not current)

### v0.6.0: Step-up and water recovery

- The voxel grid and existing saves are **unchanged**. Player collision height is 1.90 vs 1.80 previously; eye height 1.70 vs 1.62, so blocks look roughly 5% smaller relative to the player.
- Grounded entities can automatically climb obstacles up to one full block using a 0.125-step collision clearance sweep. Two-block walls and low ceilings still block passage.
- Water is now directly targetable when breaking blocks. The settings panel includes **주변 물 정리**. It restores only saved water edits within 24 blocks of the player (including old spilled water), keeping natural water and placed solids intact. Unloaded chunks are handled via saved edit records.
- Before recovery, the current full edit snapshot is backed up under `localStorage['mcweb:<world>:before-water-cleanup']`, then the recovered world is saved automatically.
- The old source-unaware water-spread code made permanent water copies. **Further water spreading is temporarily disabled**, until a source/flow-level implementation can retract liquid safely. Water blocks can still be placed, removed and rendered.

## Architecture

| Module | Responsibility |
|---|---|
| `core/blocks.js` | Block IDs, collision and render metadata |
| `core/lighting.js` | Chunk-indexed emissive fixture lookup |
| `core/lightVolume.js` | Occlusion-aware emissive light propagation in a compact 3D voxel grid |
| `client/light.worker.js` | Off-main-thread light volume generation |
| `client/hologram.js` | Depth-tested 3D card array with world-anchored center, viewer-facing billboard basis and screen ray hits |
| `client/picking.js` | Pixel-accurate screen ray casting shared by desktop and mobile building |
| `client/textures.js` | Deterministic 32×32 texture-array materials, one GPU upload and mipmaps |
| `core/door.js` | Reusable two-block door geometry and collision bounds |
| `core/chunk.js` | Fixed 16 × 16 × 64 typed-array voxel storage |
| `core/world.js` | Block access, streaming, edits, tick scheduling, local saves, multiverse |
| `core/physics.js` | AABB collision, swept substeps, movement, voxel DDA raycast |
| `core/systems.js` | Inventory, extensible block behaviors, projectiles, explosions |
| `worldgen/generators.js` | Seeded passes: surface, caves, ore, trees, decorations; normal/flat/islands |
| `entities/entities.js` | Player, sheep/zombie archetypes, simple wandering/chase AI |
| `core/effects.js` | Particle simulation |
| `client/mesher.js` | Greedy face merging and transparent mesh bucket |
| `client/renderer.js` | WebGL2 buffers, shaders, camera, visibility culling and adaptive render scale |
| `client/mesh.worker.js` | Background meshing of chunk snapshots with transferables |
| `client/input.js` | Keyboard, free-cursor primary tap/hold, right-drag camera and touch input |
| `client/game.js` | Main integration and fixed timestep orchestration |

## Extension points

- **Blocks:** Append an entry to `BLOCKS` (and an ID to `BLOCK`), then add a hotbar entry or behavior. Two-block doors occupy IDs 18/19; `World.blockStates` holds facing/open independently and persists in optional `states` save data. The current chunk format uses `Uint8Array`, so IDs must remain 0–255, and `World.set` validates them against the registry length.
- **Worldgen:** Implement a deterministic `(chunk, seed) => chunk` generator and dispatch by `World.mode` inside `worldgen/generators.js`. Use world coordinates for features extending across chunks.
- **Mobs:** Introduce new classes based on `Entity` / `Mob`, with AI in `update` and visual representation in `Renderer.dynamicData`.
- **Rendering:** The world now uses 32×32 generated albedo-modulation tiles in a WebGL2 2D texture array, with face IDs packed into existing seven-float mesh vertices. Mipmaps help at distance. No borrowed Minecraft assets or extra texture HTTP fetches.
- **Save format:** Chunk modifications persist via `localStorage`, not full chunk snapshots. For production persistence migrate to IndexedDB plus a revisioned save schema.
- **Portals:** Existing purple portal blocks still travel between worlds; the main hotbar now uses slot 10 for a wooden door. The world selector remains available.

## Deliberate limitations / next work

This is an engine playground, **not a full Minecraft recreation**. It has no crafting or network multiplayer, cross-chunk pathfinding, dynamic shadow maps, high-resolution soft global illumination, true liquid-level conservation, animated textures, or survival item drops. A standalone `Projectile` class is present but not tied to a bow input or its renderer. The `Inventory` and `BehaviorRegistry` are core extension APIs; the world-space creative bag currently lists the basic palette. Mob AI is elementary pursuit and wandering rather than A*. Keyboard and WebGL2 are implemented, but automated tests cover only the renderer-independent code and mesh construction, not visual or browser driver execution.

## Notes

- Fixed simulation: 60 ticks/s, with accumulator cap to prevent runaway catch-up.
- Greedy meshing combines adjacent identical block faces into quads, reducing GPU vertices.
- One chunk mesh submission per frame; at most two worker jobs running and one GPU upload per frame. Fallback to main-thread meshing if Web Workers are unavailable.
- Canvas resolution adapts downward on sustained slow frames; WebGL antialiasing is off to avoid extra GPU cost.
- Render chunk range is 88 blocks and chunks behind the camera are conservatively skipped.
- Revisions guard against publishing stale worker results when blocks or neighbor chunks change.
- Block-face culling handles missing neighboring chunks and marks adjacent meshes dirty when newly loaded.
- The clock stays fixed at night. Old saved worlds still keep their block edits; the previous time-of-day value is intentionally ignored.
- Saved worlds are scoped by world name, seed and generator mode; ensure `localStorage` is available.

## Optimization verification

`npm test` validates chunk streaming, camera projection, merged geometry, worker snapshots, physics and world travel. Baseline 9-chunk scene: 20,772 drawn quads / 3.49 MB geometry; v0.2: 4,653 quads / 0.78 MB geometry on the same generated seed and chunk coordinates (Node benchmark, not FPS). Browser real-world FPS must be assessed on the target device.

## Endless Night lighting v0.3

- Three placeable light fixtures: torch, lantern and campfire. Toggle the light palette with **L**, then use 1–3.
- Nearby terrain is shaded by warm point lights in the WebGL2 fragment shader. Emissive faces are encoded within the existing seven-float vertex stride, retaining greedy meshing and the meshing worker.
- Light registration is automatic on chunk load, edits and unload. Save data stays compatible with older edits.
- Up to 8 nearby lights are evaluated per pixel (fixed GPU budget). This is an artistic non-shadow-casting approximation: walls do not block illumination yet.
- Sheep spawn naturally in the peaceful world. Zombies remain available to manually spawn for testing with Shift+G.
- Keep terrain readability with gentle moonlight; no morning/sunrise transition.

**Known limitation:** Runtime FPS and light appearance must be checked on a browser with working WebGL2; Node tests validate core behavior and mesh output only.

### Usability and night contrast v0.4

- Ambient sky and ground lighting are deliberately dimmer. Warm torch, lantern and campfire light gives a visible, cozy pool of light that can be extended gradually by building.
- **How to build:** look at an existing block, select a new block with 1–0 or mouse wheel, then right-click (or press **R**) to place it adjacent to the targeted face. Left-click breaks the targeted block.
- **No repeated Esc:** press **E** to release the mouse and open the settings. All toolbar and hotbar buttons stay clickable. Press **E** again or click **Return to game**; clicking the world also resumes mouse look. Esc now opens the controls after releasing pointer lock.
- The HUD shows the essential controls, including the menu shortcut, without relying on an initial tutorial screen.
- All three light fixture meshes are generated, not only torches. Nearby light lookup searches only relevant chunk indices so more distant light placements do not raise frame-wide scan costs.
- This artistic lighting is still non-occluding: walls do not cast shadows. Visual appearance and FPS on real hardware require browser testing.

### Spatial inventory & softer night atmosphere v0.5.1

- The creative building bag is an in-game CSS 3D layer over the live world, opened by **E / I** or the bottom-left **Bag** button. It uses no extra WebGL scene and blocks movement/placement while open. Clicking an item selects it and returns to gameplay in one step. **M** opens the settings separately.
- Warm fixtures now have a **larger, softer radius** and less intense orange centers, using a smooth distance-squared attenuation that does not introduce per-pixel square roots.
- Night is **not pitch black**: moderate dim ambient light preserves terrain silhouettes. A lightweight sky gradient moves with the camera pitch, transitioning from charcoal overhead to a muted horizon instead of a flat navy fill.
- This is artistic lighting, not occlusion or shadow casting. Rendering and pointer-lock behavior still need visual verification in a real browser; Node tests do not measure FPS or prove GPU shader compilation.

### v0.7: No wall-penetrating light / a truly in-game holographic bag

- Light is propagated through **reachable air cells** in a local 80×64×80 voxel volume. Opaque walls stop it; doorways let it through, and corners naturally receive weaker reflected-looking light. Light is never calculated by sampling the wall voxel itself.
- The grid is recomputed when the view moves into a new chunk, nearby blocks change or chunks load/unload. It is computed in a **dedicated Web Worker** and uploaded as a single WebGL2 3D texture; the fragment shader uses **one texture lookup**, instead of evaluating 8 lights per pixel. CPU synchronous fallback is available if Worker construction fails.
- Blended light accumulation is compressed before RGB8 conversion, preventing overbright saturation where torches overlap. Light-lit terrain reflectance is partially neutralized so grass is illuminated with **soft amber**, rather than glowing saturated green.
- Press **E / I**: the bag is now a **real 3D quad rendered by WebGL in the world**, not HTML with CSS perspective. Its position and orientation are defined from player/world coordinates. Mouse is kept captured, moving the reticle inside the panel. Click a tile to equip and close, click the on-panel tabs to switch category, or press **L**; press **E** to close. No Escape loop.
- Settings and help remain accessible HTML overlays on **M / H**. Existing saved blocks, generation, mesh worker and physics behavior are unchanged.
- Tests include opaque-wall light blocking, doorway propagation, overlapping lamp compression, volume snapshots, and hologram hit tests. **Actual browser WebGL rendering remains unverified in the automated environment** and should be checked on-device.

### v0.9.0: World-anchored inventory and hold-to-break

- Replaces the large camera-facing menu surface with small, separated cards in the **actual world coordinates**, anchored when opened. The regular camera turns during selection, and **scene depth testing** allows opaque terrain to occlude the tiles. Individual cards use one shared small atlas and one batched draw call. This is not a fullscreen HTML/CSS modal, though the settings and help overlays remain ordinary HTML.
- Clicking with a selected item now **places one block per mouse press**. Press Q, select the same item again, or choose **맨손** in the spatial bag to unequip; empty-hand left-click then **mines while held**. Right-click can mine while an item is equipped. R no longer places blocks.
- Every block defines `breakTime` in seconds independently from blast resistance. Mining is cancellable, starts over on a different target, and shows a small progress meter. Bedrock remains unbreakable.
- Save data, registered block IDs, existing terrain generation and meshing algorithms are not changed. Runtime WebGL2 appearance still requires real-device validation.


## v1.4.0 experimental expansion

- A distinct **Highlands** world explores warped ridgelines, steep mountain belts and curved valleys without changing existing terrain generators. Select it from the world settings.
- The inventory adds a **정원** tab with paths, fences and small luminous mushrooms. These use stable new block IDs `20`, `21`, `22`, leaving old saves intact.
- Gameplay catalogs, collider shapes and the door/fence picking box share their source of truth. New content is no longer added as arbitrary exceptions to `collides()`.
- See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for boundaries, world-generation limitations and planned vertical sections.

The Highland terrain is an **early, heightfield-based prototype**, not hydraulic erosion or a full rewrite of the world renderer. Real-device WebGL/PWA verification is still required.
