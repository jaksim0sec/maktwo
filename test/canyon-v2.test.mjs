import assert from 'node:assert/strict';
import test from 'node:test';
import {BLOCK as B} from '../src/core/blocks.js';
import {collides} from '../src/core/physics.js';
import {World} from '../src/core/world.js';
import {Player} from '../src/entities/entities.js';
import {CANYON_MODE,canyonBay,canyonShelter} from '../src/worldgen/canyon-v2-plan.js';

const seed=9999;
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
