import {BLOCK as B} from '../core/blocks.js';

/** Small-scale inhabited spaces use layered finishes instead of treating
 * structural floor, corridor, room, ceiling and light as the same material.
 * No new block IDs: old saves, palettes and architecture remain stable.
 */
export function floorFinish(f,shape,x,z,base) {
 const corridor=shape?.corridor;
 if(corridor&&f.program!=='workshops') {
  const edge=Math.min(x-corridor.x0,corridor.x1-x,z-corridor.z0,corridor.z1-z);
  // Thin border only where the corridor has enough width. A school-like
  // 2.7 m hall must not turn entirely red-brown on the voxel grid.
  const width=Math.min(corridor.x1-corridor.x0,corridor.z1-corridor.z0);
  const band=Math.min(.8,Math.max(0,(width-2)/2));
  return edge<band?B.TERRACOTTA:B.ARCH_TILE_LARGE_PORCELAIN;
 }
 if(shape?.room?.kind==='room'&&f.program==='housing')return B.ARCH_FLOOR_WOOD;
 if(shape?.room?.kind==='shop')return B.ARCH_FLOOR_LINOLEUM;
 return base;
}

/** Drop ceilings should never seal an atrium, a short shop or a stair shaft.
 * Callers check structural holes, staircase/landing geometry and exits.
 */
export function hasDropCeiling(f,shape) {
 return Boolean(f.program!=='workshops'&&f.top-f.y>=6&&shape?.edge===-1
  &&(shape.corridor||(
   shape.room&&['market','court','exchange','shops'].includes(f.program)
  )));
}

export function ceilingFixture(f,corridor,x,z,buildingId) {
 if(!corridor)return B.CEILING_FINISH;
 const alongX=corridor.x1-corridor.x0>=corridor.z1-corridor.z0;
 const center=alongX?(corridor.z0+corridor.z1)/2:(corridor.x0+corridor.x1)/2;
 const minor=alongX?z:x,major=Math.floor(alongX?x:z);
 const phase=((major+buildingId)%6+6)%6;
 return Math.abs(minor-center)<.61&&phase===0?B.FLUORESCENT:B.CEILING_FINISH;
}

export function interiorWallFinish(f,base) {
 if(f.program==='exchange'||f.program==='court')return B.ARCH_CONCRETE_PEBBLE_PAINT;
 if(f.program==='housing'||f.program==='market'||f.program==='shops')return B.STAINED_PLASTER;
 return base;
}
