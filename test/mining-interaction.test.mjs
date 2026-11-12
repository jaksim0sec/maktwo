import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B,block,BLOCKS} from '../src/core/blocks.js';
import {MiningProgress} from '../src/core/mining.js';
const target=(id,x=1)=>({x,y:21,z:4,id});

test('every block has its own mining time separate from blast resistance',()=>{
 assert.equal(BLOCKS.length,18);
 assert.ok(BLOCKS.every(b=>typeof b.breakTime==='number'));
 assert.equal(block(B.BEDROCK).breakTime,Infinity);
 assert.ok(block(B.STONE).breakTime>block(B.DIRT).breakTime);
 assert.ok(block(B.ORE).breakTime>block(B.STONE).breakTime);
 assert.ok(block(B.TORCH).breakTime>0);
});
test('holding accumulates seconds until block is mined',()=>{
 const m=new MiningProgress(),t=target(B.STONE),total=block(B.STONE).breakTime;
 let result;for(let i=0;i<Math.floor(total/.05)-1;i++)result=m.update(t,true,.05);
 assert.equal(result.completed,false);
 let completed=false;for(let i=0;i<6;i++){result=m.update(t,true,.05);if(result.completed){completed=true;break}}
 assert.equal(completed,true);
 assert.equal(m.ratio,0);
});
test('releasing button or changing block resets mining, never instantly deletes',()=>{
 const m=new MiningProgress(),dirt=target(B.DIRT);
 m.update(dirt,true,.2);assert.ok(m.ratio>0);
 m.update(dirt,false,.01);assert.equal(m.ratio,0);
 m.update(dirt,true,.25);m.update(target(B.DIRT,2),true,.02);
 assert.ok(m.ratio<.1);
 m.update(target(B.STONE,2),true,.02);assert.ok(m.ratio<.05);
});
test('bedrock cannot be mined and frame stalls cannot skip the timer',()=>{
 const m=new MiningProgress();assert.equal(m.update(target(B.BEDROCK),true,30).completed,false);
 assert.equal(m.update(target(B.STONE),true,5).completed,false);
 assert.ok(m.ratio<.1);
});
