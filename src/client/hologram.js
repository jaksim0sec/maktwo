import {BLOCK_SIZE} from '../core/scale.js';
import {drawItemIcon} from './item-icons.js';
import {recipeGrid} from '../core/crafting.js';
// A collection of small, world-anchored surfaces, not a screen-space modal.
// The scene's depth buffer occludes each tile just like any other world object.
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec2 aUV;
layout(location=2) in float aCard;
uniform mat4 uVP;
out vec2 vUV;flat out int vCard;
void main(){vUV=aUV;vCard=int(aCard+.5);gl_Position=uVP*vec4(aPosition*${BLOCK_SIZE.toFixed(2)},1.);}`;
const FS=`#version 300 es
precision highp float;
in vec2 vUV;flat in int vCard;
uniform sampler2D uAtlas;
uniform int uHovered;
uniform int uSelected;
uniform float uOpacity;
out vec4 outColor;
void main(){vec4 c=texture(uAtlas,vUV);if(c.a<.015)discard;
 if(vCard==uHovered){c.rgb=mix(c.rgb,vec3(.90,.76,.54),.21);c.a=min(1.,c.a*1.1);}
 else if(vCard==uSelected){c.rgb=mix(c.rgb,vec3(.83,.75,.62),.10);}
 outColor=vec4(c.rgb,c.a*uOpacity);}`;
const ATLAS_W=1024,ATLAS_H=1024,CELL_W=196,CELL_H=235;
// World-rendered spatial panel attached to the viewer. No fixed object remains inside a house.
export const PANEL_DISTANCE=1.58, PANEL_SCALE=1.12;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b,k)=>a.map((v,i)=>v+b[i]*k);
const point=(center,right,up,x,y,depth,forward)=>add(add(add(center,right,x),up,y),forward,depth);
const font=(size,heavy=false)=>`${heavy?'600':'450'} ${size}px system-ui,-apple-system,'Noto Sans KR',sans-serif`;
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke()}}
function colorParts(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)||0)}
// Every card samples an atlas rectangle with its own world-space aspect ratio.
// Using fixed 196x235 images stretched all wide buttons and item cards.
export function atlasRect(card,index){
 const maxW=CELL_W-12,maxH=CELL_H-12,aspect=card.w/Math.max(.01,card.h);
 const w=Math.min(maxW,maxH*aspect),h=w/aspect;
 return {x:(index%5)*CELL_W+6+(maxW-w)/2,
  y:Math.floor(index/5)*CELL_H+6+(maxH-h)/2,w,h};
}
function cardGeometry(palette,items,compact=false,page=null,craftFilter='all'){
 const cards=[],craft=palette==='craft';
 const add=(id,name,x,y,w,h,role='control')=>cards.push({id,name,x,y,w,h,depth:-.035,role});
 if(compact){
  add('view:inventory','내 가방',-.25,.80,.34,.20,'view');
  add('view:craft','제작하기',.14,.80,.32,.20,'view');
  add('close','✕',.38,.80,.14,.14,'close');
  const filters=craft?[['filter:all','전체'],['filter:available','제작 가능'],['hand','맨손']]:
   [['tab:all','전체'],['tab:blocks','블록'],['tab:parts','부품'],['tab:trees','수목'],['tab:items','소품'],['hand','맨손']];
  filters.forEach(([id,name],i)=>{
   const row=craft?0:Math.floor(i/3),col=craft?i:i%3,total=3;
   add(id,name,(col-(total-1)/2)*.29,craft?.49:row===0?.53:.34,.27,.15,'filter');
  });
 }else{
  add('view:inventory','내 가방',-.53,.81,.86,.27,'view');
  add('view:craft','제작하기',.43,.81,.80,.27,'view');
  add('close','✕',1.06,.81,.27,.27,'close');
  const filters=craft?[['filter:all','전체 레시피'],['filter:available','제작 가능'],['hand','맨손']]:
   [['tab:all','전체'],['tab:blocks','블록'],['tab:parts','부품'],['tab:trees','수목'],['tab:items','소품'],['hand','맨손']];
  const step=craft?.63:.41;
  filters.forEach(([id,name],i)=>add(id,name,(i-(filters.length-1)/2)*step,.50,step-.055,.19,'filter'));
 }
 for(let i=0;i<items.length;i++){
  const col=compact?i%2:i%5,row=Math.floor(i/(compact?2:5)),item=items[i];
  const x=compact?(col-.5)*.45:(col-2)*.51;
  cards.push({id:`item:${i}`,name:item.name,color:item.color,blockId:item.id,count:item.count,
   craftable:item.craftable,recipe:item.recipe,missing:item.missing,
   x,y:compact?(craft?.12:.06)-row*.36:.15-row*.55,
   w:compact?.41:.46,h:compact?.32:.43,depth:-.07+Math.abs(x)*.035,role:'item'});
 }
 if(!items.length)add('empty',craft?'표시할 제작법이 없습니다':'보유한 아이템이 없습니다',0,-.13,compact?.80:1.60,compact?.25:.40,'empty');
 if(page?.total>1){
  if(compact){add('page:prev','‹ 이전',-.23,-.88,.35,.17,'page');add('page:next',`다음 ${page.index+1}/${page.total} ›`,.21,-.88,.41,.17,'page')}
  else{add('page:prev','‹ 이전',-.48,-.84,.65,.22,'page');add('page:next',`다음 › ${page.index+1}/${page.total}`,.48,-.84,.86,.22,'page')}
 }
 if(cards.length>20)throw Error('Spatial inventory atlas overflow');
 return cards;
}
export {cardGeometry};
export function createAnchor(player,compact=false){
 const yaw=player.yaw;
 const forward=[-Math.sin(yaw),0,-Math.cos(yaw)],right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[0,1,0];
 const eye=[player.x,player.y+player.eye+(player.visualStepOffset||0),player.z];
 const center=add(add(eye,forward,PANEL_DISTANCE),up,-.12);
 return{center,forward,right,up};
}
// Keep the 3D card positions, but billboard their front faces toward the viewer.
// Uses the viewer position, not current look direction. This is NOT a HUD overlay.
export function faceAnchor(anchor,viewer){
 if(!anchor)return false;
 const eye=[viewer.x,viewer.y+viewer.eye+(viewer.visualStepOffset||0),viewer.z];
 const v=sub(anchor.center,eye);v[1]=0;const length=Math.hypot(...v);
 if(length<.0001)return false;
 const forward=v.map(x=>x/length);
 const cross=[-forward[2],0,forward[0]];let m=Math.hypot(...cross);
 const right=m<.0001?anchor.right:cross.map(x=>x/m);
 const up=[0,1,0];
 const rotated=Math.abs(dot(forward,anchor.forward)-1)>1e-7||Math.abs(dot(right,anchor.right)-1)>1e-7;
 if(rotated){anchor.forward=forward;anchor.right=right;anchor.up=up}
 return rotated;
}
// The frame follows the head while open; actual card vertices still live in the WebGL scene.
// Use camera-up to keep its plane perpendicular to the current view rather than lying flat.
export function followAnchor(anchor,player,dt=Infinity){
 if(!anchor)return false;
 const yaw=player.yaw,pitch=player.pitch,sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const forward=[-sy*cp,sp,-cy*cp],right=[cy,0,-sy],up=[sy*sp,cp,cy*sp];
 const eye=[player.x,player.y+player.eye+(player.visualStepOffset||0),player.z];
 const center=add(add(eye,forward,PANEL_DISTANCE),up,-.12);
 const t=Number.isFinite(dt)?1-Math.exp(-7.5*Math.max(0,Math.min(dt,.12))):1;
 for(let i=0;i<3;i++)anchor.center[i]+=(center[i]-anchor.center[i])*t;
 const f=anchor.forward.map((v,i)=>v+(forward[i]-v)*t);
 const len=Math.hypot(...f)||1;anchor.forward=f.map(v=>v/len);
 const horizontal=Math.hypot(anchor.forward[0],anchor.forward[2]);
 if(horizontal>.0001){anchor.right=[-anchor.forward[2]/horizontal,0,anchor.forward[0]/horizontal];anchor.up=[-anchor.forward[1]*anchor.forward[0]/horizontal,horizontal,-anchor.forward[1]*anchor.forward[2]/horizontal]}else{anchor.right=right;anchor.up=up}
 return true;
}
export function spatialHit(anchor,cards,camera,ray,scale=PANEL_SCALE){
 if(!anchor||!cards?.length)return null;
 const origin=[camera.x,camera.y+camera.eye+(camera.visualStepOffset||0),camera.z];
 let best=Infinity,result=null;
 for(let i=0;i<cards.length;i++){
  const card=cards[i],center=point(anchor.center,anchor.right,anchor.up,card.x*scale,card.y*scale,card.depth*scale,anchor.forward);
  const denominator=dot(ray,anchor.forward);
  if(denominator<=1e-5)continue;
  const distance=dot(sub(center,origin),anchor.forward)/denominator;
  if(distance<=.05||distance>6||distance>=best)continue;
  const hit=sub(add(origin,ray,distance),center);
  if(Math.abs(dot(hit,anchor.right))<=card.w*scale*.5&&Math.abs(dot(hit,anchor.up))<=card.h*scale*.5){best=distance;result={id:card.id,index:i,distance}}
 }
 return result;
}
function pointerRay(player,nx,ny,aspect){
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),cp=Math.cos(player.pitch),sp=Math.sin(player.pitch);
 const forward=[-sy*cp,sp,-cy*cp],right=[cy,0,-sy],up=[sy*sp,cp,cy*sp];
 const tan=Math.tan(75*Math.PI/360),horizontal=nx*tan*aspect,vertical=-ny*tan;
 const dir=add(add(forward,right,horizontal),up,vertical),mag=Math.hypot(...dir);
 return dir.map(v=>v/mag);
}
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(`Spatial inventory shader: ${gl.getShaderInfoLog(shader)}`);return shader}
export class Hologram{
 constructor(gl){this.gl=gl;this.opened=false;this.compact=false;this.palette='blocks';this.items=[];this.selected=-1;this.anchor=null;this.cards=[];this.hover=null;this.pointer=null;this.focusId=null;this.keyboardMode=false;this.craftFilter='all';this.dirty=true;
  const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.program=p;
  this.u={vp:gl.getUniformLocation(p,'uVP'),atlas:gl.getUniformLocation(p,'uAtlas'),hover:gl.getUniformLocation(p,'uHovered'),selected:gl.getUniformLocation(p,'uSelected'),opacity:gl.getUniformLocation(p,'uOpacity')};
  this.canvas=document.createElement('canvas');this.canvas.width=ATLAS_W;this.canvas.height=ATLAS_H;this.ctx=this.canvas.getContext('2d');
  this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,32*6*6*4,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,24,20);gl.bindVertexArray(null);this.count=0;
 }
 open(player){this.opened=true;const canvas=this.gl.canvas;this.compact=Boolean(canvas?.clientHeight&&canvas.clientWidth/canvas.clientHeight<.8);this.scale=this.compact?Math.min(PANEL_SCALE,PANEL_DISTANCE*Math.tan(75*Math.PI/360)*(canvas.clientWidth/Math.max(1,canvas.clientHeight))*.90/.45):PANEL_SCALE;this.anchor=createAnchor(player,this.compact);this.hover=null;this.pointer=null;this.keyboardMode=false;this.focusId=null;this.buildGeometry()}
 followPlayer(player,dt=1/60){if(this.opened&&followAnchor(this.anchor,player,dt))this.buildGeometry()}
 facePlayer(player){this.followPlayer(player)}
 close(){this.opened=false;this.pointer=null;this.hover=null;this.keyboardMode=false}
 setInventory(palette,items,selected,station='hand',page=null,craftFilter='all'){
  const changed=this.palette!==palette;
  this.palette=palette;this.station=station;this.items=items;this.selected=selected;this.craftFilter=craftFilter;
  this.cards=cardGeometry(palette,items,this.compact,page,craftFilter);
  if(changed||!this.cards.some(c=>c.id===this.focusId))this.focusId=this.cards.find(c=>c.role==='item')?.id||(palette==='craft'?'view:craft':'view:inventory');
  this.dirty=true;this.buildGeometry();
 }
 moveFocus(direction){
  if(!this.opened)return null;
  const controls=this.cards.filter(c=>c.role!=='empty');
  const current=controls.find(c=>c.id===this.focusId)||controls.find(c=>c.role==='item')||controls[0];
  if(!current)return null;
  const axis=direction==='left'||direction==='right'?'x':'y',positive=direction==='right'||direction==='up';
  const candidates=controls.filter(c=>c.id!==current.id&&(positive?c[axis]>current[axis]+.01:c[axis]<current[axis]-.01));
  let next=current,score=Infinity;
  for(const c of candidates){
   const side=axis==='x'?'y':'x';
   const weight=Math.abs(c[axis]-current[axis])+Math.abs(c[side]-current[side])*3.1;
   if(weight<score){score=weight;next=c}
  }
  this.focusId=next.id;this.keyboardMode=true;this.hover={id:next.id,index:this.cards.indexOf(next)};this.dirty=true;
  return this.focusId;
 }
 focusedId(){return this.focusId}
 buildGeometry(){if(!this.anchor||!this.cards.length)return;const gl=this.gl,vertices=[],a=this.anchor;
  this.cards.forEach((card,i)=>{
   const rect=atlasRect(card,i),u0=rect.x/ATLAS_W,u1=(rect.x+rect.w)/ATLAS_W;
   const v0=1-(rect.y+rect.h)/ATLAS_H,v1=1-rect.y/ATLAS_H;
   const scale=this.scale??PANEL_SCALE;
   const halfW=card.w*scale*.5,halfH=card.h*scale*.5,c=point(a.center,a.right,a.up,card.x*scale,card.y*scale,card.depth*scale,a.forward);
   const quad=[[ -halfW,halfH,u0,v1],[halfW,halfH,u1,v1],[halfW,-halfH,u1,v0],[-halfW,halfH,u0,v1],[halfW,-halfH,u1,v0],[-halfW,-halfH,u0,v0]];
   for(const [x,y,u,v] of quad)vertices.push(...point(c,a.right,a.up,x,y,0,a.forward),u,v,i);
  });
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(vertices));this.count=vertices.length/6;
 }
 point(clientX,clientY,rect){this.keyboardMode=false;this.pointer={nx:((clientX-rect.left)/Math.max(1,rect.width))*2-1,ny:((clientY-rect.top)/Math.max(1,rect.height))*2-1,aspect:rect.width/Math.max(1,rect.height)}}
 aim(player){if(!this.opened)return null;
  if(this.keyboardMode){const index=this.cards.findIndex(c=>c.id===this.focusId);this.hover=index<0?null:{id:this.focusId,index};return this.focusId}
  const ray=this.pointer?pointerRay(player,this.pointer.nx,this.pointer.ny,this.pointer.aspect):(()=>{const d=player.direction();return[d.x,d.y,d.z]})();const found=spatialHit(this.anchor,this.cards,player,ray,this.scale??PANEL_SCALE);this.hover=found;return found?.id||null}
 // Pick synchronously using the same camera projection as the rendered cards.
 // Never act on a hover result cached before the most recent pointer movement.
 pickAt(player,clientX,clientY,rect,{center=false}={}){
  if(!this.opened)return null;
  this.keyboardMode=false;if(center){this.pointer=null}
  else this.point(clientX,clientY,rect);
  return this.aim(player);
 }
 click(){return this.keyboardMode?this.focusId:this.hover?.id||null}
 drawAtlas(){
  const ctx=this.ctx;ctx.clearRect(0,0,ATLAS_W,ATLAS_H);
  const textFit=(value,maxWidth,size,min=12)=>{
   let n=size;ctx.font=font(n,true);
   while(ctx.measureText(String(value)).width>maxWidth&&n>min){n-=1;ctx.font=font(n,true)}
   return n;
  };
  this.cards.forEach((card,i)=>{
   const {x,y,w,h}=atlasRect(card,i),cx=x+w*.5;
   const active=card.id==='view:inventory'?this.palette!=='craft':
    card.id==='view:craft'?this.palette==='craft':
    card.id.startsWith('tab:')?card.id===`tab:${this.palette}`:
    card.id.startsWith('filter:')?card.id===`filter:${this.craftFilter}`:false;
   const focused=this.keyboardMode&&this.focusId===card.id;
   const ready=card.role==='item'&&this.palette==='craft'&&card.craftable;
   ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
   rounded(ctx,x+2,y+2,w-4,h-4,Math.min(16,h*.17),
    ready?'#213b32ef':active?'#454139ef':'#202a2fee',
    focused?'#ffe1ae':ready?'#6fba91':active?'#e1b982':'#67696766');
   if(card.role!=='item'){
    ctx.fillStyle=card.role==='close'?'#f6cfbd':active||focused?'#ffe1b7':'#d8dfdc';
    const fontsize=textFit(card.name,w-12,card.role==='close'?Math.min(58,h*.57):Math.min(29,h*.43));
    ctx.textAlign='center';ctx.fillText(card.name,cx,y+h*.5+fontsize*.34,w-12);
    ctx.textAlign='left';ctx.restore();return;
   }
   if(this.palette==='craft'&&card.recipe){
    const cells=recipeGrid(card.recipe),step=Math.min(25,h*.16),side=step-2,baseX=cx-step*1.5,baseY=y+h*.055;
    for(let k=0;k<9;k++){
     const px=baseX+k%3*step,py=baseY+Math.floor(k/3)*step;
     ctx.fillStyle='rgba(5,11,13,.55)';ctx.fillRect(px,py,side,side);
     if(cells[k])drawItemIcon(ctx,cells[k],px+1,py+1,side-2);
    }
   }else{
    const size=Math.min(78,h*.46);drawItemIcon(ctx,card.blockId,cx-size*.5,y+h*.06,size);
   }
   ctx.textAlign='center';const titleSize=textFit(card.name,w-14,Math.min(26,h*.15));
   ctx.fillStyle='#f2f4f0';ctx.fillText(card.name,cx,y+h*.76+titleSize*.24,w-14);
   const status=this.palette==='craft'?(ready?`제작 가능 ×${card.recipe?.count||1}`:
    card.recipe?.station==='bench'&&this.station!=='bench'?'작업대 필요':
    card.missing>0?`재료 ${card.missing}개 부족`:'제작 불가'):
    card.count===Infinity?'무제한':`보유 ${card.count||0}`;
   ctx.fillStyle=ready?'#9de1b5':'#b9c1bb';
   const size=textFit(status,w-12,Math.min(19,h*.12));
   ctx.fillText(status,cx,y+h*.92+size*.18,w-12);ctx.textAlign='left';ctx.restore();
  });this.dirty=false;
 }
 render(vp){if(!this.opened||!this.anchor||!this.count)return;const gl=this.gl;
  if(this.dirty){this.drawAtlas();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)}
  gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform1i(this.u.atlas,1);gl.uniform1i(this.u.hover,this.hover?.index??-1);gl.uniform1i(this.u.selected,this.keyboardMode?this.cards.findIndex(card=>card.id===this.focusId):-1);
  gl.bindVertexArray(this.vao);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);
  // Spatial head-attached UI is not world geometry: keep full 3D perspective
  // but don't let opaque world polygons cut holes through selectable cards.
  gl.disable(gl.DEPTH_TEST);gl.uniform1f(this.u.opacity,1);gl.drawArrays(gl.TRIANGLES,0,this.count);
  gl.depthFunc(gl.LESS);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.disable(gl.BLEND);
  return true;
 }
}
