import {buildLightVolume} from '../core/lightVolume.js';
self.onmessage=({data})=>{
 try{
  const dimensions=data.size?{width:data.size,height:data.size,depth:data.size}:{};
  const output=buildLightVolume(new Uint8Array(data.blocks),data.sources,
   {...dimensions,origin:data.origin,skyTop:data.skyTop?new Uint8Array(data.skyTop):null});
  self.postMessage({token:data.token,origin:data.origin,output:output.buffer},[output.buffer]);
 }catch(error){self.postMessage({token:data.token,error:String(error.stack||error)})}
};
