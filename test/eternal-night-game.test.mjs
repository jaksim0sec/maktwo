import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B,block} from '../src/core/blocks.js';
import {WORLD_PRESETS} from '../src/core/catalog.js';
import {Player} from '../src/entities/entities.js';
import {createCityPlan} from '../src/worldgen/eternal-night-game.js';
import {partById} from '../src/core/part-library.js';
import {meshChunkData} from '../src/client/mesher.js';
import {Chunk,SIZE} from '../src/core/chunk.js';

test('market precincts pack connected modules and upper districts have their own programmes',()=>{
  const plan=createCityPlan(9999);
  const roots=plan.volumes.filter(v=>v.support===null);
  const occupied=roots.reduce((sum,v)=>sum+v.gw*v.gd,0);
  assert.ok(occupied/plan.buildable.reduce((sum,n)=>sum+n,0)>.57);
  assert.ok(plan.precincts.some(p=>p.modules.length>=5));
  assert.ok(plan.volumes.filter(v=>v.support!==null).length>=25);
  assert.ok(roots.some(v=>v.floors.some(f=>f.program==='market'&&f.rooms.filter(r=>r.kind==='shop').length>=6)));
  const tall=roots.find(v=>v.floors.length>=70);
  assert.ok(new Set(tall.floors.map(f=>f.program)).size>=4);
  assert.ok(tall.floors.every(f=>Number.isFinite(f.luxury)&&Number.isFinite(f.access)));
  assert.ok(tall.floors.at(-1).luxury<Math.max(...tall.floors.slice(10,50).map(f=>f.luxury)));
  assert.ok(new Set(plan.links.map(l=>l.typology)).size>=4);
  assert.ok(plan.links.some(l=>l.typology==='annex'&&l.landings.some(p=>p.kind==='annex-bay')));
  assert.ok(roots.some(v=>v.floors.some(f=>f.outline.length>8)));
});

test('the city voxelizes high-rise floors, varied parts and multiple bridge heights',()=>{
  const plan=createCityPlan(9999);
  const tower=plan.volumes.find(v=>v.floors.length>=70&&v.floors.length<=80);
  assert.ok(tower && plan.layout.width>=900);
  assert.ok(plan.links.some(a=>plan.links.some(b=>a!==b && a.ports[0].building===b.ports[0].building && Math.abs(a.ports[0].y-b.ports[0].y)>40)));
  const world=new World({seed:9999,mode:'eternal-city-lab'});
  const floor=tower.floors[69],families=new Set();
  for(let x=Math.floor(tower.x0);x<tower.x1;x++)for(let z=Math.floor(tower.z0);z<tower.z1;z++) {
    for(let y=Math.round(floor.y);y<Math.round(floor.top);y++){
      const part=partById(world.get(x,y,z));
      if(part)families.add(part.family);
    }
  }
  assert.ok(families.has('window')&&families.has('staircase')&&families.has('interior'));
  const chunk=world.getChunk(Math.floor((tower.x0+2)/16),Math.floor((tower.z0+2)/16));
  const mesh=meshChunkData(chunk,{yMin:Math.floor(floor.y),yMax:Math.ceil(floor.top)});
  assert.ok(mesh.opaque.length>0);
  assert.ok(mesh.opaque[1]>64);
  assert.equal(new World().getChunk(0,0).height,64);
});

test('a cropped worker payload keeps its absolute floor height and the ceiling halo',async()=>{
  const full=new Chunk(0,0,768);
  full.set(0,400,0,B.CONCRETE);
  full.set(0,401,0,B.CONCRETE);
  const yMin=400,yMax=401,offset=(yMin-1)*SIZE*SIZE;
  const data=full.data.slice(offset,(yMax+1)*SIZE*SIZE).buffer;
  const expected=meshChunkData(full,{yMin,yMax});
  let result;
  globalThis.self={postMessage(value){result=value;}};
  try {
    await import('../src/client/mesh.worker.js');
    self.onmessage({data:{cx:0,cz:0,height:768,data,offset,yMin,yMax,neighbors:[],seed:0}});
    assert.equal(result.error,undefined);
    assert.deepEqual(result.opaque,expected.opaque);
    assert.ok(result.opaque[1]>=400);
  } finally {delete globalThis.self;}
});

test('city lab spawns on a walkable building floor with air and a ceiling',()=>{
  const preset=WORLD_PRESETS.find(p=>p.name==='EternalNightCityLab');
  assert.ok(preset);
  const world=new World(preset);
  const {x,y,z}=world.spawn();
  assert.ok(block(world.get(x,y-1,z)).opaque);
  assert.equal(world.get(x,y,z),B.AIR);
  assert.equal(world.get(x,y+1,z),B.AIR);
  assert.ok([3,4,5,6,7].some(d=>block(world.get(x,y+d,z)).solid));
});

test('a player can walk from the test spawn through the doorway onto the main walkway',()=>{
  const world=new World(WORLD_PRESETS.find(p=>p.name==='EternalNightCityLab'));
  const {x,y,z}=world.spawn();
  const player=new Player(x,y,z);
  const door=createCityPlan(world.seed).walkways.filter(l=>l.kind==='core').map(l=>l.ports[0])
    .find(p=>Math.round(p.y)===y&&Math.hypot(p.x-x,p.z-z)<5);
  assert.ok(door);
  player.yaw=Math.atan2(-door.dx,-door.dz);
  for(let i=0;i<31;i++)player.update(world,1/60,{forward:true});
  assert.ok((player.x-door.x)*door.dx+(player.z-door.z)*door.dz>.25,'player crossed the exterior doorway');
  assert.ok(Math.abs(player.y-y)<.05&&player.grounded,'the deck supported the player');
});

test('switchback stairs reach low, middle and upper landings at every generated storey pitch',()=>{
  const world=new World(WORLD_PRESETS.find(p=>p.name==='EternalNightCityLab'));
  const plan=createCityPlan(world.seed);
  const samples=new Map();
  for(const b of plan.volumes)if(b.floors.length>6&&!samples.has(b.storeyHeight))samples.set(b.storeyHeight,b);
  assert.ok(samples.size>=3);
  for(const building of samples.values())for(const level of [1,Math.floor(building.floors.length/2),building.floors.length-2]) {
  const s=building.stairs[level], treads=s.treads;
  const alongX=building.stairFacing===2;
  const center=(r,axis)=>Math.floor((r[axis+'0']+r[axis+'1'])/2)+.5;
  const waypoint=(lane,depth)=>alongX?[center(depth,'x'),center(lane,'z')]:[center(lane,'x'),center(depth,'z')];
  const [x,z]=waypoint(treads[0],s.upperLanding);
  const player=new Player(x,Math.round(s.fromY),z);
  for(const [tx,tz] of [waypoint(treads[0],s.landing),waypoint(treads.at(-1),s.landing),waypoint(treads.at(-1),s.upperLanding)]) {
    for(let i=0;i<160&&Math.hypot(player.x-tx,player.z-tz)>.14;i++) {
      player.yaw=Math.atan2(player.x-tx,player.z-tz);
      player.update(world,1/60,{forward:true});
    }
    assert.ok(Math.hypot(player.x-tx,player.z-tz)<.15,`pitch ${building.storeyHeight} floor ${level}: missed landing`);
  }
  assert.ok(player.grounded&&Math.abs(player.y-Math.round(s.toY))<.05);
  }
});
