import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,blockLabel,block} from '../src/core/blocks.js';
import {WORLD_PRESETS,PALETTES,PALETTE_KEYS} from '../src/core/catalog.js';
import {integratedTerrain} from '../src/worldgen/integrated.js';
import {surfaceAt,generateChunk} from '../src/worldgen/generators.js';
import {meshChunk,gardenMesh} from '../src/client/mesher.js';
import {collides,raycast} from '../src/core/physics.js';

test('legacy block IDs remain stable and only studio presets are visible',()=>{
 assert.deepEqual(WORLD_PRESETS.map(x=>x.name),['TextureGallery','PartsGallery']);
 assert.equal(B.DOOR,18);assert.equal(B.DOOR_TOP,19);
 assert.deepEqual([B.PATH,B.GLOW_MUSHROOM,B.FENCE],[20,21,22]);
 assert.deepEqual(PALETTE_KEYS,['blocks','items','craft']);
 assert.ok(PALETTES.blocks.items.includes(B.PLANKS));
 assert.ok(PALETTES.items.items.includes(B.TORCH)&&!PALETTES.blocks.items.includes(B.TORCH));
 assert.equal(blockLabel(B.FENCE),'나무 울타리');
 assert.equal(block(B.GLOW_MUSHROOM).light.radius,4);
});
test('highlands terrain is deterministic over seeds, chunk order and negative coordinates',()=>{
 const coords=[[-24,11],[12,-47],[0,0],[200,312],[-82,-131]];
 for(const [x,z] of coords)assert.deepEqual(surfaceAt(x,z,990,'highlands'),surfaceAt(x,z,990,'normal'));
 const w1=new World({seed:990,mode:'highlands'}),w2=new World({seed:990,mode:'highlands'});
 const a=w1.getChunk(-1,0),b=w1.getChunk(0,0);
 const c=w2.getChunk(0,0),d=w2.getChunk(-1,0);
 assert.deepEqual(a.data,d.data);assert.deepEqual(b.data,c.data);
 assert.equal(surfaceAt(-17,-3,990,'highlands'),integratedTerrain(-17,-3,990).height);
});
test('highlands include valleys, ridge peaks and generally continuous slopes without clipping ceiling',()=>{
 const levels=[];
 for(let z=-180;z<=180;z+=10)for(let x=-180;x<=180;x+=10)levels.push(surfaceAt(x,z,62031,'highlands'));
 assert.ok(Math.max(...levels)>=44,'requires distinctive peaks');
 assert.ok(Math.min(...levels)<=20,'requires real valleys');
 assert.ok(new Set(levels).size>=24,'requires a broad height distribution');
 assert.ok(levels.every(n=>n>=5&&n<=57));
});
test('new props render through the special-mesh path and keep greedy mesh arrays',()=>{
 const w=new World({mode:'flat'});
 w.set(2,23,3,B.PATH);w.set(3,23,3,B.GLOW_MUSHROOM);w.set(4,23,3,B.FENCE);
 const chunk=w.getChunk(0,0),geometry=meshChunk(w,chunk);
 assert.ok(geometry.opaque.length>0);assert.equal(geometry.opaque.length%21,0);
 assert.ok(w.lights.near(3,23,3,10,6).some(v=>v.id===B.GLOW_MUSHROOM));
 const a=[];gardenMesh(a,B.FENCE,0,23,0);assert.ok(a.length>0);
});
test('fence collider matches partial shape instead of behaving as a full solid cube',()=>{
 const w=new World({mode:'flat'});w.set(5,23,5,B.FENCE);
 assert.equal(collides(w,5.5,23,5.5,.5,1.75),true);
 assert.equal(collides(w,5.03,23,5.03,.05,.2),false);
 const hit=raycast(w,{x:4.5,y:23.5,z:5.5},{x:1,y:0,z:0},2);
 assert.equal(hit?.id,B.FENCE);
});
test('new garden contents roundtrip without altering normal world block generation',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const a=new World({name:'Garden',seed:42,mode:'flat',storage});a.set(-2,24,3,B.GLOW_MUSHROOM);a.set(4,23,-2,B.FENCE);a.save();
 const b=new World({name:'Garden',seed:42,mode:'flat',storage});
 assert.equal(b.get(-2,24,3),B.GLOW_MUSHROOM);assert.equal(b.get(4,23,-2),B.FENCE);
 const unchanged=new World({seed:42,mode:'normal'}).getChunk(0,0).data;
 assert.deepEqual(unchanged,generateChunk(new Chunk(0,0),42,'normal').data);
});

test('flat builder world keeps its previous voxel output',async()=>{
 const {createHash}=await import('node:crypto');
 const checks={
  flat:'dc342408035612cf70afc312f9a6d93de3d8e07a07924daf5523ee3eb3e05719',
 };
 for(const [mode,sha] of Object.entries(checks)){
  const world=new World({seed:17331,mode});const bufs=[];
  for(const [cx,cz] of [[0,0],[-1,2],[7,-4]])bufs.push(Buffer.from(world.getChunk(cx,cz).data));
  assert.equal(createHash('sha256').update(Buffer.concat(bufs)).digest('hex'),sha,mode);
 }
});
test('worker mesher preserves forms, mounted fixtures and seven-float vertex layout',async()=>{
 const world=new World({mode:'flat',seed:141}),chunk=world.getChunk(0,0);
 world.set(1,23,1,B.FENCE);world.set(2,23,1,B.GLOW_MUSHROOM);world.set(3,23,1,B.PATH);
 world.set(4,23,1,B.CONCRETE,{form:3});
 world.set(5,23,1,B.PLANKS,{form:7});
 const diagonal=raycast(world,{x:4.9,y:23.5,z:1.9},{x:-Math.SQRT1_2,y:0,z:-Math.SQRT1_2});
 assert.equal(world.placeMount(B.TORCH,diagonal),true);
 const expected=meshChunk(world,chunk),old=globalThis.self;let actual;
 globalThis.self={onmessage:null,postMessage:packet=>{actual=packet}};
 try{
  await import('../src/client/mesh.worker.js?garden-test=1');
  const neighbors=[];
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
   const c=world.getChunk(dx,dz,false);if(c)neighbors.push([dx,dz,c.data.slice().buffer]);
  }
  globalThis.self.onmessage({data:{cx:0,cz:0,data:chunk.data.slice().buffer,forms:chunk.forms.slice().buffer,mounts:chunk.mounts,neighbors,doorStates:[],seed:141,key:'0,0',revision:1,token:1}});
  assert.equal(actual.error,undefined);
  assert.deepEqual(actual.opaque,expected.opaque);
  assert.deepEqual(actual.transparent,expected.transparent);
 }finally{globalThis.self=old}
});
test('all imported ES modules use canonical URLs without duplicate stale version query identities',async()=>{
 const {readdirSync,readFileSync}=await import('node:fs');
 const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../src/',import.meta.url));
 function walk(dir){for(const d of readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+d.name;
  if(d.isDirectory())walk(path);else if(path.endsWith('.js'))assert.doesNotMatch(readFileSync(path,'utf8'),/\.js\?v=\d/);
 }}walk(root);
});
