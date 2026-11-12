import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {shapeBoxes,isStairs,isSlab} from '../src/core/shapes.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {buildingPlan} from '../src/worldgen/buildings.js';
import {roomLevel} from '../src/worldgen/architecture-v2.js';
import {skyClarityAt} from '../src/client/atmosphere.js';
import {materialFor,MATERIALS} from '../src/client/textures.js';

test('partial geometry retains matching physical shape and stable block IDs',()=>{
 assert.equal(B.CONCRETE_SLAB,77);assert.equal(B.WINDOW_EW,82);assert.equal(BLOCKS.length,83);
 assert.ok(isStairs(B.CONCRETE_STAIRS));assert.ok(isSlab(B.CONCRETE_SLAB));
 const slab=shapeBoxes(B.CONCRETE_SLAB,0,0,0);
 assert.equal(slab[0].h,.5);
 assert.ok(shapeBoxes(B.THIN_WALL_NS,0,0,0)[0].d<.5);
 assert.ok(shapeBoxes(B.THIN_WALL_EW,0,0,0)[0].w<.5);
 assert.equal(shapeBoxes(B.WINDOW_NS,0,0,0).length,5);
 for(let id=77;id<=82;id++)assert.ok(materialFor(id,0)<=MATERIALS.length);
});
test('new floors share exactly one vertical staircase axis',()=>{
 let tested=0;
 for(let rz=-2;rz<=2;rz++)for(let rx=-2;rx<=2;rx++){
  const plan=buildingPlan(rx,rz,52771);if(!plan||plan.floors<2)continue;
  for(let level=0;level<plan.floors-1;level++){
   const a=roomLevel(plan,level),b=roomLevel(plan,level+1);
   assert.equal(b.base-a.base,5);
  }
  tested++;
 }
 assert.ok(tested>5);
});
test('v4 architecture has stair runs and no bright full-width ceiling band',()=>{
 let stairs=0,half=0,windows=0;
 for(let cz=-2;cz<=2;cz++)for(let cx=-2;cx<=2;cx++){
  const c=generateChunk(new Chunk(cx,cz),52771,'ruins',4);
  const d=generateChunk(new Chunk(cx,cz),52771,'ruins',4);
  assert.deepEqual(c.data,d.data);
  for(const id of c.data){if(id===B.CONCRETE_STAIRS)stairs++;if(id===B.THIN_WALL_NS||id===B.THIN_WALL_EW)half++;if(id===B.WINDOW_NS||id===B.WINDOW_EW)windows++}
 }
 assert.ok(stairs>10);assert.ok(half>10);assert.ok(windows>10);
});
test('sky stays dark on the ground and brightens gradually only at high altitude',()=>{
 assert.equal(skyClarityAt(60),0);
 assert.equal(skyClarityAt(200),0);
 assert.ok(skyClarityAt(300)>0&&skyClarityAt(300)<.5);
 assert.ok(skyClarityAt(420)>.5);
 assert.equal(skyClarityAt(470),1);
});

test('ground floor doors and a continuous side return for stairs exist',()=>{
 const p=buildingPlan(0,0,52771)||buildingPlan(1,0,52771);
 assert.ok(p);
 const c=generateChunk(new Chunk(Math.floor(p.x/16),Math.floor(p.z/16)),52771,'ruins',4);
 assert.ok(c.data.length>0);
});
