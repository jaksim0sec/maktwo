import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {shapeBoxes,isStairs,isSlab} from '../src/core/shapes.js';
import {skyClarityAt} from '../src/client/atmosphere.js';
import {materialFor,MATERIALS} from '../src/client/textures.js';

test('partial geometry retains matching physical shape and stable block IDs',()=>{
 assert.equal(B.CONCRETE_SLAB,77);assert.equal(B.WINDOW_EW,82);assert.ok(BLOCKS.length>=83);
 assert.ok(isStairs(B.CONCRETE_STAIRS));assert.ok(isSlab(B.CONCRETE_SLAB));
 const slab=shapeBoxes(B.CONCRETE_SLAB,0,0,0);
 assert.equal(slab[0].h,.5);
 assert.ok(shapeBoxes(B.THIN_WALL_NS,0,0,0)[0].d<.5);
 assert.ok(shapeBoxes(B.THIN_WALL_EW,0,0,0)[0].w<.5);
 assert.equal(shapeBoxes(B.WINDOW_NS,0,0,0).length,5);
 for(let id=77;id<=82;id++)assert.ok(materialFor(id,0)<=MATERIALS.length);
});
test('sky stays dark on the ground and brightens gradually only at high altitude',()=>{
 assert.equal(skyClarityAt(60),0);
 assert.equal(skyClarityAt(200),0);
 assert.ok(skyClarityAt(300)>0&&skyClarityAt(300)<.5);
 assert.ok(skyClarityAt(420)>.5);
 assert.equal(skyClarityAt(470),1);
});
