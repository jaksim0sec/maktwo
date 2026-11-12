import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {meshChunk} from '../src/client/mesher.js';
import {shapeBoxes} from '../src/core/shapes.js';
import {materialFor} from '../src/client/textures.js';
test('stairs and slabs keep physical shape and mesh data aligned',()=>{
 const w=new World({mode:'flat',seed:7});for(const [i,id] of [B.STONE_STAIRS,B.WOOD_STAIRS,B.STONE_SLAB,B.WOOD_SLAB,B.CHAIR,B.FLOWER_POT].entries()){
  assert.ok(shapeBoxes(id,i+1,23,2)?.length);w.set(i+1,23,2,id);
 }
 const mesh=meshChunk(w,w.getChunk(0,0));assert.ok(mesh.opaque.length>0);
 assert.equal(mesh.opaque.length%21,0);assert.ok(materialFor(B.STONE_STAIRS,0)>0);
});
test('integrated terrain preserves saved legacy world generation',()=>{
 const legacy=new World({mode:'normal',seed:82417,version:1});
 const modern=new World({mode:'normal',seed:82417,version:2});
 assert.equal(legacy.terrainVersion,1);assert.equal(modern.terrainVersion,2);
 assert.deepEqual(legacy.getChunk(0,0).data,new World({mode:'normal',seed:82417,version:1}).getChunk(0,0).data);
});
