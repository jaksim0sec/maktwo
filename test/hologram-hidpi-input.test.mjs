import test from 'node:test';
import assert from 'node:assert/strict';
import * as renderer from '../src/client/renderer.js';
import {Hologram,cardGeometry,createAnchor} from '../src/client/hologram.js';
import {Input} from '../src/client/input.js';

function emitter(){
 const handlers=new Map();
 return {addEventListener(type,listener){handlers.set(type,[...(handlers.get(type)||[]),listener])},
  emit(type,event={}){for(const callback of handlers.get(type)||[])callback(event)}};
}
function inputHarness(){
 const old={document:globalThis.document,window:globalThis.window},doc=emitter(),win=emitter(),canvas=emitter();
 canvas.getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:700,width:1000,height:700});
 canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
 globalThis.document=doc;globalThis.window=win;
 return {doc,win,canvas,restore(){globalThis.document=old.document;globalThis.window=old.window}};
}
const touch=(pointerId,x,y)=>({pointerType:'touch',pointerId,clientX:x,clientY:y,preventDefault(){}});
test('world stays at its old render scale while hologram uses device-native resolution',()=>{
 assert.equal(typeof renderer.hologramFrameSize,'function','need a resolution policy separate from renderScale');
 const low=renderer.hologramFrameSize(1000,600,.75,3,true);
 assert.deepEqual(low,{width:2000,height:1200,worldWidth:750,worldHeight:450,split:true});
 assert.deepEqual(renderer.hologramFrameSize(1000,600,.75,3,false),{
  width:750,height:450,worldWidth:750,worldHeight:450,split:false});
 assert.deepEqual(renderer.hologramFrameSize(360,800,1,1,true),{
  width:360,height:800,worldWidth:360,worldHeight:800,split:false});
});
test('spatial hologram owns blank space inside its footprint, not the surrounding world',()=>{
 const player={x:0,y:26,z:0,eye:1.7,yaw:0,pitch:0,direction(){return{x:0,y:0,z:-1}}};
 const h=Object.create(Hologram.prototype);
 h.opened=true;h.anchor=createAnchor(player);h.scale=.84;
 h.cards=cardGeometry('all',Array.from({length:9},(_,i)=>({id:10+i,name:'아이템 '+i,count:3})));
 const rect={left:0,top:0,width:1000,height:700};
 assert.equal(typeof h.containsAt,'function','need whole-panel ray hit, not only per-card hit');
 assert.equal(h.containsAt(player,500,350,rect),true,'space between UI cards is still UI');
 assert.equal(h.containsAt(player,20,350,rect),false,'outside the workspace is camera');
});
test('UI-origin touch never moves camera even when dragged outside',()=>{
 const h=inputHarness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  const events=[];
  input.hologramPointerDown=e=>e.clientX>=300&&e.clientX<=700;
  input.hologramPointerMove=e=>events.push(['move',e.pointerId]);
  input.hologramPointerUp=(e,cancel)=>events.push(['up',e.pointerId,cancel]);
  h.canvas.emit('pointerdown',touch(7,500,350));
  h.canvas.emit('pointermove',touch(7,970,370));
  assert.deepEqual(input.consumeLook(),[0,0]);
  h.canvas.emit('pointerup',touch(7,970,370));
  assert.deepEqual(events,[['move',7],['up',7,false]]);
 }finally{h.restore()}
});
test('outside touch owns camera on either side even when crossing the hologram',()=>{
 const h=inputHarness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  let touched=0;input.hologramPointerDown=e=>{touched++;return e.clientX>=300&&e.clientX<=700};
  h.canvas.emit('pointerdown',touch(8,900,400));
  h.canvas.emit('pointermove',touch(8,800,410));
  h.canvas.emit('pointermove',touch(8,600,420));
  assert(input.consumeLook()[0]<0,'right-side outside drag rotates');
  h.canvas.emit('pointerup',touch(8,600,420));
  h.canvas.emit('pointerdown',touch(9,100,400));
  h.canvas.emit('pointermove',touch(9,160,425));
  assert(input.consumeLook()[0]>0,'left-side outside drag rotates instead of walking');
  assert.deepEqual(input.read().moveX,0);
  h.canvas.emit('pointerup',touch(9,160,425));
  assert.equal(touched,2,'hit ownership decided once on touch-down');
 }finally{h.restore()}
});
test('two pointers may separately manipulate hologram and rotate camera',()=>{
 const h=inputHarness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  let selected=0;input.hologramPointerDown=e=>e.clientX>300&&e.clientX<700;
  input.hologramPointerUp=()=>selected++;
  h.canvas.emit('pointerdown',touch(10,500,350));
  h.canvas.emit('pointerdown',touch(11,850,450));
  h.canvas.emit('pointermove',touch(11,910,440));
  assert(input.consumeLook()[0]>0);
  h.canvas.emit('pointerup',touch(10,500,350));
  assert.equal(selected,1);
  h.canvas.emit('pointerup',touch(11,910,440));
 }finally{h.restore()}
});
