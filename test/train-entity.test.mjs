import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {EntityManager,Player} from '../src/entities/entities.js';
import {trainCollision,carryTrainPassenger} from '../src/core/train-collision.js';
import {collides} from '../src/core/physics.js';
import {stationTrainMesh} from '../src/client/station-train-mesh.js';
import {createStationTrain} from '../src/worldgen/station-train.js';

test('entity train proxies support feet on the deck and roof, and make shell solid',()=>{
 const train=new EntityManager({mode:'station-preview'}).entities[0];
 const world={trainColliders:[train],get:()=>0};
 assert.equal(trainCollision([train],-10,22.97,0,.54,1.53),true);
 assert.equal(trainCollision([train],-10,23,0,.54,1.53),false);
 assert.equal(trainCollision([train],-10,25.12,0,.54,1.53),true);
 assert.equal(trainCollision([train],-10,25.24,0,.54,1.53),false);
 assert.equal(trainCollision([train],-10,23,-1.50,.54,1.53),true);
 assert.equal(trainCollision([train],-12,23,-1.50,.54,1.53),true);
 train.setDoors(true);for(let n=0;n<110;n++)train.advance(1/60);
 assert.ok(train.doorOpen>.95);
 assert.equal(trainCollision([train],-12,23,-1.50,.54,1.53),false);
 assert.equal(trainCollision([train],-10,23,-1.50,.54,1.53),true);
 assert.equal(trainCollision([train],-12,23,-2.9,.54,1.53),false);
});
test('train can only move with doors closed; braking and rail limit work without world edits',()=>{
 const train=new EntityManager({mode:'station-preview'}).entities[0];
 train.setDoors(true);for(let n=0;n<120;n++)train.advance(1/60);
 train.control(true,false);for(let n=0;n<120;n++)train.advance(1/60);
 assert.equal(train.speed,0);
 train.setDoors(false);for(let n=0;n<130;n++)train.advance(1/60);
 train.control(true,false);for(let n=0;n<180;n++)train.advance(1/60);
 assert.ok(train.speed>0&&train.offset>0);
 assert.equal(train.setDoors(true),false);
 const before=train.speed;
 train.control(false,true);for(let n=0;n<180;n++)train.advance(1/60);
 assert.ok(train.speed<before);
 assert.equal(train.speed,0);
 train.control(true,false);for(let n=0;n<1000;n++)train.advance(1/60);
 assert.ok(train.offset<=train.limit&&train.offset>=0);
 assert.equal(train.speed,0);
});
test('standing on a moving deck is transported without writing to chunks',()=>{
 const train=new EntityManager({mode:'station-preview'}).entities[0];
 const passenger={x:-12,y:23,z:0,width:.54,grounded:true};
 const before=passenger.x;
 train.offset=.7;train.x=.7;
 assert.ok(carryTrainPassenger([train],passenger,new Map([[train.id,.7]])));
 assert.equal(passenger.x,before+.7);
 assert.ok(!carryTrainPassenger([train],{...passenger,y:20},new Map([[train.id,.7]])));
});
test('a car is static-GPU cacheable, with six distinct sliding-door buffers',()=>{
 const train=createStationTrain(),data=stationTrainMesh(train);
 for(const key of ['opaque','transparent','doorA','doorB','doorAGlass','doorBGlass']){
  assert.ok(data[key].length>0,key);
  assert.equal(data[key].length%7,0,key);
  assert.ok(data[key].every(Number.isFinite));
 }
 const faces=Object.values(data).reduce((n,arr)=>n+arr.length/7,0);
 assert.ok(faces<100000,'old train required 140k vertices');
 const same=stationTrainMesh(train);
 for(const key of Object.keys(data))assert.equal(same[key].length,data[key].length);
});
