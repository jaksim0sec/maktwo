import {block,BLOCK as B,isBed,itemId} from '../core/blocks.js';
import {makeTextureLayers,materialFor} from './textures.js';
import {shapeBoxes} from '../core/shapes.js';
import {TREE_SPECIES,treeKind,isTreeAnchor,isFallenLeaves} from '../core/tree-assets.js';

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
 const kind=treeKind(id);
 if(kind>=0){
  const tree=TREE_SPECIES[kind];
  if(isFallenLeaves(id)){
   for(let j=0;j<16;j++){
    const x=8+(j*17%51),y=31+(j*13%24),r=1.8+j%3;
    poly(ctx,[[x-r,y],[x,y-r*1.5],[x+r,y],[x,y+r]],tree.litter[j%tree.litter.length]);
   }
  }else if(isTreeAnchor(id)){
   ctx.strokeStyle=tree.bark;ctx.lineCap='round';ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(32,59);ctx.bezierCurveTo(30,44,33,33,35,25);ctx.stroke();
   for(let i=0;i<7;i++){
    const a=(i/7)*Math.PI*2,tx=32+Math.cos(a)*16,ty=27+Math.sin(a)*10;
    ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(34,39);ctx.lineTo(tx,ty);ctx.stroke();
   }
   for(let j=0;j<14;j++){
    const a=j*2.39996,r=4+Math.sqrt(j/14)*18;
    const x=32+Math.cos(a)*r,y=23+Math.sin(a)*r*.62-(j%3)*2;
    ctx.fillStyle=tree.crown[j%tree.crown.length];
    ctx.beginPath();ctx.ellipse(x,y,7+(j%3)*2,5+(j%2)*2,a*.5,0,Math.PI*2);ctx.fill();
   }
  }
  return true;
 }
 let boxes=shapeBoxes(id,0,0,0,{facing:0,upper:false});
 // Reuse the component proportions from the world mesh, not a generic cube.
 if(id===B.WORKBENCH)boxes=[{x:.045,y:.77,z:.045,w:.91,h:.22,d:.91},...[.11,.72].flatMap(x=>[.11,.72].map(z=>({x,y:0,z,w:.17,h:.76,d:.17})))];
 if(id===B.FENCE)boxes=[{x:.405,y:0,z:.405,w:.19,h:1.04,d:.19},...[.35,.72].flatMap(y=>[{x:.08,y,z:.442,w:.84,h:.13,d:.116},{x:.442,y,z:.08,w:.116,h:.13,d:.84}])];
 if(id===B.CRATE)boxes=[
  {x:.085,y:.06,z:.085,w:.83,h:.75,d:.83,material:B.PLANKS},
  ...[.10,.34,.58].flatMap(y=>[.074,.86].map(z=>({x:.12,y,z,w:.76,h:.18,d:.032,material:B.WOOD}))),
  ...[.074,.864].flatMap(x=>[.10,.84].map(z=>({x,y:.08,z,w:.04,h:.71,d:.065,material:B.METAL_PANEL}))),
  {x:.13,y:.81,z:.13,w:.74,h:.035,d:.74,material:B.PLANKS}
 ];
 if(id===B.PATH)boxes=[{x:.06,y:.013,z:.06,w:.88,h:.035,d:.88}];
 if(id===B.GLOW_MUSHROOM)boxes=[{x:.45,y:.025,z:.45,w:.10,h:.23,d:.10},{x:.31,y:.235,z:.31,w:.38,h:.12,d:.38}];
 if(id===B.DOOR)boxes=[{x:.05,y:0,z:.42,w:.90,h:.94,d:.12}];
 if(id===B.FLUORESCENT||id===B.BROKEN_FLUORESCENT)boxes=[{x:.10,y:.80,z:.25,w:.80,h:.10,d:.50},{x:.14,y:.76,z:.29,w:.72,h:.07,d:.42}];
 if(id===B.ROUND_FLUORESCENT){
  ctx.fillStyle='#676e72';ctx.beginPath();ctx.ellipse(32,28,21,11,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#e7f0f4';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(32,29,15,7,0,0,Math.PI*2);ctx.stroke();
  return true;
 }
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
 if(id===B.WOOD_CLUB||id===B.STEEL_BAR){
  const wood=id===B.WOOD_CLUB;
  poly(ctx,[[10,53],[17,59],[54,17],[52,7],[45,11]],wood?'#917051':'#778388');
  poly(ctx,[[16,50],[18,53],[52,15],[52,10]],wood?'#bc9367':'#a1a9a7');
  poly(ctx,[[12,50],[18,56],[26,46],[21,41]],'#51453b');
 }else if(isBed(id)){
  const framed=itemId(id)===B.BED,offset=framed?0:6;
  ctx.translate(0,offset);
  if(framed){
   poly(ctx,[[8,28],[28,40],[55,25],[55,36],[28,52],[8,40]],'#705746');
   poly(ctx,[[8,16],[27,26],[27,41],[8,31]],'#826751');
  }
  poly(ctx,[[8,28],[36,13],[56,24],[28,41]],'#ada48e');
  poly(ctx,[[8,28],[28,41],[56,24],[56,29],[28,47],[8,34]],'#807868');
  poly(ctx,[[20,30],[45,17],[56,24],[28,41]],framed?'#697b77':'#777568');
  poly(ctx,[[11,25],[23,19],[33,24],[21,31]],'#c9c1ac');
 }else if(drawShapeIcon(ctx,id)){}
 else if(id===B.TORCH||id===B.LANTERN||id===B.CAMPFIRE||id===B.GLOW_MUSHROOM){
  if(id===B.CAMPFIRE){poly(ctx,[[10,46],[31,33],[55,46],[34,58]],'#70523d');poly(ctx,[[15,47],[19,39],[43,47],[39,55]],'#af815b')}
  else if(id===B.TORCH||id===B.LANTERN){poly(ctx,[[19,19],[45,19],[48,49],[16,49]],'#a17948');poly(ctx,[[22,24],[42,24],[43,44],[21,44]],'#ffd38b');poly(ctx,[[18,15],[46,15],[43,21],[21,21]],'#d8b274');}
  else if(id===B.GLOW_MUSHROOM){poly(ctx,[[29,31],[37,31],[37,57],[28,57]],'#d1bc93');poly(ctx,[[11,31],[23,20],[40,17],[54,30],[48,39],[16,39]],'#e7a877');}
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
