import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk,SIZE} from '../src/core/chunk.js';
import {BLOCK as B,BLOCKS,BLOCK_LABELS} from '../src/core/blocks.js';
import {TREE_SPECIES,TREE_BLOCKS,FALLEN_LEAF_BLOCKS,TREE_ASSET_START,treeKind} from '../src/core/tree-assets.js';
import {treeMesh,leafLitterMesh} from '../src/client/tree-mesh.js';
import {meshChunkData} from '../src/client/mesher.js';
import {shapeBoxes} from '../src/core/shapes.js';
import {materialUVTransform} from '../src/client/textures.js';
import {ARBORETUM_MODE,ARBORETUM_SPAWN,TREE_SHOWCASE,roadsideTreeCell,stampArboretum} from '../src/worldgen/trees.js';
import {generateChunk} from '../src/worldgen/generators.js';
import {createCityPlan,CITY_BOTANICAL_VERSION} from '../src/worldgen/eternal-night-game.js';
import {World} from '../src/core/world.js';
import {WORLD_PRESETS,PALETTES} from '../src/core/catalog.js';

test('eight appended tree and litter IDs preserve all preexisting 0-237 save indices',()=>{
 assert.equal(TREE_ASSET_START,238);
 assert.equal(B.CRATE,187);
 assert.equal(B.PART_STATION_TRAINRUNNING_5,237);
 assert.equal(B.TREE_SAKURA,238);assert.equal(B.TREE_GINKGO,239);
 assert.equal(B.TREE_MAPLE,240);assert.equal(B.TREE_GREEN,241);
 assert.equal(B.FALLEN_SAKURA,242);assert.equal(B.FALLEN_GINKGO,243);
 assert.equal(B.FALLEN_MAPLE,244);assert.equal(B.FALLEN_GREEN,245);
 assert.equal(BLOCKS.length,246);assert.equal(BLOCK_LABELS.length,246);
 assert.ok(BLOCKS.every((b,i)=>b.id===i&&i<=255));
 assert.equal(TREE_SPECIES.length,4);
 assert.equal(TREE_BLOCKS.length,4);assert.equal(FALLEN_LEAF_BLOCKS.length,4);
 for(const p of [...TREE_BLOCKS,...FALLEN_LEAF_BLOCKS]){
  assert.equal(BLOCKS[p.id].render,p.render);
  assert.equal(BLOCKS[p.id].breakTime,Infinity,'harvest intentionally withheld');
  assert.equal(treeKind(p.id),p.kind);
 }
 assert.equal(PALETTES.trees.items.length,8);
});
test('four anisotropic tree silhouettes have real branch and crown triangles, no Minecraft leaf cubes',()=>{
 for(let kind=0;kind<4;kind++)for(let variant=0;variant<4;variant++){
  const tree=treeMesh(kind,variant),floor=leafLitterMesh(kind,variant);
  assert.ok(tree.length>1200*7);
  assert.ok(tree.length<11000*7);
  assert.ok(tree.every(Number.isFinite)&&floor.every(Number.isFinite));
  assert.equal(tree.length%7,0);assert.equal(floor.length%7,0);
  assert.strictEqual(treeMesh(kind,variant),tree,'geometry templates must be reused');
  assert.strictEqual(leafLitterMesh(kind,variant),floor);
  const coordinates=[];
  for(let i=0;i<tree.length;i+=7)coordinates.push([tree[i],tree[i+1],tree[i+2]]);
  const maxY=Math.max(...coordinates.map(p=>p[1]));
  const minY=Math.min(...coordinates.map(p=>p[1]));
  const minX=Math.min(...coordinates.map(p=>p[0]));
  const maxX=Math.max(...coordinates.map(p=>p[0]));
  assert.ok(minY>=-.1&&maxY>=TREE_SPECIES[kind].height*.9,'must be tall branched form');
  assert.ok(maxX-minX>2.8,'non-cuboid canopy spread');
  for(let i=1;i<floor.length;i+=7)assert.ok(floor[i]>=0&&floor[i]<.13,'litter lies on paving');
 }
 assert.notDeepEqual(treeMesh(0),treeMesh(1));
 assert.notDeepEqual(treeMesh(1),treeMesh(2));
});
test('compact botanical silhouettes use normal night lighting, not emissive leaf shaders',()=>{
 const limits=[7.6,9,7.9,8.6],widthLimits=[8.3,6.0,8.1,8.1];
 for(let kind=0;kind<4;kind++)for(let variant=0;variant<4;variant++){
  const tree=treeMesh(kind,variant),floor=leafLitterMesh(kind,variant);
  let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity;
  let darkResponsive=0,wood=0;
  for(let i=0;i<tree.length;i+=7){
   const shade=tree[i+6],x=tree[i],y=tree[i+1];
   assert.ok(shade>0,'negative vertex shade bypasses ambient lighting');
   if(shade<1)darkResponsive++;
   else wood++;
   minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  }
  for(let i=6;i<floor.length;i+=7)
   assert.ok(floor[i]>0&&floor[i]<1,'fallen leaves must also receive darkness');
  assert.ok(maxY-minY<=limits[kind],'tree exceeds new scale budget');
  assert.ok(maxX-minX<=widthLimits[kind],'canopy exceeds new scale budget');
  assert.ok(darkResponsive>tree.length/7*.35,'canopy must use light-responsive plain color');
  assert.ok(wood>0,'real wooden branches must remain');
  assert.ok(tree.length/7<11000,'smaller branching leaves must fit performance budget');
 }
 const maxima=TREE_SPECIES.flatMap(t=>[t.bark,...t.crown,...t.litter]);
 for(const hex of maxima){
  assert.match(hex,/^#[0-9a-f]{6}$/i);
  assert.ok(Math.max(...[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16)))<=242,
   'do not bring back overexposed neon tones');
 }
});
test('one render anchor emits full model and fallen petals in the seven-float worker contract',()=>{
 const c=new Chunk(0,0,64);
 c.set(4,23,4,B.TREE_SAKURA);c.set(7,23,4,B.FALLEN_SAKURA);
 const geometry=meshChunkData(c,{yMin:20,yMax:40});
 assert.equal(geometry.opaque.length%7,0);
 assert.ok(geometry.opaque.length>treeMesh(0).length);
 assert.ok(geometry.opaque.every(Number.isFinite));
 let high=0;
 for(let i=1;i<geometry.opaque.length;i+=7)high=Math.max(high,geometry.opaque[i]);
 assert.ok(high>32,'upper branches extend above anchor');
 assert.equal(shapeBoxes(B.TREE_SAKURA,4,23,4)[0].w,.4);
 assert.equal(shapeBoxes(B.FALLEN_SAKURA,7,23,4),null);
});
test('arboretum spans chunks, contains four actual models and their leaf carpets',()=>{
 const seen=new Set(),world=new World({mode:ARBORETUM_MODE,seed:9999});
 for(const item of TREE_SHOWCASE){
  assert.equal(world.get(item.x,23,item.z),item.id);
  assert.equal(world.get(item.x,22,item.z)>0,true);
  assert.equal(world.get(item.x,34,item.z),B.AIR,'one anchor not tower of leaf cubes');
  let leafCount=0;
  for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++)
   if(world.get(item.x+dx,23,item.z+dz)===item.litter)leafCount++;
  assert.ok(leafCount>=12,'fallen leaves around '+item.kind);
  seen.add(item.id);seen.add(item.litter);
 }
 assert.equal(seen.size,8);
 assert.deepEqual(world.spawn(),ARBORETUM_SPAWN);
 assert.ok(WORLD_PRESETS.some(p=>p.name==='AbandonedArboretum'));
 const a=stampArboretum(new Chunk(-1,0),9999);
 const b=generateChunk(new Chunk(-1,0),9999,ARBORETUM_MODE);
 assert.deepEqual(a.data,b.data);
});
test('city v9 seeds all four species only into open roadside space; v8 saved geometry stays intact',()=>{
 assert.equal(CITY_BOTANICAL_VERSION,9);
 const plan8=createCityPlan(9999,8),plan9=createCityPlan(9999,9);
 const ids=new Set(),leaves=new Set();
 for(const alongX of [false,true])for(const sign of [-1,1])for(let p=2;p<=5;p++){
  const major=30+66*p,shoulder=Math.floor(plan9.layout.roadHalfWidth*.56);
  for(const side of [-1,1]){
   const x=alongX?sign*major:side*shoulder,z=alongX?side*shoulder:sign*major;
   const at=roadsideTreeCell(x,z,plan9.layout,9999);
   if(at?.trunk)ids.add(at.kind);
   if(at)leaves.add(at.id);
  }
 }
 assert.equal(ids.size,4);
 assert.ok(leaves.size>=4);
 assert.equal(plan8.layout.roadHalfWidth,plan9.layout.roadHalfWidth);
 assert.equal(plan8.stations.length,4);
 assert.equal(plan9.stations.length,4);
 assert.equal(new World({name:'EternalNightCityV8',mode:'eternal-city-lab'}).version,8);
 assert.equal(new World({name:'EternalNightGardenV9',mode:'eternal-city-lab'}).version,9);
});
test('position-dependent texture mirroring and angle rotation remain disabled',()=>{
 for(const mat of [4,10,26,33,50,71,90])for(let n=0;n<=8;n++){
  assert.equal(materialUVTransform(mat,n/8),0);
  assert.equal(materialUVTransform(mat,n/8,2),2);
 }
});
