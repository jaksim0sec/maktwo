# Structural props and railings · procedural overhaul

## Scope and real render paths
Architecture: 70 catalog pieces (IDs 116–185) share part-library.js.
Metro: 30 pieces (IDs 208–237) use station-parts.js.
Standalone: mattress/bed 246–249, caged torch/lamp 14/16,
crate 187 and workbench 23 are separate mesher models.
City stairs/bridges use part-prisms.js special cases, not just gallery models.

## Root problem
Many part silhouettes were made from full unit cuboids and a few similarly
colored metal/stone finishes. Fake surface stripes would only repeat the
texture problems already fixed. Recesses and functional hardware must be real
geometry, not disconnected decorative markings.

## Design decisions
- Split chair and desk into different silhouettes; cut thin bookshelf backing.
- Layer timber bed, mattress, quilt, piping and pillow across saved 2-cell IDs.
- Replace a giant luminous box with a small protected caged light.
- Add constrained rail footplates, thinner caps, window seals, door reveals,
  recessed cabinet panels, station handles and link-stair nosings.
- Use per-piece `tone` on the existing packed vertex shade float for static
  cavity darkening. This does NOT implement true baked AO.
- Avoid per-cell decorative stripes on wall or sign families.
- Preserve block IDs, save data, 32×32 materials and existing shader stride.

## Verification and remaining gates
- Done: runtime shape bounds for architectural 70 parts, transit 30 and
  seven standalone fixtures; finite model coordinates; static rail geometry.
- Added: Node regression tests for these invariants.
- Open: running full Node suite, browser screenshots, mobile GPU timing,
  all LOD/adjacent-cell seams, and saved-world round-trip.
Do not describe the visual overhaul as fully verified before those gates.
