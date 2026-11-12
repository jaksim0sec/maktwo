import {FORMED,formedOverlap} from './construction.js';
import {block,BLOCK as B,itemId} from './blocks.js';
import {isDoor,doorIntersectsBody} from './door.js';
export const isStairs=id=>id===B.STONE_STAIRS||id===B.WOOD_STAIRS||id===B.CONCRETE_STAIRS;
export const isSlab=id=>id===B.STONE_SLAB||id===B.WOOD_SLAB||id===B.CONCRETE_SLAB||id===B.UPPER_STAIR_TREAD||id===B.FLOOR_FINISH||id===B.CEILING_FINISH;
export const isPanel=id=>itemId(id)===B.WINDOW_NS||itemId(id)===B.THIN_WALL_NS;
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
 if(isPanel(id)&&state.panelTurn!==undefined){
  const base=itemId(id);
  id=(state.panelTurn&2)?(base===B.WINDOW_NS?B.WINDOW_EW:B.THIN_WALL_EW):base;
 }
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
 if(id===B.WINDOW_NS||id===B.WINDOW_EW){
  const variant=Math.max(0,Math.min(5,state.variant||0));
  const left=variant===2?.30:.12,right=variant===2?.70:.88;
  const low=variant===5?.43:.12,high=variant===5?.84:.88;
  const parts=[
   {x:x+left,y:y+low,z:z+.47,w:right-left,h:high-low,d:.06},
   {x,y,z:z+.39,w:left+.02,h:1,d:.22},
   {x:x+right-.02,y,z:z+.39,w:1-right+.02,h:1,d:.22},
   {x,y:y+.86,z:z+.39,w:1,h:.14,d:.22},
   {x,y,z:z+.39,w:1,h:.14,d:.22},
  ];
  if(variant===3)for(const offset of [.35,.65])parts.push({x:x+offset,y:y+.12,z:z+.40,w:.05,h:.76,d:.2});
  if(variant===4)parts.push({x:x+.12,y:y+.54,z:z+.40,w:.76,h:.06,d:.2});
  if(variant===5){
   parts.push({x:x+.12,y:y+.14,z:z+.40,w:.76,h:.28,d:.2});
   parts.push({x:x+.12,y:y+.41,z:z+.40,w:.76,h:.055,d:.2});
  }
  return id===B.WINDOW_EW?rotateBoxes(parts,x,z,1):parts;
 }
 if(id===B.CHAIR){
  return rotateBoxes([{x:x+.13,y:y+.39,z:z+.13,w:.74,h:.17,d:.74},{x:x+.13,y:y+.55,z:z+.73,w:.74,h:.42,d:.14},...[.16,.69].flatMap(dx=>[.16,.69].map(dz=>({x:x+dx,y,z:z+dz,w:.15,h:.41,d:.15})))],x,z,facing);
 }
 if(id===B.FLOWER_POT)return [{x:x+.29,y,z:z+.29,w:.42,h:.38,d:.42}];
 return null;
}
// Rotate each panel part, stretch along the diagonal, and clip it to its voxel.
// The precomputed prisms are shared by the worker, picking and body collision.
const diagonalPanels=new Map();
function clipFootprint(points,axis,limit,sign){
 const output=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  const da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;
  if(da<=0)output.push(a);
  if(da*db<0){
   const t=da/(da-db);
   output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  }
 }
 return output;
}
function diagonalPart({x,y,z,w,h,d},turn){
 const sign=turn===1?1:-1;
 let footprint=[[x,z],[x+w,z],[x+w,z+d],[x,z+d]].map(([a,b])=>[
  .5+(a-.5)+(b-.5)*Math.SQRT1_2*sign,
  .5-(a-.5)*sign+(b-.5)*Math.SQRT1_2,
 ]);
 for(const axis of [0,1]){
  footprint=clipFootprint(footprint,axis,0,-1);
  footprint=clipFootprint(footprint,axis,1,1);
 }
 const bottom=footprint.map(([a,b])=>[a,y,b]),top=footprint.map(([a,b])=>[a,y+h,b]);
 const faces=[{points:[...top].reverse(),normal:[0,1,0],material:2},{points:bottom,normal:[0,-1,0],material:3}];
 const axes=[[1,0],[0,1]];
 for(let i=0;i<footprint.length;i++){
  const j=(i+1)%footprint.length,dx=footprint[j][0]-footprint[i][0],dz=footprint[j][1]-footprint[i][1],length=Math.hypot(dx,dz);
  if(length<1e-10)continue;
  const a=dz/length,b=-dx/length;
  faces.push({points:[bottom[i],top[i],top[j],bottom[j]],normal:[a,0,b],material:0});
  axes.push([a,b]);
 }
 const ranges=axes.map(([a,b])=>{
  const projections=footprint.map(([px,pz])=>a*px+b*pz);
  return [a,b,Math.min(...projections),Math.max(...projections)];
 });
 return {faces,y,h,ranges};
}
export function diagonalPanel(id,state){
 const turn=state?.panelTurn&3;
 if(!(turn&1))return null;
 const base=itemId(id),key=base*4+turn;
 if(!diagonalPanels.has(key))diagonalPanels.set(key,shapeBoxes(base,0,0,0).map(box=>diagonalPart(box,turn)));
 return diagonalPanels.get(key);
}
function overlapsPanel(parts,x,y,z,body,epsilon){
 const half=(body.width||.6)/2-epsilon;
 const bx=body.x-x,bz=body.z-z,by=body.y-y;
 return parts.some(part=>by+(body.height||1.8)-epsilon>part.y&&by+epsilon<part.y+part.h&&
  part.ranges.every(([a,b,min,max])=>{
   const mid=a*bx+b*bz,radius=half*(Math.abs(a)+Math.abs(b));
   return mid+radius>min&&mid-radius<max;
  }));
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
 const state=isStairs(id)||isSlab(id)||id===B.CHAIR||isPanel(id)?world.getShapeState?.(x,y,z):undefined;
 const diagonal=isPanel(id)?diagonalPanel(id,state):null;
 if(diagonal)return overlapsPanel(diagonal,x,y,z,body,epsilon);
 const boxes=shapeBoxes(id,x,y,z,state);if(boxes)return boxes.some(b=>bodyOverlapsBox(body,b,epsilon));
 if(id===B.FENCE)return fenceBoxes(x,y,z).some(b=>bodyOverlapsBox(body,b,epsilon));
 return bodyOverlapsBox(body,{x,y,z,w:1,h:1,d:1},epsilon);
}
