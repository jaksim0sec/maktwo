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
function cardGeometry(palette,items,compact=false){
 const cards=[
  {id:'tab:blocks',name:'건축',x:-1.02,y:.67,w:.41,h:.25,depth:-.02},
  {id:'tab:lights',name:'조명',x:-.56,y:.67,w:.41,h:.25,depth:-.035},
  {id:'tab:garden',name:'정원',x:-.11,y:.67,w:.37,h:.25,depth:-.035},
  {id:'tab:craft',name:'제작',x:.32,y:.67,w:.37,h:.25,depth:-.035},
  {id:'hand',name:'맨손',x:.75,y:.67,w:.41,h:.25,depth:-.035},
  {id:'close',name:'닫기',x:1.18,y:.67,w:.41,h:.25,depth:-.02},
 ];
 if(compact){
  cards.forEach((card,i)=>{card.x=[-.62,-.36,-.10,.16,.42,.68][i];card.w=.25;card.y=.54});
 }
 for(let i=0;i<items.length;i++){
  const col=compact?i%3:i%5,row=Math.floor(i/(compact?3:5));
  const x=compact?(col-1)*.40:(col-2)*.52,y=(compact?.06:.15)-row*(compact?.49:.53);
  cards.push({id:`item:${i}`,name:items[i].name,color:items[i].color,blockId:items[i].id,count:items[i].count,craftable:items[i].craftable,recipe:items[i].recipe,x,y,w:compact?.43:.46,h:.43,depth:-.06+Math.abs(x)*.065});
 }
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
export function spatialHit(anchor,cards,camera,ray){
 if(!anchor||!cards?.length)return null;
 const origin=[camera.x,camera.y+camera.eye+(camera.visualStepOffset||0),camera.z];
 let best=Infinity,result=null;
 for(let i=0;i<cards.length;i++){
  const card=cards[i],center=point(anchor.center,anchor.right,anchor.up,card.x*PANEL_SCALE,card.y*PANEL_SCALE,card.depth*PANEL_SCALE,anchor.forward);
  const denominator=dot(ray,anchor.forward);
  if(denominator<=1e-5)continue;
  const distance=dot(sub(center,origin),anchor.forward)/denominator;
  if(distance<=.05||distance>6||distance>=best)continue;
  const hit=sub(add(origin,ray,distance),center);
  if(Math.abs(dot(hit,anchor.right))<=card.w*PANEL_SCALE*.5&&Math.abs(dot(hit,anchor.up))<=card.h*PANEL_SCALE*.5){best=distance;result={id:card.id,index:i,distance}}
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
 constructor(gl){this.gl=gl;this.opened=false;this.compact=false;this.palette='blocks';this.items=[];this.selected=-1;this.anchor=null;this.cards=[];this.hover=null;this.pointer=null;this.dirty=true;
  const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.program=p;
  this.u={vp:gl.getUniformLocation(p,'uVP'),atlas:gl.getUniformLocation(p,'uAtlas'),hover:gl.getUniformLocation(p,'uHovered'),selected:gl.getUniformLocation(p,'uSelected'),opacity:gl.getUniformLocation(p,'uOpacity')};
  this.canvas=document.createElement('canvas');this.canvas.width=ATLAS_W;this.canvas.height=ATLAS_H;this.ctx=this.canvas.getContext('2d');
  this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,32*6*6*4,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,24,20);gl.bindVertexArray(null);this.count=0;
 }
 open(player){this.opened=true;const canvas=this.gl.canvas;this.compact=Boolean(canvas?.clientHeight&&canvas.clientWidth/canvas.clientHeight<.8);this.anchor=createAnchor(player,this.compact);this.hover=null;this.pointer=null;this.buildGeometry()}
 followPlayer(player,dt=1/60){if(this.opened&&followAnchor(this.anchor,player,dt))this.buildGeometry()}
 facePlayer(player){this.followPlayer(player)}
 close(){this.opened=false;this.pointer=null;this.hover=null}
 setInventory(palette,items,selected,station='hand'){this.palette=palette;this.station=station;this.items=items;this.selected=selected;this.cards=cardGeometry(palette,items,this.compact);this.dirty=true;this.buildGeometry()}
 buildGeometry(){if(!this.anchor||!this.cards.length)return;const gl=this.gl,vertices=[],a=this.anchor;
  this.cards.forEach((card,i)=>{
   const col=i%5,row=Math.floor(i/5),u0=(col*CELL_W+3)/ATLAS_W,u1=((col+1)*CELL_W-3)/ATLAS_W;
   const v0=1-((row+1)*CELL_H-3)/ATLAS_H,v1=1-(row*CELL_H+3)/ATLAS_H;
   const halfW=card.w*PANEL_SCALE*.5,halfH=card.h*PANEL_SCALE*.5,c=point(a.center,a.right,a.up,card.x*PANEL_SCALE,card.y*PANEL_SCALE,card.depth*PANEL_SCALE,a.forward);
   const quad=[[ -halfW,halfH,u0,v1],[halfW,halfH,u1,v1],[halfW,-halfH,u1,v0],[-halfW,halfH,u0,v1],[halfW,-halfH,u1,v0],[-halfW,-halfH,u0,v0]];
   for(const [x,y,u,v] of quad)vertices.push(...point(c,a.right,a.up,x,y,0,a.forward),u,v,i);
  });
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(vertices));this.count=vertices.length/6;
 }
 point(clientX,clientY,rect){this.pointer={nx:((clientX-rect.left)/Math.max(1,rect.width))*2-1,ny:((clientY-rect.top)/Math.max(1,rect.height))*2-1,aspect:rect.width/Math.max(1,rect.height)}}
 aim(player){if(!this.opened)return null;const ray=this.pointer?pointerRay(player,this.pointer.nx,this.pointer.ny,this.pointer.aspect):(()=>{const d=player.direction();return[d.x,d.y,d.z]})();const found=spatialHit(this.anchor,this.cards,player,ray);this.hover=found;return found?.id||null}
 // Pick synchronously using the same camera projection as the rendered cards.
 // Never act on a hover result cached before the most recent pointer movement.
 pickAt(player,clientX,clientY,rect,{center=false}={}){
  if(!this.opened)return null;
  if(center){this.pointer=null}
  else this.point(clientX,clientY,rect);
  return this.aim(player);
 }
 click(){return this.hover?.id||null}
 drawAtlas(){const ctx=this.ctx;ctx.clearRect(0,0,ATLAS_W,ATLAS_H);
  this.cards.forEach((card,i)=>{const x=i%5*CELL_W+3,y=Math.floor(i/5)*CELL_H+3,w=CELL_W-6,h=CELL_H-6;
   const isHeader=!card.id.startsWith('item:'),active=isHeader?(card.id===`tab:${this.palette}`||card.id==='hand'&&this.selected===-1):Number(card.id.slice(5))===this.selected;
   const grad=ctx.createLinearGradient(x,y,x+w,y+h);grad.addColorStop(0,'rgba(60,52,44,.86)');grad.addColorStop(1,'rgba(24,29,30,.93)');
   rounded(ctx,x+5,y+8,w-10,h-16,16,grad,active?'rgba(232,191,137,.82)':'rgba(205,199,181,.17)');
   if(isHeader){ctx.font=font(34,true);ctx.fillStyle=active?'#f8dfb7':'#e6e7e3';ctx.textAlign='center';ctx.fillText(card.name,x+w/2,y+h/2+9);ctx.textAlign='left';return}
   if(this.palette==='craft'&&card.recipe){
    const cells=recipeGrid(card.recipe);const startX=x+w/2-43,startY=y+25,step=29;
    for(let c=0;c<9;c++){
     const xx=startX+c%3*step,yy=startY+Math.floor(c/3)*step;
     ctx.fillStyle='rgba(8,12,14,.36)';ctx.fillRect(xx,yy,27,27);
     if(cells[c])drawItemIcon(ctx,cells[c],xx+2,yy+2,23);
    }
   }else drawItemIcon(ctx,card.blockId,x+w/2-48,y+24,96);
   ctx.textAlign='center';ctx.font=font(34,true);ctx.fillStyle='#efeee9';ctx.fillText(card.name,x+w/2,y+166,177);ctx.font=font(22);ctx.fillStyle='#aeb5b3';ctx.fillText(this.palette==='craft'?(card.craftable?'제작 가능':card.recipe?.station==='bench'&&this.station!=='bench'?'작업대 필요':'재료 부족'):`보유 ${card.count||0}`,x+w/2,y+184);ctx.textAlign='left';
  });this.dirty=false;
 }
 render(vp){if(!this.opened||!this.anchor||!this.count)return;const gl=this.gl;
  if(this.dirty){this.drawAtlas();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)}
  gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform1i(this.u.atlas,1);gl.uniform1i(this.u.hover,this.hover?.index??-1);gl.uniform1i(this.u.selected,this.selected<0?2:this.selected+6);
  gl.bindVertexArray(this.vao);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);
  // Spatial head-attached UI is not world geometry: keep full 3D perspective
  // but don't let opaque world polygons cut holes through selectable cards.
  gl.disable(gl.DEPTH_TEST);gl.uniform1f(this.u.opacity,1);gl.drawArrays(gl.TRIANGLES,0,this.count);
  gl.depthFunc(gl.LESS);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.disable(gl.BLEND);
 }
}
