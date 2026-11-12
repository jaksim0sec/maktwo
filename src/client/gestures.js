// Deterministic gesture state, isolated from DOM so touch behavior can be unit-tested.
export const HOLD_MS = 420;
export const TAP_DRIFT_PX = 11;
export const MOVE_DEADZONE = 9;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export class GestureState {
 constructor(){this.fingers=new Map();this.left=null;this.right=null;this.lookX=0;this.lookY=0;this.taps=0;this.tapPoints=[];}
 down(id,x,y,center,time){
  if(this.fingers.has(id))return false;
  const side=x<center?'left':'right';
  if(this[side]!==null)return false;
  this.fingers.set(id,{side,x,y,startX:x,startY:y,time,dragged:false});
  this[side]=id;
  return true;
 }
 move(id,x,y){
  const f=this.fingers.get(id);if(!f)return;
  const distance=Math.hypot(x-f.startX,y-f.startY);
  if(distance>TAP_DRIFT_PX)f.dragged=true;
  if(f.side==='right'){
   this.lookX+=clamp(x-f.x,-65,65)*1.5;
   this.lookY+=clamp(y-f.y,-65,65)*1.5;
  }
  f.x=x;f.y=y;
 }
 up(id,x,y,time,cancel=false){
  const f=this.fingers.get(id);if(!f)return;
  if(!cancel&&Math.hypot(x-f.startX,y-f.startY)<=TAP_DRIFT_PX&&!f.dragged&&time-f.time<HOLD_MS){this.taps++;this.tapPoints.push({x,y});}
  this.fingers.delete(id);this[f.side]=null;
 }
 miningPoint(now){const f=this.right===null?null:this.fingers.get(this.right);return f&&!f.dragged&&now-f.time>=HOLD_MS?{x:f.x,y:f.y}:null}
 consumeTapPoint(){this.taps=0;const p=this.tapPoints.at(-1)||null;this.tapPoints.length=0;return p}
 movement(){
  if(this.left===null)return{x:0,y:0};
  const f=this.fingers.get(this.left),dx=f.x-f.startX,dy=f.y-f.startY,r=Math.hypot(dx,dy);
  if(r<=MOVE_DEADZONE)return{x:0,y:0};
  const power=clamp((r-MOVE_DEADZONE)/75,0,1);
  return{x:dx/r*power,y:dy/r*power};
 }
 mining(now){
  const f=this.right===null?null:this.fingers.get(this.right);
  return Boolean(f&&!f.dragged&&now-f.time>=HOLD_MS);
 }
 consumeTaps(){const count=this.taps;this.taps=0;return count;}
 consumeLook(){const v=[this.lookX,this.lookY];this.lookX=0;this.lookY=0;return v;}
 reset(){this.tapPoints=[];this.fingers.clear();this.left=null;this.right=null;this.lookX=0;this.lookY=0;this.taps=0;}
}
