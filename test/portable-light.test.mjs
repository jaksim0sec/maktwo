import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B,block,itemId,portableLight} from '../src/core/blocks.js';
import {recipeByName} from '../src/core/crafting.js';
import {CreativeInventory,SurvivalInventory,harvestDrop} from '../src/core/inventory.js';
import {CREATIVE_ITEMS,PALETTES} from '../src/core/catalog.js';
import {World} from '../src/core/world.js';
import {Chunk,SIZE} from '../src/core/chunk.js';
import {meshChunkData} from '../src/client/mesher.js';
import {buildLightVolume} from '../src/core/lightVolume.js';
import {HeldLight,heldLightJob,heldLightView} from '../src/client/held-light.js';
import {raycast} from '../src/core/physics.js';

test('lantern and work lamp use the same portable light equipment type',()=>{
 assert.equal(itemId(B.LANTERN),B.TORCH);
 assert.equal(portableLight(B.LANTERN),portableLight(B.TORCH));
 assert.equal(portableLight(B.STEEL_BAR),null);
 assert.ok(portableLight(B.ELECTRIC_LAMP).radius>portableLight(B.TORCH).radius);
 assert.ok(portableLight(B.ELECTRIC_LAMP).intensity>portableLight(B.TORCH).intensity);
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const recipe=recipeByName('electric_lamp'),bag=new SurvivalInventory(storage,'portable');
 assert.equal(recipe.id,B.ELECTRIC_LAMP);
 bag.remove(B.TORCH,bag.count(B.TORCH)-1);
 const formerSlot=bag.quickSlots.indexOf(B.TORCH);
 for(const [id,count] of Object.entries(recipe.needs)){
  if(!bag.has(Number(id),count))bag.add(Number(id),count-bag.count(Number(id)));
 }
 assert.equal(bag.craft(recipe,'bench'),true);
 assert.equal(bag.quickSlots[formerSlot],null);
 assert.equal(bag.assignQuickSlot(B.ELECTRIC_LAMP),formerSlot);
 assert.equal(bag.count(B.ELECTRIC_LAMP),1);
 assert.equal(new CreativeInventory(CREATIVE_ITEMS).has(B.ELECTRIC_LAMP),true);
 assert.ok(PALETTES.items.items.includes(B.ELECTRIC_LAMP));
 assert.equal(harvestDrop(B.ELECTRIC_LAMP),B.ELECTRIC_LAMP);
});

test('an installed lamp survives chunk serialization and keeps unrelated chunks byte-sized',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const options={mode:'flat',storage};
 const world=new World(options);
 assert.equal(world.set(1,23,2,B.LANTERN),true);
 assert.equal(world.set(17,23,2,B.ELECTRIC_LAMP),true);
 assert.ok(world.getChunk(0,0,false).data instanceof Uint8Array);
 assert.ok(world.getChunk(1,0,false).data instanceof Uint16Array);
 assert.equal(world.get(17,23,2),B.ELECTRIC_LAMP);
 assert.equal(world.lights.near(17.5,23.5,2.5,1)[0].radius,block(B.ELECTRIC_LAMP).light.radius);
 world.save();
 const restored=new World(options);
 assert.equal(restored.get(17,23,2),B.ELECTRIC_LAMP);
 assert.equal(restored.get(1,23,2),B.LANTERN);
 assert.equal(restored.set(17,23,2,B.AIR),true);
 assert.equal(restored.lights.near(17.5,23.5,2.5,1,2).length,0);
});

test('the cropped mesher worker retains wide block IDs and emissive lamp geometry',async()=>{
 const chunk=new Chunk(-1,1,64),x=4,z=5,y=27;
 chunk.set(x,y,z,B.ELECTRIC_LAMP);
 const expected=meshChunkData(chunk,{yMin:y,yMax:y+1});
 assert.ok(expected.opaque.some((value,i)=>i%7===6&&value<0));
 const offset=(y-1)*SIZE*SIZE,data=chunk.data.slice(offset,(y+2)*SIZE*SIZE);
 let result;
 globalThis.self={postMessage(value){result=value}};
 try{
  await import('../src/client/mesh.worker.js');
  self.onmessage({data:{cx:chunk.cx,cz:chunk.cz,height:64,offset,data,yMin:y,yMax:y+1,neighbors:[]}});
  assert.equal(result.error,undefined);
  assert.deepEqual(result.opaque,expected.opaque);
 }finally{delete globalThis.self}
});

test('an electric lamp can be mounted and targeted on a wall',()=>{
 const world=new World({mode:'flat'});
 world.set(4,26,4,B.CONCRETE);
 const origin={x:6.5,y:26.5,z:4.5},direction={x:-1,y:0,z:0};
 const target=raycast(world,origin,direction,5);
 assert.equal(world.placeMount(B.ELECTRIC_LAMP,target),true);
 const mounted=raycast(world,origin,direction,5);
 assert.equal(mounted.id,B.ELECTRIC_LAMP);
 assert.equal(mounted.mounted,true);
 assert.equal(world.lights.near(5,26.5,4.5,1,2)[0].id,B.ELECTRIC_LAMP);
});

test('the held volume stays small, respects an opaque wall and supports the stronger lamp',()=>{
 const world=new World({mode:'flat'});
 for(let y=23;y<=40;y++)for(let z=0;z<16;z++)world.set(10,y,z,B.CONCRETE,{simulate:false});
 const cell=[8,30,8],results=[];
 for(const id of [B.TORCH,B.ELECTRIC_LAMP]){
  const {origin,blocks,sources,size}=heldLightJob(world,portableLight(id),cell);
  assert.equal(blocks.length,21**3);
  const color=buildLightVolume(blocks,sources,{origin,width:size,height:size,depth:size});
  const sample=(x,y,z)=>color[(((z-origin[2])*size+y-origin[1])*size+x-origin[0])*4];
  assert.ok(sample(9,30,8)>0);
  assert.equal(sample(11,30,8),0);
  results.push(sample(5,30,8));
  const mesh=heldLightView(id,[8.5,30.5,8.5],0,0,0,0,(_,ray,reach)=>reach);
  assert.ok(mesh.length>0&&mesh.every(Number.isFinite));
  assert.equal(heldLightView(id,[8.5,30.5,8.5],0,0,0,0,()=>.1).length,0);
 }
 assert.ok(results[1]>results[0]);
 assert.equal(world.chunks.size,1,'lighting never generates an unseen chunk');
});

test('the moving light uploads at most once per interval and clears when put away',()=>{
 const uploads=[],gl={createTexture:()=>({}),activeTexture(){},bindTexture(){},texParameteri(){},
  texImage3D(){},texSubImage3D(...args){uploads.push(args)},TEXTURE0:0};
 const light=new HeldLight(gl),world=new World({mode:'flat'});
 world.getChunk(0,0);
 light.workerUnavailable=true;
 light.update(world,B.TORCH,[5.1,26.5,5.5],0);
 light.update(world,B.TORCH,[5.9,26.5,5.5],121);
 light.update(world,B.TORCH,[6.1,26.5,5.5],122);
 light.update(world,B.TORCH,[7.1,26.5,5.5],160);
 assert.equal(uploads.length,2);
 assert.ok(light.previous);
 light.update(world,null,[7.1,26.5,5.5],161);
 assert.equal(light.current,null);
 assert.equal(light.previous,null);
});

test('the lighting worker handles the smaller held-light request',async()=>{
 const world=new World({mode:'flat'});
 world.getChunk(0,0);
 const job=heldLightJob(world,portableLight(B.ELECTRIC_LAMP),[5,26,5]);
 let result;
 globalThis.self={postMessage(value){result=value}};
 try{
  await import('../src/client/light.worker.js');
  self.onmessage({data:{...job,token:7,blocks:job.blocks.buffer}});
  assert.equal(result.error,undefined);
  assert.equal(result.token,7);
  assert.equal(result.output.byteLength,21**3*4);
  assert.ok(new Uint8Array(result.output).some((value,i)=>i%4!==3&&value>0));
 }finally{delete globalThis.self}
});
