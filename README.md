# MakTwo · Voxel Sandbox Engine v0.2

A from-scratch, **dependency-free WebGL2** voxel sandbox. The world loads immediately, with no start menu. Click the canvas to capture the mouse (required by the browser). Inspired by the block-building genre; no Minecraft assets, copyrighted textures, code, or external libraries.

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
| Left click | Break block / attack mob |
| Right click | Place block |
| 1..0 or scroll | Select from creative hotbar |
| F | Toggle flight |
| G | Spawn a mob |
| B | Make a small block explosion at target |
| P | Save edited blocks |
| Escape | Release mouse pointer |

Touch users: left side drag to walk, right side drag to look; the buttons offer jumping, placing and breaking blocks.

## Architecture

| Module | Responsibility |
|---|---|
| `core/blocks.js` | Block IDs, collision and render metadata |
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

- **Blocks:** Append an entry to `BLOCKS` (and an ID to `BLOCK`), then add a hotbar entry or behavior. The current chunk format uses `Uint8Array`, so IDs must remain 0–255, and `World.set` currently validates IDs 0–15. Update its validation alongside new definitions.
- **Worldgen:** Implement a deterministic `(chunk, seed) => chunk` generator and dispatch by `World.mode` inside `worldgen/generators.js`. Use world coordinates for features extending across chunks.
- **Mobs:** Introduce new classes based on `Entity` / `Mob`, with AI in `update` and visual representation in `Renderer.dynamicData`.
- **Rendering:** Replace procedural RGB faces with texture atlas tile indices in `mesher.js`, pass UV and tile ID through shader attributes. Current build has **no Minecraft texture atlas**.
- **Save format:** Chunk modifications persist via `localStorage`, not full chunk snapshots. For production persistence migrate to IndexedDB plus a revisioned save schema.
- **Portals:** Place a purple portal block and walk into it to travel to the next world. The world selector is also available.

## Deliberate limitations / next work

This is an engine playground, **not a full Minecraft recreation**. It has no crafting or network multiplayer, cross-chunk pathfinding, volumetric lighting, true liquid-level conservation, animated textures, or survival item drops. A standalone `Projectile` class is present but not tied to a bow input or its renderer. The `Inventory` and `BehaviorRegistry` are core extension APIs, not yet connected to the creative-hotbar UI. Mob AI is elementary pursuit and wandering rather than A*. Keyboard and WebGL2 are implemented, but automated tests cover only the renderer-independent code and mesh construction, not visual or browser driver execution.

## Notes

- Fixed simulation: 60 ticks/s, with accumulator cap to prevent runaway catch-up.
- Greedy meshing combines adjacent identical block faces into quads, reducing GPU vertices.
- One chunk mesh submission per frame; at most two worker jobs running and one GPU upload per frame. Fallback to main-thread meshing if Web Workers are unavailable.
- Canvas resolution adapts downward on sustained slow frames; WebGL antialiasing is off to avoid extra GPU cost.
- Render chunk range is 88 blocks and chunks behind the camera are conservatively skipped.
- Revisions guard against publishing stale worker results when blocks or neighbor chunks change.
- Block-face culling handles missing neighboring chunks and marks adjacent meshes dirty when newly loaded.
- Day/night time and player health reset on game load; edited block data persists on Save / page close.
- Saved worlds are scoped by world name, seed and generator mode; ensure `localStorage` is available.

## Optimization verification

`npm test` validates chunk streaming, camera projection, merged geometry, worker snapshots, physics and world travel. Baseline 9-chunk scene: 20,772 drawn quads / 3.49 MB geometry; v0.2: 4,653 quads / 0.78 MB geometry on the same generated seed and chunk coordinates (Node benchmark, not FPS). Browser real-world FPS must be assessed on the target device.
