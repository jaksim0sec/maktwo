// World-owned emissive block index. No renderer dependency and no per-frame chunk scans.
import {SIZE} from './chunk.js';
import {block} from './blocks.js';
import {key} from '../util/math.js';

const positionKey=(x,y,z)=>`${x},${y},${z}`;
export class LightIndex {
 constructor(){this.sources=new Map();this.byChunk=new Map()}
 loadChunk(chunk){
  const chunkKey=key(chunk.cx,chunk.cz);this.unloadChunk(chunkKey);
  const entries=new Set(),ox=chunk.cx*SIZE,oz=chunk.cz*SIZE;
  for(let i=0;i<chunk.data.length;i++){
   const id=chunk.data[i],light=block(id).light;
   if(!light)continue;
   const x=ox+i%SIZE,y=Math.floor(i/(SIZE*SIZE)),z=oz+Math.floor(i/SIZE)%SIZE;
   const posKey=positionKey(x,y,z);entries.add(posKey);
   this.sources.set(posKey,{x:x+.5,y:y+light.offsetY,z:z+.5,id,...light});
  }
  this.byChunk.set(chunkKey,entries);
 }
 update(x,y,z,id){
  const chunkKey=key(Math.floor(x/SIZE),Math.floor(z/SIZE));
  let entries=this.byChunk.get(chunkKey);
  if(!entries){entries=new Set();this.byChunk.set(chunkKey,entries)}
  const posKey=positionKey(x,y,z);entries.delete(posKey);this.sources.delete(posKey);
  const light=block(id).light;
  if(light){entries.add(posKey);this.sources.set(posKey,{x:x+.5,y:y+light.offsetY,z:z+.5,id,...light})}
 }
 unloadChunk(chunkKey){
  const entries=this.byChunk.get(chunkKey);
  if(entries)for(const posKey of entries)this.sources.delete(posKey);
  this.byChunk.delete(chunkKey);
 }
 // Spatial query for every loaded light whose source lies within a light-volume.
 // A distant newly placed torch must not disappear merely because 20 closer lights exist.
 inBounds(minX,maxX,minZ,maxZ,{minY=0,maxY=64,limit=80}={}){
  const chosen=[];
  const firstX=Math.floor(minX/SIZE),lastX=Math.floor((maxX-1e-6)/SIZE);
  const firstZ=Math.floor(minZ/SIZE),lastZ=Math.floor((maxZ-1e-6)/SIZE);
  for(let cx=firstX;cx<=lastX;cx++)for(let cz=firstZ;cz<=lastZ;cz++){
   const entries=this.byChunk.get(key(cx,cz));if(!entries)continue;
   for(const pos of entries){const source=this.sources.get(pos);
    if(source&&source.x>=minX&&source.x<maxX&&source.z>=minZ&&source.z<maxZ&&source.y>=minY&&source.y<maxY)chosen.push(source);
   }
  }
  // Deterministic ordering avoids flickering picks in equally populated chunks.
  chosen.sort((a,b)=>a.x-b.x||a.z-b.z||a.y-b.y);
  return chosen.slice(0,limit);
 }
 near(x,y,z,limit=8,range=32){
  const candidates=[],rangeSq=range*range;
  // Query only loaded chunks overlapping the local light radius.
  // Growing a distant village must not make every frame scan all of its lights.
  const minX=Math.floor((x-range-1)/SIZE),maxX=Math.floor((x+range)/SIZE);
  const minZ=Math.floor((z-range-1)/SIZE),maxZ=Math.floor((z+range)/SIZE);
  for(let cx=minX;cx<=maxX;cx++)for(let cz=minZ;cz<=maxZ;cz++){
   const positions=this.byChunk.get(key(cx,cz));if(!positions)continue;
   for(const pos of positions){
    const light=this.sources.get(pos);if(!light)continue;
    const d2=(light.x-x)**2+(light.y-y)**2+(light.z-z)**2;
    if(d2<=rangeSq)candidates.push({light,d2});
   }
  }
  candidates.sort((a,b)=>a.d2-b.d2);
  return candidates.slice(0,limit).map(entry=>entry.light);
 }
}
