import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS} from '../src/core/blocks.js';
import {MATERIALS,materialFor,makeTextureLayers} from '../src/client/textures.js';
import {buildingPlan,floorPlan} from '../src/worldgen/buildings.js';
import {generateChunk} from '../src/worldgen/generators.js';

test('storeys are planned deterministically and never exceed the vertical limit',()=>{
 let found=0;
 for(let rz=-3;rz<=3;rz++)for(let rx=-3;rx<=3;rx++){
  const p=buildingPlan(rx,rz,52771);
  if(!p)continue;found++;
  assert.deepEqual(p,buildingPlan(rx,rz,52771));
  assert.ok(p.floors>=2);
  for(let i=0;i<p.floors;i++){
   const f=floorPlan(p,i);
   assert.equal(f.base,p.base+i*5);
   assert.ok(f.base+4<64);
  }
 }
 assert.ok(found>5);
});
test('ruin chunks and fixtures are deterministic regardless of generation order',()=>{
 const seed=52771;
 const regions=[[0,0],[1,0],[0,1],[-1,-1]];
 const forward=regions.map(([x,z])=>generateChunk(new Chunk(x,z),seed,'ruins',3));
 const reverse=regions.slice().reverse().map(([x,z])=>generateChunk(new Chunk(x,z),seed,'ruins',3)).reverse();
 for(let i=0;i<forward.length;i++)assert.deepEqual(forward[i].data,reverse[i].data);
 assert.ok(forward.some(c=>c.data.some(id=>id>=B.CONCRETE&&id<=B.WARNING_STRIPE)));
});
test('new materials are append-only, textured, and fit the existing array format',()=>{
 assert.equal(B.CONCRETE,55);
 assert.equal(B.WARNING_STRIPE,76);
 assert.equal(BLOCKS.length,77);
 const tex=makeTextureLayers();
 assert.equal(tex.layers,MATERIALS.length);
 assert.equal(tex.layers,40);
 assert.equal(tex.data.length,40*32*32*4);
 for(let id=55;id<=76;id++)assert.ok(materialFor(id,0)<=tex.layers);
 assert.ok(BLOCKS[B.FLUORESCENT].light);
 assert.equal(BLOCKS[B.BROKEN_FLUORESCENT].light,undefined);
});
test('old saves retain legacy worldgen while new worlds persist their version',()=>{
 const records=new Map();
 const storage={getItem:key=>records.get(key)||null,setItem:(key,val)=>records.set(key,val)};
 records.set('mcweb:old',JSON.stringify({seed:123,mode:'normal',edits:{},states:[]}));
 const legacy=new World({name:'old',seed:123,mode:'normal',version:3,storage});
 assert.equal(legacy.version,1);
 const modern=new World({name:'new-ruins',seed:52771,mode:'ruins',version:3,storage});
 modern.save();
 assert.equal(JSON.parse(records.get('mcweb:new-ruins')).generationVersion,3);
});
