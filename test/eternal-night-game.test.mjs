import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B,block} from '../src/core/blocks.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {Player} from '../src/entities/entities.js';

test('city lab spawns on a walkable building floor with air and a ceiling',()=>{
  const preset=WORLD_PRESETS.find(p=>p.name==='EternalNightCityLab');
  assert.ok(preset);
  const world=new World(preset);
  const {x,y,z}=world.spawn();
  assert.equal(world.get(x,y-1,z),B.FLOOR_TILE);
  assert.equal(world.get(x,y,z),B.AIR);
  assert.equal(world.get(x,y+1,z),B.AIR);
  assert.ok([3,4,5,6,7].some(d=>block(world.get(x,y+d,z)).solid));
});

test('a player can walk from the test spawn through the doorway onto the main walkway',()=>{
  const world=new World(WORLD_PRESETS.find(p=>p.name==='EternalNightCityLab'));
  const {x,y,z}=world.spawn();
  const player=new Player(x,y,z);
  player.yaw=Math.PI/2;
  for(let i=0;i<31;i++)player.update(world,1/60,{forward:true});
  assert.ok(player.x<40,'player crossed the exterior doorway');
  assert.ok(Math.abs(player.y-y)<.05&&player.grounded,'the deck supported the player');
});
