import {block,BLOCK as B} from './blocks.js';import {clamp} from '../util/math.js';
import {toVoxels} from './scale.js';
import {doorBounds,isDoor,DOOR_HEIGHT} from './door.js';
import {solidBlockOverlap,fenceBoxes} from './shapes.js';
export const GRAVITY=toVoxels(24);
export const AUTO_STEP_HEIGHT=1.0;
const STEP_GRANULARITY=.125;
function climbStep(world,e,width,height){
 for(let rise=STEP_GRANULARITY;rise<=AUTO_STEP_HEIGHT+1e-8;rise+=STEP_GRANULARITY){
  if(!collides(world,e.x,e.y+rise,e.z,width,height)){e.y+=rise;e.onStep?.(rise);return true}
 }
 return false;
}
export function collides(world,x,y,z,width=.6,height=1.8){const e=1e-5,body={x,y,z,width,height};
 for(let bx=Math.floor(x-width/2+e);bx<=Math.floor(x+width/2-e);bx++)
 for(let by=Math.floor(y+e);by<=Math.floor(y+height-e);by++)
 for(let bz=Math.floor(z-width/2+e);bz<=Math.floor(z+width/2-e);bz++){
  const id=world.get(bx,by,bz);
  if(solidBlockOverlap(world,bx,by,bz,id,body,e))return true;
 }
 return false;
}
export function inWater(world,e){return world.get(e.x,e.y+.5,e.z)===B.WATER}
export function moveBody(world,e,dt){const w=e.width||.6,h=e.height||1.8;dt=clamp(dt,0,.08);const wasGrounded=e.grounded;e.water=inWater(world,e);if(!e.fly)e.vy=clamp(e.vy-(e.water?toVoxels(6):GRAVITY)*dt,-35,25);else e.vy=0;
 const sub=Math.max(1,Math.ceil(Math.hypot(e.vx,e.vy,e.vz)*dt/.18));const step=dt/sub;e.grounded=false;
 for(let n=0;n<sub;n++){
  for(const [axis,vel] of [['x','vx'],['z','vz']]){const old=e[axis];e[axis]+=e[vel]*step;if(collides(world,e.x,e.y,e.z,w,h)){// Step up a low obstacle when walking.
   if(!e.fly&&wasGrounded&&e.vy<=1&&climbStep(world,e,w,h))continue;e[axis]=old;e[vel]=0}}
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
 for(let n=0;n<256&&t<=maxDistance;n++){const id=world.get(x,y,z);if(id!==B.AIR&&(hitWater||id!==B.WATER)&&(hitDecor||id!==B.FLOWER)){
  if(isDoor(id)){
   const baseY=id===B.DOOR_TOP?y-1:y;
   const door=intersectDoor(origin,direction,x,baseY,z,world.getDoorState?.(x,y,z));
   if(door&&door.distance>=t-1e-5&&door.distance<=maxDistance)return{x,y,z,id,normal:door.normal,distance:door.distance};
  }else if(id===B.FENCE){
   let closest=null;for(const bounds of fenceBoxes(x,y,z)){
    const hit=intersectAabb(origin,direction,[bounds.x,bounds.y,bounds.z],[bounds.x+bounds.w,bounds.y+bounds.h,bounds.z+bounds.d]);
    if(hit&&(!closest||hit.distance<closest.distance))closest=hit;
   }
   if(closest&&closest.distance<=maxDistance)return{x,y,z,id,normal:closest.normal,distance:closest.distance};
  }else return{x,y,z,id,normal,distance:t};
 }let a=0;if(tMax[1]<tMax[a])a=1;if(tMax[2]<tMax[a])a=2;t=tMax[a];if(t>maxDistance)break;tMax[a]+=tDelta[a];coords[a]+=step[a];[x,y,z]=coords;normal={x:0,y:0,z:0};normal[['x','y','z'][a]]=-step[a]}return null}
