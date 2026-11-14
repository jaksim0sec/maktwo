import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
const triplet=text=>text.split(',').map(Number);
const pair=name=>src.match(new RegExp('vec3 '+name+'=mix\\(vec3\\(([^)]+)\\),vec3\\(([^)]+)\\)')).slice(1,3).map(triplet);
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const light=(d,hemisphere=.5,height=1,facing=0)=>{
 const sky=d*(.54+.46*d);
 const bounce=lerp(...pair('fill'),hemisphere);
 const tint=lerp(...pair('skyTint'),height);
 const t=Math.max(0,Math.min(1,(d-.68)/.28));
 const sun=t*t*(3-2*t)*facing*(.65+.35*height);
 return bounce.map((v,i)=>v+tint[i]*sky+[.49,.43,.33][i]*sun);
};
const luma=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];

test('clear morning city sky sits above a teal ground haze instead of night color',()=>{
 const [horizon,sky]=pair('citySky');
 const haze=triplet(src.match(/vec3 groundHaze=vec3\(([^)]+)\)/)[1]);
 assert.ok(luma(horizon)>.76&&luma(sky)>.65);
 assert.ok(haze[1]>haze[2]&&haze[2]>haze[0]&&luma(haze)<.4);
 assert.match(src,/float reach=uGroundView\.y\/max\(\.001,depth\)/);
 assert.match(src,/float haze=smoothstep\(55\.,480\.,reach\)/);
 assert.match(src,/gl\.uniform2f\(this\.skyGradient,this\.citySkyTone,this\.cityGroundFade\)/);
});
test('bright openings remain bright without washing out enclosed buildings',()=>{
 assert.match(src,/float daylight=\.025;/);
 assert.match(src,/if\(vEmission<\.5\)c\+=\.014/);
 const sealed=light(.025),window=light(.40),open=light(1,.5,1,.8);
 assert.ok(luma(sealed)>.10&&luma(sealed)<.15,'sealed interior retains dark detail');
 assert.ok(Math.max(...sealed)-Math.min(...sealed)<.02,'deep shade remains nearly neutral');
 assert.ok(luma(window)>luma(sealed)*2,'window raises the light level');
 assert.ok(luma(open)>luma(window)*2,'open street is substantially brighter');
 assert.ok(window[1]>window[2]&&window[2]>window[0],'exposed bounce is teal');
});
test('sky occlusion, light colors, and distant geometry stay intact',()=>{
 assert.match(src,/if\(uCityDaylight&&light\.a>0\.\)/);
 assert.match(src,/texelFetch\(uLightVolume,cell,0\)/);
 assert.match(src,/daylight=mix\(daylight,light\.a,weight\)/);
 assert.match(src,/emission\*=mix\(\.68,\.88,outdoorHeight\)/);

 assert.match(src,/gl\.uniform1f\(this\.u\.brightness,\.35\+\.43\*skyLight\)/);
 assert.match(src,/if\(nearChunk&&\(!uFarPass\|\|!outsideNearY\)\)discard/);
});
