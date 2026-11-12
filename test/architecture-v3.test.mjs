import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk,SIZE} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {shapeBoxes,isSlab} from '../src/core/shapes.js';
import {MATERIALS,materialFor} from '../src/client/textures.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {ARCHETYPES,blueprintFor,footprint,storyAt,stairTread,architecturalVoxel} from '../src/worldgen/architecture-v3.js';

const SEED=52771;
test('all five architectural types appear, with optional connected wing types',()=>{
 const types=new Set(),combined=new Set();
 for(let rz=-7;rz<=7;rz++)for(let rx=-7;rx<=7;rx++){
  const p=blueprintFor(rx,rz,SEED);if(!p)continue;
  types.add(p.type);
  assert.ok(p.width<=24&&p.depth<=24);
  assert.ok(p.base+p.floors*6<64);
  assert.deepEqual(p,blueprintFor(rx,rz,SEED));
  if(p.annexType){combined.add(p.annexType);assert.notEqual(p.type,p.annexType);assert.ok(p.modules.includes(p.annexType));}
  if(p.form==='L')assert.equal(footprint(p,p.width-1,1),false);
 }
 assert.deepEqual([...types].sort(),[...ARCHETYPES].sort());
 assert.ok(combined.size>=3);
});
test('facade style is fixed between all storeys, with no random geological stripes',()=>{
 let sampled=0;
 for(let rz=-4;rz<=4;rz++)for(let rx=-4;rx<=4;rx++){
  const p=blueprintFor(rx,rz,SEED);if(!p)continue;
  for(let level=0;level<p.floors;level++){
   const story=storyAt(p,level);
   assert.equal(architecturalVoxel(p,story,0,3,3,SEED),p.facade);
   assert.equal(architecturalVoxel(p,story,0,3,4,SEED),p.facade);
  }
  sampled++;
 }
 assert.ok(sampled>=20);
});
test('edge stairwell connects storeys in 12 half-step increments with landings',()=>{
 const p=blueprintFor(0,0,SEED);assert.ok(p?.floors>=2);
 const steps=Array.from({length:12},(_,j)=>stairTread(p,0,j));
 for(let j=0;j<12;j++){
  assert.equal(steps[j].top,p.base+2+j*.5);
  if(j)assert.equal(steps[j].top-steps[j-1].top,.5);
  const storey=Math.floor((steps[j].y-p.base)/6);
  const dy=steps[j].y-p.base-storey*6;
  const s=storyAt(p,storey);
  assert.equal(architecturalVoxel(p,s,2,j+2,dy,SEED),steps[j].id);
 }
 const ground=storyAt(p,0),upper=storyAt(p,1);
 assert.equal(architecturalVoxel(p,ground,5,0,2,SEED),B.AIR);
 assert.equal(architecturalVoxel(p,ground,4,2,2,SEED),B.AIR);
 assert.equal(architecturalVoxel(p,upper,4,14,2,SEED),B.AIR);
 assert.equal(architecturalVoxel(p,upper,3,14,1,SEED),B.FLOOR_FINISH);
});
test('floor and ceiling are separate slab layers with different surface materials',()=>{
 const p=blueprintFor(0,0,SEED),s=storyAt(p,0);
 assert.equal(architecturalVoxel(p,s,7,7,0,SEED),B.CONCRETE);
 assert.equal(architecturalVoxel(p,s,7,7,1,SEED),B.FLOOR_FINISH);
 assert.equal(architecturalVoxel(p,s,7,7,5,SEED),B.CEILING_FINISH);
 assert.ok(isSlab(B.FLOOR_FINISH)&&isSlab(B.CEILING_FINISH));
 const floor=shapeBoxes(B.FLOOR_FINISH,0,0,0),ceiling=shapeBoxes(B.CEILING_FINISH,0,0,0);
 assert.equal(floor[0].h,.5);assert.equal(floor[0].y,0);
 assert.equal(ceiling[0].h,.5);assert.equal(ceiling[0].y,.5);
 assert.notEqual(materialFor(B.FLOOR_FINISH,0),materialFor(B.CEILING_FINISH,0));
 assert.equal(BLOCKS.length,86);
 for(let id=83;id<=85;id++)assert.ok(materialFor(id,0)<=MATERIALS.length);
});
test('cross-chunk generation order has no effect on v5 ruined buildings',()=>{
 const coords=[[0,0],[1,0],[0,1],[-1,0],[2,2],[-2,-1]];
 const a=coords.map(([cx,cz])=>generateChunk(new Chunk(cx,cz),SEED,'ruins',5).data);
 const b=coords.slice().reverse().map(([cx,cz])=>generateChunk(new Chunk(cx,cz),SEED,'ruins',5).data).reverse();
 for(let i=0;i<a.length;i++)assert.deepEqual(a[i],b[i]);
 assert.ok(a.some(arr=>arr.includes(B.FLOOR_FINISH)));
 assert.ok(a.some(arr=>arr.includes(B.CEILING_FINISH)));
});
