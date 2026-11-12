// Floor-plan-derived ruins v5. A stable exterior and an edge stair core
// are assembled from five interchangeable Korean building archetypes.
import {SIZE,HEIGHT} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {integratedTerrain} from './integrated.js';
export const ARCHETYPES=Object.freeze(['shop-house','office','walkup','arcade','service']);
const GRID=32,STOREY=6;
const FINISHES=[B.CONCRETE,B.SHOP_BRICK,B.STAINED_PLASTER,B.METAL_PANEL,B.WALL_TILE];
const random=(rx,rz,seed,salt)=>hash(rx,rz,salt,seed+1957);
export function blueprintFor(rx,rz,seed){
 const n=s=>random(rx,rz,seed,s);
 if(n(0)<.16&&(rx!==0||rz!==0))return null; // guarantee a visible ruin near the initial region
 const type=ARCHETYPES[Math.floor(n(1)*ARCHETYPES.length)];
 const width=18+Math.floor(n(2)*6),depth=20+Math.floor(n(3)*5);
 const x=rx*GRID+4,z=rz*GRID+4;
 const ground=integratedTerrain(x+width/2,z+depth/2,seed,5).height;
 const buried=n(4)>.78?2:0,base=Math.max(6,Math.min(40,ground-1-buried));
 const maxFloors=Math.floor((HEIGHT-base-2)/STOREY);
 if(maxFloors<2)return null;
 const floors=Math.min(2+Math.floor(n(5)*3),maxFloors);
 const form=type==='arcade'?'L':n(6)>.66?'L':n(7)>.78?'notched':'rectangle';
 // A wing may borrow a different program while sharing the same shell.
 const annexType=form==='rectangle'?null:ARCHETYPES[(ARCHETYPES.indexOf(type)+1+Math.floor(n(12)*4))%ARCHETYPES.length];
 return {x,z,width,depth,base,floors,type,form,annexType,mirror:n(8)>.5,
  facade:FINISHES[Math.floor(n(9)*FINISHES.length)],damage:n(10),
  salt:Math.floor(n(11)*0x7fffffff),
  modules:['side-stair','corridor',type,...(annexType?['shared-wing',annexType]:[])]};
}
export function footprint(p,u,v){
 if(u<0||v<0||u>=p.width||v>=p.depth)return false;
 if(p.form==='L'&&u>=p.width-6&&v<6)return false;
 if(p.form==='notched'&&u>=p.width-4&&v<4)return false;
 return true;
}
export function storyAt(p,level){
 return {level,base:p.base+level*STOREY,
  use:(p.type==='shop-house'||p.type==='arcade')&&level===0?'retail':
    p.type==='walkup'?'residential':p.type==='service'?'plant':
    p.type==='office'?'offices':level===0?'retail':'residential'};
}
// The straight side stair occupies a protected two-cell-wide shaft.
// Twelve half-height risers connect each 6-cell storey, with a return
// corridor along u=5 and openings at both bottom and top landings.
export function stairTread(p,level,j){
 if(level<0||level>=p.floors-1||j<0||j>=12)return null;
 const top=p.base+STOREY*level+2+j*.5;
 const whole=Number.isInteger(top);
 return {y:whole?top-1:Math.floor(top),id:whole?B.UPPER_STAIR_TREAD:B.CONCRETE_SLAB,top};
}
function stairAt(p,u,v,y){
 if(u<2||u>3||v<2||v>13)return null;
 const floor=Math.floor((y-p.base)/STOREY);
 for(let l=Math.max(0,floor-1);l<=Math.min(p.floors-2,floor+1);l++){
  const step=stairTread(p,l,v-2);
  if(step&&step.y===y)return step.id;
 }
 return null;
}
function envelope(p,u,v){
 return !footprint(p,u-1,v)||!footprint(p,u+1,v)||!footprint(p,u,v-1)||!footprint(p,u,v+1);
}
function outsideWall(p,story,u,v,dy){
 const ns=!footprint(p,u,v-1)||!footprint(p,u,v+1);
 const along=ns?u:v,bay=(along+2)%5,front=v===0;
 // Each building has one immutable facade palette across every storey.
 if(front&&u===5&&dy<=3)return B.AIR;
 if(front&&story.use==='retail'&&u>=9&&u<=p.width-2){
  if((u-10)%7===0&&dy<=3)return B.AIR;
  if(dy>=2&&dy<=3)return B.SHOP_SHUTTER;
 }
 if((dy===2||dy===3)&&(bay===2||bay===3)&&(u!==0&&u!==p.width-1||!ns))
  return ns?B.WINDOW_NS:B.WINDOW_EW;
 return p.facade;
}
function roomPartition(p,story,u,v,dy){
 if(dy<2||dy>4)return B.AIR;
 // Wing's internal program may differ from the base building type. A doorway
 // joins its cells to the main hall; the facade remains globally consistent.
 if(p.annexType&&u>=p.width-7&&v>=7){
  const crossing=p.depth-7;
  if(v===crossing&&u>=p.width-7&&u<=p.width-2){
   if(u===p.width-4)return B.AIR;
   return p.annexType==='service'?B.METAL_PANEL:
    p.annexType==='arcade'?B.SHOP_SHUTTER:B.THIN_WALL_NS;
  }
  if(p.annexType==='walkup'&&u===p.width-4&&v>7&&v<p.depth-3)
   return v===p.depth-5?B.AIR:B.THIN_WALL_EW;
 }
 if(u===8&&v>=2&&v<p.depth-2){
  if(v===4||v===10||v===p.depth-5)return B.AIR;
  return story.use==='plant'?B.METAL_PANEL:B.THIN_WALL_EW;
 }
 if(story.use==='retail'&&u===13&&v>=2&&v<p.depth-2){
  return v===p.depth-6?B.AIR:B.THIN_WALL_EW;
 }
 const split=story.use==='plant'?11:story.use==='offices'?12:Math.floor(p.depth/2);
 if(story.use!=='retail'&&v===split&&u>8&&u<p.width-2){
  return u===11||u===p.width-4?B.AIR:B.THIN_WALL_NS;
 }
 if(story.use==='plant'&&v===p.depth-5&&u>8&&u<p.width-2)
  return u===p.width-5?B.AIR:B.RUSTED_METAL;
 return B.AIR;
}
export function architecturalVoxel(p,story,u,v,dy,seed){
 if(!footprint(p,u,v))return null;
 const y=story.base+dy,step=stairAt(p,u,v,y);
 if(step!==null)return step;
 const core=u>=2&&u<=3&&v>=2&&v<=13;
 const edge=envelope(p,u,v);
 if(core)return dy===0?B.CONCRETE:B.AIR;
 if(dy===0)return B.CONCRETE;
 if(dy===1)return edge?p.facade:B.FLOOR_FINISH;
 if(dy===5)return edge?p.facade:
   story.level===p.floors-1&&hash(u,story.level,v,seed+p.salt)>.987?B.AIR:B.CEILING_FINISH;
 if(edge)return outsideWall(p,story,u,v,dy);
 if(u===4&&v>=1&&v<=14){
  if((v===2||v===14)&&dy<=3)return B.AIR;
  return p.facade;
 }
 if(dy===4&&u===5&&(v===8||v===p.depth-6))
  return hash(u,story.level,v,seed+p.salt)>.4?B.FLUORESCENT:B.BROKEN_FLUORESCENT;
 if(u===5||u===6)return B.AIR;
 return roomPartition(p,story,u,v,dy);
}
function set(chunk,x,y,z,id){
 if(id===null||y<=0||y>=HEIGHT)return;
 const ix=x-chunk.cx*SIZE,iz=z-chunk.cz*SIZE;
 if(ix<0||ix>=SIZE||iz<0||iz>=SIZE)return;
 chunk.data[(y*SIZE+iz)*SIZE+ix]=id;
}
function stamp(chunk,p,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let level=0;level<p.floors;level++){
  const story=storyAt(p,level);
  for(let z=Math.max(oz,p.z);z<Math.min(oz+SIZE,p.z+p.depth);z++)
   for(let x=Math.max(ox,p.x);x<Math.min(ox+SIZE,p.x+p.width);x++){
    const lx=x-p.x,u=p.mirror?p.width-1-lx:lx,v=z-p.z;
    for(let dy=0;dy<STOREY;dy++){
     const id=architecturalVoxel(p,story,u,v,dy,seed);
     if(id!==null)set(chunk,x,story.base+dy,z,id);
    }
   }
 }
 // A compact apron connects the main hall to the surrounding terrain.
 const entryX=p.x+(p.mirror?p.width-6:5);
 for(let z=p.z-3;z<p.z;z++)for(let x=entryX-1;x<=entryX+1;x++){
  set(chunk,x,p.base,z,B.CONCRETE);set(chunk,x,p.base+1,z,B.FLOOR_FINISH);
  for(let y=p.base+2;y<=p.base+4;y++)set(chunk,x,y,z,B.AIR);
 }
}
export function stampArchitectureV3(chunk,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let rz=Math.floor((oz-29)/GRID);rz<=Math.floor((oz+SIZE)/GRID);rz++)
  for(let rx=Math.floor((ox-29)/GRID);rx<=Math.floor((ox+SIZE)/GRID);rx++){
   const p=blueprintFor(rx,rz,seed);if(p)stamp(chunk,p,seed);
  }
 chunk.dirty=true;return chunk;
}
