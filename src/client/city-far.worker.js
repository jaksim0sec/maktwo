import {createCityPlan} from '../worldgen/eternal-night-game.js';
import {distantCityMesh} from './city-distance.js';
import {distantCanyonMesh} from './canyon-distance.js';
import {cityFarMesh} from './city-far.js';

self.onmessage=({data:{seed,cx,cz,token,includeFar,cityBlueprints,canyon}})=>{
 try{
  if(canyon){
   const middle=distantCanyonMesh(seed,cx,cz,canyon.origin,canyon.y);
   self.postMessage({token,middle},[middle.buffer]);
   return;
  }
  const plan=createCityPlan(seed,cityBlueprints);
  const options={};
  const middle=distantCityMesh(plan,cx,cz,options);
  const far=includeFar?cityFarMesh(plan):null;
  self.postMessage({token,middle,far,coveredRadius:options.coveredRadius},far?[middle.buffer,far.buffer]:[middle.buffer]);
 }catch(error){self.postMessage({token,error:String(error)})}
};
