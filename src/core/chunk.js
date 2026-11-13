export const SIZE=16,HEIGHT=64;
export const MESH_NEIGHBORS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
// Generated turns occupy a different byte range than the legacy variant codes.
export const TURN_STYLE=32;
export const EXTERIOR_STYLE=64;
// Reserved high bit marks a generated single-tread city stair. Legacy parts are unchanged.
export const CITY_GENERATED_STYLE=128,CITY_STAIR_STYLE=CITY_GENERATED_STYLE,CITY_STAIR_LEVEL_MASK=24;
export class Chunk{
 constructor(cx,cz,height=HEIGHT){this.cx=cx;this.cz=cz;this.data=new Uint8Array(SIZE*SIZE*height);this.dirty=true;this.revision=0}
 get height(){return this.data.length/(SIZE*SIZE)}
 static index(x,y,z){return (y*SIZE+z)*SIZE+x}
 get(x,y,z){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=this.height)return 0;return this.data[Chunk.index(x,y,z)]}
 set(x,y,z,id){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=this.height)return false;const i=Chunk.index(x,y,z);if(this.data[i]===id)return false;this.data[i]=id;this.dirty=true;this.revision++;return true}
}
