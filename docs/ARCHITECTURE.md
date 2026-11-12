# MakTwo architecture and change rules

**Goal:** Keep the endless-night sandbox playable as worlds and furniture expand, rather than adding exceptions in the render loop.

## Layers

| Layer | Responsibility | Contract |
| --- | --- | --- |
| `src/core/blocks.js` | Immutable block IDs, shared block metadata | Append IDs; never reorder old IDs |
| `src/core/crafting.js` | Shaped recipes and workbench vs pocket size | Immutable ingredients and normalized grids, no renderer dependency |
| `src/core/inventory.js` | World-scoped item ledger, discovery, seven quick slots | Read v1 saves; store separate versioned inventory, preserve voxel save |
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
3. New items append stable block IDs (workbench ID 23); never reorder. Crafting discovery, item counts and quickslots use the separate inventory save, not voxel world edits.
4. Avoid repeating hard-coded names and special cases across DOM, input handlers and the renderer. Register them in the appropriate catalog or mesh/collider module.
5. Review any change that increases the number of synchronous world reads or vertex uploads on low-power mobile devices.
6. PWA caches must be complete, versioned snapshots; the world itself stays in localStorage and is never evicted by the service worker.

## Next substantial milestones

- **Vertical chunk sections + distant LOD**, then genuine wide mountain ranges beyond 64 voxels.
- **Region-based terrain caches**, optionally computed in a Worker for hydraulic erosion and river drainage.
- **Prop/component registry**, for openable storage, gardening growth and furniture, with persistent state outside block IDs.
- **Device tests**, especially mobile touch, WebGL shaders, PWA update lifecycle, and memory on low-end hardware.

## Modular ruins v1

- `EternalNight` is a separate `ruins`-mode world using a new storage key. Existing presets and voxel edits are retained.
- `src/worldgen/buildings.js` uses deterministic plans per 32-cell region. A five-block-tall, stair-connected floor plan is generated first and stacked into shop, utility and room floors. Upper storeys can shift, roofs can collapse, lower floors can be buried and rubble appears around footprints.
- Each chunk stamps overlapping building plans independently in global world coordinates. No persistent structure instances or extra renderer draw calls are required.
- 22 architectural voxel IDs and 18 additional procedural material textures preserve the existing block IDs, mesh stride and WebGL texture array. Fluorescent fixtures use the existing light volume.
- The generation version is saved per world; legacy worlds without a version remain v1. Mid-rise ruins fit the 64-high layout. True megastructures require vertical chunk sections and distant LOD.

## Architecture v2 / height-graded sky

- `EternalNightR2` is an opt-in new world key (generation version 4). It is the default launch world; old `EternalNight` version-3 saves remain selectable and render with the v1 generator.
- V2 architecture uses stable x/z positions for the common 2-block-wide stair core; a side landing path connects storeys. Solid concrete frames, recessed half panels, thin partitions, window meshes and concrete stair collision all match the partial box renderer.
- Exterior walls no longer receive a bright ceiling tile on every storey boundary. A central circulation corridor links side rooms and service landings; façade bays use windows, piers, sills and variable shutters.
- Sky clarity is a pure smoothstep driven by world voxel altitude starting at Y=210 and reaching full clear daylight at Y=470; high-altitude stars fade away. The current 64-high chunk layout still prevents ordinary survival players reaching those elevations. An eventual vertical section refactor is required before high sky is directly explorable.

## Ruined city architecture v5: plan-informed composition

Architectural floor-plan references (structural organization only, no copyrighted drawings or facade copies):
1. **Shop-house**: [former rice-store narrow house in Seoul](https://www.imwood.co.kr/news/articleView.html?idxno=22839), shop and entry alongside a separated stair core
2. **Office / neighborhood facility**: [Bangbae Geunsaeng](https://www.archdaily.com/1185199/bangbae-geunsaeng-neighbourhood-facility-aoa-architects), rentable rectangular spaces separated from the vertical circulation and service zones
3. **Walk-up residential**: [OBBA Beyond the Screen](https://www.domusweb.it/en/architecture/2013/08/01/obba_beyond_the_screen.html), clustered housing masses using a shared semi-exterior staircase
4. **Arcade / external circulation**: [NOXON Neighborhood Shop](https://www.archdaily.com/992542/noxon-neighborhood-shop-on-architects), stairway placed around the outside of the room volume rather than buried in its centre
5. **Service / mixed neighborhood spaces**: [Darak-Darak](https://www.domusweb.it/en/architecture/2017/03/08/darak_darak_the_system_lab.html), compact utility/service core and flexible adjacent floors

These are precedents for **circulation and spatial planning**, not copied architectural plans. `src/worldgen/architecture-v3.js` contains five original procedural archetypes `shop-house`, `office`, `walkup`, `arcade`, `service`. A shared circulation module and stairwell are placed near one side, with a back landing and longitudinal connecting corridor. The optional L / notched wing borrows another archetype's room program but always inherits the parent building's facade material. Elevations have consistent bay/window rhythm instead of per-level material stripes.

The system uses 6-block storeys and 12 half-block steps to rise between landings. Floor structure, lower half-block floor finish, and upper half-block ceiling lining are separate. Metal window frames use thin partial-depth geometry. `EternalNightR3` is a new version-5 world; v3/v4 saved worlds retain their existing generation. This **does not** add hundreds of vertical voxels. The altitude-responsive shader already allows the unnaturally clear sky gradient to be evaluated above 200 voxels, but gameplay cannot physically reach that height until vertical streaming is implemented.
