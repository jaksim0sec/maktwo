import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../src/core/world.js';
import {EntityManager} from '../src/entities/entities.js';
import {ObserverPack,OBSERVER_NAME} from '../src/entities/observers.js';
import {CANYON_MODE} from '../src/worldgen/canyon-v2-plan.js';
import {CITY_MODE} from '../src/worldgen/eternal-night-game.js';
import {BLOCK as B} from '../src/core/blocks.js';

const player=(y=40)=>({
 x:0,y,z:0,eye:1.39,width:.6,height:1.53,creative:false,fly:false,
 direction(){return{x:0,y:0,z:-1}}
});
const fakeLocalTerrain=world=>{
 world.getChunk=()=>({});
 world.get=(x,y,z,create=false)=>{
  assert.equal(create,false,'observer must not generate extra chunks');
  return y<40?B.STONE:B.AIR;
 };
 return world;
};
const at=(x,y,z)=>({x,y,z});
test('V2 uses the existing Shy Observer pack without altering its trains',()=>{
 const world=new World({mode:CANYON_MODE,seed:9999});
 const manager=new EntityManager(world);
 assert(manager.observers instanceof ObserverPack,'V2 must construct the observer pack');
 assert.equal(manager.observers.world,world);
 assert.equal(manager.entities.filter(e=>e.type==='train').length,4,'V2 station trains preserved');
 assert.equal(OBSERVER_NAME,'소심한 관찰자');
 fakeLocalTerrain(world);
 manager.observers.next=0;
 manager.observers.tick(.18,player(),48,{aspect:16/9,tan:Math.tan(65*Math.PI/360)});
 assert(manager.observers.active,'existing AI must spawn on V2 local terrain');
 assert(manager.observers.views.length>0,'observers must publish renderable tracks');
});
test('existing regular city still creates observer, other worlds do not',()=>{
 const city=new EntityManager(new World({mode:CITY_MODE,seed:9}));
 const ordinary=new EntityManager(new World({mode:'normal',seed:9}));
 assert(city.observers instanceof ObserverPack);
 assert.equal(ordinary.observers,null);
});
test('V2 vertical window rebase retains observer and all encounter coordinates',()=>{
 const world=fakeLocalTerrain(new World({mode:CANYON_MODE,seed:9999}));
 const pack=new ObserverPack(world,{count:3});
 pack.clock=5;pack.spawn(player(),48);pack.publish(player(),48);
 assert(pack.active&&pack.views.length);
 const g=pack.active,s=g.stalkers.values().next().value;
 s.target=at(s.x+2,s.y,s.z);
 s.sighting={start:at(s.x,s.y,s.z-11),seen:at(s.x,s.y,s.z-1),phase:'approach'};
 g.at=at(s.x+1,s.y,s.z);
 g.members.set(s.id,{hp:1,hitAt:3,at:at(s.x,s.y,s.z)});
 pack.previous=pack.views.map(v=>({...v,previous:at(v.x,v.y,v.z)}));
 pack.lightCache={position:at(0,40,0),at:1,revision:1,lights:[]};
 const before={
  group:g.point.y,stalker:s.y,target:s.target.y,start:s.sighting.start.y,seen:s.sighting.seen.y,
  groupTarget:g.at.y,member:g.members.get(s.id).at.y,
  views:pack.views.map(v=>v.y),previous:pack.previous.map(v=>v.y)
 };
 pack.rebaseVertical(448);
 const after={
  group:g.point.y,stalker:s.y,target:s.target.y,start:s.sighting.start.y,seen:s.sighting.seen.y,
  groupTarget:g.at.y,member:g.members.get(s.id).at.y,
  views:pack.views.map(v=>v.y),previous:pack.previous.map(v=>v.y)
 };
 for(const key of ['group','stalker','target','start','seen','groupTarget','member'])
  assert.equal(after[key],before[key]-448,key);
 for(const key of ['views','previous'])
  assert.deepEqual(after[key],before[key].map(y=>y-448),key);
 assert.equal(pack.lightCache,null,'old-height light candidates must be invalidated');
 assert.equal(s.x,s.target.x-2,'horizontal position unchanged');
});
test('canyon recenter hook shifts active observer with the player',()=>{
 const source=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 assert.match(source,/this\.entities\.observers\?\.rebaseVertical\(shift\)/,
  'V2 recenter must rebase existing observer coordinates, not respawn it');
});
