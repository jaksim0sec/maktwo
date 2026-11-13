import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,partGeometry} from '../src/core/part-library.js';
import {partPrisms,signConnections} from '../src/core/part-prisms.js';
import {World} from '../src/core/world.js';
import {Chunk} from '../src/core/chunk.js';
import {meshChunkData} from '../src/client/mesher.js';
import {BLOCKS} from '../src/core/blocks.js';
const sign=variant=>PARTS.find(p=>p.family==='sign'&&p.variant===variant).id;
test('horizontal non-emissive sign panels omit internal side caps',()=>{
 const id=sign(0),a=partPrisms(id,0,0,0,{facing:0}),b=partPrisms(id,0,0,0,{facing:0,connected:{left:true,right:true}});
 assert.ok(b.length<a.length);
 assert.ok(partGeometry(id).every(piece=>!piece.emissive));
 assert.deepEqual(signConnections(id,0,(dx,dz)=>({id:dx===1?id:0,facing:0})),{left:false,right:true});
});
test('projecting vertical signs stack without duplicated top or bottom caps',()=>{
 const id=sign(1),a=partPrisms(id,0,0,0,{facing:0}),b=partPrisms(id,0,0,0,{facing:0,connected:{top:true,bottom:true}});
 assert.ok(b.length<a.length);
 assert.deepEqual(signConnections(id,0,(_,__,dy)=>({id:dy===1?id:0,facing:0})),{top:true,bottom:false});
});
test('world picking/collision state and mesh agree on sign connections',()=>{
 const w=new World({mode:'parts',seed:9999});const id=sign(0),x=70,y=24,z=70;
 w.set(x,y,z,id);w.set(x+1,y,z,id);
 assert.equal(w.getShapeState(x,y,z).connected.right,true);
 assert.equal(w.getShapeState(x+1,y,z).connected.left,true);
 const first=new Chunk(0,0,32),next=new Chunk(1,0,32);
 first.data[(8*16+8)*16+15]=id;next.data[(8*16+8)*16]=id;
 const isolated=meshChunkData(next),attached=meshChunkData(next,{neighbors:[[-1,0,first.data]]});
 assert.ok(attached.opaque.length<isolated.opaque.length);
});
test('signs do not add any emitted lighting',()=>{for(let v=0;v<5;v++){const id=sign(v);assert.equal(BLOCKS[id].light,undefined);}});
