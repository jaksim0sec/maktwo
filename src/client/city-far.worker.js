import {createCityPlan} from '../worldgen/eternal-night-game.js';
import {distantCityMesh} from './city-distance.js';
import {cityFarMesh} from './city-far.js';

self.onmessage=({data:{seed,cx,cz,token,includeFar,cityBlueprints}})=>{
 try{
  const plan=createCityPlan(seed,cityBlueprints);
  const options={};
  const middle=distantCityMesh(plan,cx,cz,options);
  const far=includeFar?cityFarMesh(plan):null;
  self.postMessage({token,middle,far,coveredRadius:options.coveredRadius},far?[middle.buffer,far.buffer]:[middle.buffer]);
 }catch(error){self.postMessage({token,error:String(error)})}
};
