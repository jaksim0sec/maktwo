// Altitude is expressed in actual voxel coordinates, not camera pitch.
// The transition deliberately starts above the current 64-block world ceiling.
export function skyClarityAt(voxelY){
 const t=Math.max(0,Math.min(1,(voxelY-210)/260));
 return t*t*(3-2*t);
}
