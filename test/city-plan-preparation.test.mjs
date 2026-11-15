import test from 'node:test';
import assert from 'node:assert/strict';
import * as city from '../src/worldgen/eternal-night-game.js';

test('cold city planning yields to another task and shares the finished plan with chunk generation',async()=>{
 const clock={now:0};
 let slices=0,taskRan=false;
 const timer=setTimeout(()=>{taskRan=true},0);
 try{
  const plan=await city.prepareCityPlan(9999,9,{now:()=>clock.now+=4,yieldTask:async()=>{
   slices++;
   if(slices===1)await new Promise(resolve=>setTimeout(resolve,0));
  }});
  assert.ok(taskRan&&slices>10);
  assert.equal(plan,city.createCityPlan(9999,9));
  assert.ok(plan.starter?.spawn&&plan.stations.length>0&&plan.walkways.length>0);
  await city.prepareCityPlan(9999,9,{yieldTask:()=>assert.fail('cache hit yielded')});
 }finally{clearTimeout(timer)}
});
