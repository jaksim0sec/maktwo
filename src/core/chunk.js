export const SIZE=16,HEIGHT=64;
export class Chunk{
 constructor(cx,cz){this.cx=cx;this.cz=cz;this.data=new Uint8Array(SIZE*SIZE*HEIGHT);this.dirty=true;this.revision=0}
 static index(x,y,z){return (y*SIZE+z)*SIZE+x}
 get(x,y,z){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=HEIGHT)return 0;return this.data[Chunk.index(x,y,z)]}
 set(x,y,z,id){if(x<0||x>=SIZE||z<0||z>=SIZE||y<0||y>=HEIGHT)return false;const i=Chunk.index(x,y,z);if(this.data[i]===id)return false;this.data[i]=id;this.dirty=true;this.revision++;return true}
}
