import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {schoolVoxel,SCHOOL_GROUND,SCHOOL_HEIGHT,SCHOOL_PERIOD} from '../src/worldgen/school-v3.js';
const at=(x,y,z)=>schoolVoxel(x,y,z,9999);
test('corridor apartment wings exist outside the retained school compound',()=>{
 assert.notEqual(at(-160,13,-90),B.AIR); // west wing ground-floor interior
 assert.notEqual(at(160,13,37),B.AIR); // east residential shell
 assert.notEqual(at(-100,13,165),B.AIR); // north residential shell
 assert.equal(at(0,13,-40),B.AIR); // school entry unchanged
});
test('residential high rises have higher ceilings than the school, not cliff walls',()=>{
 assert(SCHOOL_HEIGHT>=76);
 assert(SCHOOL_PERIOD>=368);
 assert.notEqual(at(-181,45,-90),B.AIR);
});
test('a school gate opens onto a walkable neighborhood path',()=>{
 assert.equal(at(49,SCHOOL_GROUND+1,103),B.AIR);
 assert.equal(at(49,SCHOOL_GROUND+1,111),B.AIR);
 assert.notEqual(at(49,SCHOOL_GROUND,111),B.AIR);
});
