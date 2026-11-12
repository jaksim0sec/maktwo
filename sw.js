/* App-shell cache for offline play. This intentionally never caches remote resources. */
const CACHE_NAME='maktwo-shell-v1.7.0';
const APP_FILES=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './icons/maktwo-192.png','./icons/maktwo-512.png',
 './src/client/game.js','./src/client/input.js','./src/client/gestures.js','./src/client/item-icons.js',
 './src/client/pwa.js','./src/client/picking.js','./src/client/textures.js','./src/client/camera.js','./src/client/hologram.js',
 './src/client/renderer.js','./src/client/mesher.js','./src/client/mesh.worker.js',
 './src/client/light.worker.js','./src/core/blocks.js','./src/core/chunk.js',
 './src/core/effects.js','./src/core/events.js','./src/core/lighting.js',
 './src/core/lightVolume.js','./src/core/mining.js','./src/core/inventory.js','./src/core/physics.js',
 './src/core/scale.js','./src/core/door.js','./src/core/systems.js','./src/core/world.js',
 './src/entities/entities.js','./src/util/math.js','./src/core/catalog.js','./src/core/shapes.js',
 './src/worldgen/generators.js','./src/worldgen/landforms.js'
];
// Install a complete and versioned app snapshot. NEVER mutate it at runtime.
// A slow connection cannot partially overwrite code in a previously working build.
const CANONICAL_ASSETS=new Set(APP_FILES.map(p=>new URL(p,self.registration.scope).pathname));
const ENTRY=new URL('./index.html',self.registration.scope).href;
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
  const cache=await caches.open(CACHE_NAME);
  const response=await cache.match(url);
  if(response)return response;
  // The worker only becomes active after every listed asset was cached.
  // Unexpected navigation can still fall through safely when online.
  try{return await fetch(request)}catch{return request.mode==='navigate'?(await cache.match(ENTRY)||Response.error()):Response.error()}
 })());
});
