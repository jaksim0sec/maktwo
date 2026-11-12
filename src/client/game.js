import {WorldManager} from '../core/world.js?v=0.8.0';import {Player,EntityManager} from '../entities/entities.js?v=0.8.0';import {Effects} from '../core/effects.js';import {raycast,collides} from '../core/physics.js?v=0.8.0';import {block,BLOCK as B,HOTBAR,LIGHTBAR} from '../core/blocks.js?v=0.8.0';import {Renderer} from './renderer.js?v=0.8.0';import {applyCameraLook} from './camera.js?v=0.8.0';import {Hologram} from './hologram.js?v=0.7.0';import {Input} from './input.js?v=0.8.0';import {clamp} from '../util/math.js';import {explode} from '../core/systems.js';
const $=id=>document.getElementById(id);
// Optional buttons can be absent when the page and module use different CDN cache versions.
const bindClick=(id,handler)=>{const el=$(id);if(el)el.addEventListener('click',handler);else console.warn(`[MakTwo] Missing optional UI button #${id}`)};
class Game{
 constructor(){this.canvas=$('screen');this.renderer=new Renderer(this.canvas);this.hologram=new Hologram(this.renderer.gl);this.renderer.hologram=this.hologram;this.input=new Input(this.canvas);this.manager=new WorldManager(localStorage);this.world=this.manager.add('Overworld',17331,'normal');this.manager.add('Flatlands',9901,'flat');this.manager.add('Islands',45716,'islands');this.player=new Player(...Object.values(this.world.spawn()));this.entities=new EntityManager(this.world);this.effects=new Effects();this.last=performance.now();this.acc=0;this.interactTimer=0;this.frameCount=0;this.lastHud=0;this.portalCooldown=0;this.lastFrameMs=16;this.target=null;this.selected=0;this.palette='blocks';this.menuOpen=false;this.helpOpen=false;this.panel=null;this.bindUI();this.world.stream(this.player.x,this.player.z,2,4);this.world.events.on('block-change',e=>{});this.status('영원한 밤 · L 조명 도구 · WASD 이동');requestAnimationFrame(t=>this.frame(t))}
 get paletteItems(){return this.palette==='lights'?LIGHTBAR:HOTBAR}
 renderHotbar(){const bar=$('hotbar');bar.replaceChildren();for(let i=0;i<this.paletteItems.length;i++){
  const id=this.paletteItems[i],el=document.createElement('button');el.className='slot';
  const num=document.createElement('span');num.className='slot-number';num.textContent=String((i+1)%10);
  const tile=document.createElement('span');tile.className='voxel';tile.style.setProperty('--tile',block(id).color);
  el.append(num,tile);el.title=`${block(id).name} · ${i+1}`;el.setAttribute('aria-label',`${i+1}번 ${block(id).name} 선택`);el.onclick=()=>this.select(i);bar.append(el);
 }this.select(Math.min(this.selected,this.paletteItems.length-1));
 const paletteToggle=$('palette-toggle');if(paletteToggle){paletteToggle.textContent=this.palette==='lights'?'▦ 블록':'✦ 조명';paletteToggle.title='블록/조명 도구 전환 · L'}
 }
 // Inventory lives in the actual WebGL scene, not a DOM/modal overlay.
 get uiOpen(){return Boolean(this.panel)}
 setPanel(name){
  const prior=this.panel;this.panel=name||null;this.menuOpen=this.panel==='settings';this.helpOpen=this.panel==='help';
  $('toolbar')?.classList.toggle('hidden',!this.menuOpen);
  $('help')?.classList.toggle('hidden',!this.helpOpen);
  $('menu-btn')?.setAttribute('aria-expanded',String(this.menuOpen));
  $('bag-btn')?.setAttribute('aria-expanded',String(this.panel==='inventory'));
  document.body.classList.toggle('ui-open',this.uiOpen);
  document.body.classList.toggle('holo-open',this.panel==='inventory');
  this.input.setUiMode(this.uiOpen);
  if(this.panel==='inventory'){
   if(prior!=='inventory')this.hologram.open(this.player);
   this.updateHologram();
  }else this.hologram.close();
  // Keep pointer lock active for the in-world hologram. HTML settings still release it.
  if(this.uiOpen&&this.panel!=='inventory'&&document.pointerLockElement===this.canvas)document.exitPointerLock?.();
  this.updateControlHint();
 }
 requestGameFocus(){
  this.setPanel(null);
  if(!matchMedia?.('(pointer:coarse)').matches){
   try{this.canvas.requestPointerLock?.()?.catch?.(()=>this.updateControlHint())}catch{}
  }
  this.updateControlHint();
 }
 togglePanel(name){if(this.panel===name)this.requestGameFocus();else this.setPanel(name)}
 toggleMenu(){this.togglePanel('settings')}
 togglePalette(){
  this.palette=this.palette==='lights'?'blocks':'lights';this.selected=0;
  this.renderHotbar();if(this.panel==='inventory')this.updateHologram();
  this.status(this.palette==='lights'?'조명 도구 · 1 횃불  2 랜턴  3 모닥불':'건축 블록');
 }
 updateHologram(){this.hologram.setInventory(this.palette,this.paletteItems.map(id=>block(id)),this.selected)}
 inventoryClick(){
  const hit=this.hologram.click();if(!hit)return;
  if(hit==='close'){this.requestGameFocus();return}
  if(hit.startsWith('tab:')){
   const palette=hit.slice(4);if(palette!==this.palette)this.togglePalette();return;
  }
  if(hit.startsWith('item:')){
   const index=Number(hit.slice(5));if(index>=0&&index<this.paletteItems.length){this.select(index);this.requestGameFocus()}
  }
 }
 updateControlHint(){
  const el=$('control-hint');if(!el)return;
  el.classList.toggle('ui-active',this.uiOpen);
  el.textContent=this.panel==='inventory'?'게임 공간의 가방 · 마우스로 가리켜 클릭 · E 닫기':
   this.uiOpen?'메뉴 조작 · E 가방 · M 설정 · 계속하기로 복귀':
   document.pointerLockElement===this.canvas?'좌클릭 파괴 · 우클릭 / R 설치 · E 가방 · M 설정 · L 조명':
   '화면 클릭해서 조작 · E 공간형 가방 · 우클릭 / R 설치';
 }
 bindUI(){
  this.renderHotbar();this.updateControlHint();
  bindClick('palette-toggle',()=>this.togglePalette());
  bindClick('menu-btn',()=>this.toggleMenu());
  bindClick('bag-btn',()=>this.togglePanel('inventory'));
  bindClick('resume',()=>this.requestGameFocus());
  bindClick('help-btn',()=>this.togglePanel('help'));
  bindClick('close-help',()=>this.requestGameFocus());
  bindClick('save',()=>{this.world.save();this.status('월드 저장 완료')});
  bindClick('water-repair',()=>{
   const count=this.world.drainPlacedWater(this.player.x,this.player.y,this.player.z,24);
   this.status(count?`주변에 설치된 물 ${count}칸 정리 완료 · 자동 저장`:'주변에 정리할 설치된 물이 없어요');
  });
  bindClick('mode',()=>{this.player.fly=!this.player.fly;this.player.vy=0;this.status(this.player.fly?'비행 모드':'걷기 모드')});
  $('world').addEventListener('change',e=>this.travel(e.target.value));
  bindClick('spawn',()=>{const t=this.world.spawn();Object.assign(this.player,t,{vx:0,vy:0,vz:0,visualStepOffset:0});this.status('시작 위치로 이동')});
  $('seed').textContent=String(this.world.seed);
  for(const b of document.querySelectorAll('[data-action]')){
   const action=b.dataset.action;
   b.addEventListener('pointerdown',e=>{e.preventDefault();this.input.held[action]=true;b.setPointerCapture(e.pointerId)});
   for(const n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>this.input.held[action]=false);
  }
  // Clicking the world closes menus and captures the mouse in one gesture.
  this.canvas.addEventListener('mousedown',event=>{if(this.panel==='inventory'){event.preventDefault();if(event.button===0)this.inventoryClick();return}if(this.uiOpen)this.requestGameFocus()});
  document.addEventListener('pointerlockchange',()=>{
   // Esc may release pointer lock. Do not automatically spawn a menu over the scene.
   this.updateControlHint();
  });
  this.canvas.addEventListener('pointermove',event=>{
   if(this.panel==='inventory'&&!this.input.locked)this.hologram.point(event.clientX,event.clientY,this.canvas.getBoundingClientRect());
  });
  this.canvas.addEventListener('pointerdown',event=>{
   if(this.panel==='inventory'&&event.pointerType==='touch'){
    event.preventDefault();this.hologram.point(event.clientX,event.clientY,this.canvas.getBoundingClientRect());this.inventoryClick();
   }
  });
  this.canvas.addEventListener('wheel',e=>{
   e.preventDefault();if(this.panel==='inventory'){this.hologram.move(0,e.deltaY>0?100:-100);return}if(this.uiOpen)return;
   this.select((this.selected+(e.deltaY>0?1:-1)+this.paletteItems.length)%this.paletteItems.length);
  },{passive:false});
  document.addEventListener('keydown',e=>{
   if(e.repeat||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   if(e.code==='KeyE'||e.code==='KeyI'){e.preventDefault();this.togglePanel('inventory');return}
   if(e.code==='KeyM'){e.preventDefault();this.togglePanel('settings');return}
   if(e.code==='KeyH'){e.preventDefault();this.togglePanel('help');return}
   if(e.code==='Escape'){
    if(this.uiOpen){e.preventDefault();this.setPanel(null)}
    // Browser owns Escape while pointer-locked. No extra UI is opened.
    return;
   }
   if(this.panel==='inventory'){
    if(e.code==='KeyL'){this.togglePalette();return}
    if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5)),index=n===0?9:n-1;if(index>=0&&index<this.paletteItems.length){this.select(index);this.requestGameFocus()}return}
   }
   if(this.uiOpen)return;
   const i=+e.key;
   if(e.code.startsWith('Digit')&&i>=0&&i<=9){const index=i===0?9:i-1;if(index<this.paletteItems.length)this.select(index)}
   if(e.code==='KeyL')this.togglePalette();
   if(e.code==='KeyF')$('mode')?.click();
   if(e.code==='KeyG')this.spawnMob(e.shiftKey?'zombie':'sheep');
   if(e.code==='KeyB')this.blast();
   if(e.code==='KeyP')this.world.save();
  });
  window.addEventListener('beforeunload',()=>this.world.save());
 }
 select(i){this.selected=i;document.querySelectorAll('.slot').forEach((el,j)=>{el.classList.toggle('active',j===i);el.setAttribute('aria-pressed',String(j===i))});$('block-name').textContent=block(this.paletteItems[i]).name;if(this.panel==='inventory')this.updateHologram()}
 status(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100)}
 travel(name){this.manager.active.save();this.world=this.manager.travel(name);this.entities=new EntityManager(this.world);this.effects=new Effects();const pos=this.world.spawn();Object.assign(this.player,pos,{vx:0,vy:0,vz:0,visualStepOffset:0});this.renderer.resetWorld(this.world);this.world.stream(pos.x,pos.z,2,4);$('seed').textContent=String(this.world.seed);this.status('Entered '+name)}
 blast(){const p=this.player,d=p.direction(),hit=raycast(this.world,{x:p.x,y:p.y+p.eye,z:p.z},d,7);if(hit){const x=hit.x+.5,y=hit.y+.5,z=hit.z+.5;explode(this.world,this.entities.entities,this.effects,x,y,z,3);this.status('Blast!')}}
 spawnMob(type='sheep'){const p=this.player,d=p.direction(),x=Math.floor(p.x+d.x*5),z=Math.floor(p.z+d.z*5);for(let y=55;y>0;y--){if(this.world.get(x,y,z)===B.AIR&&this.world.get(x,y-1,z)!==B.AIR){this.entities.spawn(type,x+.5,y,z+.5);this.status('Mob spawned');break}}}
 interaction(dt,input){this.interactTimer-=dt;const p=this.player,d=p.direction(),origin={x:p.x,y:p.y+p.eye,z:p.z};this.target=raycast(this.world,origin,d,6);
 if(this.interactTimer>0)return;
 if(input.mine){const entity=this.entities.attack(p,3.4);if(entity){this.effects.burst(entity.x,entity.y+1,entity.z,'#f15d59',9);this.interactTimer=.32;return}const waterTarget=raycast(this.world,origin,d,6,{hitWater:true});const t=waterTarget||this.target;if(t&&t.id!==B.BEDROCK){this.world.set(t.x,t.y,t.z,B.AIR);this.effects.burst(t.x+.5,t.y+.5,t.z+.5,block(t.id).color,16);this.interactTimer=.18}}
 else if(input.place&&this.target){const t=this.target,x=t.x+t.normal.x,y=t.y+t.normal.y,z=t.z+t.normal.z,id=this.paletteItems[this.selected],old=this.world.get(x,y,z);if(block(old).replaceable){this.world.set(x,y,z,id);if(collides(this.world,p.x,p.y,p.z,p.width,p.height)){this.world.set(x,y,z,old)}else{this.effects.burst(x+.5,y+.5,z+.5,block(id).color,5)}this.interactTimer=.18}}}
 tick(dt){this.portalCooldown=Math.max(0,this.portalCooldown-dt);const p=this.player,input=this.input.read();p.update(this.world,dt,input);if(this.portalCooldown===0&&(this.world.get(p.x,p.y+.4,p.z)===B.PORTAL||this.world.get(p.x,p.y+1.1,p.z)===B.PORTAL)){const names=[...this.manager.worlds.keys()];this.travel(names[(names.indexOf(this.world.name)+1)%names.length]);this.portalCooldown=2;}this.world.tick();this.entities.tick(dt,p);this.effects.tick(dt);this.interaction(dt,input);if(p.dead){p.hp=20;p.dead=false;Object.assign(p,this.world.spawn(),{vx:0,vy:0,vz:0,visualStepOffset:0});this.status('Respawned')}}
 frame(time){const elapsed=time-this.last,dt=Math.min(Math.max(elapsed/1000,0),.06);this.last=time;this.lastFrameMs=elapsed;const [mx,my]=this.input.consumeLook();if(this.panel==='inventory'){if(this.input.locked)this.hologram.move(mx,my)}else if(!this.uiOpen){applyCameraLook(this.player,mx,my)}this.acc+=dt;let n=0;while(this.acc>=1/60&&n++<5){this.tick(1/60);this.acc-=1/60}this.frameCount++;this.renderer.observeFrame(elapsed);if(this.frameCount%3===0)this.world.stream(this.player.x,this.player.z,3,2);this.renderer.sync(this.world,this.player);this.renderer.frame(this.world,this.player,this.entities.entities,this.effects,dt);if(time-this.lastHud>150){this.hud();this.lastHud=time}requestAnimationFrame(t=>this.frame(t))}
 hud(){const p=this.player;$('coords').textContent=`${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`;$('biome').textContent=`${this.world.name} · ${this.world.mode.toUpperCase()}`;$('fps').textContent=`${Math.round(1000/Math.max(1,this.lastFrameMs))} FPS · ${this.world.chunks.size} loaded / ${this.renderer.lastDrawnChunks} drawn · ${this.entities.entities.length} mobs`;$('target').textContent=this.target?'조준: '+block(this.target.id).name+' · 우클릭 / R 설치':'기존 블록을 조준하세요';$('health').textContent='♥'.repeat(Math.ceil(p.hp/2))+'♡'.repeat(10-Math.ceil(p.hp/2));$('flight').textContent=p.fly?'FLYING':'SURVIVAL PHYSICS'}
}
try{new Game()}catch(err){console.error(err);$('fatal').textContent='Cannot start: '+err.message;$('fatal').hidden=false}
