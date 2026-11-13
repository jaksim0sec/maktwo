import {BLOCK as B,BLOCKS} from '../core/blocks.js';
import {partById} from '../core/part-library.js';
import {partPrisms,prismFaces,prismNormal} from '../core/part-prisms.js';
import {stampStationTrainColumn,stampTrainCoupler} from '../worldgen/station-train.js';
import {materialFor} from './textures.js';
import {cube,rgb,quad} from './mesher.js';

/** Build one entity's textured mesh once, independent of chunk remeshing. */
export function stationTrainMesh(train){
 const opaque=[],transparent=[];
 const emit=(x,y,z,id,facing=0)=>{
  if(!partById(id)){
   cube(opaque,x,y,z,1,1,1,rgb(BLOCKS[id].color));return;
  }
  for(const prism of partPrisms(id,x,y,z,{facing})||[]){
   const color=rgb(BLOCKS[prism.material].color),target=prism.alpha?transparent:opaque;
   for(const face of prismFaces(prism)){
    const normal=prismNormal(face);if(!normal)continue;
    quad(target,face,color,.74+.26*Math.abs(normal[1])+4*materialFor(prism.material,0));
   }
  }
 };
 for(let along=train.start-1;along<=train.end+1;along++)for(let cross=-(train.width-1)/2;cross<=(train.width-1)/2;cross++){
  const x=train.axis==='x'?train.x+along:train.x+cross;
  const z=train.axis==='x'?train.z+cross:train.z+along;
  const put=(y,id,facing)=>emit(x,y,z,id,facing);
  stampStationTrainColumn(train,x,z,put);
  stampTrainCoupler(train,x,z,put);
 }
 return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent)};
}
