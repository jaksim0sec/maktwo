import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SurvivalInventory,RECIPES} from '../src/core/inventory.js';
import {recipeGrid,matchesPattern,recipeByName} from '../src/core/crafting.js';
import {BLOCK as B,BLOCKS,HOTBAR_SIZE} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {meshChunk} from '../src/client/mesher.js';
import {makeTextureLayers} from '../src/client/textures.js';
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};

test('quickbar is exactly seven saved slots and preserves an older inventory save',()=>{
 const storage=store(),key='maktwo:survival:Overworld';
 storage.setItem(key,JSON.stringify({version:1,items:[[B.PLANKS,12],[B.DIRT,3]]}));
 const inventory=new SurvivalInventory(storage);
 assert.equal(HOTBAR_SIZE,7);assert.equal(inventory.quickSlots.length,7);
 assert.equal(inventory.count(B.PLANKS),12);assert.equal(inventory.discovered(B.TORCH),false);
 assert.equal(inventory.discovered(B.PLANKS),true);
 inventory.add(B.WOOD,3);const slot=inventory.assignQuickSlot(B.WOOD);assert.ok(slot>=0&&slot<7);
 const loaded=new SurvivalInventory(storage);assert.deepEqual(loaded.quickSlots,inventory.quickSlots);
 assert.ok(loaded.discovered(B.WOOD));assert.equal(loaded.count(B.WOOD),3);
});

test('recipes unlock through acquired materials, not an always-visible creative catalogue',()=>{
 const inv=new SurvivalInventory();
 assert.ok(!inv.discovered(B.COBBLE));assert.ok(!inv.knownRecipes('bench').some(r=>r.id===B.PATH));
 assert.ok(inv.knownRecipes('hand').some(r=>r.id===B.WORKBENCH));
 assert.ok(!inv.knownRecipes('hand').some(r=>r.id===B.DOOR));
 inv.add(B.COBBLE,2);assert.ok(inv.knownRecipes('bench').some(r=>r.id===B.PATH));
 inv.remove(B.COBBLE,2);assert.ok(inv.knownRecipes('bench').some(r=>r.id===B.PATH),'discovery survives spending ingredients');
 const fake={...recipeByName('torch')};assert.equal(inv.craft(fake,'bench'),false,'client cannot mint items by passing a forged recipe');
});

test('workbench crafting consumes exact resources, stays gated and survives a reload',()=>{
 const storage=store(),inv=new SurvivalInventory(storage);
 const bench=recipeByName('workbench'),door=recipeByName('door');
 assert.equal(inv.canCraft(bench),true);
 assert.equal(inv.craft(bench,'hand'),true);assert.equal(inv.count(B.WORKBENCH),1);
 assert.equal(inv.count(B.PLANKS),8);assert.equal(inv.craft(door,'hand'),false);
 assert.equal(inv.craft(door,'bench'),true);assert.equal(inv.count(B.DOOR),2);assert.equal(inv.count(B.PLANKS),2);
 assert.equal(inv.craft(door,'bench'),false);
 const reloaded=new SurvivalInventory(storage);assert.equal(reloaded.count(B.WORKBENCH),1);
 assert.ok(reloaded.discovered(B.WORKBENCH));assert.equal(reloaded.count(B.PLANKS),2);
});

test('recipes have real shaped 2x2/3x3 patterns and off-shape layouts fail',()=>{
 for(const recipe of RECIPES){const grid=recipeGrid(recipe);assert.equal(grid.length,9);assert.ok(matchesPattern(grid,recipe),recipe.name);
  assert.ok(recipe.pattern.length<=(recipe.station==='hand'?2:3));
  assert.equal(Object.values(recipe.needs).reduce((sum,n)=>sum+n,0),grid.filter(Boolean).length);
 }
 const door=recipeByName('door');const wrong=recipeGrid(door);[wrong[0],wrong[2]]=[wrong[2],wrong[0]];
 // A single missing plank makes the shaped recipe invalid.
 const missing=recipeGrid(door);missing[0]=0;assert.equal(matchesPattern(missing,door),false);
 // Shift a two-column door pattern one space right, still accepted.
 const shifted=Array(9).fill(0);for(let y=0;y<3;y++){shifted[y*3+1]=B.PLANKS;shifted[y*3+2]=B.PLANKS}
 assert.ok(matchesPattern(shifted,door));
});

test('workbench lives in the world, uses a dedicated mesh, and does not renumber legacy blocks',()=>{
 assert.equal(B.DOOR,18);assert.equal(B.FENCE,22);assert.equal(B.WORKBENCH,23);
 assert.equal(BLOCKS.length,24);
 const storage=store(),a=new World({name:'a',mode:'flat',storage});
 assert.ok(a.set(3,25,4,B.WORKBENCH));
 const geom=meshChunk(a,a.getChunk(0,0));assert.ok(geom.opaque.length>0);assert.equal(geom.opaque.length%7,0);
 a.save();const b=new World({name:'a',mode:'flat',storage});assert.equal(b.get(3,25,4),B.WORKBENCH);
 const tile=makeTextureLayers();assert.equal(tile.layers,14);assert.equal(tile.data.byteLength,14*32*32*4);
});

test('client accesses the bench in range, crafting UI uses real ingredient grid and PWA precaches it',()=>{
 const game=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 const hologram=readFileSync(new URL('../src/client/hologram.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(game,/this\.target\.id===B\.WORKBENCH/);
 assert.match(game,/this\.inventory\.knownRecipes\(station\)/);
 assert.match(game,/this\.inventory\.craft\(recipe,station\)/);
 assert.match(game,/this\.inventory\.quickSlots\[i\]/);
 assert.match(hologram,/recipeGrid\(card\.recipe\)/);
 assert.match(sw,/src\/core\/crafting\.js/);
 assert.match(sw,/maktwo-shell-v1\.10\.0/);
});

test('workbench meshing is identical in the worker and on the main thread',async()=>{
 const world=new World({seed:61,mode:'flat'}),chunk=world.getChunk(0,0);
 world.set(3,25,4,B.WORKBENCH,{simulate:false});const reference=meshChunk(world,chunk);
 const oldSelf=globalThis.self;let response;
 globalThis.self={postMessage:packet=>{response=packet}};
 try{
  await import('../src/client/mesh.worker.js?crafting-workbench-check');
  globalThis.self.onmessage({data:{cx:0,cz:0,key:'0,0',revision:0,token:1,seed:61,data:chunk.data.slice().buffer,neighbors:[],doorStates:[]}});
  assert.equal(response.error,undefined);assert.deepEqual(response.opaque,reference.opaque);
 }finally{globalThis.self=oldSelf}
});

// Importing an oversized hand recipe used to crash the entire game at startup.
test('flower pot V pattern belongs to the 3x3 workbench, not the 2x2 hand grid',()=>{
 const pot=recipeByName('flower_pot');
 assert.equal(pot.station,'bench');
 assert.equal(Math.max(...pot.pattern.map(row=>row.length)),3);
 assert.ok(matchesPattern(recipeGrid(pot),pot));
 const inv=new SurvivalInventory();inv.add(B.COBBLE,3);
 assert.equal(inv.canCraft(pot,'hand'),false);
 assert.equal(inv.canCraft(pot,'bench'),true);
 assert.equal(inv.craft(pot,'bench'),true);
 assert.equal(inv.count(B.FLOWER_POT),2);
});
