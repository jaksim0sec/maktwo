import {ObserverRenderer} from './observer-render.js';
import {weaponView} from './weapon-view.js';
import {weaponBasis} from '../core/combat.js';
import {raycast} from '../core/physics.js';
import {block as itemBlock} from '../core/blocks.js';
import {meshChunkData,cube,rgb} from './mesher.js';import {SIZE,MESH_NEIGHBORS} from '../core/chunk.js';import {clamp} from '../util/math.js';
import {BLOCK_SIZE,toMeters} from '../core/scale.js';
import {CITY_MODE,CITY_BASE_Y,CITY_BLUEPRINT_VERSION,createCityPlan} from '../worldgen/eternal-night-game.js';
import {distantCityMesh,distanceSectorVisible} from './city-distance.js';
import {cityFarMesh} from './city-far.js';
import {FAR_LOOK} from './far-look.js';
import {LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,makeOccluderSnapshot,makeDaylightSnapshot,buildLightVolume} from '../core/lightVolume.js';
import {cameraEyeY,dampStepOffset} from './camera.js';
import {makeTextureLayers} from './textures.js';
import {skyClarityAt} from './atmosphere.js';
import {TRAIN,trainDoorMotion} from '../worldgen/station-train.js';
import {stationTrainMesh} from './station-train-mesh.js';
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aColor;layout(location=2) in float aShade;
uniform mat4 uVP;uniform vec3 uCamera;uniform vec3 uEntityOffset;uniform float uTime;uniform vec2 uFogRange;
out vec3 vColor;out float vFog;out vec3 vPos;out vec3 vMaterialPos;out float vEmission;flat out int vMaterial;flat out int vTurns;
void main(){vec3 worldPosition=aPos+uEntityOffset;gl_Position=uVP*vec4(worldPosition*${BLOCK_SIZE.toFixed(2)},1.);vPos=worldPosition;vMaterialPos=aPos;vEmission=aShade<0.?1.:0.;int packedMat=aShade<0.?0:int(floor(aShade*.25));vTurns=packedMat>>7;vMaterial=packedMat&127;vColor=aColor*(aShade<0.?abs(aShade):(aShade-4.*float(packedMat)));float d=length(worldPosition*${BLOCK_SIZE.toFixed(2)}-uCamera);vFog=clamp((d-uFogRange.x)/uFogRange.y,0.,1.);}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vColor;in float vFog;in vec3 vPos;in vec3 vMaterialPos;in float vEmission;flat in int vMaterial;flat in int vTurns;
uniform vec3 uFog;uniform vec3 uLowerFog;uniform float uBrightness;uniform float uAlpha;uniform bool uCityDaylight;
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
 float daylight=.025;
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
   if(uCityDaylight&&light.a>0.){
    vec3 edge=min(samplePos,vec3(size)-samplePos);
    float weight=smoothstep(0.,4.,min(edge.x,min(edge.y,edge.z)));
    daylight=mix(daylight,light.a,weight);
   }
  }
 }
 vec3 ambient=vec3(.65,.72,.93)*uBrightness;
 if(uCityDaylight){
  vec3 sun=normalize(vec3(.42,.86,-.29));
  float facing=max(0.,dot(normal,sun));
  // Sealed skylight controls the cool bounce. The shadow floor is nearly neutral.
  float outdoorHeight=smoothstep(${(CITY_BASE_Y-2).toFixed(1)},${(CITY_BASE_Y+8).toFixed(1)},vPos.y);
  float skyFill=daylight*(.54+.46*daylight);
  float hemisphere=normal.y*.5+.5;
  vec3 fill=mix(vec3(.100,.106,.105),vec3(.126,.134,.131),hemisphere);
  vec3 skyTint=mix(vec3(.42,.48,.46),vec3(.49,.59,.55),outdoorHeight);
  ambient=fill+skyTint*skyFill
   +vec3(.49,.43,.33)*facing*smoothstep(.68,.96,daylight)*mix(.65,1.,outdoorHeight);
  // Broad fluorescent spill stays visible without washing out concrete.
  emission*=mix(.68,.88,outdoorHeight);
  ambient+=vec3(.14,.15,.14)*max(0.,uBrightness-.35);
  if(uDistant)ambient=vec3(.37,.41,.39); // Fog provides the distant color shift.
 }
 // Keep authored block colors unchanged; light range is controlled by each source.
 vec3 tinted=vColor;
 if(vMaterial>0){
  vec3 axis=abs(normal);vec2 uv=axis.y>axis.x&&axis.y>axis.z?vMaterialPos.xz:(axis.x>axis.z?vMaterialPos.zy:vMaterialPos.xy);
  // D4 symmetry with turn/reflection bits already packed in aShade.
  int quarter=vTurns&3;
  uv=mix(uv,uv.yx,float(quarter&1));
  uv*=vec2(1.-2.*float(quarter==1||quarter==2),1.-2.*float(quarter>=2));
  uv.x*=1.-2.*float((vTurns>>2)&1);
  if(vMaterial>=95&&vMaterial<=98)uv*=vMaterial==95?1.45:(vMaterial==98?2.75:1.05); // wider fabric weave, fine iron marks
  tinted*=texture(uMaterials,vec3(uv,float(vMaterial-1))).rgb;
 }
 // Use the source spectrum: fluorescent tubes stay cool and torches stay warm.
 vec3 c=vEmission>.5?min(tinted,vec3(1.)):tinted*(ambient+emission*.88)+emission*.13;
 float peak=max(c.r,max(c.g,c.b));
 if(uCityDaylight){
  float knee=vEmission>.5?.60:.39;
  c/=1.+max(0.,peak-knee)*.78;
  // Lift the deepest non-emissive tones without flattening lit surfaces.
  if(vEmission<.5)c+=.014*(1.-smoothstep(.025,.16,peak));
  float lowAir=1.-smoothstep(${(CITY_BASE_Y+4).toFixed(1)},${(CITY_BASE_Y+42).toFixed(1)},vPos.y);
  c=mix(c,mix(uFog,uLowerFog,lowAir),smoothstep(.13,1.,vFog));
 }else{
  c/=1.+max(0.,peak-1.)*.6;
  c=mix(c,uFog,vFog);
 }
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
uniform float uClarity;uniform float uSkyBrightness;uniform float uCitySky;uniform vec2 uCityGradient;
uniform vec2 uGroundView;
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
 color+=vec3(.21,.22,.23)*stars*(1.-uClarity)*(1.-uCitySky);
 vec3 citySky=mix(vec3(.79,.88,.85),vec3(.58,.77,.76),smoothstep(uHorizon-.20,uHorizon+.72,uv.y));
 citySky*=mix(.70,1.30,uCityGradient.x);
 // Camera-ray intersection with a distant floor plane. It stays below the
 // horizon even when the camera pitches steeply, and costs no extra mesh.
 float pitch=uGroundView.x;
 float rayY=sin(pitch)+(uv.y*2.-1.)*.767327*cos(pitch);
 float depth=max(0.,-rayY);
 float reach=uGroundView.y/max(.001,depth);
 float ground=1.-exp(-depth*mix(9.,23.,uCityGradient.y));
 float haze=smoothstep(55.,480.,reach);
 vec3 groundHaze=vec3(.22,.33,.31);
 vec3 groundColor=mix(vec3(.082,.125,.119),groundHaze,haze);
 citySky=mix(citySky,groundColor,ground);
 color=mix(color,citySky,uCitySky);
 frag=vec4(color,1.);
}`;
// Tiny sky-only silhouettes: no distant chunks, lighting, textures or depth writes.
const SKYLINE_VERT=`#version 300 es
precision highp float;
uniform vec4 uTowers[12];
out vec2 localPos;out float opacity;
void main(){
 int index=gl_VertexID/6,corner=gl_VertexID%6;
 vec4 tower=uTowers[index];
 vec2 cornerPos=vec2(corner==1||corner==4||corner==5?1.:0.,corner==2||corner==3||corner==5?1.:0.);
 localPos=cornerPos;opacity=tower.w;
 gl_Position=vec4((tower.xy+cornerPos*vec2(tower.z,tower.z*4.5))*2.-1.,0.,1.);
}`;
const SKYLINE_FRAG=`#version 300 es
precision highp float;
in vec2 localPos;in float opacity;out vec4 frag;
void main(){
 vec2 p=vec2((localPos.x-.5)*2.,localPos.y);
 float shaft=1.-smoothstep(.20,.25,abs(p.x));
 float lowerRing=(1.-smoothstep(.76,.81,abs(p.x)))*smoothstep(.15,.20,p.y)*(1.-smoothstep(.27,.32,p.y));
 float upperRing=(1.-smoothstep(.52,.58,abs(p.x)))*smoothstep(.56,.60,p.y)*(1.-smoothstep(.64,.69,p.y));
 float cap=(1.-smoothstep(.30,.35,abs(p.x)))*smoothstep(.90,.94,p.y)*(1.-smoothstep(.96,1.,p.y));
 float shape=max(max(shaft,lowerRing),max(upperRing,cap));
 float fade=smoothstep(.03,.47,p.y)*(1.-smoothstep(.88,1.,p.y)*.15);
 frag=vec4(.19,.29,.27,opacity*shape*fade);
}`;
// Nearby dust only becomes visible in lit air. Fixed GPU points, no CPU
// particle updates, buffers, or full-screen post-processing.
const DUST_VERT=`#version 300 es
precision highp float;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uTime;
uniform float uPointScale;
uniform highp sampler3D uLightVolume;
uniform vec3 uLightOrigin;
uniform vec3 uLightSize;
out float opacity;
vec3 hash(vec3 p){
 p=fract(p*vec3(.1031,.11369,.13787));
 p+=dot(p,p.yzx+19.19);
 return fract((p.xxy+p.yzz)*p.zyx);
}
void main(){
 int id=gl_VertexID;
 vec3 cell=floor(uEye/3.)+vec3(float(id%5-2),float(id/25-1),float(id/5%5-2));
 vec3 seed=hash(cell);
 vec3 local=fract(seed+vec3(sin(uTime*.23+seed.y*6.)*.065,-uTime*.018,sin(uTime*.17+seed.x*5.)*.055));
 vec3 pos=(cell+local)*3.;
 vec3 delta=pos-uEye;
 float distanceToEye=length(delta);
 vec3 at=pos-uLightOrigin;
 vec4 light=vec4(0.);
 if(all(greaterThanEqual(at,vec3(0.)))&&all(lessThan(at,uLightSize)))
  light=texelFetch(uLightVolume,ivec3(at),0);
 float lamp=light.a>0.?max(light.r,max(light.g,light.b)):0.;
 float sky=light.a*smoothstep(0.,4.,pos.y-${(CITY_BASE_Y-2).toFixed(1)});
 float fade=smoothstep(1.5,3.,distanceToEye)*(1.-smoothstep(4.5,7.,distanceToEye));
 float wrapFade=smoothstep(0.,.10,min(local.y,1.-local.y));
 opacity=max(lamp*.38,sky*.16)*fade*wrapFade;
 gl_Position=uVP*vec4(pos*${BLOCK_SIZE.toFixed(2)},1.);
 gl_PointSize=clamp(uPointScale/max(1.,gl_Position.w),1.,3.);
}
`;
const DUST_FRAG=`#version 300 es
precision highp float;
in float opacity;
out vec4 frag;
void main(){
 vec2 p=gl_PointCoord-.5;
 frag=vec4(.65,.74,.68,opacity*(1.-smoothstep(.06,.25,dot(p,p))));
}
`;
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
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;this.observerRenderer=new ObserverRenderer(gl);this.program=program(gl);this.skyProgram=gl.createProgram();gl.attachShader(this.skyProgram,shader(gl,gl.VERTEX_SHADER,SKY_VERT));gl.attachShader(this.skyProgram,shader(gl,gl.FRAGMENT_SHADER,SKY_FRAG));gl.linkProgram(this.skyProgram);if(!gl.getProgramParameter(this.skyProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.skyProgram));this.skyHorizon=gl.getUniformLocation(this.skyProgram,'uHorizon');this.skyClarity=gl.getUniformLocation(this.skyProgram,'uClarity');this.skyLight=gl.getUniformLocation(this.skyProgram,'uSkyBrightness');this.skyCity=gl.getUniformLocation(this.skyProgram,'uCitySky');this.skyGradient=gl.getUniformLocation(this.skyProgram,'uCityGradient');this.skyGround=gl.getUniformLocation(this.skyProgram,'uGroundView');this.citySkyTone=.55;this.cityGroundFade=.60;this.skyBrightness=0;this.skyVao=gl.createVertexArray();this.skylineProgram=gl.createProgram();gl.attachShader(this.skylineProgram,shader(gl,gl.VERTEX_SHADER,SKYLINE_VERT));gl.attachShader(this.skylineProgram,shader(gl,gl.FRAGMENT_SHADER,SKYLINE_FRAG));gl.linkProgram(this.skylineProgram);if(!gl.getProgramParameter(this.skylineProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.skylineProgram));this.skylineTowers=gl.getUniformLocation(this.skylineProgram,'uTowers[0]');gl.useProgram(this.program);this.u={vp:gl.getUniformLocation(this.program,'uVP'),camera:gl.getUniformLocation(this.program,'uCamera'),entityOffset:gl.getUniformLocation(this.program,'uEntityOffset'),fog:gl.getUniformLocation(this.program,'uFog'),fogRange:gl.getUniformLocation(this.program,'uFogRange'),distant:gl.getUniformLocation(this.program,'uDistant'),centerChunk:gl.getUniformLocation(this.program,'uCenterChunk'),brightness:gl.getUniformLocation(this.program,'uBrightness'),alpha:gl.getUniformLocation(this.program,'uAlpha'),time:gl.getUniformLocation(this.program,'uTime'),lightVolume:gl.getUniformLocation(this.program,'uLightVolume'),lightOrigin:gl.getUniformLocation(this.program,'uLightOrigin'),lightSize:gl.getUniformLocation(this.program,'uLightSize'),materials:gl.getUniformLocation(this.program,'uMaterials')};for(const name of ['LodNear','FarPass','NearY','CityDaylight','LowerFog'])this.u[name]=gl.getUniformLocation(this.program,'u'+name);
 this.dustProgram=gl.createProgram();
 gl.attachShader(this.dustProgram,shader(gl,gl.VERTEX_SHADER,DUST_VERT));
 gl.attachShader(this.dustProgram,shader(gl,gl.FRAGMENT_SHADER,DUST_FRAG));
 gl.linkProgram(this.dustProgram);
 if(!gl.getProgramParameter(this.dustProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.dustProgram));
 this.dustUniforms={};
 for(const name of ['VP','Eye','Time','PointScale','LightVolume','LightOrigin','LightSize'])
  this.dustUniforms[name]=gl.getUniformLocation(this.dustProgram,'u'+name);
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
 gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST_MIPMAP_LINEAR);
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
 resetWorld(world){this.farWorker?.terminate();this.farWorker=null;this.farJob=null;this.farResult=null;this.middleCoverage=null;this.dispose(this.farMesh);this.farMesh=null;this.dispose(this.distanceMesh);this.distanceMesh=null;this.distanceKey='';for(const mesh of this.meshes.values()){this.dispose(mesh.opaque);this.dispose(mesh.transparent)}this.meshes.clear();for(const mesh of this.trainMeshes?.values()??[]){for(const name of ['opaque','transparent','doorSteel','doorGlass'])this.dispose(mesh[name]);for(const states of mesh.levers)for(const lever of states)this.dispose(lever);}this.trainMeshes?.clear();this.completed=[];this.inflight.clear();this.world=world;this.worldToken++;this.lightAppliedKey='';this.lightRequestedKey='';this.lightSerial++;this.lightBusy=false;this.lightHasSources=false;glClearLight(this.gl,this.lightTexture)}
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
  // Rebuild the distant panorama only when the camera changes its 32-block anchor.
  const ax=Math.round(cx/2)*2,az=Math.round(cz/2)*2;
  const key=ax+','+az;
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
    this.farJob={cx:ax,cz:az,key};
    this.farWorker.postMessage({seed:world.seed,cityBlueprints:world.version>=CITY_BLUEPRINT_VERSION?world.version:false,cx:ax,cz:az,token:this.worldToken,includeFar:!this.farMesh});
    return;
   }catch(error){this.failFarWorker(error)}
  }
  const plan=createCityPlan(world.seed,world.version>=CITY_BLUEPRINT_VERSION?world.version:false),options={enhanced:this.farEnabled,partitionForView:!this.farEnabled};
  if(this.farEnabled&&!this.farMesh)this.farMesh=this.upload(cityFarMesh(plan));
  this.distanceMesh=this.replace(this.distanceMesh,distantCityMesh(plan,ax,az,options));
  if(this.distanceMesh){
   this.distanceMesh.sectors=options.sectors||null;
   this.distanceMesh.landmarkVertices=options.landmarkVertices||0;
  }
  this.middleCoverage={radius:options.coveredRadius,x:(ax+.5)*SIZE,z:(az+.5)*SIZE};
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
  const city=world.mode===CITY_MODE;
  if(!sources.length&&!city){
   if(this.lightHasSources)glClearLight(this.gl,this.lightTexture);
   this.lightHasSources=false;this.lightAppliedKey=requestKey;this.lightBusy=false;
   return;
  }
  this.lightHasSources=true;
  const {blocks,skyTop}=city?makeDaylightSnapshot(world,origin):{blocks:makeOccluderSnapshot(world,origin)};
  if(this.lightWorker){
   const transfers=skyTop?[blocks.buffer,skyTop.buffer]:[blocks.buffer];
   this.lightWorker.postMessage({token,origin,blocks:blocks.buffer,sources,skyTop:skyTop?.buffer},transfers);
   return;
  }
  const result=buildLightVolume(blocks,sources,{origin,skyTop});const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,0,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH,gl.RGBA,gl.UNSIGNED_BYTE,result);
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
 drawMesh(mesh,first=0,count=mesh?.count){if(!count)return;this.lastDrawCalls++;const gl=this.gl;gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,first,count)}
 drawMeshRange(mesh,first,count){if(!mesh?.count||count<=0)return;this.lastDrawCalls++;const gl=this.gl;gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,first,count)}
 dynamicData(entities,effects,time){
  const arr=[];
  for(const e of entities){
   if(e.type==='train')continue;
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
 frame(world,player,entities,effects,dt=1/60,combat=null,observers=null){const gl=this.gl,canvas=this.canvas,dpr=this.maxPixelRatio*(this.hologram?.opened?Math.max(this.renderScale,.96):this.renderScale),width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}gl.viewport(0,0,width,height);
  this.lastDrawCalls=1;this.lastDistanceDrawCalls=0;
  const walkingSpeed=player.fly||!player.grounded?0:Math.min(7,Math.hypot(player.vx,player.vz));
  this.walkAmount+=(Math.min(1,walkingSpeed/5)-this.walkAmount)*(1-Math.exp(-dt*8));
  this.walkPhase+=walkingSpeed*dt*2.2;
  const walkSway=Math.sin(this.walkPhase)*this.walkAmount*.012;
  const city=world.mode===CITY_MODE,farLook=city&&this.farEnabled;
  const blurActive=city&&this.distanceBlurEnabled&&!this.hologram?.opened&&this.prepareDistanceBlur(width,height);
  if(blurActive)gl.bindFramebuffer(gl.FRAMEBUFFER,this.distanceBlurTarget.fbo);
  const clarity=skyClarityAt(cameraEyeY(player)),skyLight=player.creative?Math.max(0,Math.min(1,this.skyBrightness)):0;
  const fog=city?[.155,.234,.218]:[.067+.53*clarity+.17*skyLight,.067+.70*clarity+.19*skyLight,.075+.83*clarity+.22*skyLight];gl.clearColor(...fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // Render sky separately from voxel fog so the horizon is not a flat navy fill.
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.skyProgram);
  const horizon=Math.max(-.6,Math.min(1.6,.5-Math.tan(player.pitch)*.32));
  gl.uniform1f(this.skyHorizon,horizon);
  gl.uniform2f(this.skyGround,player.pitch,Math.max(1,toMeters(cameraEyeY(player)-CITY_BASE_Y)));
  gl.uniform1f(this.skyClarity,clarity);gl.uniform1f(this.skyLight,skyLight);gl.uniform1f(this.skyCity,city?1:0);gl.uniform2f(this.skyGradient,this.citySkyTone,this.cityGroundFade);
  gl.bindVertexArray(this.skyVao);gl.drawArrays(gl.TRIANGLES,0,3);
  if(city){
   const towers=new Float32Array(48),aspect=width/Math.max(1,height),horizontalScale=2*Math.tan(75*Math.PI/360)*aspect;
   for(let group=0;group<4;group++)for(let n=0;n<3;n++){
    const i=group*3+n,angle=group*Math.PI/2+[-.31,.02,.35][n];
    const delta=Math.atan2(Math.sin(player.yaw-angle),Math.cos(player.yaw-angle));
    const size=[.023,.030,.020][n],x=Math.abs(delta)<1.18?.5+Math.tan(delta)/horizontalScale-size/2:-2;
    towers.set([x,horizon-.075+(n-1)*.006,size,.21+(i%3)*.025],i*4);
   }
   gl.useProgram(this.skylineProgram);gl.uniform4fv(this.skylineTowers,towers);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.drawArrays(gl.TRIANGLES,0,72);gl.disable(gl.BLEND);
  }
  gl.bindVertexArray(null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.uniform3f(this.u.entityOffset,0,0,0);
  const swing=combat?.pose(),baseYaw=player.yaw+walkSway;
  const eye=[player.x,cameraEyeY(player),player.z];
  let yaw=baseYaw,pitch=player.pitch;
  if(swing){
   const {forward,right,up}=weaponBasis(baseYaw,pitch);
   const shift=eye.map((_,i)=>forward[i]*(swing.extension*.21-swing.pull*.11-swing.recoil*.085)+right[i]*swing.arc*.055-up[i]*swing.weight*.036);
   const length=Math.hypot(...shift);
   if(length>.001){
    const ray={x:shift[0]/length,y:shift[1]/length,z:shift[2]/length},origin={x:eye[0],y:eye[1],z:eye[2]};
    let limit=raycast(world,origin,ray,length+.09,{solidOnly:true})?.distance??length+.09;
    for(const train of world.trainColliders??[])limit=train.shellDistance(origin,ray,limit);
    const available=Math.max(0,Math.min(1,(limit-.09)/length));
    for(let i=0;i<3;i++)eye[i]+=shift[i]*available;
   }
   yaw-=swing.arc*swing.weight*.23;
   pitch+=swing.pull*.061-swing.extension*.10+swing.recoil*.032;
  }
  const [camX,camY,camZ]=eye.map(toMeters);
  const vp=matMultiply(perspective(75*Math.PI/180,width/Math.max(1,height),farLook?FAR_LOOK.nearPlaneMeters:.05,farLook?FAR_LOOK.farPlaneMeters:city?260:140),view(yaw,pitch,camX,camY,camZ));
  gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform3f(this.u.camera,camX,camY,camZ);gl.uniform3fv(this.u.fog,fog);gl.uniform2f(this.u.fogRange,24,62);gl.uniform1f(this.u.brightness,.35+.43*skyLight);gl.uniform1f(this.u.time,performance.now()*.001);gl.uniform1f(this.u.alpha,1);
  gl.uniform1i(this.u.CityDaylight,city?1:0);
  if(city)gl.uniform3f(this.u.LowerFog,.091,.142,.132);
  this.updateLightVolume(world,player);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,this.lightTexture);
  gl.uniform1i(this.u.lightVolume,0);
  gl.uniform1i(this.u.materials,2);
  gl.uniform3fv(this.u.lightOrigin,this.lightOrigin);
  gl.uniform3f(this.u.lightSize,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH);
  const cx=player.x,cz=player.z,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);const maxDistance=this.maxDistance||88;const visible=[];for(const [k,m] of this.meshes){const chunk=world.chunks.get(k);if(!chunk)continue;const dx=(chunk.cx+.5)*SIZE-cx,dz=(chunk.cz+.5)*SIZE-cz,dist=Math.hypot(dx,dz);if(dist>maxDistance)continue;if(dist>SIZE*2&&(dx*fx+dz*fz)<-dist*.65)continue;visible.push(m)}this.lastDrawnChunks=visible.length;for(const m of visible)this.drawMesh(m.opaque);
  if(this.distanceMesh?.count||this.farMesh?.count){
   gl.uniform2f(this.u.fogRange,30,230);
   gl.uniform1i(this.u.distant,1);
   gl.uniform2f(this.u.centerChunk,Math.floor(cx/SIZE),Math.floor(cz/SIZE));
   gl.enable(gl.POLYGON_OFFSET_FILL);
   if(this.distanceMesh?.count){
    gl.polygonOffset(1,1);
    const mesh=this.distanceMesh;
    if(mesh.sectors?.length){
     if(mesh.landmarkVertices){this.drawMeshRange(mesh,0,mesh.landmarkVertices);this.lastDistanceDrawCalls++}
     // Adjacent visible sectors are contiguous in the same buffer.
     // Merge them to keep draw-call overhead low on mobile GPUs.
     let rangeStart=-1,rangeCount=0;
     const flush=()=>{
      if(rangeCount){this.drawMeshRange(mesh,rangeStart,rangeCount);this.lastDistanceDrawCalls++}
      rangeStart=-1;rangeCount=0;
     };
     for(let i=0;i<mesh.sectors.length;i++){
      const sector=mesh.sectors[i];
      if(!sector.count)continue;
      if(!distanceSectorVisible(i,player.yaw,width/Math.max(1,height))){flush();continue}
      if(rangeStart<0)rangeStart=sector.start;
      rangeCount+=sector.count;
     }
     flush();
    }else{this.drawMesh(mesh);this.lastDistanceDrawCalls++}
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

  this.trainMeshes??=new Map();const trains=[];
  const placeTrain=(e,travel=0,recess=0)=>{
   const along=e.train.axis==='x';
   gl.uniform3f(this.u.entityOffset,e.x+(along?travel:recess),e.y,e.z+(along?recess:travel));
  };
  const drawDoors=(e,mesh,glass)=>{
   const buffer=glass?mesh.doorGlass:mesh.doorSteel;
   placeTrain(e);
   if(!e.doorOpen.some(value=>value>0)){this.drawMesh(buffer);return}
   // Coalesce adjacent closed leaves; only opened leaves need new offsets.
   let first=0,count=0;
   for(const range of mesh.doorRanges){
    const start=glass?range.glassFirst:range.steelFirst;
    const size=glass?range.glassCount:range.steelCount;
    const progress=e.doorOpen[range.index];
    if(!progress){
     if(!count)first=start;
     count+=size;continue;
    }
    if(count){this.drawMesh(buffer,first,count);count=0}
    const {slide,recess}=trainDoorMotion(progress);
    placeTrain(e,range.leaf*slide,-range.side*recess);
    this.drawMesh(buffer,start,size);
    placeTrain(e);
   }
   if(count)this.drawMesh(buffer,first,count);
  };
  for(const e of world.trainColliders||[]){
   if(Math.abs(e.y-player.y)>40||Math.hypot(e.x-cx,e.z-cz)>maxDistance+TRAIN.length/2)continue;
   let mesh=this.trainMeshes.get(e.train.axis);
   if(!mesh){
    const generated=stationTrainMesh(e.train);mesh={doorRanges:generated.doorRanges};
    for(const key of ['opaque','transparent','doorSteel','doorGlass'])mesh[key]=this.upload(generated[key]);
    mesh.levers=generated.levers.map(states=>states.map(state=>this.upload(state)));
    this.trainMeshes.set(e.train.axis,mesh);
   }
   trains.push({e,mesh});
   placeTrain(e);this.drawMesh(mesh.opaque);
   for(const [index,side] of [-1,1].entries())
    this.drawMesh(mesh.levers[index][e.cab===side?e.lever+1:1]);
   drawDoors(e,mesh,false);
  }
  gl.uniform3f(this.u.entityOffset,0,0,0);
  const time=performance.now()*.001;
  const scene=this.dynamicData(entities,effects,time);
  let data=scene;
  if(combat&&(combat.main||combat.off)){
   const held=weaponView(combat,eye,baseYaw,player.pitch,time,this.walkAmount,(center,ray,reach)=>{
    const origin={x:center[0],y:center[1],z:center[2]};
    let room=raycast(world,origin,ray,reach,{solidOnly:true})?.distance??reach;
    for(const train of world.trainColliders??[])room=train.shellDistance(origin,ray,room);
    return room;
   });
   data=new Float32Array(scene.length+held.length);
   data.set(scene);data.set(held,scene.length);
  }
  this.updateDynamic(data);gl.disable(gl.CULL_FACE);this.drawMesh(this.dynamic);gl.enable(gl.CULL_FACE);
  this.lastDrawCalls+=this.observerRenderer.draw(observers,vp,[camX,camY,camZ],fog,[24,62]);
  gl.useProgram(this.program);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);gl.uniform1f(this.u.alpha,.57);
  for(const m of visible)this.drawMesh(m.transparent);
  for(const {e,mesh} of trains){
   placeTrain(e);this.drawMesh(mesh.transparent);
   drawDoors(e,mesh,true);
  }
  gl.uniform3f(this.u.entityOffset,0,0,0);
  if(city&&!this.hologram?.opened&&this.frameAverage<25&&this.renderScale>=.90){
   const u=this.dustUniforms;
   gl.useProgram(this.dustProgram);
   gl.uniformMatrix4fv(u.VP,false,vp);
   gl.uniform3f(u.Eye,player.x,cameraEyeY(player),player.z);
   gl.uniform1f(u.Time,performance.now()*.001);
   gl.uniform1f(u.PointScale,height*.013);
   gl.uniform1i(u.LightVolume,0);
   gl.uniform3fv(u.LightOrigin,this.lightOrigin);
   gl.uniform3f(u.LightSize,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH);
   gl.bindVertexArray(this.skyVao);
   gl.drawArrays(gl.POINTS,0,75);
   this.lastDrawCalls++;
  }
  gl.depthMask(true);gl.disable(gl.BLEND);
  if(blurActive)this.applyDistanceBlur(width,height,farLook?FAR_LOOK.nearPlaneMeters:.05,farLook?FAR_LOOK.farPlaneMeters:260);
  if(this.hologram?.render(vp,performance.now()*.001))this.lastDrawCalls++;
  player.visualStepOffset=dampStepOffset(player.visualStepOffset,dt);
 }
}
