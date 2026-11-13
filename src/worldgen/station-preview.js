// Standalone view of the same track, platform and hall that the city uses.
import {BLOCK as B} from '../core/blocks.js';
import {SIZE,TURN_STYLE} from '../core/chunk.js';
import {stampStationHall} from './eternal-night-station-build.js';

export const STATION_PREVIEW_MODE='station-preview';
export const STATION_PREVIEW_SITE=Object.freeze({
 id:'preview',axis:'x',x:0,z:0,y:23,bounds:{x0:-36,x1:36,z0:-10,z1:10},exits:[]
});
export const STATION_PREVIEW_SPAWN=Object.freeze({x:1.5,y:23,z:4.5});

export function stampStationPreview(chunk,seed){
 for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++){
  const x=chunk.cx*SIZE+lx,z=chunk.cz*SIZE+lz;
  const put=(y,id,facing)=>{
   if(y<0||y>=chunk.height)return;
   const i=(y*SIZE+lz)*SIZE+lx;
   chunk.data[i]=id;
   if(facing!==undefined){
    chunk.styles??=new Uint8Array(chunk.data.length);
    chunk.styles[i]=TURN_STYLE|facing;
   }else if(chunk.styles)chunk.styles[i]=0;
  };
  stampStationHall(STATION_PREVIEW_SITE,x+.5,z+.5,put,seed);
  if(x===-34&&z>=-8&&z<-3)put(23,B.PART_STATION_TRAINRUNNING_1+z+8);
 }
 chunk.dirty=true;
 return chunk;
}
