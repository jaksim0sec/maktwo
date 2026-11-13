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
function petal(out,kind,center,scale,angle,color,bright){
 // Variable outline: pink cherry oval, two-lobed ginkgo fan,
 // serrated maple star or an elongated green leaf.
 const corners=kind===0?7:kind===1?9:kind===2?11:7;
 const radius=kind===1?1.13:kind===2?1.18:1;
 const cx=center[0],cy=center[1],cz=center[2];
 const p=[];
 for(let i=0;i<corners;i++){
  const a=i*2*PI/corners,notch=kind===1&&i===0?.52:1;
  const r=radius*(kind===2?(i%2?.45:1):kind===0?.88+.12*Math.sin(a*2):notch);
  const ox=Math.cos(a)*r*scale,oy=Math.sin(a)*r*scale*.75;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  p.push([cx+ox*ca+oy*sa*.18,cy+oy*.84,cz+ox*sa-oy*ca*.18]);
 }
 const shade=bright?-.93:32.9;
 for(let i=0;i<p.length;i++)triangle(out,center,p[i],p[(i+1)%p.length],color,shade,true);
}
function foliageBlob(out,kind,center,radii,palette,random){
 const n=8,rings=[],H=kind===1?1.18:kind===0?.78:1;
 const ys=[-.70,-.31,.27,.67],sizes=[.23,.84,1,.20];
 const jitter=Array.from({length:n},()=>.88+random()*.25);
 for(let ring=0;ring<4;ring++){
  const points=[];
  for(let i=0;i<n;i++){
   const a=2*PI*i/n+Math.sin(i*3.7)*.09,r=sizes[ring]*jitter[i];
   points.push([center[0]+Math.cos(a)*r*radii[0],center[1]+ys[ring]*radii[1]*H,
    center[2]+Math.sin(a)*r*radii[2]]);
  }
  rings.push(points);
 }
 for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){
  const j=(i+1)%n,c=palette[(i+ring*3+Math.floor(random()*3))%palette.length];
  const shine=random()>.72;
  const shade=shine?-.78:32+(.83+.18*random());
  triangle(out,rings[ring][i],rings[ring+1][i],rings[ring+1][j],c,shade);
  triangle(out,rings[ring][i],rings[ring+1][j],rings[ring][j],c,shade);
 }
 for(let k=0;k<2;k++){
  const a=random()*PI*2,reach=.72+.40*random();
  petal(out,kind,[center[0]+Math.cos(a)*radii[0]*reach,center[1]+(random()-.3)*radii[1],
   center[2]+Math.sin(a)*radii[2]*reach],
   .16+.11*random(),a,palette[Math.floor(random()*palette.length)],random()>.3);
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
  triangle(out,c,p0,p1,color,-.84,true);
  triangle(out,c,p1,p2,color,-.76,true);
  triangle(out,c,p2,p3,color,-.78,true);
  triangle(out,c,p3,p0,color,-.85,true);
 }
 const result=new Float32Array(out);
 LEAF_TEMPLATES.set(key,result);return result;
}
export function treeGeometryForBlock(id,variant=0){
 const kind=treeKind(id);
 if(kind<0)return null;
 return isTreeAnchor(id)?treeMesh(kind,variant):leafLitterMesh(kind,variant);
}
