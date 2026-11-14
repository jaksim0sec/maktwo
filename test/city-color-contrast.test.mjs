import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');
const light=(exposure,hemisphere=0.5,height=1,facing=0)=>{
 const d=exposure,sky=(1-.38)*d*d+.38*d;
 const bounce=[.032+.008*hemisphere,.043+.010*hemisphere,.051+.012*hemisphere];
 const tint=[.44+.10*height,.62+.17*height,.67+.18*height];
 const s=Math.max(0,Math.min(1,(d-.68)/(.96-.68)));
 const sun=s*s*(3-2*s)*facing*(.65+.35*height);
 return bounce.map((v,i)=>v+tint[i]*sky+[.47,.39,.24][i]*sun);
};
const luma=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];

test('clear morning city sky sits above a teal ground haze instead of night color',()=>{
 assert.match(src,/vec3 citySky=mix\(vec3\(\.76,\.87,\.88\),vec3\(\.55,\.74,\.87\)/);
 assert.match(src,/float reach=uGroundView\.y\/max\(\.001,depth\)/);
 assert.match(src,/float haze=smoothstep\(55\.,480\.,reach\)/);
 assert.match(src,/vec3 groundHaze=mix\(vec3\(\.20,\.25,\.28\),vec3\(\.075,\.741,\.608\),\.14\)/);
 assert.match(src,/const fog=city\?\[\.118,\.205,\.232\]/);
 assert.match(src,/if\(city\)gl\.uniform3f\(this\.u\.LowerFog,\.060,\.108,\.132\)/);
 assert.match(src,/gl\.uniform2f\(this\.skyGradient,this\.citySkyTone,this\.cityGroundFade\)/);
});
test('bright openings remain bright without washing out enclosed buildings',()=>{
 assert.match(src,/float daylight=\.025;/);
 assert.match(src,/float skyFill=mix\(daylight\*daylight,daylight,\.38\)/);
 assert.match(src,/vec3 fill=mix\(vec3\(\.032,\.043,\.051\),vec3\(\.040,\.053,\.063\),hemisphere\)/);
 assert.match(src,/vec3 skyTint=vec3\(\.44,\.62,\.67\)\+vec3\(\.10,\.17,\.18\)\*outdoorHeight;/);
 assert.match(src,/vec3\(\.47,\.39,\.24\)\*facing\*smoothstep\(\.68,\.96,daylight\)\*mix\(\.65,1\.,outdoorHeight\)/);
 const sealed=light(.025),window=light(.40),open=light(1,.5,1,.8);
 assert.ok(luma(sealed)<.08,'sealed interior stays genuinely dark');
 assert.ok(luma(window)>luma(sealed)*4,'sunlit gap brightens near surfaces');
 assert.ok(luma(open)>luma(window)*2,'open street is substantially brighter than a gap');
 assert.ok(window[2]>window[0]*1.3,'daylight bounce remains cool in shade');
});
test('sky occlusion, light colors, and distant geometry stay intact',()=>{
 assert.match(src,/if\(uCityDaylight&&light\.a>0\.\)/);
 assert.match(src,/texelFetch\(uLightVolume,cell,0\)/);
 assert.match(src,/daylight=mix\(daylight,light\.a,weight\)/);
 assert.match(src,/emission\*=mix\(\.68,\.88,outdoorHeight\)/);
 assert.match(src,/if\(uDistant\)ambient=vec3\(\.23,\.33,\.39\)/);
 assert.match(src,/gl\.uniform1f\(this\.u\.brightness,\.35\+\.43\*skyLight\)/);
 assert.match(src,/if\(nearChunk&&\(!uFarPass\|\|!outsideNearY\)\)discard/);
});
