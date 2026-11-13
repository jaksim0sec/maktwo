import {BLOCK as B,BLOCKS} from '../core/blocks.js';
import {partById} from '../core/part-library.js';
import {partPrisms,prismFaces,prismNormal} from '../core/part-prisms.js';
import {stampStationTrainColumn,stampTrainCoupler} from '../worldgen/station-train.js';
import {materialFor} from './textures.js';
import {rgb,quad} from './mesher.js';

// Opaque carbody, glass and the two sliding leaf directions each own one GPU buffer.
// All vertices are local to the train origin, allowing cheap movement with one uniform.
const FACES=[
 [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
 [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
 [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
 [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
 [[1,0,1],[1,1,1],[0,1,1],[0,0,1]],
 [[0,0,0],[0,1,0],[1,1,0],[1,0,0]]
];
const SHADE=[.78,.74,1,.56,.88,.82];
export const TRAIN_DOOR_TRAVEL=.88;
const CAR_PART_TEMPLATES=new Map();
export function stationTrainMesh(train){
 const opaque=[],transparent=[],doorA=[],doorB=[],doorAGlass=[],doorBGlass=[];
 const box=(into,x,y,z,w,h,d,id)=>{
  const color=rgb(BLOCKS[id].color),material=materialFor(id,0);
  for(let face=0;face<6;face++)
   quad(into,FACES[face].map(([a,b,c])=>[x+a*w,y+b*h,z+c*d]),color,SHADE[face]+4*material);
 };
 const panel=(into,along,height,cross,width,h,depth,id)=>{
  // Shared local orientation for east-west and north-south trains.
  if(train.axis==='x')box(into,along,height,cross,width,h,depth,id);
  else box(into,cross,height,along,depth,h,width,id);
 };
 // Shared per-part templates are computed once, not clipped and textured
 // hundreds of times for identical carriage modules or repeated train entities.
 const append=(dest,data,x,y,z)=>{
  for(let i=0;i<data.length;i+=7)
   dest.push(data[i]+x,data[i+1]+y,data[i+2]+z,data[i+3],data[i+4],data[i+5],data[i+6]);
 };
 const emit=(x,y,z,id,facing=0)=>{
  if(id===B.STATION_TRAIN_RUBBER||id===B.PART_STATION_TRAINWALL_5)return;
  if(id===B.PART_STATION_TRAINWALL_3||id===B.PART_STATION_TRAINWALL_4)return;
  const px=x-train.x,py=y-train.floorY,pz=z-train.z;
  if(!partById(id)){box(opaque,px,py,pz,1,1,1,id);return}
  const key=id*8+(facing&7);
  let template=CAR_PART_TEMPLATES.get(key);
  if(!template){
   const solid=[],glass=[];
   for(const prism of partPrisms(id,0,0,0,{facing})||[]){
    const color=rgb(BLOCKS[prism.material].color),target=prism.alpha?glass:solid;
    for(const face of prismFaces(prism)){
     const normal=prismNormal(face);if(!normal)continue;
     quad(target,face,color,.74+.26*Math.abs(normal[1])+4*materialFor(prism.material,0));
    }
   }
   template={solid:new Float32Array(solid),glass:new Float32Array(glass)};
   CAR_PART_TEMPLATES.set(key,template);
  }
  append(opaque,template.solid,px,py,pz);
  append(transparent,template.glass,px,py,pz);
 };
 for(let along=train.start-1;along<=train.end+1;along++)
  for(let cross=-(train.width-1)/2;cross<=(train.width-1)/2;cross++){
   const x=train.axis==='x'?train.x+along:train.x+cross;
   const z=train.axis==='x'?train.z+cross:train.z+along;
   const put=(y,id,facing)=>emit(x,y,z,id,facing);
   stampStationTrainColumn(train,x,z,put);
   stampTrainCoupler(train,x,z,put);
  }
 // One continuous roof and floor rather than 185 individual voxel roofs.
 // Roof underside y=3 is precisely flush with the upper sidewall top.
 const span=train.end-train.start+1,half=(train.width-1)/2;
 const horizontal=(a,y,c,w,h,d,mat)=>panel(opaque,a,y,c,w,h,d,mat);
 horizontal(train.start,0,-half+1,span,1,train.width-2,B.STATION_TRAIN_RUBBER);
 horizontal(train.start,3,-half,span,.19,train.width,B.STATION_TRAIN_ENAMEL);
 for(const cross of [-half+.18,0,half-.18])
  horizontal(train.start,3.19,cross,span,.045,.09,B.STATION_TRAIN_CORRUGATED);
 for(const car of train.carriages){
  for(let position=car.from+2;position<car.to-1;position+=7)
   horizontal(position,3.19,-.40,1.4,.10,.8,B.STATION_STATION_GRILLE);
 }
 // Two doorways per car on each side: eight paired openings for two cars.
 // Door frames are static, leaf meshes shift left/right, leaving a true opening.
 for(const car of train.carriages)for(const [from] of car.doors)for(const side of [-1,1]){
  const across=side*half+.465,inner=across-side*.075;
  const fixed=(along,y,w,h,d,id)=>panel(opaque,along,y,across,w,h,d,id);
  fixed(from,1.04,2,.09,.09,B.STATION_TRAIN_DOOR_STEEL); // threshold
  fixed(from,2.90,2,.10,.09,B.STATION_TRAIN_DOOR_STEEL); // upper lintel
  for(const x of [from+.015,from+1.93])fixed(x,1.11,.055,1.79,.10,B.STATION_TRAIN_ENAMEL);
  for(let leaf=0;leaf<2;leaf++){
   const x=from+leaf+.06,wall=leaf?doorB:doorA,glass=leaf?doorBGlass:doorAGlass;
   const sheet=(start,y,w,h,d,id)=>panel(wall,start,y,inner,w,h,d,id);
   sheet(x,1.12,.88,.97,.072,B.STATION_TRAIN_DOOR_STEEL);
   sheet(x,2.69,.88,.20,.072,B.STATION_TRAIN_DOOR_STEEL);
   for(const edge of [x,x+.82])sheet(edge,2.10,.06,.60,.072,B.STATION_TRAIN_ENAMEL);
   panel(glass,x+.06,2.11,inner+.015,.76,.56,.038,B.STATION_TRAIN_SMOKED_GLASS);
   sheet(x+.03,2.07,.82,.04,.075,B.STATION_TRAIN_ENAMEL);
   sheet(x+.03,2.68,.82,.03,.075,B.STATION_TRAIN_ENAMEL);
   sheet(leaf?x+.09:x+.73,1.54,.04,.28,.087,B.STATION_TRAIN_RUBBER);
  }
 }
 return {
  opaque:new Float32Array(opaque),transparent:new Float32Array(transparent),
  doorA:new Float32Array(doorA),doorB:new Float32Array(doorB),
  doorAGlass:new Float32Array(doorAGlass),doorBGlass:new Float32Array(doorBGlass)
 };
}
