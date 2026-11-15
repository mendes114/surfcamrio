/**
 * Script manual para testar TODAS as fontes de stream possíveis.
 * Rode: node scripts/testar-todas.mjs
 */

const WOWZA_BASE = 'https://5a1e323a9ae38.streamlock.net/livecam/_definst_';
const MONUV_ACCOUNT = 'f7117c097';

async function testar(url, timeout = 6000) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const txt = await r.text();
    return { ok: txt.includes('#EXTM3U'), status: r.status, bytes: txt.length };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

console.log('=== 1. WOWZA STREAMS CONHECIDOS ===');
const wowza = [
  'cam_macumba_curvao.stream', 'cam_macumba_1w.stream', 'cam_macumba.stream',
  'cam_recreio.stream', 'cam_reserva.stream', 'cam_prainha.stream',
  'cam_meio_da_barra.stream', 'cam_postinho.stream', 'cam_barra_fixa.stream',
  'cam_posto_6.stream',
];
for (const s of wowza) {
  const r = await testar(`${WOWZA_BASE}/${s}/playlist.m3u8`);
  console.log(r.ok ? '✓' : '✗', s, JSON.stringify(r));
}

console.log('\n=== 2. WOWZA VARIAÇÕES (brute-force) ===');
const variações = [
  'cam_macumba_5w.stream', 'cam_macumba5w.stream',
  'cam_macumba_6w.stream', 'cam_macumba6w.stream',
  'cam_macumba_secreto.stream', 'cam_macumbasecreto.stream', 'cam_secreto.stream',
  'cam_macumba_farofa.stream', 'cam_farofa.stream',
  'cam_canto_recreio.stream', 'cam_canto_do_recreio.stream', 'cam_cantodorecreio.stream',
  'cam_recreio_canto.stream', 'cam_recreio_p10.stream', 'cam_recreio_p11.stream',
  'cam_macumba_4w.stream', 'cam_macumba4w.stream',
  'cam_pontal.stream', 'cam_grumari.stream',
  'cam_barrafixa.stream', 'cam_barra.stream',
];
for (const s of variações) {
  const r = await testar(`${WOWZA_BASE}/${s}/playlist.m3u8`);
  if (r.ok) console.log('✓ NOVO!', s, JSON.stringify(r));
}
console.log('(brute-force feito)');

console.log('\n=== 3. MONUV SEM HASH ===');
const camIds = [67855, 87728, 109576, 87147, 87146, 94293, 83726, 94292, 77354, 83727, 75805, 81928, 68996];
const nomes = ['Macumba','Secreto','4W','5W','6W','Farofa','Canto1','Canto2','P10','P11','Reserva','PrainhaDir','PrainhaEsq'];
const combos = [
  { server: 'live-32', type: 'rtmp' },
  { server: 'live-582', type: 'a1' },
  { server: 'live-p2p-252', type: 'p2p' },
];
for (let i = 0; i < camIds.length; i++) {
  for (const combo of combos) {
    const url = `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camIds[i]}.stream/playlist.m3u8`;
    const r = await testar(url);
    if (r.ok) console.log('✓ SEM HASH:', nomes[i], camIds[i], combo.server, combo.type);
  }
}
console.log('(monuv sem hash feito)');

console.log('\n=== 4. MONUV EMBED ===');
for (let i = 0; i < camIds.length; i++) {
  try {
    const r = await fetch(`https://cams.monuv.com.br/embed/${camIds[i]}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const html = await r.text();
      const m = html.match(/https?:[^"'\s]*\.m3u8[^"'\s]*/);
      if (m) console.log('✓ EMBED:', nomes[i], camIds[i], m[0].slice(0, 120));
    }
  } catch {}
}
console.log('(embed feito)');

console.log('\n=== 5. DVR STREAMS (SurfConnect Premium) ===');
try {
  const r = await fetch('https://api-python.surfconnect.com.br/starter/new_filtered_spot_data/', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  const premium = d.filters?.['Premium'] || [];
  for (const s of premium) {
    if (!s.stream) continue;
    const r2 = await testar(s.stream);
    console.log(r2.ok ? '✓' : '✗', s.name, r2.ok ? 'DVR FUNCIONA' : `DVR ${JSON.stringify(r2)}`);
  }
} catch (e) {
  console.log('Erro API:', e.message);
}

console.log('\n=== 6. SURFVIEW HOMEPAGE SCRAPE ===');
try {
  const r = await fetch('https://surfview.com.br/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await r.text();
  const streams = [...html.matchAll(/https?:\/\/live[^"'\s]*monuv\.com\.br[^"'\s]*\.m3u8[^"'\s]*/g)];
  console.log('Streams na homepage:', streams.length);
  for (const m of streams) {
    const camMatch = m[0].match(/(\d+)\.stream/);
    const camId = camMatch ? Number(camMatch[1]) : '?';
    const nome = nomes[camIds.indexOf(camId)] || '?';
    console.log('  ✓', nome, camId, m[0].slice(0, 120));
  }
} catch (e) {
  console.log('Erro surfview:', e.message);
}

console.log('\n=== 7. API MONUV PLAYER/LIVE-URL ===');
const alvoIds = [87728, 87146, 94293, 83726, 94292, 108636, 110119];
const alvoNomes = {87728:'Secreto',87146:'6W',94293:'Farofa',83726:'Canto1',94292:'Canto2',108636:'NOVO-A',110119:'NOVO-B'};
for (const camId of alvoIds) {
  for (const ep of ['player', 'live-url']) {
    try {
      const r = await fetch(`https://app.monuv.com.br/api/camera/${camId}/${ep}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html,application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const txt = await r.text();
      const m = txt.match(/https?:[^"'\s]*\.m3u8[^"'\s]*/);
      const digest = txt.match(/(?:digest|hash|token)['":\s=]+([A-Za-z0-9_=-]{10,80})/i);
      if (m) console.log('✓ STREAM:', alvoNomes[camId], ep, m[0].slice(0,100));
      else if (digest) console.log('  DIGEST:', alvoNomes[camId], ep, digest[0].slice(0,60));
      else console.log(' ', r.status, alvoNomes[camId], ep, txt.slice(0,100));
    } catch (e) { console.log('  ERR', alvoNomes[camId], ep, e.message); }
  }
}

console.log('\n=== 8. WOWZA VARIAÇÕES EXTRA ===');
const extraWowza = [
  'cam_secreto.stream', 'cam_6w.stream', 'cam_macumba_6w.stream',
  'cam_farofa.stream', 'cam_macumba_farofa.stream',
  'cam_canto.stream', 'cam_canto_recreio.stream', 'cam_cantodorecreio.stream',
  'cam_recreio_canto.stream', 'cam_pontal.stream',
  'cam_macumba_secreto.stream', 'cam_macumbasecreto.stream',
  'cam_recreio_p10.stream', 'cam_recreio_p11.stream',
  'cam_macumba_curvao_2.stream', 'cam_macumba_2.stream',
  'cam_macumba_1w_2.stream', 'cam_recreio_2.stream',
];
for (const s of extraWowza) {
  const r = await testar(`${WOWZA_BASE}/${s}/playlist.m3u8`);
  if (r.ok) console.log('✓ NOVO WOWZA!', s, JSON.stringify(r));
}
console.log('(variações extra feito)');

console.log('\nFIM.');
