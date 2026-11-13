import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {partGeometry,PARTS} from '../src/core/part-library.js';
import {shapeBoxes} from '../src/core/shapes.js';
import {fixture,meshChunkData} from '../src/client/mesher.js';
import {Chunk} from '../src/core/chunk.js';
test('cargo crate is appended to existing IDs and has matching solid collision',()=>{
 assert.equal(B.CRATE,B.ROUND_FLUORESCENT+1);assert.equal(BLOCKS[B.CRATE].id,B.CRATE);
 assert.ok(shapeBoxes(B.CRATE,0,0,0).length>0);
 const c=new Chunk(0,0,32);c.data[(8*16+8)*16+8]=B.CRATE;
 const mesh=meshChunkData(c).opaque;assert.equal(mesh.length%7,0);assert.ok(mesh.length>200);
});
test('interiors, bookshelves and vents gain real separate model pieces',()=>{
 const geometry=(family,variant)=>partGeometry(PARTS.find(p=>p.family===family&&p.variant===variant).id);
 assert.ok(geometry('bookshelf',0).length>40);
 assert.ok(geometry('interior',1).length>=10);
 assert.ok(geometry('ventilation',2).length>18);
 assert.ok(shapeBoxes(B.CHAIR,0,0,0).length>=10);
});
test('original lamp light levels are unchanged',()=>{
 assert.equal(BLOCKS[B.FLUORESCENT].light.intensity,.78);
 assert.equal(BLOCKS[B.ROUND_FLUORESCENT].light.intensity,.78);
 assert.equal(BLOCKS[B.PART_INTERIOR_3].light.intensity,.43);
});
