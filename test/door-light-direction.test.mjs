import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {makeOccluderSnapshot,buildLightVolume} from '../src/core/lightVolume.js';

const width=13,height=14,depth=13,origin=[0,20,0];
function brightness(w){
 const occ=makeOccluderSnapshot(w,origin,width,height,depth);
 const source=[{x:6.5,y:26.5,z:5.5,radius:9,intensity:1.1,rgb:[1,.55,.25]}];
 const light=buildLightVolume(occ,source,{width,height,depth,origin});
 const i=(((7)*height+(26-20))*width+6)*4;
 return light[i]+light[i+1]+light[i+2];
}
test('closed door blocks torchlight, opening it increases brightness beyond a stone wall',()=>{
 const w=new World({mode:'flat'});
 for(let x=0;x<13;x++)for(let y=22;y<33;y++)w.set(x,y,6,B.STONE,{simulate:false});
 w.set(6,26,6,B.AIR);w.set(6,27,6,B.AIR);
 assert.equal(w.placeDoor(6,26,6,0),true);
 const closed=brightness(w);
 assert.equal(w.isLightBlocking(B.DOOR,6,26,6),true);
 assert.equal(w.isLightBlocking(B.DOOR_TOP,6,27,6),true);
 assert.equal(w.toggleDoor(6,26,6),true);
 const open=brightness(w);
 assert.equal(w.isLightBlocking(B.DOOR,6,26,6),false);
 assert.ok(open>closed+40,'open should be brighter than closed');
 w.toggleDoor(6,26,6);
 assert.equal(brightness(w),closed,'closing restores original light occlusion');
});
