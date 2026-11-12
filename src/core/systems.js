import {BLOCK as B,block} from './blocks.js';import {hash} from '../util/math.js';
export class Inventory{
 constructor(size=36){this.slots=Array.from({length:size},()=>null)}
 add(id,count=1){if(!Number.isInteger(count)||count<1)return 0;let left=count;for(const slot of this.slots){if(slot&&slot.id===id&&slot.count<64){const n=Math.min(64-slot.count,left);slot.count+=n;left-=n;if(!left)return count}}for(let i=0;i<this.slots.length&&left;i++){if(!this.slots[i]){const n=Math.min(64,left);this.slots[i]={id,count:n};left-=n}}return count-left}
 remove(id,count=1){let left=count;for(let i=0;i<this.slots.length&&left;i++){const s=this.slots[i];if(s?.id===id){const n=Math.min(s.count,left);s.count-=n;left-=n;if(!s.count)this.slots[i]=null}}return count-left}
 count(id){return this.slots.reduce((s,slot)=>s+(slot?.id===id?slot.count:0),0)}
}
export class BehaviorRegistry{constructor(){this.types=new Map()}register(id,behavior){this.types.set(id,behavior)}onPlace(world,pos,id){this.types.get(id)?.onPlace?.(world,pos)}onTick(world,pos,id){this.types.get(id)?.onTick?.(world,pos)}}
export function explode(world,entities,effects,x,y,z,radius=3){let removed=0;const r=Math.max(0,Math.min(radius,7));for(let ix=Math.floor(x-r);ix<=Math.ceil(x+r);ix++)for(let iy=Math.max(1,Math.floor(y-r));iy<=Math.min(63,Math.ceil(y+r));iy++)for(let iz=Math.floor(z-r);iz<=Math.ceil(z+r);iz++){const d=Math.hypot(ix+.5-x,iy+.5-y,iz+.5-z);if(d>r)continue;const id=world.get(ix,iy,iz);if(id===B.BEDROCK||id===B.AIR||id===B.WATER)continue;const resistance=block(id).hardness;if(d/r+hash(ix,iy,iz,world.seed)*.4<1.15-resistance*.06){world.set(ix,iy,iz,B.AIR,{simulate:false});removed++}}
 for(const e of entities){const d=Math.hypot(e.x-x,e.y+e.height/2-y,e.z-z);if(d<r*2){e.hurt(Math.ceil((1-d/(r*2))*10),{x,y,z})}}effects?.burst(x,y,z,'#ffc66b',45);world.events.emit('explosion',{x,y,z,radius:r,removed});return removed}
export class Projectile{
 constructor(x,y,z,vx,vy,vz,owner=null){Object.assign(this,{x,y,z,vx,vy,vz,owner,age:0,dead:false})}
 tick(world,entities,dt){const speed=Math.hypot(this.vx,this.vy,this.vz),steps=Math.max(1,Math.ceil(speed*dt/.15));for(let j=0;j<steps;j++){const s=dt/steps;this.x+=this.vx*s;this.y+=this.vy*s;this.z+=this.vz*s;this.vy-=9.8*s;if(world.get(this.x,this.y,this.z)!==B.AIR&&world.get(this.x,this.y,this.z)!==B.WATER){this.dead=true;break}for(const e of entities)if(e!==this.owner&&!e.dead&&Math.abs(e.x-this.x)<e.width*.5&&this.y>e.y&&this.y<e.y+e.height&&Math.abs(e.z-this.z)<e.width*.5){e.hurt(4,this.owner);this.dead=true;break}if(this.dead)break}this.age+=dt;if(this.age>8)this.dead=true}
}
