import {collides, intersectAabb, raycast, GRAVITY} from '../core/physics.js';
import {SIZE} from '../core/chunk.js';
import {hash} from '../util/math.js';
import {observerHeads} from './observer-poses.js';

// 소심한 관찰자: distant, solitary sightings; the gaze moves before the feet.
export const OBSERVER_NAME='소심한 관찰자';
const HEIGHT=2.27, EYE=2.06, TICK=.18, FORGET=300, BODY_WIDTH=.48;
const FOCUS_LIMIT=4.8, MIN_SEPARATION=7.5;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const mix=(a,b,t)=>a+(b-a)*t;
function toward(from,to){
 const x=to.x-from.x,y=to.y-from.y,z=to.z-from.z;
 const length=Math.hypot(x,y,z)||1;
 return {x:x/length,y:y/length,z:z/length,length};
}
const shifted=(p,x,z,y=0)=>({x:p.x+x,y:p.y+y,z:p.z+z});

export class ObserverPack {
 constructor(world,{count,random=Math.random}={}){
  this.world=world;
  this.loadedWorld=Object.create(world);
  this.loadedWorld.get=(x,y,z,create,cell)=>world.get(x,y,z,false,cell);
  this.count=count??(3+Math.floor(hash(9,5,2,world.seed)*2));
  this.random=random;
  this.serial=0;
  this.clock=0;
  this.active=null;
  this.views=[];
  this.sleep=null;
  this.next=5;
 }
 loaded(p) {
  return Boolean(this.world.getChunk(Math.floor(p.x/SIZE),Math.floor(p.z/SIZE),false));
 }
 blocked(p,width=BODY_WIDTH,height=HEIGHT){
  const r=width/2;
  return !this.loaded(shifted(p,-r,-r))||!this.loaded(shifted(p,r,r))||
   !this.loaded(shifted(p,-r,r))||!this.loaded(shifted(p,r,-r))||
   collides(this.loadedWorld,p.x,p.y,p.z,width,height);
 }
 supported(p) {
  return this.loaded(p)&&collides(this.loadedWorld,p.x,p.y-.13,p.z,.31,.14);
 }
 clear(a,b){
  if(!this.loaded(a)||!this.loaded(b))return false;
  const ray=toward(a,b);
  return !raycast(this.loadedWorld,a,ray,Math.max(0,ray.length-.10),{solidOnly:true})&&
   !(this.world.trainColliders??[]).some(train=>train.shellDistance(a,ray,ray.length)<ray.length-.10);
 }
 footAt(p){
  for(const offset of [0,1,-1,2,-2,-3,3,-4,4,-6,6]){
   const foot={x:p.x,y:Math.floor(p.y)+offset,z:p.z};
   if(this.supported(foot)&&!this.blocked(foot))return foot;
  }
  return null;
 }
 layout(anchor,yaw,count=this.count){
  return Array.from({length:count},(_,i)=>{
   const lateral=(i-(count-1)*.5)*1.03;
   const back=(i%2)*.42;
   return shifted(anchor,Math.cos(yaw)*lateral-Math.sin(yaw)*back,-Math.sin(yaw)*lateral-Math.cos(yaw)*back);
  });
 }
 formation(anchor,yaw,roster=this.active){
  const slots=this.layout(anchor,yaw,roster?.size??this.count);
  return slots.every((slot,i)=>roster?.members.get(i)?.dead||(!this.blocked(slot)&&!this.blocked(shifted(slot,0,0,.05),.54,HEIGHT-.05)));
 }
 invisible(eye,look,point){
  const head=shifted(point,0,0,EYE), dir=toward(eye,head);
  // Wider than the game camera, including the corners of a landscape viewport.
  if(dir.x*look.x+dir.y*look.y+dir.z*look.z<.27)return true;
  return ![head,shifted(point,0,0,HEIGHT*.52),shifted(point,0,0,.28)].some(p=>this.clear(eye,p));
 }
 shadowScore(p,lights=[]){
  const head=shifted(p,0,0,1.5);
  const roof=Boolean(raycast(this.loadedWorld,head,{x:0,y:1,z:0},12,{solidOnly:true}));
  const lamp=lights.some(l=>Math.abs(l.y-head.y)<5&&Math.hypot(l.x-p.x,l.z-p.z)<Math.min(7,(l.radius??7)*.80));
  return (roof?2:0)-(lamp?3:0);
 }
 lightCandidates(player){
  const cached=this.lightCache;
  if(cached&&cached.revision===this.world.lightRevision&&
     this.clock-cached.at<2&&distance(cached.position,player)<6&&
     Math.abs(cached.position.y-player.y)<4)return cached.lights;
  const lights=this.world.lights?.inBounds(player.x-38,player.x+38,player.z-38,player.z+38,
   {minY:player.y-6,maxY:player.y+13,limit:48,focus:player})??[];
  this.lightCache={at:this.clock,position:{x:player.x,y:player.y,z:player.z},
   revision:this.world.lightRevision,lights};
  return lights;
 }
 spot(player,others=[],lights=[],range=32,near=null){
  const eye=shifted(player,0,0,player.eye),look=player.direction();
  const heading=Math.atan2(look.x,look.z);
  let best=null,score=-Infinity;
  for(let i=0;i<24;i++){
   const n=this.serial++,side=i%2?-1:1;
   const angle=heading+side*(1.02+hash(n,1,3,this.world.seed)*2.02);
   const radius=Math.max(13,Math.min(range-2,15+hash(n,2,5,this.world.seed)*15));
   const p=this.footAt(shifted(player,Math.sin(angle)*radius,Math.cos(angle)*radius));
   if(!p||distance(p,player)<12||others.some(o=>distance(o,p)<MIN_SEPARATION)||
      (near&&distance(p,near)>18)||!this.invisible(eye,look,p))continue;
   const shade=this.shadowScore(p,lights);
   const rank=shade*6+(near?Math.max(0,12-distance(p,near))*.12:0)+hash(n,3,2,this.world.seed);
   if(rank>score){best={...p,shade};score=rank;}
  }
  // A single ambiguous silhouette is acceptable in the open; never gather a crowd there.
  return best&&!(best.shade<1&&others.length>0)?best:null;
 }
 spawn(player,range){
  const lights=this.lightCandidates(player),stalkers=new Map(),placed=[];
  for(let i=0;i<this.count;i++){
   const p=this.spot(player,placed,lights,Math.min(range*.83,36));
   if(!p)continue;
   placed.push(p);
   const side=hash(i,7,1,this.world.seed)<.5?-1:1;
   const yaw=Math.atan2(player.x-p.x,player.z-p.z)+side*(.36+hash(i,8,1,this.world.seed)*.34);
   stalkers.set(i,{...p,id:i,yaw,phase:hash(i,9,4,this.world.seed)*6,
    walking:false,hidden:false,presence:1,focus:0,headYaw:0,headPitch:0,eyeYaw:0,eyePitch:0,
    target:null,nextMove:this.clock+2+i*1.8,hideUntil:0,retreat:false});
  }
  if(!stalkers.size)return;
  const lead=stalkers.values().next().value;
  this.previous=null;
  this.active={point:{x:lead.x,y:lead.y,z:lead.z},yaw:lead.yaw,size:this.count,
   members:new Map(),stalkers,age:0,at:null,peekSide:0,mode:'watch',phase:0,
   alert:0,intent:false,dir:null,vy:0,fallY:null,charge:0,nextThreat:0,blocked:false,lookTime:0};
 }
 // Simple authored-risk rule: an exposed edge a short distance away. No drop-height scoring.
 edge(player,dx,dz){
  return this.supported(shifted(player,dx*.35,dz*.35))&&
   [.8,1.3,1.9,2.6].some(d=>{
    const p=shifted(player,dx*d,dz*d);
    return this.loaded(p)&&!this.supported(p)&&!this.blocked(p,player.width,player.height);
   });
 }
 threatDirection(player,from){
  const incoming=toward(from,player);
  for(const a of [0,.55,-.55,1.05,-1.05]){
   const x=incoming.x*Math.cos(a)+incoming.z*Math.sin(a),z=incoming.z*Math.cos(a)-incoming.x*Math.sin(a);
   const norm=Math.hypot(x,z)||1;
   if(this.edge(player,x/norm,z/norm))return {x:x/norm,z:z/norm};
  }
  return null;
 }
 damage(index,region){
  const group=this.active;
  if(!group)return;
  const member=group.members.get(index)??{hp:3,hitAt:-Infinity};
  if(member.dead)return;
  member.phase??=group.phase;
  member.hp=region==='head'&&this.random()<.5?0:member.hp-1;
  member.region=region;member.hitAt=this.clock;
  if(member.hp<=0)this.kill(index,member);
  group.members.set(index,member);
  // Getting hit makes them wary and more likely to herd, but still needs an edge.
  group.alert=Math.min(8,group.alert+3);
 }
 kill(index,member=this.active.members.get(index)??{}){
  if(member.dead)return;
  const g=this.active;
  member.hp=0;member.dead=true;member.hitAt=this.clock;
  const track=g.stalkers?.get(index);
  member.yaw=track?.yaw??g.yaw;
  member.at=track?{x:track.x,y:track.y,z:track.z}:this.layout(g.point,g.yaw,g.size)[index];
  g.members.set(index,member);this.count--;
 }
 canMove(from,to,yaw=this.active.yaw,previousYaw=yaw){
  const speed=distance(from,to);
  const turn=Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw));
  const steps=Math.max(1,Math.ceil((speed+Math.abs(turn)*1.8)/.25));
  for(let i=1;i<=steps;i++){
   const t=i/steps;
   if(!this.formation({x:mix(from.x,to.x,t),y:mix(from.y,to.y,t),z:mix(from.z,to.z,t)},previousYaw+turn*t))return false;
  }
  return true;
 }
 stepGroup(player,dt){
  const g=this.active, p=g.point, eye=shifted(player,0,0,player.eye);
  g.age+=dt;
  const d=distance(p,player), visible=this.clear(shifted(p,0,0,EYE),eye);
  let faceYaw=Math.atan2(player.x-p.x,player.z-p.z);
  g.blocked=!visible;
  g.lookTime=visible?0:g.lookTime+dt;
  g.peekSide=0;
  if(!visible){
   for(const side of [-1,1]){
    const head=shifted(p,0,0,EYE);
    const shift=side*.70, probe=shifted(head,Math.cos(g.yaw)*shift,-Math.sin(g.yaw)*shift,-.13);
    if(this.clear(probe,eye)&&this.clear(head,probe)){g.peekSide=side;break}
   }
  }
  g.alert=Math.max(0,g.alert-dt*.13);
  g.nextThreat=Math.max(0,g.nextThreat-dt);
  if(g.nextThreat===0){
   g.nextThreat=2.8;
   g.dir=!player.creative&&!player.fly&&visible&&d<30&&g.age>10 ? this.threatDirection(player,p) : null;
   if(!g.dir)g.intent=false;
   else if(!g.intent)g.intent=this.random()<.13+.062*g.alert;
  }
  let target=g.at, speed=1.05;
  if(target&&distance(p,target)<.35){g.at=null;target=null;}
  if(!visible&&!target&&g.mode!=='charge')g.mode='watch';
  if(g.mode==='charge'){
   g.charge+=dt;
   if(!visible||!g.dir||g.charge>=1.28){
    g.mode='watch';g.charge=0;g.intent=false;g.nextThreat=5;target=null;
   }else{
    target=shifted(p,g.dir.x*1.4,g.dir.z*1.4);
    faceYaw=Math.atan2(g.dir.x,g.dir.z);
    speed=g.charge<.19?0:6.2;
    const lateral=Math.abs((player.x-p.x)*g.dir.z-(player.z-p.z)*g.dir.x);
    if(g.charge>=.36&&g.charge<=1.15&&lateral<Math.max(.67,g.size*.48)&&d<2.3&&
       Math.abs(player.y-p.y)<.85&&(player.x-p.x)*g.dir.x+(player.z-p.z)*g.dir.z>-.18&&
       this.edge(player,g.dir.x,g.dir.z)&&this.clear(shifted(p,0,0,1.3),shifted(player,0,0,1))){
     player.push?.(g.dir.x*8,g.dir.z*8);
     g.mode='watch';g.intent=false;g.nextThreat=7;target=null;
    }
   }
  }else if(g.intent&&g.dir&&visible&&Math.abs(player.y-p.y)<1.2){
   const flank=shifted(player,-g.dir.x*2.7,-g.dir.z*2.7);
   const behind=(player.x-p.x)*g.dir.x+(player.z-p.z)*g.dir.z;
   const cross=(player.x-p.x)*g.dir.z-(player.z-p.z)*g.dir.x;
   if(behind>0&&d<3.0&&Math.abs(cross)<1.15&&this.edge(player,g.dir.x,g.dir.z)){
    g.mode='charge';g.charge=0;target=null;
   }else if(d>1.4){target=flank;speed=1.45;}
  }
  const standing=this.supported(p);
  if(!standing){
   if(g.fallY===null)g.fallY=p.y;
   g.vy-=GRAVITY*dt;
   const drop=-g.vy*dt, steps=Math.max(1,Math.ceil(drop/.12));
   for(let i=0;i<steps;i++){
    const next=shifted(p,0,0,-drop/steps);
    if(this.blocked(next,.32,.22))break;
    p.y=next.y;
   }
   if(p.y<0 || (this.supported(p)&&g.fallY-p.y>5.5)){
    for(let i=0;i<g.size;i++)this.kill(i);
   }
   g.mode='fall';
   return;
  }
  if(g.fallY!==null){g.fallY=null;g.vy=0;}
  let step=null;
  if(target&&speed>0){
   const l=distance(target,p)||1;
   const length=Math.min(l,dt*speed);
   const next=shifted(p,(target.x-p.x)/l*length,(target.z-p.z)/l*length);
   const yaw=g.yaw+clamp(Math.atan2(Math.sin(faceYaw-g.yaw),Math.cos(faceYaw-g.yaw)),-.55,.55);
   if((g.mode==='charge'||this.supported(next))&&this.canMove(p,next,yaw,g.yaw)){
    step=next;g.yaw=yaw;
   }else{
    g.blocked=true;g.at=null;
    g.intent=false;g.charge=0;g.nextThreat=5;g.mode='watch';
   }
  }
  if(step){
   const phase=distance(step,p)*2.8;
   g.point=step;g.phase+=phase;
   for(const member of g.members.values())if(!member.dead)member.phase=(member.phase??0)+phase*(member.hp===1?.48:.72);
   if(g.mode!=='charge')g.mode='walk';
  }else if(g.mode!=='charge')g.mode='watch';
  if(visible&&!step&&g.mode==='watch'){
   const yaw=g.yaw+clamp(Math.atan2(Math.sin(faceYaw-g.yaw),Math.cos(faceYaw-g.yaw)),-.28,.28);
   if(this.canMove(p,p,yaw,g.yaw))g.yaw=yaw;
  }
 }
 // Individual stalking replaces synchronized group translation in normal gameplay.
 stepStalkers(player,dt){
  const g=this.active,eye=shifted(player,0,0,player.eye),look=player.direction();
  const lights=this.lightCandidates(player);
  g.age+=dt;
  for(const s of g.stalkers.values()){
   if(g.members.get(s.id)?.dead)continue;
   const d=distance(s,player);
   const direction=toward(eye,shifted(s,0,0,EYE));
   const dot=direction.x*look.x+direction.y*look.y+direction.z*look.z;
   const visible=dot>.20&&this.clear(eye,shifted(s,0,0,EYE));
   const centered=visible&&dot>.80;
   s.focus=clamp(s.focus+(centered?dt:-dt*.55),0,FOCUS_LIMIT);
   s.walking=false;
   if(s.hidden){
    if(this.clock>=s.hideUntil){
     const occupied=[...g.stalkers.values()].filter(o=>o!==s&&!g.members.get(o.id)?.dead);
     const p=this.spot(player,occupied,lights,Math.min(36,Math.max(16,d+5)));
     if(p){
      Object.assign(s,{x:p.x,y:p.y,z:p.z,shade:p.shade,hidden:false,presence:1,
       focus:0,target:null,retreat:false,nextMove:this.clock+1.6});
      s.yaw=Math.atan2(player.x-s.x,player.z-s.z)+(s.id%2?-.58:.58);
     }else s.hideUntil=this.clock+3;
    }
    continue;
   }
   // An observer stops presenting itself: it finds cover first, with a short
   // darkness fade only when the route to cover is obstructed.
   s.retreat=d<9||s.focus>2.0;
   if(s.retreat&&!visible&&s.focus>.5){
    s.hidden=true;s.hideUntil=this.clock+3.8;s.target=null;continue;
   }
   s.presence=clamp((FOCUS_LIMIT-s.focus)/.75,0,1);
   if(s.focus>=FOCUS_LIMIT||(d>39&&!visible)){
    s.hidden=true;s.hideUntil=this.clock+4.5;s.target=null;continue;
   }
   if(this.clock>=s.nextMove||!s.target){
    s.nextMove=this.clock+(s.retreat?1.0:3.5+hash(s.id,4,Math.floor(this.clock/4),this.world.seed)*2);
    if(s.retreat){
     const awayX=(s.x-player.x)/(d||1),awayZ=(s.z-player.z)/(d||1);
     const side=s.id%2?1:-1;
     s.target=shifted(s,(awayX+awayZ*side*.7)*4,(awayZ-awayX*side*.7)*4);
    }else if(d>24||!visible){
     const occupied=[...g.stalkers.values()].filter(o=>o!==s&&!g.members.get(o.id)?.dead);
     s.target=this.spot(player,occupied,lights,32,s);
    }else s.target=null;
   }
   if(s.target&&(!centered||s.retreat)){
    const length=distance(s,s.target);
    if(length<.4){s.target=null;}else{
     const speed=s.retreat?1.5:.72;
     const step=Math.min(length,dt*speed);
     const dx=(s.target.x-s.x)/length,dz=(s.target.z-s.z)/length;
     const desiredYaw=Math.atan2(dx,dz);
     const turn=Math.atan2(Math.sin(desiredYaw-s.yaw),Math.cos(desiredYaw-s.yaw));
     // Move with actual feet, not an instant facing/teleport of the whole pack.
     s.yaw+=clamp(turn,-dt*1.8,dt*1.8);
     // A few cheap alternate footholds allow the observer to edge along walls.
     const side=s.id%2?1:-1;
     const next=[0,side*.55,-side*.55,side*1.1,-side*1.1].map(angle=>{
      const x=dx*Math.cos(angle)-dz*Math.sin(angle),z=dz*Math.cos(angle)+dx*Math.sin(angle);
      return shifted(s,x*step,z*step);
     }).find(p=>this.supported(p)&&!this.blocked(p));
     if(next){
      s.x=next.x;s.z=next.z;s.phase+=step*5.1;s.walking=true;
     }else{s.target=null;s.nextMove=this.clock+1.2;}
    }
   }
   // The torso faces travel; only the neck and lone eye quietly follow the player.
   const gazeYaw=Math.atan2(player.x-s.x,player.z-s.z);
   const relative=Math.atan2(Math.sin(gazeYaw-s.yaw),Math.cos(gazeYaw-s.yaw));
   const vertical=Math.atan2(eye.y-(s.y+EYE),Math.max(1,d));
   const ease=(value,target,rate)=>value+(target-value)*clamp(dt*rate,0,1);
   s.headYaw=ease(s.headYaw,clamp(relative,-.53,.53),2.3);
   s.headPitch=ease(s.headPitch,clamp(vertical,-.22,.20),1.5);
   s.eyeYaw=ease(s.eyeYaw,clamp(relative-s.headYaw+Math.sin(this.clock*1.65+s.id*2.8)*.025,-.32,.32),4.5);
   s.eyePitch=ease(s.eyePitch,clamp(vertical-s.headPitch,-.16,.16),3.8);
   if(!s.walking&&Math.abs(relative)>1.35&&s.focus<.3)
    s.yaw+=clamp(relative,-dt*.18,dt*.18);
  }
  const living=[...g.stalkers.values()].filter(s=>!g.members.get(s.id)?.dead);
  if(living.length){
   g.point={x:living.reduce((v,s)=>v+s.x,0)/living.length,
    y:living.reduce((v,s)=>v+s.y,0)/living.length,
    z:living.reduce((v,s)=>v+s.z,0)/living.length};
  }
 }
 tick(dt,player,range){
  this.clock+=dt;
  if(this.clock<this.next)return;
  this.next=this.clock+TICK;
  const g=this.active;
  if(g&&this.count===0&&[...g.members.values()].every(m=>this.clock-m.hitAt>10)){
   this.active=null;this.views=[];return;
  }
  if(g&&(distance(g.point,player)>range||Math.abs(g.point.y-player.y)>range||!this.loaded(g.point))){
   this.sleep??=this.clock;
   this.views=[];this.previous=null;
   if(this.clock-this.sleep>=FORGET){this.active=null;this.sleep=null;this.next=this.clock+4;return;}
   // When genuinely out of range, relocate only while invisible; keep wounded identities.
   if(g.stalkers&&this.clock-this.sleep>6&&this.clock>=(g.nextRelocate??0)&&!player.fly){
    g.nextRelocate=this.clock+3;
    const lights=this.lightCandidates(player),taken=[],moves=[];
    for(const s of g.stalkers.values()){
     if(g.members.get(s.id)?.dead)continue;
     const p=this.spot(player,taken,lights,Math.min(range*.83,36));
     if(p){taken.push(p);moves.push([s,p]);}
    }
    if(moves.length){
     for(const [s,p] of moves){
      Object.assign(s,{x:p.x,y:p.y,z:p.z,shade:p.shade,hidden:false,focus:0,
       presence:1,retreat:false,target:null,nextMove:this.clock+1.5});
      s.yaw=Math.atan2(player.x-s.x,player.z-s.z)+(s.id%2?-.58:.58);
     }
     for(const s of g.stalkers.values())if(!moves.some(([o])=>o===s))s.hidden=true;
     g.point={x:moves[0][1].x,y:moves[0][1].y,z:moves[0][1].z};
     this.sleep=null;this.next=this.clock+TICK;
    }
   }
   return;
  }
  this.sleep=null;
  if(!g){
   if(this.count>0&&!player.fly){
    this.spawn(player,range);
    if(!this.active)this.next=this.clock+2.5;
   }
  }else if(this.count>0){
   this.previous=this.views;this.sampleTime=this.clock;this.stepStalkers(player,TICK);
  }
  this.publish();
 }
 publish(){
  const g=this.active;
  if(!g)return;
  const tracks=g.stalkers?[...g.stalkers.entries()]:
   this.layout(g.point,g.yaw,g.size).map((p,i)=>[i,{...p,yaw:g.yaw}]);
  this.views=tracks.map(([i,s])=>{
   const member=g.members.get(i);
   const old=this.previous?.find(view=>view.id===i);
   const previous=old&&{x:old.x,y:old.y,z:old.z,yaw:old.yaw};
   return {...(member?.dead?member.at:s),id:i,yaw:member?.yaw??s.yaw,
    group:g,member,track:s,previous};
  }).filter(view=>(!view.track.hidden&&!view.member?.dead)||
    (view.member?.dead&&this.clock-view.member.hitAt<10));
 }
 pick(origin,ray,limit,padding=0){
  let result=null;
  for(const view of this.views){
   if(view.member?.dead||view.track?.presence<.2||distance(view,origin)>limit+2)continue;
   const {from,to,blend}=observerPose(view,this.clock);
   const a=observerHeads[from],b=observerHeads[to];
   const x=mix(a[0],b[0],blend),z=mix(a[2],b[2],blend),y=mix(a[1],b[1],blend);
   const c=Math.cos(view.yaw),s=Math.sin(view.yaw);
   const neck=view.track?.headYaw??0,cn=Math.cos(neck),sn=Math.sin(neck);
   const xx=(x*cn+(z-.14)*sn),zz=(-x*sn+(z-.14)*cn)+.14;
   const head=[view.x+xx*c+zz*s,view.y+y+(view.track?.headPitch??0)*.09,view.z-xx*s+zz*c];
   for(const [region,center,width,height] of [['head',head,.205,.205],['body',[view.x,view.y+.92,view.z],.22,.26],['leg',[view.x,view.y+.40,view.z],.31,.36]]){
    const w=width+padding*.45;
    const hit=intersectAabb(origin,ray,[center[0]-w,center[1]-height,center[2]-w],[center[0]+w,center[1]+height,center[2]+w]);
    if(hit&&hit.distance<limit){
     limit=hit.distance;
     result={distance:limit,region,entity:{type:'observer',name:OBSERVER_NAME,x:view.x,y:view.y,z:view.z,height:HEIGHT,hurt:()=>this.damage(view.id,region)}};
    }
   }
  }
  return result;
 }
}

export function observerPose(view,time){
 const {group:g,member,id}=view;
 if(member?.dead){
  const t=(time-member.hitAt)*1.4;
  return t<1?{from:'idle',to:'fall0',blend:t}:t<1.7?{from:'fall0',to:'fall1',blend:(t-1)/.7}:
   {from:'fall1',to:'fall2',blend:clamp((t-1.7)/.7,0,1)};
 }
 if(member&&time-member.hitAt<.40){
  const t=(time-member.hitAt)/.40;
  return {from:'idle',to:member.region,blend:Math.sin(Math.PI*t)**.72};
 }
 if(view.track){
  if(view.track.walking){
   const f=((view.track.phase%6)+6)%6,i=Math.floor(f);
   return {from:'walk'+i,to:'walk'+((i+1)%6),blend:f-i};
  }
  const slow=Math.sin(time*.58+id*.84);
  return {from:'idle',to:slow>0?'peek1':'peek0',blend:.045+Math.abs(slow)*.065};
 }
 if(g.mode==='charge'){
  const f=clamp(g.charge/1.28*5,0,4.99), i=Math.floor(f);
  return {from:i===0?'idle':'charge'+(i-1),to:'charge'+i,blend:f-i};
 }
 if(g.mode==='walk'){
  const f=((((member?.phase??g.phase)+id*.78)%6)+6)%6,i=Math.floor(f);
  return {from:'walk'+i,to:'walk'+((i+1)%6),blend:f-i};
 }
 if(g.mode==='fall')return {from:'fall0',to:'fall1',blend:.24};
 const wave=g.blocked?Math.sin(g.lookTime*2.7+id*.62):Math.sin(time*.61+id*.47);
 const amount=g.peekSide?.93:g.blocked?Math.abs(wave)*.24:Math.abs(wave)**5*.27;
 return {from:'idle',to:'peek'+((g.peekSide||wave)>0?1:0),blend:amount};
}
