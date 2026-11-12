import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureState,HOLD_MS} from '../src/client/gestures.js';
import {EntityManager} from '../src/entities/entities.js';
test('long hold does not trap the right camera when the pointer becomes a drag',()=>{
 const s=new GestureState();
 s.down(1,280,140,180,1000,360);
 assert.deepEqual(s.miningPoint(1000+HOLD_MS),{x:280,y:140});
 s.move(1,294,143);assert.deepEqual(s.miningPoint(1500),{x:280,y:140});
 s.move(1,301,143);assert.equal(s.miningPoint(1600),null);
 assert.ok(s.consumeLook()[0]>0);
 s.up(1,301,143,1700);assert.equal(s.miningPoint(1800),null);
});
test('entity hit targeting has small mobile assistance but respects nearer obstacles',()=>{
 const mgr=new EntityManager({seed:5});
 const mob=mgr.spawn('sheep',3,0,.60);
 const origin={x:0,y:.5,z:0},dir={x:1,y:0,z:0};
 assert.equal(mgr.hitRay(origin,dir,3.8,Infinity,0),null);
 assert.equal(mgr.hitRay(origin,dir,3.8,Infinity,.18),mob);
 assert.equal(mgr.hitRay(origin,dir,3.8,1.0,.18),null);
});
