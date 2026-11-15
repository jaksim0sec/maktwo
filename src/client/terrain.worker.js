import {Chunk} from '../core/chunk.js';
import {generateChunk} from '../worldgen/generators.js';
import {CITY_MODE,createCityPlan} from '../worldgen/eternal-night-game.js';
import {distantCityMesh} from './city-distance.js';
import {distantCanyonMeshSteps} from './canyon-distance.js';
import {CANYON_MODE} from '../worldgen/canyon-v2-plan.js';
import {canyonCore} from '../worldgen/canyon-v2-core.js';
import {cityFarMesh} from './city-far.js';

// Let incoming near-chunk requests run between expensive panorama batches.
async function buildCanyonDistance(steps){
 let deadline=performance.now()+12,step;
 for(step=steps.next();!step.done;step=steps.next()){
  if(performance.now()<deadline)continue;
  await new Promise(resolve=>setTimeout(resolve,0));
  deadline=performance.now()+12;
 }
 return step.value;
}

self.onmessage=async({data:job})=>{
 const {kind,id,cx,cz,seed,cityBlueprints}=job;
 try{
  if(kind==='prepare'){
   if(job.mode===CITY_MODE)createCityPlan(seed,cityBlueprints);
   if(job.mode===CANYON_MODE)canyonCore(seed);
   self.postMessage({kind,id});
   return;
  }
  if(kind==='chunk'){
   const chunk=generateChunk(new Chunk(cx,cz,job.height),seed,job.mode,cityBlueprints,job.yOrigin);
   const {data,styles,forms,revision}=chunk;
   const transfer=[data.buffer];
   if(styles)transfer.push(styles.buffer);
   if(forms)transfer.push(forms.buffer);
   self.postMessage({kind,id,data,styles,forms,revision},transfer);
   return;
  }
  if(kind!=='distance')throw Error('Unknown terrain job');
  const {canyon,includeFar}=job;
  if(canyon){
   const middle=await buildCanyonDistance(distantCanyonMeshSteps(seed,cx,cz,canyon.origin,canyon.y));
   self.postMessage({kind,id,middle},[middle.buffer]);
   return;
  }
  const plan=createCityPlan(seed,cityBlueprints);
  const options={};
  const middle=distantCityMesh(plan,cx,cz,options);
  const far=includeFar?cityFarMesh(plan):null;
  self.postMessage({kind,id,middle,far,coveredRadius:options.coveredRadius},far?[middle.buffer,far.buffer]:[middle.buffer]);
 }catch(error){self.postMessage({kind,id,error:String(error)})}
};
