# MakTwo architecture and change rules

**Goal:** Keep the endless-night sandbox playable as worlds and furniture expand, rather than adding exceptions in the render loop.

## Layers

| Layer | Responsibility | Contract |
| --- | --- | --- |
| `src/core/blocks.js` | Immutable block IDs, shared block metadata | Append IDs; never reorder old IDs |
| `src/core/catalog.js` | Display categories and world choices | Stable world names are save keys |
| `src/core/shapes.js` | Per-block collision shapes | Collision uses the same geometry family as meshing |
| `src/core/world.js` | Chunk edits, interactive state, persistence | No direct WebGL dependencies; old worlds unchanged |
| `src/worldgen/generators.js` | Existing generator routing and decorations | `normal`, `flat`, `islands` remain deterministic |
| `src/worldgen/landforms.js` | Experimental highland height field | Deterministic world-coordinate evaluation across chunks |
| `src/client/mesher.js` | Greedy cubes + distinct prop meshes | Vertex layout stays seven floats |
| `src/client/renderer.js` | WebGL2, GPU buffers, distant light field | Keep expensive meshing/lighting in Workers |
| `src/client/hologram.js` | World-positioned inventory cards | No fullscreen UI panel or forced camera lock |
| `sw.js` | Atomic versioned app shell | No per-request cache mutation or query-string variants |

## Terrain research and limits

The experimental **Highlands** preset combines low-frequency domain warp, ridge fields and curved canyon cuts, informed by the approach of domain-warp noise generators and erosion-shaped terrain mods. It does **not** simulate sediment or hydraulic erosion. Heights are capped at 56 in the existing 64-high chunk layout. A future full mountain overhaul needs vertical chunk sections and distant-terrain LOD first; raising the global chunk height in-place would double memory and could regenerate old terrain.

Reference ideas (not dependencies or copied source): FastNoiseLite's domain warp documentation; TerraForged's erosion and river design; Tectonic's region-scale terrain goals.

## Guardrails

1. Tests must cover old save indices and seeds, door clearance, player collision, negative chunk boundaries, cross-chunk decorations and worker meshes.
2. Only the `Highlands` preset uses the new terrain algorithm. Existing saved names/seeds and generation outputs are untouched.
3. All new garden objects use block IDs 20+, stored as ordinary edited blocks. No save migration is necessary.
4. Avoid repeating hard-coded names and special cases across DOM, input handlers and the renderer. Register them in the appropriate catalog or mesh/collider module.
5. Review any change that increases the number of synchronous world reads or vertex uploads on low-power mobile devices.
6. PWA caches must be complete, versioned snapshots; the world itself stays in localStorage and is never evicted by the service worker.

## Next substantial milestones

- **Vertical chunk sections + distant LOD**, then genuine wide mountain ranges beyond 64 voxels.
- **Region-based terrain caches**, optionally computed in a Worker for hydraulic erosion and river drainage.
- **Prop/component registry**, for openable storage, gardening growth and furniture, with persistent state outside block IDs.
- **Device tests**, especially mobile touch, WebGL shaders, PWA update lifecycle, and memory on low-end hardware.
