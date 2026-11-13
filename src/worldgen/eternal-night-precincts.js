import {designBuilding,designShopModule,stairRisers} from './eternal-night-buildings.js';
import {designRoofWalkway} from './eternal-night-walkways.js';
import {CORE_DOME_HEIGHT} from './eternal-night-library.js';

const TYPES={market:3,housing:1,court:2,workshops:4,shops:0};
const CARDINAL=[[1,0],[-1,0],[0,1],[0,-1]];

/** Grow lots around shared passages. The grid reserves space; the modules own the geometry. */
// High-rise masses average 1.75 dome heights, with modest seeded variation.
// One-storey shops and street-front commercial strips retain their low scale.
export const DISTRICT_DOME_RATIO=1.75;
export const DISTRICT_HEIGHT_SPREAD=.17;
export function populatePrecincts(layout,grid,partitioned,{unit,buildingDensity,cityBlueprints=true},randomAt) {
  const {size,step,left,top,luxury,noise,buildable}=grid;
  const {sections,labels,tangentX,tangentZ}=partitioned;
  const occupied=new Uint8Array(buildable.length),lanes=new Uint8Array(buildable.length);
  const volumes=[],roofLinks=[],precincts=[],landmarks=new Map();
  const make=(bounds,type,section,support,y0,weight)=>{
    const {x0,z0,x1,z1}=bounds;
    return {...bounds,id:volumes.length,type,section:section.id,precinct:section.id,support,y0,luxury:weight,
      gx:(x0-left)/step,gz:(z0-top)/step,gw:(x1-x0)/step,gd:(z1-z0)/step,highRise:true};
  };
  let ringCount=0;
  if(!buildingDensity)return {volumes,roofLinks,precincts,occupied};
  for(const section of sections) {
    const cells=section.cells.filter(i=>buildable[i]);
    if(!cells.length)continue;
    const cx=section.index%size,cz=Math.floor(section.index/size);
    const alongX=Math.abs(tangentX[section.index])>Math.abs(tangentZ[section.index]);
    const precinct={id:section.id,axis:alongX?'x':'z',lanes:[],modules:[]};
    precincts.push(precinct);
    // A spine and occasional service branches reserve connected voids through the block.
    const band=i=>alongX?Math.floor(i/size):i%size;
    const along=i=>alongX?i%size:Math.floor(i/size);
    const middle=alongX?cz:cx,origin=alongX?cx:cz;
    const scores=new Map();
    for(const i of cells) {
      const cross=band(i)-middle,alongOffset=along(i)-origin;
      const laneOffset=alongOffset>6?1:alongOffset<-6?-1:0;
      const bend=alongOffset===-6&&cross===-1||alongOffset===6&&cross===1;
      if(cells.length>36&&(cross===laneOffset||bend||(alongOffset===4&&cross>=0&&cross<=3))) {
        lanes[i]=1;precinct.lanes.push(i);
      }
      scores.set(i,1/(1+Math.abs(cross-laneOffset))+.32*noise[i]+.3*randomAt(layout.noiseSeed,i,12));
    }
    cells.sort((a,b)=>scores.get(b)-scores.get(a)||a-b);
    const budget=Math.ceil(cells.length*Math.min(.98,buildingDensity*1.09));
    let used=0;
    for(const i of cells) {
      if(used>=budget)break;
      if(occupied[i]||lanes[i])continue;
      const x=i%size,z=Math.floor(i/size);
      const nearSpine=Math.abs(band(i)-middle)<=3;
      const random=salt=>randomAt(layout.noiseSeed,i,salt);
      const local=.72*luxury[i]+.28*section.luxury;
      const tier=local/layout.districtLuxuryMax;
      const roll=random(33);
      const program=nearSpine?(roll<.52?'market':roll<.78?'shops':'court'):(roll<.6?'housing':roll<.84?'workshops':'shops');
      const min=Math.max(2,Math.ceil((7.2*unit+3.8)/step));
      const max=program==='court'?min+3:program==='market'?min+2:min+1;
      const longLot=cityBlueprints&&(program==='housing'&&random(102)<.34||program==='market'&&random(102)<.24);
      const lotSizes=[[max,min+1],[min+1,max],[min+1,min],[min,min+1],[min,min],[1,1]];
      if(longLot)lotSizes.unshift([max+1,min]);
      if(cityBlueprints&&program==='court'&&random(103)<.35)lotSizes.unshift([min+2,min+2],[min+2,min+1]);
      if(alongX===(random(22)>.18))for(const p of lotSizes)p.reverse();
      // Give small individual shops priority directly along the public alley.
      const laneSide=CARDINAL.some(([dx,dz])=>{
        const nx=x+dx,nz=z+dz;
        return nx>=0&&nx<size&&nz>=0&&nz<size&&lanes[nz*size+nx]===1;
      });
      if(nearSpine&&laneSide&&(program==='market'||program==='shops')&&random(25)<.32)
        lotSizes.unshift(lotSizes.pop());
      let found;
      for(const [w,d] of lotSizes) {
        if(used+w*d>budget+2||w===1&&step<5.2)continue;
        for(const [ax,az] of [[0,0],[w-1,0],[0,d-1],[w-1,d-1]]) {
          const a=x-ax,b=z-az;
          if(a<0||b<0||a+w>size||b+d>size)continue;
          let clear=true;
          for(let dz=0;dz<d&&clear;dz++)for(let dx=0;dx<w;dx++) {
            const k=(b+dz)*size+a+dx;
            if(occupied[k]||lanes[k]||!buildable[k]||labels[k]!==section.id){clear=false;break;}
          }
          if(clear){found={a,b,w,d};break;}
        }
        if(found)break;
      }
      if(!found)continue;
      const {a,b,w,d}=found,small=w===1&&d===1;
      // Narrow lots share party-wall edges; larger ones have small service alleys.
      const gap=small?0:nearSpine?.50:.85;
      const inset=()=>gap;
      const v=make({x0:left+a*step+inset(61),z0:top+b*step+inset(62),x1:left+(a+w)*step-inset(63),z1:top+(b+d)*step-inset(64)},
        small?0:TYPES[program],section,null,layout.floorY,local);
      v.program=small?'shops':program;
      v.phase=random(94);
      v.moreBridges=cityBlueprints;
      if(small) {
        const frontage=[[0,-1],[1,0],[0,1],[-1,0]].findIndex(([dx,dz])=>
          a+dx>=0&&a+dx<size&&b+dz>=0&&b+dz<size&&lanes[(b+dz)*size+a+dx]);
        if(frontage>=0)v.frontSide=frontage;
        if(!designShopModule(v,unit,random))continue;
      } else {
        const pitch=stairRisers(v,unit)*unit/4;
        if(!pitch)continue;
        const landmark=!landmarks.has(section.district)&&w*d>=min*(min+1);
        // Keep the typical district roof near 1.75x the dome above the shared base.
        // Building-specific stair pitch determines floor count, never a taller storey.
        const centered=(random(98)*2-1)*DISTRICT_HEIGHT_SPREAD;
        const landmarkBonus=landmark?.07:0;
        const targetHeight=CORE_DOME_HEIGHT*DISTRICT_DOME_RATIO*(1+centered+landmarkBonus);
        const streetFront=nearSpine&&(program==='market'||program==='shops');
        const streetCap=4+Math.floor(random(47)*7);
        const preferred=Math.max(2,Math.round(targetHeight/pitch));
        const floors=Math.min(streetFront?Math.min(preferred,streetCap):preferred,
          Math.floor((layout.floorTop-v.y0)/pitch)-1);
        if(floors<1)continue;
        v.y1=v.y0+pitch*floors;
        if(cityBlueprints&&!landmark){
          const narrow=Math.min(v.x1-v.x0,v.z1-v.z0),long=Math.max(v.x1-v.x0,v.z1-v.z0);
          const variant=random(106);
          if(program==='housing'){
            v.blueprint=long>=unit*13&&long/narrow>=1.28?'gallery':variant<.57?'balcony':undefined;
          }else if(program==='court'&&narrow>=unit*13&&long>=unit*15){
            v.blueprint=ringCount<2?'ring':variant<.72?'school':'department';
          }else if(program==='court'&&long>=unit*14&&variant<.64){
            v.blueprint='school';
          }else if(program==='market'&&long>=unit*13){
            v.blueprint=narrow>=unit*14&&variant<.26?'department':variant<.59?'arcade':'corner';
          }else if(program==='shops'&&long>=unit*12&&variant<.48){
            v.blueprint='corner';
          }
        }
        if(!designBuilding(v,unit,random))continue;
        if(v.floors[0].blueprint==='ring')ringCount++;
        if(landmark)landmarks.set(section.district,v);
      }
      if(v.y1>=layout.floorTop)continue;
      volumes.push(v);precinct.modules.push(v.id);used+=w*d;
      for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++)occupied[(b+dz)*size+a+dx]=1;
    }
  }

  // Roof workshops and small stores share the parent's stair exit and keep its shaft free.
  for(const host of [...volumes]) {
    if(host.floors.length<3||host.y1+6>=layout.floorTop)continue;
    const shaft=host.roof.holes[0],section=sections[host.section];
    const random=salt=>randomAt(layout.noiseSeed,host.id,salt);
    const xs=host.roof.outline.map(p=>p[0]),zs=host.roof.outline.map(p=>p[1]);
    const x0=Math.min(...xs)+1.4,z0=Math.min(...zs)+1.4,x1=Math.max(...xs)-1.4,z1=Math.max(...zs)-1.4;
    const strips=[[x0,z0,shaft.x0-1.8,z1],[shaft.x1+1.8,z0,x1,z1],[x0,z0,x1,shaft.z0-1.8],[x0,shaft.z1+1.8,x1,z1]];
    for(let n=0;n<12;n++) {
      const [a,b,c,d]=strips[(n+Math.floor(random(52)*4))%4];
      const w=Math.min(c-a,unit*(3.4+random(54+n)*2)),h=Math.min(d-b,unit*(3.3+random(72+n)*2));
      if(w<4||h<4)continue;
      const x=a+(c-a-w)*random(32+n),z=b+(d-b-h)*random(16+n);
      const child=make({x0:x,z0:z,x1:x+w,z1:z+h},5,section,host.id,host.y1,host.luxury*.76);
      child.program=random(9)>.55?'workshops':'shops';child.phase=random(10);
      if(!designShopModule(child,unit,random))continue;
      const link=designRoofWalkway(child,host,unit);
      if(!link)continue;
      volumes.push(child);roofLinks.push(link);
      precincts.find(p=>p.id===section.id)?.modules.push(child.id);
      break;
    }
  }
  return {volumes,roofLinks,precincts,occupied,lanes};
}
