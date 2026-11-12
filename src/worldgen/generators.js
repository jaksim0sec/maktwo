import {SIZE,HEIGHT} from '../core/chunk.js';
import {highlandAt,highlandBiome} from './landforms.js';
import {BLOCK as B} from '../core/blocks.js';import {fbm,hash,clamp} from '../util/math.js';
export const SEA=17;
export const BIOMES={plains:{base:22,relief:7,tree:.012},forest:{base:24,relief:9,tree:.075},desert:{base:20,relief:8,tree:0},mountains:{base:30,relief:23,tree:.008}};
export function biomeAt(x,z,seed,mode='normal'){
 if(mode==='highlands')return highlandBiome(highlandAt(x,z,seed));const h=fbm(x*.003,z*.003,seed+110,3),dry=fbm(x*.007,z*.007,seed+221,3);return h>.21?'mountains':dry>.17?'desert':dry<-.12?'forest':'plains'}
export function surfaceAt(x,z,seed,mode='normal'){
 if(mode==='flat')return 22;
 if(mode==='highlands')return highlandAt(x,z,seed).height;
 const biome=biomeAt(x,z,seed),cfg=BIOMES[biome];let h=cfg.base+fbm(x*.018,z*.018,seed,4)*cfg.relief+fbm(x*.065,z*.065,seed+22,2)*2;
 if(mode==='islands'){const r=Math.hypot(x,z),envelope=clamp((180-r)/65,-3,1);h=SEA-4+(h-SEA+4)*Math.max(0,envelope)}
 return clamp(Math.floor(h),2,HEIGHT-8);
}
// Stable world-coordinate passes: features can cross chunk boundaries without load-order dependence.
export function generateChunk(chunk,seed,mode='normal'){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,profile=mode==='highlands'?highlandAt(wx,wz,seed):null;
  const h=profile?profile.height:surfaceAt(wx,wz,seed,mode),b=profile?highlandBiome(profile):biomeAt(wx,wz,seed,mode);
  for(let y=0;y<HEIGHT;y++){
   let id=B.AIR;if(y===0)id=B.BEDROCK;else if(y<h-4)id=B.STONE;else if(y<h)id=b==='desert'?B.SAND:B.DIRT;else if(y===h)id=b==='desert'?B.SAND:B.GRASS;else if(y<=SEA)id=B.WATER;
   if(mode!=='flat'&&y>5&&y<h-4&&y<36&&fbm(wx*.085+y*.017,wz*.085-y*.01,seed+y*31,2)>.48)id=B.AIR;
   if(id===B.STONE&&hash(wx,y,wz,seed+701)>.987)id=B.ORE;
   chunk.data[(y*SIZE+z)*SIZE+x]=id;
  }
 }
 if(mode!=='flat'){
  // Search an expanded region so neighboring chunks receive identical feature pieces.
  for(let wz=oz-5;wz<oz+SIZE+5;wz++)for(let wx=ox-5;wx<ox+SIZE+5;wx++){
   const biome=biomeAt(wx,wz,seed,mode),cfg=BIOMES[biome];if(hash(wx,0,wz,seed+401)>=cfg.tree)continue;
   if(hash(wx,1,wz,seed+402)<.65)continue;
   const h=surfaceAt(wx,wz,seed,mode);if(h<=SEA||h>=HEIGHT-9)continue;
   const trunk=4+Math.floor(hash(wx,2,wz,seed)*2);
   function put(ax,ay,az,id,onlyAir=false){const lx=ax-ox,lz=az-oz;if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||ay<0||ay>=HEIGHT)return;const idx=(ay*SIZE+lz)*SIZE+lx;if(!onlyAir||chunk.data[idx]===B.AIR)chunk.data[idx]=id}
   for(let y=h+1;y<=h+trunk;y++)put(wx,y,wz,B.WOOD);
   for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dz*dz+(dy*.9)**2<=5.7&&hash(wx+dx,dy,wz+dz,seed+9)>.12)put(wx+dx,h+trunk+dy,wz+dz,B.LEAVES,true);
  }
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){const wx=ox+x,wz=oz+z,h=surfaceAt(wx,wz,seed,mode);if(h>SEA&&h+1<HEIGHT&&chunk.get(x,h,z)===B.GRASS&&chunk.get(x,h+1,z)===B.AIR&&hash(wx,4,wz,seed)>.975)chunk.set(x,h+1,z,B.FLOWER)}
 }
 chunk.dirty=true;return chunk;
}
export const GENERATORS={normal:'Hills, caves, trees and biomes',flat:'Flat builder world',islands:'Scattered ocean islands',highlands:'Warped ridges, winding canyons and mountains'};
