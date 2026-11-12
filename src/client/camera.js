// Presentation-only camera behavior. Physics coordinates remain authoritative.
export function applyCameraLook(player,dx,dy,sensitivity=.0023){
 const limit=180;const bound=v=>Number.isFinite(v)?Math.max(-limit,Math.min(limit,v)):0;
 player.yaw-=bound(dx)*sensitivity;
 player.pitch=Math.max(-1.53,Math.min(1.53,player.pitch-bound(dy)*sensitivity));
}
export function cameraEyeY(player){return player.y+player.eye+(player.visualStepOffset||0)}
export function dampStepOffset(offset,dt){
 if(!Number.isFinite(offset))return 0;
 const next=offset*Math.exp(-4.8*Math.max(0,Math.min(.1,dt)));
 return Math.abs(next)<.001?0:next;
}
