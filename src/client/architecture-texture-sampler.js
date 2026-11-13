// Deterministic 32x32 material patterns. Pigment comes from the block color.
// Tile joints, mineral chips, formwork, mortar, folds and planks stay distinct.
function noise(x,y,s){
 let v=Math.imul(x+89,374761393)^Math.imul(y+43,668265263)^Math.imul(s+13,2246822519);
 v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;
}
function joint(u,v,w,h,offset=0){
 const row=Math.floor(v/h),a=(u+(row%2?offset:0))%w,b=v%h;
 return {row,edge:a<.85||b<.85,rim:a<1.6||b<1.6};
}
export function sampleArchitectureTexture(index,x,y,size=32){
 const family=Math.floor(index/5),style=index%5,u=x*32/size,v=y*32/size;
 const n=noise(x,y,index),fine=noise(x>>1,y>>1,index+97);
 const patch=noise(x>>2,y>>2,index+211),large=noise(x>>3,y>>3,index+391);
 let f=.92+.12*(patch-.5)+.04*(n-.5),r=1,g=1,b=1;
 if(family===0){
  const dimensions=[[8,16],[8,8],[16,16],[4,4],[16,8]][style];
  const j=joint(u,v,dimensions[0],dimensions[1]);
  const tile=noise(Math.floor(u/dimensions[0]),Math.floor(v/dimensions[1]),index+31);
  f=.96+.09*(tile-.5)+.026*(n-.5);
  if(j.edge)f*=.62;else if(j.rim)f*=.93;
  if(j.rim&&fine>.78&&patch<.48)f*=.79;
  if(v>23&&large<.24)f*=.90;
  if(style===1){r=.96;g=.99;b=1;}
  if(style===2)f+=.04*Math.sin(u*.23+v*.14);
  if(style===3){f+=.17*(tile-.5);r=.97;b=1.015;}
  if(style===4&&Math.abs(Math.sin(u*.42+v*.34+Math.sin(v*.43)))<.055&&!j.edge)f*=.78;
 }else if(family===1){
  if(style<=2){
   const crystal=noise(x>>1,y>>1,index+121);
   f=.84+.19*crystal+.09*(n-.5);
   if(n>.9)f*=1.12;else if(n<.11)f*=.75;
   if(style===1){g=.96;b=.94;}
   if(style===2)f=.75+.25*crystal+(n>.91?.2:n<.14?-.14:0);
  }else if(style===3){
   const chip=noise(Math.floor(u/3.5),Math.floor(v/3.5),index+78);
   f=.95+.03*(n-.5)+(chip>.67?.16:chip<.18?-.18:0);
   if(u%3.5<.6||v%3.5<.6)f*=.95;
  }else{
   const vein=Math.sin(v*.37+u*.13+1.9*Math.sin(u*.23+v*.18));
   f=.98+.05*(large-.5)-(Math.abs(vein)<.095?.18:.015);
   if(u<.85||v<.85)f*=.86;
  }
 }else if(family===2){
  f=.9+.13*(patch-.5)+.05*(n-.5);
  if(style===0){
   if(u<.85||v<.85)f*=.75;
   if(v>22&&patch<.4)f*=.83;
   if(noise(Math.floor(u/8),Math.floor(v/8),index+71)>.83&&Math.hypot(u%8-4,v%8-4)<1)f*=.66;
   if(n<.045)f*=.77;
  }else if(style===1){if(n>.72)f*=1.11;else if(n<.19)f*=.76;}
  else if(style===2){f=.83+.25*patch+.1*(n-.5);if(fine<.17)f*=.79;}
  else if(style===3)f=.97+.04*Math.sin(u*.18+v*.13)+.02*(large-.5);
  else{const repair=(u>5&&u<23&&v>8&&v<25);f=repair?.99:.84;if(u===5||u===23||v===8||v===25)f*=.84;f+=.04*(patch-.5);}
 }else if(family===3){
  const dims=[[16,8],[16,8],[16,10],[16,5],[16,8]][style];
  const j=joint(u,v,dims[0],dims[1],dims[0]/2);
  f=.87+.14*patch+.055*(fine-.5);
  if(j.edge)f*=style===4?.84:style===3?.76:.58;
  if(j.rim&&fine>.84&&patch<.31)f*=.81;
  else if(j.rim)f*=1.04;
  if(style===0){g=.94;b=.89;}
  if(style===2)f=.94+.06*patch-(j.edge?.16:0);
  if(style===3){f=.96+.05*patch-(j.edge?.19:0);b=.98;}
  if(style===4){if(Math.sin(u*.18+v*.3)>.79&&patch>.56)f*=.76;b=.94;}
 }else if(family===4){
  f=.91+.09*(patch-.5)+.03*(n-.5);
  if(style===0){f=.93+.025*(n-.5);if(n>.977)f*=1.2;}
  else if(style===1){f=.87+.14*noise(x>>1,y>>1,index+75);b=1.02;}
  else if(style===2){f=.87+.15*patch-.2*Math.max(0,Math.sin(u*.46+large*3))*v/32;if(n<.14)f*=.76;g=.9;b=.83;}
  else if(style===3){f=.93+.055*Math.sin(v*2.4)+.03*(n-.5);b=1.02;}
  else{const rib=u%8;f=(rib<1.2?.63:rib<2.8?1.05:rib<6?.87:.73)+.03*(patch-.5);}
 }else{
  if(style===0){const j=joint(u,v,16,8,8);f=.85+.18*noise(Math.floor(u/16),j.row,index+44);if(j.edge)f*=.56;}
  else if(style===1){const j=joint(u,v,16,16);f=.96+.08*(noise(Math.floor(u/16),Math.floor(v/16),index+32)-.5);if(j.edge)f*=.72;}
  else if(style===2){f=.94+.05*patch+.03*Math.sin(u*.17+v*.11);if(u<.85)f*=.82;g=.96;b=.91;}
  else if(style===3){f=.77+.2*patch+.08*(fine-.5);if(n>.9)f*=1.2;else if(n<.1)f*=.8;}
  else{const j=joint(u,v,8,32);f=.92+.065*Math.sin(v*.74+.45*Math.sin(u*.37))+.025*(n-.5);if(j.edge)f*=.62;g=.96;b=.89;}
 }
 return [Math.max(.48,Math.min(1.16,f)),r,g,b];
}
