import {observerMotion} from '../entities/observer-motion.js';
import {BLOCK_SIZE} from '../core/scale.js';
import {HELD_LIGHT_SHADER,heldLightUniforms} from './held-light.js';

const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aWalkFrom;
layout(location=1) in vec3 aWalkTo;
layout(location=2) in vec3 aColor;
layout(location=3) in vec3 aIdle;
layout(location=4) in vec3 aRunFrom;
layout(location=5) in vec3 aRunTo;
layout(location=6) in vec3 aOverlayFrom;
layout(location=7) in vec3 aOverlayTo;
uniform mat4 uVP;
uniform vec4 uPlace;
uniform vec3 uClipBlend,uClipWeight,uNeckPivot,uEyePivot;
uniform float uCloud,uBreath,uCollapse,uGuard;
uniform vec2 uNeck,uEyeAim;
uniform int uEyeFrom;
out vec3 vColor,vPos;
vec3 rotateJoint(vec3 point,vec3 center,vec2 angles){
 vec3 local=point-center;
 float cy=cos(angles.x),sy=sin(angles.x),cp=cos(angles.y),sp=sin(angles.y);
 float z=local.z*cp-local.y*sp;
 return center+vec3(local.x*cy+z*sy,local.y*cp+local.z*sp,-local.x*sy+z*cy);
}
void main(){
 float upper=smoothstep(.68,1.57,aIdle.y)*.76;
 vec3 walk=mix(mix(aWalkFrom,aWalkTo,uClipBlend.x),aIdle,upper);
 vec3 run=mix(aRunFrom,aRunTo,uClipBlend.y);
 vec3 p=mix(mix(aIdle,walk,uClipWeight.x),run,uClipWeight.y);
 if(uClipWeight.z>0.)p=mix(p,mix(aOverlayFrom,aOverlayTo,uClipBlend.z),uClipWeight.z);
 // The neutral rig defines the neck influence through every authored pose.
 // The eyeball rotates inside its socket, then moves with the whole head.
 if(gl_VertexID>=uEyeFrom)p=rotateJoint(p,uEyePivot,uEyeAim);
 float neck=smoothstep(1.36,1.84,aIdle.y);
 if(neck>0.)p=mix(p,rotateJoint(p,uNeckPivot,uNeck),neck);
 p.z+=sin(uBreath)*.006*smoothstep(.60,1.05,aIdle.y)*(1.-smoothstep(1.55,1.84,aIdle.y));
 p.y=p.y*(1.-uGuard*.12)+uCollapse;
 float c=cos(uPlace.w),s=sin(uPlace.w);
 vPos=(vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c)+uPlace.xyz)*${BLOCK_SIZE.toFixed(2)};
 vColor=gl_VertexID>=uEyeFrom?mix(aColor,vec3(.54,.51,.39),uCloud):aColor;
 gl_Position=uVP*vec4(vPos,1.);
}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vColor,vPos;
uniform vec3 uEye,uFog;
uniform vec2 uFogRange;
uniform float uPresence;
uniform highp sampler3D uLightVolume;uniform vec3 uLightOrigin,uLightSize;
out vec4 frag;
${HELD_LIGHT_SHADER}
void main(){
 vec3 n=normalize(cross(dFdx(vPos),dFdy(vPos)));
 if(uPresence<=0.)discard;
 if(uPresence<.999){
  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  if(grain>uPresence)discard;
 }
 vec3 pos=vPos/0.80-uLightOrigin;
 vec4 light=vec4(0.);
 if(all(greaterThanEqual(pos,vec3(0.)))&&all(lessThan(pos,uLightSize)))
  light=texelFetch(uLightVolume,ivec3(floor(pos)),0);
 float facing=max(0.,dot(n,normalize(vec3(-.38,.71,.57))));
 vec3 ambient=vec3(.105,.112,.116)+vec3(.24,.29,.28)*light.a;
 vec3 emit=max(light.rgb,heldLightAt(vPos/${BLOCK_SIZE.toFixed(2)}+n*.02,n));
 vec3 color=vColor*(ambient+emit*.85)*(.72+.28*facing);
 float fog=clamp((distance(vPos,uEye)-uFogRange.x)/uFogRange.y,0.,1.);
 frag=vec4(mix(color,uFog,fog*.91),1.);
}`;

export class ObserverRenderer {
 constructor(gl){
  this.gl=gl;
  this.ready=false;
 }
 async load(){
  const response=await fetch(new URL('../../assets/observer.mesh',import.meta.url));
  if(!response.ok)throw Error('Observer mesh '+response.status);
  const data=await response.arrayBuffer();
  const header=new DataView(data), count=header.getUint32(0,true);
  let offset=4+count*4;
  const parts=Array.from({length:count},(_,i)=>{
   const size=header.getUint32(4+i*4,true);
   const bytes=data.slice(offset,offset+size);offset+=size;return bytes;
  });
  const meta=JSON.parse(new TextDecoder().decode(parts[0]));
  const gl=this.gl,p=gl.createProgram();
  for(const [type,src] of [[gl.VERTEX_SHADER,VERT],[gl.FRAGMENT_SHADER,FRAG]]){
   const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
   gl.attachShader(p,s);gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  const upload=(buffer,target)=>{
   const handle=gl.createBuffer();gl.bindBuffer(target,handle);gl.bufferData(target,buffer,gl.STATIC_DRAW);return handle;
  };
  this.program=p;
  this.u=Object.fromEntries(['VP','Place','ClipBlend','ClipWeight','Cloud','EyeFrom','Eye','Fog','FogRange',
   'Neck','EyeAim','NeckPivot','EyePivot','Breath','Presence','Collapse','Guard','LightVolume','LightOrigin','LightSize'].map(n=>[n,gl.getUniformLocation(p,'u'+n)]));
  this.heldLightUniforms=heldLightUniforms(gl,p);
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  upload(new Uint16Array(parts[2]),gl.ELEMENT_ARRAY_BUFFER);
  upload(new Uint8Array(parts[1]),gl.ARRAY_BUFFER);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.UNSIGNED_BYTE,true,0,0);
  this.poses=Object.fromEntries(meta.names.map((name,i)=>[name,upload(Float32Array.from(new Int16Array(parts[i+3]),v=>v/4096),gl.ARRAY_BUFFER)]));
  gl.bindBuffer(gl.ARRAY_BUFFER,this.poses.idle);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,3,gl.FLOAT,false,0,0);
  this.poseBindings=[];
  for(const location of [0,1,4,5,6,7])gl.enableVertexAttribArray(location);
  gl.bindVertexArray(null);
  this.eyeFrom=meta.eyeFrom;this.indexCount=parts[2].byteLength/2;this.ready=true;
 }
 draw(pack,vp,eye,fog,fogRange,lightOrigin=[0,0,0],lightSize=[0,0,0],heldLight=null,now=0){
  if(!pack?.views.length)return 0;
  if(!this.ready){
   if(performance.now()<(this.tryAt??0))return 0;
   this.loading??=this.load().catch(e=>{console.error('[Observer]',e);this.loading=null;this.tryAt=performance.now()+10000;});
   return 0;
  }
  const gl=this.gl,u=this.u;
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);
  gl.uniformMatrix4fv(u.VP,false,vp);
  gl.uniform3fv(u.Eye,eye);gl.uniform3fv(u.Fog,fog);gl.uniform2fv(u.FogRange,fogRange);
  gl.uniform1i(u.EyeFrom,this.eyeFrom);
  gl.uniform1i(u.LightVolume,0);gl.uniform3fv(u.LightOrigin,lightOrigin);gl.uniform3fv(u.LightSize,lightSize);
  if(heldLight)heldLight.bindUniforms(this.heldLightUniforms,now);
  else gl.uniform4f(this.heldLightUniforms.Current,0,0,0,-1);
  gl.disable(gl.CULL_FACE);
  let calls=0;
  for(const e of pack.views){
   const motion=observerMotion(e,pack.clock,pack.sampleTime);
   const {sample,base,overlay,overlayWeight}=motion;
   for(const [location,name] of [
    [0,base.walkWeight?base.walk.from:'idle'],[1,base.walkWeight?base.walk.to:'idle'],
    [4,base.runWeight?base.run.from:'idle'],[5,base.runWeight?base.run.to:'idle'],
    [6,overlayWeight?overlay.from:'idle'],[7,overlayWeight?overlay.to:'idle']
   ]){
    const buffer=this.poses[name];
    if(this.poseBindings[location]===buffer)continue;
    this.poseBindings[location]=buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
   }
   gl.uniform4f(u.Place,sample.x,sample.y,sample.z,sample.yaw);
   gl.uniform3f(u.ClipBlend,base.walk.blend,base.run.blend,overlay.blend);
   gl.uniform3f(u.ClipWeight,base.walkWeight,base.runWeight,overlayWeight);
   gl.uniform1f(u.Cloud,e.member?.dead?Math.min(1,(pack.clock-e.member.hitAt)/1.3):0);
   gl.uniform2fv(u.Neck,motion.head);
   gl.uniform2fv(u.EyeAim,motion.eyes);
   gl.uniform3fv(u.NeckPivot,motion.neck);
   gl.uniform3fv(u.EyePivot,motion.eye);
   gl.uniform1f(u.Breath,e.member?.dead?0:pack.clock*.85+e.id*1.71);
   gl.uniform1f(u.Collapse,motion.ground);
   gl.uniform1f(u.Guard,motion.guard);
   gl.uniform1f(u.Presence,e.member?.dead?1:e.track?.presence??1);
   gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);calls++;
  }
  gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
  return calls;
 }
}
