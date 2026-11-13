import {Chunk,SIZE,HEIGHT,TURN_STYLE,CITY_STAIR_STYLE,CITY_STAIR_LEVEL_MASK} from './chunk.js';import {BLOCK as B,BLOCKS,block} from './blocks.js';import {generateChunk,surfaceAt,SEA,GENERATION_VERSION} from '../worldgen/generators.js';import {key} from '../util/math.js';import {EventBus} from './events.js';
import {partGallerySpawn} from '../worldgen/part-gallery.js';
import {CITY_MODE,CITY_HEIGHT,citySpawnCandidates} from '../worldgen/eternal-night-game.js';
import {partById} from './part-library.js';
import {decodeSplitTread} from '../worldgen/eternal-night-stairs.js';
import {stairConnections,stairRailRise} from './part-prisms.js';import {LightIndex} from './lighting.js';
import {isDoor,doorIntersectsBody} from './door.js';
import {FORMED,supportsForms} from './construction.js';
import {isWallItem,mountCell} from './mounts.js';

export class World{
 constructor({seed=12345,mode='normal',name='Overworld',storage=null}={}){this.seed=seed|0;this.mode=mode;this.height=mode===CITY_MODE?CITY_HEIGHT:HEIGHT;this.saveKey=mode===CITY_MODE?name+':precincts':name;this.version=GENERATION_VERSION;this.name=name;this.storage=storage;this.chunks=new Map();this.edits=new Map();this.blockStates=new Map();this.forms=new Map();this.mounts=new Map();this.queue=[];this.queued=new Set();this.events=new EventBus();this.time=18000;this.lights=new LightIndex();this.lightRevision=0;this.lightChunkRevision=0;this.maxChunks=56;this.tickCount=0;this.loadEdits()}
 getChunk(cx,cz,create=true){const k=key(cx,cz);let c=this.chunks.get(k);if(!c&&create){c=generateChunk(new Chunk(cx,cz,this.height),this.seed,this.mode);this.chunks.set(k,c);const saved=this.edits.get(k);if(saved)for(const [idx,id] of saved){c.data[idx]=id;if(c.styles)c.styles[idx]=0}const forms=this.forms.get(k);
 if(forms){c.forms=new Uint8Array(c.data.length);for(const [idx,form] of forms)c.forms[idx]=form}
 c.mounts=this.mounts.get(k);
 c.dirty=true;this.lights.loadChunk(c);this.lightChunkRevision++;this.markDirty(cx-1,cz);this.markDirty(cx+1,cz);this.markDirty(cx,cz-1);this.markDirty(cx,cz+1);this.events.emit('chunk-load',c)}return c}
 isLightBlocking(id,x,y,z,form=this.getForm(x,y,z)){return isDoor(id)?!this.getDoorState(x,y,z).open:Boolean(BLOCKS[id]?.opaque)&&!form}
 stateKey(x,y,z){return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`}
 partFacing(x,y,z){
  const authored=this.blockStates.get(this.stateKey(x,y,z));
  if(authored)return authored.facing||0;
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),chunk=this.getChunk(cx,cz,false);
  const style=chunk?.styles?.[Chunk.index(Math.floor(x)-cx*SIZE,Math.floor(y),Math.floor(z)-cz*SIZE)]||0;
  return decodeSplitTread(style)?.facing??(style&TURN_STYLE?style&7:0);
 }
 getShapeState(x,y,z){
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz,false);
  const y0=Math.floor(y),variant=y0>=0&&y0<this.height?(c?.styles?.[Chunk.index(Math.floor(x)-cx*SIZE,y0,Math.floor(z)-cz*SIZE)]||0):0;
  const cityStair=Boolean(variant&CITY_STAIR_STYLE);
  const split=decodeSplitTread(variant);
  const state={facing:split?.facing??(variant&TURN_STYLE?variant&7:0),upper:false,
   variant:variant&TURN_STYLE?0:variant,
   ...(cityStair?{cityStair:true,treadHeight:split?.high??(((variant&CITY_STAIR_LEVEL_MASK)>>3)+1)/4,rail:Boolean(variant&64),splitTread:split}:{}),
   ...this.blockStates.get(this.stateKey(x,y,z))};
  if(cityStair&&partById(this.get(x,y,z,false))?.family==='passage'){
   state.cityBridge=true;state.cityStair=false;state.bridgePost=Boolean(variant&8);
   delete state.treadHeight;delete state.rail;
  }
  const id=this.get(x,y,z,false);
  if(partById(id)?.family==='staircase'){
   const neighbor=(dx,dz,dy=0)=>{
    const nx=Math.floor(x)+dx,nz=Math.floor(z)+dz;
    const other=this.get(nx,y+dy,nz,false);
    const c=this.getChunk(Math.floor(nx/SIZE),Math.floor(nz/SIZE),false),
     style=c?.styles?.[Chunk.index((nx%SIZE+SIZE)%SIZE,Math.floor(y+dy),(nz%SIZE+SIZE)%SIZE)]||0;
    const split=decodeSplitTread(style);
    return {id:other,facing:this.partFacing(nx,y+dy,nz),
     treadHeight:split?.low??(style&CITY_STAIR_STYLE?(((style&CITY_STAIR_LEVEL_MASK)>>3)+1)/4:undefined)};
   };
   state.connected=stairConnections(id,state.facing,neighbor);
   if(split||variant&TURN_STYLE)state.stairRise=stairRailRise(state.facing,neighbor,split?.low??(state.cityStair?state.treadHeight:undefined));
  }
  return state;
 }
 setShapeState(x,y,z,state={}){
  const id=this.get(x,y,z,false);if(id===B.AIR||isDoor(id))return false;
  const turns=partById(id)?8:4;
  this.blockStates.set(this.stateKey(x,y,z),{facing:((state.facing||0)%turns+turns)%turns,
   upper:Boolean(state.upper),...(state.panelTurn!==undefined?{panelTurn:state.panelTurn&3}:{})});
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),lx=Math.floor(x)-cx*SIZE,lz=Math.floor(z)-cz*SIZE;
  this.markDirty(cx,cz);
  // Rails in the adjacent chunk depend on the updated orientation.
  if(lx===0)this.markDirty(cx-1,cz);if(lx===SIZE-1)this.markDirty(cx+1,cz);
  if(lz===0)this.markDirty(cx,cz-1);if(lz===SIZE-1)this.markDirty(cx,cz+1);
  this.lightRevision++;return true;
 }
 getDoorState(x,y,z){const yBase=this.get(x,y,z,false)===B.DOOR_TOP?Math.floor(y)-1:Math.floor(y);return {...this.getShapeState(x,yBase,z),open:false,...this.blockStates.get(this.stateKey(x,yBase,z))}}
 setDoorState(x,y,z,{facing=0,open=false}={}){const baseY=this.get(x,y,z,false)===B.DOOR_TOP?Math.floor(y)-1:Math.floor(y);if(this.get(x,baseY,z)!==B.DOOR)return false;this.blockStates.set(this.stateKey(x,baseY,z),{facing:((facing%4)+4)%4,open:!!open});this.markDirty(Math.floor(x/SIZE),Math.floor(z/SIZE));this.lightRevision++;this.events.emit('door-change',{x,y:baseY,z});return true}
 toggleDoor(x,y,z,occupants=[]){
  const bx=Math.floor(x),bz=Math.floor(z),baseY=this.get(x,y,z)===B.DOOR_TOP?Math.floor(y)-1:Math.floor(y);
  if(this.get(bx,baseY,bz)!==B.DOOR)return false;
  const previous=this.getDoorState(bx,baseY,bz),next={...previous,open:!previous.open};
  // Reject a swing/closure into an actor before the block geometry changes.
  // Failing safely here avoids pushing players through floors or over rooftops.
  for(const body of occupants||[])if(body&&!body.dead&&doorIntersectsBody(bx,baseY,bz,next,body))return false;
  return this.setDoorState(bx,baseY,bz,next);
 }
 placeDoor(x,y,z,facing=0,occupants=[]){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<1||y+1>=this.height||!block(this.get(x,y,z)).replaceable||!block(this.get(x,y+1,z)).replaceable)return false;const lower=this.get(x,y,z),upper=this.get(x,y+1,z);
  const state={facing,open:false};for(const actor of occupants)if(actor&&!actor.dead&&doorIntersectsBody(x,y,z,state,actor))return false;
  if(!this.set(x,y,z,B.DOOR))return false;if(!this.set(x,y+1,z,B.DOOR_TOP)){this.set(x,y,z,lower);return false}this.setDoorState(x,y,z,{facing,open:false});return true}
 removeDoor(x,y,z){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);const id=this.get(x,y,z);if(!isDoor(id))return false;const baseY=id===B.DOOR_TOP?y-1:y;this.blockStates.delete(this.stateKey(x,baseY,z));if(this.get(x,baseY,z)===B.DOOR)this.set(x,baseY,z,B.AIR);if(this.get(x,baseY+1,z)===B.DOOR_TOP)this.set(x,baseY+1,z,B.AIR);return true}
 get(x,y,z,create=true,cell=null){
  if(cell){cell.form=0;cell.mount=null}
  x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
  if(y<0)return B.BEDROCK;if(y>=this.height)return B.AIR;
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz,create);
  if(!c)return B.AIR;
  const i=Chunk.index(x-cx*SIZE,y,z-cz*SIZE);
  if(cell){cell.form=c.forms?.[i]||0;if(cell.pickMount)cell.mount=c.mounts?.get(i)}
  return c.data[i];
 }
 getForm(x,y,z){
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz,false);
  return c?.forms?.[Chunk.index(x-cx*SIZE,y,z-cz*SIZE)]||0;
 }
 placeMount(id,target,facing=0){
  if(!isWallItem(id)||!target.anchor||!target.normal||Math.abs(target.normal.y)>1e-6)return false;
  const {x,y,z}=target.anchor,{x:nx,z:nz}=target.normal;
  if(Math.abs(Math.hypot(nx,nz)-1)>1e-6)return false;
  const support=this.get(target.x,target.y,target.z);
  if(!block(support).solid||support!==target.id)return false;
  const mount={id,x,y,z,nx,nz,facing:facing&3,sx:target.x,sy:target.y,sz:target.z};
  const cell=mountCell(mount);
  if(!cell)return false;
  const [bx,by,bz]=cell;
  if(by<1||by>=this.height)return false;
  const same=bx===mount.sx&&by===mount.sy&&bz===mount.sz;
  if(!same&&!block(this.get(bx,by,bz)).replaceable)return false;
  const cx=Math.floor(bx/SIZE),cz=Math.floor(bz/SIZE),k=key(cx,cz),chunk=this.getChunk(cx,cz);
  const idx=Chunk.index(bx-cx*SIZE,by,bz-cz*SIZE);
  if(chunk.mounts?.has(idx))return false;
  if(!chunk.mounts){chunk.mounts=new Map();this.mounts.set(k,chunk.mounts)}
  chunk.mounts.set(idx,mount);
  this.lights.updateMount(cx,cz,idx,mount);
  this.markDirty(cx,cz);this.lightRevision++;
  return true;
 }
 removeMount(x,y,z,{detach=false}={}){
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),k=key(cx,cz);
  const idx=Chunk.index(x-cx*SIZE,y,z-cz*SIZE),mounts=this.mounts.get(k);
  const mount=mounts?.get(idx);
  if(!mount)return false;
  mounts.delete(idx);
  if(!mounts.size){this.mounts.delete(k);const chunk=this.getChunk(cx,cz,false);if(chunk)chunk.mounts=undefined}
  this.lights.updateMount(cx,cz,idx,null);
  this.markDirty(cx,cz);this.lightRevision++;
  if(detach)this.events.emit('mount-detach',mount);
  return true;
 }
 detachMounts(x,y,z){
  if(!this.mounts.size)return;
  // A vertical mount occupies its support cell or the one across its face.
  for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
   const bx=x+dx,bz=z+dz,cx=Math.floor(bx/SIZE),cz=Math.floor(bz/SIZE);
   const mount=this.mounts.get(key(cx,cz))?.get(Chunk.index(bx-cx*SIZE,y,bz-cz*SIZE));
   if(mount&&(dx===0&&dz===0||mount.sx===x&&mount.sy===y&&mount.sz===z))this.removeMount(bx,y,bz,{detach:true});
  }
 }
 set(x,y,z,id,{simulate=true,record=true,form=0}={}){
  x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
  if(y<=0||y>=this.height||!Number.isInteger(id)||id<0||id>=BLOCKS.length||!Number.isInteger(form)||form!==0&&(!FORMED[form]||!supportsForms(id)))return false;
  const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz),k=key(cx,cz);
  const lx=x-cx*SIZE,lz=z-cz*SIZE,idx=Chunk.index(lx,y,lz),oldId=c.data[idx],oldForm=c.forms?.[idx]||0;
  if(oldId===id&&oldForm===form)return false;
  c.set(lx,y,lz,id);if(c.styles)c.styles[idx]=0;
  if(oldForm!==form){
   if(!c.forms)c.forms=new Uint8Array(c.data.length);
   c.forms[idx]=form;
   this.markDirty(cx,cz);
   if(record){
    let shapes=this.forms.get(k);
    if(form){if(!shapes)this.forms.set(k,shapes=new Map());shapes.set(idx,form)}
    else if(shapes){shapes.delete(idx);if(!shapes.size){this.forms.delete(k);c.forms=undefined}}
   }
  }
  this.detachMounts(x,y,z);
  // Keep both halves of a door consistent even when an external system (blast)
  // changes just one cell.
  if(oldId===B.DOOR&&id!==B.DOOR&&this.get(x,y+1,z)===B.DOOR_TOP)this.set(x,y+1,z,B.AIR,{simulate,record});
  else if(oldId===B.DOOR_TOP&&id!==B.DOOR_TOP&&this.get(x,y-1,z)===B.DOOR)this.set(x,y-1,z,B.AIR,{simulate,record});
  if(id!==B.DOOR)this.blockStates.delete(this.stateKey(x,y,z));this.lights.update(x,y,z,id);
  if(block(oldId).light||block(id).light||isDoor(oldId)||isDoor(id)||(block(oldId).opaque&&!oldForm)!==(block(id).opaque&&!form))
   this.lightRevision++;
  if(record){const k=key(cx,cz),idx=Chunk.index(lx,y,lz);let edits=this.edits.get(k);if(!edits)this.edits.set(k,edits=new Map());edits.set(idx,id)}
  if(lx===0)this.markDirty(cx-1,cz);if(lx===15)this.markDirty(cx+1,cz);if(lz===0)this.markDirty(cx,cz-1);if(lz===15)this.markDirty(cx,cz+1);
  this.events.emit('block-change',{x,y,z,id});if(simulate){this.schedule(x,y,z);for(const [dx,dy,dz] of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]])this.schedule(x+dx,y+dy,z+dz)}return true}
 markDirty(cx,cz){const c=this.chunks.get(key(cx,cz));if(c){c.dirty=true;c.revision++}}
 schedule(x,y,z){if(y<1||y>=this.height)return;const k=`${x|0},${y|0},${z|0}`;if(!this.queued.has(k)){this.queued.add(k);this.queue.push([x|0,y|0,z|0,k])}}
 tick(){
  this.tickCount++; // The world has no sunrise; time stays in deep twilight.
  // A single batch splice avoids repeatedly shifting a potentially large queue.
  // Newly scheduled updates remain queued for the next simulation tick.
  const batch=this.queue.splice(0,Math.min(80,this.queue.length));
  for(const [x,y,z,k] of batch){
   this.queued.delete(k);const id=this.get(x,y,z);
   if(id===B.SAND&&block(this.get(x,y-1,z)).replaceable){
    this.set(x,y-1,z,B.SAND,{simulate:true});this.set(x,y,z,B.AIR,{simulate:true});
   } // Water stays contained until source/flow states can be simulated reversibly.
  }
 }


 // Undo accidental floods without erasing natural lakes or any placed solid blocks.
 // Water from old simulated flow was saved as WATER edits, so it is recoverable too.
 drainPlacedWater(x,y,z,radius=20){
  const radius2=radius*radius,selected=[];
  for(const [k,edits] of this.edits){
   const [cx,cz]=k.split(',').map(Number),ox=cx*SIZE,oz=cz*SIZE;
   for(const [idx,id] of edits){
    if(id!==B.WATER)continue;
    const bx=ox+idx%SIZE,by=Math.floor(idx/(SIZE*SIZE)),bz=oz+Math.floor(idx/SIZE)%SIZE;
    if((bx+.5-x)**2+(bz+.5-z)**2>radius2||Math.abs(by+.5-y)>radius)continue;
    selected.push({k,idx,cx,cz,bx,by,bz});
   }
  }
  if(!selected.length)return 0;
  // Keep the entire current edit snapshot available before modifying anything.
  if(this.storage)this.storage.setItem('mcweb:'+this.saveKey+':before-water-cleanup',this.snapshot());
  const originals=new Map();
  for(const entry of selected){
   let base=originals.get(entry.k);
   if(!base){base=generateChunk(new Chunk(entry.cx,entry.cz,this.height),this.seed,this.mode);originals.set(entry.k,base)}
   const bx=entry.bx,by=entry.by,bz=entry.bz;
   const original=base.get(bx-entry.cx*SIZE,by,bz-entry.cz*SIZE);
   this.edits.get(entry.k)?.delete(entry.idx);
   if(this.edits.get(entry.k)?.size===0)this.edits.delete(entry.k);
   const loaded=this.chunks.get(entry.k);
   if(loaded)this.set(bx,by,bz,original,{simulate:false,record:false});
  }
  // Old queued water events are now harmless; preserve all other block updates.
  this.save();
  return selected.length;
 }
 snapshot(){const edits={};for(const [k,m] of this.edits)edits[k]=[...m];return JSON.stringify({seed:this.seed,mode:this.mode,generationVersion:this.version,time:this.time,edits,states:[...this.blockStates],forms:[...this.forms].map(([k,m])=>[k,[...m]]),mounts:[...this.mounts].map(([k,m])=>[k,[...m]])})}

 stream(x,z,radius=3,budget=2,{roundEdges=false}={}){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);let generated=0;outer:for(let r=0;r<=radius;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r||(roundEdges&&r===radius&&Math.abs(dx)+Math.abs(dz)>radius+1))continue;const tx=cx+dx,tz=cz+dz;if(this.chunks.has(key(tx,tz)))continue;this.getChunk(tx,tz);if(++generated>=budget)break outer}if(this.chunks.size>this.maxChunks){for(const k of this.chunks.keys()){const [a,b]=k.split(',').map(Number);if(Math.max(Math.abs(a-cx),Math.abs(b-cz))>radius+1){this.chunks.delete(k);this.lights.unloadChunk(k);this.lightChunkRevision++;this.events.emit('chunk-unload',k)}if(this.chunks.size<=this.maxChunks)break}}}
 spawn(){
  if(this.mode===CITY_MODE){
   let fallback;
   for(const pos of citySpawnCandidates(this.seed)){
    fallback??=pos;
    const {x,y,z}=pos;
    if(block(this.get(x,y-1,z)).opaque&&this.get(x,y,z)===B.AIR&&this.get(x,y+1,z)===B.AIR)return pos;
   }
   if(fallback)return fallback;
  }
  if(this.mode==='materials')return {x:18.5,y:25,z:38.5};
   if(this.mode==='parts')return partGallerySpawn(0);
  if(this.mode.startsWith('building:'))return {x:9.5,y:25,z:-2.5};
  let x=0,z=0;for(let r=0;r<32;r++){x=r*3;z=r*2;
  const y=surfaceAt(x,z,this.seed,this.mode);if(y<SEA+1)continue;
  if(this.mode==='ruins'&&(this.get(x,y+1,z)!==B.AIR||this.get(x,y+2,z)!==B.AIR))continue;
  return{x:x+.5,y:y+2,z:z+.5};
 }return{x:.5,y:30,z:.5}}
 save(){if(!this.storage)return false;this.storage.setItem('mcweb:'+this.saveKey,this.snapshot());return true}
 loadEdits(){if(!this.storage)return;try{const d=JSON.parse(this.storage.getItem('mcweb:'+this.saveKey)||'null');if(d&&d.seed===this.seed&&d.mode===this.mode){if(d.generationVersion!==GENERATION_VERSION){try{const backup='mcweb:'+this.saveKey+':before-generator-unification';if(!this.storage.getItem(backup))this.storage.setItem(backup,JSON.stringify(d))}catch{}}this.time=18000;for(const [k,arr] of Object.entries(d.edits||{}))this.edits.set(k,new Map(arr));for(const [k,state] of d.states||[])this.blockStates.set(k,state);
 for(const [k,arr] of d.forms||[])this.forms.set(k,new Map(arr.filter(([idx,form])=>FORMED[form]&&supportsForms(this.edits.get(k)?.get(idx)))));
 for(const [k,arr] of d.mounts||[])this.mounts.set(k,new Map(arr.filter(([,mount])=>isWallItem(mount?.id))));
 }}catch{}}
}
export class WorldManager{constructor(storage=null){this.storage=storage;this.worlds=new Map();this.active=null}add(name,seed,mode='normal'){const w=new World({name,seed,mode,storage:this.storage});this.worlds.set(name,w);if(!this.active)this.active=w;return w}travel(name){const dest=this.worlds.get(name);if(!dest)throw Error('Unknown world '+name);this.active.save();this.active=dest;return dest}}
