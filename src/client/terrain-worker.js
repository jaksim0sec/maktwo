import {Chunk,SIZE,inChunkStreamRange} from '../core/chunk.js';
import {CITY_MODE,CITY_BLUEPRINT_VERSION} from '../worldgen/eternal-night-game.js';
import {CANYON_MODE} from '../worldgen/canyon-v2-plan.js';

const browserWorker=typeof Worker==='function'
 ?()=>new Worker(new URL('./terrain.worker.js',import.meta.url),{type:'module'})
 :null;

export class TerrainWorker{
 constructor(createWorker=browserWorker){
  this.createWorker=createWorker;
  this.available=Boolean(createWorker);
  this.pending=new Map();
  this.serial=0;
 }

 request(kind,input,onResult,onCancel){
  if(!this.available||this.pending.has(kind))return false;
  try{
   if(!this.worker){
    const worker=this.worker=this.createWorker();
    worker.onmessage=({data})=>{
     if(this.worker!==worker)return;
     const job=this.pending.get(data?.kind);
     if(!job||job.id!==data.id)return;
     if(data.error){this.fail(worker,data.error);return}
     this.pending.delete(data.kind);
     try{
      job.onResult(data);
     }catch(error){this.fail(worker,error)}
    };
    worker.onerror=event=>this.fail(worker,event.message);
    worker.onmessageerror=event=>this.fail(worker,event.message);
   }
   const id=++this.serial;
   this.pending.set(kind,{id,onResult,onCancel});
   this.worker.postMessage({...input,kind,id});
   return true;
  }catch(error){
   this.fail(this.worker,error);
   return false;
  }
 }

 prepare(world){
  if(world.mode!==CITY_MODE&&world.mode!==CANYON_MODE)return;
  const {seed,mode,version}=world;
  const cityBlueprints=version>=CITY_BLUEPRINT_VERSION?version:false;
  return new Promise(resolve=>{
   if(!this.request('prepare',{seed,mode,cityBlueprints},()=>resolve(),resolve))resolve();
  });
 }

 reset(){
  const worker=this.worker;
  this.worker=null;
  for(const {onCancel} of this.pending.values())onCancel?.();
  this.pending.clear();
  this.completedChunk=null;
  worker?.terminate();
 }

 fail(worker,error){
  if(this.worker!==worker)return;
  this.available=false;
  this.reset();
  console.warn('Terrain worker unavailable, using synchronous loading',error);
 }

 stream(world,x,z,radius,allowSync){
  if(!this.available){
   if(allowSync)world.stream(x,z,radius,2,{roundEdges:true});
   return;
  }

  const completed=this.completedChunk;
  this.completedChunk=null;
  if(completed?.world===world&&completed.yOrigin===world.yOrigin){
   const {chunk}=completed;
   const dx=chunk.cx-Math.floor(x/SIZE),dz=chunk.cz-Math.floor(z/SIZE);
   if(inChunkStreamRange(dx,dz,radius,true))world.registerChunk(chunk);
  }

  world.stream(x,z,radius,1,{roundEdges:true,loadChunk:(cx,cz)=>{
   const {seed,mode,height,yOrigin,version}=world;
   const cityBlueprints=version>=CITY_BLUEPRINT_VERSION?version:false;
   this.request('chunk',{cx,cz,seed,mode,height,yOrigin,cityBlueprints},result=>{
    const {data,styles,forms,revision}=result;
    const valid=array=>array instanceof Uint8Array&&array.length===height*SIZE*SIZE;
    if(!valid(data)||styles!==undefined&&!valid(styles)||forms!==undefined&&!valid(forms)||
       !Number.isSafeInteger(revision)||revision<0)
     throw Error('Invalid terrain chunk');
    const chunk=new Chunk(cx,cz,height,data);
    chunk.styles=styles;
    chunk.forms=forms;
    chunk.revision=revision;
    this.completedChunk={world,yOrigin,chunk};
   });
  }});
 }
}
