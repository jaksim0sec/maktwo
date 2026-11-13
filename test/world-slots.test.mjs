import test from 'node:test';
import assert from 'node:assert/strict';
import {addWorldSlot,loadWorldSlots,savePlayerState,loadPlayerState,WORLD_SLOT_KEY} from '../src/core/world-slots.js';
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
test('distinct new worlds preserve independent signed seeds',()=>{
 const s=store(),a=addWorldSlot(s,-4321,1700000000000),b=addWorldSlot(s,4321,1700000000001);
 assert.notEqual(a.name,b.name);assert.equal(loadWorldSlots(s).length,2);assert.equal(a.seed,-4321);
 assert.throws(()=>addWorldSlot(s,-4321,1700000000000),/already exists/);
});
test('corrupt index does not break original worlds',()=>{
 const s=store();s.setItem(WORLD_SLOT_KEY,'{oops');assert.deepEqual(loadWorldSlots(s),[]);
});
test('player saves are isolated and coordinates validated',()=>{
 const s=store();savePlayerState(s,'one',{x:11,y:21,z:12,yaw:0,pitch:0,hp:18,stamina:60,creative:true,fly:true});
 assert.equal(loadPlayerState(s,'one',768).x,11);assert.equal(loadPlayerState(s,'other',768),null);
 assert.equal(loadPlayerState(s,'one',20),null);
});
