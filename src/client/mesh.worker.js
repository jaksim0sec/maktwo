import {Chunk} from '../core/chunk.js';
import {meshChunk} from './mesher.js?v=0.8.0';

// Worker-side snapshots keep world generation and block edits owned by the main thread.
self.onmessage=({data:job})=>{
 try{
  const chunk=new Chunk(job.cx,job.cz);
  chunk.data=new Uint8Array(job.data);
  const neighbors=new Map(job.neighbors.map(([dx,dz,buffer])=>[`${job.cx+dx},${job.cz+dz}`,{data:new Uint8Array(buffer)}]));
  const world={seed:job.seed,getChunk:(cx,cz)=>neighbors.get(`${cx},${cz}`)};
  const mesh=meshChunk(world,chunk);
  self.postMessage({key:job.key,revision:job.revision,token:job.token,opaque:mesh.opaque,transparent:mesh.transparent},[mesh.opaque.buffer,mesh.transparent.buffer]);
 }catch(err){self.postMessage({key:job.key,revision:job.revision,token:job.token,error:String(err.stack||err)})}
};
