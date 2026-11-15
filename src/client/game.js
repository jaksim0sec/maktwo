import {Combat,weapons} from '../core/combat.js';
import {WorldManager} from '../core/world.js';
import {loadWorldSlots,addWorldSlot,deleteWorldSlot,ACTIVE_WORLD_KEY,savePlayerState,loadPlayerState} from '../core/world-slots.js';import {Player,EntityManager} from '../entities/entities.js';import {Effects} from '../core/effects.js';import {raycast,collides} from '../core/physics.js';import {block,blockLabel,BLOCK as B,isBed,isBedFoot,isContainer,bedDirection,itemId} from '../core/blocks.js';import {Renderer} from './renderer.js';import {applyCameraLook,cameraEyeY,FOV_TAN} from './camera.js';import {Hologram} from './hologram.js';import {Input} from './input.js';import {MiningProgress} from '../core/mining.js';
import {SurvivalInventory,CreativeInventory,MAX_STACK,harvestDrop} from '../core/inventory.js';
import {itemIconURL} from './item-icons.js';
import {registerPWA} from './pwa.js';
import {WORLD_PRESETS,PALETTES,CREATIVE_ITEMS,paletteItems,worldLabel} from '../core/catalog.js';
import {PART_FAMILIES,partById} from '../core/part-library.js';
import {partGallerySpawn} from '../worldgen/part-gallery.js';
import {canyonCore} from '../worldgen/canyon-v2-core.js';
import {CANYON_MODE} from '../worldgen/canyon-v2-plan.js';
import {CITY_MODE,createCityPlan} from '../worldgen/eternal-night-game.js';
import {screenRay} from './picking.js';
import {FORMS,buildType,placementRotation,orientedForm} from '../core/construction.js';
import {isWallItem} from '../core/mounts.js';
import {solidBlockOverlap,isSlab,isStairs} from '../core/shapes.js';
const $=id=>document.getElementById(id);
const storedPercent=(key,fallback)=>{const value=Number(localStorage.getItem(key)??fallback);return Number.isFinite(value)?Math.max(0,Math.min(100,value)):fallback};
// Optional buttons can be absent when the page and module use different CDN cache versions.
const bindClick=(id,handler)=>{const el=$(id);if(el)el.addEventListener('click',handler);else console.warn(`[MakTwo] Missing optional UI button #${id}`)};
class Game{
 constructor(){this.canvas=$('screen');this.renderer=new Renderer(this.canvas);this.hologram=new Hologram(this.renderer.gl);this.renderer.hologram=this.hologram;this.input=new Input(this.canvas);this.manager=new WorldManager(localStorage);this.worldPresets=[...WORLD_PRESETS.filter(preset=>!preset.legacy||localStorage.getItem('mcweb:'+preset.name)),...loadWorldSlots(localStorage)];for(const preset of this.worldPresets)this.manager.add(preset.name,preset.seed,preset.mode);this.manager.active=this.manager.worlds.get(new URLSearchParams(location.search).get('world')||localStorage.getItem(ACTIVE_WORLD_KEY))||this.manager.worlds.get('EternalNightCityLab')||this.manager.active;this.world=this.manager.active;this.survivalInventory=new SurvivalInventory(localStorage,this.world.name);this.inventoryPalette=null;this.craftFilter='all';this.station=null;this.visibleRecipes=[];this.visibleItems=[];this.visibleCarried=[];this.visibleStored=[];this.holoDragging=null;this.movePending=null;const start=loadPlayerState(localStorage,this.world.name,this.world.height,this.world.yOrigin)||this.world.firstSpawn();this.player=new Player(start.x,start.y,start.z);Object.assign(this.player,start);if(this.world.mode==='parts'&&start.yaw===undefined)this.player.yaw=0;this.creativeInventory=new CreativeInventory(CREATIVE_ITEMS);this.form=0;this.manualAngle=null;this.skyBrightness=0;this.inventoryPage=0;this.entities=new EntityManager(this.world);this.effects=new Effects();this.combat=new Combat();this.offWeapon=null;this.last=performance.now();this.acc=0;this.interactTimer=0;this.placeLatch=false;this.mining=new MiningProgress();this.frameCount=0;this.lastHud=0;this.portalCooldown=0;this.lastFrameMs=16;this.target=null;this.selected=-1;this.palette='blocks';this.menuOpen=false;this.helpOpen=false;this.panel=null;this.bindUI();this.world.stream(this.player.x,this.player.z,2,4);this.bindWorld();this.scheduleFrame()}
 get inventory(){return this.player.creative?this.creativeInventory:this.survivalInventory}
 applyGraphics(){
  const distance=localStorage.getItem('maktwo:render-distance')||'medium',resolution=localStorage.getItem('maktwo:render-resolution')||'medium';
  this.renderRadius={low:2,medium:3,high:4}[distance]||3;
  this.world.maxChunks={low:32,medium:56,high:96}[distance]||56;
  this.renderer.maxDistance={low:62,medium:88,high:112}[distance]||88;
  const pixelLimit={low:.75,medium:matchMedia('(pointer:coarse)').matches?1:1.2,high:1.5}[resolution]||1;
  this.renderer.maxPixelRatio=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,pixelLimit);
  const far=(localStorage.getItem('maktwo:far-silhouettes')??(new URLSearchParams(location.search).get('far')==='1'?'1':'0'))==='1';
  if(this.renderer.farEnabled!==far){this.renderer.farEnabled=far;this.renderer.resetWorld(this.world)}
 }

 bindWorld(){
  this.stopMountEvents?.();
  this.stopMountEvents=this.world.events.on('mount-detach',mount=>{
   if(!this.player.creative)this.entities.spawnDrop(mount.id,mount.x,mount.y,mount.z);
  });
 }
 toggleCreative(){
  const p=this.player;
  this.survivalInventory.save();
  p.creative=!p.creative;
  if(!p.creative){p.fly=false;p.vy=0;}
  this.selected=-1;this.inventoryPage=0;
  this.renderHotbar();this.updateModeControls();
 }
 toggleFlight(){
  if(!this.player.creative)return;
  this.player.fly=!this.player.fly;this.player.vy=0;
  this.updateModeControls();
 }
 updateModeControls(){
  const p=this.player,mode=$('mode'),flight=$('flight-toggle'),sky=$('sky-brightness-setting');
  if(sky)sky.hidden=!p.creative;
  const citySky=$('city-sky-setting');if(citySky)citySky.hidden=this.world.mode!==CITY_MODE&&this.world.mode!==CANYON_MODE;
  this.renderer.skyBrightness=p.creative?this.skyBrightness:0;
  mode.textContent=p.creative?'모드 · 크리에이티브':'모드 · 서바이벌';
  mode.setAttribute('aria-pressed',String(p.creative));
  if(flight){
   flight.hidden=!p.creative;
   flight.textContent=p.fly?'비행 끄기 · F':'비행 켜기 · F';
   flight.setAttribute('aria-pressed',String(p.fly));
  }
 }
 updateFormControls(){
  const id=this.paletteItems[this.selected],shape=$('build-form'),rotate=$('build-rotate');
  if(!shape||!rotate)return;
  const {forms}=buildType(id),{step}=placementRotation(id,this.form);
  shape.hidden=!forms;
  shape.textContent=FORMS[this.form];
  rotate.hidden=!step;
  const auto=id===B.DOOR||isStairs(id)||Boolean(partById(id));
  rotate.textContent=auto&&this.manualAngle===null?'회전 · 자동':`회전 · ${this.placementAngle(id)}°`;
 }
 placementAngle(id){
  const {step,offset}=placementRotation(id,this.form);
  if(!step)return 0;
  const automatic=id===B.DOOR||isStairs(id)||partById(id)?this.player.yaw*180/Math.PI:offset;
  const angle=(this.manualAngle??automatic)%360;
  return (Math.round((angle-offset)/step)*step+offset+360)%360;
 }
 changeForm(){
  if(!buildType(this.paletteItems[this.selected]).forms)return;
  this.form=(this.form+1)%FORMS.length;this.updateFormControls();
 }
 rotateForm(){
  const id=this.paletteItems[this.selected],{step}=placementRotation(id,this.form);
  if(!step)return;
  this.manualAngle=(this.placementAngle(id)+step)%360;
  this.updateFormControls();
 }
 get paletteItems(){return this.inventory.quickSlots}
 renderHotbar(){
  const bar=$('hotbar');bar.replaceChildren();for(let i=0;i<7;i++){
   const id=this.inventory.quickSlots[i];
   // Empty or depleted slots have no button and occupy no space.
   if(id===null||this.inventory.count(id)<=0)continue;
   const el=document.createElement('button');el.className='slot';el.dataset.block=String(id);el.dataset.slot=String(i);
   const num=document.createElement('span');num.className='slot-number';num.textContent=String(i+1);
   el.append(num);
   if(id!==null&&this.inventory.count(id)>0){const image=document.createElement('img');image.className='item-icon';image.alt='';image.src=itemIconURL(id);el.append(image)}
   const count=document.createElement('span');count.className='slot-count';el.append(count);
   el.title=id===null?'빈 칸':blockLabel(id);el.setAttribute('aria-label',`${i+1}번 ${id===null?'빈 칸':blockLabel(id)}`);
   el.onclick=()=>this.select(i);bar.append(el);
  }
  if(this.selected>=0&&(this.paletteItems[this.selected]===null||this.inventory.count(this.paletteItems[this.selected])<=0))this.selected=-1;
  this.select(this.selected,{toggle:false});this.refreshInventoryUI();

 }
 refreshInventoryUI(){
  const expected=this.inventory.quickSlots.map((id,i)=>id!==null&&this.inventory.count(id)>0?i:-1).filter(i=>i!==-1);
  const visible=[...$('hotbar').querySelectorAll('.slot')];
  if(expected.length!==visible.length||expected.some((i,j)=>Number(visible[j].dataset.slot)!==i)){
   this.renderHotbar();return;
  }
  for(const el of visible){
   const id=Number(el.dataset.block),n=this.inventory.count(id),count=el.querySelector('.slot-count');
   if(count)count.textContent=n===Infinity?'∞':n>1?String(n):'';
   el.title=`${blockLabel(id)} · ${n===Infinity?'무제한':n+'개'}`;
  }
  if(this.panel==='inventory')this.updateHologram();
 }

 // Inventory lives in the actual WebGL scene, not a DOM/modal overlay.
 get uiOpen(){return Boolean(this.panel)}
 setPanel(name){
  if(this.cinematic&&name!=='cinematic')return;
  const prior=this.panel;this.panel=name||null;this.holoDragging=null;this.movePending=null;
  if(this.panel)this.combat.cancel();
  if(this.panel!=='inventory')this.openContainer=null;
  if(this.panel!=='inventory'){this.inspectedItem=null;this.inventoryPalette=null;this.inventoryPage=0;this.station=null}
  this.menuOpen=this.panel==='settings';this.helpOpen=this.panel==='help';
  $('toolbar')?.classList.toggle('hidden',!this.menuOpen);
  $('help')?.classList.toggle('hidden',!this.helpOpen);
  $('menu-btn')?.setAttribute('aria-expanded',String(this.menuOpen));
  $('bag-btn')?.setAttribute('aria-expanded',String(this.panel==='inventory'));
  document.body.classList.toggle('ui-open',this.uiOpen);
  document.body.classList.toggle('holo-open',this.panel==='inventory');
  this.input.setUiMode(this.uiOpen&&this.panel!=='inventory');this.input.setInventoryMode(this.panel==='inventory');this.placeLatch=false;this.mining.reset();this.showMining(0);
  if(this.panel==='inventory'){
   if(prior!=='inventory')this.hologram.open(this.player);
   // Release the cursor for accessible card clicks; right-drag camera remains available.
   if(document.pointerLockElement===this.canvas)document.exitPointerLock?.();
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
 openCraft(){this.inspectedItem=null;if(this.panel!=='inventory')this.setPanel('inventory');this.inventoryPalette='craft';this.craftFilter='all';this.inventoryPage=0;this.updateHologram()}
 togglePalette(){this.openCraft()}
 activeStation(){
  if(this.player.creative)return 'bench';
  const s=this.station,p=this.player;if(!s||s.world!==this.world||this.world.get(s.x,s.y,s.z,false)!==B.WORKBENCH)return 'hand';
  return Math.hypot(p.x-(s.x+.5),p.y-(s.y+.5),p.z-(s.z+.5))<=5?'bench':'hand';
 }
 updateHologram(){
  if(this.inspectedItem){this.renderInspection();return}
  if(this.openContainer){this.renderContainer();return}
  const category=this.inventoryPalette||'all',station=this.activeStation(),craft=category==='craft';
  // Bag content and craft output are different views. Bench recipes remain inspectable.
  const raw=craft?[...this.inventory.knownRecipes('bench')].sort((a,b)=>Number(this.inventory.canCraft(b,station))-Number(this.inventory.canCraft(a,station))):
   category==='all'?CREATIVE_ITEMS.filter(id=>this.inventory.count(id)>0):
    paletteItems(category).filter(id=>this.inventory.count(id)>0);
  const catalog=craft?raw:this.inventory.orderedIds(raw);
  const entries=craft&&this.craftFilter==='available'?catalog.filter(recipe=>this.inventory.canCraft(recipe,station)):catalog;
  const pageSize=craft?(this.hologram.compact?6:9):(this.hologram.compact?6:12),total=Math.max(1,Math.ceil(entries.length/pageSize));
  this.inventoryPage=Math.min(total-1,Math.max(0,this.inventoryPage));
  const page=entries.slice(this.inventoryPage*pageSize,(this.inventoryPage+1)*pageSize);
  if(craft)this.visibleRecipes=page;else this.visibleItems=page;
  const items=page.map(entry=>{
   const id=craft?entry.id:entry;
   return {...block(id),name:craft?entry.label:blockLabel(id),count:this.inventory.count(id),
    ...(craft?{craftable:this.inventory.canCraft(entry,station),recipe:entry,
     missing:Object.entries(entry.needs).reduce((sum,[key,num])=>sum+Math.max(0,num-this.inventory.count(Number(key))),0)}:{})};
  });
  this.hologram.setInventory(category,items,-1,station,{index:this.inventoryPage,total},this.craftFilter,null,{
   quickSlots:this.inventory.quickSlots.map(id=>({blockId:id!==null&&this.inventory.has(id)?id:null,count:id===null?0:this.inventory.count(id)})),
   selectedId:this.movePending,moveMode:this.movePending!==null
  });
 }
 inventoryClick(hit=this.hologram.click()){
  if(!hit)return;
  if(hit==='close'){this.requestGameFocus();return}
  if(hit==='empty'||hit.startsWith('info:summary'))return;
  if(hit==='info:shortcut'&&this.inspectedItem){this.inspectAction('slots');return}
  if(hit.startsWith('quick:')){
   const index=Number(hit.slice(6)),item=this.inspectedItem;
   if(this.movePending!==null){
    if(this.inventory.moveShortcut(this.movePending,index)){this.select(index,{toggle:false});this.renderHotbar()}
    this.movePending=null;this.updateHologram();return;
   }
   if(item&&item.source!=='stored'&&item.source!=='recipe'&&this.inventory.moveShortcut(item.id,index)){
    this.select(index,{toggle:false});this.renderHotbar();this.updateHologram();
   }return;
  }
  if(hit.startsWith('inspect:')){this.inspectAction(hit.slice(8));return}
  if(this.openContainer){this.containerClick(hit);return}
  if(hit==='view:inventory'){this.movePending=null;this.inspectedItem=null;this.inventoryPalette='all';this.inventoryPage=0;this.updateHologram();return}
  if(hit==='view:craft'){this.movePending=null;this.inspectedItem=null;this.inventoryPalette='craft';this.craftFilter='all';this.inventoryPage=0;this.updateHologram();return}
  if(hit.startsWith('filter:')){this.movePending=null;this.inspectedItem=null;this.craftFilter=hit.slice(7);this.inventoryPage=0;this.updateHologram();return}
  if(hit==='hand'){this.movePending=null;this.select(-1,{toggle:false});this.requestGameFocus();return}
  if(hit.startsWith('page:')){
   this.inspectedItem=null;this.inventoryPage+=hit==='page:next'?1:-1;this.updateHologram();return;
  }
  if(hit.startsWith('tab:')){
   const category=hit.slice(4);if(category!=='all'&&!PALETTES[category])return;
   this.movePending=null;this.inspectedItem=null;this.inventoryPalette=category;this.inventoryPage=0;this.updateHologram();return;
  }
  if(hit.startsWith('item:')){
   const index=Number(hit.slice(5));
   const recipe=this.inventoryPalette==='craft'?this.visibleRecipes[index]:null;
   const id=recipe?.id??this.visibleItems[index];
   if(this.movePending!==null&&id!==undefined){
    if(!this.inventory.reorder(this.movePending,id))this.status('아이템 순서를 변경하지 못했어요');
    this.movePending=null;this.updateHologram();return;
   }
   if(id!==undefined)this.inspectItem(id,recipe?'recipe':'bag',recipe);
  }
 }
 inspectItem(id,source,recipe=null){
  this.inspectedItem={id,source,recipe,step:'details',amount:1};
  this.updateHologram();
 }
 renderInspection(){
  const item=this.inspectedItem,{id,source,recipe,step}=item;
  const inventory=this.inventory,definition=block(id),part=partById(id);
  const stored=source==='stored',deposit=source==='carried',container=stored||deposit;
  const count=container?(stored?this.survivalInventory.containers.get(this.openContainer.key)?.get(id):this.survivalInventory.count(id))||0:inventory.count(id);
  if(!recipe&&!count){this.inspectedItem=null;this.updateHologram();return}
  if(step==='quantity')item.amount=Math.max(1,Math.min(item.amount,this.inspectionLimit(item)));
  const actions=recipe?[['craft',inventory.canCraft(recipe,this.activeStation())?'제작하기':'제작 조건 확인']]:
   container?[['quantity',stored?'꺼내기':'넣기']]:[['slots','빠른 슬롯'],['move','슬롯 이동'],...(!this.player.creative?[['quantity','버리기']]:[])];
  const description=weapons[id]?'손에 장착해 공격에 사용':isContainer(id)?'아이템을 넣고 꺼낼 수 있는 수납품':
   isBed(id)?'휴식과 부활 지점 저장':definition.light?'주변을 밝히는 광원':
   part?(PART_FAMILIES.find(f=>f.key===part.family)?.label||'건축 부품'):definition.solid?'설치할 수 있는 건축재':'설치하거나 제작에 쓰는 아이템';
  const ingredients=recipe?Object.entries(recipe.needs).map(([key,n])=>`${blockLabel(Number(key))} ${inventory.count(Number(key))}/${n}`):[];
  const info=recipe?`제작 결과 ${recipe.count}개 · ${recipe.station==='bench'?'작업대':'맨손'}`:
   `${count===Infinity?'무제한':count+'개'} · ${description}`;
  const note=recipe?ingredients.join('  /  '):step==='slots'?'옮길 슬롯을 고르세요':step==='quantity'?'수량을 고른 후 확정하세요':
   source==='bag'?'빠른 슬롯에 배치하거나 바닥에 버릴 수 있어요':null;
  this.hologram.setInventory('inspection',[],-1,this.activeStation(),null,'all',{
   name:recipe?.label??blockLabel(id),blockId:id,info,note,step,actions,amount:item.amount,
   slots:inventory.quickSlots.map(slot=>({blockId:slot!==null&&inventory.has(slot)?slot:null})),
   confirm:`${item.amount}개 ${stored?'꺼내기':deposit?'넣기':'버리기'}`
  });
 }
 inspectionLimit({id,source}){
  const carried=this.survivalInventory.count(id);
  const inStorage=this.openContainer?this.survivalInventory.containers.get(this.openContainer.key)?.get(id)||0:0;
  return source==='stored'?Math.min(inStorage,MAX_STACK-carried):
   source==='carried'?Math.min(carried,MAX_STACK-inStorage):carried;
 }
 inspectAction(action){
  const item=this.inspectedItem;
  if(!item)return;
  const {id,source,recipe,step}=item;
  if(action==='back'){
   if(step==='details')this.inspectedItem=null;else item.step='details';
   this.updateHologram();return;
  }
  if(this.openContainer&&!this.containerInReach()){this.requestGameFocus();return}
  const stored=source==='stored',deposit=source==='carried',inventory=this.inventory;
  if(action==='move'&&source==='bag'){
   this.movePending=id;this.inspectedItem=null;this.updateHologram();return;
  }
  if(action==='slots'||action==='quantity'){item.step=action;item.amount=1}
  else if(action.startsWith('slot:')&&step==='slots'){
   const index=Number(action.slice(5));
   if(!inventory.moveShortcut(id,index)){this.status('슬롯을 변경하지 못했어요');return}
   item.step='details';this.select(index,{toggle:false});this.renderHotbar();
  }else if(action==='craft'&&recipe){
   if(!inventory.craft(recipe,this.activeStation())){this.status('제작 재료와 작업대 조건을 확인하세요');return}
   inventory.assignQuickSlot(id);
   this.renderHotbar();this.status(`${recipe.label} 제작 완료`);
  }else if(step==='quantity'){
   const count=this.inspectionLimit(item);
   if(count<1){this.status('옮길 공간이 없어요');return}
   if(action==='confirm'){
    if(item.amount>count){this.updateHologram();this.status('가능한 수량을 다시 확인하세요');return}
    const ok=stored||deposit?this.survivalInventory.transfer(this.openContainer.key,id,deposit,item.amount):
     this.dropCarried(id,item.amount);
    if(!ok){this.status('공간 또는 수량을 확인하세요');return}
    this.inspectedItem=null;this.renderHotbar();
   }else if(action==='all'||action==='minus'||action==='plus'){
    item.amount=action==='all'?count:Math.max(1,Math.min(count,item.amount+(action==='plus'?1:-1)));
   }else return;
  }
  this.updateHologram();
 }
 dropCarried(id,count){
  if(this.player.creative||id==null||!this.survivalInventory.discard(id,count))return false;
  const p=this.player,dx=-Math.sin(p.yaw),dz=-Math.cos(p.yaw);
  this.entities.spawnDrop(id,p.x,p.y+.8,p.z,count,{vx:dx*2.6,vy:2,vz:dz*2.6,pickupDelay:1.15});
  return true;
 }

 updateControlHint(){
  this.updateCameraButton();const el=$('control-hint');if(!el)return;
  el.classList.toggle('ui-active',this.uiOpen);
  el.textContent=this.panel==='inventory'?'창 안 터치 · 드래그 이동 / 창 밖 드래그 시점 회전 · E 닫기':
   this.uiOpen?'메뉴 조작 · E 가방 · M 설정 · 돌아가기로 복귀':
   this.selected<0?'길게 클릭해 채굴 · 우클릭 드래그 또는 C 시점 고정 · E 가방':
   '클릭 설치 · 길게 누르면 채굴 · 우클릭 드래그 / C 시점 고정 · E 가방';
 }
 updateCameraButton(){const btn=$('camera-btn');if(!btn)return;const locked=Boolean(this.input?.locked);btn.setAttribute('aria-pressed',String(locked));btn.innerHTML=locked?'시점 고정 <kbd>C</kbd>':'자유 커서 <kbd>C</kbd>';}
 toggleCameraMode(){this.input.toggleCameraMode();this.updateCameraButton()}
 showMining(ratio){const el=$('mine-progress');if(!el)return;el.style.setProperty('--progress',`${Math.round(ratio*100)}%`);el.classList.toggle('active',ratio>0)}

 bindUI(){
  this.renderHotbar();this.updateControlHint();
  // A gesture is owned by the 3D workspace where it begins, not by screen half
  // or a double-tap timer. Other pointers still rotate the free camera.
  this.input.hologramOwnsPointer=event=>this.panel==='inventory'&&
   this.hologram.containsAt(this.player,event.clientX,event.clientY,this.canvas.getBoundingClientRect());
  this.input.hologramPointerDown=event=>{
   if(!this.input.hologramOwnsPointer(event))return false;
   if(!this.holoDragging){
    const hit=this.hologram.pickAt(this.player,event.clientX,event.clientY,this.canvas.getBoundingClientRect());
    this.holoDragging={pointerId:event.pointerId,source:hit,startX:event.clientX,startY:event.clientY,moved:false};
   }
   return true;
  };
  this.input.hologramPointerMove=event=>{
   const drag=this.holoDragging;if(!drag||drag.pointerId!==event.pointerId)return;
   if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>12)drag.moved=true;
   if(!drag.moved||!drag.source?.startsWith('item:'))return;
   const target=this.hologram.pickAt(this.player,event.clientX,event.clientY,this.canvas.getBoundingClientRect());
   this.hologram.dragSource=drag.source;
   this.hologram.dragTarget=target;
  };
  this.input.hologramPointerUp=(event,cancel)=>{
   const drag=this.holoDragging;
   if(!drag||drag.pointerId!==event.pointerId)return;
   this.holoDragging=null;this.hologram.dragSource=null;this.hologram.dragTarget=null;
   const rect=this.canvas.getBoundingClientRect();
   const target=this.hologram.pickAt(this.player,event.clientX,event.clientY,rect);
   if(cancel)return;
   if(!drag.moved){this.inventoryClick(drag.source);return}
   if(drag.source?.startsWith('item:')&&target&&target!==drag.source&&
      !this.hologramDrop(drag.source,target))this.status('이 위치에는 옮길 수 없어요');
  };
  this.input.hologramPointerCancel=()=>{
   this.holoDragging=null;this.hologram.dragSource=null;this.hologram.dragTarget=null;
  };

  bindClick('menu-btn',()=>this.toggleMenu());
  bindClick('camera-btn',()=>this.toggleCameraMode());
  bindClick('debug-toggle',()=>{const enabled=document.body.classList.toggle('debug-ui');$('debug-toggle')?.setAttribute('aria-pressed',String(enabled))});
  bindClick('bag-btn',()=>this.togglePanel('inventory'));
  bindClick('inventory-close',()=>this.requestGameFocus());
  bindClick('resume',()=>this.requestGameFocus());
  bindClick('help-btn',()=>this.togglePanel('help'));
  bindClick('close-help',()=>this.requestGameFocus());
  bindClick('save',()=>{if(this.saveGameState())this.status('게임 · 소지품 저장 완료')});
   bindClick('new-game',()=>this.createGame());
   bindClick('load-world',()=>this.loadSelectedGame());
  bindClick('delete-world',()=>this.deleteSelectedGame());
  for(const button of document.querySelectorAll('[data-teleport]'))button.addEventListener('click',()=>this.teleportCity(button.dataset.teleport));
  bindClick('water-repair',()=>{
   const count=this.world.drainPlacedWater(this.player.x,this.player.y,this.player.z,24);
   this.status(count?`주변에 설치된 물 ${count}칸 정리 완료 · 자동 저장`:'주변에 정리할 설치된 물이 없어요');
  });
  bindClick('offhand-weapon',()=>this.toggleOffhand());
  bindClick('mode',()=>this.toggleCreative());
  bindClick('flight-toggle',()=>this.toggleFlight());
  $('sky-brightness')?.addEventListener('input',e=>{this.skyBrightness=Number(e.target.value)/100;
   this.renderer.skyBrightness=this.player.creative?this.skyBrightness:0;
   const output=$('sky-brightness-value');if(output)output.textContent=e.target.value+'%';
  });
  for(const [id,key,field] of [['city-sky-tone','mcweb:city-sky-tone','citySkyTone'],['city-ground-fade','mcweb:city-ground-fade','cityGroundFade']]){
   const input=$(id),output=$(id+'-value');if(!input)continue;
   const value=storedPercent(key,field==='citySkyTone'?55:60);
   input.value=String(value);output.textContent=value+'%';this.renderer[field]=value/100;
   input.addEventListener('input',()=>{const value=Number(input.value);this.renderer[field]=value/100;output.textContent=value+'%';localStorage.setItem(key,String(value))});
  }
  bindClick('build-form',()=>this.changeForm());
  bindClick('build-rotate',()=>this.rotateForm());
  this.updateModeControls();
  for(const id of ['render-distance','render-resolution']){
   const select=$(id),key='maktwo:'+id;if(!select)continue;
   select.value=localStorage.getItem(key)||'medium';
   select.addEventListener('change',()=>{localStorage.setItem(key,select.value);this.applyGraphics()});
  }
  const farToggle=$('far-silhouettes');if(farToggle){farToggle.checked=(localStorage.getItem('maktwo:far-silhouettes')??(new URLSearchParams(location.search).get('far')==='1'?'1':'0'))==='1';farToggle.addEventListener('change',()=>{localStorage.setItem('maktwo:far-silhouettes',farToggle.checked?'1':'0');this.applyGraphics()})}
  this.applyGraphics();
  this.refreshWorldChoices();
  const partSelect=$('part-family-select');if(partSelect){partSelect.replaceChildren(...PART_FAMILIES.map((family,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=family.label+' · 5종';return option}));partSelect.value='0';partSelect.addEventListener('change',e=>{
   if(this.world.mode!=='parts')return;
   const pos=partGallerySpawn(Number(e.target.value));Object.assign(this.player,pos,{vx:0,vy:0,vz:0,visualStepOffset:0});this.player.yaw=0;this.player.pitch=0;
   this.mining.reset();this.showMining(0);this.world.stream(pos.x,pos.z,2,4);
  });}
  this.updatePartGalleryControls();
  bindClick('spawn',()=>{const t=this.world.firstSpawn();this.player.clearPush();Object.assign(this.player,t,{vx:0,vy:0,vz:0,visualStepOffset:0});this.status('시작 위치로 이동')});
  $('seed').textContent=String(this.world.seed);
  for(const b of document.querySelectorAll('[data-action]')){
   const action=b.dataset.action;
   b.addEventListener('pointerdown',e=>{e.preventDefault();this.input.held[action]=true;b.setPointerCapture(e.pointerId)});
   for(const n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>this.input.held[action]=false);
  }
  // Clicking the world closes menus and captures the mouse in one gesture.
  this.canvas.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')return;if(this.panel==='inventory'){
   if(event.button===0&&this.input.hologramOwnsPointer(event)){
    event.preventDefault();this.input.ignoreMouseUntilUp=true;
    this.input.hologramPointerDown(event);
    try{this.canvas.setPointerCapture(event.pointerId)}catch{}
   }return;
  }if(this.uiOpen)this.requestGameFocus()});
  document.addEventListener('pointerlockchange',()=>{
   // Esc may release pointer lock. Do not automatically spawn a menu over the scene.
   if(this.input.locked)this.hologram.pointer=null;
   const crosshair=$('crosshair');if(crosshair){crosshair.style.left='50%';crosshair.style.top='50%'}
   this.updateControlHint();this.updateCameraButton();
  });
  this.canvas.addEventListener('pointermove',event=>{
   if(event.pointerType==='mouse'&&this.panel==='inventory'&&this.holoDragging?.pointerId===event.pointerId)
    this.input.hologramPointerMove(event);
   if(event.pointerType==='mouse'&&!this.uiOpen&&!this.input.locked){const crosshair=$('crosshair');if(crosshair){crosshair.style.left=event.clientX+'px';crosshair.style.top=event.clientY+'px'}const progress=$('mine-progress');if(progress){progress.style.left=event.clientX+'px';progress.style.top=(event.clientY+27)+'px'}}
   if(this.panel==='inventory'&&!this.input.locked&&event.pointerType==='mouse'){this.hologram.point(event.clientX,event.clientY,this.canvas.getBoundingClientRect());this.hologram.aim(this.player)}
  });
  this.canvas.addEventListener('pointerup',event=>{
   if(event.pointerType!=='mouse'||event.button!==0||this.panel!=='inventory'||
      this.holoDragging?.pointerId!==event.pointerId)return;
   event.preventDefault();this.input.hologramPointerUp(event,false);
   if(this.canvas.hasPointerCapture?.(event.pointerId))try{this.canvas.releasePointerCapture(event.pointerId)}catch{}
  });
  this.canvas.addEventListener('pointercancel',event=>{
   if(event.pointerType==='mouse'&&this.holoDragging?.pointerId===event.pointerId)
    this.input.hologramPointerUp(event,true);
  });
    this.canvas.addEventListener('wheel',e=>{
   e.preventDefault();if(this.panel==='inventory'||this.uiOpen)return;
   const occupied=this.paletteItems.map((id,i)=>id!==null&&this.inventory.count(id)>0?i:-1).filter(i=>i>=0);
   if(!occupied.length)return;
   const at=occupied.indexOf(this.selected),next=occupied[(at+(e.deltaY>0?1:-1)+occupied.length)%occupied.length];
   this.select(next,{toggle:false});
  },{passive:false});
  document.addEventListener('keydown',e=>{
   if(this.cinematic)return;
   if(e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   if(this.panel==='inventory'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
    e.preventDefault();this.input.keys.delete(e.code);
    this.hologram.moveFocus(e.code.slice(5).toLowerCase());return;
   }
   if(this.panel==='inventory'&&(e.code==='Enter'||e.code==='NumpadEnter')){
    e.preventDefault();if(!e.repeat)this.inventoryClick(this.hologram.focusedId());return;
   }
   if(e.repeat)return;
   if(this.openContainer&&!['Escape','KeyE','KeyI','KeyM','KeyH','KeyC'].includes(e.code))return;
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
    if(e.code.startsWith('Digit')){const n=Number(e.code.slice(5)),index=n-1;if(index>=0&&index<this.paletteItems.length){this.select(index,{toggle:false});this.requestGameFocus()}return}
   }
   if(this.uiOpen)return;
   const i=+e.key;
   if(e.code.startsWith('Digit')&&i>=1&&i<=7){const index=i-1;if(index<this.paletteItems.length)this.select(index)}
   if(e.code==='KeyL')this.togglePalette();
   if(e.code==='KeyQ'){if(this.dropCarried(this.paletteItems[this.selected],1))this.renderHotbar();return}
   if(e.code==='KeyX'){this.toggleOffhand();return}
   if(e.code==='KeyF')this.toggleFlight();
   if(e.code==='KeyR')this.changeForm();
   if(e.code==='KeyT')this.rotateForm();
   if(e.code==='KeyP')this.saveGameState()
  });
  window.addEventListener('beforeunload',()=>{this.saveGameState()});
  document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='hidden')this.saveGameState();
  });
 }
 select(i,{toggle=true}={}){
  if(i!==-1&&(i<0||i>=this.paletteItems.length))return;
  const previous=this.paletteItems[this.selected];
  this.selected=toggle&&this.selected===i?-1:(i>=0&&(this.paletteItems[i]===null||this.inventory.count(this.paletteItems[i])===0)?-1:i);
  if(this.paletteItems[this.selected]!==previous)this.manualAngle=null;
  this.mining.reset();this.showMining(0);
  document.querySelectorAll('.slot').forEach(el=>{const active=Number(el.dataset.slot)===this.selected;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active))});
  $('block-name').textContent=this.selected<0?'':blockLabel(this.paletteItems[this.selected]);
  this.updateEquipment();
  this.updateFormControls();this.updateControlHint();if(this.panel==='inventory')this.updateHologram();
 }

 updateEquipment(){
  const selected=this.paletteItems[this.selected];
  if(this.offWeapon!==null&&!this.inventory.has(this.offWeapon))this.offWeapon=null;
  const main=weapons[selected]?selected:null;
  const distinct=this.offWeapon!==main||this.inventory.count(main)>=2;
  const off=weapons[main]?.hands===2||!distinct?null:this.offWeapon;
  this.combat.equip(main,off);
  const button=$('offhand-weapon');
  if(button){
   button.hidden=weapons[main]?.hands===2||!(main||this.offWeapon);
   button.textContent=this.offWeapon?'왼손 해제 · X':'왼손 장착 · X';
   button.setAttribute('aria-pressed',String(Boolean(off)));
  }
 }
 toggleOffhand(){
  if(this.uiOpen||this.cinematic)return;
  if(this.offWeapon){this.offWeapon=null;this.updateEquipment();return}
  const id=this.paletteItems[this.selected];
  if(weapons[id]?.hands!==1)return;
  this.offWeapon=id;
  this.select(-1,{toggle:false});
 }
 renderStatusRing(id,value,max){const el=$(id);if(!el)return;const rounded=Math.ceil(Math.max(0,Math.min(max,value)));if(el.getAttribute('aria-valuenow')===String(rounded))return;el.setAttribute('aria-valuenow',String(rounded));el.querySelector('.ring-fill').setAttribute('stroke-dasharray',`${Math.max(0,Math.min(100,value/max*100))} 100`);el.querySelector('.ring-value').textContent=String(rounded)}
 status(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100)}
 updatePartGalleryControls(){const panel=$('part-gallery-controls');if(panel)panel.hidden=this.world.mode!=='parts';}
 saveGameState(){
  try{
   if(!this.world.save())throw Error('Unavailable world storage');
   if(this.survivalInventory.save()===false)throw Error('Unavailable inventory storage');
   const scene=this.cinematic;
   let player=this.player;
   if(scene?.type==='death')player={...player,...scene.respawn,hp:player.maxHp,stamina:100,pitch:0,fly:false};
   if(scene?.type==='sleep')player={...player,x:scene.x,z:scene.z,pitch:scene.pitch};
   savePlayerState(localStorage,this.world.name,player,this.world.yOrigin);
   localStorage.setItem(ACTIVE_WORLD_KEY,this.world.name);return true;
  }catch(error){
   console.warn('[MakTwo] Local game save failed',error);
   this.status('저장 실패 · 브라우저 저장 공간 확인');return false;
  }
 }
 refreshWorldChoices(){
  const menu=$('world');if(!menu)return;
  menu.replaceChildren(...this.worldPresets.filter(w=>w.mode===CITY_MODE||w.mode===CANYON_MODE||w.mode==='station-preview').map(w=>{
   const option=document.createElement('option');option.value=w.name;option.textContent=w.label+' · '+w.seed;return option;
  }));
  menu.value=this.world.name;
  if($('city-teleports'))$('city-teleports').hidden=this.world.mode!==CITY_MODE&&this.world.mode!==CANYON_MODE;
 }
 deleteSelectedGame(){
  const name=$('world')?.value,slot=loadWorldSlots(localStorage).find(w=>w.name===name);
  if(!slot){this.status('삭제할 내 게임을 선택해 주세요');return}
  if(!confirm(`${slot.label}을 삭제할까요? 저장 데이터가 지워집니다`))return;
  if(name===this.world.name){const fallback=this.worldPresets.find(w=>w.name!==name&&w.mode===CITY_MODE);if(!fallback)return;this.travel(fallback.name)}
  if(!deleteWorldSlot(localStorage,name))return;this.manager.worlds.delete(name);this.worldPresets=this.worldPresets.filter(w=>w.name!==name);this.refreshWorldChoices();this.status('월드 삭제 완료');
 }
 teleportCity(target){
  const canyon=this.world.mode===CANYON_MODE;
  if(this.world.mode!==CITY_MODE&&!canyon)return;
  const plan=canyon?canyonCore(this.world.seed):createCityPlan(this.world.seed,this.world.version>=7?this.world.version:false);
  const site=target==='dome'?null:plan.stations[Number(target.split('-')[1])];
  if(target!=='dome'&&!site){this.status('이 월드에는 역이 없습니다');return}
  const pos=site?{x:Math.round(site.x)+.5,y:site.y,z:Math.round(site.z)+(site.axis==='x'?4.5:.5)}:{x:Math.round(plan.library.x+plan.library.towerRadius+9)+.5,y:plan.library.galleries[1],z:Math.round(plan.library.z)+.5};
  if(site?.axis==='z')pos.x=Math.round(site.x)+4.5;
  if(canyon){
   this.shiftCanyonView(pos.y-this.world.yOrigin);
   pos.y-=this.world.yOrigin;
  }
  Object.assign(this.player,pos,{vx:0,vy:0,vz:0,visualStepOffset:0,canyonFallStart:undefined});this.world.stream(pos.x,pos.z,2,4);this.setPanel(null);this.status('이동 완료');
 }
 createGame(){
  try{
   if(!this.saveGameState())return;
   const rand=new Uint32Array(1);
   if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(rand);
   else rand[0]=Math.floor(Math.random()*0x100000000);
   const nonce=Date.now().toString()+String(Math.floor(Math.random()*1000)).padStart(3,'0');
   const slot=addWorldSlot(localStorage,rand[0]|0,nonce,this.world.mode===CANYON_MODE?CANYON_MODE:undefined);
   this.worldPresets.push(slot);this.manager.add(slot.name,slot.seed,slot.mode);
   if(this.travel(slot.name)){this.refreshWorldChoices();this.requestGameFocus();}
  }catch(error){console.warn('[MakTwo] New game failed',error);this.status('새 게임 생성 실패 · 로컬 저장 공간 확인')}
 }
 loadSelectedGame(){
  const name=$('world')?.value;
  if(!name||!this.manager.worlds.has(name)){this.status('불러올 게임을 선택해 주세요');return}
  if(name===this.world.name||this.travel(name))this.requestGameFocus();
 }
 travel(name){if(!this.saveGameState())return false;this.player.clearPush();this.world=this.manager.travel(name);this.survivalInventory=new SurvivalInventory(localStorage,this.world.name);this.selected=-1;this.offWeapon=null;this.combat.cancel();this.inventoryPalette=null;this.station=null;this.renderHotbar();this.entities=new EntityManager(this.world);this.bindWorld();this.effects=new Effects();const pos=loadPlayerState(localStorage,this.world.name,this.world.height,this.world.yOrigin)||this.world.firstSpawn();Object.assign(this.player,pos,{vx:0,vy:0,vz:0,visualStepOffset:0,canyonFallStart:undefined,creative:pos.creative??false,fly:pos.fly??false,hp:pos.hp??20,stamina:pos.stamina??100});if(pos.yaw===undefined)this.player.yaw=0;if(pos.pitch===undefined)this.player.pitch=0;this.updateModeControls();this.updatePartGalleryControls();if($('part-family-select'))$('part-family-select').value='0';this.mining.reset();this.showMining(0);this.renderer.resetWorld(this.world);this.applyGraphics();this.world.stream(pos.x,pos.z,2,4);$('seed').textContent=String(this.world.seed);this.refreshWorldChoices();try{localStorage.setItem(ACTIVE_WORLD_KEY,name)}catch{}this.status('게임 불러옴: '+(this.worldPresets.find(w=>w.name===name)?.label||worldLabel(name)));return true}
 bedPair(target){
  const {id,x,y,z}=target;
  const facing=this.world.getShapeState(x,y,z).facing;
  const [dx,dz]=bedDirection(facing);
  const foot=isBedFoot(id);
  const head={x:x-(foot?dx:0),y,z:z-(foot?dz:0)};
  const end={x:head.x+dx,y,z:head.z+dz};
  const base=itemId(id);
  if(this.world.get(head.x,y,head.z)!==base||this.world.get(end.x,y,end.z)!==base+1||
     this.world.getShapeState(end.x,y,end.z).facing!==this.world.getShapeState(head.x,y,head.z).facing)return null;
  return {head,end,base,facing};
 }
 placeBed(id,x,y,z,facing){
  if(y<1||y>=this.world.height)return false;
  const [dx,dz]=bedDirection(facing),p=this.player;
  const cells=[[x,z,id],[x+dx,z+dz,id+1]];
  for(const [bx,bz,part] of cells){
   if(!block(this.world.get(bx,y,bz)).replaceable||!block(this.world.get(bx,y-1,bz)).solid||
      solidBlockOverlap({getShapeState:()=>({facing})},bx,y,bz,part,p,1e-5,0))return false;
  }
  for(const [bx,bz,part] of cells){
   this.world.set(bx,y,bz,part);
   this.world.setShapeState(bx,y,bz,{facing});
  }
  return true;
 }
 respawnPosition(){
  const checkpoint=this.survivalInventory.checkpoint,p=this.player;
  if(checkpoint)this.shiftCanyonView(checkpoint.y-this.world.yOrigin);
  const saved=checkpoint&&{...checkpoint,y:checkpoint.y-this.world.yOrigin};
  if(saved&&saved.y>0&&saved.y<this.world.height-2){
   const id=this.world.get(saved.x,saved.y,saved.z);
   const pair=isBed(id)&&this.bedPair({...saved,id});
   if(pair){
    for(const tile of [pair.end,pair.head])for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const {x,y,z}={x:tile.x+dx+.5,y:tile.y,z:tile.z+dz+.5};
     if(this.world.get(x,y,z)!==B.WATER&&collides(this.world,x,y-.65,z,p.width,p.standingHeight)&&
        !collides(this.world,x,y,z,p.width,p.standingHeight)&&!isBed(this.world.get(x,y,z)))return {x,y,z};
    }
   }
  }
  const origin=this.world.yOrigin;
  const spawn=this.world.spawn();
  this.shiftCanyonView(this.player.y, this.world.yOrigin-origin);
  return spawn;
 }
 useBed(target){
  const pair=this.bedPair(target);
  if(!pair){this.status('침대가 부서져 있어요');return}
  const old=this.survivalInventory.checkpoint;
  this.survivalInventory.checkpoint={...pair.head,y:pair.head.y+this.world.yOrigin};
  if(!this.saveGameState()){
   this.survivalInventory.checkpoint=old;return;
  }
  this.status('부활 지점을 저장했어요');
  if(this.player.hp<this.player.maxHp)this.beginCinematic('sleep',pair);
 }
 beginCinematic(type,bed=null){
  const p=this.player;
  this.setPanel('cinematic');
  this.cinematic={type,bed,elapsed:0,x:p.x,z:p.z,pitch:p.pitch,eye:p.eye};
  p.vx=p.vy=p.vz=0;p.visualStepOffset=0;

  const overlay=$('life-overlay');
  overlay.dataset.scene=type;overlay.style.setProperty('--fade','0');overlay.hidden=false;
  overlay.querySelector('strong').textContent=type==='death'?'사망했습니다':'잠드는 중';
  if(type==='death'){
   this.cinematic.respawn=this.respawnPosition();
   this.selected=-1;
   this.offWeapon=null;
   this.survivalInventory.clearCarried();
   this.renderHotbar();
   this.saveGameState();
  }
 }
 updateCinematic(dt){
  const scene=this.cinematic,p=this.player,overlay=$('life-overlay');
  scene.elapsed+=dt;
  const death=scene.type==='death',duration=death?2.4:2.2;
  const progress=Math.min(1,scene.elapsed/(death?1.15:.8));
  const ease=progress*progress*(3-2*progress);
  const revealAt=duration-.45;
  if(scene.elapsed<revealAt){
   if(death){
    p.pitch=scene.pitch+(-1.44-scene.pitch)*ease;
    p.eye=scene.eye+(.25-scene.eye)*ease;
   }else{
    const {head,base}=scene.bed;
    p.x=scene.x+(head.x+.5-scene.x)*ease;
    p.z=scene.z+(head.z+.5-scene.z)*ease;
    p.visualStepOffset=(head.y+(base===B.BED?.82:.55)-p.y-p.eye)*ease;
    p.pitch=scene.pitch+(1.36-scene.pitch)*ease;
   }
  }else if(!scene.restored){
   scene.restored=true;
   if(death){
    const pos=scene.respawn;
    p.clearPush();
    Object.assign(p,pos,{dead:false,fly:false,grounded:false,crouching:false,
     canyonFallStart:undefined,height:p.standingHeight,eye:p.standingEye,stamina:100,staminaRecovery:0,exhausted:false,pitch:0});
    this.world.stream(pos.x,pos.z,2,4);
    this.portalCooldown=1;
   }else Object.assign(p,{x:scene.x,z:scene.z,pitch:scene.pitch,eye:scene.eye});
   p.hp=p.maxHp;p.visualStepOffset=0;
  }
  overlay.style.setProperty('--fade',String(Math.min(1,ease,Math.max(0,(duration-scene.elapsed)/.45))));
  if(scene.elapsed<duration)return;
  this.cinematic=null;overlay.hidden=true;this.setPanel(null);
  this.saveGameState();
  this.status(death?'부활했어요':'체력이 회복됐어요');
 }
 showContainer(target){
  if(!this.saveGameState())return;
  const key=this.world.stateKey(target.x,target.y+this.world.yOrigin,target.z);
  if(target.id===B.CRATE&&!this.survivalInventory.prepareCrate(key,this.world.seed,
   target.x,target.y+this.world.yOrigin,target.z,this.world.isGeneratedBlock(target.x,target.y,target.z))){
   this.status('상자 내용을 저장하지 못했어요');return;
  }
  this.openContainer={...target,world:this.world,key};
  this.inspectedItem=null;
  this.storageView='stored';
  this.inventoryPage=0;
  this.setPanel('inventory');
 }
 containerInReach(){
  const target=this.openContainer,p=this.player;
  return target.world===this.world&&Math.hypot(p.x-target.x-.5,cameraEyeY(p)-target.y-.5,p.z-target.z-.5)<=8&&
   this.world.get(target.x,target.y,target.z,false)===target.id;
 }
 renderContainer(){
  const target=this.openContainer,inventory=this.survivalInventory;
  const size=this.hologram.compact?4:8;
  const carried=inventory.orderedIds(inventory.items.keys()).map(id=>[id,inventory.count(id)]);
  const stored=[...(inventory.containers.get(target.key)||new Map())].sort(([a],[b])=>a-b);
  const total=Math.max(1,Math.ceil(Math.max(carried.length,stored.length)/size));
  this.inventoryPage=Math.max(0,Math.min(total-1,this.inventoryPage));
  const begin=this.inventoryPage*size;
  const pageCarried=carried.slice(begin,begin+size),pageStored=stored.slice(begin,begin+size);
  this.visibleCarried=pageCarried.map(([id])=>id);
  this.visibleStored=pageStored.map(([id])=>id);
  const mapItems=rows=>rows.map(([id,count])=>({id,count,name:blockLabel(id)}));
  this.hologram.setInventory('storage:stored',[], -1,'hand',
   {index:this.inventoryPage,total},'all',null,{
    storage:{carried:mapItems(pageCarried),stored:mapItems(pageStored),label:target.id===B.CRATE?'상자':'수납장'},
    quickSlots:inventory.quickSlots.map(id=>({blockId:id!==null&&inventory.has(id)?id:null,count:id===null?0:inventory.count(id)}))
   });
 }
 containerClick(hit){
  if(!this.containerInReach()){this.requestGameFocus();return}
  if(hit==='storage:carried'||hit==='storage:stored'){
   this.storageView=hit.slice(8);
  }else if(hit==='page:prev'||hit==='page:next'){
   this.inspectedItem=null;this.inventoryPage+=hit==='page:next'?1:-1;
  }else if(hit.startsWith('item:')){
   const m=/^item:(carried|stored):(\d+)$/.exec(hit);
   if(!m)return;
   const id=(m[1]==='carried'?this.visibleCarried:this.visibleStored)[Number(m[2])];
   if(id===undefined)return;
   this.storageView=m[1];this.inspectItem(id,m[1]);return;
  }else return;
  this.updateHologram();
 }
 // Spatial drops operate on the existing ledger and shortcut API, not dummy DOM slots.
 hologramDrop(from,to){
  if(!from||!to||from===to)return false;
  const src=/^item:(?:(carried|stored):)?(\d+)$/.exec(from);
  const dst=/^item:(?:(carried|stored):)?(\d+)$/.exec(to);
  if(!src||this.inventoryPalette==='craft'&&!this.openContainer)return false;
  const sourceId=src[1]==='carried'?this.visibleCarried[Number(src[2])]:
   src[1]==='stored'?this.visibleStored[Number(src[2])]:this.visibleItems[Number(src[2])];
  if(sourceId===undefined)return false;
  if(to.startsWith('quick:')&&src[1]!=='stored'){
   const index=Number(to.slice(6));
   if(!this.inventory.moveShortcut(sourceId,index))return false;
   this.select(index,{toggle:false});this.renderHotbar();this.updateHologram();return true;
  }
  if(dst){
   const destId=dst[1]==='carried'?this.visibleCarried[Number(dst[2])]:
    dst[1]==='stored'?this.visibleStored[Number(dst[2])]:this.visibleItems[Number(dst[2])];
   if(destId===undefined)return false;
   if(this.openContainer&&src[1]!==dst[1]){
    const deposit=src[1]==='carried';
    if(!this.survivalInventory.transfer(this.openContainer.key,sourceId,deposit,1))return false;
    this.inspectedItem=null;this.renderHotbar();this.updateHologram();return true;
   }
   if(src[1]==='stored')return false;
   if(!this.inventory.reorder(sourceId,destId))return false;
   this.inspectedItem=null;this.updateHologram();return true;
  }
  // A container title is also an accessible target for moving one item.
  if(this.openContainer&&(to==='storage:carried'||to==='storage:stored')&&src[1]&&src[1]!==to.slice(8)){
   if(!this.survivalInventory.transfer(this.openContainer.key,sourceId,src[1]==='carried',1))return false;
   this.inspectedItem=null;this.renderHotbar();this.updateHologram();return true;
  }
  return false;
 }
 interaction(dt,input){
  if(this.uiOpen){this.target=null;this.mining.reset();this.showMining(0);return}
  this.interactTimer=Math.max(0,this.interactTimer-dt);
  const p=this.player,d=p.direction(),origin={x:p.x,y:cameraEyeY(p),z:p.z};
  const miningMode=input.mine;
  const aim=this.input.locked?null:(input.aim||this.input.canvasCursor());
  const ray=aim?screenRay(p,aim.x,aim.y,this.canvas.clientWidth,this.canvas.clientHeight):d;
  if(this.combat.main||(this.combat.off&&this.selected<0)||this.combat.attack){
   if(input.use)this.combat.start(ray,p);
   if(this.combat.main||input.use||this.combat.attack){
    this.target=null;this.mining.reset();this.showMining(0);return;
   }
  }
  this.target=raycast(this.world,origin,ray,7.5,{hitWater:!miningMode&&this.selected>=0,hitDecor:miningMode});
  let interactionDistance=this.target?.distance??7.5;
  if(input.use||miningMode){
   const blockDistance=this.target?.distance??7.5;
   let shellDistance=blockDistance;
   for(const train of this.world.trainColliders)
    shellDistance=train.shellDistance(origin,ray,shellDistance);
   if(input.use){
    for(const train of this.world.trainColliders){
     const handle=train.pickControl(origin,ray,Math.min(blockDistance,shellDistance+.08));
     if(handle){
      train.useControl(handle,p);
      this.mining.reset();this.showMining(0);return;
     }
    }
   }
   if(shellDistance<blockDistance){this.target=null;interactionDistance=shellDistance}
  }
  if(input.use&&this.target&&!this.target.mounted){
   if(isBed(this.target.id)){this.useBed(this.target);return}
   if(isContainer(this.target.id)){this.showContainer(this.target);return}
  }
  if(input.use&&this.target&&this.target.id===B.WORKBENCH){
   this.setPanel('inventory');this.station={world:this.world,x:this.target.x,y:this.target.y,z:this.target.z};
   this.inventoryPalette='craft';this.inventoryPage=0;this.updateHologram();this.status('작업대 · 발견한 제작법을 선택하세요');
   this.interactTimer=.2;return;
  }
  if(input.use&&this.target&&(this.target.id===B.DOOR||this.target.id===B.DOOR_TOP)){
   if(this.world.toggleDoor(this.target.x,this.target.y,this.target.z,[p,...this.entities.entities]))this.status(this.world.getDoorState(this.target.x,this.target.y,this.target.z).open?'문을 열었어요':'문을 닫았어요');
   else this.status('문 앞에 공간이 부족해요');
   this.interactTimer=.18;this.mining.reset();this.showMining(0);return;
  }
  // Cursor-specific entity targeting, checked before construction.
  const hitMob=this.entities.hitRay(origin,ray,3.8,interactionDistance,.18);
  if((input.use||miningMode)&&this.interactTimer<=0&&hitMob){
   hitMob.hurt(4,p);this.effects.burst(hitMob.x,hitMob.y+hitMob.height*.6,hitMob.z,'#b8a08f',4);
   this.interactTimer=.38;this.mining.reset();this.showMining(0);return;
  }
  const placing=(this.selected>=0&&input.use);
  if(!placing)this.placeLatch=false;
  if(placing&&this.selected>=0){
   this.mining.reset();this.showMining(0);
   if(this.interactTimer>0||!this.target)return;
   this.placeLatch=true;
   const id=this.paletteItems[this.selected];if(!this.inventory.has(id)){this.status(`${blockLabel(id)}이 부족해요 · 채굴하거나 제작하세요`);this.interactTimer=.25;return}
   const t=this.target;
   if(t.mounted)return;
   if(isWallItem(id)&&t.anchor&&Math.abs(t.normal.y)<1e-6&&Math.hypot(t.normal.x,t.normal.z)>.5){
    if(this.world.placeMount(id,t,this.placementAngle(id)/90)){this.inventory.remove(id);this.refreshInventoryUI()}
    else this.status('이 면에 배치할 공간이 없어요');
    this.interactTimer=.20;return;
   }
   if(id===B.SHOP_SIGN){this.status('간판을 붙일 벽을 선택하세요');this.interactTimer=.20;return}
   const n=t.normal,replaceWater=t.id===B.WATER;
   const axis=Math.abs(n.y)>.001?'y':Math.abs(n.x)>=Math.abs(n.z)?'x':'z';
   const x=t.x+(!replaceWater&&axis==='x'?Math.sign(n.x):0),y=t.y+(!replaceWater&&axis==='y'?Math.sign(n.y):0),z=t.z+(!replaceWater&&axis==='z'?Math.sign(n.z):0);
   const old=this.world.get(x,y,z);
   if(block(old).replaceable){
    if(isBed(id)){
     if(this.placeBed(id,x,y,z,this.placementAngle(id)/90)){
      this.inventory.remove(id);this.refreshInventoryUI();
     }else this.status('침대에는 바닥 두 칸이 필요해요');
    }else if(id===B.DOOR){
     const facing=this.placementAngle(id)/90,upperOld=this.world.get(x,y+1,z);
     if(this.world.placeDoor(x,y,z,facing,[p,...this.entities.entities])){
      if(collides(this.world,p.x,p.y,p.z,p.width,p.height)){this.world.removeDoor(x,y,z);if(old!==B.AIR)this.world.set(x,y,z,old);if(upperOld!==B.AIR)this.world.set(x,y+1,z,upperOld)}
      else{this.inventory.remove(id);this.refreshInventoryUI();this.status('나무 문 설치 · 클릭해서 열고 닫기')};
     }else this.status('문은 위로 두 칸의 공간이 필요해요');
    }else{
     const angle=this.placementAngle(id),type=buildType(id);
     const form=type.forms?orientedForm(this.form,angle):0;
     const state={facing:partById(id)?Math.round(angle/45):Math.floor(angle/90),upper:isSlab(id)&&n.y===-1};
     if(type.panel)state.panelTurn=angle/45;
     if(!solidBlockOverlap({getShapeState:()=>state},x,y,z,id,p,1e-5,form)&&this.world.set(x,y,z,id,{form})){
      if((angle&&!form)||state.upper)this.world.setShapeState(x,y,z,state);
      this.inventory.remove(id);this.refreshInventoryUI();
      this.effects.burst(x+.5,y+.5,z+.5,block(id).color,5);
     }
    }
    this.interactTimer=.20;
   }
   return;
  }
  if(!miningMode){this.mining.reset();this.showMining(0);return}

  const target=this.target&&this.target.id!==B.BEDROCK&&this.target.id!==B.WATER?this.target:null;
  const result=this.mining.update(target,true,dt,p.creative?.5:undefined);this.showMining(result.ratio);
  if(result.completed&&target){
   if(target.mounted||this.world.get(target.x,target.y,target.z)===target.id){
    const {x,y,z,id}=target;
    if(!target.mounted&&isContainer(id)&&this.survivalInventory.containers.has(this.world.stateKey(x,y+this.world.yOrigin,z))){
     this.status('내용물을 먼저 꺼내세요');this.mining.reset();this.showMining(0);return;
    }
    const mined=target.mounted?this.world.removeMount(x,y,z):id===B.DOOR||id===B.DOOR_TOP?
     this.world.removeDoor(x,y,z):this.world.set(x,y,z,B.AIR);
    if(mined){const item=harvestDrop(target.id);
     if(!p.creative&&item!==null)this.entities.spawnDrop(item,target.x+.5,target.y+.45,target.z+.5);
     this.effects.burst(target.x+.5,target.y+.5,target.z+.5,block(target.id).color,12)}
   }
   this.interactTimer=.12;this.showMining(0);
  }
 }

 shiftCanyonView(y,shift=this.world.recenterCanyon(y)){
  if(!shift)return;
  this.player.y-=shift;
  if(this.player.pushedFromY!==undefined)this.player.pushedFromY-=shift;
  for(const entity of this.entities.entities)if(entity.type!=='train'&&entity.type!=='drop')entity.y-=shift;
  for(const particle of this.effects.particles)particle.y-=shift;
  if(this.openContainer)this.openContainer.y-=shift;
  this.renderer.resetWorld(this.world);
  this.target=null;
  this.mining.reset();this.showMining(0);
 }
 tick(dt){
  if(this.cinematic){this.updateCinematic(dt);return}
  this.portalCooldown=Math.max(0,this.portalCooldown-dt);
  const p=this.player,input=this.input.read();
  p.update(this.world,dt,input);
  if(this.world.mode===CANYON_MODE){
   const altitude=p.y+this.world.yOrigin;
   if(p.grounded||p.fly||p.water)p.canyonFallStart=undefined;
   else {
    p.canyonFallStart=Math.max(p.canyonFallStart??altitude,altitude);
    if(p.canyonFallStart-altitude>44)p.hurt(p.hp);
   }
   this.shiftCanyonView(p.y);
  }
  if(p.dead){this.beginCinematic('death');return}
  if(this.portalCooldown===0&&(this.world.get(p.x,p.y+.4,p.z)===B.PORTAL||this.world.get(p.x,p.y+1.1,p.z)===B.PORTAL)){
   const names=[...this.manager.worlds.keys()];
   this.travel(names[(names.indexOf(this.world.name)+1)%names.length]);this.portalCooldown=2;
  }
  this.world.tick();
  this.entities.tick(dt,p,p.creative?null:this.inventory,Math.min(this.renderer.maxDistance??88,(this.renderRadius??3)*16),
   {aspect:this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),tan:FOV_TAN});
  this.effects.tick(dt);
  if(this.entities.collected){this.entities.collected=false;this.renderHotbar();this.refreshInventoryUI()}
  if(p.dead)this.beginCinematic('death');
  else{
   this.interaction(dt,input);
   this.combat.tick(dt,this.world,this.entities,p,cameraEyeY(p),this.effects);
  }
 }
 frame(time){const elapsed=time-this.last,dt=Math.min(Math.max(elapsed/1000,0),.06);this.last=time;this.lastFrameMs=elapsed;const [mx,my]=this.input.consumeLook();if(this.panel==='inventory'||!this.uiOpen)applyCameraLook(this.player,mx,my);if(this.openContainer&&!this.containerInReach())this.requestGameFocus();if(this.panel==='inventory'){if(this.hologram.syncViewport())this.updateHologram();this.hologram.followPlayer(this.player,dt);if(this.station&&this.activeStation()!=='bench'){this.station=null;this.updateHologram()} if(this.input.gestures.right!==null)this.hologram.pointer=null;this.hologram.aim(this.player)};this.acc+=dt;let n=0;while(this.acc>=1/60&&n++<5){this.tick(1/60);this.acc-=1/60}this.frameCount++;this.renderer.observeFrame(elapsed);if(this.frameCount%3===0)this.world.stream(this.player.x,this.player.z,this.renderRadius||3,2,{roundEdges:true});this.renderer.sync(this.world,this.player);this.renderer.frame(this.world,this.player,this.entities.entities,this.effects,dt,this.uiOpen?null:this.combat,this.entities.observers);if(time-this.lastHud>150){this.hud();this.lastHud=time}this.scheduleFrame()}
 scheduleFrame(){requestAnimationFrame(t=>{try{this.frame(t)}catch(error){console.error('[MakTwo] Frame error',error);const el=$('fatal');if(el){el.textContent='화면 오류: '+String(error?.message||error)+' · 새로고침 후에도 반복되면 이 문구를 알려주세요';el.hidden=false}}})}
 hud(){const p=this.player;$('coords').textContent=`${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`;$('biome').textContent=`${worldLabel(this.world.name)} · ${({'normal':'자연 지형','flat':'평탄한 지형','islands':'섬 지형','highlands':'산맥·협곡 지형'}[this.world.mode]||this.world.mode)}`;$('fps').textContent=`${Math.round(1000/Math.max(1,this.lastFrameMs))} FPS · ${this.world.chunks.size} 청크 / ${this.renderer.lastDrawnChunks} 렌더 · 원거리 ${(this.renderer.distanceMesh?.count??0)+(this.renderer.farMesh?.count??0)} verts / ${this.renderer.lastDistanceDrawCalls??0} draw · 전체 ${this.renderer.lastDrawCalls??0} draw · 동물 ${this.entities.entities.length}`;$('target').textContent=this.target?`조준: ${blockLabel(this.target.id)} · 탭 설치 / 길게 채굴`:this.selected<0?'맨손 · 길게 눌러 채굴':'클릭한 곳에 설치';this.renderStatusRing('health',p.hp,p.maxHp);this.renderStatusRing('stamina',p.stamina,100);document.body.classList.toggle('submerged',this.world.get(p.x,p.y+p.eye,p.z,false)===B.WATER);$('flight').textContent=p.fly?'비행 중':'걷는 중'}
}
try{new Game()}catch(err){console.error(err);$('fatal').textContent='Cannot start: '+err.message;$('fatal').hidden=false}
registerPWA();
