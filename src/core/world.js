import {Chunk,SIZE,HEIGHT} from './chunk.js';import {BLOCK as B,BLOCKS,block} from './blocks.js?v=0.9.0';import {generateChunk,surfaceAt,SEA} from '../worldgen/generators.js';import {key} from '../util/math.js';import {EventBus} from './events.js';import {LightIndex} from './lighting.js';
export class World{
 constructor({seed=12345,mode='normal',name='Overworld',storage=null}={}){this.seed=seed|0;this.mode=mode;this.name=name;this.storage=storage;this.chunks=new Map();this.edits=new Map();this.queue=[];this.queued=new Set();this.events=new EventBus();this.time=18000;this.lights=new LightIndex();this.lightRevision=0;this.maxChunks=100;this.tickCount=0;this.loadEdits()}
 getChunk(cx,cz,create=true){const k=key(cx,cz);let c=this.chunks.get(k);if(!c&&create){c=generateChunk(new Chunk(cx,cz),this.seed,this.mode);this.chunks.set(k,c);const saved=this.edits.get(k);if(saved)for(const [idx,id] of saved)c.data[idx]=id;c.dirty=true;this.lights.loadChunk(c);this.lightRevision++;this.markDirty(cx-1,cz);this.markDirty(cx+1,cz);this.markDirty(cx,cz-1);this.markDirty(cx,cz+1);this.events.emit('chunk-load',c)}return c}
 isLightBlocking(id){return Boolean(BLOCKS[id]?.opaque)}
 get(x,y,z,create=true){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0)return B.BEDROCK;if(y>=HEIGHT)return B.AIR;const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz,create);return c?c.get(x-cx*SIZE,y,z-cz*SIZE):B.AIR}
 set(x,y,z,id,{simulate=true,record=true}={}){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<=0||y>=HEIGHT||!Number.isInteger(id)||id<0||id>=BLOCKS.length)return false;const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),c=this.getChunk(cx,cz);const lx=x-cx*SIZE,lz=z-cz*SIZE;if(!c.set(lx,y,lz,id))return false;this.lights.update(x,y,z,id);this.lightRevision++;
  if(record){const k=key(cx,cz),idx=Chunk.index(lx,y,lz);let edits=this.edits.get(k);if(!edits)this.edits.set(k,edits=new Map());edits.set(idx,id)}
  if(lx===0)this.markDirty(cx-1,cz);if(lx===15)this.markDirty(cx+1,cz);if(lz===0)this.markDirty(cx,cz-1);if(lz===15)this.markDirty(cx,cz+1);
  this.events.emit('block-change',{x,y,z,id});if(simulate){this.schedule(x,y,z);for(const [dx,dy,dz] of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]])this.schedule(x+dx,y+dy,z+dz)}return true}
 markDirty(cx,cz){const c=this.chunks.get(key(cx,cz));if(c){c.dirty=true;c.revision++}}
 schedule(x,y,z){if(y<1||y>=HEIGHT)return;const k=`${x|0},${y|0},${z|0}`;if(!this.queued.has(k)){this.queued.add(k);this.queue.push([x|0,y|0,z|0,k])}}
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
  if(this.storage)this.storage.setItem('mcweb:'+this.name+':before-water-cleanup',this.snapshot());
  const originals=new Map();
  for(const entry of selected){
   let base=originals.get(entry.k);
   if(!base){base=generateChunk(new Chunk(entry.cx,entry.cz),this.seed,this.mode);originals.set(entry.k,base)}
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
 snapshot(){const edits={};for(const [k,m] of this.edits)edits[k]=[...m];return JSON.stringify({seed:this.seed,mode:this.mode,time:this.time,edits})}

 stream(x,z,radius=3,budget=2){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);let generated=0;outer:for(let r=0;r<=radius;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const tx=cx+dx,tz=cz+dz;if(this.chunks.has(key(tx,tz)))continue;this.getChunk(tx,tz);if(++generated>=budget)break outer}if(this.chunks.size>this.maxChunks){for(const k of this.chunks.keys()){const [a,b]=k.split(',').map(Number);if(Math.max(Math.abs(a-cx),Math.abs(b-cz))>radius+1){this.chunks.delete(k);this.lights.unloadChunk(k);this.lightRevision++;this.events.emit('chunk-unload',k)}if(this.chunks.size<=this.maxChunks)break}}}
 spawn(){let x=0,z=0;for(let r=0;r<20;r++){x=r*3;z=r*2;const y=surfaceAt(x,z,this.seed,this.mode);if(y>=SEA+1)return{x:x+.5,y:y+2,z:z+.5}}return{x:.5,y:30,z:.5}}
 save(){if(!this.storage)return false;this.storage.setItem('mcweb:'+this.name,this.snapshot());return true}
 loadEdits(){if(!this.storage)return;try{const d=JSON.parse(this.storage.getItem('mcweb:'+this.name)||'null');if(d&&d.seed===this.seed&&d.mode===this.mode){this.time=18000;for(const [k,arr] of Object.entries(d.edits||{}))this.edits.set(k,new Map(arr))}}catch{}}
}
export class WorldManager{constructor(storage=null){this.storage=storage;this.worlds=new Map();this.active=null}add(name,seed,mode='normal'){const w=new World({name,seed,mode,storage:this.storage});this.worlds.set(name,w);if(!this.active)this.active=w;return w}travel(name){const dest=this.worlds.get(name);if(!dest)throw Error('Unknown world '+name);this.active.save();this.active=dest;return dest}}
