// Common oriented geometry for construction parts. Rendering, picking and
// physical overlap use the same clipped prisms, including 45-degree rotations.
import {partById,partGeometry} from './part-library.js';
const EPS=1e-8;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function clip(poly,axis,limit,keepAbove){
 const out=[];
 const dist=p=>(p[axis]-limit)*(keepAbove?1:-1);
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=dist(a),db=dist(b);
  if(da>=-EPS)out.push(a);
  if((da<-EPS&&db>EPS)||(da>EPS&&db<-EPS)){
   const t=da/(da-db);
   out.push(a.map((q,j)=>q+(b[j]-q)*t));
  }
 }
 return out;
}
function footprint(piece,angle){
 const c=Math.cos(angle),s=Math.sin(angle);
 const points=[[piece.x,piece.z],[piece.x+piece.w,piece.z],
  [piece.x+piece.w,piece.z+piece.d],[piece.x,piece.z+piece.d]];
 let out=points.map(([x,z])=>{
  const a=x-.5,b=z-.5;return [.5+a*c-b*s,.5+a*s+b*c,z];
 });
 for(const [axis,limit,above] of [[0,0,true],[0,1,false],[1,0,true],[1,1,false]]){
  out=clip(out,axis,limit,above);
  if(out.length<3)return [];
 }
 // Deduplicate clipped vertices on exactly intersecting corners.
 return out.filter((v,i)=>!out.slice(0,i).some(p=>Math.hypot(p[0]-v[0],p[1]-v[1])<EPS));
}
export function stairConnections(id,facing,neighborAt){
 const part=partById(id);
 if(part?.family!=='staircase'||(facing&1))return {left:false,right:false};
 const a=(facing>>1)&3;
 const left=[[-1,0],[0,-1],[1,0],[0,1]][a];
 const same=offset=>{
  const other=neighborAt(...offset);
  return partById(other?.id)?.family==='staircase'&&((other.facing||0)&7)===(facing&7);
 };
 return {left:same(left),right:same([-left[0],-left[1]])};
}
export function partPrisms(id,x,y,z,state={}){
 if(!partById(id))return null;
 const angle=(((state.facing||0)%8)+8)%8*Math.PI/4;
 const joined=state.connected||{};
 const pieces=[];
 for(const piece of partGeometry(id)){
  if(piece.railSide&&joined[piece.railSide])continue;
  const points=footprint(piece,angle);
  if(points.length<3)continue;
  const verts=points.map(([a,b,sourceZ])=>{
   const rise=(piece.slopeY||0)*(sourceZ-piece.z)/piece.d;
   return {x:x+a,z:z+b,lo:y+piece.y+rise,hi:y+piece.y+piece.h+rise};
  });
  pieces.push({vertices:verts,material:piece.material,alpha:piece.alpha,solid:piece.solid,
   structural:piece.structural||false,connected:joined,angle});
 }
 return pieces;
}
export function prismFaces(prism){
 const v=prism.vertices,lo=v.map(p=>[p.x,p.lo,p.z]),hi=v.map(p=>[p.x,p.hi,p.z]);
 const faces=[lo,[...hi].reverse()];
 for(let i=0;i<v.length;i++){
  const j=(i+1)%v.length;
  const edge=[lo[i],hi[i],hi[j],lo[j]];
  // Joined stair parts share the outer x=0 or x=1 plane. Eliminate both
  // concealed side faces along with the internal handrail primitives.
  if(prism.structural&&prism.angle%Math.PI/2<EPS){
   const cx=v[i].x,dx=v[j].x,cz=v[i].z,dz=v[j].z;
   const axis=Math.round(prism.angle/(Math.PI/2))&3;
   const isLeft=axis===0?Math.abs(cx-Math.floor(cx))<EPS&&Math.abs(dx-Math.floor(dx))<EPS:
    axis===1?Math.abs(cz-Math.floor(cz))<EPS&&Math.abs(dz-Math.floor(dz))<EPS:
    axis===2?Math.abs(cx-Math.ceil(cx))<EPS&&Math.abs(dx-Math.ceil(dx))<EPS:
    Math.abs(cz-Math.ceil(cz))<EPS&&Math.abs(dz-Math.ceil(dz))<EPS;
   if((prism.connected?.left&&isLeft)||(prism.connected?.right&&isLeft))continue;
  }
  faces.push(edge);
 }
 return faces;
}
export function prismNormal(face){
 const a=face[0],b=face[1],c=face[2],u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
 const d=cross(u,v),len=Math.hypot(...d);
 return len>EPS?d.map(x=>x/len):null;
}
export function prismAabb(prism){
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of prism.vertices){
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
  minY=Math.min(minY,p.lo);maxY=Math.max(maxY,p.hi);
  minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
 }
 return {x:minX,y:minY,z:minZ,w:maxX-minX,h:maxY-minY,d:maxZ-minZ,
  material:prism.material,alpha:prism.alpha,solid:prism.solid};
}
export function partOverlaps(prisms,body,epsilon=1e-5){
 const radius=(body.width||.6)/2,top=body.y+(body.height||1.8),loX=body.x-radius,
 hiX=body.x+radius,loZ=body.z-radius,hiZ=body.z+radius;
 for(const p of prisms||[]){
  if(p.solid===false)continue;
  const bounds=prismAabb(p);
  if(body.y+epsilon>=bounds.y+bounds.h||top-epsilon<=bounds.y||
    hiX-epsilon<=bounds.x||loX+epsilon>=bounds.x+bounds.w||
    hiZ-epsilon<=bounds.z||loZ+epsilon>=bounds.z+bounds.d)continue;
  let overlap=true;
  const poly=p.vertices;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],nx=b.z-a.z,nz=a.x-b.x;
   let min=Infinity,max=-Infinity;
   for(const q of poly){const v=nx*q.x+nz*q.z;min=Math.min(min,v);max=Math.max(max,v)}
   const center=nx*body.x+nz*body.z,r=(Math.abs(nx)+Math.abs(nz))*radius;
   if(center+r-epsilon<=min||center-r+epsilon>=max){overlap=false;break}
  }
  if(overlap)return true;
 }
 return false;
}
export function partRaycast(prisms,origin,direction,maxDistance=Infinity){
 const o=[origin.x,origin.y,origin.z],d=[direction.x,direction.y,direction.z];
 let closest=null;
 for(const prism of prisms||[]){
  let entry=-Infinity,exit=Infinity,normalIn=null,normalOut=null,valid=true;
  for(const f of prismFaces(prism)){
   const normal=prismNormal(f);if(!normal)continue;
   const delta=dot(normal,f[0])-dot(normal,o),rate=dot(normal,d);
   if(Math.abs(rate)<EPS){if(delta<-EPS){valid=false;break}continue}
   const t=delta/rate;
   if(rate<0&&t>entry){entry=t;normalIn=normal}
   if(rate>0&&t<exit){exit=t;normalOut=normal}
   if(entry>exit+EPS){valid=false;break}
  }
  const t=entry>=0?entry:exit,n=entry>=0?normalIn:normalOut;
  if(valid&&t>=0&&t<=maxDistance&&n&&(!closest||t<closest.distance)){
   closest={distance:t,normal:{x:n[0],y:n[1],z:n[2]},
    anchor:{x:o[0]+d[0]*t,y:o[1]+d[1]*t,z:o[2]+d[2]*t}};
  }
 }
 return closest;
}
