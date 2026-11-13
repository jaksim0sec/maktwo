import {SIZE,HEIGHT} from '../core/chunk.js';
import {integratedTerrain} from './integrated.js';
import {stampArchitectureV3} from './architecture-v3.js';
import {stampMaterialGallery} from './material-gallery.js';
import {stampPartGallery} from './part-gallery.js';
import {STATION_PREVIEW_MODE,stampStationPreview} from './station-preview.js';
import {ARBORETUM_MODE,stampArboretum} from './trees.js';
import {CITY_MODE,CITY_BASE_Y,stampCityChunk} from './eternal-night-game.js';
import {BLOCK as B} from '../core/blocks.js';import {fbm,hash,clamp} from '../util/math.js';
export const SEA=17, GENERATION_VERSION=5;
export const BIOMES={plains:{tree:.012},forest:{tree:.075},desert:{tree:0},mountains:{tree:.008},marsh:{tree:.02},alpine:{tree:.004},volcanic:{tree:0},badlands:{tree:0},wetlands:{tree:.032},boreal:{tree:.047},meadow:{tree:.014},limestone:{tree:.004}};
const isStudioMode=mode=>mode==='materials'||mode==='parts';
function terrainAt(x,z,seed,mode){
 if(mode===CITY_MODE)return {height:CITY_BASE_Y-1,biome:'plains'};
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
const DEFAULT_MATERIAL={soil:B.DIRT,surface:()=>B.GRASS};
const BIOME_MATERIALS={
 desert:{soil:B.SAND,surface:()=>B.SAND},
 volcanic:{soil:B.BASALT,surface:()=>B.BASALT,rock:[.22,B.SLATE,B.BASALT]},
 limestone:{soil:B.LIMESTONE,surface:()=>B.LIMESTONE,rock:[.34,B.MARBLE,B.LIMESTONE]},
 badlands:{soil:B.TERRACOTTA,surface:()=>B.RED_SAND,rock:[.55,B.SHALE,B.TERRACOTTA]},
 alpine:{soil:B.ALPINE_SOIL,surface:r=>r>.85?B.ICE:B.SNOW,rock:[.39,B.SLATE,B.GRANITE]},
 mountains:{soil:B.DIRT,surface:()=>B.GRASS,rock:[.72,null,B.BASALT]},
 wetlands:{soil:B.CLAY,surface:r=>r>.45?B.PEAT:B.CLAY,peat:true},
 boreal:{soil:B.ALPINE_SOIL,surface:()=>B.MOSS},
 meadow:{soil:B.DIRT,surface:()=>B.HIGHLAND_GRASS},
 forest:{soil:B.DIRT,surface:r=>r>.7?B.MOSS:B.GRASS}
};
export function generateChunk(chunk,seed,mode='normal',cityBlueprints=true){
 if(mode===CITY_MODE)return stampCityChunk(chunk,seed,cityBlueprints);
 if(mode===STATION_PREVIEW_MODE)return stampStationPreview(chunk,seed);
 if(mode===ARBORETUM_MODE)return stampArboretum(chunk,seed);
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE, profiles=new Array(SIZE*SIZE);
 const studio=isStudioMode(mode),detail=mode!=='flat'&&!studio;
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,profile=terrainAt(wx,wz,seed,mode);
  profiles[z*SIZE+x]=profile;
  const {height:h,biome:b}=profile,material=BIOME_MATERIALS[b]??DEFAULT_MATERIAL;
  for(let y=0;y<HEIGHT;y++){
   let id=B.AIR;if(y===0)id=B.BEDROCK;else if(y<h-4)id=B.STONE;else if(y<h)id=material.soil;else if(y===h)id=studio?B.CONCRETE:b==='desert'?B.SAND:B.GRASS;else if(y<=SEA)id=B.WATER;
   if(detail&&y>5&&y<h-4&&y<36&&fbm(wx*.085+y*.017,wz*.085-y*.01,seed+y*31,2)>.48)id=B.AIR;
   if(detail&&id!==B.BEDROCK&&id!==B.AIR&&id!==B.WATER){
    const geology=hash(Math.floor(wx/6),Math.floor(y/5),Math.floor(wz/6),seed+850);
    const r=hash(wx,y,wz,seed+862);
    if(y<h-4){
     const rock=material.rock;
     if(rock&&geology>rock[0])id=rock[2];
     else if(rock&&rock[1]!==null)id=rock[1];
     else id=geology>.83?B.SHALE:geology<.18?B.SLATE:B.STONE;
     if(r>.997)id=B.QUARTZ;
    }else if(y<h){
     id=material.soil;
     if(material.peat&&geology>.65)id=B.PEAT;
    }else if(y===h){
     id=material.surface(r);
     if(b==='forest'&&r>.997)id=B.GLOW_MOSS;
    }
   }
   if(id===B.STONE&&hash(wx,y,wz,seed+701)>.987)id=B.ORE;
   chunk.data[(y*SIZE+z)*SIZE+x]=id;
  }
 }
 if(detail&&mode!=='ruins'){
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
 else if(mode==='parts')stampPartGallery(chunk);
 chunk.dirty=true;return chunk;
}
export const GENERATORS={materials:'Architectural material gallery',parts:'Isolated architectural components',normal:'Integrated ridges, canyons, marsh and biomes',flat:'Flat builder world',islands:'Scattered ocean islands',highlands:'Warped ridges, winding canyons and mountains',ruins:'Procedural stacked abandoned buildings'};
