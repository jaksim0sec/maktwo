# MakTwo architecture and change rules

**Goal:** Keep the endless-night sandbox playable as worlds and furniture expand, rather than adding exceptions in the render loop.

## Layers

| Layer | Responsibility | Contract |
| --- | --- | --- |
| `src/core/blocks.js` | Immutable block IDs, shared block metadata | Append IDs; never reorder old IDs |
| `src/core/crafting.js` | Shaped recipes and workbench vs pocket size | Immutable ingredients and normalized grids, no renderer dependency |
| `src/core/inventory.js` | World-scoped item ledger, discovery, seven quick slots | Read v1 saves; store separate versioned inventory, preserve voxel save |
| `src/core/catalog.js` | Display categories and world choices | Stable world names are save keys |
| `src/core/shapes.js`, `construction.js` | Legacy block shapes and reusable construction forms | Collision, picking and meshing share geometry |
| `src/core/mounts.js` | Wall fixtures and their local part geometry | Mounts are separate from construction material IDs |
| `src/core/world.js` | Chunk edits, interactive state, persistence | No WebGL dependency; stable save keys and edit coordinates |
| `src/worldgen/generators.js` | Unified terrain routing and decorations | Integrated terrain and one ruins generator |
| `src/client/mesher.js` | Greedy cubes + distinct prop meshes | Vertex layout stays seven floats |
| `src/client/renderer.js` | WebGL2, GPU buffers, distant light field | Keep expensive meshing/lighting in Workers |
| `src/client/hologram.js` | World-positioned inventory cards | No fullscreen UI panel or forced camera lock |
| `sw.js` | Atomic versioned app shell | No per-request cache mutation or query-string variants |

## World generation and rendering boundary

`src/worldgen/` owns the deterministic terrain and building algorithms. `World` in
`src/core/world.js` requests generated `Chunk` voxel data, applies saved edits, and
manages loaded chunks and block states. `Chunk` in `src/core/chunk.js` contains only
coordinates, voxel IDs, optional form and mount data, and change tracking. World keys and block IDs are stable. Old saves keep their edits, use generation version 5, and retain a pre-migration backup under `mcweb:<name>:before-generator-unification` when storage permits.

`meshChunkData(chunk, {neighbors, states, visualSeed})` in `src/client/mesher.js`
turns already-loaded voxel arrays and block states into seven-float vertices.
Neighbors are relative `[dx, dz, data, forms]` entries; absent neighbors expose boundary
faces. `visualSeed` preserves the old per-face and plant color variation and has
no effect on world generation. The main-thread fallback and `mesh.worker.js` use
this same input contract. `renderer.js` uploads the resulting geometry and does
not evaluate terrain or building rules. The older `meshChunk(world, chunk)` entry
point adapts already-loaded world data for existing callers without generating
neighboring chunks. A new generator should produce the same chunk data contract;
no mesher, worker, or renderer change is needed.

## Terrain research and limits

The shared terrain profile combines low-frequency domain warp, ridge fields and curved canyon cuts, informed by the approach of domain-warp noise generators and erosion-shaped terrain mods. It does **not** simulate sediment or hydraulic erosion. Heights are capped at 57 in the existing 64-high chunk layout. A future full mountain overhaul needs vertical chunk sections and distant-terrain LOD first; raising the global chunk height in-place would double memory and could regenerate old terrain.

Reference ideas (not dependencies or copied source): FastNoiseLite's domain warp documentation; TerraForged's erosion and river design; Tectonic's region-scale terrain goals.

## Guardrails

1. Tests must cover old save indices and seeds, door clearance, player collision, negative chunk boundaries, cross-chunk decorations and worker meshes.
2. All presets share the latest terrain profile. Flat mode stays level and islands apply an ocean envelope. Ruins add the current architecture generator. Saved edits are applied over the current base terrain.
3. New items append stable block IDs (workbench ID 23); never reorder. Crafting discovery, item counts and quickslots use the separate inventory save, not voxel world edits.
4. Avoid repeating hard-coded names and special cases across DOM, input handlers and the renderer. Register them in the appropriate catalog or mesh/collider module.
5. Review any change that increases the number of synchronous world reads or vertex uploads on low-power mobile devices.
6. PWA caches must be complete, versioned snapshots; the world itself stays in localStorage and is never evicted by the service worker.

## Next substantial milestones

- **Vertical chunk sections + distant LOD**, then genuine wide mountain ranges beyond 64 voxels.
- **Region-based terrain caches**, optionally computed in a Worker for hydraulic erosion and river drainage.
- **Prop/component registry**, for openable storage, gardening growth and furniture, with persistent state outside block IDs.
- **Device tests**, especially mobile touch, WebGL shaders, PWA update lifecycle, and memory on low-end hardware.

## Building and placement

The material ID stays in the chunk voxel array. An optional form byte encodes slab half or the orientation of a diagonal wall or ramp. Full cubes use greedy meshing. Wall fixtures occupy separate sparse entries, retain their support coordinates, and detach if the support changes. Rendering and picking use the same fixture parts.

Creative mode has independent quick slots, unlimited materials, and access to all recipes. Survival inventory is stored separately. Flight uses the usual collision checks.

## Ruined city architecture v5: plan-informed composition

Architectural floor-plan references (structural organization only, no copyrighted drawings or facade copies):
1. **Shop-house**: [former rice-store narrow house in Seoul](https://www.imwood.co.kr/news/articleView.html?idxno=22839), shop and entry alongside a separated stair core
2. **Office / neighborhood facility**: [Bangbae Geunsaeng](https://www.archdaily.com/1185199/bangbae-geunsaeng-neighbourhood-facility-aoa-architects), rentable rectangular spaces separated from the vertical circulation and service zones
3. **Walk-up residential**: [OBBA Beyond the Screen](https://www.domusweb.it/en/architecture/2013/08/01/obba_beyond_the_screen.html), clustered housing masses using a shared semi-exterior staircase
4. **Arcade / external circulation**: [NOXON Neighborhood Shop](https://www.archdaily.com/992542/noxon-neighborhood-shop-on-architects), stairway placed around the outside of the room volume rather than buried in its centre
5. **Service / mixed neighborhood spaces**: [Darak-Darak](https://www.domusweb.it/en/architecture/2017/03/08/darak_darak_the_system_lab.html), compact utility/service core and flexible adjacent floors

These are precedents for **circulation and spatial planning**, not copied architectural plans. `src/worldgen/architecture-v3.js` contains five original procedural archetypes `shop-house`, `office`, `walkup`, `arcade`, `service`. A shared circulation module and stairwell are placed near one side, with a back landing and longitudinal connecting corridor. The optional L / notched wing borrows another archetype's room program but always inherits the parent building's facade material. Elevations have consistent bay/window rhythm instead of per-level material stripes.

The system uses 6-block storeys and 12 half-block steps to rise between landings. Floor structure, lower half-block floor finish, and upper half-block ceiling lining are separate. Metal window frames use thin partial-depth geometry. `EternalNightR3` is the default world. Older ruins saves use the same current building generator. This **does not** add hundreds of vertical voxels. The altitude-responsive shader already allows the unnaturally clear sky gradient to be evaluated above 200 voxels, but gameplay cannot physically reach that height until vertical streaming is implemented.
