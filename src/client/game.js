import {WorldManager} from '../core/world.js';import {Player,EntityManager} from '../entities/entities.js';import {Effects} from '../core/effects.js';import {raycast,collides} from '../core/physics.js';import {block,BLOCK as B,HOTBAR,LIGHTBAR} from '../core/blocks.js';import {Renderer} from './renderer.js';import {Input} from './input.js';import {clamp} from '../util/math.js';import {explode} from '../core/systems.js';
const $=id=>document.getElementById(id);
class Game{
 constructor(){this.canvas=$('screen');this.renderer=new Renderer(this.canvas);this.input=new Input(this.canvas);this.manager=new WorldManager(localStorage);this.world=this.manager.add('Overworld',17331,'normal');this.manager.add('Flatlands',9901,'flat');this.manager.add('Islands',45716,'islands');this.player=new Player(...Object.values(this.world.spawn()));this.entities=new EntityManager(this.world);this.effects=new Effects();this.last=performance.now();this.acc=0;this.interactTimer=0;this.frameCount=0;this.lastHud=0;this.portalCooldown=0;this.lastFrameMs=16;this.target=null;this.selected=0;this.palette='blocks';this.menuOpen=false;this.helpOpen=false;this.hasLockedOnce=false;this.bindUI();this.world.stream(this.player.x,this.player.z,2,4);this.world.events.on('block-change',e=>{});this.status('영원한 밤 · L 조명 도구 · WASD 이동');requestAnimationFrame(t=>this.frame(t))}
 get paletteItems(){return this.palette==='lights'?LIGHTBAR:HOTBAR}
 renderHotbar(){const bar=$('hotbar');bar.replaceChildren();for(let i=0;i<this.paletteItems.length;i++){
  const id=this.paletteItems[i],el=document.createElement('button');el.className='slot';
  const num=document.createElement('span');num.className='slot-number';num.textContent=String((i+1)%10);
  const tile=document.createElement('span');tile.className='voxel';tile.style.setProperty('--tile',block(id).color);
  el.append(num,tile);el.title=`${block(id).name} · ${i+1}`;el.setAttribute('aria-label',`${i+1}번 ${block(id).name} 선택`);el.onclick=()=>this.select(i);bar.append(el);
 }this.select(Math.min(this.selected,this.paletteItems.length-1));
 $('palette-toggle').textContent=this.palette==='lights'?'▦ 블록':'✦ 조명';
 $('palette-toggle').title='블록/조명 도구 전환 · L';
 }
 togglePalette(){this.palette=this.palette==='lights'?'blocks':'lights';this.selected=0;this.renderHotbar();this.status(this.palette==='lights'?'조명 도구 · 1 횃불  2 랜턴  3 모닥불':'건축 블록')}
 // UI mode releases pointer lock once and keeps it released while controls are in use.
 setMenu(open){
  this.menuOpen=Boolean(open);$('toolbar').classList.toggle('hidden',!this.menuOpen);
  $('menu-btn').setAttribute('aria-expanded',String(this.menuOpen));
  this.input.setUiMode(this.menuOpen||this.helpOpen);
  if(this.menuOpen&&document.pointerLockElement===this.canvas)document.exitPointerLock?.();
  this.updateControlHint();
 }
 setHelp(open){
  this.helpOpen=Boolean(open);
  if(this.helpOpen)this.setMenu(false);
  $('help').classList.toggle('hidden',!this.helpOpen);
  this.input.setUiMode(this.menuOpen||this.helpOpen);
  if(this.helpOpen&&document.pointerLockElement===this.canvas)document.exitPointerLock?.();
  this.updateControlHint();
 }
 requestGameFocus(){
  this.setHelp(false);this.setMenu(false);
  try{this.canvas.requestPointerLock?.()?.catch?.(()=>this.updateControlHint())}catch{}
  this.updateControlHint();
 }
 toggleMenu(){if(this.helpOpen){this.setHelp(false);this.setMenu(true);return}
  if(this.menuOpen)this.requestGameFocus();else this.setMenu(true)}
 updateControlHint(){
  const el=$('control-hint');if(!el)return;
  const ui=this.menuOpen||this.helpOpen;
  el.classList.toggle('ui-active',ui);
  el.textContent=ui?'블록을 골라보세요 · 게임 복귀는 E 또는 버튼':
   document.pointerLockElement===this.canvas?'좌클릭 파괴 · 우클릭 / R 설치 · 1–0 블록 · L 조명 · E 메뉴':
   '화면 클릭해서 시작 · 좌클릭 파괴 · 우클릭 / R 설치 · E 메뉴';
 }
 bindUI(){
  this.renderHotbar();this.updateControlHint();
  $('palette-toggle').onclick=()=>this.togglePalette();
  $('menu-btn').onclick=()=>this.toggleMenu();
  $('resume').onclick=()=>this.requestGameFocus();
  $('help-btn').onclick=()=>this.setHelp(true);
  $('close-help').onclick=()=>this.requestGameFocus();
  $('save').onclick=()=>{this.world.save();this.status('월드 저장 완료')};
  $('mode').onclick=()=>{this.player.fly=!this.player.fly;this.player.vy=0;this.status(this.player.fly?'비행 모드':'걷기 모드')};
  $('world').addEventListener('change',e=>this.travel(e.target.value));
  $('spawn').onclick=()=>{const t=this.world.spawn();Object.assign(this.player,t,{vx:0,vy:0,vz:0});this.status('시작 위치로 이동')};
  $('seed').textContent=String(this.world.seed);
  for(const b of document.querySelectorAll('[data-action]')){
   const action=b.dataset.action;
   b.addEventListener('pointerdown',e=>{e.preventDefault();this.input.held[action]=true;b.setPointerCapture(e.pointerId)});
   for(const n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>this.input.held[action]=false);
  }
  // Clicking the world closes menus and captures the mouse in one gesture.
  this.canvas.addEventListener('mousedown',()=>{if(this.menuOpen||this.helpOpen)this.requestGameFocus()});
  document.addEventListener('pointerlockchange',()=>{
   const locked=document.pointerLockElement===this.canvas;
   if(locked)this.hasLockedOnce=true;
   else if(this.hasLockedOnce&&!this.menuOpen&&!this.helpOpen)this.setMenu(true);
   this.updateControlHint();
  });
  this.canvas.addEventListener('wheel',e=>{
   e.preventDefault();if(this.menuOpen||this.helpOpen)return;
   this.select((this.selected+(e.deltaY>0?1:-1)+this.paletteItems.length)%this.paletteItems.length);
  },{passive:false});
  document.addEventListener('keydown',e=>{
   if(e.repeat)return;
   if(e.code==='KeyE'&& !e.target?.matches?.('input,textarea,select,[contenteditable]')){
    e.preventDefault();this.toggleMenu();return;
   }
   if(e.code==='Escape'){
    if(this.helpOpen){e.preventDefault();this.setHelp(false);this.setMenu(true)}
    else if(this.menuOpen){e.preventDefault();this.setMenu(false)}
    return;
   }
   if(this.menuOpen||this.helpOpen||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   const i=+e.key;
   if(e.code.startsWith('Digit')&&i>=0&&i<=9){const index=i===0?9:i-1;if(index<this.paletteItems.length)this.select(index)}
   if(e.code==='KeyL')this.togglePalette();
   if(e.code==='KeyF')$('mode').click();
   if(e.code==='KeyH')this.setHelp(true);
   if(e.code==='KeyG')this.spawnMob(e.shiftKey?'zombie':'sheep');
   if(e.code==='KeyB')this.blast();
   if(e.code==='KeyP')this.world.save();
  });
  window.addEventListener('beforeunload',()=>this.world.save());
 }
 select(i){this.selected=i;document.querySelectorAll('.slot').forEach((el,j)=>{el.classList.toggle('active',j===i);el.setAttribute('aria-pressed',String(j===i))});$('block-name').textContent=block(this.paletteItems[i]).name}
 status(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100)}
 travel(name){this.manager.active.save();this.world=this.manager.travel(name);this.entities=new EntityManager(this.world);this.effects=new Effects();const pos=this.world.spawn();Object.assign(this.player,pos,{vx:0,vy:0,vz:0});this.renderer.resetWorld(this.world);this.world.stream(pos.x,pos.z,2,4);$('seed').textContent=String(this.world.seed);this.status('Entered '+name)}
 blast(){const p=this.player,d=p.direction(),hit=raycast(this.world,{x:p.x,y:p.y+p.eye,z:p.z},d,7);if(hit){const x=hit.x+.5,y=hit.y+.5,z=hit.z+.5;explode(this.world,this.entities.entities,this.effects,x,y,z,3);this.status('Blast!')}}
 spawnMob(type='sheep'){const p=this.player,d=p.direction(),x=Math.floor(p.x+d.x*5),z=Math.floor(p.z+d.z*5);for(let y=55;y>0;y--){if(this.world.get(x,y,z)===B.AIR&&this.world.get(x,y-1,z)!==B.AIR){this.entities.spawn(type,x+.5,y,z+.5);this.status('Mob spawned');break}}}
 interaction(dt,input){this.interactTimer-=dt;const p=this.player,d=p.direction(),origin={x:p.x,y:p.y+p.eye,z:p.z};this.target=raycast(this.world,origin,d,6);
 if(this.interactTimer>0)return;
 if(input.mine){const entity=this.entities.attack(p,3.4);if(entity){this.effects.burst(entity.x,entity.y+1,entity.z,'#f15d59',9);this.interactTimer=.32;return}if(this.target){const t=this.target;if(t.id!==B.BEDROCK){this.world.set(t.x,t.y,t.z,B.AIR);this.effects.burst(t.x+.5,t.y+.5,t.z+.5,block(t.id).color,16);this.interactTimer=.18}}}
 else if(input.place&&this.target){const t=this.target,x=t.x+t.normal.x,y=t.y+t.normal.y,z=t.z+t.normal.z,id=this.paletteItems[this.selected],old=this.world.get(x,y,z);if(block(old).replaceable){this.world.set(x,y,z,id);if(collides(this.world,p.x,p.y,p.z,p.width,p.height)){this.world.set(x,y,z,old)}else{this.effects.burst(x+.5,y+.5,z+.5,block(id).color,5)}this.interactTimer=.18}}}
 tick(dt){this.portalCooldown=Math.max(0,this.portalCooldown-dt);const p=this.player,input=this.input.read(),[mx,my]=this.input.consumeLook();p.yaw-=mx*.0023;p.pitch=clamp(p.pitch-my*.0023,-1.53,1.53);p.update(this.world,dt,input);if(this.portalCooldown===0&&(this.world.get(p.x,p.y+.4,p.z)===B.PORTAL||this.world.get(p.x,p.y+1.1,p.z)===B.PORTAL)){const names=[...this.manager.worlds.keys()];this.travel(names[(names.indexOf(this.world.name)+1)%names.length]);this.portalCooldown=2;}this.world.tick();this.entities.tick(dt,p);this.effects.tick(dt);this.interaction(dt,input);if(p.dead){p.hp=20;p.dead=false;Object.assign(p,this.world.spawn(),{vx:0,vy:0,vz:0});this.status('Respawned')}}
 frame(time){const elapsed=time-this.last,dt=Math.min(elapsed/1000,.06);this.last=time;this.lastFrameMs=elapsed;this.acc+=dt;let n=0;while(this.acc>=1/60&&n++<5){this.tick(1/60);this.acc-=1/60}this.frameCount++;this.renderer.observeFrame(elapsed);if(this.frameCount%3===0)this.world.stream(this.player.x,this.player.z,3,2);this.renderer.sync(this.world,this.player);this.renderer.frame(this.world,this.player,this.entities.entities,this.effects);if(time-this.lastHud>150){this.hud();this.lastHud=time}requestAnimationFrame(t=>this.frame(t))}
 hud(){const p=this.player;$('coords').textContent=`${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`;$('biome').textContent=`${this.world.name} · ${this.world.mode.toUpperCase()}`;$('fps').textContent=`${Math.round(1000/Math.max(1,this.lastFrameMs))} FPS · ${this.world.chunks.size} loaded / ${this.renderer.lastDrawnChunks} drawn · ${this.entities.entities.length} mobs`;$('target').textContent=this.target?'조준: '+block(this.target.id).name+' · 우클릭 / R 설치':'기존 블록을 조준하세요';$('health').textContent='♥'.repeat(Math.ceil(p.hp/2))+'♡'.repeat(10-Math.ceil(p.hp/2));$('flight').textContent=p.fly?'FLYING':'SURVIVAL PHYSICS'}
}
try{new Game()}catch(err){console.error(err);$('fatal').textContent='Cannot start: '+err.message;$('fatal').hidden=false}
