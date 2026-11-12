# MakTwo · Endless Night v0.6.0

An unhurried, moonlit voxel garden. **Morning never comes**: build a warm place in an endless gentle night. Built on a dependency-free WebGL2 voxel sandbox. The world loads immediately, with no start menu. Click the canvas to capture the mouse (required by the browser). Inspired by the block-building genre; no Minecraft assets, copyrighted textures, code, or external libraries.

## Run

```bash
node server.mjs
# visit http://localhost:8080
```

Node 18+ is enough. WebGL2 must be available in the browser. Do **not** open `index.html` with `file://`, because ES modules normally need an HTTP origin.

```bash
npm test
```

## Controls

| Input | Action |
|---|---|
| W A S D | Walk |
| Mouse / touch swipe | Look |
| Space | Jump |
| Shift | Crouch / descend while flying |
| Ctrl | Sprint |
| Left click | Break block (including placed water) / attack mob |
| Right click or R | Place a block against the face you are looking at |
| 1..0 or scroll | Select from the current hotbar |
| L or the light button | Switch between the original building hotbar and three light fixtures |
| Light palette 1 / 2 / 3 | Torch / Lantern / Campfire |
| F | Toggle flight |
| G | Spawn a sheep |
| Shift+G | Spawn a zombie for debugging |
| B | Make a small block explosion at target |
| P | Save edited blocks |
| E or I | Open the floating building bag, releasing the pointer; choose an item to return directly |
| M | Open/close settings (separate from the building bag) |
| Settings → 주변 물 정리 | Clear only player-edited water within 24 blocks and save automatically |
| H | Open/close help |
| Escape | Release the pointer; E reopens the bag or M opens settings |

Touch users: left side drag to walk, right side drag to look; the buttons offer jumping, placing and breaking blocks.

## v0.6.0: Step-up and water recovery

- The voxel grid and existing saves are **unchanged**. Player collision height is 1.90 vs 1.80 previously; eye height 1.70 vs 1.62, so blocks look roughly 5% smaller relative to the player.
- Grounded entities can automatically climb obstacles up to one full block using a 0.125-step collision clearance sweep. Two-block walls and low ceilings still block passage.
- Water is now directly targetable when breaking blocks. The settings panel includes **주변 물 정리**. It restores only saved water edits within 24 blocks of the player (including old spilled water), keeping natural water and placed solids intact. Unloaded chunks are handled via saved edit records.
- Before recovery, the current full edit snapshot is backed up under `localStorage['mcweb:<world>:before-water-cleanup']`, then the recovered world is saved automatically.
- The old source-unaware water-spread code made permanent water copies. **Further water spreading is temporarily disabled**, until a source/flow-level implementation can retract liquid safely. Water blocks can still be placed, removed and rendered.

## Architecture

| Module | Responsibility |
|---|---|
| `core/blocks.js` | Block IDs, collision and render metadata |
| `core/lighting.js` | Load/unload-aware, constant-time light lookup for block edits; nearest-source query |
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
| `client/input.js` | Keyboard, pointer lock, touch input |
| `client/game.js` | Main integration and fixed timestep orchestration |

## Extension points

- **Blocks:** Append an entry to `BLOCKS` (and an ID to `BLOCK`), then add a hotbar entry or behavior. The current chunk format uses `Uint8Array`, so IDs must remain 0–255, and `World.set` validates them against the registry length.
- **Worldgen:** Implement a deterministic `(chunk, seed) => chunk` generator and dispatch by `World.mode` inside `worldgen/generators.js`. Use world coordinates for features extending across chunks.
- **Mobs:** Introduce new classes based on `Entity` / `Mob`, with AI in `update` and visual representation in `Renderer.dynamicData`.
- **Rendering:** Replace procedural RGB faces with texture atlas tile indices in `mesher.js`, pass UV and tile ID through shader attributes. Current build has **no Minecraft texture atlas**.
- **Save format:** Chunk modifications persist via `localStorage`, not full chunk snapshots. For production persistence migrate to IndexedDB plus a revisioned save schema.
- **Portals:** Place a purple portal block and walk into it to travel to the next world. The world selector is also available.

## Deliberate limitations / next work

This is an engine playground, **not a full Minecraft recreation**. It has no crafting or network multiplayer, cross-chunk pathfinding, occluding shadow maps, volumetric lighting, true liquid-level conservation, animated textures, or survival item drops. A standalone `Projectile` class is present but not tied to a bow input or its renderer. The `Inventory` and `BehaviorRegistry` are core extension APIs, not yet connected to the creative-hotbar UI. Mob AI is elementary pursuit and wandering rather than A*. Keyboard and WebGL2 are implemented, but automated tests cover only the renderer-independent code and mesh construction, not visual or browser driver execution.

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

## Usability and night contrast v0.4

- Ambient sky and ground lighting are deliberately dimmer. Warm torch, lantern and campfire light gives a visible, cozy pool of light that can be extended gradually by building.
- **How to build:** look at an existing block, select a new block with 1–0 or mouse wheel, then right-click (or press **R**) to place it adjacent to the targeted face. Left-click breaks the targeted block.
- **No repeated Esc:** press **E** to release the mouse and open the settings. All toolbar and hotbar buttons stay clickable. Press **E** again or click **Return to game**; clicking the world also resumes mouse look. Esc now opens the controls after releasing pointer lock.
- The HUD shows the essential controls, including the menu shortcut, without relying on an initial tutorial screen.
- All three light fixture meshes are generated, not only torches. Nearby light lookup searches only relevant chunk indices so more distant light placements do not raise frame-wide scan costs.
- This artistic lighting is still non-occluding: walls do not cast shadows. Visual appearance and FPS on real hardware require browser testing.

## Spatial inventory & softer night atmosphere v0.5.1

- The creative building bag is an in-game CSS 3D layer over the live world, opened by **E / I** or the bottom-left **Bag** button. It uses no extra WebGL scene and blocks movement/placement while open. Clicking an item selects it and returns to gameplay in one step. **M** opens the settings separately.
- Warm fixtures now have a **larger, softer radius** and less intense orange centers, using a smooth distance-squared attenuation that does not introduce per-pixel square roots.
- Night is **not pitch black**: moderate dim ambient light preserves terrain silhouettes. A lightweight sky gradient moves with the camera pitch, transitioning from charcoal overhead to a muted horizon instead of a flat navy fill.
- This is artistic lighting, not occlusion or shadow casting. Rendering and pointer-lock behavior still need visual verification in a real browser; Node tests do not measure FPS or prove GPU shader compilation.
