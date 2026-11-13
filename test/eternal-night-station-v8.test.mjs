import test from 'node:test';
import assert from 'node:assert/strict';
import {createFloorLayout,CORE_FLOOR_DEFAULTS} from '../src/worldgen/eternal-night-core-floor.js';
import {createCityPlan,CITY_MODE,CITY_STATION_VERSION,CITY_STATION_REDESIGN_VERSION} from '../src/worldgen/eternal-night-game.js';
import {stampElevatedStationColumn} from '../src/worldgen/eternal-night-station-build.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {EntityManager} from '../src/entities/entities.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';

test('core road half width is .025 in v8 and remains .01 in saved v7',()=>{
 const earlier=createCityPlan(9999,7),next=createCityPlan(9999,8);
 assert.equal(CORE_FLOOR_DEFAULTS.ratios.roadHalfWidth,.025);
 assert.equal(earlier.layout.roadHalfWidth,earlier.layout.halfWidth*.01);
 assert.equal(next.layout.roadHalfWidth,next.layout.halfWidth*.025);
 assert.equal(next.layout.roadHalfWidth/earlier.layout.roadHalfWidth,2.5);
 assert.equal(earlier.stations.length,4);
 assert.equal(next.stations.length,4);
 assert.equal(CITY_STATION_VERSION,7);
 assert.equal(CITY_STATION_REDESIGN_VERSION,8);
 for(const site of next.stations){
  const old=earlier.stations[site.id],along=site.axis==='x'?'x':'z';
  assert.equal(site.y,old.y,'the new rails meet the library without a grade');
  assert.ok(site.bounds[along+'1']-site.bounds[along+'0']>=60);
  assert.ok(site.exits.length>0);
  assert.equal(site.approach.from[1],old.hubLevel,'approach must start at old library level');
  assert.equal(site.approach.to[1],site.y);
 }
});

test('four station platforms, roof vaults and low-height corridors are present',()=>{
 const plan=createCityPlan(9999,8);
 const exposed=[];
 for(const site of plan.stations){
  const material=new Map(),put=(y,id)=>material.set(y,id);
  const x=Math.round(site.x)+(site.axis==='z'?4:0);
  const z=Math.round(site.z)+(site.axis==='x'?4:0);
  stampElevatedStationColumn(plan,x,z,put);
  assert.equal(material.get(site.y-1),B.STATION_PLATFORM_ORANGE,'safety strip beside tactile zone');
  let roofs=0,skylights=0;
  for(let off=-8;off<=8;off++){
   const values=new Map();
   stampElevatedStationColumn(plan,Math.round(site.x)+(site.axis==='x'?off:0),
    Math.round(site.z)+(site.axis==='z'?off:0),(y,id)=>values.set(y,id));
   const sealed=[...values].filter(([y,id])=>y>=site.y+9&&y<=site.y+13&&id!==B.AIR);
   if(sealed.length)roofs++;if(sealed.some(([,id])=>id===B.DIRTY_GLASS))skylights++;
  }
  assert.ok(roofs>=8,site.id+' vault canopy');
  assert.ok(skylights>=1,site.id+' skylight span');
  exposed.push(site.y);
 }
 assert.equal(exposed.length,4);
 assert.equal(new Set(exposed).size,2);
});

test('legacy city snapshots are not silently migrated to new suspended station geometry',()=>{
 const key='mcweb:EternalNightCityLab:precincts',save=JSON.stringify({
  seed:9999,mode:CITY_MODE,generationVersion:7,time:18000,edits:{},states:[],forms:[],mounts:[]
 });
 const storage={getItem:k=>k===key?save:null,setItem(){}};
 const old=new World({seed:9999,mode:CITY_MODE,name:'EternalNightCityLab',storage});
 const fresh=new World({seed:9999,mode:CITY_MODE,name:'EternalNightCityV8'});
 assert.equal(old.version,7);
 assert.equal(fresh.version,8);
 assert.ok(WORLD_PRESETS.some(p=>p.name==='EternalNightCityV8'));
 assert.equal(new EntityManager(fresh).entities.filter(e=>e.type==='train').length,4);
 for(const e of new EntityManager(fresh).entities.filter(e=>e.type==='train')){
  assert.ok(e.minOffset<0);
  assert.ok(e.maxOffset>0);
 }
});
