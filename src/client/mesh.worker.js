import {Chunk} from '../core/chunk.js';
import {meshChunkData} from './mesher.js';

// Worker-side snapshots keep world generation and block edits owned by the main thread.
self.onmessage=({data:job})=>{
 try{
  const chunk=new Chunk(job.cx,job.cz);
  chunk.data=new Uint8Array(job.data);
  if(job.forms)chunk.forms=new Uint8Array(job.forms);
  chunk.mounts=job.mounts;
  const neighbors=job.neighbors.map(([dx,dz,buffer,forms])=>[dx,dz,new Uint8Array(buffer),forms&&new Uint8Array(forms)]);
  const states=new Map(job.doorStates||[]);
  const mesh=meshChunkData(chunk,{neighbors,states,visualSeed:job.seed});
  self.postMessage({key:job.key,revision:job.revision,token:job.token,opaque:mesh.opaque,transparent:mesh.transparent},[mesh.opaque.buffer,mesh.transparent.buffer]);
 }catch(err){self.postMessage({key:job.key,revision:job.revision,token:job.token,error:String(err.stack||err)})}
};
