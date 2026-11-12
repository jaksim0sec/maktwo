// Independently placeable architecture specimens. No full-building assembly.
// All 65 blocks own their shape, material and creative item; existing IDs stay fixed.
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
      "조명 간판",
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
 const put=(x,y,z,w,h,d,mat,alpha=false,solid=true)=>{
  if(w<=0||h<=0||d<=0)throw Error('Invalid architectural shape');
  a.push({x,y,z,w,h,d,material:mat,alpha,solid});
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
  const f=[dark,metals[1],metals[0],silver,metals[1]][v];
  for(const x of [.06,.87])put(x,.06,.43,.07,.88,.16,f);
  for(const y of [.06,.87])put(.06,y,.43,.88,.07,.16,f);
  const low=v===1?.43:.14,high=v===4?.53:.87;
  if(v===1){put(.06,.1,.43,.88,.34,.16,f);}
  if(v===4){put(.06,.54,.43,.88,.32,.16,f);}
  put(.13,low,.50,.74,high-low,.035,tiles[2],true);
  if(v===0){put(.49,.12,.42,.055,.76,.17,f);}
  if(v===2)for(const x of [.35,.65])mullion(x,f);
  if(v===3)put(.13,.62,.42,.74,.065,.17,f);
  if(v===4){put(.13,.51,.42,.74,.055,.17,f);put(.18,.71,.39,.65,.025,.12,f);}
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
  const mat=[concretes[0],stones[0],metals[2],floors[4],stones[4]][v];
  put(.03,0,.03,.94,.16,.94,mat);
  put(.03,.16,.48,.94,.27,.49,mat);
  put(.03,.43,.75,.94,.25,.22,mat);
  for(const x of [.06,.88]){put(x,.12,.10,.07,.60,.09,metals[0]);put(x,.12,.80,.07,.70,.09,metals[0]);}
  put(.06,.71,.13,.07,.05,.72,metals[0]);put(.88,.71,.13,.07,.05,.72,metals[0]);
  if(v===1){put(.03,.68,.78,.94,.055,.19,stones[2]);}
  if(v===2)for(const z of [.30,.62])put(.10,.03,z,.79,.08,.06,metals[1]);
  if(v===3)put(.04,.41,.48,.92,.045,.49,stones[2]);
  if(v===4)put(.03,.13,.07,.94,.06,.10,stones[2]);
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
  const mat=[metals[0],metals[1],metals[2],metals[4],metals[0]][v];
  // Wall plate, duct barrel, rotor and grilles are independent physical parts.
  put(.08,.12,.46,.84,.76,.10,mat);
  if(v===0||v===4){
   put(.25,.24,.40,.50,.50,.10,metals[1]);
   put(.44,.43,.30,.12,.12,.15,stones[2]);
   for(const [dx,dy,w,h] of [[.20,.47,.26,.055],[.54,.47,.26,.055],[.47,.20,.055,.26],[.47,.54,.055,.26]])
    put(dx,dy,.32,w,h,.07,metals[3]);
   if(v===4)for(const x of [.12,.28,.67,.84])put(x,.12,.29,.035,.75,.05,metals[0]);
  }else if(v===1){for(let y=.19;y<.79;y+=.115)put(.14,y,.37,.72,.048,.10,dark);}
  else if(v===2){put(.19,.23,.24,.62,.52,.21,metals[1]);for(const x of [.25,.40,.55,.70])put(x,.30,.20,.035,.40,.05,dark);}
  else{put(.2,.28,.18,.60,.44,.32,metals[1]);put(.15,.62,.18,.70,.12,.38,metals[4]);for(const x of [.28,.60])put(x,.34,.15,.09,.25,.09,metals[0]);}
  break;
 }
 case 'sign':{
  const backing=[metals[0],metals[1],metals[0],metals[3],floors[4]][v];
  // Common subassemblies: fixings, box frame, interchangeable face, relief glyph.
  put(.08,.17,.61,.84,.10,.16,metals[0]);
  put(.12,.24,.62,.11,.58,.08,metals[0]);
  put(.77,.24,.62,.11,.58,.08,metals[0]);
  if(v===1){put(.34,.28,.30,.32,.63,.12,metals[1]);put(.39,.35,.22,.22,.48,.07,stones[4]);}
  else{
   put(.18,.33,.48,.64,.48,.11,backing);
   put(.24,.39,.40,.52,.32,.09,[tiles[2],stones[4],bricks[3],tiles[1],floors[3]][v]);
   // Three-dimensional characters: simple geometric strokes, not random stripes.
   for(const x of [.31,.50,.68]){put(x,.46,.34,.065,.18,.055,v===3?stones[4]:dark);put(x-.03,.45,.34,.12,.043,.055,v===3?stones[4]:dark);}
  }
  if(v===2){put(.13,.79,.45,.74,.065,.08,metals[1]);}
  if(v===3){for(const x of [.2,.8])put(x,.22,.40,.055,.62,.06,metals[0]);put(.2,.82,.40,.66,.065,.1,stones[4]);}
  if(v===4){put(.08,.82,.22,.84,.10,.56,metals[4]);put(.09,.76,.13,.82,.05,.10,metals[0]);}
  break;
 }
 case 'interior':{
  const mat=[floors[4],floors[4],metals[3],stones[0],metals[1]][v];
  if(v===0){put(.13,0,.18,.74,.84,.65,mat);for(const y of [.24,.49])put(.17,y,.13,.66,.045,.08,dark);}
  if(v===1){put(.09,.41,.11,.82,.10,.65,mat);for(const x of [.16,.76])for(const z of [.2,.64])put(x,0,z,.08,.43,.09,mat);put(.17,.46,.68,.65,.31,.10,mat);}
  if(v===2){put(.10,.77,.27,.8,.10,.46,dark);for(const z of [.35,.56])put(.19,.73,z,.63,.06,.08,stones[4]);}
  if(v===3){put(.25,.02,.25,.50,.42,.50,stones[2]);put(.45,.36,.46,.10,.39,.10,metals[0]);for(const x of [.24,.65])put(x,.55,.40,.12,.21,.12,tiles[2]);}
  if(v===4){put(.19,.03,.17,.62,.86,.66,mat);put(.22,.61,.12,.56,.17,.065,metals[3]);for(const y of [.18,.43])put(.26,y,.10,.48,.035,.05,dark);}
  break;
 }
 default:throw Error('Unregistered part family '+p.family);
 }
 return a;
}
