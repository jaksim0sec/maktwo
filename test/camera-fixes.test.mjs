import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../src/core/world.js';
import {BLOCK as B,BLOCKS,LIGHTBAR,block} from '../src/core/blocks.js';
import {Player} from '../src/entities/entities.js';
import {moveBody} from '../src/core/physics.js';
import {applyCameraLook,cameraEyeY,dampStepOffset} from '../src/client/camera.js';

test('light sources have compact reach without recoloring source blocks',()=>{
 assert.deepEqual(LIGHTBAR.map(id=>block(id).light.radius),[9,10,10]);
 assert.equal(block(B.GRASS).color,'#78966e');
 assert.equal(block(B.DIRT).color,'#806c59');
 assert.equal(block(B.STONE).color,'#858b90');
 assert.equal(block(B.TORCH).light.color,'#ff8750');
});
test('step raises physical collision body immediately but eases camera',()=>{
 const world=new World({mode:'flat'}),player=new Player(.5,23.001,.5);player.grounded=true;
 world.set(0,23,-1,B.STONE,{simulate:false});
 let rose=false;
 for(let i=0;i<20;i++){player.vz=-4;moveBody(world,player,1/60);if(player.visualStepOffset<0){rose=true;break}}
 assert.ok(rose);assert.ok(player.y>23.9);
 const before=player.y+player.eye;
 assert.ok(cameraEyeY(player)<before-.8);
 let old=cameraEyeY(player);for(let i=0;i<24;i++){player.visualStepOffset=dampStepOffset(player.visualStepOffset,1/60);const now=cameraEyeY(player);assert.ok(now>=old,'camera ascends smoothly, never snaps down');old=now}
 assert.ok(Math.abs(cameraEyeY(player)-before)<.02);
});
test('look is frame-driven and clamps stale pointer spikes',()=>{
 const player=new Player(0,25,0);applyCameraLook(player,10000,-10000);
 assert.ok(Math.abs(player.yaw)<.5);assert.ok(Math.abs(player.pitch)<.5);
 const game=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 const tick=game.slice(game.indexOf('tick(dt){'),game.indexOf('frame(time){'));
 const frame=game.slice(game.indexOf('frame(time){'),game.indexOf('hud(){'));
 assert.doesNotMatch(tick,/consumeLook\(/);assert.match(frame,/consumeLook\(/);
 assert.match(frame,/applyCameraLook\(this\.player,mx,my\)/);
});
test('shader uses original authored albedo, without artificial grayscale substitution',()=>{
 const renderer=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
 assert.doesNotMatch(renderer,/warmReflectance|float gray=dot\(vColor/);
 assert.match(renderer,/vec3 tinted=vColor/);assert.match(renderer,/tinted\*\(ambient\+emission\*\.12\)/);
});
