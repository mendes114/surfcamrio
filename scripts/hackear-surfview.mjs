#!/usr/bin/env node
/**
 * Extrai streams HLS de TODAS as câmeras SurfView da área Macumba/Recreio.
 * Roda: node scripts/hackear-surfview.mjs
 */

const CAMERAS = [
  { name: 'Macumba',            camId: 67855,  ref: 'macumba' },
  { name: 'Macumba Secreto',    camId: 87728,  ref: 'macumbasecreto' },
  { name: 'Macumba 4W',         camId: 109576, ref: 'macumba4w' },
  { name: 'Macumba 5W',         camId: 87147,  ref: 'macumba5w' },
  { name: 'Macumba 6W',         camId: 87146,  ref: 'macumba6w' },
  { name: 'Macumba Farofa',     camId: 94293,  ref: 'macumbaforofa' },
  { name: 'Canto do Recreio',   camId: 83726,  ref: 'cantodorecreio' },
  { name: 'Canto do Recreio 2', camId: 94292,  ref: 'cantodorecreioll' },
  { name: 'Recreio P10',        camId: 77354,  ref: 'recreiop10' },
  { name: 'Recreio P11',        camId: 83727,  ref: 'recreiop11' },
  { name: 'Praia da Reserva',   camId: 75805,  ref: 'reserva' },
  { name: 'Prainha Canto Dir',  camId: 81928,  ref: 'prainhacantoesquerdo' },
  { name: 'Prainha Canto Esq',  camId: 68996,  ref: 'prainhaRj' },
];

const ACCOUNT = 'f7117c097';
const SERVERS = ['live-32', 'live-582', 'live-p2p-252', 'live-64', 'live-128', 'live-256'];
const TYPES = ['rtmp', 'a1', 'p2p'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';

async function testStream(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes('#EXTM3U') ? url : null;
  } catch {
    return null;
  }
}

async function extrairStreamsHomepage() {
  console.log('\n[1] Extraindo streams da homepage do SurfView...');
  const res = await fetch('https://surfview.com.br/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const map = new Map();
  for (const m of html.matchAll(/https?:\/\/live[^"']*monuv\.com\.br[^"']*\.m3u8[^"']*/g)) {
    const id = m[0].match(/(\d+)\.stream/)?.[1];
    if (id) map.set(Number(id), m[0]);
  }
  console.log(`   Encontradas ${map.size} streams no HTML público.`);
  for (const [id, url] of map) {
    const cam = CAMERAS.find(c => c.camId === id);
    console.log(`   cam=${id} ${cam ? '→ ' + cam.name : '(outra)'}: ${url.substring(0, 80)}...`);
  }
  return map;
}

async function tentarSemHash() {
  console.log('\n[2] Testando streams SEM m_hash (sem autenticação)...');
  const found = new Map();
  for (const cam of CAMERAS) {
    let ok = false;
    for (const type of TYPES) {
      for (const server of SERVERS) {
        const url = `https://${server}-${ACCOUNT}.monuv.com.br:443/${type}/${cam.camId}.stream/playlist.m3u8`;
        const result = await testStream(url);
        if (result) {
          console.log(`   ✓ ${cam.name} (${cam.camId}): ${url.substring(0, 90)}...`);
          found.set(cam.camId, result);
          ok = true;
          break;
        }
      }
      if (ok) break;
    }
    if (!ok) process.stdout.write(`   ✗ ${cam.name} `);
  }
  console.log(`\n   Total sem hash: ${found.size}/${CAMERAS.length}`);
  return found;
}

async function tentarSpotsAPI(cookieStr, csrf) {
  console.log('\n[3] Testando API /api/spots/info...');
  const refs = CAMERAS.map(c => c.ref).join(',');
  const res = await fetch('https://surfview.com.br/api/spots/info?refs=' + refs, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrf,
      Cookie: cookieStr,
      Referer: 'https://surfview.com.br/',
    },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`   Status: ${res.status}`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items || data.data || [];
  console.log(`   Spots retornados: ${items.length}`);
  for (const s of items) {
    const keys = Object.keys(s).join(', ');
    console.log(`   ${s.nome || s.name || s.ref}: ${keys}`);
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'string' && (v.includes('monuv') || v.includes('m3u8') || v.includes('live'))) {
        console.log(`   >>> ${k}: ${v}`);
      }
    }
  }
  return items;
}

async function tentarMonuvPlayer() {
  console.log('\n[4] Testando embeds monuv.com.br/api/camera/{id}/player...');
  for (const cam of CAMERAS.slice(0, 3)) {
    const url = `https://app.monuv.com.br/api/camera/${cam.camId}/player`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
        signal: AbortSignal.timeout(5000),
      });
      console.log(`   ${cam.name}: HTTP ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        const streams = [...html.matchAll(/https?:\/\/[^"']*\.m3u8[^"']*/g)];
        if (streams.length) {
          console.log(`   >>> STREAMS: ${streams.map(m => m[0]).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`   ${cam.name}: ${e.message}`);
    }
  }
}

async function tentarLiveUrl() {
  console.log('\n[5] Testando monuv /api/camera/{id}/live-url...');
  for (const cam of CAMERAS.slice(0, 3)) {
    const url = `https://app.monuv.com.br/api/camera/${cam.camId}/live-url`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      console.log(`   ${cam.name}: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`   >>> ${JSON.stringify(data).substring(0, 300)}`);
      }
    } catch (e) {
      console.log(`   ${cam.name}: ${e.message}`);
    }
  }
}

(async () => {
  console.log('=== HACKEAR SURFVIEW — Extrator de Streams ===\n');
  console.log(`Alvo: ${CAMERAS.length} câmeras da área Macumba/Recreio/Barra\n`);

  // Step 1: Homepage streams
  const homeStreams = await extrairStreamsHomepage();

  // Step 2: Try without hash
  const noHashStreams = await tentarSemHash();

  // Step 3: Get session and try spots API
  console.log('\n[3] Obtendo sessão do SurfView...');
  const homeRes = await fetch('https://surfview.com.br/', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  const homeHtml = await homeRes.text();
  const csrf = homeHtml.match(/csrf-token.*?content="([^"]+)"/)?.[1] || '';
  const cookies = homeRes.headers.getSetCookie?.() || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  console.log(`   CSRF: ${csrf.substring(0, 20)}... | Cookies: ${cookieStr.substring(0, 60)}...`);

  await tentarSpotsAPI(cookieStr, csrf);

  // Step 4: Monuv player
  await tentarMonuvPlayer();

  // Step 5: Monuv live-url
  await tentarLiveUrl();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO FINAL');
  console.log('='.repeat(60));

  const all = new Map([...homeStreams, ...noHashStreams]);
  let live = 0;
  for (const cam of CAMERAS) {
    const url = all.get(cam.camId);
    if (url) {
      live++;
      console.log(`✓ ${cam.name.padEnd(22)} STREAM: ${url.substring(0, 90)}`);
    } else {
      console.log(`  ${cam.name.padEnd(22)} thumb: https://thumbs-cameras.monuv.com.br/${cam.camId}/last/${cam.camId}.jpg`);
    }
  }
  console.log(`\nTotal: ${live} streams ao vivo / ${CAMERAS.length} câmeras`);

  // Save results
  const output = CAMERAS.map(cam => ({
    ...cam,
    streamUrl: all.get(cam.camId) || null,
    thumbnail: `https://thumbs-cameras.monuv.com.br/${cam.camId}/last/${cam.camId}.jpg`,
  }));
  const fs = await import('node:fs/promises');
  await fs.writeFile('surfview-streams.json', JSON.stringify(output, null, 2));
  console.log('\nSalvo em surfview-streams.json');
})();
