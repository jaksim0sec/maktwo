import {BLOCK as B} from '../core/blocks.js';
import {SIZE,TURN_STYLE,EXTERIOR_STYLE,CITY_STAIR_STYLE} from '../core/chunk.js';
import {hash} from '../util/math.js';
import {containsRect,insidePolygon} from './eternal-night-buildings.js';
import {cityPart} from './eternal-night-kits.js';
import {encodeCityStair} from './eternal-night-stairs.js';
import {stampBuilding} from './eternal-night-game.js';
import {canyonBays,canyonShelter} from './canyon-v2-plan.js';

const mod=(n,k)=>((n%k)+k)%k;
const turn=(x,z)=>x<0?2:x>0?6:z<0?4:0;
const has=(r,x,z)=>containsRect(r,x,z);
const intersects=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;
const rail=cityPart('passage',4),stair=cityPart('staircase',2);

export function routeSurface(p,x,z){
 const along=(x-p.ax-.5)*p.dx+(z-p.az-.5)*p.dz;
 const land=p.half;
 if(p.by===p.ay)return p.ay;
 const progress=Math.max(0,Math.min(1,(along-land)/(p.length-2*land)));
 return p.ay+(p.by-p.ay)*progress;
}

function stampTerrace(t,x,z,seed,put,lowerRoof){
 const set=(y,id)=>{if(y>=lowerRoof)put(y,id);};
 const {x0,x1,z0,z1}=t.bounds,xi=Math.floor(x),zi=Math.floor(z);
 const inward=t.side===1?x-x0:x1-x,depth=x1-x0;
 const across=Math.min(z-z0,z1-z);
 const seam=mod(zi,12),beam=seam<2||mod(xi,13)<2||inward<1;
 // Ribbed slabs taper near unsupported ends. Wide rectangular piers and brackets
 // are visible underneath, with no terrain mass filling the canyon.
 const thickness=Math.max(2,t.thickness-(inward<7?3:0)-(across<3?2:0));
 const patch=hash(Math.floor(x/4),t.level,Math.floor(z/4),seed);
 for(let h=1;h<=thickness;h++){
  if(h>2&&!beam)continue;
  set(t.y-h,h===1?(patch>.92?B.WET_TILE:B.FLOOR_TILE):h===2?B.CRACKED_CONCRETE:B.CONCRETE_BEAM);
 }
 if(across>3&&across<z1-z0-5&&seam<3){
  const rib=18+Math.floor(hash(t.level,t.bay,Math.floor(z/12),seed)*17);
  const bracket=inward>8&&inward<depth-2?Math.min(15,Math.floor(inward*.24)):0;
  for(let h=thickness+1;h<=thickness+bracket;h++)set(t.y-h,B.CONCRETE_BEAM);
  if((inward>=depth*.32&&inward<depth*.32+4)||(inward>depth-8&&inward<depth-3))
   for(let h=thickness+1;h<=thickness+rib;h++)set(t.y-h,h%12===0?B.CONCRETE_BEAM:B.CRACKED_CONCRETE);
 }
}

function stampRoute(p,x,z,put,empty,terrace,paths){
 const surface=routeSurface(p,x,z);
 // The platform already carries its own slab. Joints are left open.
 if(terrace?.y===surface)return;
 const rising=Math.sign(p.by-p.ay)||1;
 const facing=turn(p.dx*rising,p.dz*rising),profile=encodeCityStair(surface,facing);
 const along=(x-p.ax-.5)*p.dx+(z-p.az-.5)*p.dz;
 const lateral=(z-p.az-.5)*p.dx-(x-p.ax-.5)*p.dz;
 const railY=profile.base+1;
 const onSpan=along>1&&along<p.length-1;
 const isEdge=onSpan&&Math.abs(lateral)>=p.half&&
  !paths.some(q=>q!==p&&Math.abs(routeSurface(q,x,z)-surface)<.25);
 if(profile.height===1)put(profile.base,B.FLOOR_TILE);
 else put(profile.base,stair,facing,false,CITY_STAIR_STYLE|(profile.quarter<<3));
 put(profile.base-1,B.CONCRETE_BEAM);
 if(p.kind==='concourse'&&onSpan){
  put(railY+3,B.CEILING_TILE);
  if(isEdge){
   const wallTurn=turn(-p.dz*Math.sign(lateral),p.dx*Math.sign(lateral));
   put(railY,B.CRACKED_CONCRETE);
   if(mod(Math.floor(along),19)<16)put(railY+1,cityPart('window',3),wallTurn,true);
   put(railY+2,B.CONCRETE_BEAM);
  }else if(lateral===0&&mod(Math.floor(along),11)===2){
   put(railY+2,mod(Math.floor(along),33)===2?B.FLUORESCENT:B.BROKEN_FLUORESCENT,facing>>1);
  }
 }else if(isEdge&&empty(railY)){
  put(railY,rail,turn(-p.dz*Math.sign(lateral),p.dx*Math.sign(lateral)),true,
   CITY_STAIR_STYLE|(mod(Math.floor(along),3)===0?8:0));
 }else if((p.kind==='bridge'||p.kind==='concourse')&&mod(Math.floor(along),14)<2){
  put(profile.base-2,B.CONCRETE_BEAM);
 }
}

function stampBuildingDetails(v,x,z,put,empty){
 const vSide=Math.sign(v.x0+v.x1),face=vSide===1?v.x0:v.x1;
 const inward=(x-face)*vSide;
 const along=Math.floor(z-v.z0);
 if(v.balconyFront&&inward<0&&inward>=-2&&along>=4&&z<v.z1-4&&mod(along,7)<4){
  for(const f of v.floors.slice(1)){
   if(!insidePolygon(f.outline,x+vSide*2.5,z))continue;
   const damage=hash(v.id,Math.floor(along/7),f.level,2932);
   if(damage<.15)continue;
   const y=Math.round(f.y);
   if(!empty(y-1)||!empty(y))continue;
   put(y-1,B.CONCRETE_BEAM);
   if(inward<-1&&damage>.22)
    put(y,rail,turn(-vSide,0),true,CITY_STAIR_STYLE|(mod(along,3)===0?8:0));
  }
 }
 if(v.kind==='market'&&v.front&&z>v.z0+4&&z<v.z1-4&&inward<0&&inward>=-2){
  const bay=Math.floor((z-v.z0)/6);
  if(hash(v.id,bay,0,1745)>.27){
   const y=v.y0+4;
   if(empty(y))put(y,B.SHOP_AWNING,turn(-vSide,0),true);
   if(inward>-1&&Math.abs(z-v.front.z)>3&&empty(y+1))put(y+1,cityPart('sign',3),turn(-vSide,0),true);
  }
 }
 if(!has(v,x,z)||!insidePolygon(v.roof.outline,x,z)||v.roof.holes.some(h=>has(h,x,z)))return;
 const y=Math.round(v.y1);
 if(v.kind==='industrial'){
  const xx=Math.floor((v.x0+v.x1)/2)+5,zz=Math.floor((v.z0+v.z1)/2)-5;
  if(Math.abs(x-xx)<1.5&&Math.abs(z-zz)<1.5){
   const height=4+Math.round(v.roofWear*5);
   for(let h=0;h<height;h++)put(y+h,h===height-1?B.RUSTED_METAL:B.CRACKED_CONCRETE);
  }else if(Math.abs(x-xx)<5&&Math.abs(z-zz)<4&&empty(y))put(y,B.CORRUGATED_METAL);
 }else if(v.roofWear>.28&&hash(Math.floor(x/3),v.id,Math.floor(z/3),48)>.94&&empty(y)){
  put(y,v.roofWear>.87?B.RUBBLE:B.CITY_DAMP_GROWTH);
 }
}

export function stampCanyonChunk(chunk,seed,origin=0){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 const bounds={x0:ox,x1:ox+SIZE,z0:oz,z1:oz+SIZE};
 const terraces=[],buildings=[],routes=[];
 for(const plan of canyonBays(seed,origin,chunk.height,bounds.z0,bounds.z1)){
  terraces.push(...plan.terraces.filter(t=>intersects(t.bounds,bounds)));
  buildings.push(...plan.buildings.filter(v=>intersects({...v,x0:v.x0-2,x1:v.x1+2},bounds)));
  routes.push(...plan.routes.filter(p=>intersects(p.bounds,bounds)));
 }
 const shelter=canyonShelter(seed);
 for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++){
  const x=ox+lx+.5,z=oz+lz+.5;
  const index=y=>((y-origin)*SIZE+lz)*SIZE+lx;
  const valid=y=>y>=origin&&y<origin+chunk.height;
  const empty=y=>valid(y)&&!chunk.data[index(y)];
  const put=(y,id,facing,exterior=false,flags=0,form=0)=>{
   if(!valid(y))return;
   const i=index(y),style=facing===undefined?flags:TURN_STYLE|facing|(exterior?EXTERIOR_STYLE:0)|flags;
   chunk.data[i]=id;
   if(style)chunk.styles??=new Uint8Array(chunk.data.length);
   if(chunk.styles)chunk.styles[i]=style;
   if(form)chunk.forms??=new Uint8Array(chunk.data.length);
   if(chunk.forms)chunk.forms[i]=form;
  };
  const decks=terraces.filter(t=>has(t.bounds,x,z));
  const paths=routes.filter(p=>has(p.bounds,x,z));
  for(const t of decks){
   let lowerRoof=-Infinity;
   for(const v of buildings)
    if(v.y1<t.y&&v.y1>t.y-48&&has(v,x,z)&&insidePolygon(v.roof.outline,x,z))
     lowerRoof=Math.max(lowerRoof,v.y1);
   stampTerrace(t,x,z,seed,put,lowerRoof);
  }
  for(const v of buildings)if(has(v,x,z)&&v.y1>origin&&v.y0<origin+chunk.height)
   stampBuilding(v,v.detail,x,z,seed,put,empty,undefined,origin+chunk.height);
  for(const v of buildings)stampBuildingDetails(v,x,z,put,empty);
  for(const p of paths)stampRoute(p,x,z,put,empty,decks.find(t=>Math.abs(t.y-routeSurface(p,x,z))<3),paths);
  for(const t of decks){
   const {x0,x1,z0,z1}=t.bounds;
   const edge=[[x-x0,-1,0],[x1-x,1,0],[z-z0,0,-1],[z1-z,0,1]].find(([d])=>d<1);
   if(edge&&empty(t.y)&&!paths.some(p=>Math.abs(routeSurface(p,x,z)-t.y)<5)){
    const [,dx,dz]=edge,damage=hash(Math.floor(x/4),t.level,Math.floor(z/4),seed+12);
    if(damage>.045)put(t.y,rail,turn(dx,dz),true,CITY_STAIR_STYLE|(mod(Math.floor(dx?z:x),3)===0?8:0));
    else if(damage<.02)put(t.y,B.EXPOSED_REBAR);
   }else if(!edge&&empty(t.y)&&!paths.some(p=>Math.abs(routeSurface(p,x,z)-t.y)<5)){
    if(hash(Math.floor(x/5),t.level,Math.floor(z/5),seed+2)>.94&&hash(x,t.level,z,seed)>.56)
     put(t.y,B.CITY_DAMP_GROWTH);
   }
  }
  if(shelter?.head!==undefined&&Math.floor(z)===shelter.z&&x>=shelter.x-1&&x<shelter.lamp+1){
   // The starting corridor has one clear aisle from the shelter to the facade.
   const u=Math.floor(x),y=shelter.y;
   put(y-1,B.FLOOR_TILE);
   put(y,B.AIR);put(y+1,B.AIR);
   if(u===shelter.head)put(y,B.BED,1);
   if(u===shelter.foot)put(y,B.BED_FOOT,1);
   if(u===shelter.lamp)put(y,B.TORCH);
  }
 }
 return chunk;
}
