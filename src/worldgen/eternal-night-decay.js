import {hash,clamp} from '../util/math.js';

// Coherent, deterministic city decay. Evaluated once per building/floor, not in a shader.
export const CITY_DECAY=Object.freeze({lightFloor:.005,lightCore:.94,lightLogStrength:.38,lightScale:26,damageBase:.10,damageRadial:.49,damageAltitude:.20});
export const smooth01=t=>{const v=clamp(t,0,1);return v*v*(3-2*v)};
export const lightProbability=distance=>{
 // Negative logarithmic attenuation, clamped to a tiny surviving-light floor.
 // Compute it only when a city plan is built (and for rare skybridge fittings).
 return Math.max(CITY_DECAY.lightFloor,CITY_DECAY.lightCore-
  CITY_DECAY.lightLogStrength*Math.log1p(Math.max(0,distance)/CITY_DECAY.lightScale));
};
export const decayPressure=(distance,fraction,buildingId,level,seed)=>{
 const radial=1-lightProbability(distance);
 const stratum=hash(buildingId,Math.floor(level/3),0,seed)-.5;
 return clamp(CITY_DECAY.damageBase+CITY_DECAY.damageRadial*radial+
  CITY_DECAY.damageAltitude*smooth01(fraction)+.12*stratum,0,.92);
};
export const floorEnvironment=(volume,centerX,centerZ,seed)=>{
 const x=(volume.x0+volume.x1)*.5,z=(volume.z0+volume.z1)*.5;
 const distance=Math.hypot(x-centerX,z-centerZ);
 const light=lightProbability(distance),count=Math.max(1,volume.floors.length-1);
 for(const f of volume.floors){
  const damage=decayPressure(distance,f.level/count,volume.id,f.level,seed);
  f.damage=damage;
  f.lightChance=light*(1-.22*damage);
 }
};
export function survivingFixture(lit,x,y,z,seed,lightChance=1){
 return hash(Math.floor(x),Math.floor(y),Math.floor(z),seed^0x215791c5)<lightChance
  ?lit:0; // A zero is interpreted as an unpowered, broken fitting by the caller.
}

// One structural failure per selected building, keyed by its world coordinates.
// The wedge opens toward the facade and narrows into the floor plate.
export function collapsePlan(volume,seed){
 const {x0,x1,z0,z1,floors}=volume;
 const x=Math.floor(x0),z=Math.floor(z0);
 if(floors.length<5||Math.min(x1-x0,z1-z0)<10||hash(x,z,17,seed)>.20)return null;
 const index=2+Math.floor(hash(x,z,23,seed)*(floors.length-3));
 const failed=floors[index],below=floors[index-1];
 const edge=Math.floor(hash(x,z,31,seed)*failed.outline.length);
 const a=failed.outline[edge],b=failed.outline[(edge+1)%failed.outline.length];
 const span=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(span<8)return null;
 const tx=(b[0]-a[0])/span,tz=(b[1]-a[1])/span;
 const t=.30+.40*hash(x,z,43,seed);
 const px=a[0]+(b[0]-a[0])*t,pz=a[1]+(b[1]-a[1])*t;
 const sign=((x0+x1)*.5-px)*-tz+((z0+z1)*.5-pz)*tx<0?-1:1;
 return {px,pz,tx,tz,nx:-tz*sign,nz:tx*sign,base:Math.round(failed.y),top:Math.round(failed.top),
  debris:Math.round(below.y),width:Math.min(3.5,span*.28),lean:(hash(x,z,53,seed)-.5)*.75};
}

export function stampCollapse(c,x,z,seed,put,empty,reserved,ids){
 const rx=x-c.px,rz=z-c.pz;
 const depth=rx*c.nx+rz*c.nz,along=rx*c.tx+rz*c.tz-c.lean*depth;
 if(depth<-.75||depth>4.6)return;
 const edge=c.width-depth*.70;
 const rough=(hash(Math.floor(x),c.base,Math.floor(z),seed)-.5)*.72;
 const side=Math.abs(along)+rough;
 if(edge>.45&&side<edge){
  // Remaining cut edges climb in short steps. Narrow end retains exposed bars.
  const y0=c.base-2,y1=Math.min(c.top-1,c.base+Math.floor(2.7-depth*.50+(edge-side)*.45));
  for(let y=y0;y<=y1;y++){
   if(reserved(y))continue;
   const exposed=y===c.base-1&&(edge-side<.52||depth>3);
   put(y,exposed?ids.EXPOSED_REBAR:ids.AIR);
  }
 }else if(side<edge+.66&&!reserved(c.base-1)&&!empty(c.base-1)){
  put(c.base-1,ids.CRACKED_CONCRETE);
 }
 // Deposit on the surviving floor below, only where there is real support.
 if(depth>.10&&Math.abs(along-.48)<c.width*.85-depth*.25&&
   !reserved(c.debris)&&!reserved(c.debris+1)&&!empty(c.debris-1)&&empty(c.debris)){
  const pile=hash(Math.floor(x),c.debris,Math.floor(z),seed^0x59a1);
  if(pile>.19)put(c.debris,pile>.76?ids.CONCRETE_SLAB:ids.RUBBLE);
  if(pile>.88&&depth<2.6&&empty(c.debris+1))put(c.debris+1,ids.RUBBLE);
 }
}
