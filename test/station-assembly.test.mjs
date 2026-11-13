import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS,BLOCK_LABELS} from '../src/core/blocks.js';
import {STATION_MATERIALS,STATION_MATERIAL_START,STATION_PART_START} from '../src/core/station-materials.js';
import {STATION_PARTS,stationPartGeometry} from '../src/core/station-parts.js';
import {partById,partGeometry,PARTS} from '../src/core/part-library.js';
import {shapeBoxes} from '../src/core/shapes.js';
import {materialFor,makeTextureLayers,MATERIALS} from '../src/client/textures.js';
import {stampStationPreview,STATION_PREVIEW_SPAWN} from '../src/worldgen/station-preview.js';
import {createStationTrain,stampStationTrainColumn} from '../src/worldgen/station-train.js';
import {WORLD_PRESETS,PALETTES} from '../src/core/catalog.js';
import {createCityPlan,stampCityChunk} from '../src/worldgen/eternal-night-game.js';
import {EntityManager} from '../src/entities/entities.js';

const chunks=()=>{const map=new Map();
 for(let cz=-2;cz<=2;cz++)for(let cx=-2;cx<=2;cx++){
  const chunk=stampStationPreview(new Chunk(cx,cz),9999);
  map.set(cx+','+cz,chunk);
 }
 const at=(x,y,z)=>{
  const cx=Math.floor(x/16),cz=Math.floor(z/16);
  return map.get(cx+','+cz)?.get(x-cx*16,y,z-cz*16)||0;
 };
 return {map,at};
};
test('append-only station registry preserves 188 previous IDs and 8-bit chunk format',()=>{
 assert.equal(B.CRATE,187);
 assert.equal(STATION_MATERIAL_START,188);
 assert.equal(STATION_PART_START,208);
 assert.ok(BLOCKS.length>=246);assert.equal(BLOCK_LABELS.length,BLOCKS.length);
 assert.equal(STATION_MATERIALS.length,20);assert.equal(STATION_PARTS.length,30);
 assert.ok(BLOCKS.every((b,id)=>b.id===id&&id<=255));
 assert.equal(PARTS.length,70);
 for(const part of STATION_PARTS)assert.equal(partById(part.id)?.id,part.id);
 assert.equal(new Set(STATION_PARTS.map(p=>p.id)).size,30);
});
test('all 20 distinct pixel tiles are loaded and mapped to consecutive atlas layers',()=>{
 const atlas=makeTextureLayers();
 assert.equal(atlas.layers,MATERIALS.length);assert.equal(atlas.layers,90);
 assert.equal(atlas.data.length,32*32*4*90);
 const hashes=[];
 for(let i=0;i<20;i++){
  const id=STATION_MATERIALS[i].id,layer=materialFor(id,0)-1;
  assert.equal(layer,70+i);
  const offset=layer*32*32*4,pixels=atlas.data.subarray(offset,offset+32*32*4);
  assert.ok(pixels.every(Number.isFinite));
  // Each tile must have actual pixel variation, not a flat tinted placeholder.
  const grays=new Set();for(let n=0;n<pixels.length;n+=4)grays.add(pixels[n]);
  assert.ok(grays.size>=5,STATION_MATERIALS[i].name);
  hashes.push(Array.from(pixels).join(','));
 }
 assert.equal(new Set(hashes).size,20);
});
test('sliding door, glazing, rails, seats and hanging handles have honest physical geometry',()=>{
 for(const part of STATION_PARTS){
  const pieces=stationPartGeometry(part.id);
  assert.ok(pieces.length>0,part.key);
  assert.deepEqual(partGeometry(part.id),pieces);
  for(const p of pieces){
   assert.ok(p.w>0&&p.h>0&&p.d>0);
   assert.ok(p.x>=0&&p.y>=0&&p.z>=0);
   assert.ok(p.x+p.w<=1.00001&&p.y+p.h<=1.00001&&p.z+p.d<=1.00001);
   assert.ok(p.material>=188&&p.material<208);
  }
  assert.ok(shapeBoxes(part.id,0,0,0).every(p=>p.w>0));
 }
 const shell=stationPartGeometry(B.PART_STATION_TRAINWALL_1);
 const window=stationPartGeometry(B.PART_STATION_TRAINWALL_2);
 const doorL=stationPartGeometry(B.PART_STATION_TRAINWALL_3);
 const doorR=stationPartGeometry(B.PART_STATION_TRAINWALL_4);
 assert.ok(shell.some(p=>p.d<.06));
 assert.ok(window.some(p=>p.alpha));
 assert.ok(doorL.some(p=>p.alpha)&&doorR.some(p=>p.alpha));
 assert.notDeepEqual(doorL,doorR);
 assert.ok(stationPartGeometry(B.PART_STATION_TRAININTERIOR_3).length>=12);
});
test('preview retains station architecture while train is an independent entity',()=>{
 const {map,at}=chunks(),ids=new Set();
 for(const c of map.values())for(const id of c.data)if(id)ids.add(id);
 for(const material of STATION_MATERIALS)assert.ok(ids.has(material.id));
 for(const id of [B.PART_STATION_TRACK_3,B.PART_STATION_PLATFORM_3,B.PART_STATION_STATIONLINK_1])
  assert.ok(ids.has(id));
 assert.equal(at(0,21,1),B.PART_STATION_TRACK_3);
 assert.equal(at(0,23,0),B.AIR,'no old solid train overlaps the moving entity');
 assert.equal(at(-13,23,2),B.AIR,'train doors are not static chunk voxels');
 assert.equal(at(0,25,0),B.AIR,'train roof no longer resides in a chunk');
 assert.ok([B.STATION_PLATFORM_STONE,B.STATION_STATION_ALGAE].includes(at(0,22,10)));
 assert.ok(WORLD_PRESETS.some(p=>p.mode==='station-preview'));
 assert.ok(PALETTES.blocks.items.includes(B.STATION_PLATFORM_STONE));
 assert.ok(PALETTES.parts.items.includes(B.PART_STATION_TRAINWALL_2));
 const manager=new EntityManager({mode:'station-preview'});
 assert.equal(manager.entities.filter(e=>e.type==='train').length,1);
 assert.equal(manager.world.trainColliders.length,1);
});
test('assembled moving train connects the roof and has 8 physically openable door pairs',()=>{
 const train=createStationTrain(),parts=new Map();
 const at=(x,y,z)=>parts.get(`${x},${y},${z}`);
 for(let x=train.start-1;x<=train.end+1;x++)
  for(let z=-2;z<=2;z++){
   const put=(y,id)=>parts.set(`${x},${y},${z}`,id);
   stampStationTrainColumn(train,x,z,put);
  }
 for(const z of [-1,1])for(const x of [-15,-4,4,15]){
  assert.equal(at(x,21,z),B.PART_STATION_TRAINRUNNING_1);
  assert.equal(at(x,22,z),B.STATION_TRAIN_RUBBER);
 }
 for(const z of [-2,2])for(const x of [-15,-4,4,15])
  assert.equal(at(x,22,z),B.PART_STATION_TRAINRUNNING_2);
 for(const z of [-2,2])for(const [left,right] of [[-13,-12],[-7,-6],[6,7],[12,13]]){
  assert.equal(at(left,23,z),B.PART_STATION_TRAINWALL_3);
  assert.equal(at(right,23,z),B.PART_STATION_TRAINWALL_4);
 }
 assert.equal(at(0,21,0),B.PART_STATION_TRAINRUNNING_4);
 assert.equal(at(0,25,0),B.PART_STATION_TRAINWALL_5);
 const geometry=stationPartGeometry(B.PART_STATION_TRAINWALL_5);
 assert.equal(Math.min(...geometry.map(p=>p.y)),0,'roof underface must meet wall top');
 assert.ok(geometry.some(p=>p.y+p.h>.18));
 assert.equal(train.carriages.reduce((n,c)=>n+c.doors.length*2,0),8);
 const entity=new EntityManager({mode:'station-preview'}).entities[0];
 assert.equal(entity.train.start,train.start);
 assert.ok(entity.setDoors(true));for(let i=0;i<100;i++)entity.advance(1/60);
 assert.ok(entity.doorOpen>.95);
 assert.ok(!entity.speed);
 assert.ok(entity.setDoors(false));for(let i=0;i<100;i++)entity.advance(1/60);
 assert.equal(entity.doorOpen,0);
});
test('train assembly also composes cars across chunks when oriented north-south',()=>{
 const train=createStationTrain({x:9,z:18,cars:3,axis:'z'});
 const seen=new Map(),putAt=(x,z)=>(y,id,turn)=>seen.set(`${x},${y},${z}`,{id,turn});
 for(let z=train.z+train.start-1;z<=train.z+train.end+1;z++)for(let x=4;x<=14;x++)
  stampStationTrainColumn(train,x,z,putAt(x,z));
 const id=(x,y,z)=>seen.get(`${x},${y},${z}`)?.id;
 assert.equal(train.carriages.length,3);
 assert.equal(id(10,21,train.z+train.carriages[0].bogies[0]),B.PART_STATION_TRAINRUNNING_1);
 assert.equal(id(11,23,train.z+train.carriages[0].doors[0][0]),B.PART_STATION_TRAINWALL_3);
 assert.equal(id(9,23,train.z+train.carriages[0].to+2),undefined,'the center of each gangway remains open');
 assert.equal(id(9,25,train.z+train.carriages[0].to+2),B.PART_STATION_TRAINWALL_5);
});

test('four suspended city stations share two library levels and own trains as entities',()=>{
 const plan=createCityPlan(9999,7);
 assert.equal(plan.stations.length,4);
 assert.equal(new Set(plan.stations.map(s=>s.y)).size,2);
 assert.equal(createCityPlan(9999,6).stations.length,0,'saved earlier cities retain their layout');
 const manager=new EntityManager({mode:'eternal-city-lab',version:7,seed:9999});
 assert.equal(manager.entities.filter(e=>e.type==='train').length,4);
 for(const site of plan.stations){
  const x=Math.round(site.x),z=Math.round(site.z),cx=Math.floor(x/16),cz=Math.floor(z/16);
  const chunk=stampCityChunk(new Chunk(cx,cz,768),9999,7);
  const at=(y,cross=0)=>site.axis==='x'?chunk.get(x-cx*16,y,z+cross-cz*16):chunk.get(x+cross-cx*16,y,z-cz*16);
  assert.equal(at(site.y-2,1),B.PART_STATION_TRACK_3);
  assert.equal(at(site.y-1,3),B.STATION_PLATFORM_TACTILE);
  assert.equal(at(site.y+7,3),B.STATION_STATION_CREAM);
 }
});
