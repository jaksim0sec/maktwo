import {BLOCK as B,BLOCKS} from './blocks.js';
import {partById} from './part-library.js';

const DIRECTIONS=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
export function panelKind(id) {
 if(id===B.WINDOW_NS||id===B.WINDOW_EW)return 'window';
 if(id===B.THIN_WALL_NS||id===B.THIN_WALL_EW)return 'wall';
 const family=partById(id)?.family;
 return family==='window'||family==='wall'||family==='partition'?family:null;
}

export function panelDirection(id,state) {
 if(id===B.WINDOW_NS||id===B.WINDOW_EW||id===B.THIN_WALL_NS||id===B.THIN_WALL_EW){
  const turn=state?.panelTurn??(id===B.WINDOW_EW||id===B.THIN_WALL_EW?2:0);
  return ((-turn)%4+4)%4;
 }
 return (state?.facing??0)&7;
}

// Ends are directions from the cell centre. A diagonal may bend to the
// centre of a shared face if a straight panel enters that face.
export function panelJoints(id,state,neighborAt) {
 const direction=panelDirection(id,state),kind=panelKind(id);
 const end=d=>{
  const [x,z]=DIRECTIONS[d];
  if(d&1){
   const diagonal=neighborAt(x,0,z);
   if(diagonal.kind&&(diagonal.direction&3)===(d&3))return {direction:d,joined:true};
   for(const side of [(d+7)&7,(d+1)&7]){
    const [dx,dz]=DIRECTIONS[side],other=neighborAt(dx,0,dz);
    if(other.kind&&(other.direction&3)===(side&3))return {direction:side,joined:true};
   }
   return {direction:d,joined:false};
  }
  const other=neighborAt(x,0,z);
  const aligned=other.kind&&((other.direction&1)||(other.direction&3)===(d&3));
  const solid=BLOCKS[other.id]?.opaque&&(!other.form||other.form>=3&&other.form<=6);
  return {direction:d,joined:Boolean(aligned||solid)};
 };
 const left=end((direction+4)&7),right=end(direction);
 const vertical=dy=>{
  if(kind!=='window')return false;
  const other=neighborAt(0,dy,0);
  return other.kind===kind&&(other.direction&3)===(direction&3);
 };
 return {left,right,bottom:vertical(-1),top:vertical(1)};
}

export function panelNeighbor(id,state,form=0){
 const kind=panelKind(id);
 return {id,kind,direction:kind?panelDirection(id,state):0,form};
}

export function panelPoint(x,z,joints,left=x<.5){
 const end=left?joints.left:joints.right;
 const [dx,dz]=DIRECTIONS[end.direction];
 const length=dx&&dz?Math.SQRT1_2:1;
 const sign=left?-1:1;
 const reach=Math.abs(x-.5);
 const [lx,lz]=DIRECTIONS[joints.left.direction], [rx,rz]=DIRECTIONS[joints.right.direction];
 const midX=(lz-rz)*.5,midZ=(rx-lx)*.5;
 const blend=Math.min(1,reach*4),depth=z-.5;
 return [.5+dx*reach+depth*(midX*(1-blend)-dz*sign*length*blend),
  .5+dz*reach+depth*(midZ*(1-blend)+dx*sign*length*blend)];
}
