import assert from 'node:assert/strict';
import test from 'node:test';
import {BLOCK as B} from '../src/core/blocks.js';
import {collides} from '../src/core/physics.js';
import {World} from '../src/core/world.js';
import {Player,EntityManager} from '../src/entities/entities.js';
import {CANYON_MODE,canyonBay,canyonShelter} from '../src/worldgen/canyon-v2-plan.js';

import {canyonCore,coreApproaches} from '../src/worldgen/canyon-v2-core.js';
import {libraryRoofHeight} from '../src/worldgen/eternal-night-library.js';
import {buildingSilhouette} from '../src/client/city-distance.js';

const seed=9999;
test('V2 far facades retain authored material without adding geometry',()=>{
 const building=canyonBay(seed,5,1).buildings[0];
 const plan={layout:{seed},details:{[building.id]:building.detail}};
 const plain=buildingSilhouette(plan,building,false),textured=buildingSilhouette(plan,building,false,true);
 assert.ok(plain.length>0);
 assert.equal(textured.length,plain.length);
 let texturedFaces=0;
 for(let i=0;i<textured.length;i++){
  if(i%7===6&&textured[i]>=4){texturedFaces++;continue;}
  assert.equal(textured[i],plain[i]);
 }
 assert.ok(texturedFaces>0);
});
test('V2 starts on a clear aisle facing a paired bed',()=>{
 const world=new World({mode:CANYON_MODE,seed});
 const spawn=world.firstSpawn();
 const {head,foot,y,z}=canyonShelter(seed);
 assert.equal(world.get(head,y,z),B.BED);
 assert.equal(world.get(foot,y,z),B.BED_FOOT);
 for(let x=spawn.x;x<head;x+=1)assert(!collides(world,x,y,z+.5));
});

test('the player can climb between city levels through a vertical window shift',()=>{
 const world=new World({mode:CANYON_MODE,seed});
 const stairs=canyonBay(seed,5,1).routes.filter(route=>route.kind==='stairs');
 const first=stairs[0];
 const player=new Player(first.ax+.5,first.ay,first.az+.5);
 for(const route of stairs){
  player.yaw=Math.atan2(-route.dx,-route.dz);
  const remaining=()=>((route.bx+.5-player.x)*route.dx+(route.bz+.5-player.z)*route.dz);
  for(let frame=0;remaining()>.075&&frame<route.length*22+180;frame++){
   player.update(world,1/60,{forward:true});
   player.y-=world.recenterCanyon(player.y);
  }
  assert(Math.abs(remaining())<=.075);
  assert(Math.abs(player.y+world.yOrigin-route.by)<.6);
 }
 assert(world.yOrigin>0);
});

test('voxel edits on absolute levels survive saving outside the active window',()=>{
 const store=new Map();
 const storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const world=new World({mode:CANYON_MODE,seed,storage});
 const {x,y,z}=world.firstSpawn();
 assert(world.set(x,y,z,B.SHOP_BRICK));
 assert(world.recenterCanyon(650)>0);
 assert(world.save());
 const loaded=new World({mode:CANYON_MODE,seed,storage});
 assert.equal(loaded.yOrigin,world.yOrigin);
 assert(loaded.recenterCanyon(y-loaded.yOrigin)<0);
 assert.equal(loaded.get(x,y-loaded.yOrigin,z),B.SHOP_BRICK);
});

test('V2 retains the original octagonal slab, dome and driveable station positions',()=>{
 const world=new World({mode:CANYON_MODE,seed});
 const core=canyonCore(seed);
 const {halfWidth,floorY,diagonalLimit}=core.layout;
 assert.equal(world.get(halfWidth-1,floorY-1,0),B.CONCRETE);
 assert.equal(world.get(halfWidth-1,floorY-1,Math.ceil(diagonalLimit-halfWidth)+5),B.AIR);
 const radius=core.library.radius-4,x=Math.floor(radius/Math.SQRT2)+.5,z=x;
 const roof=Math.floor(libraryRoofHeight(core.library,Math.hypot(x,z)));
 assert.notEqual(world.get(x,roof,z),B.AIR);

 const entities=new EntityManager(world);
 assert.equal(entities.entities.length,4);
 const station=core.stations.find(site=>site.axis==='z'&&site.z>0);
 const train=entities.entities.find(e=>e.stationId===station.id);
 const localY=train.y;
 world.recenterCanyon(station.y);
 assert.equal(train.y+world.yOrigin,localY);
 assert.equal(world.get(station.x+4,station.y-world.yOrigin-1,station.z),B.STATION_PLATFORM_ORANGE);
 const entry=coreApproaches(core).find(path=>path.ax>0&&path.az>180&&path.ay===station.y);
 const player=new Player(entry.bx+.5,entry.by-world.yOrigin,entry.bz+.5);
 player.yaw=Math.atan2(entry.dx,entry.dz);
 for(let frame=0;player.x>entry.ax+.57&&frame<entry.length*22+100;frame++)
  player.update(world,1/60,{forward:true});
 assert(player.x<=entry.ax+.57&&Math.abs(player.y+world.yOrigin-station.y)<.6);
});
