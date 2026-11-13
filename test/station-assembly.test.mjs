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
import {WORLD_PRESETS,PALETTES} from '../src/core/catalog.js';

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
 assert.equal(BLOCKS.length,233);assert.equal(BLOCK_LABELS.length,233);
 assert.equal(STATION_MATERIALS.length,20);assert.equal(STATION_PARTS.length,25);
 assert.ok(BLOCKS.every((b,id)=>b.id===id&&id<=255));
 assert.equal(PARTS.length,70);
 for(const part of STATION_PARTS)assert.equal(partById(part.id)?.id,part.id);
 assert.equal(new Set(STATION_PARTS.map(p=>p.id)).size,25);
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
test('preview contains all twenty tiles and twenty-five train and station parts',()=>{
 const {map,at}=chunks(),ids=new Set();
 for(const c of map.values())for(const id of c.data)if(id)ids.add(id);
 for(const m of STATION_MATERIALS)assert.ok(ids.has(m.id),'missing tile '+m.key);
 for(const p of STATION_PARTS)assert.ok(ids.has(p.id),'missing component '+p.key);
 assert.equal(at(0,21,2),B.PART_STATION_TRACK_3);
 assert.equal(at(0,22,0),B.STATION_TRAIN_RUBBER);
 assert.ok([B.STATION_PLATFORM_STONE,B.STATION_STATION_ALGAE].includes(at(0,22,10)));
 assert.ok([B.PART_STATION_TRAINWALL_3,B.PART_STATION_TRAINWALL_4].includes(at(0,23,4)));
 assert.ok([B.PART_STATION_TRAININTERIOR_2,B.PART_STATION_TRAININTERIOR_3,B.AIR].includes(at(0,23,0)));
 assert.equal(at(0,24,STATION_PREVIEW_SPAWN.z|0),B.AIR);
 assert.ok([B.STATION_PLATFORM_STONE,B.STATION_STATION_ALGAE].includes(at(0,22,STATION_PREVIEW_SPAWN.z|0)));
 assert.ok(WORLD_PRESETS.some(p=>p.mode==='station-preview'));
 assert.ok(PALETTES.blocks.items.includes(B.STATION_PLATFORM_STONE));
 assert.ok(PALETTES.parts.items.includes(B.PART_STATION_TRAINWALL_2));
});
