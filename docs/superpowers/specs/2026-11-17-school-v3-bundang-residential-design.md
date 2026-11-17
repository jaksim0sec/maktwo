# Descent V3: Korean School + Bundang-style Gallery Apartment Precinct

## Goal
Surround the existing Korean school campus with a realistic 1990s-era Korean planned residential superblock. Keep the school building, gym, field and gate intact. Use the latest Eternal Night housing finishes and building-detail generators rather than writing an incompatible inventory of new materials.

## Urban reference
The Bundang Si-beom apartment precinct combines separated multi-storey apartment bars, a school close to housing, a pedestrian/community spine, an outer vehicular loop, landscaped buffer strips and neighborhood play space. This is a design-language reference, NOT a 1:1 model or surveyed representation.

Public reference: Architecture & Urban Research Institute, *Characteristics of Korean Urban Design*, chapter on Bundang pilot complex, pedestrian axes and schools: https://www.auri.re.kr/publicationFileDirect.es?bid=research&list_no=33&seq=1

## Dimensions and geometry
- Existing school: original x/z coordinates inside about ±105; originally generated 4 storeys are retained.
- V3 repeating neighborhood: 448 × 448 voxels, 0.8 m per voxel (358.4 m).
- Residential housing: 8 separated gallery-access apartment slabs, 9–14 storeys. Each floor rises 5 voxels (4.0 m).
- Standard slab: 48 × 17 voxels (38.4 × 13.6 m). Inboard dwellings have partitions, living/bedroom separation, kitchens/storage and front windows. Rear-facing 4-voxel-wide open corridor has individual flat doors and guardrails.
- Stair/elevator core: at one end of each building with switchback 20 cm split treads, intermediate landing, service/fire-rated doors and storey markers. No teleport/ladders.
- Two slabs are oriented perpendicularly to avoid an unrealistic row of eight identical parallel blocks.
- Street: roads and sidewalks on a square superblock, surface parking, tree-lined margins, a south neighborhood playground, pedestrian crossing and a paved school gate-to-neighborhood route.
- Every apartment ground entrance receives a continuous paved walk to the public sidewalk. Apartment building shells take priority over surface landscaping; the original school footprint takes priority over apartments and streets.

## Reuse, not expansion
- Housing modules use `floorFinish` and `interiorWallFinish` from `eternal-night-interiors.js`.
- Residential openings reuse `facadeBay` from `eternal-night-facade.js`.
- Entry/core furnishings use `cityFloorKit` and `cityPart` from `eternal-night-kits.js`.
- Split staircase profiles reuse `encodeSplitTread` from `eternal-night-stairs.js`.
- Existing `PART_*` windows, doors, balconies, furnishings and regular `ARCH_*` finishes are reused. No new block IDs, no changes to V2 or original city generation.
- Separate implementation: `src/worldgen/school-apartments.js`; integrated only by the existing `school-v3.js` entrypoint.

## Compatibility/performance
- V3 world height rises from 64 to 96 to fit 14 residential storeys. Terrain worker and world-created chunks accept variable height; PWA shell explicitly caches the new module.
- Voxel generation for empty columns is limited to the original school height; apartment columns stop at their own roof. Eleven sampled chunks had identical voxel IDs and orientation bytes with/without this optimization.
- Enlarging the V3 generator period changes coordinates of previously repeated campuses. Old V3 user edits may not correspond to the new surroundings; new V3 saves are the reliable visual baseline.

## Validation ledger
- 31 generator tests pass in an isolated JavaScript harness using actual `Chunk`, architectural and station block IDs, split tread encoding and the current school test sources.
- 3 repository integration tests (world preset and spawn, worker/district boundary round trips, saved edits) remain unexecuted because a complete checkout/runtime was unavailable.
- No real WebGL/mobile screenshot and movement-collision validation was possible here. Rendering quality, apartment gallery locomotion and frame time on device require in-game review.
