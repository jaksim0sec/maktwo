import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {World} from '../src/core/world.js';
import {collides,raycast} from '../src/core/physics.js';
import {FORMED,formCode} from '../src/core/construction.js';
import {meshChunk} from '../src/client/mesher.js';
import {CreativeInventory,SurvivalInventory} from '../src/core/inventory.js';
import {CREATIVE_ITEMS} from '../src/core/catalog.js';
import {Player} from '../src/entities/entities.js';

test('forms reuse material IDs and preserve exact ray and collision surfaces through saves',()=>{
 const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
 let world=new World({mode:'flat',storage});
 world.set(-1,25,0,B.CONCRETE,{form:formCode(3,0)});
 world.set(0,25,0,B.PLANKS,{form:formCode(4,0)});
 world.set(1,25,0,B.PLANKS,{form:formCode(2,0)});
 world.save();
 world=new World({mode:'flat',storage});
 assert.equal(world.get(-1,25,0),B.CONCRETE);
 assert.equal(collides(world,-.1,25,.9,.1,.2),false);
 assert.equal(collides(world,-.9,25,.1,.1,.2),true);
 const hit=raycast(world,{x:.2,y:26.7,z:.25},{x:0,y:-1,z:0});
 assert.equal(hit.id,B.PLANKS);
 assert.ok(Math.abs(hit.distance-1.45)<1e-6);
 assert.ok(hit.normal.y>.7&&hit.normal.z<-.7);
 assert.equal(collides(world,1.5,25.1,.5,.1,.2),false);
 assert.equal(collides(world,1.5,25.55,.5,.1,.2),true);
 const mesh=meshChunk(world,world.getChunk(-1,0)).opaque;
 assert.ok([...FORMED[3].faces].some(face=>face.normal[0]===1&&face.normal[2]===1));
 assert.equal(mesh.length%21,0);
 assert.ok(mesh.some((value,index)=>index%7===1&&value===26));
});

test('mounted lighting is picked before its support and detaches across chunk borders',()=>{
 const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
 let world=new World({mode:'flat',storage});
 world.set(15,25,0,B.PLANKS);
 world.set(13,25,0,B.CONCRETE,{form:formCode(3,0)});
 const wall=raycast(world,{x:17,y:25.5,z:.5},{x:-1,y:0,z:0});
 assert.equal(world.placeMount(B.TORCH,wall),true);
 const diagonal=raycast(world,{x:13.9,y:25.5,z:.9},{x:-Math.SQRT1_2,y:0,z:-Math.SQRT1_2});
 assert.equal(world.placeMount(B.SHOP_SIGN,diagonal),true);
 world.save();
 world=new World({mode:'flat',storage});
 const found=raycast(world,{x:17,y:25.5,z:.5},{x:-1,y:0,z:0});
 assert.equal(found.id,B.TORCH);assert.equal(found.mounted,true);
 assert.equal(raycast(world,{x:13.9,y:25.5,z:.9},{x:-Math.SQRT1_2,y:0,z:-Math.SQRT1_2}).id,B.SHOP_SIGN);
 assert.ok(world.lights.near(16,25,0).some(light=>light.id===B.TORCH));
 world.set(15,25,0,B.AIR);
 assert.equal(world.getChunk(1,0).mounts,undefined);
 assert.equal(world.lights.near(16,25,0).some(light=>light.id===B.TORCH),false);
});

test('creative resources and recipes do not alter survival inventory, and flight respects ceilings',()=>{
 const creative=new CreativeInventory(CREATIVE_ITEMS),survival=new SurvivalInventory();
 const previous=survival.count(B.PLANKS);
 assert.equal(creative.count(B.PLANKS),Infinity);
 assert.equal(creative.remove(B.PLANKS),true);
 assert.ok(creative.knownRecipes().some(recipe=>recipe.station==='bench'&&creative.craft(recipe)));
 assert.equal(survival.count(B.PLANKS),previous);
 const world=new World({mode:'flat'}),player=new Player(2.5,24,2.5);
 world.set(2,27,2,B.PLANKS);player.fly=true;player.creative=true;
 for(let i=0;i<60;i++)player.update(world,1/60,{jump:true});
 assert.ok(player.y>25&&player.y+player.height<=27+1e-4);
 player.update(world,1/60,{crouch:true});assert.ok(player.vy<0);
});

test('rotated construction keeps cube texture turns, chair collision and mounted sign picking after reload',()=>{
 const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
 let world=new World({mode:'flat',storage});
 world.set(2,25,2,B.CHAIR);
 world.setShapeState(2,25,2,{facing:1});
 world.set(4,25,2,B.PLANKS);
 world.setShapeState(4,25,2,{facing:1});
 const wall=raycast(world,{x:6,y:25.5,z:2.5},{x:-1,y:0,z:0});
 assert.equal(world.placeMount(B.SHOP_SIGN,wall,1),true);
 world.save();
 world=new World({mode:'flat',storage});
 assert.equal(collides(world,2.8,25.7,2.5,.05,.1),true);
 assert.equal(collides(world,2.5,25.7,2.8,.05,.1),false);
 assert.equal(raycast(world,{x:6,y:25.77,z:2.5},{x:-1,y:0,z:0}).id,B.SHOP_SIGN);
 assert.equal(raycast(world,{x:6,y:25.5,z:2.77},{x:-1,y:0,z:0}).id,B.PLANKS);
 const {opaque}=meshChunk(world,world.getChunk(0,0));
 assert.ok(opaque.some((value,i)=>i%7===6&&value===297&&opaque[i-5]===26));
});
