import {portableLight} from '../core/blocks.js';
import {SIZE as CHUNK_SIZE} from '../core/chunk.js';
import {weaponBasis} from '../core/combat.js';
import {buildLightVolume,makeOccluderSnapshot} from '../core/lightVolume.js';
import {fixture,rgb} from './mesher.js';

const SIZE=21,HALF=(SIZE-1)/2,UPDATE_MS=120,BLEND_MS=95;
const UNIT=3;
const templates=new Map(),EMPTY_MESH=new Float32Array(0);

export const HELD_LIGHT_SHADER=`
uniform highp sampler3D uHeldLightVolume;
uniform vec4 uHeldLightCurrent,uHeldLightPrevious;
uniform float uHeldLightBlend;
vec4 heldVoxel(vec3 cell,float slot){
 if(any(lessThan(cell,vec3(0.)))||any(greaterThanEqual(cell,vec3(${SIZE}.))))return vec4(0.);
 cell.z+=slot*${SIZE}.;
 return texelFetch(uHeldLightVolume,ivec3(cell),0);
}
vec3 sampleHeldLight(vec3 position,vec3 normal,vec4 region){
 if(region.w<0.)return vec3(0.);
 vec3 relative=position-region.xyz;
 vec3 cell=floor(relative);
 vec4 lit=heldVoxel(cell,region.w);
 // Thin closed doors occupy an entire lighting cell. Sample the air just
 // beyond the visible face, using the same rule as stationary lighting.
 if(lit.a==0.&&all(greaterThanEqual(cell,vec3(0.)))&&all(lessThan(cell,vec3(${SIZE}.)))){
  vec3 edge=mix(fract(relative),1.-fract(relative),step(vec3(0.),normal));
  vec3 travel=edge/max(abs(normal),vec3(.0001));
  vec3 adjacent=floor(relative+normal*(min(travel.x,min(travel.y,travel.z))+.02));
  lit=heldVoxel(adjacent,region.w);
 }
 return lit.rgb;
}
vec3 heldLightAt(vec3 position,vec3 normal){
 if(uHeldLightCurrent.w<0.)return vec3(0.);
 vec3 current=sampleHeldLight(position,normal,uHeldLightCurrent);
 if(uHeldLightBlend>=1.)return current;
 return mix(sampleHeldLight(position,normal,uHeldLightPrevious),current,uHeldLightBlend);
}`;

export function heldLightUniforms(gl,program){
 return Object.fromEntries(['Volume','Current','Previous','Blend'].map(key=>[key,gl.getUniformLocation(program,'uHeldLight'+key)]));
}

export function heldLightView(id,eye,yaw,pitch,time,walk,wallDistance){
 if(!portableLight(id))return EMPTY_MESH;
 const {forward,right,up}=weaponBasis(yaw,pitch);
 const offset=forward.map((value,i)=>value*.73+right[i]*.46+up[i]*(-.34+Math.sin(time*8)*walk*.018));
 const distance=Math.hypot(...offset);
 const ray={x:offset[0]/distance,y:offset[1]/distance,z:offset[2]/distance};
 const reach=wallDistance(eye,ray,distance+.19);
 const hold=Math.max(0,Math.min(1,(reach-.19)/distance));
 if(hold<.42)return EMPTY_MESH;

 if(!templates.has(id)){
  const geometry=[];
  fixture(geometry,id,0,0,0);
  templates.set(id,new Float32Array(geometry));
 }
 const center=eye.map((value,i)=>value+offset[i]*hold);
 const mesh=templates.get(id).slice();
 for(let i=0;i<mesh.length;i+=7){
  const x=(mesh[i]-.5)*.61,y=(mesh[i+1]-.43)*.61,z=(mesh[i+2]-.5)*.61;
  // right, up and backward form the view-space axes.
  for(let axis=0;axis<3;axis++)mesh[i+axis]=center[axis]+right[axis]*x+up[axis]*y-forward[axis]*z;
 }
 return mesh;
}

function coverageAt(world,[x,,z]){
 const minX=Math.floor((x-HALF)/CHUNK_SIZE),maxX=Math.floor((x+HALF)/CHUNK_SIZE);
 const minZ=Math.floor((z-HALF)/CHUNK_SIZE),maxZ=Math.floor((z+HALF)/CHUNK_SIZE);
 let coverage=0;
 for(let cz=minZ;cz<=maxZ;cz++)for(let cx=minX;cx<=maxX;cx++)
  coverage=coverage*2+Number(Boolean(world.getChunk(cx,cz,false)));
 return coverage;
}

export function heldLightJob(world,spec,cell){
 const origin=cell.map(value=>value-HALF);
 const blocks=makeOccluderSnapshot(world,origin,SIZE,SIZE,SIZE,null,1);
 const [x,y,z]=cell.map(value=>value+.5);
 const source={...spec,x,y,z,rgb:rgb(spec.color)};
 return {origin,blocks,sources:[source],size:SIZE};
}

export class HeldLight{
 constructor(gl){
  this.gl=gl;
  this.texture=gl.createTexture();
  this.bindTexture();
  for(const name of ['TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER'])gl.texParameteri(gl.TEXTURE_3D,gl[name],gl.NEAREST);
  for(const name of ['TEXTURE_WRAP_S','TEXTURE_WRAP_T','TEXTURE_WRAP_R'])gl.texParameteri(gl.TEXTURE_3D,gl[name],gl.CLAMP_TO_EDGE);
  // Two snapshots in one 3D texture. At rest we only sample the current half.
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,SIZE,SIZE,SIZE*2,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  this.serial=0;
  this.clear();
 }

 bindTexture(){
  const gl=this.gl;
  gl.activeTexture(gl.TEXTURE0+UNIT);
  gl.bindTexture(gl.TEXTURE_3D,this.texture);
 }

 clear(){
  this.context=null;
  this.current=this.previous=this.ready=null;
  this.requestKey='';
  this.lastRequest=-Infinity;
 }

 ensureWorker(){
  if(this.worker||this.workerUnavailable)return;
  if(typeof Worker!=='function'){this.workerUnavailable=true;return}
  try{
   const worker=this.worker=new Worker(new URL('./light.worker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{
    if(this.worker!==worker||data.token!==this.inflight?.token)return;
    if(data.error){this.disableWorker();return}
    this.ready={...this.inflight,output:new Uint8Array(data.output)};
    this.inflight=null;
   };
   worker.onerror=worker.onmessageerror=()=>this.disableWorker();
  }catch{this.disableWorker()}
 }

 disableWorker(){
  this.worker?.terminate();
  this.worker=null;
  this.workerUnavailable=true;
  this.inflight=null;
  this.requestKey='';
 }

 update(world,id,source,now){
  const spec=portableLight(id);
  if(!spec){if(this.context)this.clear();return}
  const old=this.context;
  if(!old||old.world!==world||old.id!==id||old.yOrigin!==world.yOrigin){
   this.clear();
   this.context={world,id,yOrigin:world.yOrigin,revision:world.lightRevision};
  }else if(old.revision!==world.lightRevision){
   this.current=this.previous=this.ready=null;
   this.requestKey='';
   this.context={world,id,yOrigin:world.yOrigin,revision:world.lightRevision};
  }
  const cell=source.map(Math.floor);
  const nearby=origin=>cell.every((value,i)=>Math.abs(value-origin[i]-HALF)<=2);
  if(this.current&&!nearby(this.current.origin))this.current=this.previous=null;
  if(this.ready){
   const {context,origin,output}=this.ready;
   this.ready=null;
   if(context===this.context&&nearby(origin))this.apply(origin,output,now);
   else this.requestKey='';
  }

  const key=cell.join(',')+':'+coverageAt(world,cell);
  if(this.inflight||this.requestKey===key||now-this.lastRequest<UPDATE_MS)return;
  this.ensureWorker();
  const job=heldLightJob(world,spec,cell);
  this.lastRequest=now;
  this.requestKey=key;
  if(this.worker){
   const token=++this.serial;
   this.inflight={token,context:this.context,origin:job.origin};
   try{this.worker.postMessage({...job,token,blocks:job.blocks.buffer},[job.blocks.buffer]);return}
   catch{this.disableWorker()}
  }
  this.apply(job.origin,buildLightVolume(job.blocks,job.sources,{origin:job.origin,width:SIZE,height:SIZE,depth:SIZE}),now);
 }

 apply(origin,output,now){
  const slot=this.current?.slot===0?1:0;
  this.bindTexture();
  const gl=this.gl;
  gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,slot*SIZE,SIZE,SIZE,SIZE,gl.RGBA,gl.UNSIGNED_BYTE,output);
  this.previous=this.current;
  this.current={origin,slot};
  this.appliedAt=now;
 }

 bindUniforms(uniforms,now){
  const gl=this.gl,current=this.current,previous=this.previous;
  gl.uniform1i(uniforms.Volume,UNIT);
  gl.uniform4f(uniforms.Current,...(current?.origin??[0,0,0]),current?.slot??-1);
  if(!current)return;
  const blend=previous?Math.min(1,(now-this.appliedAt)/BLEND_MS):1;
  gl.uniform1f(uniforms.Blend,blend);
  if(blend<1)gl.uniform4f(uniforms.Previous,...previous.origin,previous.slot);
 }
}
