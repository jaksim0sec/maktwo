// Construction is assembled from independent reusable parts, not fixed building plans.
import {SIZE,HEIGHT} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';
export const PART_FAMILIES=Object.freeze({
 passage:['enclosed','open-gallery','arcade','service','roofless-bridge'],
 entrance:['recessed','shopfront','corner','side','throughway'],
 stairEntrance:['landing','vestibule','service-entry','two-way','open-core'],
 balcony:['recessed','projecting','covered','glazed','metal-gallery'],
 wall:['plaster','tile','brick','concrete','stone'],
 column:['concrete','tile','black-granite','steel','stone'],
 window:['sliding','vent','tripartite','transom','hopper'],
 partition:['thin','plaster','metal','glazed','masonry'],
 door:['wood','service','glass','shop','fire'],
 staircase:['concrete','granite','steel','timber','stone-tread'],
 sign:['flat-board','projecting','illuminated','awning','stacked'],
 interior:['chair','plant','workbench','cabinet','lamp'],
});
export function partVariant(plan,family,level=0,cell=0){
 const types=PART_FAMILIES[family];
 if(!types)throw new RangeError('Unknown construction family: '+family);
 return (plan.variant*3+level*2+cell+Math.floor(hash(cell,level,family.length,plan.seed)*5))%types.length;
}
export function componentPlan(seed,variant=0){
 const roll=n=>hash(variant,n,0,seed+601),width=21+Math.floor(roll(1)*4),depth=20+Math.floor(roll(2)*4);
 const footprints=[
  [{x:0,z:0,w:width-3,d:depth-1},{x:width-8,z:7,w:8,d:depth-9}],
  [{x:roll(3)>.5?1:0,z:0,w:width-3,d:depth-3},{x:width-10,z:depth-11,w:10,d:11}],
  [{x:0,z:roll(4)>.5?1:0,w:width-7,d:depth-3},{x:width-10,z:6,w:9,d:depth-10}]
 ];
 // The shared circulation core survives setbacks, cantilevers and annex changes.
 for(const pieces of footprints)pieces.push({x:0,z:0,w:7,d:16});
 return {seed,variant,x:4,z:4,base:22,floors:3,width,depth,footprints};
}
export function occupies(p,level,u,v){
 if(level<0||level>=p.floors||u<0||v<0||u>=p.width||v>=p.depth)return false;
 if(!p.footprints[level].some(b=>u>=b.x&&u<b.x+b.w&&v>=b.z&&v<b.z+b.d))return false;
 if(u>9&&v>5&&((level===0&&u>p.width-5&&v<10)||
 (level===1&&u>p.width-3&&v<8)||(level===2&&u>p.width-6&&v>p.depth-5)))return false;
 return true;
}
const walls=[B.ARCH_CONCRETE_PEBBLE_PAINT,B.ARCH_TILE_VERTICAL_WHITE,B.ARCH_BRICK_RED,B.ARCH_CONCRETE_FORMWORK,B.ARCH_STONE_GREY_GRANITE];
const columns=[B.ARCH_CONCRETE_FORMWORK,B.ARCH_TILE_VERTICAL_WHITE,B.ARCH_STONE_BLACK_GRANITE,B.ARCH_METAL_GALVANIZED,B.ARCH_STONE_GREY_GRANITE];
const partitions=[B.THIN_WALL_EW,B.ARCH_CONCRETE_SMOOTH_PLASTER,B.ARCH_METAL_GALVANIZED,B.WINDOW_EW,B.ARCH_BRICK_WHITE];
const floors=[B.FLOOR_FINISH,B.ARCH_STONE_TERRAZZO,B.ARCH_FLOOR_VINYL_TILE,B.ARCH_TILE_SQUARE_GREY,B.ARCH_STONE_GREY_GRANITE];
const stairBases=[B.CONCRETE_SLAB,B.STONE_SLAB,B.CONCRETE_SLAB,B.WOOD_SLAB,B.STONE_SLAB];
const props=[B.CHAIR,B.FLOWER_POT,B.WORKBENCH,B.METAL_PANEL,B.FLUORESCENT];
export function stairStep(p,flight,j){
 if(flight<0||flight>=p.floors-1||j<0||j>=12)return null;
 const top=p.base+6*flight+2+j*.5;
 return {top,y:Number.isInteger(top)?top-1:Math.floor(top),
 id:Number.isInteger(top)?B.UPPER_STAIR_TREAD:stairBases[partVariant(p,'staircase',flight)]};
}
function stairPart(p,u,v,y){
 if(u<1||u>4||v<2||v>=14)return null;
 for(let flight=0;flight<p.floors-1;flight++){
  const s=stairStep(p,flight,v-2);
  if((u===2||u===3)&&y===s.y)return {id:s.id};
  if((u===1||u===4)&&y===Math.floor(s.top))return {id:B.FENCE,style:7};
 }
 return null;
}
export function partAt(p,x,y,z){
 const u=x-p.x,v=z-p.z,level=Math.floor((y-p.base)/6),dy=y-p.base-level*6;
 if(!occupies(p,level,u,v))return null;
 const stair=stairPart(p,u,v,y);
 if(stair)return stair;
 const edge=[!occupies(p,level,u,v-1),!occupies(p,level,u,v+1),!occupies(p,level,u-1,v),!occupies(p,level,u+1,v)];
 const boundary=edge.some(Boolean),front=edge[0],axis=edge[0]||edge[1]?'NS':'EW';
 const balconyStyle=partVariant(p,'balcony',level);
 const balcony=level>0&&front&&u>=11&&u<p.width-4&&balconyStyle!==3;
 if(dy===0)return {id:B.CONCRETE};
 if(dy===1)return {id:floors[partVariant(p,'staircase',level,u+v)]};
 if(u>=2&&u<=3&&v>=2&&v<=13)return {id:B.AIR};
 if(u===4&&v>=2&&v<=14){
  const entrance=partVariant(p,'stairEntrance',level);
  return ((v===3+entrance%2||v===13-entrance%2)&&dy<=3)?{id:B.AIR}:{id:walls[(level+p.variant+1)%5]};
 }
 if(dy===5){
  const passage=partVariant(p,'passage',level);
  if((level===p.floors-1&&passage===4&&u===5)||(balcony&&balconyStyle===1))return {id:B.AIR};
  return {id:level===p.floors-1?B.ARCH_CONCRETE_SMOOTH_PLASTER:B.CEILING_FINISH};
 }
 if(boundary){
  if(balcony&&dy>=2)return dy===2?{id:B.FENCE,style:6}:{id:B.AIR};
  if(level===0&&v===0&&u===5){
   if(dy===2)return {id:B.DOOR,style:1+partVariant(p,'door',level)};
   if(dy===3)return {id:B.DOOR_TOP};
   if(dy===4)return {id:columns[partVariant(p,'column',level,u)]};
  }
  const entrance=partVariant(p,'entrance',level);
  if(level===0&&front&&u>=9&&u<=11+entrance%2&&dy<=4)
   return {id:dy===4?B.ARCH_METAL_BLACK_PAINT:B.AIR};
  if(level===0&&front&&u>=12&&u<=18&&(dy===3||dy===4)){
   const sign=partVariant(p,'sign',0),base=[B.SHOP_SIGN,B.ARCH_METAL_GALVANIZED,
    B.SHOP_SIGN,B.SHOP_AWNING,B.WARNING_STRIPE][sign];
   // A sign is an assembly of backing, supports and optional lighting.
   if(dy===4&&u>=13&&u<=17)return {id:sign===2&&u===15?B.FLUORESCENT:base};
   if(dy===3&&((sign===1&&(u===14||u===15))||
     (sign===3&&(u===13||u===17))||(sign===4&&(u===13||u===16))))
    return {id:sign===1?B.ARCH_METAL_BLACK_PAINT:sign===3?B.SHOP_AWNING:B.SHOP_SIGN};
  }
  if(dy>=2&&edge.filter(Boolean).length>=2&&(u+v+level)%3===0)
   return {id:columns[partVariant(p,'column',level,u+v)]};
  const along=axis==='NS'?u:v;
  if((dy===2||dy===3)&&!(u<7&&v<16)&&
   ((along+level*2+p.variant)%5===0||(level===2&&along%4===2)))
   return {id:axis==='NS'?B.WINDOW_NS:B.WINDOW_EW,style:1+partVariant(p,'window',level,along)};
  return {id:walls[partVariant(p,'wall',level,(along+3)>>2)]};
 }
 const aisle=partVariant(p,'passage',level);
 if(u===5||u===6||(aisle===4&&v===Math.floor(p.depth/2)&&u>=6&&u<=9))return {id:B.AIR};
 if(dy>=2&&dy<=4){
  const split=9+(level+p.variant)%4,partition=u===split&&v>3&&v<p.depth-2;
  const cross=v===Math.floor(p.depth/2)+level-1&&u>8&&u<p.width-2;
  if(partition||cross){
   if((u+v+level*3)%7===0)return {id:B.AIR};
   const material=partitions[partVariant(p,'partition',level,u+v)];
   return {id:cross&&material===B.THIN_WALL_EW?B.THIN_WALL_NS:cross&&material===B.WINDOW_EW?B.WINDOW_NS:material,
    style:material===B.WINDOW_EW?1+partVariant(p,'window',level,u+v):0};
  }
  if(dy===2&&u>9&&v>3&&u<p.width-3&&v<p.depth-3&&u%6===2&&v%7===3)
   return {id:props[partVariant(p,'interior',level,u+v)]};
 }
 return {id:B.AIR};
}
export function stampComponentBuilding(chunk,seed,kind){
 const types=['shop-house','office','walkup','arcade','service'],variant=types.indexOf(kind);
 if(variant<0)throw new RangeError('Unknown component scene '+kind);
 const p=componentPlan(seed,variant),ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let z=Math.max(oz,p.z-3);z<Math.min(oz+SIZE,p.z+p.depth);z++)
 for(let x=Math.max(ox,p.x);x<Math.min(ox+SIZE,p.x+p.width);x++)
 for(let y=p.base;y<p.base+p.floors*6&&y<HEIGHT;y++){
  let part=partAt(p,x,y,z);
  if(z<p.z&&x>=p.x+4&&x<=p.x+6)
   part=y===p.base?{id:B.CONCRETE}:y===p.base+1?{id:B.FLOOR_FINISH}:null;
  if(!part)continue;
  const lx=x-ox,lz=z-oz,index=(y*SIZE+lz)*SIZE+lx;
  chunk.data[index]=part.id;
  if(part.style){
   if(!chunk.styles)chunk.styles=new Uint8Array(chunk.data.length);
   chunk.styles[index]=part.style;
  }
 }
 chunk.dirty=true;return chunk;
}
