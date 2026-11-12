import test from 'node:test';
import assert from 'node:assert/strict';
import {facadeBay} from '../src/worldgen/eternal-night-facade.js';
import {cityKits} from '../src/worldgen/eternal-night-kits.js';
import {createCityPlan,stampCityChunk} from '../src/worldgen/eternal-night-game.js';
import {Chunk} from '../src/core/chunk.js';
import {partById} from '../src/core/part-library.js';
import {BLOCK as B} from '../src/core/blocks.js';

const face=(program,level,edge,bay,span=12)=>facadeBay({
 program,level,entryLevel:1,edge,bay,span,stride:5,frontEdge:0
});

test('residential wings and rear façades receive actual windows, never a continuous blind concrete sheet',()=>{
 for(const edge of [0,2,4,6]){
  assert.equal(face('housing',8,edge,2).opening,'window',`residential edge ${edge}`);
 }
 assert.equal(face('housing',8,2,2,2.2).opening,'wall','short chamfer keeps its structural pier');
 for(const edge of [0,2,4,6]){
  const bays=Array.from({length:5},(_,bay)=>face('housing',8,edge,bay));
  assert.ok(bays.filter(b=>b.opening==='window').length>=1,'living rooms have daylight');
  assert.ok(bays.filter(b=>b.opening==='wall').length>=3,'not an office glass curtain wall');
  assert.ok(bays.every(b=>!b.sign),'no residential shop signage');
 }
});

test('commercial upper floors and workshop side faces have use-specific openings',()=>{
 assert.equal(face('shops',1,0,1).opening,'shopfront');
 assert.equal(face('shops',1,2,1).opening,'wall','upper streets do not become storefronts on every side');
 assert.equal(face('shops',6,2,2).opening,'window','commercial side upper floors must not be sealed');
 assert.equal(face('court',9,6,2).opening,'window');
 assert.equal(face('workshops',6,2,2).opening,'window');
 assert.equal(face('workshops',6,4,3).vent,true);
 assert.equal(face('market',1,0,3).sign,true);
 assert.equal(face('market',1,2,3).sign,false);
 assert.equal(face('market',1,0,1,2.2).opening,'wall','tiny chamfers remain unglazed');
});

test('non-industrial buildings do not accidentally inherit the charcoal concrete envelope',()=>{
 for(const program of ['housing','shops','market','court']){
  for(let seed=0;seed<12;seed++){
   const v={id:seed+1,x0:6,z0:8,type:0,luxury:.10,program};
   const kits=cityKits(v,seed,1);
   assert.ok(kits.every(k=>k.body!==B.CRACKED_CONCRETE),
    `non-industrial ${program}/${seed} should not be a charcoal solid tower`);
  }
 }
 const industrial={id:22,x0:6,z0:8,type:4,luxury:.05,program:'workshops'};
 assert.ok(Array.from({length:12},(_,seed)=>cityKits(industrial,seed,1))
   .some(kits=>kits.some(kit=>kit.body===B.CRACKED_CONCRETE)),
   'worn industrial concrete still exists where it makes architectural sense');
});

test('real voxel output contains framed windows on a residential side wall',()=>{
 const plan=createCityPlan(9999);
 const block=plan.volumes[0];
 const floor=block.floors.find(f=>f.program==='housing'&&f.level>5);
 assert.ok(floor,'a residential storey exists');
 const a=floor.outline[2],b=floor.outline[3],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 assert.ok(length>=12,'the sampled exterior wall is long enough');
 const chunks=new Map(),seen=new Set();
 const sample=(x,y,z)=>{
  const cx=Math.floor(x/16),cz=Math.floor(z/16),key=cx+','+cz;
  if(!chunks.has(key)){const c=new Chunk(cx,cz,768);stampCityChunk(c,9999);chunks.set(key,c)}
  return chunks.get(key).get((Math.floor(x)%16+16)%16,Math.floor(y),(Math.floor(z)%16+16)%16);
 };
 let windows=0;
 for(let t=0;t<=length;t+=.4){
  const x=Math.floor(a[0]+(b[0]-a[0])*t/length)+.5;
  const z=Math.floor(a[1]+(b[1]-a[1])*t/length)+.5;
  const key=x+','+z;if(seen.has(key))continue;seen.add(key);
  const id=sample(x,Math.round(floor.y)+2,z);
  if(partById(id)?.family==='window')windows++;
  assert.notEqual(id,B.CRACKED_CONCRETE,'housing exterior is not a full charcoal slab');
 }
 assert.ok(windows>=2,'actual side wall gets more than one framed window');
});
