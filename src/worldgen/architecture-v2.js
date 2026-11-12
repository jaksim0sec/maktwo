// Ruin architecture v2: connected circulation, recessed facades and real stairs.
// This pass is opt-in for generation version 4; old version-3 ruins do not change.
import {SIZE,HEIGHT} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {integratedTerrain} from './integrated.js';
import {buildingPlan} from './buildings.js';

const GRID=32,STOREY=5;
export function roomLevel(plan,level){
 return {base:plan.base+level*STOREY,level,
  kind:level===0&&plan.kind==='shops'?'shop':plan.kind==='service'||level%3===2?'service':'residential',
  split:Math.floor(plan.width/2),mid:Math.floor(plan.depth/2)};
}
const inFlight=(x,z)=>x>=3&&x<=4&&z>=2&&z<=6;
function blockAt(plan,f,lx,lz,dy,seed){
 const w=plan.width,d=plan.depth,front=plan.front==='north'?lz===0:lx===0;
 const edge=lx===0||lz===0||lx===w-1||lz===d-1;
 const pier=(lx===0||lx===w-1)&&(lz===0||lz===d-1);
 const wallNS=lz===0||lz===d-1;
 const along=wallNS?lx:lz;
 const panel=wallNS?B.THIN_WALL_NS:B.THIN_WALL_EW;
 const window=wallNS?B.WINDOW_NS:B.WINDOW_EW;
 const weather=hash(Math.floor((plan.x+lx)/3),f.level*31+plan.salt,Math.floor((plan.z+lz)/3),seed+1329);
 const roof=f.level===plan.floors-1;
 // The shared stair core stays on the SAME x,z columns on all floors.
 // Four 1-block-rising steps lead to a landing: the last 1-block lip uses
 // the engine's auto-step, with a side return corridor at x=5.
 if(inFlight(lx,lz)){
  if(dy===0)return lz===2||lz===6?B.FLOOR_TILE:B.AIR;
  if(lz>=2&&lz<=5&&dy===lz-1)return B.CONCRETE_STAIRS;
  return B.AIR;
 }
 if(dy===0)return edge?B.CONCRETE:(f.kind==='shop'?B.FLOOR_TILE:f.kind==='service'?B.WET_TILE:B.WALL_TILE);
 if(dy===4){
  if(edge)return weather>.78?B.CRACKED_CONCRETE:B.CONCRETE;
  return roof&&weather>.88?B.AIR:B.CEILING_TILE;
 }
 if(edge){
  if(pier||along%5===0)return B.CONCRETE_BEAM;
  if(front&&f.level===0){
   const mid=wallNS?Math.floor(w/2):Math.floor(d/2);
   if(Math.abs(along-mid)<=1&&dy<=2)return B.AIR; // doors on every building type
   if(f.kind!=='shop'&&Math.abs(along-mid)<=1)return B.METAL_PANEL;
  }
  if(front&&f.kind==='shop'){
   const mid=wallNS?Math.floor(w/2):Math.floor(d/2);
   if(dy===3)return along%5===1||along%5===2?B.SHOP_SIGN:B.SHOP_BRICK;
   if(along%5===3)return B.SHOP_SHUTTER;
   if(along%5===2)return window;
   return weather>.72?B.RUSTED_METAL:B.SHOP_BRICK;
  }
  const bay=along%5;
  if((dy===1||dy===2)&&(bay===2||bay===3))return window;
  if(dy===1&&bay===4)return B.CONCRETE_SLAB; // recessed sill
  if(dy===3&&bay===2)return B.CRACKED_CONCRETE;
  return weather>.87?B.MOLD_PLASTER:panel;
 }
 // Primary central corridor is 4 cells wide. Doorways are cut through
 // each thin partition and link rooms to the stair return path.
 const partLeft=Math.max(6,f.split-1),partRight=f.split+3;
 if((lx===partLeft||lx===partRight)&&lz>1&&lz<d-2){
  if(lz===3||lz===f.mid||lz===d-5)return B.AIR;
  return lx===partLeft?B.THIN_WALL_EW:B.METAL_PANEL;
 }
 if(lz===f.mid&&(lx<partLeft||lx>partRight)&&lx>1&&lx<w-2){
  if(lx===3||lx===5||lx===w-4)return B.AIR;
  return B.THIN_WALL_NS;
 }
 // Wall-mounted lights; no full-width white roof stripes.
 if(dy===3&&lx===f.split&&lz===f.mid-2)return weather>.48?B.FLUORESCENT:B.BROKEN_FLUORESCENT;
 if(dy===3&&lx===f.split+1&&lz===d-4&&weather>.71)return B.FLUORESCENT;
 if(lx===1&&lz%6===0&&dy<=2)return B.RUSTED_METAL;
 if(lz===d-2&&lx%6===0&&dy<=2)return B.MOLD_PLASTER;
 return B.AIR;
}
export function stampArchitectureV2(chunk,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 const minRx=Math.floor((ox-28)/GRID),maxRx=Math.floor((ox+SIZE+4)/GRID);
 const minRz=Math.floor((oz-28)/GRID),maxRz=Math.floor((oz+SIZE+4)/GRID);
 for(let rz=minRz;rz<=maxRz;rz++)for(let rx=minRx;rx<=maxRx;rx++){
  const plan=buildingPlan(rx,rz,seed);if(!plan)continue;
  // Each storey shares one stable stair/return core, even when the outside
  // structure is chipped or partially buried in the terrain.
  const x0=Math.max(ox,plan.x),x1=Math.min(ox+SIZE,plan.x+plan.width);
  const z0=Math.max(oz,plan.z),z1=Math.min(oz+SIZE,plan.z+plan.depth);
  for(let level=0;level<plan.floors;level++){
   const floor=roomLevel(plan,level);
   for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
    const lx=x-plan.x,lz=z-plan.z;
    for(let dy=0;dy<STOREY;dy++){
     const y=floor.base+dy;if(y<=0||y>=HEIGHT)continue;
     chunk.data[(y*SIZE+z-oz)*SIZE+x-ox]=blockAt(plan,floor,lx,lz,dy,seed);
    }
   }
  }
  // Walkable entry apron keeps doors connected to terrain rather than
  // opening into a buried hillside. It is generated at global coordinates.
  const frontMid=plan.front==='north'?Math.floor(plan.width/2):Math.floor(plan.depth/2);
  for(let across=-2;across<=2;across++)for(let forward=1;forward<=3;forward++){
   const wx=plan.front==='north'?plan.x+frontMid+across:plan.x-forward;
   const wz=plan.front==='north'?plan.z-forward:plan.z+frontMid+across;
   if(wx<ox||wx>=ox+SIZE||wz<oz||wz>=oz+SIZE)continue;
   if(plan.base>0&&plan.base<HEIGHT)chunk.data[(plan.base*SIZE+wz-oz)*SIZE+wx-ox]=B.FLOOR_TILE;
   for(let dy=1;dy<=3;dy++){
    const y=plan.base+dy;if(y>=HEIGHT)break;
    const id=dy===3&&forward===1&&Math.abs(across)<=1?B.CONCRETE_SLAB:B.AIR;
    chunk.data[(y*SIZE+wz-oz)*SIZE+wx-ox]=id;
   }
  }
  // A little street-level collapse, bounded to the building parcel.
  for(let z=Math.max(oz,plan.z-2);z<Math.min(oz+SIZE,plan.z+plan.depth+2);z++)
   for(let x=Math.max(ox,plan.x-2);x<Math.min(ox+SIZE,plan.x+plan.width+2);x++){
    if(x>=plan.x&&x<plan.x+plan.width&&z>=plan.z&&z<plan.z+plan.depth)continue;
    if(hash(x,0,z,seed+plan.salt)<.87)continue;
    const y=integratedTerrain(x,z,seed,4).height+1;
    if(y<1||y>=HEIGHT)continue;
    const index=(y*SIZE+z-oz)*SIZE+x-ox;
    if(chunk.data[index]===B.AIR)chunk.data[index]=B.RUBBLE;
   }
 }
 chunk.dirty=true;
 return chunk;
}
