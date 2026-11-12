import {fbm,clamp} from '../util/math.js';
// Experimental mountain regions are completely isolated from legacy worlds.
// Based on layered noise, ridges and warp, not a claim of simulated hydraulic erosion.
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function highlandAt(x,z,seed){
 // Large-scale warps give mountain chains direction rather than isolated humps.
 const wx=x+fbm(x*.0032,z*.0032,seed+700,3)*48;
 const wz=z+fbm(x*.0032,z*.0032,seed+970,3)*48;
 const continental=fbm(wx*.0033,wz*.0033,seed+101,3);
 const belt=smooth(-.18,.35,fbm(wx*.0046,wz*.0046,seed+120,3));
 const ridge=Math.pow(1-Math.abs(fbm(wx*.014,wz*.014,seed+230,3)),2.35);
 const foothills=fbm(wx*.028,wz*.028,seed+248,3)*3;
 // A curved, winding canyon follows a low-frequency zero crossing.
 const river=fbm(wx*.0071,wz*.0071,seed+350,3)+fbm(wx*.021,wz*.021,seed+351,2)*.23;
 const valley=1-smooth(.025,.14,Math.abs(river));
 const h=22+continental*9+belt*ridge*29+foothills-valley*(9+7*belt);
 return {height:clamp(Math.floor(h),5,56),ridge,belt,valley};
}

export const highlandBiome=terrain=>terrain.height>42?'mountains':terrain.valley>.65?'plains':terrain.belt>.55?'forest':'plains';
