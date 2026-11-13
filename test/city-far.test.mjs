import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityPlan} from '../src/worldgen/eternal-night-game.js';
import {cityFarMesh} from '../src/client/city-far.js';
import {distantCityMesh} from '../src/client/city-distance.js';
import {FAR_LOOK} from '../src/client/far-look.js';

const plan=createCityPlan(9999);

test('whole-city mesh is deterministic, bounded, and retains the tower summit',()=>{
 const mesh=cityFarMesh(plan);
 assert.deepEqual(mesh,cityFarMesh(plan));
 assert.equal(mesh.length%7,0);
 assert.ok(mesh.length/7<=FAR_LOOK.farVertexBudget);
 let summit=false;
 for(let i=0;i<mesh.length;i+=7){
  const [x,y,z]=mesh.subarray(i,i+3);
  assert.ok(Math.abs(x)<=480&&Math.abs(z)<=480&&y>=0&&y<=640);
  for(let j=0;j<7;j++)assert.ok(Number.isFinite(mesh[i+j]));
  summit||=y>600&&Math.abs(Math.hypot(x-plan.tower.x,z-plan.tower.z)-plan.tower.radius)<.01;
 }
 assert.ok(summit);
});

test('middle distance mesh stays within its upload budget',()=>{
 for(const [x,z] of [[0,0],[-3,-9],[29,0]]){
  const coverage={};
  const mesh=distantCityMesh(plan,x,z,coverage);
  assert.ok(mesh.length>0&&mesh.length/7<=FAR_LOOK.middleVertexBudget);
  assert.ok(coverage.coveredRadius>0&&coverage.coveredRadius<=FAR_LOOK.middleRadius);
 }
});
