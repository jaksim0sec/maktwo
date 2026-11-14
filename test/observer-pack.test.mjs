import test from 'node:test';
import assert from 'node:assert/strict';
import {ObserverPack} from '../src/entities/observers.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Player} from '../src/entities/entities.js';

const world={
 seed:56,height:120,trainColliders:[],
 getChunk(cx,cz,create){assert.equal(create,false);return {};},
 get(x,y,z,create){assert.equal(create,false);return y<10?B.STONE:B.AIR;}
};
const player={x:0,y:10,z:0,width:.6,height:1.53,eye:1.39,direction:()=>({x:0,y:0,z:-1})};
const spawn=(options={})=>{
 const pack=new ObserverPack(world,{count:3,...options});
 pack.clock=5;pack.spawn(player,32);pack.publish();
 assert.ok(pack.active);
 return pack;
};

test('Observers materialize out of view and keep only group data after five minutes',()=>{
 const pack=spawn();
 assert.ok(pack.views.every(p=>pack.invisible({...player,y:11.39},player.direction(),p)));
 const before={...pack.active.point};
 const distant={...player,x:200};
 pack.tick(.3,distant,32);
 assert.equal(pack.views.length,0);
 assert.deepEqual(pack.active.point,before);
 pack.tick(301,distant,32);
 assert.equal(pack.active,null);
 assert.equal(pack.count,3);
});
test('only the hit member gets health, body hits take three and a head hit can kill immediately',()=>{
 const pack=spawn({random:()=>.49});
 pack.damage(0,'body');assert.equal(pack.active.members.size,1);
 assert.equal(pack.active.members.get(0).hp,2);
 pack.damage(0,'body');assert.equal(pack.active.members.get(0).hp,1);
 pack.damage(0,'body');pack.damage(1,'head');
 assert.equal(pack.count,1);
 assert.equal(pack.active.members.get(1).dead,true);
 assert.equal(pack.active.members.has(2),false);
});
test('safe pavement does not create a herd target and a ledge does',()=>{
 const pack=spawn();
 assert.equal(pack.threatDirection(player,{x:-2,y:10,z:0}),null);
 const ledge={...world,get(x,y,z,create){assert.equal(create,false);return y<10&&x<.99?B.STONE:B.AIR;}};
 const edgePack=new ObserverPack(ledge,{count:3});
 assert.ok(edgePack.threatDirection(player,{x:-2,y:10,z:0}).x>.9);
});
test('player push persists into input updates without subtracting health',()=>{
 const p=new Player(0,10,0);
 const floor={...world,get(x,y,z){return y<10?B.STONE:B.AIR;}};
 p.push(8,0);p.update(floor,1/60,{});
 assert.ok(p.x>.1);assert.equal(p.hp,20);
});
test('solid walls block formation movement and disable charge',()=>{
 const pack=spawn();
 const blocked={...world,get(x,y,z){return y<10||x===1?B.STONE:B.AIR;}};
 pack.world=blocked;pack.loadedWorld.get=(x,y,z)=>blocked.get(x,y,z,false);
 const a={x:0,y:10,z:0};
 assert.equal(pack.canMove(a,{x:2,y:10,z:0},Math.PI/2,Math.PI/2),false);
 pack.active.point=a;pack.active.mode='charge';pack.active.dir={x:1,z:0};
 pack.stepGroup({...player,x:3},.18);
 assert.equal(pack.active.mode,'watch');
 assert.deepEqual(pack.active.point,a);
});
test('a charge toward a ledge pushes instead of dealing contact damage',()=>{
 const pack=spawn();
 const edge={...world,get(x,y,z){return y<10&&x<=2?B.STONE:B.AIR;}};
 pack.world=edge;pack.loadedWorld.get=(x,y,z)=>edge.get(x,y,z,false);
 const target=new Player(2.05,10,0);
 pack.active.point={x:.45,y:10,z:0};pack.active.yaw=Math.PI/2;
 Object.assign(pack.active,{mode:'charge',dir:{x:1,z:0},charge:.36,nextThreat:2});
 pack.stepGroup(target,.18);
 assert.equal(target.hp,20);assert.ok(target.pushX>0);
});
