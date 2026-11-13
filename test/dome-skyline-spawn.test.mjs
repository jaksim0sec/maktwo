import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityPlan,citySpawnCandidates,CITY_BASE_Y} from '../src/worldgen/eternal-night-game.js';
import {CORE_DOME_HEIGHT} from '../src/worldgen/eternal-night-library.js';
import {DISTRICT_DOME_RATIO,DISTRICT_HEIGHT_SPREAD} from '../src/worldgen/eternal-night-precincts.js';
test('spawn candidates start just above the dome, not at the tower midpoint',()=>{
 for(const seed of [9999,371,2026]){
  const plan=createCityPlan(seed),first=citySpawnCandidates(seed).next().value;
  assert.ok(first,'spawn candidates must exist');
  assert.ok(first.y>=plan.library.crown+3&&first.y<=plan.library.crown+21,
   `seed ${seed} spawn floor ${first.y} versus dome ${plan.library.crown}`);
 }
});
test('substantial district buildings center near 1.75 dome heights with seeded variance',()=>{
 const plan=createCityPlan(9999);
 const large=plan.volumes.filter(v=>v.support===null&&v.program!=='shops'&&v.floors.length>=12);
 assert.ok(large.length>=8);
 const heights=large.map(v=>v.y1-v.y0),mean=heights.reduce((a,b)=>a+b,0)/heights.length;
 const target=CORE_DOME_HEIGHT*DISTRICT_DOME_RATIO;
 assert.ok(Math.abs(mean-target)<target*.12,`mean ${mean}, target ${target}`);
 assert.ok(Math.max(...heights)-Math.min(...heights)>=10,'height variety should remain noticeable');
 assert.equal(DISTRICT_HEIGHT_SPREAD,.17);
 assert.equal(CITY_BASE_Y+CORE_DOME_HEIGHT,94);
});
