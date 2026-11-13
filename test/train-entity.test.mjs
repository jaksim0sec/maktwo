import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {EntityManager,Player} from '../src/entities/entities.js';
import {trainCollision,carryTrainPassenger} from '../src/core/train-collision.js';
import {stationTrainMesh} from '../src/client/station-train-mesh.js';
import {createStationTrain,TRAIN} from '../src/worldgen/station-train.js';

function preview(){
 const world=new World({mode:'station-preview'}),train=new EntityManager(world).entities[0];
 world.stream(0,0,2,25);
 return {world,train};
}

test('manual jamb control opens only its own door and leaves a walkable sill',()=>{
 const {train}=preview();
 const [a,y,z]=train.handles[0].at,player=new Player(a,23,z-1);
 const hit=train.pickControl({x:a,y:train.y+y,z:z-1},{x:0,y:0,z:1},3);
 assert.equal(hit?.index,0);
 const door=train.train.doors[0]+TRAIN.doorWidth/2;
 assert.ok(trainCollision([train],door,23,z,.67,1.53));
 assert.ok(train.useControl(hit,player));
 assert.equal(train.doorOpen.reduce((a,b)=>a+b,0),1);
 assert.ok(!trainCollision([train],door,23,z,.67,1.53));
 assert.ok(trainCollision([train],door,23,TRAIN.center+TRAIN.halfWidth-.06,.67,1.53));
 assert.ok(!train.useControl(hit,new Player(door,23,z)));
 assert.ok(train.useControl(hit,player));
});

test('the lever moves a single car, stops for blocks, and works after mining clears the line',()=>{
 const {world,train}=preview();
 const lever=train.handles.find(h=>h.kind==='lever'&&h.side===1);
 const [a,y,z]=lever.at;
 assert.equal(train.pickControl({x:a-.6,y:train.y+y+.1,z:z+.025},{x:1,y:0,z:0},3)?.kind,'lever');
 const player=new Player(0,23,.5);
 const x=train.train.end+2;
 world.set(x,train.y+1,0,B.CONCRETE);
 train.useControl(lever,player);
 for(let i=0;i<240&&train.lever;i++){
  const step=train.advance(1/60,world);
  if(step)assert.ok(carryTrainPassenger(train,player,step));
 }
 assert.equal(train.speed,0);
 assert.equal(train.lever,0);
 assert.ok(train.offset>0&&train.offset<=1);
 assert.ok(Math.abs(player.x-train.offset)<1e-8);
 world.set(x,train.y+1,0,B.AIR);
 train.useControl(lever,player);
 for(let i=0;i<180;i++)train.advance(1/60,world);
 assert.ok(train.offset>1&&train.speed>0);
});

test('one 20 m car shares a static mesh with separate leaf ranges on both axes',()=>{
 for(const axis of ['x','z']){
  const train=createStationTrain({axis}),data=stationTrainMesh(train);
  assert.equal((train.end-train.start+1)*.8,20);
  assert.equal(train.bogies.length,2);
  assert.equal(data.doorRanges.length,16);
  for(const key of ['opaque','transparent','doorSteel','doorGlass']){
   assert.ok(data[key].length>0,key);
   assert.equal(data[key].length%7,0,key);
   assert.ok(data[key].every(Number.isFinite),key);
  }
  assert.ok(data.opaque.length/7<16000);
 }
});
