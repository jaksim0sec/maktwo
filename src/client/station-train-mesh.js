import {BLOCK as B,block} from '../core/blocks.js';
import {TRAIN,trainCab,trainControls} from '../worldgen/station-train.js';
import {materialFor} from './textures.js';
import {rgb,quad} from './mesher.js';

const FACES=[
 [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
 [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
 [[1,0,1],[1,1,1],[0,1,1],[0,0,1]],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]
];
const steel=B.STATION_TRAIN_DOOR_STEEL,skin=B.STATION_TRAIN_CORRUGATED,enamel=B.STATION_TRAIN_ENAMEL;
const rubber=B.STATION_TRAIN_RUBBER,glass=B.STATION_TRAIN_SMOKED_GLASS;
const blue=B.STATION_STATION_BLUE,orange=B.STATION_PLATFORM_ORANGE,seat=B.STATION_TRAIN_SEAT;
const red=[.78,.19,.13],signalBlue=[.19,.53,.77];
const shade=[.84,.78,1,.56,.87,.83];

function painter(axis){
 const point=axis==='x'?p=>p:([a,y,c])=>[c,y,a];
 const surface=(out,vertices,id,light=1)=>{
  const v=vertices.map(point);
  if(axis==='z')v.reverse(); // Axis exchange reflects the winding.
  quad(out,v,Array.isArray(id)?id:rgb(block(id).color),light<0?light:light+4*(Array.isArray(id)?0:materialFor(id,0)));
 };
 const box=(out,a,y,c,w,h,d,id,glow=false)=>{
  for(let face=0;face<6;face++)
   surface(out,FACES[face].map(([i,j,k])=>[a+i*w,y+j*h,c+k*d]),id,glow?-1:shade[face]);
 };
 return {box,surface};
}

export function stationTrainMesh(train){
 const opaque=[],transparent=[],doorSteel=[],doorGlass=[],doorRanges=[];
 const {box,surface}=painter(train.axis),{start,end,bogies,doors}=train;
 const {center,halfWidth,deck,ceiling,roof,doorWidth}=TRAIN;
 const lo=center-halfWidth,hi=center+halfWidth,length=end+1-start;
 const solid=(...args)=>box(opaque,...args);
 // One slab: rubber tread above, steel skirt on its exposed sides.
 for(let face=0;face<FACES.length;face++){
  const vertices=FACES[face].map(([a,y,c])=>[start+a*length,.70+y*.30,lo+c*(hi-lo)]);
  surface(opaque,vertices,face===2?rubber:skin,shade[face]);
 }
 // One crown with shoulders instead of a full-width cuboid on the roof.
 solid(start,ceiling,lo+.24,length,roof-ceiling,hi-lo-.48,enamel);
 for(const [a,b] of [[lo,lo+.24],[hi-.24,hi]]){
  const vertices=[[start,ceiling+(a===lo?0:.23),a],[start,ceiling+(a===lo?.23:0),b],
    [end+1,ceiling+(a===lo?.23:0),b],[end+1,ceiling+(a===lo?0:.23),a]];
  surface(opaque,vertices,enamel,.93);
  surface(opaque,[...vertices].reverse(),enamel,.82);
 }
 for(const a of [start+6,start+12,start+18]){
  solid(a,roof,center-.62,1.35,.14,1.24,steel);
  solid(a+.1,roof+.14,center-.45,1.12,.04,.9,B.STATION_STATION_GRILLE);
 }
 for(const a of bogies){
  solid(a-1.1,.04,center-.91,2.2,.65,1.82,B.STATION_TRACK_GREASE);
  for(const offset of [-.76,.76])for(const c of [center-1.085,center+.915]){
   // Eight-sided wheel, with a distinct steel axle cap on both flanks.
   const points=Array.from({length:8},(_,i)=>{
    const angle=(i+.5)*Math.PI/4;
    return [a+offset+.54*Math.cos(angle),-.20+.54*Math.sin(angle)];
   });
   for(let i=0;i<8;i++){
    const [x,y]=points[i],[nx,ny]=points[(i+1)%8];
    surface(opaque,[[nx,ny,c],[x,y,c],[x,y,c+.17],[nx,ny,c+.17]],steel,.72);
    surface(opaque,[[a+offset,-.20,c],[nx,ny,c],[x,y,c],[x,y,c]],steel,.75);
    surface(opaque,[[a+offset,-.20,c+.17],[x,y,c+.17],[nx,ny,c+.17],[nx,ny,c+.17]],steel,.75);
   }
   solid(a+offset-.32,-.63,c-.015,.64,.65,.20,B.STATION_TRACK_GREASE);
   solid(a+offset-.14,-.43,c-.03,.28,.24,.23,steel);
  }
 }
 for(const side of [-1,1]){
  const c=side<0?lo:hi-.12;
  const cladding=(a,y,w,h,id)=>solid(a,y,c,w,h,.12,id);
  cladding(start,3.57,length,ceiling-3.57,enamel);
  const bay=(a,b,index)=>{
   const w=b-a;if(w<.1)return;
   cladding(a,deck,w,.87,skin);
   const outside=side<0?c-.014:c+.12;
   solid(a,1.42,outside,w,.18,.014,blue);
   solid(a,1.60,outside,w,.05,.014,orange);
   const windowStart=a+(index===0?1.8:.20),windowEnd=b-(index===doors.length?1.8:.20);
   if(windowEnd-windowStart<.4){cladding(a,1.87,w,1.70,enamel);return}
   cladding(a,1.87,w,.22,enamel);
   cladding(a,3.22,w,.35,enamel);
   cladding(a,2.09,windowStart-a,1.13,enamel);
   cladding(windowEnd,2.09,b-windowEnd,1.13,enamel);
   const width=windowEnd-windowStart;
   cladding(windowStart,2.09,width,.07,rubber);
   cladding(windowStart,3.15,width,.07,rubber);
   for(const x of [windowStart,(windowStart+windowEnd)/2,windowEnd-.08])cladding(x,2.16,.08,.99,rubber);
   box(transparent,windowStart+.06,2.16,c+.045,width-.12,.99,.024,glass);
   if(index>0&&index<doors.length){
    const inside=side<0?lo+.13:hi-.65;
    solid(a+.3,1.15,inside,w-.6,.42,.52,seat);
    solid(a+.3,1.57,side<0?inside:inside+.40,w-.6,.42,.12,seat);
    solid(a+.25,3.35,inside,w-.5,.045,.42,steel);
   }
  };
  let cursor=start;
  for(const [index,left] of doors.entries()){
   bay(cursor,left,index);
   const right=left+doorWidth;
   // Manual releases are fixed on the jamb, reachable even with the leaves open.
   solid(left-.41,1.57,c-.045,.28,.43,.21,rubber);
   solid(left-.315,1.65,c-.085,.09,.25,.29,orange);
   cladding(left,3.51,doorWidth,.06,steel);

   for(const leaf of [-1,1]){
    const steelFirst=doorSteel.length/7,glassFirst=doorGlass.length/7;
    const a=left+(leaf===1?doorWidth/2:0)+.012,w=doorWidth/2-.025;
    const strip=(x,y,width,h,id)=>box(doorSteel,x,y,c+.014,width,h,.089,id);
    strip(a,1.04,w,1.03,steel);
    const outer=side<0?c+.008:c+.103;
    box(doorSteel,a,1.42,outer,w,.18,.006,blue);
    box(doorSteel,a,1.60,outer,w,.05,.006,orange);
    strip(a,3.10,w,.41,steel);
    for(const x of [a,a+w-.095])strip(x,2.07,.095,1.03,rubber);
    box(doorGlass,a+.08,2.08,c+.043,w-.16,1.01,.024,glass);
    const grip=a+(leaf===-1?w-.19:.13);
    box(doorSteel,grip,1.49,c-.035,.07,.25,.19,rubber);
    doorRanges.push({index:index+(side===1?4:0),side,leaf,steelFirst,glassFirst,
     steelCount:doorSteel.length/7-steelFirst,glassCount:doorGlass.length/7-glassFirst});
   }
   cursor=right;
  }
  bay(cursor,end+1,doors.length);
 }
 // Full-width cab ends, glazing gasket, marker lamps and coupler.
 for(const side of [-1,1]){
  const a=side<0?start:end+.84;
  solid(a,deck,lo,.16,1.16,hi-lo,enamel);
  solid(side<0?a-.012:a+.16,1.49,lo+.016,.012,.20,hi-lo-.032,blue);
  solid(a,2.06,lo,.16,.14,hi-lo,rubber);
  solid(a,3.36,lo,.16,.46,hi-lo,enamel);
  for(const c of [lo,center-.06,hi-.20])solid(a,2.20,c,.16,1.16,c===center-.06?.12:.20,rubber);
  box(transparent,a+.065,2.20,lo+.18,.027,1.16,hi-lo-.36,glass);
  const outside=side<0?a-.035:a+.16;
  for(const c of [lo+.31,hi-.61]){
   solid(outside,1.82,c,.038,.22,.30,rubber);
   solid(outside+(side<0?-.014:.03),1.87,c+.055,.024,.11,.19,orange);
  }
  solid(outside,3.49,center-.48,.04,.19,.96,rubber);
  solid(side<0?start-.48:end+.96,.61,center-.26,.52,.24,.52,B.STATION_TRACK_GREASE);
  const {end:tip,right,lever:[leverX,leverY,leverZ]}=trainCab(train,side);
  const front=tip-side*.58,back=tip-side*1.48;
  solid(Math.min(front,back),deck,lo+.32,.90,1.12,hi-lo-.64,steel);
  const panelLeft=center-right*1.35,panelRight=center+right*.68;
  const yAt=t=>2.46-.34*t;
  const panel=(t0,t1,c0,c1,id,lift=0,light=.86)=>{
   const p=(t,c)=>[tip-side*(.58+.90*t),yAt(t)+lift,c];
   const vertices=[p(t0,c0),p(t0,c1),p(t1,c1),p(t1,c0)];
   if((c1-c0)*side>0)vertices.reverse();
   surface(opaque,vertices,id,light);
  };
  panel(0,1,panelLeft,panelRight,enamel,.012);
  for(const c of [panelLeft,panelRight]){
   const edge=[[front,2.12,c],[front,2.472,c],[back,2.132,c],[back,2.132,c]];
   surface(opaque,edge,steel,.78);
   surface(opaque,[...edge].reverse(),steel,.78);
  }
  solid(front-.012,2.12,Math.min(panelLeft,panelRight),.024,.35,Math.abs(panelLeft-panelRight),steel);
  panel(.12,.79,center-right*1.20,center+right*.53,rubber,.027);
  panel(.23,.69,center-right*1.07,center+right*.39,glass,.034);
  for(const [index,offset] of [-.80,-.34,.19].entries()){
   const color=index===2?signalBlue:red;
   const c=center+right*offset;
   const gauge=Array.from({length:8},(_,i)=>{
    const angle=i*Math.PI/4;
    return [.46+Math.cos(angle)*.16,c+Math.sin(angle)*.146*right];
   });
   for(let i=0;i<gauge.length;i++){
    const point=([t,z])=>[tip-side*(.58+.90*t),yAt(t)+.041,z];
    const vertices=[point([.46,c]),point(gauge[i]),point(gauge[(i+1)%8])];
    if(side*right<0)vertices.reverse();
    surface(opaque,[...vertices,vertices[2]],color,-.74);
   }
   panel(.44,.48,c-.09,c+.06,rubber,.049);
  }
  // Recessed lever quadrant, separate from the tilted instrument panel.
  solid(leverX-.29,leverY+.004,leverZ-.19,.47,.075,.38,rubber);
  for(const dz of [-.133,.11])solid(leverX-.25,leverY+.079,leverZ+dz,.39,.027,.024,steel);
  for(const dx of [-.19,-.095,0,.095])solid(leverX+dx,leverY+.08,leverZ+.15,.024,.012,.028,enamel);
 }
 for(let a=start+4;a<end-2;a+=3){
  solid(a,3.65,center-.82,1.8,.06,.10,steel);
  if((a-start)%2===0)solid(a,3.73,center-.21,1.5,.06,.42,enamel);
  if((a-start)%4===0)solid(a+.15,3.716,center-.17,1.20,.02,.34,B.STATION_STATION_CREAM,true);
  for(const c of [center-.80,center+.70])solid(a+.38,3.39,c,.055,.27,.08,steel);
 }
 const levers=trainControls(train).filter(handle=>handle.kind==='lever').map(({at:[a,y,c],side})=>{
  return [-1,0,1].map(state=>{
   const mesh=[],angle=(state===0?-.30:.50)*side;
   const p=(u,v,z)=>[a+u*Math.cos(angle)+v*Math.sin(angle),y-u*Math.sin(angle)+v*Math.cos(angle),c+z];
   const piece=(u,v,z,w,h,d,id)=>{
    for(let face=0;face<FACES.length;face++){
     const vertices=FACES[face].map(([i,j,k])=>p(u+i*w,v+j*h,z+k*d));
     surface(mesh,vertices,id,shade[face]);
    }
   };
   // Tall dark arm with a red loop grip, as on a speed-brake handle.
   piece(-.038,.075,-.037,.076,.35,.074,rubber);
   piece(-.064,.37,-.115,.128,.065,.23,red);
   piece(-.062,.60,-.115,.124,.063,.23,red);
   for(const z of [-.115,.062])piece(-.055,.424,z,.11,.189,.053,red);
   return new Float32Array(mesh);
  });
 });
 return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent),
  doorSteel:new Float32Array(doorSteel),doorGlass:new Float32Array(doorGlass),doorRanges,levers};
}
