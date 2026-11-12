import {block,BLOCK as B} from './blocks.js';import {clamp} from '../util/math.js';
export const GRAVITY=24;
export function collides(world,x,y,z,width=0.6,height=1.8){const e=1e-5;for(let bx=Math.floor(x-width/2+e);bx<=Math.floor(x+width/2-e);bx++)for(let by=Math.floor(y+e);by<=Math.floor(y+height-e);by++)for(let bz=Math.floor(z-width/2+e);bz<=Math.floor(z+width/2-e);bz++)if(block(world.get(bx,by,bz)).solid)return true;return false}
export function inWater(world,e){return world.get(e.x,e.y+.5,e.z)===B.WATER}
export function moveBody(world,e,dt){const w=e.width||.6,h=e.height||1.8;dt=clamp(dt,0,.08);const wasGrounded=e.grounded;e.water=inWater(world,e);if(!e.fly)e.vy=clamp(e.vy-(e.water?6:GRAVITY)*dt,-35,25);else e.vy=0;
 const sub=Math.max(1,Math.ceil(Math.hypot(e.vx,e.vy,e.vz)*dt/.18));const step=dt/sub;e.grounded=false;
 for(let n=0;n<sub;n++){
  for(const [axis,vel] of [['x','vx'],['z','vz']]){const old=e[axis];e[axis]+=e[vel]*step;if(collides(world,e.x,e.y,e.z,w,h)){// Step up a low obstacle when walking.
   if(!e.fly&&wasGrounded&&e.vy<=1&&!collides(world,e.x,e.y+.55,e.z,w,h)){e.y+=.55;continue}e[axis]=old;e[vel]=0}}
  e.y+=e.vy*step;if(collides(world,e.x,e.y,e.z,w,h)){if(e.vy<0){e.grounded=true;e.y=Math.floor(e.y)+1e-3;while(collides(world,e.x,e.y,e.z,w,h))e.y+=.05}else{e.y=Math.floor(e.y+h)-h-1e-3;while(collides(world,e.x,e.y,e.z,w,h))e.y-=.05}e.vy=0}
 }
 if(!e.fly&&!e.grounded&&!collides(world,e.x,e.y-.06,e.z,w,h)){}else if(!e.fly&&e.vy===0)e.grounded=true;
 if(e.y<-10){e.x=0;e.y=45;e.z=0;e.vy=0}
 return e;
}
// 3D voxel DDA with face normal, also works through chunk boundaries.
export function raycast(world,origin,direction,maxDistance=6){let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z);const d=direction,step=[Math.sign(d.x),Math.sign(d.y),Math.sign(d.z)],coords=[x,y,z],dir=[d.x,d.y,d.z],pos=[origin.x,origin.y,origin.z];const tDelta=dir.map(v=>v===0?Infinity:Math.abs(1/v));const tMax=dir.map((v,i)=>v===0?Infinity:((step[i]>0?coords[i]+1-pos[i]:pos[i]-coords[i])/Math.abs(v)));let normal={x:0,y:0,z:0},t=0;
 for(let n=0;n<256&&t<=maxDistance;n++){const id=world.get(x,y,z);if(id!==B.AIR&&id!==B.WATER&&id!==B.FLOWER&&id!==B.TORCH)return{x,y,z,id,normal,distance:t};let a=0;if(tMax[1]<tMax[a])a=1;if(tMax[2]<tMax[a])a=2;t=tMax[a];if(t>maxDistance)break;tMax[a]+=tDelta[a];coords[a]+=step[a];[x,y,z]=coords;normal={x:0,y:0,z:0};normal[['x','y','z'][a]]=-step[a]}return null}
