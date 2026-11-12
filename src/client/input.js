import {GestureState,HOLD_MS} from './gestures.js';
const cap=v=>Math.max(-180,Math.min(180,v));
export class Input{
 constructor(canvas){
  this.canvas=canvas;this.keys=new Set();this.held={};this.locked=false;this.uiMode=false;
  this.dx=0;this.dy=0;this.pointer={left:false,start:0};this.pendingTaps=0;this.gestures=new GestureState();
  document.addEventListener('keydown',e=>{
   if(this.uiMode||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',...Array.from({length:10},(_,i)=>`Digit${i}`)].includes(e.code))e.preventDefault();
   this.keys.add(e.code);
  });
  document.addEventListener('keyup',e=>this.keys.delete(e.code));
  window.addEventListener('blur',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear()});
  document.addEventListener('pointerlockchange',()=>{
   this.locked=document.pointerLockElement===canvas;
   this.dx=0;this.dy=0;if(!this.locked)this.pointer.left=false;
  });
  document.addEventListener('mousemove',e=>{
   if(this.locked&&!this.uiMode){this.dx=cap(this.dx+cap(e.movementX));this.dy=cap(this.dy+cap(e.movementY));}
  });
  canvas.addEventListener('mousedown',e=>{
   if(e.button!==0||this.uiMode)return;
   if(!this.locked){canvas.requestPointerLock?.();return}
   this.pointer.left=true;this.pointer.start=performance.now();
  });
  document.addEventListener('mouseup',e=>{
   if(e.button!==0||!this.pointer.left)return;
   if(!this.uiMode&&performance.now()-this.pointer.start<HOLD_MS)this.pendingTaps++;
   this.pointer.left=false;
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  // Pointer events support simultaneous movement/look and handle interruptions.
  canvas.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
   if(this.uiMode)return;
   e.preventDefault();const rect=canvas.getBoundingClientRect();
   if(this.gestures.down(e.pointerId,e.clientX,e.clientY,rect.left+rect.width/2,performance.now())){
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
 clear(){this.keys.clear();this.held={};this.pointer.left=false;this.pendingTaps=0;this.dx=0;this.dy=0;this.gestures.reset()}
 setUiMode(open){this.uiMode=Boolean(open);this.clear()}
 read(){
  if(this.uiMode)return{forward:false,backward:false,left:false,right:false,moveX:0,moveY:0,jump:false,crouch:false,sprint:false,use:false,mine:false,place:false};
  const k=this.keys,m=this.gestures.movement();
  const taps=this.pendingTaps+this.gestures.consumeTaps();this.pendingTaps=0;
  return{
   forward:k.has('KeyW')||k.has('ArrowUp'),backward:k.has('KeyS')||k.has('ArrowDown'),
   left:k.has('KeyA')||k.has('ArrowLeft'),right:k.has('KeyD')||k.has('ArrowRight'),
   moveX:m.x,moveY:-m.y,
   jump:Boolean(k.has('Space')||this.held.jump),crouch:Boolean(k.has('ShiftLeft')||this.held.crouch),
   sprint:k.has('ControlLeft')||k.has('ControlRight'),
   use:taps>0,mine:Boolean((this.pointer.left&&performance.now()-this.pointer.start>=HOLD_MS)||this.gestures.mining(performance.now())||this.held.mine),place:false
  };
 }
 consumeLook(){
  const touch=this.gestures.consumeLook(),v=[cap(this.dx+touch[0]),cap(this.dy+touch[1])];
  this.dx=0;this.dy=0;return v;
 }
}
