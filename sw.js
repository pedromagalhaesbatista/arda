"use strict";

const root = new URL("./", self.location.href);
const cachePrefix = `arda:${root.pathname}:`;
const cacheName = `${cachePrefix}3`;
const files = [
  "index.html",
  "style.css",
  "opentibia/runtime.js",
  "opentibia/assets/sprites.js",
  "world.js",
  "shire.js",
  "art.js",
  "equipment.js",
  "saves.js",
  "game.js",
];
const assets = new Set(files.map(file => new URL(file, root).href));
const home = new URL("index.html", root).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map(url => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isHome = event.request.mode === "navigate" && url.origin === root.origin &&
    (url.pathname === root.pathname || url.pathname === new URL(home).pathname);
  const key = isHome ? home : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) ?? fetch(event.request);
  })());
});
