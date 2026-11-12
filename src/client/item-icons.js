import {block,BLOCK as B} from '../core/blocks.js';
import {makeTextureLayers,materialFor} from './textures.js';
import {shapeBoxes} from '../core/shapes.js';

// Render tiny isometric item portraits from the same procedural material layers
// as world blocks. No separate texture pack, network requests, or GPU draws.
const urls=new Map();let source=null;const faceCache=new Map();
function sampleFace(id,face){
 const key=`${id}:${face}`;if(faceCache.has(key))return faceCache.get(key);
 if(!source)source=makeTextureLayers();
 const layer=materialFor(id,face)-1,canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(32,32),hex=block(id).color;
 const base=[1,3,5].map(pos=>parseInt(hex.slice(pos,pos+2),16));
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const idx=(y*32+x)*4,k=layer>=0?((layer*32*32+y*32+x)*4):idx;
  for(let ch=0;ch<3;ch++)image.data[idx+ch]=Math.round(base[ch]*(layer>=0?source.data[k+ch]/255:1));
  image.data[idx+3]=255;
 }
 ctx.putImageData(image,0,0);faceCache.set(key,canvas);return canvas;
}
function poly(ctx,points,color){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=color;ctx.fill()}
function face(ctx,id,faceIndex,points,shade){
 ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.clip();
 // Small pixel patterns with no antialiasing: different materials remain distinct.
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const left=Math.min(...xs),top=Math.min(...ys);
 const tile=sampleFace(id,faceIndex);
 ctx.globalAlpha=shade;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(tile,left,top,Math.max(...xs)-left+1,Math.max(...ys)-top+1);
 ctx.restore();
}
// Item previews share the exact partial-voxel geometry with world meshing/collision.
// Isometric box projection is applied once when the icon is cached, not per frame.
export function drawShapeIcon(ctx,id){
 let boxes=shapeBoxes(id,0,0,0,{facing:0,upper:false});
 // Reuse the component proportions from the world mesh, not a generic cube.
 if(id===B.WORKBENCH)boxes=[{x:.045,y:.77,z:.045,w:.91,h:.22,d:.91},...[.11,.72].flatMap(x=>[.11,.72].map(z=>({x,y:0,z,w:.17,h:.76,d:.17})))];
 if(id===B.FENCE)boxes=[{x:.405,y:0,z:.405,w:.19,h:1.04,d:.19},...[.35,.72].flatMap(y=>[{x:.08,y,z:.442,w:.84,h:.13,d:.116},{x:.442,y,z:.08,w:.116,h:.13,d:.84}])];
 if(id===B.PATH)boxes=[{x:.06,y:.013,z:.06,w:.88,h:.035,d:.88}];
 if(id===B.GLOW_MUSHROOM)boxes=[{x:.45,y:.025,z:.45,w:.10,h:.23,d:.10},{x:.31,y:.235,z:.31,w:.38,h:.12,d:.38}];
 if(id===B.DOOR)boxes=[{x:.05,y:0,z:.42,w:.90,h:.94,d:.12}];
 if(id===B.FLUORESCENT||id===B.BROKEN_FLUORESCENT)boxes=[{x:.10,y:.80,z:.25,w:.80,h:.10,d:.50},{x:.14,y:.76,z:.29,w:.72,h:.07,d:.42}];
 if(!boxes)return false;
 const pr=(x,y,z)=>[32+(x-z)*22,43-y*29+(x+z)*7];
 for(const b of [...boxes].sort((a,b)=>(a.x+a.z+a.y*.3)-(b.x+b.z+b.y*.3))){
  const x=b.x,z=b.z,y=b.y,X=x+b.w,Z=z+b.d,Y=y+b.h;
  face(ctx,b.material??id,1,[pr(x,y,Z),pr(X,y,Z),pr(X,Y,Z),pr(x,Y,Z)],.82);
  face(ctx,b.material??id,0,[pr(X,y,z),pr(X,y,Z),pr(X,Y,Z),pr(X,Y,z)],.72);
  face(ctx,b.material??id,2,[pr(x,Y,z),pr(X,Y,z),pr(X,Y,Z),pr(x,Y,Z)],1);
 }
 return true;
}
export function drawItemIcon(ctx,id,x,y,size=64){
 ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);
 if(drawShapeIcon(ctx,id)){} 
 else if(id===B.TORCH||id===B.LANTERN||id===B.CAMPFIRE||id===B.GLOW_MUSHROOM){
  if(id===B.CAMPFIRE){poly(ctx,[[10,46],[31,33],[55,46],[34,58]],'#70523d');poly(ctx,[[15,47],[19,39],[43,47],[39,55]],'#af815b')}
  else if(id===B.LANTERN){poly(ctx,[[19,19],[45,19],[48,49],[16,49]],'#a17948');poly(ctx,[[22,24],[42,24],[43,44],[21,44]],'#ffd38b');poly(ctx,[[18,15],[46,15],[43,21],[21,21]],'#d8b274');}
  else if(id===B.GLOW_MUSHROOM){poly(ctx,[[29,31],[37,31],[37,57],[28,57]],'#d1bc93');poly(ctx,[[11,31],[23,20],[40,17],[54,30],[48,39],[16,39]],'#e7a877');}
  else{poly(ctx,[[28,27],[37,27],[38,56],[29,56]],'#8b6148');poly(ctx,[[26,21],[39,21],[40,32],[26,32]],'#f8a75a');poly(ctx,[[31,8],[37,16],[38,24],[26,24],[26,17]],'#ffe2a0')}
 }else if(id===B.DOOR){poly(ctx,[[18,9],[45,9],[48,58],[16,58]],'#674831');poly(ctx,[[21,13],[42,13],[44,53],[19,53]],'#ba8d62');poly(ctx,[[24,18],[39,18],[40,30],[23,30]],'#91704f');poly(ctx,[[23,34],[40,34],[41,48],[22,48]],'#94714f');poly(ctx,[[37,33],[41,33],[41,37],[37,37]],'#ebcf89');}
 else if(id===B.WORKBENCH){poly(ctx,[[10,20],[32,10],[56,20],[33,31]],'#c8a47b');poly(ctx,[[10,20],[33,31],[33,54],[10,43]],'#866348');poly(ctx,[[33,31],[56,20],[56,43],[33,54]],'#9a7352');for(let i=0;i<3;i++)poly(ctx,[[16+i*10,18],[19+i*10,17],[35+i*10,26],[32+i*10,27]],'#79583f')}
 else if(id===B.FENCE){poly(ctx,[[11,22],[19,17],[19,55],[11,59]],'#725940');poly(ctx,[[45,16],[53,22],[53,57],[45,52]],'#876442');poly(ctx,[[16,30],[48,25],[48,32],[16,37]],'#b18a62');poly(ctx,[[16,41],[48,37],[48,44],[16,48]],'#a47c57');}
 else if(id===B.STONE_STAIRS||id===B.WOOD_STAIRS){const c=id===B.STONE_STAIRS?'#8c9294':'#b49a73';poly(ctx,[[10,42],[29,32],[29,18],[49,27],[49,52],[29,60],[10,53]],c);poly(ctx,[[10,42],[29,32],[49,39],[30,49]],'#d1bd98');}
 else if(id===B.STONE_SLAB||id===B.WOOD_SLAB){const c=id===B.STONE_SLAB?'#838b90':'#ab916c';poly(ctx,[[9,30],[32,17],[55,30],[32,43]],c);poly(ctx,[[9,30],[32,43],[32,55],[9,42]],'#726c60');poly(ctx,[[32,43],[55,30],[55,42],[32,55]],'#8b7967');}
 else if(id===B.CHAIR){poly(ctx,[[20,10],[44,10],[44,42],[20,42]],'#85664b');poly(ctx,[[15,37],[33,28],[50,38],[32,48]],'#b39770');for(const x of [19,42])poly(ctx,[[x,40],[x+5,40],[x+5,60],[x,60]],'#80634d');}
 else if(id===B.FLOWER_POT){poly(ctx,[[21,26],[43,26],[40,52],[24,52]],'#a8735e');poly(ctx,[[28,25],[35,25],[35,12],[28,12]],'#628568');poly(ctx,[[20,14],[32,6],[44,14],[34,25],[25,24]],'#d09cab');}
 else if(block(id).render==='cross'&&id!==B.FLOWER){const c=block(id).color;poly(ctx,[[30,28],[35,28],[35,57],[30,57]],'#63845f');poly(ctx,[[17,22],[31,9],[47,22],[34,37]],c);poly(ctx,[[20,40],[32,29],[46,40],[31,51]],c);}
 else if(id===B.FLOWER){poly(ctx,[[30,29],[34,29],[35,56],[30,56]],'#67905f');for(const [dx,dy] of [[0,-11],[-10,0],[10,0],[0,10]])poly(ctx,[[32+dx-8,25+dy-8],[32+dx+8,25+dy-8],[32+dx+8,25+dy+8],[32+dx-8,25+dy+8]],'#d991a4');poly(ctx,[[28,21],[36,21],[36,29],[28,29]],'#f2c37b');}
 else if(id===B.PATH||id===B.WATER){const c=id===B.WATER?'#7194ab':'#969082';poly(ctx,[[7,34],[32,18],[57,34],[32,53]],c);poly(ctx,[[12,34],[32,23],[52,34],[32,48]],id===B.WATER?'#9fc4ce':'#b0aaa0');}
 else{
  const top=[[32,9],[55,22],[32,35],[9,22]],left=[[9,22],[32,35],[32,59],[9,45]],right=[[32,35],[55,22],[55,45],[32,59]];
  face(ctx,id,2,top,1);face(ctx,id,1,left,.82);face(ctx,id,0,right,.66);
 }
 ctx.restore();
}
export function itemIconURL(id){if(urls.has(id))return urls.get(id);const cv=document.createElement('canvas');cv.width=cv.height=64;drawItemIcon(cv.getContext('2d'),id,0,0,64);const src=cv.toDataURL('image/png');urls.set(id,src);return src}
