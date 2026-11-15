export const SIZE=16,HEIGHT=64;
export function inChunkStreamRange(dx,dz,radius,roundEdges=false){
 const ring=Math.max(Math.abs(dx),Math.abs(dz));
 return ring<=radius&&(!roundEdges||ring!==radius||Math.abs(dx)+Math.abs(dz)<=radius+1);
}
export const MESH_NEIGHBORS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
// Generated turns occupy a different byte range than the legacy variant codes.
export const TURN_STYLE=32;
export const EXTERIOR_STYLE=64;
export const CITY_DOOR_STEEL=8;
export const ROAD_MIRROR_STYLE=128;
// Reserved high bit marks a generated single-tread city stair. Legacy parts are unchanged.
export const CITY_GENERATED_STYLE=128,CITY_STAIR_STYLE=CITY_GENERATED_STYLE,CITY_STAIR_LEVEL_MASK=24;
export class Chunk{
 constructor(cx,cz,height=HEIGHT,data=new Uint8Array(SIZE*SIZE*height)){this.cx=cx;this.cz=cz;this.data=data;this.dirty=true;this.revision=0}
 get height(){return this.data.length/(SIZE*SIZE)}
 static index(x,y,z){return (y*SIZE+z)*SIZE+x}
 get(x,y,z){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=this.height)return 0;return this.data[Chunk.index(x,y,z)]}
 writeBlock(index,id){
  if(id>255&&this.data instanceof Uint8Array)this.data=Uint16Array.from(this.data);
  this.data[index]=id;
 }
 set(x,y,z,id){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=this.height)return false;const i=Chunk.index(x,y,z);if(this.data[i]===id)return false;this.writeBlock(i,id);this.dirty=true;this.revision++;return true}
}
