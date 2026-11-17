# School V3 Architecture Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to verify and finish this plan task by task. Statuses indicate evidence available, not assumed success.

**Goal:** Replace oversized empty-school V3 geometry with a coordinate-stable Korean school campus using existing building materials and parts.

**Architecture:** Keep the public `schoolVoxel`/`stampSchoolChunk`/spawn interfaces and `school-v3` mode. Author fixed-size wings and room programs from coordinates, create split-tread stair styles through the existing city-stair encoding, and never alter V2.

**Tech Stack:** ES modules, WebGL2 voxel renderer, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-17-school-v3-rebuild-design.md`

## Global Constraints
- 0.8m per voxel. Four storeys at 5 voxels each; main corridor four voxels.
- No new block IDs, renderer rewrite, or modification to V2 generation.
- Preserve deterministic generation and save isolation.
- Do not merge to main without user request.

## Review Focus
- A generated part without a style must retain default geometry; x-wall windows require proper facing.
- U-stair shall have split treads and an upper landing opening but must not carve a building-wide hole.
- Exterior header at the ceiling layer must remain solid; no façade air slots.
- Entrance route shall have a 2+ voxel passage unblocked by hedges.
- Different chunk visitation orders and world-seed sampling shall produce identical geometry.

## Tasks
### Task 1: Verify scale and existing assets
- [x] Read `src/core/scale.js`, `src/core/blocks.js`, architectural materials, parts, original V2 generator and stairs.
- [x] Verify real-world classroom and corridor dimensional references.

### Task 2: Refactor school campus
**Files:** `src/worldgen/school-v3.js`
- [x] Create measured main classroom modules, corridor and wing interiors.
- [x] Apply brick/panel/glazed façade compositions with existing asset IDs.
- [x] Add first floor entrance, paving, gym, field and vegetation.
- [x] Differentiate classrooms, administration and library.

### Task 3: Correct the staircase and circulation
**Files:** `src/worldgen/school-v3.js`
- [x] Replace 40cm half-step-only stairs with existing 20cm split-tread profiles.
- [x] Restore limited landing voids and metal rail components.
- [x] Keep entrance and hallway path free of colliding shrubs.

### Task 4: Regression checks and delivery
**Files:** `test/school-v3.test.mjs`, `sw.js`
- [x] Update V3 tests for geometry, material choice, orientation and stair style.
- [x] Bump offline snapshot name for PWA refresh.
- [x] Run source-level voxel/geometry checks in an isolated JS harness.
- [ ] Run complete `npm test` on a complete repository checkout.
- [ ] Inspect actual 3D browser views and player locomotion.
- [ ] Compare mobile performance and visual quality against the provided reference images.

**Status:** Implementation on a feature branch; real browser/integration verification remains a requirement before merge.
