import test from 'node:test';
import assert from 'node:assert/strict';
import {designBuilding,designShopModule} from '../src/worldgen/eternal-night-buildings.js';
import {facadeBay,enclosedPassageBay} from '../src/worldgen/eternal-night-facade.js';

const makeTall=()=>({id:3,x0:0,z0:0,x1:34,z1:42,y0:8,y1:80,type:0,highRise:true,program:'market',support:null,phase:.2,precinct:0});
const lineMid=line=>[(line.a[0]+line.b[0])/2,(line.a[1]+line.b[1])/2];

test('market floors use real shop and storeroom compartments instead of open unused facade buffers',()=>{
 const building=makeTall();assert.ok(designBuilding(building,1.5,()=>.45));
 const floor=building.floors.find(f=>f.program==='market');
 const shops=floor.rooms.filter(r=>r.kind==='shop');
 const stores=floor.rooms.filter(r=>r.kind==='service');
 assert.ok(shops.length>=4,'market has repeated shop bays');
 assert.ok(stores.length>=4,'each long shop bay has a rear service room');
 assert.ok(stores.every(r=>r.door),'back rooms have connecting doors');
 assert.ok(floor.partitions.length>shops.length*3,'full front and rear partition runs');
});

test('all four small shop fronts face their true lane and split a rear service compartment',()=>{
 for(let side=0;side<4;side++){
  const building={id:20,x0:0,x1:8,z0:0,z1:8,y0:8,support:null,frontSide:side,program:'shops'};
  assert.ok(designShopModule(building,1.5,()=>.45));
  const floor=building.floors[0],port=floor.doors[0];
  const shop=floor.rooms.find(r=>r.kind==='shop'),store=floor.rooms.find(r=>r.kind==='service');
  assert.ok(shop&&store,'shop and rear storage must be separate');
  const mid=lineMid(shop.door);
  assert.ok(Math.hypot(mid[0]-port.x,mid[1]-port.z)<.2,'shop door faces lane');
  assert.equal(floor.partitions.length,2,'two wall halves flank one service door');
 }
});

test('semantic facade uses commercial storefront only at front and suppresses office window grids',()=>{
 const mk=(program,level,edge,bay)=>facadeBay({program,level,entryLevel:1,edge,bay,stride:5});
 assert.equal(mk('shops',1,0,1).opening,'shopfront');
 assert.equal(mk('shops',1,2,1).opening,'wall');
 assert.equal(mk('housing',8,0,1).opening,'wall');
 assert.equal(mk('housing',8,0,2).opening,'window');
 assert.equal(mk('workshops',6,0,3).opening,'wall');
 assert.equal(mk('workshops',6,4,3).vent,true);
 for(let bay=0;bay<5;bay++)assert.equal(mk('housing',6,0,bay).sign,false);
});

// Integration tests verify the city plan's programme, not merely the facade selector.
// The first entry on each street is a shop or low/mid-rise mixed-use building.

test('enclosed connecting corridors are mostly solid walls and have no random shop signs',()=>{
 const bays=Array.from({length:7},(_,i)=>enclosedPassageBay(i));
 assert.ok(bays.filter(b=>b.window).length<=2,'bridge must not become a curtain wall');
 assert.ok(bays.every(b=>b.sign===false),'signs require an actual tenant');
 assert.ok(bays.every(b=>b.wall||b.window),'every edge is enclosed');
});
