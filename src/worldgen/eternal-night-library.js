import {BLOCK as B} from '../core/blocks.js';
import {cityPart} from './eternal-night-kits.js';
import {encodeCityStair,CITY_STAIR_STYLE} from './eternal-night-stairs.js';

const STONE=B.ARCH_STONE_MARBLE;
const WALL=B.ARCH_BRICK_WHITE;
const BASE=B.ARCH_STONE_GREY_GRANITE;
const WOOD=B.ARCH_FLOOR_WOOD;
const SHELVES=[B.PART_BOOKSHELF_1,B.PART_BOOKSHELF_2,B.PART_BOOKSHELF_3,B.PART_BOOKSHELF_4];
const RAIL=cityPart('passage',4);
const TABLE=cityPart('interior',1);
const STAIR=cityPart('staircase',4);
const RADIAL_BAYS=32;
const TAU=2*Math.PI;
const wrap=(n,d)=>((n%d)+d)%d;
const facing=(x,z)=>wrap(Math.round(Math.atan2(-x,z)*4/Math.PI),8);

export function createCoreLibrary(layout,tower){
 const radius=layout.centerRadius,base=layout.floorY;
 const roofInner=tower.radius+4;
 return {
  x:layout.centerX,z:layout.centerZ,radius,base,roofInner,towerRadius:tower.radius,
  eaves:base+54,crown:base+86,galleries:[tower.entryY,base+26],
  gardens:layout.gardenCenters,gardenRadius:layout.gardenRadius,
 };
}

export function libraryRoofHeight(library,radius){
 const span=library.radius-library.roofInner;
 const t=Math.max(0,Math.min(1,(radius-library.roofInner)/span));
 return library.eaves+(library.crown-library.eaves)*Math.sqrt(1-t*t);
}

export function stampCoreLibrary(library,x,z,put,empty,corePath){
 const {radius,base,galleries,gardenRadius,towerRadius,roofInner}=library;
 const dx=x-library.x,dz=z-library.z;
 const r=Math.hypot(dx,dz);
 if(r>radius+4||r<towerRadius-.25)return;

 let garden=Infinity,gardenX=0,gardenZ=0;
 for(const [gx,gz] of library.gardens){
  const d=Math.hypot(x-gx,z-gz);
  if(d<garden){garden=d;gardenX=gx;gardenZ=gz;}
 }
 if(garden<gardenRadius)return;

 const major=Math.max(Math.abs(dx),Math.abs(dz));
 const minor=Math.min(Math.abs(dx),Math.abs(dz));
 const angle=Math.atan2(dz,dx);
 const bayWidth=TAU/RADIAL_BAYS;
 const bayOffset=(wrap(angle+bayWidth/2,bayWidth)-bayWidth/2)*r;
 const cardinalDoor=minor<4.5;
 const diagonalDoor=Math.abs(dx-dz)<4||Math.abs(dx+dz)<4;
 const roof=libraryRoofHeight(library,r);
 const roofY=Math.floor(roof);
 const wall=r>=radius-2&&r<=radius;
 const doorwayTop=cardinalDoor?4+Math.sqrt(4.5**2-minor**2):0;
 const closeToGarden=garden<gardenRadius+2;
 const outerGallery=r>=radius-12;
 const innerGallery=r<=towerRadius+10;
 const along=(Math.abs(dx)+Math.abs(dz))/Math.SQRT2;
 const across=(Math.abs(dx)-Math.abs(dz))/Math.SQRT2;
 const radialGallery=Math.abs(across)<3&&along>=towerRadius+5&&along<=radius-8;
 const [lower,upper]=galleries;
 const entryGallery=corePath;
 const galleryFloors=[lower,upper];
 const inner=towerRadius+8,outer=radius-10;
 const lowerFlight=Math.abs(across-5.5)<1.6;
 const upperFlight=Math.abs(across+5.5)<1.6;
 const onFlight=(lowerFlight||upperFlight)&&along>=inner&&along<=outer;
 const progress=(along-inner)/(outer-inner);
 const surface=lowerFlight?lower+(base-lower)*progress:lower+(upper-lower)*progress;

 const exposedX=Math.hypot(dx+Math.sign(dx),dz)>radius;
 const exposedZ=Math.hypot(dx,dz+Math.sign(dz))>radius;
 const bevel=exposedX&&exposedZ&&Math.abs(dx)>1&&Math.abs(dz)>1
  ?(dx>0?(dz>0?3:6):(dz>0?4:5)):0;

 if(wall){
  for(let y=base-1;y<=roofY;y++){
   const door=y>=base&&y<base+doorwayTop;
   const archOffset=Math.abs(bayOffset);
   const windowY=wrap(y-base-10,17)+.5;
   const window=archOffset<2.25&&y>=base+10&&y<roofY-3
    &&windowY<5+Math.sqrt(2.25**2-archOffset**2);
   const bridgeDoor=corePath&&y>=lower-3&&y<=lower+6;
   if(door||window||bridgeDoor)continue;
   put(y,y===roofY||y===base-1||wrap(y-base,17)===8?STONE:WALL,undefined,false,0,bevel);
  }
 }

 // A ring vault springs from the outer wall and rises toward the tower.
 if(r>=roofInner&&r<=radius&&garden>=gardenRadius+1.25){
  const oculusRim=garden<gardenRadius+2.6;
  const trim=oculusRim||r>radius-2.5||r<roofInner+1.5||Math.abs(bayOffset)<.62;
  const directionX=Math.abs(dx)>=Math.abs(dz);
  const low=libraryRoofHeight(library,r-.5),high=libraryRoofHeight(library,r+.5);
  const grade=low-high;
  const form=grade>.55&&grade<1.45
   ?(directionX?(dx>0?10:8):(dz>0?9:7))
   :roof-roofY<.48?1:0;
  put(roofY,trim?STONE:WALL,undefined,false,0,form);
  if(oculusRim)put(roofY+1,STONE,undefined,false,0,1);
  // Close steep exterior risers in the vault's outer courses.
  const lowerRoof=Math.floor(libraryRoofHeight(library,r+.8));
  for(let y=lowerRoof+1;y<roofY;y++)put(y,trim?STONE:WALL);
 }

 const ground=r<=radius||cardinalDoor;
 if(ground){
  const trim=closeToGarden||outerGallery||innerGallery||radialGallery;
  put(base-1,trim?STONE:(Math.floor(x)+Math.floor(z))%2===0?B.ARCH_TILE_LARGE_PORCELAIN:BASE);
 }
 if(r>radius&&!cardinalDoor)return;

 for(const floor of galleryFloors){
  const joinsBridge=floor===lower&&entryGallery;
  if(wall&&!joinsBridge)continue;
  if(onFlight&&floor>surface+.25&&floor-surface<3)continue;
  if(!joinsBridge&&!outerGallery&&!innerGallery&&!radialGallery&&!closeToGarden)continue;
  if(!joinsBridge)put(floor-1,closeToGarden||innerGallery||r>radius-3?STONE:WOOD);
  const edge=closeToGarden?garden<gardenRadius+.9:
   (outerGallery&&r<radius-11.15)||(innerGallery&&r>towerRadius+9.15)
   ||(radialGallery&&Math.abs(across)>2.15&&!innerGallery&&!outerGallery);
  if(edge&&!joinsBridge&&!diagonalDoor&&!cardinalDoor&&empty(floor)){
   const turn=closeToGarden?facing(gardenX-x,gardenZ-z):
    radialGallery&&!outerGallery&&!innerGallery?facing(Math.sign(dx)*Math.sign(across),-Math.sign(dz)*Math.sign(across)):
    facing(outerGallery?-dx:dx,outerGallery?-dz:dz);
   put(floor,RAIL,turn,true,CITY_STAIR_STYLE|(wrap(Math.floor(x+z),3)===0?8:0));
  }
 }

 if(closeToGarden){
  const turn=facing(gardenX-x,gardenZ-z);
  if(garden<gardenRadius+.9&&!corePath)
   put(base,RAIL,turn,true,CITY_STAIR_STYLE|(wrap(Math.floor(x+z),3)===0?8:0));
  if(garden>gardenRadius+1.4&&wrap(Math.floor(angle*12),4)===0){
   put(base,STONE);
   put(base+1,B.FLOWER_POT);
  }
  return;
 }

 // Four radial pairs connect ground → lower inner ring → upper outer ring.
 if(onFlight&&!wall){
  const toward=lowerFlight?-1:1;
  const stair=encodeCityStair(surface,facing(Math.sign(dx)*toward,Math.sign(dz)*toward));
  if(empty(stair.base))put(stair.base,STAIR,stair.facing,false,CITY_STAIR_STYLE|(stair.quarter<<3));
 }

 if(wall||cardinalDoor||diagonalDoor||entryGallery||onFlight)return;

 // Full-height wall stacks frame the void, with lower stacks in ground reading bays.
 const bay=Math.floor(wrap(angle+bayWidth/2,TAU)/bayWidth);
 if(outerGallery&&r>radius-8&&r<radius-4&&Math.abs(bayOffset)<.7){
  for(let y=base;y<roofY-2;y++){
   if(galleryFloors.includes(y+1))continue;
   put(y,wrap(y-base,10)===0?BASE:STONE);
  }
 }
 if(r>=radius-4&&r<radius-3&&Math.abs(bayOffset)<.75){
  for(const y of [base+3,upper+4])if(empty(y)){
   put(y,B.LANTERN);
   put(y+1,BASE);
  }
 }
 const wallStacks=r>=radius-6.5&&r<radius-5.35&&Math.abs(bayOffset)>2&&Math.abs(bayOffset)<5;
 const aisleStacks=r>towerRadius+13&&r<radius-17&&garden>gardenRadius+7&&major>towerRadius+8
  &&wrap(Math.floor(minor),8)===2&&wrap(Math.floor(major),13)>=2&&wrap(Math.floor(major),13)<=8;
 if(wallStacks||aisleStacks){
  const turn=wallStacks?facing(-dx,-dz):Math.abs(dx)>Math.abs(dz)?0:2;
  const bookcase=SHELVES[wrap(bay+Math.floor(major/8),SHELVES.length)];
  const levels=wallStacks?[base,upper]:[base];
  for(const level of levels){
   const height=wallStacks?6:4;
   for(let y=level;y<level+height;y++){
    if(galleryFloors.includes(y+1)||!empty(y))continue;
    put(y,y===level?B.PART_BOOKSHELF_5:bookcase,turn,true);
   }
  }
 }else if(!outerGallery&&!innerGallery&&r>towerRadius+12&&r<radius-17
  &&wrap(Math.floor(x),16)===4&&wrap(Math.floor(z),16)===4){
  if(empty(base))put(base,TABLE,0);
  if(empty(base+1))put(base+1,B.LANTERN);
 }
}
