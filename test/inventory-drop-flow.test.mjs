import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {SurvivalInventory,harvestDrop} from '../src/core/inventory.js';
import {World} from '../src/core/world.js';
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
