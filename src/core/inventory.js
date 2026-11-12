import {BLOCK as B,BLOCKS,HOTBAR,HOTBAR_SIZE} from './blocks.js';
import {RECIPES,recipeGrid,matchesPattern} from './crafting.js';
export {RECIPES} from './crafting.js';

// A separate player-owned ledger. World/chunk snapshots remain byte-for-byte
// compatible with existing saves; resources are never derived from voxel edits.
export const STARTER_SUPPLIES=Object.freeze({
 [B.DIRT]:8,[B.PLANKS]:12,[B.TORCH]:6,[B.DOOR]:1,
});
export const MAX_STACK=999;
export function harvestDrop(id){
 if(id===B.AIR||id===B.BEDROCK||id===B.WATER||id===B.PORTAL)return null;
 return id===B.GRASS?B.DIRT:id===B.STONE?B.COBBLE:id===B.DOOR_TOP?B.DOOR:id;
}
export class SurvivalInventory{
 constructor(storage=null,world='Overworld'){
  this.storage=storage;this.world=world;this.items=new Map();this.seen=new Set();this.quickSlots=[...HOTBAR];this.load();
 }
 get key(){return `maktwo:survival:${this.world}`}
 count(id){return this.items.get(Number(id))||0}
 discovered(id){return this.seen.has(Number(id))}
 knownRecipes(station='hand'){
  return RECIPES.filter(recipe=>(station==='bench'||recipe.station==='hand')&&Object.keys(recipe.needs).every(id=>this.discovered(id)));
 }
 assignQuickSlot(id,index=null){
  id=Number(id);if(!this.discovered(id)||id<=0||id>=BLOCKS.length)return -1;
  const existing=this.quickSlots.indexOf(id);if(existing!==-1)return existing;
  const empty=this.quickSlots.indexOf(null);
  const slot=index!==null&&index>=0&&index<HOTBAR_SIZE?index:empty;
  if(slot<0)return -1;
  this.quickSlots[slot]=id;this.save();return slot;
 }

 has(id,n=1){return this.count(id)>=n}
 canCraft(recipe,station='hand'){
  return Boolean(recipe)&&RECIPES.includes(recipe)&&this.knownRecipes(station).includes(recipe)
   &&(recipe.station==='hand'||station==='bench')
   &&matchesPattern(recipeGrid(recipe),recipe)
   &&Object.entries(recipe.needs).every(([id,n])=>this.has(Number(id),n))
   &&this.count(recipe.id)+recipe.count<=MAX_STACK;
 }

 add(id,n=1){
  if(!Number.isInteger(id)||id<=B.AIR||id>=BLOCKS.length||!Number.isSafeInteger(n)||n<1)return 0;
  const amount=Math.min(n,MAX_STACK-this.count(id));if(amount<=0)return 0;
  this.items.set(id,this.count(id)+amount);this.seen.add(id);this.save();return amount;
 }
 remove(id,n=1){if(!Number.isSafeInteger(n)||n<1||!this.has(id,n))return false;const left=this.count(id)-n;if(left)this.items.set(id,left);else this.items.delete(id);this.save();return true}
 craft(recipe,station='hand'){if(!this.canCraft(recipe,station))return false;
  // Apply all ingredients and the output as a single ledger mutation.
  for(const [id,n] of Object.entries(recipe.needs)){
   const key=Number(id),left=this.count(key)-n;
   if(left)this.items.set(key,left);else this.items.delete(key);
  }
  this.items.set(recipe.id,this.count(recipe.id)+recipe.count);this.seen.add(recipe.id);this.save();return true;
 }
 recordHarvest(id){const drop=harvestDrop(id);return drop===null?0:this.add(drop,1)}
 save(){try{this.storage?.setItem(this.key,JSON.stringify({version:2,items:[...this.items],seen:[...this.seen],quickSlots:this.quickSlots}));return true}catch(error){console.warn('[MakTwo] Inventory not saved',error);return false}}
 load(){let data=null;try{const raw=this.storage?.getItem(this.key);if(raw!==null&&raw!==undefined)data=JSON.parse(raw)}catch{}
  if((data?.version===1||data?.version===2)&&Array.isArray(data.items)){
   for(const [id,n] of data.items){if(Number.isInteger(id)&&id>0&&id<BLOCKS.length&&Number.isInteger(n)&&n>0)this.items.set(id,Math.min(n,MAX_STACK))}
   if(data.version===2){for(const id of data.seen||[])if(Number.isInteger(id)&&id>0&&id<BLOCKS.length)this.seen.add(id);if(Array.isArray(data.quickSlots)&&data.quickSlots.length===HOTBAR_SIZE)this.quickSlots=data.quickSlots.map(id=>id===null?null:(Number.isInteger(id)&&id>0&&id<BLOCKS.length?id:null));}
  }else for(const [id,n] of Object.entries(STARTER_SUPPLIES))this.items.set(Number(id),n);
  for(const id of this.items.keys())this.seen.add(id);
 }
}

