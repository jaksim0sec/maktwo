import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Input} from '../src/client/input.js';

const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function emitter(){const handlers=new Map();return{addEventListener(type,fn){const list=handlers.get(type)||[];list.push(fn);handlers.set(type,list)},emit(type,event={}){for(const fn of handlers.get(type)||[])fn(event)}}}
function harness(){const previous={document:globalThis.document,window:globalThis.window};const doc=emitter(),win=emitter(),canvas=emitter();
 doc.pointerLockElement=null;doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.emit('pointerlockchange')};
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700,right:1000,bottom:700});
 canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;doc.emit('pointerlockchange');return Promise.resolve()};
 canvas.setPointerCapture=()=>{};
 globalThis.document=doc;globalThis.window=win;
 return{doc,win,canvas,restore(){globalThis.document=previous.document;globalThis.window=previous.window}};
}
test('inventory suppresses world clicks but keeps WASD and right-drag camera live',()=>{
 const h=harness();try{
  const input=new Input(h.canvas);
  h.doc.emit('keydown',{code:'KeyW',target:null,preventDefault(){}});
  h.canvas.emit('mousedown',{button:2,clientX:300,clientY:240,preventDefault(){}});
  h.doc.emit('mousemove',{clientX:315,clientY:251,movementX:15,movementY:11});
  assert.ok(input.consumeLook()[0]>0);
  input.setUiMode(false);input.setInventoryMode(true);
  assert.equal(input.read().forward,true,'inventory should not freeze held movement');
  h.doc.emit('mousemove',{clientX:331,clientY:249,movementX:16,movementY:-2});
  assert.deepEqual(input.consumeLook(),[16,-2]);
  h.canvas.emit('mousedown',{button:0,clientX:200,clientY:100});
  h.doc.emit('mouseup',{button:0});
  assert.equal(input.read().use,false,'inventory click is not a block placement');
  assert.equal(input.read().mine,false,'inventory click is not block mining');
  input.setInventoryMode(false);input.setUiMode(true);
  assert.equal(input.read().forward,false,'settings still prevent game movement');
 }finally{h.restore()}
});
test('C camera lock uses pointer movement; free cursor editing survives unlock',async()=>{
 const h=harness();try{
  const input=new Input(h.canvas);input.toggleCameraMode();
  assert.equal(input.locked,true);
  h.doc.emit('mousemove',{clientX:500,clientY:350,movementX:25,movementY:-8});
  assert.deepEqual(input.consumeLook(),[25,-8]);
  assert.equal(input.canvasCursor(),null,'no ghost cursor while locked');
  input.toggleCameraMode();assert.equal(input.locked,false);
  h.doc.emit('mousemove',{clientX:423,clientY:330,movementX:0,movementY:0});
  assert.deepEqual(input.canvasCursor(),{x:423,y:330});
 }finally{h.restore()}
});
test('in-game inventory frame retains camera and physics while interaction is blocked',()=>{
 const source=file('src/client/game.js');const html=file('index.html'),css=file('style.css');
 assert.match(source,/if\(this\.panel==='inventory'\|\|!this\.uiOpen\)applyCameraLook/);
 assert.match(source,/if\(this\.uiOpen\)\{this\.target=null;this\.mining\.reset\(\)/);
 assert.match(source,/this\.input\.setInventoryMode\(this\.panel==='inventory'\)/);
 assert.match(source,/toggleCameraMode\(\)/);
 assert.match(html,/id="camera-btn"/);
 for(const id of ['screen','hotbar','bag-btn','menu-btn','resume','help-btn','mode','water-repair'])assert.ok(html.includes(`id="${id}"`));
 assert.match(css,/#hotbar-dock/);assert.match(css,/#toolbar/);
});
test('inventory opens camera drag anywhere outside the workspace while world actions remain disabled',()=>{
 const h=harness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  const ev=(pointerId,x,y)=>({pointerId,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
  h.canvas.emit('pointerdown',ev(10,100,400));h.canvas.emit('pointerdown',ev(11,810,400));
  h.canvas.emit('pointermove',ev(10,155,410));h.canvas.emit('pointermove',ev(11,855,378));
  const m=input.read();assert.equal(m.moveX,0,'outside hologram drags are camera, not walking');assert.equal(m.use,false);assert.equal(m.mine,false);
  assert.ok(input.consumeLook()[0]>0,'both outside fingers contribute camera look');
  h.canvas.emit('pointerup',ev(11,855,378));h.canvas.emit('pointerup',ev(10,155,410));
  assert.equal(input.read().moveX,0);
 }finally{h.restore()}
});

test('a captured hologram pointer leaves the other camera finger responsive',()=>{
 const h=harness();try{
  const input=new Input(h.canvas);input.setInventoryMode(true);
  let captured=0,moves=0,releases=0;
  input.hologramPointerDown=e=>{captured++;return e.pointerId===11};
  input.hologramPointerMove=()=>moves++;
  input.hologramPointerUp=()=>releases++;
  const ev=(pointerId,x,y)=>({pointerId,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
  h.canvas.emit('pointerdown',ev(11,810,330));
  h.canvas.emit('pointermove',ev(11,855,340));
  assert.equal(moves,1);
  assert.deepEqual(input.consumeLook(),[0,0],'dragged item must not rotate camera');
  h.canvas.emit('pointerdown',ev(12,820,460));
  h.canvas.emit('pointermove',ev(12,860,445));
  assert(input.consumeLook()[0]>0,'another pointer still rotates camera');
  h.canvas.emit('pointerup',ev(11,855,340));
  assert.equal(releases,1);
  assert.equal(input.hologramCaptured.size,0);
  h.canvas.emit('pointerup',ev(12,860,445));
 }finally{h.restore()}
});
