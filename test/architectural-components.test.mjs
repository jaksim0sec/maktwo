import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,PART_FAMILIES,PART_ID_START,partById,partGeometry} from '../src/core/part-library.js';
import {World} from '../src/core/world.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {shapeBoxes} from '../src/core/shapes.js';
import {meshChunk} from '../src/client/mesher.js';
import {partPosition} from '../src/worldgen/part-gallery.js';

test('13 part families have five true independent block types',()=>{
 assert.equal(PART_FAMILIES.length,13);assert.equal(PARTS.length,65);
 const signatures=new Set();
 for(const part of PARTS){
  assert.equal(part.id,PART_ID_START+part.section*5+part.variant);
  assert.equal(BLOCKS[part.id].render,'part');
  assert.equal(partById(part.id),part);
  const geometry=partGeometry(part.id);
  assert.ok(geometry.length>0);
  signatures.add(JSON.stringify(geometry));
  for(const b of geometry){
   for(const [axis,size] of [['x','w'],['y','h'],['z','d']]){
    assert.ok(b[axis]>=0);assert.ok(b[axis]+b[size]<=1.000001);
   }
   assert.ok(b.material>=86&&b.material<=115);
  }
 }
 assert.equal(signatures.size,65,'shape variants must differ');
});
test('vents, signs, balconies and stairs render as separate clickable primitives',()=>{
 const w=new World({mode:'parts',seed:9999});
 for(const name of ['ventilation','sign','balcony','staircase']){
  const section=PART_FAMILIES.findIndex(f=>f.key===name);
  assert.ok(section>=0);
  for(let variant=0;variant<5;variant++){
   const pos=partPosition(section,variant),id=w.get(pos.x,pos.y,pos.z);
   assert.equal(id,PARTS[section*5+variant].id);
   assert.ok(shapeBoxes(id,pos.x,pos.y,pos.z).length>0);
   const mesh=meshChunk(w,w.getChunk(Math.floor(pos.x/16),Math.floor(pos.z/16)));
   assert.ok(mesh.opaque.length>0);
  }
 }
});
test('window and glass door use a separate translucent geometry pass',()=>{
 const w=new World({mode:'parts',seed:9999});
 for(const name of ['window','door']){
  const section=PART_FAMILIES.findIndex(f=>f.key===name);
  const variant=name==='door'?2:0,p=partPosition(section,variant);
  const mesh=meshChunk(w,w.getChunk(Math.floor(p.x/16),Math.floor(p.z/16)));
  assert.ok(mesh.opaque.length>0);assert.ok(mesh.transparent.length>0);
 }
});
