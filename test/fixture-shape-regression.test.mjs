import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../src/client/mesher.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {FIXTURE_MATERIAL} from '../src/client/textures.js';

const layers=vertices=>{
 const set=new Set();
 for(let i=6;i<vertices.length;i+=7)if(vertices[i]>=0)set.add(Math.floor(vertices[i]/4));
 return [...set].sort((a,b)=>a-b);
};
const mesh=id=>{const v=[];fixture(v,id,0,0,0);return v;};
test('bed surface has real puffy quilt and padded pillow, separate from the timber frame',()=>{
 for(const id of [B.BED,B.BED_FOOT,B.MATTRESS,B.MATTRESS_FOOT]){
  const v=mesh(id);
  assert.deepEqual(layers(v),id===B.BED||id===B.BED_FOOT?[95,96,97]:[96,97]);
  assert.ok(v.every(Number.isFinite));assert.equal(v.length%7,0);
  // The new quilt ridge rises above the mattress and varies across its width.
  const top=[];
  for(let i=0;i<v.length;i+=7)if(v[i+6]>=4*FIXTURE_MATERIAL.BED_COVER)
   top.push(v[i+1]);
  assert.ok(new Set(top.map(y=>y.toFixed(3))).size>=5,'quilt should not be one slab');
 }
});
test('small lantern glows inside an open metal cage, not from a giant square side',()=>{
 for(const id of [B.TORCH,B.LANTERN]){
  const v=mesh(id),emissive=[];
  for(let i=0;i<v.length;i+=7)if(v[i+6]<0)emissive.push(...v.slice(i,i+3));
  assert.deepEqual(layers(v),[FIXTURE_MATERIAL.LANTERN_METAL]);
  assert.equal(emissive.length/3,72,'two small bulb primitives preserve warm core');
  for(let i=0;i<emissive.length;i+=3){
   assert.ok(emissive[i]>=.45&&emissive[i]<=.55);
   assert.ok(emissive[i+2]>=.45&&emissive[i+2]<=.55);
  }
 }
});
