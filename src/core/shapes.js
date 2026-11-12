import {block,BLOCK as B} from './blocks.js';
import {isDoor,doorIntersectsBody} from './door.js';
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
 if(id===B.FENCE)return fenceBoxes(x,y,z).some(b=>bodyOverlapsBox(body,b,epsilon));
 return bodyOverlapsBox(body,{x,y,z,w:1,h:1,d:1},epsilon);
}
