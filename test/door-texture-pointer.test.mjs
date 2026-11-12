import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../src/core/world.js';
import {BLOCK as B,blockLabel,HOTBAR} from '../src/core/blocks.js';
import {collides,raycast} from '../src/core/physics.js';
import {doorBounds} from '../src/core/door.js';
import {Chunk} from '../src/core/chunk.js';
import {meshChunk} from '../src/client/mesher.js';
import {materialFor,makeTextureLayers,MATERIALS} from '../src/client/textures.js';
import {screenRay} from '../src/client/picking.js';
import {cardGeometry,createAnchor,faceAnchor,spatialHit} from '../src/client/hologram.js';

const adapter=()=>{const db=new Map();return{getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,v)}};
test('two-cell door rotates and persists its state without altering saved old-world block IDs',()=>{
 const storage=adapter(),w=new World({name:'DoorFixture',mode:'flat',storage});
 w.set(5,28,5,B.AIR);w.set(5,29,5,B.AIR);
 assert.ok(w.placeDoor(5,28,5,2));
 assert.equal(w.get(5,28,5),B.DOOR);assert.equal(w.get(5,29,5),B.DOOR_TOP);
 assert.equal(w.placeDoor(5,28,5,0),false);
 assert.deepEqual(w.getDoorState(5,29,5),{facing:2,open:false});
 assert.ok(w.toggleDoor(5,29,5));assert.equal(w.getDoorState(5,28,5).open,true);
 w.save();const r=new World({name:'DoorFixture',mode:'flat',storage});
 assert.equal(r.get(5,29,5),B.DOOR_TOP);assert.deepEqual(r.getDoorState(5,28,5),{facing:2,open:true});
 assert.ok(r.removeDoor(5,29,5));assert.equal(r.get(5,28,5),B.AIR);assert.equal(r.get(5,29,5),B.AIR);
 assert.equal(r.blockStates.size,0);
});
test('door collisions use its thin geometry, not an entire voxel',()=>{
 const w=new World({mode:'flat'});w.placeDoor(4,28,4,0);
 const closed=doorBounds(4,4,0,false);
 assert.ok(collides(w,closed.x+.35,28.2,closed.z+.07,.15,.9));
 assert.equal(collides(w,4.5,28.2,4.65,.1,.9),false);
 w.toggleDoor(4,28,4);assert.ok(collides(w,4.13,28.2,4.5,.12,.9));
 assert.equal(collides(w,4.5,28.2,4.12,.10,.9),false);
});
test('door models render as low-poly mesh and change with open state',()=>{
 const w=new World({mode:'flat'});w.placeDoor(2,28,2,0);const c=w.getChunk(0,0);
 const a=meshChunk(w,c);w.toggleDoor(2,28,2);const b=meshChunk(w,c);
 assert.ok(a.opaque.length>0);assert.equal(a.opaque.length%42,0);assert.notDeepEqual(a.opaque,b.opaque);
 assert.equal(materialFor(B.DOOR,0),13);
});
test('32px texture array uses a fixed low memory budget and deterministic layers',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();assert.equal(a.size,32);
 assert.ok(a.data.byteLength<=MATERIALS.length*32*32*4);assert.deepEqual(a.data,b.data);
 assert.ok(materialFor(B.GRASS,2)!==materialFor(B.GRASS,0));
 assert.ok(materialFor(B.WOOD,2)!==materialFor(B.WOOD,0));
});
test('screen pointer ray matches centered view and differs at the actual click pixel',()=>{
 const p={yaw:0,pitch:0},center=screenRay(p,400,300,800,600);
 assert.ok(Math.abs(center.x)<1e-6);assert.equal(center.y,0);assert.equal(center.z,-1);
 assert.ok(screenRay(p,700,300,800,600).x>.4);
 assert.ok(screenRay(p,100,300,800,600).x<-.4);
 assert.ok(screenRay(p,400,100,800,600).y>.2);
});
test('world anchored holo billboard faces the moving player without moving its center',()=>{
 const p={x:0,y:29,z:0,eye:1.7,yaw:0,pitch:0};const anchor=createAnchor(p);const center=anchor.center.slice();
 const cards=cardGeometry('blocks',HOTBAR.map(id=>({id,name:blockLabel(id),color:'#ffffff'})));
 p.x=1.4;p.y=29.25;p.z=.5;
 assert.ok(faceAnchor(anchor,p));assert.deepEqual(anchor.center,center);
 const toCard=[center[0]-p.x,center[1]-(p.y+p.eye),center[2]-p.z],length=Math.hypot(...toCard);
 assert.ok(anchor.forward.every((x,i)=>Math.abs(x-(i===1?0:toCard[i]/Math.hypot(toCard[0],toCard[2])))<1e-6));
 for(const card of cards){const target=anchor.center.map((v,i)=>v+anchor.right[i]*card.x+anchor.up[i]*card.y+anchor.forward[i]*card.depth);
  const eye=[p.x,p.y+p.eye,p.z],delta=target.map((v,i)=>v-eye[i]),L=Math.hypot(...delta);
  assert.equal(spatialHit(anchor,cards,p,delta.map(v=>v/L))?.id,card.id);
 }
});
test('hotbar labels localized without modifying stable block IDs',()=>{
 assert.equal(blockLabel(B.GRASS),'잔디');assert.equal(blockLabel(B.DOOR),'나무 문');
 assert.equal(HOTBAR.length,7);assert.equal(HOTBAR[3],B.DOOR);
});
test('offline service worker includes new ray picker, door and texture modules',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const p of ['src/client/picking.js','src/client/textures.js','src/core/door.js'])assert.ok(sw.includes(p));
 assert.match(sw,/maktwo-shell-v1\.9\.0-stage2/);
});

test('raycast only hits the physical door panel, not its empty cell',()=>{
 const w=new World({mode:'flat'});w.placeDoor(5,27,5,0);
 const origin={x:5.5,y:27.8,z:4.5};
 assert.equal(raycast(w,origin,{x:0,y:0,z:1},3)?.id,B.DOOR);
 assert.equal(raycast(w,{x:5.5,y:27.8,z:5.4},{x:0,y:0,z:1},1),null);
 w.toggleDoor(5,27,5);
 assert.equal(raycast(w,origin,{x:0,y:0,z:1},2),null);
 assert.equal(raycast(w,{x:4.5,y:27.8,z:5.45},{x:1,y:0,z:0},2)?.id,B.DOOR);
});
test('worker and main-thread door meshes match, including orientation',async()=>{
 const w=new World({seed:51,mode:'flat'}),chunk=w.getChunk(0,0);w.placeDoor(3,27,4,3);w.toggleDoor(3,27,4);
 const reference=meshChunk(w,chunk),previous=globalThis.self;let response;
 globalThis.self={postMessage:packet=>{response=packet}};
 try{
  await import('../src/client/mesh.worker.js?door-state-test');
  globalThis.self.onmessage({data:{cx:0,cz:0,key:'0,0',revision:0,token:1,seed:w.seed,data:chunk.data.slice().buffer,neighbors:[],doorStates:[...w.blockStates]}});
  assert.equal(response.error,undefined);assert.deepEqual(response.opaque,reference.opaque);
 }finally{globalThis.self=previous}
});
test('material encoding retains the original seven float vertex stride',()=>{
 const c=new Chunk(0,0);c.set(1,20,2,B.GRASS);
 const vertices=meshChunk({seed:0,getChunk:()=>null},c).opaque;
 assert.equal(vertices.length,6*6*7);
 assert.ok([...vertices].filter((_,i)=>i%7===6).some(v=>v>4),'material code packs into existing shade field');
 const source=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
 assert.match(source,/sampler2DArray uMaterials/);
 assert.match(source,/gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY/);
});
