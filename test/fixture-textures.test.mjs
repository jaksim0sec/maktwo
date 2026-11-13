import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTextureLayers,FIXTURE_MATERIAL,sampleFixtureTexture} from '../src/client/textures.js';
import {fixture} from '../src/client/mesher.js';
import {BLOCK as B} from '../src/core/blocks.js';

test('four 32px fabric, timber and metal layers are deterministic and lightweight',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();
 assert.equal(a.size,32);assert.equal(a.layers,98);
 assert.equal(a.data.length,98*32*32*4);assert.ok(a.data.byteLength<512*1024);
 assert.deepEqual(a.data,b.data);
 assert.deepEqual(Object.values(FIXTURE_MATERIAL),[95,96,97,98]);
 for(let kind=0;kind<4;kind++){
  const colors=new Set();
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const v=sampleFixtureTexture(kind,x,y);
   assert.deepEqual(v,sampleFixtureTexture(kind,x,y));assert.ok(v.every(Number.isFinite));
   const pos=(((94+kind)*32+y)*32+x)*4;
   const rgb=v.slice(1).map(t=>Math.min(255,Math.round(255*v[0]*t)));
   assert.deepEqual([...a.data.slice(pos,pos+3)],rgb);
   colors.add(rgb.join(','));
  }
  assert.ok(colors.size>25,kind+' texture is too monochrome');
 }
});
test('bed models have timber, linen and cover but no metal-grille texture',()=>{
 for(const id of [B.BED,B.BED_FOOT,B.MATTRESS,B.MATTRESS_FOOT]){
  const verts=[];fixture(verts,id,0,0,0);
  assert.equal(verts.length%7,0);assert.ok(verts.every(Number.isFinite));
  const mats=new Set();
  for(let i=6;i<verts.length;i+=7)mats.add(Math.floor(verts[i]/4));
  assert.ok(mats.has(FIXTURE_MATERIAL.BED_LINEN)&&mats.has(FIXTURE_MATERIAL.BED_COVER));
  assert.equal(mats.has(FIXTURE_MATERIAL.BED_WOOD),id===B.BED||id===B.BED_FOOT);
  assert.ok(!mats.has(FIXTURE_MATERIAL.LANTERN_METAL));
 }
});
test('lantern metal parts sample texture; incandescent bulb remains emissive',()=>{
 for(const id of [B.TORCH,B.LANTERN]){
  const verts=[];fixture(verts,id,0,0,0);
  let glow=0,metal=0;
  for(let i=6;i<verts.length;i+=7)if(verts[i]<0)glow++;else{
   assert.equal(Math.floor(verts[i]/4),FIXTURE_MATERIAL.LANTERN_METAL);metal++;
  }
  assert.ok(glow>0&&metal>0);
  assert.equal(verts.length%7,0);assert.ok(verts.every(Number.isFinite));
 }
});

test('fixture pigment contrast is visibly larger than the previous near-solid 4 percent texture',()=>{
 const atlas=makeTextureLayers();
 for(let kind=0;kind<4;kind++){
  const brightness=[];
  let white=0;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const p=(((94+kind)*32+y)*32+x)*4;
   const [r,g,b]=atlas.data.subarray(p,p+3);
   brightness.push((.2126*r+.7152*g+.0722*b)/255);
   if(r===255&&g===255&&b===255)white++;
  }
  brightness.sort((a,b)=>a-b);
  const contrast=brightness[921]-brightness[102];
  assert.ok(contrast>=.17&&contrast<=.36,'texture '+kind+' contrast='+contrast);
  assert.ok(white<=150,'highlight clipping washes out fixture '+kind);
 }
 const shader=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
 assert.match(shader,/vMaterial==95\?1\.45:\(vMaterial==98\?2\.75:1\.05\)/);
});
