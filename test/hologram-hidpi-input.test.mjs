import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('hologram-only FBO is allocated at world resolution, reused and released',()=>{
 const calls=[];let id=0;
 const gl={
  FRAMEBUFFER:1,TEXTURE_2D:2,RENDERBUFFER:3,COLOR_ATTACHMENT0:4,DEPTH_ATTACHMENT:5,
  RGBA8:6,RGBA:7,UNSIGNED_BYTE:8,DEPTH_COMPONENT16:9,
  TEXTURE_MIN_FILTER:10,TEXTURE_MAG_FILTER:11,TEXTURE_WRAP_S:12,TEXTURE_WRAP_T:13,
  NEAREST:14,CLAMP_TO_EDGE:15,FRAMEBUFFER_COMPLETE:16,
  createFramebuffer(){return ++id},createTexture(){return ++id},createRenderbuffer(){return ++id},
  bindFramebuffer(...a){calls.push(['bindFramebuffer',...a])},bindTexture(){},bindRenderbuffer(){},
  texParameteri(){},texImage2D(_,__,___,w,h){calls.push(['texImage2D',w,h])},
  framebufferTexture2D(){},renderbufferStorage(_,__,w,h){calls.push(['depth',w,h])},
  framebufferRenderbuffer(){},checkFramebufferStatus(){return this.FRAMEBUFFER_COMPLETE},
  deleteFramebuffer(){calls.push(['deleteFramebuffer'])},deleteTexture(){},deleteRenderbuffer(){}
 };
 const r=Object.create(renderer.Renderer.prototype);r.gl=gl;r.hologramScene=null;
 assert.equal(r.prepareHologramScene(750,450),true);
 assert.deepEqual(calls.find(x=>x[0]==='texImage2D'),['texImage2D',750,450]);
 assert.deepEqual(calls.find(x=>x[0]==='depth'),['depth',750,450]);
 const first=r.hologramScene.fbo;
 assert.equal(r.prepareHologramScene(750,450),true);
 assert.equal(r.hologramScene.fbo,first,'same render target should be reused per frame');
 r.releaseHologramScene();
 assert.equal(r.hologramScene,null);
 assert(calls.some(x=>x[0]==='deleteFramebuffer'),'GPU target must be released on close');
});
test('mouse dragging is limited to outside hologram and suppressed after UI dismissal',()=>{
 const h=inputHarness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  input.hologramOwnsPointer=e=>e.clientX>300&&e.clientX<700;
  h.canvas.emit('mousedown',{button:0,clientX:500,clientY:350,preventDefault(){}});
  h.doc.emit('mousemove',{clientX:580,clientY:370});
  assert.deepEqual(input.consumeLook(),[0,0],'inside hologram must not rotate camera');
  h.doc.emit('mouseup',{button:0});
  h.canvas.emit('mousedown',{button:0,clientX:850,clientY:350,preventDefault(){}});
  h.doc.emit('mousemove',{clientX:900,clientY:365});
  assert(input.consumeLook()[0]>0,'outside hologram mouse drag must rotate camera');
  h.doc.emit('mouseup',{button:0});
  assert.equal(input.mouseLook,false);
  input.ignoreMouseUntilUp=true;
  input.setInventoryMode(false);
  h.canvas.emit('mousedown',{button:0,clientX:500,clientY:350,preventDefault(){}});
  h.doc.emit('mouseup',{button:0});
  assert.equal(input.read().use,false,'closing inventory must never place a block');
 }finally{h.restore()}
});

test('mouse starts and finishes the same item drag interaction as touch',()=>{
 const game=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 assert.match(game,/this\\.input\\.hologramPointerDown\\(event\\)/);
 assert.match(game,/this\\.input\\.hologramPointerMove\\(event\\)/);
 assert.match(game,/this\\.input\\.hologramPointerUp\\(event,false\\)/);
});
