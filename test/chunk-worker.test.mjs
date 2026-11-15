import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {TerrainWorker} from '../src/client/terrain-worker.js';
import {World} from '../src/core/world.js';
import {Chunk,SIZE} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {CITY_MODE} from '../src/worldgen/eternal-night-game.js';
import {CANYON_MODE} from '../src/worldgen/canyon-v2-plan.js';
import {distantCanyonMesh} from '../src/client/canyon-distance.js';

class FakeWorker{
 jobs=[];
 postMessage(job){this.jobs.push(job)}
 reply(job,data={}){this.onmessage({data:{id:job.id,kind:job.kind,...data}})}
 terminate(){this.terminated=true}
}

function chunkPayload(height){
 return {data:new Uint8Array(height*SIZE*SIZE),forms:new Uint8Array(height*SIZE*SIZE),
  styles:new Uint8Array(height*SIZE*SIZE),revision:0};
}

test('streaming registers only the ready chunk and uses current saved edits and lights',()=>{
 const worker=new FakeWorker(),terrain=new TerrainWorker(()=>worker);
 const world=new World({mode:'flat'});
 const loads=[];
 world.events.on('chunk-load',chunk=>loads.push(chunk));
 terrain.stream(world,0,0,3,true);
 terrain.stream(world,0,0,3,true);
 assert.equal(worker.jobs.length,1);
 assert.equal(world.chunks.size,0);
 const job=worker.jobs[0],index=Chunk.index(2,32,3),shape=Chunk.index(3,32,3);
 assert.deepEqual([job.cx,job.cz],[0,0]);
 const payload=chunkPayload(world.height);
 payload.styles[index]=34;
 world.edits.set('0,0',new Map([[index,B.TORCH],[shape,B.PLANKS]]));
 world.forms.set('0,0',new Map([[shape,2]]));
 worker.reply(job,payload);
 assert.equal(world.chunks.size,0,'registration happens during the frame');
 terrain.stream(world,0,0,3,true);
 const chunk=world.getChunk(0,0,false);
 assert.equal(chunk.data[index],B.TORCH);
 assert.equal(chunk.styles[index],0);
 assert.equal(chunk.forms[shape],2);
 assert.ok(world.lights.byChunk.get('0,0').has('2,32,3'));
 assert.deepEqual(loads,[chunk]);
 assert.equal(worker.jobs.length,2);
});

test('a direct world read can satisfy a pending request without replacing live edits',()=>{
 const worker=new FakeWorker(),terrain=new TerrainWorker(()=>worker);
 const world=new World({mode:'flat'});
 terrain.stream(world,0,0,3,true);
 const pending=worker.jobs[0];
 assert.equal(world.get(0,22,0),B.GRASS);
 const direct=world.getChunk(0,0,false);
 assert.ok(world.set(0,33,0,B.GLASS));
 worker.reply(pending,chunkPayload(world.height));
 terrain.stream(world,0,0,3,true);
 assert.equal(world.getChunk(0,0,false),direct);
 assert.equal(world.get(0,33,0),B.GLASS);
});

test('stale replies from a recenter, a teleport, or a previous world cannot install chunks',()=>{
 const workers=[],terrain=new TerrainWorker(()=>{const worker=new FakeWorker();workers.push(worker);return worker;});
 const world=new World({mode:CANYON_MODE});
 terrain.stream(world,0,0,3,true);
 const [worker]=workers;
 assert.ok(world.recenterCanyon(650)>0);
 worker.reply(worker.jobs[0],chunkPayload(world.height));
 terrain.stream(world,0,0,3,true);
 assert.equal(world.chunks.size,0);
 assert.equal(worker.jobs[1].yOrigin,world.yOrigin);
 worker.reply(worker.jobs[1],chunkPayload(world.height));
 terrain.stream(world,1000,1000,3,true);
 assert.equal(world.chunks.size,0);
 assert.notEqual(worker.jobs[2].cx,0);
 terrain.reset();
 const next=new World({mode:'flat'});
 terrain.stream(next,0,0,3,true);
 worker.reply(worker.jobs[2],chunkPayload(world.height));
 terrain.stream(next,0,0,3,true);
 assert.equal(world.chunks.size,0);
 assert.equal(next.chunks.size,0);
 assert.equal(workers[1].jobs.length,1);
});

test('worker failure resumes synchronous streaming with its existing budget',()=>{
 const worker=new FakeWorker(),terrain=new TerrainWorker(()=>worker),world=new World({mode:'flat'});
 terrain.stream(world,0,0,3,false);
 worker.onerror({message:'module blocked'});
 terrain.stream(world,0,0,3,false);
 assert.equal(world.chunks.size,0);
 terrain.stream(world,0,0,3,true);
 assert.equal(world.chunks.size,2);
 assert.ok(worker.terminated);
});

test('a cold city waits for worker preparation and worker failure releases it',async()=>{
 const worker=new FakeWorker(),terrain=new TerrainWorker(()=>worker),world=new World({mode:CITY_MODE});
 let ready=false;
 const preparation=terrain.prepare(world).then(()=>{ready=true});
 await Promise.resolve();
 assert.equal(ready,false);
 assert.equal(worker.jobs[0].kind,'prepare');
 worker.reply(worker.jobs[0]);
 await preparation;
 assert.equal(ready,true);
 assert.equal(terrain.available,true);
 const retry=terrain.prepare(world);
 worker.onerror({message:'worker stopped while preparing'});
 await retry;
 assert.equal(terrain.available,false);
});

test('the real terrain worker preserves city, rebased canyon and distant geometry',async()=>{
 const workerURL=new URL('../src/client/terrain.worker.js',import.meta.url);
 const source=`
  import {parentPort} from 'node:worker_threads';
  globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};
  await import(${JSON.stringify(workerURL.href)});
  parentPort.on('message',data=>self.onmessage({data}));
 `;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)));
 try{
  const warmed=once(worker,'message',{signal:AbortSignal.timeout(30_000)});
  worker.postMessage({kind:'prepare',id:-1,seed:9999,mode:CITY_MODE,cityBlueprints:9});
  assert.deepEqual((await warmed)[0],{kind:'prepare',id:-1});
  const samples=[
   {mode:CITY_MODE,cx:12,cz:-5,yOrigin:0},
   {mode:CANYON_MODE,cx:3,cz:0,yOrigin:480}
  ];
  for(const [id,job] of samples.entries()){
   const world=new World({seed:9999,mode:job.mode});
   world.yOrigin=job.yOrigin;
   const reply=once(worker,'message',{signal:AbortSignal.timeout(30_000)});
   worker.postMessage({...job,id,kind:'chunk',seed:world.seed,height:world.height,
    cityBlueprints:job.mode===CITY_MODE?world.version:false});
   const [result]=await reply;
   assert.equal(result.error,undefined);
   const expected=world.getChunk(job.cx,job.cz);
   assert.deepEqual(result.data,expected.data);
   assert.deepEqual(result.styles,expected.styles);
   assert.deepEqual(result.forms,expected.forms);
   assert.equal(result.revision,expected.revision);
  }
  const reply=once(worker,'message',{signal:AbortSignal.timeout(30_000)});
  const panorama={seed:9999,cx:0,cz:0,canyon:{origin:480,y:256}};
  worker.postMessage({...panorama,id:2,kind:'distance'});
  const [result]=await reply;
  assert.equal(result.error,undefined);
  assert.deepEqual(result.middle,distantCanyonMesh(9999,0,0,480,256));
 }finally{await worker.terminate()}
});
