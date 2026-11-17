// Descent V3: deterministic Korean school campuses, generated directly from
// world coordinates. No neighboring chunk, save, or global plan is consulted.
import {SIZE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';

export const SCHOOL_MODE='school-v3';
export const SCHOOL_HEIGHT=64;
export const SCHOOL_GROUND=12;
export const SCHOOL_PERIOD=224;
export const SCHOOL_SEED=9999;
const STOREY=7, STORIES=4, HALF=SCHOOL_PERIOD/2;
const within=(n,a,b)=>n>=a&&n<=b;
const rect=(x,z,x0,x1,z0,z1)=>within(x,x0,x1)&&within(z,z0,z1);
const mod=(v,d)=>(v%d+d)%d;
const hash=(x,z,seed,salt=0)=>{
 let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041)^salt;
 n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;
};
export const schoolStyle=(seed,campusX=0,campusZ=0)=>hash(campusX,campusZ,seed,0x5ab17)%4;
export const schoolSpawn=()=>({x:.5,y:SCHOOL_GROUND+1,z:-30.5,yaw:0});
export function schoolDistrict(x,z){
 const cx=Math.floor((x+HALF)/SCHOOL_PERIOD),cz=Math.floor((z+HALF)/SCHOOL_PERIOD);
 return {cx,cz,x:x-cx*SCHOOL_PERIOD,z:z-cz*SCHOOL_PERIOD};
}
const stairLane=(x,z,level)=>{
 if(level<0||level>=STORIES-1||!within(z,-58,-45))return false;
 const even=level%2===0;
 return (within(x,even?-77:-71,even?-74:-68)||within(x,even?74:68,even?77:71));
};
function stairCell(x,y,z){
 for(let l=0;l<STORIES-1;l++){
  if(!stairLane(x,z,l))continue;
  const step=z+58;
  const base=SCHOOL_GROUND+l*STOREY;
  const treadY=base+1+Math.floor(step/2);
  if(y===treadY)return step%2?B.UPPER_STAIR_TREAD:B.CONCRETE_SLAB;
  // Landings and treads need an actual solid underside instead of free-floating slabs.
  if(y>base&&y<treadY)return B.CONCRETE;
 }
 return null;
}
function roomFurniture(x,z,floor,style){
 const corridor=within(z,-42,-36),classroom=within(z,-61,-44)&&within(x,-63,63);
 const dy=floor.y-floor.base;
 if(dy===5){
  const fixture=corridor&&mod(x,11)===0&&z===-39||classroom&&mod(x,14)===0&&z===-52;
  if(fixture)return hash(x,z,floor.level+style,327)<0x4fffffff?B.BROKEN_FLUORESCENT:B.FLUORESCENT;
 }
 if(dy!==1||!classroom)return B.AIR;
 // Loose, slightly irregular desks keep broad walkable aisles and clear doors.
 if(within(z,-57,-48)&&mod(x,14)!==0&&mod(x,14)!==1&&mod(x,14)!==13&&mod(x,4)===2&&mod(z,4)===0)
  return B.CHAIR;
 if(z===-60&&mod(x,14)===0)return B.CRATE;
 return B.AIR;
}
function mainBuilding(x,y,z,style){
 if(!rect(x,z,-83,83,-62,-35)||y<SCHOOL_GROUND||y>SCHOOL_GROUND+STOREY*STORIES+1)return null;
 const roof=SCHOOL_GROUND+STOREY*STORIES;
 if(y===roof)return B.CONCRETE;
 if(y===roof+1)return (Math.abs(x)===83||z===-62||z===-35)?B.CONCRETE_SLAB:B.AIR;
 const level=Math.floor((y-SCHOOL_GROUND)/STOREY),base=SCHOOL_GROUND+level*STOREY;
 const dy=y-base;
 const onStairs=Math.abs(x)>=64;
 if(onStairs){
  const steps=stairCell(x,y,z);
  if(steps!==null)return steps;
  // Removing the upper landing tile where the previous flight emerges
  // prevents a low ceiling and lets the player step onto the next floor.
  if(dy===0&&stairLane(x,z,level-1))return B.AIR;
  if(dy===6&&stairLane(x,z,level))return B.AIR;
 }
 if(dy===0)return B.FLOOR_TILE;
 const facade=[B.CITY_PAINT_WHITE,B.STAINED_PLASTER,B.CITY_PAINT_GRAY,B.SHOP_BRICK][style];
 const edgeX=Math.abs(x)===83,edgeZ=z===-62||z===-35;
 if(edgeX||edgeZ){
  if(level===0&&z===-35&&Math.abs(x)<=3&&dy<=4)return B.AIR; // main entrance
  if(dy===1||dy===5)return facade;
  if(edgeX&&mod(z,6)>=2&&mod(z,6)<=4)return B.WINDOW_EW;
  if(z===-62&&Math.abs(x)<=63&&mod(x,7)>=2&&mod(x,7)<=5)return B.WINDOW_NS;
  if(z===-35&&mod(x,7)>=2&&mod(x,7)<=5)return B.WINDOW_NS;
  return facade;
 }
 if(dy===6)return onStairs?B.CONCRETE:B.CEILING_TILE;
 if(onStairs)return B.AIR;
 // Traditional one-sided corridor: rooms to the north, passage faces the yard.
 if(z===-43&&within(x,-63,63)){
  const door=mod(x,14)<=1||mod(x,14)>=13;
  if(door&&dy<=3)return B.AIR;
  if(dy===3&&door)return B.WINDOW_NS;
  if(dy===2&&mod(x,14)>=3&&mod(x,14)<=5)return B.WINDOW_NS;
  return B.THIN_WALL_NS;
 }
 if(within(z,-61,-44)&&Math.abs(x)<=63&&mod(x,14)===7){
  if(z===-52&&dy<=3)return B.AIR; // classroom-to-classroom auxiliary access
  return B.THIN_WALL_EW;
 }
 if(level===0&&z===-44&&Math.abs(x)<=3&&dy<=3)return B.AIR;
 return roomFurniture(x,z,{level,base,y},style);
}
function gym(x,y,z,style){
 if(!rect(x,z,76,103,-21,36)||y<SCHOOL_GROUND||y>31)return null;
 if(y===SCHOOL_GROUND){
  if(x===80||x===99||z===-16||z===31)return B.CITY_PAINT_WHITE;
  if(x===89||z===8)return B.WARNING_STRIPE;
  return B.PLANKS;
 }
 const boundary=x===76||x===103||z===-21||z===36;
 if(y===30)return B.CONCRETE_BEAM;
 if(y===31)return B.AIR;
 if(boundary){
  if(x===76&&within(z,-10,-6)&&y<=16)return B.AIR;
  if(y>=20&&y<=24&&((x===76||x===103)&&mod(z,9)>=2&&mod(z,9)<=6||
    (z===-21||z===36)&&mod(x,8)>=2&&mod(x,8)<=5))return x===76||x===103?B.WINDOW_EW:B.WINDOW_NS;
  return style===3?B.CITY_PAINT_GRAY:B.STAINED_PLASTER;
 }
 if(y===29&&(mod(x,8)===0||mod(z,12)===0))return B.CONCRETE_BEAM;
 if(y===29&&mod(x,8)===4&&mod(z,12)===6)return B.FLUORESCENT;
 if(y===13&&x>=98&&mod(z,3)===0)return B.WOOD_SLAB??B.CONCRETE_SLAB;
 return B.AIR;
}
function surface(x,z){
 const main=rect(x,z,-83,83,-62,-35);
 if(main)return B.FLOOR_TILE;
 if(rect(x,z,76,103,-21,36))return B.PLANKS;
 if(Math.abs(x)>=104||Math.abs(z)>=104)return B.CONCRETE; // roads between campuses
 if(rect(x,z,43,55,-34,104)||rect(x,z,-6,55,-34,-27)||rect(x,z,68,80,-35,-6))return B.FLOOR_TILE;
 if(rect(x,z,-79,39,-13,84)){
  if(rect(x,z,-71,31,-5,76)){
   const border=x===-71||x===31||z===-5||z===76;
   const middle=x===-20&&within(z,-5,76);
   return border||middle?B.CITY_PAINT_WHITE:B.GRASS;
  }
  return B.TERRACOTTA;
 }
 if(rect(x,z,-6,6,-35,-24))return B.FLOOR_TILE;
 if(rect(x,z,-84,84,-66,-63))return B.CONCRETE;
 if(rect(x,z,73,77,-22,36))return B.CONCRETE;
 return B.GRASS;
}
function trees(x,y,z,seed,cx,cz){
 const points=[[-95,-81],[-96,-12],[-94,48],[-87,94],[-12,91],[30,93],[87,83],[94,62],[-96,-95]];
 for(let i=0;i<points.length;i++){
  const [px,pz]=points[i],height=3+(hash(i,0,seed,cx*31+cz*149)%2);
  if(x===px&&z===pz&&y>=13&&y<=12+height)return B.WOOD;
  const dx=x-px,dz=z-pz,dy=y-(12+height);
  if(y>=12+height-1&&y<=12+height+2&&dx*dx+dz*dz+(dy*.8)**2<=10&&hash(x,z,seed,y+i)%13!==0)return B.LEAVES;
 }
 return null;
}
export function schoolVoxel(wx,y,wz,seed=SCHOOL_SEED){
 if(y<0||y>=SCHOOL_HEIGHT)return B.AIR;
 if(y===0)return B.BEDROCK;
 if(y<SCHOOL_GROUND-1)return B.STONE;
 if(y===SCHOOL_GROUND-1)return B.DIRT;
 const {cx,cz,x,z}=schoolDistrict(wx,wz),style=schoolStyle(seed,cx,cz);
 if(y===SCHOOL_GROUND)return surface(x,z);
 const main=mainBuilding(x,y,z,style);
 if(main!==null)return main;
 const hall=gym(x,y,z,style);
 if(hall!==null)return hall;
 if(y===13&&(Math.abs(x)===103||Math.abs(z)===103)){
  if(z===103&&within(x,43,55))return B.AIR;
  if(x===103&&within(z,-25,-18))return B.AIR;
  return B.FENCE;
 }
 if(y===14&&z===103&&(x===42||x===56))return B.SHOP_SIGN;
 if(y>=13&&y<=20){const tree=trees(x,y,z,seed,cx,cz);if(tree!==null)return tree;}
 return B.AIR;
}
export function stampSchoolChunk(chunk,seed=SCHOOL_SEED){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE,height=chunk.height;
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const wx=ox+x,wz=oz+z;
  for(let y=0;y<Math.min(height,SCHOOL_HEIGHT);y++){
   const id=schoolVoxel(wx,y,wz,seed);
   if(id!==B.AIR)chunk.set(x,y,z,id);
  }
 }
 chunk.dirty=true;return chunk;
}
