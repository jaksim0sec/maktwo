// Descent V3 · residential precinct around the Korean school.
// Based on the 1990s Bundang superblock pattern: perimeter roads, green buffers,
// separated slab blocks, surface parking and pedestrian school access.
// Reuses the latest eternal-night housing finish, facade and building kit decisions.
import {BLOCK as B} from '../core/blocks.js';
import {encodeSplitTread} from './eternal-night-stairs.js';
import {floorFinish,interiorWallFinish} from './eternal-night-interiors.js';
import {facadeBay} from './eternal-night-facade.js';
import {cityFloorKit,cityPart} from './eternal-night-kits.js';

export const APARTMENT_STOREY=5; // 4 m storey
export const APARTMENT_GROUND=12;
export const APARTMENT_MAX_FLOORS=14;
export const APARTMENT_MAX_Y=APARTMENT_GROUND+APARTMENT_MAX_FLOORS*APARTMENT_STOREY+4;
export const APARTMENT_BLOCKS=Object.freeze([
 {id:101,x:-199,z:-99,floors:12,flip:false,group:'west'},
 {id:102,x:-199,z:19,floors:10,flip:false,vertical:true,group:'west'},
 {id:103,x:181,z:-101,floors:13,flip:true,vertical:true,group:'east'},
 {id:104,x:151,z:21,floors:11,flip:false,group:'east'},
 {id:105,x:-128,z:-197,floors:12,flip:false,group:'north'},
 {id:106,x:34,z:-197,floors:9,flip:false,group:'north'},
 {id:107,x:-136,z:157,floors:11,flip:true,group:'south'},
 {id:108,x:94,z:157,floors:14,flip:true,group:'south'}
].map(p=>Object.freeze({...p,width:48,depth:17})));
const within=(v,a,b)=>v>=a&&v<=b;
const rect=(x,z,a,b,c,d)=>within(x,a,b)&&within(z,c,d);
const mod=(n,d)=>(n%d+d)%d;
const hash=(x,z,seed)=>{let v=Math.imul(x,0x9e3779b1)^Math.imul(z,0x85ebca6b)^Math.imul(seed,0xc2b2ae35);v=Math.imul(v^(v>>>16),0x27d4eb2d);return(v^(v>>>15))>>>0;};
const homeFloor=floorFinish({program:'housing'},{room:{kind:'room'}},0,0,B.ARCH_FLOOR_WOOD);
const galleryFloor=floorFinish({program:'housing'},{corridor:{kind:'open-corridor'}},0,0,B.ARCH_CONCRETE_PEBBLE_PAINT);
const homeWall=interiorWallFinish({program:'housing'},B.CITY_PAINT_WHITE);
const homeKit=cityFloorKit({floor:B.ARCH_FLOOR_WOOD},{program:'housing',luxury:.48},1);
const apartmentDoor=cityPart('door',homeKit.door);
const inside=(p,x,z)=>p.vertical?rect(x,z,p.x,p.x+p.depth-1,p.z,p.z+p.width-1):rect(x,z,p.x,p.x+p.width-1,p.z,p.z+p.depth-1);
export const apartmentAt=(x,z)=>APARTMENT_BLOCKS.find(p=>inside(p,x,z))??null;
const coords=(p,x,z)=>p.vertical?{u:z-p.z,v:p.flip?p.x+p.depth-1-x:x-p.x}:{u:x-p.x,v:p.flip?p.z+p.depth-1-z:z-p.z};
const roofHeight=p=>APARTMENT_GROUND+p.floors*APARTMENT_STOREY;
const outsideWall=(p,u,v,dy,level,seed)=>{
 const variant=hash(p.id,level,seed)&3;
 if(v===0){
  // Independent facade openings follow the newest city housing facade chooser.
  const bay=mod(u-9,5);
  const glass=facadeBay({program:'housing',level,entryLevel:0,edge:0,bay,span:p.width,stride:5}).opening==='window';
  if(u>=9&&dy>=2&&dy<=3&&glass)return B.PART_WINDOW_4;
  if(u>=9&&dy===1&&mod(u-9,8)===2)return B.PART_BALCONY_2;
  return variant&1?B.ARCH_CONCRETE_SMOOTH_PLASTER:B.ARCH_TILE_LARGE_PORCELAIN;
 }
 if(u===0||u===p.width-1){
  // End walls are quiet stucco surfaces with a thin vertical glazed stair strip.
  if(u===0&&within(v,3,5)&&dy>=2&&dy<=3)return B.PART_WINDOW_4;
  if(dy===1)return B.ARCH_CONCRETE_SMOOTH_PLASTER;
  return B.STAINED_PLASTER;
 }
 return null;
};
const stairShape=(u,v)=>{
 if(within(u,1,3)&&within(v,2,6))return {step:v-1,facing:4,rail:u===1};
 if(within(u,6,8)&&within(v,2,6))return {step:12-v,facing:0,rail:u===8};
 if(within(u,1,8)&&within(v,7,8))return {step:5,landing:true};
 return null;
};
const stairVoid=(u,v)=>within(u,1,8)&&within(v,7,8)||
 within(u,1,3)&&within(v,5,6)||within(u,6,8)&&within(v,2,4);
function stairAt(p,u,v,y){
 const shape=stairShape(u,v);if(!shape)return null;
 for(let level=0;level<p.floors-1;level++){
  const base=APARTMENT_GROUND+level*APARTMENT_STOREY;
  const stepY=base+1+Math.floor((shape.step-1)/2);
  if(y===stepY)return shape.landing?B.CONCRETE_SLAB:B.PART_STAIRCASE_2;
  if(y>base&&y<stepY)return B.ARCH_CONCRETE_FORMWORK;
 }
 return null;
}
function stairStyle(p,u,v,y){
 const shape=stairShape(u,v);if(!shape||shape.landing)return null;
 for(let level=0;level<p.floors-1;level++){
  const base=APARTMENT_GROUND+level*APARTMENT_STOREY;
  if(y!==base+1+Math.floor((shape.step-1)/2))continue;
  const low=shape.step%2?1:3;
  return encodeSplitTread(low,low+1,p.vertical?(shape.facing+2)%8:shape.facing,shape.rail);
 }
 return null;
}
function apartmentRoom(p,u,v,dy,level,seed){
 const unit=Math.floor((u-9)/8),inUnit=mod(u-9,8);
 if(v===5&&dy<=3){
  // Living room / rear bedroom divider; the offset gap is the connecting door.
  return inUnit===3||inUnit===4?B.AIR:homeWall;
 }
 if(inUnit===0&&v>=1&&v<=10){
  if(dy===1&&v===5)return B.AIR;
  return homeWall;
 }
 if(inUnit===4&&v<=4&&v>=1){
  if(v===3&&dy<=2)return B.AIR;
  return homeWall;
 }
 if(dy===1){
  if(v===2&&inUnit===2)return B.PART_INTERIOR_2; // dining table
  if(v===3&&inUnit===6)return B.PART_INTERIOR_1; // shelving
  if(v===7&&inUnit===2)return B.PART_INTERIOR_1; // kitchen cabinets
  if(v===9&&inUnit===5)return B.PART_INTERIOR_2; // bedroom
  if(v===10&&inUnit===6)return B.PART_INTERIOR_5; // utility cabinet
 }
 if(dy===3&&v===9&&inUnit===1)return B.PART_INTERIOR_3; // ceiling fixture
 if(dy===2&&v===3&&inUnit===3)return B.PART_PARTITION_4;
 return B.AIR;
}
export function apartmentVoxel(x,y,z,seed=9999,cx=0,cz=0){
 if(y<APARTMENT_GROUND||y>APARTMENT_MAX_Y)return null;
 const p=apartmentAt(x,z);if(!p)return null;
 const {u,v}=coords(p,x,z),roof=roofHeight(p);
 if(y===roof)return B.ARCH_METAL_GALVANIZED;
 if(y===roof+1){
  if(u===0||u===p.width-1||v===0||v===p.depth-1)return B.ARCH_CONCRETE_SMOOTH_PLASTER;
  if(rect(u,v,2,6,4,8))return B.ARCH_METAL_STAINLESS; // elevator motor room
  return B.AIR;
 }
 if(y===roof+2&&rect(u,v,3,5,5,7))return B.ARCH_METAL_STAINLESS;
 if(y>=roof)return B.AIR;
 const level=Math.floor((y-APARTMENT_GROUND)/APARTMENT_STOREY);
 const base=APARTMENT_GROUND+level*APARTMENT_STOREY,dy=y-base;
 const core=u<=8, gallery=v>=12&&v<=15,rail=v===16;
 if(core){
  const tread=stairAt(p,u,v,y);
  if(tread!==null)return tread;
 }
 if(dy===0){
  if(core&&level>0&&stairVoid(u,v))return B.AIR;
  if(core&&v===12&&within(u,2,7))return B.ARCH_STONE_GREY_GRANITE;
  if(gallery||rail)return galleryFloor;
  return homeFloor;
 }
 if(dy===4){
  if(core&&stairVoid(u,v))return B.AIR;
  if(rail)return B.AIR;
  if(gallery)return B.AIR; // outdoor gallery, not an enclosed long office hallway
  return B.CEILING_FINISH;
 }
 if(rail){
  if(dy===1&&!(level===0&&within(u,4,6)))return B.PART_BALCONY_3;
  return B.AIR;
 }
 if(gallery){
  if(dy===3&&mod(u,8)===0&&v===13)return B.FLUORESCENT;
  return B.AIR;
 }
 if(v===11){
  if(core)return within(u,4,6)&&dy<=3?B.AIR:homeWall;
  // Each flat has its own door from the external gallery. No fake doors in windows.
  if(mod(u-9,8)===3)return dy===1?B.DOOR:dy===2?B.DOOR_TOP:B.PART_WINDOW_4;
  if(mod(u-9,8)===2||mod(u-9,8)===4)return dy===3?B.PART_WINDOW_4:homeWall;
  return homeWall;
 }
 const wall=outsideWall(p,u,v,dy,level,seed+cx*11+cz*37);
 if(wall!==null)return wall;
 if(core){
  if(u===8&&v<=10)return homeWall;
  if(dy===1&&u===6&&v===10)return B.PART_SIGN_2; // stair storey sign
  if(dy===3&&u===5&&v===9)return B.FLUORESCENT;
  if(dy===1&&v===1&&u===4)return apartmentDoor; // rated elevator fire door from housing kit
  if(dy===1&&v===1&&u===5)return B.PART_INTERIOR_5; // lifts
  return B.AIR;
 }
 if(dy===3&&u>=9&&mod(u-9,8)===4&&v===8)return B.FLUORESCENT;
 return apartmentRoom(p,u,v,dy,level,seed);
}
export function apartmentPartStyle(x,y,z,id){
 const p=apartmentAt(x,z);if(!p)return null;
 const {u,v}=coords(p,x,z);
 if(id===B.PART_STAIRCASE_2)return stairStyle(p,u,v,y);
 if(id===B.DOOR)return p.vertical?(p.flip?1:3):(p.flip?2:0); // unit entrances face open gallery
 if(id===apartmentDoor)return p.vertical?2:0;
 if(id===B.PART_BALCONY_3||id===B.PART_BALCONY_2)return p.vertical?2:(p.flip?2:0);
 if(id===B.PART_WINDOW_4&&u===0)return p.vertical?0:2;
 if(id===B.PART_WINDOW_4&&v===0)return p.vertical?2:(p.flip?2:0);
 if(id===B.PART_WINDOW_4&&v===11)return p.vertical?2:(p.flip?2:0);
 if(id===B.PART_SIGN_2)return 2;
 return null;
}
// School boundary at ±103 is not touched. Internal streets and parkland are
// evaluated only in the added residential ring, using local district coordinates.
export function neighborhoodVoxel(x,y,z,seed=9999,cx=0,cz=0){
 if(Math.abs(x)<=110&&Math.abs(z)<=110)return null; // preserve original asphalt ring beside the school
 if(y<APARTMENT_GROUND||y>APARTMENT_GROUND+8)return null;
 if(y===APARTMENT_GROUND){
  const ax=Math.abs(x),az=Math.abs(z);
  if(rect(x,z,-18,31,144,200))return rect(x,z,-13,26,149,194)?B.GRASS:B.ARCH_FLOOR_PAVERS;
  // School-to-estate 3 m pedestrian route through the south carriageway.
  if(rect(x,z,43,55,103,154)){
   if(within(z,118,127))return mod(z,3)===0?B.ARCH_TILE_VERTICAL_WHITE:B.ARCH_FLOOR_ASPHALT;
   return B.ARCH_FLOOR_PAVERS;
  }
  // 1st generation Bundang-style complete superblock with a modest grid.
  if(within(ax,116,130)||within(az,116,130)||ax>=206||az>=206)return B.ARCH_FLOOR_ASPHALT;
  if(within(ax,107,115)||within(ax,131,139)||within(az,107,115)||within(az,131,139))return B.ARCH_FLOOR_PAVERS;
  // Street-side parking bays with alternating tree islands.
  if((within(ax,142,148)||within(az,143,150))&&mod(Math.floor((x+z)/7),4)!==0)return B.ARCH_FLOOR_ASPHALT;
  if((within(ax,140,146)||within(az,138,144))&&mod(x+z,9)===0)return B.ARCH_TILE_VERTICAL_WHITE;
  return B.GRASS;
 }
 if(y===13){
  if(rect(x,z,-18,31,144,200)){
   if(rect(x,z,-10,22,151,190)&&((x+z)%27===0||mod(x-z,31)===0))return B.PART_INTERIOR_4;
   if(rect(x,z,-8,7,165,177))return (x===-8||x===7||z===165||z===177)?B.ARCH_STONE_GREY_GRANITE:B.SAND;
  }
  // Repeating bollard/barrier details at the edge of parking lots.
  if(Math.abs(x)===140&&mod(z+217,23)===0)return B.PART_COLUMN_2;
  if(Math.abs(z)===138&&mod(x+217,29)===0)return B.PART_COLUMN_2;
 }
 // Tree-lined internal walkways, but no leaves in the road or school path.
 const nearX=Math.abs(x)===139&&mod(z+190,27)===0;
 const nearZ=Math.abs(z)===139&&mod(x+190,29)===0;
 if(nearX||nearZ){
  if(within(y,13,17))return B.WOOD;
 }
 if(within(y,16,20)){
  const dx=Math.min(Math.abs(x-139),Math.abs(x+139));
  const dz=Math.min(Math.abs(z-139),Math.abs(z+139));
  // Leaf crowns are offset along trees, never over the school's central square.
  if(dx<=2&&mod(z+190,27)<=2&&mod(z+190,27)>=0&&Math.abs(x)>=136&&Math.abs(x)<=142)return B.LEAVES;
  if(dz<=2&&mod(x+190,29)<=2&&Math.abs(z)>=136&&Math.abs(z)<=142)return B.LEAVES;
 }
 return null;
}
