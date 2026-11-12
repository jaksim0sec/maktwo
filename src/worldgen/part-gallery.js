// One block per model, five models per family, never a composite building.
import {SIZE,HEIGHT} from '../core/chunk.js';
import {PARTS,PART_FAMILIES} from '../core/part-library.js';
export const PART_Y=23,PART_X=6,PART_DX=7,PART_Z=8,PART_DZ=9;
export function partPosition(section,variant){
 if(!Number.isInteger(section)||section<0||section>=PART_FAMILIES.length||!Number.isInteger(variant)||variant<0||variant>=5)throw new RangeError('Invalid part specimen');
 return {x:PART_X+variant*PART_DX,y:PART_Y,z:PART_Z+section*PART_DZ};
}
export function partGallerySpawn(section=0){const {z}=partPosition(section,0);return {x:20.5,y:25,z:z+5.5};}
export function stampPartGallery(chunk){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
 for(const part of PARTS){const {x,y,z}=partPosition(part.section,part.variant),lx=x-ox,lz=z-oz;
  if(lx<0||lx>=SIZE||lz<0||lz>=SIZE||y<1||y>=HEIGHT)continue;
  chunk.data[(y*SIZE+lz)*SIZE+lx]=part.id;
 }
 chunk.dirty=true;return chunk;
}
