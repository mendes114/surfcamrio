import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarServidor } from '../src/server.mjs';

describe('servidor HTTP do painel', () => {
  let pastaTemp;
  let servidor;
  let baseUrl;
  let fetchMock;

  beforeEach(async () => {
    pastaTemp = await mkdtemp(join(tmpdir(), 'praia-cams-test-'));
    fetchMock = async (url) => {
      const u = String(url);
      if (u.startsWith('https://marine-api.open-meteo.com')) {
        return new Response(
          JSON.stringify({
            current: {
              time: '2026-11-13T21:00',
              wave_height: 1.4,
              wave_direction: 175,
              wave_period: 11,
              swell_wave_height: 1.1,
              swell_wave_direction: 180,
              swell_wave_period: 12,
              sea_surface_temperature: 23.5,
            },
            hourly: {
              time: ['2026-11-13T21:00', '2026-11-13T22:00'],
              wave_height: [1.4, 1.5],
              swell_wave_height: [1.1, 1.2],
              swell_wave_period: [12, 12],
              wave_direction: [175, 180],
            },
          }),
          { status: 200 }
        );
      }
      if (u.startsWith('https://api.open-meteo.com')) {
        return new Response(
          JSON.stringify({
            current: {
              time: '2026-11-13T21:00',
              temperature_2m: 25.2,
              wind_speed_10m: 14.5,
              wind_direction_10m: 135,
              weather_code: 1,
            },
          }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    };

    servidor = criarServidor({ pastaDados: pastaTemp, fetchImpl: fetchMock });
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    const { port } = servidor.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => servidor.close(resolve));
    await rm(pastaTemp, { recursive: true, force: true });
  });

  it('responde healthcheck e HTML principal', async () => {
    const resSaude = await fetch(`${baseUrl}/api/saude`);
    assert.equal(resSaude.status, 200);
    const json = await resSaude.json();
    assert.equal(json.ok, true);

    const resHtml = await fetch(`${baseUrl}/`);
    assert.equal(resHtml.status, 200);
    const html = await resHtml.text();
    assert.match(html, /Macumba.*Recreio/);
  });

  it('retorna condições do mar dos 3 picos via /api/mar', async () => {
    const res = await fetch(`${baseUrl}/api/mar`);
    assert.equal(res.status, 200);
    const dados = await res.json();
    assert.equal(dados.picos.length, 3);
    assert.equal(dados.picos[0].onda.alturaM, 1.4);
    assert.equal(dados.picos[0].onda.direcaoCardeal, 'S');
    assert.equal(dados.picos[0].tempo.ventoDirecaoCardeal, 'SE');
  });

  it('cadastra, lista e remove câmeras personalizadas', async () => {
    const resVazia = await fetch(`${baseUrl}/api/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: '', entrada: '' }),
    });
    assert.equal(resVazia.status, 400);

    const resYt = await fetch(`${baseUrl}/api/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: 'Macumba Live',
        entrada: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    assert.equal(resYt.status, 201);
    const { camera } = await resYt.json();
    assert.equal(camera.tipo, 'youtube');
    assert.equal(camera.valor, 'dQw4w9WgXcQ');

    const resLista = await fetch(`${baseUrl}/api/cameras`);
    const lista = await resLista.json();
    assert.equal(lista.cameras.length, 1);

    const resDel = await fetch(`${baseUrl}/api/cameras/${camera.id}`, { method: 'DELETE' });
    assert.equal(resDel.status, 200);

    const resListaDepois = await fetch(`${baseUrl}/api/cameras`);
    const listaDepois = await resListaDepois.json();
    assert.equal(listaDepois.cameras.length, 0);
  });

  it('aceita URLs genéricas como iframe', async () => {
    const res = await fetch(`${baseUrl}/api/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: 'Player Embed', entrada: 'https://player.example.com/live' }),
    });
    assert.equal(res.status, 201);
    const { camera } = await res.json();
    assert.equal(camera.tipo, 'iframe');
  });

  it('/api/macumba retorna lista de Wowza (todas offline no mock)', async () => {
    const res = await fetch(`${baseUrl}/api/macumba`);
    assert.equal(res.status, 200);
    const dados = await res.json();
    assert.ok(Array.isArray(dados.cameras));
    assert.equal(dados.cameras.length, 0);
  });
});
