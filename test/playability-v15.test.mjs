import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Player} from '../src/entities/entities.js';
import {collides,moveBody} from '../src/core/physics.js';
import {GestureState,HOLD_MS} from '../src/client/gestures.js';
import {applyCameraLook} from '../src/client/camera.js';
import {createAnchor,faceAnchor,cardGeometry} from '../src/client/hologram.js';
import {makeTextureLayers} from '../src/client/textures.js';

const w=()=>new World({mode:'flat',seed:77});
test('open doorway can be traversed by an actual player body; closed door stops passage',()=>{
 const world=w();assert.ok(world.placeDoor(5,28,5,0));
 const player=new Player(5.5,28,5.9);player.fly=true;player.vz=-3.7;
 for(let i=0;i<18;i++){player.vz=-3.7;moveBody(world,player,.025)}
 assert.ok(player.z>5.3,'closed door should obstruct walking forward');
 assert.equal(world.toggleDoor(5,28,5,[player]),true);
 for(let i=0;i<19;i++){player.vz=-3.7;moveBody(world,player,.025)}
 assert.ok(player.z<5,'open door should be freely traversable');
 assert.ok(!collides(world,player.x,player.y,player.z,player.width,player.height));
 assert.equal(world.toggleDoor(5,28,5,[player]),true,'closing after passage is safe');
});
test('door cannot be placed on a player and cannot close around someone in passage',()=>{
 const world=w(),player=new Player(5.5,28,5.11);player.fly=true;
 assert.equal(world.placeDoor(5,28,5,0,[player]),false);
 assert.equal(world.get(5,28,5),B.AIR);
 assert.equal(world.placeDoor(5,28,5,0),true);
 assert.equal(world.toggleDoor(5,28,5,[player]),true);
 assert.equal(world.toggleDoor(5,28,5,[player]),false);
});
test('left and right stationary taps work, but drags do not edit or turn into mines',()=>{
 const g=new GestureState();
 g.down(1,32,300,180,100,360);g.up(1,32,300,160);
 g.down(2,300,220,180,190,360);g.up(2,300,220,250);
 assert.equal(g.consumeTaps(),2);
 g.down(3,32,300,180,500,360);g.move(3,125,300);g.up(3,125,300,620);
 assert.equal(g.consumeTaps(),0);
 g.down(4,290,220,180,700,360);g.move(4,205,220);g.up(4,205,220,900);
 assert.equal(g.consumeTaps(),0);
 g.down(5,32,300,180,1000,360);assert.deepEqual(g.miningPoint(1000+HOLD_MS),{x:32,y:300});
});
test('mobile camera needs around two full width swipes instead of five to turn around',()=>{
 const g=new GestureState(),p={yaw:0,pitch:0};let t=0;
 for(let swipe=0;swipe<3;swipe++){
  g.down(swipe+1,320,300,180,t,360);
  for(let x=300;x>=60;x-=20){g.move(swipe+1,x,300);const [dx,dy]=g.consumeLook();applyCameraLook(p,dx,dy)}
  g.up(swipe+1,60,300,t+300);t+=350;
 }
 assert.ok(Math.abs(p.yaw)>Math.PI*2,`three swipes should exceed one rotation, got ${p.yaw}`);
});
test('world anchored inventory faces player but stays upright and its positions do not follow camera',()=>{
 const p={x:0,y:27,z:0,eye:1.59,yaw:0,pitch:-.55};const anchor=createAnchor(p);const center=[...anchor.center];
 p.yaw=1;p.pitch=.7;p.x=.8;
 assert.equal(faceAnchor(anchor,p),true);assert.deepEqual(anchor.center,center);assert.deepEqual(anchor.up,[0,1,0]);
 const tiles=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`아이템${i}`})));
 assert.ok(tiles.every(c=>c.w<=.5&&c.h<.48));
});
test('material layers keep one compact texture array, with varied color per material',()=>{
 const {size,layers,data}=makeTextureLayers();assert.equal(size,32);assert.equal(layers,14);assert.equal(data.byteLength,14*32*32*4);
 const hasColor=(m)=>{const offset=m*size*size*4;for(let i=offset;i<offset+size*size*4;i+=4)if(data[i]!==data[i+1]||data[i+1]!==data[i+2])return true;return false};
 assert.ok([0,1,5,9,12].every(hasColor),'materials should have authored color variation');
});
test('renderer drops obsolete lighting jobs rather than showing inverted door states',()=>{
 const text=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
 assert.match(text,/this\.world\?\.lightRevision!==this\.lightRequestRevision/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="debug-toggle"/);
});
