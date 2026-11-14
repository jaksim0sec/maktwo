import {observerPose} from '../entities/observers.js';
import {BLOCK_SIZE} from '../core/scale.js';

const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aStart;
layout(location=1) in vec3 aEnd;
layout(location=2) in vec3 aColor;
uniform mat4 uVP;
uniform vec4 uPlace;
uniform float uBlend,uCloud,uGait,uStride,uBreath,uPresence;
uniform vec2 uNeck,uEyeAim;
uniform int uEyeFrom;
out vec3 vColor,vPos;
void main(){
 vec3 p=mix(aStart,aEnd,uBlend);
 // The existing walk morphs are kept; opposing foot offsets reinforce each step.
 float foot=1.-smoothstep(.12,.92,p.y);
 float beat=uGait+(p.x<0.?3.14159265:0.);
 p.z+=sin(beat)*.065*foot*uStride;
 p.y+=max(0.,sin(beat))*.036*foot*uStride;
 // Upper body remains almost fixed while the neck turns to follow movement.
 float neck=smoothstep(1.26,1.90,p.y);
 float twist=uNeck.x*neck,ct=cos(twist),st=sin(twist);
 vec3 rel=p-vec3(0.,1.48,.14);
 p.x=rel.x*ct+rel.z*st;
 p.z=-rel.x*st+rel.z*ct+.14;
 p.y+=uNeck.y*neck*max(0.,p.z-.14)*.43;
 p.z+=sin(uBreath)*.005*smoothstep(.75,1.25,p.y)*(1.-smoothstep(1.75,2.1,p.y));
 // The eye has its own, quicker micro-saccades inside the head's motion.
 if(gl_VertexID>=uEyeFrom){p.x+=uEyeAim.x*.038;p.y+=uEyeAim.y*.025;}
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
 vec3 color=vColor*(ambient+light.rgb*.85)*(.72+.28*facing);
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
  this.u=Object.fromEntries(['VP','Place','Blend','Cloud','EyeFrom','Eye','Fog','FogRange',
   'Neck','EyeAim','Gait','Stride','Breath','Presence','LightVolume','LightOrigin','LightSize'].map(n=>[n,gl.getUniformLocation(p,'u'+n)]));
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  upload(new Uint16Array(parts[2]),gl.ELEMENT_ARRAY_BUFFER);
  upload(new Uint8Array(parts[1]),gl.ARRAY_BUFFER);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.UNSIGNED_BYTE,true,0,0);
  this.poses=Object.fromEntries(meta.names.map((name,i)=>[name,upload(Float32Array.from(new Int16Array(parts[i+3]),v=>v/4096),gl.ARRAY_BUFFER)]));
  gl.bindVertexArray(null);
  this.eyeFrom=meta.eyeFrom;this.indexCount=parts[2].byteLength/2;this.ready=true;
 }
 draw(pack,vp,eye,fog,fogRange,lightOrigin=[0,0,0],lightSize=[0,0,0]){
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
  gl.disable(gl.CULL_FACE);
  let calls=0;
  for(const e of pack.views){
   const {from,to,blend}=observerPose(e,pack.clock);
   [from,to].forEach((name,i)=>{
    gl.bindBuffer(gl.ARRAY_BUFFER,this.poses[name]);
    gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);
   });
   const a=e.member?.dead?e:e.previous??e;
   const t=Math.min(1,(pack.clock-(pack.sampleTime??pack.clock))/.18);
   const yaw=a.yaw+Math.atan2(Math.sin(e.yaw-a.yaw),Math.cos(e.yaw-a.yaw))*t;
   gl.uniform4f(u.Place,a.x+(e.x-a.x)*t,a.y+(e.y-a.y)*t,a.z+(e.z-a.z)*t,yaw);
   gl.uniform1f(u.Blend,blend);
   gl.uniform1f(u.Cloud,e.member?.dead?Math.min(1,(pack.clock-e.member.hitAt)/1.3):0);
   const track=e.track;
   gl.uniform2f(u.Neck,track?.headYaw??0,track?.headPitch??0);
   gl.uniform2f(u.EyeAim,track?.eyeYaw??0,track?.eyePitch??0);
   gl.uniform1f(u.Gait,track?.phase??0);gl.uniform1f(u.Stride,track?.walking?1:0);
   gl.uniform1f(u.Breath,pack.clock*.85+e.id*1.71);
   gl.uniform1f(u.Presence,e.member?.dead?1:track?.presence??1);
   gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);calls++;
  }
  gl.enable(gl.CULL_FACE);gl.bindVertexArray(null);
  return calls;
 }
}
