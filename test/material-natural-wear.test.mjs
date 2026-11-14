// Visual-material regression: baked-only tile and brick weathering.
import test from 'node:test';
import assert from 'node:assert/strict';
import {brick,sampleDetailedMaterial} from '../src/client/material-art.js';
import {sampleArchitectureTexture} from '../src/client/architecture-texture-sampler.js';

test('brick mortar is slightly irregular between rows but interior stays brighter',()=>{
 const seam=Array.from({length:8},(_,i)=>brick(8.5,9.2+i*.7,16,8,147).joint);
 assert.ok(Math.max(...seam)-Math.min(...seam)>.10);
 assert.ok(brick(3.5,11.5,16,8,147).joint<.15);
 assert.ok(brick(8.5,11.5,16,8,147).joint>.35);
 const a=brick(.5,4.5,16,8,147),b=brick(31.5,4.5,16,8,147);
 assert.ok(a.joint>.3&&b.joint>.3,'32px texture repetition must retain its boundary mortar');
});
test('large pale tiles gain clustered patina, not a uniform gray layer',()=>{
 const l=[];for(let y=2;y<=5;y++)for(let x=3;x<=14;x++)
  l.push(sampleDetailedMaterial('architecture',2,x,y)[0]);
 const avg=l.reduce((a,b)=>a+b,0)/l.length;
 const sd=Math.sqrt(l.reduce((a,b)=>a+(b-avg)**2,0)/l.length);
 assert.ok(sd>.0195&&sd<.060,'tile surface weathering should be subtle but visible');
 assert.ok(sampleDetailedMaterial('architecture',0,0,0)[0]<
  sampleDetailedMaterial('architecture',0,5,7)[0]-.10,
  'tile grout remains clearly visible');
});
test('authored brick materials retain their five colorways with bounded values',()=>{
 for(let style=0;style<5;style++){
  const colors=new Set();
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const rgba=sampleArchitectureTexture(15+style,x,y);
   assert.ok(rgba.every(v=>Number.isFinite(v)&&v>=.24&&v<=1.35));
   colors.add(rgba.map(v=>Math.round(v*255)).join(':'));
  }
  assert.ok(colors.size>16,'brick style '+style+' must stay textured');
 }
});
test('material weathering stays deterministic across repeated samples',()=>{
 for(const type of [['base',32],['architecture',0],['architecture',2],['station',7]])for(let y=0;y<32;y+=3)for(let x=0;x<32;x+=3){
  assert.deepEqual(sampleDetailedMaterial(...type,x,y),sampleDetailedMaterial(...type,x,y));
 }
});
