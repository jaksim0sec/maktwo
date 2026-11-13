# Botanical models: the four trees of the abandoned city

**Scope:** visual assets, natural-looking geometry, leaf litter, and deterministic
placement. Mining, harvesting, loot, growth, seasonal changes, and recipes are
deliberately **not implemented**.

## Visual direction

Four very saturated tree colors punctuate the unlit concrete and steel skyline.
Every specimen is a coherent tree, **not a vertical pile of bark cubes with a
rounded leaf cube at the top**.

| Species | Shape language | Crown palette | Litter |
| --- | --- | --- | --- |
| Cherry blossom | wide spreading crooked limbs, pink umbrella with blossom tips | hot pink, rose, pale pink | scattered pink petals |
| Ginkgo | narrow upright trunk, fan-like high yellow crown | gold, lemon, amber | yellow fan-shaped leaves |
| Maple | radiating boughs, irregular multi-tier leaves | red, scarlet, orange | vermilion and crimson fallen leaves |
| Broadleaf | tall uneven woodland canopy, low branches | neon spring green, emerald, lime | green, ochre and brown fallen leaves |

The source of truth is `src/core/tree-assets.js` and
`src/client/tree-mesh.js`. A model consists of tapered seven-sided stems,
forking lateral branches, individually faceted irregular ellipsoid foliage
clusters, and visible species-colored petal/leaf outlines.
The foliage has bright highlights, while bark reuses the existing vertical
wood texture. Each tree has four **authored silhouette variations**.

## Registered block IDs and world contract

- Existing IDs **0–237 are unmodified**.
- Tree anchors **238–241**: `TREE_SAKURA`, `TREE_GINKGO`,
  `TREE_MAPLE`, `TREE_GREEN`.
- Floor litter **242–245**: `FALLEN_SAKURA`, `FALLEN_GINKGO`,
  `FALLEN_MAPLE`, `FALLEN_GREEN`.
- All eight are visible under **수목·낙엽** in the inventory.
- An entire tree is stored as **one anchor voxel**, containing a slender
  trunk collision volume; the canopy is purely decorative and not collidable.
- Litter is drawn with thin locally positioned overlapping small leaf blades
  a few centimeters above the actual floor, not as a full-height tile.
- Tree/litter geometry is emitted directly to the shared 7-float worker mesh
  pipeline and cached by four appearance variations per species.
- No added runtime shader texture units, new materials, world chunk writes
  per animation frame, or special tree entities.
- The current `breakTime = Infinity` is intentional. The harvest and drop
  phase starts **after visual review**.

## Compare the four trees

Open the local world **폐허 속의 나무 · 4종 전시장** or add
`?world=AbandonedArboretum` to the game URL.

The sample contains four separated specimen trees at X=-33, -11, 11 and 33,
on cracked concrete with independent species-specific leaf carpets.
The camera spawns at `(0.5, 23, 19.5)`. These are the production tree meshes,
not a fake UI mockup.

## City insertion

Select **영원한 밤 · 이질적인 수목 v9**, or
`?world=EternalNightGardenV9`.

The v9 generator scatters 24 deterministic potential trees along the shoulders
of the newly widened city cross route, with species-correct foliage under
their crowns. It does not change the underlying city building placement or
existing transit stations, and skips blocked/bridge-overlapped ground tiles.

Previously saved v7/v8 cities retain their generation version and terrain,
and the named `EternalNightCityV8` preset remains v8 even on a new save.
Regular biome terrain continues to use its existing trees; the high-detail
botanical assets are intentionally limited to the showcase and city v9
until the designs are approved.

## Orientation temporarily frozen

`materialUVTransform()` in `src/client/textures.js` retains the authored
orientation but comments out position-seeded rotations and X-axis mirroring.
The original code remains commented out for a later texture review.
Tree silhouette variety comes from a persistent 2-bit variant on its anchor,
not an undisclosed per-face coordinate-dependent flip.

## Review and limits

Verifications: block index continuity, four silhouettes/variants with 7-float
vertices, no NaNs, normalized single-voxel anchors, leaf scatter coverage,
studio chunk independence, and the v8/v9 generation gate.

Still required: in-game desktop and phone visual comparison (silhouette,
crowns, density, color bloom and tile seams). Do not call this visual design
fully finished before inspecting those screenshots.

## Visual correction: smaller trees, actual leaves, night illumination

The initial four meshes were too tall and wide, with multiple **closed
ellipsoid leaf shells** resembling round balloons. They also used **negative
per-vertex shade values** (for example `-.78`, `-.93`) for some petals
and foliage highlights. The shared shader explicitly treats every negative
shade as **emissive**, bypassing scene brightness and local light-volume
sampling. That was the direct cause of the neon trees appearing bright at
night, not an issue to conceal by darkening screenshots or changing the
entire world's exposure.

The corrected asset uses the existing lighting shader unchanged:

- Every foliage and fallen-leaf triangle now has a **positive light-responsive
  shade**; no botanical leaf or flower triangle emits light.
- Dense ellipsoid shells are gone. Sparse twig sprays support **separate
  pointed leaves**, cherry blossoms, lobed maple leaves and distinct ginkgo
  fans with intentional gaps revealing real branches.
- Individual tree height is now approximately **6.5–8.1 blocks** rather than
  the previous ~9.8–11.5. Crown width is roughly **4.5–7.3 blocks**.
- Species palettes remain visibly differentiated in subdued anime hues, not
  fluorescent pink/yellow/green. Ground litter uses the same restrained colors.
- Four original authored variants and all eight block IDs are maintained.
  The existing city placements, saves, inventory and independent 7-float
  mesh formats are unchanged.
- Mesh budget is below 11,000 vertices per tree; templates remain cached.

Actual PC/mobile screenshots under the game's nighttime lighting are still
necessary to judge artistic quality. No harvest/drop mechanics added.
