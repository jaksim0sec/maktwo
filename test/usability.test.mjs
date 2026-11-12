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

test('construction input supports R as an alternative to trackpad right click and suspends actions in UI mode',()=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;
 const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();
 Object.assign(doc,{pointerLockElement:null});
 canvas.requestPointerLock=()=>{doc.pointerLockElement=canvas;emit(doc,'pointerlockchange');return Promise.resolve()};
 globalThis.document=doc;globalThis.window=win;
 try{
  const input=new Input(canvas);
  emit(doc,'keydown',{code:'KeyR'});
  assert.equal(input.read().place,true);
  emit(doc,'keydown',{code:'KeyW'});
  assert.equal(input.read().forward,true);
  input.setUiMode(true);
  assert.equal(input.read().place,false);
  assert.equal(input.read().forward,false);
  emit(doc,'keydown',{code:'KeyW'});
  input.setUiMode(false);
  assert.equal(input.read().forward,false,'closing the menu must not preserve a stuck movement key');
  emit(canvas,'mousedown',{button:2});
  assert.equal(input.locked,true);
  emit(canvas,'mousedown',{button:2});
  assert.equal(input.read().place,true);
  doc.pointerLockElement=null;emit(doc,'pointerlockchange');
  assert.equal(input.read().place,false,'unlocked pointer must release held mouse state');
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
 assert.match(page,/우클릭 \/ R 설치/);
 assert.match(controller,/e\.code==='KeyE'/);
 assert.match(controller,/this\.requestGameFocus\(\)/);
});
