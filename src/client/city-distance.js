import {SIZE} from '../core/chunk.js';
import {BLOCK as B,block} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {quad,rgb} from './mesher.js';

const NEAR=44, FAR=256, MAX_BUILDINGS=96;
const nearSquared=NEAR**2, farSquared=FAR**2;
const buildingMeshes=new WeakMap();
const towerMeshes=new WeakMap();

export function distantCityMesh(plan,cx,cz) {
 const x=(cx+.5)*SIZE,z=(cz+.5)*SIZE;
 const buildings=[];
 for(const volume of plan.volumes){
  const dx=Math.max(volume.x0-x,0,x-volume.x1);
  const dz=Math.max(volume.z0-z,0,z-volume.z1);
  const distance=dx*dx+dz*dz;
  if(distance>=nearSquared&&distance<=farSquared)buildings.push({volume,distance});
 }
 buildings.sort((a,b)=>a.distance-b.distance);
 const pieces=buildings.slice(0,MAX_BUILDINGS).map(({volume})=>{
  let mesh=buildingMeshes.get(volume);
  if(!mesh){mesh=buildingSilhouette(plan,volume);buildingMeshes.set(volume,mesh)}
  return mesh;
 });
 const tower=plan.tower;
 if(tower&&Math.hypot(tower.x-x,tower.z-z)<=FAR+tower.radius){
  let mesh=towerMeshes.get(tower);
  if(!mesh){
   const vertices=[],color=rgb(block(B.ARCH_STONE_MARBLE).color),sides=48;
   for(let i=0;i<sides;i++){
    const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
    const ax=tower.x+tower.radius*Math.cos(a),az=tower.z+tower.radius*Math.sin(a);
    const bx=tower.x+tower.radius*Math.cos(b),bz=tower.z+tower.radius*Math.sin(b);
    quad(vertices,[[ax,tower.bottom,az],[ax,tower.top,az],[bx,tower.top,bz],[bx,tower.bottom,bz]],color,.78);
   }
   mesh=new Float32Array(vertices);
   towerMeshes.set(tower,mesh);
  }
  pieces.push(mesh);
 }
 const merged=new Float32Array(pieces.reduce((length,piece)=>length+piece.length,0));
 let offset=0;
 for(const piece of pieces){merged.set(piece,offset);offset+=piece.length}
 return merged;
}

function buildingSilhouette(plan,v){
 const mesh=[];
 let first=0;
 while(first<v.floors.length){
  const floor=v.floors[first];
  let end=first+1;
  while(end<v.floors.length&&v.floors[end].band===floor.band)end++;
  const outline=floor.outline,bottom=floor.y,top=v.floors[end-1].top;
  const color=rgb(block(plan.details[v.id].kits[first].body).color);
  for(let edge=0;edge<outline.length;edge++){
   const [ax,az]=outline[edge],[bx,bz]=outline[(edge+1)%outline.length];
   quad(mesh,[[ax,bottom,az],[ax,top,az],[bx,top,bz],[bx,bottom,bz]],color,.76);
   const length=Math.hypot(bx-ax,bz-az);
   if(length<6||top-bottom<3||floor.program==='workshops'||hash(v.id,edge,first,plan.layout.seed)>.5)continue;
   // A few emissive apertures sell the scale without adding light sources.
   const nx=(bz-az)/length*.04,nz=(ax-bx)/length*.04;
   const t=.25+hash(v.id,edge,first,41)*.5;
   const px=ax+(bx-ax)*t+nx,pz=az+(bz-az)*t+nz;
   const wx=(bx-ax)/length*.6,wz=(bz-az)/length*.6;
   const py=Math.min(top-1,bottom+(top-bottom)*.58);
   quad(mesh,[[px-wx,py,pz-wz],[px-wx,py+.55,pz-wz],[px+wx,py+.55,pz+wz],[px+wx,py,pz+wz]],[.64,.58,.37],-1);
  }
  // Close the top and underside of each tier so silhouettes survive flying.
  const center=outline.reduce(([sx,sz],[px,pz])=>[sx+px/outline.length,sz+pz/outline.length],[0,0]);
  for(let i=0;i<outline.length;i++){
   const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length];
   mesh.push(center[0],top,center[1],...color,.93, bx,top,bz,...color,.93, ax,top,az,...color,.93);
   mesh.push(center[0],bottom,center[1],...color,.58, ax,bottom,az,...color,.58, bx,bottom,bz,...color,.58);
  }
  first=end;
 }
 return new Float32Array(mesh);
}
