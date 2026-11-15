import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Player,EntityManager} from '../src/entities/entities.js';
import {CANYON_MODE,canyonBay,canyonShelter} from '../src/worldgen/canyon-v2-plan.js';
import {BLOCK as B} from '../src/core/blocks.js';

const SEED=9999, DT=.18, HEIGHT=360, VIEWPORT={aspect:780/360,tan:Math.tan(65*Math.PI/360)};
function standing(world,x,z,yHint){
  world.stream(x,z,2,25);
  const floor=Math.round(yHint);
  for(const dy of [0,1,-1,2,-2,3,-3,4,-4,5,-5,8,-8]){
   const y=floor+dy;
   const foot=world.get(x,y-1,z,false),a=world.get(x,y,z,false),b=world.get(x,y+1,z,false);
   if(foot!==B.AIR&&a===B.AIR&&b===B.AIR)return {x,y,z};
  }
  return null;
}
function setup(scene){
 const world=new World({mode:CANYON_MODE,seed:SEED});
 const sp=world.firstSpawn();
 let pos={x:sp.x,y:sp.y,z:sp.z,yaw:sp.yaw};
 if(scene.startsWith('terrace')){
  const terraces=canyonBay(SEED,3,0).terraces;
  const t=terraces.find(x=>x.side===1)||terraces.at(0);
  let chosen=null;
  for(const x0 of [t.inner+15,t.inner+28,t.inner+45,t.inner+57]){
   const x=x0*t.side,z=(t.z0+t.z1)/2;
   chosen=standing(world,x,z,t.y-world.yOrigin);
   if(chosen)break;
  }
  assert(chosen,'could not find an outdoor walkable deck');
  pos={...chosen,yaw:-Math.PI/2};
 }
 const player=new Player(pos.x,pos.y,pos.z);
 player.yaw=pos.yaw||0;player.pitch=0;
 world.stream(player.x,player.z,3,45);
 const manager=new EntityManager(world);
 return {world,player,pack:manager.observers,start:pos};
}
function audit(scene,seconds=200){
 const {player,pack,start}=setup(scene);
 let scheduled=0;
 const begin=pack.beginGlimpse.bind(pack);
 pack.beginGlimpse=(...args)=>{scheduled++;return begin(...args)};
 let seen=0,readable=0,face=0,unique=new Set(),first=null,maxRun=0,run=0,
     maxPixels=0,maxDepth=0,minDepth=1e9,closeCount=0,visibleFrames=0,frontal=0;
 const tally=new Map(),frames=Math.round(seconds/DT);
 for(let f=0;f<frames;f++){
  if(scene.endsWith('scan'))player.yaw+=DT*(Math.PI*2/42);
  pack.tick(DT,player,48,VIEWPORT);
  let screen=false,vis=false,big=false,inFace=false;
  for(const view of pack.views){
   const proj=pack.screenPoint(player,view);
   if(!proj)continue;
   const on=pack.onScreen(player,view);
   if(!on)continue;
   screen=true;unique.add(view.id);
   const px=2.36*HEIGHT/(2*VIEWPORT.tan*proj.depth);
   const ok=px>=24;
   const faceNow=pack.faceVisible(player,view);
   if(px>maxPixels){maxPixels=px;maxDepth=proj.depth}
   minDepth=Math.min(minDepth,proj.depth);
   let stats=tally.get(view.id)||{frames:0,readableFrames:0,faceFrames:0};
   stats.frames++;if(ok){stats.readableFrames++;big=true}if(faceNow){stats.faceFrames++;inFace=true}
   tally.set(view.id,stats);
   vis=true;
  }
  if(vis){seen++;if(first===null)first=+(f*DT).toFixed(2);run++;maxRun=Math.max(maxRun,run)}else run=0;
  if(big)readable++;
  if(inFace)face++;
  if(pack.active)closeCount++;
  if(pack.views.length)visibleFrames++;
 }
 const report={scene,seed:SEED,seconds,spawn:start,scheduled,activeFrames:closeCount,renderListFrames:visibleFrames,
   onScreenSeconds:+(seen*DT).toFixed(2),readable24pxSeconds:+(readable*DT).toFixed(2),
   faceSeconds:+(face*DT).toFixed(2),longestContinuousOnScreenSeconds:+(maxRun*DT).toFixed(2),
   firstOnScreenSecond:first,maxProjectedHeightPx:+maxPixels.toFixed(1),minDepth: Number.isFinite(minDepth)?+minDepth.toFixed(1):null,
   uniqueIds:[...unique],actors:[...tally]};
 console.log('OBSERVER_PERCEPTION '+JSON.stringify(report));
 return report;
}
test('V2 realistic spawn reports visible human-scale observer seconds', {timeout:120000},()=>{
 for(const scene of ['shelter-still','shelter-scan','terrace-still','terrace-scan']){
  audit(scene,180);
 }
});
