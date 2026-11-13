// A compact, occlusion-aware voxel light volume. Pure code, safe to run in a Worker.
import {BLOCK as B,BLOCKS} from './blocks.js';
import {SIZE} from './chunk.js';

const OPAQUE=BLOCKS.map(block=>block.opaque);
const SKY_BLOCKER=BLOCKS.map(block=>block.opaque||block.render==='slab'||block.render==='panel'||
 block.id===B.PART_WALL_1||block.id===B.PART_WALL_2||block.id===B.PART_WALL_3||block.id===B.PART_WALL_4||block.id===B.PART_WALL_5);
const LIGHT_CURVE=Uint8Array.from({length:256},(_,i)=>Math.round(255*(1-Math.exp(-1.18*i/128))));
// X is the fastest axis; the buffer is directly uploadable to WebGL2 TEXTURE_3D.
export const LIGHT_WIDTH=48, LIGHT_HEIGHT=32, LIGHT_DEPTH=48;
const STEPS=[];
for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
 if(!dx&&!dy&&!dz)continue;
 STEPS.push({dx,dy,dz,cost:Math.hypot(dx,dy,dz),diagonal:Number(Boolean(dx))+Number(Boolean(dy))+Number(Boolean(dz))>1});
}
class Heap {
 constructor(){this.a=[]}
 push(i,d){const a=this.a;let n=a.length;a.push([i,d]);while(n){const p=(n-1)>>1;if(a[p][1]<=d)break;a[n]=a[p];n=p}a[n]=[i,d]}
 pop(){const a=this.a,root=a[0],last=a.pop();if(a.length){let i=0;while(true){let j=i*2+1;if(j>=a.length)break;if(j+1<a.length&&a[j+1][1]<a[j][1])j++;if(a[j][1]>=last[1])break;a[i]=a[j];i=j}a[i]=last}return root}
 get length(){return this.a.length}
}
// Solid voxels block light but can still receive it on the illuminated exterior face.
// Light samples belong to the AIR cell adjacent to a visible face, never the wall.
export function buildLightVolume(occluders,sources,{width=LIGHT_WIDTH,height=LIGHT_HEIGHT,depth=LIGHT_DEPTH,origin=[0,0,0],skyTop=null}={}){
 const total=width*height*depth;
 if(occluders.length!==total)throw Error('Light volume dimensions mismatch');
 // Bit 1 marks lamp blockers; bit 2 adds thin surfaces that block daylight.
 const sky=skyTop?buildSkylight(occluders,skyTop,width,height,depth):null;
 if(sky)occluders=occluders.map(cell=>cell&1);
 const output=new Uint8Array(total*4),dist=new Float32Array(total),stamp=new Uint16Array(total);
 let sourceStamp=0;
 const plane=width*height;
 const inside=(x,y,z)=>x>=0&&x<width&&y>=0&&y<height&&z>=0&&z<depth;
 const at=(x,y,z)=>(z*height+y)*width+x;
 for(const src of sources){
  const sx=Math.floor(src.x-origin[0]),sy=Math.floor(src.y-origin[1]),sz=Math.floor(src.z-origin[2]);
  if(!inside(sx,sy,sz))continue;
  const first=at(sx,sy,sz);
  if(occluders[first])continue;
  const radius=Math.min(22,Math.max(1,src.radius));
  const tint=src.rgb||[1,.58,.29],energy=src.intensity||1;
  const mark=++sourceStamp;stamp[first]=mark;dist[first]=0;
  const heap=new Heap();heap.push(first,0);
  while(heap.length){
   const [index,cost]=heap.pop();if(cost>dist[index]+1e-4||cost>=radius)continue;
   const x=index%width,y=Math.floor(index/width)%height,z=Math.floor(index/plane);
   const k=index*4;
   const fraction=cost/radius,fade=(1-fraction*fraction)**2, power=128*energy*fade;
   for(let channel=0;channel<3;channel++)output[k+channel]=Math.max(output[k+channel],Math.min(255,Math.round(tint[channel]*power)));
   for(const step of STEPS){
    const xx=x+step.dx,yy=y+step.dy,zz=z+step.dz,dd=cost+step.cost;
    if(dd>radius||!inside(xx,yy,zz))continue;
    const ni=at(xx,yy,zz);if(occluders[ni])continue;
    if(step.diagonal){
     // Disallow rays slipping between touching solid voxels or through a corner.
     if((step.dx&&occluders[at(x+step.dx,y,z)])||(step.dy&&occluders[at(x,y+step.dy,z)])||(step.dz&&occluders[at(x,y,z+step.dz)]))continue;
     if(step.dx&&step.dy&&occluders[at(x+step.dx,y+step.dy,z)])continue;
     if(step.dx&&step.dz&&occluders[at(x+step.dx,y,z+step.dz)])continue;
     if(step.dy&&step.dz&&occluders[at(x,y+step.dy,z+step.dz)])continue;
    }
    if(stamp[ni]!==mark||dd+.0001<dist[ni]){stamp[ni]=mark;dist[ni]=dd;heap.push(ni,dd)}
   }
  }
 }
 // Brightness is the MAXIMUM nearby emitter, not a sum. Adding lamps extends coverage, not peak intensity.
 for(let i=0;i<total;i++){
  for(let k=0;k<3;k++)output[i*4+k]=LIGHT_CURVE[output[i*4+k]];
  output[i*4+3]=occluders[i]?0:sky?Math.max(1,sky[i]):255;
 }
 return output;
}
function buildSkylight(blocks,skyTop,width,height,depth){
 const sky=new Uint8Array(blocks.length),queue=new Uint32Array(blocks.length);
 const stride=width*height;
 let count=0;
 for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
  if(!skyTop[z*width+x])continue;
  for(let y=height-1;y>=0;y--){
   const index=z*stride+y*width+x;
   if(blocks[index])break;
   sky[index]=255;queue[count++]=index;
  }
 }
 // Equal cost steps let each cell enter the queue once. Daylight spills a
 // short way around openings, with no light leaking diagonally through walls.
 const spread=(index,level)=>{
  if(blocks[index]||sky[index])return;
  sky[index]=level;queue[count++]=index;
 };
 for(let read=0;read<count;read++){
  const i=queue[read],level=sky[i]-31;
  if(level<=0)break;
  const x=i%width,y=Math.floor(i/width)%height,z=Math.floor(i/stride);
  if(x>0)spread(i-1,level);
  if(x+1<width)spread(i+1,level);
  if(y>0)spread(i-width,level);
  if(y+1<height)spread(i+width,level);
  if(z>0)spread(i-stride,level);
  if(z+1<depth)spread(i+stride,level);
 }
 return sky;
}

export function makeDaylightSnapshot(world,origin){
 const skyTop=new Uint8Array(LIGHT_WIDTH*LIGHT_DEPTH);
 const blocks=makeOccluderSnapshot(world,origin,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,skyTop);
 return {blocks,skyTop};
}

export function makeOccluderSnapshot(world,origin,width=LIGHT_WIDTH,height=LIGHT_HEIGHT,depth=LIGHT_DEPTH,skyTop=null){
 const data=new Uint8Array(width*height*depth);
 const [ox,oy,oz]=origin;
 // Only loaded chunks are sampled: never generate terrain for a lighting update.
 for(const chunk of world.chunks.values()){
  const cx=chunk.cx*SIZE,cz=chunk.cz*SIZE;
  const x0=Math.max(0,ox-cx),x1=Math.min(SIZE,ox+width-cx);
  const z0=Math.max(0,oz-cz),z1=Math.min(SIZE,oz+depth-cz);
  const y0=Math.max(0,oy),y1=Math.min(chunk.height,oy+height);
  if(x0>=x1||z0>=z1||y0>=y1)continue;
  if(skyTop){
   for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
    let open=true;
    for(let y=y1;y<chunk.height;y++){
     const id=chunk.data[(y*SIZE+z)*SIZE+x];
     if(SKY_BLOCKER[id]){open=false;break}
    }
    skyTop[(cz+z-oz)*width+cx+x-ox]=Number(open);
   }
  }
  for(let z=z0;z<z1;z++)for(let y=y0;y<y1;y++){
   const src=(y*SIZE+z)*SIZE;
   const dst=((cz+z-oz)*height+y-oy)*width+cx-ox;
   for(let x=x0;x<x1;x++){
    const idx=src+x,id=chunk.data[idx];
    if(id===B.DOOR||id===B.DOOR_TOP)data[dst+x]=Number(world.isLightBlocking(id,cx+x,y,cz+z,0));
    else if(OPAQUE[id]&&!chunk.forms?.[idx])data[dst+x]=1;
    if(skyTop&&SKY_BLOCKER[id])data[dst+x]|=2;
   }
  }
 }
 return data;
}
