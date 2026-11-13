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
