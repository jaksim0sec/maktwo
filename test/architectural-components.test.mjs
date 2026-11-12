import test from 'node:test';
import assert from 'node:assert/strict';
import {PART_FAMILIES,componentPlan,occupies,stairStep,partAt} from '../src/worldgen/architectural-components.js';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';

test('eleven modular part families offer five variants each',()=>{
 assert.equal(Object.keys(PART_FAMILIES).length,11);
 for(const entries of Object.values(PART_FAMILIES))assert.equal(entries.length,5);
});
test('three independently irregular storeys preserve circulation and ascending stairs',()=>{
 for(let variant=0;variant<5;variant++){
  const p=componentPlan(52771,variant),masks=[];
  for(let level=0;level<3;level++){
   let mask='';for(let z=0;z<p.depth;z++)for(let x=0;x<p.width;x++)mask+=occupies(p,level,x,z)?'1':'0';
   masks.push(mask);
   for(let z=2;z<14;z++)for(const x of [2,3,4])assert.ok(occupies(p,level,x,z));
  }
  assert.equal(new Set(masks).size,3);
  for(let j=0;j<12;j++){
   const s=stairStep(p,0,j);
   assert.equal(partAt(p,p.x+2,s.y,p.z+2+j).id,s.id);
   assert.equal(partAt(p,p.x+1,Math.floor(s.top),p.z+2+j).style,7);
  }
 }
});
test('component studio generates one building without adjacent city blocks',()=>{
 for(const kind of ['shop-house','office','walkup','arcade','service']){
  const w=new World({mode:'building:'+kind,seed:52771});
  assert.equal(w.get(70,26,70),B.AIR);
  assert.equal(w.get(70,22,70),B.CONCRETE);
 }
});
