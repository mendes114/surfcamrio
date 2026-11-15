import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PICOS,
  direcaoCardeal,
  extrairIdWindy,
  extrairIdYoutube,
  extrairUrlHls,
  montarUrlOpenMeteoMar,
  montarUrlOpenMeteoTempo,
  normalizarWebcamWindy,
} from '../src/picos.mjs';

describe('picos e utilitários', () => {
  it('contém os 3 picos de Recreio e Macumba com coordenadas válidas', () => {
    assert.equal(PICOS.length, 3);
    for (const pico of PICOS) {
      assert.ok(pico.latitude < -22 && pico.latitude > -24);
      assert.ok(pico.longitude < -43 && pico.longitude > -44);
    }
  });

  it('converte graus em direção cardinal', () => {
    assert.equal(direcaoCardeal(0), 'N');
    assert.equal(direcaoCardeal(90), 'L');
    assert.equal(direcaoCardeal(135), 'SE');
    assert.equal(direcaoCardeal(180), 'S');
    assert.equal(direcaoCardeal(225), 'SO');
    assert.equal(direcaoCardeal(360), 'N');
    assert.equal(direcaoCardeal(null), '—');
  });

  it('extrai ID do YouTube de URLs variadas e IDs diretos', () => {
    assert.equal(extrairIdYoutube('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extrairIdYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extrairIdYoutube('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
    assert.equal(extrairIdYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(extrairIdYoutube('https://exemplo.com/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(extrairIdYoutube('invalido'), null);
  });

  it('detecta URLs de stream HLS (.m3u8)', () => {
    assert.equal(
      extrairUrlHls('https://streaming2.climaaovivo.com.br/brasilia1.df/index.m3u8'),
      'https://streaming2.climaaovivo.com.br/brasilia1.df/index.m3u8'
    );
    assert.equal(
      extrairUrlHls('https://example.com/live/cam.m3u8'),
      'https://example.com/live/cam.m3u8'
    );
    assert.equal(extrairUrlHls('https://youtube.com/watch?v=abc'), null);
    assert.equal(extrairUrlHls('nao-eh-url'), null);
    assert.equal(extrairUrlHls(''), null);
    assert.equal(extrairUrlHls(null), null);
  });

  it('extrai ID numérico de webcam do Windy', () => {
    assert.equal(extrairIdWindy('1654321987'), '1654321987');
    assert.equal(extrairIdWindy('https://www.windy.com/webcams/1654321987'), '1654321987');
    assert.equal(
      extrairIdWindy('https://windy.com/webcams/south-america/brazil/1654321987'),
      '1654321987'
    );
    assert.equal(extrairIdWindy('https://outrosite.com/webcams/1654321987'), null);
    assert.equal(extrairIdWindy('abc'), null);
  });

  it('monta URLs válidas do Open-Meteo', () => {
    const urlMar = new URL(montarUrlOpenMeteoMar(-23.0335, -43.4895));
    assert.equal(urlMar.hostname, 'marine-api.open-meteo.com');
    assert.equal(urlMar.searchParams.get('latitude'), '-23.0335');

    const urlTempo = new URL(montarUrlOpenMeteoTempo(-23.0335, -43.4895));
    assert.equal(urlTempo.hostname, 'api.open-meteo.com');
    assert.equal(urlTempo.searchParams.get('timezone'), 'America/Sao_Paulo');
  });

  it('normaliza objeto da Windy Webcams API v3', () => {
    const cam = normalizarWebcamWindy({
      webcamId: 1234567,
      title: 'Rio Macumba Curvão',
      status: 'active',
      location: { city: 'Rio de Janeiro', region: 'RJ', latitude: -23.03, longitude: -43.48 },
      images: { current: { preview: 'https://img.windy.com/preview.jpg' } },
      player: { day: 'https://webcams.windy.com/day', live: 'https://webcams.windy.com/live' },
      urls: { detail: 'https://www.windy.com/webcams/1234567' },
    });

    assert.equal(cam.id, '1234567');
    assert.equal(cam.titulo, 'Rio Macumba Curvão');
    assert.equal(cam.imagemGrandeUrl, 'https://img.windy.com/preview.jpg');
    assert.equal(cam.playerLiveUrl, 'https://webcams.windy.com/live');
  });
});
