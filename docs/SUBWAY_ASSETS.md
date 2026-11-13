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
Door leaves are **static display parts** in this build, not animated doors.

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

The preview does not alter `eternal-city-lab` generation or existing saved worlds.
There is no autonomous moving train or passenger simulation. Render tests must be
done separately on desktop and mobile, especially the alpha-blended windows.
