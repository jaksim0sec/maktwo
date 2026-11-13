import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {ARCH_MATERIALS,ARCH_MATERIAL_START} from '../src/core/architectural-materials.js';
import {GALLERY_BLOCK_IDS,galleryCoordinate} from '../src/worldgen/material-gallery.js';
import {PARTS,PART_FAMILIES} from '../src/core/part-library.js';
import {partPosition,partGallerySpawn} from '../src/worldgen/part-gallery.js';
import {makeTextureLayers,materialFor} from '../src/client/textures.js';

test('independent galleries and the city lab have separate presets; old IDs remain stable',()=>{
 assert.deepEqual(WORLD_PRESETS.map(p=>p.mode),['materials','parts','eternal-city-lab','eternal-city-lab','station-preview','arboretum','eternal-city-lab']);
 assert.equal(B.CONCRETE,55);assert.equal(B.CEILING_FINISH,85);
 assert.equal(BLOCKS.length,B.FALLEN_GREEN+1);
 assert.equal(PART_FAMILIES.length,14);assert.equal(PARTS.length,70);
});
test('flat texture gallery keeps exactly one cube per material block',()=>{
 const world=new World({mode:'materials',seed:9999});
 assert.equal(new Set(GALLERY_BLOCK_IDS).size,GALLERY_BLOCK_IDS.length);
 for(let i=0;i<GALLERY_BLOCK_IDS.length;i++){
  const p=galleryCoordinate(i);
  assert.equal(world.get(p.x,p.y,p.z),GALLERY_BLOCK_IDS[i]);
  assert.equal(world.get(p.x,p.y+1,p.z),B.AIR);
 }
 assert.equal(world.get(100,23,100),B.AIR);
 assert.equal(world.get(100,22,100),B.CONCRETE);
});
test('13 part rows each hold five isolated samples, no building geometry',()=>{
 const world=new World({mode:'parts',seed:9999});
 for(const entry of PARTS){
  const {x,y,z}=partPosition(entry.section,entry.variant);
  assert.equal(world.get(x,y,z),entry.id,entry.name);
  assert.equal(world.get(x+1,y,z),B.AIR,'independent X gap');
  assert.equal(world.get(x,y+1,z),B.AIR,'no assembled upper storey');
 }
 for(let i=0;i<PART_FAMILIES.length;i++){
  const spawn=partGallerySpawn(i);
  assert.equal(world.get(Math.floor(spawn.x),23,Math.floor(spawn.z)),B.AIR,'clear section landing');
 }
 assert.equal(world.get(90,26,90),B.AIR);
 assert.equal(world.get(90,22,90),B.CONCRETE);
});
test('30 deterministic 32px architecture textures retain distinct material IDs',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();
 assert.equal(a.layers,70);assert.deepEqual(a.data,b.data);
 const signatures=new Set();
 for(let i=0;i<ARCH_MATERIALS.length;i++){
  const id=ARCH_MATERIAL_START+i,layer=materialFor(id,0)-1;
  assert.equal(layer,40+i);assert.equal(BLOCKS[id].render,'cube');
  const bytes=a.data.subarray(layer*32*32*4,(layer+1)*32*32*4);
  let h=2166136261;for(const value of bytes)h=Math.imul(h^value,16777619)>>>0;
  signatures.add(h);
 }
 assert.equal(signatures.size,30);
});
