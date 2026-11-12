import {BLOCK as B,BLOCKS} from '../core/blocks.js';
import {SIZE,HEIGHT} from '../core/chunk.js';

// Each full-size textured cube or glass block appears exactly once.
export const GALLERY_BLOCK_IDS=Object.freeze(BLOCKS.filter(b=>b.id!==B.BEDROCK&&
 (b.render==='cube'||b.render==='glass')).map(b=>b.id));
export const GALLERY_COLUMNS=10,GALLERY_SPACING=3,GALLERY_ORIGIN=4,GALLERY_Y=23;
export function galleryCoordinate(i){return {x:GALLERY_ORIGIN+(i%GALLERY_COLUMNS)*GALLERY_SPACING,
 z:GALLERY_ORIGIN+Math.floor(i/GALLERY_COLUMNS)*GALLERY_SPACING,y:GALLERY_Y};}
export function stampMaterialGallery(chunk){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(let i=0;i<GALLERY_BLOCK_IDS.length;i++){
  const {x,y,z}=galleryCoordinate(i),lx=x-ox,lz=z-oz;
  if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||y<1||y>=HEIGHT)continue;
  chunk.data[(y*SIZE+lz)*SIZE+lx]=GALLERY_BLOCK_IDS[i];
 }
 chunk.dirty=true;return chunk;
}
