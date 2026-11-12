import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {CITY_STAIR_STYLE,CITY_STAIR_LEVEL_MASK,TURN_STYLE} from '../src/core/chunk.js';
import {createCityPlan} from '../src/worldgen/eternal-night-game.js';
import {partById,partGeometry} from '../src/core/part-library.js';
import {partPrisms,prismAabb} from '../src/core/part-prisms.js';
import {stairOuterRail,encodeCityStair,decodeCityStair,walkwayJunction} from '../src/worldgen/eternal-night-stairs.js';

test('a generated stair tread encodes height in the existing style byte and leaves creative stairs alone',()=>{
 for(const [height,expected] of [[16.125,.25],[16.375,.5],[16.625,.75],[16.875,1],[17,1]]){
  const encoded=encodeCityStair(height,4,true);
  const style=CITY_STAIR_STYLE|TURN_STYLE|64|encoded.facing|(encoded.quarter<<3);
  const decoded=decodeCityStair(style);
  assert.equal(decoded.height,expected);
  assert.equal(decoded.rail,true);
  assert.ok(Math.abs(encoded.base+decoded.height-height)<=.125001);
 }
 const id=partById(156)?.family==='staircase'?156:156;
 const creative=partPrisms(id,1,8,1,{facing:4});
 const generated=partPrisms(id,1,8,1,{facing:4,cityStair:true,treadHeight:.75,rail:false});
 assert.ok(creative.length>generated.length,'city tread is not three repeated risers and two full rails');
 assert.ok(generated.length<=4,'one foundation, one wear plate and small anti-slip details');
 assert.ok(generated.some(p=>Math.abs(prismAabb(p).y+prismAabb(p).h-8.75)<.001));
});
test('generated staircase has one rail-bearing edge and a consistent physical top for all directions',()=>{
 const plan=createCityPlan(9999),b=plan.volumes.find(v=>v.floors.length>=70);
 assert.ok(b&&b.stairs[0].treads.length>=16);
 const world=new World({seed:9999,mode:'eternal-city-lab'});
 const {treads}=b.stairs[0],level=2,stairY=b.floors[level].y;
 let count=0,rails=0;
 for(let i=0;i<treads.length;i++){
  const step=treads[i],x=Math.floor((step.x0+step.x1)/2)+.5,z=Math.floor((step.z0+step.z1)/2)+.5;
  const surface=stairY+step.y-b.y0,encoded=encodeCityStair(surface,b.stairFacing+(i>=treads.length/2?4:0));
  const id=world.get(x,encoded.base,z);
  assert.equal(partById(id)?.family,'staircase',`tread ${i} should exist at its designed floor`);
  const state=world.getShapeState(x,encoded.base,z);
  assert.ok(state.cityStair,`tread ${i} must use the city profile`);
  assert.ok(Math.abs(encoded.base+state.treadHeight-surface)<.26);
  const shapes=partPrisms(id,Math.floor(x),encoded.base,Math.floor(z),state);
  assert.ok(shapes.length<=8,'no three-riser railing stack');
  if(state.rail)rails++;
  count++;
 }
 assert.ok(count>=16&&rails<count,'outer rails do not occupy every voxel');
});
test('landing connectors leave the doorway open but provide joined parapet away from it',()=>{
 assert.equal(walkwayJunction({along:1,span:20,width:2.35,doorDistance:0,sideDistance:1}).open,true);
 assert.equal(walkwayJunction({along:1,span:20,width:2.35,doorDistance:4,sideDistance:1}).endSupport,true);
 assert.equal(walkwayJunction({along:10,span:20,width:2.35,doorDistance:8,sideDistance:1}).parapet,true);
});
