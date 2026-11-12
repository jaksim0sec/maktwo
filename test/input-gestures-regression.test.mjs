import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureState,HOLD_MS,LOOK_START_PX,MOVE_DEADZONE} from '../src/client/gestures.js';
import {Input} from '../src/client/input.js';

test('a stationary left tap edits, while a movement drag never edits',()=>{
 const s=new GestureState();s.down(11,40,270,180,1000,360);s.up(11,41,270,1050);
 assert.equal(s.consumeTaps(),1);assert.deepEqual(s.consumeTapPoint(),{x:41,y:270});s.down(12,45,270,180,1100,360);s.move(12,100,270);s.up(12,100,270,1200);assert.equal(s.consumeTaps(),0);
});
test('right-hand fine jitter produces no camera movement, a tap only on release',()=>{
 const s=new GestureState();s.down(9,260,260,180,100,360);
 s.move(9,265,265);assert.deepEqual(s.consumeLook(),[0,0]);
 s.up(9,265,265,280);
 assert.equal(s.consumeTaps(),1);assert.deepEqual(s.consumeTapPoint(),{x:265,y:265});
});
test('look gesture does not edit or mine and retains right-hand role after crossing midpoint',()=>{
 const s=new GestureState();s.down(6,280,140,180,0,360);
 s.move(6,280-LOOK_START_PX-4,145);s.move(6,140,150);
 assert.ok(s.consumeLook()[0]<-65);
 assert.equal(s.miningPoint(700),null);
 s.up(6,140,150,730);assert.equal(s.consumeTaps(),0);
});
test('hold stays anchored through a small wobble; large drift transitions to camera drag',()=>{
 const s=new GestureState();s.down(2,300,400,180,1000,360);
 assert.equal(s.miningPoint(1000+HOLD_MS-1),null);
 assert.deepEqual(s.miningPoint(1000+HOLD_MS),{x:300,y:400});
 s.move(2,314,403);assert.deepEqual(s.miningPoint(1500),{x:300,y:400});
 assert.deepEqual(s.consumeLook(),[0,0]);
 s.move(2,335,410);assert.equal(s.miningPoint(1600),null);assert.ok(s.consumeLook()[0]>0);
 s.move(2,301,400);assert.equal(s.miningPoint(1700),null);
 s.up(2,300,400,1800);assert.equal(s.consumeTaps(),0);
});
test('left movement has gradual analog strength and is independent of right hand',()=>{
 const s=new GestureState();s.down(1,70,280,180,1000,360);
 s.move(1,70+MOVE_DEADZONE-2,280);assert.equal(s.movement().x,0);
 s.move(1,120,280);const moderate=s.movement().x;assert.ok(moderate>0&&moderate<1);
 s.down(2,280,260,180,1050,360);s.move(2,305,240);
 assert.ok(s.consumeLook()[0]>0);assert.equal(s.movement().x,moderate);
 s.up(2,305,240,1100);assert.equal(s.movement().x,moderate);
 s.up(1,120,280,1150);assert.deepEqual(s.movement(),{x:0,y:0});
});
test('cancel, reset and duplicate side cannot leave stuck movement or phantom taps',()=>{
 const s=new GestureState();assert.equal(s.down(1,40,60,180,0),true);
 assert.equal(s.down(2,45,60,180,1),false);
 s.move(1,120,70);s.up(1,120,70,100,true);assert.deepEqual(s.movement(),{x:0,y:0});
 s.down(3,320,200,180,200);s.move(3,350,200);s.reset();
 assert.deepEqual(s.consumeLook(),[0,0]);assert.equal(s.consumeTaps(),0);assert.equal(s.miningPoint(900),null);
});
function events(){
 const handlers=new Map();
 return{addEventListener(name,cb){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(cb)},emit(name,event){for(const fn of handlers.get(name)||[])fn(event)}};
}
test('Input supplies missing canvasCursor and converts mobile client positions into canvas CSS pixels',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 const doc=events(),win=events();doc.pointerLockElement=null;
 const canvas=events(),rect={left:12,top:25,width:400,height:800,right:412,bottom:825};
 canvas.getBoundingClientRect=()=>rect;
 canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
 globalThis.document=doc;globalThis.window=win;
 try{
  const input=new Input(canvas);
  assert.equal(input.canvasCursor(),null);
  doc.emit('mousemove',{clientX:120,clientY:100,movementX:0,movementY:0});
  assert.deepEqual(input.canvasCursor(),{x:108,y:75});
  doc.emit('mousemove',{clientX:500,clientY:100,movementX:0,movementY:0});assert.equal(input.canvasCursor(),null);
  let now=performance.now();
  const event=(id,x,y)=>({pointerType:'touch',pointerId:id,clientX:x,clientY:y,preventDefault(){}});
  canvas.emit('pointerdown',event(1,300,160));
  canvas.emit('pointerup',event(1,300,160));
  const frame=input.read();assert.equal(frame.use,true);assert.deepEqual(frame.aim,{x:288,y:135});
  canvas.emit('pointerdown',event(3,300,240));
  // Long hold without waiting for timers: change only the timestamp owned by the state machine.
  input.gestures.fingers.get(3).time=now-HOLD_MS-1;
  const mine=input.read();assert.equal(mine.mine,true);assert.deepEqual(mine.aim,{x:288,y:215});
  win.emit('orientationchange',{});assert.equal(input.read().mine,false);
  input.setUiMode(true);assert.equal(input.canvasCursor(),null);
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow}
});
