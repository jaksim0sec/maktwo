import {meshChunk,cube,rgb} from './mesher.js';import {SIZE} from '../core/chunk.js';import {clamp} from '../util/math.js';
import {LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,makeOccluderSnapshot,buildLightVolume} from '../core/lightVolume.js';
import {cameraEyeY,dampStepOffset} from './camera.js?v=0.8.0';
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aColor;layout(location=2) in float aShade;
uniform mat4 uVP;uniform vec3 uCamera;uniform float uTime;
out vec3 vColor;out float vFog;out vec3 vPos;out float vEmission;
void main(){gl_Position=uVP*vec4(aPos,1.);vPos=aPos;vEmission=aShade<0.?1.:0.;vColor=aColor*abs(aShade);float d=length(aPos-uCamera);vFog=clamp((d-24.)/62.,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vColor;in float vFog;in vec3 vPos;in float vEmission;
uniform vec3 uFog;uniform float uBrightness;uniform float uAlpha;
uniform highp sampler3D uLightVolume;uniform vec3 uLightOrigin;uniform vec3 uLightSize;
uniform float uTime;
out vec4 frag;
void main(){
 // The lighting volume contains ONLY reachable open-air cells. A wall cannot
 // illuminate its far side. Sample the air just outside the fragment's face.
 vec3 normal=normalize(cross(dFdx(vPos),dFdy(vPos)));
 ivec3 cell=ivec3(floor(vPos+normal*.045-uLightOrigin));
 bool inside=all(greaterThanEqual(cell,ivec3(0)))&&all(lessThan(cell,ivec3(uLightSize)));
 vec3 emission=inside?texelFetch(uLightVolume,cell,0).rgb:vec3(0.);
 vec3 ambient=vec3(.65,.72,.93)*uBrightness;
 // Keep authored block colors unchanged; light range is controlled by each source.
 vec3 c=vEmission>.5?min(vColor,vec3(1.)):vColor*(ambient+emission*1.38);
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
out vec4 frag;
void main(){
 vec3 high=vec3(.018,.020,.025);
 vec3 horizon=vec3(.073,.073,.080);
 vec3 low=vec3(.039,.040,.046);
 float upper=smoothstep(uHorizon-.23,uHorizon+.50,uv.y);
 vec3 color=mix(horizon,high,upper);
 float below=1.-smoothstep(uHorizon-.65,uHorizon+.02,uv.y);
 color=mix(color,low,below*.65);
 frag=vec4(color,1.);
}`;
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
function matMultiply(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
export function view(yaw,pitch,x,y,z){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const fx=-sy*cp,fy=sp,fz=-cy*cp;const rx=cy,ry=0,rz=-sy;const ux=sy*sp,uy=cp,uz=cy*sp;return new Float32Array([rx,ux,-fx,0,ry,uy,-fy,0,rz,uz,-fz,0,-(rx*x+ry*y+rz*z),-(ux*x+uy*y+uz*z),fx*x+fy*y+fz*z,1])}
function glClearLight(gl,texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;this.program=program(gl);this.skyProgram=gl.createProgram();gl.attachShader(this.skyProgram,shader(gl,gl.VERTEX_SHADER,SKY_VERT));gl.attachShader(this.skyProgram,shader(gl,gl.FRAGMENT_SHADER,SKY_FRAG));gl.linkProgram(this.skyProgram);if(!gl.getProgramParameter(this.skyProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.skyProgram));this.skyHorizon=gl.getUniformLocation(this.skyProgram,'uHorizon');this.skyVao=gl.createVertexArray();gl.useProgram(this.program);this.u={vp:gl.getUniformLocation(this.program,'uVP'),camera:gl.getUniformLocation(this.program,'uCamera'),fog:gl.getUniformLocation(this.program,'uFog'),brightness:gl.getUniformLocation(this.program,'uBrightness'),alpha:gl.getUniformLocation(this.program,'uAlpha'),time:gl.getUniformLocation(this.program,'uTime'),lightVolume:gl.getUniformLocation(this.program,'uLightVolume'),lightOrigin:gl.getUniformLocation(this.program,'uLightOrigin'),lightSize:gl.getUniformLocation(this.program,'uLightSize')};this.meshes=new Map();this.dynamic=null;this.dynamicCapacity=0;this.lastDrawnChunks=0;this.worker=null;this.inflight=new Map();this.completed=[];this.world=null;this.worldToken=0;this.renderScale=1;this.frameAverage=16.7;this.scaleCooldown=0;this.lightTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.lightOrigin=[0,0,0];this.lightAppliedKey='';this.lightRequestedKey='';this.lightBusy=false;this.lightSerial=0;this.lightWorker=null;this.lightLastRequest=0;this.hologram=null;this.maxPixelRatio=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,1.2);
 try{if(typeof Worker==='function'){
  this.worker=new Worker(new URL('./mesh.worker.js?v=0.8.0',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{const task=this.inflight.get(data.key);if(!task||task.token!==data.token)return;this.inflight.delete(data.key);if(data.error){console.error('Mesher worker:',data.error);task.chunk.dirty=true;this.disableWorker();return}this.completed.push({task,data})};
  this.worker.onerror=(event)=>{console.warn('Worker unavailable, using fallback mesher',event.message);this.disableWorker()};
 }}catch(error){console.warn('Worker unavailable',error)}
 try{if(typeof Worker==='function'){
  this.lightWorker=new Worker(new URL('./light.worker.js',import.meta.url),{type:'module'});
  this.lightWorker.onmessage=({data})=>{
   if(data.token!==this.lightSerial)return;
   this.lightBusy=false;
   if(data.error){console.warn('Light worker error',data.error);this.lightWorker.terminate();this.lightWorker=null;return}
   const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);
   gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(data.output));
   this.lightOrigin=data.origin;this.lightAppliedKey=this.lightRequestedKey;
  };
  this.lightWorker.onerror=(error)=>{console.warn('Light Worker unavailable',error.message);this.lightWorker.terminate();this.lightWorker=null;this.lightBusy=false};
 }}catch(error){console.warn('Light Worker unavailable',error)}
 gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.039,.040,.046,1)}
 upload(data){const gl=this.gl,vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,28,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,28,24);gl.bindVertexArray(null);return{vao,vbo,count:data.length/7}}
 replace(old,data){if(old)this.dispose(old);return this.upload(data)}
 dispose(m){if(!m)return;this.gl.deleteBuffer(m.vbo);this.gl.deleteVertexArray(m.vao)}
 updateDynamic(data){const gl=this.gl;if(!this.dynamic){this.dynamic=this.upload(data);this.dynamicCapacity=data.byteLength;return}gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.vbo);if(data.byteLength>this.dynamicCapacity){this.dynamicCapacity=Math.max(data.byteLength,Math.ceil(this.dynamicCapacity*1.5),4096);gl.bufferData(gl.ARRAY_BUFFER,this.dynamicCapacity,gl.DYNAMIC_DRAW)}if(data.byteLength)gl.bufferSubData(gl.ARRAY_BUFFER,0,data);this.dynamic.count=data.length/7}
 disableWorker(){this.worker?.terminate();this.worker=null;for(const task of this.inflight.values())task.chunk.dirty=true;this.inflight.clear();this.completed=[]}
 resetWorld(world){for(const mesh of this.meshes.values()){this.dispose(mesh.opaque);this.dispose(mesh.transparent)}this.meshes.clear();this.completed=[];this.inflight.clear();this.world=world;this.worldToken++;this.lightAppliedKey='';this.lightRequestedKey='';this.lightSerial++;this.lightBusy=false;glClearLight(this.gl,this.lightTexture)}
 queueMesh(world,key,chunk){
  chunk.dirty=false;
  const revision=chunk.revision,token=this.worldToken;
  const task={world,key,chunk,revision,token};
  if(!this.worker){const geo=meshChunk(world,chunk);this.completed.push({task,data:{opaque:geo.opaque,transparent:geo.transparent}});return}
  const buffers=[];
  const copy=(a)=>{const data=new Uint8Array(a);buffers.push(data.buffer);return data.buffer};
  const neighbors=[];
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
   const c=world.getChunk(chunk.cx+dx,chunk.cz+dz,false);
   if(c)neighbors.push([dx,dz,copy(c.data)]);
  }
  this.inflight.set(key,task);
  this.worker.postMessage({key,revision,token,seed:world.seed,cx:chunk.cx,cz:chunk.cz,data:copy(chunk.data),neighbors},buffers);
 }
 sync(world,player){
  if(this.world!==world)this.resetWorld(world);
  for(const [key,mesh] of this.meshes)if(!world.chunks.has(key)){this.dispose(mesh.opaque);this.dispose(mesh.transparent);this.meshes.delete(key)}
  // Keep GPU uploads bounded. The heavy CPU mesh work runs off the UI thread.
  if(this.completed.length){const {task,data}=this.completed.shift();const current=world.chunks.get(task.key);
   if(task.world===world&&current===task.chunk){
    if(current.revision===task.revision){const old=this.meshes.get(task.key);this.meshes.set(task.key,{opaque:this.replace(old?.opaque,data.opaque),transparent:this.replace(old?.transparent,data.transparent)})}
    else current.dirty=true;
   }
  }
  if(this.inflight.size>=2||this.completed.length>=2)return;
  const px=Math.floor(player.x/SIZE),pz=Math.floor(player.z/SIZE);
  let best=null,bestDist=Infinity;
  for(const [key,chunk] of world.chunks){
   if(this.inflight.has(key)||(!chunk.dirty&&this.meshes.has(key)))continue;
   const d=(chunk.cx-px)**2+(chunk.cz-pz)**2;
   if(d<bestDist){bestDist=d;best=[key,chunk]}
  }
  if(best)this.queueMesh(world,best[0],best[1]);
 }
 updateLightVolume(world,player){
  const ox=Math.floor(player.x/16)*16-32,oz=Math.floor(player.z/16)*16-32;
  const origin=[ox,0,oz],requestKey=`${this.worldToken}:${world.lightRevision}:${ox}:${oz}`;
  if(requestKey===this.lightAppliedKey||this.lightBusy||performance.now()-this.lightLastRequest<170)return;
  const blocks=makeOccluderSnapshot(world,origin);
  const sources=world.lights.near(player.x,player.y+player.eye,20,52).filter(l=>l.x>=ox&&l.x<ox+LIGHT_WIDTH&&l.z>=oz&&l.z<oz+LIGHT_DEPTH).map(l=>({...l,rgb:rgb(l.color)}));
  const token=++this.lightSerial;this.lightBusy=true;this.lightLastRequest=performance.now();this.lightRequestedKey=requestKey;
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
 drawMesh(mesh){if(!mesh?.count)return;const gl=this.gl;gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 dynamicData(entities,effects,time){const arr=[];for(const e of entities){const walk=Math.sin(time*7+e.id)*.12;const zombie=e.type==='zombie',c=zombie?rgb('#728c72'):rgb('#d9d5cb'),head=zombie?rgb('#8aa089'):rgb('#c7b9a7');const x=e.x,y=e.y,z=e.z;cube(arr,x-.27,y+.52,z-.17,.54,zombie?.78:.56,.34,c);cube(arr,x-.25,y+(zombie?1.34:.95),z-.25,.5,.45,.5,head);if(zombie){cube(arr,x-.42,y+.58,z-.11,.15,.64,.2,c);cube(arr,x+.27,y+.58,z-.11,.15,.64,.2,c)}for(const s of [-1,1])cube(arr,x+s*.13-.12,y+.05+(s===1?Math.max(0,walk):Math.max(0,-walk)),z-.13,.24,.46,.26,zombie?rgb('#4c6081'):rgb('#6e6a65'));
  if(e.flash>0)cube(arr,x-.3,y+.4,z-.28,.6,.2,.56,rgb('#ff8787'))}
 for(const p of effects.particles)cube(arr,p.x-.045,p.y-.045,p.z-.045,.09,.09,.09,rgb(p.color),1);return new Float32Array(arr)}
 frame(world,player,entities,effects,dt=1/60){const gl=this.gl,canvas=this.canvas,dpr=this.maxPixelRatio*this.renderScale,width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}gl.viewport(0,0,width,height);
  const fog=[.067,.067,.075];gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // Render sky separately from voxel fog so the horizon is not a flat navy fill.
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.skyProgram);
  gl.uniform1f(this.skyHorizon,Math.max(-.6,Math.min(1.6,.5-Math.tan(player.pitch)*.32)));
  gl.bindVertexArray(this.skyVao);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindVertexArray(null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);
  const camY=cameraEyeY(player),vp=matMultiply(perspective(75*Math.PI/180,width/Math.max(1,height),.05,140),view(player.yaw,player.pitch,player.x,camY,player.z));gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform3f(this.u.camera,player.x,camY,player.z);gl.uniform3fv(this.u.fog,fog);gl.uniform1f(this.u.brightness,.35);gl.uniform1f(this.u.time,performance.now()*.001);gl.uniform1f(this.u.alpha,1);
  this.updateLightVolume(world,player);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);
  gl.uniform1i(this.u.lightVolume,0);
  gl.uniform3fv(this.u.lightOrigin,this.lightOrigin);
  gl.uniform3f(this.u.lightSize,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH);
  const cx=player.x,cz=player.z,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);const maxDistance=88;const visible=[];for(const [k,m] of this.meshes){const chunk=world.chunks.get(k);if(!chunk)continue;const dx=(chunk.cx+.5)*SIZE-cx,dz=(chunk.cz+.5)*SIZE-cz,dist=Math.hypot(dx,dz);if(dist>maxDistance)continue;if(dist>SIZE*2&&(dx*fx+dz*fz)<-dist*.65)continue;visible.push(m)}this.lastDrawnChunks=visible.length;for(const m of visible)this.drawMesh(m.opaque);
  const data=this.dynamicData(entities,effects,performance.now()*.001);this.updateDynamic(data);gl.disable(gl.CULL_FACE);this.drawMesh(this.dynamic);gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(this.u.alpha,.57);for(const m of visible)this.drawMesh(m.transparent);gl.depthMask(true);gl.disable(gl.BLEND);
  this.hologram?.render(vp,performance.now()*.001);
  player.visualStepOffset=dampStepOffset(player.visualStepOffset,dt);
 }
}
