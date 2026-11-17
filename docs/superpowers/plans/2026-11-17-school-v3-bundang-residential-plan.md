# Bundang-style Apartment District Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to finish and validate unverified items before calling the complete game verified.

**Goal:** Implement a playable gallery-apartment neighborhood around School V3 with no regression in the original school, V2 or city worlds.

**Architecture:** Separate deterministic coordinate-based `school-apartments.js` module is called from `school-v3.js` after core school geometry; no V2 modification. Housing finish/facade decisions are delegated to the existing newest Eternal Night modules.

## Tasks and evidence
1. [x] Inspect current `school-v3.js` geometry, world dimensions and latest city building architecture/finish/part libraries; review Bundang Si-beom urban plan
2. [x] Write failing residential tests for distant housing and extended V3 height/period
3. [x] Implement 8 apartment towers (9–14 floors), 2 vertical orientations, exterior gallery, unit doors, interior partition/furniture, stair/elevator core, roof
4. [x] Add complete neighborhood: school-to-estate walking axis, car roads, parking, park/playground, landscaped buffers and gallery access walks
5. [x] Integrate new module with school generator, correct chunk orientation and variable world height, PWA snapshot registration
6. [x] Verify 31 available unit/geometry tests and 11 sample chunks before and after optimization, no block/style differences
7. [ ] Run complete project `npm test` including the three repository integrations
8. [ ] Verify actual WebGL gameplay across school gate, each stairwell, apartment unit doors and camera views
9. [ ] Verify mobile memory/performance and acceptable sightline/draw distance

## Scope and risks
- V2 generation remains unmodified. No block ID changes or renderer changes.
- Existing V3 saves with edits in old 224-voxel periodic neighborhoods may mismatch the new 448-voxel period.
- Independent 31/31 geometry tests are not a substitute for actual gameplay/visual testing. These remaining tasks cannot be marked complete without executing them.
