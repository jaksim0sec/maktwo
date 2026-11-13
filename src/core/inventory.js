import {BLOCK as B,BLOCKS,HOTBAR,HOTBAR_SIZE,itemId} from './blocks.js';
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
 return id===B.GRASS?B.DIRT:id===B.STONE?B.COBBLE:id===B.DOOR_TOP?B.DOOR:itemId(id);
}
export class SurvivalInventory{
 constructor(storage=null,world='Overworld'){
  this.storage=storage;this.world=world;this.items=new Map();this.containers=new Map();this.checkpoint=null;this.seen=new Set();this.quickSlots=[...HOTBAR];this.load();
 }
 get key(){return `maktwo:survival:${this.world}`}
 count(id){return this.items.get(itemId(Number(id)))||0}
 discovered(id){return this.seen.has(itemId(Number(id)))}
 knownRecipes(station='hand'){
  return RECIPES.filter(recipe=>(station==='bench'||recipe.station==='hand')&&Object.keys(recipe.needs).every(id=>this.discovered(id)));
 }
 assignQuickSlot(id,index=null){
  id=itemId(Number(id));if(!this.discovered(id)||id<=0||id>=BLOCKS.length)return -1;
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
  id=itemId(id);
  const amount=Math.min(n,MAX_STACK-this.count(id));if(amount<=0)return 0;
  this.items.set(id,this.count(id)+amount);this.seen.add(id);this.save();return amount;
 }
 remove(id,n=1){if(!Number.isSafeInteger(n)||n<1||!this.has(id,n))return false;id=itemId(id);const left=this.count(id)-n;if(left)this.items.set(id,left);else{this.items.delete(id);this.quickSlots=this.quickSlots.map(slot=>slot===id?null:slot)}this.save();return true}
 craft(recipe,station='hand'){if(!this.canCraft(recipe,station))return false;
  // Apply all ingredients and the output as a single ledger mutation.
  for(const [id,n] of Object.entries(recipe.needs)){
   const key=Number(id),left=this.count(key)-n;
   if(left)this.items.set(key,left);else this.items.delete(key);
  }
  this.items.set(recipe.id,this.count(recipe.id)+recipe.count);this.seen.add(recipe.id);this.save();return true;
 }
 recordHarvest(id){const drop=harvestDrop(id);return drop===null?0:this.add(drop,1)}
 clearCarried(){
  this.items.clear();
  this.quickSlots.fill(null);
  return this.save();
 }
 transfer(key,id,deposit){
  const previous=this.containers.get(key),stored=new Map(previous);
  const from=deposit?this.items:stored,to=deposit?stored:this.items;
  const source=from.get(id)||0,destination=to.get(id)||0;
  const count=Math.min(source,MAX_STACK-destination);
  if(count<=0)return false;
  const slots=this.quickSlots,known=this.seen.has(id);
  if(count===source)from.delete(id);else from.set(id,source-count);
  to.set(id,destination+count);
  if(deposit&&!from.has(id))this.quickSlots=slots.map(slot=>slot===id?null:slot);
  if(!deposit){
   this.seen.add(id);
   if(!slots.includes(id)&&slots.includes(null)){
    this.quickSlots=[...slots];
    this.quickSlots[slots.indexOf(null)]=id;
   }
  }
  if(stored.size)this.containers.set(key,stored);else this.containers.delete(key);
  if(this.save())return true;
  const original=deposit?source:destination;
  if(original)this.items.set(id,original);else this.items.delete(id);
  if(previous)this.containers.set(key,previous);else this.containers.delete(key);
  this.quickSlots=slots;if(!known)this.seen.delete(id);
  return false;
 }
 save(){try{this.storage?.setItem(this.key,JSON.stringify({version:2,items:[...this.items],seen:[...this.seen],quickSlots:this.quickSlots,checkpoint:this.checkpoint,containers:[...this.containers].map(([key,items])=>[key,[...items]])}));return true}catch(error){console.warn('[MakTwo] Inventory not saved',error);return false}}
 load(){let data=null;try{const raw=this.storage?.getItem(this.key);if(raw!==null&&raw!==undefined)data=JSON.parse(raw)}catch{}
  if((data?.version===1||data?.version===2)&&Array.isArray(data.items)){
   for(const [id,n] of data.items){
    if(!Number.isInteger(id)||id<=0||id>=BLOCKS.length||!Number.isSafeInteger(n)||n<1)continue;
    const canonical=itemId(id);
    const limit=canonical===B.WINDOW_NS||canonical===B.THIN_WALL_NS?2*MAX_STACK:MAX_STACK;
    this.items.set(canonical,Math.min(this.count(id)+n,limit));
   }
   if(data.version===2){for(const id of data.seen||[])if(Number.isInteger(id)&&id>0&&id<BLOCKS.length)this.seen.add(itemId(id));if(Array.isArray(data.quickSlots)&&data.quickSlots.length===HOTBAR_SIZE)this.quickSlots=data.quickSlots.map(id=>id===null?null:(Number.isInteger(id)&&id>0&&id<BLOCKS.length&&this.count(id)>0?itemId(id):null));}
  }else for(const [id,n] of Object.entries(STARTER_SUPPLIES))this.items.set(Number(id),n);
  const checkpoint=data?.checkpoint;
  if(checkpoint&&[checkpoint.x,checkpoint.y,checkpoint.z].every(Number.isSafeInteger))this.checkpoint=checkpoint;
  for(const entry of Array.isArray(data?.containers)?data.containers:[]){
   if(!Array.isArray(entry)||typeof entry[0]!=='string'||!Array.isArray(entry[1]))continue;
   const stored=new Map();
   for(const stack of entry[1]){
    if(!Array.isArray(stack))continue;
    const [id,count]=stack;
    if(Number.isInteger(id)&&id>B.AIR&&id<BLOCKS.length&&Number.isSafeInteger(count)&&count>0){
     const canonical=itemId(id);
     stored.set(canonical,Math.min(MAX_STACK,(stored.get(canonical)||0)+count));
    }
   }
   if(stored.size)this.containers.set(entry[0],stored);
  }
  const assigned=new Set();
  this.quickSlots=this.quickSlots.map(id=>{
   const canonical=itemId(id);
   if(canonical==null||assigned.has(canonical)||this.count(canonical)===0)return null;
   assigned.add(canonical);
   return canonical;
  });
  for(const id of this.items.keys())this.seen.add(id);
 }
}


export class CreativeInventory {
 constructor(items){
  this.items=new Set(items);
  this.quickSlots=[B.CONCRETE,B.PLANKS,B.TORCH,B.SHOP_SIGN,B.GLASS,null,null];
 }
 count(id){return this.items.has(id)?Infinity:0}
 has(id){return this.items.has(id)}
 knownRecipes(){return RECIPES}
 canCraft(recipe){return RECIPES.includes(recipe)}
 craft(recipe){return this.canCraft(recipe)}
 remove(id){return this.has(id)}
 save(){}
 assignQuickSlot(id,index=null){
  if(!this.has(id))return -1;
  const existing=this.quickSlots.indexOf(id);
  if(existing>=0)return existing;
  const slot=index??this.quickSlots.indexOf(null);
  if(slot<0||slot>=HOTBAR_SIZE)return -1;
  this.quickSlots[slot]=id;
  return slot;
 }
}
