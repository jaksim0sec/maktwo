import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {addWorldSlot,loadWorldSlots} from '../src/core/world-slots.js';
import {SCHOOL_MODE,SCHOOL_HEIGHT,SCHOOL_GROUND,SCHOOL_PERIOD,schoolVoxel,stampSchoolChunk,schoolSpawn,schoolStyle} from '../src/worldgen/school-v3.js';

const seed=9999,at=(x,y,z,s=seed)=>schoolVoxel(x,y,z,s);
test('V3 has an independent playable world preset and entrance',()=>{
 assert.equal(SCHOOL_MODE,'school-v3');
 assert.equal(SCHOOL_HEIGHT,64);
 assert.equal(SCHOOL_PERIOD,224);
 assert(WORLD_PRESETS.some(p=>p.mode===SCHOOL_MODE&&p.label.includes('하강')));
 const world=new World({seed,mode:SCHOOL_MODE,name:'DescentSchoolV3'});
 assert.equal(world.height,SCHOOL_HEIGHT);
 assert.deepEqual(world.firstSpawn(),schoolSpawn());
 assert.equal(at(0,SCHOOL_GROUND,-31),B.FLOOR_TILE);
 assert.equal(at(0,SCHOOL_GROUND+1,-31),B.AIR);
 assert.equal(at(0,SCHOOL_GROUND+2,-35),B.AIR);
});
test('four floors contain clear corridors, classroom doors and partitions',()=>{
 assert.equal(at(0,13,-40),B.AIR);
 assert.notEqual(at(3,13,-43),B.AIR);
 assert.equal(at(0,13,-43),B.AIR);
 assert.equal(at(0,13,-55),B.AIR);
 for(const floorY of [12,19,26,33])assert.equal(at(0,floorY,-55),B.FLOOR_TILE);
});
test('half treads connect school levels instead of ladders or teleporting',()=>{
 for(const heightOffset of [0,7,14]){
  const side=heightOffset===7?-69:-76,base=12+heightOffset;
  assert.equal(at(side,base+1,-58),B.CONCRETE_SLAB);
  assert.equal(at(side,base+7,-46),B.CONCRETE_SLAB);
  assert.equal(at(side,base+7,-45),B.UPPER_STAIR_TREAD);
 }
});
test('schoolyard, indoor gym, gate and campus road remain separate',()=>{
 assert.equal(at(-25,12,40),B.GRASS);
 assert.equal(at(-74,12,40),B.TERRACOTTA);
 assert.equal(at(90,12,0),B.PLANKS);
 assert.notEqual(at(76,19,0),B.AIR);
 assert.equal(at(49,13,103),B.AIR);
 assert.equal(at(0,13,103),B.FENCE);
 assert.equal(at(107,12,0),B.CONCRETE);
});
test('chunk order and negative district boundaries have identical voxels',()=>{
 const coords=[[0,0],[-1,-3],[-6,-2],[-5,-4],[7,3],[0,-4]];
 const a=coords.map(([x,z])=>stampSchoolChunk(new Chunk(x,z),seed).data);
 const b=coords.slice().reverse().map(([x,z])=>stampSchoolChunk(new Chunk(x,z),seed).data).reverse();
 for(let i=0;i<a.length;i++)assert.deepEqual(a[i],b[i]);
 for(const x of [-226,-224,-1,0,15,16,223,224])for(const z of [-226,-225,-16,-1,0,15,16,223,225]){
  const c=generateChunk(new Chunk(Math.floor(x/16),Math.floor(z/16)),seed,SCHOOL_MODE);
  assert.equal(c.get((x%16+16)%16,12,(z%16+16)%16),at(x,12,z));
 }
});
test('visual finishes vary across seeds but geometry is stable',()=>{
 let changes=0;
 for(let i=0;i<20;i++)if(schoolStyle(i,0,0)!==schoolStyle(i+1,0,0))changes++;
 assert(changes>=4);
 assert.equal(at(0,13,-40,4),at(0,13,-40,5));
});
test('new school saves are isolated from legacy V2 saves',()=>{
 const store=new Map();
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const slot=addWorldSlot(storage,seed,1700000011111,SCHOOL_MODE);
 assert.equal(slot.mode,SCHOOL_MODE);
 assert.equal(loadWorldSlots(storage)[0].name,slot.name);
 const school=new World({name:slot.name,seed,mode:slot.mode,storage});
 assert(school.set(0,13,-39,B.CRATE));
 assert(school.save());
 const canyon=new World({name:'EternalNightCanyonV2',seed,mode:'canyon-v2',storage});
 assert.notEqual(canyon.saveKey,school.saveKey);
 assert.equal(new World({name:slot.name,seed,mode:SCHOOL_MODE,storage}).get(0,13,-39),B.CRATE);
});
