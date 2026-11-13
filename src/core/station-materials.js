// Append-only station material palette. Existing world/block ids 0..187 are immutable.
export const STATION_MATERIAL_START=188;
const DATA=[
 ['TRACK_BALLAST','선로 자갈','Track ballast','#5e6160','ballast'],
 ['TRACK_SLEEPER','기름 먹은 침목','Oiled track sleeper','#756452','sleeper'],
 ['TRACK_RAIL','마모된 레일 강철','Polished rail steel','#b5b9b8','rail'],
 ['TRACK_GREASE','기름 묻은 철재','Rail grease metal','#555b5c','grease'],
 ['PLATFORM_STONE','승강장 회색 석판','Platform stone','#969b97','platform'],
 ['PLATFORM_TACTILE','점형 노란 유도블록','Tactile warning pavers','#c8a84c','tactile'],
 ['PLATFORM_ORANGE','낡은 주황 안전선','Orange safety line','#aa7449','safety'],
 ['STATION_CREAM','역사 크림 세라믹','Cream ceramic wall','#b4b0a3','ceramic'],
 ['STATION_BLUE','균열 청색 유약타일','Crazed blue tile','#789195','blue'],
 ['STATION_ALGAE','이끼 스민 콘크리트','Algae-worn concrete','#768579','algae'],
 ['TRAIN_CORRUGATED','전동차 골강판 외벽','Subway ribbed steel','#a1a8a9','ribbed'],
 ['TRAIN_ENAMEL','도장된 전동차 차체','Subway painted shell','#c8c9bc','enamel'],
 ['TRAIN_DOOR_STEEL','전동차 슬라이드 도어','Sliding door steel','#aab0aa','door'],
 ['TRAIN_SMOKED_GLASS','전동차 차창 유리','Smoked transit glass','#61777c','glass'],
 ['TRAIN_SEAT','전동차 청록 좌석','Turquoise seat vinyl','#587d7c','seat'],
 ['TRAIN_RUBBER','차량 고무 바닥재','Dark rubber flooring','#575a5a','rubber'],
 ['STATION_CABLE','피복 배선 덕트','Cable conduit','#666e70','cable'],
 ['STATION_GRILLE','먼지 낀 환기 그릴','Dusty ventilation grate','#747e7e','grille'],
 ['STATION_PIPE','산화된 배관','Oxidized pipe steel','#6c7976','pipe'],
 ['STATION_SOOT','매연 얼룩 타일','Soot-stained station tile','#747a77','soot']
];
export const STATION_MATERIALS=Object.freeze(DATA.map(([key,label,name,color,pattern],index)=>Object.freeze({
 id:STATION_MATERIAL_START+index,key:'STATION_'+key,label,name,color,pattern
})));
export const STATION_PART_START=STATION_MATERIAL_START+STATION_MATERIALS.length;
