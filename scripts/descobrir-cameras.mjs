#!/usr/bin/env node
/**
 * Descobre câmeras públicas gratuitas de surf/praia no Rio de Janeiro.
 * Fontes: SurfConnect (API pública), Clima ao Vivo, PraiaBarra, YouTube.
 * Roda sem chave, sem login, sem nada.
 *
 * Uso: node scripts/descobrir-cameras.mjs
 */

const SURFCONNECT_API = 'https://api-python.surfconnect.com.br';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0';

async function json(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...opts.headers },
    signal: AbortSignal.timeout(15000),
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function html(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// ── 1. SurfConnect ──────────────────────────────────────────────────────
async function buscarSurfConnect() {
  console.log('\n🔍 SurfConnect — buscando spots e streams...');

  const dados = await json(`${SURFCONNECT_API}/starter/new_filtered_spot_data/`);
  const streamServer = dados.streamServer ?? 0;
  const filtros = dados.filters || {};
  const todosSpots = [];
  const ids = new Set();

  for (const [grupo, spots] of Object.entries(filtros)) {
    if (!Array.isArray(spots)) continue;
    for (const s of spots) {
      if (ids.has(s.id)) continue;
      ids.add(s.id);
      todosSpots.push(s);
    }
  }

  if (todosSpots.length === 0) {
    const status = await json(`${SURFCONNECT_API}/status/`);
    for (const s of status.spots || []) {
      if (!ids.has(s.id)) {
        ids.add(s.id);
        todosSpots.push(s);
      }
    }
  }

  console.log(`   ${todosSpots.length} spots encontrados (streamServer=${streamServer})\n`);

  const cameras = [];
  for (const spot of todosSpots) {
    const stream = spot.stream || spot.m3u8 || null;
    const mobileStream = spot.mobile_stream || null;
    const thumb = spot.thumbnail || spot.thumb || null;
    const online = spot.online !== false;

    cameras.push({
      fonte: 'surfconnect',
      id: spot.id,
      nome: spot.name || spot.nome || `Spot ${spot.id}`,
      cidade: spot.city || spot.cidade || '',
      estado: spot.state || spot.estado || '',
      online,
      stream,
      mobileStream,
      thumbnail: thumb,
      streamServer,
      urlSite: `https://surfconnect.com.br/cameras/${(spot.state || 'rj').toLowerCase()}/${spot.id}/`,
    });

    const status = stream ? '✅' : online ? '⚠️  (stream protegido)' : '🔴 offline';
    console.log(`   [${String(spot.id).padStart(2)}] ${(spot.name || '').padEnd(25)} ${status}${stream ? '  → ' + stream : ''}`);
  }

  return cameras;
}

// ── 2. Clima ao Vivo ────────────────────────────────────────────────────
const CAMERAS_CAV = [
  { slug: 'rj/rio-de-janeiro/rio-de-janeiro-cdesign-hotel', titulo: 'CDesign Hotel · Recreio' },
  { slug: 'rj/rio-de-janeiro/rio-de-janeiro-lagoa-rodrigo-de-freitas', titulo: 'Lagoa Rodrigo de Freitas' },
  { slug: 'rj/rio-de-janeiro/rio-de-janeiro-morro-da-urca', titulo: 'Morro da Urca' },
  { slug: 'rj/rio-de-janeiro/rio-de-janeiro-aterro-do-flamengo', titulo: 'Aterro do Flamengo' },
  { slug: 'rj/rio-de-janeiro/rio-de-janeiro-centro', titulo: 'Centro do Rio' },
  { slug: 'rj/niteroi/niteroi-praia-de-icarai', titulo: 'Icaraí · Niterói' },
];

function extrairStreamCAV(htmlText) {
  const match = htmlText.match(/__NEXT_DATA__[^>]*>(\{.*?\})\s*<\/script/s);
  if (!match) return null;
  try {
    const d = JSON.parse(match[1]);
    const page = d?.props?.pageProps?.page?.data;
    if (!page) return null;

    const embed = page.desurlextreaming || page.link || '';
    if (embed.includes('embed.html')) {
      return embed.replace('embed.html', 'playlist.m3u8');
    }
    const m3u8 = embed.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    if (m3u8) return m3u8[0];
  } catch {}
  return null;
}

async function buscarClimaAoVivo() {
  console.log('\n🔍 Clima ao Vivo — buscando streams HLS...');
  const cameras = [];

  for (const cam of CAMERAS_CAV) {
    try {
      const page = await html(`https://www.climaaovivo.com.br/${cam.slug}`);
      const stream = extrairStreamCAV(page);

      // Also look for the authenticated playlist URL
      const m3u8Match = page.match(/https:\/\/streaming\d*\.climaaovivo\.com\.br\/[^\s"']+\.m3u8[^\s"']*/);
      const streamAuth = m3u8Match ? m3u8Match[0] : null;

      const url = streamAuth || stream;
      cameras.push({
        fonte: 'climaaovivo',
        slug: cam.slug,
        titulo: cam.titulo,
        stream: url,
        streamSemAuth: stream,
        urlSite: `https://www.climaaovivo.com.br/${cam.slug}`,
      });

      console.log(`   ${cam.titulo.padEnd(35)} ${url ? '✅ ' + url.slice(0, 80) + '...' : '❌ sem stream'}`);
    } catch (e) {
      console.log(`   ${cam.titulo.padEnd(35)} ❌ ${e.message}`);
      cameras.push({ fonte: 'climaaovivo', slug: cam.slug, titulo: cam.titulo, stream: null, erro: e.message });
    }
  }

  return cameras;
}

// ── 3. PraiaBarra (JMVStream) ───────────────────────────────────────────
async function buscarPraiaBarra() {
  console.log('\n🔍 PraiaBarra.com.br — buscando player JMVStream...');
  try {
    const page = await html('https://praiabarra.com.br');
    const iframeMatch = page.match(/player\.jmvstream\.com\/[^"'\s]+/);
    const windyMatch = page.match(/embed\.windy\.com\/[^"'\s]+/);

    const playerUrl = iframeMatch ? `https://${iframeMatch[0]}` : null;
    console.log(`   Player JMVStream: ${playerUrl || 'não encontrado'}`);
    if (windyMatch) console.log(`   Mapa Windy embed: https://${windyMatch[0].slice(0, 60)}...`);

    return [{
      fonte: 'praiabarra',
      titulo: 'PraiaBarra · Barra da Tijuca 24h',
      tipo: 'iframe',
      playerUrl,
      urlSite: 'https://praiabarra.com.br',
    }];
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
    return [];
  }
}

// ── 4. Recreio.Online ───────────────────────────────────────────────────
async function buscarRecreioOnline() {
  console.log('\n🔍 Recreio.Online — buscando stream...');
  try {
    const page = await html('https://recreio.online/');
    const iframeMatch = page.match(/<iframe[^>]+src="([^"]+)"/gi);
    const m3u8Match = page.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    const ytMatch = page.match(/youtube\.com\/embed\/([^"?\s]+)/);

    const cameras = [];
    if (m3u8Match) {
      console.log(`   ✅ HLS: ${m3u8Match[0]}`);
      cameras.push({ fonte: 'recreio.online', titulo: 'Recreio.Online', tipo: 'hls', stream: m3u8Match[0] });
    }
    if (ytMatch) {
      console.log(`   ✅ YouTube embed: ${ytMatch[1]}`);
      cameras.push({ fonte: 'recreio.online', titulo: 'Recreio.Online (YouTube)', tipo: 'youtube', valor: ytMatch[1] });
    }
    if (iframeMatch) {
      for (const iframe of iframeMatch) {
        const src = iframe.match(/src="([^"]+)"/)?.[1];
        if (src && !src.includes('google') && !src.includes('windy')) {
          console.log(`   ✅ iframe: ${src}`);
          cameras.push({ fonte: 'recreio.online', titulo: 'Recreio.Online (embed)', tipo: 'iframe', playerUrl: src });
        }
      }
    }
    if (cameras.length === 0) console.log('   ⚠️  Stream carregado via JS — não extraído do HTML');
    return cameras;
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
    return [];
  }
}

// ── 5. SkylineWebcams ───────────────────────────────────────────────────
async function buscarSkyline() {
  console.log('\n🔍 SkylineWebcams — buscando Copacabana...');
  try {
    const page = await html('https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana.html');
    const streamMatch = page.match(/url\s*[:=]\s*['"]?(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/i);
    const hlsMatch = page.match(/livecam-cdn[^'"\s]+\.m3u8[^'"\s]*/i);
    const sourceMatch = page.match(/source\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)/i);

    const stream = streamMatch?.[1] || hlsMatch?.[0] || sourceMatch?.[1] || null;
    if (stream) {
      console.log(`   ✅ ${stream}`);
      return [{ fonte: 'skylinewebcams', titulo: 'SkylineWebcams · Copacabana', tipo: 'hls', stream }];
    }

    // Try to find the ll.cam ID
    const camIdMatch = page.match(/cam_id\s*[:=]\s*['"]?(\d+)/i) || page.match(/\/(\d+)\.m3u8/);
    if (camIdMatch) {
      const possibleUrl = `https://hd-auth.skylinewebcams.com/live.m3u8?a=copacabana`;
      console.log(`   ⚠️  cam_id=${camIdMatch[1]} — stream carregado via JS`);
    } else {
      console.log('   ⚠️  Stream carregado via JS — não extraído do HTML');
    }
    return [];
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
    return [];
  }
}

// ── 6. YouTube Lives pesquisa ───────────────────────────────────────────
async function buscarYouTubeLives() {
  console.log('\n🔍 YouTube — buscando lives conhecidas...');
  const lives = [
    { id: '6QoLEltTzIM', titulo: 'EarthCam · Copacabana Beach' },
    { id: 'c0AZN6rz8Jk', titulo: 'Rio World Live · Copacabana 24/7' },
  ];

  const cameras = [];
  for (const live of lives) {
    try {
      const res = await fetch(`https://www.youtube.com/watch?v=${live.id}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      const isLive = res.ok;
      cameras.push({
        fonte: 'youtube',
        titulo: live.titulo,
        tipo: 'youtube',
        valor: live.id,
        urlSite: `https://www.youtube.com/watch?v=${live.id}`,
      });
      console.log(`   ${live.titulo.padEnd(40)} ${isLive ? '✅' : '⚠️'} ${live.id}`);
    } catch (e) {
      console.log(`   ${live.titulo.padEnd(40)} ❌ ${e.message}`);
    }
  }
  return cameras;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DESCOBRIDOR DE CÂMERAS PÚBLICAS — Praias do Rio de Janeiro');
  console.log('  Sem login, sem chave, sem assinatura. Tudo grátis.');
  console.log('═══════════════════════════════════════════════════════════════');

  const resultados = await Promise.allSettled([
    buscarSurfConnect(),
    buscarClimaAoVivo(),
    buscarPraiaBarra(),
    buscarRecreioOnline(),
    buscarSkyline(),
    buscarYouTubeLives(),
  ]);

  const todasCameras = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      todasCameras.push(...r.value);
    }
  }

  // Resumo
  const comStream = todasCameras.filter(c => c.stream || c.playerUrl || c.valor);
  const hlsLivres = todasCameras.filter(c => c.stream && c.tipo !== 'youtube');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total de câmeras encontradas: ${todasCameras.length}`);
  console.log(`  Com stream/player acessível:  ${comStream.length}`);
  console.log(`  Streams HLS diretos (grátis): ${hlsLivres.length}`);

  // Gerar JSON com as câmeras encontradas
  const output = JSON.stringify(todasCameras, null, 2);
  const { writeFile } = await import('node:fs/promises');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const caminho = resolve(__dirname, '..', 'cameras-descobertas.json');
  await writeFile(caminho, output, 'utf8');
  console.log(`\n  Salvo em: ${caminho}`);

  // Mostrar os streams HLS prontos para usar
  if (hlsLivres.length > 0) {
    console.log('\n── STREAMS HLS PRONTOS PARA USAR ──────────────────────────');
    for (const c of hlsLivres) {
      console.log(`\n  📹 ${c.titulo || c.nome}`);
      console.log(`     ${c.stream}`);
    }
  }

  // Mostrar streams do SurfConnect
  const sc = todasCameras.filter(c => c.fonte === 'surfconnect');
  const scComStream = sc.filter(c => c.stream);
  const scSemStream = sc.filter(c => !c.stream && c.online);
  if (scComStream.length > 0) {
    console.log('\n── SURFCONNECT — STREAMS ABERTOS ──────────────────────────');
    for (const c of scComStream) {
      console.log(`  📹 ${c.nome}: ${c.stream}`);
    }
  }
  if (scSemStream.length > 0) {
    console.log('\n── SURFCONNECT — ONLINE MAS STREAM PROTEGIDO ─────────────');
    console.log('  (Para pegar: abra o site, F12 → Network → filtrar .m3u8)');
    for (const c of scSemStream) {
      console.log(`  ⚠️  ${c.nome}: ${c.urlSite}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
