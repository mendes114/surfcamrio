/**
 * Explorar streams do SkylineWebcams para câmeras do RJ.
 *
 * Rode: node scripts/explorar-skyline.mjs
 *
 * O SkylineWebcams tem 3 cameras no RJ:
 *   - Copacabana Beach (data-id 604)
 *   - Praia do Forte (data-id 4373)
 *   - Rico Joint (data-id 3280)
 *
 * Streams são carregados via JS. Este script tenta extrair
 * o padrão da URL de stream analisando o JS principal.
 */

const CAMERAS = [
  { label: 'Copacabana Beach', url: 'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana-beach.html' },
  { label: 'Praia do Forte', url: 'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/praia-do-forte.html' },
  { label: 'Rico Joint', url: 'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/rico-joint.html' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';

// 1. Buscar JS principal
console.log('=== Buscando JS principal do SkylineWebcams ===\n');
const r = await fetch(CAMERAS[0].url, {
  headers: { 'User-Agent': UA, Accept: 'text/html' },
  signal: AbortSignal.timeout(10000),
});
const html = await r.text();

const jsFiles = [...new Set(html.match(/src="(https:\/\/cdn\.[^"]+\.js[^"]*)"/g) || [])];
console.log('JS files encontrados:');
for (const f of jsFiles) console.log(`  ${f}`);

for (const jsTag of jsFiles) {
  const url = jsTag.match(/src="([^"]+)"/)?.[1];
  if (!url || !url.includes('sky')) continue;

  console.log(`\nAnalisando ${url}...`);
  const jr = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const js = await jr.text();
  console.log(`  ${js.length} chars`);

  // Buscar padrões de stream
  const idx = js.indexOf('.m3u8');
  if (idx > -1) {
    console.log('\nContexto ao redor de .m3u8:');
    console.log(js.substring(Math.max(0, idx - 300), idx + 100));
  }

  // Buscar URLs de stream
  for (const term of ['hd-auth', 'hd.skyline', 'livecam', 'stream.sky', 'live.sky']) {
    const i = js.indexOf(term);
    if (i > -1) {
      console.log(`\nContexto "${term}":`);
      console.log(js.substring(Math.max(0, i - 150), i + 200));
    }
  }
}

// 2. Extrair data-id de cada camera
console.log('\n\n=== Data IDs das cameras ===\n');
for (const cam of CAMERAS) {
  const cr = await fetch(cam.url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10000),
  });
  const ch = await cr.text();
  const dataId = ch.match(/data-id="(\d+)"/)?.[1];
  console.log(`${cam.label}: data-id=${dataId}`);

  // Buscar config inline
  const scripts = ch.match(/<script[^>]*>([^<]{20,2000})<\/script>/gs) || [];
  for (const s of scripts) {
    const content = s.replace(/<\/?script[^>]*>/g, '');
    if (content.includes('cam') || content.includes('live') || content.includes('hls')) {
      console.log(`  Script relevante: ${content.substring(0, 300)}`);
    }
  }
}

// 3. Tentar padrões comuns
console.log('\n\n=== Testando padrões de URL ===\n');
const ids = ['604', '4373', '3280'];
const patterns = [
  id => `https://hd-auth.skylinewebcams.com/live.m3u8?id=${id}`,
  id => `https://hd.skylinewebcams.com/live.m3u8?id=${id}`,
  id => `https://livecam.skylinewebcams.com/${id}.m3u8`,
  id => `https://hd-auth.skylinewebcams.com/${id}/live.m3u8`,
  id => `https://cdn.skylinewebcams.com/live/${id}/playlist.m3u8`,
  id => `https://hd-auth.skylinewebcams.com/live/${id}/playlist.m3u8`,
];

for (const id of ids) {
  for (const pattern of patterns) {
    const url = pattern(id);
    try {
      const tr = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://www.skylinewebcams.com/', Origin: 'https://www.skylinewebcams.com' },
        signal: AbortSignal.timeout(5000),
      });
      const txt = await tr.text();
      if (txt.includes('#EXTM3U')) {
        console.log(`🟢 LIVE (${id}): ${url}`);
      } else if (tr.status !== 404 && tr.status !== 403) {
        console.log(`⚪ ${tr.status} (${id}): ${url} => ${txt.substring(0, 80)}`);
      }
    } catch {}
  }
}

console.log('\nSe nenhum padrão funcionou, abra uma das câmeras no browser,');
console.log('abra DevTools > Network > filtre por m3u8, e copie a URL aqui.');
