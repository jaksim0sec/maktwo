import {hash,noise} from '../util/math.js';
import {designBuilding,stairRisers} from './eternal-night-buildings.js';
import {cityFloorKit,cityKits} from './eternal-night-kits.js';
import {CORE_FLOOR_DEFAULTS} from './eternal-night-core-floor.js';
import {collapsePlan,floorEnvironment} from './eternal-night-decay.js';

export const CANYON_MODE='canyon-v2';
export const CANYON_HEIGHT=768;
export const CANYON_PITCH=112;
export const CANYON_SHIFT=4*CANYON_PITCH;
const BAY=100, UNIT=1.5, LIMIT=1;
const HALF=CORE_FLOOR_DEFAULTS.width/2, DIAGONAL=Math.SQRT2*HALF;
const firstOctagonBay=Math.floor(-HALF/BAY),lastOctagonBay=Math.ceil(HALF/BAY)-1;
const PROFILES={
 apartment:{type:1,program:'housing',span:[23,37],depth:[25,42],floors:[6,13]},
 market:{type:2,program:'market',span:[24,43],depth:[29,52],floors:[3,7],blueprint:'department'},
 housing:{type:0,program:'housing',span:[13,23],depth:[15,24],floors:[2,5]},
 industrial:{type:4,program:'workshops',span:[24,45],depth:[34,50],floors:[2,5]},
};
const idFor=(level,bay,side,lot)=>Math.floor(hash(bay,level*31+lot,side,773)*0x7fffffff);
const integer=(r,a,b)=>a+Math.floor(r*(b-a+1));
const rect=(x0,x1,z0,z1)=>({x0,x1,z0,z1});
const mirror=(side,a,b,z0,z1)=>side===1?rect(a,b,z0,z1):rect(-b,-a,z0,z1);

function deckElevation(seed,level,bay,side){
 // Absolute levels vary in separation, while each bank keeps a gradual longitudinal grade.
 const strata=Math.round((hash(level,1,0,seed+941)-.5)*26);
 return level*CANYON_PITCH+56+strata+Math.round(noise(bay*.31,level*.53+side*3,seed+71)*19)+side*3;
}

function terrace(seed,level,bay,side){
 const roll=s=>hash(bay,level*43+s,side,seed);
 const trend=noise(bay*.21,level*.37+side*14,seed);
 const starter=level===3&&bay===0&&side===1;
 const atCore=bay===-1||bay===0;
 const inner=starter?Math.round(84+trend*22+roll(1)*15-(roll(17)<.20?17:0)):
  level===0&&atCore?110:Math.max(atCore?42:31,Math.round(45+trend*13+roll(1)*9-(roll(17)<.22?11:0)));
 const margin=starter?integer(roll(3),8,14):integer(roll(3),4,9);
 const end=starter?integer(roll(4),8,14):integer(roll(4),4,9);
 const z0=Math.max(-HALF,bay*BAY+margin),z1=Math.min(HALF,(bay+1)*BAY-end);
 const outer=Math.floor(Math.min(HALF,DIAGONAL-Math.max(Math.abs(z0),Math.abs(z1))-1,
  inner+integer(roll(2),103,131)));
 // Longitudinal heights move slowly enough for a short staircase across a joint.
 const y=deckElevation(seed,level,bay,side),headroom=deckElevation(seed,level+1,bay,side)-y;
 const thickness=integer(roll(5),4,12);
 return {kind:'terrace',level,bay,side,inner,outer,y,z0,z1,thickness,headroom,
  bounds:mirror(side,inner,outer,z0,z1),roll};
}

function buildLot(t,seed,kind,bounds,lot,supportY){
 const {level,bay,side,y}=t;
 const id=idFor(level,bay,side,lot),random=s=>hash(bay*71+lot,level*109+s,side,seed);
 const spec=PROFILES[kind];
 const volume={...bounds,id,kind,y0:y,type:spec.type,program:spec.program,fixedProgram:spec.program,
  luxury:.18+random(11)*.56,support:null,highRise:true,frontAxis:'x',terraceEntry:true};
 if(spec.blueprint&&bounds.z1-bounds.z0>=29&&random(12)<.55)volume.blueprint=spec.blueprint;
 const risers=stairRisers(volume,UNIT);
 if(!risers)return null;
 const pitch=risers*UNIT/4;
 const floors=supportY===undefined
  ?Math.min(integer(random(15),...spec.floors)+(kind==='apartment'?2:0),Math.floor((t.headroom-13)/pitch))
  :Math.floor((supportY-y-3)/pitch);
 volume.y1=y+pitch*floors;
 if(!designBuilding(volume,UNIT,random))return null;
 const floor=volume.floors[0];
 const facing=volume.ports.filter(p=>p.level===0&&p.dx===-side)
  .sort((a,b)=>Math.abs(a.z-(volume.z0+volume.z1)/2)-Math.abs(b.z-(volume.z0+volume.z1)/2))[0];
 if(facing&&!facing.open){facing.open=true;floor.doors.push(facing);}
 const facade=cityKits(volume,seed,LIMIT)[1];
 floorEnvironment(volume,0,bay*BAY+50,seed);
 const kits=volume.floors.map(f=>cityFloorKit(facade,f,LIMIT));
 const {landing,upperLanding,treads}=volume.stairs[0];
 volume.detail={kits,landing,access:upperLanding,stairs:treads,collapse:collapsePlan(volume,seed+level*997)};
 volume.front=facing;
 volume.deckAbove=supportY;
 volume.balconyFront=kind==='apartment'&&random(29)<.78;
 volume.roofWear=random(30);
 return volume;
}

function buildingsOn(t,seed){
 const types=['apartment','market','housing','industrial'];
 const {level,bay,side,inner,outer,z0,z1}=t;
 const district=hash(Math.floor(bay/3),level,side,seed+217);
 const preferred=types[Math.floor(district*types.length)];
 const buildings=[];
 const upper=terrace(seed,level+1,bay,side);
 // Deep building wings carry the slabs above. They share a rear service alley
 // with the smaller lots in front, and keep the gorge side open.
 const wingFront=Math.max(inner+61,upper.inner+7);
 const wingRear=Math.min(outer-3,upper.outer-3);
 const wingLimit=wingRear-wingFront>=14?wingFront-4:outer-3;
 let cursor=z0+4;
 for(let lot=0;cursor+14<=z1-3;lot++){
  const random=s=>hash(bay*71+lot,level*109+s,side,seed);
  // Each bay has a dominant use, with separate smaller buildings in its gaps.
  const starter=level===3&&bay===0&&side===1&&lot===0;
  const kind=starter?'market':lot===0&&preferred==='housing'&&random(22)<.67?'apartment':
   lot===0||random(5)<.62?preferred:types[Math.floor(random(6)*types.length)];
  const spec=PROFILES[kind];
  const span=Math.min(z1-3-cursor,integer(random(8),...spec.span));
  if(span<spec.span[0]&&lot!==0)break;
  const front=inner+integer(random(9),10,19);
  const rear=Math.min(wingLimit,front+integer(random(10),...spec.depth));
  const joinsUpper=lot===0&&!starter&&(kind==='apartment'||kind==='industrial')&&
   front>=upper.inner+3&&rear<=upper.outer-2&&cursor>=upper.z0+2&&cursor+span<=upper.z1-2;
  const building=buildLot(t,seed,kind,mirror(side,front,rear,cursor,cursor+span),lot,joinsUpper?upper.y:undefined);
  if(building)buildings.push(building);
  const behind=rear+4,remaining=wingLimit-behind;
  if(remaining>=16&&span>=18&&random(20)<.72){
   const small=preferred==='industrial'&&remaining>=34&&span>=26?'industrial':'housing';
   const depth=Math.min(remaining,small==='housing'?22:41);
   const infill=buildLot(t,seed,small,mirror(side,behind,behind+depth,cursor+1,cursor+span-1),lot+10);
   if(infill)buildings.push(infill);
  }
  cursor+=span+integer(random(16),4,8);
 }
 if(wingLimit!==outer-3&&!(level===-1&&(bay===-1||bay===0))){
  const middle=Math.floor((z0+z1)/2);
  const spans=[[Math.max(z0+3,upper.z0+3),middle-3],[middle+3,Math.min(z1-3,upper.z1-3)]];
  for(const [index,[start,end]] of spans.entries()){
   if(end-start<13)continue;
   const wing=buildLot(t,seed,preferred==='industrial'?'industrial':'apartment',
    mirror(side,wingFront,wingRear,start,end),20+index,upper.y);
   if(wing)buildings.push(wing);
  }
 }
 return buildings;
}

export function addCanyonRoute(list,kind,points,width=5){
 for(let i=1;i<points.length;i++){
  const [ax,ay,az]=points[i-1],[bx,by,bz]=points[i];
  const dx=Math.sign(bx-ax),dz=Math.sign(bz-az),length=Math.abs(bx-ax)+Math.abs(bz-az);
  if(!length)continue;
  if(dx&&dz||Math.abs(by-ay)>Math.max(0,length-2*Math.floor(width/2)))throw new RangeError(`Canyon route exceeds stair grade: ${kind} ${points[i-1]} to ${points[i]}`);
  const half=Math.floor(width/2),joint=i>1?half:0,end=i<points.length-1?half:0;
  const bounds=rect(Math.min(ax-dx*joint,bx+dx*end)-(dz?half:0),Math.max(ax-dx*joint,bx+dx*end)+(dz?half:0)+1,
   Math.min(az-dz*joint,bz+dz*end)-(dx?half:0),Math.max(az-dz*joint,bz+dz*end)+(dx?half:0)+1);
  list.push({kind,ax,ay,az,bx,by,bz,dx,dz,length,half,bounds,
   start:i===1,end:i===points.length-1});
 }
}

function joinBay(a,b,routes){
 const x=a.side*(a.inner+5),next=b.side*(b.inner+5);
 const difference=Math.abs(b.y-a.y);
 if(x===next||Math.abs(x-next)<8){
  const setback=Math.max(2,Math.ceil((difference+4-(b.z0-a.z1))/2));
  addCanyonRoute(routes,'walkway',[[Math.abs(x)>Math.abs(next)?x:next,a.y,a.z1-setback],
   [Math.abs(x)>Math.abs(next)?x:next,b.y,b.z0+setback]]);
 }else{
  const joint=Math.floor((a.z1+b.z0)/2);
  const dy=Math.sign(b.y-a.y),mid=a.y+dy*Math.max(0,difference-(Math.abs(x-next)-4));
  const setback=Math.max(2,Math.abs(mid-a.y)+4-(joint-a.z1));
  addCanyonRoute(routes,'walkway',[[x,a.y,a.z1-setback],[x,mid,joint],[next,b.y,joint],[next,b.y,b.z0+2]]);
 }
}

function crossCanyon(a,b,routes){
 const z=a.bay===0?61:a.bay===-1?-61:Math.max(a.z0,b.z0)+25;
 const ax=-a.inner-6,bx=b.inner+6;
 // Longer enclosed spans alternate with open transfers. Both finish on public decks.
 const kind=Math.abs(a.bay%2)===0?'concourse':'bridge';
 addCanyonRoute(routes,kind,[[ax,a.y,z],[bx,b.y,z]],7);
 routes.at(-1).landing=7;
}

function climb(a,b,routes){
 const sign=a.side,x=a.inner*sign+sign*5,upper=b.inner*sign+sign*5;
 const front=Math.min(a.inner,b.inner);
 const middleX=sign*(front-6),outerX=sign*(front-15),innerX=sign*(front-24);
 const z0=a.bay*BAY+18,z1=Math.min(a.z1,b.z1,a.bay*BAY+85)-3;
 const rise=b.y-a.y,y1=a.y+Math.round(rise/3),y2=a.y+Math.round(rise*2/3);
 addCanyonRoute(routes,'stairs',[[x,a.y,z0],[middleX,a.y,z0],[middleX,y1,z1],[outerX,y1,z1],
  [outerX,y2,z0],[innerX,y2,z0],[innerX,b.y,z1],[upper,b.y,z1]]);
}

// Absolute levels and bays can be sampled independently, including negative indices.
export function planCanyonLevel(seed,level,{firstBay=-3,lastBay=3}={}){
 if(!Number.isSafeInteger(level)||!Number.isSafeInteger(firstBay)||!Number.isSafeInteger(lastBay)||lastBay<firstBay)
  throw new RangeError('Invalid canyon range');
 const terraces=[],buildings=[],routes=[];
 for(let bay=Math.max(firstBay,firstOctagonBay);bay<=Math.min(lastBay,lastOctagonBay);bay++){
  const a=terrace(seed,level,bay,-1),b=terrace(seed,level,bay,1);
  for(const bank of [a,b]){
   terraces.push(bank);
   buildings.push(...buildingsOn(bank,seed));
   if(bay<lastOctagonBay){
    const next=terrace(seed,level,bay+1,bank.side);
    joinBay(bank,next,routes);
   }
  }
  const pattern=((bay%4)+4)%4;
  if((pattern===0||pattern===3)&&!(level===0&&(bay===0||bay===-1)))crossCanyon(a,b,routes);
  if((pattern===1||pattern===2)&&bay>firstOctagonBay&&bay<lastOctagonBay){
   const sign=(pattern===1?1:-1)*((level&1)?-1:1);
   climb(sign===1?b:a,terrace(seed,level+1,bay,sign),routes);
   // The opposite bank has a street stair down to the existing station/dome level.
   if(level===0&&(bay===1||bay===2||bay===-2||bay===-3)){
    const bank=sign===1?a:b,x=bank.side*(bank.inner+5),xx=bank.side*(bank.inner-6);
    const start=bay*BAY+(bay===2?82:22),end=bay*BAY+(bay===2?19:85);
    const middle=Math.round((bank.y+8)/2),inner=bank.side*(bank.inner-14);
    addCanyonRoute(routes,'street-stair',[[x,bank.y,start],[xx,bank.y,start],[xx,middle,end],
     [inner,middle,end],[inner,8,start]]);
   }
  }
 }
 return {level,terraces,buildings,routes};
}

const plans=new Map();
export function canyonBay(seed,level,bay){
 const key=`${seed}:${level}:${bay}`;
 const cached=plans.get(key);
 if(cached){plans.delete(key);plans.set(key,cached);return cached;}
 const plan=planCanyonLevel(seed,level,{firstBay:bay,lastBay:bay});
 if(plans.size>=240)plans.delete(plans.keys().next().value);
 plans.set(key,plan);
 return plan;
}

export function* canyonBays(seed,origin,height,z0,z1){
 // Include the previous terrace's outgoing bridges and the buildings overhanging the lower edge.
 const bottom=Math.floor((origin-156)/CANYON_PITCH),top=Math.floor((origin+height)/CANYON_PITCH);
 for(let level=bottom;level<=top;level++)
  for(let bay=Math.floor(z0/BAY)-1;bay<=Math.floor(z1/BAY);bay++)
   yield canyonBay(seed,level,bay);
}

export function canyonShelter(seed){
 const market=canyonBay(seed,3,0).buildings.find(v=>v.kind==='market'&&v.front&&v.front.dx===-1);
 if(!market){
  const deck=canyonBay(seed,3,0).terraces[1];
  return {spawn:{x:deck.inner+5.5,y:deck.y,z:deck.z0+22.5,yaw:-Math.PI/2}};
 }
 const door=market.front;
 const x=Math.floor(door.x),z=Math.floor(door.z);
 return {x,z,y:door.y,spawn:{x:x+3.5,y:door.y,z:z+.5,yaw:-Math.PI/2},
  head:x+15,foot:x+16,lamp:x+17};
}
