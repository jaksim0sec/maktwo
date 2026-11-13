import {GestureState,HOLD_MS} from './gestures.js';
const cap=v=>Math.max(-180,Math.min(180,v));
export class Input{
 constructor(canvas){
  this.canvas=canvas;this.keys=new Set();this.held={};this.locked=false;this.uiMode=false;this.inventoryMode=false;
  this.dx=0;this.dy=0;this.pointer={left:false,start:0,x:0,y:0};this.pendingTaps=0;this.tapPoint=null;this.mouseLook=false;this.lastMouse=null;this.gestures=new GestureState();
  document.addEventListener('keydown',e=>{
   if(this.uiMode||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Array.from({length:10},(_,i)=>`Digit${i}`)].includes(e.code))e.preventDefault();
   this.keys.add(e.code);
  });
  document.addEventListener('keyup',e=>this.keys.delete(e.code));
  window.addEventListener('blur',()=>this.clear());
  window.addEventListener('orientationchange',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear()});
  document.addEventListener('pointerlockchange',()=>{
   this.locked=document.pointerLockElement===canvas;
   this.dx=0;this.dy=0;if(!this.locked)this.pointer.left=false;
  });
  document.addEventListener('mousemove',e=>{
   if(this.uiMode)return;
   if(this.locked){this.dx=cap(this.dx+cap(e.movementX));this.dy=cap(this.dy+cap(e.movementY));}
   else if(this.mouseLook&&this.lastMouse){this.dx=cap(this.dx+cap(e.clientX-this.lastMouse.x));this.dy=cap(this.dy+cap(e.clientY-this.lastMouse.y));}
   this.lastMouse={x:e.clientX,y:e.clientY};
  });
  // Primary click edits the actual cursor pixel. Secondary drag rotates the camera.
  // No automatic pointer lock: the user must be able to target off-center blocks.
  canvas.addEventListener('mousedown',e=>{
   if(this.uiMode)return;
   if(this.inventoryMode&&e.button===0)return;
   if(e.button===2){e.preventDefault();this.mouseLook=true;this.lastMouse={x:e.clientX,y:e.clientY};return;}
   if(e.button!==0)return;
   const rect=canvas.getBoundingClientRect();this.pointer={left:true,start:performance.now(),x:e.clientX-rect.left,y:e.clientY-rect.top};
  });
  document.addEventListener('mouseup',e=>{
   if(e.button===2){this.mouseLook=false;this.lastMouse=null;return;}
   if(e.button!==0||!this.pointer.left)return;
   if(!this.uiMode&&!this.inventoryMode&&performance.now()-this.pointer.start<HOLD_MS){this.pendingTaps++;this.tapPoint={x:this.pointer.x,y:this.pointer.y}}
   this.pointer.left=false;
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  // Pointer events support simultaneous movement/look and handle interruptions.
  canvas.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   if(this.uiMode)return;
   e.preventDefault();const rect=canvas.getBoundingClientRect();
   if(this.gestures.down(e.pointerId,e.clientX,e.clientY,rect.left+rect.width/2,performance.now(),rect.width)){
    try{canvas.setPointerCapture(e.pointerId)}catch{}
   }
  });
  canvas.addEventListener('pointermove',e=>{
   if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   if(this.uiMode)return;
   e.preventDefault();this.gestures.move(e.pointerId,e.clientX,e.clientY);
  });
  const finish=(e,cancel=false)=>{
   if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   e.preventDefault();this.gestures.up(e.pointerId,e.clientX,e.clientY,performance.now(),cancel);
   if(canvas.hasPointerCapture?.(e.pointerId))try{canvas.releasePointerCapture(e.pointerId)}catch{}
  };
  canvas.addEventListener('pointerup',e=>finish(e));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('lostpointercapture',e=>{
   if(e.pointerType==='touch'||e.pointerType==='pen')this.gestures.up(e.pointerId,e.clientX,e.clientY,performance.now(),true);
  });
 }
 canvasCursor(){
  const p=this.lastMouse;if(!p||this.uiMode||this.inventoryMode||this.locked)return null;
  const r=this.canvas.getBoundingClientRect();
  if(p.x<r.left||p.x>r.right||p.y<r.top||p.y>r.bottom)return null;
  return{x:p.x-r.left,y:p.y-r.top};
 }
 clear(){this.keys.clear();this.held={};this.pointer.left=false;this.pendingTaps=0;this.tapPoint=null;this.dx=0;this.dy=0;this.mouseLook=false;this.lastMouse=null;this.gestures.reset()}
 setUiMode(open){const next=Boolean(open);if(this.uiMode===next)return;this.uiMode=next;if(next)this.clear()}
 setInventoryMode(open){const next=Boolean(open);if(this.inventoryMode===next)return;this.inventoryMode=next;this.pointer.left=false;this.pendingTaps=0;this.tapPoint=null;this.gestures.reset();this.dx=0;this.dy=0}
 toggleCameraMode(){
  if(document.pointerLockElement===this.canvas){document.exitPointerLock?.();return}
  try{const request=this.canvas.requestPointerLock?.();request?.catch?.(e=>console.warn('[MakTwo] Pointer lock unavailable',e))}catch(e){console.warn('[MakTwo] Pointer lock unavailable',e)}
 }
 read(){
  if(this.uiMode)return{forward:false,backward:false,left:false,right:false,moveX:0,moveY:0,jump:false,crouch:false,sprint:false,use:false,mine:false,place:false};
  const k=this.keys,m=this.gestures.movement();
  const taps=this.pendingTaps+this.gestures.consumeTaps();this.pendingTaps=0;
  const rect=this.canvas.getBoundingClientRect();
  const canvasAim=p=>p?{x:p.x-rect.left,y:p.y-rect.top}:null;
  const fingerTap=canvasAim(this.gestures.consumeTapPoint());const picked=this.tapPoint||fingerTap;this.tapPoint=null;
  const minePoint=this.inventoryMode?null:(this.pointer.left&&performance.now()-this.pointer.start>=HOLD_MS?{x:this.pointer.x,y:this.pointer.y}:canvasAim(this.gestures.miningPoint(performance.now())));
  return{
   forward:k.has('KeyW')||k.has('ArrowUp'),backward:k.has('KeyS')||k.has('ArrowDown'),
   left:k.has('KeyA')||k.has('ArrowLeft'),right:k.has('KeyD')||k.has('ArrowRight'),
   moveX:m.x,moveY:-m.y,
   jump:Boolean(k.has('Space')||this.held.jump),crouch:Boolean(k.has('ShiftLeft')||this.held.crouch),
   sprint:k.has('ControlLeft')||k.has('ControlRight')||Boolean(this.held.sprint),
   use:!this.inventoryMode&&taps>0,mine:!this.inventoryMode&&Boolean(minePoint||this.held.mine),aim:this.inventoryMode?null:(minePoint||picked),place:false
  };
 }
 consumeLook(){
  const touch=this.gestures.consumeLook(),v=[cap(this.dx+touch[0]),cap(this.dy+touch[1])];
  this.dx=0;this.dy=0;return v;
 }
}
