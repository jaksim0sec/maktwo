import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,PART_FAMILIES,partGeometry} from '../src/core/part-library.js';
import {partPrisms,prismFaces,partOverlaps,partRaycast} from '../src/core/part-prisms.js';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {buildType,placementRotation} from '../src/core/construction.js';
import {meshChunk,fanRotorMesh} from '../src/client/mesher.js';
import {shapeBoxes} from '../src/core/shapes.js';

const part=(family,variant=0)=>PARTS.find(p=>p.family===family&&p.variant===variant);
const worlds=()=>new World({mode:'parts',seed:9999});
test('all 65 part models remain separately placeable with physically clipped 45 degree geometry',()=>{
 assert.equal(PART_FAMILIES.length,13);
 assert.equal(PARTS.length,65);
 for(const item of PARTS){
  assert.equal(buildType(item.id).rotation,45);
  assert.equal(placementRotation(item.id,0).step,45);
  assert.ok(partGeometry(item.id).length>0);
  for(let turn=0;turn<8;turn++){
   const shapes=partPrisms(item.id,10,24,10,{facing:turn});
   assert.ok(shapes.length>0,item.name+' '+turn);
   for(const poly of shapes)for(const v of poly.vertices){
    assert.ok(v.x>=10-1e-6&&v.x<=11+1e-6,'clip X');
    assert.ok(v.z>=10-1e-6&&v.z<=11+1e-6,'clip Z');
    assert.ok(v.hi>=v.lo,'valid local height');
   }
  }
 }
});
test('stairs include tread nosing, vertical risers and physically sloped integrated metal rails',()=>{
 for(let variant=0;variant<5;variant++){
  const stair=part('staircase',variant),pieces=partGeometry(stair.id);
  assert.ok(pieces.some(p=>p.railSide==='left'));
  assert.ok(pieces.some(p=>p.railSide==='right'));
  assert.ok(pieces.some(p=>p.slopeY>0),'actual inclined rail, not stepped decals');
  assert.ok(pieces.some(p=>p.structural));
  assert.ok(pieces.length>=20,'several actual tread and handrail shapes');
  assert.ok(shapeBoxes(stair.id,0,0,0,{facing:0}).length>0);
 }
});
test('neighboring stairs share one side with no duplicated rail or hidden side face at four cardinal orientations',()=>{
 const id=part('staircase').id;
 const offsets=[[-1,0],[0,-1],[1,0],[0,1]];
 for(const facing of [0,2,4,6]){
  const w=worlds(),x=72,y=24,z=72,[dx,dz]=offsets[facing/2];
  assert.equal(w.set(x,y,z,id),true);
  assert.equal(w.set(x+dx,y,z+dz,id),true);
  if(facing)for(const [px,pz] of [[x,z],[x+dx,z+dz]])w.setShapeState(px,y,pz,{facing});
  const state=w.getShapeState(x,y,z),other=w.getShapeState(x+dx,y,z+dz);
  assert.equal(state.connected.left,true);
  assert.equal(other.connected.right,true);
  const before=partPrisms(id,x,y,z,{facing}),joined=partPrisms(id,x,y,z,state);
  assert.ok(joined.length<before.length,'inner rail removed');
  const main=joined.find(p=>p.structural);
  assert.ok(prismFaces(main,true).length<prismFaces(main,false).length,'hidden contact surface removed');
  w.setShapeState(x+dx,y,z+dz,{facing:(facing+1)%8});
  assert.equal(w.getShapeState(x,y,z).connected.left,false,'rotate updates nearby rail');
 }
});
test('the same 45 degree prism is used for picking and solid-body collision',()=>{
 const window=part('window',2),x=80,y=24,z=80,shape=partPrisms(window.id,x,y,z,{facing:1});
 const hit=partRaycast(shape,{x:x+.5,y:y+.65,z:z+1.3},{x:0,y:0,z:-1},3);
 assert.ok(hit&&hit.distance>0&&hit.distance<3);
 assert.ok(partOverlaps(shape,{x:x+.5,y:y+.3,z:z+.5,width:.6,height:1.4}));
 assert.equal(partOverlaps(shape,{x:x+2,y:y+.3,z:z+.5,width:.4,height:1.4}),false);
 const w=worlds();w.set(x,y,z,window.id);w.setShapeState(x,y,z,{facing:1});
 assert.equal(w.getShapeState(x,y,z).facing,1);
 assert.ok(w.getShapeState(x,y,z).connected===undefined);
});
test('all eight stair and window directions render, including translucent glass and rotor blades',()=>{
 const w=worlds(),x=82,y=24,z=82;
 for(const family of ['staircase','window','ventilation']){
  for(let facing=0;facing<8;facing++){
   const item=part(family);
   w.set(x,y,z,item.id);
   w.setShapeState(x,y,z,{facing});
   const mesh=meshChunk(w,w.getChunk(Math.floor(x/16),Math.floor(z/16)));
   assert.ok(mesh.opaque.length>0,family+' '+facing);
   if(family==='window')assert.ok(mesh.transparent.length>0,'glass separate alpha');
  }
 }
 const fan=part('ventilation'),verts=[];
 fanRotorMesh(verts,0,0,0,fan.id,1);
 assert.ok(verts.length>100,'diagonal blades and protective ring are polygons');
 assert.equal(verts.length%7,0);
});
test('all new parts keep their block ID and orientation through save/load',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const name='test-stair-parts-v151',id=part('staircase',4).id;
 const original=new World({mode:'parts',name,seed:9999,storage});
 original.set(60,24,60,id);
 original.setShapeState(60,24,60,{facing:7});
 assert.equal(original.save(),true);
 const reloaded=new World({mode:'parts',name,seed:9999,storage});
 assert.equal(reloaded.get(60,24,60),id);
 assert.equal(reloaded.getShapeState(60,24,60).facing,7);
});
