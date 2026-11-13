// Deterministic, small 32x32 tile layers. One texture-array sampling unit for
// all opaque blocks, retaining the existing seven-float greedy mesh format.
// Each pixel modulates the block's authored RGB color, not replacing its palette.
import {ARCH_MATERIALS,ARCH_MATERIAL_START} from '../core/architectural-materials.js';
import {sampleArchitectureTexture} from './architecture-texture-sampler.js';
import {STATION_MATERIALS,STATION_MATERIAL_START} from '../core/station-materials.js';
import {sampleStationTexture} from './station-textures.js';
export const TEXTURE_SIZE=32;
export const MATERIALS=['잔디 윗면','잔디 측면','흙','돌','모래','나무 옆면','나무 단면','잎','조약돌','판자','유리','광석','문','작업대 윗면','눈','얼음','층상 퇴적암','화강암','이끼','붉은 모래','침엽수 수피','석영','낡은 콘크리트','금 간 콘크리트','벗겨진 회벽','회색 바닥 타일','사무실 천장 패널','긁힌 철판','녹슨 철판','더러운 유리','상가 셔터','바랜 간판','상가 벽돌','노출 철근','곰팡이 회벽','콘크리트 잔해','천 차양','젖은 타일','흰 벽 타일','낡은 경고 표시',...ARCH_MATERIALS.map(m=>m.label),...STATION_MATERIALS.map(m=>m.label)];
// Only orientation-safe material families are transformed. Directional seams stay aligned.
// Modes: 3 = quarter-turns and reflection; 1 = reflection; 0 = unchanged.
const UV_VARIANTS=new Uint8Array(MATERIALS.length+1);
for(const id of [4,8,9,12,18,19,22,23,24,25,35,36])UV_VARIANTS[id]=3;
for(let id=46;id<=55;id++)UV_VARIANTS[id]=3; // stone, concrete
for(let id=61;id<=63;id++)UV_VARIANTS[id]=3; // non-directional metal weathering
for(const id of [6,10,20,21,28,29,31,33])UV_VARIANTS[id]=1; // maintain wood, rust streaks, shutters and brick direction
for(let id=71;id<=90;id++)UV_VARIANTS[id]=1; // station patterns remain aligned to track geometry
export const textureTransformMode=id=>UV_VARIANTS[id]||0;
export function materialUVTransform(id,random,authoredTurn=0){
 // Temporarily disable coordinate-hashed UV rotations and mirroring.
 // Preserve authored orientations on directional blocks; re-enable only
 // after visual review of the original texture alignment.
 // const mode=textureTransformMode(id),sample=Math.min(7,Math.floor(random*8));
 // const rotation=(mode>>1)*(sample&3),mirror=(mode&1)*(sample&4);
 // return authoredTurn?authoredTurn|mirror:rotation|mirror;
 return authoredTurn;
}
export function materialFor(id,face){
 if(id>=STATION_MATERIAL_START&&id<STATION_MATERIAL_START+STATION_MATERIALS.length)return 41+ARCH_MATERIALS.length+id-STATION_MATERIAL_START;
 if(id>=ARCH_MATERIAL_START&&id<ARCH_MATERIAL_START+ARCH_MATERIALS.length)return 41+id-ARCH_MATERIAL_START;
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
  case 24:case 26:return 9; // cobblestone for stone stairs/slabs
  case 25:case 27:case 28:return 10; // boards
  case 29:return 3;
  case 30:case 38:case 52:return 19;
  case 31:case 39:case 40:return 3;
  case 32:return 15;
  case 33:return 16;
  case 34:case 36:case 37:case 43:return 17;
  case 35:case 44:return 18;
  case 41:case 42:return 20;
  case 45:return face===2||face===3?7:21;
  case 46:case 48:return 8;
  case 47:return face===2||face===3?7:21;
  case 54:return 22; // quartz
  case 55:case 73:return 23;
  case 56:return 24;
  case 57:return 25;
  case 58:return 26;
  case 59:return 27;
  case 60:return 28;
  case 61:return 29;
  case 62:return 30;
  case 63:case 70:return 31;
  case 64:return 32;
  case 65:return 33;
  case 68:return 34;
  case 69:return 35;
  case 71:return 36;
  case 72:return 37;
  case 74:return 38;
  case 75:return 39;
  case 76:return 40;
  case 77:case 78:return 23;
  case 79:case 80:return 25;
  case 81:case 82:return 28;
  case 83:return 23;
  case 84:return 26;
  case 85:return 27;
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
  if(m>=40+ARCH_MATERIALS.length){
   const [shade,red,green,blue]=sampleStationTexture(m-40-ARCH_MATERIALS.length,x,y,size);
   const a=(m*size*size+y*size+x)*4;
   out[a]=Math.min(255,Math.round(255*shade*red));
   out[a+1]=Math.min(255,Math.round(255*shade*green));
   out[a+2]=Math.min(255,Math.round(255*shade*blue));out[a+3]=255;
   continue;
  }
  if(m>=40){
   const [shade,red,green,blue]=sampleArchitectureTexture(m-40,x,y,size),a=(m*size*size+y*size+x)*4;
   out[a]=Math.min(255,Math.round(255*shade*red));out[a+1]=Math.min(255,Math.round(255*shade*green));
   out[a+2]=Math.min(255,Math.round(255*shade*blue));out[a+3]=255;
   continue;
  }
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
  }else if(m===14){ // Snow: packed, low-contrast flakes.
   f=.94+.07*patch+.025*(fine-.5);if(n>.981)f*=.85;
  }else if(m===15){ // Frozen lake: irregular, translucent frost seams.
   f=.87+.10*patch;if(Math.abs(Math.sin(px*.31+py*.11))<.09)f*=1.07;
  }else if(m===16){ // Shale and layered bedrock: subtle fractured strata.
   f=.78+.22*patch;if(Math.abs(Math.sin(py*.36+px*.12))<.07)f*=.76;
  }else if(m===17){ // Granite: broad mineral clusters.
   f=.80+.22*patch+.08*(fine-.5);if(n>.95)f*=1.10;
  }else if(m===18){ // Moss: tiny organic flakes and dark undergrowth.
   f=.77+.22*patch;if(fine>.83)f*=1.1;
  }else if(m===19){ // Layered ochre sand and red clay.
   f=.82+.16*patch+.035*Math.sin(py*.42+px*.11);
  }else if(m===20){ // Cedar and birch bark.
   f=barkGrain(x,y,size,n,patch);if(px%9<1.0)f*=.89;
  }else if(m===21){ // Quartz crystals: pale branching veins.
   f=.87+.14*patch;if(Math.abs(py*.72-px*.40-10)<2.2)f*=1.12;
  }else if(m>=22&&m<=39){ // Ruins: damaged manufactured surfaces with category-specific marks.
   const seamX=Math.min(px%16,16-px%16),seamY=Math.min(py%16,16-py%16);
   const fissure=Math.abs(py-(9+px*.19+2*Math.sin(px*.44)))<1.1;
   const stain=Math.max(0,(py-11)/21)*(.18+.15*(1-patch));
   f=.78+.23*patch+.095*(fine-.5)+.04*(n-.5);
   if(m===22||m===23){ // Poured concrete, pitting and cracks.
    if((px<1||py<1)&&fine<.72)f*=.78;
    // Broad damp marks keep weathering legible under low station light.
    const damp=Math.max(0,Math.sin(px*.26+Math.sin(py*.29))*Math.sin(py*.22));
    f*=1-.12*damp;
    if(n>.975)f*=.76;
    if(m===23&&(fissure||Math.abs(px-21-4*Math.sin(py*.2))<.7))f*=.47;
    r=.96;g=.98;b=1;
   }else if(m===24||m===34){ // Whitewashed walls, peeling paint and damp mold.
    const drip=Math.max(0,rand(x>>2,0,m+413)-.48)*(.4+.6*Math.sin(py*.11)**2);
    f=.92+.08*patch-stain-.16*drip;
    if(fine>.79&&n>.5)f*=.65;
    if(m===34&&patch<.48){f*=.68;r=.74;g=.87;b=.74}
    else{r=1;g=.98;b=.94}
   }else if(m===25||m===37||m===38){ // Grout, stone speckles and wet floors.
    if(seamX<1||seamY<1)f*=.59;
    if(n>.94)f*=.78;
    if(m===37){f*=.77+Math.max(0,Math.sin(px*.27+py*.19))*.24;r=.91;g=.98;b=1}
    if(m===38){f=.93+.065*patch;if(seamX<.85||seamY<.85)f*=.70}
   }else if(m===26){ // Suspended ceiling grid and old water rings.
    f=.93+.045*patch;
    if(px<1.3||py<1.3)f*=.57;
    const ring=Math.abs(Math.hypot(px-20,py-12)-8);
    if(ring<1.2&&patch<.66)f*=.75;
   }else if(m===27||m===28){ // Brushed steel, scratches and brown rust trails.
    f=.87+.1*patch+.035*Math.sin(px*2.7);
    if(n>.94&&py>6)f*=.55;
    if(m===28){r=1;g=.76;b=.62;f-=stain*.65}
    else{r=.94;g=.98;b=1}
   }else if(m===29){ // Smudged window glass.
    f=.94+.05*patch-.09*Math.max(0,Math.sin((px+py)*.14));
    if(n>.95)f*=.78;r=.91;g=.97;b=1;
   }else if(m===30){ // Shutter's repeated horizontal folds.
    const fold=py%5;
    f=(fold<.9?.60:fold<2?.97:.85)+.12*patch;
    if(px%13<1&&n>.38)f*=.72;
   }else if(m===31){ // A painted shop sign with no invented lettering.
    f=.90+.08*patch;if(py<3||py>28)f*=.63;
    if(n>.89&&fine>.6)f*=.59;
    r=1;g=.96;b=.87;
   }else if(m===32){ // Old façade brick joints.
    const row=Math.floor(py/8),joint=(px+(row%2)*8)%16;
    if(py%8<1||joint<1)f*=.55;else if(joint<2)f*=1.08;
    r=.95;g=.93;b=.91;
   }else if(m===33){ // Exposed reinforcing steel lattice.
    f=(px%9<1.6||py%11<1.7)?.60:.89+.08*patch;
    r=.89;g=.88;b=.88;
   }else if(m===35){ // Angular chunks embedded in dusty rubble.
    if(Math.abs(Math.sin(px*.43+py*.51))<.14)f*=.58;
    if(n>.93)f*=1.14;
   }else if(m===36){ // Worn striped shop awnings.
    const stripe=Math.floor((px+py*.17)/6)%3;
    f=.75+.18*patch-(stripe===1?.19:0);
    if(stripe===1){r=1;g=.86;b=.78}else{r=.94;g=.92;b=.82}
   }else if(m===39){ // A worn safety stripe, mostly rubbed away.
    const stripe=Math.floor((px+py)/8)%2;
    f=(stripe?.63:.91)+.10*patch;
    if(fine>.82)f*=.76;
    r=1;g=.95;b=.69;
   }
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
