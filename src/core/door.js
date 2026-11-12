// Axis-aligned two-block doors. Saved orientation and open state are kept separate
// from block IDs so old worlds and future interactive props remain extensible.
export const DOOR_HEIGHT=1.88;
export function doorBounds(x,z,facing=0,open=false){
 const bands=[
  {x:.08,z:.07,w:.84,d:.14}, // north: across X
  {x:.79,z:.08,w:.14,d:.84}, // east: across Z
  {x:.08,z:.79,w:.84,d:.14}, // south
  {x:.07,z:.08,w:.14,d:.84}  // west
 ];
 const i=(((facing|0)%4)+4)%4;
 const b=bands[open?(i+3)%4:i];
 return{x:x+b.x,z:z+b.z,w:b.w,d:b.d};
}
export const isDoor=id=>id===18||id===19;
