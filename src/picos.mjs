/**
 * Picos monitorados na Zona Oeste do Rio de Janeiro (Recreio e Macumba)
 * e funções puras de apoio para previsão do mar e parsing de câmeras.
 */

export const PICOS = [
  {
    id: 'macumba',
    nome: 'Praia da Macumba (Curvão / 5W)',
    bairro: 'Recreio dos Bandeirantes',
    latitude: -23.0335,
    longitude: -43.4895,
  },
  {
    id: 'pontal',
    nome: 'Pedra do Pontal (Canto do Recreio)',
    bairro: 'Recreio dos Bandeirantes',
    latitude: -23.0308,
    longitude: -43.4718,
  },
  {
    id: 'recreio',
    nome: 'Praia do Recreio (Posto 9 / CDesign)',
    bairro: 'Recreio dos Bandeirantes',
    latitude: -23.0255,
    longitude: -43.461,
  },
];

export const CENTRO_REGIAO = {
  latitude: -23.031,
  longitude: -43.475,
  raioKmPadrao: 25,
};

const PONTOS_CARDEAIS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

/**
 * Converte graus (0-360) em direção cardinal em português.
 */
export function direcaoCardeal(graus) {
  if (typeof graus !== 'number' || !Number.isFinite(graus)) {
    return '—';
  }
  const normalizado = ((graus % 360) + 360) % 360;
  const indice = Math.round(normalizado / 45) % 8;
  return PONTOS_CARDEAIS[indice];
}

/**
 * Monta URL da API Marine do Open-Meteo (gratuita, sem chave).
 */
export function montarUrlOpenMeteoMar(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature',
    hourly: 'wave_height,swell_wave_height,swell_wave_period,wave_direction',
    forecast_days: '2',
    timezone: 'America/Sao_Paulo',
  });
  return `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`;
}

/**
 * Monta URL da API de Tempo do Open-Meteo (gratuita, sem chave).
 */
export function montarUrlOpenMeteoTempo(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',
    timezone: 'America/Sao_Paulo',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * Detecta se a entrada é uma URL de stream HLS (.m3u8).
 * Retorna a URL completa ou null.
 */
export function extrairUrlHls(entrada) {
  if (typeof entrada !== 'string') return null;
  const texto = entrada.trim();
  if (!texto) return null;
  try {
    const url = new URL(texto);
    if (url.pathname.endsWith('.m3u8') && (url.protocol === 'https:' || url.protocol === 'http:')) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extrai o ID de vídeo de uma URL ou string do YouTube.
 * Retorna null se não for um formato válido.
 */
export function extrairIdYoutube(entrada) {
  if (typeof entrada !== 'string') return null;
  const texto = entrada.trim();
  if (!texto) return null;

  if (/^[A-Za-z0-9_-]{11}$/.test(texto)) {
    return texto;
  }

  try {
    const url = new URL(texto);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      const partes = url.pathname.split('/').filter(Boolean);
      if (
        partes.length >= 2 &&
        (partes[0] === 'live' || partes[0] === 'embed' || partes[0] === 'shorts')
      ) {
        return /^[A-Za-z0-9_-]{11}$/.test(partes[1]) ? partes[1] : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Extrai o ID numérico de uma webcam do Windy a partir de URL ou texto.
 */
export function extrairIdWindy(entrada) {
  if (typeof entrada !== 'string') return null;
  const texto = entrada.trim();
  if (!texto) return null;

  if (/^\d{5,15}$/.test(texto)) {
    return texto;
  }

  try {
    const url = new URL(texto);
    if (!url.hostname.includes('windy.com')) return null;
    const match = url.pathname.match(/\/webcams\/(?:[^/]+\/)?(\d{5,15})/);
    if (match) return match[1];
    const partes = url.pathname.split('/').filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? '';
    const matchFim = ultimo.match(/(\d{5,15})$/);
    return matchFim ? matchFim[1] : null;
  } catch {
    return null;
  }
}

/**
 * Câmeras públicas conhecidas do Clima ao Vivo na região.
 * O servidor busca a página, extrai o stream HLS do __NEXT_DATA__ e retorna ao front.
 */
export const CAMERAS_CLIMA_AO_VIVO = [
  {
    id: 'cav-cdesign-recreio',
    titulo: 'CDesign Hotel · Praia do Recreio',
    slug: 'rj/rio-de-janeiro/rio-de-janeiro-cdesign-hotel',
  },
];

/**
 * Extrai a URL de streaming HLS do __NEXT_DATA__ de uma página do Clima ao Vivo.
 */
export function extrairStreamClimaAoVivo(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/__NEXT_DATA__[^>]*>(\{.*?\})\s*<\/script/s);
  if (!match) return null;
  try {
    const dados = JSON.parse(match[1]);
    const urlEmbed = dados?.props?.pageProps?.page?.data?.desurlextreaming;
    if (typeof urlEmbed === 'string' && urlEmbed.includes('embed.html')) {
      return urlEmbed.replace('embed.html', 'index.m3u8');
    }
    const link = dados?.props?.pageProps?.page?.data?.link;
    if (typeof link === 'string' && link.includes('embed.html')) {
      return link.replace('embed.html', 'index.m3u8');
    }
  } catch {
    return null;
  }
  return null;
}

const MONUV_THUMBS = 'https://thumbs-cameras.monuv.com.br';

const SURFVIEW_WOWZA_MAP = {
  'sv-macumba':     'cam_macumba_curvao.stream',
  'sv-macumba-5w':  'cam_macumba.stream',
  'sv-recreio-p10': 'cam_recreio.stream',
  'sv-reserva':     'cam_reserva.stream',
  'sv-prainha-dir': 'cam_prainha.stream',
  'sv-prainha-esq': 'cam_prainha.stream',
};

const SURFVIEW_SC_SPOT_MAP = {
  'sv-macumba':     16,
  'sv-macumba-5w':  7,
  'sv-recreio-p10': 6,
  'sv-reserva':     5,
  'sv-prainha-dir': 36,
  'sv-prainha-esq': 36,
};

export const CAMERAS_SURFVIEW = [
  { id: 'sv-macumba',         ref: 'macumba',            titulo: 'Macumba',            camId: 67855,  zona: 'macumba' },
  { id: 'sv-macumba-secreto', ref: 'macumbasecreto',     titulo: 'Macumba Secreto',    camId: 87728,  zona: 'macumba' },
  { id: 'sv-macumba-4w',      ref: 'macumba4w',          titulo: 'Macumba 4W',         camId: 109576, zona: 'macumba' },
  { id: 'sv-macumba-5w',      ref: 'macumba5w',          titulo: 'Macumba 5W',         camId: 87147,  zona: 'macumba' },
  { id: 'sv-macumba-6w',      ref: 'macumba6w',          titulo: 'Macumba 6W',         camId: 87146,  zona: 'macumba' },
  { id: 'sv-macumba-farofa',  ref: 'macumbaforofa',      titulo: 'Macumba Farofa',     camId: 94293,  zona: 'macumba' },
  { id: 'sv-recreio-canto',   ref: 'cantodorecreio',     titulo: 'Canto do Recreio',   camId: 83726,  zona: 'recreio' },
  { id: 'sv-recreio-canto2',  ref: 'cantodorecreioll',   titulo: 'Canto do Recreio 2', camId: 94292,  zona: 'recreio' },
  { id: 'sv-recreio-p10',     ref: 'recreiop10',         titulo: 'Recreio',            camId: 77354,  zona: 'recreio' },
  { id: 'sv-reserva',         ref: 'reserva',            titulo: 'Praia da Reserva',   camId: 75805,  zona: 'barra' },
  { id: 'sv-prainha-dir',     ref: 'prainhacantoesquerdo', titulo: 'Prainha Canto Dir', camId: 81928,  zona: 'macumba' },
  { id: 'sv-prainha-esq',     ref: 'prainhaRj',          titulo: 'Prainha Canto Esq',  camId: 68996,  zona: 'macumba' },
  { id: 'sv-praia-ne',         ref: '',                   titulo: 'Praia NE (SurfView)', camId: 108636, zona: 'outra' },
  { id: 'sv-gloria',           ref: '',                   titulo: 'Glória RJ (SurfView)', camId: 110119, zona: 'outra' },
];

export function thumbSurfView(camId) {
  return `${MONUV_THUMBS}/${camId}/last/${camId}.jpg`;
}

function extrairStreamMonuv(html) {
  const map = new Map();
  const regex = /https?:\/\/live[^"'\s]*monuv\.com\.br[^"'\s]*\.m3u8[^"'\s]*/g;
  for (const m of html.matchAll(regex)) {
    const camMatch = m[0].match(/(\d+)\.stream/);
    if (camMatch) map.set(Number(camMatch[1]), m[0]);
  }
  return map;
}

const MONUV_ACCOUNT = 'f7117c097';
const MONUV_COMBOS = [
  { server: 'live-32',      type: 'rtmp' },
  { server: 'live-582',     type: 'a1' },
  { server: 'live-p2p-252', type: 'p2p' },
];

function monuvUrl(camId, hash, combo) {
  return `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camId}.stream/playlist.m3u8?m_hash=${hash}`;
}

async function testarStreamMonuv(url, fetchImpl) {
  try {
    const r = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://surfview.com.br/' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return false;
    const txt = await r.text();
    return txt.includes('#EXTM3U');
  } catch { return false; }
}

const _wowzaStatus = new Map();
const WOWZA_STATUS_TTL = 5 * 60 * 1000;

async function testarWowza(streamName, fetchImpl) {
  const cached = _wowzaStatus.get(streamName);
  if (cached && Date.now() - cached.t < WOWZA_STATUS_TTL) return cached.url;
  const url = `${WOWZA_BASE}/${streamName}/playlist.m3u8`;
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) { _wowzaStatus.set(streamName, { url: null, t: Date.now() }); return null; }
    const txt = await r.text();
    const ok = txt.includes('#EXTM3U');
    _wowzaStatus.set(streamName, { url: ok ? url : null, t: Date.now() });
    return ok ? url : null;
  } catch {
    _wowzaStatus.set(streamName, { url: null, t: Date.now() });
    return null;
  }
}

let _cacheStreams = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function buscarStreamsSurfView(fetchImpl = globalThis.fetch) {
  if (_cacheStreams && Date.now() - _cacheTime < CACHE_TTL) return _cacheStreams;

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
  const streamMap = new Map();

  const res = await fetchImpl('https://surfview.com.br/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`SurfView HTTP ${res.status}`);
  const html = await res.text();
  for (const [id, url] of extrairStreamMonuv(html)) streamMap.set(id, url);

  try {
    const csrf = (html.match(/csrf-token.*?content="([^"]+)"/) || [])[1];
    const rawCookies = res.headers.getSetCookie?.() || [];
    const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');

    if (csrf && cookieStr) {
      const refs = CAMERAS_SURFVIEW.filter(c => c.ref).map(c => c.ref).join(',');
      const infoRes = await fetchImpl(
        `https://surfview.com.br/api/spots/info?refs=${encodeURIComponent(refs)}`,
        {
          headers: {
            'User-Agent': UA, Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf,
            Cookie: cookieStr, Referer: 'https://surfview.com.br/',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (infoRes.ok) {
        const data = await infoRes.json();
        const spots = data.spots || data.items || (Array.isArray(data) ? data : []);
        const faltando = CAMERAS_SURFVIEW.filter(c => !streamMap.has(c.camId));

        const testes = [];
        for (const cam of faltando) {
          const spot = spots.find(s => s.referencia === cam.ref);
          if (!spot?.descricao || !/^[A-Za-z0-9_=-]{20,80}$/.test(spot.descricao)) continue;
          for (const combo of MONUV_COMBOS) {
            const url = monuvUrl(cam.camId, spot.descricao, combo);
            testes.push({ camId: cam.camId, url, test: testarStreamMonuv(url, fetchImpl) });
          }
        }

        const resultados = await Promise.allSettled(testes.map(t => t.test));
        for (let i = 0; i < testes.length; i++) {
          if (resultados[i].status === 'fulfilled' && resultados[i].value && !streamMap.has(testes[i].camId)) {
            streamMap.set(testes[i].camId, testes[i].url);
          }
        }
      }
    }
  } catch {}

  const wowzaTestes = CAMERAS_SURFVIEW
    .filter(cam => !streamMap.has(cam.camId) && SURFVIEW_WOWZA_MAP[cam.id])
    .map(cam => ({ cam, p: testarWowza(SURFVIEW_WOWZA_MAP[cam.id], fetchImpl) }));
  const wowzaResults = await Promise.allSettled(wowzaTestes.map(t => t.p));
  const wowzaMap = new Map();
  for (let i = 0; i < wowzaTestes.length; i++) {
    const url = wowzaResults[i].status === 'fulfilled' ? wowzaResults[i].value : null;
    if (url) wowzaMap.set(wowzaTestes[i].cam.id, url);
  }

  const faltandoStream = CAMERAS_SURFVIEW.filter(
    cam => !streamMap.has(cam.camId) && !wowzaMap.has(cam.id) && SURFVIEW_SC_SPOT_MAP[cam.id]
  );
  const dvrMap = new Map();
  if (faltandoStream.length) {
    try {
      const scRes = await fetchImpl(`${SURFCONNECT_API}/starter/new_filtered_spot_data/`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (scRes.ok) {
        const scData = await scRes.json();
        const spotMap = new Map();
        for (const spots of Object.values(scData.filters || {})) {
          if (!Array.isArray(spots)) continue;
          for (const s of spots) if (s.id && s.stream) spotMap.set(s.id, s.stream);
        }
        const dvrTestes = faltandoStream
          .map(cam => {
            const dvrUrl = spotMap.get(SURFVIEW_SC_SPOT_MAP[cam.id]);
            return dvrUrl ? { cam, url: dvrUrl, p: testarStream(dvrUrl, fetchImpl) } : null;
          })
          .filter(Boolean);
        const dvrResults = await Promise.allSettled(dvrTestes.map(t => t.p));
        for (let i = 0; i < dvrTestes.length; i++) {
          if (dvrResults[i].status === 'fulfilled' && dvrResults[i].value) {
            dvrMap.set(dvrTestes[i].cam.id, dvrTestes[i].url);
          }
        }
      }
    } catch {}
  }

  const result = CAMERAS_SURFVIEW.map(cam => {
    const monuvUrl = streamMap.get(cam.camId);
    const wowzaUrl = wowzaMap.get(cam.id);
    const dvr = dvrMap.get(cam.id);
    const streamUrl = monuvUrl || wowzaUrl || dvr || null;
    const fonteStream = monuvUrl ? 'monuv' : wowzaUrl ? 'wowza' : dvr ? 'dvr' : null;
    return { ...cam, thumbnail: thumbSurfView(cam.camId), streamUrl, fonteStream, fonte: 'surfview' };
  });

  _cacheStreams = result;
  _cacheTime = Date.now();
  return result;
}

const SURFCONNECT_API = 'https://api-python.surfconnect.com.br';

const WOWZA_BASE = 'https://5a1e323a9ae38.streamlock.net/livecam/_definst_';

export const CAMERAS_WOWZA_LIVRES = [
  { id: 'wz-macumba-curvao', titulo: 'Macumba · Curvão', stream: 'cam_macumba_curvao.stream', zona: 'macumba' },
  { id: 'wz-macumba-1w',     titulo: 'Macumba · 1W',     stream: 'cam_macumba_1w.stream',     zona: 'macumba' },
  { id: 'wz-macumba-5w',     titulo: 'Macumba · 5W',     stream: 'cam_macumba.stream',        zona: 'macumba' },
  { id: 'wz-recreio',        titulo: 'Recreio',           stream: 'cam_recreio.stream',        zona: 'recreio' },
  { id: 'wz-reserva',        titulo: 'Reserva',           stream: 'cam_reserva.stream',        zona: 'barra' },
  { id: 'wz-prainha',        titulo: 'Prainha',           stream: 'cam_prainha.stream',        zona: 'macumba' },
  { id: 'wz-meio-barra',     titulo: 'Meio da Barra',    stream: 'cam_meio_da_barra.stream',  zona: 'barra' },
  { id: 'wz-postinho',       titulo: 'Postinho (Barra)', stream: 'cam_postinho.stream',        zona: 'barra' },
  { id: 'wz-barra-fixa',     titulo: 'Barra Fixa',       stream: 'cam_barra_fixa.stream',     zona: 'barra' },
  { id: 'wz-posto6',         titulo: 'Posto 6 (Barra)',  stream: 'cam_posto_6.stream',        zona: 'barra' },
  { id: 'wz-pepino',         titulo: 'Pepino (S. Conrado)', stream: 'cam_pepino.stream',      zona: 'zona-sul' },
  { id: 'wz-sanca-lat',      titulo: 'São Conrado Lateral', stream: 'cam_sao_conrado.stream', zona: 'zona-sul' },
  { id: 'wz-sanca-front',    titulo: 'São Conrado Frontal', stream: 'cam_sancaocean.stream',  zona: 'zona-sul' },
  { id: 'wz-leblon-p12',     titulo: 'Leblon P12',       stream: 'cam_leblon_p12.stream',     zona: 'zona-sul' },
  { id: 'wz-leblon-p11',     titulo: 'Leblon P11',       stream: 'cam_leblon_p11.stream',     zona: 'zona-sul' },
  { id: 'wz-ipanema-p10',    titulo: 'Ipanema P10',      stream: 'cam_ipanema_p10.stream',    zona: 'zona-sul' },
  { id: 'wz-arpex',          titulo: 'Arpoador',         stream: 'cam_arpex.stream',          zona: 'zona-sul' },
  { id: 'wz-arpex2',         titulo: 'Arpoador Lateral', stream: 'cam_arpex2.stream',         zona: 'zona-sul' },
  { id: 'wz-copa-p6',        titulo: 'Copa P6',          stream: 'cam_copa_6.stream',         zona: 'zona-sul' },
  { id: 'wz-copa-p5',        titulo: 'Copa P5',          stream: 'cam_copa_p5.stream',        zona: 'zona-sul' },
  { id: 'wz-leme',           titulo: 'Leme',             stream: 'cam_leme.stream',           zona: 'zona-sul' },
  { id: 'wz-pitangueiras',   titulo: 'Pitangueiras (SP)', stream: 'cam_pitangueiras.stream',  zona: 'sp' },
];

/**
 * Testa online status de cada câmera Wowza e retorna só as que respondem.
 */
export async function buscarWowzaOnline(fetchImpl = globalThis.fetch) {
  const results = await Promise.allSettled(
    CAMERAS_WOWZA_LIVRES.map(async cam => {
      const url = await testarWowza(cam.stream, fetchImpl);
      return url ? { ...cam, streamUrl: url, fonte: 'wowza' } : null;
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

async function testarStream(url, fetchImpl) {
  try {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return false;
    const txt = await r.text();
    return txt.includes('#EXTM3U');
  } catch { return false; }
}

/**
 * Busca todos os spots com streams HLS abertos da API pública do SurfConnect.
 * Prefere o stream mobile (Wowza, sem token) quando disponível.
 */
export async function buscarStreamsSurfConnect(fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${SURFCONNECT_API}/starter/new_filtered_spot_data/`, {
    headers: {
      'User-Agent': 'cameras-recreio-macumba/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`SurfConnect HTTP ${res.status}`);
  const dados = await res.json();

  const filtros = dados.filters || {};
  const todos = [];
  const ids = new Set();

  for (const spots of Object.values(filtros)) {
    if (!Array.isArray(spots)) continue;
    for (const s of spots) {
      if (!s.id || ids.has(s.id)) continue;
      ids.add(s.id);
      const mobile = s.mobile_stream || null;
      const dvr = s.stream || s.m3u8 || null;
      if (!mobile && !dvr) continue;
      todos.push({
        id: `sc-${s.id}`,
        titulo: `SurfConnect · ${s.name || `Spot ${s.id}`}`,
        cidade: s.city || '',
        estado: s.state || '',
        mobileStream: mobile,
        dvrStream: dvr,
        thumbnail: s.thumbnail || s.thumb || null,
        fonte: 'surfconnect',
        spotId: s.id,
      });
    }
  }

  const tested = await Promise.allSettled(todos.map(async cam => {
    if (cam.mobileStream && await testarStream(cam.mobileStream, fetchImpl)) {
      return { ...cam, streamUrl: cam.mobileStream, fonteStream: 'wowza' };
    }
    if (cam.dvrStream && await testarStream(cam.dvrStream, fetchImpl)) {
      return { ...cam, streamUrl: cam.dvrStream, fonteStream: 'dvr' };
    }
    return { ...cam, streamUrl: null, fonteStream: null };
  }));

  return tested
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(c => c.streamUrl);
}

const ZONA_OESTE_IDS = new Set([2, 3, 4, 5, 6, 7, 16, 36, 38, 42]);

const SC_ZONA_MAP = {
  36: 'macumba', 16: 'macumba', 7: 'macumba', 38: 'macumba',
  6: 'recreio',
  5: 'barra', 4: 'barra', 3: 'barra', 2: 'barra', 42: 'barra',
  37: 'zona-sul', 11: 'zona-sul', 39: 'zona-sul',
  9: 'zona-sul', 15: 'zona-sul', 34: 'zona-sul',
  1: 'zona-sul', 10: 'zona-sul', 40: 'zona-sul',
  12: 'zona-sul', 35: 'zona-sul', 13: 'zona-sul',
  41: 'zona-sul', 8: 'zona-sul',
  17: 'outra', 18: 'outra', 24: 'sp',
};

export async function buscarStreamsSurfConnectZonaOeste(fetchImpl = globalThis.fetch) {
  const todas = await buscarStreamsSurfConnect(fetchImpl);
  return todas.map(c => ({ ...c, zona: SC_ZONA_MAP[c.spotId] || 'outra' }));
}

/**
 * Normaliza a resposta da Windy Webcams API v3 para o painel.
 */
export function normalizarWebcamWindy(cam) {
  const id = String(cam?.webcamId ?? cam?.id ?? '');
  const imagens = cam?.images ?? {};
  const atual = imagens?.current ?? {};
  const player = cam?.player ?? {};
  const loc = cam?.location ?? {};
  const urls = cam?.urls ?? {};

  return {
    id,
    titulo: cam?.title || 'Webcam Windy',
    status: cam?.status || 'unknown',
    cidade: loc?.city || '',
    regiao: loc?.region || '',
    latitude: typeof loc?.latitude === 'number' ? loc.latitude : null,
    longitude: typeof loc?.longitude === 'number' ? loc.longitude : null,
    imagemUrl: atual?.preview || atual?.icon || atual?.thumbnail || null,
    imagemGrandeUrl: atual?.preview || null,
    playerDiaUrl: player?.day || null,
    playerLiveUrl: player?.live || null,
    urlWindy: urls?.detail || (id ? `https://www.windy.com/webcams/${id}` : null),
  };
}
