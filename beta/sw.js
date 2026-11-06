// Card Ledger Beta service worker.
// Chrome needs a service worker with a fetch handler before it offers to install the app.
// This one caches nothing: page loads go straight to the network, and everything else
// (Supabase, photos, scripts) isn't touched at all.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(
      () => new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#111318;color:#F4F2EC;font:16px system-ui;padding:24px">You\'re offline. Card Ledger needs a connection.</body>',
        { headers: { 'Content-Type': 'text/html' } })
    )
  );
});
