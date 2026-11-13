# Metro finish and rolling-stock correction (2026-11-13)

## Scope
Correct only the remaining repetitive surface patterns and station/rolling-stock assemblies
seen in the five supplied screenshots. Preserve the other improved textures.

## Findings
- Metro glazed tile: the prior authored fracture formed the exact same branching Y
  every 32 pixels, producing wall-wide repeated graffiti.
- Ceiling panel: a fixed ring at the same texel coordinate produced a regular
  decoration. Such fixed stains are visually stronger than the material itself.
- Rolling-stock side: continuous cuboid seat slugs and thick rubber window
  dividers made the train read as a glazed building. The painted materials also
  baked in strong black bands and seams independent of actual geometry.
- Transit parts: nameboards, turnstiles, and steps lacked recognizable geometry.

## Corrective design
- 32px textures retained. Hairlines are rare, tapered and discontinuous in each
  individual ceramic cell. Ceiling loses its identical bullseye stain.
- Train enamel and windows use quiet paint/glass surfaces, with seams expressed
  through thin physical framing. Seats have individual vinyl pads and rails.
- Active carriage gains continuous thin sill trim, overhead paired bars and
  sparse hand loops, with identical door IDs, positions and animated leaf ranges.
- Existing 30 standalone station part IDs remain stable. Station signs now
  have recognisable strip signage; turnstiles use two supports and glazing;
  stairs have three risers rather than two oversized steps.

## Budget
No new 32px layers, no shader passes, no new world block IDs, no new
per-frame procedural calculations. Carriage mesh contains additional
static geometry built once, so real-device GPU regression remains necessary.
