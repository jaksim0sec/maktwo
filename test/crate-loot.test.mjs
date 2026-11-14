import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SurvivalInventory,crateLoot} from '../src/core/inventory.js';
import {World} from '../src/core/world.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';

const memory=()=>{const records=new Map();return {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)}};

test('seed and XYZ determine valid, varied crate loot with weapons',()=>{
 const args=[543,-19,35,47],base=crateLoot(...args);
 assert.deepEqual([...base],[...crateLoot(...args)]);
 for(const [id,n] of base){assert.ok(BLOCKS[id]&&n>0&&n<=999);}
 const rolls=Array.from({length:48},(_,i)=>crateLoot(543,-19+i,35,47));
 assert.ok(new Set(rolls.map(loot=>JSON.stringify([...loot]))).size>5);
 assert.ok(rolls.some(loot=>loot.has(B.WOOD_CLUB)||loot.has(B.STEEL_BAR)));
 assert.ok(Array.from({length:12},(_,i)=>crateLoot(543+i,-19,35,47))
  .some(loot=>JSON.stringify([...loot])!==JSON.stringify([...base])));
});
test('natural crate fills once, then remains empty after taking everything and reload',()=>{
 const storage=memory(),key='-19,35,47',bag=new SurvivalInventory(storage,'city');
 assert.ok(bag.prepareCrate(key,543,-19,35,47,true));
 assert.deepEqual([...bag.containers.get(key)],[...crateLoot(543,-19,35,47)]);
 for(const id of [...bag.containers.get(key).keys()])assert.equal(bag.transfer(key,id,false),true);
 assert.equal(bag.containers.has(key),false);
 const next=new SurvivalInventory(storage,'city');
 assert.ok(next.prepareCrate(key,543,-19,35,47,true));
 assert.equal(next.containers.has(key),false);
 assert.equal(next.initializedContainers.has(key),true);
});
test('older stored loot is retained without duplicating stock',()=>{
 const storage=memory(),key='2,31,7';
 storage.setItem('maktwo:survival:legacy',JSON.stringify({version:2,items:[[B.TORCH,5]],
  containers:[[key,[[B.STEEL_BAR,1]]]]}));
 const bag=new SurvivalInventory(storage,'legacy');
 assert.ok(bag.prepareCrate(key,54,2,31,7,true));
 assert.deepEqual([...bag.containers.get(key)],[[B.STEEL_BAR,1]]);
});
test('generated provenance differs from player placement, which starts empty',()=>{
 const w=new World({mode:'flat',seed:17}),x=8,y=30,z=-8,key=w.stateKey(x,y,z);
 assert.equal(w.isGeneratedBlock(x,y,z),true);
 assert.equal(w.set(x,y,z,B.CRATE,{simulate:false}),true);
 assert.equal(w.isGeneratedBlock(x,y,z),false);
 const bag=new SurvivalInventory(memory(),'build');
 assert.ok(bag.prepareCrate(key,w.seed,x,y,z,w.isGeneratedBlock(x,y,z)));
 assert.equal(bag.containers.has(key),false);
});
test('save errors rollback crate generation',()=>{
 const s={getItem:()=>null,setItem:()=>{throw Error('full')}};
 const bag=new SurvivalInventory(s,'fail');
 assert.equal(bag.prepareCrate('1,20,1',11,1,20,1,true),false);
 assert.equal(bag.containers.size,0);
 assert.equal(bag.initializedContainers.size,0);
});
test('opening UI starts on stored contents rather than player inventory',()=>{
 const game=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 assert.match(game,/this\.storageView='stored'/);
 assert.match(game,/this\.survivalInventory\.prepareCrate\(key,this\.world\.seed/);
});
