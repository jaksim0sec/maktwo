import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Player} from '../src/entities/entities.js';
import {moveBody,raycast,AUTO_STEP_HEIGHT,collides} from '../src/core/physics.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK_SIZE,toMeters} from '../src/core/scale.js';
import {generateChunk} from '../src/worldgen/generators.js';

function walkToBarrier(height,ceiling=false){
 const world=new World({mode:'flat'});
 const p=new Player(.5,23.001,.5);p.grounded=true;
 for(let y=23;y<23+height;y++)world.set(0,y,-1,B.STONE,{simulate:false});
 if(ceiling)world.set(0,25,-1,B.STONE,{simulate:false});
 for(let i=0;i<20;i++){p.vz=-4;p.vx=0;moveBody(world,p,1/60)}
 return {p,world};
}
test('world voxel is physically 0.8m while player keeps human proportions and saved chunk layout',()=>{
 const p=new Player(0,25,0);
 assert.equal(BLOCK_SIZE,.8);
 assert.ok(Math.abs(toMeters(p.height)-1.9)<1e-8);
 assert.ok(Math.abs(toMeters(p.eye)-1.7)<1e-8&&p.eye<p.height);
 assert.equal(new Chunk(0,0).data.length,16*16*64);
});
test('auto step climbs exactly one full block without jumping',()=>{
 assert.equal(AUTO_STEP_HEIGHT,1);
 const {p,world}=walkToBarrier(1);
 assert.ok(p.z<-.35,`should cross barrier, z=${p.z}`);
 assert.ok(p.y>=24,`should stand on top, y=${p.y}`);
 assert.ok(!collides(world,p.x,p.y,p.z,p.width,p.height));
});
test('auto step does not climb two-block wall or pass through a ceiling',()=>{
 const wall=walkToBarrier(2);
 assert.ok(wall.p.z>-.2,`should be blocked, z=${wall.p.z}`);
 const capped=walkToBarrier(1,true);
 assert.ok(capped.p.z>-.2,`should be blocked by ceiling, z=${capped.p.z}`);
});
test('water can be mined deliberately and old spreading stays contained',()=>{
 const w=new World({mode:'flat'});
 w.set(2,25,2,B.WATER);
 const dir={x:0,y:0,z:-1},origin={x:2.5,y:25.5,z:4.5};
 assert.equal(raycast(w,origin,dir,5),null);
 const hit=raycast(w,origin,dir,5,{hitWater:true});
 assert.equal(hit.id,B.WATER);
 for(let t=0;t<40;t++)w.tick();
 assert.equal(w.get(3,25,2),B.AIR);
 assert.equal(w.get(2,24,2),B.AIR);
});
test('water repair restores only edited water, keeps buildings and natural water',()=>{
 const storage=new Map();const adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 const w=new World({mode:'islands',seed:8,name:'Test',storage:adapter});
 const naturalChunk=generateChunk(new Chunk(12,12),w.seed,w.mode);
 // Choose air well above the generated surface; preserve a custom window and a remote puddle.
 w.set(2,40,2,B.WATER);w.set(3,40,2,B.WATER);
 w.set(4,40,2,B.GLASS);w.set(50,40,50,B.WATER);
 // A naturally generated water block in an unrelated biome must never be touched.
 const natural = [...Array(16).keys()].flatMap(x=>[...Array(16).keys()].map(z=>[x,z])).find(([x,z])=>[...Array(18).keys()].some(y=>naturalChunk.get(x,y,z)===B.WATER));
 assert.ok(natural,'test world has natural water');
 const [nx,nz]=natural,ny=[...Array(18).keys()].find(y=>naturalChunk.get(nx,y,nz)===B.WATER);
 const cleaned=w.drainPlacedWater(2.5,40.5,2.5,8);
 assert.equal(cleaned,2);
 assert.equal(w.get(2,40,2),B.AIR);assert.equal(w.get(3,40,2),B.AIR);
 assert.equal(w.get(4,40,2),B.GLASS);
 assert.equal(w.get(50,40,50),B.WATER);
 assert.equal(w.get(nx+192,ny,nz+192),B.WATER);
 assert.ok(storage.get('mcweb:Test:before-water-cleanup'));
 const restored=new World({seed:8,mode:'islands',name:'Test',storage:adapter});
 assert.equal(restored.get(2,40,2),B.AIR);
 assert.equal(restored.get(4,40,2),B.GLASS);
 assert.equal(restored.get(50,40,50),B.WATER);
});
test('water repair updates saved edits even when the chunk was unloaded',()=>{
 const w=new World({mode:'flat'});w.set(1,37,1,B.WATER);w.set(1,37,2,B.PLANKS);
 w.chunks.clear();
 assert.equal(w.drainPlacedWater(1,37,1,6),1);
 assert.equal(w.get(1,37,1),B.AIR);assert.equal(w.get(1,37,2),B.PLANKS);
});
