// Physically motivated, deterministic micro-art for the highest-visibility 32px finishes.
// Generated once when the RGBA8 texture array is uploaded. No per-frame noise or textures.
// Returns relative pigments: the renderer still owns each block's authored base color.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sm=(a,b,t)=>{t=clamp((t-a)/(b-a));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const mod=(a,n)=>(a%n+n)%n;
function hash(x,y,s){
 let n=Math.imul((x|0)+71,374761393)^Math.imul((y|0)+53,668265263)^Math.imul((s|0)+13,2246822519);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
function noise(x,y,s){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 return mix(mix(hash(ix,iy,s),hash(ix+1,iy,s),sx),mix(hash(ix,iy+1,s),hash(ix+1,iy+1,s),sx),sy);
}
function fbm(x,y,s){return noise(x,y,s)*.58+noise(x*2.09+3.7,y*2.09-2.9,s+11)*.29+noise(x*4.17-5.1,y*4.17+7.4,s+19)*.13}
const edge=(p,t,w=1)=>1-sm(t,t+w,p);
function nearestLine(u,v,points){
 let d=100;for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
  const k=clamp(((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy),0,1);
  d=Math.min(d,Math.hypot(u-a[0]-dx*k,v-a[1]-dy*k));
 }return d;
}
function pigment(l=1,r=1,g=1,b=1){return [clamp(l,.24,1.28),clamp(r,.72,1.3),clamp(g,.68,1.3),clamp(b,.66,1.3)]}
// Domain-warped deposition. Smooth low-frequency contours, then small porous margins.
function deposits(u,v,seed,gravity=.2){
 const w=noise(u*.13+2,v*.10,seed+41)-.5;
 const q=fbm((u+w*5)*.125,v*.105,seed+47);
 const cluster=sm(.40,.67,q+gravity*sm(8,31,v));
 const streak=noise(u*.28+1.8*w,v*.045,seed+63)*.7+noise(u*.11,v*.16,seed+64)*.3;
 return clamp(cluster*.8+sm(.55,.78,streak)*gravity*.55);
}
function fracture(u,v,seed,w=16,h=16){
 // Rare, discontinuous glaze hairlines inside individual cells, not repeated Y graffiti.
 const col=Math.floor(u/w),row=Math.floor(v/h);
 const chance=hash(col,row,seed+37);
 if(chance>.24)return 0;
 const lx=mod(u,w),ly=mod(v,h),t=ly/h;
 const phase=hash(col+5,row-7,seed+38)*6.283;
 const center=w*(.24+.49*t)+Math.sin(t*4+phase)*.66+(noise(lx*.23,ly*.26,seed+39)-.5)*1.15;
 const taper=sm(.09,.26,t)*(1-sm(.79,.94,t));
 const interrupted=sm(.32,.48,noise(lx*.21,ly*.20,seed+40));
 return (1-sm(.21,.73,Math.abs(lx-center)))*taper*interrupted*.63;
}
function tile(u,v,w,h,seed,erosion=.12){
 const px=mod(u,w),py=mod(v,h),cx=Math.floor(u/w),cy=Math.floor(v/h),texel=hash(cx,cy,seed);
 const seam=Math.min(px,py),near=1-sm(.1,2.3,seam);
 const joint=edge(px,.58,.6)+edge(py,.58,.6);
 const chip=erosion*sm(.57,.85,fbm(u*.31,v*.31,seed+81))*(.45+.55*near);
 const bevel=sm(.50,1.55,seam)-sm(w-1.55,w-.50,px)*.035;
 const light=1-.33*clamp(joint)-.11*near+(.055+.018*texel)*bevel-chip;
 return {light,px,py,texel,seam,near,joint:clamp(joint)};
}
function brick(u,v,w,h,seed){
 const row=Math.floor(v/h),shift=(row&1)*w/2,px=mod(u+shift,w),py=mod(v,h);
 const j=Math.min(px,py,w-px,h-py),brickHash=hash(Math.floor((u+shift)/w),row,seed);
 const joint=1-sm(.4,1.35,j),rim=sm(.1,1.7,j)*(1-sm(2.5,4,j));
 const erode=sm(.58,.79,fbm(u*.33,v*.31,seed+5))*rim;
 return {light:1-.34*joint-.10*(1-sm(.4,2,j))-.15*erode+.05*rim,brickHash,joint,erode};
}
function grain(u,v,seed){
 const bend=(noise(u*.13,v*.16,seed+14)-.5)*3.6;
 const long=Math.sin((v+bend)*.9+noise(u*.09,v*.11,seed+15)*3);
 return .45+.28*long+.27*noise(u*.28,v*.09,seed+16);
}
function metal(u,v,seed,old=false){
 const brush=(noise(u*.95,v*.11,seed+9)-.5)*.09+Math.sin(v*2.5+noise(u*.09,v*.23,seed+11)*4)*.022;
 const scratch=sm(.81,.94,noise(u*.26,v*.045,seed+21))*sm(.38,.70,noise(u*.12,v*.20,seed+22));
 const corrosion=deposits(u,v,seed+37,.36)*(.35+.65*sm(.43,.64,fbm(u*.18,v*.16,seed+39)));
 return {l:.94+brush-scratch*.11-(old?corrosion*.24:corrosion*.03),scratch,corrosion};
}
function ceramic(u,v,w,h,seed,old=.2){
 const t=tile(u,v,w,h,seed,old*.26),wash=deposits(u,v,seed+1,old*.48);
 const gloss=.035*sm(.1,2.1,t.px)*sm(.2,1.6,t.py);
 const chip=(1-sm(.35,1.6,t.seam))*sm(.72,.9,fbm(u*.43,v*.37,seed+61))*.22;
 return {t,wash,l:t.light+gloss-old*.28*wash-chip,chip};
}
function stone(u,v,seed,kind){
 const x=u*.22,y=v*.22;
 const field=fbm(x,y,seed+3),finer=fbm(x*2.4,y*2.4,seed+5),mineral=sm(.59,.76,field)*sm(.51,.70,finer);
 const pores=sm(.75,.90,noise(u*.75,v*.74,seed+39));
 const pitting=sm(.65,.82,fbm(u*.40,v*.40,seed+42));
 let l=.91+.26*(field-.5)+.10*(finer-.5)-.12*pores-.14*pitting;
 if(kind==='marble'){
  const warp=(noise(u*.10,v*.11,seed+51)-.5)*8+(noise(u*.24,v*.17,seed+52)-.5)*3;
  const ridge=Math.sin((u*.47-v*.34+warp)*.76);
  const vein=1-sm(.06,.25,Math.abs(ridge));
  const halo=1-sm(.17,.52,Math.abs(ridge));
  l=.98+.10*(field-.5)-.24*vein-.055*halo-.045*mineral;
  return {l,vein,field,mineral};
 }
 if(kind==='limestone')l=.96+.16*(field-.5)-.15*pores-.12*pitting;
 return {l,vein:0,field,mineral};
}
function concrete(u,v,seed,mode){
 const base=stone(u,v,seed,'concrete'),dirt=deposits(u,v,seed+4,mode==='damaged'?.32:.20);
 const pits=sm(.70,.90,noise(u*.68,v*.65,seed+21));
 const cracks=mode==='damaged'?fracture(u,v,seed+3):0;
 return {l:.94+(base.l-.9)*.60-.15*dirt-.10*pits-.40*cracks,cracks,dirt,pits};
}
function plaster(u,v,seed,mold=false){
 const wash=deposits(u,v,seed,.42),flaking=sm(.53,.69,fbm(u*.16,v*.18,seed+61)+.11*noise(u*.62,v*.58,seed+64));
 const exposed=sm(.58,.79,fbm(u*.21,v*.23,seed+67))*(.35+.65*wash);
 const rim=(sm(.47,.52,flaking)-sm(.73,.83,flaking))*.20;
 const moldGrowth=mold?deposits(u+2,v,seed+91,.24)*flaking:0;
 return {l:.97-.20*wash-.18*flaking-.21*exposed-.17*moldGrowth+.07*rim,wash,flaking,exposed,moldGrowth};
}
function floorwear(u,v,seed){
 const abrasion=sm(.57,.74,fbm(u*.19,v*.26,seed+18));
 const skids=sm(.72,.88,noise(u*.41,v*.09,seed+19))*sm(.43,.73,noise(u*.12,v*.17,seed+20));
 return clamp(.68*abrasion+.32*skids);
}
const BASE=new Set([22,23,24,25,26,27,28,29,32,34,37,38]);
const ARCH=new Set([0,2,4,9,11,14,27,29]);
const STATION=new Set([4,5,6,7,8,9,19]);
export const hasDetailedMaterial=(group,index)=>group==='base'?BASE.has(index):group==='architecture'?ARCH.has(index):group==='station'?STATION.has(index):group==='extra'?index>=0&&index<4:false;

export function sampleDetailedMaterial(group,index,x,y,size=32){
 if(!hasDetailedMaterial(group,index))return null;
 const u=x*32/size+.5,v=y*32/size+.5,seed=31+index*47+(group==='station'?1201:group==='architecture'?509:group==='extra'?2501:0);
 const fine=noise(u*.86,v*.79,seed+8),mid=fbm(u*.32,v*.28,seed+9);
 let l=.93+.13*(mid-.5)+.055*(fine-.5),r=1,g=1,b=1;
 if(group==='base')switch(index){
  case 22:case 23:{const p=concrete(u,v,seed,index===23?'damaged':'plain');l=p.l;r=.98-.035*p.dirt;g=.99;b=1.015+.03*p.pits;break;}
  case 24:case 34:{const p=plaster(u,v,seed,index===34);l=p.l;r=1-.21*p.moldGrowth+.03*p.flaking;g=.985+.025*p.moldGrowth;b=.955-.19*p.moldGrowth;break;}
  case 25:case 37:case 38:{const t=ceramic(u,v,index===38?8:16,index===38?8:16,seed,index===37?.72:.38);const wear=floorwear(u,v,seed);l=t.l-.10*wear;r=1-.035*t.wash;g=.99+.035*(1-wear);b=1.01+.04*t.wash; if(index===37)l-=.10*deposits(u,v,seed+55,.48);break;}
  case 26:{const t=tile(u,v,16,16,seed,.045),dust=deposits(u,v,seed+30,.16);l=t.light-.08*dust;r=1;g=1;b=1.015;break;}
  case 27:case 28:{const p=metal(u,v,seed,index===28);l=p.l;r=.96+.19*p.corrosion;g=1-.16*p.corrosion;b=1.025-.22*p.corrosion;break;}
  case 29:{const grime=deposits(u,v,seed,.22),finger=sm(.69,.82,noise(u*.19,v*.22,seed+35));l=.99-.22*grime-.10*finger;r=.94;g=1.015;b=1.035;break;}
  case 32:{const p=brick(u,v,16,8,seed),stain=deposits(u,v,seed+16,.25);l=p.light+(.20*(p.brickHash-.5))-.15*stain;r=1.05+.07*(p.brickHash-.5);g=.94-.06*stain;b=.9-.04*stain;break;}
  default:break;
 }else if(group==='architecture')switch(index){
  case 0:case 2:{const p=ceramic(u,v,index===0?8:16,index===0?16:16,seed,.22);l=p.l;r=1.02-.025*p.wash;g=1.015;b=.98+.03*p.wash;break;}
  case 4:{const p=ceramic(u,v,16,8,seed,.23),crack=fracture(u,v,seed,16,8);l=p.l-.17*crack;r=1.005;g=1.01;b=.985;break;}
  case 9:{const p=stone(u,v,seed,'marble');l=p.l;r=.99-.055*p.vein;g=1.0-.015*p.vein;b=1.01+.025*p.vein;break;}
  case 11:{const p=plaster(u,v,seed,false);l=.97+.55*(p.l-.95);r=1.015;g=1;b=.97;break;}
  case 14:{const p=concrete(u,v,seed,'plain');const patch=sm(.57,.76,fbm(u*.15,v*.14,seed+60));l=p.l-.075*patch-.025*deposits(u,v,seed+62,.24);r=1;g=.995;b=.985;break;}
  case 27:{const t=tile(u,v,16,16,seed,.08),wear=floorwear(u,v,seed);l=t.light-.17*wear-.12*deposits(u,v,seed+9,.20);r=1.015-.055*wear;g=.97;b=.95;break;}
  case 29:{const row=Math.floor(v/8),pos=mod(v,8),p=grain(u,v,seed+row*13);const joint=edge(pos,.65,.45);const worn=sm(.63,.82,fbm(u*.17,v*.24,seed+28));l=.88+.22*p-.36*joint-.12*worn;r=1.05;g=.95-.055*worn;b=.88;break;}
  default:break;
 }else if(group==='station')switch(index){
  case 4:{const p=ceramic(u,v,16,8,seed,.60),wear=floorwear(u,v,seed);l=p.l-.15*wear;r=.975;g=1;b=.99;break;}
  case 5:{const cellX=mod(u,8)-4,cellY=mod(v,8)-4,d=Math.hypot(cellX,cellY),relief=1-sm(1.5,3.1,d),rim=sm(2.1,3.9,d)*(1-sm(4.2,5.2,d));l=.80+.26*relief-.10*rim-.08*floorwear(u,v,seed);r=1.045;g=1;b=.88;break;}
  case 6:{const stripe=mod(u+v*.85,16),paint=stripe<7.7,wear=floorwear(u,v,seed),chips=sm(.55,.72,fbm(u*.37,v*.28,seed+22));l=(paint?.98:.69)-.27*wear*(.4+.6*chips);r=1.07;g=.99;b=.80;break;}
  case 7:case 8:case 19:{const p=ceramic(u,v,16,index===8?16:8,seed,index===19?.95:index===8?.62:.51);const f=index===8?fracture(u,v,seed):0;const soot=index===19?deposits(u+1.8,v,seed+35,.48):0;l=p.l-.20*f-.33*soot;r=index===8?.91:1.01;g=index===8?1.025:1.0;b=index===8?1.075:.96;break;}
  case 9:{const p=concrete(u,v,seed,'plain'),moss=deposits(u,v,seed+11,.45);l=p.l-.29*moss;r=1-.21*moss;g=.985+.07*moss;b=.98-.16*moss;break;}
  default:break;
 }else if(group==='extra')switch(index){
  case 0:{const p=stone(u,v,seed,'limestone'),sediment=noise(u*.12,v*.34,seed+36);l=p.l-.07*sediment;r=1.01;g=.98;b=.93;break;}
  case 1:{const p=stone(u,v,seed,'marble');l=p.l;r=1.03-.09*p.vein;g=1-.04*p.vein;b=.98+.025*p.vein;break;}
  case 2:{const p=concrete(u,v,seed,'plain'),form=edge(mod(v,16),.7,.7),bolt=1-sm(.5,1.45,Math.hypot(mod(u+4,16)-8,mod(v+4,16)-8));l=p.l-.22*form-.28*bolt-.08*deposits(u,v,seed+50,.18);r=1;g=.99;b=.98;break;}
  case 3:{const p=tile(u,v,16,16,seed,.06);const dust=deposits(u,v,seed+12,.25);l=p.light-.13*dust;r=1.02;g=1.015;b=.985;break;}
  default:break;
 }
 // Independent warm/cool deposits give actual pigment variation, not grayscale only.
 const warm=fbm(u*.17,v*.21,seed+113)-.5;
 const cool=fbm(u*.31,v*.27,seed+127)-.5;
 r*=1+.13*warm-.018*cool;g*=1+.022*warm+.028*cool;b*=1-.11*warm+.07*cool;
 l+=.024*(noise(u*1.33,v*1.41,seed+77)-.5);
 return pigment(l,r,g,b);
}
