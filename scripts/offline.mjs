import { readdir, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(dir, prefix = '') {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'sw.js') continue;
    const name = prefix + e.name;
    if (e.isDirectory()) result.push(...(await files(dir + '/' + e.name, name + '/')));
    else result.push('./' + name);
  }
  return result;
}
await mkdir('dist/docs', { recursive: true });
await cp('docs', 'dist/docs', { recursive: true });
const assets = await files('dist');
const digest = createHash('sha256');
for (const name of assets.sort()) digest.update(await readFile('dist/' + name.slice(2)));
const version = 'ankara-' + digest.digest('hex').slice(0, 12);
await writeFile(
  'dist/sw.js',
  `const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ankara-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(error=>{if(event.request.mode==='navigate')return caches.match(new URL('./index.html',self.registration.scope));throw error})));});`,
);
console.log('Offline cache:', version, assets.length, 'assets');
