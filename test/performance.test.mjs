import test from 'node:test';
import assert from 'node:assert/strict';
import {view,perspective} from '../src/client/renderer.js';
import {World} from '../src/core/world.js';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
test('camera basis stays orthonormal across yaw and pitch',()=>{
 for(const yaw of [0,.4,1.7,-2.2])for(const pitch of [0,.2,.8,-1.3]){
  const m=view(yaw,pitch,3,4,5);
  const axes=[[m[0],m[4],m[8]],[m[1],m[5],m[9]],[m[2],m[6],m[10]]];
  for(let a=0;a<3;a++){assert.ok(Math.abs(dot(axes[a],axes[a])-1)<1e-5);for(let b=a+1;b<3;b++)assert.ok(Math.abs(dot(axes[a],axes[b]))<1e-5)}
 }
});
test('perspective scales with aspect ratio',()=>{const wide=perspective(Math.PI/3,2,.05,140),square=perspective(Math.PI/3,1,.05,140);assert.ok(Math.abs(wide[0]*2-square[0])<1e-6);assert.equal(wide[5],square[5])});
test('world streaming respects a per-call generation budget',()=>{const world=new World({mode:'flat'});world.stream(0,0,3,2);assert.equal(world.chunks.size,2);world.stream(0,0,3,2);assert.equal(world.chunks.size,4);for(let i=0;i<30;i++)world.stream(0,0,3,2);assert.equal(world.chunks.size,49)});
