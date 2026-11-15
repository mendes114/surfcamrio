import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarArmazenamento } from './armazenamento.mjs';
import {
  PICOS,
  buscarStreamsSurfConnect,
  buscarStreamsSurfConnectZonaOeste,
  buscarStreamsSurfView,
  buscarWowzaOnline,
  direcaoCardeal,
  extrairIdYoutube,
  extrairUrlHls,
  montarUrlOpenMeteoMar,
  montarUrlOpenMeteoTempo,
} from './picos.mjs';
import { buscarCamerasClimaAoVivo } from './climaaovivo.mjs';
import { buscarCamerasSkyline } from './skyline.mjs';
import { buscarCamerasIframe } from './iframes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PASTA_RAIZ = resolve(__dirname, '..');
const PASTA_PUBLIC = join(PASTA_RAIZ, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function enviarJson(res, status, corpo) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(corpo));
}

async function lerCorpoJson(req, limiteBytes = 64 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limiteBytes) {
      throw Object.assign(new Error('Corpo da requisição excede o limite.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  const texto = Buffer.concat(chunks).toString('utf8').trim();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400 });
  }
}

async function buscarCondicoesPico(pico, fetchImpl) {
  const [resMar, resTempo] = await Promise.all([
    fetchImpl(montarUrlOpenMeteoMar(pico.latitude, pico.longitude), {
      signal: AbortSignal.timeout(10000),
    }),
    fetchImpl(montarUrlOpenMeteoTempo(pico.latitude, pico.longitude), {
      signal: AbortSignal.timeout(10000),
    }),
  ]);

  if (!resMar.ok) {
    throw new Error(`Open-Meteo Marine HTTP ${resMar.status}`);
  }
  if (!resTempo.ok) {
    throw new Error(`Open-Meteo Weather HTTP ${resTempo.status}`);
  }

  const dadosMar = await resMar.json();
  const dadosTempo = await resTempo.json();
  const marAtual = dadosMar?.current ?? {};
  const tempoAtual = dadosTempo?.current ?? {};
  const horaria = dadosMar?.hourly ?? {};
  const tempos = Array.isArray(horaria.time) ? horaria.time : [];

  const agoraIso = new Date().toISOString().slice(0, 13);
  let indiceInicio = tempos.findIndex((t) => t.slice(0, 13) >= agoraIso);
  if (indiceInicio < 0) indiceInicio = 0;

  const proximasHoras = [];
  for (let i = indiceInicio; i < Math.min(indiceInicio + 12, tempos.length); i++) {
    const dir = horaria.wave_direction?.[i] ?? null;
    proximasHoras.push({
      hora: tempos[i],
      alturaOndaM: horaria.wave_height?.[i] ?? null,
      alturaSwellM: horaria.swell_wave_height?.[i] ?? null,
      periodoSwellS: horaria.swell_wave_period?.[i] ?? null,
      direcaoGraus: dir,
      direcaoCardeal: direcaoCardeal(dir),
    });
  }

  return {
    id: pico.id,
    nome: pico.nome,
    bairro: pico.bairro,
    latitude: pico.latitude,
    longitude: pico.longitude,
    atualizadoEm: marAtual.time || tempoAtual.time || new Date().toISOString(),
    onda: {
      alturaM: marAtual.wave_height ?? null,
      direcaoGraus: marAtual.wave_direction ?? null,
      direcaoCardeal: direcaoCardeal(marAtual.wave_direction),
      periodoS: marAtual.wave_period ?? null,
      swellAlturaM: marAtual.swell_wave_height ?? null,
      swellDirecaoGraus: marAtual.swell_wave_direction ?? null,
      swellDirecaoCardeal: direcaoCardeal(marAtual.swell_wave_direction),
      swellPeriodoS: marAtual.swell_wave_period ?? null,
      temperaturaAguaC: marAtual.sea_surface_temperature ?? null,
    },
    tempo: {
      temperaturaArC: tempoAtual.temperature_2m ?? null,
      ventoKmh: tempoAtual.wind_speed_10m ?? null,
      ventoDirecaoGraus: tempoAtual.wind_direction_10m ?? null,
      ventoDirecaoCardeal: direcaoCardeal(tempoAtual.wind_direction_10m),
      codigoTempo: tempoAtual.weather_code ?? null,
    },
    proximasHoras,
  };
}

export function criarServidor({
  pastaDados = PASTA_RAIZ,
  pastaPublic = PASTA_PUBLIC,
  fetchImpl = globalThis.fetch,
} = {}) {
  const armazenamento = criarArmazenamento(pastaDados);

  async function tratarRequisicao(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const caminho = url.pathname;
    const metodo = req.method || 'GET';

    try {
      if (metodo === 'GET' && caminho === '/api/saude') {
        return enviarJson(res, 200, { ok: true, servico: 'cameras-recreio-macumba' });
      }

      if (metodo === 'GET' && caminho === '/api/mar') {
        const resultados = await Promise.allSettled(
          PICOS.map((pico) => buscarCondicoesPico(pico, fetchImpl))
        );
        const picos = resultados.map((r, idx) =>
          r.status === 'fulfilled'
            ? r.value
            : {
                ...PICOS[idx],
                erro: r.reason?.message || 'Falha ao consultar dados do mar',
              }
        );
        return enviarJson(res, 200, { picos, fonte: 'Open-Meteo Marine & Weather API' });
      }

      if (metodo === 'GET' && caminho === '/api/macumba') {
        try {
          const cameras = await buscarWowzaOnline(fetchImpl);
          return enviarJson(res, 200, { cameras });
        } catch (erro) {
          return enviarJson(res, 502, { erro: erro?.message || 'Falha ao testar Wowza.' });
        }
      }

      if (metodo === 'GET' && caminho === '/api/surfview') {
        try {
          const cameras = await buscarStreamsSurfView(fetchImpl);
          try {
            const { enhanceCameras } = await import('./stream-enhancer.mjs');
            await enhanceCameras(cameras, fetchImpl);
          } catch {}
          return enviarJson(res, 200, { total: cameras.length, cameras });
        } catch (erro) {
          return enviarJson(res, 502, {
            erro: erro?.message || 'Falha ao buscar dados do SurfView.',
          });
        }
      }

      if (metodo === 'GET' && caminho === '/api/climaaovivo') {
        try {
          const cameras = await buscarCamerasClimaAoVivo(fetchImpl);
          return enviarJson(res, 200, { total: cameras.length, cameras });
        } catch (erro) {
          return enviarJson(res, 502, {
            erro: erro?.message || 'Falha ao buscar Clima ao Vivo.',
          });
        }
      }

      if (metodo === 'GET' && caminho === '/api/skyline') {
        try {
          const cameras = await buscarCamerasSkyline(fetchImpl);
          return enviarJson(res, 200, { total: cameras.length, cameras });
        } catch (erro) {
          return enviarJson(res, 502, {
            erro: erro?.message || 'Falha ao buscar SkylineWebcams.',
          });
        }
      }

      if (metodo === 'GET' && caminho === '/api/iframes') {
        const cameras = buscarCamerasIframe();
        return enviarJson(res, 200, { total: cameras.length, cameras });
      }

      if (metodo === 'GET' && caminho === '/api/surfconnect') {
        try {
          const cameras = await buscarStreamsSurfConnectZonaOeste(fetchImpl);
          return enviarJson(res, 200, { total: cameras.length, cameras });
        } catch (erro) {
          return enviarJson(res, 502, {
            erro: erro?.message || 'Falha ao buscar streams do SurfConnect.',
          });
        }
      }

      if (metodo === 'GET' && caminho === '/api/cameras') {
        const cameras = await armazenamento.listarCameras();
        return enviarJson(res, 200, { cameras });
      }

      if (metodo === 'POST' && caminho === '/api/cameras') {
        const corpo = await lerCorpoJson(req);
        const titulo = typeof corpo?.titulo === 'string' ? corpo.titulo.trim() : '';
        const entrada = typeof corpo?.entrada === 'string' ? corpo.entrada.trim() : '';

        if (!titulo || !entrada) {
          return enviarJson(res, 400, {
            erro: 'Informe um título e o link/ID da live do YouTube ou webcam do Windy.',
          });
        }

        const urlHls = extrairUrlHls(entrada);
        if (urlHls) {
          const camera = await armazenamento.adicionarCamera({
            titulo: titulo.slice(0, 80),
            tipo: 'hls',
            valor: urlHls,
          });
          return enviarJson(res, 201, { camera });
        }

        const idYoutube = extrairIdYoutube(entrada);
        if (idYoutube) {
          const camera = await armazenamento.adicionarCamera({
            titulo: titulo.slice(0, 80),
            tipo: 'youtube',
            valor: idYoutube,
          });
          return enviarJson(res, 201, { camera });
        }

        try {
          const parsed = new URL(entrada);
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            const camera = await armazenamento.adicionarCamera({
              titulo: titulo.slice(0, 80),
              tipo: 'iframe',
              valor: parsed.toString(),
            });
            return enviarJson(res, 201, { camera });
          }
        } catch {}

        return enviarJson(res, 400, {
          erro: 'Link não reconhecido. Cole uma URL .m3u8 (HLS), link do YouTube Live, ID do Windy ou URL de player (iframe).',
        });
      }

      if (metodo === 'DELETE' && caminho.startsWith('/api/cameras/')) {
        const id = decodeURIComponent(caminho.slice('/api/cameras/'.length));
        const removida = await armazenamento.removerCamera(id);
        if (!removida) {
          return enviarJson(res, 404, { erro: 'Câmera não encontrada.' });
        }
        return enviarJson(res, 200, { ok: true });
      }

      // Servir arquivos estáticos de public/
      if (metodo === 'GET' || metodo === 'HEAD') {
        const relativo = caminho === '/' ? 'index.html' : caminho.replace(/^\/+/, '');
        const resolvido = resolve(pastaPublic, relativo);
        if (!resolvido.startsWith(resolve(pastaPublic))) {
          res.writeHead(403);
          return res.end('Acesso negado');
        }
        try {
          const conteudo = await readFile(resolvido);
          const ext = extname(resolvido).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
          });
          return res.end(metodo === 'HEAD' ? undefined : conteudo);
        } catch {
          res.writeHead(404);
          return res.end('Arquivo não encontrado');
        }
      }

      return enviarJson(res, 405, { erro: 'Método não permitido' });
    } catch (erro) {
      const status = erro?.status || 500;
      return enviarJson(res, status, {
        erro: erro?.message || 'Erro interno no servidor',
      });
    }
  }

  return createServer(tratarRequisicao);
}

const executadoDireto =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  const porta = Number(process.env.PORT) || 3456;
  const servidor = criarServidor();
  servidor.listen(porta, '127.0.0.1', () => {
    console.log(`Painel Recreio & Macumba no ar em http://127.0.0.1:${porta}`);
  });
}
