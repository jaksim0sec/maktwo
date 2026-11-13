import {Chunk,SIZE} from '../core/chunk.js';
import {meshChunkData} from './mesher.js';

// Worker-side snapshots keep world generation and block edits owned by the main thread.
self.onmessage=({data:job})=>{
 try{
  const chunk=new Chunk(job.cx,job.cz,job.height);
  const restore=buffer=>{
   if(!buffer)return undefined;
   const view=new Uint8Array(buffer),length=(job.height??chunk.height)*SIZE*SIZE;
   if(view.length===length||job.height===undefined)return view;
   const data=new Uint8Array(length);data.set(view,job.offset);return data;
  };
  chunk.data=restore(job.data);
  chunk.forms=restore(job.forms);
  chunk.styles=restore(job.styles);
  chunk.mounts=job.mounts;
  const neighbors=job.neighbors.map(([dx,dz,buffer,forms,styles,cornerY])=>{
   const read=cornerY===undefined?restore:value=>value?new Uint8Array(value):undefined;
   return [dx,dz,read(buffer),read(forms),read(styles),cornerY];
  });
  const states=new Map(job.doorStates||[]);
  const mesh=meshChunkData(chunk,{neighbors,states,visualSeed:job.seed,yMin:job.yMin,yMax:job.yMax,detailY:job.detailY});
  self.postMessage({key:job.key,revision:job.revision,token:job.token,opaque:mesh.opaque,transparent:mesh.transparent},[mesh.opaque.buffer,mesh.transparent.buffer]);
 }catch(err){self.postMessage({key:job.key,revision:job.revision,token:job.token,error:String(err.stack||err)})}
};
