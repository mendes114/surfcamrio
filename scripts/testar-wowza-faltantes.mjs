/**
 * Testa variações de nomes Wowza para as 5 câmeras faltantes:
 * - Macumba Secreto (camId 87728)
 * - Macumba 6W (camId 87146)
 * - Macumba Farofa (camId 94293)
 * - Canto do Recreio (camId 83726)
 * - Canto do Recreio 2 (camId 94292)
 *
 * Rode: node scripts/testar-wowza-faltantes.mjs
 */

const BASE = 'https://5a1e323a9ae38.streamlock.net/livecam/_definst_';

const NOMES = [
  // Secreto
  'cam_macumba_secreto.stream',
  'cam_secreto.stream',
  'cam_macumbasecreto.stream',
  'cam_macumba_secret.stream',
  'cam_secreto_macumba.stream',

  // 6W
  'cam_macumba_6w.stream',
  'cam_6w.stream',
  'cam_macumba6w.stream',

  // Farofa
  'cam_macumba_farofa.stream',
  'cam_farofa.stream',
  'cam_macumbafarofa.stream',
  'cam_macumbaforofa.stream',
  'cam_farofa_macumba.stream',

  // Canto do Recreio
  'cam_canto_do_recreio.stream',
  'cam_cantodorecreio.stream',
  'cam_canto_recreio.stream',
  'cam_recreio_canto.stream',
  'cam_cantinho.stream',
  'cam_canto.stream',
  'cam_pontal.stream',

  // Canto do Recreio 2
  'cam_cantodorecreioll.stream',
  'cam_canto_do_recreio_2.stream',
  'cam_cantodorecreio2.stream',
  'cam_recreio_canto2.stream',
  'cam_canto2.stream',
  'cam_cantinho2.stream',
  'cam_pontal2.stream',

  // 4W (já temos via Monuv, mas testar Wowza)
  'cam_macumba_4w.stream',
  'cam_4w.stream',
  'cam_macumba4w.stream',

  // Extras/variações criativas
  'cam_macumba_2w.stream',
  'cam_macumba_3w.stream',
  'cam_prainha_direita.stream',
  'cam_prainha_esquerda.stream',
  'cam_grumari.stream',
  'cam_grumari_1.stream',
  'cam_grumari_2.stream',

  // Rodada 2 — refs SurfView sem prefixo cam_
  'macumbasecreto.stream',
  'macumba6w.stream',
  'macumbaforofa.stream',
  'cantodorecreio.stream',
  'cantodorecreioll.stream',

  // Sufixos _fixa (padrão barra_fixa/leme_fixa)
  'cam_secreto_fixa.stream',
  'cam_canto_fixa.stream',
  'cam_farofa_fixa.stream',

  // Postos recreio
  'cam_recreio_p9.stream',
  'cam_recreio_p8.stream',
  'cam_recreio_9.stream',

  // Padrão ocean/lateral (como sancaocean)
  'cam_macumba_ocean.stream',
  'cam_macumba_lateral.stream',

  // Pedra do Pontal
  'cam_curvao.stream',
  'cam_pedra_do_pontal.stream',
  'cam_pedra_pontal.stream',

  // CDesign / posto9
  'cam_recreio_cdesign.stream',
  'cam_recreio_posto9.stream',

  // Nomes curtos
  'cam_secret.stream',
  'cam_farofa_rj.stream',

  // LL variations
  'cam_canto_do_recreio_ll.stream',
  'cam_recreio_ll.stream',

  // Diabo/pico vizinhos (pra ampliar)
  'cam_diabo.stream',
  'cam_praia_do_diabo.stream',
  'cam_ipanema.stream',
  'cam_ipanema_fixa.stream',
  'cam_leme_fixa.stream',
  'cam_itauna.stream',
];

async function testar(nome) {
  const url = `${BASE}/${nome}/playlist.m3u8`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const txt = r.ok ? await r.text() : '';
    const ok = r.ok && txt.includes('#EXTM3U');
    return { nome, status: r.status, ok };
  } catch (e) {
    return { nome, status: 'ERR', ok: false };
  }
}

console.log(`Testando ${NOMES.length} variações Wowza...\n`);

const resultados = await Promise.allSettled(NOMES.map(testar));
const achados = [];

for (const r of resultados) {
  if (r.status !== 'fulfilled') continue;
  const { nome, status, ok } = r.value;
  if (ok) {
    achados.push(nome);
    console.log(`✅ ENCONTRADO: ${nome}`);
  } else {
    console.log(`   ${status} ${nome}`);
  }
}

console.log(`\n--- Resultado ---`);
if (achados.length) {
  console.log(`Encontrados ${achados.length} streams:`);
  for (const n of achados) console.log(`  ${BASE}/${n}/playlist.m3u8`);
} else {
  console.log('Nenhum stream novo encontrado.');
  console.log('As 5 câmeras faltantes (Secreto, 6W, Farofa, Canto x2) são exclusivas do SurfView Premium via Monuv.');
}
