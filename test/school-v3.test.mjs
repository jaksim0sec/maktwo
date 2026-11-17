import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk,TURN_STYLE} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {addWorldSlot,loadWorldSlots} from '../src/core/world-slots.js';
import {SCHOOL_MODE,SCHOOL_HEIGHT,SCHOOL_GROUND,SCHOOL_PERIOD,SCHOOL_STOREY,schoolVoxel,stampSchoolChunk,schoolSpawn,schoolStyle} from '../src/worldgen/school-v3.js';

const seed=9999,at=(x,y,z,s=seed)=>schoolVoxel(x,y,z,s);
test('V3 has an independent playable world preset and entrance',()=>{
 assert.equal(SCHOOL_MODE,'school-v3');
 assert.equal(SCHOOL_HEIGHT,64);
 assert.equal(SCHOOL_PERIOD,224);
 assert(WORLD_PRESETS.some(p=>p.mode===SCHOOL_MODE&&p.label.includes('하강')));
 const world=new World({seed,mode:SCHOOL_MODE,name:'DescentSchoolV3'});
 assert.equal(world.height,SCHOOL_HEIGHT);
 assert.deepEqual(world.firstSpawn(),schoolSpawn());
 assert.equal(schoolSpawn().yaw,0); // face the school entrance (-Z), not the playground
 assert.equal(at(0,SCHOOL_GROUND,-31),B.ARCH_FLOOR_PAVERS);
 assert.equal(at(0,SCHOOL_GROUND+1,-31),B.AIR);
 assert.equal(at(0,SCHOOL_GROUND+2,-35),B.AIR);
});
test('four floors contain clear corridors, classroom doors and partitions',()=>{
 assert.equal(SCHOOL_STOREY,5); // 4m per storey at 0.8m/voxel
 assert.equal(at(1,13,-53),B.AIR); // 3.2m corridor
 assert.equal(at(1,13,-55),B.ARCH_CONCRETE_SMOOTH_PLASTER);
 assert.equal(at(-58,13,-55),B.AIR); // double-width classroom entry
 assert.equal(at(-56,13,-61),B.PART_INTERIOR_2);
 assert.equal(at(-60,14,-60),B.ARCH_METAL_BLACK_PAINT);
 for(const floorY of [12,17,22,27])assert.equal(at(1,floorY,-60),B.ARCH_FLOOR_LINOLEUM);
});
test('half treads connect school levels instead of ladders or teleporting',()=>{
 for(const heightOffset of [0,5,10]){
  const base=12+heightOffset;
  assert.equal(at(-70,base+1,-55),B.CONCRETE_SLAB);
  assert.equal(at(-70,base+3,-59),B.CONCRETE_SLAB);
  assert.equal(at(-65,base+5,-55),B.UPPER_STAIR_TREAD);
  assert.equal(at(-71,base+5,-55),B.ARCH_FLOOR_LINOLEUM);
  assert.equal(at(-68,base+5,-60),B.AIR); // landing headroom
 }
});
test('schoolyard, indoor gym, gate and campus road remain separate',()=>{
 assert.equal(at(-25,12,40),B.GRASS);
 assert.equal(at(-54,12,40),B.TERRACOTTA);
 assert.equal(at(90,12,0),B.ARCH_FLOOR_WOOD);
 assert.notEqual(at(80,19,10),B.AIR);
 assert.equal(at(49,13,103),B.AIR);
 assert.equal(at(0,13,103),B.FENCE);
 assert.equal(at(107,12,0),B.ARCH_FLOOR_ASPHALT);
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

test('facade materials, stair glazing and differentiated ceiling remain continuous',()=>{
 assert.equal(at(1,16,-65),B.ARCH_TILE_LARGE_PORCELAIN);
 assert.equal(at(78,16,-20),B.ARCH_TILE_LARGE_PORCELAIN);
 assert.equal(at(1,16,-60),B.CEILING_FINISH);
 assert.equal(at(0,13,-43),B.AIR);
 assert.equal(at(0,18,-40),B.ARCH_METAL_GALVANIZED);
 assert.notEqual(at(-75,14,-58),B.AIR);
});
test('existing architectural parts retain real rotation in a generated chunk',()=>{
 const chunk=stampSchoolChunk(new Chunk(-5,-3),seed);
 assert.equal(chunk.get(2,14,6),B.PART_WINDOW_1);
 assert.equal(chunk.styles[Chunk.index(2,14,6)],TURN_STYLE|2);
 assert.equal(at(-78,14,-42),B.PART_WINDOW_1);
});
test('main building wings and schoolyard do not overwrite each other',()=>{
 assert.equal(at(-78,13,0),B.ARCH_TILE_LARGE_PORCELAIN);
 assert.equal(at(-61,13,7),B.AIR);
 assert.equal(at(0,12,-33),B.ARCH_FLOOR_PAVERS);
 assert.equal(at(0,13,-33),B.AIR);
 assert.equal(at(-25,12,40),B.GRASS);
 assert.equal(at(90,12,10),B.ARCH_FLOOR_WOOD);
});

test('entrance path is traversable without crossing hedges or walls',()=>{
 for(let z=-42;z<=-30;z++){
  assert.equal(at(0,13,z),B.AIR,`blocked entrance at z=${z}`);
  assert.equal(at(0,14,z),B.AIR,`blocked headroom at z=${z}`);
 }
 assert.equal(at(0,12,-36),B.ARCH_FLOOR_PAVERS);
 assert.equal(at(15,13,-36),B.LEAVES);
});
test('staff office and library use specialized furniture instead of identical desks',()=>{
 assert.equal(at(-34,13,-61),B.AIR);
 assert.equal(at(-26,13,-61),B.PART_INTERIOR_1);
 assert.equal(at(-8,28,-61),B.PART_BOOKSHELF_1);
 assert.equal(at(-8,28,-58),B.PART_INTERIOR_2);
});
test('stair landings get metallic rail parts, not a wooden fence',()=>{
 assert.equal(at(-63,18,-60),B.PART_BALCONY_3);
 const c=stampSchoolChunk(new Chunk(-4,-4),seed);
 // Left hand rail at world x=-63, z=-60, y=18.
 assert.equal(c.get(1,18,4),B.PART_BALCONY_3);
 assert.equal(c.styles[Chunk.index(1,18,4)],TURN_STYLE|2);
});
