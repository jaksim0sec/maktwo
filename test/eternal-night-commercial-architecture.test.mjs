import test from 'node:test';
import assert from 'node:assert/strict';
import {designBuilding,designShopModule} from '../src/worldgen/eternal-night-buildings.js';
import {createCityPlan,stampCityChunk} from '../src/worldgen/eternal-night-game.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,block} from '../src/core/blocks.js';
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

test('seed 9999 rasterizes solid service walls and a true two-cell door while retaining high-rises',()=>{
 const plan=createCityPlan(9999);
 const shops=plan.volumes.filter(v=>v.support===null&&v.floors.length===1);
 const street=shops.find(v=>v.frontSide===2);
 assert.ok(street,'south-facing lane-front shop is present');
 const modules=street.floors[0],store=modules.rooms.find(r=>r.kind==='service');
 assert.ok(store&&modules.partitions.length===2);
 const chunks=new Map();
 const at=(x,y,z)=>{
  const cx=Math.floor(x/16),cz=Math.floor(z/16),key=cx+','+cz;
  if(!chunks.has(key)){const c=new Chunk(cx,cz,768);stampCityChunk(c,9999);chunks.set(key,c)}
  return chunks.get(key).get((Math.floor(x)%16+16)%16,Math.floor(y),(Math.floor(z)%16+16)%16);
 };
 const mid=({a,b})=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
 for(const partition of modules.partitions){
  const [x,z]=mid(partition);
  assert.ok(block(at(x,modules.y+1,z)).opaque,'actual backroom wall');
 }
 const [dx,dz]=mid(store.door);
 assert.equal(at(dx,modules.y,dz),B.DOOR);
 assert.equal(at(dx,modules.y+1,dz),B.DOOR_TOP);
 const market=plan.volumes.filter(v=>v.support===null&&v.program==='market'&&v.floors.length>1&&v.floors.length<Math.round(70*.92));
 assert.ok(market.length>0);
 assert.ok(market.every(v=>v.floors.length<=14),'local shop-house height');
 assert.ok(plan.volumes.some(v=>v.floors.length>=Math.round(70*.92)&&v.floors.length<=Math.round(80*.92)),'core landmark is preserved');
 assert.ok(plan.links.length>100,'multilevel connections remain generated');
});

test('recessed tower balcony cannot occupy an annex skybridge pedestrian deck',()=>{
 const chunk=new Chunk(Math.floor(-66.5/16),Math.floor(271.5/16),768);
 stampCityChunk(chunk,9999);
 assert.equal(chunk.get((Math.floor(-66.5)%16+16)%16,134,(Math.floor(271.5)%16+16)%16),B.AIR);
});
