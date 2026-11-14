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
test('center-screen observation ends before five seconds with a discreet retreat',()=>{
 const pack=make();
 const s=pack.active.stalkers.values().next().value;
 const watched={...player,direction(){
  const x=s.x-this.x,z=s.z-this.z,m=Math.hypot(x,z);
  return{x:x/m,y:0,z:z/m};
 }};
 for(let i=0;i<30;i++)pack.tick(.18,watched,48);
 assert.ok(s.hidden||s.presence<.2,'a sustained stare must stop the sighting');
 assert.ok(pack.views.every(v=>v.id!==s.id||v.track.presence<.2));
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


test('a shy observer walks from off-screen into view and withdraws within five seconds',()=>{
 const pack=make(),viewport={aspect:16/9,tan:Math.tan(65*Math.PI/360)};
 let started=false,seen=false,finished=false,firstTrack=null,seenAt=null;
 for(let i=0;i<230;i++){
  pack.tick(.18,player,48,viewport);
  const active=[...pack.active.stalkers.values()].find(s=>s.sighting);
  if(active&&!started){
   started=true;firstTrack=active;
   assert.equal(pack.onScreen(player,active),false,'entry must not pop into view');
  }
  if(active===firstTrack&&pack.onScreen(player,active)){
   seen=true;seenAt??=pack.clock;
  }
  if(seen&&!firstTrack.sighting){finished=true;break;}
 }
 assert.ok(started,'at least one edge-of-view event should be scheduled');
 assert.ok(seen,'a walkable sighting should be visible without rotating the camera');
 assert.ok(finished,'the observer must leave view without staying indefinitely');
 assert.ok(pack.clock-seenAt<5.3,'the sighting must end within five seconds of being noticed');
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
