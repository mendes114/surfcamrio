#!/usr/bin/env node
/**
 * Testa TODAS as abordagens para obter streams das câmeras SurfView.
 * Roda manualmente: node scripts/testar-streams.mjs
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
  { name: 'Prainha Dir',        camId: 81928,  ref: 'prainhacantoesquerdo' },
  { name: 'Prainha Esq',        camId: 68996,  ref: 'prainhaRj' },
];

const ACCOUNT = 'f7117c097';
const COMBOS = [
  { server: 'live-32',      type: 'rtmp' },
  { server: 'live-582',     type: 'a1' },
  { server: 'live-p2p-252', type: 'p2p' },
  { server: 'live-64',      type: 'rtmp' },
  { server: 'live-128',     type: 'a1' },
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

async function testUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const txt = await r.text();
    return txt.includes('#EXTM3U') ? url : null;
  } catch { return null; }
}

(async () => {
  console.log('=== TESTE DE STREAMS SURFVIEW ===\n');

  // 1) Homepage streams
  console.log('[1] Extraindo streams da homepage...');
  const homeRes = await fetch('https://surfview.com.br/', { headers: { 'User-Agent': UA } });
  const html = await homeRes.text();
  const homeStreams = new Map();
  for (const m of html.matchAll(/https?:\/\/live[^"'\s]*monuv\.com\.br[^"'\s]*\.m3u8[^"'\s]*/g)) {
    const id = m[0].match(/(\d+)\.stream/)?.[1];
    if (id) homeStreams.set(Number(id), m[0]);
  }
  console.log(`   ${homeStreams.size} streams na homepage\n`);

  // 2) spots/info API — pegar tokens "descricao"
  console.log('[2] Obtendo tokens da API spots/info...');
  const csrf = (html.match(/csrf-token.*?content="([^"]+)"/) || [])[1];
  const cookies = (homeRes.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  const refs = CAMERAS.map(c => c.ref).join(',');

  let spots = [];
  try {
    const infoRes = await fetch('https://surfview.com.br/api/spots/info?refs=' + refs, {
      headers: {
        'User-Agent': UA, Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf,
        Cookie: cookies, Referer: 'https://surfview.com.br/',
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await infoRes.json();
    spots = data.spots || [];
    console.log(`   ${spots.length} spots retornados`);
    for (const s of spots) {
      console.log(`   ${(s.nome || s.referencia).padEnd(24)} token: ${s.descricao?.substring(0, 30)}...`);
    }
  } catch (e) {
    console.log(`   Erro: ${e.message}`);
  }

  // 3) Testar tokens como m_hash em todas as combinações
  console.log('\n[3] Testando tokens como m_hash em monuv...');
  const found = new Map([...homeStreams]);

  for (const cam of CAMERAS) {
    if (found.has(cam.camId)) continue;
    const spot = spots.find(s => s.referencia === cam.ref);
    if (!spot?.descricao) { console.log(`   ${cam.name.padEnd(24)} sem token`); continue; }

    process.stdout.write(`   ${cam.name.padEnd(24)} testando...`);
    let ok = false;
    for (const combo of COMBOS) {
      const url = `https://${combo.server}-${ACCOUNT}.monuv.com.br:443/${combo.type}/${cam.camId}.stream/playlist.m3u8?m_hash=${spot.descricao}`;
      const result = await testUrl(url);
      if (result) {
        found.set(cam.camId, result);
        console.log(` ✓ ${combo.server}/${combo.type}`);
        ok = true;
        break;
      }
    }
    if (!ok) console.log(' ✗');
  }

  // 4) Testar sem hash (brute force)
  console.log('\n[4] Testando SEM m_hash (acesso público)...');
  for (const cam of CAMERAS) {
    if (found.has(cam.camId)) continue;
    process.stdout.write(`   ${cam.name.padEnd(24)} `);
    let ok = false;
    for (const combo of COMBOS.slice(0, 3)) {
      const url = `https://${combo.server}-${ACCOUNT}.monuv.com.br:443/${combo.type}/${cam.camId}.stream/playlist.m3u8`;
      const result = await testUrl(url);
      if (result) {
        found.set(cam.camId, result);
        process.stdout.write(`✓ sem hash! ${combo.server}/${combo.type}\n`);
        ok = true;
        break;
      }
    }
    if (!ok) console.log('✗');
  }

  // 5) Testar monuv embed player
  console.log('\n[5] Testando embed monuv (player_digest)...');
  for (const cam of CAMERAS.filter(c => !found.has(c.camId)).slice(0, 5)) {
    const spot = spots.find(s => s.referencia === cam.ref);
    if (!spot?.descricao) continue;
    try {
      const embedUrl = `https://app.monuv.com.br/embed/player/${cam.camId}?digest=${spot.descricao}`;
      const r = await fetch(embedUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
        signal: AbortSignal.timeout(8000),
      });
      const body = await r.text();
      console.log(`   ${cam.name.padEnd(24)} HTTP ${r.status} (${body.length} bytes)`);
      const streams = [...body.matchAll(/https?:\/\/[^"'\s]*\.m3u8[^"'\s]*/g)];
      if (streams.length) {
        for (const s of streams) {
          console.log(`   >>> ${s[0].substring(0, 100)}`);
          const id = s[0].match(/(\d+)\.stream/)?.[1];
          if (id) found.set(Number(id), s[0]);
        }
      }
    } catch (e) {
      console.log(`   ${cam.name.padEnd(24)} ERRO: ${e.message}`);
    }
  }

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO FINAL');
  console.log('='.repeat(60));
  let live = 0;
  for (const cam of CAMERAS) {
    const url = found.get(cam.camId);
    if (url) { live++; console.log(`✓ ${cam.name.padEnd(24)} ${url.substring(0, 90)}`); }
    else { console.log(`  ${cam.name.padEnd(24)} thumb only`); }
  }
  console.log(`\nTotal: ${live} LIVE / ${CAMERAS.length}`);

  // Salvar
  const output = CAMERAS.map(c => ({
    ...c,
    streamUrl: found.get(c.camId) || null,
    thumbnail: `https://thumbs-cameras.monuv.com.br/${c.camId}/last/${c.camId}.jpg`,
  }));
  const fs = await import('node:fs/promises');
  await fs.writeFile('surfview-streams.json', JSON.stringify(output, null, 2));
  console.log('\nSalvo em surfview-streams.json');
})();
