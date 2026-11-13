import {SIZE} from '../core/chunk.js';
import {BLOCK as B} from '../core/blocks.js';
import {TREE_BLOCKS,FALLEN_LEAF_BLOCKS} from '../core/tree-assets.js';
import {hash} from '../util/math.js';

// A deterministic showroom allows judging the actual GPU silhouettes before
// harvest, growth or biome rules are introduced.
export const ARBORETUM_MODE='arboretum';
export const ARBORETUM_SPAWN=Object.freeze({x:0.5,y:23,z:19.5});
export const TREE_SHOWCASE=Object.freeze(TREE_BLOCKS.map((tree,i)=>Object.freeze({
 x:-33+i*22,z:0,kind:i,id:tree.id,litter:FALLEN_LEAF_BLOCKS[i].id
})));
export function stampArboretum(chunk,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 const put=(lx,y,lz,id,style=0)=>{
  if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||y<0||y>=chunk.height)return;
  const idx=(y*SIZE+lz)*SIZE+lx;chunk.data[idx]=id;
  if(style){chunk.styles??=new Uint8Array(chunk.data.length);chunk.styles[idx]=style}
 };
 for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++){
  const x=ox+lx,z=oz+lz,ax=Math.abs(x),az=Math.abs(z);
  if(x< -48||x>48||z< -16||z>29)continue;
  put(lx,0,lz,B.BEDROCK);
  put(lx,21,lz,B.CONCRETE);
  const cell=hash(Math.floor(x/3),2,Math.floor(z/3),seed);
  put(lx,22,lz,cell>.91?B.MOSS:cell>.78?B.CRACKED_CONCRETE:cell<.05?B.WET_TILE:B.FLOOR_TILE);
  // Weathered perimeter ruins, never blocking crowns or the walking aisle.
  if((ax>=46||az>=15&&z<0)&&(Math.abs(x)%8===0||Math.abs(z)%8===0)&&z<0){
   const h=2+Math.floor(hash(x,0,z,seed+70)*3);
   for(let y=23;y<23+h;y++)put(lx,y,lz,y===23?B.RUSTED_METAL:B.CRACKED_CONCRETE);
  }
  for(const t of TREE_SHOWCASE){
   const dx=x-t.x,dz=z-t.z,d2=dx*dx+dz*dz;
   if(d2===0){
    put(lx,23,lz,t.id,t.kind+1);break;
   }
   if(d2<36&&hash(x,6,z,seed+t.kind*41)>.67){
    put(lx,23,lz,t.litter,((x+2*z+t.kind)&3)+1);break;
   }
  }
 }
 chunk.dirty=true;return chunk;
}

// This lookup is constant-time per column. Only v9's existing wide cross
// routes receive trees; earlier city layouts and building footprints stay intact.
// Trees stand near the road shoulders, leaving the central travel lane open.
export function roadsideTreeCell(wx,wz,layout,seed){
 const x=Math.floor(wx),z=Math.floor(wz),ax=Math.abs(x),az=Math.abs(z);
 const alongX=ax>=az,major=alongX?ax:az,minor=alongX?z:x;
 const side=Math.sign(minor)||1;
 const aisle=Math.floor(layout.roadHalfWidth*.56);
 const center=30+66*Math.round((major-30)/66);
 if(center<layout.centerRadius+30||center>layout.miniShaftOffset-46)return null;
 const dx=major-center,dz=minor-side*aisle,d2=dx*dx+dz*dz;
 if(d2>32)return null;
 const plot=Math.round((center-30)/66),kind=(plot+(alongX?0:1)+(x<0?2:0)+(z<0?1:0))&3;
 const trunk=dx===0&&dz===0;
 if(!trunk&&hash(x,12,z,seed+991+kind*47)<.70)return null;
 const variant=(plot+kind+(alongX?0:2))&3;
 return {id:trunk?TREE_BLOCKS[kind].id:FALLEN_LEAF_BLOCKS[kind].id,
  kind,variant,trunk};
}
