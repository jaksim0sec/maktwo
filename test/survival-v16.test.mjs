import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SurvivalInventory,STARTER_SUPPLIES,harvestDrop,RECIPES} from '../src/core/inventory.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Player} from '../src/entities/entities.js';
import {DOOR_HEIGHT} from '../src/core/door.js';
import {fixture} from '../src/client/mesher.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),m}};

test('survival starts with finite resources and persists independently from world edits',()=>{
 const storage=store(),a=new SurvivalInventory(storage,'Overworld');
 assert.deepEqual(Object.fromEntries(a.items),Object.fromEntries(Object.entries(STARTER_SUPPLIES).map(([id,n])=>[Number(id),n])));
 assert.ok(a.remove(B.TORCH,1));assert.equal(a.count(B.TORCH),STARTER_SUPPLIES[B.TORCH]-1);
 assert.equal(a.remove(B.TORCH,100),false);
 const b=new SurvivalInventory(storage,'Overworld');assert.equal(b.count(B.TORCH),a.count(B.TORCH));
 assert.ok(!storage.m.has('mcweb:Overworld'));
 const other=new SurvivalInventory(storage,'Islands');assert.equal(other.count(B.TORCH),STARTER_SUPPLIES[B.TORCH]);
});
test('harvesting turns stone into cobblestone, grass into dirt, doors into one drop',()=>{
 assert.equal(harvestDrop(B.STONE),B.COBBLE);
 assert.equal(harvestDrop(B.GRASS),B.DIRT);
 assert.equal(harvestDrop(B.DOOR_TOP),B.DOOR);
 assert.equal(harvestDrop(B.DOOR),B.DOOR);
 assert.equal(harvestDrop(B.BEDROCK),null);
 const inv=new SurvivalInventory();assert.equal(inv.recordHarvest(B.STONE),1);assert.equal(inv.count(B.COBBLE),1);
});
test('crafting requires all ingredients, adds output once, and survives reload',()=>{
 const storage=store(),inv=new SurvivalInventory(storage,'World');
 const makePlanks=RECIPES.find(r=>r.id===B.PLANKS),makeDoor=RECIPES.find(r=>r.id===B.DOOR);
 assert.equal(inv.craft(makePlanks),false);
 inv.add(B.WOOD,1);assert.equal(inv.craft(makePlanks),true);assert.equal(inv.count(B.WOOD),0);
 const planks=inv.count(B.PLANKS),doors=inv.count(B.DOOR);
 assert.ok(inv.craft(makeDoor));assert.equal(inv.count(B.DOOR),doors+1);assert.equal(inv.count(B.PLANKS),planks-4);
 const reloaded=new SurvivalInventory(storage,'World');assert.deepEqual([...reloaded.items],[...inv.items]);
});
test('invalid stacks, nonpositive counts and overflows cannot mint resources',()=>{
 const inv=new SurvivalInventory();assert.equal(inv.add(B.TORCH,-3),0);assert.equal(inv.add(B.AIR,5),0);assert.equal(inv.add(-2,5),0);assert.equal(inv.add(999,5),0);
 assert.equal(inv.remove(B.PLANKS,0),false);assert.equal(inv.add(B.TORCH,2000),999-6);
 assert.equal(inv.add(B.TORCH,1),0);assert.equal(inv.count(B.TORCH),999);
});
test('player is shorter than two-block door, torch physical mesh smaller than before',()=>{
 const player=new Player(0,20,0);assert.ok(player.height<=1.55&&player.eye<player.height);
 assert.ok(player.height<DOOR_HEIGHT);assert.equal(player.creative,false);
 const mesh=[];fixture(mesh,B.TORCH,0,0,0);assert.ok(mesh.length>0);
 const ys=[];for(let i=1;i<mesh.length;i+=7)ys.push(mesh[i]);
 assert.ok(Math.max(...ys)<.72,`torch height ${Math.max(...ys)}`);
});
test('hotbar icons and world hologram draw actual item images and counts',()=>{
 const game=read('src/client/game.js'),holo=read('src/client/hologram.js'),icon=read('src/client/item-icons.js');
 assert.match(game,/itemIconURL\(id\)/);assert.match(game,/this\.inventory\.remove\(id\)/);
 assert.match(game,/this\.inventory\.recordHarvest/);assert.match(holo,/drawItemIcon\(ctx,card\.blockId/);
 assert.match(holo,/card\.count/);assert.match(icon,/makeTextureLayers/);
 assert.doesNotMatch(game,/if\(e\.code==='KeyG'\)this\.spawnMob/);
});
test('landscape installed PWA and readable portrait fallback, with atomic offline resources',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest')),css=read('style.css'),pwa=read('src/client/pwa.js'),sw=read('sw.js');
 assert.equal(manifest.orientation,'landscape-primary');assert.match(css,/@media\(pointer:coarse\) and \(orientation:portrait\)/);
 assert.match(read('index.html'),/id="rotate-screen"/);assert.match(pwa,/screen\.orientation\.lock\('landscape'\)/);
 for(const name of ['src/core/inventory.js','src/client/item-icons.js'])assert.ok(sw.includes(name),name);
 assert.match(sw,/maktwo-shell-v1\.6\.1/);
});
test('scene stays unobstructed and warm light shader is restrained',()=>{
 const css=read('style.css'),shader=read('src/client/renderer.js');
 assert.match(css,/#hud\{display:none/);
 assert.match(css,/#camera-btn\{display:none/);
 assert.match(css,/#player-status\{position:fixed;z-index:5;bottom/);
 assert.match(shader,/vec3\(\.47,\.195,\.060\)\*warmth\*\.64/);
 assert.doesNotMatch(shader,/emission\*1\.38/);
});
