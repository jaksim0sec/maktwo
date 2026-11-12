import {SIZE,HEIGHT} from '../core/chunk.js';
import {integratedTerrain} from './integrated.js';
import {stampArchitectureV3} from './architecture-v3.js';
import {stampMaterialGallery} from './material-gallery.js';
import {stampComponentBuilding} from './architectural-components.js';
import {BLOCK as B} from '../core/blocks.js';import {fbm,hash,clamp} from '../util/math.js';
export const SEA=17, GENERATION_VERSION=5;
export const BIOMES={plains:{tree:.012},forest:{tree:.075},desert:{tree:0},mountains:{tree:.008},marsh:{tree:.02},alpine:{tree:.004},volcanic:{tree:0},badlands:{tree:0},wetlands:{tree:.032},boreal:{tree:.047},meadow:{tree:.014},limestone:{tree:.004}};
const isStudioMode=mode=>mode==='materials'||mode.startsWith('building:');
function terrainAt(x,z,seed,mode){
 if(mode==='flat'||isStudioMode(mode))return {height:22,biome:'plains'};
 const profile=integratedTerrain(x,z,seed);
 if(mode==='islands'){
  const envelope=clamp((180-Math.hypot(x,z))/65,0,1);
  profile.height=Math.round(SEA-4+(profile.height-SEA+4)*envelope);
 }
 return profile;
}
export const biomeAt=(x,z,seed,mode='normal')=>terrainAt(x,z,seed,mode).biome;
export const surfaceAt=(x,z,seed,mode='normal')=>terrainAt(x,z,seed,mode).height;
// Stable world-coordinate passes: features can cross chunk boundaries without load-order dependence.
const MAX_TREE_CHANCE=Math.max(...Object.values(BIOMES).map(biome=>biome.tree));
export function generateChunk(chunk,seed,mode='normal'){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE, profiles=new Array(SIZE*SIZE);
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,profile=terrainAt(wx,wz,seed,mode);
  profiles[z*SIZE+x]=profile;
  const {height:h,biome:b}=profile;
  for(let y=0;y<HEIGHT;y++){
   let id=B.AIR;if(y===0)id=B.BEDROCK;else if(y<h-4)id=B.STONE;else if(y<h)id=b==='desert'?B.SAND:B.DIRT;else if(y===h)id=isStudioMode(mode)?B.CONCRETE:b==='desert'?B.SAND:B.GRASS;else if(y<=SEA)id=B.WATER;
   if(mode!=='flat'&&!isStudioMode(mode)&&y>5&&y<h-4&&y<36&&fbm(wx*.085+y*.017,wz*.085-y*.01,seed+y*31,2)>.48)id=B.AIR;
   if(mode!=='flat'&&!isStudioMode(mode)&&id!==B.BEDROCK&&id!==B.AIR&&id!==B.WATER){
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
 if(mode!=='flat'&&mode!=='ruins'&&!isStudioMode(mode)){
  // Search an expanded region so neighboring chunks receive identical feature pieces.
  for(let wz=oz-5;wz<oz+SIZE+5;wz++)for(let wx=ox-5;wx<ox+SIZE+5;wx++){
   const roll=hash(wx,0,wz,seed+401);
   if(roll>=MAX_TREE_CHANCE||hash(wx,1,wz,seed+402)<.65)continue;
   const x=wx-ox,z=wz-oz;
   const {height:h,biome}=x>=0&&x<SIZE&&z>=0&&z<SIZE?profiles[z*SIZE+x]:terrainAt(wx,wz,seed,mode);
   if(roll>=BIOMES[biome].tree)continue;
   if(h<=SEA||h>=HEIGHT-9)continue;
   const trunk=4+Math.floor(hash(wx,2,wz,seed)*2);
   function put(ax,ay,az,id,onlyAir=false){const lx=ax-ox,lz=az-oz;if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||ay<0||ay>=HEIGHT)return;const idx=(ay*SIZE+lz)*SIZE+lx;if(!onlyAir||chunk.data[idx]===B.AIR)chunk.data[idx]=id}
   const variant=biome==='boreal'?'cedar':biome==='forest'&&hash(wx,7,wz,seed)>.48?'birch':'oak';
   const wood=variant==='cedar'?B.CEDAR_WOOD:variant==='birch'?B.BIRCH_WOOD:B.WOOD;
   const leaves=variant==='cedar'?B.CEDAR_LEAVES:variant==='birch'?B.BIRCH_LEAVES:B.LEAVES;
   for(let y=h+1;y<=h+trunk;y++)put(wx,y,wz,wood);
   for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)if(dx*dx+dz*dz+(dy*.9)**2<=5.7&&hash(wx+dx,dy,wz+dz,seed+9)>.12)put(wx+dx,h+trunk+dy,wz+dz,leaves,true);
  }
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
   const wx=ox+x,wz=oz+z,{height:h,biome}=profiles[z*SIZE+x],top=chunk.get(x,h,z);
   if(h<=SEA||h+1>=HEIGHT||chunk.get(x,h+1,z)!==B.AIR)continue;
   const roll=hash(wx,4,wz,seed);
   let decor=B.AIR;
   if(biome==='wetlands'&&roll>.948)decor=B.REEDS;
   else if(biome==='alpine'&&roll>.968&&top!==B.ICE)decor=B.HEATHER;
   else if(biome==='meadow'&&roll>.957)decor=B.BLUE_FLOWER;
   else if((biome==='forest'||biome==='boreal'||biome==='wetlands')&&roll>.992)decor=B.FIREFLY_GRASS;
   else if((biome==='meadow'||biome==='forest')&&roll>.965)decor=B.FLOWER;
   if(decor!==B.AIR)chunk.set(x,h+1,z,decor);
  }
 }
 if(mode==='ruins')stampArchitectureV3(chunk,seed);
 else if(mode==='materials')stampMaterialGallery(chunk);
 else if(mode.startsWith('building:'))stampComponentBuilding(chunk,seed,mode.slice('building:'.length));
 chunk.dirty=true;return chunk;
}
export const GENERATORS={materials:'Architectural material gallery',normal:'Integrated ridges, canyons, marsh and biomes',flat:'Flat builder world',islands:'Scattered ocean islands',highlands:'Warped ridges, winding canyons and mountains',ruins:'Procedural stacked abandoned buildings'};
