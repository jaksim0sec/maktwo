import {SIZE, HEIGHT} from '../core/chunk.js';
import {BLOCK as B, BLOCKS, block} from '../core/blocks.js?v=1.1.0';
import {hash} from '../util/math.js';
import {materialFor} from './textures.js';
import {doorBounds} from '../core/door.js';

// Winding and direction are kept consistent with the WebGL cull-face convention.
const FACES = [
  {d:[1,0,0],  n:0, u:1, v:2, corners:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],shade:.78},
  {d:[-1,0,0], n:0, u:1, v:2, corners:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],shade:.74},
  {d:[0,1,0],  n:1, u:0, v:2, corners:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
  {d:[0,-1,0], n:1, u:0, v:2, corners:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.56},
  {d:[0,0,1],  n:2, u:1, v:0, corners:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],shade:.88},
  {d:[0,0,-1], n:2, u:1, v:0, corners:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],shade:.82}
];
const DIMS = [SIZE, HEIGHT, SIZE];
const COLORS = BLOCKS.map(({color}) => rgb(color));
const TRANSPARENT = BLOCKS.map(({render})=>render==='fluid'||render==='glass'||render==='portal');
const OPAQUE = BLOCKS.map(({opaque})=>opaque);
const CROSS = BLOCKS.map(({render})=>render==='cross'||render==='fixture'||render==='door'||render==='door-top');
const CUTOUT = BLOCKS.map(({render})=>render==='cutout');

export function rgb(hex){const s=hex.replace('#','');return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255]}
export function quad(arr,v,color,shade){for(const i of [0,1,2,0,2,3])arr.push(...v[i],...color,shade)}
export function cube(arr,x,y,z,w,h,d,color,shade=1){for(const face of FACES){const v=face.corners.map(([a,b,c])=>[x+a*w,y+b*h,z+c*d]);quad(arr,v,color,face.shade*shade)}}

// Six directional masks; every rectangular run of the same block becomes ONE quad.
// Cross plants remain individual crossed quads. No changes to storage or world rules.
export function meshChunk(world,chunk){
 const opaque=[],transparent=[],ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let faceIndex=0;faceIndex<FACES.length;faceIndex++){
  const f=FACES[faceIndex];const {d,n,u,v,corners,shade}=f,nu=DIMS[u],nv=DIMS[v],sign=d[n];
  const mask=new Int32Array(nu*nv);
  const edge=n===0?world.getChunk(chunk.cx+sign,chunk.cz,false):n===2?world.getChunk(chunk.cx,chunk.cz+sign,false):null;
  const data=chunk.data, edgeData=edge?.data;
  for(let layer=0;layer<DIMS[n];layer++){
   let i=0;
   for(let j=0;j<nv;j++)for(let k=0;k<nu;k++,i++){
    const x=n===0?layer:n===1?k:j;
    const y=n===1?layer:k;
    const z=n===2?layer:j;
    const idx=(y*SIZE+z)*SIZE+x,id=data[idx];
    if(id===B.AIR||CROSS[id]){mask[i]=0;continue}
    let other;
    if(n===0){
     const next=x+sign;
     other=next>=0&&next<SIZE?data[idx+sign]:edgeData?edgeData[(y*SIZE+z)*SIZE+(sign===1?0:SIZE-1)]:B.AIR;
    }else if(n===1){
     const next=y+sign;
     other=next<0?B.BEDROCK:next>=HEIGHT?B.AIR:data[idx+sign*SIZE*SIZE];
    }else{
     const next=z+sign;
     other=next>=0&&next<SIZE?data[idx+sign*SIZE]:edgeData?edgeData[(y*SIZE+(sign===1?0:SIZE-1))*SIZE+x]:B.AIR;
    }
    const transparent=TRANSPARENT[id];
    mask[i]=OPAQUE[other]||(id===other&&(transparent||CUTOUT[id]))||(!transparent&&other===B.GLASS)
      ?0:id|(id===B.WATER&&n!==1?y<<8:0);
   }
   for(let j=0;j<nv;j++)for(let k=0;k<nu;){
    const idx=j*nu+k,mat=mask[idx];if(!mat){k++;continue}
    let width=1,height=1;
    while(k+width<nu&&mask[idx+width]===mat)width++;
    heightLoop:while(j+height<nv){for(let t=0;t<width;t++)if(mask[(j+height)*nu+k+t]!==mat)break heightLoop;height++}
    for(let jj=0;jj<height;jj++)mask.fill(0,(j+jj)*nu+k,(j+jj)*nu+k+width);
    const id=mat&255,dest=TRANSPARENT[id]?transparent:opaque;
    const c=[0,0,0];c[n]=layer;c[u]=k;c[v]=j;
    const xyz=[ox+c[0],c[1],oz+c[2]],water=id===B.WATER;
    const verts=corners.map(q=>{
     const p=[...xyz];p[n]+=q[n];p[u]+=q[u]*width;p[v]+=q[v]*height;
     if(water&&q[1]===1)p[1]-=.13;
     return p;
    });
    // Tiny world-coordinate variation only per merged face, never per vertex.
    const color=COLORS[id],variation=.95+hash(xyz[0],xyz[1],xyz[2],world.seed)*.06;
    quad(dest,verts,[color[0]*variation,color[1]*variation,color[2]*variation],shade+4*materialFor(id,faceIndex));
    k+=width;
   }
  }
 }
 // Thin crossed planes must remain double-sided, irrespective of face culling.
 for(let y=0;y<HEIGHT;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const id=chunk.get(x,y,z);if(id!==B.FLOWER&&id!==B.TORCH&&id!==B.LANTERN&&id!==B.CAMPFIRE&&id!==B.DOOR)continue;
  const wx=ox+x,wz=oz+z,color=COLORS[id];
  if(id===B.DOOR){doorMesh(opaque,wx,y,wz,world.getDoorState?.(wx,y,wz));continue}
  if(id!==B.FLOWER){fixture(opaque,id,wx,y,wz);continue}
  const v1=[[wx+.12,y,wz+.12],[wx+.88,y,wz+.88],[wx+.88,y+.87,wz+.88],[wx+.12,y+.87,wz+.12]];
  const v2=[[wx+.12,y,wz+.88],[wx+.88,y,wz+.12],[wx+.88,y+.87,wz+.12],[wx+.12,y+.87,wz+.88]];
  for(const verts of [v1,v2,[...v1].reverse(),[...v2].reverse()])quad(opaque,verts,color,1);
 }
 return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent)};
}

// Small low-poly practical lights. Negative vertex shade tags emissive surfaces
// without adding another vertex attribute or increasing the chunk buffer stride.
export function fixture(dest,id,x,y,z){
 const shape=(dx,dy,dz,w,h,d,color,shade=1)=>cube(dest,x+dx,y+dy,z+dz,w,h,d,rgb(color),shade);
 if(id===B.TORCH){
  shape(.43,.06,.43,.14,.65,.14,'#806550');
  shape(.405,.68,.405,.19,.17,.19,'#e9ad63',-1.5);
  shape(.445,.81,.445,.11,.11,.11,'#ffe2a3',-1.6);
 }else if(id===B.LANTERN){
  shape(.31,.12,.31,.38,.09,.38,'#746858');
  shape(.36,.22,.36,.28,.38,.28,'#ffd19a',-1.5);
  for(const dx of [.3,.64])for(const dz of [.3,.64])shape(dx,.2,dz,.06,.44,.06,'#766b59');
  shape(.28,.63,.28,.44,.09,.44,'#766b59');
  shape(.45,.72,.45,.10,.11,.10,'#766b59');
 }else if(id===B.CAMPFIRE){
  shape(.13,.09,.28,.74,.18,.18,'#80624d');
  shape(.28,.06,.13,.18,.19,.74,'#7b5d4a');
  shape(.29,.22,.31,.42,.12,.39,'#e47b45',-1.15);
  shape(.37,.34,.37,.26,.32,.26,'#f8ae65',-1.5);
  shape(.45,.59,.45,.10,.13,.10,'#ffe0a3',-1.7);
 }
}

// The door's full two-block model is emitted once from the lower cell.
// Rendering it separately avoids breaking greedy face merging or chunk storage.
export function doorMesh(dest,x,y,z,state={facing:0,open:false}){
 const b=doorBounds(x,z,state?.facing||0,Boolean(state?.open));
 const color=rgb('#af9372');
 for(let f=0;f<FACES.length;f++){
  const face=FACES[f];const verts=face.corners.map(([a,c,d])=>[b.x+a*b.w,y+.04+c*1.88,b.z+d*b.d]);
  quad(dest,verts,color,face.shade+4*materialFor(18,f));
 }
 // Inlaid handle: small warm metal knob on the visible side.
 const acrossX=b.w>b.d;
 cube(dest,b.x+(acrossX?b.w*.78:-.025),y+.93,b.z+(acrossX?b.d+.008:b.d*.78),acrossX?.065:.06,.08,acrossX?.06:.065,rgb('#cdbd8f'));
}
