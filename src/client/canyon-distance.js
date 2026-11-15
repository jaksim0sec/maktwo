import {BLOCK as B,block} from '../core/blocks.js';
import {SIZE} from '../core/chunk.js';
import {canyonBays} from '../worldgen/canyon-v2-plan.js';
import {canyonCore,coreApproaches} from '../worldgen/canyon-v2-core.js';
import {buildingSilhouette,librarySilhouette,towerSilhouette} from './city-distance.js';
import {cube,quad,rgb} from './mesher.js';

const color=rgb(block(B.CRACKED_CONCRETE).color);
const dark=rgb(block(B.CONCRETE_BEAM).color);
const skins=new WeakMap();
const RADIUS=328;

// Use the same outlines and span endpoints as the collision-bearing voxel plan.
export function distantCanyonMesh(seed,cx,cz,origin,focusY){
 const steps=distantCanyonMeshSteps(seed,cx,cz,origin,focusY);
 let step;
 do{step=steps.next()}while(!step.done);
 return step.value;
}

export function* distantCanyonMeshSteps(seed,cx,cz,origin,focusY){
 const x=(cx+.5)*SIZE,z=(cz+.5)*SIZE,y=origin+focusY;
 const out=[];
 const visible=(bounds,y0,y1)=>{
  const dx=Math.max(bounds.x0-x,0,x-bounds.x1),dz=Math.max(bounds.z0-z,0,z-bounds.z1);
  return dx*dx+dz*dz<RADIUS*RADIUS&&y1>y-300&&y0<y+300;
 };
 const copy=mesh=>{
  for(let i=0;i<mesh.length;i+=7)
   out.push(mesh[i],mesh[i+1]-origin,mesh[i+2],mesh[i+3],mesh[i+4],mesh[i+5],mesh[i+6]);
 };
 const routes=[];
 if(y-300<626&&y+300>0){
  const core=canyonCore(seed),{layout,library,tower,stations}=core;
  if(Math.hypot(x,z)<RADIUS+tower.radius)copy(towerSilhouette(tower));
  if(y-300<library.crown&&Math.hypot(x,z)<RADIUS+library.radius)copy(librarySilhouette(library));
  if(y-300<layout.floorY&&y+300>layout.slabBottom){
   const half=layout.halfWidth,chamfer=layout.diagonalLimit-half;
   const outline=[[half,chamfer],[chamfer,half],[-chamfer,half],[-half,chamfer],
    [-half,-chamfer],[-chamfer,-half],[chamfer,-half],[half,-chamfer]];
   for(let i=0;i<outline.length;i++){
    const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length];
    const y0=layout.slabBottom-origin,y1=layout.floorY-origin;
    quad(out,[[ax,y0,az],[ax,y1,az],[bx,y1,bz],[bx,y0,bz]],dark,.77);
    // The roof of the slab is a fan split away from the central stair shaft.
    const inset=layout.mainShaftRadius/half;
    quad(out,[[ax*inset,y1,az*inset],[bx*inset,y1,bz*inset],[bx,y1,bz],[ax,y1,az]],color,.72);
   }
   for(const site of stations){
    const {x0,x1,z0,z1}=site.bounds;
    if(!visible(site.bounds,site.y-3,site.y+10))continue;
    cube(out,x0,site.y-origin-3,z0,x1-x0,2,z1-z0,color);
    cube(out,x0,site.y-origin+7,z0,x1-x0,2,z1-z0,dark);
    if(site.axis==='x'){
     cube(out,x0,site.y-origin,z0,x1-x0,7,.8,dark);
     cube(out,x0,site.y-origin,z1-.8,x1-x0,7,.8,dark);
    }else{
     cube(out,x0,site.y-origin,z0,.8,7,z1-z0,dark);
     cube(out,x1-.8,site.y-origin,z0,.8,7,z1-z0,dark);
    }
   }
   routes.push(...coreApproaches(core));
  }
 }
 for(const {terraces,buildings,routes:localRoutes} of canyonBays(seed,y-300,600,z-RADIUS,z+RADIUS)){
  yield;
  routes.push(...localRoutes);
  for(const v of buildings){
   if(!visible(v,v.y0,v.y1))continue;
   let mesh=skins.get(v);
   if(!mesh){
    mesh=buildingSilhouette({layout:{seed},details:{[v.id]:v.detail}},v,false);
    skins.set(v,mesh);
   }
   copy(mesh);
   if(v.deckAbove!==undefined){
    const outline=v.roof.outline,wall=rgb(block(v.detail.kits.at(-1).body).color);
    for(let i=0;i<outline.length;i++){
     const [ax,az]=outline[i],[bx,bz]=outline[(i+1)%outline.length];
     quad(out,[[ax,v.y1-origin,az],[ax,v.deckAbove-origin-1,az],
      [bx,v.deckAbove-origin-1,bz],[bx,v.y1-origin,bz]],wall,.76);
    }
   }
  }
  for(const t of terraces){
   if(!visible(t.bounds,t.y-t.thickness,t.y))continue;
   const {x0,x1,z0,z1}=t.bounds;
   const thickness=Math.min(t.thickness,4);
   cube(out,x0,t.y-origin-thickness,z0,x1-x0,thickness,z1-z0,color,.77);
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
 return new Float32Array(out);
}
