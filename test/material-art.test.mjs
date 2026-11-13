import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTextureLayers,materialFor,TEXTURE_SIZE,MATERIALS} from '../src/client/textures.js';
import {hasDetailedMaterial,sampleDetailedMaterial} from '../src/client/material-art.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
const selected={base:[22,23,24,25,26,27,28,29,32,34,37,38],architecture:[0,2,9,11,14,27,29],station:[4,5,6,7,8,9,19],extra:[0,1,2,3]};
test('30 individually authored 32px materials are deterministic and varied',()=>{
 assert.equal(Object.values(selected).flat().length,30);
 const signatures=new Set();
 for(const [group,indices] of Object.entries(selected))for(const index of indices){
  assert.equal(hasDetailedMaterial(group,index),true);
  const samples=[],colors=new Set();
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const rgba=sampleDetailedMaterial(group,index,x,y);
   assert.equal(rgba.length,4);
   for(const v of rgba)assert.ok(Number.isFinite(v)&&v>=.20&&v<=1.31);
   assert.deepEqual(rgba,sampleDetailedMaterial(group,index,x,y));
   const key=rgba.map(v=>Math.round(v*255)).join(':');
   colors.add(key);samples.push(key);
  }
  assert.ok(colors.size>45,group+':'+index+' palette');
  signatures.add(samples.join(';'));
 }
 assert.equal(signatures.size,30);
});
test('specialized limestone, marble, beam and ceiling layers preserve block IDs',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();
 assert.equal(a.size,TEXTURE_SIZE);
 assert.equal(a.layers,MATERIALS.length);
 assert.equal(a.layers,94);
 assert.deepEqual(a.data,b.data);
 const ids=[B.LIMESTONE,B.MARBLE,B.CONCRETE_BEAM,B.CEILING_FINISH];
 assert.deepEqual(ids,[43,44,73,85]);
 assert.deepEqual(ids.map(id=>materialFor(id,0)),[91,92,93,94]);
 for(const id of ids)assert.equal(BLOCKS[id].id,id);
 for(let i=0;i<4;i++){
  const start=(90+i)*32*32*4,layer=a.data.subarray(start,start+4096);
  assert.equal(layer.length,4096);
  assert.ok(new Set(layer.filter((_,k)=>k%4===0)).size>30);
 }
});
test('tile joints contain precalculated material-level darkening',()=>{
 const joint=sampleDetailedMaterial('architecture',0,0,0)[0];
 const face=sampleDetailedMaterial('architecture',0,5,7)[0];
 assert.ok(joint<face-.10);
});
