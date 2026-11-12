import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {GestureState,HOLD_MS} from '../src/client/gestures.js';
import {cardGeometry,createAnchor} from '../src/client/hologram.js';
import {World} from '../src/core/world.js';
import {Player} from '../src/entities/entities.js';
import {BLOCK_SIZE,toMeters} from '../src/core/scale.js';
const root=new URL('../',import.meta.url);
const source=path=>readFileSync(new URL(path,root),'utf8');

test('mobile split zones allow movement and look with two independent fingers',()=>{
 const state=new GestureState();
 assert.ok(state.down(1,50,300,180,1000));
 assert.ok(state.down(2,300,200,180,1020));
 state.move(1,110,220);state.move(2,333,180);
 const m=state.movement();assert.ok(m.x>.3&&m.y<-.3);
 const [dx,dy]=state.consumeLook();assert.ok(dx>25&&dy<0);
 assert.deepEqual(state.consumeLook(),[0,0]);
 state.up(2,333,180,1200);assert.equal(state.consumeTaps(),0,'a drag never places a block');
 assert.ok(state.movement().x>.3,'moving remains active after look ends');
 state.up(1,110,220,1200);assert.deepEqual(state.movement(),{x:0,y:0});
});
test('short tap places exactly once, and sustained right hold mines instead',()=>{
 const state=new GestureState();
 state.down(8,260,220,180,500);
 state.up(8,262,219,610);
 assert.equal(state.consumeTaps(),1);assert.equal(state.consumeTaps(),0);
 state.down(9,280,220,180,1000);
 assert.equal(state.mining(1000+HOLD_MS-1),false);
 assert.equal(state.mining(1000+HOLD_MS),true);
 state.up(9,280,220,1000+HOLD_MS+300);
 assert.equal(state.consumeTaps(),0,'long hold never issues a delayed placement');
 assert.equal(state.mining(2000),false);
});
test('gesture drift, cancellation, duplicate side and mode resets prevent phantom edits',()=>{
 const s=new GestureState();
 s.down(1,280,150,180,0);assert.equal(s.down(2,300,150,180,50),false);
 s.move(1,290,165);s.up(1,290,165,200);
 assert.equal(s.consumeTaps(),0);
 s.down(3,260,200,180,500);s.up(3,260,200,530,true);
 assert.equal(s.consumeTaps(),0);
 s.down(4,80,150,180,1000);s.move(4,135,140);s.reset();
 assert.deepEqual(s.movement(),{x:0,y:0});assert.equal(s.mining(3000),false);
});
test('mobile hologram cards remain inside the portrait view cone',()=>{
 const cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`Item ${i}`})),true);
 const anchor=createAnchor({x:1,y:25,z:1,eye:2.125,yaw:0,pitch:0},true);
 assert.equal(anchor.center[0],1);
 const horizontalHalfWidth=2.65*Math.tan(75*Math.PI/360)*.45;
 assert.ok(cards.every(card=>Math.abs(card.x)+card.w*.5<horizontalHalfWidth));
});
test('physical 0.8m voxels preserve integer chunk storage and world save coordinates',()=>{
 assert.equal(BLOCK_SIZE,.8);
 const p=new Player(0,25,0);assert.ok(Math.abs(toMeters(p.height)-1.9)<1e-9);
 const storage=new Map(),adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 const world=new World({mode:'flat',storage:adapter,name:'Scale'});world.set(-5,30,20,9);world.save();
 const restored=new World({mode:'flat',storage:adapter,name:'Scale'});
 assert.equal(restored.get(-5,30,20),9);
});
test('rounded outer chunk ring reduces loaded area without dropping adjacent chunks',()=>{
 const w=new World({mode:'flat'});
 w.stream(0,0,3,100,{roundEdges:true});
 assert.equal(w.chunks.size,37);
 assert.ok(w.getChunk(1,1,false));assert.ok(w.getChunk(-2,-1,false));
 assert.equal(w.getChunk(3,3,false),undefined);
 assert.ok(w.maxChunks<100);
});
test('PWA manifest, icons and all offline app-shell dependencies exist',()=>{
 const manifest=JSON.parse(source('manifest.webmanifest'));
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){assert.ok(existsSync(new URL(icon.src,root)));const buf=readFileSync(new URL(icon.src,root));assert.equal(buf.subarray(1,4).toString(),'PNG')}
 const sw=source('sw.js');const paths=[...sw.matchAll(/'\.\/(?:src|icons)[^']+'/g)].map(m=>m[0].slice(1,-1));
 assert.ok(paths.length>=25);
 for(const file of paths)assert.ok(existsSync(new URL(file,root)),`missing offline dependency: ${file}`);
 const moduleGraph=[...source('src/client/game.js').matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g)].map(m=>m[1]);
 for(const item of moduleGraph){const file=new URL(item,new URL('src/client/game.js',root));assert.ok(existsSync(file),`missing entry import: ${item}`)}
 assert.match(source('index.html'),/rel="manifest"/);
 assert.match(source('src/client/game.js'),/registerPWA\(\)/);
});
test('WebGL rendering scales terrain and hologram vertices consistently',()=>{
 const renderer=source('src/client/renderer.js'),hologram=source('src/client/hologram.js');
 assert.match(renderer,/aPos\*\$\{BLOCK_SIZE\.toFixed\(2\)\}/);
 assert.match(hologram,/aPosition\*\$\{BLOCK_SIZE\.toFixed\(2\)\}/);
 assert.match(renderer,/toMeters\(player\.x\)/);
});

test('offline worker activates and serves cached navigation, modules, and icons without network',async()=>{
 const {runInNewContext}=await import('node:vm');
 const listeners={},data=new Map(),scope='https://example.test/maktwo/';
 const normalized=u=>typeof u==='string'?u:u.href||u.url;
 const cache={
  async addAll(urls){for(const u of urls)data.set(normalized(u),new Response(`fixture:${u}`,{status:200}));},
  async match(request,{ignoreSearch=false}={}){
   const url=normalized(request);
   if(!ignoreSearch)return data.get(url);
   const noQuery=new URL(url);noQuery.search='';return data.get(noQuery.href);
  },
  async put(request,response){data.set(normalized(request),response)}
 };
 const keys=new Set(),cachesMock={
  async open(name){keys.add(name);return cache},
  async keys(){return [...keys]},
  async delete(name){return keys.delete(name)}
 };
 const self={registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,listener)=>listeners[name]=listener};
 runInNewContext(source('sw.js'),{self,caches:cachesMock,URL,Response,fetch:async()=>{throw Error('Network offline')}});
 const run=(name,event)=>new Promise((resolve,reject)=>{
  listeners[name]({...event,waitUntil:p=>p.then(resolve,reject),respondWith:p=>p.then(resolve,reject)});
 });
 await run('install',{});
 await run('activate',{});
 const navigation=await run('fetch',{request:{url:scope,method:'GET',mode:'navigate'}});
 assert.equal(navigation.status,200);
 assert.match(await navigation.text(),/index\.html/);
 const module=await run('fetch',{request:{url:scope+'src/client/game.js?v=1.2.0',method:'GET',mode:'cors'}});
 assert.equal(module.status,200);
 assert.match(await module.text(),/src\/client\/game\.js/);
 const icon=await run('fetch',{request:{url:scope+'icons/maktwo-192.png',method:'GET',mode:'cors'}});
 assert.equal(icon.status,200);
});
