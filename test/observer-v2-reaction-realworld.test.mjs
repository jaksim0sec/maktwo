import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {Player} from '../src/entities/entities.js';
import {ObserverPack} from '../src/entities/observers.js';
import {CANYON_MODE} from '../src/worldgen/canyon-v2-plan.js';

test('a directly seen V2 observer visibly acknowledges a hit and escapes if the path is walkable',
 {timeout:120000},()=>{
 const world=new World({mode:CANYON_MODE,seed:9999});
 world.firstSpawn();
 const player=new Player(124,410,49);
 player.yaw=-Math.PI/2;player.pitch=0;
 world.stream(player.x,player.z,3,60);
 const pack=new ObserverPack(world);
 const viewport={aspect:780/360,tan:Math.tan(65*Math.PI/360)};
 let chosen=null;
 for(let f=0;f<1500&&!chosen;f++){
  player.yaw+=.18*Math.PI*2/42;
  pack.tick(.18,player,48,viewport);
  for(const v of pack.views){
   const point=pack.screenPoint(player,v);
   if(point?.depth>3&&point.depth<14&&pack.faceVisible(player,v)&&!v.member?.dead){
    chosen=pack.active.stalkers.get(v.id);break;
   }
  }
 }
 assert(chosen,'could not find an actual observer in the V2 terrace');
 const start={x:chosen.x,y:chosen.y,z:chosen.z,yaw:chosen.yaw},wasScene=chosen.sighting?.phase;
 pack.damage(chosen.id,'body',player);
 assert(chosen.fearUntil>pack.clock);
 let moving=0,escaping=0,maxTravel=0,physicalTravel=0,visibleTeleports=0;
 let previous={x:chosen.x,z:chosen.z};
 for(let step=0;step<55;step++){
  pack.tick(.18,player,48,viewport);
  const stepTravel=Math.hypot(chosen.x-previous.x,chosen.z-previous.z);
  if(chosen.walking&&!chosen.hidden){
   if(stepTravel>3.5*.18+.15)visibleTeleports++;
   else physicalTravel+=stepTravel;
  }
  previous={x:chosen.x,z:chosen.z};
  const travel=Math.hypot(chosen.x-start.x,chosen.z-start.z);
  maxTravel=Math.max(maxTravel,travel);
  moving+=Number(Boolean(chosen.walking));
  escaping+=Number(Boolean(chosen.fleeing));
 }
 const diag={from:start,wasScene,end:{x:chosen.x,y:chosen.y,z:chosen.z},
  maxTravel:+maxTravel.toFixed(2),physicalTravel:+physicalTravel.toFixed(2),visibleTeleports,movingFrames:moving,escapingFrames:escaping,
  scene:chosen.sighting?.phase??null,fearActive:chosen.fearUntil>pack.clock,
  visible:pack.onScreen(player,chosen),hasEscapeTarget:Boolean(chosen.target)};
 console.log('V2_OBSERVER_HIT_REACTION '+JSON.stringify(diag));
 assert(moving>2,'must move rather than only set an alert flag');
 assert(escaping>2,'must use the fleeing animation while reacting to the impact');
 assert(maxTravel>.45,'must actually move away from the impact, not idle');
 assert(physicalTravel>1,'must physically run at least a meter, not just relocate while invisible');
 assert.equal(visibleTeleports,0,'cannot visibly teleport across V2 corridors');
});
