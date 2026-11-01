/* Generated at build time. Private APIs and auth are never cached here. */
const VERSION = "2.8.0";
const CACHE = `tripflow-shell-${VERSION}`;
const ASSETS = [];
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", ...ASSETS];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if(event.data?.type === "GET_VERSION") event.ports[0]?.postMessage({version:VERSION});
});
self.addEventListener("activate", event => {
  // Keep the immediately previous shell for old tabs and their hashed lazy chunks.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith("tripflow-shell-") && k!==CACHE).slice(0,-1).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(new Request(req,{cache:"no-store"})).then(res=>{
      if(res.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put("/",res.clone())));
      return res;
    }).catch(async()=> (await (await caches.open(CACHE)).match("/")) || Response.error()));return;
  }
  if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/icon")||url.pathname==="/manifest.webmanifest"){
    event.respondWith(caches.match(req).then(async cached=>{
      if(cached)return cached;
      const res=await fetch(req);if(res.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,res.clone())));return res;
    }));
  }
});
