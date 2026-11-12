import test from 'node:test';import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';import {EntityManager,Player} from '../src/entities/entities.js';
import {SurvivalInventory} from '../src/core/inventory.js';import {BLOCK as B} from '../src/core/blocks.js';
import {GestureState,HOLD_MS} from '../src/client/gestures.js';
test('dragging after a mining hold restores camera movement',()=>{
 const g=new GestureState();g.down(1,450,260,300,0,600);
 assert.deepEqual(g.miningPoint(HOLD_MS),{x:450,y:260});
 g.move(1,460,260);assert.deepEqual(g.miningPoint(HOLD_MS+50),{x:450,y:260});
 g.move(1,486,263);assert.equal(g.miningPoint(HOLD_MS+60),null);assert.ok(g.consumeLook()[0]>0);
});
test('entity hit ray respects solid occlusion',()=>{
 const w=new World({mode:'flat'}),em=new EntityManager(w);em.spawn('sheep',4.5,23,4.5);
 const o={x:2.5,y:23.6,z:4.5},d={x:1,y:0,z:0};
 assert.equal(em.hitRay(o,d,3.8)?.type,'sheep');assert.equal(em.hitRay(o,d,3.8,.9),null);
});
test('auto pickup requires proximity and empties the hotbar at zero count',()=>{
 const w=new World({mode:'flat'}),em=new EntityManager(w),inv=new SurvivalInventory(),p=new Player(8,24,8);
 em.spawnDrop(B.COBBLE,3,24,3);em.tick(.3,p,inv);assert.equal(inv.count(B.COBBLE),0);
 p.x=3.25;p.z=3.25;em.tick(.3,p,inv);assert.equal(inv.count(B.COBBLE),1);
 inv.remove(B.COBBLE,1);assert.equal(inv.quickSlots.includes(B.COBBLE),false);
});