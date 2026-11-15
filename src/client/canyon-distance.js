import {BLOCK as B,block} from '../core/blocks.js';
import {SIZE} from '../core/chunk.js';
import {canyonBays} from '../worldgen/canyon-v2-plan.js';
import {buildingSilhouette} from './city-distance.js';
import {cube,quad,rgb} from './mesher.js';

const color=rgb(block(B.CRACKED_CONCRETE).color);
const dark=rgb(block(B.CONCRETE_BEAM).color);
const skins=new WeakMap();
const RADIUS=328;

// Use the same outlines and span endpoints as the collision-bearing voxel plan.
export function distantCanyonMesh(seed,cx,cz,origin,focusY){
 const x=(cx+.5)*SIZE,z=(cz+.5)*SIZE,y=origin+focusY;
 const out=[];
 const visible=(bounds,y0,y1)=>{
  const dx=Math.max(bounds.x0-x,0,x-bounds.x1),dz=Math.max(bounds.z0-z,0,z-bounds.z1);
  return dx*dx+dz*dz<RADIUS*RADIUS&&y1>y-300&&y0<y+300;
 };
 for(const {terraces,buildings,routes} of canyonBays(seed,y-300,600,z-RADIUS,z+RADIUS)){
  for(const v of buildings){
   if(!visible(v,v.y0,v.y1))continue;
   let mesh=skins.get(v);
   if(!mesh){
    mesh=buildingSilhouette({layout:{seed},details:{[v.id]:v.detail}},v,false);
    skins.set(v,mesh);
   }
   for(let i=0;i<mesh.length;i+=7)
    out.push(mesh[i],mesh[i+1]-origin,mesh[i+2],mesh[i+3],mesh[i+4],mesh[i+5],mesh[i+6]);
  }
  for(const t of terraces){
   if(!visible(t.bounds,t.y-42,t.y))continue;
   const {x0,x1,z0,z1}=t.bounds,w=x1-x0,d=z1-z0;
   cube(out,x0,t.y-origin-t.thickness,z0,w,t.thickness,d,color,.77);
   for(let seam=Math.ceil((z0+3)/12)*12;seam<z1-3;seam+=12)
    for(const depth of [.32,.9]){
     const xx=t.side===1?x0+w*depth:x1-w*depth;
     cube(out,xx-2,t.y-origin-t.thickness-21,seam,4,21,3,dark,.76);
    }
  }
  for(const p of routes){
   if(!visible(p.bounds,Math.min(p.ay,p.by)-3,Math.max(p.ay,p.by)+4))continue;
   const a=p.ay-origin,b=p.by-origin,h=p.half+.5;
   const point=(end,side,dy)=>{
    const x=(end?p.bx:p.ax)+.5-p.dz*h*side,z=(end?p.bz:p.az)+.5+p.dx*h*side;
    return [x,(end?b:a)+dy,z];
   };
   for(const side of [-1,1])
    quad(out,[point(false,side,0),point(true,side,0),point(true,side,-2),point(false,side,-2)],dark,.75);
   for(const dy of [-2,0])
    quad(out,[point(false,-1,dy),point(false,1,dy),point(true,1,dy),point(true,-1,dy)],color,.78);
   if(p.kind==='concourse'){
    quad(out,[point(false,-1,4),point(false,1,4),point(true,1,4),point(true,-1,4)],color,.85);
    const panes=rgb(block(B.DIRTY_GLASS).color);
    for(const side of [-1,1]){
     quad(out,[point(false,side,.25),point(true,side,.25),point(true,side,3.8),point(false,side,3.8)],panes,.76);
     const post=dy=>point(false,side,dy);
     const [x0,y0,z0]=post(.3);
     for(let i=8;i<p.length-4;i+=9)
      cube(out,x0+p.dx*i-.22,y0+(b-a)*i/p.length,z0+p.dz*i-.22,.44,3.4,.44,dark);
    }
   }
  }
 }
 return new Float32Array(out);
}
