import {BLOCK as B,HOTBAR,LIGHTBAR} from './blocks.js';
// One canonical registry for user-visible categories and world definitions.
// Stable world names are storage keys: NEVER rename an existing entry.
export const WORLD_PRESETS=Object.freeze([
 {name:'Overworld',seed:17331,mode:'normal',label:'영원한 밤'},
 {name:'Flatlands',seed:9901,mode:'flat',label:'평지'},
 {name:'Islands',seed:45716,mode:'islands',label:'섬'},
 {name:'Highlands',seed:62031,mode:'highlands',label:'협곡 고원 · 실험'},
]);
export const PALETTES=Object.freeze({
 blocks:{label:'건축',items:HOTBAR},
 lights:{label:'조명',items:LIGHTBAR},
 garden:{label:'정원',items:[B.PATH,B.FENCE,B.GLOW_MUSHROOM,B.FLOWER,B.LEAVES]},
});
export const PALETTE_KEYS=Object.freeze(Object.keys(PALETTES));
export const paletteItems=palette=>PALETTES[palette]?.items||HOTBAR;
export const worldLabel=name=>WORLD_PRESETS.find(item=>item.name===name)?.label||name;
