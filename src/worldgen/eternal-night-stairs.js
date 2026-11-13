// Generated stairs store a deck height or two half-cell tread heights,
// plus the facing and outer rail, in the chunk style byte.
import {CITY_STAIR_STYLE,CITY_STAIR_LEVEL_MASK,EXTERIOR_STYLE,TURN_STYLE} from '../core/chunk.js';
export {CITY_STAIR_STYLE};

export function encodeCityStair(surface,orientation,rail=false){
 const base=Math.ceil(surface-1e-6)-1;
 const height=Math.max(.001,Math.min(1,surface-base));
 const quarter=Math.min(3,Math.max(0,Math.round(height*4)-1));
 return {base,quarter,height:(quarter+1)/4,facing:((orientation%8)+8)%8,rail};
}

export function decodeCityStair(style){
 if(!(style&CITY_STAIR_STYLE))return null;
 const split=decodeSplitTread(style);
 if(split)return {height:split.high,rail:split.rail,facing:split.facing};
 return {height:((style&CITY_STAIR_LEVEL_MASK)>>3|0)*.25+.25,
  rail:!!(style&64),facing:style&7};
}

// Building flights are cardinal, leaving one facing bit free. Generated stair
// voxels without TURN_STYLE use it plus the two height bits for a half-cell profile.
const SPLIT_PROFILES=[[0,1],[0,2],[1,2],[1,3],[2,3],[2,4],[3,4],[0,3]];
export function encodeSplitTread(low,high,facing,rail=false) {
 const pair=SPLIT_PROFILES.findIndex(([a,b])=>a===low&&b===high);
 if(pair<0)throw new RangeError(`Invalid city stair profile ${low},${high}`);
 return CITY_STAIR_STYLE|(facing&6)|(pair&1)|((pair>>1)<<3)|(rail?EXTERIOR_STYLE:0);
}

export function decodeSplitTread(style) {
 if(!(style&CITY_STAIR_STYLE)||(style&TURN_STYLE))return null;
 const index=((style&CITY_STAIR_LEVEL_MASK)>>2)|(style&1);
 const [low,high]=SPLIT_PROFILES[index];
 return {index,low:low/4,high:high/4,facing:style&6,rail:Boolean(style&EXTERIOR_STYLE)};
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
