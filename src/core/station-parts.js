import {STATION_MATERIALS,STATION_PART_START} from './station-materials.js';
// Standalone one-voxel 3D assemblies. A full train is composed from these units.
export const STATION_PART_FAMILIES=Object.freeze([
 {key:'trainWall',label:'전동차 차체',variants:['골강판 측벽','철제 차창','슬라이딩 좌문','슬라이딩 우문','차량 지붕 이음']},
 {key:'trainInterior',label:'전동차 실내',variants:['청록 연결 좌석','스테인리스 손잡이 봉','삼각 현수 손잡이','수하물 선반','운전실 계기반']},
 {key:'track',label:'철도 선로',variants:['자갈 도상','레일 침목','주행 레일','주행 레일 이음','선로 배선 트레이']},
 {key:'platform',label:'역 승강장',variants:['승강장 단부','점자 유도 경계','노선 안내판','개찰구','환기 그릴']},
 {key:'stationLink',label:'도시 연결부',variants:['연결통로 난간','상부 배관','전선 덕트','방향 안내 표지','계단/경사 연결']},
 {key:'trainRunning',label:'전동차 하부·전면',variants:['차륜·대차','차체 하부 스커트','운전실 전면·통유리','차량 연결기','차간 주름막']},
]);
export const STATION_PARTS=Object.freeze(STATION_PART_FAMILIES.flatMap((family,section)=>
 family.variants.map((variantName,variant)=>Object.freeze({
 id:STATION_PART_START+section*5+variant,
 key:'PART_STATION_'+family.key.toUpperCase()+'_'+(variant+1),
 name:family.label+' · '+variantName,
 family:family.key,variant,section:14+section
 }))));
export const stationPartById=id=>id>=STATION_PART_START&&id<STATION_PART_START+STATION_PARTS.length
 ?STATION_PARTS[id-STATION_PART_START]:null;
const M=Object.fromEntries(STATION_MATERIALS.map(m=>[m.key.slice(8),m.id]));
// The same parts drive world mesh, collision, picking and item representations.
export function stationPartGeometry(id){
 const p=stationPartById(id);if(!p)return null;
 const a=[],add=(x,y,z,w,h,d,material,solid=false,alpha=false)=>{
  if(w<=0||h<=0||d<=0||x<0||y<0||z<0||x+w>1.000001||y+h>1.000001||z+d>1.000001)throw Error('Invalid station geometry '+p.key);
  a.push({x,y,z,w,h,d,material:typeof material==='number'?material:M[material],solid,alpha});
 };
 const dark='TRAIN_RUBBER',metal='TRAIN_DOOR_STEEL',skin='TRAIN_CORRUGATED',glass='TRAIN_SMOKED_GLASS',enamel='TRAIN_ENAMEL';
 switch(p.family){
 case 'trainWall':{
  if(p.variant===4){ // Structural roof rests on the top of the upper wall, not .79m above it.
   add(0,0,0,1,.19,1,enamel,true);
   for(const z of [.09,.47,.85])add(0,.19,z,1,.035,.065,skin);
   for(const x of [.10,.82])add(x,0,.13,.075,.08,.74,metal);
   break;
  }
  // 8 cm steel side sandwich. Door and window panels are never full cubes.
  for(const x of [.015,.952])add(x,0,.445,.033,1,.11,metal,true);
  add(.03,0,.465,.94,.11,.065,skin,true);
  add(.03,.92,.465,.94,.08,.065,skin,true);
  if(p.variant===0){
   add(.06,.13,.477,.88,.76,.045,enamel,true);
   add(.055,.25,.449,.89,.025,.04,metal);
   add(.055,.67,.449,.89,.018,.04,skin);
   add(.055,.76,.448,.89,.015,.045,metal);
  }else if(p.variant===1){
   add(.05,.12,.48,.90,.21,.055,enamel,true);
   add(.095,.37,.48,.81,.45,.018,glass,false,true);
   for(const y of [.345,.82])add(.075,y,.444,.85,.034,.084,metal);
   for(const x of [.078,.887])add(x,.35,.445,.036,.50,.082,metal);
   add(.09,.89,.445,.82,.025,.085,enamel);
   add(.12,.32,.444,.76,.020,.09,metal);
  }else{
   // Dedicated two-leaf sliding door: seam, track, recessed window and pull.
   const left=p.variant===2;
   add(.05,.12,.475,.90,.80,.055,metal,true);
   add(.13,.45,.445,.72,.33,.014,glass,false,true);
   for(const x of [.11,.86])add(x,.13,.434,.043,.76,.08,enamel);
   add(.12,.79,.434,.75,.036,.08,enamel);
   add(.12,.41,.434,.75,.032,.08,enamel);
   add(left?.86:.12,.22,.416,.035,.20,.044,dark);
   add(left?.82:.12,.29,.406,.045,.09,.04,enamel);
   add(.42,.08,.404,.16,.03,.10,metal);
  }
  break;
 }
 case 'trainInterior':{
  if(p.variant===0){ // Three separate vinyl cushions on a common steel support.
   for(const x of [.07,.82])add(x,.06,.23,.075,.31,.53,metal,true);
   add(.05,.34,.19,.90,.075,.60,metal,true);
   for(let j=0;j<3;j++){
    const x=.065+j*.295;
    add(x,.405,.20,.265,.105,.49,'TRAIN_SEAT',true);
    add(x,.515,.705,.265,.335,.11,'TRAIN_SEAT',true);
   }
   add(.07,.85,.69,.84,.04,.14,metal);
   add(.09,.43,.15,.82,.025,.07,metal);
  }else if(p.variant===1){
   add(.47,0,.47,.062,1,.062,metal,true);
   add(.38,.92,.45,.24,.035,.10,metal);
   for(const y of [.23,.73])add(.425,y,.42,.15,.035,.14,metal);
  }else if(p.variant===2){ // Roof-mounted suspended grips, thinner than the old frame.
   add(.06,.94,.43,.88,.043,.13,metal);
   for(const x of [.16,.47,.78]){
    add(x+.032,.76,.485,.025,.18,.045,metal);
    add(x,.70,.465,.090,.067,.08,'TRAIN_RUBBER');
    add(x,.58,.465,.025,.12,.08,'TRAIN_RUBBER');
    add(x+.065,.58,.465,.025,.12,.08,'TRAIN_RUBBER');
    add(x,.565,.465,.09,.031,.08,'TRAIN_RUBBER');
   }
  }else if(p.variant===3){
   for(const x of [.08,.88])add(x,.50,.80,.035,.39,.05,metal);
   for(const y of [.59,.77])add(.10,y,.76,.78,.035,.12,metal);
   for(const x of [.20,.38,.56,.74])add(x,.60,.75,.025,.18,.035,metal);
  }else{
   add(.11,.08,.13,.78,.58,.69,'TRAIN_ENAMEL',true);
   add(.16,.56,.10,.68,.33,.12,'TRAIN_RUBBER');
   for(const x of [.24,.45,.66])add(x,.63,.085,.11,.07,.04,'TRAIN_SMOKED_GLASS',false,true);
   add(.21,.15,.105,.52,.20,.055,metal);
   for(const x of [.31,.58])add(x,.23,.075,.08,.045,.08,'PLATFORM_ORANGE');
  }
  break;
 }
 case 'track':{
  if(p.variant===0){add(0,.00,0,1,.18,1,'TRACK_BALLAST',true);break}
  if(p.variant===1){
   add(.17,0,0,.66,.16,1,'TRACK_SLEEPER',true);
   break;
  }
  if(p.variant===2||p.variant===3){
   if(p.variant===2){
    add(.17,0,0,.66,.16,1,'TRACK_SLEEPER',true);
    for(const z of [.36,.58])add(.28,.16,z,.44,.035,.065,'TRACK_GREASE');
   }
   add(0,.16,.40,1,.027,.20,'TRACK_GREASE',true);
   add(0,.187,.469,1,.10,.062,'TRACK_GREASE',true);
   add(0,.287,.438,1,.045,.124,'TRACK_RAIL',true);
   break;
  }
  add(0,.02,.27,1,.13,.44,'STATION_CABLE',true);
  for(const y of [.12,.19])add(0,y,.27,1,.018,.44,'STATION_GRILLE');
  for(const x of [.07,.89])add(x,.15,.28,.035,.04,.42,'STATION_PIPE');
  break;
 }
 case 'platform':{
  if(p.variant===0){
   add(0,0,.49,1,.96,.51,'PLATFORM_STONE',true);
   add(0,.96,.49,1,.04,.51,'PLATFORM_STONE',true);
   add(0,.94,.477,1,.06,.037,'PLATFORM_ORANGE',true);
   add(0,.13,.47,1,.14,.025,'STATION_SOOT');
  }else if(p.variant===1){
   add(0,0,0,1,.24,1,'PLATFORM_STONE',true);
   add(0,.24,0,1,.045,1,'PLATFORM_TACTILE',true);
   for(const x of [.08,.28,.48,.68,.88])for(const z of [.14,.54])add(x,.285,z,.06,.018,.06,'PLATFORM_TACTILE');
  }else if(p.variant===2){
   for(const x of [.06,.88])add(x,0,.46,.06,.95,.08,metal,true);
   add(.06,.65,.47,.88,.25,.07,'STATION_SOOT');
   add(.18,.76,.437,.24,.045,.03,'PLATFORM_TACTILE');
   add(.54,.76,.437,.23,.045,.03,'STATION_CREAM');
   add(.78,.74,.43,.075,.08,.04,'PLATFORM_STONE');
  }else if(p.variant===3){
   add(.13,0,.13,.74,.73,.70,'STATION_GRILLE',true);
   add(.2,.68,.18,.60,.09,.57,'STATION_CREAM');
   add(.43,.76,.19,.14,.11,.10,'TRAIN_SMOKED_GLASS',false,true);
   add(.83,.17,.44,.14,.61,.13,metal);
  }else{
   add(.06,.09,.08,.88,.10,.84,'STATION_GRILLE');
   for(const y of [.23,.36,.49,.62])add(.07,y,.09,.86,.035,.82,'STATION_PIPE');
   for(const x of [.08,.86])add(x,.07,.08,.055,.67,.84,'STATION_CABLE');
  }break;
 }
 case 'trainRunning':{
  if(p.variant===0){ // Two stacked octagonal wheel silhouettes and a visible axle journal.
   // The wheel is modeled in the X/Y plane, centered close to the outer side of a carriage.
   const steel='TRACK_GREASE',tire='TRAIN_RUBBER',rim='TRACK_RAIL';
   add(.04,.50,.35,.92,.10,.30,steel,true);
   for(const center of [.26,.74]){
    for(const [height,width] of [[.13,.21],[.22,.37],[.34,.47],[.46,.47],[.58,.37],[.67,.21]]){
     add(center-width*.5,height,.46,width,.083,.14,tire,true);
    }
    add(center-.105,.38,.425,.21,.13,.21,steel);
    add(center-.053,.416,.407,.106,.057,.025,rim);
   }
   add(.09,.84,.39,.82,.075,.24,'TRAIN_DOOR_STEEL',true);
   for(const x of [.09,.84])add(x,.70,.38,.055,.15,.24,rim);
  }else if(p.variant===1){ // Carriage lower-body sill and orange/blue horizontal livery.
   add(0,.10,.44,1,.17,.105,'TRAIN_CORRUGATED',true);
   add(0,.29,.439,1,.083,.11,'PLATFORM_ORANGE');
   add(0,.41,.444,1,.045,.10,'STATION_BLUE');
   add(.025,.05,.441,.95,.035,.11,'TRAIN_RUBBER');
   for(const x of [.11,.88])add(x,.04,.415,.04,.32,.17,'TRAIN_DOOR_STEEL');
  }else if(p.variant===2){ // A front-facing cab has wide windscreen and real perimeter.
   for(const x of [.04,.89])add(x,.08,.44,.07,.88,.115,metal,true);
   add(.05,.04,.46,.91,.20,.073,enamel,true);
   add(.05,.87,.46,.91,.11,.073,enamel,true);
   add(.14,.33,.49,.72,.52,.026,glass,false,true);
   add(.17,.31,.438,.68,.040,.112,metal);
   for(const x of [.10,.86])add(x,.30,.44,.045,.55,.10,metal);
   add(.31,.89,.435,.38,.035,.10,'STATION_SOOT');
   for(const x of [.15,.78]){
    add(x,.12,.409,.095,.07,.105,'PLATFORM_TACTILE');
    add(x,.105,.407,.095,.032,.10,metal);
   }
  }else if(p.variant===3){ // Exposed knuckle coupler, two spring packs and hoses.
   add(.12,.43,.23,.76,.23,.53,'TRACK_GREASE',true);
   add(.27,.31,.34,.46,.13,.31,'TRAIN_DOOR_STEEL',true);
   add(.37,.56,.32,.26,.17,.34,'TRACK_RAIL',true);
   for(const x of [.16,.73]){
    add(x,.25,.28,.065,.29,.14,'TRAIN_RUBBER');
    add(x,.22,.27,.085,.065,.14,'TRACK_GREASE');
   }
  }else{ // Bellows between carriage sections; open middle, actual flexible rubber ribs.
   for(const x of [.035,.90])add(x,.05,.40,.065,.92,.19,dark,true);
   for(const y of [.04,.93])add(.06,y,.40,.88,.07,.19,dark,true);
   for(const x of [.16,.34,.52,.70,.86]){
    add(x,.10,.395,.027,.79,.20,'TRAIN_RUBBER');
    add(x,.905,.395,.034,.035,.20,metal);
   }
  }
  break;
 }
 case 'stationLink':{
  if(p.variant===0){
   add(0,0,.04,1,.12,.92,'PLATFORM_STONE',true);
   for(const x of [.045,.85])add(x,.12,.80,.085,.78,.10,metal,true);
   for(const y of [.47,.84])add(0,y,.81,1,.055,.075,'STATION_PIPE');
  }else if(p.variant===1){
   add(0,.83,.32,1,.13,.36,'STATION_PIPE');
   for(const x of [.07,.86])add(x,.67,.39,.06,.18,.23,metal);
   add(.04,.92,.35,.91,.03,.28,'STATION_CABLE');
  }else if(p.variant===2){
   add(.08,.65,.08,.84,.15,.22,'STATION_CABLE');
   add(.08,.81,.08,.84,.06,.22,'STATION_GRILLE');
   for(const x of [.14,.84])add(x,.62,.10,.035,.20,.18,metal);
  }else if(p.variant===3){
   for(const x of [.09,.87])add(x,.39,.42,.045,.48,.09,metal);
   add(.08,.52,.43,.85,.33,.065,'STATION_SOOT');
   add(.20,.62,.39,.29,.038,.04,'STATION_CREAM');
   add(.57,.62,.39,.25,.038,.04,'PLATFORM_TACTILE');
  }else{
   add(0,0,0,1,.25,.48,'PLATFORM_STONE',true);
   add(0,0,.49,1,.50,.51,'PLATFORM_STONE',true);
   for(const x of [.035,.91])add(x,.49,.48,.055,.22,.46,'STATION_PIPE');
  }break;
 }
 }
 return a;
}
