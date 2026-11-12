import {SIZE,TURN_STYLE,EXTERIOR_STYLE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {containsRect,insidePolygon} from './eternal-night-buildings.js';
import {CORE_ZONE,createFloorLayout,zoneAt} from './eternal-night-core-floor.js';
import {createDistrictPlan} from './eternal-night-districts.js';
import {cityFloorKit,cityKits,cityPart} from './eternal-night-kits.js';
import {segmentY} from './eternal-night-walkways.js';

export const CITY_MODE='eternal-city-lab';
export const CITY_BASE_Y=8;
export const CITY_HEIGHT=768;
export const CITY_WIDTH=960;
let cached;

export function createCityPlan(seed) {
  if(cached?.layout.seed===seed)return cached;
  const layout=createFloorLayout({seed,width:CITY_WIDTH,floorY:CITY_BASE_Y,floorHeight:CITY_HEIGHT-CITY_BASE_Y-1});
  const plan=createDistrictPlan(layout,120,{unit:1.5,buildingDensity:.88,highRise:true});
  plan.details=plan.volumes.map(v=>{
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

export function* citySpawnCandidates(seed) {
  const plan=createCityPlan(seed);
  const entries=plan.walkways.filter(link=>link.kind==='core').map(link=>link.ports[0]);
  for(const entry of entries)for(const depth of [2,3,4]) {
    const x=Math.floor(entry.x-entry.dx*depth)+.5,z=Math.floor(entry.z-entry.dz*depth)+.5;
    yield {x,y:Math.round(entry.y),z};
  }
  for(const v of plan.volumes) {
    const f=v.floors[0], spine=f.corridors[0];
    const x=Math.floor((spine.x0+spine.x1)/2)+.5,z=Math.floor((spine.z0+spine.z1)/2)+.5;
    yield {x,y:Math.round(f.y),z};
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
  const door=f.rooms.find(({door})=>lineDistance(x,z,door.a,door.b)<.70)?.door;
  const partition=!door&&f.partitions.find(({a,b})=>lineDistance(x,z,a,b)<.56);
  return {edge,room,door,partition,corridor:f.corridors.some(r=>containsRect(r,x,z))};
}

function stampBuilding(v,detail,x,z,seed,put,empty) {
  const xi=Math.floor(x),zi=Math.floor(z),{stairs,landing,access,kits}=detail;
  const step=stairs.findIndex(t=>containsRect(t,x,z));
  const onLanding=landing&&containsRect(landing,x,z);
  const atAccess=access&&containsRect(access,x,z);
  const shaft=v.roof.holes[0], stairAlongX=v.stairFacing===2;
  const shaftSide=shaft&&(stairAlongX
    ? x>=shaft.x0&&x<shaft.x1&&(Math.abs(z-shaft.z0)<1.1||Math.abs(z-shaft.z1)<1.1)
    : z>=shaft.z0&&z<shaft.z1&&(Math.abs(x-shaft.x0)<1.1||Math.abs(x-shaft.x1)<1.1));
  const stairWallTurn=stairAlongX?0:2;
  const shapeCache=new Map();
  const columnHash=hash(xi,v.id,zi,seed);
  const roofY=Math.round(v.roof.y);
  if(inside(v.roof.outline,x,z)&&!(shaft&&containsRect(shaft,x,z)))put(roofY-1,kits.at(-1).body);
  let lastShape=null;
  for(const f of v.floors) {
    if(!shapeCache.has(f.key))shapeCache.set(f.key,inspectShape(f,x,z));
    const shape=shapeCache.get(f.key);
    const kit=kits[f.level],floor=Math.round(f.y),ceiling=Math.round(f.top)-1;
    if(!shape) {
      // Recessed upper floors expose the roof of the previous mass as a terrace.
      if(lastShape&&lastShape.edge>=0&&columnHash>.54) {
        const previous=v.floors[f.level-1].outline;
        put(floor,cityPart('balcony',kit.balcony),lineTurn(previous[lastShape.edge],previous[(lastShape.edge+1)%previous.length]),true);
      }
      lastShape=shape;
      continue;
    }
    lastShape=shape;
    const {edge,corridor,room,door,partition}=shape;
    const hole=f.holes.some(h=>containsRect(h,x,z));
    if(!hole)put(floor-1,kit.floor);
    // An exposed underside still needs a slab even where the next storey steps back.
    const next=v.floors[f.level+1];
    if((!next||!inside(next.outline,x,z))&&!(shaft&&containsRect(shaft,x,z)))put(ceiling,kit.body);
    if(edge>=0) {
      const a=f.outline[edge],b=f.outline[(edge+1)%f.outline.length],turn=lineTurn(a,b);
      const exit=f.doors.find(d=>Math.abs((x-d.x)*d.dz-(z-d.z)*d.dx)<d.width/2+.38&&Math.abs((x-d.x)*d.dx+(z-d.z)*d.dz)<1.20);
      const bay=mod(Math.floor(Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1])?x-a[0]:z-a[1]),kit.wall===4?6:5);
      if(exit) {
        put(ceiling-1,cityPart('entrance',kit.entrance),turn,true);
      } else {
        const column=bay===0 && edge%2===0;
        const blank=f.program==='workshops'?bay<3:f.program==='housing'?bay%2===0:bay===4;
        for(let y=floor;y<ceiling;y++) {
          const window=!column&&!blank&&y>=floor+(f.program==='workshops'?2:1)&&y<=ceiling-2;
          const id=column?cityPart('column',kit.column):window?cityPart('window',kit.window):
            (bay===4||edge%2||f.level===0?cityPart('wall',kit.wall):kit.body);
          put(y,id,turn,true);
        }
        if(columnHash>.985 && f.level%5===2)put(ceiling-1,cityPart('ventilation',kit.ventilation),turn,true);
        if((f.level===v.entryLevel||f.doors.length)&&f.doors.some(d=>Math.abs((x-d.x)*d.dx+(z-d.z)*d.dz)<1.2&&Math.abs((x-d.x)*d.dz-(z-d.z)*d.dx)<4)) {
          put(ceiling-1,cityPart('sign',kit.sign),turn,true);
          if(bay===0&&ceiling-floor>=5)put(ceiling-2,cityPart('sign',(kit.sign+1)%5),turn,true);
        }
      }
    } else if(!hole && step<0 && !onLanding && !atAccess) {
      if(shaftSide&&!corridor) {
        for(let y=floor;y<ceiling;y++)put(y,cityPart('wall',kit.wall),stairWallTurn);
      } else if(partition) {
        const turn=lineTurn(partition.a,partition.b);
        for(let y=floor;y<ceiling;y++)put(y,cityPart('partition',kit.partition),turn);
      } else if(door) {
        const turn=lineTurn(door.a,door.b);
        if(room && room.kind!=='shop' && columnHash>.57 &&
           Math.floor((door.a[0]+door.b[0])/2)===xi && Math.floor((door.a[1]+door.b[1])/2)===zi) {
          put(floor,B.DOOR,turn>>1);
          put(floor+1,B.DOOR_TOP);
        } else if(f.program==='shops'||f.program==='market'||f.program==='exchange') {
          put(ceiling-1,cityPart('sign',kit.sign),turn);
          // Some stores are shuttered, leaving the shared market aisle free.
          if(columnHash>.93)put(floor,cityPart('door',3),turn);
          if(columnHash>.81&&ceiling-floor>=4)put(ceiling-2,cityPart('sign',(kit.sign+1)%5),turn);
        }
      } else if(corridor && mod(xi+zi+v.id,7)===0) {
        put(ceiling-1,cityPart('interior',2),stairWallTurn);
      } else if(room) {
        const wallDistance=Math.min(x-room.x0,room.x1-x,z-room.z0,room.z1-z);
        const turn=outwardTurn(x-(room.x0+room.x1)/2,z-(room.z0+room.z1)/2);
        if(wallDistance<1.65&&columnHash>.79) {
          const index=Math.floor(hash(xi,f.band,zi,seed)*kit.interior.length);
          put(floor,cityPart('interior',kit.interior[index]),turn);
          if(room.kind==='service'&&columnHash>.91)put(floor+1,cityPart('door',kit.door),turn);
        } else if(wallDistance>1.9&&mod(xi+v.id,5)===0&&mod(zi+v.type,4)===0) {
          put(floor,cityPart('interior',room.kind==='service'?4:1),turn);
        }
      }
    }
    if(atAccess&&columnHash>.53&&ceiling-floor>=4)put(ceiling-1,cityPart('stairEntrance',kit.stairEntrance),v.stairFacing);
    if(step>=0) {
      const surface=f.y+stairs[step].y-v.y0;
      const facing=mod(v.stairFacing+(step>=stairs.length/2?4:0),8);
      const base=Math.max(floor,Math.floor(surface-.18));
      put(base,cityPart('staircase',kit.staircase),facing);
    }
    if(onLanding) {
      const surface=Math.round((f.y+landing.y-v.y0)*2)/2,base=Math.floor(surface);
      if(surface>base)put(base,B.CONCRETE_SLAB);
      else put(base-1,kit.floor);
    }
    const atrium=f.holes.find(h=>h.kind==='atrium');
    if(atrium&&!hole&&edge<0) {
      const outward=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>containsRect(atrium,x+dx,z+dz));
      if(outward&&empty(floor))put(floor,cityPart('balcony',kit.balcony),outwardTurn(...outward));
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

function stampWalkway(link,part,x,z,put,empty) {
  if(!inside(part.outline,x,z))return;
  if(part.kind==='annex-bay'){stampAnnex(part,x,z,put,empty);return;}
  const level=Math.round(part.y??segmentY(part,x,z));
  const style=link.architecture??'open';
  if(empty(level-1))put(level-1,style==='hung'?B.METAL_PANEL:B.FLOOR_TILE);
  if(!part.from||link.kind==='roof')return;
  const dx=(part.to[0]-part.from[0])/part.length,dz=(part.to[2]-part.from[2])/part.length;
  const sx=x-part.from[0],sz=z-part.from[2],along=sx*dx+sz*dz,lateral=sz*dx-sx*dz;
  const edge=Math.abs(lateral)>link.width/2-.95;
  const gate=link.ports.some(p=>Math.hypot(p.x-x,p.z-z)<2.15);
  if(gate)return;
  const storefront=link.typology==='annex'&&link.landings.some(p=>p.kind==='annex-bay'&&lineDistance(x,z,[p.a[0],p.a[2]],[p.b[0],p.b[2]])<2.4);
  const turn=outwardTurn(-dz*Math.sign(lateral),dx*Math.sign(lateral));
  const bay=mod(Math.floor(along),7);
  if(edge&&style!=='hung'&&bay<=1&&empty(level-2))put(level-2,B.CONCRETE_BEAM);
  if(style==='enclosed'||style==='arcade'||style==='hung') {
    const roofY=level+(style==='hung'?4:3);
    if(empty(roofY)&&(style!=='hung'||edge||bay===0))put(roofY,style==='enclosed'?B.CEILING_TILE:B.CONCRETE_BEAM);
  }
  if(edge&&!storefront&&empty(level)) {
    if(style==='enclosed'){
      put(level,cityPart('wall',1),turn,true);
      if(empty(level+1))put(level+1,cityPart('window',3),turn,true);
      if(empty(level+2))put(level+2,cityPart('window',3),turn,true);
    } else {
      put(level,cityPart('passage',style==='arcade'&&bay===0?2:4),turn,true);
      if(bay===0&&(style==='arcade'||style==='hung')){
        for(let y=level+1;y<level+(style==='hung'?4:3);y++)if(empty(y))put(y,cityPart('column',3),turn,true);
      }
    }
  }
  if(!edge&&bay===2&&style!=='open'&&empty(level+2))put(level+2,B.FLUORESCENT,axisTurn(dx,dz));
  if(edge&&bay===4&&style==='enclosed'&&empty(level+3))put(level+3,cityPart('sign',3),turn,true);
}

/** Rasterize floors and parts into ordinary chunk data shared by the renderer and physics. */
export function stampCityChunk(chunk,seed) {
  const plan=createCityPlan(seed),{layout,left,top,step,size}=plan;
  for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++) {
    const x=chunk.cx*SIZE+lx+.5,z=chunk.cz*SIZE+lz+.5;
    const gx=Math.floor((x-left)/step),gz=Math.floor((z-top)/step);
    if(gx<0||gz<0||gx>=size||gz>=size)continue;
    const index=gz*size+gx,zone=zoneAt(layout,x,z);
    const cell=y=>(y*SIZE+lz)*SIZE+lx;
    const empty=y=>y>=0&&y<chunk.height&&!chunk.data[cell(y)];
    const put=(y,id,turn,exterior=false)=>{
      if(y<0||y>=chunk.height)return;
      const i=cell(y);
      chunk.data[i]=id;
      if(turn!==undefined){
        chunk.styles??=new Uint8Array(chunk.data.length);
        chunk.styles[i]=TURN_STYLE|turn|(exterior?EXTERIOR_STYLE:0);
      } else if(chunk.styles)chunk.styles[i]=0;
    };
    if(zone!==CORE_ZONE.OUTSIDE&&zone!==CORE_ZONE.SKY_GARDEN&&zone!==CORE_ZONE.MAIN_SHAFT&&zone!==CORE_ZONE.MINI_SHAFT) {
      put(0,B.BEDROCK);
      put(CITY_BASE_Y-1,plan.lanes?.[index]?(mod(Math.floor(x)+Math.floor(z),6)===0?B.WET_TILE:B.FLOOR_TILE):B.CONCRETE);
    }
    for(const v of plan.columns[index])stampBuilding(v,plan.details[v.id],x,z,seed,put,empty);
    for(const {link,part} of plan.pathColumns[index])stampWalkway(link,part,x,z,put,empty);
  }
  return chunk;
}
