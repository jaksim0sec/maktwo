import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {schoolVoxel,stampSchoolChunk,SCHOOL_GROUND,SCHOOL_HEIGHT,SCHOOL_PERIOD} from '../src/worldgen/school-v3.js';
import {APARTMENT_BLOCKS,APARTMENT_MAX_FLOORS,apartmentAt} from '../src/worldgen/school-apartments.js';
import {Chunk,TURN_STYLE} from '../src/core/chunk.js';
import {decodeSplitTread} from '../src/worldgen/eternal-night-stairs.js';
const at=(x,y,z)=>schoolVoxel(x,y,z,9999);
test('corridor apartment wings exist outside the retained school compound',()=>{
 assert.notEqual(at(-160,12,-90),B.AIR); // west wing ground-floor interior
 assert.notEqual(at(160,12,37),B.AIR); // east residential shell
 assert.notEqual(at(-100,12,165),B.AIR); // north residential shell
 assert.equal(at(0,13,-40),B.AIR); // school entry unchanged
});
test('residential high rises have higher ceilings than the school, not cliff walls',()=>{
 assert(SCHOOL_HEIGHT>=76);
 assert(SCHOOL_PERIOD>=368);
 assert.notEqual(at(-199,45,-90),B.AIR);
});
test('a school gate opens onto a walkable neighborhood path',()=>{
 assert.equal(at(49,SCHOOL_GROUND+1,103),B.AIR);
 assert.equal(at(49,SCHOOL_GROUND+1,111),B.AIR);
 assert.notEqual(at(49,SCHOOL_GROUND,111),B.AIR);
});

test('eight residential slabs keep school and gym clear, with realistic floor variation',()=>{
 assert.equal(APARTMENT_BLOCKS.length,8);
 assert(APARTMENT_BLOCKS.every(p=>p.floors>=9&&p.floors<=APARTMENT_MAX_FLOORS));
 assert.equal(new Set(APARTMENT_BLOCKS.map(p=>p.id)).size,APARTMENT_BLOCKS.length);
 assert.equal(apartmentAt(-160,-90)?.id,101);
 assert.equal(apartmentAt(160,37)?.id,104);
 assert.equal(apartmentAt(0,0),null);
 for(const p of APARTMENT_BLOCKS){
  const sx=p.vertical?(p.flip?p.x+p.depth-3:p.x+2):p.x+2;
  const sz=p.vertical?p.z+2:(p.flip?p.z+p.depth-3:p.z+2);
  assert.equal(at(sx,12,sz),B.ARCH_FLOOR_WOOD);
  assert.equal(at(p.x,12+p.floors*5,p.z),B.ARCH_METAL_GALVANIZED);
 }
 assert.equal(at(90,12,0),B.ARCH_FLOOR_WOOD);
 assert.equal(at(-25,12,40),B.GRASS);
});
test('each dwelling opens onto a continuous exterior gallery with a solid rail',()=>{
 assert.equal(at(-187,13,-88),B.DOOR);
 assert.equal(at(-187,14,-88),B.DOOR_TOP);
 assert.equal(at(-187,15,-88),B.PART_WINDOW_4);
 assert.equal(at(-187,13,-86),B.AIR);
 assert.equal(at(-187,12,-86),B.ARCH_CONCRETE_PEBBLE_PAINT);
 assert.equal(at(-187,13,-83),B.PART_BALCONY_3);
 assert.equal(at(-124,13,162),B.DOOR); // south block mirrors its corridor toward school
 assert.equal(at(-124,13,157),B.PART_BALCONY_3);
});
test('residential unit details come from the latest city housing kit',()=>{
 assert.equal(at(-188,13,-97),B.PART_INTERIOR_2);
 assert.equal(at(-188,13,-92),B.PART_INTERIOR_1);
 assert.equal(at(-188,14,-99),B.PART_WINDOW_4);
 assert.equal(at(-195,13,-98),B.PART_DOOR_2); // elevator fire door
});
test('slab stair cores use split 20cm treads with style data, not empty shafts',()=>{
 assert.equal(at(-197,13,-97),B.PART_STAIRCASE_2);
 const p=stampSchoolChunk(new Chunk(-13,-7,SCHOOL_HEIGHT),9999);
 const x=-197-(-13*16),z=-97-(-7*16);
 assert.equal(p.get(x,13,z),B.PART_STAIRCASE_2);
 const tread=decodeSplitTread(p.styles[Chunk.index(x,13,z)]);
 assert.deepEqual([tread.low,tread.high,tread.facing],[.25,.5,4]);
});
test('Bundang-like pedestrian axis, parking street and playground survive',()=>{
 assert.equal(at(107,12,0),B.ARCH_FLOOR_ASPHALT);
 assert.equal(at(122,12,0),B.ARCH_FLOOR_ASPHALT);
 assert.equal(at(49,12,111),B.ARCH_FLOOR_PAVERS);
 assert.equal(at(49,13,118),B.AIR);
 assert.equal(at(0,12,160),B.GRASS);
 assert.equal(at(0,13,170),B.SAND);
});
test('residential campus is deterministic and repeats without seams',()=>{
 for(const p of APARTMENT_BLOCKS){
  const x=p.x+2,z=p.z+2;
  assert.equal(at(x,12,z),at(x+SCHOOL_PERIOD,12,z));
  assert.equal(at(x,12,z),at(x,12,z+SCHOOL_PERIOD));
 }
});

test('two perpendicular apartment slabs keep doors and galleries facing the court',()=>{
 assert.equal(apartmentAt(-188,31)?.id,102);
 assert.equal(at(-188,13,31),B.DOOR);
 assert.equal(at(-183,13,31),B.PART_BALCONY_3);
 assert.equal(apartmentAt(186,-89)?.id,103);
 assert.equal(at(186,13,-89),B.DOOR);
 assert.equal(at(181,13,-89),B.PART_BALCONY_3);
 const west=stampSchoolChunk(new Chunk(-12,1,SCHOOL_HEIGHT),9999);
 assert.equal(west.get(4,13,15),B.DOOR);
 assert.equal(west.styles[Chunk.index(4,13,15)],TURN_STYLE|3);
 const east=stampSchoolChunk(new Chunk(11,-6,SCHOOL_HEIGHT),9999);
 assert.equal(east.get(10,13,7),B.DOOR);
 assert.equal(east.styles[Chunk.index(10,13,7)],TURN_STYLE|1);
});

test('every apartment lobby has a dry paved connection to the district sidewalk',()=>{
 for(const [x,z] of [[-170,-80],[-165,24],[165,-96],[140,40],[-91,-149],[39,-149],[-131,146],[99,146]]){
  assert.equal(at(x,12,z),B.ARCH_FLOOR_PAVERS,`unconnected lobby approach ${x},${z}`);
  assert.equal(at(x,13,z),B.AIR,`blocked pavement at ${x},${z}`);
 }
});
