// Deterministic museum-scale abandoned metro assembly, separate from city generation.
// Every object is composed from the same registered blocks available in Creative.
import {BLOCK as B} from '../core/blocks.js';
import {SIZE} from '../core/chunk.js';
import {hash} from '../util/math.js';
export const STATION_PREVIEW_MODE='station-preview';
export const STATION_PREVIEW_SPAWN=Object.freeze({x:1.5,y:24,z:10.5});
const T=Object.freeze({
 shell:[B.PART_STATION_TRAINWALL_1,B.PART_STATION_TRAINWALL_2,B.PART_STATION_TRAINWALL_3,B.PART_STATION_TRAINWALL_4,B.PART_STATION_TRAINWALL_5],
 furnish:[B.PART_STATION_TRAININTERIOR_1,B.PART_STATION_TRAININTERIOR_2,B.PART_STATION_TRAININTERIOR_3,B.PART_STATION_TRAININTERIOR_4,B.PART_STATION_TRAININTERIOR_5],
 track:[B.PART_STATION_TRACK_1,B.PART_STATION_TRACK_2,B.PART_STATION_TRACK_3,B.PART_STATION_TRACK_4,B.PART_STATION_TRACK_5],
 platform:[B.PART_STATION_PLATFORM_1,B.PART_STATION_PLATFORM_2,B.PART_STATION_PLATFORM_3,B.PART_STATION_PLATFORM_4,B.PART_STATION_PLATFORM_5],
 link:[B.PART_STATION_STATIONLINK_1,B.PART_STATION_STATIONLINK_2,B.PART_STATION_STATIONLINK_3,B.PART_STATION_STATIONLINK_4,B.PART_STATION_STATIONLINK_5]
});
const doorway=x=>[-10,-9,-1,0,9,10].includes(x);
const carriage=x=>x>=-18&&x<=18;
export function stampStationPreview(chunk,seed){
 const ox=chunk.cx*SIZE,oz=chunk.cz*SIZE,H=chunk.height;
 const put=(lx,y,lz,id,facing=0)=>{
  if(y<0||y>=H)return;
  const i=(y*SIZE+lz)*SIZE+lx;
  chunk.data[i]=id;
  if(facing){chunk.styles??=new Uint8Array(chunk.data.length);chunk.styles[i]=32|(facing&7)}
 };
 for(let lz=0;lz<SIZE;lz++)for(let lx=0;lx<SIZE;lx++){
  const x=ox+lx,z=oz+lz,az=Math.abs(z),ax=Math.abs(x),inside=ax<=32&&az<=21;
  const set=(y,id,facing=0)=>put(lx,y,lz,id,facing);
  if(!inside)continue;
  set(0,B.BEDROCK);
  set(18,B.CONCRETE);set(19,B.CONCRETE);set(20,B.STATION_TRACK_BALLAST);
  if(ax<=27&&az<=5){
   set(21,B.STATION_TRACK_BALLAST);
   if(az===2)set(21,T.track[2]);
   else if(x%3===0&&az<=3)set(21,T.track[1]);
   else if(az===4)set(21,T.track[3]);
   else if(az===5&&x%4===0)set(21,T.track[4]);
   else if(z===0&&x%5===0)set(21,T.track[0]);
   if(ax<=18){
    if(az<=3)set(22,B.STATION_TRAIN_RUBBER);
    if(az===4){
     set(22,B.STATION_TRAIN_ENAMEL);
     set(23,doorway(x)?T.shell[(x%2+2)%2===0?2:3]:T.shell[0],z>0?4:0);
     set(24,doorway(x)?T.shell[(x%2+2)%2===0?2:3]:T.shell[1],z>0?4:0);
    }else if(az<=3){
     if(az===3&&x%3===0&&!doorway(x))set(23,T.furnish[0],z>0?4:0);
     if(z===0&&x%3===0&&!doorway(x))set(24,T.furnish[2]);
     else if(z===0&&x%3===1)set(23,T.furnish[1]);
     if(az===3&&x%6===1)set(24,T.furnish[3]);
    }
    if(az<=4)set(25,B.STATION_TRAIN_ENAMEL);
    if(x%4===0&&az<=4)set(26,T.shell[4]);
   }else if(ax<=21&&az===4){
    set(23,T.shell[0],z>0?4:0);
    set(24,T.shell[1],z>0?4:0);
   }
   if((x===-18||x===18)&&az<=4){
    set(23,T.shell[0],2);set(24,T.shell[1],2);
    if(z===0)set(23,T.furnish[4],2);
   }
  }
  // Opposing side platforms: edge marker, tactile bumps, slate and damp grime.
  if(az>=6&&az<=18&&ax<=28){
   set(21,B.CONCRETE);
   const water=hash(x,0,z,seed+421)>.981;
   set(22,az===6?B.STATION_PLATFORM_TACTILE:az===7?B.STATION_PLATFORM_ORANGE:
    az>=16?B.STATION_STATION_SOOT:water?B.STATION_STATION_ALGAE:B.STATION_PLATFORM_STONE);
   if(az===6&&x%8===0)set(23,T.platform[0],z>0?4:0);
   if(az===8&&x%5===0)set(23,T.platform[1]);
   if(az===13&&x%12===0)set(23,T.platform[3]);
   if(az===14&&x%10===0)set(23,T.platform[4]);
   if(az===12&&x%9===0)set(23,T.link[0],z>0?4:0);
   // Columns and vaulted concrete canopy with accessible concourse space.
   if(az===16&&x%8===0){for(let y=23;y<=30;y++)set(y,B.STATION_STATION_CREAM)}
   if(az>=13&&x%8===0)set(30,B.STATION_STATION_PIPE);
   if(ax<=25&&az>=10&&ax%13===0)set(28,T.platform[2],z>0?4:0);
   if(az===10&&x%10===0)set(30,B.FLUORESCENT);
   if(az===10&&x%10===5)set(30,B.BROKEN_FLUORESCENT);
  }
  if(ax<=30&&az<=18){
   // Overall station roof, with repeated open central skylights and equipment.
   if(az>=12&&az<=18){set(31,B.STATION_STATION_SOOT)}
   else if(x%8!==0||az>3)set(31,B.STATION_STATION_CREAM);
   if(x%8===0&&az<=18)set(30,B.STATION_STATION_PIPE);
   if(az===11&&x%6===0)set(29,T.link[1]);
   if(az===17&&x%7===0)set(28,T.link[2]);
  }
  // A small 20-tile material swatch wall proves every registered tile is usable.
  if(x===-30&&z>=-10&&z<10){
   set(21,B.CONCRETE);set(22,B.STATION_PLATFORM_STONE);
   set(24,188+z+10);
  }
  // Concourse circulation: an end passage leading toward a surface-access stair.
  if(x>=28&&x<=32&&z>=-9&&z<=9){
   set(21,B.CONCRETE);set(22,B.STATION_PLATFORM_STONE);
   if(x===30&&z%4===0)set(23,T.link[4]);
   if(x===31&&(z===-4||z===4))set(23,T.link[3]);
  }
  // Distinct side wall finishes, junction arches, and occasional mold/water damage.
  if(ax<=32&&(az===19||az===20)){
   for(let y=21;y<30;y++){
    const stained=hash(Math.floor(x/4),Math.floor(y/3),z,seed+29)>.74;
    set(y,stained?B.STATION_STATION_ALGAE:y>26?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM);
   }
   if(x%9===0)set(26,T.platform[2],z>0?4:0);
  }
 }
 chunk.dirty=true;return chunk;
}
