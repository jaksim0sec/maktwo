// One saved voxel is one logical cell, physically 0.8 m on each side.
// Existing block coordinates, chunk keys, light volumes and edit snapshots
// must NOT be rescaled; only meters/world rendering and entity metric sizes are.
export const BLOCK_SIZE = .8;
export const toMeters = voxels => voxels * BLOCK_SIZE;
export const toVoxels = meters => meters / BLOCK_SIZE;
