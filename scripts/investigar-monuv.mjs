/**
 * Investigação aprofundada de streams Monuv.
 * Rode: node scripts/investigar-monuv.mjs
 *
 * Testa:
 * 1. Identificação dos camera IDs 108636 e 110119
 * 2. Reutilização de m_hash entre câmeras
 * 3. API /api/spots/info com referências completas
 * 4. Variações de URL do embed Monuv
 */

const MONUV_ACCOUNT = 'f7117c097';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

const CAMERAS = {
  67855:  'Macumba',
  87728:  'Secreto',
  109576: '4W',
  87147:  '5W',
  87146:  '6W',
  94293:  'Farofa',
  83726:  'Canto1',
  94292:  'Canto2',
  77354:  'P10',
  83727:  'P11',
  75805:  'Reserva',
  81928:  'PrainhaDir',
  68996:  'PrainhaEsq',
  108636: 'NOVO-A',
  110119: 'NOVO-B',
};

const COMBOS = [
  { server: 'live-32', type: 'rtmp' },
  { server: 'live-582', type: 'a1' },
  { server: 'live-p2p-252', type: 'p2p' },
];

async function testar(url, timeout = 6000) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const txt = await r.text();
    return { ok: txt.includes('#EXTM3U'), status: r.status, bytes: txt.length };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// 1. Pegar todos os hashes da homepage
console.log('=== 1. SCRAPE HOMEPAGE: Extrair m_hash ===');
const hashes = new Map();
try {
  const r = await fetch('https://surfview.com.br/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await r.text();

  const regex = /https?:\/\/live[^"'\s]*monuv\.com\.br[^"'\s]*\.m3u8[^"'\s]*/g;
  for (const m of html.matchAll(regex)) {
    const camMatch = m[0].match(/(\d+)\.stream/);
    const hashMatch = m[0].match(/m_hash=([^&"'\s]+)/);
    if (camMatch && hashMatch) {
      const id = Number(camMatch[1]);
      hashes.set(id, hashMatch[1]);
      console.log('  Hash encontrado:', CAMERAS[id] || '?', `(${id})`, hashMatch[1].slice(0, 30) + '...');
    }
  }

  // Tentar também CSRF + API
  const csrf = (html.match(/csrf-token.*?content="([^"]+)"/) || [])[1];
  const rawCookies = r.headers.getSetCookie?.() || [];
  const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');

  if (csrf && cookieStr) {
    console.log('\n=== 2. API /api/spots/info: Buscar todas as referências ===');

    // Tentar com todas as refs conhecidas + variações
    const refs = [
      'macumba', 'macumbasecreto', 'macumba4w', 'macumba5w', 'macumba6w',
      'macumbaforofa', 'cantodorecreio', 'cantodorecreioll', 'recreiop10',
      'recreiop11', 'reserva', 'prainhacantoesquerdo', 'prainhaRj',
      // Variações extras
      'macumba1w', 'macumbacurvao', 'macumba_curvao', 'barradatijuca',
      'barra', 'postinho', 'meiodabarra', 'leme', 'copacabana',
      'ipanema', 'leblon', 'saoconrado', 'pepino', 'grumari',
    ];
    const infoRes = await fetch(
      `https://surfview.com.br/api/spots/info?refs=${encodeURIComponent(refs.join(','))}`,
      {
        headers: {
          'User-Agent': UA, Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf,
          Cookie: cookieStr, Referer: 'https://surfview.com.br/',
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    console.log('  Status:', infoRes.status);
    if (infoRes.ok) {
      const data = await infoRes.json();
      const spots = data.spots || data.items || (Array.isArray(data) ? data : []);
      console.log('  Spots retornados:', spots.length);
      for (const s of spots) {
        const desc = s.descricao || '';
        const isHash = /^[A-Za-z0-9_=-]{20,80}$/.test(desc);
        console.log('   ', s.referencia,
          '| cam:', s.monuv_camera_id || s.camera_id || '?',
          '| nome:', s.nome || s.name || '?',
          '| desc:', isHash ? desc.slice(0, 30) + '... (HASH!)' : (desc || '-').slice(0, 40));
      }
    }
  }
} catch (e) {
  console.log('Erro homepage:', e.message);
}

// 3. Testar reutilização de hash entre câmeras
console.log('\n=== 3. REUTILIZAÇÃO DE HASH ===');
if (hashes.size > 0) {
  const semStream = [87728, 87146, 94293, 83726, 94292]; // Secreto, 6W, Farofa, Canto1, Canto2
  const [doadorId, doadorHash] = [...hashes.entries()][0];
  console.log(`Hash do doador: ${CAMERAS[doadorId]} (${doadorId})`);

  for (const camId of semStream) {
    for (const combo of COMBOS) {
      const url = `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camId}.stream/playlist.m3u8?m_hash=${doadorHash}`;
      const r = await testar(url);
      if (r.ok) {
        console.log('✓ HASH REUTILIZADO!', CAMERAS[camId], camId, combo.server, combo.type);
      }
    }
  }

  // Testar cada hash disponível em cada câmera faltante
  if (hashes.size > 1) {
    console.log('\nTestando todos os hashes disponíveis:');
    for (const [hashCamId, hash] of hashes) {
      for (const camId of semStream) {
        if (camId === hashCamId) continue;
        const combo = COMBOS[0]; // rtmp
        const url = `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camId}.stream/playlist.m3u8?m_hash=${hash}`;
        const r = await testar(url);
        if (r.ok) {
          console.log('✓ CROSS-HASH!', CAMERAS[hashCamId], '→', CAMERAS[camId], combo.type);
        }
      }
    }
  }
  console.log('(teste de reutilização concluído)');
} else {
  console.log('Nenhum hash extraído da homepage para testar.');
}

// 4. Testar embed do Monuv com diferentes abordagens
console.log('\n=== 4. EMBED MONUV (múltiplas rotas) ===');
const alvoIds = [87728, 87146, 94293, 83726, 94292, 108636, 110119];
for (const camId of alvoIds) {
  const urls = [
    `https://cams.monuv.com.br/embed/${camId}`,
    `https://cams.monuv.com.br/cameras/${camId}`,
    `https://cams.monuv.com.br/${camId}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://surfview.com.br/' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (r.ok) {
        const html = await r.text();
        const streamMatch = html.match(/https?:[^"'\s]*\.m3u8[^"'\s]*/);
        if (streamMatch) {
          console.log('✓ EMBED:', CAMERAS[camId], camId, url.split('/').pop(), streamMatch[0].slice(0, 100));
        }
        // Also check for any token/hash in the page
        const tokenMatch = html.match(/(?:token|hash|key|m_hash)['":\s=]+([A-Za-z0-9_=-]{20,80})/gi);
        if (tokenMatch) {
          console.log('  Token encontrado:', CAMERAS[camId], tokenMatch[0].slice(0, 60));
        }
      }
    } catch {}
  }
}
console.log('(embed concluído)');

// 5. Procurar páginas específicas no SurfView
console.log('\n=== 5. PÁGINAS ESPECÍFICAS SURFVIEW ===');
const paginas = [
  'https://surfview.com.br/macumba-secreto',
  'https://surfview.com.br/macumba-6w',
  'https://surfview.com.br/macumba-farofa',
  'https://surfview.com.br/canto-do-recreio',
  'https://surfview.com.br/spot/macumbasecreto',
  'https://surfview.com.br/spot/macumba6w',
  'https://surfview.com.br/spot/macumbaforofa',
  'https://surfview.com.br/spot/cantodorecreio',
  'https://surfview.com.br/cameras/macumbasecreto',
  'https://surfview.com.br/cameras/macumba6w',
];
for (const url of paginas) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });
    if (r.status === 200) {
      const html = await r.text();
      const streams = [...html.matchAll(/https?:\/\/live[^"'\s]*monuv\.com\.br[^"'\s]*\.m3u8[^"'\s]*/g)];
      if (streams.length) {
        console.log('✓ PÁGINA:', url.split('/').pop(), streams.length, 'streams');
        for (const s of streams) console.log('  ', s[0].slice(0, 120));
      } else {
        console.log('  Página OK mas sem stream:', url.split('/').pop());
      }
    } else {
      console.log(' ', r.status, url.split('/').pop());
    }
  } catch {}
}

// 6. Testar IDs sequenciais próximos aos novos
console.log('\n=== 6. IDS SEQUENCIAIS PRÓXIMOS ===');
const ranges = [
  { start: 108630, end: 108645, label: 'perto de 108636' },
  { start: 110115, end: 110125, label: 'perto de 110119' },
];
for (const range of ranges) {
  for (let id = range.start; id <= range.end; id++) {
    if (id === 108636 || id === 110119) continue;
    try {
      const r = await fetch(`https://thumbs-cameras.monuv.com.br/${id}/last/${id}.jpg`, {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok && Number(r.headers.get('content-length')) > 1000) {
        console.log('✓ CAM ATIVA:', id, range.label, 'size:', r.headers.get('content-length'));
      }
    } catch {}
  }
}

// 7. API Monuv: player endpoint (sem auth e com player_digest)
console.log('\n=== 7. API MONUV: PLAYER & LIVE-URL ===');
for (const camId of alvoIds) {
  const endpoints = [
    `https://app.monuv.com.br/api/camera/${camId}/player`,
    `https://app.monuv.com.br/api/camera/${camId}/live-url`,
    `https://app.monuv.com.br/api/camera-player/${camId}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const txt = await r.text();
      const label = url.split('/api/')[1] || url;
      if (r.ok) {
        const streams = [...txt.matchAll(/https?:[^"'\s]*\.m3u8[^"'\s]*/g)];
        const hashes = [...txt.matchAll(/(?:digest|hash|token)['":\s=]+([A-Za-z0-9_=-]{10,80})/gi)];
        if (streams.length) console.log('✓ STREAM via API:', CAMERAS[camId], label, streams[0][0].slice(0,100));
        if (hashes.length) console.log('  DIGEST/TOKEN:', CAMERAS[camId], hashes.map(h=>h[0].slice(0,50)).join(' | '));
        if (!streams.length && !hashes.length) console.log('  OK mas sem stream/digest:', CAMERAS[camId], label, txt.slice(0,150));
      } else {
        console.log(' ', r.status, CAMERAS[camId], label);
      }
    } catch {}
  }
}

// 8. Testar se app.monuv.com.br/api/v4/cameras retorna algo sem token
console.log('\n=== 8. API v4 CAMERAS (sem token) ===');
try {
  const r = await fetch('https://app.monuv.com.br/api/v4/cameras?p=hls', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  console.log('Status:', r.status);
  if (r.ok) {
    const data = await r.json();
    console.log('Resposta:', JSON.stringify(data).slice(0, 500));
  }
} catch (e) { console.log('Erro:', e.message); }

// 9. Cross-hash reuse (resultado esperado: 403, mas vale confirmar com hashes completos)
console.log('\n=== 9. CROSS-HASH (CONFIRMAÇÃO) ===');
if (hashes.size > 0) {
  const semStream = [87728, 87146, 94293, 83726, 94292];
  const hashEntries = [...hashes.entries()];
  let found = 0;
  for (const [doadorId, doadorHash] of hashEntries) {
    for (const camId of semStream) {
      const combo = COMBOS[0];
      const url = `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camId}.stream/playlist.m3u8?m_hash=${doadorHash}`;
      const r = await testar(url);
      if (r.ok) {
        console.log('✓ CROSS-HASH FUNCIONA!', CAMERAS[doadorId], '→', CAMERAS[camId]);
        found++;
      }
    }
  }
  if (!found) console.log('Cross-hash NÃO funciona (403 em todos). Hash é por câmera.');
} else {
  console.log('Sem hashes para testar.');
}

console.log('\nFIM DA INVESTIGAÇÃO.');
