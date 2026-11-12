import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {ARCH_MATERIALS,ARCH_MATERIAL_START} from '../src/core/architectural-materials.js';
import {GALLERY_BLOCK_IDS,galleryCoordinate} from '../src/worldgen/material-gallery.js';
import {ARCHETYPES,showcaseBlueprint} from '../src/worldgen/architecture-v3.js';
import {makeTextureLayers,materialFor} from '../src/client/textures.js';

test('six selectable studio worlds; original block IDs remain stable',()=>{
 assert.equal(WORLD_PRESETS.length,6);assert.equal(WORLD_PRESETS[0].mode,'materials');
 assert.deepEqual(WORLD_PRESETS.slice(1).map(p=>p.mode.slice(9)),ARCHETYPES);
 assert.equal(B.CONCRETE,55);assert.equal(B.CEILING_FINISH,85);
 assert.equal(BLOCKS.length,ARCH_MATERIAL_START+ARCH_MATERIALS.length);
});
test('flat texture gallery has exactly one sample per displayed full material block',()=>{
 const w=new World({mode:'materials',seed:9999});
 assert.equal(new Set(GALLERY_BLOCK_IDS).size,GALLERY_BLOCK_IDS.length);
 for(let i=0;i<GALLERY_BLOCK_IDS.length;i++){
  const p=galleryCoordinate(i);assert.equal(w.get(p.x,p.y,p.z),GALLERY_BLOCK_IDS[i]);
  assert.equal(w.get(p.x,p.y+1,p.z),B.AIR);
 }
 assert.equal(w.get(100,23,100),B.AIR);assert.equal(w.get(100,22,100),B.CONCRETE);
});
test('each isolated building shares the original architecture program and no neighboring buildings',()=>{
 for(const type of ARCHETYPES){
  const seed=52771,w=new World({mode:'building:'+type,seed}),p=showcaseBlueprint(type,seed);
  assert.equal(p.type,type);assert.equal(p.floors,3);
  assert.equal(w.get(p.x,p.base+3,p.z+3),p.facade,type);
  assert.equal(w.get(64,26,64),B.AIR);assert.equal(w.get(64,22,64),B.CONCRETE);
  assert.deepEqual(p,showcaseBlueprint(type,seed));
 }
});
test('30 new deterministic 32px textures map to stable material IDs',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();
 assert.equal(a.layers,70);assert.deepEqual(a.data,b.data);
 const signatures=new Set();
 for(let i=0;i<ARCH_MATERIALS.length;i++){
  const id=ARCH_MATERIAL_START+i,layer=materialFor(id,0)-1;
  assert.equal(layer,40+i);assert.equal(BLOCKS[id].render,'cube');
  const bytes=a.data.subarray(layer*32*32*4,(layer+1)*32*32*4);
  let h=2166136261;for(const v of bytes)h=Math.imul(h^v,16777619)>>>0;
  signatures.add(h);
 }
 assert.equal(signatures.size,30);
});
