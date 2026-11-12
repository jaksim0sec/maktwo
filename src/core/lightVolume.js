// A compact, occlusion-aware voxel light volume. Pure code, safe to run in a Worker.
// X is the fastest axis; the buffer is directly uploadable to WebGL2 TEXTURE_3D.
export const LIGHT_WIDTH=80, LIGHT_HEIGHT=64, LIGHT_DEPTH=80;
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
export function buildLightVolume(occluders,sources,{width=LIGHT_WIDTH,height=LIGHT_HEIGHT,depth=LIGHT_DEPTH,origin=[0,0,0]}={}){
 const total=width*height*depth;
 if(occluders.length!==total)throw Error('Light volume dimensions mismatch');
 const output=new Uint8Array(total*4),colors=new Float32Array(total*3),dist=new Float32Array(total),stamp=new Uint16Array(total);
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
   const k=index*3;
   const fraction=cost/radius,fade=(1-fraction*fraction)**2, power=energy*fade;
   colors[k]+=tint[0]*power;colors[k+1]+=tint[1]*power;colors[k+2]+=tint[2]*power;
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
 // Smooth highlight compression: overlapping lights do not bleach bright tiles.
 for(let i=0;i<total;i++){
  for(let k=0;k<3;k++)output[i*4+k]=Math.round(255*(1-Math.exp(-1.18*colors[i*3+k])));
  output[i*4+3]=255;
 }
 return output;
}
export function makeOccluderSnapshot(world,origin,width=LIGHT_WIDTH,height=LIGHT_HEIGHT,depth=LIGHT_DEPTH){
 const data=new Uint8Array(width*height*depth);
 const [ox,oy,oz]=origin;
 // Only loaded chunks are sampled: never generate terrain for a lighting update.
 for(const chunk of world.chunks.values()){
  const cx=chunk.cx*16,cz=chunk.cz*16;
  if(cx+16<=ox||cx>=ox+width||cz+16<=oz||cz>=oz+depth)continue;
  for(let z=Math.max(0,oz-cz);z<Math.min(16,oz+depth-cz);z++)for(let y=Math.max(0,oy);y<Math.min(64,oy+height);y++)for(let x=Math.max(0,ox-cx);x<Math.min(16,ox+width-cx);x++){
   const id=chunk.data[(y*16+z)*16+x];
   // Avoid importing the block registry into the Worker payload.
   if(world.isLightBlocking(id,cx+x,y,cz+z))data[(((cz+z-oz)*height)+(y-oy))*width+(cx+x-ox)]=1;
  }
 }
 return data;
}
