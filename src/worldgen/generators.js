import {SIZE,HEIGHT} from '../core/chunk.js';
import {highlandAt,highlandBiome} from './landforms.js';
import {integratedTerrain} from './integrated.js';
import {stampRuins} from './buildings.js';
import {BLOCK as B} from '../core/blocks.js';import {fbm,hash,clamp} from '../util/math.js';
export const SEA=17;
export const BIOMES={plains:{base:22,relief:7,tree:.012},forest:{base:24,relief:9,tree:.075},desert:{base:20,relief:8,tree:0},mountains:{base:30,relief:23,tree:.008},marsh:{base:18,relief:4,tree:.02},alpine:{tree:.004},volcanic:{tree:0},badlands:{tree:0},wetlands:{tree:.032},boreal:{tree:.047},meadow:{tree:.014},limestone:{tree:.004}};
export function biomeAt(x,z,seed,mode='normal',version=1){
 if((mode==='normal'||mode==='ruins')&&version>=2)return integratedTerrain(x,z,seed,version).biome;
 if(mode==='highlands')return highlandBiome(highlandAt(x,z,seed));const h=fbm(x*.003,z*.003,seed+110,3),dry=fbm(x*.007,z*.007,seed+221,3);return h>.21?'mountains':dry>.17?'desert':dry<-.12?'forest':'plains'}
export function surfaceAt(x,z,seed,mode='normal',version=1){
 if((mode==='normal'||mode==='ruins')&&version>=2)return integratedTerrain(x,z,seed,version).height;
 if(mode==='flat')return 22;
 if(mode==='highlands')return highlandAt(x,z,seed).height;
 const biome=biomeAt(x,z,seed),cfg=BIOMES[biome];let h=cfg.base+fbm(x*.018,z*.018,seed,4)*cfg.relief+fbm(x*.065,z*.065,seed+22,2)*2;
 if(mode==='islands'){const r=Math.hypot(x,z),envelope=clamp((180-r)/65,-3,1);h=SEA-4+(h-SEA+4)*Math.max(0,envelope)}
 return clamp(Math.floor(h),2,HEIGHT-8);
}
// Stable world-coordinate passes: features can cross chunk boundaries without load-order dependence.
export function generateChunk(chunk,seed,mode='normal',version=1){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,profile=mode==='highlands'?highlandAt(wx,wz,seed):null;
  const integrated=(mode==='normal'||mode==='ruins')&&version>=2?integratedTerrain(wx,wz,seed,version):null;
  const h=integrated?integrated.height:profile?profile.height:surfaceAt(wx,wz,seed,mode,version),b=integrated?integrated.biome:profile?highlandBiome(profile):biomeAt(wx,wz,seed,mode);
  for(let y=0;y<HEIGHT;y++){
   let id=B.AIR;if(y===0)id=B.BEDROCK;else if(y<h-4)id=B.STONE;else if(y<h)id=b==='desert'?B.SAND:B.DIRT;else if(y===h)id=b==='desert'?B.SAND:B.GRASS;else if(y<=SEA)id=B.WATER;
   if(mode!=='flat'&&y>5&&y<h-4&&y<36&&fbm(wx*.085+y*.017,wz*.085-y*.01,seed+y*31,2)>.48)id=B.AIR;
   if(version>=3&&(mode==='normal'||mode==='ruins')&&id!==B.BEDROCK&&id!==B.AIR&&id!==B.WATER){
    const geology=hash(Math.floor(wx/6),Math.floor(y/5),Math.floor(wz/6),seed+850);
    const r=hash(wx,y,wz,seed+862);
    if(y<h-4){
     if(b==='volcanic')id=geology>.22?B.BASALT:B.SLATE;
     else if(b==='limestone')id=geology>.34?B.LIMESTONE:B.MARBLE;
     else if(b==='badlands')id=geology>.55?B.TERRACOTTA:B.SHALE;
     else if(b==='alpine')id=geology>.39?B.GRANITE:B.SLATE;
     else if(b==='mountains'&&geology>.72)id=B.BASALT;
     else id=geology>.83?B.SHALE:geology<.18?B.SLATE:B.STONE;
     if(r>.997)id=B.QUARTZ;
    }else if(y<h){
     id=b==='badlands'?B.TERRACOTTA:b==='wetlands'?B.CLAY:b==='boreal'?B.ALPINE_SOIL:b==='alpine'?B.ALPINE_SOIL:b==='volcanic'?B.BASALT:b==='limestone'?B.LIMESTONE:B.DIRT;
     if(b==='wetlands'&&geology>.65)id=B.PEAT;
    }else if(y===h){
     id=b==='alpine'?(r>.85?B.ICE:B.SNOW):b==='volcanic'?B.BASALT:b==='badlands'?B.RED_SAND:b==='wetlands'? (r>.45?B.PEAT:B.CLAY):b==='limestone'?B.LIMESTONE:b==='boreal'?B.MOSS:b==='meadow'?B.HIGHLAND_GRASS:b==='forest'&&r>.7?B.MOSS:B.GRASS;
     if(b==='forest'&&r>.997)id=B.GLOW_MOSS;
    }
   }
   if(id===B.STONE&&hash(wx,y,wz,seed+701)>.987)id=B.ORE;
   chunk.data[(y*SIZE+z)*SIZE+x]=id;
  }
 }
 if(mode!=='flat'&&mode!=='ruins'){
  // Search an expanded region so neighboring chunks receive identical feature pieces.
  for(let wz=oz-5;wz<oz+SIZE+5;wz++)for(let wx=ox-5;wx<ox+SIZE+5;wx++){
   const biome=biomeAt(wx,wz,seed,mode,version),cfg=BIOMES[biome]||BIOMES.plains;if(hash(wx,0,wz,seed+401)>=cfg.tree)continue;
   if(hash(wx,1,wz,seed+402)<.65)continue;
   const h=surfaceAt(wx,wz,seed,mode,version);if(h<=SEA||h>=HEIGHT-9)continue;
   const trunk=4+Math.floor(hash(wx,2,wz,seed)*2);
   function put(ax,ay,az,id,onlyAir=false){const lx=ax-ox,lz=az-oz;if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||ay<0||ay>=HEIGHT)return;const idx=(ay*SIZE+lz)*SIZE+lx;if(!onlyAir||chunk.data[idx]===B.AIR)chunk.data[idx]=id}
   const variant=version>=3&&mode==='normal'?(biome==='boreal'?'cedar':biome==='forest'&&hash(wx,7,wz,seed)>.48?'birch':'oak'):'oak';
   const wood=variant==='cedar'?B.CEDAR_WOOD:variant==='birch'?B.BIRCH_WOOD:B.WOOD;
   const leaves=variant==='cedar'?B.CEDAR_LEAVES:variant==='birch'?B.BIRCH_LEAVES:B.LEAVES;
   for(let y=h+1;y<=h+trunk;y++)put(wx,y,wz,wood);
   for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dz*dz+(dy*.9)**2<=5.7&&hash(wx+dx,dy,wz+dz,seed+9)>.12)put(wx+dx,h+trunk+dy,wz+dz,leaves,true);
  }
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
   const wx=ox+x,wz=oz+z,h=surfaceAt(wx,wz,seed,mode,version),biome=biomeAt(wx,wz,seed,mode,version),top=chunk.get(x,h,z);
   if(h<=SEA||h+1>=HEIGHT||chunk.get(x,h+1,z)!==B.AIR)continue;
   const roll=hash(wx,4,wz,seed);
   if(version>=3&&mode==='normal'){
    let decor=B.AIR;
    if(biome==='wetlands'&&roll>.948)decor=B.REEDS;
    else if(biome==='alpine'&&roll>.968&&top!==B.ICE)decor=B.HEATHER;
    else if(biome==='meadow'&&roll>.957)decor=B.BLUE_FLOWER;
    else if((biome==='forest'||biome==='boreal'||biome==='wetlands')&&roll>.992)decor=B.FIREFLY_GRASS;
    else if((biome==='meadow'||biome==='forest')&&roll>.965)decor=B.FLOWER;
    if(decor!==B.AIR)chunk.set(x,h+1,z,decor);
   }else if(top===B.GRASS&&roll>.975)chunk.set(x,h+1,z,B.FLOWER);
  }
 }
 if(mode==='ruins')stampRuins(chunk,seed);
 chunk.dirty=true;return chunk;
}
export const GENERATORS={normal:'Integrated ridges, canyons, marsh and biomes',flat:'Flat builder world',islands:'Scattered ocean islands',highlands:'Warped ridges, winding canyons and mountains',ruins:'Procedural stacked abandoned buildings'};
