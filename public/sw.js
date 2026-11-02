/* Generated at build time. Private APIs and auth are never cached here. */
const VERSION = "2.13.0";
const CACHE = `tripflow-shell-${VERSION}`;
const ASSETS = ["/_next/static/QkesP8kDZ5bC0p8w4f7aZ/_buildManifest.js","/_next/static/QkesP8kDZ5bC0p8w4f7aZ/_ssgManifest.js","/_next/static/chunks/205.ad3d12ef6af63bd0.js","/_next/static/chunks/210.98504cad7fddd0b8.js","/_next/static/chunks/221.eb32d33966c2bdff.js","/_next/static/chunks/236.7dd183028f17c8e7.js","/_next/static/chunks/247.2a460e1cd386f72a.js","/_next/static/chunks/3.3b08823713b1ba1b.js","/_next/static/chunks/418.23dcd715d6dcab19.js","/_next/static/chunks/44530001-9e645d832c7c3cc5.js","/_next/static/chunks/493-3111bc716c24e8fc.js","/_next/static/chunks/4bd1b696-92152b0f5947070d.js","/_next/static/chunks/548.72c7243ec668ade7.js","/_next/static/chunks/791.f0aafb77c7e09054.js","/_next/static/chunks/794-a3c6349e754e6fcd.js","/_next/static/chunks/948.f91d92b3f6c1a0a5.js","/_next/static/chunks/app/_global-error/page-02aac66120edff66.js","/_next/static/chunks/app/_not-found/page-062f5a03211168b4.js","/_next/static/chunks/app/api/admin/route-02aac66120edff66.js","/_next/static/chunks/app/api/bookings/route-02aac66120edff66.js","/_next/static/chunks/app/api/fund/route-02aac66120edff66.js","/_next/static/chunks/app/api/maps/resolve/route-02aac66120edff66.js","/_next/static/chunks/app/api/recovery/route-02aac66120edff66.js","/_next/static/chunks/app/api/release/route-02aac66120edff66.js","/_next/static/chunks/app/api/settlement/route-02aac66120edff66.js","/_next/static/chunks/app/api/templates/route-02aac66120edff66.js","/_next/static/chunks/app/api/tripflow/route-02aac66120edff66.js","/_next/static/chunks/app/api/version/route-02aac66120edff66.js","/_next/static/chunks/app/auth/callback/route-02aac66120edff66.js","/_next/static/chunks/app/auth/confirm/route-02aac66120edff66.js","/_next/static/chunks/app/layout-240e0247866d71bb.js","/_next/static/chunks/app/page-7cd9d6fbc64ad470.js","/_next/static/chunks/framework-0f597d6e68ffafed.js","/_next/static/chunks/main-3b98c594b659c3da.js","/_next/static/chunks/main-app-cff92da45a6b87e1.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-02aac66120edff66.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-02aac66120edff66.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-cf02f5c958b1c960.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-02aac66120edff66.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-02aac66120edff66.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-dbb146953018bb76.js","/_next/static/css/398381faabce2024.css","/_next/static/css/3ddd12a2b305160f.css","/_next/static/css/74cbdbbba8748c89.css"];
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
