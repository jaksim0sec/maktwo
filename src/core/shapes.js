import {FORMED,formedOverlap} from './construction.js';
import {block,BLOCK as B} from './blocks.js';
import {isDoor,doorIntersectsBody} from './door.js';
export const isStairs=id=>id===B.STONE_STAIRS||id===B.WOOD_STAIRS||id===B.CONCRETE_STAIRS;
export const isSlab=id=>id===B.STONE_SLAB||id===B.WOOD_SLAB||id===B.CONCRETE_SLAB||id===B.UPPER_STAIR_TREAD||id===B.FLOOR_FINISH||id===B.CEILING_FINISH;
// Keep the saved voxel IDs for both axes. A quarter turn swaps the pair.
const panelTurns=new Map([
 [B.WINDOW_NS,B.WINDOW_EW],[B.WINDOW_EW,B.WINDOW_NS],
 [B.THIN_WALL_NS,B.THIN_WALL_EW],[B.THIN_WALL_EW,B.THIN_WALL_NS],
]);
export const rotatePanel=(id,turns)=>(turns&1)?(panelTurns.get(id)??id):id;
export function rotateCellXZ(x,z,facing){
 switch(facing&3){
  case 1:return [z,1-x];
  case 2:return [1-x,1-z];
  case 3:return [1-z,x];
  default:return [x,z];
 }
}
function rotateBoxes(boxes,x,z,facing){
 if(!facing)return boxes;
 return boxes.map(box=>{
  const [ax,az]=rotateCellXZ(box.x-x,box.z-z,facing);
  const [bx,bz]=rotateCellXZ(box.x-x+box.w,box.z-z+box.d,facing);
  return {...box,x:x+Math.min(ax,bx),z:z+Math.min(az,bz),w:Math.abs(bx-ax),d:Math.abs(bz-az)};
 });
}
export function shapeBoxes(id,x,y,z,state={}){
 const facing=((state.facing||0)%4+4)%4;
 if(id===B.UPPER_STAIR_TREAD)return rotateBoxes([
   {x,y:y+.5,z,w:1,h:.5,d:1},
   {x:x+.04,y:y+.95,z:z+.002,w:.92,h:.045,d:.09}
  ],x,z,facing);
 if(id===B.FLOOR_FINISH)return [{x,y,z,w:1,h:.5,d:1}];
 if(id===B.CEILING_FINISH)return [{x,y:y+.5,z,w:1,h:.5,d:1}];
 if(isSlab(id))return [{x,y:y+(state.upper?.5:0),z,w:1,h:.5,d:1}];
 if(isStairs(id)){
  const riser=facing===0?{x,y:y+.5,z:z+.5,w:1,h:.5,d:.5}:facing===1?{x:x+.5,y:y+.5,z,w:.5,h:.5,d:1}:facing===2?{x,y:y+.5,z,w:1,h:.5,d:.5}:{x,y:y+.5,z,w:.5,h:.5,d:1};
  if(id===B.CONCRETE_STAIRS)return [
    {x,y,z,w:1,h:.5,d:1},riser,
    {x:x+.03,y:y+.94,z:z+.03,w:.94,h:.045,d:.94}
   ];
  return [{x,y,z,w:1,h:.5,d:1},riser];
 }
 // These architectural blocks are only partial-depth geometry. The exact same
 // AABBs are used for physics, selection and the worker-built mesh.
 if(id===B.THIN_WALL_NS)return [{x,y,z:z+.34,w:1,h:1,d:.32}];
 if(id===B.THIN_WALL_EW)return [{x:x+.34,y,z,w:.32,h:1,d:1}];
 if(id===B.WINDOW_NS)return [
  {x:x+.12,y:y+.12,z:z+.47,w:.76,h:.76,d:.06},
  {x,y,z:z+.39,w:.14,h:1,d:.22},{x:x+.86,y,z:z+.39,w:.14,h:1,d:.22},
  {x,y:y+.86,z:z+.39,w:1,h:.14,d:.22},{x,y,z:z+.39,w:1,h:.14,d:.22}];
 if(id===B.WINDOW_EW)return [
  {x:x+.47,y:y+.12,z:z+.12,w:.06,h:.76,d:.76},
  {x:x+.39,y,z,w:.22,h:1,d:.14},{x:x+.39,y,z:z+.86,w:.22,h:1,d:.14},
  {x:x+.39,y:y+.86,z,w:.22,h:.14,d:1},{x:x+.39,y,z,w:.22,h:.14,d:1}];
 if(id===B.CHAIR){
  return rotateBoxes([{x:x+.13,y:y+.39,z:z+.13,w:.74,h:.17,d:.74},{x:x+.13,y:y+.55,z:z+.73,w:.74,h:.42,d:.14},...[.16,.69].flatMap(dx=>[.16,.69].map(dz=>({x:x+dx,y,z:z+dz,w:.15,h:.41,d:.15})))],x,z,facing);
 }
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
export function solidBlockOverlap(world,x,y,z,id,body,epsilon=1e-5,form=world.getForm?.(x,y,z)){
 if(!block(id).solid)return false;
 if(FORMED[form])return formedOverlap(FORMED[form],x,y,z,body,epsilon);
 if(isDoor(id))return doorIntersectsBody(x,id===B.DOOR_TOP?y-1:y,z,world.getDoorState?.(x,y,z),body,epsilon);
 const state=isStairs(id)||isSlab(id)||id===B.CHAIR?world.getShapeState?.(x,y,z):undefined;
 const boxes=shapeBoxes(id,x,y,z,state);if(boxes)return boxes.some(b=>bodyOverlapsBox(body,b,epsilon));
 if(id===B.FENCE)return fenceBoxes(x,y,z).some(b=>bodyOverlapsBox(body,b,epsilon));
 return bodyOverlapsBox(body,{x,y,z,w:1,h:1,d:1},epsilon);
}
