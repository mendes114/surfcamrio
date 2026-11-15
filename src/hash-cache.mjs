/**
 * Cache persistente de hashes Monuv descobertos na homepage do SurfView.
 * Salva em disco para sobreviver a reinícios do servidor.
 * Os hashes são vinculados por câmera e expiram após TTL.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, '..', 'data', 'hash-cache.json');
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — hashes Monuv costumam durar ~1 dia

let cache = loadCache();

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache() {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {}
}

export function guardarHash(camId, hash) {
  cache[camId] = { hash, ts: Date.now() };
  saveCache();
}

export function buscarHash(camId) {
  const entry = cache[camId];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    delete cache[camId];
    saveCache();
    return null;
  }
  return entry.hash;
}

export function todosHashes() {
  const agora = Date.now();
  const validos = new Map();
  for (const [camId, entry] of Object.entries(cache)) {
    if (agora - entry.ts <= TTL_MS) {
      validos.set(Number(camId), entry.hash);
    }
  }
  return validos;
}

export function guardarVarios(hashMap) {
  for (const [camId, hash] of hashMap) {
    cache[camId] = { hash, ts: Date.now() };
  }
  saveCache();
}
