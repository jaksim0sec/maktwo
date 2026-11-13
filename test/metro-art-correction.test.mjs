import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {materialFor,makeTextureLayers} from '../src/client/textures.js';
import {hasDetailedMaterial,sampleDetailedMaterial} from '../src/client/material-art.js';
import {STATION_PARTS,stationPartGeometry} from '../src/core/station-parts.js';
import {createStationTrain} from '../src/worldgen/station-train.js';
import {stationTrainMesh} from '../src/client/station-train-mesh.js';

test('blue and crazed ceramic are baked from the rare hairline sampler',()=>{
 assert.equal(hasDetailedMaterial('station',8),true);
 assert.equal(hasDetailedMaterial('architecture',4),true);
 const atlas=makeTextureLayers();
 assert.equal(atlas.size,32);
 assert.equal(atlas.layers,94);
 for(const [id,group,kind] of [[B.STATION_STATION_BLUE,'station',8],[B.ARCH_TILE_CRAZED,'architecture',4]]){
  const layer=materialFor(id,0)-1;
  for(const [x,y] of [[3,5],[12,13],[21,23],[29,29]]){
   const [shade,r,g,b]=sampleDetailedMaterial(group,kind,x,y,32);
   const i=((layer*32+y)*32+x)*4;
   assert.equal(atlas.data[i],Math.round(Math.min(255,255*shade*r)));
   assert.equal(atlas.data[i+1],Math.round(Math.min(255,255*shade*g)));
   assert.equal(atlas.data[i+2],Math.round(Math.min(255,255*shade*b)));
  }
 }
});

test('all 30 original metro building parts retain stable, bounded geometry',()=>{
 assert.equal(STATION_PARTS.length,30);
 for(const part of STATION_PARTS){
  const pieces=stationPartGeometry(part.id);
  assert.ok(pieces?.length>0,part.name);
  for(const p of pieces){
   for(const value of [p.x,p.y,p.z,p.w,p.h,p.d])assert.ok(Number.isFinite(value),part.name);
   assert.ok(p.x>=0&&p.y>=0&&p.z>=0&&p.w>0&&p.h>0&&p.d>0,part.name);
   assert.ok(p.x+p.w<=1.000001&&p.y+p.h<=1.000001&&p.z+p.d<=1.000001,part.name);
  }
 }
 const bench=stationPartGeometry(B.PART_STATION_TRAININTERIOR_1);
 assert.equal(bench.filter(p=>p.material===B.STATION_TRAIN_SEAT&&p.y<.51).length,3);
 const gate=stationPartGeometry(B.PART_STATION_PLATFORM_4);
 assert.ok(gate.filter(p=>p.alpha).length>=2);
 const stair=stationPartGeometry(B.PART_STATION_STATIONLINK_5);
 assert.equal(stair.filter(p=>p.solid).length,3);
});

test('moving metro preserves 8 paired doors, separate moving leaves and finite meshes',()=>{
 for(const axis of ['x','z']){
  const train=createStationTrain({axis}),model=stationTrainMesh(train);
  assert.equal(model.doorRanges.length,16);
  for(const kind of ['opaque','transparent','doorSteel','doorGlass']){
   assert.ok(model[kind].length>0);
   assert.equal(model[kind].length%7,0);
   assert.ok(model[kind].every(Number.isFinite));
  }
  assert.ok(model.opaque.length/7>2600,'bench pads and rails are real geometry');
 }
});
