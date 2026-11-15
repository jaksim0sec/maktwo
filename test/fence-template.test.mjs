import test from 'node:test';
import assert from 'node:assert/strict';
import {fencePrisms,fenceJoints} from '../src/core/fence-joints.js';
import {prismFaces} from '../src/core/part-prisms.js';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {meshChunkData} from '../src/client/mesher.js';

const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
const jointsFor=code=>{const out=[];let c=code;for(const [x,z] of DIRS){const d=c%4;c=Math.floor(c/4);if(d)out.push([x,[0,1,-1][d-1],z])}return out};
const triangleVertices=faces=>faces.reduce((n,f)=>n+(f.length-2)*3,0);

// The mesher drops each rail's end cap at the post centre (prism face 2). That is only
// invisible while the cap stays strictly inside the post, so this guards fence geometry edits.
test('fence rail caps at the post centre stay strictly inside the post for every joint layout',()=>{
 for(const metal of [false,true]){
  const half=metal?.07:.095;
  for(let code=0;code<4**8;code+=1){
   fencePrisms(0,0,0,jointsFor(code),metal).forEach((piece,index)=>{
    if(index===0)return;
    for(const [x,y,z] of prismFaces(piece)[2]){
     assert.ok(Math.abs(x-.5)<half&&Math.abs(z-.5)<half&&y>0&&y<1,
      `rail cap escapes the post (metal=${metal}, joints=${JSON.stringify(jointsFor(code))})`);
    }
   });
  }
 }
});

function meshWith(cells){
 const chunk=new Chunk(0,0,16);
 for(const [x,y,z] of cells)chunk.set(x,y,z,B.FENCE);
 return meshChunkData(chunk,{});
}

test('fence mesh is the full prism geometry minus one hidden cap per rail',()=>{
 for(const joinedTo of [[],[[1,0]],[[1,0],[0,1]],[[1,0],[-1,0]]]){
  const cells=[[8,1,8],...joinedTo.map(([dx,dz])=>[8+dx,1,8+dz])];
  const {opaque}=meshWith(cells);
  // Expected vertices: every fence cell, built straight from the prisms.
  let expected=0;
  for(const [x,y,z] of cells){
   // Reference joints come from the shared joint rules, independent of the mesher.
   const joints=fenceJoints((dx,dy,dz)=>cells.some(c=>c[0]===x+dx&&c[1]===y+dy&&c[2]===z+dz)?B.FENCE:B.AIR);
   fencePrisms(x,y,z,joints,false).forEach((piece,index)=>{
    const faces=prismFaces(piece);
    expected+=triangleVertices(index===0?faces:faces.filter((_,i)=>i!==2));
   });
  }
  assert.equal(opaque.length/7,expected,`vertex count for ${joinedTo.length+1} connected fence cells`);
 }
});

test('identical fences emit identical translated geometry',()=>{
 const single=meshWith([[3,1,3]]).opaque,moved=meshWith([[9,1,12]]).opaque;
 assert.equal(single.length,moved.length);
 for(let i=0;i<single.length;i+=7){
  assert.ok(Math.abs(moved[i]-single[i]-6)<1e-5&&Math.abs(moved[i+2]-single[i+2]-9)<1e-5,'x/z translate by the cell offset');
  assert.equal(moved[i+1],single[i+1]);
  for(let k=3;k<7;k++)assert.equal(moved[i+k],single[i+k],'colour and shade are untouched');
 }
});
