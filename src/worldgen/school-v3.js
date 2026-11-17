// Descent V3: coordinate-stable Korean high school with reusable architecture.
// World scale is 0.8m/voxel; geometry is authored in dimensions, not decoration.
import {SIZE,TURN_STYLE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {encodeSplitTread} from './eternal-night-stairs.js';
import {APARTMENT_MAX_Y,apartmentAt,apartmentVoxel,apartmentPartStyle,neighborhoodVoxel} from './school-apartments.js';
export const SCHOOL_MODE='school-v3';
export const SCHOOL_HEIGHT=96;
export const SCHOOL_GROUND=12;
export const SCHOOL_PERIOD=448;
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
// School interior: matte paint, light wainscoting and terrazzo.
// Exterior red masonry is deliberately a separate surface decision.
const schoolWall=(dy,style=0)=>dy===1?(style&1?B.STATION_TRAIN_ENAMEL:B.ARCH_CONCRETE_PEBBLE_PAINT):B.CITY_PAINT_WHITE;
const schoolCeiling=B.CITY_PAINT_WHITE;
const corridorFloor=(x,z)=>z===-54&&mod(x+60,12)===2?B.ARCH_STONE_PINK_GRANITE:B.ARCH_STONE_TERRAZZO;
const classroomFloor=B.ARCH_STONE_TERRAZZO;
const hallwayWindow=B.PART_WINDOW_4; // slim silver aluminum glazing
function corridorDetails(x,y,z,base){
 const bay=mod(x+60,12);
 if(z===-54&&y===base+3&&bay===4)return B.PART_SIGN_2;
 if(z===-51&&y===base+1&&mod(x+60,24)===11)return B.PART_INTERIOR_1;
 if(z===-51&&y===base+1&&mod(x+60,48)===35)return B.PART_INTERIOR_4;
 return null;
}

// Two U-shaped stair flights, 0.5-voxel risers, a real middle landing.
// First lane climbs north, second returns south to the next-floor hallway.
function stairProfile(x,z){
 const a=Math.abs(x);
 if(a<64||a>72)return null;
 if(within(a,70,72)&&within(z,-59,-55))return {step:-55-z+1};
 if(within(a,64,66)&&within(z,-59,-55))return {step:6+z+59};
 if(within(a,64,72)&&within(z,-61,-60))return {step:5,landing:true};
 return null;
}
const stairVoid=(x,z)=>{
 const a=Math.abs(x);
 return within(a,64,72)&&within(z,-61,-60)||
  within(a,64,66)&&within(z,-59,-55)||
  within(a,70,72)&&within(z,-59,-58);
};
function stairCell(x,y,z){
 const profile=stairProfile(x,z);
 if(!profile)return null;
 for(let level=0;level<STORIES-1;level++){
  const base=SCHOOL_GROUND+level*SCHOOL_STOREY;
  const treadY=base+1+Math.floor((profile.step-1)/2);
  if(y===treadY)return profile.landing?B.CONCRETE_SLAB:B.PART_STAIRCASE_2;
  if(y>base&&y<treadY)return B.ARCH_CONCRETE_FORMWORK;
 }
 return null;
}
function splitStairStyle(x,y,z){
 const profile=stairProfile(x,z);
 if(!profile||profile.landing)return null;
 for(let level=0;level<STORIES-1;level++){
  const base=SCHOOL_GROUND+level*SCHOOL_STOREY;
  if(y!==base+1+Math.floor((profile.step-1)/2))continue;
  // Each voxel contains two risers of 0.25 voxel = 0.2m.
  const low=profile.step%2?1:3,high=low+1;
  const ascendingNorth=profile.step<=5;
  const outerRail=ascendingNorth?Math.abs(x)===72:Math.abs(x)===64;
  return encodeSplitTread(low,high,ascendingNorth?4:0,outerRail);
 }
 return null;
}
function classFurniture(x,y,z,level,base){
 if(y!==base+1)return B.AIR;
 const bay=mod(x+60,12),room=Math.floor((x+60)/12);
 if(level===3&&room===4){ // shared reading room, shelved wall and tables
  if([2,4,6,8,10].includes(bay)&&[-63,-61].includes(z))return B.PART_BOOKSHELF_1;
  if([4,8].includes(bay)&&z===-58)return B.PART_INTERIOR_2;
  return B.AIR;
 }
 if(level===0&&room===2){ // administration room, not another classroom
  if(bay===10&&[-63,-61,-59].includes(z))return B.PART_INTERIOR_1;
  if([3,8].includes(bay)&&[-62,-58].includes(z))return B.PART_INTERIOR_2;
  return B.AIR;
 }
 if(bay===11&&z===-64)return B.PART_INTERIOR_1;
 if(bay===6&&z===-57)return B.PART_INTERIOR_2;
 if([2,4,6,8,10].includes(bay)&&[-63,-62,-61,-60,-59,-58].includes(z))return B.PART_INTERIOR_2;
 return B.AIR;
}
function mainFacade(x,z,dy,level,style){
 const a=Math.abs(x),bay=mod(x+60,12);
 if(a===75&&z===-54&&dy===2)return B.CITY_STAIR_MARKER;
 if(z===-50&&level===0&&a<=3&&dy<=3)return B.AIR;
 if(z===-50&&a>=62&&a<=65&&dy<=3)return B.AIR; // joins side wing corridors
 if(a===75&&within(z,-62,-53)&&dy>=2&&dy<=3&&mod(z+65,5)<3)return hallwayWindow;
 if(z===-65&&a<=60&&within(bay,3,9)&&(dy===2||dy===3))return hallwayWindow;
 if(z===-50&&a<=60&&within(bay,4,8)&&(dy===2||dy===3))return hallwayWindow;
 if(z===-65&&a>60&&within(a,66,71)&&dy>=2&&dy<=3)return hallwayWindow;
 // The corridor-facing facade and stairwells must not display outdoor brick.
 if(z===-50||a===75)return schoolWall(dy,style);
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
  // Photo-referenced yellow tactile warning at each landing entrance.
  if(core&&z===-54&&(within(a,64,66)||within(a,70,72)))return B.STATION_PLATFORM_TACTILE;
  return within(z,-54,-51)?corridorFloor(x,z):classroomFloor;
 }
 if(dy===4){
  if(a===75||z===-65||z===-50)return facade(dy,style);
  return core&&stairVoid(x,z)?B.AIR:schoolCeiling;
 }
 if(a===75||z===-65||z===-50)return mainFacade(x,z,dy,level,style);
 if(dy===3&&((within(z,-54,-51)&&z===-53&&mod(x+3,8)===3)||(a<=60&&z===-60&&mod(x+60,12)===6)))return B.FLUORESCENT;
 if(core){
  if(a===61&&z<=-55)return schoolWall(dy,style);
  if(level>0&&dy===1&&within(z,-61,-55)&&(a===63||a===73))return B.PART_BALCONY_3;
  return B.AIR;
 }
 if(!core){
  const detail=corridorDetails(x,y,z,base);
  if(detail!==null)return detail;
 }
 if(z===-55){
  const bay=mod(x+60,12);
  if(bay===2){
   if(dy===1)return B.DOOR;
   if(dy===2)return B.DOOR_TOP;
   return hallwayWindow;
  }
  if(bay===1||bay===3)return dy<=2?B.ARCH_FLOOR_WOOD:hallwayWindow;
  if(within(bay,5,8)&&dy>=2)return hallwayWindow;
  return schoolWall(dy,style);
 }
 if(z<=-56){
  const bay=mod(x+60,12);
  if(bay===0)return dy===2&&within(z,-62,-59)?B.STATION_ALGAE:schoolWall(dy,style);
  return classFurniture(x,y,z,level,base);
 }
 return B.AIR;
}
function wingFacade(a,z,dy,style){
 const bay=mod(z+49,12);
 if(a===78&&within(bay,3,9)&&(dy===2||dy===3))return hallwayWindow;
 if(a===61&&within(bay,4,6)&&(dy===2||dy===3))return hallwayWindow;
 return a===61?schoolWall(dy,style):facade(dy,style);
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
 const restroom=west&&level===0&&within(z,5,16);
 const library=west&&level===2&&within(z,-14,-3);
 const office=east&&level===0&&within(z,-25,-14);
 if(dy===0&&restroom&&!corridor)return B.ARCH_TILE_VERTICAL_WHITE;
 if(dy===0)return corridor?B.ARCH_STONE_TERRAZZO:classroomFloor;
 if(dy===4){
  if(a===61||a===78||z===-49||z===end)return facade(dy,style);
  return schoolCeiling;
 }
 if(dy===3&&corridor&&a===63&&mod(z+49,8)===4)return B.FLUORESCENT;
 if(dy===3&&!corridor&&a===72&&bay===6)return B.FLUORESCENT;
 if(z===-49){
  if(corridor&&dy<=3)return B.AIR;
  return schoolWall(dy,style);
 }
 if(z===end)return dy===2&&within(a,68,73)?hallwayWindow:facade(dy,style);
 if(a===61){
  if(level===0&&west&&within(z,6,8)&&dy<=2)return B.AIR;
  return wingFacade(a,z,dy,style);
 }
 if(a===78)return wingFacade(a,z,dy,style);
 if(dy===3&&corridor&&a===65&&bay===3)return B.PART_SIGN_2; // mounted beside classroom wall
 if(dy===1&&corridor&&a===63&&mod(z+49,24)===11)return B.PART_INTERIOR_1;
 if(a===66){
  if(bay===2){
   if(dy===1)return B.DOOR;
   if(dy===2)return B.DOOR_TOP;
   return hallwayWindow;
  }
  if(bay===1||bay===3)return dy<=2?B.ARCH_FLOOR_WOOD:hallwayWindow;
  if(within(bay,5,8)&&dy>=2)return hallwayWindow;
  return schoolWall(dy,style);
 }
 if(corridor)return B.AIR;
 if(bay===0)return schoolWall(dy,style);
 if(restroom){
  if(dy<=2&&(bay===8||bay===10)&&within(a,69,74))return B.PART_PARTITION_2;
  if(dy===1&&a===76&&(bay===7||bay===9))return B.PART_INTERIOR_5;
  return B.AIR;
 }
 if(library){
  if(dy===1&&a===75&&[2,4,6,8].includes(bay))return B.PART_BOOKSHELF_1;
  if(dy===1&&[68,71].includes(a)&&[3,7].includes(bay))return B.PART_INTERIOR_2;
  return B.AIR;
 }
 if(office){
  if(dy===1&&a===77&&bay===10)return B.PART_INTERIOR_1;
  if(dy===1&&[68,72,75].includes(a)&&[4,8].includes(bay))return B.PART_INTERIOR_2;
  return B.AIR;
 }
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
 if(within(y,13,16)&&Math.abs(x)===6&&z===-46)return B.PART_COLUMN_2;
 if(y===16&&x===0&&z===-46)return B.FLUORESCENT;
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
function schoolFrontCanopy(x,y,z){
 if(!rect(x,z,-56,56,-42,-36))return null;
 if(y===17)return z===-36||Math.abs(x)===56?B.ARCH_METAL_BLACK_PAINT:B.ARCH_METAL_GALVANIZED;
 if(y===16&&mod(x,14)===0&&Math.abs(x)>=14&&z===-38)return B.FLUORESCENT;
 if(within(y,13,16)&&mod(x,14)===0&&Math.abs(x)>=14&&z===-37)return B.PART_COLUMN_4;
 return null;
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
 if(y===13&&within(x,-50,50)&&Math.abs(x)>=10&&z===-36&&mod(x,5)<4)return B.LEAVES;
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
 const canopy=schoolFrontCanopy(x,y,z);if(canopy!==null)return canopy;
 const gym=schoolGym(x,y,z,style);if(gym!==null)return gym;
 const home=apartmentVoxel(x,y,z,seed,cx,cz);if(home!==null)return home;
 const neighborhood=neighborhoodVoxel(x,y,z,seed,cx,cz);if(neighborhood!==null)return neighborhood;
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
 if(apartmentAt(x,z))return null;
 if(id===B.PART_SIGN_2)return Math.abs(x)===65?2:0;
 if(id===B.DOOR)return Math.abs(x)===66?(x<0?1:3):2;
 if(id===B.PART_BALCONY_3)return 2;
 if(id!==B.PART_WINDOW_1&&id!==B.PART_WINDOW_2&&id!==B.PART_WINDOW_3&&id!==B.PART_WINDOW_4)return null;
 const a=Math.abs(x),inWing=westWing(x,z)||eastWing(x,z);
 if(inWing&&(a===61||a===66||a===78))return 2;
 if(a===75&&z>-65&&z<-50)return 2;
 if(hallFootprint(x,z)&&(a===80||a===104))return 2;
 if(entryFootprint(x,z)&&a===8)return 2;
 return null; // windows mounted on the north/south facades face z
}
export function stampSchoolChunk(chunk,seed=SCHOOL_SEED){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE,height=Math.min(chunk.height,APARTMENT_MAX_Y+1);
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z,local=schoolDistrict(wx,wz);
  for(let y=0;y<height;y++){
   const id=schoolVoxel(wx,y,wz,seed);
   if(id===B.AIR)continue;
   chunk.set(x,y,z,id);
   let style=id===B.PART_STAIRCASE_2?splitStairStyle(local.x,y,local.z):schoolPartFacing(local.x,local.z,id);
   if(style===null)style=apartmentPartStyle(local.x,y,local.z,id);
   if(style!==null){
    chunk.styles??=new Uint8Array(chunk.data.length);
    chunk.styles[(y*SIZE+z)*SIZE+x]=id===B.PART_STAIRCASE_2?style:TURN_STYLE|style;
   }
  }
 }
 chunk.dirty=true;return chunk;
}
