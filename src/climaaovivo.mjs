/**
 * Clima ao Vivo — extrai streams HLS das páginas de câmeras.
 * O token expira em ~5 min, então mantemos cache curto e refrescamos.
 */

const CAMERAS_CAV = [
  {
    id: 'cav-cdesign',
    titulo: 'CDesign Hotel · Recreio',
    slug: 'rj/rio-de-janeiro/rio-de-janeiro-cdesign-hotel',
    zona: 'recreio',
  },
];

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 min (token dura ~5 min, margem de 3 min)

function extrairStream(html) {
  const match = html.match(
    /https?:\/\/streaming\d*\.climaaovivo\.com\.br\/[^"'\\\s]+\.m3u8[^"'\\\s]*/
  );
  return match ? match[0] : null;
}

export async function buscarCamerasClimaAoVivo(fetchImpl = globalThis.fetch) {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  const results = await Promise.allSettled(
    CAMERAS_CAV.map(async (cam) => {
      const r = await fetchImpl(`https://www.climaaovivo.com.br/${cam.slug}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return null;
      const html = await r.text();
      const streamUrl = extrairStream(html);
      if (!streamUrl) return null;
      return {
        ...cam,
        streamUrl,
        fonte: 'climaaovivo',
        fonteStream: 'climaaovivo',
      };
    })
  );

  const cameras = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  _cache = cameras;
  _cacheTime = Date.now();
  return cameras;
}
