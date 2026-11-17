import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk,TURN_STYLE} from '../src/core/chunk.js';
import {decodeSplitTread} from '../src/worldgen/eternal-night-stairs.js';
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
 assert([B.ARCH_CONCRETE_PEBBLE_PAINT,B.STATION_TRAIN_ENAMEL].includes(at(0,13,-55)));
 assert.equal(at(-58,13,-55),B.DOOR); // real, interactive classroom door
 assert.equal(at(-56,13,-61),B.PART_INTERIOR_2);
 assert.equal(at(-60,14,-60),B.STATION_ALGAE);
 for(const floorY of [12,17,22,27])assert.equal(at(1,floorY,-60),B.ARCH_STONE_TERRAZZO);
});
test('split treads connect the school storeys while the landing floor remains solid',()=>{
 for(const heightOffset of [0,5,10]){
  const base=12+heightOffset;
  assert.equal(at(-70,base+1,-55),B.PART_STAIRCASE_2);
  assert.equal(at(-70,base+3,-59),B.PART_STAIRCASE_2);
  assert.equal(at(-65,base+5,-55),B.PART_STAIRCASE_2);
  assert.equal(at(-68,base+3,-60),B.CONCRETE_SLAB);
  assert.equal(at(-71,base+5,-55),B.ARCH_STONE_TERRAZZO);
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
 assert.equal(at(1,16,-60),B.CITY_PAINT_WHITE);
 assert.equal(at(0,13,-43),B.AIR);
 assert.equal(at(0,18,-40),B.ARCH_METAL_GALVANIZED);
 assert.notEqual(at(-75,14,-58),B.AIR);
});
test('existing architectural parts retain real rotation in a generated chunk',()=>{
 const chunk=stampSchoolChunk(new Chunk(-5,-3),seed);
 assert.equal(chunk.get(2,14,6),B.PART_WINDOW_4);
 assert.equal(chunk.styles[Chunk.index(2,14,6)],TURN_STYLE|2);
 assert.equal(at(-78,14,-42),B.PART_WINDOW_4);
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

test('split-tread stair geometry uses 0.2m risers and oriented outside rails',()=>{
 const chunk=stampSchoolChunk(new Chunk(-5,-4),seed);
 const tread=decodeSplitTread(chunk.styles[Chunk.index(10,13,9)]); // (-70,13,-55)
 assert.deepEqual([tread.low,tread.high,tread.facing,tread.rail],[.25,.5,4,false]);
 const outer=decodeSplitTread(chunk.styles[Chunk.index(8,13,9)]); // (-72,13,-55)
 assert.equal(outer.rail,true);
 const second=decodeSplitTread(chunk.styles[Chunk.index(10,13,8)]);
 assert.deepEqual([second.low,second.high],[.75,1]);
});

test('all exterior window parts inherit their correct wall-plane orientation',()=>{
 const side=stampSchoolChunk(new Chunk(4,-4),seed); // main side wall x=75
 assert.equal(side.get(11,14,6),B.PART_WINDOW_4);
 assert.equal(side.styles[Chunk.index(11,14,6)],TURN_STYLE|2);
 const back=stampSchoolChunk(new Chunk(4,-5),seed); // main rear wall x=66
 assert.equal(back.get(2,14,15),B.PART_WINDOW_4);
 assert.equal(back.styles?.[Chunk.index(2,14,15)]||0,0);
 const entrance=stampSchoolChunk(new Chunk(0,-3),seed); // lobby side x=8
 assert.equal(entrance.get(8,14,2),B.PART_WINDOW_3);
 assert.equal(entrance.styles[Chunk.index(8,14,2)],TURN_STYLE|2);
 const gym=stampSchoolChunk(new Chunk(5,0),seed); // gym side x=80
 assert.equal(gym.get(0,19,10),B.PART_WINDOW_3);
 assert.equal(gym.styles[Chunk.index(0,19,10)],TURN_STYLE|2);
});

test('photographic classroom corridor: wood doors, transoms and painted wall bands',()=>{
 assert.equal(at(-58,13,-55),B.DOOR);
 assert.equal(at(-58,14,-55),B.DOOR_TOP);
 assert.equal(at(-58,15,-55),B.PART_WINDOW_4);
 assert.equal(at(-59,13,-55),B.ARCH_FLOOR_WOOD);
 assert([B.ARCH_CONCRETE_PEBBLE_PAINT,B.STATION_TRAIN_ENAMEL].includes(at(0,13,-55)));
 assert.equal(at(0,14,-55),B.CITY_PAINT_WHITE);
 assert.equal(at(1,12,-54),B.ARCH_STONE_TERRAZZO);
 assert.equal(at(1,12,-52),B.ARCH_STONE_TERRAZZO);
 assert.equal(at(0,15,-53),B.FLUORESCENT);
 assert.equal(at(0,16,-53),B.CITY_PAINT_WHITE);
});
test('photographic school facade: covered approach, canopy posts and stair signage',()=>{
 assert.equal(at(42,17,-38),B.ARCH_METAL_GALVANIZED);
 assert.equal(at(42,13,-37),B.PART_COLUMN_4);
 assert.equal(at(14,16,-38),B.FLUORESCENT);
 assert.equal(at(-75,14,-54),B.CITY_STAIR_MARKER);
 for(let z=-42;z<=-30;z++)assert.equal(at(0,13,z),B.AIR);
});
test('all classrooms and wings get correctly facing interactive doors',()=>{
 const main=stampSchoolChunk(new Chunk(-4,-4),seed);
 assert.equal(main.get(6,13,9),B.DOOR); // (-58,13,-55)
 assert.equal(main.get(6,14,9),B.DOOR_TOP);
 assert.equal(main.styles[Chunk.index(6,13,9)],TURN_STYLE|2);
 const east=stampSchoolChunk(new Chunk(4,-3),seed);
 assert.equal(east.get(2,13,1),B.DOOR); // (66,13,-47)
 assert.equal(east.get(2,15,1),B.PART_WINDOW_4);
 assert.equal(east.styles[Chunk.index(2,13,1)],TURN_STYLE|3);
 const west=stampSchoolChunk(new Chunk(-5,-3),seed);
 assert.equal(west.get(14,13,1),B.DOOR); // (-66,13,-47)
 assert.equal(west.styles[Chunk.index(14,13,1)],TURN_STYLE|1);
});

test('school wings contain distinct working classrooms, library and bathroom volumes',()=>{
 assert.equal(at(-72,12,7),B.ARCH_TILE_VERTICAL_WHITE);
 assert.equal(at(-72,13,7),B.PART_PARTITION_2);
 assert.equal(at(-75,23,-11),B.PART_BOOKSHELF_1);
 assert.equal(at(68,13,-21),B.PART_INTERIOR_2);
 assert.equal(at(72,15,-19),B.FLUORESCENT);
 for(const level of [0,1,2,3]){
  const y=SCHOOL_GROUND+level*SCHOOL_STOREY+1;
  assert.equal(at(63,y,-50),B.AIR);
  assert.equal(at(-63,y,-50),B.AIR);
 }
});

test('school-only finishes keep exterior masonry but replace exposed internal brick',()=>{
 const base=12,white=B.CITY_PAINT_WHITE,window=B.PART_WINDOW_4;
 // The former red brick strip on the corridor side is now painted.
 assert([B.ARCH_CONCRETE_PEBBLE_PAINT,B.STATION_TRAIN_ENAMEL].includes(at(12,base+1,-50)));
 assert.equal(at(12,base+2,-50),white);
 assert.equal(at(4,base+2,-50),window);
 assert([B.ARCH_BRICK_RED,B.ARCH_BRICK_RENDERED,window].includes(at(0,base+2,-65)));
 assert.equal(at(-61,base+2,-44),window);
 assert.equal(at(-78,base+2,-42),window);
 for(const y of [16,21,26,31])assert.equal(at(0,y,-53),white); // flat matte ceilings
});
test('old thick floor strips are replaced by terrazzo with only room thresholds',()=>{
 for(const z of [-54,-53,-52,-51])assert.equal(at(1,12,z),B.ARCH_STONE_TERRAZZO);
 assert.equal(at(-58,12,-54),B.ARCH_STONE_PINK_GRANITE); // narrow doorway threshold
 assert.equal(at(68,12,-47),B.ARCH_STONE_TERRAZZO);
});
test('school signage, storage and denser seating repeat without blocking walkways',()=>{
 assert.equal(at(-56,15,-54),B.PART_SIGN_2);
 assert.equal(at(-65,15,-46),B.PART_SIGN_2);
 assert.equal(at(-49,13,-51),B.PART_INTERIOR_1);
 assert.equal(at(-56,13,-62),B.PART_INTERIOR_2);
 assert.equal(at(-54,13,-57),B.PART_INTERIOR_2);
 for(const x of [-58,-46,-34,-22])assert.equal(at(x,13,-55),B.DOOR);
 for(let z=-54;z<=-52;z++)assert.equal(at(0,13,z),B.AIR);
 const wing=stampSchoolChunk(new Chunk(-5,-3),seed);
 assert.equal(wing.get(15,15,2),B.PART_SIGN_2); // (-65,15,-46)
 assert.equal(wing.styles[Chunk.index(15,15,2)],TURN_STYLE|2);
});

test('yellow tactile warnings mark stair mouths while open corridors stay walkable',()=>{
 for(const level of [0,1,2,3]){
  const floorY=SCHOOL_GROUND+level*SCHOOL_STOREY;
  assert.equal(at(-70,floorY,-54),B.STATION_PLATFORM_TACTILE);
  assert.equal(at(65,floorY,-54),B.STATION_PLATFORM_TACTILE);
  assert.equal(at(-69,floorY,-53),B.ARCH_STONE_TERRAZZO);
  assert.equal(at(-70,floorY+1,-54),B.AIR);
 }
});
