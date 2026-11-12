import {WorldManager} from '../core/world.js?v=1.1.0';import {Player,EntityManager} from '../entities/entities.js?v=1.1.0';import {Effects} from '../core/effects.js';import {raycast,collides} from '../core/physics.js?v=1.1.0';import {block,blockLabel,BLOCK as B,HOTBAR,LIGHTBAR} from '../core/blocks.js?v=1.1.0';import {Renderer} from './renderer.js?v=1.1.0';import {applyCameraLook} from './camera.js?v=1.1.0';import {Hologram} from './hologram.js?v=1.1.0';import {Input} from './input.js?v=1.2.0';import {clamp} from '../util/math.js';import {explode} from '../core/systems.js';import {MiningProgress} from '../core/mining.js?v=1.1.0';
import {registerPWA} from './pwa.js';
import {screenRay,canvasPoint} from './picking.js';
const $=id=>document.getElementById(id);
// Optional buttons can be absent when the page and module use different CDN cache versions.
const bindClick=(id,handler)=>{const el=$(id);if(el)el.addEventListener('click',handler);else console.warn(`[MakTwo] Missing optional UI button #${id}`)};
class Game{
 constructor(){this.canvas=$('screen');this.renderer=new Renderer(this.canvas);this.hologram=new Hologram(this.renderer.gl);this.renderer.hologram=this.hologram;this.input=new Input(this.canvas);this.manager=new WorldManager(localStorage);this.world=this.manager.add('Overworld',17331,'normal');this.manager.add('Flatlands',9901,'flat');this.manager.add('Islands',45716,'islands');this.player=new Player(...Object.values(this.world.spawn()));this.entities=new EntityManager(this.world);this.effects=new Effects();this.last=performance.now();this.acc=0;this.interactTimer=0;this.placeLatch=false;this.mining=new MiningProgress();this.frameCount=0;this.lastHud=0;this.portalCooldown=0;this.lastFrameMs=16;this.target=null;this.selected=-1;this.palette='blocks';this.menuOpen=false;this.helpOpen=false;this.panel=null;this.bindUI();this.world.stream(this.player.x,this.player.z,2,4);this.world.events.on('block-change',e=>{});this.status('영원한 밤 · L 조명 도구 · WASD 이동');this.scheduleFrame()}
 get paletteItems(){return this.palette==='lights'?LIGHTBAR:HOTBAR}
 renderHotbar(){const bar=$('hotbar');bar.replaceChildren();for(let i=0;i<this.paletteItems.length;i++){
  const id=this.paletteItems[i],el=document.createElement('button');el.className='slot';
  const num=document.createElement('span');num.className='slot-number';num.textContent=String((i+1)%10);
  const tile=document.createElement('span');tile.className='voxel';tile.style.setProperty('--tile',block(id).color);
  el.append(num,tile);el.title=`${blockLabel(id)} · ${i+1}`;el.setAttribute('aria-label',`${i+1}번 ${blockLabel(id)} 선택`);el.onclick=()=>this.select(i);bar.append(el);
 }this.select(Math.min(this.selected,this.paletteItems.length-1),{toggle:false});
 const paletteToggle=$('palette-toggle');if(paletteToggle){paletteToggle.innerHTML=this.palette==='lights'?'<span class="dock-icon" aria-hidden="true">▥</span><span>블록</span>':'<span class="dock-icon" aria-hidden="true">✧</span><span>조명</span>';paletteToggle.title='블록/조명 도구 전환 · L'}
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
  this.input.setUiMode(this.uiOpen&&this.panel!=='inventory');this.input.setInventoryMode(this.panel==='inventory');this.placeLatch=false;this.mining.reset();this.showMining(0);
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
  this.updateControlHint();
 }
 togglePanel(name){if(this.panel===name)this.requestGameFocus();else this.setPanel(name)}
 toggleMenu(){this.togglePanel('settings')}
 togglePalette(){
  this.palette=this.palette==='lights'?'blocks':'lights';this.selected=-1;
  this.renderHotbar();if(this.panel==='inventory')this.updateHologram();
  this.status(this.palette==='lights'?'조명 도구 · 1 횃불  2 랜턴  3 모닥불':'건축 블록');
 }
 updateHologram(){this.hologram.setInventory(this.palette,this.paletteItems.map(id=>({...block(id),name:blockLabel(id)})),this.selected)}
 inventoryClick(hit=this.hologram.click()){
  if(!hit)return;
  if(hit==='close'){this.requestGameFocus();return}
  if(hit==='hand'){this.select(-1,{toggle:false});this.requestGameFocus();return}
  if(hit.startsWith('tab:')){
   const palette=hit.slice(4);if(palette!==this.palette)this.togglePalette();return;
  }
  if(hit.startsWith('item:')){
   const index=Number(hit.slice(5));if(index>=0&&index<this.paletteItems.length){this.select(index,{toggle:false});this.requestGameFocus()}
  }
 }
 updateControlHint(){
  this.updateCameraButton();const el=$('control-hint');if(!el)return;
  el.classList.toggle('ui-active',this.uiOpen);
  el.textContent=this.panel==='inventory'?'가방을 보며 이동 가능 · 카드 선택 후 E 닫기':
   this.uiOpen?'메뉴 조작 · E 가방 · M 설정 · 돌아가기로 복귀':
   this.selected<0?'길게 클릭해 채굴 · 우클릭 드래그 또는 C 시점 고정 · E 가방':
   '클릭 설치 · 길게 누르면 채굴 · 우클릭 드래그 / C 시점 고정 · E 가방';
 }
 updateCameraButton(){const btn=$('camera-btn');if(!btn)return;const locked=Boolean(this.input?.locked);btn.setAttribute('aria-pressed',String(locked));btn.innerHTML=locked?'시점 고정 <kbd>C</kbd>':'자유 커서 <kbd>C</kbd>';}
 toggleCameraMode(){this.input.toggleCameraMode();this.updateCameraButton()}
 showMining(ratio){const el=$('mine-progress');if(!el)return;el.style.setProperty('--progress',`${Math.round(ratio*100)}%`);el.classList.toggle('active',ratio>0)}

 bindUI(){
  this.renderHotbar();this.updateControlHint();
  bindClick('palette-toggle',()=>this.togglePalette());
  bindClick('menu-btn',()=>this.toggleMenu());
  bindClick('camera-btn',()=>this.toggleCameraMode());
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
  this.canvas.addEventListener('mousedown',event=>{if(this.panel==='inventory'){if(event.button===0){event.preventDefault();const rect=this.canvas.getBoundingClientRect();const hit=this.hologram.pickAt(this.player,event.clientX,event.clientY,rect,{center:this.input.locked});this.inventoryClick(hit)}return}if(this.uiOpen)this.requestGameFocus()});
  document.addEventListener('pointerlockchange',()=>{
   // Esc may release pointer lock. Do not automatically spawn a menu over the scene.
   if(this.input.locked)this.hologram.pointer=null;
   this.updateControlHint();this.updateCameraButton();
  });
  this.canvas.addEventListener('pointermove',event=>{
   if(event.pointerType==='mouse'&&!this.uiOpen){const pos=canvasPoint(event,this.canvas);for(const id of ['crosshair','target','mine-progress']){const el=$(id);if(el){el.style.left=pos.x+'px';if(id==='crosshair')el.style.top=pos.y+'px';else el.style.top=(pos.y+(id==='target'?18:27))+'px'}}}
   if(this.panel==='inventory'&&!this.input.locked&&event.pointerType==='mouse'){this.hologram.point(event.clientX,event.clientY,this.canvas.getBoundingClientRect());this.hologram.aim(this.player)}
  });
  // A right-side *tap* selects an inventory card. Dragging either zone keeps
  // movement/camera working; selection must not happen on touch-down.
  this.canvas.addEventListener('pointerup',event=>{
   if(this.panel!=='inventory'||(event.pointerType!=='touch'&&event.pointerType!=='pen'))return;
   const tap=this.input.gestures.consumeTapPoint();this.input.gestures.consumeTaps();
   if(!tap)return;
   event.preventDefault();const hit=this.hologram.pickAt(this.player,tap.x,tap.y,this.canvas.getBoundingClientRect());this.inventoryClick(hit);this.hologram.pointer=null;
  });
  this.canvas.addEventListener('wheel',e=>{
   e.preventDefault();if(this.panel==='inventory')return;if(this.uiOpen)return;
   this.select((this.selected+(e.deltaY>0?1:-1)+this.paletteItems.length)%this.paletteItems.length,{toggle:false});
  },{passive:false});
  document.addEventListener('keydown',e=>{
   if(e.repeat||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   if(e.code==='KeyE'||e.code==='KeyI'){e.preventDefault();this.togglePanel('inventory');return}
   if(e.code==='KeyM'){e.preventDefault();this.togglePanel('settings');return}
   if(e.code==='KeyC'&&!this.menuOpen&&!this.helpOpen){e.preventDefault();this.toggleCameraMode();return}
   if(e.code==='KeyH'){e.preventDefault();this.togglePanel('help');return}
   if(e.code==='Escape'){
    if(this.uiOpen){e.preventDefault();this.setPanel(null)}
    // Browser owns Escape while pointer-locked. No extra UI is opened.
    return;
   }
   if(this.panel==='inventory'){
    if(e.code==='KeyL'){this.togglePalette();return}
    if(e.code==='KeyQ'){this.select(-1,{toggle:false});this.requestGameFocus();return}
    if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5)),index=n===0?9:n-1;if(index>=0&&index<this.paletteItems.length){this.select(index,{toggle:false});this.requestGameFocus()}return}
   }
   if(this.uiOpen)return;
   const i=+e.key;
   if(e.code.startsWith('Digit')&&i>=0&&i<=9){const index=i===0?9:i-1;if(index<this.paletteItems.length)this.select(index)}
   if(e.code==='KeyL')this.togglePalette();
   if(e.code==='KeyQ'){this.select(-1,{toggle:false});return}
   if(e.code==='KeyF')$('mode')?.click();
   if(e.code==='KeyG')this.spawnMob(e.shiftKey?'zombie':'sheep');
   if(e.code==='KeyB')this.blast();
   if(e.code==='KeyP')this.world.save();
  });
  window.addEventListener('beforeunload',()=>this.world.save());
 }
 select(i,{toggle=true}={}){
  if(i!==-1&&(i<0||i>=this.paletteItems.length))return;
  this.selected=toggle&&this.selected===i?-1:i;
  this.mining.reset();this.showMining(0);
  document.querySelectorAll('.slot').forEach((el,j)=>{el.classList.toggle('active',j===this.selected);el.setAttribute('aria-pressed',String(j===this.selected))});
  $('block-name').textContent=this.selected<0?'맨손 · 누르고 채굴':blockLabel(this.paletteItems[this.selected]);
  this.updateControlHint();if(this.panel==='inventory')this.updateHologram();
 }

 status(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100)}
 travel(name){this.manager.active.save();this.world=this.manager.travel(name);this.entities=new EntityManager(this.world);this.effects=new Effects();const pos=this.world.spawn();Object.assign(this.player,pos,{vx:0,vy:0,vz:0,visualStepOffset:0});this.mining.reset();this.showMining(0);this.renderer.resetWorld(this.world);this.world.stream(pos.x,pos.z,2,4);$('seed').textContent=String(this.world.seed);this.status('월드 이동: '+({'Overworld':'끝나지 않는 밤','Flatlands':'평지','Islands':'섬'}[name]||name))}
 blast(){const p=this.player,d=p.direction(),hit=raycast(this.world,{x:p.x,y:p.y+p.eye,z:p.z},d,7);if(hit){const x=hit.x+.5,y=hit.y+.5,z=hit.z+.5;explode(this.world,this.entities.entities,this.effects,x,y,z,3);this.status('폭발')}}
 spawnMob(type='sheep'){const p=this.player,d=p.direction(),x=Math.floor(p.x+d.x*5),z=Math.floor(p.z+d.z*5);for(let y=55;y>0;y--){if(this.world.get(x,y,z)===B.AIR&&this.world.get(x,y-1,z)!==B.AIR){this.entities.spawn(type,x+.5,y,z+.5);this.status('동물이 나타났어요');break}}}
 interaction(dt,input){
  if(this.uiOpen){this.target=null;this.mining.reset();this.showMining(0);return}
  this.interactTimer=Math.max(0,this.interactTimer-dt);
  const p=this.player,d=p.direction(),origin={x:p.x,y:p.y+p.eye,z:p.z};
  const miningMode=input.mine;
  const aim=input.aim||(this.input.locked?null:this.input.canvasCursor());
  const ray=aim?screenRay(p,aim.x,aim.y,this.canvas.clientWidth,this.canvas.clientHeight):d;
  this.target=raycast(this.world,origin,ray,7.5,{hitWater:miningMode,hitDecor:miningMode});
  if(input.use&&this.target&&(this.target.id===B.DOOR||this.target.id===B.DOOR_TOP)){
   if(this.world.toggleDoor(this.target.x,this.target.y,this.target.z))this.status(this.world.getDoorState(this.target.x,this.target.y,this.target.z).open?'문을 열었어요':'문을 닫았어요');
   this.interactTimer=.18;this.mining.reset();this.showMining(0);return;
  }
  const placing=(this.selected>=0&&input.use);
  if(!placing)this.placeLatch=false;
  if(placing&&this.selected>=0){
   this.mining.reset();this.showMining(0);
   if(this.interactTimer>0||!this.target)return;
   this.placeLatch=true;
   const t=this.target,x=t.x+t.normal.x,y=t.y+t.normal.y,z=t.z+t.normal.z;
   const id=this.paletteItems[this.selected],old=this.world.get(x,y,z);
   if(block(old).replaceable){
    if(id===B.DOOR){
     const facing=((Math.round(p.yaw/(Math.PI/2))%4)+4)%4,upperOld=this.world.get(x,y+1,z);
     if(this.world.placeDoor(x,y,z,facing)){
      if(collides(this.world,p.x,p.y,p.z,p.width,p.height)){this.world.removeDoor(x,y,z);if(old!==B.AIR)this.world.set(x,y,z,old);if(upperOld!==B.AIR)this.world.set(x,y+1,z,upperOld)}
      else this.status('나무 문 설치 · 클릭해서 열고 닫기');
     }else this.status('문은 위로 두 칸의 공간이 필요해요');
    }else{
     this.world.set(x,y,z,id);
     if(collides(this.world,p.x,p.y,p.z,p.width,p.height))this.world.set(x,y,z,old);
     else this.effects.burst(x+.5,y+.5,z+.5,block(id).color,5);
    }
    this.interactTimer=.20;
   }
   return;
  }
  if(!miningMode){this.mining.reset();this.showMining(0);return}
  if(this.interactTimer<=0&&this.selected<0&&this.entities.attack(p,3.4)){
   this.interactTimer=.40;this.mining.reset();this.showMining(0);return;
  }
  const target=this.target&&this.target.id!==B.BEDROCK?this.target:null;
  const result=this.mining.update(target,true,dt);this.showMining(result.ratio);
  if(result.completed&&target){
   if(this.world.get(target.x,target.y,target.z)===target.id){
    if(target.id===B.DOOR||target.id===B.DOOR_TOP)this.world.removeDoor(target.x,target.y,target.z);
    else this.world.set(target.x,target.y,target.z,B.AIR);
    this.effects.burst(target.x+.5,target.y+.5,target.z+.5,block(target.id).color,12);
   }
   this.interactTimer=.12;this.showMining(0);
  }
 }

 tick(dt){this.portalCooldown=Math.max(0,this.portalCooldown-dt);const p=this.player,input=this.input.read();p.update(this.world,dt,input);if(this.portalCooldown===0&&(this.world.get(p.x,p.y+.4,p.z)===B.PORTAL||this.world.get(p.x,p.y+1.1,p.z)===B.PORTAL)){const names=[...this.manager.worlds.keys()];this.travel(names[(names.indexOf(this.world.name)+1)%names.length]);this.portalCooldown=2;}this.world.tick();this.entities.tick(dt,p);this.effects.tick(dt);this.interaction(dt,input);if(p.dead){p.hp=20;p.dead=false;Object.assign(p,this.world.spawn(),{vx:0,vy:0,vz:0,visualStepOffset:0});this.status('시작 지점으로 돌아왔어요')}}
 frame(time){const elapsed=time-this.last,dt=Math.min(Math.max(elapsed/1000,0),.06);this.last=time;this.lastFrameMs=elapsed;const [mx,my]=this.input.consumeLook();if(this.panel==='inventory'||!this.uiOpen)applyCameraLook(this.player,mx,my);if(this.panel==='inventory'){this.hologram.facePlayer(this.player);if(this.input.gestures.right!==null)this.hologram.pointer=null;this.hologram.aim(this.player)};this.acc+=dt;let n=0;while(this.acc>=1/60&&n++<5){this.tick(1/60);this.acc-=1/60}this.frameCount++;this.renderer.observeFrame(elapsed);if(this.frameCount%3===0)this.world.stream(this.player.x,this.player.z,3,2,{roundEdges:true});this.renderer.sync(this.world,this.player);this.renderer.frame(this.world,this.player,this.entities.entities,this.effects,dt);if(time-this.lastHud>150){this.hud();this.lastHud=time}this.scheduleFrame()}
 scheduleFrame(){requestAnimationFrame(t=>{try{this.frame(t)}catch(error){console.error('[MakTwo] Frame error',error);const el=$('fatal');if(el){el.textContent='화면 오류: '+String(error?.message||error)+' · 새로고침 후에도 반복되면 이 문구를 알려주세요';el.hidden=false}}})}
 hud(){const p=this.player;$('coords').textContent=`${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`;$('biome').textContent=`${({'Overworld':'영원한 밤','Flatlands':'평지','Islands':'섬'}[this.world.name]||this.world.name)} · ${({'normal':'자연 지형','flat':'평탄한 지형','islands':'섬 지형'}[this.world.mode]||this.world.mode)}`;$('fps').textContent=`${Math.round(1000/Math.max(1,this.lastFrameMs))} FPS · ${this.world.chunks.size} 청크 / ${this.renderer.lastDrawnChunks} 렌더 · 동물 ${this.entities.entities.length}`;$('target').textContent=this.target?`조준: ${blockLabel(this.target.id)} · 탭 설치 / 길게 채굴`:this.selected<0?'맨손 · 길게 눌러 채굴':'클릭한 곳에 설치';$('health').textContent='♥'.repeat(Math.ceil(p.hp/2))+'♡'.repeat(10-Math.ceil(p.hp/2));$('flight').textContent=p.fly?'비행 중':'걷는 중'}
}
try{new Game()}catch(err){console.error(err);$('fatal').textContent='Cannot start: '+err.message;$('fatal').hidden=false}
registerPWA();
