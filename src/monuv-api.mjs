/**
 * Busca streams via API pública do Monuv (endpoint player).
 * Tenta cada câmera que ainda não tem stream.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';

export async function buscarViaApiMonuv(camIds, fetchImpl = globalThis.fetch) {
  const results = new Map();
  const testes = camIds.map(camId => ({
    camId,
    test: (async () => {
      try {
        const r = await fetchImpl(
          `https://app.monuv.com.br/api/camera/${camId}/player`,
          {
            headers: { 'User-Agent': UA, Accept: 'text/html' },
            signal: AbortSignal.timeout(6000),
          }
        );
        if (!r.ok) return null;
        const html = await r.text();
        const m = html.match(/https?:[^"'\s]*\.m3u8[^"'\s]*/);
        return m ? m[0] : null;
      } catch { return null; }
    })()
  }));

  const settled = await Promise.allSettled(testes.map(t => t.test));
  for (let i = 0; i < testes.length; i++) {
    const url = settled[i].status === 'fulfilled' ? settled[i].value : null;
    if (url) results.set(testes[i].camId, url);
  }
  return results;
}
