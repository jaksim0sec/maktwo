import {SIZE} from '../core/chunk.js';
import {BLOCK as B,block} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {libraryRoofHeight} from '../worldgen/eternal-night-library.js';
import {FAR_LOOK} from './far-look.js';
import {quad,rgb} from './mesher.js';

const NEAR=44, FAR=256, MAX_BUILDINGS=96;
const nearSquared=NEAR**2;
const legacyBuildingMeshes=new WeakMap();
const buildingMeshes=new WeakMap();
const towerMeshes=new WeakMap();
const libraryMeshes=new WeakMap();

export function distantCityMesh(plan,cx,cz,options) {
 const enhanced=options?.enhanced??true;
 const radius=enhanced?FAR_LOOK.middleRadius:FAR;
 const x=(cx+.5)*SIZE,z=(cz+.5)*SIZE;
 const pieces=[];
 const tower=plan.tower, library=plan.library;
 if(tower&&Math.hypot(tower.x-x,tower.z-z)<=radius+tower.radius)
  pieces.push(towerSilhouette(tower));
 if(library&&Math.hypot(library.x-x,library.z-z)<=radius+library.radius)
  pieces.push(librarySilhouette(library));

 const buildings=[];
 for(const volume of plan.volumes){
  const dx=Math.max(volume.x0-x,0,x-volume.x1);
  const dz=Math.max(volume.z0-z,0,z-volume.z1);
  const distance=dx*dx+dz*dz;
  const insideNear=volume.x0>=(cx-2)*SIZE&&volume.x1<=(cx+3)*SIZE
   &&volume.z0>=(cz-2)*SIZE&&volume.z1<=(cz+3)*SIZE;
  if(distance<=radius**2&&(enhanced?!insideNear:distance>=nearSquared))
   buildings.push({volume,distance});
 }
 buildings.sort((a,b)=>a.distance-b.distance);
 let floats=pieces.reduce((sum,piece)=>sum+piece.length,0);
 let covered=radius;
 for(const {volume,distance} of (enhanced?buildings:buildings.slice(0,MAX_BUILDINGS))){
  const cache=enhanced?buildingMeshes:legacyBuildingMeshes;
  let mesh=cache.get(volume);
  if(!mesh){mesh=buildingSilhouette(plan,volume,enhanced);cache.set(volume,mesh)}
  if(enhanced&&floats+mesh.length>FAR_LOOK.middleVertexBudget*7){
   covered=Math.sqrt(distance);
   break;
  }
  pieces.push(mesh);
  floats+=mesh.length;
 }
 if(options)options.coveredRadius=covered;
 const merged=new Float32Array(floats);
 let offset=0;
 for(const piece of pieces){merged.set(piece,offset);offset+=piece.length}
 return merged;
}

export function towerSilhouette(tower){
 let mesh=towerMeshes.get(tower);
 if(mesh)return mesh;
 const vertices=[],color=rgb(block(B.ARCH_STONE_MARBLE).color),sides=48;
 for(let i=0;i<sides;i++){
  const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
  const ax=tower.x+tower.radius*Math.cos(a),az=tower.z+tower.radius*Math.sin(a);
  const bx=tower.x+tower.radius*Math.cos(b),bz=tower.z+tower.radius*Math.sin(b);
  quad(vertices,[[ax,tower.bottom,az],[ax,tower.top,az],[bx,tower.top,bz],[bx,tower.bottom,bz]],color,.78);
 }
 mesh=new Float32Array(vertices);
 towerMeshes.set(tower,mesh);
 return mesh;
}

export function librarySilhouette(library){
 const cached=libraryMeshes.get(library);
 if(cached)return cached;
 const mesh=[],sides=96,rings=12;
 const color=rgb(block(B.ARCH_BRICK_WHITE).color);
 const point=(angle,r,y)=>[library.x+Math.cos(angle)*r,y,library.z+Math.sin(angle)*r];
 for(let side=0;side<sides;side++){
  const a=side*2*Math.PI/sides,b=(side+1)*2*Math.PI/sides;
  const r=library.radius;
  if(side%24!==0&&side%24!==23)
   quad(mesh,[point(a,r,library.base-1),point(a,r,library.eaves),point(b,r,library.eaves),point(b,r,library.base-1)],color,.70);
  for(let ring=0;ring<rings;ring++){
   const inner=library.roofInner+(r-library.roofInner)*ring/rings;
   const outer=library.roofInner+(r-library.roofInner)*(ring+1)/rings;
   const [mx,,mz]=point((a+b)/2,(inner+outer)/2,0);
   if(library.gardens.some(([gx,gz])=>Math.hypot(gx-mx,gz-mz)<library.gardenRadius+2))continue;
   const high=libraryRoofHeight(library,inner),low=libraryRoofHeight(library,outer);
   const face=[point(a,inner,high),point(b,inner,high),point(b,outer,low),point(a,outer,low)];
   quad(mesh,face,color,.86);
   quad(mesh,face.toReversed(),color,.52);
  }
 }
 const result=new Float32Array(mesh);
 libraryMeshes.set(library,result);
 return result;
}

export function shadedWall(mesh,points,color){
 const dx=points[3][0]-points[0][0],dz=points[3][2]-points[0][2];
 const shade=.75+.15*(dz-dx)*Math.SQRT1_2/(Math.hypot(dx,dz)||1);
 for(const i of [0,1,2,0,2,3])mesh.push(...points[i],...color,shade*(i===0||i===3?.74:.98));
}

function buildingSilhouette(plan,v,enhanced){
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
   const wall=[[ax,bottom,az],[ax,top,az],[bx,top,bz],[bx,bottom,bz]];
   if(enhanced){shadedWall(mesh,wall,color);continue}
   quad(mesh,wall,color,.76);
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
   if(!enhanced)mesh.push(center[0],bottom,center[1],...color,.58, ax,bottom,az,...color,.58, bx,bottom,bz,...color,.58);
  }
  first=end;
 }
 return new Float32Array(mesh);
}
