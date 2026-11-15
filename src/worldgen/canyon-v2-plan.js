// Experimental spatial planner. It does not yet stamp blocks or replace the saved generator.
import {hash,noise} from '../util/math.js';

const TYPES=['apartment','market','housing','industrial'];
const spec={apartment:[34,68,5,13],market:[26,48,2,5],housing:[17,30,2,5],industrial:[30,55,2,6]};

// Each level is indexed independently, so extending the world vertically is deterministic.
export function planCanyonLevel(seed,level,{length=720,cell=48}={}) {
 if(!Number.isInteger(level)||!Number.isFinite(length)||length<=0||!Number.isFinite(cell)||cell<24)throw new RangeError('Invalid canyon dimensions');
 const count=Math.floor(length/cell),buildings=[],terraces=[],connections=[];
 const rand=(a,b,c=0)=>hash(a,level*197+b,c,seed);
 for(const side of [-1,1]){
  for(let i=0;i<count;i++){
   const z=(i-count/2)*cell;
   const bend=noise(i/5,level/4,seed)*30;
   const edge=side*(65+Math.round(rand(i,1,side)*35)+bend);
   const elevation=level*105+Math.round((noise(i/3,side*2+level,seed+7)*19+rand(i,2,side)*12)/4)*4;
   const depth=42+Math.floor(rand(i,3,side)*60);
   const district=Math.floor(i/4),kind=TYPES[Math.floor(hash(district,level,side,seed+39)*TYPES.length)];
   const [minW,maxW,minF,maxF]=spec[kind];
   const width=Math.min(cell-5,minW+Math.floor(rand(i,4,side)*(maxW-minW)));
   const floors=minF+Math.floor(rand(i,5,side)*(maxF-minF+1));
   const id=`${level}:${side}:${i}`;
   terraces.push({id,side,x:edge,z,y:elevation,width:cell-3,depth,thickness:4+Math.floor(rand(i,6,side)*9)});
   buildings.push({id,kind,side,x:edge+side*depth*.48,z,y:elevation,width,depth:Math.min(depth-8,20+Math.floor(rand(i,7,side)*28)),floors});
   if(i>0){
    const previous=terraces[terraces.length-2];
    const dy=elevation-previous.y;
    connections.push({from:previous.id,to:id,kind:Math.abs(dy)<=4?'corridor':'stairs',heightDifference:dy});
   }
  }
 }
 // Sparse cross-canyon bridges are candidates; physical route and clearance must be validated before stamping.
 for(let i=0;i<count;i++)if(rand(i,18)<.12){
  const a=terraces[i],b=terraces[count+i];
  if(Math.abs(a.y-b.y)<=8)connections.push({from:a.id,to:b.id,kind:'bridge',heightDifference:b.y-a.y});
 }
 return {seed,level,terraces,buildings,connections};
}
