import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B,block,HOTBAR,LIGHTBAR} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {meshChunk} from '../src/client/mesher.js';
import {raycast} from '../src/core/physics.js';

test('three different practical lights have an extensible data definition',()=>{
 assert.deepEqual(LIGHTBAR,[B.TORCH,B.LANTERN,B.CAMPFIRE]);
 assert.equal(HOTBAR.length,7);
 for(const id of LIGHTBAR){const light=block(id).light;assert.ok(light);assert.ok(light.radius>0);assert.ok(light.intensity>0);assert.match(light.color,/^#[0-9a-f]{6}$/i)}
});
test('light index tracks placement, removal and nearest light selection',()=>{
 const w=new World({mode:'flat'});
 assert.equal(w.lights.near(0,34,0).length,0);
 w.set(2,27,2,B.TORCH);w.set(4,27,2,B.LANTERN);w.set(11,27,2,B.CAMPFIRE);
 assert.deepEqual(w.lights.near(0,28,0).map(x=>x.id),[B.TORCH,B.LANTERN,B.CAMPFIRE]);
 assert.equal(w.lights.near(0,28,0,1).length,1);
 w.set(2,27,2,B.AIR);
 assert.deepEqual(w.lights.near(0,28,0).map(x=>x.id),[B.LANTERN,B.CAMPFIRE]);
});
test('light index handles negative coordinates and chunk unloading without leaking',()=>{
 const w=new World({mode:'flat'});
 w.set(-1,30,-1,B.LANTERN);
 assert.equal(w.lights.near(-1,30,-1).length,1);
 w.maxChunks=1;w.stream(200,200,0,1);
 assert.equal(w.lights.near(-1,30,-1).length,0);
 assert.equal(w.get(-1,30,-1),B.LANTERN);
 assert.equal(w.lights.near(-1,30,-1).length,1);
});
test('saved lights restore with world edits while the night stays permanent',()=>{
 const state=new Map(),storage={setItem:(k,v)=>state.set(k,v),getItem:k=>state.get(k)};
 const a=new World({seed:9,name:'save',storage,mode:'flat'});
 a.set(0,34,0,B.CAMPFIRE);a.save();
 const b=new World({seed:9,name:'save',storage,mode:'flat'});
 assert.equal(b.get(0,34,0),B.CAMPFIRE);
 assert.equal(b.lights.near(0,34,0).length,1);
 b.time=18000;for(let i=0;i<240;i++)b.tick();assert.equal(b.time,18000);
});
test('fixture meshes include emissive faces and remain compatible with worker format',()=>{
 const c=new Chunk(0,0);
 for(let i=0;i<LIGHTBAR.length;i++)c.set(i+1,10,1,LIGHTBAR[i]);
 const {opaque,transparent}=meshChunk({seed:1,getChunk:()=>null},c);
 assert.equal(transparent.length,0);assert.equal(opaque.length%42,0);
 let emissions=0;for(let i=6;i<opaque.length;i+=7)if(opaque[i]<0)emissions++;
 assert.ok(emissions>0);
});
test('placed torches can be selected and removed with the normal raycast',()=>{
 const w=new World({mode:'flat'});w.set(1,28,-2,B.TORCH);
 const hit=raycast(w,{x:1.5,y:28.5,z:.5},{x:0,y:0,z:-1},5);
 assert.equal(hit.id,B.TORCH);
 assert.equal(hit.normal.z,1);
});
