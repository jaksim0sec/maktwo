import {SIZE,TURN_STYLE,EXTERIOR_STYLE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {containsRect,insidePolygon} from './eternal-night-buildings.js';
import {CORE_FLOOR_DEFAULTS,CORE_ZONE,createFloorLayout,zoneAt} from './eternal-night-core-floor.js';
import {createDistrictPlan} from './eternal-night-districts.js';
import {cityFloorKit,cityKits,cityPart} from './eternal-night-kits.js';
import {facadeBay,enclosedPassageBay} from './eternal-night-facade.js';
import {segmentY} from './eternal-night-walkways.js';
import {encodeCityStair,encodeSplitTread,stairOuterRail,walkwayJunction,CITY_STAIR_STYLE} from './eternal-night-stairs.js';
import {createCoreTower,stampCoreTower} from './eternal-night-tower.js';
import {createCoreLibrary,stampCoreLibrary} from './eternal-night-library.js';
import {floorFinish,hasDropCeiling,ceilingFixture,interiorWallFinish} from './eternal-night-interiors.js';
import {floorEnvironment,lightProbability,survivingFixture} from './eternal-night-decay.js';

export const CITY_MODE='eternal-city-lab';
export const CITY_BASE_Y=8;
export const CITY_HEIGHT=768;
export const CITY_WIDTH=CORE_FLOOR_DEFAULTS.width;
export const CITY_SEED=9999;
export const CITY_BLUEPRINT_VERSION=6;
export const CITY_BUILDING_OPTIONS=Object.freeze({unit:1.5,buildingDensity:1,highRise:true});
let cached;

export function createCityPlan(seed=CITY_SEED,cityBlueprints=true) {
  if(cached?.layout.seed===seed&&cached.cityBlueprints===cityBlueprints)return cached;
  const layout=createFloorLayout({seed,floorY:CITY_BASE_Y});
  const plan=createDistrictPlan(layout,120,{...CITY_BUILDING_OPTIONS,cityBlueprints});
  plan.cityBlueprints=cityBlueprints;
  plan.tower=createCoreTower(layout,plan.unit,plan.walkways);
  plan.library=createCoreLibrary(layout,plan.tower);
  plan.details=plan.volumes.map(v=>{
    floorEnvironment(v,layout.centerX,layout.centerZ,seed);
    const bands=cityKits(v,seed,layout.districtLuxuryMax);
    return {kits:v.floors.map(f=>cityFloorKit(bands[f.band],f,layout.districtLuxuryMax)),
      stairs:v.stairs[0]?.treads??[],landing:v.stairs[0]?.landing,access:v.stairs[0]?.upperLanding};
  });
  return cached=plan;
}

const mod=(n,d)=>((n%d)+d)%d;
const lineTurn=(a,b)=>mod(Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])*4/Math.PI),8);
const outwardTurn=(x,z)=>mod(Math.round(Math.atan2(-x,z)*4/Math.PI),8);
const axisTurn=(dx,dz)=>Math.abs(dx)>=Math.abs(dz)?2:0;
function lineDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}

const inside=insidePolygon;

export function* citySpawnCandidates(seed,cityBlueprints=true) {
 const plan=createCityPlan(seed,cityBlueprints);
 const centerX=plan.layout.centerX,centerZ=plan.layout.centerZ;
 const targetRadius=plan.layout.width*.32;
 const candidates=plan.volumes.filter(v=>v.support===null&&v.floors?.length>=25).map(v=>{
  const mid=Math.floor(v.floors.length*(.44+hash(v.id,13,seed,seed)*.12));
  const floors=v.floors.filter(f=>f.corridors?.length&&Math.abs(f.level-mid)<=2);
  if(!floors.length)return null;
  floors.sort((a,b)=>Math.abs(a.level-mid)-Math.abs(b.level-mid)||a.level-b.level);
  const dx=(v.x0+v.x1)/2-centerX,dz=(v.z0+v.z1)/2-centerZ;
  return {v,floors,score:Math.abs(Math.hypot(dx,dz)-targetRadius)};
 }).filter(Boolean);
 candidates.sort((a,b)=>a.score-b.score||a.v.id-b.v.id);
 const recent=candidates.slice(0,12);
 const offset=recent.length?Math.floor(hash(seed,27,51,seed)*recent.length):0;
 for(let i=0;i<recent.length;i++){
  const {floors}=recent[(i+offset)%recent.length];
  for(const f of floors){
   for(const spine of f.corridors){
    const x=Math.floor((spine.x0+spine.x1)/2)+.5,z=Math.floor((spine.z0+spine.z1)/2)+.5;
    yield {x,y:Math.round(f.y),z};
   }
  }
 }
 // Connected core routes remain a fallback when no middle-floor room is safe.
 const entries=plan.walkways.filter(link=>link.kind==='core').map(link=>link.ports[0])
  .sort((a,b)=>Math.abs(a.y-plan.library.crown)-Math.abs(b.y-plan.library.crown));
 for(const entry of entries)for(const depth of [2,3,4]){
  const x=Math.floor(entry.x-entry.dx*depth)+.5,z=Math.floor(entry.z-entry.dz*depth)+.5;
  yield {x,y:Math.round(entry.y),z};
 }
 for(const v of plan.volumes){
  const f=v.floors[0],spine=f?.corridors?.[0];if(!spine)continue;
  yield {x:Math.floor((spine.x0+spine.x1)/2)+.5,y:Math.round(f.y),z:Math.floor((spine.z0+spine.z1)/2)+.5};
 }
}
function inspectShape(f,x,z) {
  if(!inside(f.outline,x,z))return null;
  const n=f.outline.length;
  let edge=-1,dist=.84;
  for(let i=0;i<n;i++) {
    const d=lineDistance(x,z,f.outline[i],f.outline[(i+1)%n]);
    if(d<dist){edge=i;dist=d;}
  }
  const room=f.rooms.find(r=>containsRect(r,x,z));
  let door,doorKind;
  for(const room of f.rooms){
    door=room.openings?room.openings.find(opening=>lineDistance(x,z,opening.a,opening.b)<.70):
      lineDistance(x,z,room.door.a,room.door.b)<.70?room.door:undefined;
    if(door){doorKind=room.kind;break;}
  }
  const partition=!door&&f.partitions.find(({a,b})=>lineDistance(x,z,a,b)<.56);
  const corridor=f.corridors.find(r=>containsRect(r,x,z));
  return {edge,room,door,doorKind,partition,corridor};
}

function furnishRoom(room,x,z,kit,seed) {
  const {a,b}=room.door;
  const alongX=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1]);
  const midX=(a[0]+b[0])/2,midZ=(a[1]+b[1])/2;
  const dx=alongX?0:Math.sign((room.x0+room.x1)/2-midX);
  const dz=alongX?Math.sign((room.z0+room.z1)/2-midZ):0;
  const depth=(x-midX)*dx+(z-midZ)*dz;
  const across=alongX?x-midX:z-midZ;
  const length=alongX?room.z1-room.z0:room.x1-room.x0;
  const span=alongX?room.x1-room.x0:room.z1-room.z0;
  if(depth<1.25||length<2.6||Math.abs(across)<.9)return null;
  const turn=outwardTurn(-dx,-dz);
  const offset=Math.abs(across),side=hash(Math.floor(midX),0,Math.floor(midZ),seed)<.5?-1:1;
  // Each room keeps a clear aisle from its door to the back wall.
  if(depth>length-1.3&&offset<span*.53)return {variant:room.kind==='service'?4:0,turn};
  if(Math.sign(across)!==side||offset<span*.23||offset>span*.48)return null;
  if(room.kind==='shop'&&depth<2.65)return {variant:1,turn};
  if(room.kind==='room'&&depth>length*.55&&depth<length*.55+1)return {variant:kit.interior.includes(3)?3:1,turn};
  if(room.kind==='service'&&depth>2.5&&depth<3.5)return {variant:4,turn};
  return null;
}

function stampBuilding(v,detail,x,z,seed,put,empty,reservedPassage=()=>false,yLimit=Infinity) {
  const xi=Math.floor(x),zi=Math.floor(z),{stairs,landing,access,kits}=detail;
  const stairAlongX=v.stairFacing===2;
  const sampleX=stairAlongX?.25:0,sampleZ=stairAlongX?0:.25;
  const firstSample=stairs.findIndex(t=>containsRect(t,x-sampleX,z-sampleZ));
  const step=firstSample>=0?firstSample:stairs.findIndex(t=>containsRect(t,x+sampleX,z+sampleZ));
  const onLanding=landing&&containsRect(landing,x,z);
  const atAccess=access&&containsRect(access,x,z);
  const shaft=v.roof.holes[0];
  const shaftSide=shaft&&(stairAlongX
    ? x>=shaft.x0&&x<shaft.x1&&(Math.abs(z-shaft.z0)<1.1||Math.abs(z-shaft.z1)<1.1)
    : z>=shaft.z0&&z<shaft.z1&&(Math.abs(x-shaft.x0)<1.1||Math.abs(x-shaft.x1)<1.1));
  const stairWallTurn=stairAlongX?0:2;
  const half=stairs.length/2, firstFlight=step<half;
  const facing=mod(v.stairFacing+(firstFlight?0:4),8);
  const rail=step>=0&&stairOuterRail(stairs[step],step,stairs.length,stairAlongX,x,z);
  const [dx,dz]=facing===0?[0,1]:facing===2?[-1,0]:facing===4?[0,-1]:[1,0];
  const from=step>=0?stairs.find(t=>containsRect(t,x-dx*.25,z-dz*.25)):null;
  const to=step>=0?stairs.find(t=>containsRect(t,x+dx*.25,z+dz*.25)):null;
  const shapeCache=new Map();
  let lastKey,lastCachedShape;
  const columnHash=hash(xi,v.id,zi,seed);
  const roofY=Math.round(v.roof.y);
  if(inside(v.roof.outline,x,z)&&!v.roof.holes.some(h=>containsRect(h,x,z)))put(roofY-1,kits.at(-1).body);
  let lastShape=null;
  for(let floorIndex=0;floorIndex<v.floors.length;floorIndex++) {
    const f=v.floors[floorIndex];
    if(Math.round(f.y)-1>=yLimit)break;
    if(f.key!==lastKey){
      lastCachedShape=shapeCache.get(f.key);
      if(lastCachedShape===undefined){
        lastCachedShape=inspectShape(f,x,z);
        shapeCache.set(f.key,lastCachedShape);
      }
      lastKey=f.key;
    }
    const shape=lastCachedShape;
    const kit=kits[f.level],floor=Math.round(f.y),ceiling=Math.round(f.top)-1;
    if(!shape) {
      // Recessed upper floors expose the roof of the previous mass as a terrace.
      if(lastShape&&lastShape.edge>=0&&columnHash>.54&&!reservedPassage(floor)) {
        const previous=v.floors[floorIndex-1].outline;
        put(floor,cityPart('balcony',2),lineTurn(previous[lastShape.edge],previous[(lastShape.edge+1)%previous.length]),true);
      }
      lastShape=shape;
      continue;
    }
    lastShape=shape;
    const {edge,corridor,room,door,doorKind,partition}=shape;
    const partitionWall=interiorWallFinish(f,kit.roomWall);
    const scarred=hash(Math.floor(x/3),f.level,Math.floor(z/3),seed^0x72b4)<(f.damage??0)*.27;
    const wallFinish=y=>scarred&&(y-floor<2||ceiling-y<2)?(y-floor<2?B.MOLD_PLASTER:B.STAINED_PLASTER):partitionWall;
    const hole=f.holes.find(h=>containsRect(h,x,z));
    if(hole?.kind==='atrium'&&f.blueprint)continue;

    if(!hole){
      const finish=floorFinish(f,shape,x,z,kit.floor);
      // Weathering is sparse and clustered into four-block patches, not pixel noise.
      const damp=hash(Math.floor(x/4),f.level,Math.floor(z/4),seed^0x1872)<(f.damage??0)*.23;
      put(floor-1,damp&&finish===B.ARCH_TILE_LARGE_PORCELAIN?B.WET_TILE:finish);
    }
    // An independent suspended surface lives BELOW the upper structural slab,
    // and is absent at roof openings, stairwells and bridge clearances.
    const ceilingY=ceiling-1;
    const hasCeiling=!hole&&step<0&&!onLanding&&!atAccess&&!shaftSide
      &&!reservedPassage(ceilingY)&&hasDropCeiling(f,shape);
    if(hasCeiling)put(ceilingY,ceilingFixture(f,corridor,x,z,v.id,seed));
    // An exposed underside still needs a slab even where the next storey steps back.
    const next=v.floors[floorIndex+1];
    if((!next||!inside(next.outline,x,z))&&!(shaft&&containsRect(shaft,x,z))&&
      !(next?.blueprint&&next.voidRect&&containsRect(next.voidRect,x,z)))put(ceiling,kit.body);
    if(edge>=0) {
      const a=f.outline[edge],b=f.outline[(edge+1)%f.outline.length],turn=lineTurn(a,b);
      const exit=f.doors.find(d=>Math.abs((x-d.x)*d.dz-(z-d.z)*d.dx)<d.width/2+.38&&Math.abs((x-d.x)*d.dx+(z-d.z)*d.dz)<1.20);
      const stride=kit.wall===4?6:5;
      const bay=mod(Math.floor(Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?x-a[0]:z-a[1]),stride);
      const frontEdge=f.key==='shop'?(f.doors[0]?.edge??0):0;
      const railEdge=f.railEdges?.[edge];
      const classroomEdge=f.blueprint==='school'||f.blueprint==='ring';
      const span=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const retailEdge=f.shopEdges?.[edge]&&span>=3.4;
      const facade=facadeBay({program:f.program,level:f.level,entryLevel:v.entryLevel,
        edge,bay,stride,frontEdge,span});
      if(exit){
        // Preserve the physical 2-block exit, but give it an actual wall/lintel
        // above instead of an isolated floating 'entrance' voxel.
        for(let y=floor+3;y<ceiling-1;y++)put(y,kit.body);
        put(ceiling-1,cityPart('entrance',kit.entrance),turn,true);
      }else if(railEdge){
        if(!reservedPassage(floor)){
          const outward=outwardTurn(b[1]-a[1],a[0]-b[0]);
          const gallery=corridor?.kind==='open-corridor';
          put(floor,cityPart(gallery?'passage':'balcony',gallery?4:2),outward,true,
            gallery?CITY_STAIR_STYLE|(bay%3===0?8:0):0);
          if(gallery&&bay===0)for(let y=floor+1;y<ceiling;y++)put(y,cityPart('column',0),turn,true);
        }
      }else{
        for(let y=floor;y<ceiling;y++){
          let id=kit.body;
          if(retailEdge&&y===ceiling-1&&bay>=1&&bay<=3)
            id=cityPart('sign',f.blueprint==='department'?0:3);
          else if((facade.opening==='shopfront'||retailEdge&&bay>0)&&(y===floor+1||y===floor+2)&&y<ceiling-1)
            id=cityPart('window',y===floor+2?3:kit.window);
          else if((facade.opening==='window'||classroomEdge&&span>=4.5&&bay>0&&bay<4)&&(y===floor+2||y===floor+3)&&y<ceiling-1)
            id=cityPart('window',f.program==='housing'?4:kit.window);
          else if(facade.vent&&y===floor+2&&y<ceiling-1)
            id=cityPart('ventilation',kit.ventilation);
          else if(facade.sign&&y===ceiling-1)
            id=cityPart('sign',kit.sign);
          put(y,id,turn,true);
        }
      }
    } else if(!hole && step<0 && !onLanding && !atAccess) {
      if(shaftSide&&!corridor) {
        for(let y=floor;y<ceiling;y++)put(y,wallFinish(y));
      } else if(partition) {
        const turn=lineTurn(partition.a,partition.b);
        for(let y=floor;y<ceiling;y++) {
          if(partition.kind==='shopfront'&&(y===floor+1||y===floor+2)&&y<ceiling-1)put(y,cityPart('window',3),turn);
          else if(partition.kind==='classroom-wall'&&y===floor+2&&y<ceiling-1)put(y,cityPart('window',3),turn);
          else put(y,wallFinish(y));
        }
      } else if(door) {
        const turn=lineTurn(door.a,door.b);
        // Shops open onto an actual corridor; private rooms and storage have
        // a single usable door. Signage belongs outside, never on a back wall.
        for(let y=floor+2;y<ceiling;y++)put(y,wallFinish(y));
        const midX=Math.floor((door.a[0]+door.b[0])/2),midZ=Math.floor((door.a[1]+door.b[1])/2);
        const atDoor=midX===xi&&midZ===zi;
        if(atDoor&&doorKind!=='shop') {
          put(floor,B.DOOR,turn>>1);
          put(floor+1,B.DOOR_TOP);
        }
      } else if(corridor) {
        // Older, low-headroom corridors keep their legacy ceiling light;
        // enclosed high corridors use the suspended integrated light panel.
        if(!hasCeiling){
          const overhead=ceilingFixture(f,corridor,x,z,v.id,seed);
          if(overhead===B.FLUORESCENT||overhead===B.BROKEN_FLUORESCENT)put(ceilingY,overhead);
        }
      } else if(room) {
        const desk=room.kind==='classroom'&&x>room.x0+1.3&&x<room.x1-1.3&&z>room.z0+1.3&&z<room.z1-1.3
          &&mod(xi-Math.ceil(room.x0),3)===1&&mod(zi-Math.ceil(room.z0),3)===1;
        const item=desk?{variant:1,turn:v.stairFacing}:furnishRoom(room,x,z,kit,seed);

        if(item){
          const unstocked=hash(xi,f.level,zi,seed^0x631c)<(f.damage??0)*.42;
          // Abandoned storage occurs on upper floors too. Only room-owned
          // furnishing positions are used; walkable corridors stay clear.
          put(floor,unstocked?B.CRATE:cityPart('interior',item.variant),item.turn);
        }
        if(xi===Math.floor((room.x0+room.x1)/2)&&zi===Math.floor((room.z0+room.z1)/2)){
          const lit=f.program==='housing'?B.ROUND_FLUORESCENT:B.FLUORESCENT;
          put(ceiling-1,survivingFixture(lit,xi,ceiling-1,zi,seed,f.lightChance)||B.BROKEN_FLUORESCENT);
        }
      }
    }
    if(atAccess&&empty(ceiling-1)&&mod(xi+zi+v.id,5)===0)
      put(ceiling-1,survivingFixture(B.FLUORESCENT,xi,ceiling-1,zi,seed,f.lightChance)||B.BROKEN_FLUORESCENT,stairWallTurn>>1);
    if(step>=0) {
      // Stamp both half-cells even when their surfaces cross a voxel Y boundary.
      const low=Math.round((f.y+(from??stairs[step]).y-v.y0)*4);
      const high=Math.round((f.y+(to??stairs[step]).y-v.y0)*4);
      const base=Math.ceil(low/4)-1,top=Math.ceil(high/4)-1;
      const id=cityPart('staircase',kit.staircase);
      // A half slab bridges the underside at integer-height transitions.
      if(low%4===1&&empty(base-1))put(base-1,kit.body,undefined,false,0,2);
      for(let y=base;y<=top;y++){
        const a=Math.max(0,Math.min(4,low-y*4)),b=Math.min(4,high-y*4);
        if(a===b)put(y,id,facing,rail&&y===base,CITY_STAIR_STYLE|((b-1)<<3));
        else put(y,id,undefined,false,encodeSplitTread(a,b,facing,rail&&y===base));
      }
    }
    if(onLanding&&step<0) {
      const surface=f.y+landing.y-v.y0;
      const profile=encodeCityStair(surface,facing);
      put(profile.base,cityPart('staircase',kit.staircase),facing,false,
       CITY_STAIR_STYLE|(profile.quarter<<3));
    }
    const atrium=f.holes.find(h=>h.kind==='atrium');
    if(atrium&&!hole&&edge<0) {
      const outward=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>containsRect(atrium,x+dx,z+dz));
      if(outward&&empty(floor)&&!reservedPassage(floor))put(floor,cityPart('balcony',2),outwardTurn(...outward));
    }
  }
}

function stampAnnex(part,x,z,put,empty) {
  const y=Math.round(part.y),[a,b]=[part.a,part.b],length=Math.hypot(b[0]-a[0],b[2]-a[2]);
  const dx=(b[0]-a[0])/length,dz=(b[2]-a[2])/length;
  const along=(x-a[0])*dx+(z-a[2])*dz;
  const outer=((z-a[2])*dx-(x-a[0])*dz)*part.side;
  const turn=outwardTurn(-dz*part.side,dx*part.side);
  if(empty(y-1))put(y-1,B.METAL_PANEL);
  if(empty(y-2))put(y-2,B.CONCRETE_BEAM);
  if(empty(y+3))put(y+3,B.CEILING_TILE);
  if(outer>1.1||along<.65||along>length-.65) {
    for(let k=0;k<3;k++)if(empty(y+k))put(y+k,cityPart(k===1?'window':'wall',k===1?3:1),turn,true);
  } else if(outer<-.8&&along>length*.22&&along<length*.8&&empty(y+2)) {
    put(y+2,cityPart('sign',1),turn,true);
  } else if(outer>.2&&(along<1.2||along>length-1.2)&&empty(y))put(y,cityPart('interior',0),turn);
}

function stampWalkway(link,part,x,z,put,empty,centerX,centerZ,seed) {
  if(part.kind==='annex-bay'){stampAnnex(part,x,z,put,empty);return;}
  const surface=part.y??segmentY(part,x,z);
  const level=Math.round(surface),style=link.architecture??'open';
  if(part.kind==='deck'||!part.from||!part.to){
    if(empty(level-1))put(level-1,style==='hung'?B.METAL_PANEL:B.FLOOR_TILE);
  }else{
    // Graded bridge sections also receive ONE real tread rather than a
    // staircase made from full-height tiled cubes with 1 m vertical jumps.
    const vx=part.to[0]-part.from[0],vz=part.to[2]-part.from[2];
    const profile=encodeCityStair(surface,outwardTurn(vx,vz));
    if(empty(profile.base))put(profile.base,cityPart('staircase',2),
      profile.facing,false,CITY_STAIR_STYLE|(profile.quarter<<3));
  }
  if(!part.from)return;
  const dx=(part.to[0]-part.from[0])/part.length,dz=(part.to[2]-part.from[2])/part.length;
  const sx=x-part.from[0],sz=z-part.from[2],along=sx*dx+sz*dz,lateral=sz*dx-sx*dz;
  const doorDistance=Math.min(...link.ports.map(p=>Math.hypot(p.x-x,p.z-z)),
    ...(link.kind==='roof'?[Math.hypot(link.points.at(-1)[0]-x,link.points.at(-1)[2]-z)]:[]));
  const junction=walkwayJunction({along,span:part.length,width:link.width,
    doorDistance,sideDistance:Math.abs(lateral)});
  const edge=junction.parapet;
  if(junction.open)return;
  const storefront=link.typology==='annex'&&link.landings.some(p=>p.kind==='annex-bay'&&lineDistance(x,z,[p.a[0],p.a[2]],[p.b[0],p.b[2]])<2.4);
  const turn=outwardTurn(-dz*Math.sign(lateral),dx*Math.sign(lateral));
  const bay=mod(Math.floor(along),7);
  // Each route meets an actual landing with a cantilever bracket beneath the
  // parapet. The doorway itself stays unobstructed at player height.
  if(edge&&(junction.endSupport||style!=='hung'&&bay<=1)&&empty(level-2))
    put(level-2,B.CONCRETE_BEAM);
  if(style==='enclosed'||style==='arcade'||style==='hung') {
    const roofY=level+(style==='hung'?4:3);
    if(empty(roofY)&&(style!=='hung'||edge||bay===0))put(roofY,style==='enclosed'?B.CEILING_TILE:B.CONCRETE_BEAM);
  }
  const guardY=part.kind==='deck'?level:Math.ceil(surface);
  if(edge&&!storefront&&empty(guardY)) {
    if(style==='enclosed'){
      const face=enclosedPassageBay(bay);
      put(guardY,cityPart('wall',1),turn,true);
      if(empty(guardY+1))put(guardY+1,cityPart(face.window?'window':'wall',face.window?3:1),turn,true);
      if(empty(guardY+2))put(guardY+2,cityPart(face.vent?'ventilation':'wall',1),turn,true);
    } else {
      // A continuous guardrail replaces three posts per independent module.
      put(guardY,cityPart('passage',4),turn,true,CITY_STAIR_STYLE|(mod(Math.floor(along),3)===0?8:0));
      if(bay===0&&(style==='arcade'||style==='hung')){
        for(let y=level+1;y<level+(style==='hung'?4:3);y++)if(empty(y))put(y,cityPart('column',3),turn,true);
      }
    }
  }
  if(!edge&&bay===2&&style!=='open'&&empty(level+2)){
   const distance=Math.hypot(x-centerX,z-centerZ);
   const lit=survivingFixture(B.FLUORESCENT,x,level+2,z,seed,lightProbability(distance));
   put(level+2,lit||B.BROKEN_FLUORESCENT,axisTurn(dx,dz));
  }
  // The skybridge has no independent shop signage unless an actual annex bay exists.
}

/** Rasterize floors and parts into ordinary chunk data shared by the renderer and physics. */
export function stampCityChunk(chunk,seed,cityBlueprints=true) {
  const plan=createCityPlan(seed,cityBlueprints),{layout,left,top,step,size}=plan;
  for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++) {
    const x=chunk.cx*SIZE+lx+.5,z=chunk.cz*SIZE+lz+.5;
    const gx=Math.floor((x-left)/step),gz=Math.floor((z-top)/step);
    if(gx<0||gz<0||gx>=size||gz>=size)continue;
    const index=gz*size+gx,zone=zoneAt(layout,x,z);
    const cell=y=>(y*SIZE+lz)*SIZE+lx;
    const empty=y=>y>=0&&y<chunk.height&&!chunk.data[cell(y)];
    const put=(y,id,turn,exterior=false,flags=0,form=0)=>{
      if(y<0||y>=chunk.height)return;
      const i=cell(y);
      chunk.data[i]=id;
      if(form){
        chunk.forms??=new Uint8Array(chunk.data.length);
        chunk.forms[i]=form;
      }else if(chunk.forms)chunk.forms[i]=0;
      if(turn!==undefined){
        chunk.styles??=new Uint8Array(chunk.data.length);
        chunk.styles[i]=TURN_STYLE|turn|(exterior?EXTERIOR_STYLE:0)|flags;
      } else if(flags){
        chunk.styles??=new Uint8Array(chunk.data.length);
        chunk.styles[i]=flags;
      } else if(chunk.styles)chunk.styles[i]=0;
    };
    if(zone!==CORE_ZONE.OUTSIDE&&zone!==CORE_ZONE.SKY_GARDEN&&zone!==CORE_ZONE.MAIN_SHAFT&&zone!==CORE_ZONE.MINI_SHAFT) {
      put(0,B.BEDROCK);
      put(CITY_BASE_Y-1,plan.lanes?.[index]?(mod(Math.floor(x)+Math.floor(z),6)===0?B.WET_TILE:B.FLOOR_TILE):B.CONCRETE);
    }
    // Determine each route footprint once; buildings, walkways and the
    // library all consume this same spatial classification.
    const paths=[],reservedLevels=new Set();
    let corePath=false;
    for(const item of plan.pathColumns[index]){
      const {link,part}=item;
      if(!inside(part.outline,x,z))continue;
      paths.push(item);
      if(link.kind==='core')corePath=true;
      const level=Math.round(part.y??segmentY(part,x,z));
      reservedLevels.add(level-1);reservedLevels.add(level);reservedLevels.add(level+1);
    }
    const reservedPassage=y=>reservedLevels.has(y);
    for(const v of plan.columns[index])stampBuilding(v,plan.details[v.id],x,z,seed,put,empty,reservedPassage,chunk.height);
    for(const {link,part} of paths){
      if(link.kind!=='tower')stampWalkway(link,part,x,z,put,empty,layout.centerX,layout.centerZ,seed);
    }
    const library=plan.library;
    if(Math.abs(x-library.x)<=library.radius+4&&Math.abs(z-library.z)<=library.radius+4){
      stampCoreLibrary(library,x,z,put,empty,corePath);
    }
    const tower=plan.tower;
    if(Math.abs(x-tower.x)<=tower.radius+4&&Math.abs(z-tower.z)<=tower.radius+4)
      stampCoreTower(tower,x,z,put);
  }
  return chunk;
}
