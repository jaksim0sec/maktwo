import {BLOCK as B,BLOCKS,block} from './blocks.js';

// A separate player-owned ledger. World/chunk snapshots remain byte-for-byte
// compatible with existing saves; resources are never derived from voxel edits.
export const STARTER_SUPPLIES=Object.freeze({
 [B.DIRT]:8,[B.PLANKS]:12,[B.TORCH]:6,[B.DOOR]:1,
});
export const RECIPES=Object.freeze([
 {id:B.PLANKS,count:4,needs:{[B.WOOD]:1},label:'나무 판자 ×4'},
 {id:B.TORCH,count:4,needs:{[B.PLANKS]:2},label:'횃불 ×4'},
 {id:B.DOOR,count:1,needs:{[B.PLANKS]:4},label:'나무 문'},
 {id:B.FENCE,count:3,needs:{[B.PLANKS]:3},label:'울타리 ×3'},
 {id:B.PATH,count:4,needs:{[B.COBBLE]:2},label:'돌길 ×4'},
 {id:B.LANTERN,count:1,needs:{[B.TORCH]:1,[B.ORE]:1},label:'랜턴'},
]);
export const MAX_STACK=999;
export function harvestDrop(id){
 if(id===B.AIR||id===B.BEDROCK||id===B.WATER||id===B.PORTAL)return null;
 return id===B.GRASS?B.DIRT:id===B.STONE?B.COBBLE:id===B.DOOR_TOP?B.DOOR:id;
}
export class SurvivalInventory{
 constructor(storage=null,world='Overworld'){
  this.storage=storage;this.world=world;this.items=new Map();this.load();
 }
 get key(){return `maktwo:survival:${this.world}`}
 count(id){return this.items.get(Number(id))||0}
 has(id,n=1){return this.count(id)>=n}
 canCraft(recipe){return Boolean(recipe)&&Object.entries(recipe.needs).every(([id,n])=>this.has(Number(id),n))&&this.count(recipe.id)+recipe.count<=MAX_STACK}
 add(id,n=1){
  if(!Number.isInteger(id)||id<=B.AIR||id>=BLOCKS.length||!Number.isSafeInteger(n)||n<1)return 0;
  const amount=Math.min(n,MAX_STACK-this.count(id));if(amount<=0)return 0;
  this.items.set(id,this.count(id)+amount);this.save();return amount;
 }
 remove(id,n=1){if(!Number.isSafeInteger(n)||n<1||!this.has(id,n))return false;const left=this.count(id)-n;if(left)this.items.set(id,left);else this.items.delete(id);this.save();return true}
 craft(recipe){if(!this.canCraft(recipe))return false;
  // Apply all ingredients and the output as a single ledger mutation.
  for(const [id,n] of Object.entries(recipe.needs)){
   const key=Number(id),left=this.count(key)-n;
   if(left)this.items.set(key,left);else this.items.delete(key);
  }
  this.items.set(recipe.id,this.count(recipe.id)+recipe.count);this.save();return true;
 }
 recordHarvest(id){const drop=harvestDrop(id);return drop===null?0:this.add(drop,1)}
 save(){try{this.storage?.setItem(this.key,JSON.stringify({version:1,items:[...this.items]}));return true}catch(error){console.warn('[MakTwo] Inventory not saved',error);return false}}
 load(){let data=null;try{const raw=this.storage?.getItem(this.key);if(raw!==null&&raw!==undefined)data=JSON.parse(raw)}catch{}
  if(data?.version===1&&Array.isArray(data.items)){
   for(const [id,n] of data.items){if(Number.isInteger(id)&&id>0&&id<BLOCKS.length&&Number.isInteger(n)&&n>0)this.items.set(id,Math.min(n,MAX_STACK))}
  }else for(const [id,n] of Object.entries(STARTER_SUPPLIES))this.items.set(Number(id),n);
 }
}

