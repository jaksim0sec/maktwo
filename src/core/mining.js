import {block,BLOCK} from './blocks.js';
// Dedicated interaction timer; independent of simulation frame rate and rendering.
export class MiningProgress{
 constructor(){this.key=null;this.seconds=0;this.ratio=0}
 reset(){this.key=null;this.seconds=0;this.ratio=0}
 update(target,holding,dt){
  if(!holding||!target||target.id===BLOCK.AIR){this.reset();return {ratio:0,completed:false}}
  const duration=block(target.id).breakTime;
  if(!Number.isFinite(duration)){this.reset();return {ratio:0,completed:false}}
  const key=`${target.x},${target.y},${target.z}:${target.id}`;
  if(this.key!==key){this.key=key;this.seconds=0}
  this.seconds+=Math.max(0,Math.min(dt,.1));
  this.ratio=Math.min(1,this.seconds/Math.max(.01,duration));
  if(this.ratio>=1){this.reset();return {ratio:1,completed:true}}
  return {ratio:this.ratio,completed:false};
 }
}
