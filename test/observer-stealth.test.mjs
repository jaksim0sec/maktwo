import test from 'node:test';
import assert from 'node:assert/strict';
import {ObserverPack,OBSERVER_NAME,observerPose} from '../src/entities/observers.js';
import {BLOCK as B} from '../src/core/blocks.js';

const world={
 seed:123,height:120,trainColliders:[],lightRevision:0,
 getChunk(cx,cz,create){assert.equal(create,false);return {};},
 get(x,y,z,create){
  assert.equal(create,false);
  return y<10||y===20?B.STONE:B.AIR;
 }
};
const player={x:0,y:10,z:0,eye:1.39,width:.6,height:1.53,
 direction(){return{x:0,y:0,z:-1}}};
function make(){
 const pack=new ObserverPack(world,{count:3});
 pack.clock=5;pack.spawn(player,48);pack.publish();
 assert.ok(pack.active,'an observer must find a concealed position');
 return pack;
}
test('shy observers spread out rather than spawning as a bright cluster',()=>{
 const pack=make();
 assert.equal(OBSERVER_NAME,'소심한 관찰자');
 assert.equal(pack.views.length,3);
 for(let i=0;i<pack.views.length;i++)for(let j=i+1;j<pack.views.length;j++){
  assert.ok(Math.hypot(pack.views[i].x-pack.views[j].x,pack.views[i].z-pack.views[j].z)>=7.49);
 }
 const eye={x:player.x,y:player.y+player.eye,z:player.z};
 assert.ok(pack.views.every(p=>pack.invisible(eye,player.direction(),p)));
});
test('center-screen focus makes a visible observer retreat without fading away',()=>{
 const pack=make();
 const s=pack.active.stalkers.values().next().value;
 const watched={...player,direction(){
  const x=s.x-this.x,z=s.z-this.z,m=Math.hypot(x,z);
  return{x:x/m,y:0,z:z/m};
 }};
 for(let i=0;i<30;i++)pack.tick(.18,watched,48);
 assert.equal(s.hidden,false,'must not disappear while looking at it');
 assert.equal(s.presence,1,'focus must not fade it to transparency');
 assert.ok(s.retreat,'focus must make it flee');
});
test('neck follows independently while the body does not snap toward the viewer',()=>{
 const pack=make();
 const s=pack.active.stalkers.values().next().value,initialYaw=s.yaw;
 const watched={...player,direction(){
  const x=s.x-this.x,z=s.z-this.z,m=Math.hypot(x,z);
  return{x:x/m,y:0,z:z/m};
 }};
 for(let i=0;i<4;i++)pack.tick(.18,watched,48);
 assert.ok(Math.abs(s.headYaw)>.03,'head should aim without fully rotating the torso');
 assert.ok(Math.abs(s.yaw-initialYaw)<.35,'torso should not snap at the viewer');
});
test('roof shadows outrank lamp-lit positions',()=>{
 const pack=make(),p={x:5,y:10,z:5};
 assert.equal(pack.shadowScore(p,[]),2);
 assert.ok(pack.shadowScore(p,[{x:5,y:12,z:5,radius:8}])<pack.shadowScore(p,[]));
});

test('lighting candidates use array focus and are cached between short AI ticks',()=>{
 let queries=0;
 const lit={...world,lightRevision:19,lights:{inBounds(x0,x1,z0,z1,{focus}){
  assert.deepEqual(focus,[0,10,0]);
  queries++;return [];
 }}};
 const pack=new ObserverPack(lit,{count:1});
 pack.clock=5;pack.lightCandidates(player);
 pack.clock+=.18;pack.lightCandidates(player);
 assert.equal(queries,1);
});


test('a shy observer reaches recognisable face range then withdraws within five seconds',()=>{
 const pack=make(),viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 let started=false,seen=false,retreating=false,firstTrack=null,seenAt=null;
 for(let i=0;i<230;i++){
  pack.tick(.18,player,48,viewport);
  const active=[...pack.active.stalkers.values()].find(s=>s.sighting);
  if(active&&!started){
   started=true;firstTrack=active;
   assert.ok(!pack.onScreen(player,active)||
    active.sighting.entry==='distant'&&Math.hypot(active.x-player.x,active.z-player.z)>20,
    'distant fog entry is allowed, but not popping in near the camera');
  }
  if(active===firstTrack&&pack.faceVisible(player,active)){
   seen=true;seenAt??=pack.clock;
  }
  if(seen&&firstTrack.sighting?.phase==='withdraw'&&firstTrack.walking){retreating=true;break;}
 }
 assert.ok(started,'at least one edge-of-view event should be scheduled');
 assert.ok(seen,'a walkable sighting should be visible without rotating the camera');
 assert.ok(retreating,'observer must physically flee after eye contact');
 assert.ok(pack.clock-seenAt<5.3,'fleeing must begin within five seconds');
});
test('portrait viewport selects a genuinely visible peripheral position',()=>{
 const pack=make(),viewport={aspect:9/16,tan:Math.tan(65*Math.PI/360)};
 let seen=false;
 for(let i=0;i<260;i++){
  pack.tick(.18,player,48,viewport);
  const active=[...pack.active.stalkers.values()].find(s=>s.sighting);
  if(active&&pack.onScreen(player,active)){seen=true;break;}
 }
 assert.ok(seen,'mobile portrait framing must still allow an encounter');
});

test('observer movement checks the entire route and the forward charge lean',()=>{
 const w={...world,get(x,y,z,create){
  assert.equal(create,false);
  return y<10||(Math.floor(x)===0&&Math.floor(z)===0&&y<14)?B.STONE:B.AIR;
 }};
 const pack=new ObserverPack(w,{count:1});
 const start={x:-2,y:10,z:.5},end={x:2,y:10,z:.5};
 assert.equal(pack.blocked(start),false);
 assert.equal(pack.blocked(end),false);
 assert.equal(pack.walkClear(start,end,Math.PI/2),false,'thin wall between valid endpoints must block walk');
 assert.equal(pack.walkClear(start,end,Math.PI/2,true),false,'running must not tunnel through the wall');
 assert.equal(pack.walkClear({x:-.6,y:10,z:.5},{x:-.55,y:10,z:.5},Math.PI/2,true),false,
  'forward-leaning charge mesh must not protrude through wall');
});
test('first sighting holds eye contact before the retreat begins',()=>{
 const pack=make(),viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 let observed=null;
 for(let i=0;i<260;i++){
  pack.tick(.18,player,48,viewport);
  const s=[...pack.active.stalkers.values()].find(s=>s.sighting?.firstSeen!=null);
  if(s){observed=s;break;}
 }
 assert.ok(observed,'there must be an actual sighting');
 assert.equal(observed.sighting.phase,'watch','first visibility must start a watch, not a retreat');
 const gaze=Math.atan2(player.x-observed.x,player.z-observed.z);
 assert.ok(Math.cos(gaze-observed.yaw)>.8,'the observer must look toward the player');
 const startTime=observed.sighting.firstSeen;
 for(let i=0;i<3;i++)pack.tick(.18,player,48,viewport);
 assert.equal(observed.sighting.phase,'watch','the observer must not run away instantly');
 assert.ok(pack.clock-startTime<1,'watch should be held before the flee');
});
test('retreat reuses the charge pose and the fast movement still respects walls',()=>{
 const pack=make(),viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 let running=null;
 for(let i=0;i<300;i++){
  pack.tick(.18,player,48,viewport);
  const s=[...pack.active.stalkers.values()].find(s=>s.sighting?.phase==='withdraw'&&s.walking);
  if(s){running=s;break;}
 }
 assert.ok(running,'one observer must visibly sprint during withdrawal');
 const pose=observerPose({track:running,id:running.id,group:pack.active},pack.clock);
 assert.ok(pose.from.startsWith('charge')&&pose.to.startsWith('charge'),
  'withdrawal should use the charge animation instead of walk');
});

test('narrow straight city corridor creates a true frontal encounter even when no side-spawn fits',()=>{
 const corridor={...world,get(x,y,z,create){
  assert.equal(create,false);
  return y<10||(Math.abs(Math.floor(x))>=4&&y<25)?B.STONE:B.AIR;
 }};
 for(const aspect of [16/9,9/16]){
  const pack=new ObserverPack(corridor,{count:3}),view={aspect,tan:Math.tan(65*Math.PI/360)};
  let faceTime=0,firstFace=null,seenId=null;
  for(let i=0;i<450;i++){
   pack.tick(.18,player,48,view);
   for(const s of pack.views)if(pack.faceVisible(player,s)){
    faceTime+=.18;firstFace??=pack.clock;seenId??=s.id;
   }
  }
  assert.ok(pack.active, 'cannot block all spawning on a corridor with clear ahead space');
  assert.ok(faceTime>1.0,'player must see a frontal observer rather than only a peripheral silhouette');
  assert.ok(firstFace!==null&&seenId!==null);
 }
});
test('peripheral visibility alone cannot trigger the gaze countdown',()=>{
 const pack=make();
 const away={x:14,y:10,z:-18};
 pack.viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 assert.equal(pack.onScreen(player,away),true);
 assert.equal(pack.faceVisible(player,away),false);
});

test('no visible despawn on sighting timeout or return to entrance',()=>{
 const pack=make(),s=pack.active.stalkers.values().next().value;
 pack.clock=12;pack.viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 Object.assign(s,{x:0,y:10,z:-13,hidden:false,focus:0,presence:1,yaw:Math.PI,
  target:{x:0,y:10,z:-13},sighting:{start:{x:0,y:10,z:-13},seen:{x:0,y:10,z:-10},
  phase:'withdraw',entry:'distant',firstSeen:7,until:10,deadline:20}});
 assert.equal(pack.faceVisible(player,s),true);
 pack.stepStalkers(player,.18);
 assert.equal(s.hidden,false,'no sudden visible disappearance after 4.7s');
 assert.ok(s.sighting&&s.target,'keep a walkable escape objective');
 assert.ok(Math.hypot(s.x,s.z)>13,'physically run away instead');
});
test('camera turning away is not physical cover',()=>{
 const pack=make(),s=pack.active.stalkers.values().next().value;
 pack.clock=12;pack.viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 Object.assign(s,{x:0,y:10,z:-13,hidden:false,focus:0,presence:1,yaw:Math.PI,
  target:{x:0,y:10,z:-22},sighting:{start:{x:0,y:10,z:-22},seen:{x:0,y:10,z:-13},
  phase:'withdraw',entry:'distant',firstSeen:11,until:10,deadline:20}});
 const away={...player,direction(){return{x:0,y:0,z:1}}};
 assert.equal(pack.onScreen(away,s),false);
 assert.equal(pack.clear({x:0,y:11.39,z:0},{x:0,y:12.06,z:-13}),true);
 pack.stepStalkers(away,.18);
 assert.equal(s.hidden,false,'camera frustum alone is not an occluder');
});
test('solid wall across the sightline allows a concealed exit',()=>{
 const occluded={...world,get(x,y,z,create){
  assert.equal(create,false);
  return y<10||y===20||(z>=-7&&z<=-6&&y>=10&&y<15)?B.STONE:B.AIR;
 }};
 const pack=new ObserverPack(occluded,{count:1});
 const s={x:0,y:10,z:-13,id:0,phase:0,yaw:Math.PI,walking:false,hidden:false,
  presence:1,focus:0,headYaw:0,headPitch:0,eyeYaw:0,eyePitch:0,target:{x:0,y:10,z:-19},
  retreat:true,sighting:{start:{x:0,y:10,z:-19},seen:{x:0,y:10,z:-13},
  phase:'withdraw',entry:'distant',firstSeen:7,until:9,deadline:20}};
 pack.active={point:{x:s.x,y:s.y,z:s.z},age:0,members:new Map(),stalkers:new Map([[0,s]])};
 pack.clock=12;pack.viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 assert.equal(pack.clear({x:0,y:11.39,z:0},{x:0,y:12.06,z:-13}),false);
 pack.stepStalkers(player,.18);
 assert.equal(s.hidden,true,'only after real occlusion can it leave simulation');
});

test('off-range fleeing observer retires only after leaving draw range',()=>{
 const pack=make(),s=pack.active.stalkers.values().next().value;
 pack.clock=12;pack.renderRange=48;
 Object.assign(s,{x:0,y:10,z:-56,focus:0,hidden:false,presence:1,yaw:Math.PI,
  sighting:{start:{x:0,y:10,z:-60},seen:{x:0,y:10,z:-12},
  phase:'withdraw',entry:'distant',firstSeen:7,until:10,deadline:20},
  target:{x:0,y:10,z:-60}});
 pack.stepStalkers(player,.18);
 assert.equal(s.hidden,true,'render-range retirement must stop endless sprint simulation');
 assert.equal(s.sighting,null,'retired runner must not block future encounters');
});
test('a distant stalker cannot remain in the draw list just because its packmate is nearby',()=>{
 const pack=make(),s=pack.active.stalkers.values().next().value;
 s.x=0;s.y=10;s.z=-250;
 pack.publish(player,48);
 assert.ok(!pack.views.some(view=>view.id===s.id),'far beyond camera range must be culled');
 assert.ok(pack.views.length>0,'a nearby packmate must remain visible');
});
