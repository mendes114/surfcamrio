/**
 * Testa se as páginas de player do Monuv são acessíveis
 * para as 5 câmeras faltantes (sem token).
 *
 * Rode: node scripts/testar-monuv-player.mjs
 */

const CAMERAS = [
  { id: 87728, nome: 'Macumba Secreto' },
  { id: 87146, nome: 'Macumba 6W' },
  { id: 94293, nome: 'Macumba Farofa' },
  { id: 83726, nome: 'Canto do Recreio' },
  { id: 94292, nome: 'Canto do Recreio 2' },
];

for (const cam of CAMERAS) {
  const url = `https://app.monuv.com.br/api/camera/${cam.id}/player`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    const txt = await r.text();
    const m3u8 = txt.match(/https?:[^"'\s]*\.m3u8[^"'\s]*/);
    if (m3u8) {
      console.log(`✅ ${cam.nome} (${cam.id}): STREAM ENCONTRADO`);
      console.log(`   ${m3u8[0]}`);
    } else {
      console.log(`❌ ${cam.nome} (${cam.id}): ${r.status} — ${txt.substring(0, 120)}`);
    }
  } catch (e) {
    console.log(`❌ ${cam.nome} (${cam.id}): ERRO — ${e.message}`);
  }
}
