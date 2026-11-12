import {BLOCK as B,HOTBAR,LIGHTBAR} from './blocks.js';
import {RECIPES} from './inventory.js';
// One canonical registry for user-visible categories and world definitions.
// Stable world names are storage keys: NEVER rename an existing entry.
export const WORLD_PRESETS=Object.freeze([
 {name:'Overworld',seed:17331,mode:'normal',version:3,label:'영원한 밤'},
 {name:'Flatlands',seed:9901,mode:'flat',label:'평지'},
 {name:'Islands',seed:45716,mode:'islands',label:'섬'},
 {name:'Highlands',seed:62031,mode:'highlands',label:'이전 협곡 월드',legacy:true},
 {name:'Everwild',seed:82417,mode:'normal',version:3,label:'새로운 세계 · 통합 지형'},
 {name:'EternalNight',seed:52771,mode:'ruins',version:3,label:'영원한 밤 · 폐허'},
]);
export const PALETTES=Object.freeze({
 blocks:{label:'건축',items:[B.GRASS,B.DIRT,B.STONE,B.COBBLE,B.SAND,B.WOOD,B.PLANKS,B.GLASS,B.DOOR,B.WORKBENCH,B.STONE_STAIRS,B.WOOD_STAIRS,B.STONE_SLAB,B.WOOD_SLAB,B.HIGHLAND_GRASS,B.ALPINE_SOIL,B.SNOW,B.ICE,B.SHALE,B.GRANITE,B.SLATE,B.BASALT,B.MOSS,B.CLAY,B.PEAT,B.RED_SAND,B.TERRACOTTA,B.LIMESTONE,B.MARBLE,B.CEDAR_WOOD,B.BIRCH_WOOD,B.QUARTZ,B.CONCRETE,B.CRACKED_CONCRETE,B.STAINED_PLASTER,B.FLOOR_TILE,B.CEILING_TILE,B.METAL_PANEL,B.RUSTED_METAL,B.DIRTY_GLASS,B.SHOP_SHUTTER,B.SHOP_SIGN,B.SHOP_BRICK,B.EXPOSED_REBAR,B.MOLD_PLASTER,B.CORRUGATED_METAL,B.RUBBLE,B.SHOP_AWNING,B.CONCRETE_BEAM,B.WET_TILE,B.WALL_TILE,B.WARNING_STRIPE,B.CONCRETE_SLAB,B.CONCRETE_STAIRS,B.THIN_WALL_NS,B.THIN_WALL_EW,B.WINDOW_NS,B.WINDOW_EW]},
 lights:{label:'조명',items:[...LIGHTBAR,B.FLUORESCENT,B.BROKEN_FLUORESCENT]},
 garden:{label:'정원',items:[B.PATH,B.FENCE,B.GLOW_MUSHROOM,B.FLOWER,B.LEAVES,B.CHAIR,B.FLOWER_POT,B.CEDAR_LEAVES,B.BIRCH_LEAVES,B.REEDS,B.HEATHER,B.BLUE_FLOWER,B.GLOW_MOSS,B.FIREFLY_GRASS]},
 craft:{label:'제작',items:RECIPES.map(r=>r.id)},
});
export const PALETTE_KEYS=Object.freeze(Object.keys(PALETTES));
export const paletteItems=palette=>PALETTES[palette]?.items||HOTBAR;
export const worldLabel=name=>WORLD_PRESETS.find(item=>item.name===name)?.label||name;
