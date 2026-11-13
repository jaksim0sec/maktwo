import test from 'node:test';
import assert from 'node:assert/strict';
import {materialUVTransform,textureTransformMode,makeTextureLayers} from '../src/client/textures.js';
import {meshChunkData} from '../src/client/mesher.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Chunk} from '../src/core/chunk.js';
test('coordinate UV transforms are paused; authored rotations remain',()=>{
 assert.equal(textureTransformMode(4),3);
 assert.equal(textureTransformMode(26),0);
 assert.equal(textureTransformMode(33),1);
 assert.equal(textureTransformMode(65),0);
 assert.equal(materialUVTransform(4,.99),0);
 assert.equal(materialUVTransform(33,.99),0);
 assert.equal(materialUVTransform(26,.99),0);
 assert.equal(materialUVTransform(4,0,2),2);
});
test('UV variants are deterministic and stay inside original packed orientation bits',()=>{
 for(let id=1;id<66;id++)for(let n=0;n<8;n++){
  const t=materialUVTransform(id,(n+.2)/8);
  assert.ok(Number.isInteger(t)&&t>=0&&t<=7);
  assert.equal(t,materialUVTransform(id,(n+.2)/8));
 }
 const atlas=makeTextureLayers();
 assert.equal(atlas.size,32);
});
test('voxel meshing retains 7-float vertices with generated texture orientation',()=>{
 const c=new Chunk(0,0,64);c.set(8,8,8,B.STONE);c.set(9,8,8,B.STONE);
 const a=meshChunkData(c,{visualSeed:9999}).opaque;
 const b=meshChunkData(c,{visualSeed:9999}).opaque;
 assert.equal(a.length%7,0);assert.deepEqual(a,b);
 assert.ok(a.every(Number.isFinite));
});
