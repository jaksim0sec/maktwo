// Axis-aligned two-block doors. Saved orientation and open state are kept separate
// from block IDs so old worlds and future interactive props remain extensible.
export const DOOR_HEIGHT=1.94;
export function doorBounds(x,z,facing=0,open=false){
 const bands=[
  {x:.08,z:.07,w:.84,d:.14}, // north: across X
  {x:.79,z:.08,w:.14,d:.84}, // east: across Z
  {x:.08,z:.79,w:.84,d:.14}, // south
  {x:.07,z:.08,w:.14,d:.84}  // west
 ];
 const i=(((facing|0)%4)+4)%4;
 // An opened panel folds flush against a jamb, leaving enough room for a
 // player in the 0.8m block scale. The closed panel keeps its usual silhouette.
 const opened=[
  {x:.01,z:.07,w:.09,d:.84}, // north swings toward west
  {x:.08,z:.01,w:.84,d:.09}, // east swings toward north
  {x:.90,z:.08,w:.09,d:.84}, // south swings toward east
  {x:.08,z:.90,w:.84,d:.09}  // west swings toward south
 ];
 const b=open?opened[i]:bands[i];
 return{x:x+b.x,z:z+b.z,w:b.w,d:b.d};
}
// Single source of truth for thin-slab geometry, used by both collision
// checks and state transitions. Positions are in logical voxel units.
export function doorIntersectsBody(x,y,z,state,body,epsilon=1e-5){
 const bounds=doorBounds(x,z,state?.facing||0,Boolean(state?.open));
 const half=(body.width||.6)*.5;
 return body.x+half-epsilon>bounds.x && body.x-half+epsilon<bounds.x+bounds.w
  && body.z+half-epsilon>bounds.z && body.z-half+epsilon<bounds.z+bounds.d
  && body.y+(body.height||1.8)-epsilon>y+.04 && body.y+epsilon<y+.04+DOOR_HEIGHT;
}
export const isDoor=id=>id===18||id===19;
