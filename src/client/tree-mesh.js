import {TREE_SPECIES,treeKind,isTreeAnchor} from '../core/tree-assets.js';

// Authored low-poly botanical silhouettes. One anchor emits a complete branching
// tree, never a Minecraft-style log column with a cuboid leaf cap.
// Cached by species + four authored variations; no position-randomized mirroring.
const TREE_TEMPLATES=new Map();
const LEAF_TEMPLATES=new Map();
const PI=Math.PI;
const rgb=hex=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255);
const mulberry=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296};
function triangle(out,a,b,c,color,shade,double=false){
 const write=(p,q,r)=>{out.push(...p,...color,shade,...q,...color,shade,...r,...color,shade)};
 write(a,b,c);if(double)write(a,c,b);
}
function stem(out,from,to,r0,r1,color,seedShade=1){
 const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],len=Math.hypot(dx,dy,dz)||1;
 const d=[dx/len,dy/len,dz/len],other=Math.abs(d[1])>.84?[0,0,1]:[0,1,0];
 const ux=d[1]*other[2]-d[2]*other[1],uy=d[2]*other[0]-d[0]*other[2],uz=d[0]*other[1]-d[1]*other[0];
 const ul=Math.hypot(ux,uy,uz)||1,u=[ux/ul,uy/ul,uz/ul],v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];
 const point=(center,r,i)=>{const a=PI*2*i/7,c=Math.cos(a),s=Math.sin(a);
  return [center[0]+r*(u[0]*c+v[0]*s),center[1]+r*(u[1]*c+v[1]*s),center[2]+r*(u[2]*c+v[2]*s)]};
 for(let i=0;i<7;i++){
  const a=point(from,r0,i),b=point(to,r1,i),c=point(to,r1,i+1),d0=point(from,r0,i+1);
  const sh=24.82+.015*i+(seedShade-1)*.07; // original vertical bark atlas, not grass.
  triangle(out,a,b,c,color,sh,true);triangle(out,a,c,d0,color,sh,true);
 }
}
// Unlit-looking foliage was caused by NEGATIVE vertex shade values, which the
// shared shader interprets as emissive. Every botanical triangle now uses a
// positive, non-emissive shade in [0,1], including fallen leaves.
function petal(out,kind,center,scale,angle,color,shade){
 const c=Math.cos(angle),sn=Math.sin(angle),lift=.16*Math.sin(angle*1.8);
 // Local leaf plane tilts in 3D to reveal alternating surfaces, without disks.
 const at=(dx,dy)=>[center[0]+dx*c-dy*sn*.35,center[1]+dy*.82+dx*lift,
  center[2]+dx*sn+dy*c*.35];
 const base=at(0,0);
 const pair=(a,b)=>triangle(out,base,at(...a),at(...b),color,shade,true);
 if(kind===0){
  // Individual five-point blossoms, with visible spaces between petals.
  for(let j=0;j<5;j++){
   const a=j*2*PI/5+angle*.12;
   pair([Math.cos(a-.31)*scale*.48,Math.sin(a-.31)*scale*.48],
        [Math.cos(a)*scale,Math.sin(a)*scale]);
  }
 }else if(kind===1){
  // Two-lobed ginkgo fan with a notch and radiating fan veins.
  const rim=[[-.35,.18],[-.95,.76],[-.38,1],[0,.68],[.38,1],[.95,.76],[.35,.18]];
  for(let j=0;j<rim.length-1;j++)
   pair(rim[j].map(v=>v*scale),rim[j+1].map(v=>v*scale));
 }else if(kind===2){
  // Five unequal, pointed maple lobes rather than a spherical red surface.
  for(let j=0;j<5;j++){
   const a=j*2*PI/5+angle*.1,reach=(j%2? .78:1.08)*scale;
   pair([Math.cos(a-.32)*reach*.46,Math.sin(a-.32)*reach*.46],
        [Math.cos(a)*reach,Math.sin(a)*reach]);
  }
 }else{
  // Long folded leaves with a narrow attachment and raised central ridge.
  const tip=at(scale*1.25,scale*.25),mid=at(scale*.47,scale*.22);
  const left=at(scale*.49,scale*.59),right=at(scale*.49,-scale*.49);
  triangle(out,base,left,mid,color,shade,true);
  triangle(out,mid,right,tip,color,shade*.92,true);
 }
}
function foliageBlob(out,kind,center,radii,palette,random){
 // Open sprays of separate pointed leaves. No closed oval / ball / spherical shell.
 // Branches remain visible through intentional gaps in the crown.
 const count=kind===0?7:kind===1?7:kind===2?7:11;
 for(let i=0;i<count;i++){
  const spiral=i*2.399963229728653;
  const r=.23+.74*Math.sqrt(random());
  const theta=spiral+(random()-.5)*.58;
  const spread=.36+.64*random();
  const end=[center[0]+Math.cos(theta)*r*radii[0],
   center[1]+(random()-.5)*1.44*radii[1],
   center[2]+Math.sin(theta)*r*radii[2]];
  const join=[center[0]+(end[0]-center[0])*.57,
   center[1]+(end[1]-center[1])*.71,center[2]+(end[2]-center[2])*.57];
  const twig=rgb('#61554d');
  // Slender visible twig, no cylindrical foliage volume.
  const width=.013;
  const left=[join[0]-width,join[1],join[2]],right=[join[0]+width,join[1],join[2]];
  triangle(out,left,end,right,twig,.64,true);
  const leafColor=palette[(i+Math.floor(random()*palette.length))%palette.length];
  petal(out,kind,end,(kind===0?.19:kind===1?.23:kind===2?.22:.26)*spread,
   theta+(random()-.5)*1.1,leafColor,.68+.22*random());
  if(i%5===0){
   const a=theta+1.3,side=[
    join[0]+Math.cos(a)*radii[0]*.21,
    join[1]+radii[1]*.13,
    join[2]+Math.sin(a)*radii[2]*.21];
   petal(out,kind,side,.14+.065*random(),a,palette[(i+2)%palette.length],.62+.20*random());
  }
 }
}
export function treeMesh(kind,variant=0){
 if(kind<0||kind>=TREE_SPECIES.length)throw RangeError('Invalid tree species');
 variant=variant&3;const key=kind*4+variant;
 if(TREE_TEMPLATES.has(key))return TREE_TEMPLATES.get(key);
 const spec=TREE_SPECIES[kind],rand=mulberry(0x19087+kind*7841+variant*331),palette=spec.crown.map(rgb);
 const out=[],bark=rgb(spec.bark),height=spec.height,spread=spec.spread;
 const trunk=[[.5,0,.5]];
 for(let i=1;i<=5;i++){
  const t=i/5,wander=.09*Math.sin(t*5+variant*.83);
  trunk.push([.5+wander+(rand()-.5)*t*.06,height*(.13+i*.13),.5+.07*Math.sin(t*6+kind)+(rand()-.5)*t*.05]);
 }
 for(let i=0;i<5;i++)stem(out,trunk[i],trunk[i+1],
  (.31-i*.042)*(kind===0?1.17:1),Math.max(.074,.28-i*.044),bark);
 // Uneven surface roots radiate from the trunk into broken paving.
 for(let i=0;i<5;i++){
  const a=(i/5)*PI*2+rand()*.4,r=.7+rand()*.30;
  stem(out,[.5, .29,.5],[.5+Math.cos(a)*r,.04,.5+Math.sin(a)*r],.13,.045,bark);
 }
 const clusters=[],branches=kind===1?10:kind===2?11:9;
 for(let i=0;i<branches;i++){
  const a=2*PI*(i/branches)+.36*rand()+kind*.20;
  const t=.46+.24*rand(),base=trunk[Math.min(5,Math.max(2,Math.round(t*5)))];
  const reach=spread*(kind===1?.53+.23*rand():.61+.31*rand());
  const tipHeight=kind===1?height*(.76+.18*rand()):
   kind===0?height*(.63+.14*rand()):kind===2?height*(.66+.18*rand()):height*(.71+.16*rand());
  const mid=[.5+Math.cos(a)*reach*.50,base[1]+(tipHeight-base[1])*.67,.5+Math.sin(a)*reach*.50];
  const tip=[.5+Math.cos(a)*reach,tipHeight,.5+Math.sin(a)*reach];
  stem(out,base,mid,.15,.087,bark);stem(out,mid,tip,.088,.025,bark);
  clusters.push([tip[0],tip[1]+(kind===1?.32:-.02),tip[2],.87+.25*rand()]);
  if(i%2===0){
   const aa=a+(i%4===0?.53:-.42);
   const side=[mid[0]+Math.cos(aa)*.8,mid[1]+.37,mid[2]+Math.sin(aa)*.8];
   stem(out,mid,side,.054,.019,bark);
   clusters.push([...side,.75+.18*rand()]);
  }
 }
 // Crown is intentionally asymmetrical; no uniform leaf cubes or perfect spheres.
 clusters.push([.5,height*.87,.5,1.30]);
 clusters.push([.5+spread*.31,height*.89,.5-spread*.13,1.02]);
 clusters.push([.5-spread*.29,height*.82,.5+spread*.23,1.02]);
 clusters.push([.5+.23,height*.99,.5-.18,kind===1?.84:1.02]);
 for(let i=0;i<clusters.length;i++){
  const [cx,cy,cz,scale]=clusters[i],radius=(.92+.21*rand())*scale;
  const size=kind===1?[.82,1.35,.8]:kind===0?[1.15,.88,1.07]:kind===2?[1.07,1.04,.95]:[1.12,1.02,1.02];
  foliageBlob(out,kind,[cx,cy,cz],size.map(v=>v*radius),palette,rand);
 }
 const result=new Float32Array(out);
 TREE_TEMPLATES.set(key,result);return result;
}
export function leafLitterMesh(kind,variant=0){
 if(kind<0||kind>=TREE_SPECIES.length)throw RangeError('Invalid litter species');
 variant=variant&3;const key=kind*4+variant;
 if(LEAF_TEMPLATES.has(key))return LEAF_TEMPLATES.get(key);
 const out=[],rand=mulberry(7391+kind*1199+variant*251),palette=TREE_SPECIES[kind].litter.map(rgb);
 const count=17+kind*2;
 for(let i=0;i<count;i++){
  const angle=rand()*2*PI,rad=.08+Math.sqrt(rand())*.53;
  const x=.5+Math.cos(angle)*rad,z=.5+Math.sin(angle)*rad,y=.027+i%4*.002;
  const color=palette[Math.floor(rand()*palette.length)];
  const size=(kind===0?.07:kind===1?.092:.09)*(.7+.7*rand());
  // Crinkled fallen leaves lie just above the tile. A tiny rise catches side light.
  const a=rand()*2*PI,dir=[Math.cos(a),Math.sin(a)],orth=[-dir[1],dir[0]],k=kind===2?1.2:1;
  const c=[x,y+.006,z],p0=[x+dir[0]*size*k,y,z+dir[1]*size*k],
    p1=[x+orth[0]*size*.65,y+.01,z+orth[1]*size*.65],
    p2=[x-dir[0]*size*.7,y,z-dir[1]*size*.7],
    p3=[x-orth[0]*size*.60,y+.007,z-orth[1]*size*.60];
  triangle(out,c,p0,p1,color,.74,true);
  triangle(out,c,p1,p2,color,.68,true);
  triangle(out,c,p2,p3,color,.70,true);
  triangle(out,c,p3,p0,color,.72,true);
 }
 const result=new Float32Array(out);
 LEAF_TEMPLATES.set(key,result);return result;
}
export function treeGeometryForBlock(id,variant=0){
 const kind=treeKind(id);
 if(kind<0)return null;
 return isTreeAnchor(id)?treeMesh(kind,variant):leafLitterMesh(kind,variant);
}
