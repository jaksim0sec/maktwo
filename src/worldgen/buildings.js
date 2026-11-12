// Modular ruined buildings. Each level is built from a repeatable floor plan,
// then stacked and weathered. No dependency on chunk generation order.
import {SIZE,HEIGHT} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {integratedTerrain} from './integrated.js';

const GRID=32,FLOOR=5;
const roll=(rx,rz,seed,salt)=>hash(rx,salt,rz,seed+9151);
export function buildingPlan(rx,rz,seed){
 const n=salt=>roll(rx,rz,seed,salt);
 if(n(1)<.19)return null;
 const width=14+Math.floor(n(2)*7),depth=13+Math.floor(n(3)*8);
 const x=rx*GRID+4+Math.floor(n(4)*5),z=rz*GRID+4+Math.floor(n(5)*5);
 const terrain=integratedTerrain(x+Math.floor(width/2),z+Math.floor(depth/2),seed,3);
 const buried=n(6)>.66?3:0;
 const base=Math.max(6,Math.min(40,terrain.height-1-buried));
 const maxFloors=Math.floor((HEIGHT-base-2)/FLOOR);
 if(maxFloors<2)return null;
 return {x,z,width,depth,base,floors:Math.min(2+Math.floor(n(7)*4),maxFloors),buried,
  kind:n(8)<.56?'shops':n(8)<.82?'housing':'service',
  front:n(9)<.5?'north':'west',
  lean:n(10)>.77?(n(11)<.5?-1:1):0,
  damage:n(12),salt:Math.floor(n(13)*10000)};
}
export function floorPlan(plan,level){
 return {level,
  kind:level===0&&plan.kind==='shops'?'shop':plan.kind==='service'||level%2===1?'utility':'rooms',
  shiftedX:plan.x+Math.max(0,level-1)*plan.lean,
  shiftedZ:plan.z+(plan.lean&&level>2?Math.sign(plan.lean):0),
  split:Math.floor(plan.width/2),innerZ:Math.floor(plan.depth/2),
  base:plan.base+level*FLOOR};
}
const stairwell=(x,z)=>x>=2&&x<=5&&z>=2&&z<=4;
function floorVoxel(plan,floor,lx,lz,dy,seed){
 const w=plan.width,d=plan.depth,front=plan.front==='north'?lz===0:lx===0;
 const edge=lx===0||lz===0||lx===w-1||lz===d-1;
 const stairs=stairwell(lx,lz),last=floor.level===plan.floors-1;
 const rx=floor.shiftedX+lx,rz=floor.shiftedZ+lz;
 const noise=hash(Math.floor(rx/3),floor.level+plan.salt,Math.floor(rz/3),seed+1329);
 const hole=plan.damage>.59&&last&&noise>.90&&!stairs;
 if(hole)return B.AIR;
 // Shared stairwell preserves a route between adjacent storeys.
 if(stairs&&lz<=3&&!last&&dy>=1&&dy<=lx-1)return B.CONCRETE;
 if(dy===0){
  if(floor.level>0&&stairs)return B.AIR;
  return floor.kind==='utility'?B.WET_TILE:floor.kind==='shop'?B.FLOOR_TILE:B.WALL_TILE;
 }
 if(dy===4){
  if(!last&&stairs)return B.AIR;
  return noise>.85?B.CRACKED_CONCRETE:B.CEILING_TILE;
 }
 if(edge){
  const along=plan.front==='north'?lx:lz,mid=plan.front==='north'?Math.floor(w/2):Math.floor(d/2);
  if(front&&floor.kind==='shop'){
   if(dy===3)return B.SHOP_SIGN;
   if(Math.abs(along-mid)<=1)return B.AIR;
   return along%6===0?B.CORRUGATED_METAL:along%6===1?B.RUSTED_METAL:along%6===2?B.SHOP_SHUTTER:B.DIRTY_GLASS;
  }
  const aperture=(lx+lz*3+floor.level*2)%6;
  if(dy===2&&(aperture===2||aperture===3))return B.DIRTY_GLASS;
  return noise>.83?B.CRACKED_CONCRETE:noise<.17?B.MOLD_PLASTER:floor.kind==='shop'?B.SHOP_BRICK:B.CONCRETE;
 }
 // Central passages retain openings so the floor can be explored.
 if(lx===floor.split&&lz>5&&lz<d-2&&Math.abs(lz-floor.innerZ)>1)return B.STAINED_PLASTER;
 if(floor.kind==='utility'&&lz===d-4&&lx>floor.split+1&&lx<w-2)return lx===w-4?B.AIR:B.METAL_PANEL;
 if(dy===3&&lx===floor.split-2&&lz===floor.innerZ&&noise<.85)return B.FLUORESCENT;
 if(dy===3&&lx===floor.split+2&&lz===floor.innerZ+1&&noise<.46)return B.BROKEN_FLUORESCENT;
 if(lx===1&&lz%5===0&&dy<3)return B.CONCRETE_BEAM;
 if(lz===d-2&&lx%5===0&&dy<3)return B.METAL_PANEL;
 return B.AIR;
}
function stampFloor(chunk,plan,floor,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 const x0=Math.max(ox,floor.shiftedX),x1=Math.min(ox+SIZE,floor.shiftedX+plan.width);
 const z0=Math.max(oz,floor.shiftedZ),z1=Math.min(oz+SIZE,floor.shiftedZ+plan.depth);
 for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
  const lx=x-floor.shiftedX,lz=z-floor.shiftedZ;
  for(let dy=0;dy<FLOOR;dy++){
   const y=floor.base+dy;if(y<=0||y>=HEIGHT)continue;
   chunk.data[(y*SIZE+z-oz)*SIZE+x-ox]=floorVoxel(plan,floor,lx,lz,dy,seed);
  }
 }
}
function scatterDebris(chunk,plan,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let z=Math.max(oz,plan.z-2);z<Math.min(oz+SIZE,plan.z+plan.depth+2);z++)
  for(let x=Math.max(ox,plan.x-2);x<Math.min(ox+SIZE,plan.x+plan.width+2);x++){
   if(x>=plan.x&&x<plan.x+plan.width&&z>=plan.z&&z<plan.z+plan.depth)continue;
   if(hash(x,0,z,seed+plan.salt)<.84)continue;
   const y=integratedTerrain(x,z,seed,3).height+1;
   if(y>=HEIGHT-1||y<=1)continue;
   const i=(y*SIZE+z-oz)*SIZE+x-ox;
   if(chunk.data[i]===B.AIR)chunk.data[i]=hash(x,1,z,seed+plan.salt)>.78?B.EXPOSED_REBAR:B.RUBBLE;
  }
}
export function stampRuins(chunk,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 // Neighboring region anchors are checked so no floor is cut at chunk edges.
 const minX=Math.floor((ox-27)/GRID),maxX=Math.floor((ox+SIZE+6)/GRID);
 const minZ=Math.floor((oz-27)/GRID),maxZ=Math.floor((oz+SIZE+6)/GRID);
 for(let rz=minZ;rz<=maxZ;rz++)for(let rx=minX;rx<=maxX;rx++){
  const plan=buildingPlan(rx,rz,seed);if(!plan)continue;
  for(let level=0;level<plan.floors;level++)stampFloor(chunk,plan,floorPlan(plan,level),seed);
  scatterDebris(chunk,plan,seed);
 }
 chunk.dirty=true;return chunk;
}
