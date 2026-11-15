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
const mixPoint=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const length=Math.hypot(...v)||1;return v.map(n=>n/length);};
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);

function branchTube(out,path,radii,color,sides=6,phase=0){
 const axis=unit(subtract(path.at(-1),path[0]));
 const guide=Math.abs(axis[1])>.72?[0,0,1]:[0,1,0];
 // Each bend has a shared tapered ring, so the bark continues through forks.
 const rings=path.map((point,i)=>{
  const tangent=unit(subtract(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));
  const u=unit(cross(guide,tangent)),v=cross(tangent,u);
  return Array.from({length:sides},(_,j)=>{
   const angle=j*2*PI/sides+phase;
   const radius=radii[i]*(1+.12*Math.sin(j*2.1+phase)+.10*(i===0)*Math.cos(j*3.7));
   return point.map((p,k)=>p+radius*(u[k]*Math.cos(angle)+v[k]*Math.sin(angle)));
  });
 });
 for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){
  const k=(j+1)%sides,shade=24.73+.15*(1+Math.sin(j*2*PI/sides+phase))*.5;
  triangle(out,rings[i-1][j],rings[i-1][k],rings[i][k],color,shade);
  triangle(out,rings[i-1][j],rings[i][k],rings[i][j],color,shade);
 }
}

function foldedLeaf(out,base,angle,length,width,lift,color,shade){
 const dx=Math.cos(angle),dz=Math.sin(angle),[x,y,z]=base;
 const tip=[x+dx*length,y+lift,z+dz*length];
 const joint=[x+dx*length*.48,y+lift*.45,z+dz*length*.48];
 const ridge=[joint[0],joint[1]+width*.37,joint[2]];
 const left=[joint[0]-dz*width,joint[1],joint[2]+dx*width];
 const right=[joint[0]+dz*width,joint[1]-width*.19,joint[2]-dx*width];
 triangle(out,base,left,ridge,color,shade,true);
 triangle(out,left,tip,ridge,color,shade,true);
 triangle(out,ridge,tip,right,color,shade*.85,true);
 triangle(out,base,ridge,right,color,shade*.85,true);
}

function foliageSpray(out,from,to,angle,kind,palette,bark,rand){
 // Leaves hang from staggered points on a real twig. There are holes between sprays.
 const bend=mixPoint(from,to,.58);bend[1]+=.13;
 branchTube(out,[from,bend,to],[.024,.013,.004],bark,3,angle);
 const count=kind===1?7:6;
 for(let i=0;i<count;i++){
  const t=(i+.65)/count;
  const base=t<.58?mixPoint(from,bend,t/.58):mixPoint(bend,to,(t-.58)/.42);
  const length=(.41+rand()*.18)*(.85+.20*Math.sin(t*PI));
  const width=length*[.40,.36,.32,.25][kind];
  const side=i%2?1:-1;
  foldedLeaf(out,base,angle+side*(.56+.68*rand()),length,width,(rand()-.65)*.37,
   palette[Math.floor(rand()*palette.length)],.64+.25*rand());
 }
}

export function treeMesh(kind,variant=0){
 if(kind<0||kind>=TREE_SPECIES.length)throw RangeError('Invalid tree species');
 variant=variant&3;const key=kind*4+variant;
 if(TREE_TEMPLATES.has(key))return TREE_TEMPLATES.get(key);
 const spec=TREE_SPECIES[kind],rand=mulberry(0x19087+kind*7841+variant*331),palette=spec.crown.map(rgb);
 const out=[],bark=rgb(spec.bark),h=spec.height,spread=spec.spread;
 const turn=rand()*2*PI,wind=kind===1?.41:.66;
 const trunk=[[.5,.01,.5],[.46,.46,.53],[.54+Math.cos(turn)*wind*.58,h*.30,.52+Math.sin(turn)*wind*.58],
  [.5+Math.cos(turn)*wind,h*.49,.5+Math.sin(turn)*wind],
  [.48+Math.cos(turn+.66)*wind,h*.66,.53+Math.sin(turn+.66)*wind],
  [.65+Math.cos(turn+1)*wind,h*[.91,.94,.93,.95][kind],.5+Math.sin(turn+1)*wind]];
 branchTube(out,trunk,[.36,.245,.196,.145,.098,.022],bark,8,turn);
 for(let i=0;i<4;i++){
  const a=turn+i*2*PI/4+rand()*.59,r=.63+rand()*.41;
  const root=[.5+Math.cos(a)*r,.033,.5+Math.sin(a)*r];
  branchTube(out,[[.5,.23,.5],mixPoint([.5,.14,.5],root,.54),root],[.16,.103,.025],bark,5,a);
 }
 const limbs=kind===1?7:6;
 for(let i=0;i<limbs;i++){
  const t=i/(limbs-1),a=turn+i*2.399963+(rand()-.5)*.57;
  const start=i===limbs-1?trunk[4]:mixPoint(trunk[i<2?2:3],trunk[i<2?3:4],.17+.60*rand());
  const broad=kind===1?.56:1;
  const reach=spread*broad*(.58+.23*rand())*(1-.33*t);
  const endY=i===limbs-1?h*.96:h*(.62+.26*t+.048*rand());
  const joint=[start[0]+Math.cos(a-.14)*reach*.52,start[1]+(endY-start[1])*.55,start[2]+Math.sin(a-.14)*reach*.52];
  const tip=[start[0]+Math.cos(a)*reach,endY,start[2]+Math.sin(a)*reach];
  branchTube(out,[start,mixPoint(start,joint,.48),joint,tip],[.112-.049*t,.094-.042*t,.064-.031*t,.018],bark,6,a);
  for(let j=0;j<3;j++){
   const root=j===2?mixPoint(joint,tip,.77):mixPoint(start,joint,.69+j*.24);
   const angle=a+(j===2?.12:j?-.67:.88)+(rand()-.5)*.48;
   const length=.40+rand()*.48;
   const knee=[root[0]+Math.cos(angle)*length,root[1]+.17+rand()*.31,root[2]+Math.sin(angle)*length];
   branchTube(out,[root,mixPoint(root,knee,.53),knee],[.044,.031,.015],bark,4,angle);
   if((i*3+j+variant)%11===4)continue; // A few dry tips survive between live clusters.
   for(let k=0;k<2;k++){
    const aim=angle+(k?-.68:.50)+(rand()-.5)*.24;
    const reach=.54+rand()*.49;
    const end=[knee[0]+Math.cos(aim)*reach,knee[1]+(kind===1?.21:.06)-rand()*.28,knee[2]+Math.sin(aim)*reach];
    foliageSpray(out,knee,end,aim,kind,palette,bark,rand);
   }
  }
 }
 const result=new Float32Array(out);
 TREE_TEMPLATES.set(key,result);return result;
}

const GROWTH_TEMPLATES=new Map();
export function dampGrowthMesh(style,variation){
 const sprout=Boolean(style&1),key=(sprout?4:0)+Math.min(3,Math.floor(variation*4));
 if(GROWTH_TEMPLATES.has(key))return GROWTH_TEMPLATES.get(key);
 const out=[],random=mulberry(7793+key*1001);
 const colors=['#425043','#566248','#5f6347','#666451'].map(rgb);
 const center=[.18+random()*.41,.012,.26+random()*.44];
 for(let i=0;i<11;i++){
  const angle=random()*PI*2,r=.025+random()*.23;
  const x=center[0]+Math.cos(angle)*r,z=center[2]+Math.sin(angle)*r,y=center[1]+i*.0006;
  const width=.034+random()*.07;
  const tip=[x+Math.cos(angle)*width,y+.004,z+Math.sin(angle)*width];
  const root=[x-Math.cos(angle)*width*.84,y,z-Math.sin(angle)*width*.84];
  const c=colors[i%4];
  triangle(out,root,tip,[x+Math.sin(angle)*width,y+.016,z-Math.cos(angle)*width],c,.76,true);
  triangle(out,tip,root,[x-Math.sin(angle)*width*.74,y+.009,z+Math.cos(angle)*width*.74],c,.83,true);
 }
 if(sprout)for(let i=0;i<5;i++){
  const angle=random()*PI*2,length=.08+random()*.14;
  const root=[center[0]+Math.cos(angle)*.021,.025,center[2]+Math.sin(angle)*.021];
  foldedLeaf(out,root,angle,length,.012+random()*.022,.08+random()*.16,colors[(i+2)%4],.87);
 }
 const mesh=new Float32Array(out);GROWTH_TEMPLATES.set(key,mesh);return mesh;
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
