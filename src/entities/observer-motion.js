import {observerRig,observerEyeRotations} from './observer-poses.js';

export const OBSERVER_STEP=.18;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const unit=value=>clamp(value,0,1);
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=unit(t);return t*t*(3-2*t)};
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
// Never flip straight from one shoulder to the other when a target crosses the rear axis.
export const glanceYaw=yaw=>yaw*(1-smooth((Math.abs(yaw)-2.60)/(Math.PI-2.60)));

const still={from:'idle',to:'idle',blend:0};
const walks=['walk0','walk1','walk2','walk3','walk4','walk5'];
const runs=['charge1','charge2','charge3','charge4'];
const sprintEyeCenter=[.044,1.405,.682];
const pair=(from,to,blend=0)=>({from,to,blend});
function cycle(poses,phase){
 const f=(phase%poses.length+poses.length)%poses.length,i=Math.floor(f);
 return pair(poses[i],poses[(i+1)%poses.length],f-i);
}

export function observerSample(view,clock,sampleTime=clock,duration=OBSERVER_STEP){
 const track=view.track??view,member=view.member,dead=Boolean(member?.dead);
 const previous=dead?null:view.previous;
 const frame=previous?unit((clock-sampleTime)/duration):1;
 const sample=(name,fallback=0)=>{
  const current=view[name]??track[name]??fallback;
  return mix(previous?.[name]??current,current,frame);
 };
 const currentYaw=view.yaw??track.yaw??0,lastYaw=previous?.yaw??currentYaw;
 return {
  x:sample('x'),y:sample('y'),z:sample('z'),yaw:lastYaw+angleDelta(lastYaw,currentYaw)*frame,
  travel:sample('travel',track.phase??0),speed:sample('speed',track.walking?(track.fleeing?3.5:1.05):0),
  head:[sample('headYaw'),sample('headPitch')],eyes:[sample('eyeYaw'),sample('eyePitch')],
  guard:sample('guardWeight',track.guarding?1:0)
 };
}

function blendLandmark(a,b,t){
 return a.map((value,i)=>mix(value,b[i],t));
}
function clipPoint(clip,index){
 return blendLandmark(observerRig[clip.from][index],observerRig[clip.to][index],clip.blend);
}
function clipFloor(clip){
 return mix(observerRig[clip.from][3],observerRig[clip.to][3],clip.blend);
}
function rotate([x,y,z],[px,py,pz],yaw,pitch){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 x-=px;y-=py;z-=pz;
 const tz=z*cp-y*sp;
 return [px+x*cy+tz*sy,py+y*cp+z*sp,pz-x*sy+tz*cy];
}
export function observerMotion(view,clock,sampleTime=clock,duration=OBSERVER_STEP){
 const sample=observerSample(view,clock,sampleTime,duration),member=view.member;
 const distance=sample.travel+(view.id??0)*.22;
 const walk=cycle(walks,distance*3.8),run=cycle(runs,distance*2.55);
 const walkWeight=smooth(sample.speed/1.05),runWeight=smooth((sample.speed-1.45)/1.7);
 let base={walk,run,walkWeight,runWeight},overlay=still,overlayWeight=0,guard=sample.guard;
 let head=sample.head,eyes=sample.eyes;
 const age=clock-(member?.hitAt??-Infinity);
 if(member?.dead){
  base=member.deathBase??{walk:still,run:still,walkWeight:0,runWeight:0};
  const recoil=1-smooth(age/.22);
  head=(member.deathHead??head).map(n=>n*recoil);
  eyes=(member.deathEyes??eyes).map(n=>n*recoil);
  guard=(member.deathGuard??0)*(1-smooth(age/.22));
  if(age<.16){
   const fall=smooth(age/.16),previous=(member.deathOverlayWeight??0)*(1-fall);
   overlayWeight=fall+previous;
   overlay=pair(member.deathOverlay?.from??'fall0','fall0',overlayWeight?fall/overlayWeight:0);
  }else{
   overlay=age<.59?pair('fall0','fall1',smooth((age-.16)/.43)):
    pair('fall1','fall2',smooth((age-.59)/.55));
   overlayWeight=1;
  }
 }else if(age>=0&&age<.55){
  const region=member.region??'body';
  overlay=pair(region,region);
  overlayWeight=smooth(age/.08)*(1-smooth((age-.10)/.45))*.94;
 }else if(sample.guard>.001){
  overlay=pair('charge0','charge0');
  overlayWeight=sample.guard*.34;
 }
 const ground=Math.max(0,-mix(mix(mix(observerRig.idle[3],clipFloor(base.walk),base.walkWeight),
  clipFloor(base.run),base.runWeight),clipFloor(overlay),overlayWeight));
 const landmarks=[0,1,2].map(index=>{
  const idle=observerRig.idle[index];
  // Match the vertex shader's neutral-height weighting on the walk clip.
  const walking=blendLandmark(clipPoint(base.walk,index),idle,smooth((idle[1]-.68)/.89)*.76);
  const moving=blendLandmark(blendLandmark(idle,walking,base.walkWeight),clipPoint(base.run,index),base.runWeight);
  return blendLandmark(moving,clipPoint(overlay,index),overlayWeight);
 });
 // Keep the authored forward lean while softening the large head bounce between run poses.
 const runEye=clipPoint(base.run,0),settle=base.runWeight*(1-overlayWeight)*.68;
 const headOffset=runEye.map((value,i)=>(sprintEyeCenter[i]-value)*settle);
 const eye=landmarks[0].map((value,i)=>value+headOffset[i]);
 landmarks[0]=eye;
 const neck=[eye[0]*.83,eye[1]-.33,eye[2]-.19];
 const look=view.track?.closeLook;
 if(!member?.dead&&look?.weight>.005){
  const cy=Math.cos(sample.yaw),sy=Math.sin(sample.yaw);
  const dx=look.x-sample.x-eye[0]*cy-eye[2]*sy;
  const dz=look.z-sample.z+eye[0]*sy-eye[2]*cy;
  const yaw=glanceYaw(angleDelta(sample.yaw,Math.atan2(dx,dz)));
  const height=sample.y+eye[1]*(1-guard*.12)+ground;
  const pitch=Math.atan2(look.y-height,Math.max(.2,Math.hypot(dx,dz)));
  const headYaw=clamp(yaw*.65,-.80,.80),headPitch=clamp(pitch*.64,-.56,.38);
  head=[mix(head[0],headYaw,look.weight),mix(head[1],headPitch,look.weight)];
  eyes=[mix(eyes[0],clamp(yaw-headYaw,-.53,.53),look.weight),
   mix(eyes[1],clamp(pitch-headPitch,-.42,.34),look.weight)];
 }
 return {sample,base,overlay,overlayWeight,guard,ground,head,eyes,neck,eye,headOffset,landmarks};
}

function rotationMatrix(q){
 const length=Math.hypot(...q),[x,y,z,w]=q.map(value=>value/length);
 return [
  1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y),
  2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x),
  2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)
 ];
}

const eyeMatrices=Object.fromEntries(Object.entries(observerEyeRotations).map(([name,q])=>[name,rotationMatrix(q)]));
const noWarp=new Float32Array(9);

export function observerEyeWarp({base,overlay,overlayWeight}){
 // At eye height the walking pose contributes 24% of its usual blend weight.
 const walk=base.walkWeight*(1-base.runWeight)*(1-overlayWeight)*.24;
 const run=base.runWeight*(1-overlayWeight);
 if(walk+run+overlayWeight===0)return noWarp;
 const q=[0,0,0,0],linear=new Float32Array(9);
 const add=(name,weight)=>{
  if(!weight)return;
  const frame=observerEyeRotations[name],matrix=eyeMatrices[name];
  for(let i=0;i<q.length;i++)q[i]+=frame[i]*weight;
  for(let i=0;i<linear.length;i++)linear[i]+=matrix[i]*weight;
 };
 const addPair=(clip,weight)=>{
  add(clip.from,weight*(1-clip.blend));
  add(clip.to,weight*clip.blend);
 };
 add('idle',1-walk-run-overlayWeight);
 addPair(base.walk,walk);addPair(base.run,run);addPair(overlay,overlayWeight);
 const rigid=rotationMatrix(q);
 // Restore the rigid rotation while retaining the artist's geometry offsets.
 for(let i=0;i<linear.length;i++)linear[i]=rigid[i]-linear[i];
 return linear;
}

export function observerHitRegions(motion){
 const {sample,landmarks,neck,head,ground,guard}=motion;
 const c=Math.cos(sample.yaw),s=Math.sin(sample.yaw);
 const point=([x,y,z],height=y)=>[sample.x+x*c+z*s,sample.y+y-guard*.12*height+ground,sample.z-x*s+z*c];
 const [eye,torso,legs]=landmarks;
 const face=rotate(eye,neck,...head);
 return [
  ['head',point(face,eye[1]),.218,.22],
  ['body',point(neck),.165,.22],
  ['body',point(torso),.31,.50],
  ['leg',point(legs),.32,.40]
 ];
}
