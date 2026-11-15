/**
 * Câmeras YouTube Live — extrai IDs de páginas SkylineWebcams
 * e inclui lives conhecidos do YouTube de praias do RJ.
 */

const CAMERAS_SKYLINE = [
  {
    id: 'sky-copacabana',
    titulo: 'Copacabana · Posto 6 (Panorama)',
    pageUrl: 'https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana-beach.html',
    zona: 'zona-sul',
  },
];

const CAMERAS_YOUTUBE = [
  {
    id: 'yt-copa-posto6',
    titulo: 'Copacabana · Posto 6',
    youtubeId: 'wyEi0OPai5g',
    zona: 'zona-sul',
  },
  {
    id: 'yt-copa-posto3',
    titulo: 'Copacabana · Posto 3',
    youtubeId: 'WEl_I5vmuSs',
    zona: 'zona-sul',
  },
];

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

export async function buscarCamerasSkyline(fetchImpl = globalThis.fetch) {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  const results = await Promise.allSettled(
    CAMERAS_SKYLINE.map(async (cam) => {
      const r = await fetchImpl(cam.pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return null;
      const html = await r.text();

      const ytMatch =
        html.match(/videoId['"]\s*:\s*['"]([A-Za-z0-9_-]{11})/) ||
        html.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
      if (!ytMatch) return null;

      return {
        ...cam,
        youtubeId: ytMatch[1],
        streamType: 'youtube',
        fonte: 'skyline',
      };
    })
  );

  const cameras = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  // Add known YouTube lives (verified by oEmbed)
  const ytResults = await Promise.allSettled(
    CAMERAS_YOUTUBE.map(async (cam) => {
      const r = await fetchImpl(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${cam.youtubeId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      return r.ok ? { ...cam, streamType: 'youtube', fonte: 'youtube' } : null;
    })
  );
  for (const r of ytResults) {
    if (r.status === 'fulfilled' && r.value) cameras.push(r.value);
  }

  _cache = cameras;
  _cacheTime = Date.now();
  return cameras;
}
