import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Input} from '../src/client/input.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {Chunk} from '../src/core/chunk.js';
import {World} from '../src/core/world.js';
import {meshChunk} from '../src/client/mesher.js';

function emit(target,type,props={}){
 const e=new Event(type,{bubbles:true,cancelable:true});
 for(const [name,value] of Object.entries(props))Object.defineProperty(e,name,{value});
 target.dispatchEvent(e);
 return e;
}

test('mouse tap installs; held mouse mines; UI clears pointer states',()=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;
 const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();
 Object.assign(doc,{pointerLockElement:null});
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});
 globalThis.document=doc;globalThis.window=win;
 try{
  const input=new Input(canvas);
  emit(doc,'keydown',{code:'KeyR'});assert.equal(input.read().place,false);
  emit(doc,'keydown',{code:'KeyW'});assert.equal(input.read().forward,true);
  input.setUiMode(true);assert.equal(input.read().forward,false);
  emit(doc,'keydown',{code:'KeyW'});input.setUiMode(false);
  assert.equal(input.read().forward,false);
  emit(canvas,'mousedown',{button:0,clientX:360,clientY:210});assert.equal(input.locked,false);
  assert.equal(input.read().mine,false);
  input.pointer.start=performance.now()-500;assert.equal(input.read().mine,true);
  emit(doc,'mouseup',{button:0});assert.equal(input.read().use,false,'hold never installs');
  emit(canvas,'mousedown',{button:0,clientX:550,clientY:310});emit(doc,'mouseup',{button:0});
  const click=input.read();assert.equal(click.use,true,'short click issues exactly one place');assert.deepEqual(click.aim,{x:550,y:310});
  assert.equal(input.read().use,false);
  emit(canvas,'mousedown',{button:0,clientX:300,clientY:300});input.setUiMode(true);
  assert.equal(input.read().mine,false);
 }finally{globalThis.document=oldDoc;globalThis.window=oldWin}
});

test('every light fixture produces its own visible emissive geometry',()=>{
 for(const id of [B.TORCH,B.LANTERN,B.CAMPFIRE]){
  const chunk=new Chunk(0,0);chunk.set(8,15,8,id);
  const {opaque}=meshChunk({seed:2,getChunk:()=>null},chunk);
  const emissive=[...opaque].filter((v,index)=>index%7===6&&v<0);
  assert.ok(opaque.length>0,`fixture ${id} must render`);
  assert.ok(emissive.length>0,`fixture ${id} must glow`);
 }
});

test('light query only examines nearby indexed chunks and retains matching nearest results',()=>{
 const world=new World({mode:'flat'});
 world.set(1,30,1,B.LANTERN);
 world.set(-16,30,0,B.TORCH);
 world.set(1000,30,1000,B.CAMPFIRE);
 // A regression to a full-world scan would fail this test.
 world.lights.sources.values=()=>{throw Error('global light scan must not happen')};
 const lights=world.lights.near(0,30,0,8,20);
 assert.deepEqual(lights.map(l=>l.id),[B.LANTERN,B.TORCH]);
 assert.equal(world.lights.near(0,30,0,8,3).length,1);
});

test('UI documents explain placement and expose a one-click resume path',()=>{
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 assert.match(page,/id="resume"/);
 assert.match(page,/id="control-hint"/);
 assert.match(page,/아이템 선택 후 원하는 곳을 짧게 클릭 또는 탭/);
 assert.match(controller,/e\.code==='KeyE'/);
 assert.match(controller,/this\.requestGameFocus\(\)/);
});
