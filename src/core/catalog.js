import {BLOCK as B,BLOCKS,HOTBAR,LIGHTBAR,itemId} from './blocks.js';
import {RECIPES} from './crafting.js';
import {CITY_MODE,CITY_SEED} from '../worldgen/eternal-night-game.js';
import {PART_ID_START} from './part-library.js';
// One canonical registry for user-visible categories and world definitions.
// Stable world names are storage keys: NEVER rename an existing entry.
export const WORLD_PRESETS=Object.freeze([
 {name:'TextureGallery',seed:9999,mode:'materials',label:'텍스처 전시장'},
 {name:'PartsGallery',seed:9999,mode:'parts',label:'건축 부품 전시장'},
 {name:'EternalNightCityLab',seed:CITY_SEED,mode:CITY_MODE,label:'영원한 밤 · 도시 실험'},
 {name:'SubwayAssemblyPreview',seed:9999,mode:'station-preview',label:'폐역 · 전동차 조립 예시'},
]);
const placeables=new Set([
 ...LIGHTBAR,B.FLUORESCENT,B.ROUND_FLUORESCENT,B.BROKEN_FLUORESCENT,B.SHOP_SIGN,B.WORKBENCH,B.CHAIR,B.CRATE,B.FLOWER_POT,
 B.FLOWER,B.GLOW_MUSHROOM,B.REEDS,B.HEATHER,B.BLUE_FLOWER,B.FIREFLY_GRASS,
]);
const visible=BLOCKS.filter(({id})=>id!==B.AIR&&id!==B.BEDROCK&&id!==B.DOOR_TOP&&id!==B.PORTAL&&itemId(id)===id).map(({id})=>id);
export const isPlaceableItem=id=>placeables.has(id);
export const CREATIVE_ITEMS=Object.freeze(visible);
export const PALETTES=Object.freeze({
 blocks:{label:'건축재',items:visible.filter(id=>(id<PART_ID_START||B.STATION_TRACK_BALLAST<=id&&id<B.PART_STATION_TRAINWALL_1)&&!isPlaceableItem(id))},
 parts:{label:'건축 부품',items:visible.filter(id=>id>=PART_ID_START&&(id<B.STATION_TRACK_BALLAST||id>=B.PART_STATION_TRAINWALL_1))},
 items:{label:'배치품',items:visible.filter(isPlaceableItem)},
 craft:{label:'제작',items:RECIPES.map(r=>r.id)},
});
export const PALETTE_KEYS=Object.freeze(Object.keys(PALETTES));
export const paletteItems=palette=>PALETTES[palette]?.items||HOTBAR;
export const worldLabel=name=>WORLD_PRESETS.find(item=>item.name===name)?.label||name;
