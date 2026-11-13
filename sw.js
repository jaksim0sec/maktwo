/* App-shell cache for offline play. This intentionally never caches remote resources. */
const CACHE_NAME='maktwo-shell-v1.15.1-core-tower';
const SNAPSHOT_PREFIX='maktwo-shell-snapshot-';
const APP_FILES=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './icons/maktwo-192.png','./icons/maktwo-512.png',
 './src/client/game.js','./src/client/input.js','./src/client/gestures.js','./src/client/item-icons.js',
 './src/client/pwa.js','./src/client/picking.js','./src/client/textures.js','./src/client/architecture-texture-sampler.js','./src/client/camera.js','./src/client/atmosphere.js','./src/client/hologram.js',
 './src/client/city-distance.js','./src/client/renderer.js','./src/client/mesher.js','./src/client/mesh.worker.js',
 './src/client/light.worker.js','./src/core/blocks.js','./src/core/chunk.js',
 './src/core/effects.js','./src/core/events.js','./src/core/lighting.js',
 './src/core/lightVolume.js','./src/core/mining.js','./src/core/inventory.js','./src/core/crafting.js','./src/core/physics.js',
 './src/core/scale.js','./src/core/part-library.js','./src/core/part-prisms.js','./src/core/architectural-materials.js','./src/core/construction.js','./src/core/mounts.js','./src/core/door.js','./src/core/systems.js','./src/core/world.js',
 './src/entities/entities.js','./src/util/math.js','./src/core/catalog.js','./src/core/shapes.js',
 './src/worldgen/generators.js','./src/worldgen/part-gallery.js','./src/worldgen/material-gallery.js','./src/worldgen/integrated.js','./src/worldgen/architecture-v3.js',
 './src/worldgen/eternal-night-game.js','./src/worldgen/eternal-night-core-floor.js','./src/worldgen/eternal-night-districts.js',
 './src/worldgen/eternal-night-buildings.js','./src/worldgen/eternal-night-walkways.js','./src/worldgen/eternal-night-kits.js',
 './src/worldgen/eternal-night-precincts.js','./src/worldgen/eternal-night-facade.js','./src/worldgen/eternal-night-interiors.js','./src/worldgen/eternal-night-stairs.js','./src/worldgen/eternal-night-tower.js'
];
// Install a complete and versioned app snapshot. NEVER mutate it at runtime.
// A slow connection cannot partially overwrite code in a previously working build.
const CANONICAL_ASSETS=new Set(APP_FILES.map(p=>new URL(p,self.registration.scope).pathname));
const ENTRY=new URL('./index.html',self.registration.scope).href;
let refreshing=null;
const currentCache=async()=>{
 const snapshots=(await caches.keys()).filter(name=>name.startsWith(SNAPSHOT_PREFIX)).sort();
 return caches.open(snapshots.at(-1)||CACHE_NAME);
};
// Replace the offline build only after every file in the new build is ready.
function refreshSnapshot(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const name=SNAPSHOT_PREFIX+Date.now();
  try{
   const cache=await caches.open(name);
   await cache.addAll(APP_FILES.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})));
   const keys=await caches.keys();
   await Promise.all(keys.filter(key=>key.startsWith('maktwo-shell-')&&key!==name).map(key=>caches.delete(key)));
  }catch(error){await caches.delete(name);throw error}
 })().finally(()=>{refreshing=null});
 return refreshing;
}
const canonicalURL=request=>{
 const url=new URL(request.url);
 // Cache only this app's explicit files, not every GET request to the origin.
 if(!CANONICAL_ASSETS.has(url.pathname))return null;
 url.search='';url.hash='';return url.href;
};
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  // Bypass HTTP caches. A single failure rejects the new worker, keeping the
  // previous (complete) offline build intact.
  await cache.addAll(APP_FILES.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(name=>name.startsWith('maktwo-shell-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const url=canonicalURL(request);
 if(!url)return;
 event.respondWith((async()=>{
  const cache=await currentCache();
  const cached=await cache.match(url);
  try{
   // Always request current code online, even when the worker itself has not changed.
   const fresh=await fetch(new Request(request,{cache:'no-cache'}));
   if(!fresh.ok)throw new Error(`HTTP ${fresh.status}`);
   if(cached&&(request.mode==='navigate'||/\.(?:html|css|js)$/.test(new URL(url).pathname))){
    const [oldText,newText]=await Promise.all([cached.clone().text(),fresh.clone().text()]);
    if(oldText!==newText)event.waitUntil(refreshSnapshot().catch(error=>console.warn('[MakTwo] Offline snapshot refresh failed:',error)));
   }
   return fresh;
  }catch{return cached||(request.mode==='navigate'?await cache.match(ENTRY):null)||Response.error()}
 })());
});
