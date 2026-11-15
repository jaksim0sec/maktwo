import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {SurvivalInventory,harvestDrop} from '../src/core/inventory.js';
import {CANYON_MODE} from '../src/worldgen/canyon-v2-plan.js';
import {World,WorldManager} from '../src/core/world.js';
import {Player,EntityManager} from '../src/entities/entities.js';

test('a chosen shortcut swaps positions and container transfer respects the chosen quantity',()=>{
 const inv=new SurvivalInventory();
 const from=inv.quickSlots.indexOf(B.DIRT),to=inv.quickSlots.indexOf(B.PLANKS);
 assert(inv.moveShortcut(B.DIRT,to));
 assert.equal(inv.quickSlots[from],B.PLANKS);
 assert.equal(inv.quickSlots[to],B.DIRT);
 assert(inv.transfer('crate',B.DIRT,true,3));
 assert.equal(inv.count(B.DIRT),5);
 assert(inv.transfer('crate',B.DIRT,false,1));
 assert.equal(inv.count(B.DIRT),6);
 assert.equal(inv.containers.get('crate').get(B.DIRT),2);
});

test('harvested and discarded drops land and return through the same pickup path',()=>{
 const world=new World({mode:'flat'});
 const entities=new EntityManager(world),inventory=new SurvivalInventory();
 const p=new Player(2.5,23,2.5);
 assert(inventory.discard(B.DIRT,2));
 const dropped=entities.spawnDrop(B.DIRT,p.x,p.y+.68,p.z,2,{pickupDelay:1.15});
 const mined=entities.spawnDrop(harvestDrop(B.STONE),p.x+.35,p.y+.33,p.z);
 for(let i=0;i<58;i++)entities.tick(1/60,p,inventory);
 assert.equal(inventory.count(B.COBBLE),1);
 assert(!entities.entities.includes(mined));
 assert.equal(inventory.count(B.DIRT),6);
 assert(dropped.grounded);
 for(let i=0;i<20;i++)entities.tick(1/60,p,inventory);
 assert.equal(inventory.count(B.DIRT),8);
 assert(!entities.entities.includes(dropped));
});

test('a pickup rejected by storage keeps its item and can be retried',()=>{
 const world=new World({mode:'flat'}),entities=new EntityManager(world);
 const player=new Player(2.5,23,2.5),inv=new SurvivalInventory();
 inv.save=()=>false;
 const drop=entities.spawnDrop(B.COBBLE,player.x,player.y+.1,player.z);
 for(let i=0;i<20;i++)entities.tick(1/60,player,inv);
 assert.equal(inv.count(B.COBBLE),0);
 assert.equal(inv.discovered(B.COBBLE),false);
 assert.equal(drop.count,1);
 inv.save=()=>true;
 for(let i=0;i<32;i++)entities.tick(1/60,player,inv);
 assert.equal(inv.count(B.COBBLE),1);
 assert(!entities.entities.includes(drop));
});

test('world travel and reload preserve a dropped stack without duplicating a collected stack',()=>{
 const backend=new Map(),storage={getItem:key=>backend.get(key),setItem:(key,value)=>backend.set(key,value)};
 const manager=new WorldManager(storage);
 const a=manager.add('A',17,'flat');
 manager.add('B',17,'flat');
 const inventory=new SurvivalInventory(storage,'A');
 const first=new EntityManager(a);
 first.spawnDrop(B.DIRT,2.5,23,2.5,3,{pickupDelay:1.2}).age=.4;
 assert.equal(new EntityManager(manager.travel('B')).entities.length,0);
 const back=new EntityManager(manager.travel('A'));
 assert.equal(back.entities.length,1);
 assert.equal(back.entities[0].count,3);
 assert.equal(back.entities[0].age,.4);
 const restoredWorld=new World({name:'A',seed:17,mode:'flat',storage});
 const restored=new EntityManager(restoredWorld);
 const player=new Player(2.5,23,2.5);
 for(let i=0;i<65;i++)restored.tick(1/60,player,inventory);
 assert.equal(inventory.count(B.DIRT),11);
 assert(restoredWorld.save());
 const again=new World({name:'A',seed:17,mode:'flat',storage});
 assert.equal(new EntityManager(again).entities.length,0);
});

test('canyon drops keep their absolute height when saved from a different vertical window',()=>{
 const backend=new Map(),storage={getItem:key=>backend.get(key),setItem:(key,value)=>backend.set(key,value)};
 const world=new World({name:'Canyon',seed:9999,mode:CANYON_MODE,storage});
 const drop=new EntityManager(world).spawnDrop(B.FLOOR_TILE,81.5,401,35.5,2);
 assert.equal(world.recenterCanyon(650),448);
 assert.equal(drop.y+world.yOrigin,401);
 assert(world.save());
 const restoredWorld=new World({name:'Canyon',seed:9999,mode:CANYON_MODE,storage});
 const restored=new EntityManager(restoredWorld).entities.find(e=>e.type==='drop');
 assert.equal(restored.y+restoredWorld.yOrigin,401);
 assert.equal(restored.count,2);
 assert.equal(restoredWorld.recenterCanyon(100),-448);
 assert.equal(restored.y,401);
});
