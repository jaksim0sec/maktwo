import test from 'node:test';
import assert from 'node:assert/strict';
import {Hologram} from '../src/client/hologram.js';
const probe=(x,y,count=10)=>Hologram.prototype.hit.call({cursor:[x/1024,y/680],items:Array(count).fill({})});
test('in-world inventory hit mapping reaches the construction and light tabs',()=>{
 assert.equal(probe(120,145),'tab:blocks');
 assert.equal(probe(285,145),'tab:lights');
 assert.equal(probe(880,606),'close');
});
test('3D panel supports ten numbered items and a three-item lighting palette',()=>{
 assert.equal(probe(100,270),'item:0');
 assert.equal(probe(920,270),'item:4');
 assert.equal(probe(100,455),'item:5');
 assert.equal(probe(920,455),'item:9');
 assert.equal(probe(920,455,3),null);
});
test('inventory reticle is clamped and never changes camera yaw during selection',()=>{
 const item={opened:true,cursor:[.5,.5],items:Array(10).fill({}),hover:null,dirty:false,hit(){return Hologram.prototype.hit.call(this)}};
 Hologram.prototype.move.call(item,10000,-10000);
 assert.deepEqual(item.cursor,[.96,.05]);
 assert.equal(item.hover,null);
});
test('unlocked pointer projects onto the middle of a 3D panel and remains clamped',()=>{
 const inventory={cursor:[0,0],items:Array(10).fill({}),hover:null,dirty:false,hit(){return Hologram.prototype.hit.call(this)}};
 const rect={left:0,top:0,width:1280,height:800};
 Hologram.prototype.point.call(inventory,640,400,rect);
 assert.ok(Math.abs(inventory.cursor[0]-.5)<1e-5);
 assert.ok(Math.abs(inventory.cursor[1]-.5)<1e-5);
 Hologram.prototype.point.call(inventory,-2000,5000,rect);
 assert.deepEqual(inventory.cursor,[.02,.98]);
});
