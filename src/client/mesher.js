import {SEA} from '../worldgen/generators.js';
import {SIZE,HEIGHT} from '../core/chunk.js';import {BLOCK as B,block} from '../core/blocks.js';import {hash} from '../util/math.js';
const FACES=[
 {d:[1,0,0],corners:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],shade:.77},
 {d:[-1,0,0],corners:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],shade:.72},
 {d:[0,1,0],corners:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
 {d:[0,-1,0],corners:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.52},
 {d:[0,0,1],corners:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],shade:.87},
 {d:[0,0,-1],corners:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],shade:.81}
];
export function rgb(hex){const s=hex.replace('#','');return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255]}
export function quad(arr,v,color,shade){for(const i of [0,1,2,0,2,3])arr.push(...v[i],...color,shade)}
export function cube(arr,x,y,z,w,h,d,color,shade=1){for(const face of FACES){const v=face.corners.map(([a,b,c])=>[x+a*w,y+b*h,z+c*d]);quad(arr,v,color,face.shade*shade)}}
export function meshChunk(world,chunk){const opaque=[],transparent=[];const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let y=0;y<HEIGHT;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const id=chunk.get(x,y,z);if(id===B.AIR)continue;const def=block(id),wx=ox+x,wz=oz+z;const v=hash(wx,y,wz,world.seed),tint=.88+v*.18,color=rgb(def.color).map(q=>q*tint),isTrans=def.render==='fluid'||def.render==='glass'||def.render==='portal';const dest=isTrans?transparent:opaque;
  if(def.render==='cross'){const v1=[[wx+.12,y,wz+.12],[wx+.88,y,wz+.88],[wx+.88,y+.87,wz+.88],[wx+.12,y+.87,wz+.12]],v2=[[wx+.12,y,wz+.88],[wx+.88,y,wz+.12],[wx+.88,y+.87,wz+.12],[wx+.12,y+.87,wz+.88]];for(const verts of [v1,v2,[...v1].reverse(),[...v2].reverse()])quad(dest,verts,color,1);continue}
  for(const f of FACES){const [dx,dy,dz]=f.d,other=world.get(wx+dx,y+dy,wz+dz,false),oth=block(other);if(other===id&&(isTrans||def.render==='cutout'))continue;if(oth.opaque)continue;if(!isTrans&&other===B.GLASS)continue;
   const hh=id===B.WATER?.87:1;const corners=f.corners.map(([a,b,c])=>[wx+a,y+b*hh,wz+c]);const top=f.d[1]>0,shade=f.shade*(top?1:1);const light=top?1:Math.min(1,.75+Math.max(0,y-SEA)/100);quad(dest,corners,color,shade*light);
  }
 }
 return{opaque:new Float32Array(opaque),transparent:new Float32Array(transparent)};
}
