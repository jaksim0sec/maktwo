import {meshChunk,cube,rgb} from './mesher.js';import {SIZE} from '../core/chunk.js';import {clamp} from '../util/math.js';
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aColor;layout(location=2) in float aShade;
uniform mat4 uVP;uniform vec3 uCamera;uniform float uTime;
out vec3 vColor;out float vFog;out float vWorldY;
void main(){gl_Position=uVP*vec4(aPos,1.);vWorldY=aPos.y;vColor=aColor*aShade;float d=length(aPos-uCamera);vFog=clamp((d-28.)/70.,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;in vec3 vColor;in float vFog;in float vWorldY;uniform vec3 uFog;uniform float uBrightness;uniform float uAlpha;out vec4 frag;
void main(){vec3 c=vColor*uBrightness;c=mix(c,uFog,vFog);frag=vec4(c,uAlpha);}`;
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
function program(gl){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
function matMultiply(a,b){const o=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
function view(yaw,pitch,x,y,z){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const fx=-sy*cp,fy=sp,fz=-cy*cp;const rx=cy,ry=0,rz=-sy;const ux=-sy*sp,uy=cp,uz=-cy*sp;return new Float32Array([rx,ux,-fx,0,ry,uy,-fy,0,rz,uz,-fz,0,-(rx*x+ry*y+rz*z),-(ux*x+uy*y+uz*z),fx*x+fy*y+fz*z,1])}
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;this.program=program(gl);gl.useProgram(this.program);this.u={vp:gl.getUniformLocation(this.program,'uVP'),camera:gl.getUniformLocation(this.program,'uCamera'),fog:gl.getUniformLocation(this.program,'uFog'),brightness:gl.getUniformLocation(this.program,'uBrightness'),alpha:gl.getUniformLocation(this.program,'uAlpha'),time:gl.getUniformLocation(this.program,'uTime')};this.meshes=new Map();this.dynamic=null;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(.62,.78,.92,1)}
 upload(data){const gl=this.gl,vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,28,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,28,24);gl.bindVertexArray(null);return{vao,vbo,count:data.length/7}}
 replace(old,data){if(old)this.dispose(old);return this.upload(data)}
 dispose(m){this.gl.deleteBuffer(m.vbo);this.gl.deleteVertexArray(m.vao)}
 sync(world,player){for(const [k,m] of this.meshes)if(!world.chunks.has(k)){this.dispose(m.opaque);this.dispose(m.transparent);this.meshes.delete(k)}
  let count=0;for(const [k,c] of world.chunks){if(!c.dirty)continue;if(count++>=5)break;const geo=meshChunk(world,c),old=this.meshes.get(k);this.meshes.set(k,{opaque:this.replace(old?.opaque,geo.opaque),transparent:this.replace(old?.transparent,geo.transparent)});c.dirty=false}}
 drawMesh(mesh){if(!mesh?.count)return;const gl=this.gl;gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count)}
 dynamicData(entities,effects,time){const arr=[];for(const e of entities){const walk=Math.sin(time*7+e.id)*.12;const zombie=e.type==='zombie',c=zombie?rgb('#5e9658'):rgb('#e5dfce'),head=zombie?rgb('#77b376'):rgb('#d0c1ab');const x=e.x,y=e.y,z=e.z;cube(arr,x-.27,y+.52,z-.17,.54,zombie?.78:.56,.34,c);cube(arr,x-.25,y+(zombie?1.34:.95),z-.25,.5,.45,.5,head);if(zombie){cube(arr,x-.42,y+.58,z-.11,.15,.64,.2,c);cube(arr,x+.27,y+.58,z-.11,.15,.64,.2,c)}for(const s of [-1,1])cube(arr,x+s*.13-.12,y+.05+(s===1?Math.max(0,walk):Math.max(0,-walk)),z-.13,.24,.46,.26,zombie?rgb('#4c6081'):rgb('#6e6a65'));
  if(e.flash>0)cube(arr,x-.3,y+.4,z-.28,.6,.2,.56,rgb('#ff8787'))}
 for(const p of effects.particles)cube(arr,p.x-.045,p.y-.045,p.z-.045,.09,.09,.09,rgb(p.color),1);return new Float32Array(arr)}
 frame(world,player,entities,effects){const gl=this.gl,canvas=this.canvas,dpr=Math.min(devicePixelRatio||1,1.7),width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}gl.viewport(0,0,width,height);
  const t=world.time/24000*Math.PI*2,day=clamp(Math.sin(t)+.3,.12,1),fog=[.38+day*.22,.43+day*.35,.55+day*.35];gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const camY=player.y+player.eye,vp=matMultiply(perspective(75*Math.PI/180,width/Math.max(1,height),.05,140),view(player.yaw,player.pitch,player.x,camY,player.z));gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform3f(this.u.camera,player.x,camY,player.z);gl.uniform3fv(this.u.fog,fog);gl.uniform1f(this.u.brightness,day);gl.uniform1f(this.u.time,world.time);gl.uniform1f(this.u.alpha,1);
  for(const m of this.meshes.values())this.drawMesh(m.opaque);
  const data=this.dynamicData(entities,effects,world.time*.01);this.dynamic=this.replace(this.dynamic,data);gl.disable(gl.CULL_FACE);this.drawMesh(this.dynamic);gl.enable(gl.CULL_FACE);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(this.u.alpha,.57);for(const m of this.meshes.values())this.drawMesh(m.transparent);gl.depthMask(true);gl.disable(gl.BLEND);
 }
}
