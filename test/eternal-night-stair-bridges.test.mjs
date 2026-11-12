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
 const minX=Math.floor(Math.min(...treads.map(r=>r.x0))),maxX=Math.ceil(Math.max(...treads.map(r=>r.x1)));
 const minZ=Math.floor(Math.min(...treads.map(r=>r.z0))),maxZ=Math.ceil(Math.max(...treads.map(r=>r.z1)));
 for(let x=minX;x<maxX;x++)for(let z=minZ;z<maxZ;z++){
  const tread=treads.find(r=>x+.5>=r.x0&&x+.5<r.x1&&z+.5>=r.z0&&z+.5<r.z1);
  if(!tread)continue;
  const step=treads.indexOf(tread),surface=stairY+tread.y-b.y0;
  const encoded=encodeCityStair(surface,b.stairFacing+(step>=treads.length/2?4:0));
  const id=world.get(x,encoded.base,z);
  assert.equal(partById(id)?.family,'staircase',`stair cell ${x},${z} should exist at its designed floor`);
  const state=world.getShapeState(x,encoded.base,z);
  assert.ok(state.cityStair,`stair cell ${x},${z} must use the city profile`);
  assert.ok(Math.abs(encoded.base+state.treadHeight-surface)<.26);
  const shapes=partPrisms(id,x,encoded.base,z,state);
  assert.ok(shapes.length<=8,'no three-riser railing stack');
  if(state.rail)rails++;
  count++;
 }
 assert.ok(count>=7&&rails>0&&rails<count,'exterior rails occur only on one side of the flight');
});
test('landing connectors leave the doorway open but provide joined parapet away from it',()=>{
 assert.equal(walkwayJunction({along:1,span:20,width:2.35,doorDistance:0,sideDistance:1}).open,true);
 assert.equal(walkwayJunction({along:1,span:20,width:2.35,doorDistance:4,sideDistance:1}).endSupport,true);
 assert.equal(walkwayJunction({along:10,span:20,width:2.35,doorDistance:8,sideDistance:1}).parapet,true);
});

test('continuous bridge guard uses joined horizontal bars with one post per interval',()=>{
 const id=116+4,solo=partPrisms(id,0,30,0,{facing:0});
 const joined=partPrisms(id,0,30,0,{facing:0,cityBridge:true,bridgePost:false});
 const posted=partPrisms(id,0,30,0,{facing:0,cityBridge:true,bridgePost:true});
 assert.ok(joined.length<solo.length,'ordinary show-room passage is not stamped repeatedly');
 assert.equal(posted.length,joined.length+1);
 assert.ok(joined.every(p=>p.vertices.every(v=>v.x>=-.00001&&v.x<=1.00001)));
});
