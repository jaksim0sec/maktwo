import test from 'node:test';
import assert from 'node:assert/strict';
import {frustumPlanes,boxIntersectsFrustum} from '../src/client/frustum.js';
import {view,perspective} from '../src/client/renderer.js';

const mul=(a,b)=>{const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const clip=(m,x,y,z)=>[0,1,2,3].map(r=>m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r]);
const inClip=(c,eps=0)=>Math.abs(c[0])<=c[3]+eps&&Math.abs(c[1])<=c[3]+eps&&Math.abs(c[2])<=c[3]+eps&&c[3]>0;
let seed=1;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;

test('boxes in front are visible, behind and far to the side are culled',()=>{
 const vp=mul(perspective(1.2,16/9,.05,200),view(0,0,0,0,0)); // looks down -z
 const planes=frustumPlanes(vp);
 assert.equal(boxIntersectsFrustum(planes,-1,-1,-12,1,1,-10),true);
 assert.equal(boxIntersectsFrustum(planes,-1,-1,10,1,1,12),false,'behind camera');
 assert.equal(boxIntersectsFrustum(planes,60,-1,-12,62,1,-10),false,'far to the right');
 assert.equal(boxIntersectsFrustum(planes,-1,-1,-400,1,1,-390),false,'past the far plane');
});

test('a box that contains the camera is always visible',()=>{
 for(let n=0;n<200;n++){
  const yaw=(rnd()-.5)*12,pitch=(rnd()-.5)*2.6,x=rnd()*100-50,y=rnd()*50,z=rnd()*100-50;
  const planes=frustumPlanes(mul(perspective(1.2,rnd()+.6,.05,260),view(yaw,pitch,x,y,z)));
  assert.equal(boxIntersectsFrustum(planes,x-6,y-6,z-6,x+10,y+10,z+10),true);
 }
});

test('never culls a box that has a corner inside the view (randomised)',()=>{
 let culled=0,kept=0;
 for(let n=0;n<4000;n++){
  const yaw=(rnd()-.5)*12,pitch=(rnd()-.5)*2.6,x=rnd()*60-30,y=rnd()*40,z=rnd()*60-30;
  const vp=mul(perspective(.9+rnd()*.7,rnd()*1.2+.6,.05,260),view(yaw,pitch,x,y,z));
  const planes=frustumPlanes(vp);
  const bx=rnd()*160-80,by=rnd()*60-10,bz=rnd()*160-80,sx=.5+rnd()*16,sy=.5+rnd()*40,sz=.5+rnd()*16;
  const corners=[];for(const dx of [0,sx])for(const dy of [0,sy])for(const dz of [0,sz])corners.push(clip(vp,bx+dx,by+dy,bz+dz));
  const reference=corners.some(c=>inClip(c,1e-4));
  const result=boxIntersectsFrustum(planes,bx,by,bz,bx+sx,by+sy,bz+sz);
  if(reference)assert.equal(result,true,`visible box was culled (case ${n})`);
  result?kept++:culled++;
 }
 assert.ok(culled>500&&kept>500,'test should exercise both outcomes');
});

test('a chunk column straddling the view edge stays visible',()=>{
 const vp=mul(perspective(1.1,1.5,.05,260),view(0,0,0,5,0));
 const planes=frustumPlanes(vp);
 // Wide box whose centre is outside the view cone but whose edge crosses into it.
 assert.equal(boxIntersectsFrustum(planes,5,0,-30,21,64,-14),true);
});
