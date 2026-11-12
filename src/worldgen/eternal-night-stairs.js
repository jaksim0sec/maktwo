// Voxel encoding for a single planned stair tread.
// Existing creative parts keep their detailed independent 3-step geometry.
// Generated buildings instead use one world-aligned tread per occupied voxel;
// its top height and outside rail are captured in the chunk style byte.
import {CITY_STAIR_STYLE,CITY_STAIR_LEVEL_MASK} from '../core/chunk.js';
export {CITY_STAIR_STYLE};

export function encodeCityStair(surface,orientation,rail=false){
 const base=Math.ceil(surface-1e-6)-1;
 const height=Math.max(.001,Math.min(1,surface-base));
 const quarter=Math.min(3,Math.max(0,Math.round(height*4)-1));
 return {base,quarter,height:(quarter+1)/4,facing:((orientation%8)+8)%8,rail};
}

export function decodeCityStair(style){
 if(!(style&CITY_STAIR_STYLE))return null;
 return {height:((style&CITY_STAIR_LEVEL_MASK)>>3|0)*.25+.25,
  rail:!!(style&64),facing:style&7};
}

/** A rail belongs to the OUTER edge of a continuous flight.
 * The central edge is intentionally left open at the 180-degree landing;
 * multiple adjacent voxel cells must not each emit a complete pair of rails.
 */
export function stairOuterRail(tread,step,total,alongX,x,z){
 const first=step<total/2;
 const outer=alongX?(first?tread.z1:tread.z0):(first?tread.x0:tread.x1);
 const pos=alongX?z:x;
 return Math.abs(pos-outer)<.85;
}

/** Bridge ends are genuine landings. Rail posts begin beyond the door width
 * and must end at the same plane as the wall, instead of crossing the entry.
 */
export function walkwayJunction({along,span,width,doorDistance,sideDistance}){
 const atEnd=along<2.5||along>span-2.5;
 const open=atEnd&&doorDistance<Math.max(1.45,width*.72);
 return {open,parapet:!open&&sideDistance>Math.max(.12,width/2-.72),
  endSupport:atEnd&&!open};
}
