// Mobile pointer-state machine. No on-screen joystick; each finger keeps its
// starting role even when crossing the midline. DOM and game ticks stay separate.
export const HOLD_MS = 420;
export const TAP_DRIFT_PX = 12;
export const LOOK_START_PX = 14;
export const HOLD_CANCEL_DRIFT_PX = 24;
export const MOVE_DEADZONE = 10;
export const MOVE_FULL_SPEED_PX = 100;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const smoothstep=t=>t*t*(3-2*t);
export class GestureState {
 constructor(){this.fingers=new Map();this.left=null;this.right=null;this.lookX=0;this.lookY=0;this.tapPoints=[];this.taps=0;}
 down(id,x,y,center,time,viewportWidth=center*2){
  if(this.fingers.has(id))return false;
  const side=x<center?'left':'right';
  if(this[side]!==null)return false;
  this.fingers.set(id,{side,x,y,startX:x,startY:y,time,dragged:false,holding:false,holdCancelled:false,lookActive:false,viewportWidth:Math.max(240,viewportWidth)});
  this[side]=id;
  return true;
 }
 move(id,x,y){
  const f=this.fingers.get(id);if(!f)return;
  const dist=Math.hypot(x-f.startX,y-f.startY);
  if(f.side==='right'){
   if(f.holding){if(dist>HOLD_CANCEL_DRIFT_PX)f.holdCancelled=true;}
   else if(!f.holdCancelled){
    if(dist>=LOOK_START_PX)f.lookActive=true;
    if(f.lookActive){
     // CSS px, not device px; keep look sensitivity comparable on phones and tablets.
     const gain=clamp(1750/f.viewportWidth,2.8,5.6);
     this.lookX+=clamp(x-f.x,-48,48)*gain;
     this.lookY+=clamp(y-f.y,-48,48)*gain;
    }
   }
  }
  if(dist>TAP_DRIFT_PX)f.dragged=true;
  f.x=x;f.y=y;
 }
 up(id,x,y,time,cancel=false){
  const f=this.fingers.get(id);if(!f)return;
  // A stationary tap on either side is an explicit world action; movement drags never edit.
  if(!cancel&&!f.dragged&&!f.holding&&!f.holdCancelled&&time-f.time<HOLD_MS&&Math.hypot(x-f.startX,y-f.startY)<=TAP_DRIFT_PX){
   this.taps++;this.tapPoints.push({x,y});
  }
  this.fingers.delete(id);this[f.side]=null;
 }
 miningPoint(now){
  const right=this.right===null?null:this.fingers.get(this.right);
  const left=this.left===null?null:this.fingers.get(this.left);
  const f=[right,left].find(f=>(f?.holding||f&&!f.dragged)&&!f.lookActive)||null;
  if(!f||f.lookActive||f.holdCancelled||(!f.holding&&f.dragged)||now-f.time<HOLD_MS)return null;
  f.holding=true;
  // Lock the target during a hold so subpixel finger wobble doesn't reset mining.
  return{x:f.startX,y:f.startY};
 }
 mining(now){return Boolean(this.miningPoint(now))}
 consumeTapPoint(){const p=this.tapPoints.at(-1)||null;this.tapPoints.length=0;return p}
 movement(){
  const f=this.left===null?null:this.fingers.get(this.left);
  if(!f)return{x:0,y:0};
  const dx=f.x-f.startX,dy=f.y-f.startY,r=Math.hypot(dx,dy);
  if(r<=MOVE_DEADZONE)return{x:0,y:0};
  const power=smoothstep(clamp((r-MOVE_DEADZONE)/(MOVE_FULL_SPEED_PX-MOVE_DEADZONE),0,1));
  return{x:dx/r*power,y:dy/r*power};
 }
 consumeTaps(){const count=this.taps;this.taps=0;return count;}
 consumeLook(){const v=[this.lookX,this.lookY];this.lookX=0;this.lookY=0;return v;}
 reset(){this.tapPoints.length=0;this.fingers.clear();this.left=null;this.right=null;this.lookX=0;this.lookY=0;this.taps=0;}
}
