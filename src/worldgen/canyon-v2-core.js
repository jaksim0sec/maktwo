import {BLOCK as B} from '../core/blocks.js';
import {createCityPlan,prepareCityPlan,CITY_BOTANICAL_VERSION,stampWalkway} from './eternal-night-game.js';
import {CORE_ZONE,zoneAt} from './eternal-night-core-floor.js';
import {insidePolygon} from './eternal-night-buildings.js';
import {stampCoreLibrary} from './eternal-night-library.js';
import {stampCoreTower} from './eternal-night-tower.js';
import {stampElevatedStationColumn} from './eternal-night-station-build.js';
import {addCanyonRoute} from './canyon-v2-plan.js';

let cached;
export function canyonCore(seed){
 if(cached?.layout.seed!==seed)cached=createCityPlan(seed,CITY_BOTANICAL_VERSION);
 return cached;
}
export async function prepareCanyonCore(seed){
 if(cached?.layout.seed!==seed)cached=await prepareCityPlan(seed,CITY_BOTANICAL_VERSION);
 return cached;
}

const routesByCore=new WeakMap();
export function coreApproaches(core){
 if(routesByCore.has(core))return routesByCore.get(core);
 const routes=[];
 for(const site of core.stations){
  const axisX=site.axis==='x';
  for(const exit of site.exits){
   const along=Math.floor((axisX?site.x:site.z)+exit.along);
   const edge=Math.floor(axisX?(site.bounds.z1-site.bounds.z0)/2:(site.bounds.x1-site.bounds.x0)/2);
   const first=exit.side*(edge-1),span=site.y-core.layout.floorY+11;
   const point=(offset,y)=>axisX?[along,y,site.z+offset]:[site.x+offset,y,along];
   addCanyonRoute(routes,'station-entry',[point(first,site.y),point(exit.side*(edge+span),core.layout.floorY)],3);
  }
 }
 routesByCore.set(core,routes);
 return routes;
}

export function stampCanyonCoreColumn(core,x,z,put,empty,yMin,yMax,stairSlots){
 const {layout,library,tower}=core;
 const zone=zoneAt(layout,x,z);
 if(zone===CORE_ZONE.OUTSIDE)return;
 if(zone!==CORE_ZONE.SKY_GARDEN&&zone!==CORE_ZONE.MAIN_SHAFT&&zone!==CORE_ZONE.MINI_SHAFT){
  for(let y=layout.slabBottom;y<layout.floorY;y++){
   if(stairSlots.some(surface=>y>=surface-1e-6&&y<surface+3))continue;
   put(y,y===layout.floorY-1&&zone===CORE_ZONE.MAIN_ROUTE?B.FLOOR_TILE:B.CONCRETE);
  }
 }
 const radius=Math.hypot(x-layout.centerX,z-layout.centerZ);
 if(radius<=library.radius+4&&yMin<=library.crown&&yMax>library.base){
  const gx=Math.floor((x-core.left)/core.step),gz=Math.floor((z-core.top)/core.step);
  let corePath=false;
  for(const {link,part} of core.pathColumns[gz*core.size+gx]||[]){
   if(link.kind!=='core'||!insidePolygon(part.outline,x,z))continue;
   corePath=true;
   stampWalkway(link,part,x,z,put,empty,layout.centerX,layout.centerZ,layout.seed);
  }
  stampCoreLibrary(library,x,z,put,empty,corePath);
 }
 if(radius<=tower.radius+4)stampCoreTower(tower,x,z,put);
 if(yMin<45&&yMax>6)stampElevatedStationColumn(core,x,z,put);
}
