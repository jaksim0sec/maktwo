import test from 'node:test';
import assert from 'node:assert/strict';
import {lightProbability,decayPressure,floorEnvironment,survivingFixture} from '../src/worldgen/eternal-night-decay.js';
import {createCityPlan} from '../src/worldgen/eternal-night-game.js';
import {BLOCK as B} from '../src/core/blocks.js';

test('electricity survival declines smoothly away from the core tower',()=>{
 const distances=[0,60,150,300,450,650];
 const p=distances.map(lightProbability);
 assert.ok(p.every((v,i)=>i===0||v<p[i-1]));
 assert.ok(p[0]>.80&&p.at(-1)<.16);
 assert.ok(decayPressure(450,.8,11,19,9999)>decayPressure(40,.2,11,4,9999));
});
test('fixture outcome is stable and follows the same probability for identical coordinates',()=>{
 let center=0,outer=0;
 for(let i=0;i<512;i++){
  center+=Number(survivingFixture(B.FLUORESCENT,i,i%20,i*13,371,lightProbability(0))===B.FLUORESCENT);
  outer+=Number(survivingFixture(B.FLUORESCENT,i,i%20,i*13,371,lightProbability(650))===B.FLUORESCENT);
 }
 assert.ok(center>outer*3);
 assert.equal(survivingFixture(B.FLUORESCENT,12,27,32,371,.5),
  survivingFixture(B.FLUORESCENT,12,27,32,371,.5));
});
test('the geometry planner generates distinct higher floor shapes and caches decay',()=>{
 const plan=createCityPlan(9999);
 const high=plan.volumes.find(v=>v.support===null&&v.floors.length>=20);
 assert.ok(high);
 assert.ok(new Set(high.floors.filter(f=>f.level>=6).map(f=>f.key)).size>=7);
 assert.ok(high.floors.every(f=>f.damage>=0&&f.damage<=.92&&f.lightChance>=0&&f.lightChance<=1));
 const center=plan.volumes.find(v=>v.support===null&&v.floors.length>=12);
 floorEnvironment(center,plan.layout.centerX,plan.layout.centerZ,9999);
 assert.ok(center.floors.every(f=>Number.isFinite(f.damage)));
});
