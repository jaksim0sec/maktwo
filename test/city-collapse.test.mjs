import test from 'node:test';
import assert from 'node:assert/strict';
import {collapsePlan,stampCollapse} from '../src/worldgen/eternal-night-decay.js';
import {BLOCK as B,block} from '../src/core/blocks.js';

test('facade collapse follows world coordinates and leaves a torn slab and supported debris',()=>{
 const floors=Array.from({length:8},(_,i)=>({y:10+i*5,top:15+i*5,outline:[[0,0],[14,0],[14,14],[0,14]]}));
 const volume={x0:0,x1:14,z0:0,z1:14,floors};
 const seed=Array.from({length:100},(_,i)=>i).find(i=>collapsePlan(volume,i));
 const plan=collapsePlan(volume,seed);
 assert.deepEqual(plan,collapsePlan({...volume,id:999},seed));
 const cells=new Map();
 for(let z=-1;z<15;z++)for(let x=-1;x<15;x++){
  stampCollapse(plan,x+.5,z+.5,seed,(y,id)=>cells.set(`${x},${y},${z}`,id),
   y=>y!==plan.debris-1&&y!==plan.base-1,y=>y===plan.base+1,B);
 }
 const values=[...cells.values()];
 assert.ok(values.includes(B.AIR)&&values.includes(B.RUBBLE)&&values.includes(B.EXPOSED_REBAR));
 assert.ok([...cells.keys()].every(key=>Number(key.split(',')[1])!==plan.base+1));
});
test('both lantern IDs share the short, steep warm-light profile',()=>{
 const a=block(B.TORCH).light;
 assert.equal(block(B.LANTERN).light,a);
 assert.ok(a.radius<8&&a.intensity<.7&&a.falloff>=3);
});
