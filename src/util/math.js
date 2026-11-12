export const floor=Math.floor,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hash(x,y=0,z=0,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1442695041)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
export function noise(x,z,seed=0){const i=floor(x),k=floor(z),u=x-i,v=z-k,s=t=>t*t*(3-2*t),a=s(u),b=s(v),lerp=(p,q,t)=>p+(q-p)*t;return lerp(lerp(hash(i,0,k,seed),hash(i+1,0,k,seed),a),lerp(hash(i,0,k+1,seed),hash(i+1,0,k+1,seed),a),b)*2-1}
export function fbm(x,z,seed=0,oct=4){let sum=0,amp=1,norm=0;for(let i=0;i<oct;i++){sum+=noise(x,z,seed+i*97)*amp;norm+=amp;x*=2;z*=2;amp*=.5}return sum/norm}
export function key(cx,cz){return `${cx},${cz}`}
export const dist2=(a,b)=>((a.x-b.x)**2+(a.z-b.z)**2);
