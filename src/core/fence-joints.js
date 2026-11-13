import {BLOCK as B} from './blocks.js';

const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];

export function fenceJoints(neighborId){
 const joints=[];
 for(const [x,z] of DIRECTIONS){
  for(const rise of [0,1,-1]){
   if(neighborId(x,rise,z)!==B.FENCE)continue;
   if(rise&&(neighborId(0,rise,0)===B.FENCE||neighborId(x,0,z)===B.FENCE))continue;
   if(x&&z&&(neighborId(x,0,0)===B.FENCE||neighborId(0,0,z)===B.FENCE||
    neighborId(x,rise,0)===B.FENCE||neighborId(0,rise,z)===B.FENCE))continue;
   joints.push([x,rise,z]);
   break;
  }
 }
 return joints;
}

export function fencePrisms(x,y,z,joints,metal=false){
 const pieces=[];
 const put=(foot,low,high,material)=>{
  pieces.push({solid:true,material,vertices:foot.map(([dx,dz,lift])=>({x:x+dx,z:z+dz,lo:y+low+lift,hi:y+high+lift}))});
 };
 const post=metal?.07:.095,material=metal?106:115;
 put([[.5-post,.5-post,0],[.5+post,.5-post,0],[.5+post,.5+post,0],[.5-post,.5+post,0]],0,1,material);
 for(const [dx,rise,dz] of joints){
  const thickness=metal?.045:.059;
  const nx=-dz*thickness,nz=dx*thickness;
  const ex=.5+dx*.5,ez=.5+dz*.5;
  const ends=[
   [.5+nx,.5+nz,0],[.5-nx,.5-nz,0],
   [ex-nx,ez-nz,rise*.5],[ex+nx,ez+nz,rise*.5],
  ];
  for(const h of [.36,.78])put(ends,h,h+(metal?.075:.11),material);
 }
 return pieces;
}
