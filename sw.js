const CACHE='wochenkorb-v71-shell-1';
const SHELL=['./','./index.html','./cloud.js','./intelligence.js','./intelligence.css','./v7.css','./v7.js','./theme.css','./config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wochenkorb-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()
])));
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(fetch(req).then(res=>{
    if(res.ok && res.type==='basic')caches.open(CACHE).then(cache=>cache.put(req,res.clone())).catch(()=>{});
    return res;
  }).catch(async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    if(req.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
