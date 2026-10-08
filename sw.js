const CACHE='soundwave-shell-v47';
const SHELL=['./','./index.html','./style.css?v=47','./app.js?v=47','./manifest.webmanifest'];
const SENSITIVE_KEYS=new Set(['code','error','error_description','maya','rrn','playlist_invite','subscription_invite','token','access_token','refresh_token']);
const isSensitive=(url)=>url.pathname.endsWith('/auth-callback.html')||[...url.searchParams.keys()].some(k=>SENSITIVE_KEYS.has(k));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  if(isSensitive(url)){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return res;
  }).catch(()=>caches.match(event.request)));
});
