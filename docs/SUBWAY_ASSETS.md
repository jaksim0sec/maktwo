# Abandoned subway station | asset and assembly specification

The artwork is authored as **20 distinct 32×32 pixel procedural tiles**, generated
once per texture-array upload by `src/client/station-textures.js`. Materials use the
same texture-array sampler, mipmaps and seven-float vertex layout as the rest of the
game. No runtime texture noise, external JPEGs or full-screen passes.

The photo references separate three layers: station architecture with old tile and
grout, heavy infrastructure (rails, ducts, grime and cables), and a structurally
credible train (ribs, sliding doors, smoked glazing, seats and grab rails).
Distinct pixel patterns are used for all 20 finishes, not one recolored noise layer.

## Asset registry

**Do not change old IDs.** The original 0–187 are unchanged.
Station tiles occupy **188–207** in `station-materials.js`.
30 assembled model blocks occupy **208–237** in `station-parts.js`.
All still fit a `Uint8Array` block index; changing those offsets would break
saves. Material atlas layers for the new tiles are 71–90 (1-based).

The 20 tiles are grouped by use:

- Rail and traction: ballast, sleeper wood, rail crown, greased steel
- Platforms: stone paving, tactile domes, orange platform warning, soot
- Station finishes: cream ceramic, blue crazed ceramic, algae concrete
- Carriage: ribbed steel, off-white painted sheet, door stainless, smoked glass,
  teal seat vinyl, anti-slip rubber
- Infrastructure: cable duct, vent grill, oxidized pipe

The 30 3D units form six five-piece families:

1. Carriage walls: thin ribbed side, window frame and translucent glass,
   left and right sliding door leaves with sealing strips, roof cassette.
2. Carriage interior: bench seats with real legs/backrest, full-height pole,
   three hollow hanging straps, luggage rack, driver console.
3. Rail: ballast, sleeper, rails, conductor rail, cable trough.
4. Platform: projecting platform edge, tactile edge, service route sign,
   ticket gate, ventilation grille.
5. Transfers: deck railing, ductwork, wiring conduit, directional signage,
   stepped access.
6. Rolling stock: stepped circular wheel-and-axle bogies, underbody skirt with
   orange/blue waistline, wide driver windscreen and cab nose, mechanical
   coupler, and the flexible inter-car gangway bellows.

Each piece is a cluster of clipped 0..1 cuboids. Mesh, physics and selection
share the same part geometry. Window glass is separately alpha-tagged; seats
and grab handles are physically shaped rather than painted onto full cubes.
Door leaves are authored as two dedicated GPU mesh groups per opening. Their motion is a local translation; static train wall part IDs remain unchanged.

## Assembly preview

Open the game and select **폐역 · 전동차 조립 예시** in the local-world selector,
or open it with `?world=SubwayAssemblyPreview`.
World mode: `station-preview`, seed `9999`, default spawn `(1.5,24,10.5)`.

A two-car, 37-cell long, 5-cell wide train faces along X between two opposite
platforms. Ballast and the two continuous single-rail strips
occupy Y=20–21; carriage floor and platform deck both top out at Y=23.
Train shell, windows, sliding leaves and seats are built in layers Y=23–25.
The station has grouted wall tiles, warning strips, skylight slits, operable and
broken fluorescent tube **fixtures** (lighting preserved from existing system),
ticket gates, vents, pipes, signage, and an end stair/access connection.
Twenty tile swatches are available at X=-30. An additional line of five
rolling-stock pieces sits at X=-28 (Z=-5..-1).

**Assembly plan:** `station-train.js` defines car bounds, paired sliding doors,
two bogies per car, cab ends and articulated gaps before stamping any blocks.
The same column assembler accepts X or Z orientation and an arbitrary car count.
Wheels sit under the uninterrupted side skirts at Y=21; floor and platform meet
at Y=23, with the tactile edge immediately beside the carriage. Body sides,
door pairs and windows occupy Y=23–24. A continuous shaped roof cassette caps
each car at Y=25. The middle gangway keeps a clear walking center under its
roof and has a coupler beneath the floor. Cab noses and end couplers remain
distinct buildable parts. No random column condition substitutes one module
for another at the car boundary.

Station preview exterior vehicle parts set the existing exterior style bit,
and the simplified mesh retains its main solid frame and translucent
glazing. This prevents the whole train body from disappearing when it
falls outside the fine-detail Y range.

## Core-city stations

New generation version 7 places four suspended stations at the reserved sites:
two on the east/west track at the library's lower gallery, two on the north/south
track at its upper gallery. Track and narrow guarded footways run from the
library interchange to each station, with portals through the dome wall.
Platforms, tactile edges, columns, canopy, signs, infrastructure and decayed
fixtures use the same registered materials and parts as the assembly preview.
Each station receives one controllable `SubwayTrain` entity, with shared
GPU buffers for like-shaped trains. Preview uses the same entity rather than
stamping a second static carriage. Core-city generation versions 5 and 6
retain their earlier layouts and version 7 station geometry is preserved.

### Train driving and collision (v1.15.33)

Two 17-block cars are joined by a continuous floor and a roof cassette whose
bottom meets the upper wall at y=3 exactly. There are two two-column door
openings per car, on both sides: **8 double-leaf door pairs**, plus ordinary
window modules and a front cab on each end. Physical door openings remain
clear for a player rather than repeating a 1-block door frame at both Y levels.

`src/core/train-collision.js` provides broad-phase-trimmed physical boxes
for the rubber deck, roof, side panels and cab bulkhead, and removes the door
wall collision only when fully open. It is shared by the ordinary physics
system; neither riding nor falling onto a train requires a voxel edit.
A standing passenger is translated with their carriage once per physics tick.
Door animation is controlled through `O`, boarding/disembarkation through `G`,
`W` for cautious acceleration and `S` for braking. All have touch buttons when
near a train. Boarding and doors are disabled when moving; top speed is about
7.9 km/h. The locomotive is intentionally limited to a short straight stretch.

A single static train formerly produced 139,824 vertices. The continuous
body model with separate door buffers has 89,640 vertices (36% fewer).
Material/orientation templates are cached, and 4 station trains share at most
2 GPU mesh sets based on track axis. Opening doors or moving a train changes
only the `uEntityOffset` uniform, with no chunk remesh, repeated GPU upload,
or full-world physics simulation. AABB proxies cost only a few comparisons on
player collision checks. This is a proxy, not a simulated vehicle chassis.

Desktop and mobile visual rendering still needs direct inspection.
Desktop and mobile visual rendering still needs direct inspection.

## Suspended metro v8 (architectural revision)

Use the **영원한 밤 · 공중 폐역 v8** world preset, or
`?world=EternalNightCityV8`. The existing `EternalNightCityLab` save
continues to use its recorded generation version; no save is silently
regenerated and no existing block ID is modified.

- **Circulation:** core `roadHalfWidth` is `0.025` relative to the core
  apothem (previously `0.01`). At a 960-cell width, main route total width
  changes from 9.6 to 24 cells. Older city versions explicitly use `0.01`.
- **Station elevation:** each new platform rises four cells above v7.
  Approaches gradually rise from the existing library interchange height to
  station level and retain track and a side pedestrian deck.
- **Stations:** paired platforms grow from 13.5 to 16.5 cells in width
  and are lengthened from 51 to 72 cells, allowing a longer stopping lane.
  Each station is still one continuous structural object, with enough clearance
  around the physical train door proxies.
- **Reference atmosphere:** a faceted elevated vault with scattered skylight
  gaps, banks of oxidized pipes, hanging wayfinding signs, stained ceramic
  cladding, worn safety strips, tactile markers, exposed structural ribs,
  aged seating, drainage grills, decayed fixtures and occasional refuse.
  Working and broken lamps retain the existing light system.
- **Exposed structure:** slim lower supports and open-span braces instead of
  a solid supporting plinth, so the entire station reads as suspended.
- **Gallery preview:** the original assembly preset remains accessible and
  receives the roof silhouette, ceiling-aligned fixtures and visible lower
  trestles. Its saved world key and original player coordinate system stay intact.

Only structures generated as v8 use the raised station composition.
The architecture is voxel stylization informed by the references, not
photorealistic reproduction. Physical collision remains a lightweight
envelope and train doors are animated as separate GPU groups.
