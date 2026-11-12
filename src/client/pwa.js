// Register after game initialization; never block gameplay on SW setup errors.
export function registerPWA(){
 if(!('serviceWorker' in navigator))return;
 const url=new URL('../../sw.js',import.meta.url);
 navigator.serviceWorker.register(url.href,{scope:new URL('../../',import.meta.url).pathname,updateViaCache:'none'})
  .catch(error=>console.warn('[MakTwo] Offline service worker unavailable:',error));
}
