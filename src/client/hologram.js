// World-space, WebGL2 hologram: a real 3D quad in the game projection.
// Pointer-lock stays active; mouse movement controls an in-scene reticle instead
// of forcing the player to release/re-capture the cursor for an HTML dialog.
const VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;
layout(location=1)in vec2 aUV;
uniform mat4 uVP;
out vec2 vUV;
void main(){vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`;
const FS=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTexture;
uniform vec2 uCursor;
out vec4 outputColor;
void main(){
 vec4 c=texture(uTexture,vUV);
 vec2 offset=(vUV-uCursor)*vec2(1.0,1.5);
 float dist=length(offset);
 float glow=(1.-smoothstep(.006,.022,dist))*.84;
 float ring=(1.-smoothstep(.002,.004,abs(dist-.013)))*.88;
 c.rgb=mix(c.rgb,vec3(.94,.78,.51),max(glow,ring));
 c.a=max(c.a,glow*.85+ring);
 outputColor=c;
}`;
const W=1024,H=680;
const font=(size,bold=false)=>`${bold?'600':'400'} ${size}px system-ui,-apple-system,'Noto Sans KR',sans-serif`;
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(`Hologram shader: ${gl.getShaderInfoLog(shader)}`);return shader}
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function hexRGB(color){const s=color.slice(1);return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]}
export class Hologram {
 constructor(gl){this.gl=gl;this.opened=false;this.palette='blocks';this.items=[];this.selected=0;this.cursor=[.5,.62];this.hover=null;this.anchor=null;this.dirty=true;
  const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(`Hologram link: ${gl.getProgramInfoLog(p)}`);this.program=p;
  this.uniforms={vp:gl.getUniformLocation(p,'uVP'),texture:gl.getUniformLocation(p,'uTexture'),cursor:gl.getUniformLocation(p,'uCursor')};
  this.canvas=document.createElement('canvas');this.canvas.width=W;this.canvas.height=H;this.ctx=this.canvas.getContext('2d');
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,30*4,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);gl.bindVertexArray(null);
 }
 open(player){this.opened=true;this.anchor={x:player.x,y:player.y+player.eye,z:player.z,yaw:player.yaw,pitch:player.pitch};this.cursor=[.5,.56];this.hover=null;this.dirty=true}
 close(){this.opened=false}
 setInventory(palette,items,selected){this.palette=palette;this.items=items;this.selected=selected;this.dirty=true}
 move(dx,dy){if(!this.opened)return;this.cursor[0]=Math.max(.04,Math.min(.96,this.cursor[0]+dx/880));this.cursor[1]=Math.max(.05,Math.min(.95,this.cursor[1]+dy/660));const h=this.hit();if(h!==this.hover){this.hover=h;this.dirty=true}}
 point(clientX,clientY,rect){
  // Translate a free mouse/touch position to the center-anchored perspective plane.
  // When pointer lock is active, relative movement is handled by move() instead.
  const aspect=rect.width/Math.max(1,rect.height),tan=Math.tan(75*Math.PI/360),distance=2.8;
  const fracX=4.15/(2*distance*tan*aspect),fracY=2.75/(2*distance*tan);
  const x=(clientX-rect.left)/rect.width,y=(clientY-rect.top)/rect.height;
  this.cursor[0]=Math.max(.02,Math.min(.98,(x-.5)/fracX+.5));
  this.cursor[1]=Math.max(.02,Math.min(.98,(y-.5)/fracY+.5));
  const hit=this.hit();if(hit!==this.hover){this.hover=hit;this.dirty=true}
 }
 hit(){const x=this.cursor[0]*W,y=this.cursor[1]*H;
  if(y>=112&&y<170){if(x>=54&&x<=215)return'tab:blocks';if(x>=225&&x<=386)return'tab:lights'}
  if(y>=205&&y<555&&x>=54&&x<972){const col=Math.floor((x-54)/184),row=Math.floor((y-205)/170),localX=(x-54)%184,localY=(y-205)%170;if(col<5&&row<2&&localX<169&&localY<148){const index=row*5+col;return index<this.items.length?`item:${index}`:null}}
  if(y>=582&&x>=760&&x<=975)return'close';
  return null;
 }
 click(){return this.hit()}
 drawCanvas(){const ctx=this.ctx;ctx.clearRect(0,0,W,H);
  // Dark glass, soft amber edge and lightly luminous pale text.
  rounded(ctx,20,18,W-40,H-36,34,'rgba(23,29,32,.93)','rgba(174,188,179,.35)');
  const halo=ctx.createLinearGradient(20,18,960,640);halo.addColorStop(0,'rgba(193,143,87,.18)');halo.addColorStop(.65,'rgba(80,108,118,.03)');halo.addColorStop(1,'rgba(94,127,134,.13)');rounded(ctx,24,22,W-48,H-44,32,halo);
  ctx.font=font(18,true);ctx.fillStyle='#d5b899';ctx.fillText('M A K T W O    /    NIGHT GARDEN',54,66);
  ctx.font=font(32,true);ctx.fillStyle='#f1ece0';ctx.fillText('가방',54,100);
  for(const [id,label,x] of [['blocks','건축',54],['lights','조명',225]]){
   const active=this.palette===id,hover=this.hover===`tab:${id}`;
   rounded(ctx,x,114,161,56,15,active?'rgba(179,138,89,.31)':hover?'rgba(130,148,146,.23)':'rgba(255,255,255,.06)',active?'#b69d79':hover?'#a7b0a9':'rgba(255,255,255,.08)');
   ctx.fillStyle=active?'#ffe0af':'#b8bdb8';ctx.font=font(23,active);ctx.fillText(label,x+55,150);
  }
  ctx.font=font(18);ctx.fillStyle='#a9aaa6';ctx.fillText('마우스로 고르고 클릭 · E 닫기 · L 종류 전환',454,146);
  for(let i=0;i<this.items.length;i++){
   const item=this.items[i],col=i%5,row=Math.floor(i/5),x=54+col*184,y=205+row*170,selected=i===this.selected,hover=this.hover===`item:${i}`;
   rounded(ctx,x,y,169,148,19,hover?'rgba(196,166,121,.20)':selected?'rgba(152,145,126,.18)':'rgba(255,255,255,.05)',hover?'rgba(244,200,145,.72)':selected?'rgba(210,170,116,.55)':'rgba(220,225,220,.09)');
   const [r,g,b]=hexRGB(item.color);const color=`rgb(${r},${g},${b})`;
   // A tiny shaded collectible block, drawn in the textured world-space panel.
   ctx.fillStyle=color;ctx.fillRect(x+65,y+30,43,43);
   ctx.fillStyle=`rgba(255,255,255,.22)`;ctx.beginPath();ctx.moveTo(x+65,y+30);ctx.lineTo(x+79,y+18);ctx.lineTo(x+122,y+18);ctx.lineTo(x+108,y+30);ctx.closePath();ctx.fill();
   ctx.fillStyle='rgba(0,0,0,.20)';ctx.beginPath();ctx.moveTo(x+108,y+30);ctx.lineTo(x+122,y+18);ctx.lineTo(x+122,y+61);ctx.lineTo(x+108,y+73);ctx.closePath();ctx.fill();
   ctx.fillStyle=selected?'#f5debb':'#e0e1da';ctx.font=font(18,selected);ctx.textAlign='center';ctx.fillText(item.name,x+84,y+115);
   ctx.font=font(14);ctx.fillStyle='#b0aaa0';ctx.fillText(String(i+1),x+143,y+24);ctx.textAlign='left';
  }
  ctx.font=font(18);ctx.fillStyle='#b7b6b0';ctx.fillText('불빛 하나에서 시작해 천천히 밤을 가꿔보세요',56,612);
  rounded(ctx,760,582,213,54,16,this.hover==='close'?'rgba(203,171,116,.25)':'rgba(250,246,234,.11)','rgba(219,206,187,.28)');
  ctx.font=font(20,true);ctx.fillStyle='#f0e8d9';ctx.fillText('돌아가기    E',791,616);
  this.dirty=false;
 }
 render(vp,time){if(!this.opened||!this.anchor)return;const gl=this.gl;
  if(this.dirty){this.drawCanvas();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)}
  const a=this.anchor,cy=Math.cos(a.yaw),sy=Math.sin(a.yaw),cp=Math.cos(a.pitch),sp=Math.sin(a.pitch);
  const forward=[-sy*cp,sp,-cy*cp],right=[cy,0,-sy],up=[sy*sp,cp,cy*sp];
  const floating=Math.sin(time*1.6)*.025;
  const center=[a.x+forward[0]*2.8+up[0]*floating,a.y+forward[1]*2.8+up[1]*floating,a.z+forward[2]*2.8+up[2]*floating];
  const position=(u,v)=>center.map((p,i)=>p+(u-.5)*4.15*right[i]+(.5-v)*2.75*up[i]);
  const points=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]],arr=[];
  for(const [u,v] of points)arr.push(...position(u,v),u,1-v);
  gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniforms.vp,false,vp);gl.uniform2f(this.uniforms.cursor,this.cursor[0],1-this.cursor[1]);gl.uniform1i(this.uniforms.texture,1);
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(arr));
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES,0,6);
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.disable(gl.BLEND);
 }
}
