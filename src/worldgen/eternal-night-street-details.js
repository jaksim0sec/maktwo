import {BLOCK as B} from '../core/blocks.js';
import {CITY_STAIR_STYLE} from '../core/chunk.js';
import {hash} from '../util/math.js';
import {insidePolygon,containsRect} from './eternal-night-buildings.js';
import {CORE_ZONE,zoneAt} from './eternal-night-core-floor.js';
import {encodeCityStair} from './eternal-night-stairs.js';
import {cityPart} from './eternal-night-kits.js';

const cellKey=(x,z)=>Math.floor(x)+','+Math.floor(z);
const dirs=[[0,1],[-1,0],[0,-1],[1,0]];
const outward=(dx,dz)=>2*dirs.findIndex(([x,z])=>x===dx&&z===dz);
const occupied=(f,x,z)=>insidePolygon(f.outline,x+.5,z+.5);
const portNear=(f,x,z)=>f.doors.some(p=>Math.hypot(p.x-x-.5,p.z-z-.5)<p.width/2+1.5);
const guard=(y,turn,post)=>[y,cityPart('passage',4),turn,true,CITY_STAIR_STYLE|(post?8:0)];

export function designStreetDetails(plan,seed,ground){
 const columns=new Map(),examples={piloti:0,stairs:0,mirror:0};
 const {layout,left,top,step,size}=plan;
 const clear=(v,x,z,y0,y1)=>{
  const gx=Math.floor((x+.5-left)/step),gz=Math.floor((z+.5-top)/step);
  if(gx<0||gz<0||gx>=size||gz>=size)return false;
  const index=gz*size+gx,zone=zoneAt(layout,x+.5,z+.5);
  if([CORE_ZONE.OUTSIDE,CORE_ZONE.MAIN_SHAFT,CORE_ZONE.MINI_SHAFT,CORE_ZONE.SKY_GARDEN].includes(zone)||
    columns.has(cellKey(x,z)))return false;
  return !plan.columns[index].some(other=>other!==v&&other.y0<y1&&other.y1>y0&&
   x+.5>=other.x0&&x+.5<other.x1&&z+.5>=other.z0&&z+.5<other.z1)&&
   !plan.pathColumns[index].some(({part})=>{
    const low=Math.min(part.from?.[1]??part.y,part.to?.[1]??part.y);
    const high=Math.max(part.from?.[1]??part.y,part.to?.[1]??part.y);
    return low-2<y1&&high+4>y0&&occupied(part,x,z);
   });
 };
 const add=(kind,stamps)=>{
  for(const [x,z,blocks] of stamps)columns.set(cellKey(x,z),{kind,blocks});
  examples[kind]++;
 };
 for(const v of plan.volumes){
  if(v.support!==null||Math.abs(v.y0-ground)>1)continue;
  const roll=hash(v.id,65,0,seed);
  const f=v.floors[0],upper=v.floors[1],y=Math.round(f.y),next=Math.round(upper?.y??f.top);
  const facade=v.ports.find(p=>p.level===0&&p.open);
  if(!facade)continue;
  if(roll<.085&&upper&&v.floors.length<=11){
   const {dx,dz}=facade,tx=dz,tz=-dx;
   for(const side of [-1,1]){
    const baseX=Math.floor(facade.x+tx*side*5.5-dx*.8),baseZ=Math.floor(facade.z+tz*side*5.5-dz*.8);
    const stamps=[];
    for(let a=-2;a<=2;a++)for(let depth=0;depth<=3;depth++){
     const x=baseX+a*tx-depth*dx,z=baseZ+a*tz-depth*dz;
     if(!occupied(f,x,z)||!occupied(upper,x,z)||!clear(v,x,z,y,next+4)||portNear(f,x,z)||portNear(upper,x,z)||
        f.holes.some(h=>containsRect(h,x+.5,z+.5))||
        v.stairs[0]?.treads.some(t=>containsRect(t,x+.5,z+.5)))continue;
     const pier=Math.abs(a)===2&&depth===0,blocks=[];
     for(let level=y;level<next+3;level++){
      let id=B.AIR;
      if(pier)id=B.WALL_TILE;
      else if(depth===3&&!(a===0&&level>=next))id=level===y||level===next-1?B.CONCRETE_BEAM:cityPart('window',2);
      else if(depth===0&&level<next&&level>=next-2)id=B.CONCRETE_BEAM;
      else if(depth>=1&&level===next-1)id=B.FLOOR_TILE;
      else if(depth===1&&level===next){blocks.push(guard(level,outward(dx,dz),a%2===0));continue;}
      blocks.push([level,id,dz?0:2,true]);
     }
     blocks.push([next+3,B.CORRUGATED_METAL,dz?1:0,true]);
     stamps.push([x,z,blocks]);
    }
    if(stamps.length===20){add('piloti',stamps);break;}
   }
  }else if(roll<.25&&upper&&v.floors.length<=11){
   // Try short facade offsets so the upper landing meets a free wall bay.
   tryStairs:for(const [dx,dz] of dirs)for(const shift of [0,-3,3,-5,5]){
    const tx=dz,tz=-dx;
    const cx=Math.floor((v.x0+v.x1)/2),cz=Math.floor((v.z0+v.z1)/2);
    const facadeX=(dx===0?cx:dx>0?Math.ceil(v.x1-.5)-1:Math.ceil(v.x0-.5))+tx*shift;
    const facadeZ=(dz===0?cz:dz>0?Math.ceil(v.z1-.5)-1:Math.ceil(v.z0-.5))+tz*shift;
    const run=next-y,coreTop=next+3,stamps=[];
    if(!occupied(upper,facadeX-2*tx,facadeZ-2*tz))continue;
    let fits=run>=4&&run<=10,ports=0;
    for(let depth=0;depth<=run+2&&fits;depth++)for(let a=-3;a<=2;a++){
     const x=facadeX+dx*depth+tx*a,z=facadeZ+dz*depth+tz*a;
     if(!clear(v,x,z,y,coreTop+1)||(depth>0&&(occupied(f,x,z)||occupied(upper,x,z)))||
        (depth===0&&(portNear(f,x,z)||portNear(upper,x,z)))){fits=false;continue;}
     const blocks=[];
     if(depth===0){
      if(a<=-2&&occupied(upper,x,z)){
       ports++;
       for(let h=0;h<3;h++)blocks.push([next+h,B.AIR]);
       blocks.push([next-1,B.FLOOR_TILE]);
      }
     }else if(a>=-1&&a<=0&&depth<=run){
      for(let h=y;h<coreTop;h++)blocks.push([h,h===coreTop-1?B.CONCRETE_BEAM:B.STAINED_PLASTER]);
      blocks.push([coreTop,B.CONCRETE_SLAB]);
     }else{
      const landing=depth>run;
      const surface=landing?(next+y)/2:a>0?y+(depth-1)*.5:next-(depth-1)*.5;
      const heading=outward(a>0?dx:-dx,a>0?dz:-dz);
      const tread=encodeCityStair(surface,heading),side=a>0?1:-1,edge=a===-3||a===2;
      if(tread.base>y)blocks.push([tread.base-1,B.CONCRETE_BEAM]);
      if(depth===1&&a<0)blocks.push([coreTop,B.CONCRETE_SLAB]);
      if((landing||depth===1)&&tread.height===1)blocks.push([tread.base,B.FLOOR_TILE]);
      else blocks.push([tread.base,cityPart('staircase',2),heading,!landing&&edge,CITY_STAIR_STYLE|(tread.quarter<<3)]);
      if((landing||depth===1)&&(edge||depth===run+2))blocks.push(guard(tread.base+1,
       depth===run+2?outward(dx,dz):outward(tx*side,tz*side),a%2===0||depth===1));
     }
     if(blocks.length)stamps.push([x,z,blocks]);
    }
    if(fits&&ports===2){add('stairs',stamps);break tryStairs;}
   }
  }
  // Road mirror placement is paused. Keep its mesh path for existing saved chunks.
  // if(roll>.82&&v.floors.length<6){
  //  const {dx,dz}=facade,side=roll>.91?1:-1;
  //  mirrorSite:for(const offset of [side,-side])for(const depth of [1.6,2.6,3.5]){
  //   const x=Math.floor(facade.x+dx*depth+dz*offset*2.8),z=Math.floor(facade.z+dz*depth-dx*offset*2.8);
  //   if(!occupied(f,x,z)&&clear(v,x,z,ground,ground+4)){
  //    add('mirror',[[x,z,[[ground,B.CITY_DAMP_GROWTH,undefined,false,ROAD_MIRROR_STYLE|(outward(dx,dz)>>1)]]]]);
  //    break mirrorSite;
  //   }
  //  }
  // }
 }
 return {columns,examples};
}
