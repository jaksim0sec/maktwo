import {fbm,clamp} from '../util/math.js';
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export function integratedTerrain(x,z,seed){
 const warpX=fbm(x*.0031,z*.0031,seed+101,3)*68;
 const warpZ=fbm(x*.0031,z*.0031,seed+209,3)*68;
 const xx=x+warpX,zz=z+warpZ;
 const continent=fbm(xx*.0026,zz*.0026,seed+311,4);
 const bands=fbm(xx*.004,zz*.004,seed+401,3);
 const mountain=smooth(-.12,.34,bands+.20*continent);
 const ridgeField=fbm(xx*.0124,zz*.0124,seed+502,4);
 const ridge=Math.pow(1-Math.abs(ridgeField),2.8);
 const fine=fbm(xx*.028,zz*.028,seed+581,3);
 const valleyField=fbm(xx*.007,zz*.007,seed+623,3)+fine*.12;
 const canyon=1-smooth(.02,.155,Math.abs(valleyField));
 const basin=1-smooth(-.20,.07,continent);
 const h=23+continent*8+fine*3+mountain*(6+31*ridge)-canyon*(5+mountain*14)-basin*4;
 const height=clamp(Math.round(h),5,57);
 const moisture=fbm(x*.006,z*.006,seed+728,3),temperature=fbm(x*.003,z*.003,seed+813,3);
 let biome=height>43?'mountains':height<=18&&moisture>.08?'marsh':moisture>.16?'forest':temperature>.12&&moisture<-.12?'desert':'plains';
 if(mountain>.65&&height>35)biome='mountains';
 return {height,biome,mountain,canyon,moisture,basin};
}