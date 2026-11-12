import {BLOCK as B,BLOCKS,HOTBAR,LIGHTBAR} from './blocks.js';
import {RECIPES} from './crafting.js';
// One canonical registry for user-visible categories and world definitions.
// Stable world names are storage keys: NEVER rename an existing entry.
export const WORLD_PRESETS=Object.freeze([
 {name:'Overworld',seed:17331,mode:'normal',label:'영원한 밤'},
 {name:'Flatlands',seed:9901,mode:'flat',label:'평지'},
 {name:'Islands',seed:45716,mode:'islands',label:'섬'},
 {name:'Highlands',seed:62031,mode:'highlands',label:'고지대 월드',legacy:true},
 {name:'Everwild',seed:82417,mode:'normal',label:'새로운 세계 · 통합 지형'},
 {name:'EternalNight',seed:52771,mode:'ruins',label:'폐허 · 이전 저장',legacy:true},
 {name:'EternalNightR2',seed:52771,mode:'ruins',label:'폐허 · 두 번째 저장',legacy:true},
 {name:'EternalNightR3',seed:52771,mode:'ruins',label:'영원한 밤 · 폐허'},
]);
const placeables=new Set([
 ...LIGHTBAR,B.FLUORESCENT,B.BROKEN_FLUORESCENT,B.SHOP_SIGN,B.WORKBENCH,B.CHAIR,B.FLOWER_POT,
 B.FLOWER,B.GLOW_MUSHROOM,B.REEDS,B.HEATHER,B.BLUE_FLOWER,B.FIREFLY_GRASS,
]);
const visible=BLOCKS.filter(({id})=>id!==B.AIR&&id!==B.BEDROCK&&id!==B.DOOR_TOP&&id!==B.PORTAL).map(({id})=>id);
export const isPlaceableItem=id=>placeables.has(id);
export const CREATIVE_ITEMS=Object.freeze(visible);
export const PALETTES=Object.freeze({
 blocks:{label:'건축재',items:visible.filter(id=>!isPlaceableItem(id))},
 items:{label:'배치품',items:visible.filter(isPlaceableItem)},
 craft:{label:'제작',items:RECIPES.map(r=>r.id)},
});
export const PALETTE_KEYS=Object.freeze(Object.keys(PALETTES));
export const paletteItems=palette=>PALETTES[palette]?.items||HOTBAR;
export const worldLabel=name=>WORLD_PRESETS.find(item=>item.name===name)?.label||name;
