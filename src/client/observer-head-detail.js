import {BLOCK_SIZE} from '../core/scale.js';
import {HELD_LIGHT_SHADER,heldLightUniforms} from './held-light.js';

const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec2 aUv;
uniform mat4 uVP;
uniform vec4 uPlace;
uniform vec3 uEyePivot,uNeckPivot;
uniform vec2 uNeck,uEyeAim;
uniform float uGuard,uGround,uIsEye;
out vec2 vUv;
out vec3 vPos,vNormalHint,vModelPos;
vec3 turn(vec3 point,vec3 center,vec2 angles){
 vec3 p=point-center;
 float cy=cos(angles.x),sy=sin(angles.x),cp=cos(angles.y),sp=sin(angles.y);
 float z=p.z*cp-p.y*sp;
 return center+vec3(p.x*cy+z*sy,p.y*cp+p.z*sp,-p.x*sy+z*cy);
}
void main(){
 vec3 sourceEye=vec3(0.,-.0075,-.065);
 vec3 p=(aPosition-(uIsEye>.5?vec3(0.):sourceEye))*.176+uEyePivot;
 if(uIsEye>.5)p=turn(p,uEyePivot,uEyeAim);
 p=turn(p,uNeckPivot,uNeck);
 vec3 radial=p-turn(uEyePivot,uNeckPivot,uNeck);
 p.y+=uGround-uGuard*.12*uEyePivot.y;
 float c=cos(uPlace.w),s=sin(uPlace.w);
 vNormalHint=uIsEye>.5?normalize(vec3(radial.x*c+radial.z*s,radial.y,-radial.x*s+radial.z*c)):vec3(0.);
 vUv=aUv;
 vModelPos=aPosition;
 vPos=(vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c)+uPlace.xyz)*${BLOCK_SIZE.toFixed(2)};
 gl_Position=uVP*vec4(vPos,1.);
}`;
const FRAG=`#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vPos,vNormalHint,vModelPos;
uniform vec3 uEye,uFog,uLightOrigin,uLightSize;
uniform vec2 uFogRange;
uniform float uIsEye,uCloud;
uniform float uPresence,uHeadBlend;
uniform sampler2D uArtwork;
uniform highp sampler3D uLightVolume;
out vec4 frag;
${HELD_LIGHT_SHADER}
void main(){
 float blendGrain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 if(blendGrain>uHeadBlend)discard;
 if(uPresence<.999){
  if(blendGrain>uPresence)discard;
 }
 vec3 normal=normalize(uIsEye>.5?vNormalHint:cross(dFdx(vPos),dFdy(vPos)));
 vec3 pos=vPos/${BLOCK_SIZE.toFixed(2)}-uLightOrigin;
 vec4 light=vec4(0.);
 if(all(greaterThanEqual(pos,vec3(0.)))&&all(lessThan(pos,uLightSize)))light=texture(uLightVolume,pos/uLightSize);
 vec3 color=texture(uArtwork,vUv).rgb;
 if(uIsEye<.5){
  float front=smoothstep(-.09,.18,vModelPos.z+.125*(1.-smoothstep(-1.4,-.45,vModelPos.y)));
  float side=abs(vModelPos.x)/max(.02,length(vModelPos.xz));
  float sideFade=smoothstep(.72,.98,side);
  float edgeFade=smoothstep(.81,.99,abs(vModelPos.x))*.62;
  float painted=front*(1.-max(sideFade*.90,edgeFade));
  vec3 clay=vec3(.255,.198,.174);
  color=mix(clay,color,painted);
  float nape=smoothstep(.60,.92,-vModelPos.y)*smoothstep(.20,.62,-vModelPos.z);
  color=mix(color,vec3(.212,.165,.148),nape*.74);
 }
 float facing=max(0.,dot(normal,normalize(vec3(-.38,.71,.57))));
 vec3 ambient=vec3(.128,.138,.153)+vec3(.24,.29,.28)*light.a;
 vec3 emit=max(light.rgb,heldLightAt(vPos/${BLOCK_SIZE.toFixed(2)}+normal*.02,normal));
 color*= (ambient+emit*.85)*(.72+.28*facing);
 if(uIsEye>.5){
  vec3 view=normalize(uEye-vPos);
  float shine=pow(max(0.,dot(normal,normalize(view+normalize(vec3(-.38,.71,.57))))),48.);
  color+=vec3(.04,.04,.035)*shine*(1.-uCloud);
  color=mix(color,vec3(.18,.18,.15),uCloud*.6);
 }
 float fog=clamp((distance(vPos,uEye)-uFogRange.x)/uFogRange.y,0.,1.);
 frag=vec4(mix(color,uFog,fog*.91),1.);
}`;
function shader(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
 return s;
}
function image(url){
 return new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(`Observer texture ${url}`));img.src=url;
 });
}
export class ObserverHeadDetail{
 constructor(gl){this.gl=gl;this.ready=false;this.loading=null;this.tryAt=0;}
 ensureLoaded(){
  if(this.ready||this.loading||performance.now()<this.tryAt)return;
  this.loading=this.load().catch(error=>{
   console.error('[Observer head]',error);this.tryAt=performance.now()+10000;
  }).finally(()=>{this.loading=null;});
 }
 async load(){
  const url=new URL('../../assets/observer-head.mesh',import.meta.url);
  const [response,face,eye]=await Promise.all([fetch(url),image(new URL('../../assets/observer-face.jpg',import.meta.url)),image(new URL('../../assets/observer-eye.jpg',import.meta.url))]);
  if(!response.ok)throw Error('Observer head '+response.status);
  const data=await response.arrayBuffer(),view=new DataView(data),gl=this.gl;
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,VERT));
  gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  this.program=program;
  this.u=Object.fromEntries(['VP','Place','EyePivot','NeckPivot','Neck','EyeAim','Guard','Ground','IsEye','Eye','Fog','FogRange','Cloud','Presence','HeadBlend','Artwork','LightVolume','LightOrigin','LightSize'].map(key=>[key,gl.getUniformLocation(program,'u'+key)]));
  this.heldLightUniforms=heldLightUniforms(gl,program);
  this.parts=[];
  let offset=0;
  for(const source of [face,eye]){
   const count=view.getUint32(offset,true),indices=view.getUint32(offset+4,true);offset+=8;
   const vertices=new Float32Array(data.slice(offset,offset+count*20));offset+=count*20;
   const elements=new Uint16Array(data.slice(offset,offset+indices*2));offset+=indices*2;
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
   const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,elements,gl.STATIC_DRAW);
   gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
   gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.generateMipmap(gl.TEXTURE_2D);
   this.parts.push({vao,texture,indices});
  }
  gl.bindVertexArray(null);this.ready=true;
 }
 draw(motion,vp,eye,fog,fogRange,lightOrigin,lightSize,cloud,presence,blend,heldLight,now){
  if(!this.ready){
   this.ensureLoaded();
   return false;
  }
  const gl=this.gl,u=this.u,{sample}=motion;
  gl.useProgram(this.program);gl.uniformMatrix4fv(u.VP,false,vp);
  gl.uniform4f(u.Place,sample.x,sample.y,sample.z,sample.yaw);
  gl.uniform3fv(u.EyePivot,motion.eye);gl.uniform3fv(u.NeckPivot,motion.neck);
  gl.uniform2fv(u.Neck,motion.head);gl.uniform2fv(u.EyeAim,motion.eyes);
  gl.uniform1f(u.Guard,motion.guard);gl.uniform1f(u.Ground,motion.ground);
  gl.uniform3fv(u.Eye,eye);gl.uniform3fv(u.Fog,fog);gl.uniform2fv(u.FogRange,fogRange);
  gl.uniform3fv(u.LightOrigin,lightOrigin);gl.uniform3fv(u.LightSize,lightSize);
  gl.uniform1f(u.Cloud,cloud);gl.uniform1i(u.LightVolume,0);
  gl.uniform1f(u.Presence,presence);
  gl.uniform1f(u.HeadBlend,blend);
  if(heldLight)heldLight.bindUniforms(this.heldLightUniforms,now);
  else gl.uniform4f(this.heldLightUniforms.Current,0,0,0,-1);
  gl.activeTexture(gl.TEXTURE1);gl.uniform1i(u.Artwork,1);
  for(let i=0;i<this.parts.length;i++){
   const {vao,texture,indices}=this.parts[i];
   gl.uniform1f(u.IsEye,i);gl.bindVertexArray(vao);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.drawElements(gl.TRIANGLES,indices,gl.UNSIGNED_SHORT,0);
  }
  gl.activeTexture(gl.TEXTURE0);gl.bindVertexArray(null);
  return true;
 }
}
