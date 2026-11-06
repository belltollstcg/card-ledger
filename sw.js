// Card Ledger service worker (root scope).
// Chrome needs a service worker with a fetch handler before it offers to install the app.
// It caches nothing: page loads go straight to the network (with a small offline page as
// a fallback), and every other request (Supabase, edge functions, photos, scripts, fonts)
// is not touched at all, so it can never serve stale data.
// Bump VERSION whenever the app changes so phones pick up the new worker straight away.
const VERSION = '2026-11-06.3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // Remove any caches an older version might have created.
  for (const key of await caches.keys()) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only this site's own page loads. Supabase (database, auth, storage, edge functions)
  // and everything else go to the network untouched.
  if (e.request.mode !== 'navigate' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).catch(
      () => new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#111318;color:#F4F2EC;font:16px system-ui;padding:24px">You\'re offline. Card Ledger needs a connection.</body>',
        { headers: { 'Content-Type': 'text/html' } })
    )
  );
});
