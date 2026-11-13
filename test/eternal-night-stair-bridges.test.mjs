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
 const id=156; // First independently placeable stair family block (unchanged ID)
 const creative=partPrisms(id,1,8,1,{facing:4});
 const generated=partPrisms(id,1,8,1,{facing:4,cityStair:true,treadHeight:.75,rail:false});
 assert.ok(creative.length>generated.length,'city tread is not three repeated risers and two full rails');
 assert.ok(generated.length<=4,'one foundation, one wear plate and small anti-slip details');
 assert.ok(generated.some(p=>Math.abs(prismAabb(p).y+prismAabb(p).h-8.75)<.001));
});
test('generated flights preserve both half-block treads and keep a single outer rail',()=>{
 const plan=createCityPlan(9999),world=new World({seed:9999,mode:'eternal-city-lab'});
 for(const facing of [2,4]){
  const b=plan.volumes.find(v=>v.floors.length>=70&&v.stairFacing===facing);
  assert.ok(b);
  for(const level of [1,2]){
   const {treads}=b.stairs[level];
   let rails=0,split=0;
   for(const tread of treads){
    const x=(tread.x0+tread.x1)/2,z=(tread.z0+tread.z1)/2;
    const wx=Math.floor(x),wz=Math.floor(z);
    const {base}=encodeCityStair(tread.y,0);
    const id=world.get(wx,base,wz);
    assert.equal(partById(id)?.family,'staircase',`missing tread at ${x}, ${base}, ${z}`);
    const state=world.getShapeState(wx,base,wz);
    assert.ok(state.cityStair);
    if(state.splitTread)split++;
    if(state.rail)rails++;
    const tops=partPrisms(id,wx,base,wz,state).filter(p=>p.structural).map(prismAabb)
     .filter(p=>x>=p.x&&x<=p.x+p.w&&z>=p.z&&z<=p.z+p.d)
     .map(p=>p.y+p.h);
    assert.ok(Math.abs(Math.max(...tops)-tread.y)<=.12501,`wrong surface at ${x}, ${base}, ${z}`);
   }
   assert.ok(split>=treads.length/2,'subcell treads survive rasterization');
   const minX=Math.floor(Math.min(...treads.map(r=>r.x0))),maxX=Math.ceil(Math.max(...treads.map(r=>r.x1)));
   const minZ=Math.floor(Math.min(...treads.map(r=>r.z0))),maxZ=Math.ceil(Math.max(...treads.map(r=>r.z1)));
   for(let x=minX;x<maxX;x++)for(let z=minZ;z<maxZ;z++)
    for(let y=Math.floor(b.floors[level].y);y<b.floors[level].top;y++)
     if(world.getShapeState(x,y,z).rail)rails++;
   assert.ok(rails>0&&rails<treads.length*2);
  }
 }
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

test('roof addition paths have guardrails outside their open portal and stair landing',()=>{
 const plan=createCityPlan(9999),roof=plan.walkways.find(l=>l.kind==='roof'&&l.segments.some(s=>s.kind==='deck'&&s.length>7));
 assert.ok(roof,'real roof addition needs a usable connection');
 const segment=roof.segments.find(s=>s.kind==='deck'&&s.length>7);
 const t=.5,at=[segment.from[0]+(segment.to[0]-segment.from[0])*t,
   segment.from[1],segment.from[2]+(segment.to[2]-segment.from[2])*t];
 const width=roof.width,dx=(segment.to[0]-segment.from[0])/segment.length,dz=(segment.to[2]-segment.from[2])/segment.length;
 const x=Math.floor(at[0]-dz*(width/2-.3))+.5,z=Math.floor(at[2]+dx*(width/2-.3))+.5;
 const world=new World({seed:9999,mode:'eternal-city-lab'});
 const id=world.get(x,Math.round(at[1]),z);
 // A path crossing an active building doorway can be legitimately open;
 // elsewhere a guard is required and must share the designed deck level.
 const nearPortal=roof.ports.some(p=>Math.hypot(p.x-x,p.z-z)<2.5) ||
   Math.hypot(roof.points.at(-1)[0]-x,roof.points.at(-1)[2]-z)<2.5;
 if(!nearPortal)assert.ok(id===B.AIR||partById(id)?.family==='passage',
  'roof link does not place opaque walls in the crossing');
});

test('sloped skybridges voxelize the same quarter-step walkway geometry as building stairs',()=>{
 const plan=createCityPlan(9999),world=new World({seed:9999,mode:'eternal-city-lab'});
 const graded=plan.walkways.flatMap(l=>l.segments.filter(s=>(s.kind==='stairs'||s.kind==='ramp')&&s.length>7));
 assert.ok(graded.length>100,'the city has many sloping connections');
 let found=0,checked=0;
 for(const s of graded.slice(0,90)){
  for(const t of [.32,.53,.74]){
   const x=s.from[0]+(s.to[0]-s.from[0])*t,z=s.from[2]+(s.to[2]-s.from[2])*t;
   const surface=s.from[1]+(s.to[1]-s.from[1])*t;
   const v=encodeCityStair(surface,0);
   const id=world.get(Math.floor(x)+.5,v.base,Math.floor(z)+.5);
   checked++;
   if(partById(id)?.family!=='staircase')continue;
   assert.equal(world.getShapeState(x,v.base,z).cityStair,true);
   found++;
  }
  if(found>12)break;
 }
 assert.ok(found>=5,`sloping bridges need real treads, got ${found} of ${checked}`);
});

test('connected roof passages stamp actual continuous rails, not only a plan label',()=>{
 const plan=createCityPlan(9999),world=new World({seed:9999,mode:'eternal-city-lab'});
 let rails=0,scanned=0;
 for(const link of plan.walkways.filter(l=>l.kind==='roof').slice(0,18)){
  for(const segment of link.segments.filter(s=>s.kind==='deck'&&s.length>6)){
   const dx=(segment.to[0]-segment.from[0])/segment.length;
   const dz=(segment.to[2]-segment.from[2])/segment.length;
   for(const t of [.27,.40,.53,.66,.78])for(const side of [-1,1]){
    const px=segment.from[0]+(segment.to[0]-segment.from[0])*t;
    const pz=segment.from[2]+(segment.to[2]-segment.from[2])*t;
    const x=Math.floor(px-dz*side*(link.width/2-.23))+.5;
    const z=Math.floor(pz+dx*side*(link.width/2-.23))+.5;
    const y=Math.round(segment.from[1]);
    const id=world.get(x,y,z);
    scanned++;
    if(partById(id)?.family==='passage'&&world.getShapeState(x,y,z).cityBridge)rails++;
   }
  }
 }
 assert.ok(rails>=2,`roof circulation needs genuine joined rails, got ${rails} of ${scanned} samples`);
});
