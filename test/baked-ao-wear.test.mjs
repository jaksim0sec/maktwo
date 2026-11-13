import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {meshChunkData} from '../src/client/mesher.js';
import {makeTextureLayers} from '../src/client/textures.js';
test('vertex AO respects occluders and uses stable 7-float vertices',()=>{
 const c=new Chunk(0,0,32),set=(x,y,z)=>c.data[(y*16+z)*16+x]=B.STONE;
 set(8,8,8);const before=meshChunkData(c).opaque;
 set(7,9,8);set(8,9,7);set(7,9,7);
 const after=meshChunkData(c).opaque;
 assert.equal(after.length%7,0);assert.ok(after.every(Number.isFinite));
 const values=data=>{const found=[];for(let i=0;i<data.length;i+=7)if(data[i]===8&&data[i+1]===9&&data[i+2]===8)found.push(data[i+6]%4);return found;};
 assert.ok(values(before).some(v=>v>.95));
 assert.ok(values(after).some(v=>v<.8));
});
test('material texture bytes are deterministic',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();assert.equal(a.size,32);assert.equal(a.data.length,a.layers*a.size*a.size*4);assert.deepEqual(a.data,b.data);
});