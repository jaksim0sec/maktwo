import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk,SIZE} from '../src/core/chunk.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {makeTextureLayers,materialFor,MATERIALS,TEXTURE_SIZE} from '../src/client/textures.js';
import {meshChunk} from '../src/client/mesher.js';
import {World} from '../src/core/world.js';

const seed=82417;
test('25 new terrain materials and plants appear in reproducible new-world geography',()=>{
 const counts=new Uint32Array(BLOCKS.length);
 for(let cz=-12;cz<=12;cz+=4)for(let cx=-12;cx<=12;cx+=4){
  const a=generateChunk(new Chunk(cx,cz),seed,'normal',3);
  const b=generateChunk(new Chunk(cx,cz),seed,'normal',3);
  assert.deepEqual(a.data,b.data);
  for(const id of a.data)counts[id]++;
 }
 for(let id=30;id<=54;id++)assert.ok(counts[id]>0,`${BLOCKS[id].name} (${id}) never generated`);
});
test('new texture layers remain a single compact GPU texture array',()=>{
 const {data}=makeTextureLayers(TEXTURE_SIZE);
 assert.equal(data.length,MATERIALS.length*TEXTURE_SIZE*TEXTURE_SIZE*4);
 assert.ok(data.byteLength<512*1024); // 98 compact RGBA8 layers, still under 512 KiB
 for(let id=30;id<=54;id++)assert.ok(materialFor(id,0)<=MATERIALS.length);
});
test('natural glow and decorative cross geometry are rendered without separate draw calls',()=>{
 const w=new World({mode:'flat',seed:seed,version:3});
 w.set(3,24,3,B.REEDS);w.set(4,24,3,B.BLUE_FLOWER);w.set(5,24,3,B.FIREFLY_GRASS);
 const data=meshChunk(w,w.getChunk(0,0));
 assert.ok(data.opaque.length>0);assert.equal(data.opaque.length%21,0);
 assert.ok(BLOCKS[B.GLOW_MOSS].light.intensity<.3);
 assert.ok(BLOCKS[B.FIREFLY_GRASS].light.intensity<.3);
});
