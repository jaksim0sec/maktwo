import {BLOCK as B} from '../core/blocks.js';
import {cityPart} from './eternal-night-kits.js';
import {encodeCityStair,CITY_STAIR_STYLE} from './eternal-night-stairs.js';

const TURN=2*Math.PI;
const START=Math.PI/4;
const UPPER_LANDING_WIDTH=4;
const WALL_THICKNESS=2;
const STAIR_WIDTH=6;
const RISE_PER_TURN=32;
const STEPS_PER_TURN=RISE_PER_TURN*4;
const WINDOW_INTERVAL=16;
const WINDOW_BAYS=16;
const MARBLE=B.ARCH_STONE_MARBLE;
const STAIR=cityPart('staircase',4);
const wrap=(angle,period)=>((angle%period)+period)%period;

export function createCoreTower(layout,unit,walkways){
 const entryY=layout.floorY+4*unit;
 const radius=layout.mainShaftRadius;
 return {
  x:layout.centerX,z:layout.centerZ,radius,
  stairInner:radius-WALL_THICKNESS-STAIR_WIDTH,
  bottom:layout.floorY-layout.slabThickness,entryY,top:layout.floorTop,
  entries:walkways.filter(link=>link.kind==='core').map(link=>link.ports[1]),
 };
}

export function stampCoreTower(tower,x,z,put){
 const dx=x-tower.x,dz=z-tower.z,radius=Math.hypot(dx,dz);
 const {stairInner,bottom,entryY,top,entries}=tower;
 if(radius<stairInner-1||radius>tower.radius+UPPER_LANDING_WIDTH)return;
 const angle=Math.atan2(dz,dx);
 const phase=wrap(angle-START,TURN)/TURN;
 const upperPhase=wrap((top-entryY)/RISE_PER_TURN,1);
 const exitRun=wrap(phase-upperPhase,1);
 const upperLanding=exitRun<.045&&radius>=stairInner;
 if(upperLanding)put(top-1,MARBLE);
 const isDoor=entries.some(p=>{
  const px=p.x-tower.x,pz=p.z-tower.z;
  return dx*px+dz*pz>0&&Math.abs(dx*pz-dz*px)/tower.radius<2.5;
 });
 const wall=radius<=tower.radius&&radius>=tower.radius-WALL_THICKNESS;
 if(wall){
  const bay=TURN/WINDOW_BAYS;
  const offset=(wrap(angle,bay)-bay/2)*tower.radius;
  const halfWidth=2.35;
  const arch=offset*offset<halfWidth*halfWidth
   ?Math.sqrt(halfWidth*halfWidth-offset*offset):0;
  for(let y=bottom;y<top;y++){
   if(isDoor&&y>=entryY&&y<entryY+4)continue;
   const windowY=wrap(y-entryY-6,WINDOW_INTERVAL)+.5;
   if(y>=entryY+6&&arch&&windowY<4+arch)continue;
   put(y,MARBLE);
  }
 }
 const entryDeck=radius>=stairInner&&(radius<=tower.radius-WALL_THICKNESS||isDoor);
 if(entryDeck)put(entryY-1,MARBLE);
 if(radius>tower.radius-WALL_THICKNESS)return;

 const facing=(2*Math.round(angle*2/Math.PI)+8)%8;
 const step=Math.floor(phase*STEPS_PER_TURN);
 const rail=radius<stairInner+.65;
 const walk=radius>=stairInner;
 for(let turnY=entryY;turnY<top;turnY+=RISE_PER_TURN){
  const y=turnY+(step+1)/4;
  if(y>top)break;
  if(walk){
   const tread=encodeCityStair(y,facing);
   put(tread.base,STAIR,tread.facing,false,CITY_STAIR_STYLE|(tread.quarter<<3));
   // At the foot of the helix, close the gap below the first few risers.
   if(turnY===entryY&&y<entryY+3)
    for(let support=entryY;support<tread.base;support++)put(support,MARBLE);
  }
  if(rail&&y>=entryY+.5)put(Math.ceil(y),B.FENCE);
 }
}
