import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PARTS,partGeometry} from '../src/core/part-library.js';
import {STATION_PARTS,stationPartGeometry} from '../src/core/station-parts.js';
import {partPrisms} from '../src/core/part-prisms.js';
import {BLOCK as B,BLOCKS,block} from '../src/core/blocks.js';
import {fixture} from '../src/client/mesher.js';
const bound=p=>{
 for(const k of ['x','y','z','w','h','d'])assert.ok(Number.isFinite(p[k]));
 for(const [x,w] of [['x','w'],['y','h'],['z','d']]){
  assert.ok(p[x]>=0&&p[w]>0&&p[x]+p[w]<=1.000001);
 }
};
test('architectural parts remain valid and material-diverse',()=>{
 assert.equal(PARTS.length,70);
 for(const p of PARTS){
  const g=partGeometry(p.id);
  assert.ok(g.length>0&&g.length<=72,p.name);
  assert.ok(new Set(g.map(x=>x.material)).size>=2,p.name);
  for(const x of g){bound(x);assert.ok(BLOCKS[x.material]);}
 }
});
test('city stair and bridge retain one-vertex-attribute packed shadow details',()=>{
 const stair=partPrisms(B.PART_STAIRCASE_3,0,0,0,{cityStair:true,rail:true,treadHeight:.5,stairRise:.25});
 const bridge=partPrisms(B.PART_PASSAGE_5,0,0,0,{cityBridge:true,bridgePost:true});
 assert.ok(stair.some(p=>p.tone<.9));assert.ok(bridge.some(p=>p.tone<.9));
 const src=readFileSync(new URL('../src/client/mesher.js',import.meta.url),'utf8');
 assert.match(src,/piece\.tone\?\?1/);
 assert.match(src,/4\*materialFor\(piece\.material,0\)/);
});
test('mattress, bed and caged lantern preserve IDs and finite vertex output',()=>{
 for(const id of [B.BED,B.BED_FOOT,B.MATTRESS,B.MATTRESS_FOOT,B.TORCH,B.LANTERN,B.CRATE]){
  const v=[];fixture(v,id,0,0,0);
  assert.ok(v.length>600,id);
  assert.equal(v.length%7,0);
  assert.ok(v.every(Number.isFinite));
 }
 assert.deepEqual([B.BED,B.MATTRESS,B.TORCH],[246,248,14]);
 assert.ok(block(B.TORCH).light?.radius>=9);
});
test('30 station modules preserve IDs, materials and bounding boxes',()=>{
 assert.equal(STATION_PARTS.length,30);
 for(const p of STATION_PARTS){
  const g=stationPartGeometry(p.id);
  assert.ok(g.length>0&&g.length<=32,p.name);
  for(const x of g){bound(x);assert.ok(BLOCKS[x.material]);}
 }
 assert.ok(stationPartGeometry(B.PART_STATION_TRAININTERIOR_3).length>=18);
 assert.ok(stationPartGeometry(B.PART_STATION_STATIONLINK_5).length>=12);
});
