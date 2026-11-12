import {block,BLOCK as B} from './blocks.js';
import {isDoor,doorIntersectsBody} from './door.js';
export const isStairs=id=>id===B.STONE_STAIRS||id===B.WOOD_STAIRS;
export const isSlab=id=>id===B.STONE_SLAB||id===B.WOOD_SLAB;
export function shapeBoxes(id,x,y,z,state={}){
 const facing=((state.facing||0)%4+4)%4;
 if(isSlab(id))return [{x,y:y+(state.upper?.5:0),z,w:1,h:.5,d:1}];
 if(isStairs(id)){
  const riser=facing===0?{x,y:y+.5,z:z+.5,w:1,h:.5,d:.5}:facing===1?{x:x+.5,y:y+.5,z,w:.5,h:.5,d:1}:facing===2?{x,y:y+.5,z,w:1,h:.5,d:.5}:{x,y:y+.5,z,w:.5,h:.5,d:1};
  return [{x,y,z,w:1,h:.5,d:1},riser];
 }
 if(id===B.CHAIR)return [{x:x+.13,y:y+.39,z:z+.13,w:.74,h:.17,d:.74},{x:x+.13,y:y+.55,z:z+.73,w:.74,h:.42,d:.14},...[.16,.69].flatMap(dx=>[.16,.69].map(dz=>({x:x+dx,y,z:z+dz,w:.15,h:.41,d:.15})))];
 if(id===B.FLOWER_POT)return [{x:x+.29,y,z:z+.29,w:.42,h:.38,d:.42}];
 return null;
}
export function fenceBoxes(x,y,z){return [
 {x:x+.41,y,z:z+.41,w:.18,h:1,d:.18},
 {x:x+.10,y:y+.33,z:z+.44,w:.80,h:.13,d:.12},
 {x:x+.10,y:y+.72,z:z+.44,w:.80,h:.13,d:.12},
 {x:x+.44,y:y+.33,z:z+.10,w:.12,h:.13,d:.80},
 {x:x+.44,y:y+.72,z:z+.10,w:.12,h:.13,d:.80}
]}
export function bodyOverlapsBox(body,b,epsilon=1e-5){const r=(body.width||.6)/2,h=body.height||1.8;
 return body.x+r-epsilon>b.x&&body.x-r+epsilon<b.x+b.w
 &&body.z+r-epsilon>b.z&&body.z-r+epsilon<b.z+b.d
 &&body.y+h-epsilon>b.y&&body.y+epsilon<b.y+b.h;
}
export function solidBlockOverlap(world,x,y,z,id,body,epsilon=1e-5){
 if(!block(id).solid)return false;
 if(isDoor(id))return doorIntersectsBody(x,id===B.DOOR_TOP?y-1:y,z,world.getDoorState?.(x,y,z),body,epsilon);
 const boxes=shapeBoxes(id,x,y,z,world.getShapeState?.(x,y,z));if(boxes)return boxes.some(b=>bodyOverlapsBox(body,b,epsilon));
 if(id===B.FENCE)return fenceBoxes(x,y,z).some(b=>bodyOverlapsBox(body,b,epsilon));
 return bodyOverlapsBox(body,{x,y,z,w:1,h:1,d:1},epsilon);
}
