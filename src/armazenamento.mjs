import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Gerencia persistência local simples em JSON para chave da Windy API
 * e câmeras personalizadas adicionadas pelo usuário.
 */
export function criarArmazenamento(pastaDados) {
  const arquivoChave = join(pastaDados, '.windy-key.local.json');
  const arquivoCameras = join(pastaDados, 'cameras-salvas.json');

  async function lerJsonSeguro(caminho, padrao) {
    try {
      const conteudo = await readFile(caminho, 'utf8');
      return JSON.parse(conteudo);
    } catch {
      return padrao;
    }
  }

  async function gravarJsonSeguro(caminho, dados) {
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, JSON.stringify(dados, null, 2), 'utf8');
  }

  async function obterChaveWindy() {
    if (process.env.WINDY_API_KEY?.trim()) {
      return { chave: process.env.WINDY_API_KEY.trim(), origem: 'env' };
    }
    const salvo = await lerJsonSeguro(arquivoChave, null);
    if (salvo?.apiKey && typeof salvo.apiKey === 'string' && salvo.apiKey.trim()) {
      return { chave: salvo.apiKey.trim(), origem: 'arquivo' };
    }
    return { chave: '', origem: null };
  }

  async function salvarChaveWindy(chave) {
    const limpa = typeof chave === 'string' ? chave.trim() : '';
    await gravarJsonSeguro(arquivoChave, { apiKey: limpa });
    return Boolean(limpa);
  }

  async function listarCameras() {
    const lista = await lerJsonSeguro(arquivoCameras, []);
    return Array.isArray(lista) ? lista : [];
  }

  async function adicionarCamera(nova) {
    const lista = await listarCameras();
    const registro = {
      id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: nova.titulo,
      tipo: nova.tipo,
      valor: nova.valor,
      criadaEm: new Date().toISOString(),
    };
    lista.unshift(registro);
    await gravarJsonSeguro(arquivoCameras, lista);
    return registro;
  }

  async function removerCamera(id) {
    const lista = await listarCameras();
    const filtrada = lista.filter((item) => item.id !== id);
    if (filtrada.length === lista.length) return false;
    await gravarJsonSeguro(arquivoCameras, filtrada);
    return true;
  }

  return {
    obterChaveWindy,
    salvarChaveWindy,
    listarCameras,
    adicionarCamera,
    removerCamera,
  };
}
