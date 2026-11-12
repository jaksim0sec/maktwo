import {HEIGHT,SIZE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {containsRect,cutPolygon} from './eternal-night-buildings.js';
import {CORE_ZONE,createFloorLayout,zoneAt} from './eternal-night-core-floor.js';
import {createDistrictPlan} from './eternal-night-districts.js';
import {segmentY} from './eternal-night-walkways.js';

export const CITY_MODE='eternal-city-lab';
export const CITY_BASE_Y=4;
let cached;

function city(seed) {
  if(cached?.layout.seed===seed)return cached;
  const layout=createFloorLayout({seed,width:320,floorY:CITY_BASE_Y,floorHeight:HEIGHT-CITY_BASE_Y-1});
  cached=createDistrictPlan(layout,64,{unit:1.25,buildingDensity:.57});
  cached.steps=new Map(cached.volumes.map(v=>[v.id,v.stairs.map(s=>[...s.treads,s.landing])]));
  return cached;
}

function lineDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}

function inside(outline,x,z) {
  const range=cutPolygon(outline,'x',z);
  return range && x>=range[0] && x<range[1];
}

export function* citySpawnCandidates(seed) {
  const plan=city(seed);
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

/** Rasterize the same floor plans as the sectional preview into ordinary chunk data. */
export function stampCityChunk(chunk,seed) {
  const plan=city(seed),{layout,left,top,step,size}=plan;
  for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++) {
    const x=chunk.cx*SIZE+lx+.5,z=chunk.cz*SIZE+lz+.5;
    const gx=Math.floor((x-left)/step),gz=Math.floor((z-top)/step);
    if(gx<0||gz<0||gx>=size||gz>=size)continue;
    const index=gz*size+gx,zone=zoneAt(layout,x,z);
    const put=(y,id)=>{if(y>=0&&y<HEIGHT)chunk.data[(y*SIZE+lz)*SIZE+lx]=id;};
    if(zone!==CORE_ZONE.OUTSIDE&&zone!==CORE_ZONE.SKY_GARDEN&&zone!==CORE_ZONE.MAIN_SHAFT&&zone!==CORE_ZONE.MINI_SHAFT) {
      put(0,B.BEDROCK);
      put(CITY_BASE_Y-1,B.CONCRETE);
    }
    for(const v of plan.columns[index]) {
      if(inside(v.roof.outline,x,z)&&!v.roof.holes.some(h=>containsRect(h,x,z)))put(Math.round(v.roof.y)-1,B.CONCRETE);
      const stairs=plan.steps.get(v.id);
      for(const f of v.floors) {
        if(!inside(f.outline,x,z))continue;
        const bottom=Math.round(f.y), ceiling=Math.round(f.top)-1;
        const hole=f.holes.some(h=>containsRect(h,x,z));
        if(!hole)put(bottom-1,B.FLOOR_TILE);
        let edge=-1;
        for(let i=0;i<f.outline.length;i++) {
          if(lineDistance(x,z,f.outline[i],f.outline[(i+1)%f.outline.length])<.82){edge=i;break;}
        }
        const exteriorDoor=edge>=0&&f.doors.some(d=>d.edge===edge&&Math.abs((x-d.x)*d.dz-(z-d.z)*d.dx)<d.width/2+.3);
        const roomDoor=f.rooms.some(({door})=>lineDistance(x,z,door.a,door.b)<.72);
        const partition=!hole&&!roomDoor&&f.partitions.some(({a,b})=>lineDistance(x,z,a,b)<.51);
        if(edge>=0||partition)for(let y=bottom;y<ceiling;y++) {
          if(exteriorDoor&&y<bottom+3)continue;
          const window=edge>=0&&!exteriorDoor&&edge%2===0&&y>bottom&&y<ceiling-1&&
            ((Math.floor(edge===0||edge===4?x+z:x-z)%5+5)%5)<2;
          put(y,window?B.DIRTY_GLASS:partition?B.STAINED_PLASTER:B.CONCRETE);
        }
        if(!hole&&edge<0&&!partition&&f.corridors.some(r=>containsRect(r,x,z))&&
          Math.floor(x)%4===0&&Math.floor(z)%4===0)put(ceiling-1,B.FLUORESCENT);
        for(const tread of stairs[f.level])if(containsRect(tread,x,z))put(Math.round(tread.y)-1,B.CONCRETE);
      }
    }
    for(const {link,part} of plan.pathColumns[index]) {
      if(link.kind==='roof'||!inside(part.outline,x,z))continue;
      const level=part.y??segmentY(part,x,z);
      put(Math.round(level)-1,link.kind==='bridge'?B.METAL_PANEL:B.FLOOR_TILE);
    }
  }
  return chunk;
}
