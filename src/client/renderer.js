import {block as itemBlock} from '../core/blocks.js';
import {meshChunkData,cube,rgb} from './mesher.js';import {SIZE,MESH_NEIGHBORS} from '../core/chunk.js';import {clamp} from '../util/math.js';
import {BLOCK_SIZE,toMeters} from '../core/scale.js';
import {CITY_MODE,createCityPlan} from '../worldgen/eternal-night-game.js';
import {distantCityMesh} from './city-distance.js';
import {cityFarMesh} from './city-far.js';
import {FAR_LOOK} from './far-look.js';
import {LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,makeOccluderSnapshot,buildLightVolume} from '../core/lightVolume.js';
import {cameraEyeY,dampStepOffset} from './camera.js';
import {makeTextureLayers} from './textures.js';
import {skyClarityAt} from './atmosphere.js';
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aColor;layout(location=2) in float aShade;
uniform mat4 uVP;uniform vec3 uCamera;uniform float uTime;uniform vec2 uFogRange;
out vec3 vColor;out float vFog;out vec3 vPos;out float vEmission;flat out int vMaterial;flat out int vTurns;
void main(){gl_Position=uVP*vec4(aPos*${BLOCK_SIZE.toFixed(2)},1.);vPos=aPos;vEmission=aShade<0.?1.:0.;int packedMat=aShade<0.?0:int(floor(aShade*.25));vTurns=packedMat>>7;vMaterial=packedMat&127;vColor=aColor*(aShade<0.?abs(aShade):(aShade-4.*float(packedMat)));float d=length(aPos*${BLOCK_SIZE.toFixed(2)}-uCamera);vFog=clamp((d-uFogRange.x)/uFogRange.y,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vColor;in float vFog;in vec3 vPos;in float vEmission;flat in int vMaterial;flat in int vTurns;
uniform vec3 uFog;uniform float uBrightness;uniform float uAlpha;
uniform highp sampler3D uLightVolume;uniform vec3 uLightOrigin;uniform vec3 uLightSize;
uniform float uTime;uniform highp sampler2DArray uMaterials;uniform bool uDistant;uniform vec2 uCenterChunk;
uniform vec3 uCamera;
uniform float uLodNear;uniform bool uFarPass;uniform vec2 uNearY;
out vec4 frag;
void main(){
 if(uDistant){
  vec2 delta=abs(floor(vPos.xz/16.)-uCenterChunk);
  float ring=max(delta.x,delta.y);
  bool nearChunk=ring<3.||(ring==3.&&delta.x+delta.y<=4.);
  // Only the streamed vertical band has near geometry. Keep the full-height
  // silhouette above and below it, even for buildings in the same chunk.
  bool outsideNearY=vPos.y<uNearY.x||vPos.y>uNearY.y;
  if(nearChunk&&(!uFarPass||!outsideNearY))discard;
  vec3 relative=vPos*${BLOCK_SIZE.toFixed(2)}-uCamera;
  if(!nearChunk&&uLodNear>0.&&dot(relative.xz,relative.xz)<uLodNear*uLodNear)discard;

 }
 // The lighting volume contains ONLY reachable open-air cells. A wall cannot
 // illuminate its far side. Sample the air just outside the fragment's face.
 vec3 normal=vec3(0.,1.,0.);
 if(!uDistant)normal=normalize(cross(dFdx(vPos),dFdy(vPos)));
 vec3 emission=vec3(0.);
 if(!uDistant&&vEmission<.5&&vFog<.99){
  vec3 samplePos=vPos+normal*.02-uLightOrigin;
  ivec3 cell=ivec3(floor(samplePos));
  ivec3 size=ivec3(uLightSize);
  if(all(greaterThanEqual(cell,ivec3(0)))&&all(lessThan(cell,size))){
   vec4 light=texelFetch(uLightVolume,cell,0);
   // Partial blocks can share a voxel with illuminated air. Closed doors
   // instead take light from the next cell on their visible side.
   if(light.a==0.){
    vec3 toEdge=mix(fract(samplePos),1.-fract(samplePos),step(vec3(0.),normal));
    vec3 travel=toEdge/max(abs(normal),vec3(.0001));
    cell=ivec3(floor(samplePos+normal*(min(travel.x,min(travel.y,travel.z))+.02)));
    if(all(greaterThanEqual(cell,ivec3(0)))&&all(lessThan(cell,size)))light=texelFetch(uLightVolume,cell,0);
   }
   emission=light.rgb;
  }
 }
 vec3 ambient=vec3(.65,.72,.93)*uBrightness;
 // Keep authored block colors unchanged; light range is controlled by each source.
 vec3 tinted=vColor;
 if(vMaterial>0){
  vec3 axis=abs(normal);vec2 uv=axis.y>axis.x&&axis.y>axis.z?vPos.xz:(axis.x>axis.z?vPos.zy:vPos.xy);
  if(vTurns==1)uv=vec2(-uv.y,uv.x);
  else if(vTurns==2)uv=-uv;
  else if(vTurns==3)uv=vec2(uv.y,-uv.x);
  tinted*=texture(uMaterials,vec3(uv,float(vMaterial-1))).rgb;
 }
 // Use the source spectrum: fluorescent tubes stay cool and torches stay warm.
 vec3 c=vEmission>.5?min(tinted,vec3(1.)):tinted*(ambient+emission*.88)+emission*.13;
 c=c/(1.+max(0.,max(c.r,max(c.g,c.b))-1.)*.6);
 c=mix(c,uFog,vFog);
 frag=vec4(c,uAlpha);
}`;
// One fullscreen triangle: a subdued near-black sky with a horizon gradient.
// This costs one extra draw call and no textures, geometry, or world updates.
const SKY_VERT=`#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const SKY_FRAG=`#version 300 es
precision highp float;
in vec2 uv;
uniform float uHorizon;
uniform float uClarity;uniform float uSkyBrightness;
out vec4 frag;
float starHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 high=vec3(.018,.020,.025);
 vec3 horizon=vec3(.073,.073,.080);
 vec3 low=vec3(.039,.040,.046);
 float upper=smoothstep(uHorizon-.23,uHorizon+.50,uv.y);
 vec3 color=mix(horizon,high,upper);
 float below=1.-smoothstep(uHorizon-.65,uHorizon+.02,uv.y);
 color=mix(color,low,below*.65);
 vec2 cell=floor(uv*vec2(200.,115.));vec2 pos=fract(uv*vec2(200.,115.));
 float stars=step(.992,starHash(cell))*(1.-smoothstep(.035,.22,length(pos-vec2(.5))))*smoothstep(uHorizon+.05,uHorizon+.38,uv.y);
 vec3 clearTop=vec3(.24,.47,.78);
 vec3 clearHorizon=vec3(.70,.84,.95);
 float clearGradient=smoothstep(uHorizon-.20,uHorizon+.62,uv.y);
 vec3 highAltitude=mix(clearHorizon,clearTop,clearGradient);
 color=mix(color,highAltitude,uClarity);
 color=mix(color,vec3(.22,.25,.30),uSkyBrightness*(1.-uClarity));
 color+=vec3(.21,.22,.23)*stars*(1.-uClarity);
 frag=vec4(color,1.);
}`;
// Depth-aware blur is only enabled by ?farblur=1; near geometry is left sharp.
const DISTANCE_BLUR_FRAG=`#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D uScene;uniform sampler2D uDepth;
uniform vec2 uPixel;uniform vec2 uClip;
out vec4 frag;
float eyeDepth(float d){return uClip.x*uClip.y/(uClip.y-d*(uClip.y-uClip.x));}
void main(){
 vec3 center=texture(uScene,uv).rgb;
 float depth=texture(uDepth,uv).r;
 if(depth>=.999999){frag=vec4(center,1.);return;}
 float amount=smoothstep(30.,110.,eyeDepth(depth));
 if(amount<=.001){frag=vec4(center,1.);return;}
 vec2 stepSize=uPixel*(1.75*amount);
 vec3 accum=center*4.;float weight=4.;
 for(int i=0;i<4;i++){
  vec2 offset=i==0?vec2(stepSize.x,0.):i==1?vec2(-stepSize.x,0.):i==2?vec2(0.,stepSize.y):vec2(0.,-stepSize.y);
  vec2 at=clamp(uv+offset,vec2(0.),vec2(1.));
  float nearbyDepth=texture(uDepth,at).r;
  if(nearbyDepth>=.999999||eyeDepth(nearbyDepth)>27.){accum+=texture(uScene,at).rgb;weight+=1.;}
 }
 frag=vec4(mix(center,accum/weight,amount*.85),1.);
}`;
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
function matMultiply(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
export function view(yaw,pitch,x,y,z){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const fx=-sy*cp,fy=sp,fz=-cy*cp;const rx=cy,ry=0,rz=-sy;const ux=sy*sp,uy=cp,uz=cy*sp;return new Float32Array([rx,ux,-fx,0,ry,uy,-fy,0,rz,uz,-fz,0,-(rx*x+ry*y+rz*z),-(ux*x+uy*y+uz*z),fx*x+fy*y+fz*z,1])}
function glClearLight(gl,texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;this.program=program(gl);this.skyProgram=gl.createProgram();gl.attachShader(this.skyProgram,shader(gl,gl.VERTEX_SHADER,SKY_VERT));gl.attachShader(this.skyProgram,shader(gl,gl.FRAGMENT_SHADER,SKY_FRAG));gl.linkProgram(this.skyProgram);if(!gl.getProgramParameter(this.skyProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.skyProgram));this.skyHorizon=gl.getUniformLocation(this.skyProgram,'uHorizon');this.skyClarity=gl.getUniformLocation(this.skyProgram,'uClarity');this.skyLight=gl.getUniformLocation(this.skyProgram,'uSkyBrightness');this.skyBrightness=0;this.skyVao=gl.createVertexArray();gl.useProgram(this.program);this.u={vp:gl.getUniformLocation(this.program,'uVP'),camera:gl.getUniformLocation(this.program,'uCamera'),fog:gl.getUniformLocation(this.program,'uFog'),fogRange:gl.getUniformLocation(this.program,'uFogRange'),distant:gl.getUniformLocation(this.program,'uDistant'),centerChunk:gl.getUniformLocation(this.program,'uCenterChunk'),brightness:gl.getUniformLocation(this.program,'uBrightness'),alpha:gl.getUniformLocation(this.program,'uAlpha'),time:gl.getUniformLocation(this.program,'uTime'),lightVolume:gl.getUniformLocation(this.program,'uLightVolume'),lightOrigin:gl.getUniformLocation(this.program,'uLightOrigin'),lightSize:gl.getUniformLocation(this.program,'uLightSize'),materials:gl.getUniformLocation(this.program,'uMaterials')};for(const name of ['LodNear','FarPass','NearY'])this.u[name]=gl.getUniformLocation(this.program,'u'+name);
 // Keep the experimental long-distance impostors opt-in; original city renderer is the default.
  this.farEnabled=new URLSearchParams(globalThis.location?.search).get('far')==='1';
 // Only an explicit test URL allocates the extra shader/framebuffer.
 this.distanceBlurEnabled=new URLSearchParams(globalThis.location?.search).get('farblur')==='1';
 this.distanceBlurTarget=null;this.distanceBlurProgram=null;this.distanceBlurUniforms=null;
 if(this.distanceBlurEnabled)try{
  const p=gl.createProgram();
  gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,SKY_VERT));
  gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,DISTANCE_BLUR_FRAG));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  this.distanceBlurProgram=p;
  this.distanceBlurUniforms={scene:gl.getUniformLocation(p,'uScene'),depth:gl.getUniformLocation(p,'uDepth'),pixel:gl.getUniformLocation(p,'uPixel'),clip:gl.getUniformLocation(p,'uClip')};
 }catch(error){console.warn('Far blur disabled: shader unavailable',error);this.distanceBlurEnabled=false}
 this.walkAmount=0;this.walkPhase=0;this.farMesh=null;this.farWorker=null;this.farJob=null;this.farResult=null;this.middleCoverage=null;
 this.meshes=new Map();this.distanceMesh=null;this.distanceKey='';this.dynamic=null;this.dynamicCapacity=0;this.lastDrawnChunks=0;this.worker=null;this.inflight=new Map();this.completed=[];this.world=null;this.worldToken=0;this.renderScale=1;this.frameAverage=16.7;this.scaleCooldown=0;this.materialTexture=gl.createTexture();
 const t=makeTextureLayers();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.materialTexture);
 gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST_MIPMAP_NEAREST);
 gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);
 gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,t.size,t.size,t.layers,0,gl.RGBA,gl.UNSIGNED_BYTE,t.data);gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
 gl.activeTexture(gl.TEXTURE0);
 this.lightTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.lightOrigin=[0,0,0];this.lightAppliedKey='';this.lightRequestedKey='';this.lightBusy=false;this.lightSerial=0;this.lightWorker=null;this.lightLastRequest=0;this.lightRequestWorld=null;this.hologram=null;this.maxPixelRatio=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,matchMedia?.('(pointer:coarse)').matches?1:1.2);
 try{if(typeof Worker==='function'){
  this.worker=new Worker(new URL('./mesh.worker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{const task=this.inflight.get(data.key);if(!task||task.token!==data.token)return;this.inflight.delete(data.key);if(data.error){console.error('Mesher worker:',data.error);task.chunk.dirty=true;this.disableWorker();return}this.completed.push({task,data})};
  this.worker.onerror=(event)=>{console.warn('Worker unavailable, using fallback mesher',event.message);this.disableWorker()};
 }}catch(error){console.warn('Worker unavailable',error)}
 try{if(typeof Worker==='function'){
  this.lightWorker=new Worker(new URL('./light.worker.js',import.meta.url),{type:'module'});
  this.lightWorker.onmessage=({data})=>{
   if(data.token!==this.lightSerial)return;
   this.lightBusy=false;
   // Keep the previous texture until an occlusion-consistent result is ready.
   if(this.world!==this.lightRequestWorld||this.world?.lightRevision!==this.lightRequestRevision)return;
   if(data.error){console.warn('Light worker error',data.error);this.lightWorker.terminate();this.lightWorker=null;return}
   const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);
   gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(data.output));
   this.lightOrigin=data.origin;this.lightAppliedKey=this.lightRequestedKey;
  };
  this.lightWorker.onerror=(error)=>{console.warn('Light Worker unavailable',error.message);this.lightWorker.terminate();this.lightWorker=null;this.lightBusy=false};
 }}catch(error){console.warn('Light Worker unavailable',error)}
 gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.039,.040,.046,1)}
 prepareDistanceBlur(width,height){
  const gl=this.gl,old=this.distanceBlurTarget;
  if(old&&old.width===width&&old.height===height)return true;
  if(old){gl.deleteFramebuffer(old.fbo);gl.deleteTexture(old.color);gl.deleteTexture(old.depth);this.distanceBlurTarget=null}
  const fbo=gl.createFramebuffer(),color=gl.createTexture(),depth=gl.createTexture();
  const setup=texture=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)};
  try{
   gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
   setup(color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
   setup(depth);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,width,height,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('incomplete framebuffer');
   this.distanceBlurTarget={fbo,color,depth,width,height};return true;
  }catch(error){
   console.warn('Far blur disabled: render target unavailable',error);
   gl.deleteFramebuffer(fbo);gl.deleteTexture(color);gl.deleteTexture(depth);
   this.distanceBlurEnabled=false;return false;
  }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
 }
 applyDistanceBlur(width,height,nearPlane,farPlane){
  const gl=this.gl,t=this.distanceBlurTarget,u=this.distanceBlurUniforms;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.distanceBlurProgram);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t.color);gl.uniform1i(u.scene,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t.depth);gl.uniform1i(u.depth,1);
  gl.uniform2f(u.pixel,1/width,1/height);gl.uniform2f(u.clip,nearPlane,farPlane);
  gl.bindVertexArray(this.skyVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);
 }
 upload(data){const gl=this.gl,vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,28,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,28,24);gl.bindVertexArray(null);return{vao,vbo,count:data.length/7}}
 replace(old,data){if(old)this.dispose(old);return this.upload(data)}
 dispose(m){if(!m)return;this.gl.deleteBuffer(m.vbo);this.gl.deleteVertexArray(m.vao)}
 updateDynamic(data){const gl=this.gl;if(!this.dynamic){this.dynamic=this.upload(data);this.dynamicCapacity=data.byteLength;return}gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.vbo);if(data.byteLength>this.dynamicCapacity){this.dynamicCapacity=Math.max(data.byteLength,Math.ceil(this.dynamicCapacity*1.5),4096);gl.bufferData(gl.ARRAY_BUFFER,this.dynamicCapacity,gl.DYNAMIC_DRAW)}if(data.byteLength)gl.bufferSubData(gl.ARRAY_BUFFER,0,data);this.dynamic.count=data.length/7}
 disableWorker(){this.worker?.terminate();this.worker=null;for(const task of this.inflight.values())task.chunk.dirty=true;this.inflight.clear();this.completed=[]}
 resetWorld(world){this.farWorker?.terminate();this.farWorker=null;this.farJob=null;this.farResult=null;this.middleCoverage=null;this.dispose(this.farMesh);this.farMesh=null;this.dispose(this.distanceMesh);this.distanceMesh=null;this.distanceKey='';for(const mesh of this.meshes.values()){this.dispose(mesh.opaque);this.dispose(mesh.transparent)}this.meshes.clear();this.completed=[];this.inflight.clear();this.world=world;this.worldToken++;this.lightAppliedKey='';this.lightRequestedKey='';this.lightSerial++;this.lightBusy=false;this.lightHasSources=false;glClearLight(this.gl,this.lightTexture)}
 queueMesh(world,key,chunk,yMin,yMax,detailY){
  chunk.dirty=false;
  const revision=chunk.revision,token=this.worldToken;
  const task={world,key,chunk,revision,token,yMin,yMax,detailY};
  const neighbors=[];
  for(const [dx,dz] of MESH_NEIGHBORS){
   const c=world.getChunk(chunk.cx+dx,chunk.cz+dz,false);
   if(c)neighbors.push([dx,dz,c.data,c.forms,c.styles]);
  }
  const states=[...world.blockStates].filter(([pos])=>{const [x,,z]=pos.split(',').map(Number);return x>=chunk.cx*SIZE-1&&x<=(chunk.cx+1)*SIZE&&z>=chunk.cz*SIZE-1&&z<=(chunk.cz+1)*SIZE});
  if(!this.worker){const geo=meshChunkData(chunk,{neighbors,states:new Map(states),visualSeed:world.seed,yMin,yMax,detailY});this.completed.push({task,data:{opaque:geo.opaque,transparent:geo.transparent}});return}
  const buffers=[];
  const offset=Math.max(0,(yMin??0)-1)*SIZE*SIZE,end=Math.min(chunk.height,(yMax??chunk.height)+1)*SIZE*SIZE;
  const copy=(a)=>{const data=new Uint8Array(a.subarray(offset,end));buffers.push(data.buffer);return data.buffer};
  this.inflight.set(key,task);
  const neighborBuffers=neighbors.map(([dx,dz,data,forms,styles])=>{
   if(!dx||!dz)return [dx,dz,copy(data),forms&&copy(forms),styles&&copy(styles)];
   // Only one XZ column of a diagonal chunk can meet this chunk.
   const corner=(dz<0?SIZE-1:0)*SIZE+(dx<0?SIZE-1:0);
   const copyCorner=array=>{
    if(!array)return undefined;
    const strip=new Uint8Array((end-offset)/(SIZE*SIZE));
    for(let i=0;i<strip.length;i++)strip[i]=array[offset+i*SIZE*SIZE+corner];
    buffers.push(strip.buffer);
    return strip.buffer;
   };
   return [dx,dz,copyCorner(data),copyCorner(forms),copyCorner(styles),offset/(SIZE*SIZE)];
  });
  this.worker.postMessage({key,revision,token,yMin,yMax,detailY,offset,height:chunk.height,seed:world.seed,cx:chunk.cx,cz:chunk.cz,data:copy(chunk.data),forms:chunk.forms&&copy(chunk.forms),styles:chunk.styles&&copy(chunk.styles),mounts:chunk.mounts,neighbors:neighborBuffers,doorStates:states},buffers);
 }
 syncCityDistance(world,cx,cz){
  const key=cx+','+cz;
  if(this.farResult){
   const {middle,far,coveredRadius,job}=this.farResult;
   this.farResult=null;
   if(far)this.farMesh=this.upload(far);
   this.distanceMesh=this.replace(this.distanceMesh,middle);
   this.middleCoverage={radius:coveredRadius,x:(job.cx+.5)*SIZE,z:(job.cz+.5)*SIZE};
   this.distanceKey=job.key;
  }
  if(this.distanceKey===key||this.farJob)return;
  if(this.farEnabled&&typeof Worker!=='undefined'&&!this.farWorkerFailed){
   try{
    if(!this.farWorker){
     this.farWorker=new Worker(new URL('./city-far.worker.js',import.meta.url),{type:'module'});
     this.farWorker.onmessage=({data})=>{
      if(data.token!==this.worldToken||!this.farJob)return;
      if(data.error){this.failFarWorker(data.error);return}
      this.farResult={...data,job:this.farJob};
      this.farJob=null;
     };
     this.farWorker.onerror=event=>this.failFarWorker(event.message);
    }
    this.farJob={cx,cz,key};
    this.farWorker.postMessage({seed:world.seed,cx,cz,token:this.worldToken,includeFar:!this.farMesh});
    return;
   }catch(error){this.failFarWorker(error)}
  }
  const plan=createCityPlan(world.seed),options={enhanced:this.farEnabled};
  if(this.farEnabled&&!this.farMesh)this.farMesh=this.upload(cityFarMesh(plan));
  this.distanceMesh=this.replace(this.distanceMesh,distantCityMesh(plan,cx,cz,options));
  this.middleCoverage={radius:options.coveredRadius,x:(cx+.5)*SIZE,z:(cz+.5)*SIZE};
  this.distanceKey=key;
 }
 failFarWorker(error){
  console.warn('City mesh worker unavailable',error);
  this.farWorker?.terminate();
  this.farWorker=null;this.farJob=null;this.farWorkerFailed=true;
 }
 sync(world,player){
  if(this.world!==world)this.resetWorld(world);
  const height=world.height??64, tall=height>64;
  const band=Math.max(0,Math.min(height-1,Math.floor(player.y/64)*64));
  const yMin=tall?Math.max(0,band-160):0,yMax=Math.min(height,band+208);
  const px=Math.floor(player.x/SIZE),pz=Math.floor(player.z/SIZE);
  if(world.mode===CITY_MODE){
   this.nearYMin=yMin;this.nearYMax=yMax;
   this.syncCityDistance(world,px,pz);
  }
  const detailFor=c=>!tall?undefined:Math.max(Math.abs(c.cx-px),Math.abs(c.cz-pz))<=1?Math.floor(player.y/8)*8:null;
  for(const [key,mesh] of this.meshes)if(!world.chunks.has(key)){this.dispose(mesh.opaque);this.dispose(mesh.transparent);this.meshes.delete(key)}
  // Keep GPU uploads bounded. The heavy CPU mesh work runs off the UI thread.
  if(this.completed.length){const {task,data}=this.completed.shift();const current=world.chunks.get(task.key);
   if(task.world===world&&current===task.chunk){
    if(current.revision===task.revision&&task.yMin===yMin&&task.yMax===yMax&&task.detailY===detailFor(current)){
     const old=this.meshes.get(task.key);this.meshes.set(task.key,{yMin,yMax,detailY:task.detailY,opaque:this.replace(old?.opaque,data.opaque),transparent:this.replace(old?.transparent,data.transparent)})
    }
    else current.dirty=true;
   }
  }
  if(this.inflight.size>=2||this.completed.length>=2)return;
  let best=null,bestDist=Infinity;
  for(const [key,chunk] of world.chunks){
   const mesh=this.meshes.get(key);
   if(this.inflight.has(key)||(!chunk.dirty&&mesh?.yMin===yMin&&mesh?.yMax===yMax&&mesh.detailY===detailFor(chunk)))continue;
   const d=(chunk.cx-px)**2+(chunk.cz-pz)**2;
   if(d<bestDist){bestDist=d;best=[key,chunk]}
  }
  if(best)this.queueMesh(world,best[0],best[1],yMin,yMax,detailFor(best[1]));
 }
 updateLightVolume(world,player){
  const ox=Math.floor(player.x/8)*8-20,oz=Math.floor(player.z/8)*8-20;
  const oy=Math.max(0,Math.min(world.height-LIGHT_HEIGHT,Math.floor(player.y/8)*8-12));
  const focus=[Math.floor(player.x/8)*8+4,Math.floor(player.y/4)*4+2,Math.floor(player.z/8)*8+4];
  const origin=[ox,oy,oz],requestKey=`${this.worldToken}:${world.lightRevision}:${world.lightChunkRevision}:${ox}:${oy}:${oz}:${focus.join(',')}`;
  if(requestKey===this.lightAppliedKey||this.lightBusy||performance.now()-this.lightLastRequest<170)return;
  const sources=world.lights.inBounds(ox,ox+LIGHT_WIDTH,oz,oz+LIGHT_DEPTH,{minY:oy,maxY:oy+LIGHT_HEIGHT,limit:32,focus}).map(l=>({...l,rgb:rgb(l.color)}));
  const token=++this.lightSerial;this.lightBusy=true;this.lightLastRequest=performance.now();this.lightRequestedKey=requestKey;this.lightRequestWorld=world;this.lightRequestRevision=world.lightRevision;
  if(!sources.length){
   if(this.lightHasSources)glClearLight(this.gl,this.lightTexture);
   this.lightHasSources=false;this.lightAppliedKey=requestKey;this.lightBusy=false;
   return;
  }
  this.lightHasSources=true;
  const blocks=makeOccluderSnapshot(world,origin);
  if(this.lightWorker){this.lightWorker.postMessage({token,origin,blocks:blocks.buffer,sources},[blocks.buffer]);return}
  const result=buildLightVolume(blocks,sources,{origin});const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,gl.RGBA,gl.UNSIGNED_BYTE,result);
  this.lightOrigin=origin;this.lightAppliedKey=requestKey;this.lightBusy=false;
 }
 observeFrame(ms){
  // Lower 3D render resolution when GPU is consistently overwhelmed.
  this.frameAverage=this.frameAverage*.965+Math.min(100,ms)*.035;
  this.scaleCooldown--;
  if(this.scaleCooldown<=0){
   if(this.frameAverage>31&&this.renderScale>.7){this.renderScale=Math.max(.7,this.renderScale-.12);this.scaleCooldown=90}
   else if(this.frameAverage<19&&this.renderScale<1){this.renderScale=Math.min(1,this.renderScale+.06);this.scaleCooldown=240}
  }
 }
 drawMesh(mesh){if(!mesh?.count)return;this.lastDrawCalls++;const gl=this.gl;gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 dynamicData(entities,effects,time){
  const arr=[];
  for(const e of entities){
   if(e.type==='drop'){
    const color=rgb(itemBlock(e.itemId).color),size=.23,phase=Math.sin(time*2+e.id)*.07;
    cube(arr,e.x-size/2,e.y+phase,e.z-size/2,size,size,size,color,.92);
    continue;
   }
   const walk=Math.sin(time*7+e.id)*.12,zombie=e.type==='zombie';
   const c=zombie?rgb('#728c72'):rgb('#d9d5cb'),head=zombie?rgb('#8aa089'):rgb('#c7b9a7');
   // Creature size is measured in meters, independent of the 0.8m voxel.
   const draw=(dx,dy,dz,w,h,d,color,shade=1)=>cube(arr,e.x+dx/BLOCK_SIZE,e.y+dy/BLOCK_SIZE,e.z+dz/BLOCK_SIZE,w/BLOCK_SIZE,h/BLOCK_SIZE,d/BLOCK_SIZE,color,shade);
   draw(-.27,.52,-.17,.54,zombie?.78:.56,.34,c);
   draw(-.25,zombie?1.34:.95,-.25,.5,.45,.5,head);
   if(zombie){draw(-.42,.58,-.11,.15,.64,.2,c);draw(.27,.58,-.11,.15,.64,.2,c)}
   for(const side of [-1,1])draw(side*.13-.12,.05+(side===1?Math.max(0,walk):Math.max(0,-walk)),-.13,.24,.46,.26,zombie?rgb('#4c6081'):rgb('#6e6a65'));
   if(e.flash>0)draw(-.3,.4,-.28,.6,.2,.56,rgb('#ff8787'));
  }
  for(const p of effects.particles)cube(arr,p.x-.045,p.y-.045,p.z-.045,.09,.09,.09,rgb(p.color),1);
  return new Float32Array(arr)
 }
 frame(world,player,entities,effects,dt=1/60){const gl=this.gl,canvas=this.canvas,dpr=this.maxPixelRatio*(this.hologram?.opened?Math.max(this.renderScale,.96):this.renderScale),width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}gl.viewport(0,0,width,height);
  this.lastDrawCalls=1;this.lastDistanceDrawCalls=0;
  const walkingSpeed=player.fly||!player.grounded?0:Math.min(7,Math.hypot(player.vx,player.vz));
  this.walkAmount+=(Math.min(1,walkingSpeed/5)-this.walkAmount)*(1-Math.exp(-dt*8));
  this.walkPhase+=walkingSpeed*dt*2.2;
  const walkSway=Math.sin(this.walkPhase)*this.walkAmount*.012;
  const city=world.mode===CITY_MODE,farLook=city&&this.farEnabled;
  const blurActive=city&&this.distanceBlurEnabled&&!this.hologram?.opened&&this.prepareDistanceBlur(width,height);
  if(blurActive)gl.bindFramebuffer(gl.FRAMEBUFFER,this.distanceBlurTarget.fbo);
  const clarity=skyClarityAt(cameraEyeY(player)),skyLight=player.creative?Math.max(0,Math.min(1,this.skyBrightness)):0;
  const fog=[.067+.53*clarity+.17*skyLight,.067+.70*clarity+.19*skyLight,.075+.83*clarity+.22*skyLight];gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // Render sky separately from voxel fog so the horizon is not a flat navy fill.
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.skyProgram);
  gl.uniform1f(this.skyHorizon,Math.max(-.6,Math.min(1.6,.5-Math.tan(player.pitch)*.32)));
  gl.uniform1f(this.skyClarity,clarity);gl.uniform1f(this.skyLight,skyLight);
  gl.bindVertexArray(this.skyVao);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindVertexArray(null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);
  const camY=toMeters(cameraEyeY(player)),vp=matMultiply(perspective(75*Math.PI/180,width/Math.max(1,height),farLook?FAR_LOOK.nearPlaneMeters:.05,farLook?FAR_LOOK.farPlaneMeters:city?260:140),view(player.yaw+walkSway,player.pitch,toMeters(player.x),camY,toMeters(player.z)));gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform3f(this.u.camera,toMeters(player.x),camY,toMeters(player.z));gl.uniform3fv(this.u.fog,fog);gl.uniform2f(this.u.fogRange,24,62);gl.uniform1f(this.u.brightness,.35+.43*skyLight);gl.uniform1f(this.u.time,performance.now()*.001);gl.uniform1f(this.u.alpha,1);
  this.updateLightVolume(world,player);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);
  gl.uniform1i(this.u.lightVolume,0);
  gl.uniform1i(this.u.materials,2);
  gl.uniform3fv(this.u.lightOrigin,this.lightOrigin);
  gl.uniform3f(this.u.lightSize,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH);
  const cx=player.x,cz=player.z,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);const maxDistance=88;const visible=[];for(const [k,m] of this.meshes){const chunk=world.chunks.get(k);if(!chunk)continue;const dx=(chunk.cx+.5)*SIZE-cx,dz=(chunk.cz+.5)*SIZE-cz,dist=Math.hypot(dx,dz);if(dist>maxDistance)continue;if(dist>SIZE*2&&(dx*fx+dz*fz)<-dist*.65)continue;visible.push(m)}this.lastDrawnChunks=visible.length;for(const m of visible)this.drawMesh(m.opaque);
  if(this.distanceMesh?.count||this.farMesh?.count){
   gl.uniform2f(this.u.fogRange,30,230);
   gl.uniform1i(this.u.distant,1);
   gl.uniform2f(this.u.centerChunk,Math.floor(cx/SIZE),Math.floor(cz/SIZE));
   gl.enable(gl.POLYGON_OFFSET_FILL);
   if(this.distanceMesh?.count){
    gl.polygonOffset(1,1);
    this.drawMesh(this.distanceMesh);this.lastDistanceDrawCalls++;
   }
   if(this.farMesh?.count){
    const middle=this.middleCoverage;
    const overlap=middle?Math.max(FAR_LOOK.overlap,Math.hypot(cx-middle.x,cz-middle.z)):0;
    gl.uniform1f(this.u.LodNear,middle?toMeters(Math.max(0,middle.radius-overlap)):0);
    gl.uniform1i(this.u.FarPass,1);
    gl.uniform2f(this.u.NearY,this.nearYMin,this.nearYMax);
    gl.polygonOffset(2,2);
    this.drawMesh(this.farMesh);this.lastDistanceDrawCalls++;
    gl.uniform1f(this.u.LodNear,0);
    gl.uniform1i(this.u.FarPass,0);
   }
   gl.disable(gl.POLYGON_OFFSET_FILL);
   gl.uniform1i(this.u.distant,0);
   gl.uniform2f(this.u.fogRange,24,62);
  }

  const data=this.dynamicData(entities,effects,performance.now()*.001);this.updateDynamic(data);gl.disable(gl.CULL_FACE);this.drawMesh(this.dynamic);gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(this.u.alpha,.57);for(const m of visible)this.drawMesh(m.transparent);gl.depthMask(true);gl.disable(gl.BLEND);
  if(blurActive)this.applyDistanceBlur(width,height,farLook?FAR_LOOK.nearPlaneMeters:.05,farLook?FAR_LOOK.farPlaneMeters:260);
  if(this.hologram?.render(vp,performance.now()*.001))this.lastDrawCalls++;
  player.visualStepOffset=dampStepOffset(player.visualStepOffset,dt);
 }
}
