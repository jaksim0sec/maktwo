import {block,BLOCK as B} from './blocks.js';import {clamp} from '../util/math.js';
import {toVoxels} from './scale.js';
import {doorBounds,isDoor,doorIntersectsBody,DOOR_HEIGHT} from './door.js';
import {trainCollision} from './train-collision.js';
import {FORMED,hitFormed} from './construction.js';
import {partById} from './part-library.js';
import {partPrisms,partRaycast} from './part-prisms.js';
import {fencePrisms} from './fence-joints.js';
import {hitMount} from './mounts.js';
import {solidBlockOverlap,shapeBoxes,isStairs,isSlab,isPanel,diagonalPanel} from './shapes.js';
export const GRAVITY=toVoxels(24);
export const AUTO_STEP_HEIGHT=1.0;
const STEP_GRANULARITY=.125;
function doorCollision(world,x,y,z,width,height){
 const body={x,y,z,width,height};
 for(let bx=Math.floor(x-width/2);bx<=Math.floor(x+width/2);bx++)for(let by=Math.floor(y);by<=Math.floor(y+height);by++)for(let bz=Math.floor(z-width/2);bz<=Math.floor(z+width/2);bz++){
  const id=world.get(bx,by,bz,false);
  if(isDoor(id)&&doorIntersectsBody(bx,id===B.DOOR_TOP?by-1:by,bz,world.getDoorState(bx,by,bz),body))return true;
 }
 return false;
}
function recoverDoorOverlap(world,e,width,height){
 if(!doorCollision(world,e.x,e.y,e.z,width,height))return false;
 const ox=e.x,oz=e.z;
 for(const r of [.125,.25,.375,.5,.625,.75])for(let a=0;a<8;a++){
  const theta=a*Math.PI/4,x=ox+Math.cos(theta)*r,z=oz+Math.sin(theta)*r;
  if(!collides(world,x,e.y,z,width,height)){
   e.x=x;e.z=z;e.vx=0;e.vz=0;return true;
  }
 }
 return false;
}
function climbStep(world,e,width,height){
 for(let rise=STEP_GRANULARITY;rise<=AUTO_STEP_HEIGHT+1e-8;rise+=STEP_GRANULARITY){
  if(!collides(world,e.x,e.y+rise,e.z,width,height)){e.y+=rise;e.onStep?.(rise);return true}
 }
 return false;
}
export function collides(world,x,y,z,width=.6,height=1.8){
 if(trainCollision(world.trainColliders,x,y,z,width,height))return true;
 const e=1e-5,body={x,y,z,width,height},cell={form:0};
 for(let bx=Math.floor(x-width/2+e);bx<=Math.floor(x+width/2-e);bx++)
 for(let by=Math.floor(y+e);by<=Math.floor(y+height-e);by++)
 for(let bz=Math.floor(z-width/2+e);bz<=Math.floor(z+width/2-e);bz++){
  const id=world.get(bx,by,bz,true,cell);
  if(solidBlockOverlap(world,bx,by,bz,id,body,e,cell.form))return true;
 }
 return false;
}
export function inWater(world,e){return world.get(e.x,e.y+.5,e.z)===B.WATER}
export function moveBody(world,e,dt){const w=e.width||.6,h=e.height||1.8;dt=clamp(dt,0,.08);recoverDoorOverlap(world,e,w,h);const wasGrounded=e.grounded;e.water=inWater(world,e);if(!e.fly)e.vy=clamp(e.vy-(e.water?toVoxels(6):GRAVITY)*dt,-35,25);
 const sub=Math.max(1,Math.ceil(Math.hypot(e.vx,e.vy,e.vz)*dt/.18));const step=dt/sub;e.grounded=false;
 for(let n=0;n<sub;n++){
  for(const [axis,vel] of [['x','vx'],['z','vz']]){const old=e[axis];e[axis]+=e[vel]*step;if(collides(world,e.x,e.y,e.z,w,h)){// Step up a low obstacle when walking.
   if(!e.fly&&wasGrounded&&e.vy<=1&&!e.crouching&&!doorCollision(world,e.x,e.y,e.z,w,h)&&climbStep(world,e,w,h))continue;e[axis]=old;e[vel]=0}
   if(e.crouching&&wasGrounded&&!e.fly&&!collides(world,e.x,e.y-.12,e.z,w,h)){e[axis]=old;e[vel]=0}
  }
  const oldY=e.y;e.y+=e.vy*step;
  if(collides(world,e.x,e.y,e.z,w,h)){
   // Revert the *swept* vertical movement. Never search upward with a while-loop:
   // a door closing nearby could otherwise launch the character multiple metres.
   if(e.vy<=0)e.grounded=true;e.y=oldY;e.vy=0;
  }
 }
 if(!e.fly&&!e.grounded&&!collides(world,e.x,e.y-.06,e.z,w,h)){}else if(!e.fly&&e.vy===0)e.grounded=true;
 if(e.y<-10){e.x=0;e.y=45;e.z=0;e.vy=0}
 return e;
}
// Intersect an actual thin door slab so open doors are not targeted through
// the rest of their empty voxel. Returns surface normal for placement too.
export function intersectAabb(origin,direction,lo,hi){
 let t0=-Infinity,t1=Infinity,normal={x:0,y:0,z:0};
 for(let axis=0;axis<3;axis++){
  const d=[direction.x,direction.y,direction.z][axis],o=[origin.x,origin.y,origin.z][axis];
  if(Math.abs(d)<1e-10){if(o<lo[axis]||o>hi[axis])return null;continue}
  const low=(lo[axis]-o)/d,high=(hi[axis]-o)/d,near=Math.min(low,high),far=Math.max(low,high);
  if(near>t0){t0=near;normal={x:0,y:0,z:0};normal[['x','y','z'][axis]]=low<high?-1:1}
  t1=Math.min(t1,far);if(t0>t1)return null;
 }
 const distance=t0>=0?t0:t1;return distance>=0?{distance,normal}:null;
}
export function intersectDoor(origin,direction,x,y,z,state){
 const b=doorBounds(x,z,state?.facing||0,Boolean(state?.open));
 return intersectAabb(origin,direction,[b.x,y+.04,b.z],[b.x+b.w,y+.04+DOOR_HEIGHT,b.z+b.d]);
}
// 3D voxel DDA with face normal, also works through chunk boundaries.
export function raycast(world,origin,direction,maxDistance=6,{hitWater=false,hitDecor=false}={}){let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z);const d=direction,step=[Math.sign(d.x),Math.sign(d.y),Math.sign(d.z)],coords=[x,y,z],dir=[d.x,d.y,d.z],pos=[origin.x,origin.y,origin.z];const tDelta=dir.map(v=>v===0?Infinity:Math.abs(1/v));const tMax=dir.map((v,i)=>v===0?Infinity:((step[i]>0?coords[i]+1-pos[i]:pos[i]-coords[i])/Math.abs(v)));let normal={x:0,y:0,z:0},t=0;
 const cell={form:0,pickMount:true,mount:null};
 for(let n=0;n<256&&t<=maxDistance;n++){
  const id=world.get(x,y,z,true,cell);
  let hit=null;
  if(id!==B.AIR&&(hitWater||id!==B.WATER)&&(hitDecor||block(id).render!=='cross')){
   if(FORMED[cell.form])hit=hitFormed(FORMED[cell.form],x,y,z,origin,direction);
   else if(partById(id))hit=partRaycast(partPrisms(id,x,y,z,world.getShapeState?.(x,y,z)||{}),origin,direction,maxDistance);
   else if(id===B.FENCE){
    const state=world.getShapeState?.(x,y,z);
    hit=partRaycast(fencePrisms(x,y,z,state?.fenceJoints||[],state?.variant===6||state?.variant===7),origin,direction,maxDistance);
   }else if(isDoor(id)){
    const baseY=id===B.DOOR_TOP?y-1:y;
    hit=intersectDoor(origin,direction,x,baseY,z,world.getDoorState?.(x,y,z));
   }else{
    const state=isStairs(id)||isSlab(id)||id===B.CHAIR||isPanel(id)?world.getShapeState?.(x,y,z):undefined;
    const diagonal=isPanel(id)?diagonalPanel(id,state):null;
    const boxes=diagonal?null:shapeBoxes(id,x,y,z,state);
    if(diagonal){
     for(const part of diagonal){
      const next=hitFormed(part,x,y,z,origin,direction);
      if(next&&next.distance>=t-1e-5&&(!hit||next.distance<hit.distance))hit=next;
     }
    }else if(boxes){
     for(const {x:bx,y:by,z:bz,w,h,d} of boxes){
      const next=intersectAabb(origin,direction,[bx,by,bz],[bx+w,by+h,bz+d]);
      if(next&&next.distance>=t-1e-5&&(!hit||next.distance<hit.distance)){
       hit=next;
       if(id===B.THIN_WALL_NS||id===B.THIN_WALL_EW){
        hit.anchor={x:bx+w*(1+next.normal.x)/2,y:by+h*(1+next.normal.y)/2,z:bz+d*(1+next.normal.z)/2};
       }
      }
     }
    }else{
     const anchor=block(id).render==='cube'?{x:x+.5+normal.x*.5,y:y+.5+normal.y*.5,z:z+.5+normal.z*.5}:null;
     hit={distance:t,normal,anchor};
    }
   }
  }
  if(cell.mount){
   const mounted=hitMount(cell.mount,origin,direction,intersectAabb);
   if(mounted&&mounted.distance>=t-1e-5&&mounted.distance<=maxDistance&&(!hit||mounted.distance<hit.distance)){
    return {x,y,z,id:cell.mount.id,distance:mounted.distance,mounted:true};
   }
  }
  if(hit&&hit.distance>=t-1e-5&&hit.distance<=maxDistance)return{x,y,z,id,...hit};
 let a=0;if(tMax[1]<tMax[a])a=1;if(tMax[2]<tMax[a])a=2;t=tMax[a];if(t>maxDistance)break;tMax[a]+=tDelta[a];coords[a]+=step[a];[x,y,z]=coords;normal={x:0,y:0,z:0};normal[['x','y','z'][a]]=-step[a]}return null}
