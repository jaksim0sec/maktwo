import {SIZE, HEIGHT} from '../core/chunk.js';
import {BLOCK as B, BLOCKS, block} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {materialFor} from './textures.js';
import {doorBounds,DOOR_HEIGHT} from '../core/door.js';
import {shapeBoxes,isStairs,isSlab} from '../core/shapes.js';

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
const CROSS = BLOCKS.map(({render})=>['cross','fixture','door','door-top','path','mushroom','fence','workbench','stairs','slab','panel','frame','chair','flower-pot'].includes(render));
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
    const color=COLORS[id],variation=id===B.GLASS?1:.95+hash(xyz[0],xyz[1],xyz[2],world.seed)*.06;
    quad(dest,verts,[color[0]*variation,color[1]*variation,color[2]*variation],(id===B.GLASS?1:shade)+4*materialFor(id,faceIndex));
    k+=width;
   }
  }
 }
 // Thin crossed planes must remain double-sided, irrespective of face culling.
 for(let y=0;y<HEIGHT;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const id=chunk.get(x,y,z);if(![B.FLOWER,B.TORCH,B.LANTERN,B.CAMPFIRE,B.DOOR,B.PATH,B.GLOW_MUSHROOM,B.FENCE,B.WORKBENCH,B.STONE_STAIRS,B.WOOD_STAIRS,B.STONE_SLAB,B.WOOD_SLAB,B.CHAIR,B.FLOWER_POT,B.REEDS,B.HEATHER,B.BLUE_FLOWER,B.FIREFLY_GRASS,B.FLUORESCENT,B.BROKEN_FLUORESCENT,B.CONCRETE_SLAB,B.CONCRETE_STAIRS,B.THIN_WALL_NS,B.THIN_WALL_EW,B.WINDOW_NS,B.WINDOW_EW,B.UPPER_STAIR_TREAD,B.FLOOR_FINISH,B.CEILING_FINISH].includes(id))continue;
  const wx=ox+x,wz=oz+z,color=COLORS[id];
  if(isStairs(id)||isSlab(id)||BLOCKS[id].render==='panel'||BLOCKS[id].render==='frame'||id===B.CHAIR||id===B.FLOWER_POT){shapeMesh(opaque,id,wx,y,wz,world.getShapeState?.(wx,y,wz));continue}
  if(id===B.DOOR){doorMesh(opaque,wx,y,wz,world.getDoorState?.(wx,y,wz));continue}
 if(id===B.PATH){gardenMesh(opaque,id,wx,y,wz);continue}
  if(id===B.GLOW_MUSHROOM){gardenMesh(opaque,id,wx,y,wz);continue}
  if(id===B.FENCE||id===B.WORKBENCH){gardenMesh(opaque,id,wx,y,wz);continue}
  if(id!==B.FLOWER&&BLOCKS[id].render!=='cross'){fixture(opaque,id,wx,y,wz);continue}
  flowerMesh(opaque,wx,y,wz,world.seed,id);

 }
 return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent)};
}

// Small low-poly practical lights. Negative vertex shade tags emissive surfaces
// without adding another vertex attribute or increasing the chunk buffer stride.
export function fixture(dest,id,x,y,z){
 const shape=(dx,dy,dz,w,h,d,color,shade=1)=>cube(dest,x+dx,y+dy,z+dz,w,h,d,rgb(color),shade);
 if(id===B.TORCH){
  shape(.458,.04,.458,.084,.45,.084,'#806550');
  shape(.438,.49,.438,.124,.125,.124,'#e9ad63',-1.5);
  shape(.464,.61,.464,.072,.092,.072,'#ffe2a3',-1.6);
 }else if(id===B.LANTERN){
  shape(.31,.12,.31,.38,.09,.38,'#746858');
  shape(.36,.22,.36,.28,.38,.28,'#ffd19a',-1.5);
  for(const dx of [.3,.64])for(const dz of [.3,.64])shape(dx,.2,dz,.06,.44,.06,'#766b59');
  shape(.28,.63,.28,.44,.09,.44,'#766b59');
  shape(.45,.72,.45,.10,.11,.10,'#766b59');
 }else if(id===B.FLUORESCENT||id===B.BROKEN_FLUORESCENT){
  const lit=id===B.FLUORESCENT;
  shape(.10,.80,.25,.80,.10,.50,'#5f666a');
  shape(.14,.78,.29,.72,.055,.42,lit?'#afbcc5':'#555b5e');
  for(const z of [.36,.57])shape(.19,.76,z,.62,.038,.065,lit?'#eff6f1':'#899094',lit?-1.20:1);
  if(!lit)shape(.59,.72,.49,.20,.045,.05,'#4e5355');
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
  const face=FACES[f];const verts=face.corners.map(([a,c,d])=>[b.x+a*b.w,y+.04+c*DOOR_HEIGHT,b.z+d*b.d]);
  quad(dest,verts,color,face.shade+4*materialFor(18,f));
 }
 // Inlaid handle: small warm metal knob on the visible side.
 const acrossX=b.w>b.d;
 cube(dest,b.x+(acrossX?b.w*.78:-.025),y+.93,b.z+(acrossX?b.d+.008:b.d*.78),acrossX?.065:.06,.08,acrossX?.06:.065,rgb('#cdbd8f'));
}

export function gardenMesh(dest,id,x,y,z){
 const box=(dx,dy,dz,w,h,d,color,shade=1)=>cube(dest,x+dx,y+dy,z+dz,w,h,d,rgb(color),shade);
 if(id===B.WORKBENCH){
  // One reusable furniture model, separate from the chunk's greedy cube path.
  const part=(dx,dy,dz,w,h,d,color,mat=0)=>{
   const rgbColor=rgb(color);for(let fi=0;fi<FACES.length;fi++){
    const face=FACES[fi],verts=face.corners.map(([a,b,c])=>[x+dx+a*w,y+dy+b*h,z+dz+c*d]);
    quad(dest,verts,rgbColor,face.shade+4*mat);
   }
  };
  part(.045,.77,.045,.91,.22,.91,'#b29472',14);
  part(.07,.71,.07,.86,.07,.86,'#614d3a');
  for(const dx of [.11,.72])for(const dz of [.11,.72])part(dx,0,dz,.17,.76,.17,'#8d6b4b',10);
  for(let zRow=0;zRow<3;zRow++)part(.18,.990,.20+zRow*.24,.63,.005,.012,'#735944');
  return;
 }
 if(id===B.PATH){
  const color=rgb('#8b897d'),layer=materialFor(B.STONE,2);
  for(const f of FACES){const vertices=f.corners.map(([a,b,c])=>[x+.06+a*.88,y+.013+b*.035,z+.06+c*.88]);quad(dest,vertices,color,f.shade+4*layer)}
  for(const [dx,dz] of [[.17,.21],[.63,.28],[.39,.62]])box(dx,.053,dz,.13,.009,.1,'#a9a596');
 }else if(id===B.GLOW_MUSHROOM){
  box(.45,.025,.45,.10,.23,.10,'#c4b49a');
  box(.31,.235,.31,.38,.12,.38,'#dcac81',-1.13);
  box(.38,.36,.38,.24,.065,.24,'#f5d6ab',-1.22);
 }else if(id===B.FENCE){
  box(.405,0,.405,.19,1.04,.19,'#80694f');
  for(const height of [.35,.72]){
   box(.08,height,.442,.84,.13,.116,'#937755');
   box(.442,height,.08,.116,.13,.84,'#937755');
  }
  box(.375,1.04,.375,.25,.08,.25,'#a48a65');
 }
}

// Colored petals, leaves and a small centre. Slightly varied blooms, no flat X artifacts.
export function flowerMesh(dest,x,y,z,seed=0,id=B.FLOWER){
 if(id===B.REEDS){for(const dx of [.35,.52,.67])cube(dest,x+dx,y+.04,z+.44,.045,.58+hash(x,dx,z,seed)*.32,.045,rgb('#779677'));return;}
 if(id===B.FIREFLY_GRASS){for(const dx of [.33,.5,.66])cube(dest,x+dx,y+.03,z+.47,.04,.35+hash(x,dx,z,seed)*.18,.05,rgb('#6c9b69'));for(const dx of [.33,.68])cube(dest,x+dx,y+.51,z+.47,.07,.07,.07,rgb('#efc76f'),-1.08);return;}
 const n=hash(x,0,z,seed),h=.55+hash(x,1,z,seed)*.16;
 const petal=id===B.HEATHER?'#a78baa':id===B.BLUE_FLOWER?'#819dc8':n<.26?'#b97999':n<.52?'#d8a8b9':n<.78?'#e4c69b':'#ab99c5';
 cube(dest,x+.47,y+.045,z+.47,.06,h-.08,.06,rgb('#628764'));
 cube(dest,x+.33,y+.27,z+.46,.16,.045,.09,rgb('#72956e'));
 cube(dest,x+.51,y+.33,z+.44,.16,.045,.09,rgb('#668a63'));
 const cy=y+h;
 for(const [dx,dz] of [[-.13,0],[.13,0],[0,-.13],[0,.13]])cube(dest,x+.44+dx,cy-.02,z+.44+dz,.12,.105,.12,rgb(petal));
 cube(dest,x+.462,cy+.025,z+.462,.076,.08,.076,rgb('#d7b77e'));
}
// Partial voxel shapes keep the authored block material and physical AABBs aligned.
export function shapeMesh(dest,id,x,y,z,state){
 const boxes=shapeBoxes(id,x,y,z,state)||[];
 const c=rgb(BLOCKS[id].color);
 for(let index=0;index<boxes.length;index++){
  const b=boxes[index],dx=b.x-x,dy=b.y-y,dz=b.z-z;
  const glass=(id===B.WINDOW_NS||id===B.WINDOW_EW)&&index===0;
  const paint=glass?rgb('#25343b'):c,mat=glass?materialFor(B.DIRTY_GLASS,0):materialFor(id,0);
  for(let fi=0;fi<FACES.length;fi++){
   const face=FACES[fi],verts=face.corners.map(([a,v,t])=>[x+dx+a*b.w,y+dy+v*b.h,z+dz+t*b.d]);
   quad(dest,verts,paint,face.shade+4*(glass?mat:materialFor(id,fi)));
  }
 }
 if(id===B.FLOWER_POT){
  cube(dest,x+.43,y+.33,z+.43,.14,.33,.14,rgb('#608360'));
  cube(dest,x+.36,y+.55,z+.36,.28,.12,.28,rgb('#cf95a7'));
  cube(dest,x+.41,y+.65,z+.41,.18,.08,.18,rgb('#e3c6a4'));
 }
}
