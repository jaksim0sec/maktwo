import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/client/renderer.js',import.meta.url),'utf8');

test('city sky and distance haze separate from the buildings',()=>{
 assert.match(src,/vec3 citySky=mix\(vec3\(\.62,\.75,\.83\),vec3\(\.33,\.52,\.66\)/);
 assert.match(src,/const fog=city\?\[\.166,\.235,\.281\]/);
 assert.match(src,/if\(city\)gl\.uniform3f\(this\.u\.LowerFog,\.096,\.138,\.162\)/);
 assert.match(src,/gl\.uniform2f\(this\.skyGradient,this\.citySkyTone,this\.cityGroundFade\)/);
});

test('outdoor skylight and directional sunlight remain sky-occlusion gated',()=>{
 assert.match(src,/float skyFill=daylight\*daylight\*\(\.55\+\.45\*daylight\)/);
 assert.match(src,/vec3\(\.45,\.39,\.30\)\*facing\*smoothstep\(\.75,1\.,daylight\)\*outdoorHeight/);
 assert.match(src,/if\(uDistant\)ambient=vec3\(\.298,\.365,\.428\)/);
 assert.match(src,/if\(uCityDaylight&&light\.a>0\.\)/);
 assert.match(src,/texelFetch\(uLightVolume,cell,0\)/);
 assert.match(src,/gl\.uniform1f\(this\.u\.brightness,\.35\+\.43\*skyLight\)/);
});

test('street shade brightens noticeably, while sheltered interior ambient remains restrained',()=>{
 const oldSun=.154+.30+.38,newSun=.170+.345+.45;
 const oldShade=.154+.30,newShade=.170+.345;
 const oldRoom=.140+.069*Math.pow(.22,3);
 const newRoom=.150+.080*Math.pow(.22,2)*(.55+.45*.22);
 assert.ok(newSun>oldSun&&newShade>oldShade);
 assert.ok(newRoom<oldRoom*1.16);
 assert.ok(.315>.25*1.2,'distant red fill lifts without changing block pigments');
});

test('cool sky reflections increase only on outdoor-exposed cells',()=>{
 assert.match(src,/vec3 skyTint=mix\(vec3\(\.080,\.091,\.102\),vec3\(\.295,\.385,\.485\),outdoorHeight\)/);
 assert.match(src,/float outdoorHeight=smoothstep/);
 assert.match(src,/float skyFill=daylight\*daylight\*\(\.55\+\.45\*daylight\)/);
 assert.match(src,/if\(uCityDaylight&&light\.a>0\.\)/);
 assert.match(src,/daylight=mix\(daylight,light\.a,weight\)/);
 assert.match(src,/texelFetch\(uLightVolume,cell,0\)/);
 const fill=d=>d*d*(.55+.45*d);
 const low=[.080,.091,.102].map(c=>c*fill(.22));
 const high=[.295,.385,.485].map(c=>c*fill(.80));
 assert.ok(low[2]-low[0]<.001,'underground blue contribution remains negligible');
 assert.ok(high[2]-high[0]>.1,'exposed sky retains cool contrast');
});
