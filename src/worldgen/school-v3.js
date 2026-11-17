// Descent V3: coordinate-stable Korean high school with reusable architecture.
// World scale is 0.8m/voxel; geometry is authored in dimensions, not decoration.
import {SIZE,TURN_STYLE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
export const SCHOOL_MODE='school-v3';
export const SCHOOL_HEIGHT=64;
export const SCHOOL_GROUND=12;
export const SCHOOL_PERIOD=224;
export const SCHOOL_SEED=9999;
export const SCHOOL_STOREY=5; // 4.0m, four above-ground floors
const STORIES=4,HALF=SCHOOL_PERIOD/2;
const within=(n,a,b)=>n>=a&&n<=b;
const rect=(x,z,x0,x1,z0,z1)=>within(x,x0,x1)&&within(z,z0,z1);
const mod=(v,d)=>(v%d+d)%d;
const hash=(x,z,seed,salt=0)=>{
 let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041)^salt;
 n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;
};
export const schoolStyle=(seed,campusX=0,campusZ=0)=>hash(campusX,campusZ,seed,0x5ab17)%4;
export const schoolSpawn=()=>({x:.5,y:SCHOOL_GROUND+1,z:-30.5,yaw:0});
export function schoolDistrict(x,z){
 const cx=Math.floor((x+HALF)/SCHOOL_PERIOD),cz=Math.floor((z+HALF)/SCHOOL_PERIOD);
 return {cx,cz,x:x-cx*SCHOOL_PERIOD,z:z-cz*SCHOOL_PERIOD};
}
const mainFootprint=(x,z)=>rect(x,z,-75,75,-65,-50);
const westWing=(x,z)=>rect(x,z,-78,-61,-49,16);
const eastWing=(x,z)=>rect(x,z,61,78,-49,-14);
const hallFootprint=(x,z)=>rect(x,z,80,104,-10,50);
const entryFootprint=(x,z)=>rect(x,z,-8,8,-49,-43);
const outsideBrick=style=>(style&1)?B.ARCH_BRICK_RENDERED:B.ARCH_BRICK_RED;
const facade=(dy,style)=>dy===1||dy===4?B.ARCH_TILE_LARGE_PORCELAIN:outsideBrick(style);
const plaster=B.ARCH_CONCRETE_SMOOTH_PLASTER;
const corridorFloor=(x,z)=>mod(x,14)===0&&z===-52?B.ARCH_STONE_PINK_GRANITE:
 z===-54||z===-51?B.ARCH_STONE_PINK_GRANITE:B.ARCH_TILE_LARGE_PORCELAIN;

// Two U-shaped stair flights, 0.5-voxel risers, a real middle landing.
// First lane climbs north, second returns south to the next-floor hallway.
function stairProfile(x,z){
 const a=Math.abs(x);
 if(a<64||a>72)return null;
 if(within(a,70,72)&&within(z,-59,-55))return {step:-55-z+1};
 if(within(a,64,66)&&within(z,-59,-55))return {step:6+z+59};
 if(within(a,64,72)&&within(z,-61,-60))return {step:5};
 return null;
}
const stairVoid=(x,z)=>within(Math.abs(x),64,72)&&within(z,-61,-55);
function stairCell(x,y,z){
 const profile=stairProfile(x,z);
 if(!profile)return null;
 for(let level=0;level<STORIES-1;level++){
  const base=SCHOOL_GROUND+level*SCHOOL_STOREY,top=base+1+profile.step*.5;
  const treadY=Math.ceil(top)-1;
  if(y===treadY)return Number.isInteger(top)?B.UPPER_STAIR_TREAD:B.CONCRETE_SLAB;
  if(y>base&&y<treadY)return B.ARCH_CONCRETE_FORMWORK;
 }
 return null;
}
function classFurniture(x,y,z,base){
 if(y!==base+1)return B.AIR;
 const bay=mod(x+60,12);
 if(bay===11&&z===-64)return B.PART_INTERIOR_1; // locker/storage
 if(bay===10&&z===-64)return B.PART_INTERIOR_2; // teacher's desk
 if([2,4,6,8,10].includes(bay)&&[-63,-61,-59,-57].includes(z))
  return B.PART_INTERIOR_2;
 return B.AIR;
}
function mainFacade(x,z,dy,level,style){
 const a=Math.abs(x),bay=mod(x+60,12);
 if(z===-50&&level===0&&a<=3&&dy<=3)return B.AIR;
 if(z===-50&&a>=62&&a<=65&&dy<=3)return B.AIR; // joins side wing corridors
 if(a===75&&within(z,-62,-53)&&dy>=1&&dy<=3&&mod(z+65,5)<3)return B.PART_WINDOW_3;
 if(z===-65&&a<=60&&within(bay,3,9)&&(dy===2||dy===3))return B.PART_WINDOW_1;
 if(z===-50&&a<=60&&within(bay,4,8)&&(dy===2||dy===3))return B.PART_WINDOW_2;
 if(z===-65&&a>60&&within(a,66,71)&&dy>=2&&dy<=3)return B.PART_WINDOW_3;
 return facade(dy,style);
}
function schoolMain(x,y,z,style){
 if(!mainFootprint(x,z)||y<SCHOOL_GROUND||y>SCHOOL_GROUND+STORIES*SCHOOL_STOREY+1)return null;
 const roof=SCHOOL_GROUND+STORIES*SCHOOL_STOREY;
 if(y===roof)return B.ARCH_METAL_GALVANIZED;
 if(y===roof+1)return Math.abs(x)===75||z===-65||z===-50?plaster:B.AIR;
 const level=Math.floor((y-SCHOOL_GROUND)/SCHOOL_STOREY);
 const base=SCHOOL_GROUND+level*SCHOOL_STOREY,dy=y-base,a=Math.abs(x),core=a>=61;
 if(core){const tread=stairCell(x,y,z);if(tread!==null)return tread;}
 if(dy===0){
  if(core&&level>0&&stairVoid(x,z))return B.AIR;
  return within(z,-54,-51)?corridorFloor(x,z):B.ARCH_FLOOR_LINOLEUM;
 }
 if(dy===4){
  if(core&&stairVoid(x,z))return B.AIR;
  const lit=within(z,-54,-51)&&z===-52&&mod(x,9)===0||
    a<=60&&z===-60&&mod(x+60,12)===6;
  return lit?B.FLUORESCENT:B.CEILING_FINISH;
 }
 if(a===75||z===-65||z===-50)return mainFacade(x,z,dy,level,style);
 if(core){
  if(a===61&&z<=-55)return plaster;
  if(level>0&&dy===1&&within(z,-61,-55)&&(a===63||a===73))return B.FENCE;
  return B.AIR;
 }
 if(z===-55){
  const bay=mod(x+60,12);
  if(within(bay,2,3)&&dy<=2)return B.AIR; // two-cell classroom doorway
  if(within(bay,2,3)&&dy===3)return B.PART_WINDOW_2;
  if(within(bay,6,8)&&dy===2)return B.PART_WINDOW_2;
  return plaster;
 }
 if(z<=-56){
  const bay=mod(x+60,12);
  if(bay===0)return dy===2&&within(z,-62,-59)?B.ARCH_METAL_BLACK_PAINT:plaster;
  return classFurniture(x,y,z,base);
 }
 return B.AIR;
}
function wingFacade(a,z,dy,style){
 const bay=mod(z+49,12);
 if(a===78&&within(bay,3,9)&&(dy===2||dy===3))return B.PART_WINDOW_1;
 if(a===61&&within(bay,4,6)&&(dy===2||dy===3))return B.PART_WINDOW_2;
 return facade(dy,style);
}
function schoolWing(x,y,z,style){
 const west=westWing(x,z),east=eastWing(x,z);
 if(!west&&!east||y<SCHOOL_GROUND||y>SCHOOL_GROUND+STORIES*SCHOOL_STOREY+1)return null;
 const roof=SCHOOL_GROUND+STORIES*SCHOOL_STOREY,a=Math.abs(x),end=west?16:-14;
 if(y===roof)return B.ARCH_METAL_GALVANIZED;
 if(y===roof+1)return a===61||a===78||z===-49||z===end?plaster:B.AIR;
 const level=Math.floor((y-SCHOOL_GROUND)/SCHOOL_STOREY);
 const base=SCHOOL_GROUND+level*SCHOOL_STOREY,dy=y-base;
 const corridor=within(a,62,65),bay=mod(z+49,12);
 if(dy===0)return corridor?B.ARCH_TILE_LARGE_PORCELAIN:B.ARCH_FLOOR_LINOLEUM;
 if(dy===4)return corridor&&a===63&&mod(z+49,8)===4?B.FLUORESCENT:B.CEILING_FINISH;
 if(z===-49){
  if(corridor&&dy<=3)return B.AIR;
  return facade(dy,style);
 }
 if(z===end)return dy===2&&within(a,68,73)?B.PART_WINDOW_1:facade(dy,style);
 if(a===61){
  if(level===0&&west&&within(z,6,8)&&dy<=2)return B.AIR;
  return wingFacade(a,z,dy,style);
 }
 if(a===78)return wingFacade(a,z,dy,style);
 if(a===66){
  if(within(bay,2,3)&&dy<=2)return B.AIR;
  if(within(bay,2,3)&&dy===3)return B.PART_WINDOW_2;
  return plaster;
 }
 if(corridor)return B.AIR;
 if(bay===0)return plaster;
 if(dy===1){
  if(a===77&&bay===10)return B.PART_INTERIOR_1;
  if([68,70,72,74].includes(a)&&[2,4,6,8,10].includes(bay))
   return B.PART_INTERIOR_2;
 }
 return B.AIR;
}
function schoolEntrance(x,y,z){
 if(!entryFootprint(x,z)&&!rect(x,z,-10,10,-42,-37))return null;
 if(y===SCHOOL_GROUND&&entryFootprint(x,z))return B.ARCH_STONE_GREY_GRANITE;
 if(y===18&&rect(x,z,-10,10,-43,-37))return B.ARCH_METAL_GALVANIZED;
 if(y===17&&entryFootprint(x,z))return B.ARCH_METAL_GALVANIZED;
 if(y<13||y>17)return null;
 if((x===-10||x===10)&&z===-38&&y<=17)return B.ARCH_METAL_STAINLESS;
 if(!entryFootprint(x,z))return null;
 if(Math.abs(x)===8)return within(y,14,15)?B.PART_WINDOW_3:plaster;
 if(z===-43){
  if(Math.abs(x)<=2&&y<=15)return B.AIR;
  if(within(Math.abs(x),3,6)&&within(y,14,15))return B.PART_WINDOW_3;
  return plaster;
 }
 return B.AIR;
}
function schoolGym(x,y,z,style){
 if(!hallFootprint(x,z)||y<SCHOOL_GROUND||y>26)return null;
 if(y===SCHOOL_GROUND){
  if(x===84||x===100||z===-5||z===45||x===92&&within(z,-5,45))return B.WARNING_STRIPE;
  return B.ARCH_FLOOR_WOOD;
 }
 if(y===25)return B.ARCH_METAL_GALVANIZED;
 if(y===26)return x===80||x===104||z===-10||z===50?B.ARCH_METAL_BLACK_PAINT:B.AIR;
 if(x===80||x===104||z===-10||z===50){
  if(x===80&&within(z,-3,0)&&y<=15)return B.AIR;
  if(within(y,18,21)&&(within(x,83,101)&&mod(x,7)<5||
    within(z,-7,47)&&mod(z+10,9)<6))return x===80||x===104?B.PART_WINDOW_3:B.PART_WINDOW_1;
  return facade(y-SCHOOL_GROUND,style);
 }
 if(x>=100&&z>=9&&mod(z,3)!==0&&y<=12+Math.min(3,x-99))
  return y===12+Math.min(3,x-99)?B.WOOD_SLAB:B.CONCRETE;
 if(y===24&&within(x,86,98)&&mod(z+10,10)===5)return B.FLUORESCENT;
 return B.AIR;
}
function surface(x,z){
 if(Math.abs(x)>=106||Math.abs(z)>=106)return B.ARCH_FLOOR_ASPHALT;
 if(rect(x,z,49,58,-34,104)||rect(x,z,-6,58,-31,-24))return B.ARCH_FLOOR_PAVERS;
 if(rect(x,z,-6,6,-43,-24))return B.ARCH_FLOOR_PAVERS;
 if(rect(x,z,-59,59,-39,2))return B.ARCH_FLOOR_PAVERS;
 if(rect(x,z,-55,51,5,89)){
  if(rect(x,z,-48,44,12,82)){
   const lines=x===-48||x===44||z===12||z===82||x===-2&&within(z,12,82);
   return lines?B.ARCH_TILE_VERTICAL_WHITE:B.GRASS;
  }
  return B.TERRACOTTA;
 }
 if(rect(x,z,-79,-58,17,30)||rect(x,z,58,78,-13,8))return B.ARCH_FLOOR_PAVERS;
 return B.GRASS;
}
function plants(x,y,z,seed,cx,cz){
 const trunks=[[-93,-81],[-94,-13],[-92,50],[-83,93],[-12,96],[30,96],[87,83],[97,65],[-95,-97]];
 for(let i=0;i<trunks.length;i++){
  const [tx,tz]=trunks[i],height=3+(hash(i,0,seed,cx*31+cz*149)%2);
  if(x===tx&&z===tz&&within(y,13,12+height))return B.WOOD;
  const dx=x-tx,dz=z-tz,dy=y-(12+height);
  if(within(y,12+height-1,12+height+2)&&dx*dx+dz*dz+(dy*.8)**2<=10&&hash(x,z,seed,y+i)%13!==0)return B.LEAVES;
 }
 if(y===13&&within(x,-50,50)&&z===-36&&mod(x,5)<4)return B.LEAVES;
 return null;
}
export function schoolVoxel(wx,y,wz,seed=SCHOOL_SEED){
 if(y<0||y>=SCHOOL_HEIGHT)return B.AIR;
 if(y===0)return B.BEDROCK;
 if(y<SCHOOL_GROUND-1)return B.STONE;
 if(y===SCHOOL_GROUND-1)return B.DIRT;
 const {cx,cz,x,z}=schoolDistrict(wx,wz),style=schoolStyle(seed,cx,cz);
 const main=schoolMain(x,y,z,style);if(main!==null)return main;
 const wing=schoolWing(x,y,z,style);if(wing!==null)return wing;
 const entry=schoolEntrance(x,y,z);if(entry!==null)return entry;
 const gym=schoolGym(x,y,z,style);if(gym!==null)return gym;
 if(y===SCHOOL_GROUND)return surface(x,z);
 if(y===13&&(Math.abs(x)===103||Math.abs(z)===103)){
  if(z===103&&within(x,43,55))return B.AIR;
  if(x===103&&within(z,-25,-18))return B.AIR;
  return B.FENCE;
 }
 if(y===14&&z===103&&(x===42||x===56))return B.PART_SIGN_1;
 if(within(y,13,20)){const plant=plants(x,y,z,seed,cx,cz);if(plant!==null)return plant;}
 return B.AIR;
}
function schoolPartFacing(x,z,id){
 if(id!==B.PART_WINDOW_1&&id!==B.PART_WINDOW_2&&id!==B.PART_WINDOW_3)return null;
 if(Math.abs(x)===78||Math.abs(x)===75||Math.abs(x)===61||Math.abs(x)===66)return 2;
 return null;
}
export function stampSchoolChunk(chunk,seed=SCHOOL_SEED){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE,height=Math.min(chunk.height,SCHOOL_HEIGHT);
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,local=schoolDistrict(wx,wz);
  for(let y=0;y<height;y++){
   const id=schoolVoxel(wx,y,wz,seed);
   if(id===B.AIR)continue;
   chunk.set(x,y,z,id);
   const facing=schoolPartFacing(local.x,local.z,id);
   if(facing!==null){
    chunk.styles??=new Uint8Array(chunk.data.length);
    chunk.styles[(y*SIZE+z)*SIZE+x]=TURN_STYLE|facing;
   }
  }
 }
 chunk.dirty=true;return chunk;
}
