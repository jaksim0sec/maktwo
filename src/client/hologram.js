import {BLOCK_SIZE} from '../core/scale.js';
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
out vec4 outColor;
void main(){vec4 c=texture(uAtlas,vUV);if(c.a<.015)discard;
 if(vCard==uHovered){c.rgb=mix(c.rgb,vec3(.90,.76,.54),.21);c.a=min(1.,c.a*1.1);}
 else if(vCard==uSelected){c.rgb=mix(c.rgb,vec3(.83,.75,.62),.10);}
 outColor=c;}`;
const ATLAS_W=1024,ATLAS_H=768,CELL_W=192,CELL_H=230;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b,k)=>a.map((v,i)=>v+b[i]*k);
const point=(center,right,up,x,y,depth,forward)=>add(add(add(center,right,x),up,y),forward,depth);
const font=(size,heavy=false)=>`${heavy?'600':'450'} ${size}px system-ui,-apple-system,'Noto Sans KR',sans-serif`;
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke()}}
function colorParts(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)||0)}
function cardGeometry(palette,items,compact=false){
 const cards=[
  {id:'tab:blocks',name:'건축',x:-.76,y:.53,w:.43,h:.22,depth:-.02},
  {id:'tab:lights',name:'조명',x:-.27,y:.53,w:.43,h:.22,depth:-.035},
  {id:'hand',name:'맨손',x:.27,y:.53,w:.43,h:.22,depth:-.035},
  {id:'close',name:'닫기',x:.76,y:.53,w:.43,h:.22,depth:-.02},
 ];
 if(compact){
  cards.forEach((card,i)=>{card.x=[-.56,-.18,.18,.56][i];card.w=.33});
 }
 for(let i=0;i<items.length;i++){
  const col=compact?i%3:i%5,row=Math.floor(i/(compact?3:5));
  const x=compact?(col-1)*.42:(col-2)*.44,y=.12-row*.43;
  cards.push({id:`item:${i}`,name:items[i].name,color:items[i].color,x,y,w:compact?.375:.385,h:.36,depth:-.06+Math.abs(x)*.065});
 }
 return cards;
}
export {cardGeometry};
export function createAnchor(player,compact=false){
 const yaw=player.yaw,pitch=player.pitch,cp=Math.cos(pitch),sp=Math.sin(pitch);
 const forward=[-Math.sin(yaw)*cp,sp,-Math.cos(yaw)*cp],right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[Math.sin(yaw)*sp,cp,Math.cos(yaw)*sp];
 const eye=[player.x,player.y+player.eye+(player.visualStepOffset||0),player.z];
 const center=add(add(add(eye,forward,2.25),right,compact?0:.42),up,-.24);
 return{center,forward,right,up};
}
// Keep the 3D card positions, but billboard their front faces toward the viewer.
// Uses the viewer position, not current look direction. This is NOT a HUD overlay.
export function faceAnchor(anchor,viewer){
 if(!anchor)return false;
 const eye=[viewer.x,viewer.y+viewer.eye+(viewer.visualStepOffset||0),viewer.z];
 const v=sub(anchor.center,eye),length=Math.hypot(...v);
 if(length<.0001)return false;
 const forward=v.map(x=>x/length);
 const cross=[-forward[2],0,forward[0]];let m=Math.hypot(...cross);
 const right=m<.0001?anchor.right:cross.map(x=>x/m);
 const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
 const rotated=Math.abs(dot(forward,anchor.forward)-1)>1e-7||Math.abs(dot(right,anchor.right)-1)>1e-7;
 if(rotated){anchor.forward=forward;anchor.right=right;anchor.up=up}
 return rotated;
}
export function spatialHit(anchor,cards,camera,ray){
 if(!anchor||!cards?.length)return null;
 const origin=[camera.x,camera.y+camera.eye+(camera.visualStepOffset||0),camera.z];
 let best=Infinity,result=null;
 for(let i=0;i<cards.length;i++){
  const card=cards[i],center=point(anchor.center,anchor.right,anchor.up,card.x,card.y,card.depth,anchor.forward);
  const denominator=dot(ray,anchor.forward);
  if(denominator<=1e-5)continue;
  const distance=dot(sub(center,origin),anchor.forward)/denominator;
  if(distance<=.05||distance>6||distance>=best)continue;
  const hit=sub(add(origin,ray,distance),center);
  if(Math.abs(dot(hit,anchor.right))<=card.w*.5&&Math.abs(dot(hit,anchor.up))<=card.h*.5){best=distance;result={id:card.id,index:i,distance}}
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
  this.u={vp:gl.getUniformLocation(p,'uVP'),atlas:gl.getUniformLocation(p,'uAtlas'),hover:gl.getUniformLocation(p,'uHovered'),selected:gl.getUniformLocation(p,'uSelected')};
  this.canvas=document.createElement('canvas');this.canvas.width=ATLAS_W;this.canvas.height=ATLAS_H;this.ctx=this.canvas.getContext('2d');
  this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,15*6*6*4,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,24,20);gl.bindVertexArray(null);this.count=0;
 }
 open(player){this.opened=true;const canvas=this.gl.canvas;this.compact=Boolean(canvas?.clientHeight&&canvas.clientWidth/canvas.clientHeight<.8);this.anchor=createAnchor(player,this.compact);this.hover=null;this.pointer=null;this.buildGeometry()}
 facePlayer(player){if(this.opened&&faceAnchor(this.anchor,player))this.buildGeometry()}
 close(){this.opened=false;this.pointer=null;this.hover=null}
 setInventory(palette,items,selected){this.palette=palette;this.items=items;this.selected=selected;this.cards=cardGeometry(palette,items,this.compact);this.dirty=true;this.buildGeometry()}
 buildGeometry(){if(!this.anchor||!this.cards.length)return;const gl=this.gl,vertices=[],a=this.anchor;
  this.cards.forEach((card,i)=>{
   const col=i%5,row=Math.floor(i/5),u0=(col*CELL_W+3)/ATLAS_W,u1=((col+1)*CELL_W-3)/ATLAS_W;
   const v0=1-((row+1)*CELL_H-3)/ATLAS_H,v1=1-(row*CELL_H+3)/ATLAS_H;
   const halfW=card.w*.5,halfH=card.h*.5,c=point(a.center,a.right,a.up,card.x,card.y,card.depth,a.forward);
   const quad=[[ -halfW,halfH,u0,v1],[halfW,halfH,u1,v1],[halfW,-halfH,u1,v0],[-halfW,halfH,u0,v1],[halfW,-halfH,u1,v0],[-halfW,-halfH,u0,v0]];
   for(const [x,y,u,v] of quad)vertices.push(...point(c,a.right,a.up,x,y,0,a.forward),u,v,i);
  });
  gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(vertices));this.count=vertices.length/6;
 }
 point(clientX,clientY,rect){this.pointer={nx:((clientX-rect.left)/Math.max(1,rect.width))*2-1,ny:((clientY-rect.top)/Math.max(1,rect.height))*2-1,aspect:rect.width/Math.max(1,rect.height)}}
 aim(player,aspect){if(!this.opened)return null;const ray=this.pointer?pointerRay(player,this.pointer.nx,this.pointer.ny,this.pointer.aspect):player.direction();const found=spatialHit(this.anchor,this.cards,player,ray);this.hover=found;return found?.id||null}
 click(){return this.hover?.id||null}
 drawAtlas(){const ctx=this.ctx;ctx.clearRect(0,0,ATLAS_W,ATLAS_H);
  this.cards.forEach((card,i)=>{const x=i%5*CELL_W+3,y=Math.floor(i/5)*CELL_H+3,w=CELL_W-6,h=CELL_H-6;
   const isHeader=!card.id.startsWith('item:'),active=isHeader?(card.id===`tab:${this.palette}`||card.id==='hand'&&this.selected===-1):Number(card.id.slice(5))===this.selected;
   const grad=ctx.createLinearGradient(x,y,x+w,y+h);grad.addColorStop(0,'rgba(54,60,65,.81)');grad.addColorStop(1,'rgba(29,34,38,.89)');
   rounded(ctx,x+5,y+8,w-10,h-16,22,grad,active?'rgba(235,200,155,.76)':'rgba(235,235,232,.25)');
   if(isHeader){ctx.font=font(29,true);ctx.fillStyle=active?'#f8dfb7':'#e6e7e3';ctx.textAlign='center';ctx.fillText(card.name,x+w/2,y+h/2+9);ctx.textAlign='left';return}
   const [r,g,b]=colorParts(card.color||'#888888'),base=`rgb(${r},${g},${b})`;
   ctx.fillStyle=base;ctx.fillRect(x+w/2-28,y+52,53,52);
   ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.moveTo(x+w/2-28,y+52);ctx.lineTo(x+w/2-12,y+38);ctx.lineTo(x+w/2+41,y+38);ctx.lineTo(x+w/2+25,y+52);ctx.fill();
   ctx.fillStyle='rgba(0,0,0,.27)';ctx.beginPath();ctx.moveTo(x+w/2+25,y+52);ctx.lineTo(x+w/2+41,y+38);ctx.lineTo(x+w/2+41,y+90);ctx.lineTo(x+w/2+25,y+104);ctx.fill();
   ctx.textAlign='center';ctx.font=font(30,true);ctx.fillStyle='#efeee9';ctx.fillText(card.name,x+w/2,y+159,173);ctx.font=font(19);ctx.fillStyle='#aeb5b3';ctx.fillText(String(Number(card.id.slice(5))+1),x+w/2,y+184);ctx.textAlign='left';
  });this.dirty=false;
 }
 render(vp){if(!this.opened||!this.anchor||!this.count)return;const gl=this.gl;
  if(this.dirty){this.drawAtlas();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)}
  gl.useProgram(this.program);gl.uniformMatrix4fv(this.u.vp,false,vp);gl.uniform1i(this.u.atlas,1);gl.uniform1i(this.u.hover,this.hover?.index??-1);gl.uniform1i(this.u.selected,this.selected<0?2:this.selected+4);
  gl.bindVertexArray(this.vao);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES,0,this.count);
  gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.disable(gl.BLEND);
 }
}
