import {BLOCK as B,BLOCKS,HOTBAR,LIGHTBAR,itemId} from './blocks.js';
import {RECIPES} from './crafting.js';
// One canonical registry for user-visible categories and world definitions.
// Stable world names are storage keys: NEVER rename an existing entry.
export const WORLD_PRESETS=Object.freeze([
 {name:'TextureGallery',seed:9999,mode:'materials',label:'텍스처 전시장'},
 {name:'BuildingShopHouse',seed:52771,mode:'building:shop-house',label:'부품 조합 · A'},
 {name:'BuildingOffice',seed:52771,mode:'building:office',label:'부품 조합 · B'},
 {name:'BuildingWalkup',seed:52771,mode:'building:walkup',label:'부품 조합 · C'},
 {name:'BuildingArcade',seed:52771,mode:'building:arcade',label:'부품 조합 · D'},
 {name:'BuildingService',seed:52771,mode:'building:service',label:'부품 조합 · E'},
]);
const placeables=new Set([
 ...LIGHTBAR,B.FLUORESCENT,B.BROKEN_FLUORESCENT,B.SHOP_SIGN,B.WORKBENCH,B.CHAIR,B.FLOWER_POT,
 B.FLOWER,B.GLOW_MUSHROOM,B.REEDS,B.HEATHER,B.BLUE_FLOWER,B.FIREFLY_GRASS,
]);
const visible=BLOCKS.filter(({id})=>id!==B.AIR&&id!==B.BEDROCK&&id!==B.DOOR_TOP&&id!==B.PORTAL&&itemId(id)===id).map(({id})=>id);
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
