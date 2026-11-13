// Independently placeable architecture specimens. No full-building assembly.
// Parts own their shape, material and creative item; existing IDs stay fixed.
import {ARCH_MATERIAL_START} from './architectural-materials.js';
export const PART_ID_START=116;
export const PART_FAMILIES=Object.freeze([
  {
    "key": "passage",
    "label": "통로",
    "variants": [
      "폐쇄형 복도",
      "개방형 편복도",
      "기둥 아케이드",
      "설비 복도",
      "노천 교량"
    ]
  },
  {
    "key": "entrance",
    "label": "현관",
    "variants": [
      "석재 현관",
      "상가 출입구",
      "좁은 측면 현관",
      "철제 현관",
      "유리 현관"
    ]
  },
  {
    "key": "stairEntrance",
    "label": "계단입구",
    "variants": [
      "직선 진입",
      "이중 문틀",
      "좁은 계단실",
      "철제 계단실",
      "화강석 계단실"
    ]
  },
  {
    "key": "wall",
    "label": "벽",
    "variants": [
      "도장 미장벽",
      "세로 타일벽",
      "적벽돌 벽",
      "노출 콘크리트벽",
      "석재 마감벽"
    ]
  },
  {
    "key": "column",
    "label": "기둥",
    "variants": [
      "사각 콘크리트",
      "백색 타일기둥",
      "화강석 기둥",
      "H형강 기둥",
      "다각형 석재기둥"
    ]
  },
  {
    "key": "window",
    "label": "창문·창틀",
    "variants": [
      "철제 미닫이",
      "좁은 환기창",
      "삼분할 창",
      "가로 트랜섬",
      "프로젝트 창"
    ]
  },
  {
    "key": "partition",
    "label": "가벽",
    "variants": [
      "경량 칸막이",
      "석고 가벽",
      "철제 파티션",
      "유리 파티션",
      "조적 가벽"
    ]
  },
  {
    "key": "door",
    "label": "문",
    "variants": [
      "목재 패널문",
      "철제 방화문",
      "상가 유리문",
      "셔터형 문",
      "설비실 철문"
    ]
  },
  {
    "key": "staircase",
    "label": "계단",
    "variants": [
      "콘크리트 계단",
      "화강석 계단",
      "철제 계단",
      "목재 계단",
      "석재 계단"
    ]
  },
  {
    "key": "balcony",
    "label": "베란다",
    "variants": [
      "돌출 난간형",
      "매입 방호형",
      "철제 증축형",
      "유리 난간형",
      "지붕 부착형"
    ]
  },
  {
    "key": "ventilation",
    "label": "환풍기·설비",
    "variants": [
      "벽부 프로펠러",
      "금속 환기 그릴",
      "박스형 환풍기",
      "원통 덕트",
      "산업 송풍기"
    ]
  },
  {
    "key": "sign",
    "label": "조합형 간판",
    "variants": [
      "가로 판간판",
      "돌출 세로간판",
      "채널 문자 간판",
      "낡은 겹간판",
      "천막 간판"
    ]
  },
  {
    "key": "interior",
    "label": "인테리어",
    "variants": [
      "수납장",
      "의자와 테이블",
      "조명 fixture",
      "화분·잡화",
      "설비 캐비닛"
    ]
  },
  {
    key:'bookshelf',
    label:'도서관 서가',
    variants:['정돈된 장서','청회색 장서','적갈색 장서','빈 칸이 있는 장서','서가 받침']
  }
].map(f=>Object.freeze({...f,variants:Object.freeze(f.variants)})));
export const PARTS=Object.freeze(PART_FAMILIES.flatMap((family,section)=>family.variants.map((name,variant)=>Object.freeze({
 id:PART_ID_START+section*5+variant,
 key:'PART_'+family.key.toUpperCase()+'_'+(variant+1),
 name:family.label+' · '+name,section,variant,family:family.key
}))));
export const partById=id=>id>=PART_ID_START&&id<PART_ID_START+PARTS.length?PARTS[id-PART_ID_START]:null;
const tiles=[86,87,88,89,90],stones=[91,92,93,94,95],concretes=[96,97,98,99,100],bricks=[101,102,103,104,105],metals=[106,107,108,109,110],floors=[111,112,113,114,115];
// Every part is a stand-alone 1x1x1 buildable module. Coordinates are local to its own cell.
// Materials are stable full-block IDs; 32px texture layer is inherited from each material.
export function partGeometry(id){
 const p=partById(id);if(!p)return null;
 const v=p.variant,a=[];
 const put=(x,y,z,w,h,d,mat,alpha=false,solid=true,meta=null)=>{
  if(w<=0||h<=0||d<=0)throw Error('Invalid architectural shape');
  a.push({x,y,z,w,h,d,material:mat,alpha,solid,...meta});
 };
 const dark=metals[0],silver=metals[3],frame=v%2?metals[1]:dark;
 const edge=(height=.84,mat=dark)=>{
  put(.04,0,.06,.10,height,.10,mat);put(.86,0,.06,.10,height,.10,mat);
  put(.04,0,.84,.10,height,.10,mat);put(.86,0,.84,.10,height,.10,mat);
 };
 const lintel=(mat,top=.89)=>put(.03,top,.05,.94,.10,.90,mat);
 const mullion=(x,mat=frame)=>put(x,.16,.48,.055,.68,.08,mat);
 const rail=(mat=dark,glass=false)=>{
  for(const x of [.05,.46,.86])put(x,.12,.84,.075,.72,.075,mat);
  put(.04,.82,.82,.92,.09,.11,mat);
  if(glass)put(.12,.17,.88,.74,.60,.035,tiles[2],true);
  else for(const height of [.33,.55])put(.06,height,.85,.88,.045,.06,mat);
 };
 switch(p.family){
 case 'passage':{
  put(0,0,0,1,.12,1,floors[v]);
  if(v===0){for(const x of [.02,.88])put(x,.12,0,.10,.77,1,concretes[3]);lintel(concretes[3]);}
  if(v===1){put(.03,.1,.85,.07,.67,.08,metals[0]);rail();}
  if(v===2){edge(.82,tiles[0]);lintel(tiles[0],.84);}
  if(v===3){put(0,.82,0,1,.10,1,metals[4]);for(const z of [.22,.64])put(.1,.72,z,.8,.08,.08,metals[1]);}
  if(v===4){rail();put(.12,.02,.08,.77,.14,.12,metals[1]);put(.12,.02,.71,.77,.14,.12,metals[1]);}
  break;
 }
 case 'entrance':{
  put(.02,0,.03,.96,.12,.94,stones[v]);
  const material=[stones[0],tiles[0],concretes[3],metals[0],silver][v];
  for(const x of [.06,.83])put(x,.13,.42,.11,.75,.18,material);
  put(.06,.86,.42,.88,.12,.18,material);
  if(v===0)put(.13,.13,.49,.72,.13,.08,stones[2]);
  if(v===1){put(.17,.12,.49,.65,.69,.04,tiles[2],true);mullion(.48);}
  if(v===2)put(.23,.13,.50,.54,.67,.05,bricks[1]);
  if(v===3){for(let y=.18;y<.74;y+=.16)put(.2,y,.49,.60,.05,.07,metals[1]);}
  if(v===4){put(.17,.12,.5,.67,.73,.04,tiles[2],true);put(.18,.57,.51,.65,.06,.08,silver);}
  break;
 }
 case 'stairEntrance':{
  const s=stones[v],wall=v===3?metals[1]:concretes[v];
  put(.02,0,.02,.96,.13,.96,s);
  put(.07,.13,.48,.86,.20,.47,s);put(.07,.32,.68,.86,.19,.27,s);
  for(const x of [.07,.83])put(x,.32,.13,.10,.53,.17,wall);
  put(.07,.84,.13,.86,.11,.17,wall);
  if(v===1||v===4)put(.07,.13,.24,.86,.09,.08,metals[3]);
  if(v===2)put(.06,.55,.07,.88,.07,.12,metals[0]);
  if(v===3)for(const y of [.49,.68])put(.07,y,.73,.86,.055,.06,metals[0]);
  break;
 }
 case 'wall':{
  const mat=[concretes[3],tiles[0],bricks[0],concretes[0],stones[0]][v];
  put(.04,0,.39,.92,1,.22,mat);
  if(v===0)put(.04,0,.35,.92,.15,.045,metals[0]);
  if(v===1)for(const x of [.30,.60])put(x,0,.35,.025,1,.04,metals[2]);
  if(v===2)for(const y of [.29,.59])put(.04,y,.36,.92,.023,.035,concretes[2]);
  if(v===3){for(const y of [.12,.86])put(.09,y,.36,.11,.035,.035,metals[1]);}
  if(v===4){put(.04,.02,.36,.92,.075,.035,stones[2]);put(.04,.94,.36,.92,.06,.035,stones[4]);}
  break;
 }
 case 'column':{
  const mat=[concretes[0],tiles[0],stones[0],metals[1],stones[4]][v];
  if(v===3){put(.43,0,.14,.14,1,.72,mat);for(const z of [.13,.75])put(.20,0,z,.6,1,.11,mat);}
  else if(v===4){put(.36,0,.23,.28,1,.54,mat);put(.23,0,.36,.54,1,.28,mat);}
  else{const thick=v===2?.57:.46;put((1-thick)/2,0,(1-thick)/2,thick,1,thick,mat);}
  if(v===1)for(const y of [.2,.44,.69])put(.22,y,.22,.56,.025,.56,metals[1]);
  if(v===2){put(.16,0,.16,.68,.10,.68,stones[2]);put(.17,.9,.17,.66,.10,.66,stones[2]);}
  if(v===0)put(.21,.88,.21,.58,.12,.58,concretes[2]);
  break;
 }
 case 'window':{
  // A whole window per block: jamb, reveal, independent sash, glazing,
  // weatherstrip, sill and small hinge/handle shapes. Depth never fills the cell.
  const f=[dark,metals[1],metals[0],silver,metals[1]][v];
  const frame=(x,y,w,h)=>put(x,y,.455,w,h,.082,f);
  const glass=(x,y,w,h,z=.496)=>put(x,y,z,w,h,.022,tiles[2],true);
  const trim=(x,y,w,h)=>put(x,y,.419,w,h,.027,metals[3]);
  // Perimeter box with recessed thin sill and separate drainage rail.
  frame(.072,.075,.064,.85);frame(.864,.075,.064,.85);
  frame(.074,.075,.85,.065);frame(.074,.86,.85,.065);
  put(.065,.036,.405,.872,.038,.19,v===3?stones[0]:metals[1]);
  for(const x of [.10,.87])put(x,.89,.428,.029,.035,.13,metals[3]); // corner brackets
  if(v===0){ // Horizontal sliding aluminum sash, two offset glass leaves
   glass(.14,.15,.38,.65,.487);glass(.49,.15,.37,.65,.513);
   frame(.49,.13,.052,.69);trim(.135,.13,.045,.69);trim(.82,.13,.045,.69);
   put(.53,.43,.426,.052,.115,.045,metals[3]); // latch
   put(.10,.13,.42,.80,.028,.06,dark);
  }else if(v===1){ // High ventilation window above a solid opaque lower infill
   put(.137,.14,.481,.727,.33,.062,concretes[2]);
   glass(.14,.53,.72,.26);frame(.13,.48,.74,.056);
   for(const y of [.60,.69,.78])put(.15,y,.424,.70,.022,.04,silver);
   put(.79,.63,.42,.035,.082,.04,metals[3]);
  }else if(v===2){ // Tripartite narrow steel casements
   for(const [x,w] of [[.14,.19],[.38,.23],[.66,.20]])glass(x,.14,w,.70);
   for(const x of [.346,.633]){frame(x,.12,.051,.75);trim(x+.014,.15,.019,.68);}
   for(const x of [.28,.77])put(x,.49,.413,.023,.10,.035,silver);
   put(.13,.13,.43,.73,.028,.05,dark);
  }else if(v===3){ // Broad storefront transom with double glazing rails
   glass(.14,.14,.72,.39,.493);glass(.14,.60,.72,.21,.493);
   frame(.13,.54,.74,.061);trim(.13,.545,.74,.017);
   for(const x of [.16,.84])put(x,.55,.413,.02,.045,.045,metals[3]);
   put(.16,.1,.4,.68,.035,.05,stones[2]);
  }else{ // Hopper window, upper fixed sheet and lower hinged vent leaf
   glass(.14,.50,.72,.34,.504);
   put(.13,.46,.433,.74,.051,.095,f);
   glass(.165,.14,.67,.25,.48);
   for(const x of [.21,.78])put(x,.385,.418,.055,.10,.062,metals[3]); // hinge pins
   put(.46,.23,.39,.08,.10,.035,silver); // opening latch
   put(.16,.13,.42,.70,.032,.07,metals[0]);
  }
  break;
 }
 case 'partition':{
  const mat=[concretes[3],concretes[1],metals[1],metals[3],bricks[3]][v];
  const solid=v!==3;
  if(solid)put(.04,0,.45,.92,.96,.10,mat);
  else{put(.11,.12,.49,.78,.74,.035,tiles[2],true);for(const x of [.05,.87])put(x,.02,.41,.08,.95,.18,metals[0]);}
  if(v===0)put(.05,.04,.40,.9,.10,.05,metals[0]);
  if(v===1){for(const y of [.32,.66])put(.07,y,.39,.86,.045,.05,metals[1]);}
  if(v===2){for(const x of [.28,.56,.82])put(x,.02,.39,.025,.90,.05,dark);}
  if(v===3)for(const y of [.06,.91])put(.05,y,.41,.90,.07,.18,metals[0]);
  if(v===4)for(const y of [.22,.52,.81])put(.04,y,.40,.92,.03,.04,concretes[2]);
  break;
 }
 case 'door':{
  const mat=[floors[4],metals[0],silver,metals[2],metals[1]][v];
  for(const x of [.08,.84])put(x,.04,.41,.08,.92,.19,metals[0]);
  put(.08,.88,.41,.84,.08,.19,metals[0]);
  if(v===2){put(.17,.10,.49,.66,.75,.035,tiles[2],true);put(.18,.55,.40,.64,.055,.08,silver);}
  else if(v===3){for(let y=.13;y<.83;y+=.13)put(.16,y,.47,.68,.08,.11,mat);}
  else{put(.15,.10,.47,.70,.77,.09,mat);
   if(v===0)for(const y of [.21,.55])put(.22,y,.41,.56,.04,.04,stones[2]);
   if(v===1)put(.21,.69,.41,.58,.10,.045,metals[1]);
   if(v===4)put(.17,.47,.42,.66,.055,.055,metals[3]);
  }
  put(.74,.45,.36,.07,.06,.14,stones[2]);
  break;
 }
 case 'staircase':{
  // A three-riser run with distinct treads, open/detailed risers, nosings and
  // integrated sloped handrails. No independent fence block is needed.
  const carcass=[concretes[0],stones[0],metals[1],floors[4],stones[4]][v];
  const tread=[concretes[3],stones[0],metals[3],floors[4],stones[4]][v];
  const railMat=v===2?metals[3]:v===3?metals[0]:metals[0];
  const sections=[{z:0,d:.333,h:.25},{z:.333,d:.334,h:.49},{z:.667,d:.333,h:.74}];
  for(let k=0;k<sections.length;k++){
   const q=sections[k];
   // Full-width structure meets its neighbor without an interior side.
   if(v===2){ // Ribbed open steel stringers instead of a monolithic concrete block
    for(const x of [.13,.79])put(x,.02,q.z+.018,.085,q.h-.04,q.d-.036,carcass,false,true,{structural:true});
    put(.07,q.h-.07,q.z+.009,.86,.065,q.d-.018,tread,false,true,{structural:true});
   }else{
    put(0,0,q.z,1,q.h-.025,q.d,carcass,false,true,{structural:true});
    put(0,q.h-.035,q.z,.999,.035,q.d,tread,false,true,{structural:true});
   }
   put(.035,q.h-.015,q.z+.012,.93,.025,.063,
    v===0?concretes[2]:v===3?stones[2]:metals[3],false,true,{structural:true});
   // Tread anti-slip strips and exposed riser joints.
   if(v===1||v===4)for(const x of [.13,.26,.39,.52,.65,.78])
    put(x,q.h+.001,q.z+.065,.038,.008,q.d-.11,stones[2]);
   if(v===3)for(const x of [.16,.42,.68])put(x,q.h+.001,q.z+.055,.034,.009,q.d-.09,stones[2]);
   if(v===2){for(const x of [.18,.44,.70])put(x,q.h+.001,q.z+.035,.065,.012,q.d-.08,metals[0]);}
   for(const [side,x] of [['left',.035],['right',.91]]){
    // Rail posts start at each tread top; the same model owns every post.
    const z=q.z+.15,railY=.59+.31*z;
    const postTop=Math.min(.95,railY),postBottom=q.h-.012;
    if(postTop>postBottom)put(x,postBottom,z,.055,postTop-postBottom,.060,railMat,false,true,{railSide:side});
    if(k===0||k===2)put(x-.016,postTop-.02,z-.02,.09,.038,.10,metals[3],false,true,{railSide:side});
   }
  }
  for(const [side,x] of [['left',.036],['right',.908]]){
   // Inclined, non-stepped top rail; shape uses a sheared prism in Y/Z.
   put(x,.59,.055,.060,.052,.89,railMat,false,true,{railSide:side,slopeY:.31});
   put(x,.41,.08,.035,.035,.83,railMat,false,true,{railSide:side,slopeY:.31});
  }
  if(v===0||v===1){ // Smooth stone fascia beneath the treads
   for(const q of sections)put(.015,.018,q.z+.012,.021,q.h-.042,q.d-.024,carcass,false,true,{structural:true});
  }
  break;
 }
 case 'balcony':{
  put(0,.02,0,1,.12,1,[concretes[0],stones[0],metals[1],stones[4],tiles[1]][v]);
  if(v===2){for(const z of [.06,.86])put(.04,.02,z,.92,.06,.06,metals[0]);}
  rail(v===3?metals[3]:v===2?metals[0]:stones[2],v===3);
  if(v===1){put(.05,.02,.05,.11,.62,.85,concretes[2]);put(.84,.02,.05,.11,.62,.85,concretes[2]);}
  if(v===4){edge(.86,tiles[0]);lintel(tiles[0],.87);}
  if(v===0)put(.04,.12,.88,.92,.12,.09,stones[0]);
  break;
 }
 case 'ventilation':{
  // Ventilation units expose a dark recessed throat, a flanged housing,
  // projecting fan cage or directional louvers. Curved rotors are emitted as
  // decorative planar meshes from the same part registry (fanRotor variants).
  const casing=[metals[0],metals[1],metals[2],metals[4],metals[0]][v];
  const housing=(z,depth)=>{ // Rear bracket and four independent sides (open centre)
   for(const y of [.17,.80])put(.135,y,z,.73,.061,depth,casing);
   for(const x of [.135,.81])put(x,.17,z,.055,.70,depth,casing);
  };
  put(.105,.12,.68,.79,.78,.043,metals[0]); // dark interior throat
  housing(.40,.28);
  // Real housings expose mounting feet, drain lips and protective duct details.
  if(v===2){ // Outdoor condenser unit, recessed inlet and service hardware.
   put(.075,.10,.63,.85,.13,.22,metals[1]);
   for(const x of [.09,.84])put(x,.025,.69,.07,.11,.18,metals[0]);
   for(const y of [.25,.74])put(.09,y,.34,.82,.034,.035,metals[3]);
   put(.79,.36,.315,.07,.30,.06,metals[1]);
   for(const y of [.42,.54,.66])put(.79,y,.29,.07,.016,.04,metals[0]);
   put(.87,.18,.63,.046,.26,.12,metals[2]);
  }
  if(v===3){ // Vent duct has folded seams and bent mount brackets.
   for(const x of [.13,.82])put(x,.21,.33,.045,.66,.055,metals[3]);
   for(const y of [.26,.72])put(.10,y,.41,.80,.025,.055,metals[0]);
  }
  if(v===4){ // Industrial fan: guard stand-offs and paired mounting tabs.
   for(const x of [.08,.88])for(const y of [.18,.81])put(x,y,.37,.04,.08,.18,metals[1]);
  }
  for(const x of [.145,.827])for(const y of [.21,.83])
   put(x,y,.353,.030,.030,.045,metals[3]); // mount screws
  if(v===0||v===4){
   housing(.29,.12);
   // Radial grille approximated with thin circular-segment tangents.
   for(const [x,y,w,h] of [[.50,.19,.035,.62],[.195,.49,.61,.031],
    [.25,.27,.052,.47],[.69,.27,.05,.47]])
    put(x,y,.295,w,h,.031,v===4?metals[1]:metals[3]);
   put(.464,.464,.263,.076,.076,.080,metals[3]); // rotor hub
   if(v===4){ // Reinforced guard bars and external support ears
    for(const x of [.17,.30,.67,.81])put(x,.18,.247,.025,.65,.043,metals[0]);
    put(.11,.46,.31,.78,.05,.08,metals[1]);
    for(const x of [.07,.89])put(x,.22,.45,.042,.52,.18,metals[2]);
   }
  }else if(v===1){ // Gravity louvers angled in recessed slot
   for(let k=0;k<6;k++){
    const y=.235+k*.094;
    put(.18,y,.33,.64,.026,.13,metals[3]);
    put(.18,y+.020,.28,.64,.036,.04,casing);
   }
   put(.16,.22,.29,.038,.56,.07,metals[0]);
   put(.80,.22,.29,.038,.56,.07,metals[0]);
  }else if(v===2){ // Deep external boxed fan with weather hood and grate
   housing(.22,.2);
   put(.14,.76,.16,.72,.078,.48,metals[2]);
   for(let x=.22;x<=.76;x+=.105)put(x,.24,.17,.033,.52,.042,metals[0]);
   put(.10,.16,.24,.10,.11,.37,metals[1]);
   put(.8,.16,.24,.10,.11,.37,metals[1]);
  }else{ // Exposed industrial duct with bonnet and clamp bands
   for(const x of [.15,.27,.66,.79])put(x,.23,.20,.047,.54,.43,metals[1]);
   for(const y of [.26,.74])put(.18,y,.19,.63,.055,.46,metals[4]);
   put(.21,.79,.15,.58,.082,.54,metals[2]);
   for(const x of [.32,.60])put(x,.28,.14,.080,.40,.065,metals[3]);
  }
  break;
 }
 case 'sign':{
  // All signboards are non-emissive aged metal or painted timber; no neon and no light sources.
  const backing=[metals[0],metals[1],bricks[3],stones[2],floors[4]][v];
  const panel=[stones[4],tiles[0],bricks[1],concretes[2],floors[3]][v];
  if(v===1){ // Wall-mounted blade sign; same-facing modules stack vertically.
   put(.30,.02,.23,.40,.96,.34,backing);
   put(.345,.075,.175,.31,.85,.065,panel);
   put(.25,.01,.17,.50,.035,.43,metals[0],false,true,{railSide:'bottom'});
   put(.25,.955,.17,.50,.035,.43,metals[0],false,true,{railSide:'top'});
   for(const y of [.23,.48,.73]){
    put(.405,y,.15,.19,.058,.045,metals[0],false,false);
    put(.40,y+.06,.147,.051,.13,.048,metals[1],false,false);
   }
   for(const y of [.24,.76])put(.46,y,.58,.08,.065,.29,metals[1]);
  }else{
   // One nearly full-cell backing lets N adjacent cells become one long hoarding.
   put(0,.24,.53,1,.64,.13,backing);
   put(.022,.285,.465,.956,.54,.075,panel);
   put(0,.875,.475,1,.053,.17,metals[0]);
   put(0,.205,.475,1,.055,.17,metals[1]);
   put(.0,.215,.465,.048,.71,.18,metals[0],false,true,{railSide:'left'});
   put(.952,.215,.465,.048,.71,.18,metals[0],false,true,{railSide:'right'});
   // Faded relief lettering is deliberately unlit and segmented.
   for(const x of [.18,.45,.71]){
    put(x,.42,.410,.07,.25,.058,v===3?metals[1]:metals[0],false,false);
    put(x-.035,.42,.409,.145,.05,.059,metals[0],false,false);
    if(v===2)put(x-.025,.60,.407,.13,.035,.06,metals[1],false,false);
   }
   if(v===4){
    put(.035,.90,.32,.93,.055,.49,metals[1]); // Old projecting rain cap.
    for(const x of [.14,.83])put(x,.11,.48,.048,.20,.08,metals[0]);
   }
   if(v===3){
    put(.11,.31,.398,.78,.057,.055,metals[1],false,false);
    put(.11,.72,.398,.78,.028,.055,metals[1],false,false);
   }
  }
  break;
 }
case 'interior':{
  const mat=[floors[4],floors[4],metals[3],stones[0],metals[1]][v];
  if(v===0){ // Recessed storage cupboard, fitted drawers and handles.
   put(.11,0,.16,.78,.88,.66,mat);
   for(const x of [.12,.85])put(x,.03,.13,.035,.81,.05,dark);
   for(const [y,h] of [[.08,.21],[.36,.23],[.67,.15]]){
    put(.16,y,.105,.68,h,.035,floors[3]);
    put(.46,y+h*.5,.087,.09,.025,.035,metals[3],false,false);
   }
   put(.14,.87,.13,.72,.045,.73,metals[1]);
  }
  if(v===1){ // Taper-free chair and table with realistically open space.
   put(.08,.46,.09,.84,.07,.71,mat);
   put(.105,.43,.09,.79,.025,.69,floors[3]);
   for(const x of [.13,.78])for(const z of [.18,.69])put(x,.02,z,.07,.43,.08,metals[0]);
   put(.18,.30,.17,.64,.035,.05,metals[1]);
   put(.19,.30,.70,.61,.035,.05,metals[1]);
   put(.16,.52,.72,.69,.33,.073,floors[4]);
   for(const x of [.18,.79])put(x,.54,.71,.045,.28,.045,metals[0]);
  }
  if(v===2){ // Tube housing, separate reflector, retaining clips and lenses.
   put(.09,.79,.25,.82,.11,.50,dark);
   put(.12,.775,.275,.76,.025,.45,metals[3]);
   for(const z of [.36,.58]){
    put(.17,.72,z,.66,.055,.077,stones[4],false,false,{emissive:true});
    for(const x of [.14,.82])put(x,.716,z-.018,.04,.075,.114,metals[1],false,false);
   }
   for(const x of [.13,.82])put(x,.90,.36,.045,.042,.25,metals[1]);
  }
  if(v===3){ // Planter with foot, rim, soil and individual stems.
   put(.25,.02,.25,.50,.09,.50,stones[0]);
   put(.29,.11,.29,.42,.35,.42,stones[2]);
   put(.22,.42,.22,.56,.058,.56,stones[0]);
   put(.30,.464,.30,.40,.026,.40,floors[0],false,false);
   for(const [x,z,h] of [[.41,.43,.31],[.56,.56,.39],[.49,.35,.24]]){
    put(x,.48,z,.038,h,.038,metals[0],false,false);
    put(x-.055,.48+h*.63,z-.025,.14,.06,.10,tiles[2],false,false);
   }
  }
  if(v===4){ // Service cabinet with seams, ventilation and inset access panel.
   put(.16,.02,.14,.68,.91,.70,mat);
   put(.20,.64,.105,.60,.23,.047,metals[3]);
   for(const y of [.21,.45]){put(.21,y,.105,.58,.03,.05,dark);put(.68,y+.05,.094,.045,.08,.045,metals[3]);}
   for(const y of [.72,.77,.82])put(.28,y,.096,.41,.016,.026,metals[0],false,false);
   for(const x of [.19,.76])put(x,.03,.09,.048,.07,.07,metals[0]);
  }
  break;
 }
 case 'bookshelf':{
  const timber=floors[4];
  put(0,0,.20,1,1,.59,timber);
  if(v===4){put(0,.04,.08,1,.12,.84,timber);put(0,.72,.08,1,.19,.84,timber);break;}
  const covers=[bricks[1],metals[1],bricks[0],stones[2],bricks[3],floors[2]];
  for(const z of [.09,.80])for(const y of [0,.47,.94])put(0,y,z,1,.056,.10,timber);
  for(const x of [.01,.935])put(x,0,.08,.055,1,.85,timber);
  for(const z of [.135,.805])for(let row=0;row<2;row++){
   let x=.085,book=0;
   while(x<.89){
    const gap=v===3&&(book+row)%4===2;
    const width=.085+((book*7+row+v)%4)*.012;
    const height=.215+((book*3+row+v)%6)*.027;
    if(!gap&&x+width<.92){
     const color=covers[(book*5+row+v)%covers.length];
     put(x,.057+row*.47,z,width,height,.072,color,false,false);
     // Raised spine bands and narrow paper edges are actual geometry.
     if((book+v)%3===0)put(x+.009,.071+row*.47,z-.012,width-.018,.020,.014,stones[4],false,false);
    }
    x+=width+.019;book++;
   }
   // A small horizontal pile breaks the uniform wall of upright spines.
   if(row===0&&v!==3)for(let stack=0;stack<3;stack++)
    put(.40,.064+stack*.036,z-.02,.21,.027,.098,covers[(stack+v+2)%covers.length],false,false);
  }
  break;
 }
 default:throw Error('Unregistered part family '+p.family);
 }
 return a;
}
