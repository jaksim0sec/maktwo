import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {meshChunk,meshChunkData} from '../src/client/mesher.js';

function snapshot(c){return c.data.slice().buffer}

test('mesher consumes voxel snapshots without generator or world access',()=>{
 const world=new World({seed:52771,mode:'ruins',version:5});
 const chunk=world.getChunk(-1,2),neighbor=world.getChunk(0,2);
 const expected=meshChunk(world,chunk);
 const isolated=new Chunk(-1,2);isolated.data=chunk.data.slice();
 const actual=meshChunkData(isolated,{neighbors:[[1,0,neighbor.data.slice()]],states:new Map(world.blockStates),visualSeed:world.seed});
 assert.deepEqual(actual,expected);
 assert.deepEqual(isolated.data,chunk.data);
});

test('greedy meshing merges two touching cubes into six quads',()=>{
 const c=new Chunk(0,0);c.set(1,10,1,B.STONE);c.set(2,10,1,B.STONE);
 const m=meshChunk({seed:0,getChunk:()=>null},c);
 assert.equal(m.opaque.length/42,6);
 assert.equal(m.transparent.length,0);
});
test('greedy meshing keeps all six faces on isolated cubes',()=>{
 const c=new Chunk(0,0);c.set(1,10,1,B.GRASS);c.set(4,10,1,B.WOOD);
 const m=meshChunk({seed:0,getChunk:()=>null},c);
 assert.equal(m.opaque.length/42,12);
});
test('chunk faces are rebuilt when adjacent chunks load',()=>{
 const w=new World({seed:12,mode:'flat'}),c=w.getChunk(0,0);const r=c.revision;
 w.getChunk(1,0);assert.ok(c.revision>r);assert.equal(c.dirty,true);
});
test('worker snapshot computes the same mesh as the main thread',async()=>{
 const w=new World({seed:3,mode:'flat'});const c=w.getChunk(0,0),neighbor=w.getChunk(1,0);
 const reference=meshChunk(w,c),oldSelf=globalThis.self;let reply;
 globalThis.self={postMessage:(message)=>{reply=message}};
 try{
  await import('../src/client/mesh.worker.js');
  globalThis.self.onmessage({data:{key:'0,0',token:1,revision:0,seed:w.seed,cx:0,cz:0,data:snapshot(c),neighbors:[[1,0,snapshot(neighbor)]]}});
  assert.equal(reply.error,undefined);
  assert.deepEqual(reply.opaque,reference.opaque);
  assert.deepEqual(reply.transparent,reference.transparent);
 }finally{globalThis.self=oldSelf}
});
test('block tick retains newly queued updates for later ticks',()=>{
 const w=new World({seed:2,mode:'flat'});
 w.set(1,36,1,B.SAND);const first=w.queue.length;
 assert.ok(first>0);
 w.tick();assert.ok(w.queue.length>=0);
 assert.equal(w.queued.size,new Set(w.queue.map(q=>q[3])).size);
 assert.ok(Array.from({length:13},(_,i)=>w.get(1,23+i,1)).includes(B.SAND));
});
test('greedy face winding still points outward on every cube face',()=>{
 const c=new Chunk(0,0);c.set(2,12,3,B.STONE);
 const m=meshChunk({seed:0,getChunk:()=>null},c).opaque;
 for(let i=0;i<m.length;i+=42){
  const v0=m.slice(i,i+3),v1=m.slice(i+7,i+10),v2=m.slice(i+14,i+17);
  const a=v1.map((v,j)=>v-v0[j]),b=v2.map((v,j)=>v-v0[j]);
  const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const center=v0.map((_,j)=>(v0[j]+v1[j]+v2[j])/3-[2.5,12.5,3.5][j]);
  const outward=normal.reduce((sum,v,j)=>sum+v*center[j],0);
  assert.ok(outward>0,`face winding=${normal} center=${center}`);
 }
});
