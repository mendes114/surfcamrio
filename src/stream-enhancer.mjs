/**
 * Melhora a lista de câmeras SurfView com streams adicionais.
 * Usa cache persistente de hashes e tenta a API Monuv player.
 */
import { guardarVarios, todosHashes } from './hash-cache.mjs';
import { buscarViaApiMonuv } from './monuv-api.mjs';

const MONUV_ACCOUNT = 'f7117c097';
const COMBOS = [
  { server: 'live-32', type: 'rtmp' },
  { server: 'live-582', type: 'a1' },
  { server: 'live-p2p-252', type: 'p2p' },
];

function buildUrl(camId, hash, combo) {
  return `https://${combo.server}-${MONUV_ACCOUNT}.monuv.com.br:443/${combo.type}/${camId}.stream/playlist.m3u8?m_hash=${hash}`;
}

async function testStream(url, fetchImpl) {
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

export async function enhanceCameras(cameras, fetchImpl = globalThis.fetch) {
  // 1. Guardar hashes de câmeras que já têm stream monuv
  const novos = new Map();
  for (const cam of cameras) {
    if (cam.streamUrl && cam.fonteStream === 'monuv') {
      const hm = cam.streamUrl.match(/m_hash=([^&"'\s]+)/);
      if (hm) novos.set(cam.camId, hm[1]);
    }
  }
  if (novos.size) guardarVarios(novos);

  // 2. Tentar hashes do cache para câmeras sem stream
  const semStream = cameras.filter(c => !c.streamUrl);
  if (semStream.length) {
    const hashCache = todosHashes();
    for (const cam of semStream) {
      const hash = hashCache.get(cam.camId);
      if (!hash) continue;
      for (const combo of COMBOS) {
        const url = buildUrl(cam.camId, hash, combo);
        if (await testStream(url, fetchImpl)) {
          cam.streamUrl = url;
          cam.fonteStream = 'monuv-cache';
          break;
        }
      }
    }
  }

  // 3. API Monuv player como último recurso
  const aindaSem = cameras.filter(c => !c.streamUrl).map(c => c.camId);
  if (aindaSem.length) {
    try {
      const extras = await buscarViaApiMonuv(aindaSem, fetchImpl);
      for (const cam of cameras) {
        if (!cam.streamUrl && extras.has(cam.camId)) {
          cam.streamUrl = extras.get(cam.camId);
          cam.fonteStream = 'monuv-api';
        }
      }
    } catch {}
  }

  return cameras;
}
