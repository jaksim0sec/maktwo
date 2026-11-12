// Deterministic, small 32x32 tile layers. One texture-array sampling unit for
// all opaque blocks, retaining the existing seven-float greedy mesh format.
// Each pixel modulates the block's authored RGB color, not replacing its palette.
export const TEXTURE_SIZE=32;
export const MATERIALS=['잔디 윗면','잔디 측면','흙','돌','모래','나무 옆면','나무 단면','잎','조약돌','판자','유리','광석','문'];
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
export function makeTextureLayers(size=TEXTURE_SIZE){const layers=MATERIALS.length,out=new Uint8Array(size*size*layers*4);
 for(let m=0;m<layers;m++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=rand(x,y,m),smooth=rand(Math.floor(x/4),Math.floor(y/4),m);
  let f=.91+.15*n+.06*smooth;
  if(m===0){ // speckled grass
   if(n>.90)f*=1.09;
  }else if(m===1){ // grassy fringe along the top edge
   if(y<size*.22+Math.floor(rand(x,0,m)*4))f*=1.11;
  }else if(m===3||m===8){ // stone and cobble mineral seams
   if((x+Math.floor(smooth*3))%11===0&&y%7<5)f*=.83;
   if(m===8&&(x%13===0||y%12===0))f*=.79;
  }else if(m===4){f=.95+.10*n+.025*Math.sin(x*.52+y*.4)}
  else if(m===5){f=barkGrain(x,y,size,n,smooth)}
  else if(m===6){f=endGrain(x,y,size,n)}
  else if(m===7){if(n>.81)f*=1.13}
  else if(m===9){f=plankGrain(x,y,size,n)}
  else if(m===10){if(x%8===0||y%8===0)f*=.84}
  else if(m===11){if(n>.94&&((x+y)%7<3))f*=1.18}
  else if(m===12){if(x%8===0)f*=.78;if(y===(size/3|0)||y===(size*2/3|0))f*=.83;}
  const a=(m*size*size+y*size+x)*4;
  const v=Math.max(90,Math.min(255,Math.round(f*255)));out[a]=out[a+1]=out[a+2]=v;out[a+3]=255;
 }
 return{data:out,size,layers};
}
