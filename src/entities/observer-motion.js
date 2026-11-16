import {observerRig} from './observer-poses.js';

export const OBSERVER_STEP=.18;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const unit=value=>clamp(value,0,1);
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=unit(t);return t*t*(3-2*t)};
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

const still={from:'idle',to:'idle',blend:0};
const walks=['walk0','walk1','walk2','walk3','walk4','walk5'];
const runs=['charge1','charge2','charge3','charge4'];
const pair=(from,to,blend=0)=>({from,to,blend});
function cycle(poses,phase){
 const f=(phase%poses.length+poses.length)%poses.length,i=Math.floor(f);
 return pair(poses[i],poses[(i+1)%poses.length],f-i);
}

export function observerSample(view,clock,sampleTime=clock){
 const track=view.track??view,member=view.member,dead=Boolean(member?.dead);
 const previous=dead?null:view.previous;
 const frame=previous?unit((clock-sampleTime)/OBSERVER_STEP):1;
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
export function observerMotion(view,clock,sampleTime=clock){
 const sample=observerSample(view,clock,sampleTime),member=view.member;
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
 const eye=landmarks[0],neck=[eye[0]*.83,eye[1]-.33,eye[2]-.19];
 return {sample,base,overlay,overlayWeight,guard,ground,head,eyes,neck,eye,landmarks};
}

export function observerHitRegions(motion){
 const {sample,landmarks,neck,head,ground,guard}=motion;
 const c=Math.cos(sample.yaw),s=Math.sin(sample.yaw);
 const point=([x,y,z])=>[sample.x+x*c+z*s,sample.y+y*(1-guard*.12)+ground,sample.z-x*s+z*c];
 const [eye,torso,legs]=landmarks;
 const face=rotate(eye,neck,...head);
 return [
  ['head',point(face),.218,.22],
  ['body',point(neck),.165,.22],
  ['body',point(torso),.31,.50],
  ['leg',point(legs),.32,.40]
 ];
}
