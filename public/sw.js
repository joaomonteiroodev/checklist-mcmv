// Service Worker — Certus Share Target
const CACHE = 'certus-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Intercepta o compartilhamento recebido
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('files');

      // Converte cada arquivo para base64 e guarda no cache temporário
      const arquivos = await Promise.all(files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return {
          base64: btoa(binary),
          nome: file.name,
          tipo: file.type,
          data: Date.now(),
        };
      }));

      // Guarda no cache para o app ler
      const cache = await caches.open(CACHE);
      await cache.put('/share-pending', new Response(JSON.stringify(arquivos), {
        headers: { 'Content-Type': 'application/json' },
      }));

      // Redireciona para o app com flag de compartilhamento pendente
      return Response.redirect('/?shared=1', 303);
    })());
  }
});
