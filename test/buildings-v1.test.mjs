import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {MATERIALS,materialFor,makeTextureLayers} from '../src/client/textures.js';
import {generateChunk,GENERATION_VERSION} from '../src/worldgen/generators.js';

test('ruin chunks and fixtures are deterministic regardless of generation order',()=>{
 const seed=52771;
 const regions=[[0,0],[1,0],[0,1],[-1,-1]];
 const forward=regions.map(([x,z])=>generateChunk(new Chunk(x,z),seed,'ruins'));
 const reverse=regions.slice().reverse().map(([x,z])=>generateChunk(new Chunk(x,z),seed,'ruins')).reverse();
 for(let i=0;i<forward.length;i++)assert.deepEqual(forward[i].data,reverse[i].data);
 assert.ok(forward.some(c=>c.data.some(id=>id>=B.CONCRETE&&id<=B.WARNING_STRIPE)));
});
test('new materials are append-only, textured, and fit the existing array format',()=>{
 assert.equal(B.CONCRETE,55);
 assert.equal(B.WARNING_STRIPE,76);
 assert.ok(BLOCKS.length>=77); // IDs 0-76 remain stable after v2 additions
 const tex=makeTextureLayers();
 assert.equal(tex.layers,MATERIALS.length);
 assert.equal(tex.layers,90);
 assert.equal(tex.data.length,tex.layers*32*32*4);
 for(let id=55;id<=76;id++)assert.ok(materialFor(id,0)<=tex.layers);
 assert.ok(BLOCKS[B.FLUORESCENT].light);
 assert.equal(BLOCKS[B.BROKEN_FLUORESCENT].light,undefined);
});
test('old saves use the latest generator and retain edits, inventory keys and a backup',()=>{
 const records=new Map();
 const storage={getItem:key=>records.get(key)||null,setItem:(key,val)=>records.set(key,val)};
 const original=JSON.stringify({seed:123,mode:'normal',edits:{'0,0':[[Chunk.index(2,44,3),B.COBBLE]]},states:[]});
 records.set('mcweb:old',original);
 const world=new World({name:'old',seed:123,mode:'normal',storage});
 assert.equal(world.version,GENERATION_VERSION);
 assert.equal(world.get(2,44,3),B.COBBLE);
 world.save();
 assert.equal(records.get('mcweb:old:before-generator-unification'),original);
 assert.equal(JSON.parse(records.get('mcweb:old')).generationVersion,GENERATION_VERSION);
});
