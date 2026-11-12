// Register after game initialization; never block gameplay on SW setup errors.
export function registerPWA(){
 if(!('serviceWorker' in navigator))return;
 const url=new URL('../../sw.js',import.meta.url);
 // An old controlling worker can otherwise serve v1.0 JS alongside newer HTML.
 // Reload exactly once when an existing controller is replaced by the new worker.
 const wasControlled=Boolean(navigator.serviceWorker.controller);let reloaded=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(wasControlled&&!reloaded&&!window.__maktwoReloading){reloaded=true;window.__maktwoReloading=true;window.location.reload()}
 });
 navigator.serviceWorker.register(url.href,{scope:new URL('../../',import.meta.url).pathname,updateViaCache:'none'})
  .then(registration=>registration.update().catch(error=>console.warn('[MakTwo] SW update check failed:',error)))
  .catch(error=>console.warn('[MakTwo] Offline service worker unavailable:',error));
}
