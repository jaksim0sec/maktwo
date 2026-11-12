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
export function makeTextureLayers(size=TEXTURE_SIZE){const layers=MATERIALS.length,out=new Uint8Array(size*size*layers*4);
 for(let m=0;m<layers;m++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=rand(x,y,m),smooth=rand(Math.floor(x/4),Math.floor(y/4),m),xnorm=x/size,ynorm=y/size;
  let f=.91+.15*n+.06*smooth;
  if(m===0){ // speckled grass
   if(n>.90)f*=1.09;
  }else if(m===1){ // grassy fringe along the top edge
   if(y<size*.22+Math.floor(rand(x,0,m)*4))f*=1.11;
  }else if(m===3||m===8){ // stone and cobble mineral seams
   if((x+Math.floor(smooth*3))%11===0&&y%7<5)f*=.83;
   if(m===8&&(x%13===0||y%12===0))f*=.79;
  }else if(m===4){f=.95+.10*n+.025*Math.sin(x*.52+y*.4)}
  else if(m===5){if(y%6===0)f*=.80;f*=.96+.08*Math.sin(y*.7+n*2)}
  else if(m===6){const radius=Math.hypot(xnorm-.5,ynorm-.5);f*=.90+.14*Math.sin(radius*24)}
  else if(m===7){if(n>.81)f*=1.13}
  else if(m===9){if(y%8===0)f*=.69;else if((x+(Math.floor(y/8)%2)*13)%19===0)f*=.80;f*=.96+.04*Math.sin(y*.45)}
  else if(m===10){if(x%8===0||y%8===0)f*=.84}
  else if(m===11){if(n>.94&&((x+y)%7<3))f*=1.18}
  else if(m===12){if(x%8===0)f*=.78;if(y===(size/3|0)||y===(size*2/3|0))f*=.83;}
  const a=(m*size*size+y*size+x)*4;
  const v=Math.max(90,Math.min(255,Math.round(f*255)));out[a]=out[a+1]=out[a+2]=v;out[a+3]=255;
 }
 return{data:out,size,layers};
}
