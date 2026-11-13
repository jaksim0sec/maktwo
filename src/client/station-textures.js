// Hand-authored 32x32 pixel rules for the station's 20 tile families.
// Generated once on texture-array upload, never per render frame.
const mod=(x,n)=>(x%n+n)%n;
function noise(x,y,seed){
 let n=Math.imul(x+51,374761393)^Math.imul(y+79,668265263)^Math.imul(seed+31,2246822519);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
const line=(x,at,width=1)=>Math.abs(x-at)<width;
const seam=(u,step,width=1)=>mod(u,step)<width;
export function sampleStationTexture(kind,x,y,size=32){
 const u=Math.floor(x*32/size),v=Math.floor(y*32/size);
 const n=noise(u,v,kind),grain=noise(u>>1,v>>1,kind+101),patch=noise(u>>3,v>>3,kind+301);
 const chips=noise(u>>2,v>>2,kind+501);
 let f=.90+.13*(patch-.5)+.055*(n-.5),r=1,g=1,b=1;
 switch(kind){
 case 0: { // Chipped ballast stones, dark gaps and occasional pale mineral.
  const cx=u>>2,cy=v>>2,q=noise(cx,cy,19),edge=mod(u,4)===0||mod(v,4)===0;
  f=edge?.42+q*.14:.73+q*.33;
  if(n>.89)f*=1.11;break;
 }
 case 1: // Deep black oil running along the ends of old timber ties.
  f=.78+.16*grain+.07*Math.sin(v*1.18+Math.sin(u*.32));
  if(seam(u,12,1))f*=.55;
  if(v>23&&chips<.27)f*=.73;
  if((u===7||u===25)&&(v===4||v===28))f*=.58;
  break;
 case 2: // Running-rail crown, broad specular band, narrow oxidized edge.
  f=.73+.20*patch+((u>12&&u<18)? .20:0);
  if(line(u,6)||line(u,27))f*=.54;
  if(n>.985)f*=.72;
  break;
 case 3: // Steel darkened by oily grease beneath running rail.
  f=.66+.24*grain;if(v>19&&patch<.5)f*=.67;
  if(seam(v,7,1))f*=.79;break;
 case 4: { // Long staggered platform stone with worn grout.
  const row=v>>3,joint=mod(u+(row&1)*16,32);
  f=(seam(v,8,1)||joint<1)? .56:.96+.09*(grain-.5);
  if(joint<3&&n>.7)f*=.79;
  if(patch<.18&&v>21)f*=.78;
  break;
 }
 case 5: { // Raised truncated domes, laid in a tactile warning grid.
  const dx=mod(u,8)-3.5,dy=mod(v,8)-3.5,d=dx*dx+dy*dy;
  f=d<6?1.13:d<12?.87:.79;
  if(n>.96)f*=.69;
  r=1.03;g=.99;b=.82;break;
 }
 case 6: { // Faded orange platform warning chevrons.
  const stripe=mod(u+v,16),worn=patch<.33&&n>.38;
  f=(stripe<7?.98:.62)+(n-.5)*.08;
  if(worn)f*=.59;
  r=1.05;g=.96;b=.79;break;
 }
 case 7: { // Thick cream glazed station tiles; mortar gathers soot.
  const grout=seam(u,16,1)||seam(v,8,1);
  f=grout?.50:.98+.06*(grain-.5);
  if(v>24&&patch<.45)f*=.76;break;
 }
 case 8: { // Cracked sea-glass tiles, with sharp sparse fissures.
  const grout=seam(u,16,1)||seam(v,16,1);
  f=grout?.53:.92+.10*(grain-.5);
  const crack=Math.abs(v-(9+u*.38+2*Math.sin(u*.7)))<.65;
  if(crack&&patch<.76)f*=.55;
  if(n>.98)f*=1.17;
  r=.90;g=1.02;b=1.08;break;
 }
 case 9: // Damp concrete: moss at grout edges and at the lower border.
  f=.84+.21*grain-(v>19?.11+.14*(1-patch):0);
  if(chips<.28&&n>.36){g=1.13;r=.84;b=.89;f*=.73}
  if(seam(v,16,1))f*=.62;break;
 case 10: { // Thin horizontal folded carriage skin, 6px step with scratches.
  const fold=mod(v,6);
  f=fold===0?.50:fold===1?.79:fold===2?1.05:.91;
  if(seam(u+Math.floor(v*.32),23,1)&&n>.36)f*=.70;
  if(chips<.23&&n>.66)f*=.84;break;
 }
 case 11: // Dusty off-white painted train panels, edge seams and paint chips.
  f=.95+.07*(patch-.5);
  if(seam(u,31,1)||seam(v,31,1))f*=.77;
  if(chips>.86&&n>.72)f*=.65;
  break;
 case 12: { // Stainless sliding door surface, rubber seals and handle scratches.
  f=.96+.035*Math.sin(u*2.5);
  if(u<2||u>29)f*=.42;
  else if(u<4||u>27)f*=.70;
  if(v>20&&n>.91)f*=.75;
  break;
 }
 case 13: { // Old smoked glass, greenish reflectance and dusty streaks.
  f=.88+.08*(grain-.5)+.12*Math.max(0,Math.sin((u+v*.43)*.23));
  if(Math.abs(v-(u*.3+4))<2)f*=1.1;
  if(n>.96)f*=.73;
  r=.90;g=1.01;b=1.05;break;
 }
 case 14: { // Seat upholstery, woven vinyl, split seams and worn center.
  f=.90+.13*grain;
  if(seam(u,8,1)&&n<.9)f*=.70;
  if(seam(v,5,1)&&n<.9)f*=.88;
  if(u>9&&u<23&&v>12&&v<25&&patch<.52)f*=.76;
  break;
 }
 case 15: // Non-slip rubber floor with raised stipple dots.
  f=mod(u,4)===1&&mod(v,4)===1?1.06:.78+.13*grain;
  if(seam(v,16,1))f*=.61;
  break;
 case 16: { // Electrical trunking: lid seam, fixing bolts and dirt.
  f=.85+.11*grain;
  if(seam(v,12,1))f*=.46;
  if((u===6||u===25)&&mod(v,12)===5)f*=.37;
  break;
 }
 case 17: { // Dark rectangular air grill, fins and rusted fastening heads.
  f=seam(v,5,2)?.43:.93+.05*grain;
  if(u<3||u>28)f*=.54;
  if((u===5||u===26)&&(v===5||v===26))f*=.35;
  if(patch<.18)f*=.87;
  break;
 }
 case 18: { // Station pipes with horizontal oxidation bands and join collars.
  f=.89+.08*Math.sin(u*.6)+.06*(grain-.5);
  if(seam(u,16,2))f*=.57;
  if(v>17&&chips<.35){r=.89;g=1.08;b=.96;f*=.72}
  break;
 }
 case 19: { // Old tiled concourse with black pollution drip and chipped glaze.
  f=.88+.15*grain;
  if(seam(u,16,1)||seam(v,8,1))f*=.53;
  if(u>7&&u<11&&v>11)f*=.64-.20*grain;
  if(chips<.22&&n>.55)f*=.66;
  break;
 }
 default:break;
 }
 return [Math.max(.25,Math.min(1.28,f)),r,g,b];
}
