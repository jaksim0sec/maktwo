import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Player} from '../src/entities/entities.js';
import {collides,moveBody} from '../src/core/physics.js';
import {doorBounds,doorIntersectsBody,DOOR_HEIGHT} from '../src/core/door.js';

test('door cannot swing into a character and must not change collision geometry',()=>{
 const world=new World({mode:'flat'});
 assert.equal(world.placeDoor(5,23,5,0),true);
 const actor=new Player(5.5,23,5.07);actor.fly=true;
 assert.equal(doorIntersectsBody(5,23,5,{facing:0,open:false},actor),true);
 assert.equal(world.toggleDoor(5,23,5,[actor]),true,'open state does not occupy player at the hinge');
 assert.equal(world.getDoorState(5,23,5).open,true);
 assert.equal(world.toggleDoor(5,23,5,[actor]),false,'close must be blocked by character');
 assert.equal(world.getDoorState(5,23,5).open,true);
});
test('open door leaves a passable passage and solid closed door respects slab height',()=>{
 const world=new World({mode:'flat'});world.placeDoor(5,23,5,0);
 const actor=new Player(5.5,23,5.5);
 const open=doorBounds(5,5,0,true);
 assert.ok(open.x+open.w<=5.11);
 world.toggleDoor(5,23,5,[actor]);
 assert.equal(collides(world,actor.x,actor.y,actor.z,actor.width,actor.height),false);
 assert.equal(world.toggleDoor(5,23,5,[actor]),false);
 assert.equal(collides(world,5.5,23+DOOR_HEIGHT+.01,5.12,.2,.4),false,'door top cannot block invisible space above mesh');
});
test('a body that is already in contact with a door never vertically teleports',()=>{
 const world=new World({mode:'flat'});world.placeDoor(5,23,5,0);
 const body=new Player(5.5,23,5.11);body.vy=-.2;body.vx=0;body.vz=0;
 const old=body.y;
 moveBody(world,body,1/30);
 assert.ok(Math.abs(body.y-old)<.05,`door overlap caused unexpected jump of ${body.y-old}`);
});
test('staged offline cache only ever includes explicit versioned app assets',async()=>{
 // Additional source-level guard: future changes must not silently revert to
 // caching every fetched GET and unlimited ?v= query variants.
 const {readFileSync}=await import('node:fs');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(sw,/CANONICAL_ASSETS/);
 assert.match(sw,/url\.search=''/);
 assert.doesNotMatch(sw,/cache\.put\(request/);
});
