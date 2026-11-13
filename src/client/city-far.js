import {block} from '../core/blocks.js';
import {blueprintCaps,librarySilhouette,sameSilhouetteTier,shadedWall,towerSilhouette} from './city-distance.js';
import {FAR_LOOK} from './far-look.js';
import {quad,rgb} from './mesher.js';

export function cityFarMesh(plan){
 const vertices=[];
 const landmarks=[];
 if(plan.tower)landmarks.push(towerSilhouette(plan.tower));
 if(plan.library)landmarks.push(librarySilhouette(plan.library));
 const landmarkFloats=landmarks.reduce((sum,mesh)=>sum+mesh.length,0);
 const budget=FAR_LOOK.farVertexBudget*7-landmarkFloats;
 const volumes=plan.volumes.toSorted((a,b)=>
  Number(Boolean(b.floors[0].blueprint))-Number(Boolean(a.floors[0].blueprint))||
  (b.x1-b.x0)*(b.z1-b.z0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.z1-a.z0)*(a.y1-a.y0)||a.id-b.id);
 for(const volume of volumes){
  const start=vertices.length;
  const tiers=[];
  for(let first=0;first<volume.floors.length;){
   const floor=volume.floors[first];
   let end=first+1;
   while(sameSilhouetteTier(floor,volume.floors[end]))end++;
   if(floor.plates){
    const bottom=floor.y,top=volume.floors[end-1].top;
    const color=rgb(block(plan.details[volume.id].kits[first].body).color);
    tiers.push({outline:floor.outline,plates:floor.plates,bottom,top,color});
    first=end;
    continue;
   }
   const xs=floor.outline.map(point=>point[0]),zs=floor.outline.map(point=>point[1]);
   const inset=FAR_LOOK.tierInset;
   const bounds=[Math.min(...xs)+inset,Math.min(...zs)+inset,Math.max(...xs)-inset,Math.max(...zs)-inset];
   const top=volume.floors[end-1].top;
   const previous=tiers.at(-1);
   if(previous?.bounds&&previous.bounds.every((value,i)=>Math.abs(value-bounds[i])<=FAR_LOOK.tierMergeTolerance)){
    previous.top=top;
   }else if(bounds[0]<bounds[2]&&bounds[1]<bounds[3]){
    tiers.push({bounds,bottom:floor.y,top,color:rgb(block(plan.details[volume.id].kits[first].body).color)});
   }
   first=end;
  }
  for(const [i,{bounds,outline,plates,bottom,top,color}] of tiers.entries()){
   if(plates){
    for(let edge=0;edge<outline.length;edge++){
     const [ax,az]=outline[edge],[bx,bz]=outline[(edge+1)%outline.length];
     shadedWall(vertices,[[ax,bottom,az],[ax,top,az],[bx,top,bz],[bx,bottom,bz]],color);
    }
    if(i===tiers.length-1||plates!==tiers[i+1].plates)blueprintCaps(vertices,plates,top,color);
    continue;
   }
   const [x0,z0,x1,z1]=bounds;
   const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
   for(let edge=0;edge<4;edge++){
    const [ax,az]=corners[edge],[bx,bz]=corners[(edge+1)%4];
    shadedWall(vertices,[[ax,bottom,az],[ax,top,az],[bx,top,bz],[bx,bottom,bz]],color);
   }
   const next=tiers[i+1]?.bounds;
   if(!next||next[0]>x0||next[1]>z0||next[2]<x1||next[3]<z1)
    quad(vertices,corners.toReversed().map(([x,z])=>[x,top,z]),color,.9);
  }
  if(vertices.length>budget)vertices.length=start;
 }
 const result=new Float32Array(vertices.length+landmarkFloats);
 result.set(vertices);
 let offset=vertices.length;
 for(const mesh of landmarks){result.set(mesh,offset);offset+=mesh.length}
 return result;
}
