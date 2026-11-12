// Deterministic, small 32x32 tile layers. One texture-array sampling unit for
// all opaque blocks, retaining the existing seven-float greedy mesh format.
// Each pixel modulates the block's authored RGB color, not replacing its palette.
export const TEXTURE_SIZE=32;
export const MATERIALS=['잔디 윗면','잔디 측면','흙','돌','모래','나무 옆면','나무 단면','잎','조약돌','판자','유리','광석','문','작업대 윗면'];
export function materialFor(id,face){
 switch(id){
  case 1:return face===2?1:face===3?3:2;
  case 2:return 3;
  case 3:return 4;
  case 4:return 5;
  case 6:return face===2||face===3?7:6;
  case 7:return 8;
  case 8:return 9;
  case 9:return 10;
  case 10:return 11;
  case 13:return 12;
  case 18:return 13;
  case 23:return face===2?14:10;
  default:return 0;
 }
}
function rand(x,y,s){let n=Math.imul(x+37,73856093)^Math.imul(y+51,19349663)^Math.imul(s+11,83492791);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295}

// Wood is drawn into a tiny reusable tile once, not computed during gameplay.
// Side faces use (horizontal coordinate, world height), so veins must run
// vertically. Curved fibres and an occasional knot replace the old y%6 bands.
export function barkGrain(x,y,size,n=0,smooth=0){
 const u=x*32/size,v=y*32/size;
 const knot=Math.exp(-(((u-11.4)/4.2)**2+((v-19.5)/6.2)**2));
 const bend=.7*Math.sin(v*.23+u*.06)+.5*Math.sin(v*.48-u*.15)+knot*1.9*Math.sin(v*.23);
 const fiber=u+bend;
 const broad=Math.sin(fiber*.93+.45*Math.sin(v*.17));
 const fine=Math.sin(fiber*2.15+.22*Math.sin(v*.29));
 const ring=Math.cos(fiber*3.45+knot*.8);
 return .91+.081*broad+.031*fine+.016*ring+.025*(smooth-.5)+.019*(n-.5)-.075*knot;
}
export function endGrain(x,y,size,n=0){
 const u=x/size-.52,v=y/size-.47;
 const drift=.024*Math.sin(y*.45)+.015*Math.cos(x*.33);
 const r=Math.hypot((u+drift)*1.07,(v-drift)*.92);
 const grain=Math.sin(r*62+2.2*Math.sin((x+y)*.15));
 return .89+.105*grain+.028*(n-.5);
}
export function plankGrain(x,y,size,n=0){
 const u=x*32/size,v=y*32/size;
 const joint=(v%16+16)%16;
 const seam=Math.min(joint,16-joint);
 const vein=Math.sin(v*.63+.22*Math.sin(u*.36))*.043+Math.sin(v*1.65+u*.09)*.018;
 return .96+vein+.023*(n-.5)-(seam<.7?.12:0);
}
// Compact, intentionally pixelated material art. Every surface has its own
// spatial structure (chips, fibres, mortar, joints), not just random grayscale.
// 14 x 32 x 32 RGBA8 ~= 56KiB. Texture array grows by one tiny layer.
export function makeTextureLayers(size=TEXTURE_SIZE){
 const layers=MATERIALS.length,out=new Uint8Array(size*size*layers*4);
 for(let m=0;m<layers;m++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=rand(x,y,m),fine=rand(x>>1,y>>1,m+31),patch=rand(x>>2,y>>2,m+71);
  let f=.89+.13*patch+.055*(fine-.5),r=1,g=1,b=1;
  const px=x*32/size,py=y*32/size;
  if(m===0){ // Mossy grass: short leaves and small shadow clusters.
   f=.89+.13*patch+.045*(n-.5);
   if(fine>.78&&((y+x*3)%7<2))f*=1.10;
   if(patch<.17&&n<.7)f*=.84;
   r=.95;g=1.0;b=.91;
  }else if(m===1){ // Grass covers dirt, with an irregular tufted edge.
   const edge=5+Math.floor(rand(x>>1,0,m)*4);
   if(y<edge){f=.92+.12*patch;r=.89;g=1.0;b=.87}
   else{f=.88+.14*patch+.05*(n-.5);r=1;g=.69;b=.60;
    if(fine<.12)f*=.82;}
  }else if(m===2){ // Soil: clay clumps and scattered mineral grains.
   f=.85+.18*patch+.035*(n-.5);
   if(fine<.14)f*=.87;
   if(fine>.90&&n>.66)f*=1.13;
   r=1;g=.96;b=.91;
  }else if(m===3){ // Stone: larger coherent planes, not static noise.
   f=.84+.19*patch+.035*(fine-.5);
   if((x+Math.floor(3*patch))%17===0&&n<.85)f*=.83;
   if(fine>.93)f*=1.09;
   r=.97;g=.99;b=1;
  }else if(m===4){ // Sand: matte, tiny sparse grains.
   f=.94+.075*patch+.025*(fine-.5);
   if(n>.955)f*=.86;
   r=1;g=.99;b=.94;
  }else if(m===5){ // Bark: winding, predominantly vertical fibres and rare knots.
   const knot=Math.exp(-(((px-11.5)/3.1)**2+((py-19)/4.5)**2));
   f=barkGrain(x,y,size,0.5,patch)+.016*(fine-.5)-.075*knot;
   if(Math.sin((px+.9*Math.sin(py*.19))*1.21)<-.79)f*=.83;
   r=1;g=.94;b=.89;
  }else if(m===6){ // Log ends: concentric irregular growth rings.
   f=endGrain(x,y,size,.5)+.055*(patch-.5);
   if(Math.abs(px-16)>14||Math.abs(py-16)>14)f*=.82;
   r=1;g=.93;b=.86;
  }else if(m===7){ // Foliage: clumps, branching gaps and leaf highlights.
   f=.75+.27*patch+.05*(fine-.5);
   if(patch<.11)f*=.72;
   if(fine>.83&&n>.5)f*=1.14;
   r=.93;g=1;b=.92;
  }else if(m===8){ // Cobbles: offset chiseled stones with mortar lines.
   const row=Math.floor(py/10),shift=row%2?5:0,u=(px+shift)%11,v=py%10;
   const nearJoint=u<1.1||v<1.3||u>10.5;
   f=.83+.19*patch+.035*(fine-.5);
   if(nearJoint)f*=.65;
   else if(u<2||v<2)f*=1.11;
   r=.97;g=.99;b=1;
  }else if(m===9){ // Planed boards: restrained grain, distinct horizontal joints.
   const row=Math.floor(py/8),seam=py%8;
   f=plankGrain(x,y,size,.5)+.034*(patch-.5);
   if(seam===0)f*=.73;
   if(seam===1)f*=1.09;
   if((px%29<2)&&row%2===0&&seam>1)f*=.90;
   r=1;g=.95;b=.88;
  }else if(m===10){ // Seamless glass: no painted frame on any tile edge.
   f=.98;r=.97;g=.995;b=1;
  }else if(m===11){ // Ore: a modest vein, not glittering random pixels.
   f=.83+.18*patch;
   if(Math.abs(py-(18+Math.sin(px*.35)*5))<2.5&&n>.35){f*=1.15;r=.9;g=.96;b=1}
   if(fine<.10)f*=.85;
  }else if(m===12){ // Door: two recessed panels, thin raised rim and crossbar.
   const rim=px<2||px>29||py<2||py>29;
   const frame=px<6||px>25||Math.abs(py-16)<2;
   f=.96+.055*(patch-.5);
   if(rim)f*=.72;
   else if(frame)f*=1.06;
   else if(px===6||px===25||py===5||py===27)f*=.79;
   else f*=.88+.045*Math.sin(px*.72+.2*Math.sin(py*.25));
   if(px>23&&px<27&&py>12&&py<15)f*=1.1;
   r=1;g=.96;b=.88;
  }else if(m===13){ // Crafting table: a pixelated nine-cell tool-marked tabletop.
   const cellX=Math.floor(px/10.67),cellY=Math.floor(py/10.67);
   const groove=px%10.67<1.0||py%10.67<1.0;
   f=.92+.07*patch+.025*(n-.5);
   if(groove)f*=.66;
   if((cellX+cellY)%2===0&&px%10.67>2&&py%10.67>2)f*=1.025;
   r=1;g=.94;b=.83;
  }
  const a=(m*size*size+y*size+x)*4;
  const shade=Math.min(1.18,Math.max(.53,f));
  out[a]=Math.round(Math.min(255,255*shade*r));
  out[a+1]=Math.round(Math.min(255,255*shade*g));
  out[a+2]=Math.round(Math.min(255,255*shade*b));
  out[a+3]=255;
 }
 return{data:out,size,layers};
}
