import test from 'node:test';
import assert from 'node:assert/strict';
import {floorFinish,ceilingFixture,hasDropCeiling,interiorWallFinish} from '../src/worldgen/eternal-night-interiors.js';
import {createCityPlan,stampCityChunk} from '../src/worldgen/eternal-night-game.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';

const publicFloor={program:'exchange',y:8,top:17,level:3};
const hall={x0:0,z0:0,x1:4,z1:20,kind:'corridor'};
const shape={corridor:hall,room:null,edge:-1};
test('corridor makes a contrasting tiled central walkway and thinner reddish perimeter',()=>{
 assert.equal(floorFinish(publicFloor,shape,0.5,4.5,B.FLOOR_TILE),B.TERRACOTTA);
 assert.equal(floorFinish(publicFloor,shape,1.5,4.5,B.FLOOR_TILE),B.ARCH_TILE_LARGE_PORCELAIN);
 assert.equal(floorFinish(publicFloor,{...shape,corridor:null,room:{kind:'service'}},1.5,4.5,B.FLOOR_TILE),B.FLOOR_TILE);
 assert.equal(floorFinish({...publicFloor,program:'workshops'},shape,1.5,4.5,B.WET_TILE),B.WET_TILE);
});
test('functional ceiling tile grid sits below the structural floor, with regular embedded lighting',()=>{
 assert.equal(hasDropCeiling(publicFloor,shape),true);
 assert.equal(hasDropCeiling({...publicFloor,top:12},shape),false,'small shop headroom protected');
 assert.equal(hasDropCeiling(publicFloor,{...shape,corridor:null,room:null}),false);
 assert.equal(ceilingFixture(publicFloor,hall,1.5,6.5,0),B.FLUORESCENT);
 assert.equal(ceilingFixture(publicFloor,hall,1.5,5.5,0),B.CEILING_FINISH);
 assert.equal(ceilingFixture(publicFloor,hall,.5,6.5,0),B.CEILING_FINISH,'edge of hall stays ceiling tile');
 assert.equal(interiorWallFinish(publicFloor,B.CRACKED_CONCRETE),B.ARCH_CONCRETE_PEBBLE_PAINT);
});
test('rasterized school-like corridor has distinct floors, suspended ceiling and fixed overhead lighting',()=>{
 const plan=createCityPlan(9999),v=plan.volumes.find(v=>v.floors.some(f=>f.program==='exchange'&&f.top-f.y>=6));
 assert.ok(v,'a mixed-use public floor exists');
 const f=v.floors.find(f=>f.program==='exchange'&&f.top-f.y>=6);
 const corridor=f.corridors.find(c=>c.kind==='corridor');
 assert.ok(corridor);
 const cx=(corridor.x0+corridor.x1)/2,cz=Math.floor((corridor.z0+corridor.z1)/2)+.5;
 const chunks=new Map();
 const get=(x,y,z)=>{
  const ax=Math.floor(x),az=Math.floor(z),key=Math.floor(ax/16)+','+Math.floor(az/16);
  if(!chunks.has(key)){const c=new Chunk(Math.floor(ax/16),Math.floor(az/16),768);stampCityChunk(c,9999);chunks.set(key,c)}
  return chunks.get(key).get((ax%16+16)%16,y,(az%16+16)%16);
 };
 let ceiling=0,lights=0,centerTiles=0;
 for(let z=corridor.z0+1;z<corridor.z1-1;z++){
  const x=Math.floor(cx)+.5,zz=Math.floor(z)+.5;
  if(get(x,Math.round(f.top)-2,zz)===B.CEILING_FINISH)ceiling++;
  if(get(x,Math.round(f.top)-2,zz)===B.FLUORESCENT)lights++;
  if(get(x,Math.round(f.y)-1,zz)===B.ARCH_TILE_LARGE_PORCELAIN)centerTiles++;
 }
 assert.ok(ceiling>=3,'ceiling panels exist');
 assert.ok(lights>=1,'repeating ceiling lights exist');
 assert.ok(centerTiles>=3,'corridor floor separates from wall cladding');
});
